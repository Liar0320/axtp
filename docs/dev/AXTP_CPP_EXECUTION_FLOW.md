# AXTP C++ Execution Flow

本文档描述当前 C++ runtime、SDK 和 CLI 的端到端执行流程。代码架构见 `runtimes/cpp/core/ARCHITECTURE.md`，命名规范见 `docs/dev/AXTP_CPP_STYLE.md`，设计模式见 `docs/dev/AXTP_CPP_RUNTIME_PATTERNS.md`。

## Common Runtime Lifecycle

普通应用推荐生命周期：

```text
construct BasicBroker<> broker
construct AxtpEndpoint endpoint(broker)
construct or receive an ITransport implementation

endpoint.attachTransport(transport)
transport.open()

while running:
  poll the concrete transport if it exposes ManualPoll
  endpoint.poll()

transport.close()
endpoint.detachTransport()
```

实际 `ITransport` 接口没有强制 `poll()`，因为不同 transport 可以用不同平台机制。当前 HID 和测试 transport 使用 ManualPoll；SDK/工具层负责识别 concrete transport 的轮询入口。

## FramedBinary Inbound Request

FramedBinary 入口是字节流或二进制消息。transport 不解析 AXTP，只把 bytes 交给 endpoint 绑定的 sink。

```mermaid
sequenceDiagram
    participant T as ITransport
    participant E as AxtpEndpoint
    participant C as AxtpCore
    participant I as InboundProcessor
    participant B as BasicBroker
    participant O as OutboundProcessor

    T->>E: onBytes(frame bytes)
    E->>C: byteSink().onBytes()
    C->>I: FrameDecoder -> MessageReassembler -> PayloadDecoder
    I->>C: RpcPayload(Request)
    C-->>E: pollEvent() = CoreEvent::RpcRequest
    E->>B: submit(BrokerTask)
    E->>B: poll(maxTasks)
    B-->>E: pollResult() = BrokerResult::RpcResponse/RpcError
    E->>C: handleBrokerResult()
    C->>O: PayloadEncoder -> MessageFragmenter -> FrameEncoder
    C-->>E: tryPopOutboundBytes()
    E->>T: sendBytes(response frames)
```

Key points:

- `FrameDecoder` 可以接收 split bytes；重组在 core pipeline 内完成。
- `AxtpCore` 不执行 handler，只输出 `CoreEvent`。
- `BasicBroker<>` 不知道 frame/header/CRC。
- `AxtpEndpoint::poll()` 是事件和结果搬运点。

## WebSocketJsonRpc Text Flow

WebSocketJsonRpc 是正式 AXTP wire mode，输入是一条完整 UTF-8 text message：

```json
{"sid":"...","op":7,"d":{"id":1,"method":"audio.getAlgorithmConfig","params":{}}}
```

执行路径：

```text
WebSocket text message bytes
  -> ITransport::bind sink
  -> AxtpEndpoint::onTransportBytes()
  -> AxtpCore::byteSink()
  -> JsonRpcDecoder
  -> RpcPayload
  -> CoreEvent
  -> BasicBroker<>
  -> BrokerResult
  -> JsonRpcEncoder
  -> UTF-8 JSON response bytes
  -> ITransport::sendBytes()
```

Rules:

- WebSocketJsonRpc 不走 AX Standard Frame、CRC、message fragmentation。
- `params/result/data` 作为 UTF-8 JSON bytes 存在 `RpcPayload.body` 中。
- method/event/error name 通过 generated registry lookup 解析。
- 若继续使用 `IByteSink::onBytes()`，每次调用必须是一条完整 text message。

## Client Dynamic Call Flow

SDK client 默认动态 RPC：

```text
AxtpClient::callJson("audio.getAlgorithmConfig", "{}")
  -> MethodRegistry::findMethodId()
  -> RpcPayload{op=Request, encoding=Json, body="{}"}
  -> AxtpEndpoint::sendRpcRequest()
  -> AxtpCore::expectRpcResponse()
  -> AxtpCore::sendRpcRequest()
  -> outbound bytes
  -> transport.sendBytes()
  -> poll loop until tryTakeRpcResponse(requestId)
```

If a local mock handler is registered on `AxtpClient`, `callRaw()` may return without transport I/O. Otherwise the client requires an attached transport and a poll loop.

Typed calls follow the same path:

```text
typed request -> SchemaCodec -> callRaw -> response bytes -> SchemaCodec -> typed response
```

Typed API must not bypass dynamic/raw RPC.

## Server Flow

SDK server wraps endpoint + broker:

```text
AxtpServer::attachTransport()
  -> transport.open()
  -> endpoint.attachTransport()

AxtpServer::onJson(name, handler)
  -> BasicBroker::registerJsonMethod(name, handler)

AxtpServer::poll()
  -> endpoint.poll()
  -> broker handler dispatch
  -> core response encode
  -> transport.sendBytes()
```

`AxtpServer` is intentionally thin. Full multi-connection routing, session tables, subscription filters, and async I/O are future layers above endpoint/core/broker.

## HID Transport Flow

HID transport is the first real concrete transport and follows the transport-boundary rule:

```text
poll()
  -> backend read input report
  -> check reportId
  -> strip reportId slot
  -> sink.onBytes(report payload, including padding)

sendBytes(bytes)
  -> split by outputReportSize - 1
  -> write [reportId][chunk][zero padding]
```

HID transport does not strip inbound trailing zero padding because it cannot know AXTP payload length. FramedBinary decoder performs length-based parsing and resync.

## CLI Command Flow

Normal CLI command flow:

```text
argv
  -> parse global options and command
  -> load generated/default MethodRegistry
  -> optionally merge --registry-file
  -> construct AxtpClient
  -> attach mock or optional concrete transport
  -> execute SDK dynamic call
  -> format output as json/hex/file
```

`inspect` commands are the exception: they may directly parse AXTP frame bytes for diagnostics. Regular `call`, `ping`, `capability`, `event`, and future `stream` commands should stay at SDK level.

## Direct Core Flow

Advanced users can bypass endpoint and broker:

```cpp
axtp::AxtpCore core;
core.configure(profile);
core.byteSink().onBytes(data, size);

while (auto event = core.pollEvent()) {
    // Inspect or convert event yourself.
}

core.handleBrokerResult(result);

while (auto bytes = core.tryPopOutboundBytes()) {
    writer.writeBytes(bytes->data(), bytes->size());
}
```

Direct core usage is useful for fuzzing, protocol conformance tests, or embedding AXTP in an existing scheduler. Application code that wants normal request/response dispatch should use `AxtpEndpoint + BasicBroker<>`.

## Poll Ordering

Recommended tick order when using ManualPoll transports:

1. Poll transport/platform source to feed incoming bytes into endpoint.
2. Call `endpoint.poll(maxTasks)` to drain core events, run broker work, feed results back, and flush outbound bytes.
3. Repeat at the application scheduler rate.

Within `endpoint.poll()` the order is intentionally stable:

```text
drainCoreEvents()
broker.poll(maxTasks)
drainBrokerResults()
flushOutbound()
```

This keeps request handling deterministic and makes unit tests independent of threads.

## Error And Status Flow

- Wire/protocol errors should be represented as `CoreEventType::ProtocolError` or status/error payloads.
- Business errors should return `RpcResponseData` with a non-success `ErrorCode`; broker converts that into `BrokerResult::rpcError()`.
- Core decides how the selected wire mode encodes the error response.
- Transport read/write failures should not throw through core; they are platform diagnostics handled by the concrete transport or SDK/tool layer.
