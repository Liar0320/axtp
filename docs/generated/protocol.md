<!-- This file was automatically generated. Do not edit directly! -->

# AXTP Protocol

## Main Table of Contents

- [Overview](#overview)
- [Design Goals / Non-Goals](#design-goals--non-goals)
- [Connection Lifecycle](#connection-lifecycle)
- [Capability Discovery](#capability-discovery)
- [Methods](#methods)
  - [capability Methods](#capability-methods)
    - [capability.supportedMethods](#capabilitysupportedmethods)
  - [device Methods](#device-methods)
    - [device.getInfo](#devicegetinfo)
  - [display Methods](#display-methods)
    - [display.getBrightness](#displaygetbrightness)
    - [display.setBrightness](#displaysetbrightness)
  - [firmware Methods](#firmware-methods)
    - [firmware.begin](#firmwarebegin)
    - [firmware.end](#firmwareend)
    - [firmware.verify](#firmwareverify)
    - [firmware.apply](#firmwareapply)
- [Events](#events)
  - [display Events](#display-events)
    - [display.brightnessChanged](#displaybrightnesschanged)
  - [firmware Events](#firmware-events)
    - [firmware.updateProgress](#firmwareupdateprogress)
    - [firmware.updateCompleted](#firmwareupdatecompleted)
    - [firmware.updateFailed](#firmwareupdatefailed)
- [Additional Types](#additional-types)
- [Errors Reference](#errors-reference)
- [Profiles Reference](#profiles-reference)

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

## Capability Discovery

Capability discovery is exposed through `capability.supportedMethods`. The `CapabilitySupportedMethodsResponse.methodMasks` field is derived from `methods[].bitOffset` within each method domain.

| Domain | Methods |
| --- | --- |
| capability | 0: capability.supportedMethods |
| device | 0: device.getInfo |
| display | 0: display.getBrightness<br>1: display.setBrightness |
| firmware | 0: firmware.begin<br>1: firmware.end<br>2: firmware.verify<br>3: firmware.apply |

## Methods

### capability Methods

#### capability.supportedMethods

Return the per-domain method bitmap supported by the current session.

| Property | Value |
| --- | --- |
| Method ID | 0x0301 |
| Domain | capability |
| Bit Offset | 0 |
| Since | 1.0.0 |
| Status | stable |
| Encodings | json<br>binary_tlv |
| Capabilities | capability.supportedMethods |
| Possible Events | - |
| Possible Errors | SUCCESS<br>RPC_METHOD_NOT_FOUND |

**Request Fields:**

Type: `Empty`

No fields.

**Response Fields:**

Type: `CapabilitySupportedMethodsResponse`

| Name | Type | Required | Field ID | Constraints | Description |
| --- | --- | --- | --- | --- | --- |
| methodMaskCount | uint16 | Yes | 0x01 | None | - |
| methodMasks | bytes | Yes | 0x02 | derivedFrom=methods[].bitOffset | - |

---

### device Methods

#### device.getInfo

Return static device identity and firmware metadata.

| Property | Value |
| --- | --- |
| Method ID | 0x0101 |
| Domain | device |
| Bit Offset | 0 |
| Since | 1.0.0 |
| Status | stable |
| Encodings | json<br>binary_tlv |
| Capabilities | device.info |
| Possible Events | - |
| Possible Errors | SUCCESS<br>RPC_METHOD_NOT_FOUND<br>RPC_PARAM_INVALID |

**Request Fields:**

Type: `Empty`

No fields.

**Response Fields:**

Type: `DeviceGetInfoResponse`

| Name | Type | Required | Field ID | Constraints | Description |
| --- | --- | --- | --- | --- | --- |
| vendor | string | No | 0x01 | maxLength=32 | - |
| product | string | No | 0x02 | maxLength=32 | - |
| firmwareVersion | string | No | 0x03 | maxLength=32 | - |
| serialNumber | string | No | 0x04 | maxLength=64 | - |

---

### display Methods

#### display.getBrightness

Read the current display brightness percentage.

| Property | Value |
| --- | --- |
| Method ID | 0x0501 |
| Domain | display |
| Bit Offset | 0 |
| Since | 1.0.0 |
| Status | stable |
| Encodings | json<br>binary_tlv |
| Capabilities | display.brightness |
| Possible Events | - |
| Possible Errors | SUCCESS<br>RPC_METHOD_NOT_FOUND |

**Request Fields:**

Type: `Empty`

No fields.

**Response Fields:**

Type: `DisplayGetBrightnessResponse`

| Name | Type | Required | Field ID | Constraints | Description |
| --- | --- | --- | --- | --- | --- |
| value | uint8 | Yes | 0x01 | min=0, max=100 | - |

---

#### display.setBrightness

Set the display brightness and optionally request a transition duration.

| Property | Value |
| --- | --- |
| Method ID | 0x0502 |
| Domain | display |
| Bit Offset | 1 |
| Since | 1.0.0 |
| Status | stable |
| Encodings | json<br>binary_tlv |
| Capabilities | display.brightness |
| Possible Events | display.brightnessChanged |
| Possible Errors | SUCCESS<br>RPC_PARAM_INVALID<br>BUSY |

**Request Fields:**

Type: `DisplaySetBrightnessRequest`

| Name | Type | Required | Field ID | Constraints | Description |
| --- | --- | --- | --- | --- | --- |
| value | uint8 | Yes | 0x01 | min=0, max=100 | - |
| transitionMs | uint16 | No | 0x02 | min=0, max=60000 | - |

**Response Fields:**

Type: `Empty`

No fields.

---

### firmware Methods

#### firmware.begin

Begin a firmware OTA transfer and allocate the STREAM context.

| Property | Value |
| --- | --- |
| Method ID | 0x0B02 |
| Domain | firmware |
| Bit Offset | 0 |
| Since | 1.0.0 |
| Status | stable |
| Encodings | json<br>binary_tlv |
| Capabilities | firmware.ota |
| Possible Events | firmware.updateProgress |
| Possible Errors | SUCCESS<br>RPC_PARAM_INVALID<br>BUSY |

**Request Fields:**

Type: `FirmwareBeginRequest`

| Name | Type | Required | Field ID | Constraints | Description |
| --- | --- | --- | --- | --- | --- |
| imageType | enum | Yes | 0x01 | None | Firmware image type. |
| imageSize | uint64 | Yes | 0x02 | None | Full firmware image size in bytes. |
| imageVersion | string | Yes | 0x03 | maxLength=32 | Target firmware version. |
| verifyType | string | Yes | 0x04 | maxLength=16 | Object-level verification algorithm such as md5, crc32 or sha256. |
| verifyValue | string | Yes | 0x05 | maxLength=64 | Hex verification value for the full firmware image. |
| chunkSizeHint | uint16 | No | 0x06 | None | Preferred STREAM chunk size in bytes. |
| windowSizeHint | uint16 | No | 0x07 | None | Preferred stream-layer send window. |
| flags | uint16 | No | 0x08 | None | OTA behavior flags such as resume or force-update hints. |

**Response Fields:**

Type: `FirmwareBeginResponse`

| Name | Type | Required | Field ID | Constraints | Description |
| --- | --- | --- | --- | --- | --- |
| transferId | uint32 | Yes | 0x01 | None | OTA transfer identifier. |
| streamId | uint32 | Yes | 0x02 | None | STREAM data channel identifier. |
| acceptedOffset | uint64 | Yes | 0x03 | None | First byte offset the sender should transmit. |
| chunkSize | uint16 | Yes | 0x04 | None | Negotiated STREAM chunk size in bytes. |
| windowSize | uint16 | Yes | 0x05 | None | Negotiated stream-layer send window. |
| resumeToken | bytes | No | 0x06 | maxLength=32 | Opaque resume token. |
| otaState | enum | Yes | 0x07 | None | Current OTA state. |
| profile | string | Yes | 0x08 | maxLength=32 | Bound Stream Profile, usually firmware.ota. |
| ackMode | enum | Yes | 0x09 | None | Stream-layer reliability mode. |
| cursorUnit | enum | Yes | 0x0A | None | Cursor unit used by STREAM packets, usually byteOffset. |
| maxDataSize | uint16 | No | 0x0B | None | Maximum STREAM data bytes per packet. |

---

#### firmware.end

Finish sending firmware data for the active OTA stream.

| Property | Value |
| --- | --- |
| Method ID | 0x0B03 |
| Domain | firmware |
| Bit Offset | 1 |
| Since | 1.0.0 |
| Status | stable |
| Encodings | json<br>binary_tlv |
| Capabilities | firmware.ota |
| Possible Events | - |
| Possible Errors | SUCCESS<br>STREAM_NOT_FOUND<br>BUSY |

**Request Fields:**

Type: `FirmwareEndRequest`

| Name | Type | Required | Field ID | Constraints | Description |
| --- | --- | --- | --- | --- | --- |
| transferId | uint32 | Yes | 0x01 | None | OTA transfer identifier. |
| totalBytesSent | uint64 | No | 0x02 | None | Total firmware bytes sent by the host. |
| totalChunks | uint32 | No | 0x03 | None | Total STREAM chunks sent by the host. |

**Response Fields:**

Type: `FirmwareEndResponse`

| Name | Type | Required | Field ID | Constraints | Description |
| --- | --- | --- | --- | --- | --- |
| receivedBytes | uint64 | Yes | 0x01 | None | Total bytes accepted by the device. |
| receivedChunks | uint32 | No | 0x02 | None | Total chunks accepted by the device. |
| otaState | enum | Yes | 0x03 | None | Current OTA state. |

---

#### firmware.verify

Verify the transferred firmware object before applying it.

| Property | Value |
| --- | --- |
| Method ID | 0x0B04 |
| Domain | firmware |
| Bit Offset | 2 |
| Since | 1.0.0 |
| Status | stable |
| Encodings | json<br>binary_tlv |
| Capabilities | firmware.ota |
| Possible Events | firmware.updateCompleted<br>firmware.updateFailed |
| Possible Errors | SUCCESS<br>STREAM_CRC_ERROR<br>BUSY |

**Request Fields:**

Type: `FirmwareVerifyRequest`

| Name | Type | Required | Field ID | Constraints | Description |
| --- | --- | --- | --- | --- | --- |
| transferId | uint32 | Yes | 0x01 | None | OTA transfer identifier. |

**Response Fields:**

Type: `FirmwareVerifyResponse`

| Name | Type | Required | Field ID | Constraints | Description |
| --- | --- | --- | --- | --- | --- |
| verifyResult | enum | Yes | 0x01 | None | Verification result for the transferred image. |
| otaState | enum | Yes | 0x02 | None | Current OTA state. |

---

#### firmware.apply

Apply a verified firmware image.

| Property | Value |
| --- | --- |
| Method ID | 0x0B05 |
| Domain | firmware |
| Bit Offset | 3 |
| Since | 1.0.0 |
| Status | stable |
| Encodings | json<br>binary_tlv |
| Capabilities | firmware.ota |
| Possible Events | firmware.updateCompleted<br>firmware.updateFailed |
| Possible Errors | SUCCESS<br>BUSY |

**Request Fields:**

Type: `FirmwareApplyRequest`

| Name | Type | Required | Field ID | Constraints | Description |
| --- | --- | --- | --- | --- | --- |
| transferId | uint32 | Yes | 0x01 | None | OTA transfer identifier. |
| applyMode | enum | Yes | 0x02 | None | Apply mode such as APPLY_NOW, APPLY_ON_REBOOT or STAGE_ONLY. |

**Response Fields:**

Type: `FirmwareApplyResponse`

| Name | Type | Required | Field ID | Constraints | Description |
| --- | --- | --- | --- | --- | --- |
| otaState | enum | Yes | 0x01 | None | Current OTA state. |
| rebootRequired | bool | Yes | 0x02 | None | Whether applying the image requires reboot. |

---

## Events

### display Events

#### display.brightnessChanged

Emitted when display brightness changes.

| Property | Value |
| --- | --- |
| Event ID | 0x8507 |
| Domain | display |
| Bit Offset | 0 |
| Since | 1.0.0 |
| Status | stable |
| Severity | info |
| Trigger | display.setBrightness<br>device_local_change |
| Capabilities | display.brightness |

**Payload Fields:**

Type: `DisplayBrightnessChangedEvent`

| Name | Type | Required | Field ID | Constraints | Description |
| --- | --- | --- | --- | --- | --- |
| value | uint8 | Yes | 0x01 | min=0, max=100 | - |
| previousValue | uint8 | No | 0x02 | min=0, max=100 | - |

---

### firmware Events

#### firmware.updateProgress

Emitted while firmware OTA transfer or processing advances.

| Property | Value |
| --- | --- |
| Event ID | 0x8B02 |
| Domain | firmware |
| Bit Offset | 0 |
| Since | 1.0.0 |
| Status | stable |
| Severity | info |
| Trigger | firmware.begin<br>stream.ota.chunk |
| Capabilities | firmware.ota |

**Payload Fields:**

Type: `FirmwareUpdateProgressEvent`

| Name | Type | Required | Field ID | Constraints | Description |
| --- | --- | --- | --- | --- | --- |
| transferId | uint32 | Yes | 0x01 | None | - |
| percent | uint8 | Yes | 0x02 | min=0, max=100 | - |

---

#### firmware.updateCompleted

Emitted when firmware update processing completes successfully.

| Property | Value |
| --- | --- |
| Event ID | 0x8B03 |
| Domain | firmware |
| Bit Offset | 1 |
| Since | 1.0.0 |
| Status | stable |
| Severity | info |
| Trigger | firmware.verify<br>firmware.apply |
| Capabilities | firmware.ota |

**Payload Fields:**

Type: `FirmwareUpdateCompletedEvent`

| Name | Type | Required | Field ID | Constraints | Description |
| --- | --- | --- | --- | --- | --- |
| version | string | No | 0x01 | maxLength=32 | - |

---

#### firmware.updateFailed

Emitted when firmware update processing fails.

| Property | Value |
| --- | --- |
| Event ID | 0x8B04 |
| Domain | firmware |
| Bit Offset | 2 |
| Since | 1.0.0 |
| Status | stable |
| Severity | error |
| Trigger | firmware.verify<br>firmware.apply<br>stream.error |
| Capabilities | firmware.ota |

**Payload Fields:**

Type: `FirmwareUpdateFailedEvent`

| Name | Type | Required | Field ID | Constraints | Description |
| --- | --- | --- | --- | --- | --- |
| errorCode | uint16 | Yes | 0x01 | None | - |
| message | string | No | 0x02 | maxLength=96 | - |

---

## Additional Types

### FirmwareOtaCapability

Kind: `object`

| Name | Type | Required | Field ID | Constraints | Description |
| --- | --- | --- | --- | --- | --- |
| maxImageSize | uint32 | Yes | 0x01 | None | - |
| maxChunkSize | uint16 | Yes | 0x02 | None | - |

---

## Errors Reference

| Code | Name | Category | Severity | Retryable | Status | Message |
| --- | --- | --- | --- | --- | --- | --- |
| 0x0000 | SUCCESS | common | info | No | stable | Operation completed successfully. |
| 0x0001 | UNKNOWN_ERROR | common | error | No | stable | Unknown error. |
| 0x0005 | BUSY | common | warning | Yes | stable | Device or resource is busy. |
| 0x0102 | FRAME_VERSION_UNSUPPORTED | frame | error | No | stable | Frame version is not supported. |
| 0x0106 | FRAME_CRC_ERROR | frame | error | Yes | stable | Frame CRC check failed. |
| 0x0108 | FRAME_FRAGMENT_MISSING | frame | error | Yes | stable | One or more frame fragments are missing. |
| 0x0201 | CONTROL_OPCODE_INVALID | control | error | No | stable | Control opcode is invalid. |
| 0x0202 | CONTROL_PAYLOAD_INVALID | control | error | No | stable | Control payload is invalid. |
| 0x0204 | CONTROL_OPEN_REQUIRED | control | error | No | stable | Session has not completed CONTROL OPEN. |
| 0x0205 | CONTROL_OPEN_REJECTED | control | error | No | stable | Control OPEN was rejected. |
| 0x0206 | RESERVED_CONTROL_PROFILE_UNSUPPORTED | control | error | No | reserved | Historical header profile negotiation error. |
| 0x0207 | CONTROL_NEGOTIATION_FAILED | control | error | No | stable | Control negotiation failed. |
| 0x0208 | CONTROL_SESSION_INVALID | control | error | No | stable | SessionId is invalid. |
| 0x020A | CONTROL_RESUME_FAILED | control | error | No | stable | Session resume failed. |
| 0x020C | CONTROL_WINDOW_EXCEEDED | control | warning | Yes | stable | Flow-control window was exceeded. |
| 0x0301 | RPC_ENCODING_UNSUPPORTED | rpc | error | No | stable | RPC encoding is not supported. |
| 0x0306 | RPC_METHOD_NOT_FOUND | rpc | error | No | stable | MethodId or method name is not supported. |
| 0x030B | RPC_PARAM_INVALID | rpc | error | No | stable | RPC parameters are invalid. |
| 0x0401 | STREAM_NOT_FOUND | stream | error | No | stable | Stream context does not exist. |
| 0x0402 | STREAM_TIMEOUT | stream | error | Yes | stable | Stream timed out. |
| 0x0403 | STREAM_CRC_ERROR | stream | error | Yes | stable | Stream chunk CRC check failed. |
| 0x060B | FW_VERIFY_FAILED | business | error | No | stable | Firmware verification failed. |

## Profiles Reference

### AXTP-MVP

| Property | Value |
| --- | --- |
| Since | 1.0.0 |
| Status | stable |
| Extends | - |
| Required Methods | device.getInfo<br>capability.supportedMethods<br>display.getBrightness<br>display.setBrightness<br>firmware.begin<br>firmware.end<br>firmware.verify<br>firmware.apply |
| Required Events | display.brightnessChanged<br>firmware.updateProgress<br>firmware.updateCompleted<br>firmware.updateFailed |
| Required Errors | SUCCESS<br>RPC_METHOD_NOT_FOUND<br>RPC_PARAM_INVALID<br>STREAM_NOT_FOUND<br>STREAM_CRC_ERROR<br>BUSY |
| Notes | - |

---

### AXTP-MVP-HID

| Property | Value |
| --- | --- |
| Since | 1.0.0 |
| Status | stable |
| Extends | AXTP-MVP |
| Required Methods | device.getInfo<br>capability.supportedMethods<br>display.getBrightness<br>display.setBrightness<br>firmware.begin<br>firmware.end<br>firmware.verify<br>firmware.apply |
| Required Events | display.brightnessChanged<br>firmware.updateProgress<br>firmware.updateCompleted<br>firmware.updateFailed |
| Required Errors | SUCCESS<br>RPC_METHOD_NOT_FOUND<br>RPC_PARAM_INVALID<br>STREAM_NOT_FOUND<br>STREAM_CRC_ERROR<br>BUSY |
| Notes | - |

---
