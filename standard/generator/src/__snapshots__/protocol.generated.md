# AXTP Protocol

> Generated from protocol/axtp.protocol.yaml. Do not edit by hand.

## Overview

AXTP is a transport-independent device communication protocol for CONTROL, RPC and STREAM payloads across TCP, WebSocket, USB HID, BLE and UART transports.

| Property | Value |
| --- | --- |
| Protocol | AXTP |
| Version | 1.0.0 |
| Spec Version | 1 |
| Registry Version | 1.0.0 |
| Status | rc1 |

## Design Goals / Non-Goals

### Goals

- Provide one unified protocol model for control, request/response RPC and stream transfer.
- Keep production clients small by binding each transport to a fixed frame profile.
- Support both standard and compact binary frame paths.
- Keep full dynamic capability modeling optional outside AXTP v1 Core.

### Non-Goals

- Full dynamic UI capability modeling is not required in v1.
- WebSocket Text and HTTP JSON are debug or legacy adapter paths.
- STREAM is not carried over WebSocket Text or HTTP JSON in production.
- Header profile negotiation is not performed dynamically in v1.

## Architecture

| Layer | Description |
| --- | --- |
| Transport Profile | Defines how AXTP runs over TCP, WebSocket, HID, BLE or UART. |
| Frame Profile | Binds L1 Frame Header and L2 Payload Header into one parser profile. |
| Payload Layer | Carries CONTROL, RPC or STREAM payloads. |
| RPC Session | Handles Hello, Identify, requests, responses, events and errors. |
| Stream Session | Handles OTA, file, audio, video, log and sensor chunk transfer. |

## Connection Lifecycle

| Step | From | To | Status | Description |
| --- | --- | --- | --- | --- |
| OPEN | Client | Server | - | Open an AXTP logical session and declare runtime limits. |
| ACCEPT | Server | Client | - | Accept the session and return final runtime parameters. |
| Hello | Server | Client | - | Announce RPC session rules, protocol version and authentication requirements. |
| Identify | Client | Server | - | Submit client identity and optional authentication data. |
| Identified | Server | Client | - | Confirm that the RPC session is ready. |
| capability.supportedMethods | Client | Server | - | Query the method bitmap available to the current session. |

### Optional Lifecycle Extensions

| Step | From | To | Status | Description |
| --- | --- | --- | --- | --- |
| READY | - | - | optional | Reserved for transports that need an explicit client acknowledgement after ACCEPT; not required by AXTP v1 Core. |

## Frame Profiles

| Name | Magic | L1 | L2 | Supports Mixing |
| --- | --- | --- | --- | --- |
| STANDARD_FRAME | AXTP | STANDARD_L1 | STANDARD_L2 | no |
| COMPACT_FRAME | 0xA7 | COMPACT_L1 | COMPACT_L2 | no |
| COMPACT_FRAME_CRC | 0xA7 | COMPACT_L1_CRC | COMPACT_L2 | no |

## Transport Profiles

| Name | Family | Frame Profile | Production | Max Frame Size | Usage |
| --- | --- | --- | --- | --- | --- |
| AXTP-WS | websocket | STANDARD_FRAME | yes | - | - |
| AXTP-TCP | tcp | STANDARD_FRAME | yes | - | - |
| AXTP-HID-64 | usb-hid | COMPACT_FRAME | yes | 64 | - |
| AXTP-BLE-RPC | ble | COMPACT_FRAME | yes | - | - |
| AXTP-UART | uart | COMPACT_FRAME_CRC | yes | - | - |
| AXTP-WS-TEXT | websocket | none | no | - | debug-or-legacy-adapter |
| AXTP-HTTP-JSON | http | none | no | - | debug-or-legacy-adapter |

## Payload Types

| Name | ID | Header Bytes | Description |
| --- | --- | --- | --- |
| CONTROL | 0x01 | 5 | Logical session control payload. |
| RPC | 0x02 | 11 | Binary request, response, event and error payload. |
| STREAM | 0x03 | 16 | Chunk-oriented data plane payload. |

## Control Rules

| Required Opcodes | Optional Opcodes | Reserved Opcodes |
| --- | --- | --- |
| OPEN<br>ACCEPT | READY | NACK<br>RESUME |

- v1 Core requires OPEN and ACCEPT before RPC or STREAM payloads.
- READY is not required by v1 Core and must not be assumed by peers.
- Dynamic header negotiation is not performed in v1.

## Capability Discovery

Capability discovery is exposed through `capability.supportedMethods`. The `CapabilitySupportedMethodsResponse.methodMasks` field is derived from `methods[].bitOffset` within each method domain.

| Domain | Methods |
| --- | --- |
| capability | 0: capability.supportedMethods |
| device | 0: device.getInfo |
| display | 0: display.getBrightness<br>1: display.setBrightness |
| firmware | 0: firmware.begin<br>1: firmware.end<br>2: firmware.verify<br>3: firmware.apply |

## Stream Transfer Model

| Header | Size | Fields |
| --- | --- | --- |
| AxtpStreamHeader | 16 | streamId: uint32<br>seq: uint32<br>position: uint32<br>chunkLength: uint16<br>flags: uint16 |

- STREAM uses the unified 16-byte header in production transports.
- The historical 8-byte stream header is not part of AXTP v1 Core.
- WebSocket Text and HTTP JSON must not carry production STREAM data.

## Methods Reference

### device.getInfo

| Property | Value |
| --- | --- |
| Method ID | 0x0101 |
| Domain | device |
| Bit Offset | 0 |
| Since | 1.0.0 |
| Status | stable |
| Request Type | DeviceGetInfoRequest |
| Response Type | DeviceGetInfoResponse |
| Encodings | json<br>binary_tlv |
| Capabilities | device.info |
| Events | - |
| Errors | SUCCESS<br>RPC_METHOD_NOT_FOUND<br>RPC_PARAM_INVALID |

### capability.supportedMethods

| Property | Value |
| --- | --- |
| Method ID | 0x0301 |
| Domain | capability |
| Bit Offset | 0 |
| Since | 1.0.0 |
| Status | stable |
| Request Type | CapabilitySupportedMethodsRequest |
| Response Type | CapabilitySupportedMethodsResponse |
| Encodings | json<br>binary_tlv |
| Capabilities | capability.supportedMethods |
| Events | - |
| Errors | SUCCESS<br>RPC_METHOD_NOT_FOUND |

### display.getBrightness

| Property | Value |
| --- | --- |
| Method ID | 0x0501 |
| Domain | display |
| Bit Offset | 0 |
| Since | 1.0.0 |
| Status | stable |
| Request Type | DisplayGetBrightnessRequest |
| Response Type | DisplayGetBrightnessResponse |
| Encodings | json<br>binary_tlv |
| Capabilities | display.brightness |
| Events | - |
| Errors | SUCCESS<br>RPC_METHOD_NOT_FOUND |

### display.setBrightness

| Property | Value |
| --- | --- |
| Method ID | 0x0502 |
| Domain | display |
| Bit Offset | 1 |
| Since | 1.0.0 |
| Status | stable |
| Request Type | DisplaySetBrightnessRequest |
| Response Type | CommonEmptyResponse |
| Encodings | json<br>binary_tlv |
| Capabilities | display.brightness |
| Events | display.brightnessChanged |
| Errors | SUCCESS<br>RPC_PARAM_INVALID<br>BUSY |

### firmware.begin

| Property | Value |
| --- | --- |
| Method ID | 0x0B02 |
| Domain | firmware |
| Bit Offset | 0 |
| Since | 1.0.0 |
| Status | stable |
| Request Type | FirmwareBeginRequest |
| Response Type | FirmwareBeginResponse |
| Encodings | json<br>binary_tlv |
| Capabilities | firmware.ota |
| Events | firmware.updateProgress |
| Errors | SUCCESS<br>RPC_PARAM_INVALID<br>BUSY |

### firmware.end

| Property | Value |
| --- | --- |
| Method ID | 0x0B03 |
| Domain | firmware |
| Bit Offset | 1 |
| Since | 1.0.0 |
| Status | stable |
| Request Type | FirmwareEndRequest |
| Response Type | CommonEmptyResponse |
| Encodings | json<br>binary_tlv |
| Capabilities | firmware.ota |
| Events | - |
| Errors | SUCCESS<br>STREAM_NOT_FOUND<br>BUSY |

### firmware.verify

| Property | Value |
| --- | --- |
| Method ID | 0x0B04 |
| Domain | firmware |
| Bit Offset | 2 |
| Since | 1.0.0 |
| Status | stable |
| Request Type | FirmwareVerifyRequest |
| Response Type | CommonEmptyResponse |
| Encodings | json<br>binary_tlv |
| Capabilities | firmware.ota |
| Events | firmware.updateCompleted<br>firmware.updateFailed |
| Errors | SUCCESS<br>STREAM_CRC_ERROR<br>BUSY |

### firmware.apply

| Property | Value |
| --- | --- |
| Method ID | 0x0B05 |
| Domain | firmware |
| Bit Offset | 3 |
| Since | 1.0.0 |
| Status | stable |
| Request Type | FirmwareApplyRequest |
| Response Type | CommonEmptyResponse |
| Encodings | json<br>binary_tlv |
| Capabilities | firmware.ota |
| Events | firmware.updateCompleted<br>firmware.updateFailed |
| Errors | SUCCESS<br>BUSY |

## Events Reference

### display.brightnessChanged

| Property | Value |
| --- | --- |
| Event ID | 0x8507 |
| Domain | display |
| Bit Offset | 0 |
| Since | 1.0.0 |
| Status | stable |
| Payload Type | DisplayBrightnessChangedEvent |
| Severity | info |
| Trigger | display.setBrightness<br>device_local_change |
| Capabilities | display.brightness |

### firmware.updateProgress

| Property | Value |
| --- | --- |
| Event ID | 0x8B02 |
| Domain | firmware |
| Bit Offset | 0 |
| Since | 1.0.0 |
| Status | stable |
| Payload Type | FirmwareUpdateProgressEvent |
| Severity | info |
| Trigger | firmware.begin<br>stream.ota.chunk |
| Capabilities | firmware.ota |

### firmware.updateCompleted

| Property | Value |
| --- | --- |
| Event ID | 0x8B03 |
| Domain | firmware |
| Bit Offset | 1 |
| Since | 1.0.0 |
| Status | stable |
| Payload Type | FirmwareUpdateCompletedEvent |
| Severity | info |
| Trigger | firmware.verify<br>firmware.apply |
| Capabilities | firmware.ota |

### firmware.updateFailed

| Property | Value |
| --- | --- |
| Event ID | 0x8B04 |
| Domain | firmware |
| Bit Offset | 2 |
| Since | 1.0.0 |
| Status | stable |
| Payload Type | FirmwareUpdateFailedEvent |
| Severity | error |
| Trigger | firmware.verify<br>firmware.apply<br>stream.error |
| Capabilities | firmware.ota |

## Types Reference

### CapabilitySupportedMethodsRequest

Kind: `object`

_No entries._

### CapabilitySupportedMethodsResponse

Kind: `object`

| Field ID | Name | Type | Required | Constraints | Description |
| --- | --- | --- | --- | --- | --- |
| 0x01 | methodMaskCount | uint16 | yes | - | - |
| 0x02 | methodMasks | bytes | yes | derivedFrom=methods.bitOffset | - |

### CommonEmptyRequest

Kind: `object`

_No entries._

### CommonEmptyResponse

Kind: `object`

_No entries._

### DeviceGetInfoRequest

Kind: `object`

_No entries._

### DeviceGetInfoResponse

Kind: `object`

| Field ID | Name | Type | Required | Constraints | Description |
| --- | --- | --- | --- | --- | --- |
| 0x01 | vendor | string | no | maxLength=32 | - |
| 0x02 | product | string | no | maxLength=32 | - |
| 0x03 | firmwareVersion | string | no | maxLength=32 | - |
| 0x04 | serialNumber | string | no | maxLength=64 | - |

### DisplayBrightnessChangedEvent

Kind: `object`

| Field ID | Name | Type | Required | Constraints | Description |
| --- | --- | --- | --- | --- | --- |
| 0x01 | value | uint8 | yes | min=0, max=100 | - |
| 0x02 | previousValue | uint8 | no | min=0, max=100 | - |

### DisplayGetBrightnessRequest

Kind: `object`

_No entries._

### DisplayGetBrightnessResponse

Kind: `object`

| Field ID | Name | Type | Required | Constraints | Description |
| --- | --- | --- | --- | --- | --- |
| 0x01 | value | uint8 | yes | min=0, max=100 | - |

### DisplaySetBrightnessRequest

Kind: `object`

| Field ID | Name | Type | Required | Constraints | Description |
| --- | --- | --- | --- | --- | --- |
| 0x01 | value | uint8 | yes | min=0, max=100 | - |
| 0x02 | transitionMs | uint16 | no | min=0, max=60000 | - |

### FirmwareApplyRequest

Kind: `object`

| Field ID | Name | Type | Required | Constraints | Description |
| --- | --- | --- | --- | --- | --- |
| 0x01 | streamId | uint32 | yes | - | - |

### FirmwareBeginRequest

Kind: `object`

| Field ID | Name | Type | Required | Constraints | Description |
| --- | --- | --- | --- | --- | --- |
| 0x01 | totalSize | uint32 | yes | - | - |
| 0x02 | hashAlgo | string | yes | maxLength=16 | - |
| 0x03 | hash | bytes | yes | maxLength=64 | - |
| 0x04 | chunkSize | uint16 | yes | - | - |

### FirmwareBeginResponse

Kind: `object`

| Field ID | Name | Type | Required | Constraints | Description |
| --- | --- | --- | --- | --- | --- |
| 0x01 | streamId | uint32 | yes | - | - |
| 0x02 | profile | string | yes | maxLength=32 | - |
| 0x03 | chunkSize | uint16 | yes | - | - |
| 0x04 | ackMode | enum | yes | - | - |
| 0x05 | cursorUnit | enum | yes | - | - |
| 0x06 | reservedStreamHeaderProfile | enum | no | deprecated | - |
| 0x07 | maxDataSize | uint16 | no | - | - |

### FirmwareEndRequest

Kind: `object`

| Field ID | Name | Type | Required | Constraints | Description |
| --- | --- | --- | --- | --- | --- |
| 0x01 | streamId | uint32 | yes | - | - |

### FirmwareOtaCapability

Kind: `object`

| Field ID | Name | Type | Required | Constraints | Description |
| --- | --- | --- | --- | --- | --- |
| 0x01 | maxImageSize | uint32 | yes | - | - |
| 0x02 | maxChunkSize | uint16 | yes | - | - |

### FirmwareUpdateCompletedEvent

Kind: `object`

| Field ID | Name | Type | Required | Constraints | Description |
| --- | --- | --- | --- | --- | --- |
| 0x01 | version | string | no | maxLength=32 | - |

### FirmwareUpdateFailedEvent

Kind: `object`

| Field ID | Name | Type | Required | Constraints | Description |
| --- | --- | --- | --- | --- | --- |
| 0x01 | errorCode | uint16 | yes | - | - |
| 0x02 | message | string | no | maxLength=96 | - |

### FirmwareUpdateProgressEvent

Kind: `object`

| Field ID | Name | Type | Required | Constraints | Description |
| --- | --- | --- | --- | --- | --- |
| 0x01 | streamId | uint32 | yes | - | - |
| 0x02 | percent | uint8 | yes | min=0, max=100 | - |

### FirmwareVerifyRequest

Kind: `object`

| Field ID | Name | Type | Required | Constraints | Description |
| --- | --- | --- | --- | --- | --- |
| 0x01 | streamId | uint32 | yes | - | - |

## Errors Reference

| Code | Name | Category | Severity | Retryable | Status | Message |
| --- | --- | --- | --- | --- | --- | --- |
| 0x0000 | SUCCESS | common | info | no | stable | Operation completed successfully. |
| 0x0001 | UNKNOWN_ERROR | common | error | no | stable | Unknown error. |
| 0x0005 | BUSY | common | warning | yes | stable | Device or resource is busy. |
| 0x0102 | FRAME_VERSION_UNSUPPORTED | frame | error | no | stable | Frame version is not supported. |
| 0x0106 | FRAME_CRC_ERROR | frame | error | yes | stable | Frame CRC check failed. |
| 0x0108 | FRAME_FRAGMENT_MISSING | frame | error | yes | stable | One or more frame fragments are missing. |
| 0x0201 | CONTROL_OPCODE_INVALID | control | error | no | stable | Control opcode is invalid. |
| 0x0202 | CONTROL_PAYLOAD_INVALID | control | error | no | stable | Control payload is invalid. |
| 0x0204 | CONTROL_OPEN_REQUIRED | control | error | no | stable | Session has not completed CONTROL OPEN. |
| 0x0205 | CONTROL_OPEN_REJECTED | control | error | no | stable | Control OPEN was rejected. |
| 0x0206 | RESERVED_CONTROL_PROFILE_UNSUPPORTED | control | error | no | reserved | Historical header profile negotiation error. |
| 0x0207 | CONTROL_NEGOTIATION_FAILED | control | error | no | stable | Control negotiation failed. |
| 0x0208 | CONTROL_SESSION_INVALID | control | error | no | stable | SessionId is invalid. |
| 0x020A | CONTROL_RESUME_FAILED | control | error | no | stable | Session resume failed. |
| 0x020C | CONTROL_WINDOW_EXCEEDED | control | warning | yes | stable | Flow-control window was exceeded. |
| 0x0301 | RPC_ENCODING_UNSUPPORTED | rpc | error | no | stable | RPC encoding is not supported. |
| 0x0306 | RPC_METHOD_NOT_FOUND | rpc | error | no | stable | MethodId or method name is not supported. |
| 0x030B | RPC_PARAM_INVALID | rpc | error | no | stable | RPC parameters are invalid. |
| 0x0401 | STREAM_NOT_FOUND | stream | error | no | stable | Stream context does not exist. |
| 0x0402 | STREAM_TIMEOUT | stream | error | yes | stable | Stream timed out. |
| 0x0403 | STREAM_CRC_ERROR | stream | error | yes | stable | Stream chunk CRC check failed. |
| 0x060B | FW_VERIFY_FAILED | firmware | error | no | stable | Firmware verification failed. |

## Profiles Reference

### AXTP-MVP

| Property | Value |
| --- | --- |
| Since | 1.0.0 |
| Status | stable |
| Extends | - |
| Required Methods | device.getInfo<br>capability.supportedMethods<br>display.getBrightness<br>display.setBrightness<br>firmware.begin<br>firmware.end<br>firmware.verify<br>firmware.apply |
| Required Events | display.brightnessChanged<br>firmware.updateProgress<br>firmware.updateCompleted<br>firmware.updateFailed |
| Required Types | - |
| Required Errors | SUCCESS<br>RPC_METHOD_NOT_FOUND<br>RPC_PARAM_INVALID<br>STREAM_NOT_FOUND<br>STREAM_CRC_ERROR<br>BUSY |
| Required Capabilities | protocol.payload.control<br>protocol.payload.rpc<br>protocol.payload.stream<br>device.info<br>capability.supportedMethods<br>display.brightness<br>display.brightnessMin<br>display.brightnessMax<br>display.brightnessStep<br>firmware.ota |
| Transport Profiles | AXTP-WS<br>AXTP-TCP<br>AXTP-HID-64<br>AXTP-BLE-RPC<br>AXTP-UART |
| Frame Profiles | STANDARD_FRAME<br>COMPACT_FRAME<br>COMPACT_FRAME_CRC |
| Notes | - |

### AXTP-MVP-HID

| Property | Value |
| --- | --- |
| Since | 1.0.0 |
| Status | stable |
| Extends | AXTP-MVP |
| Required Methods | device.getInfo<br>capability.supportedMethods<br>display.getBrightness<br>display.setBrightness<br>firmware.begin<br>firmware.end<br>firmware.verify<br>firmware.apply |
| Required Events | display.brightnessChanged<br>firmware.updateProgress<br>firmware.updateCompleted<br>firmware.updateFailed |
| Required Types | - |
| Required Errors | SUCCESS<br>RPC_METHOD_NOT_FOUND<br>RPC_PARAM_INVALID<br>STREAM_NOT_FOUND<br>STREAM_CRC_ERROR<br>BUSY |
| Required Capabilities | - |
| Transport Profiles | AXTP-HID-64 |
| Frame Profiles | COMPACT_FRAME |
| Notes | - |

