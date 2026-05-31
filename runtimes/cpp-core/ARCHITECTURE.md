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

## Runtime Flow

```mermaid
flowchart TB
    Transport["Transport<br/>TcpTransport / WebSocketTransport / MockTransport"]
    Mux["ProtocolMux<br/>AXTP magic or legacy bytes"]

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

    LegacyIn["LegacyProtocolAdapter<br/>legacy bytes -> RpcPayload"]
    LegacyOut["LegacyProtocolAdapter<br/>RpcPayload -> legacy response bytes"]

    Transport --> Mux
    Mux -->|"AX magic"| FD
    Mux -->|"legacy"| LegacyIn
    FD --> MR --> PD --> CorePorts --> Core
    LegacyIn --> CorePorts
    Core --> CorePorts --> Broker --> Router --> Broker --> CorePorts --> Core
    Core --> CorePorts --> PE --> MF --> FE --> Transport
    Core -->|"legacy sourceProtocol"| LegacyOut --> Transport
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
    LegacyDir["legacy/ + mux/<br/>old protocol compatibility"]

    Model --> InboundDir
    Model --> OutboundDir
    IO --> InboundDir
    IO --> OutboundDir
    InboundDir --> Ports --> CoreDir
    CoreDir --> Ports --> OutboundDir
    TransportDir --> Ports
    CoreDir --> BrokerDir
    LegacyDir --> Ports
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
| `phase8_legacy_test` | Legacy request mapping, shared Broker handler, legacy response encoding |

## Key Invariants

- Transport only moves bytes or WebSocket text messages. It does not parse AXTP frames or payloads.
- Inbound code stops at payload envelopes; it does not call business handlers.
- Outbound code starts from payload envelopes; it does not know business handlers.
- `AxtpCore` does not inherit `IByteSink`, `IPayloadSink`, `IByteWriter`, or `IBrokerSink`.
- `AxtpCore` owns thin port objects that implement those interfaces and delegate to private Core methods.
- Core owns protocol state and queues, but business dispatch is in Broker.
- Legacy command values stay in `legacy/` and `mux/`; Core and Broker operate on normalized payloads.
- WebSocket JSON is an RPC-only wire mode and does not carry CONTROL or STREAM.
