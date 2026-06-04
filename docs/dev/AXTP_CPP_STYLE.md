# AXTP C++ Style Guide

## 1. Overall Style

AXTP C++ uses a Skia-like library discipline with AXTP-specific naming:

- public API discipline and clear include boundaries
- 4 spaces, 100 columns, K&R braces, no tabs
- explicit ownership and ManualPoll-friendly runtime APIs
- header-only core and header-only generated traits
- no platform dependencies in cpp/core public headers
- concrete transports as optional runtime/tool adapters

AXTP does not use Skia's `fMember` or `gGlobal` naming, and it does not require every type to carry an `Axtp` prefix. AXTP also does not use obs-websocket's tab/132-column/application-plugin style as core style.

`clang-format` controls whitespace, indentation, braces, wrapping, and include grouping. It does not enforce identifier or file naming; `_member` and lower_snake_case file names are enforced by review and this guide. Future work may add clang-tidy naming checks or a custom file-name lint.

## 1.1 Code Documentation Map

Use these documents together when changing C++ runtime code:

| Document | Scope |
|---|---|
| `runtimes/cpp/core/ARCHITECTURE.md` | Target layout, runtime layers, wire paths, test map |
| `docs/dev/AXTP_CPP_RUNTIME_PATTERNS.md` | Design patterns, extension recipes, anti-patterns |
| `docs/dev/AXTP_CPP_EXECUTION_FLOW.md` | Runtime, SDK, CLI, HID, and direct-core execution flow |
| `docs/dev/AXTP_CORE_API_DESIGN.md` | Core public API and boundaries |
| `docs/dev/AXTP_SDK_API_DESIGN.md` | SDK public API and dynamic RPC policy |
| `docs/dev/AXTPCTL_COMMAND_DESIGN.md` | CLI command shape and command dispatch policy |

## 2. Namespace And Type Naming

All C++ symbols live in `namespace axtp` or a child namespace such as `axtp::sdk`. Do not use a global `Axtp` prefix as a substitute for the namespace.

The main protocol-stack entry keeps the prefix:

```cpp
axtp::AxtpCore core;
```

Do not rename it to `Core`; that name is too generic in user code and docs.

The lightweight broker is:

```cpp
axtp::BasicBroker<> broker;
```

Do not use `AxtpBroker` for the lightweight header-only broker. This runtime intentionally does not preserve old `AxtpBroker`, `AxtpInboundProcessor`, or `AxtpOutboundProcessor` aliases.

Internal pipeline components do not use the `Axtp` prefix:

```cpp
axtp::InboundProcessor;
axtp::OutboundProcessor;
axtp::FrameDecoder;
axtp::FrameEncoder;
axtp::MessageReassembler;
axtp::MessageFragmenter;
axtp::PayloadDecoder;
axtp::PayloadEncoder;
axtp::JsonRpcDecoder;
axtp::JsonRpcEncoder;
```

Protocol model and runtime value types also avoid the prefix:

```cpp
axtp::Frame;
axtp::Message;
axtp::RpcPayload;
axtp::ControlPayload;
axtp::StreamPayload;
axtp::PayloadMeta;
axtp::TransportProfile;
axtp::SessionContext;
axtp::BrokerTask;
axtp::BrokerResult;
```

Interfaces use an `I` prefix, but not an `Axtp` prefix:

```cpp
axtp::ITransport;
axtp::IByteSink;
axtp::IByteWriter;
axtp::IPayloadSink;
```

Function names use lowerCamelCase: `attachTransport()`, `detachTransport()`, `flushOutbound()`, `onBytes()`, `sendBytes()`, and `handleBrokerResult()`.

Constants use `kConstantName`. New non-generated enum values should prefer `kValue` naming, but existing generated and protocol enum values such as `RpcOp::Request` and `ErrorCode::Success` remain unchanged in this migration.

## 3. Private Member Naming

Private and protected non-static data members use leading underscore plus lowerCamelCase:

```cpp
class InboundProcessor {
private:
    PayloadDecoder _payloadDecoder;
    MessageReassembler _messageReassembler;
    AxtpWireMode _wireMode = AxtpWireMode::FramedBinary;
};
```

Do not use `member_`, `fMember`, `gGlobal`, `__member`, or `_Member`.

Leading underscore safety rules:

- `_member` is allowed only for private/protected class or struct data members.
- The character after `_` must be lowercase.
- Do not use leading underscore identifiers at namespace or global scope.
- Do not use leading underscore macros or include guards such as `_AXTP_CORE_HPP`.
- Prefer `#pragma once`; if a guard is needed, use a non-reserved name such as `AXTP_CORE_HPP`.

## 4. File Naming

C++ file names use lower_snake_case. New C++ headers use `.hpp`; implementation files use `.cpp`.

Recommended examples:

```text
axtp_core.hpp
inbound_processor.hpp
frame_decoder.hpp
message_reassembler.hpp
basic_broker.hpp
hid_transport.cpp
```

Do not use UpperCamelCase file names such as `AxtpCore.h` or `AxtpFrameDecoder.hpp`.

Directories also use lower_snake_case. If the directory already expresses the module, do not repeat it in the file name:

```text
core/axtp_core.hpp
core/inbound/frame_decoder.hpp
core/outbound/frame_encoder.hpp
broker/basic_broker.hpp
transport/transport.hpp
transport/transport_profile.hpp
testing/mock_transport.hpp
```

Generated files may keep their current `.h` names until the generator owns a dedicated migration. Third-party code is never renamed or formatted by AXTP scripts.

## 5. Include Rules

Use full module include paths:

```cpp
#include <axtp/axtp.hpp>
#include <axtp/core/axtp_core.hpp>
#include <axtp/broker/basic_broker.hpp>
#include <axtp/core/inbound/frame_decoder.hpp>
#include <axtp/core/outbound/frame_encoder.hpp>
#include <axtp/transport/transport.hpp>
```

Do not include old top-level pipeline paths:

```cpp
#include <axtp/inbound/frame_decoder.hpp>   // forbidden
#include <axtp/outbound/frame_encoder.hpp>  // forbidden
```

Core public headers may include standard C++ headers, AXTP public headers, generated headers, and Boost.JSON where required by the formal `WebSocketJsonRpc` core wire mode. They must not include `windows.h`, `unistd.h`, `sys/socket.h`, `hidapi.h`, Boost.Asio, Boost.Beast, websocket libraries, Qt headers, or pthread headers.

Concrete transport targets and tools may include platform libraries, but those dependencies must not leak through cpp/core public headers.

## 6. Runtime Layering And Ownership

The runtime layering is fixed:

```text
ITransport <-> AxtpEndpoint -> AxtpCore -> BasicBroker
```

- `AxtpEndpoint` is the only glue layer.
- `AxtpCore` may know payload models, processors, `CoreEvent`, `BrokerResult`, and `TransportProfile`.
- `AxtpCore` must not know `ITransport`, concrete transports, SDK clients, CLI code, or legacy command ids.
- `BasicBroker<>` may know `BrokerTask`, `BrokerResult`, method registry, and handler dispatch.
- `BasicBroker<>` must not know `AxtpCore`, `ITransport`, frames, or transport-specific behavior.

Transport implementations store `IByteSink*` as a non-owning callback target. `AxtpEndpoint` owns neither the transport nor the broker; application or SDK code owns them.

Preferred lifecycle:

```text
construct -> attach/bind -> open -> poll -> close -> detach -> destroy
```

Do not create ownership cycles.

## 7. Header-Only Core, Broker, And Transport Rules

`axtp_core` and `BasicBroker<>` are header-only and ManualPoll-based.

Core may parse frames, reassemble messages, decode payload envelopes, manage sessions, track pending calls, and enqueue outbound bytes. Core must not create threads, do socket I/O, call HID APIs, execute business handlers directly, or hardcode legacy command IDs.

`BasicBroker<>` dispatches business handlers by `RpcPayload.methodOrEventId` and raw body bytes. It must not introduce `std::thread`, condition variables, futures, platform executors, or socket/transport behavior.

`ITransport` is part of core. Real transport implementations are optional runtime/tool/platform code. A transport must not parse AXTP frames, payloads, method IDs, or legacy command IDs; it only reads/writes bytes or transport-native messages.

## 8. Formatting Scripts

Use:

```bash
scripts/format-cpp.sh
scripts/check-format-cpp.sh
```

The scripts scan `runtimes/cpp/core`, `runtimes/cpp/sdk`, `runtimes/cpp/json-rpc`, `runtimes/cpp/transports`, and `runtimes/cpp/tools`, excluding `build/`, `generated/`, and `thirdparty/`.
