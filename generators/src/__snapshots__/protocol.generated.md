<!-- This file was automatically generated. Do not edit directly! -->

# AXTP Protocol

## Main Table of Contents

- [Overview](#overview)
- [Design Goals / Non-Goals](#design-goals--non-goals)
- [Connection Lifecycle](#connection-lifecycle)
- [Capability Discovery](#capability-discovery)
- [Methods](#methods)
  - [capability Methods](#capability-methods)
  - [device Methods](#device-methods)
  - [display Methods](#display-methods)
  - [firmware Methods](#firmware-methods)
  - [stream Methods](#stream-methods)
- [Events](#events)
  - [display Events](#display-events)
  - [firmware Events](#firmware-events)
  - [stream Events](#stream-events)
- [Additional Types](#additional-types)
- [Errors Reference](#errors-reference)
- [Profiles Reference](#profiles-reference)

## Implemented Domains

| Domain | Methods | Events |
| ---- | ---- | ---- |
| capability | 1 | 0 |
| device | 1 | 0 |
| display | 2 | 1 |
| firmware | 4 | 3 |
| stream | 1 | 2 |

## Overview

AXTP is a transport-independent device communication protocol for CONTROL, RPC and STREAM payloads across TCP, WebSocket, USB HID, BLE and UART transports.

| Property | Value |
| ---- | ---- |
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
| ---- | ---- | ---- | ---- | ---- |
| OPEN | Client | Server | - | Open an AXTP logical session and declare runtime limits. |
| ACCEPT | Server | Client | - | Accept the session and return final runtime parameters. |
| Hello | Server | Client | - | Announce RPC session rules, protocol version and authentication requirements. |
| Identify | Client | Server | - | Submit client identity and optional authentication data. |
| Identified | Server | Client | - | Confirm that the RPC session is ready. |
| capability.supportedMethods | Client | Server | - | Query the method bitmap available to the current session. |

### Optional Lifecycle Extensions

| Step | From | To | Status | Description |
| ---- | ---- | ---- | ---- | ---- |
| READY | - | - | optional | Reserved for transports that need an explicit client acknowledgement after ACCEPT; not required by AXTP v1 Core. |

## Transport Profiles

AXTP runs over multiple transports. Each transport binds to a fixed Frame Profile for the lifetime of the session.

| Transport | Family | Frame Profile | Production | Notes |
| ---- | ---- | ---- | ---- | ---- |
| AXTP-WS | websocket | STANDARD_FRAME | Yes | One AXTP Frame per WebSocket Binary Message. No extra framing needed. |
| AXTP-TCP | tcp | STANDARD_FRAME | Yes | Byte-stream transport. Receiver must reassemble frames using Magic+Length. |
| AXTP-HID-HS | usb-hid | STANDARD_FRAME | Yes | USB HID with Report Size > 64B. Specific report size is implementation-defined. |
| AXTP-HID-64 | usb-hid | COMPACT_FRAME | Yes | USB HID with 64B Report. 58B usable payload after 4B header and 1B CRC8 and 1B ReportID. |
| AXTP-BLE-RPC | ble | COMPACT_FRAME | Yes | BLE GATT. MTU negotiated at BLE layer; typical range 20B-247B. |
| AXTP-UART | uart | COMPACT_FRAME_CRC | Yes | UART with COBS or SLIP framing at transport layer. |
| AXTP-WS-CLOUD-REVERSE | websocket | STANDARD_FRAME | Yes | Device is Physical Client but Logical Server. Device sends Hello after ACCEPT. |
| AXTP-WS-TEXT | websocket | Unframed | No (debug) | DS-RPC JSON mode. No AXTP Frame Header. No STREAM support. Debug only. |
| AXTP-HTTP-JSON | http | Unframed | No (debug) | debug-or-legacy-adapter |

**Standard Frame** (12B L1 Header + CRC16) is the primary implementation target for TCP, WebSocket Binary, and USB HID High Speed.

**Compact Frame** (4B L1 Header + CRC8) is a fallback for constrained transports with MTU ≤ 64B (HID-64, BLE, UART). See §15 of the Transport Profiles spec for the full degradation guide.

### Cloud Reverse Connection

When a device initiates a connection to a cloud endpoint, the Physical Client/Server roles are reversed from the typical local scenario, but the Logical Server role stays with the device:

```text
Physical Client: Device    Physical Server: Cloud
Logical Client:  Cloud     Logical Server:  Device

  Role mapping: Device = Physical Client + Logical Server. Cloud = Physical Server + Logical Client.
  Device initiates WebSocket connection to cloud endpoint.
  Device sends CONTROL OPEN (device is Physical Client but drives session setup).
  Cloud sends CONTROL ACCEPT.
  Device sends RPC Hello (op=0) — device is Logical Server, so device always sends Hello.
  Cloud sends RPC Identify (op=2).
  Device sends RPC Identified (op=3) with session ID.
  Cloud sends capability.supportedMethods request to discover device capabilities.
  Cloud issues RPC requests to device as normal.
```

The key invariant: **the Logical Server always sends Hello**, regardless of who initiated the TCP/WebSocket connection.

### DS-RPC Debug Adapter (WebSocket Text)

For browser debugging and development tooling only. Not for production.

- Purpose: browser or curl debugging only. Not for production. No STREAM support.
- Connect via WebSocket Text (ws://device/axtp-debug or similar endpoint).
- No CONTROL OPEN/ACCEPT handshake — connection enters FRAMING_READY directly.
- Device sends DS-RPC Hello: {"sid":"","op":0,"d":{"rpcVersion":"..."}}
- Client sends DS-RPC Identify: {"sid":"","op":2,"d":{"clientName":"..."}}
- Device sends DS-RPC Identified: {"sid":"<uuid>","op":3,"d":{"negotiatedRpcVersion":"..."}}
- Issue RPC calls as JSON: {"sid":"<uuid>","op":7,"d":{"id":"00000001","method":"display.setBrightness","params":{"value":80}}}
- Receive response: {"sid":"<uuid>","op":8,"d":{"id":"00000001","status":{"ok":true,"code":0}}}

| DS-RPC (Unframed) | Framed Mode (AXTP) |
| --- | --- |
| WebSocket Upgrade | CONTROL OPEN/ACCEPT |
| Hello (op=0) | RPC Hello |
| Identify (op=2) | RPC Identify |
| Identified (op=3) | RPC Identified |
| REQUEST (op=7) | RPC Request |
| REQUEST_RESPONSE (op=8) | RPC RequestResponse |
| EVENT (op=6) | RPC Event |
| WebSocket Close | CONTROL CLOSE |
| — | STREAM (not supported in DS-RPC) |

## Payload Types

Every AXTP Frame carries exactly one payload. The `PayloadType` field in the Frame Header selects the parser.

| Type | ID | Header Size | When to Use |
| ---- | ---- | ---- | ---- |
| `CONTROL` | 0x01 | 5B | Use for session lifecycle signals — OPEN, ACCEPT, HEARTBEAT, ACK, NACK, CLOSE, RESUME. Never use for business data. |
| `RPC` | 0x02 | 11B | Use for all business operations — method calls, responses, events, and batch. Choose JSON or BINARY encoding per capability. |
| `STREAM` | 0x03 | 16B | Use for high-throughput data — OTA firmware chunks, video/audio frames, file transfer, log streaming. Never carry business metadata in STREAM; use RPC for setup and teardown. |

### CONTROL Payload Header (5B)

Logical session control payload.

| Field | Type | Size | Description |
| ---- | ---- | ---- | ---- |
| `opcode` | uint8 | 1B | Control operation code. |
| `controlId` | uint16 | 2B | Correlates OPEN/ACCEPT, ACK/NACK pairs. Little-Endian. |
| `statusCode` | uint16 | 2B | Result code. 0x0000 = SUCCESS. Little-Endian. |
| `body` | bytes | variable | TLV-encoded fields. Length = Frame.payloadLength - 5. |

### RPC Payload Header (11B)

Binary request, response, event and error payload.

| Field | Type | Size | Description |
| ---- | ---- | ---- | ---- |
| `rpcEncoding` | uint8 | 1B | Encoding: 0x01=JSON, 0x02=BINARY, 0x03=CBOR, 0x04=MSGPACK. |
| `rpcOp` | uint8 | 1B | Operation: 0x00=Hello, 0x02=Identify, 0x03=Identified, 0x06=Event, 0x07=Request, 0x08=RequestResponse. |
| `requestId` | uint32 | 4B | Client-assigned request correlation ID. Little-Endian. 0 for events. |
| `methodOrEventId` | uint16 | 2B | methodId for Request/Response; eventId for Event. Little-Endian. |
| `statusCode` | uint16 | 2B | 0x0000 = SUCCESS. Non-zero = error. Little-Endian. |
| `bodyEncoding` | uint8 | 1B | Body encoding: 0x00=NONE, 0x01=TLV8, 0x02=TLV16. Only meaningful when rpcEncoding=BINARY. |

### STREAM Payload Header (16B)

Chunk-oriented data plane payload.

| Field | Type | Size | Description |
| ---- | ---- | ---- | ---- |
| `streamId` | uint32 | 4B | Stream identifier assigned by firmware.begin or stream.open response. Little-Endian. |
| `seqId` | uint32 | 4B | Monotonically increasing chunk sequence number. Starts at 0. Little-Endian. |
| `cursor` | uint64 | 8B | Byte offset of this chunk within the stream. Used for resume and integrity checks. Little-Endian. |

## Wire Format Examples

The following examples show the exact byte layout for a complete session establishment over USB HID High Speed (Standard Frame Profile). All integers are Little-Endian.

### USB HID High Speed — Full Session Establishment

Complete session establishment over USB HID with Report Size > 64B. Standard Frame Profile (12B L1 Header + CRC16). All integers Little-Endian.

#### 1. CONTROL OPEN

**Direction:** Client → Device

```text
Standard L1 Header (12B)
+--------+--------+--------+--------+--------+--------+
| Magic  | Magic  | Ver/PT | PayLen | PayLen | MsgId  |
| 0x41   | 0x58   | 0x11   | 0x0F   | 0x00   | 0x01   |
+--------+--------+--------+--------+--------+--------+
| MsgId  | FrInfo | SrcId  | DstId  | (reserved)      |
| 0x00   | 0x01   | 0x01   | 0x10   | 0x00   | 0x00   |
+--------+--------+--------+--------+--------+--------+
Control Payload (15B)
+--------+--------+--------+--------+--------+
| opcode | ctrlId | ctrlId | status | status |
| 0x01   | 0x01   | 0x00   | 0x00   | 0x00   |
+--------+--------+--------+--------+--------+
| TLV body: protocolVersion=1, maxFrameSize=512, mtu=512, ...  |
+--------------------------------------------------------------|
CRC16 (2B)
+--------+--------+
| CRC16L | CRC16H |
+--------+--------+
```

**Hex bytes:**

```text
41 58 11 0F 00 01 00 01 01 10 00 00  01 01 00 00 00  02 01 01 04 02 00 02 06 02 00 02 07 01 07 0A 04 88 13 00 00 0B 01 01  XX XX
```

**Field annotations:**

- `41 58 = Magic 'AX'`
- `11 = Version(0x1) | PayloadType(0x1=CONTROL)`
- `0F 00 = payloadLength=15 (Little-Endian)`
- `01 00 = messageId=1`
- `01 = frameInfo (single frame, index=0, count=1)`
- `01 = sourceId=0x01 (client)`
- `10 = destinationId=0x10 (device)`
- `01 = opcode=OPEN`
- `01 00 = controlId=1`
- `00 00 = statusCode=SUCCESS`
- `02 01 01 = TLV: fieldId=0x02 protocolVersion=1`
- `04 02 00 02 = TLV: fieldId=0x04 maxFrameSize=512`
- `06 02 00 02 = TLV: fieldId=0x06 mtu=512`
- `07 01 07 = TLV: fieldId=0x07 supportedPayloadTypes=0x07 (CONTROL|RPC|STREAM)`
- `0A 04 88 13 00 00 = TLV: fieldId=0x0A heartbeatIntervalMs=5000`
- `0B 01 01 = TLV: fieldId=0x0B ackMode=1 (MESSAGE_ACK)`
- `XX XX = CRC16 over Header+Payload`

#### 2. CONTROL ACCEPT

**Direction:** Device → Client

```text
Standard L1 Header (12B) + Control Payload (17B) + CRC16 (2B)
opcode=0x02 (ACCEPT), controlId=1, statusCode=0x0000
TLV body: sessionId=0x00000001, protocolVersion=1, maxFrameSize=512, mtu=512
```

**Hex bytes:**

```text
41 58 11 11 00 01 00 01 10 01 00 00  02 01 00 00 00  01 04 01 00 00 00 02 01 01 04 02 00 02 06 02 00 02  XX XX
```

**Field annotations:**

- `02 = opcode=ACCEPT`
- `01 04 01 00 00 00 = TLV: fieldId=0x01 sessionId=1`
- `02 01 01 = TLV: fieldId=0x02 protocolVersion=1`
- `04 02 00 02 = TLV: fieldId=0x04 maxFrameSize=512`
- `06 02 00 02 = TLV: fieldId=0x06 mtu=512`

#### 3. RPC Hello (JSON)

**Direction:** Device → Client

```text
Standard L1 Header (12B) + RPC Binary Header (11B) + JSON body + CRC16 (2B)
rpcEncoding=0x01 (JSON), rpcOp=0x00 (Hello), requestId=0, methodOrEventId=0
```

**Hex bytes:**

```text
41 58 12 <payLen> 02 00 01 10 01 00 00  01 00 00 00 00 00 00 00 00 00 00  7B...7D  XX XX
```

**Field annotations:**

- `12 = Version(0x1) | PayloadType(0x2=RPC)`
- `01 = rpcEncoding=JSON`
- `00 = rpcOp=Hello`
- `00 00 00 00 = requestId=0 (server-push, no correlation)`
- `00 00 = methodOrEventId=0 (Hello has no methodId)`
- `00 00 = statusCode=0`
- `00 = bodyEncoding=NONE (JSON body follows directly)`
- `7B...7D = JSON body: {"rpcVersion":"2026.05","authRequired":false}`

#### 4. RPC Identify (JSON)

**Direction:** Client → Device

```text
Standard L1 Header (12B) + RPC Binary Header (11B) + JSON body + CRC16 (2B)
rpcEncoding=0x01 (JSON), rpcOp=0x02 (Identify), requestId=1
```

**Hex bytes:**

```text
41 58 12 <payLen> 03 00 01 01 10 00 00  01 02 01 00 00 00 00 00 00 00 00  7B...7D  XX XX
```

**Field annotations:**

- `02 = rpcOp=Identify`
- `01 00 00 00 = requestId=1`
- `7B...7D = JSON body: {"clientName":"MyApp","clientVersion":"1.0"}`

#### 5. RPC Identified (JSON)

**Direction:** Device → Client

```text
Standard L1 Header (12B) + RPC Binary Header (11B) + JSON body + CRC16 (2B)
rpcEncoding=0x01 (JSON), rpcOp=0x03 (Identified), requestId=1
```

**Hex bytes:**

```text
41 58 12 <payLen> 03 00 01 10 01 00 00  01 03 01 00 00 00 00 00 00 00 00  7B...7D  XX XX
```

**Field annotations:**

- `03 = rpcOp=Identified`
- `01 00 00 00 = requestId=1 (correlates with Identify)`
- `7B...7D = JSON body: {"sid":"a1b2c3d4","negotiatedRpcVersion":"2026.05"}`

#### 6. capability.supportedMethods Request (Binary TLV)

**Direction:** Client → Device

```text
Standard L1 Header (12B) + RPC Binary Header (11B) + TLV body (empty) + CRC16 (2B)
rpcEncoding=0x02 (BINARY), rpcOp=0x07 (Request), methodId=0x0301
```

**Hex bytes:**

```text
41 58 12 0B 00 04 00 01 10 00 00  02 07 02 00 00 01 03 00 00 01 00  XX XX
```

**Field annotations:**

- `02 = rpcEncoding=BINARY`
- `07 = rpcOp=Request`
- `02 00 00 00 = requestId=2`
- `01 03 = methodOrEventId=0x0301 (capability.supportedMethods)`
- `00 00 = statusCode=0`
- `01 = bodyEncoding=TLV8`
- `(no TLV fields — empty request body)`

#### 7. capability.supportedMethods Response (Binary TLV)

**Direction:** Device → Client

```text
Standard L1 Header (12B) + RPC Binary Header (11B) + TLV body + CRC16 (2B)
rpcOp=0x08 (RequestResponse), methodId=0x0301
TLV body: methodMasks field containing per-domain bitmasks
```

**Hex bytes:**

```text
41 58 12 <payLen> 04 00 01 10 01 00 00  02 08 02 00 00 01 03 00 00 01 00  <TLV methodMasks>  XX XX
```

**Field annotations:**

- `08 = rpcOp=RequestResponse`
- `02 00 00 00 = requestId=2 (correlates with Request)`
- `TLV methodMasks example: 01 04 05 01 00 00 = fieldId=0x01 len=4 value=[DomainId=0x05 MaskLen=0x01 Bitmask=0x03] meaning display domain supports getBrightness(bit0) and setBrightness(bit1)`

## Capability Discovery

Capability discovery is exposed through `capability.supportedMethods`. The `CapabilitySupportedMethodsResponse.methodMasks` field is derived from `methods[].bitOffset` within each method domain.

| Domain | Methods |
| ---- | ---- |
| capability | 0: capability.supportedMethods |
| device | 0: device.getInfo |
| display | 0: display.getBrightness<br>1: display.setBrightness |
| firmware | 0: firmware.begin<br>1: firmware.end<br>2: firmware.verify<br>3: firmware.apply |
| stream | 0: stream.open |

# Methods

## capability Methods

### Methods in this domain

- [capability.supportedMethods](#capabilitysupportedmethods)

---

### capability.supportedMethods

Return the per-domain method bitmap supported by the current session.

- Method ID: `0x0301`
- Domain: `capability`
- Bit Offset: `0`
- Status: `stable`
- Added in v1.0.0
- Encodings: `json`, `binary_tlv`
- Required Capabilities: `capability.supportedMethods`
- Possible Events: `None`
- Possible Errors: `SUCCESS`, `RPC_METHOD_NOT_FOUND`

#### Request Fields

Type: `Empty`

No fields.

#### Response Fields

Type: `CapabilitySupportedMethodsResponse`

| Name | Type | Field ID | Description | Value Restrictions | ?Default Behavior |
| ---- | :---: | :---: | ---- | :---: | ---- |
| methodMaskCount | UInt16 | 0x01 | - | None | N/A |
| methodMasks | Bytes | 0x02 | - | derivedFrom=methods[].bitOffset | N/A |

---

## device Methods

### Methods in this domain

- [device.getInfo](#devicegetinfo)

---

### device.getInfo

Return static device identity and firmware metadata.

- Method ID: `0x0101`
- Domain: `device`
- Bit Offset: `0`
- Status: `stable`
- Added in v1.0.0
- Encodings: `json`, `binary_tlv`
- Required Capabilities: `device.info`
- Possible Events: `None`
- Possible Errors: `SUCCESS`, `RPC_METHOD_NOT_FOUND`, `RPC_PARAM_INVALID`

#### Request Fields

Type: `Empty`

No fields.

#### Response Fields

Type: `DeviceGetInfoResponse`

| Name | Type | Field ID | Description | Value Restrictions | ?Default Behavior |
| ---- | :---: | :---: | ---- | :---: | ---- |
| ?vendor | String | 0x01 | - | maxLength=32 | Omit if not used. |
| ?product | String | 0x02 | - | maxLength=32 | Omit if not used. |
| ?firmwareVersion | String | 0x03 | - | maxLength=32 | Omit if not used. |
| ?serialNumber | String | 0x04 | - | maxLength=64 | Omit if not used. |

---

## display Methods

### Methods in this domain

- [display.getBrightness](#displaygetbrightness)
- [display.setBrightness](#displaysetbrightness)

---

### display.getBrightness

Read the current display brightness percentage.

- Method ID: `0x0501`
- Domain: `display`
- Bit Offset: `0`
- Status: `stable`
- Added in v1.0.0
- Encodings: `json`, `binary_tlv`
- Required Capabilities: `display.brightness`
- Possible Events: `None`
- Possible Errors: `SUCCESS`, `RPC_METHOD_NOT_FOUND`

#### Request Fields

Type: `Empty`

No fields.

#### Response Fields

Type: `DisplayGetBrightnessResponse`

| Name | Type | Field ID | Description | Value Restrictions | ?Default Behavior |
| ---- | :---: | :---: | ---- | :---: | ---- |
| value | UInt8 | 0x01 | - | min=0, max=100 | N/A |

---

### display.setBrightness

Set the display brightness and optionally request a transition duration.

- Method ID: `0x0502`
- Domain: `display`
- Bit Offset: `1`
- Status: `stable`
- Added in v1.0.0
- Encodings: `json`, `binary_tlv`
- Required Capabilities: `display.brightness`
- Possible Events: `display.brightnessChanged`
- Possible Errors: `SUCCESS`, `RPC_PARAM_INVALID`, `BUSY`

#### Request Fields

Type: `DisplaySetBrightnessRequest`

| Name | Type | Field ID | Description | Value Restrictions | ?Default Behavior |
| ---- | :---: | :---: | ---- | :---: | ---- |
| value | UInt8 | 0x01 | - | min=0, max=100 | N/A |
| ?transitionMs | UInt16 | 0x02 | - | min=0, max=60000 | Omit if not used. |

#### Response Fields

Type: `Empty`

No fields.

---

## firmware Methods

### Methods in this domain

- [firmware.begin](#firmwarebegin)
- [firmware.end](#firmwareend)
- [firmware.verify](#firmwareverify)
- [firmware.apply](#firmwareapply)

---

### firmware.begin

Begin a firmware OTA transfer and allocate the STREAM context.

- Method ID: `0x0B02`
- Domain: `firmware`
- Bit Offset: `0`
- Status: `stable`
- Added in v1.0.0
- Encodings: `json`, `binary_tlv`
- Required Capabilities: `firmware.ota`
- Possible Events: `firmware.updateProgress`
- Possible Errors: `SUCCESS`, `RPC_PARAM_INVALID`, `BUSY`

#### Request Fields

Type: `FirmwareBeginRequest`

| Name | Type | Field ID | Description | Value Restrictions | ?Default Behavior |
| ---- | :---: | :---: | ---- | :---: | ---- |
| imageType | Enum | 0x01 | Firmware image type. | None | N/A |
| imageSize | UInt64 | 0x02 | Full firmware image size in bytes. | None | N/A |
| imageVersion | String | 0x03 | Target firmware version. | maxLength=32 | N/A |
| verifyType | String | 0x04 | Object-level verification algorithm such as md5, crc32 or sha256. | maxLength=16 | N/A |
| verifyValue | String | 0x05 | Hex verification value for the full firmware image. | maxLength=64 | N/A |
| ?chunkSizeHint | UInt16 | 0x06 | Preferred STREAM chunk size in bytes. | None | Omit if not used. |
| ?windowSizeHint | UInt16 | 0x07 | Preferred stream-layer send window. | None | Omit if not used. |
| ?flags | UInt16 | 0x08 | OTA behavior flags such as resume or force-update hints. | None | Omit if not used. |

#### Response Fields

Type: `FirmwareBeginResponse`

| Name | Type | Field ID | Description | Value Restrictions | ?Default Behavior |
| ---- | :---: | :---: | ---- | :---: | ---- |
| transferId | UInt32 | 0x01 | OTA transfer identifier. | None | N/A |
| streamId | UInt32 | 0x02 | STREAM data channel identifier. | None | N/A |
| acceptedOffset | UInt64 | 0x03 | First byte offset the sender should transmit. | None | N/A |
| chunkSize | UInt16 | 0x04 | Negotiated STREAM chunk size in bytes. | None | N/A |
| windowSize | UInt16 | 0x05 | Negotiated stream-layer send window. | None | N/A |
| ?resumeToken | Bytes | 0x06 | Opaque resume token. | maxLength=32 | Omit if not used. |
| otaState | Enum | 0x07 | Current OTA state. | None | N/A |
| profile | String | 0x08 | Bound Stream Profile, usually firmware.ota. | maxLength=32 | N/A |
| ackMode | Enum | 0x09 | Stream-layer reliability mode. | None | N/A |
| cursorUnit | Enum | 0x0A | Cursor unit used by STREAM packets, usually byteOffset. | None | N/A |
| ?maxDataSize | UInt16 | 0x0B | Maximum STREAM data bytes per packet. | None | Omit if not used. |

---

### firmware.end

Finish sending firmware data for the active OTA stream.

- Method ID: `0x0B03`
- Domain: `firmware`
- Bit Offset: `1`
- Status: `stable`
- Added in v1.0.0
- Encodings: `json`, `binary_tlv`
- Required Capabilities: `firmware.ota`
- Possible Events: `None`
- Possible Errors: `SUCCESS`, `STREAM_NOT_FOUND`, `BUSY`

#### Request Fields

Type: `FirmwareEndRequest`

| Name | Type | Field ID | Description | Value Restrictions | ?Default Behavior |
| ---- | :---: | :---: | ---- | :---: | ---- |
| transferId | UInt32 | 0x01 | OTA transfer identifier. | None | N/A |
| ?totalBytesSent | UInt64 | 0x02 | Total firmware bytes sent by the host. | None | Omit if not used. |
| ?totalChunks | UInt32 | 0x03 | Total STREAM chunks sent by the host. | None | Omit if not used. |

#### Response Fields

Type: `FirmwareEndResponse`

| Name | Type | Field ID | Description | Value Restrictions | ?Default Behavior |
| ---- | :---: | :---: | ---- | :---: | ---- |
| receivedBytes | UInt64 | 0x01 | Total bytes accepted by the device. | None | N/A |
| ?receivedChunks | UInt32 | 0x02 | Total chunks accepted by the device. | None | Omit if not used. |
| otaState | Enum | 0x03 | Current OTA state. | None | N/A |

---

### firmware.verify

Verify the transferred firmware object before applying it.

- Method ID: `0x0B04`
- Domain: `firmware`
- Bit Offset: `2`
- Status: `stable`
- Added in v1.0.0
- Encodings: `json`, `binary_tlv`
- Required Capabilities: `firmware.ota`
- Possible Events: `firmware.updateCompleted`, `firmware.updateFailed`
- Possible Errors: `SUCCESS`, `STREAM_CRC_ERROR`, `BUSY`

#### Request Fields

Type: `FirmwareVerifyRequest`

| Name | Type | Field ID | Description | Value Restrictions | ?Default Behavior |
| ---- | :---: | :---: | ---- | :---: | ---- |
| transferId | UInt32 | 0x01 | OTA transfer identifier. | None | N/A |

#### Response Fields

Type: `FirmwareVerifyResponse`

| Name | Type | Field ID | Description | Value Restrictions | ?Default Behavior |
| ---- | :---: | :---: | ---- | :---: | ---- |
| verifyResult | Enum | 0x01 | Verification result for the transferred image. | None | N/A |
| otaState | Enum | 0x02 | Current OTA state. | None | N/A |

---

### firmware.apply

Apply a verified firmware image.

- Method ID: `0x0B05`
- Domain: `firmware`
- Bit Offset: `3`
- Status: `stable`
- Added in v1.0.0
- Encodings: `json`, `binary_tlv`
- Required Capabilities: `firmware.ota`
- Possible Events: `firmware.updateCompleted`, `firmware.updateFailed`
- Possible Errors: `SUCCESS`, `BUSY`

#### Request Fields

Type: `FirmwareApplyRequest`

| Name | Type | Field ID | Description | Value Restrictions | ?Default Behavior |
| ---- | :---: | :---: | ---- | :---: | ---- |
| transferId | UInt32 | 0x01 | OTA transfer identifier. | None | N/A |
| applyMode | Enum | 0x02 | Apply mode such as APPLY_NOW, APPLY_ON_REBOOT or STAGE_ONLY. | None | N/A |

#### Response Fields

Type: `FirmwareApplyResponse`

| Name | Type | Field ID | Description | Value Restrictions | ?Default Behavior |
| ---- | :---: | :---: | ---- | :---: | ---- |
| otaState | Enum | 0x01 | Current OTA state. | None | N/A |
| rebootRequired | Boolean | 0x02 | Whether applying the image requires reboot. | None | N/A |

---

## stream Methods

### Methods in this domain

- [stream.open](#streamopen)

---

### stream.open

Open an AXTP STREAM media channel over HID using media.video or media.audio, without UVC or UAC.

- Method ID: `0x0901`
- Domain: `stream`
- Bit Offset: `0`
- Status: `draft`
- Added in v1.0.0
- Encodings: `json`, `binary_tlv`
- Required Capabilities: `stream.hidMedia`
- Possible Events: `stream.opened`, `stream.error`
- Possible Errors: `SUCCESS`, `BUSY`, `RPC_PARAM_INVALID`, `MEDIA_SOURCE_NOT_FOUND`, `MEDIA_SOURCE_UNAVAILABLE`, `MEDIA_CODEC_UNSUPPORTED`, `MEDIA_RESOLUTION_UNSUPPORTED`, `MEDIA_FRAMERATE_UNSUPPORTED`, `MEDIA_STREAM_START_FAILED`

#### Request Fields

Type: `StreamOpenRequest`

| Name | Type | Field ID | Description | Value Restrictions | ?Default Behavior |
| ---- | :---: | :---: | ---- | :---: | ---- |
| profile | String | 0x01 | Stream Profile name. For this method use media.video or media.audio. | maxLength=32 | N/A |
| transportProfile | String | 0x02 | Transport Profile name. HID media streams use AXTP-HID-64. | maxLength=32 | N/A |
| direction | Enum | 0x03 | Stream direction; values are device_to_host, host_to_device, or bidirectional. | None | N/A |
| mediaKind | Enum | 0x04 | Media kind carried by this stream; values are video or audio. | None | N/A |
| ?sourceId | UInt16 | 0x05 | Device-local media source identifier. | None | Omit if not used. |
| codec | String | 0x06 | Codec or sample format, for example h264, mjpeg, pcm_s16le, or opus. | maxLength=32 | N/A |
| ?width | UInt16 | 0x07 | Video width in pixels. Required for video streams when not implied by sourceId. | None | Omit if not used. |
| ?height | UInt16 | 0x08 | Video height in pixels. Required for video streams when not implied by sourceId. | None | Omit if not used. |
| ?frameRate | UInt16 | 0x09 | Video frame rate in frames per second. | None | Omit if not used. |
| ?sampleRate | UInt32 | 0x0A | Audio sample rate in Hz. | None | Omit if not used. |
| ?channelCount | UInt8 | 0x0B | Number of audio channels. | None | Omit if not used. |
| ?chunkSizeHint | UInt16 | 0x0C | Preferred STREAM data bytes per HID-64 report after the 16B STREAM header. | max=42 | Omit if not used. |
| ?windowSizeHint | UInt16 | 0x0D | Preferred stream flow-control window in chunks. | None | Omit if not used. |

#### Response Fields

Type: `StreamOpenResponse`

| Name | Type | Field ID | Description | Value Restrictions | ?Default Behavior |
| ---- | :---: | :---: | ---- | :---: | ---- |
| streamId | UInt32 | 0x01 | STREAM channel identifier bound to the selected Stream Profile. | None | N/A |
| profile | String | 0x02 | Accepted Stream Profile name. | maxLength=32 | N/A |
| transportProfile | String | 0x03 | Accepted Transport Profile name. | maxLength=32 | N/A |
| chunkSize | UInt16 | 0x04 | STREAM data bytes to place in each HID-64 report after the 16B STREAM header. | max=42 | N/A |
| windowSize | UInt16 | 0x05 | Negotiated stream flow-control window in chunks. | None | N/A |
| ackMode | Enum | 0x06 | Stream acknowledgement mode, such as best_effort or stop_and_wait. | None | N/A |
| cursorUnit | Enum | 0x07 | Cursor unit used in the 64-bit STREAM cursor, usually timestampUs for media streams. | None | N/A |

---

# Events

## display Events

### Events in this domain

- [display.brightnessChanged](#displaybrightnesschanged)

---

### display.brightnessChanged

Emitted when display brightness changes.

- Event ID: `0x8507`
- Domain: `display`
- Bit Offset: `0`
- Status: `stable`
- Severity: `info`
- Added in v1.0.0
- Trigger: `display.setBrightness`, `device_local_change`
- Required Capabilities: `display.brightness`

#### Payload Fields

Type: `DisplayBrightnessChangedEvent`

| Name | Type | Field ID | Description | Value Restrictions | ?Default Behavior |
| ---- | :---: | :---: | ---- | :---: | ---- |
| value | UInt8 | 0x01 | - | min=0, max=100 | N/A |
| ?previousValue | UInt8 | 0x02 | - | min=0, max=100 | Omit if not used. |

---

## firmware Events

### Events in this domain

- [firmware.updateProgress](#firmwareupdateprogress)
- [firmware.updateCompleted](#firmwareupdatecompleted)
- [firmware.updateFailed](#firmwareupdatefailed)

---

### firmware.updateProgress

Emitted while firmware OTA transfer or processing advances.

- Event ID: `0x8B02`
- Domain: `firmware`
- Bit Offset: `0`
- Status: `stable`
- Severity: `info`
- Added in v1.0.0
- Trigger: `firmware.begin`, `stream.ota.chunk`
- Required Capabilities: `firmware.ota`

#### Payload Fields

Type: `FirmwareUpdateProgressEvent`

| Name | Type | Field ID | Description | Value Restrictions | ?Default Behavior |
| ---- | :---: | :---: | ---- | :---: | ---- |
| transferId | UInt32 | 0x01 | - | None | N/A |
| percent | UInt8 | 0x02 | - | min=0, max=100 | N/A |

---

### firmware.updateCompleted

Emitted when firmware update processing completes successfully.

- Event ID: `0x8B03`
- Domain: `firmware`
- Bit Offset: `1`
- Status: `stable`
- Severity: `info`
- Added in v1.0.0
- Trigger: `firmware.verify`, `firmware.apply`
- Required Capabilities: `firmware.ota`

#### Payload Fields

Type: `FirmwareUpdateCompletedEvent`

| Name | Type | Field ID | Description | Value Restrictions | ?Default Behavior |
| ---- | :---: | :---: | ---- | :---: | ---- |
| ?version | String | 0x01 | - | maxLength=32 | Omit if not used. |

---

### firmware.updateFailed

Emitted when firmware update processing fails.

- Event ID: `0x8B04`
- Domain: `firmware`
- Bit Offset: `2`
- Status: `stable`
- Severity: `error`
- Added in v1.0.0
- Trigger: `firmware.verify`, `firmware.apply`, `stream.error`
- Required Capabilities: `firmware.ota`

#### Payload Fields

Type: `FirmwareUpdateFailedEvent`

| Name | Type | Field ID | Description | Value Restrictions | ?Default Behavior |
| ---- | :---: | :---: | ---- | :---: | ---- |
| errorCode | UInt16 | 0x01 | - | None | N/A |
| ?message | String | 0x02 | - | maxLength=96 | Omit if not used. |

---

## stream Events

### Events in this domain

- [stream.opened](#streamopened)
- [stream.error](#streamerror)

---

### stream.opened

Emitted after a STREAM media channel is opened and bound to a streamId.

- Event ID: `0x8901`
- Domain: `stream`
- Bit Offset: `0`
- Status: `draft`
- Severity: `info`
- Added in v1.0.0
- Trigger: `stream.open`
- Required Capabilities: `stream.hidMedia`

#### Payload Fields

Type: `StreamOpenedEvent`

| Name | Type | Field ID | Description | Value Restrictions | ?Default Behavior |
| ---- | :---: | :---: | ---- | :---: | ---- |
| streamId | UInt32 | 0x01 | Opened STREAM channel identifier. | None | N/A |
| profile | String | 0x02 | Bound Stream Profile name. | maxLength=32 | N/A |
| transportProfile | String | 0x03 | Bound Transport Profile name. | maxLength=32 | N/A |
| mediaKind | Enum | 0x04 | Media kind carried by the stream; values are video or audio. | None | N/A |

---

### stream.error

Emitted when a STREAM media channel fails or cannot continue.

- Event ID: `0x8903`
- Domain: `stream`
- Bit Offset: `1`
- Status: `draft`
- Severity: `error`
- Added in v1.0.0
- Trigger: `stream.open`, `stream runtime`
- Required Capabilities: `stream.hidMedia`

#### Payload Fields

Type: `StreamErrorEvent`

| Name | Type | Field ID | Description | Value Restrictions | ?Default Behavior |
| ---- | :---: | :---: | ---- | :---: | ---- |
| ?streamId | UInt32 | 0x01 | STREAM channel identifier, absent if the failure happened before allocation. | None | Omit if not used. |
| errorCode | UInt16 | 0x02 | AXTP ErrorCode value describing the stream failure. | None | N/A |
| ?message | String | 0x03 | Optional diagnostic text. | maxLength=128 | Omit if not used. |

---

# Additional Types

## ControlAcceptBody

Kind: `object`

| Name | Type | Field ID | Description | Value Restrictions | ?Default Behavior |
| ---- | :---: | :---: | ---- | :---: | ---- |
| sessionId | UInt32 | 0x01 | - | None | N/A |
| protocolVersion | UInt8 | 0x02 | - | min=1, max=15 | N/A |
| ?reservedHeaderProfile | UInt8 | 0x03 | - | min=1, max=2, deprecated | Omit if not used. |
| maxFrameSize | UInt16 | 0x04 | - | min=1, max=65535 | N/A |
| mtu | UInt16 | 0x06 | - | min=1, max=65535 | N/A |
| supportedPayloadTypes | Bitmap | 0x07 | - | None | N/A |
| heartbeatIntervalMs | UInt32 | 0x0A | - | min=500, max=60000 | N/A |
| ackMode | UInt8 | 0x0B | - | min=0, max=4 | N/A |
| selectedRpcEncoding | UInt8 | 0x1E | - | min=1, max=4 | N/A |

---

## ControlOpenBody

Kind: `object`

| Name | Type | Field ID | Description | Value Restrictions | ?Default Behavior |
| ---- | :---: | :---: | ---- | :---: | ---- |
| protocolVersion | UInt8 | 0x02 | - | min=1, max=15 | N/A |
| ?reservedHeaderProfile | UInt8 | 0x03 | - | min=1, max=2, deprecated | Omit if not used. |
| maxFrameSize | UInt16 | 0x04 | - | min=1, max=65535 | N/A |
| mtu | UInt16 | 0x06 | - | min=1, max=65535 | N/A |
| supportedPayloadTypes | Bitmap | 0x07 | - | None | N/A |
| supportedRpcEncodings | Bitmap | 0x08 | - | None | N/A |
| heartbeatIntervalMs | UInt32 | 0x0A | - | min=500, max=60000 | N/A |
| ackMode | UInt8 | 0x0B | - | min=0, max=4 | N/A |

---

## FirmwareOtaCapability

Kind: `object`

| Name | Type | Field ID | Description | Value Restrictions | ?Default Behavior |
| ---- | :---: | :---: | ---- | :---: | ---- |
| maxImageSize | UInt32 | 0x01 | - | None | N/A |
| maxChunkSize | UInt16 | 0x02 | - | None | N/A |

---

## StreamHidMediaCapability

Describes HID-backed media STREAM support.

| Name | Type | Field ID | Description | Value Restrictions | ?Default Behavior |
| ---- | :---: | :---: | ---- | :---: | ---- |
| transportProfile | String | 0x01 | Supported HID Transport Profile, usually AXTP-HID-64. | maxLength=32 | N/A |
| maxStreamCount | UInt8 | 0x02 | Maximum simultaneously opened media streams. | None | N/A |
| maxChunkSize | UInt16 | 0x03 | Maximum STREAM data bytes per HID-64 report after the 16B STREAM header. | max=42 | N/A |
| supportsVideo | Boolean | 0x04 | Device can open media.video streams over HID. | None | N/A |
| supportsAudio | Boolean | 0x05 | Device can open media.audio streams over HID. | None | N/A |

---

# Errors Reference

| Code | Name | Category | Severity | Retryable | Status | Message |
| ---- | ---- | ---- | ---- | ---- | ---- | ---- |
| 0x0000 | SUCCESS | common | info | No | stable | Operation completed successfully. |
| 0x0001 | UNKNOWN_ERROR | common | error | No | stable | Unknown error. |
| 0x0005 | BUSY | common | warning | Yes | stable | Device or resource is busy. |
| 0x0102 | FRAME_VERSION_UNSUPPORTED | frame | error | No | stable | Frame version is not supported. |
| 0x0106 | FRAME_CRC_ERROR | frame | warning | Yes | stable | Frame CRC check failed. |
| 0x0108 | FRAME_FRAGMENT_MISSING | frame | warning | Yes | stable | One or more frame fragments are missing. |
| 0x0201 | CONTROL_OPCODE_INVALID | control | error | No | stable | Control opcode is invalid. |
| 0x0202 | CONTROL_PAYLOAD_INVALID | control | error | No | stable | Control payload is invalid. |
| 0x0204 | CONTROL_OPEN_REQUIRED | control | error | No | stable | Session has not completed CONTROL OPEN. |
| 0x0205 | CONTROL_OPEN_REJECTED | control | error | No | stable | Control OPEN was rejected. |
| 0x0206 | RESERVED_CONTROL_PROFILE_UNSUPPORTED | control | error | No | reserved | Historical header profile negotiation error. AXTP v1 implementations must not emit it. |
| 0x0207 | CONTROL_NEGOTIATION_FAILED | control | error | No | stable | Control negotiation failed. |
| 0x0208 | CONTROL_SESSION_INVALID | control | error | No | stable | SessionId is invalid. |
| 0x020A | CONTROL_RESUME_FAILED | control | error | No | stable | Session resume failed. |
| 0x020C | CONTROL_WINDOW_EXCEEDED | control | warning | Yes | stable | Flow-control window was exceeded. |
| 0x0301 | RPC_ENCODING_UNSUPPORTED | rpc | error | No | stable | RPC encoding is not supported. |
| 0x0306 | RPC_METHOD_NOT_FOUND | rpc | error | No | stable | MethodId or method name is not supported. |
| 0x030B | RPC_PARAM_INVALID | rpc | error | No | stable | RPC parameters are invalid. |
| 0x0401 | STREAM_NOT_FOUND | stream | error | No | stable | Stream context does not exist. |
| 0x0402 | STREAM_TIMEOUT | stream | warning | Yes | stable | Stream timed out. |
| 0x0403 | STREAM_CRC_ERROR | stream | warning | Yes | stable | Stream chunk CRC check failed. |
| 0x060B | FW_VERIFY_FAILED | business | error | No | stable | Firmware verification failed. |
| 0x0801 | MEDIA_SOURCE_NOT_FOUND | business | error | No | draft | Requested media source does not exist. |
| 0x0802 | MEDIA_SOURCE_UNAVAILABLE | business | warning | Yes | draft | Requested media source is currently unavailable. |
| 0x0803 | MEDIA_CODEC_UNSUPPORTED | business | error | No | draft | Requested media codec or sample format is unsupported. |
| 0x0804 | MEDIA_RESOLUTION_UNSUPPORTED | business | error | No | draft | Requested video resolution is unsupported. |
| 0x0805 | MEDIA_FRAMERATE_UNSUPPORTED | business | error | No | draft | Requested video frame rate is unsupported. |
| 0x0807 | MEDIA_STREAM_START_FAILED | business | warning | Yes | draft | Device failed to start the requested media stream. |

# Profiles Reference

## AXTP-HID-MEDIA

- Status: `draft`
- Added in v1.0.0
- Extends: `AXTP-MVP-HID`
- Required Methods: `stream.open`
- Required Events: `stream.opened`, `stream.error`
- Required Errors: `SUCCESS`, `BUSY`, `RPC_PARAM_INVALID`, `MEDIA_SOURCE_NOT_FOUND`, `MEDIA_SOURCE_UNAVAILABLE`, `MEDIA_CODEC_UNSUPPORTED`, `MEDIA_STREAM_START_FAILED`
- Notes: -

---

## AXTP-MVP

- Status: `stable`
- Added in v1.0.0
- Extends: `-`
- Required Methods: `device.getInfo`, `capability.supportedMethods`, `display.getBrightness`, `display.setBrightness`, `firmware.begin`, `firmware.end`, `firmware.verify`, `firmware.apply`
- Required Events: `display.brightnessChanged`, `firmware.updateProgress`, `firmware.updateCompleted`, `firmware.updateFailed`
- Required Errors: `SUCCESS`, `RPC_METHOD_NOT_FOUND`, `RPC_PARAM_INVALID`, `STREAM_NOT_FOUND`, `STREAM_CRC_ERROR`, `BUSY`
- Notes: -

---

## AXTP-MVP-HID

- Status: `stable`
- Added in v1.0.0
- Extends: `AXTP-MVP`
- Required Methods: `device.getInfo`, `capability.supportedMethods`, `display.getBrightness`, `display.setBrightness`, `firmware.begin`, `firmware.end`, `firmware.verify`, `firmware.apply`
- Required Events: `display.brightnessChanged`, `firmware.updateProgress`, `firmware.updateCompleted`, `firmware.updateFailed`
- Required Errors: `SUCCESS`, `RPC_METHOD_NOT_FOUND`, `RPC_PARAM_INVALID`, `STREAM_NOT_FOUND`, `STREAM_CRC_ERROR`, `BUSY`
- Notes: -

---
