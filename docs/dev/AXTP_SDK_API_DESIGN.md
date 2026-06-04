# AXTP SDK API Design

## Summary

`runtimes/cpp/sdk` is the C++ application-facing layer built on top of `runtimes/cpp/core`. It hides Frame/Message/Payload internals and exposes client/server, endpoint, call, event, capability, and typed method helpers.

The SDK uses the runtime layering directly:

```text
ITransport <-> AxtpEndpoint -> AxtpCore -> BasicBroker
```

Client and server wrappers own `BasicBroker<>` plus `AxtpEndpoint`; they do not wire transports directly into `AxtpCore`.

The SDK is dynamic-RPC first. It supports three API levels:

| Level | Shape | Purpose |
|---|---|---|
| Raw API | methodId + encoding + body bytes | Debug, vendor private methods, bridging |
| Dynamic API | methodName + JSON/TLV body | Default extension-friendly app API |
| Typed API | generated request/response structs | Optional stable-domain convenience |

The SDK P0 goal is a buildable vertical slice:

- construct a client or server object,
- attach a transport or use a local mock handler,
- call methods by ID or name through `callJson`, `callTlv`, and `callRaw`,
- keep typed calls as wrappers over raw dynamic calls,
- provide generated domain client facades for common device/display/capability operations.

Real asynchronous network connection management, full event subscriptions, stream helpers, and full generated schema-aware codecs are P1/P2.

Related implementation documents:

| Document | Purpose |
|---|---|
| `docs/dev/AXTP_CPP_EXECUTION_FLOW.md` | Client/server call flow, endpoint polling, and CLI flow |
| `docs/dev/AXTP_CPP_RUNTIME_PATTERNS.md` | Dynamic RPC, endpoint glue, transport boundary, and extension recipes |
| `docs/dev/AXTP_CPP_STYLE.md` | C++ naming, include, formatting, and ownership rules |

## Package Layout

```text
runtimes/cpp/sdk/
  include/
    axtp_client.hpp
    axtp_server.hpp
    axtp_device.hpp
    client_options.hpp
    endpoints.hpp
    call_options.hpp
    event_subscription.hpp
    capability_client.hpp
    stream_client.hpp
    sdk_error.hpp
    sdk_result.hpp
    generated/
      audio_client.h
    axtp_sdk_all.hpp
  tests/
```

The SDK namespace is `axtp::sdk`.

## Client API

P0 client entry points:

```cpp
class AxtpClient {
public:
    explicit AxtpClient(ClientOptions options = {});

    void attachTransport(std::unique_ptr<ITransport> transport);
    void connect(const TcpEndpoint& endpoint);
    void connect(const WebSocketEndpoint& endpoint);
    void connect(const HidEndpoint& endpoint);
    void connect(const BleEndpoint& endpoint);
    void connect(const UartEndpoint& endpoint);
    void close();
    bool isConnected() const;
    const SdkError& lastError() const;
    void poll();

    MethodRegistry& registry();
    const MethodRegistry& registry() const;

    RpcPayload callRaw(RpcPayload request, CallOptions options = {});
    Bytes callRaw(std::uint32_t methodId, RpcEncoding encoding, Bytes body, CallOptions options = {});
    std::string callJson(std::string_view methodName, std::string_view paramsJson, CallOptions options = {});
    std::string callJson(std::uint32_t methodId, std::string_view paramsJson, CallOptions options = {});
    Bytes callTlv(std::string_view methodName, Bytes tlvBody, CallOptions options = {});
    Bytes callTlv(std::uint32_t methodId, Bytes tlvBody, CallOptions options = {});
    Bytes callRawBytes(std::uint32_t methodId, Bytes body, CallOptions options = {});

    template <MethodId Id>
    typename MethodTraits<Id>::Response callTyped(
        const typename MethodTraits<Id>::Request& request,
        CallOptions options = {});
};
```

`callJson(methodName, paramsJson)` resolves the method name through `MethodRegistry`, puts only the business params object into `RpcPayload.body`, and does not require generated C++ request types. Typed calls are convenience wrappers: typed request -> schema codec -> `callRaw` -> schema codec -> typed response.

## Server API

P0 server entry points:

```cpp
class AxtpServer {
public:
    void attachTransport(std::unique_ptr<ITransport> transport);
    void close();
    void poll();

    void onRaw(std::uint32_t methodId, std::function<Bytes(const RpcPayload&)> handler);
    void onJson(std::string_view methodName, JsonRpcHandler handler);
    void onTlv(std::string_view methodName, TlvRpcHandler handler);
    void emitRaw(RpcPayload payload);
};
```

The server API is a thin ergonomic wrapper over `BasicBroker<>` and `AxtpEndpoint`. It should prefer `onJson`, `onTlv`, and `onRaw`; typed handlers are optional generator output. Full multi-connection routing remains out of scope for P0.

## Domain Clients

Generated-style facades provide discoverable methods:

```cpp
AxtpClient client;
AxtpDevice device(client);

auto config = device.audio.getAlgorithmConfig();
device.audio.setAlgorithmConfig(request);
```

These facades are hand-written P0 placeholders matching the currently adopted protocol surface. A later generator update should emit the full set from the protocol registry, but adding a new business method should not require recompiling the SDK if the caller can provide method name/id plus JSON/TLV/Raw body.

## Endpoint And Options

Endpoints are value types:

- `TcpEndpoint { host, port }`
- `WebSocketEndpoint { url, wireMode }`
- `HidEndpoint { vendorId, productId, serialNumber }`
- `BleEndpoint { deviceId, serviceUuid, characteristicUuid }`
- `UartEndpoint { path, baudRate }`

P0 transport creation is intentionally limited because current cpp/core TCP/WebSocket classes are server-oriented test transports. Production client connectors will be added after the core transport abstraction grows a client connection API.

## Execution Flow

`AxtpClient::callJson()` and other dynamic calls follow this path:

```text
method name/id + params/body
  -> MethodRegistry lookup
  -> RpcPayload
  -> AxtpEndpoint::sendRpcRequest()
  -> AxtpCore outbound encode
  -> ITransport::sendBytes()
  -> poll loop
  -> AxtpCore pending response table
  -> SDK result bytes/string/typed response
```

`AxtpServer::poll()` follows this path:

```text
transport bytes
  -> AxtpEndpoint
  -> AxtpCore
  -> CoreEvent
  -> BasicBroker<> handler
  -> BrokerResult
  -> AxtpCore response encode
  -> transport sendBytes()
```

SDK wrappers must keep this direction. They may own endpoint, broker, and transport objects, but they should not make `AxtpCore` aware of SDK abstractions.

## Connector Boundary

`attachTransport(std::unique_ptr<ITransport>)` is the stable P0 path. Endpoint value types such as `TcpEndpoint`, `WebSocketEndpoint`, and `HidEndpoint` are kept as API placeholders, but real platform construction belongs to optional connector/helper code. This keeps `axtp_sdk` usable with mock or application-owned transports and prevents platform libraries from becoming mandatory dependencies.

## Dynamic RPC Policy

The SDK should prefer dynamic calls in public examples:

```cpp
client.callJson("audio.getAlgorithmConfig", "{}");
client.callTlv("audio.setAlgorithmConfig", bytes);
client.callRawBytes(0x90010001, bytes);
```

Typed calls are allowed for stable generated domains but must remain wrappers over dynamic/raw calls. New vendor or experimental methods should be callable through `MethodRegistry` without regenerating the SDK.
