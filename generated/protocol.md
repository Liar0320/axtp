# AXTP Protocol

> Generated from `protocol/axtp.protocol.yaml`.
> This file is a generated release artifact. Do not edit it by hand.

## Overview

AXTP is a transport-independent device communication protocol for CONTROL, RPC and STREAM payloads across TCP, WebSocket, USB HID, BLE and UART transports.

AXTP v1 uses fixed Transport Profile to Frame Profile bindings. A peer does not dynamically negotiate mixed Standard/Compact L1/L2 header combinations.

## Design Goals

- Provide one unified protocol model for control, request/response RPC and stream transfer.
- Keep production clients small by binding each transport to a fixed frame profile.
- Support both standard and compact binary frame paths.
- Keep full dynamic capability modeling optional outside AXTP v1 Core.

## Non-Goals

- Full dynamic UI capability modeling is not required in v1.
- WebSocket Text and HTTP JSON are debug or legacy adapter paths.
- STREAM is not carried over WebSocket Text or HTTP JSON in production.
- Header profile negotiation is not performed dynamically in v1.

## Architecture

| Layer | Description |
|---|---|
| Transport Profile | Defines how AXTP runs over TCP, WebSocket, HID, BLE or UART. |
| Frame Profile | Binds L1 Frame Header and L2 Payload Header into one parser profile. |
| Payload Layer | Carries CONTROL, RPC or STREAM payloads. |
| RPC Session | Handles Hello, Identify, requests, responses, events and errors. |
| Stream Session | Handles OTA, file, audio, video, log and sensor chunk transfer. |

## Connection Lifecycle

| Step | From | To | Description |
|---|---|---|---|
| OPEN | Client | Server | Open an AXTP logical session and declare runtime limits. |
| ACCEPT | Server | Client | Accept the session and return final runtime parameters. |
| Hello | Server | Client | Announce RPC session rules, protocol version and authentication requirements. |
| Identify | Client | Server | Submit client identity and optional authentication data. |
| Identified | Server | Client | Confirm that the RPC session is ready. |
| capability.supportedMethods | Client | Server | Query the method bitmap available to the current session. |

READY is reserved as an optional lifecycle extension for transports that need an explicit client acknowledgement after ACCEPT. It is not required by AXTP v1 Core.

## Frame Profiles

| Name | Magic | L1 | L2 |
|---|---|---|---|
| STANDARD_FRAME | `AXTP` | STANDARD_L1 | STANDARD_L2 |
| COMPACT_FRAME | `0xA7` | COMPACT_L1 | COMPACT_L2 |
| COMPACT_FRAME_CRC | `0xA7` | COMPACT_L1_CRC | COMPACT_L2 |

## Transport Profiles

| Name | Family | Frame Profile | Production |
|---|---|---|---|
| AXTP-WS | websocket | STANDARD_FRAME | true |
| AXTP-TCP | tcp | STANDARD_FRAME | true |
| AXTP-HID-64 | usb-hid | COMPACT_FRAME | true |
| AXTP-BLE-RPC | ble | COMPACT_FRAME | true |
| AXTP-UART | uart | COMPACT_FRAME_CRC | true |
| AXTP-WS-TEXT | websocket | none | false |
| AXTP-HTTP-JSON | http | none | false |

## Payload Types

| Name | Id | Header Bytes | Description |
|---|---|---|---|
| CONTROL | `0x01` | 5 | Logical session control payload. |
| RPC | `0x02` | 11 | Binary request, response, event and error payload. |
| STREAM | `0x03` | 16 | Chunk-oriented data plane payload. |

## Capability Discovery

AXTP v1 keeps the capability domain, but only requires `capability.supportedMethods`.

The supported method bitmap is derived from `requests[].methodId` and reflects the methods available to the current device, firmware, session and authentication state.

Full dynamic capability modeling is reserved for v2/P1.

## Stream Transfer Model

Production STREAM uses a unified 16-byte stream header:

| Field | Type |
|---|---|
| streamId | uint32 |
| seq | uint32 |
| position | uint32 |
| chunkLength | uint16 |
| flags | uint16 |

The historical 8-byte stream header is not part of AXTP v1 Core.

## Reference: Requests

| methodId | name | request | response |
|---|---|---|---|
| `0x0101` | `device.getInfo` | `DeviceGetInfoRequest` | `DeviceGetInfoResponse` |
| `0x0301` | `capability.supportedMethods` | `CapabilitySupportedMethodsRequest` | `CapabilitySupportedMethodsResponse` |
| `0x0501` | `display.getBrightness` | `DisplayGetBrightnessRequest` | `DisplayGetBrightnessResponse` |
| `0x0502` | `display.setBrightness` | `DisplaySetBrightnessRequest` | `CommonEmptyResponse` |
| `0x0B02` | `firmware.begin` | `FirmwareBeginRequest` | `FirmwareBeginResponse` |
| `0x0B03` | `firmware.end` | `FirmwareEndRequest` | `CommonEmptyResponse` |
| `0x0B04` | `firmware.verify` | `FirmwareVerifyRequest` | `CommonEmptyResponse` |
| `0x0B05` | `firmware.apply` | `FirmwareApplyRequest` | `CommonEmptyResponse` |

## Reference: Events

| eventId | name | payload |
|---|---|---|
| `0x8507` | `display.brightnessChanged` | `DisplayBrightnessChangedEvent` |
| `0x8B02` | `firmware.updateProgress` | `FirmwareUpdateProgressEvent` |
| `0x8B03` | `firmware.updateCompleted` | `FirmwareUpdateCompletedEvent` |
| `0x8B04` | `firmware.updateFailed` | `FirmwareUpdateFailedEvent` |

## Reference: Errors

| code | name | category |
|---|---|---|
| `0x0000` | `SUCCESS` | common |
| `0x0001` | `UNKNOWN_ERROR` | common |
| `0x0005` | `BUSY` | common |
| `0x0102` | `FRAME_VERSION_UNSUPPORTED` | frame |
| `0x0106` | `FRAME_CRC_ERROR` | frame |
| `0x0108` | `FRAME_FRAGMENT_MISSING` | frame |
| `0x0201` | `CONTROL_OPCODE_INVALID` | control |
| `0x0202` | `CONTROL_PAYLOAD_INVALID` | control |
| `0x0204` | `CONTROL_OPEN_REQUIRED` | control |
| `0x0205` | `CONTROL_OPEN_REJECTED` | control |
| `0x0206` | `RESERVED_CONTROL_PROFILE_UNSUPPORTED` | control |
| `0x0207` | `CONTROL_NEGOTIATION_FAILED` | control |
| `0x0208` | `CONTROL_SESSION_INVALID` | control |
| `0x020A` | `CONTROL_RESUME_FAILED` | control |
| `0x020C` | `CONTROL_WINDOW_EXCEEDED` | control |
| `0x0301` | `RPC_ENCODING_UNSUPPORTED` | rpc |
| `0x0306` | `RPC_METHOD_NOT_FOUND` | rpc |
| `0x030B` | `RPC_PARAM_INVALID` | rpc |
| `0x0401` | `STREAM_NOT_FOUND` | stream |
| `0x0402` | `STREAM_TIMEOUT` | stream |
| `0x0403` | `STREAM_CRC_ERROR` | stream |
| `0x060B` | `FW_VERIFY_FAILED` | firmware |

## Reference: Profiles

| Profile | Required Request Count | Transport Profiles |
|---|---|---|
| AXTP-MVP | 8 | AXTP-WS, AXTP-TCP, AXTP-HID-64, AXTP-BLE-RPC, AXTP-UART |
| AXTP-MVP-HID | 8 | AXTP-HID-64 |
