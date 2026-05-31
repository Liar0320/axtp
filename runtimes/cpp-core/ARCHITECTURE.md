# AXTP C++ Core Architecture

This document mirrors the current implementation in this directory.

## Phase Rollback Points

| Phase | Tag | Main addition |
|---:|---|---|
| 1 | `axtp-cpp-runtime-phase-01` | Model objects and byte IO |
| 2 | `axtp-cpp-runtime-phase-02` | Inbound bytes-to-payload pipeline |
| 3 | `axtp-cpp-runtime-phase-03` | Outbound payload-to-bytes pipeline |
| 4 | `axtp-cpp-runtime-phase-04` | Core state and outbound queue |
| 5 | `axtp-cpp-runtime-phase-05` | Transport abstraction and mock transport |
| 6 | `axtp-cpp-runtime-phase-06` | TCP and WebSocket JSON transports |
| 7 | `axtp-cpp-runtime-phase-07` | Broker and business routing |
| 8 | `axtp-cpp-runtime-phase-08` | Legacy adapter and protocol mux |
| 9 | `axtp-cpp-runtime-phase-09` | WebSocket Text JSON RPC session adapter |

## Runtime Flow

```mermaid
flowchart TB
    Tcp["TCP / Mock bytes<br/>AXTP standard frames"]
    Ws["WebSocket text<br/>sid / op / d JSON"]
    Hid["HID / raw legacy bytes<br/>AXDP FF A5 frames"]
    Mux["AxtpCore ByteSink / ProtocolMux<br/>AX magic or AXDP HID bytes"]

    subgraph Inbound["Inbound pipeline"]
        FD["FrameDecoder<br/>bytes -> Frame"]
        MR["MessageReassembler<br/>Frame fragments -> Message"]
        PD["PayloadDecoder<br/>Message -> Payload envelope"]
    end

    CorePorts["AxtpCore ports<br/>ByteSink / PayloadSink / ByteWriter / BrokerSink"]
    Core["AxtpCore<br/>session, pending calls, outbound queue"]
    Broker["AxtpBroker<br/>queue, middleware shell, flow control shell"]
    Router["BusinessRouter<br/>methodId -> handler"]

    subgraph Outbound["Outbound pipeline"]
        PE["PayloadEncoder<br/>Payload -> Message"]
        MF["MessageFragmenter<br/>Message -> Frame fragments"]
        FE["FrameEncoder<br/>Frame -> bytes + CRC16"]
    end

    subgraph Legacy["Legacy AXDP HID compatibility"]
        AxdpDec["LegacyFrameDecoder<br/>HID report / FF A5 / XMODEM CRC"]
        CmdMap["LegacyMethodMapper<br/>wire cmd + Beta/Common mask -> methodId"]
        LegacyIn["LegacyProtocolAdapter<br/>AXDP payload -> RpcPayload RAW_BYTES"]
        LegacyOut["LegacyProtocolAdapter<br/>RpcPayload -> AXDP response"]
        AxdpEnc["LegacyFrameEncoder<br/>dst/src swap, cmd + 0x80, XMODEM CRC"]
    end

    subgraph JsonRpc["WebSocket Text JSON compatibility"]
        JsonAdapter["WebSocketJsonRpcAdapter<br/>Hello / Identify / Request / Event"]
        NameMap["RegistryLookup<br/>method/event/error names"]
        JsonOut["JSON response/event encoder<br/>status/result"]
    end

    Generated["generated/axtp_legacy_mapping_generated.h<br/>cmd mapping + status mapping"]
    GeneratedRegistry["generated method/event/error registries"]

    Tcp --> Mux
    Hid --> Mux
    Ws --> JsonAdapter --> NameMap --> CorePorts
    Mux -->|"AX magic"| FD
    Mux -->|"FF A5 or HID report"| AxdpDec --> CmdMap --> LegacyIn
    Generated --> CmdMap
    Generated --> LegacyOut
    GeneratedRegistry --> NameMap
    FD --> MR --> PD --> CorePorts --> Core
    LegacyIn --> CorePorts
    Core --> CorePorts --> Broker --> Router --> Broker --> CorePorts --> Core
    Core -->|"AXTP sourceProtocol"| CorePorts --> PE --> MF --> FE --> Tcp
    Core -->|"legacy sourceProtocol"| LegacyOut --> AxdpEnc --> Hid
    Core -->|"JsonRpc sourceProtocol"| JsonOut --> Ws
    JsonAdapter --> JsonOut
```

## Ownership Boundaries

```mermaid
flowchart LR
    Model["model/<br/>Frame, Message, Payload, enums"]
    IO["io/<br/>ByteReader, ByteWriter, ByteBuffer, sinks, CRC16"]
    InboundDir["inbound/<br/>decode only"]
    OutboundDir["outbound/<br/>encode only"]
    CoreDir["core/<br/>protocol state, pending calls"]
    Ports["AxtpCore owned ports<br/>thin interface adapters"]
    TransportDir["transport/<br/>bytes in/out"]
    BrokerDir["broker/<br/>business queue and routing"]
    LegacyDir["legacy/ + mux/<br/>AXDP HID compatibility"]
    GeneratedDir["generated/<br/>method/event/error registries and legacy mapping tables"]

    Model --> InboundDir
    Model --> OutboundDir
    IO --> InboundDir
    IO --> OutboundDir
    InboundDir --> Ports --> CoreDir
    CoreDir --> Ports --> OutboundDir
    TransportDir --> Ports
    CoreDir --> BrokerDir
    LegacyDir --> Ports
    GeneratedDir --> TransportDir
    GeneratedDir --> LegacyDir
```

## Current Test Map

| Test | Covers |
|---|---|
| `phase1_model_io_test` | Little-endian IO, buffer operations, model includes |
| `phase2_inbound_test` | Half frames, sticky frames, fragment reassembly, magic resync, RPC decode |
| `phase3_outbound_test` | Payload encode, fragmentation, frame encode, inbound round trip |
| `phase4_core_test` | Core handlers, control responses, pending response matching |
| `phase5_transport_test` | `ITransport`, `MockTransport`, `attachTransport`, `flushOutbound` |
| `phase6_real_transport_test` | TCP framed path and WebSocket unframed JSON path |
| `phase7_broker_test` | Core-to-Broker task submission and Broker response callback |
| `phase8_legacy_test` | AXDP HID frame parsing, split reports, CRC rejection, legacy request mapping, mux routing, AXDP response encoding |

## Key Invariants

- Transport only moves bytes or WebSocket text messages. It does not parse AXTP frames or payloads.
- Inbound code stops at payload envelopes; it does not call business handlers.
- Outbound code starts from payload envelopes; it does not know business handlers.
- `AxtpCore` does not inherit `IByteSink`, `IPayloadSink`, `IByteWriter`, or `IBrokerSink`.
- `AxtpCore` owns thin port objects that implement those interfaces and delegate to private Core methods.
- `attachTransport()` binds the transport to `AxtpCore`'s byte sink; once `attachLegacyInbound()` or `attachLegacy()` is configured, that byte sink auto-routes AXTP magic to the standard inbound pipeline and AXDP HID bytes to the legacy adapter.
- WebSocket Text JSON is not routed through the AXTP standard frame decoder. `WebSocketJsonRpcAdapter` receives complete text messages, maps `method` names to methodIds, and submits normalized `RpcPayload` values to Core.
- Core owns protocol state and queues, but business dispatch is in Broker.
- AXDP HID compatibility stays in `legacy/` and `mux/`; Core and Broker operate on normalized `RpcPayload` values.
- AXDP wire details are adapter-owned: optional HID report id, `FF A5` magic, big-endian header fields, CRC-16/XMODEM, device-family masks, and `cmd + 0x80` responses.
- Legacy command and status mappings come from generated tables, not hard-coded Core or Broker logic.
- WebSocket JSON is an RPC-only wire mode and does not carry CONTROL or STREAM. It implements Text JSON `Hello`, `Identify`, `Identified`, `Request`, `RequestResponse`, `Event`, and an unsupported-batch response.
