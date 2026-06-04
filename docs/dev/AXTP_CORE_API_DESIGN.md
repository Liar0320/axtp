# AXTP Core API Design

## Summary

`runtimes/cpp/core` is the protocol-correct C++ runtime layer. It owns AXTP model types, byte IO interfaces, FramedBinary parsing/encoding, WebSocketJsonRpc text JSON parsing/encoding, core protocol state, transport profiles, and runtime lookup helpers. It does not expose business-friendly client APIs, platform transports, concrete HID/TCP/WebSocket dependencies, or legacy AXDP adapters.

The core runtime supports two AXTP v1 wire paths:

| Wire mode | Inbound path | Outbound path |
|---|---|---|
| `FramedBinary` | `FrameDecoder -> MessageReassembler -> PayloadDecoder -> IPayloadSink` | `PayloadEncoder -> MessageFragmenter -> FrameEncoder -> IByteWriter` |
| `WebSocketJsonRpc` | complete text message -> `JsonRpcDecoder -> IPayloadSink` | `JsonRpcEncoder -> IByteWriter` |

`WebSocketJsonRpc` is an AXTP protocol profile, not a compatibility or legacy layer. Legacy protocol adapters must live outside cpp/core and depend on it.

The runtime layering is:

```text
ITransport <-> AxtpEndpoint -> AxtpCore -> BasicBroker
```

`AxtpEndpoint` is the only glue layer. `AxtpCore` emits `CoreEvent`, accepts `BrokerResult`, and produces outbound bytes. `BasicBroker<>` accepts `BrokerTask`, dispatches handlers, and queues `BrokerResult`.

Related code-design documents:

| Document | Purpose |
|---|---|
| `docs/dev/AXTP_CPP_RUNTIME_PATTERNS.md` | Runtime design patterns, extension recipes, and anti-patterns |
| `docs/dev/AXTP_CPP_EXECUTION_FLOW.md` | FramedBinary, WebSocketJsonRpc, SDK, CLI, HID, and direct-core execution flows |
| `docs/dev/AXTP_CPP_STYLE.md` | Naming, file layout, include rules, formatting, and layer boundaries |

## Public API Surface

Core public headers are grouped by responsibility:

| Area | Purpose |
|---|---|
| `axtp/model/*` | Bytes, status/result, frame, message, payload, protocol constants and enums |
| `axtp/io/*` | byte sinks/writers, optional text writer, transport packet boundary types |
| `axtp/core/inbound/*` | FramedBinary and WebSocketJsonRpc inbound processors |
| `axtp/core/outbound/*` | FramedBinary and WebSocketJsonRpc outbound processors |
| `axtp/core/*` | `AxtpCore`, `CoreEvent`, session helpers, pending calls |
| `axtp/transport/*` | transport interface and profile only |
| `axtp/broker/*` | `BasicBroker<>`, task dispatch, business routing, result queue |
| `axtp/runtime/*` | `AxtpEndpoint` glue and endpoint ports |
| `axtp/generated/*` | generated IDs, dynamic registries, lookup helpers |

The aggregate include is:

```cpp
#include <axtp/axtp.hpp>
```

This header is the runtime entry point. It intentionally excludes HID/TCP/WebSocket concrete transports, `MockTransport`, and schema-aware typed codecs. `axtp/axtp_core_all.hpp` remains as a compatibility wrapper over the same entry point.

## Core API Contract

`AxtpCore` is usable without endpoint, broker, SDK, or transport:

```cpp
axtp::AxtpCore core;
core.configure(profile);
core.byteSink().onBytes(data, size);

while (auto event = core.pollEvent()) {
    // Convert CoreEvent to your scheduler or broker.
}

core.handleBrokerResult(result);

while (auto bytes = core.tryPopOutboundBytes()) {
    writer.writeBytes(bytes->data(), bytes->size());
}
```

Stable core operations:

| API | Responsibility |
|---|---|
| `configure(profile)` | Select wire mode and frame sizing from `TransportProfile` |
| `byteSink()` | Return the byte ingress port for transport/adapter bytes |
| `pollEvent()` | Pop normalized protocol events for broker/application routing |
| `handleBrokerResult(result)` | Feed business result/event/stream output back to core |
| `tryPopOutboundBytes()` | Pop encoded outbound bytes for the selected wire mode |
| `expectRpcResponse(requestId)` | Track client-side pending RPC requests |
| `tryTakeRpcResponse(requestId)` | Retrieve a resolved client-side RPC response |

`AxtpCore` does not provide `attachTransport()` or `attachBroker()`. That wiring belongs to `AxtpEndpoint`.

## IO Boundary

The existing byte-stream interfaces remain the stable baseline:

```cpp
class IByteSink {
public:
    virtual ~IByteSink() = default;
    virtual void onBytes(const Byte* data, std::size_t size) = 0;
};

class IByteWriter {
public:
    virtual ~IByteWriter() = default;
    virtual void writeBytes(const Byte* data, std::size_t size) = 0;
};
```

Two additional interfaces describe message-oriented transports without breaking existing code:

```cpp
class ITextWriter {
public:
    virtual ~ITextWriter() = default;
    virtual void writeText(const char* data, std::size_t size) = 0;
};

enum class TransportPacketKind {
    ByteStreamChunk,
    BinaryMessage,
    TextMessage,
};

struct TransportPacket {
    TransportPacketKind kind = TransportPacketKind::ByteStreamChunk;
    const Byte* data = nullptr;
    std::size_t size = 0;
};

class ITransportSink {
public:
    virtual ~ITransportSink() = default;
    virtual void onTransportPacket(const TransportPacket& packet) = 0;
};
```

For P0, `WebSocketJsonRpc` reuses `IByteSink::onBytes()`, but each call must contain one complete UTF-8 WebSocket text message.

## Dynamic RPC First

Core treats RPC bodies as bytes. `RpcEncoding` describes those bytes:

- `Json`: UTF-8 JSON business object bytes.
- `Tlv`: AXTP TLV business body bytes.
- `Raw`: uninterpreted business bytes.
- `Binary`: deprecated compatibility name; new code should avoid it.

`MethodRegistry` is runtime data and can be loaded from generated defaults or extended at runtime. JSON file loading is provided by optional `axtp_json_rpc` through `axtp/json_rpc/method_registry_json.hpp`.

Generated typed traits and schema codecs remain optional convenience headers. They are not included by `<axtp/axtp.hpp>` and must not be required by core routing.

## Current Boundaries

- `AxtpCore` handles `ControlPayload`, `RpcPayload`, and `StreamPayload` only.
- `AxtpCore` does not know `ITransport`, concrete transports, or `BasicBroker<>`.
- `BasicBroker<>` does not know `AxtpCore` and never calls back into it.
- `AxtpEndpoint` is responsible for `attachTransport()`, `poll()`, and `flushOutbound()`.
- `AxtpCore` does not parse business JSON directly; JSON-RPC parsing belongs to the wire adapter/decoder.
- `AxtpCore` does not call `SchemaCodec`, `MethodTraits`, or business request/response structs.
- `AxtpCore` does not know legacy command IDs or AXDP framing.
- TCP/WebSocket/HID classes are optional targets under `runtimes/cpp/transports`, not part of `axtp_core`.

## Implementation Patterns

- Use `AxtpEndpoint` for glue between transport, core, and broker.
- Use core port adapters and queues instead of exposing processor internals.
- Use `CoreEvent -> BrokerTask -> BrokerResult` for business dispatch.
- Keep transports at the report/socket/message boundary; they must not parse payload semantics.
- Keep typed generated APIs above raw/dynamic RPC.
- Add new wire parsing through decoder/encoder components before routing it through core.

See `docs/dev/AXTP_CPP_RUNTIME_PATTERNS.md` for the full pattern list and extension recipes.
