# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Repo Is

This is the **AXTP (Auditoryworks Transport Protocol)** specification repository. It is currently a pure documentation project — no build system, no code, no tests. The `generator/`, `registry/`, and `out/` directories under `standard/` are empty placeholders for future phases.

## Repository Structure

```text
standard/
├── docs/
│   ├── 00-overview/        # Protocol overview and landing roadmap
│   ├── 01-core-protocol/   # Frame layer, Control, RPC, Stream specs
│   ├── 02-type-system/     # Type system, TLV encoding, field numbering
│   ├── 03-registry/        # Method/Event/Error/Capability registries
│   ├── 04-compatibility/   # Legacy protocol migration
│   ├── 05-demo/            # Demo specs (WebSocket, HID, BLE, OTA)
│   ├── 06-generator/       # Generator v1 spec
│   └── 07-cpp-demo/        # C++ demo implementation spec
├── generator/              # (empty) Future: generator tool
├── registry/               # (empty) Future: YAML registry files
└── out/                    # (empty) Future: generated output
```

## Protocol Architecture

AXTP defines a 5-layer stack:

```text
Business Layer      → device / brightness / video / ota domains
Registry Layer      → Method / Event / Error / Capability IDs
Payload Layer       → CONTROL (0x01) / RPC (0x02) / STREAM (0x03)
AXTP Frame Layer    → Header / Length / MessageId / Fragment / CRC
Transport Layer     → BLE / HID / UART / TCP / WebSocket / USB Bulk
```

**Critical design constraint**: `PayloadType` only selects a parser — it never encodes business types like VIDEO, OTA, FILE. Business semantics belong in the Registry layer.

## Two Header Profiles

- **Standard Profile** (12B Header + 2B CRC16 Footer = 14B total): TCP, WebSocket Binary, USB Bulk, gateways. Magic=`AX` (`0x41 0x58`), Version, PayloadType, PayloadLength(uint16), SourceId, DestinationId, MessageId(uint16), FrameIndex(uint8), FrameCount(uint8). No Flags field.
- **Compact Profile** (4B Header + 1B CRC8 Footer = 5B total): BLE, USB HID, UART, MCU. No Magic (relies on transport frame boundary). VT(Version+PayloadType), PayloadLength(uint8), MessageId(uint8), FrameInfo(FrameIndex+FrameCount nibbles). No Flags field.

## Three Payload Types

| PayloadType | Value | Role |
| --- | --- | --- |
| CONTROL | 0x01 | Protocol runtime signals: HELLO, ACK, NACK, HEARTBEAT, RESUME, CLOSE |
| RPC | 0x02 | Business control plane: request, response, event, batch |
| STREAM | 0x03 | Business data plane: video/audio frames, OTA chunks, file chunks, logs |

RPC uses an internal `rpcEncoding` field (JSON / BINARY / TLV / CBOR / FIXED_STRUCT). JSON means the DS-RPC Text Profile; Binary-RPC uses the same Method/Event/Error/Capability semantics with binary headers and TLV bodies.

## Connection Profiles

- WebSocket Text and HTTP Debug API use DS-RPC Text Profile only. They carry Hello, Heartbeat, Request, Response, Event, and Bye through DS-RPC `op` values and do not send AXTP Frame Header.
- WebSocket Binary, HID, BLE, UART, TCP, and USB Bulk use AXTP Framed Mode. They carry lifecycle and reliability through `PayloadType=CONTROL`, business calls through `PayloadType=RPC`, and data plane traffic through `PayloadType=STREAM`.
- Do not mix DS-RPC Envelope and AXTP Frame Header on the same connection. Both codecs should decode into the same internal Session + ProtocolMessage runtime.

## Development Phases

The project is in **Phase 0 (documentation)**. Planned phases:

1. **Phase 1**: Structured YAML registries (`method_registry.yaml`, `event_registry.yaml`, `error_code.yaml`, `capability_registry.yaml`, `tlv_schema.yaml`)
2. **Phase 2**: Generator v1 — reads YAML, outputs C++ enums/constants, Markdown tables, test vectors
3. **Phase 3**: C++ Demo — frame encoder/decoder, control/rpc/stream parsers, TLV codec, mock transport
4. **Phase 4**: Legacy protocol compatibility adapters
5. **Phase 5**: Real transport integration (WebSocket → HID → BLE → UART → TCP)

## MVP Scope

The MVP validates this end-to-end flow:

```text
CONTROL HELLO/HELLO_ACK → RPC capability.getAll → RPC device.getInfo →
RPC brightness.set → RPC Event brightness.changed →
RPC firmware.begin → STREAM OTA chunk → CONTROL ACK/NACK →
RPC firmware.verify → RPC Event firmware.updateCompleted → CONTROL CLOSE
```

MVP domains: `device.*`, `capability.*`, `brightness.*`, `firmware.*`, `stream.*`, `event.*`

## Key Conventions

- **Byte order**: Little-Endian for all multi-byte integers in AXTP v1 wire format
- **CRC**: Standard uses CRC16-CCITT-FALSE (poly 0x1021, init 0xFFFF); Compact uses CRC8-MAXIM (poly 0x31, init 0x00, reflected). Both cover Header + Payload.
- **Magic**: Standard only — 2 bytes `0x41 0x58` (`AX`). Compact has no Magic (relies on HID/BLE transport frame boundary).
- **No Flags field** in either Profile — ACK mode negotiated in HELLO; compression/encryption expressed in bodyEncoding.
- **Registry is the single source of truth** — Markdown docs are human-readable output; YAML registries are the machine-readable source; Generator produces both code and docs from YAML
- **MessageId** (Frame layer) ≠ **requestId** (RPC layer) ≠ **streamId** (Stream layer) — these serve distinct purposes and must not be substituted for each other

## When Adding to This Repo

When writing new spec documents, follow the existing numbering convention (`NN-AXTP-<Title>.md`) and place them in the appropriate `docs/` subdirectory. When the registry YAML phase begins, files go in `standard/registry/` and generated output in `standard/out/`.
