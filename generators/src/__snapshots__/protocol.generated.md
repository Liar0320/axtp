<!-- This file was automatically generated. Do not edit directly! -->

# AXTP Protocol

## Main Table of Contents

- [Overview](#overview)
- [Protocol Framework](#protocol-framework)
- [Supported Connection Profiles](#supported-connection-profiles)
- [Design Goals / Non-Goals](#design-goals--non-goals)
- [Connection Lifecycle](#connection-lifecycle)
- [Capability Discovery](#capability-discovery)
- [Methods](#methods)
  - [capability Methods](#capability-methods)
  - [device Methods](#device-methods)
  - [display Methods](#display-methods)
  - [firmware Methods](#firmware-methods)
  - [network Methods](#network-methods)
  - [stream Methods](#stream-methods)
- [Events](#events)
  - [display Events](#display-events)
  - [firmware Events](#firmware-events)
  - [network Events](#network-events)
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
| network | 1 | 1 |
| stream | 1 | 2 |

## Overview

AXTP is a transport-independent device communication protocol for CONTROL, RPC and STREAM payloads across Standard Framed transports, plus a formal WebSocket Unframed JSON RPC profile.

| Property | Value |
| ---- | ---- |
| Protocol | AXTP |
| Version | 1.0.0 |
| Spec Version | 1 |
| Registry Version | 1.0.0 |
| Status | rc1 |

## Protocol Framework

AXTP v1 has two formal integration paths:

- **Standard Framed**: uses the 12-byte Standard Frame header, CONTROL OPEN/ACCEPT, RPC, STREAM, fragmentation, CRC16, and optional ACK/NACK.
- **WebSocket Unframed JSON**: uses the JSON `sid`/`op`/`d` envelope directly over WebSocket. It is RPC-only and does not carry CONTROL or STREAM payloads.

| Path | Transports | Frame | RPC Encodings | CONTROL | STREAM |
| ---- | ---- | ---- | ---- | ---- | ---- |
| Standard Framed | AXTP-USB-HID<br>AXTP-TCP | STANDARD_FRAME | `TLV`, `JSON`, `RAW` | Yes | Yes |
| WebSocket Unframed JSON | AXTP-WS-JSON<br>AXTP-WS-CLOUD-REVERSE | None | `JSON` | No | No |

Compact/HID-64/BLE/UART framing is a low-bandwidth degradation path, not an AXTP v1 Core requirement. See `docs/specs/17-AXTP-Low-Bandwidth-Degradation.md` for that path.

## Design Goals / Non-Goals

### Goals

- Provide one unified protocol model for control, request/response RPC and stream transfer.
- Make Standard Frame the AXTP v1 Core binary path for USB HID High Speed and TCP.
- Support WebSocket Unframed JSON as the formal RPC-only integration path.
- Keep full dynamic capability modeling optional outside AXTP v1 Core.

### Non-Goals

- Full dynamic UI capability modeling is not required in v1.
- Compact/HID-64/BLE/UART low-bandwidth framing is not required by AXTP v1 Core.
- STREAM is not carried over WebSocket Unframed JSON.
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

## Supported Connection Profiles

The current protocol definition exposes the connection profiles that are intended for AXTP v1 readers and SDKs.

| Profile | Family | Mode | Frame | RPC Encodings | CONTROL | STREAM | Notes |
| ---- | ---- | ---- | ---- | ---- | ---- | ---- | ---- |
| AXTP-USB-HID | usb-hid | standard-framed | STANDARD_FRAME | `TLV`, `JSON`, `RAW` | Yes | Yes | USB HID High Speed or large-report HID transport using Standard Frame. |
| AXTP-TCP | tcp | standard-framed | STANDARD_FRAME | `TLV`, `JSON`, `RAW` | Yes | Yes | TCP byte stream transport using Standard Frame magic and length parsing. |
| AXTP-WS-JSON | websocket | unframed-json | None | `JSON` | No | No | Formal RPC-only WebSocket JSON profile using the sid/op/d envelope. |
| AXTP-WS-CLOUD-REVERSE | websocket | unframed-json-cloud-reverse | None | `JSON` | No | No | Device initiates the WebSocket connection but remains the Logical Server. |

### Role Matrix

| Profile | Physical Client | Physical Server | Logical Client | Logical Server | Hello Sender |
| ---- | ---- | ---- | ---- | ---- | ---- |
| AXTP-USB-HID | Host / App | USB HID Device | Host / App | Device | Device |
| AXTP-TCP | App / PC | Device | App / PC | Device | Device |
| AXTP-WS-JSON | App / Cloud | Device / Gateway | App / Cloud | Device | Device |
| AXTP-WS-CLOUD-REVERSE | Device | Cloud | Cloud | Device | Device |

**Logical Server sends Hello.** This is true even when the device is the Physical Client in `AXTP-WS-CLOUD-REVERSE`.

### Cloud Reverse Connection

In `AXTP-WS-CLOUD-REVERSE`, the device initiates the WebSocket connection to the cloud endpoint, but the device remains the Logical Server:

```text
Physical Client: Device    Physical Server: Cloud
Logical Client:  Cloud     Logical Server:  Device

  Device opens the WebSocket connection to the cloud endpoint.
  No CONTROL OPEN or Standard Frame is used in this profile.
  Device remains the Logical Server and sends Hello after the WebSocket is established.
  Cloud identifies as the Logical Client and then issues JSON RPC requests.
```

The key invariant: **the Logical Server sends Hello** after the WebSocket is established.

### WebSocket Unframed JSON

This profile is a formal RPC-only path. It skips the Frame and CONTROL layers, uses JSON `sid`/`op`/`d`, and does not carry STREAM data.

- Open the WebSocket connection.
- Wait for Hello from the Logical Server.
- Send Identify using the JSON sid/op/d envelope.
- Wait for Identified.
- Query capability.supportedMethods.
- Start JSON RPC requests and receive JSON events.

| WebSocket Unframed JSON | Standard Framed AXTP |
| --- | --- |
| WebSocket Upgrade | Transport connect + CONTROL OPEN/ACCEPT |
| Hello (op=0) | RPC Hello |
| Identify (op=2) | RPC Identify |
| Identified (op=3) | RPC Identified |
| REQUEST (op=7) | RPC Request |
| REQUEST_RESPONSE (op=8) | RPC RequestResponse |
| EVENT (op=6) | RPC Event |
| WebSocket Close | CONTROL CLOSE or transport close |
| Not supported | STREAM |

## Payload Types

Every Standard Framed AXTP Frame carries exactly one payload. WebSocket Unframed JSON skips this layer and carries only RPC JSON envelopes.

| Type | ID | Header Size | When to Use |
| ---- | ---- | ---- | ---- |
| `CONTROL` | 0x01 | 5B | Logical session control payload. |
| `RPC` | 0x02 | 11B | Binary request, response, event and error payload. |
| `STREAM` | 0x03 | 16B | Chunk-oriented data plane payload. |

## Capability Discovery

Capability discovery is exposed through `capability.supportedMethods`. The `CapabilitySupportedMethodsResponse.methodMasks` field is derived from `methods[].bitOffset` within each method domain.

| Domain | Methods |
| ---- | ---- |
| capability | 0: capability.supportedMethods |
| device | 0: device.getInfo |
| display | 0: display.getBrightness<br>1: display.setBrightness |
| firmware | 0: firmware.begin<br>1: firmware.end<br>2: firmware.verify<br>3: firmware.apply |
| network | 0: network.getApInfo |
| stream | 0: stream.open |

# Methods

## capability Methods

### Methods in this domain

- [capability.supportedMethods](#capabilitysupportedmethods)

---

### capability.supportedMethods

Return the per-domain method bitmap supported by the current session.

- Method ID: `0x0201`
- Domain: `capability`
- Bit Offset: `0`
- Status: `stable`
- Added in v1.0.0
- Encodings: `json`, `tlv`
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
- Encodings: `json`, `tlv`
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

- Method ID: `0x0601`
- Domain: `display`
- Bit Offset: `0`
- Status: `stable`
- Added in v1.0.0
- Encodings: `json`, `tlv`
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

- Method ID: `0x0602`
- Domain: `display`
- Bit Offset: `1`
- Status: `stable`
- Added in v1.0.0
- Encodings: `json`, `tlv`
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

- Method ID: `0x0402`
- Domain: `firmware`
- Bit Offset: `0`
- Status: `stable`
- Added in v1.0.0
- Encodings: `json`, `tlv`
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

- Method ID: `0x0403`
- Domain: `firmware`
- Bit Offset: `1`
- Status: `stable`
- Added in v1.0.0
- Encodings: `json`, `tlv`
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

- Method ID: `0x0404`
- Domain: `firmware`
- Bit Offset: `2`
- Status: `stable`
- Added in v1.0.0
- Encodings: `json`, `tlv`
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

- Method ID: `0x0405`
- Domain: `firmware`
- Bit Offset: `3`
- Status: `stable`
- Added in v1.0.0
- Encodings: `json`, `tlv`
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

## network Methods

### Methods in this domain

- [network.getApInfo](#networkgetapinfo)

---

### network.getApInfo

Return information about the device-hosted SoftAP.

- Method ID: `0x0E07`
- Domain: `network`
- Bit Offset: `0`
- Status: `draft`
- Added in v1.0.0
- Encodings: `json`, `tlv`
- Required Capabilities: `network.softAp`
- Possible Events: `network.apInfoChanged`
- Possible Errors: `SUCCESS`, `RPC_METHOD_NOT_FOUND`, `CAPABILITY_METHOD_UNSUPPORTED`, `NOT_SUPPORTED`, `INVALID_STATE`

#### Request Fields

Type: `Empty`

No fields.

#### Response Fields

Type: `NetworkGetApInfoResponse`

| Name | Type | Field ID | Description | Value Restrictions | ?Default Behavior |
| ---- | :---: | :---: | ---- | :---: | ---- |
| enabled | Boolean | 0x01 | Whether the device-hosted SoftAP is currently enabled. | None | N/A |
| ?ssid | String | 0x02 | SoftAP SSID advertised by the device. | maxLength=32 | Omit if not used. |
| ?bssid | String | 0x03 | SoftAP BSSID or MAC address in colon-separated form. | maxLength=17 | Omit if not used. |
| ?band | Enum | 0x04 | SoftAP radio band, such as 2.4GHz, 5GHz or 6GHz. | None | Omit if not used. |
| ?channel | UInt16 | 0x05 | Wi-Fi channel used by the SoftAP. | min=1, max=233 | Omit if not used. |
| ?security | Enum | 0x06 | SoftAP security mode, such as open, wpa2_psk or wpa3_sae. | None | Omit if not used. |
| ?ipAddress | String | 0x07 | IPv4 or IPv6 address assigned to the device on the SoftAP interface. | maxLength=45 | Omit if not used. |
| ?clientCount | UInt16 | 0x08 | Number of clients currently associated with the SoftAP. | None | Omit if not used. |

---

## stream Methods

### Methods in this domain

- [stream.open](#streamopen)

---

### stream.open

Open an AXTP STREAM media channel over USB HID High Speed using media.video or media.audio, without UVC or UAC.

- Method ID: `0x0501`
- Domain: `stream`
- Bit Offset: `0`
- Status: `draft`
- Added in v1.0.0
- Encodings: `json`, `tlv`
- Required Capabilities: `stream.hidMedia`
- Possible Events: `stream.opened`, `stream.error`
- Possible Errors: `SUCCESS`, `BUSY`, `RPC_PARAM_INVALID`, `MEDIA_SOURCE_NOT_FOUND`, `MEDIA_SOURCE_UNAVAILABLE`, `MEDIA_CODEC_UNSUPPORTED`, `MEDIA_RESOLUTION_UNSUPPORTED`, `MEDIA_FRAMERATE_UNSUPPORTED`, `MEDIA_STREAM_START_FAILED`

#### Request Fields

Type: `StreamOpenRequest`

| Name | Type | Field ID | Description | Value Restrictions | ?Default Behavior |
| ---- | :---: | :---: | ---- | :---: | ---- |
| profile | String | 0x01 | Stream Profile name. For this method use media.video or media.audio. | maxLength=32 | N/A |
| transportProfile | String | 0x02 | Transport Profile name. HID media streams use AXTP-USB-HID. | maxLength=32 | N/A |
| direction | Enum | 0x03 | Stream direction; values are device_to_host, host_to_device, or bidirectional. | None | N/A |
| mediaKind | Enum | 0x04 | Media kind carried by this stream; values are video or audio. | None | N/A |
| ?sourceId | UInt16 | 0x05 | Device-local media source identifier. | None | Omit if not used. |
| codec | String | 0x06 | Codec or sample format, for example h264, mjpeg, pcm_s16le, or opus. | maxLength=32 | N/A |
| ?width | UInt16 | 0x07 | Video width in pixels. Required for video streams when not implied by sourceId. | None | Omit if not used. |
| ?height | UInt16 | 0x08 | Video height in pixels. Required for video streams when not implied by sourceId. | None | Omit if not used. |
| ?frameRate | UInt16 | 0x09 | Video frame rate in frames per second. | None | Omit if not used. |
| ?sampleRate | UInt32 | 0x0A | Audio sample rate in Hz. | None | Omit if not used. |
| ?channelCount | UInt8 | 0x0B | Number of audio channels. | None | Omit if not used. |
| ?chunkSizeHint | UInt16 | 0x0C | Preferred STREAM data bytes per Standard Frame after the 16B STREAM header. | None | Omit if not used. |
| ?windowSizeHint | UInt16 | 0x0D | Preferred stream flow-control window in chunks. | None | Omit if not used. |

#### Response Fields

Type: `StreamOpenResponse`

| Name | Type | Field ID | Description | Value Restrictions | ?Default Behavior |
| ---- | :---: | :---: | ---- | :---: | ---- |
| streamId | UInt32 | 0x01 | STREAM channel identifier bound to the selected Stream Profile. | None | N/A |
| profile | String | 0x02 | Accepted Stream Profile name. | maxLength=32 | N/A |
| transportProfile | String | 0x03 | Accepted Transport Profile name. | maxLength=32 | N/A |
| chunkSize | UInt16 | 0x04 | STREAM data bytes to place in each Standard Frame after the 16B STREAM header. | None | N/A |
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

- Event ID: `0x0607`
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

- Event ID: `0x0402`
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

- Event ID: `0x0403`
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

- Event ID: `0x0404`
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

## network Events

### Events in this domain

- [network.apInfoChanged](#networkapinfochanged)

---

### network.apInfoChanged

Emitted when the device-hosted SoftAP state or visible AP information changes.

- Event ID: `0x0E01`
- Domain: `network`
- Bit Offset: `0`
- Status: `draft`
- Severity: `info`
- Added in v1.0.0
- Trigger: `network.getApInfo`, `SoftAP state changed`
- Required Capabilities: `network.softAp`

#### Payload Fields

Type: `NetworkApInfoChangedEvent`

| Name | Type | Field ID | Description | Value Restrictions | ?Default Behavior |
| ---- | :---: | :---: | ---- | :---: | ---- |
| enabled | Boolean | 0x01 | Whether the device-hosted SoftAP is currently enabled. | None | N/A |
| ?ssid | String | 0x02 | SoftAP SSID advertised by the device. | maxLength=32 | Omit if not used. |
| ?bssid | String | 0x03 | SoftAP BSSID or MAC address in colon-separated form. | maxLength=17 | Omit if not used. |
| ?band | Enum | 0x04 | SoftAP radio band, such as 2.4GHz, 5GHz or 6GHz. | None | Omit if not used. |
| ?channel | UInt16 | 0x05 | Wi-Fi channel used by the SoftAP. | min=1, max=233 | Omit if not used. |
| ?security | Enum | 0x06 | SoftAP security mode, such as open, wpa2_psk or wpa3_sae. | None | Omit if not used. |
| ?ipAddress | String | 0x07 | IPv4 or IPv6 address assigned to the device on the SoftAP interface. | maxLength=45 | Omit if not used. |
| ?clientCount | UInt16 | 0x08 | Number of clients currently associated with the SoftAP. | None | Omit if not used. |

---

## stream Events

### Events in this domain

- [stream.opened](#streamopened)
- [stream.error](#streamerror)

---

### stream.opened

Emitted after a STREAM media channel is opened and bound to a streamId.

- Event ID: `0x0501`
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

- Event ID: `0x0503`
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
| transportProfile | String | 0x01 | Supported HID Transport Profile, usually AXTP-USB-HID. | maxLength=32 | N/A |
| maxStreamCount | UInt8 | 0x02 | Maximum simultaneously opened media streams. | None | N/A |
| maxChunkSize | UInt16 | 0x03 | Maximum STREAM data bytes per Standard Frame after the 16B STREAM header. | None | N/A |
| supportsVideo | Boolean | 0x04 | Device can open media.video streams over HID. | None | N/A |
| supportsAudio | Boolean | 0x05 | Device can open media.audio streams over HID. | None | N/A |

---

# Errors Reference

| Code | Name | Category | Severity | Retryable | Status | Message |
| ---- | ---- | ---- | ---- | ---- | ---- | ---- |
| 0x0000 | SUCCESS | common | info | No | stable | Operation completed successfully. |
| 0x0001 | UNKNOWN_ERROR | common | error | No | stable | Unknown error. |
| 0x0002 | NOT_IMPLEMENTED | common | error | No | stable | Feature is not implemented. |
| 0x0003 | NOT_SUPPORTED | common | error | No | stable | Feature is not supported by the current device or mode. |
| 0x0004 | INVALID_STATE | common | error | No | stable | Operation is not allowed in the current state. |
| 0x0005 | BUSY | common | warning | Yes | stable | Device or resource is busy. |
| 0x0006 | TIMEOUT | common | warning | Yes | stable | Operation timed out. |
| 0x0007 | CANCELED | common | error | No | stable | Operation was canceled. |
| 0x0008 | RESOURCE_EXHAUSTED | common | warning | Yes | stable | Resource is exhausted. |
| 0x0009 | PERMISSION_DENIED | common | error | No | stable | Permission denied. |
| 0x000A | INVALID_ARGUMENT | common | error | No | stable | Argument is invalid. |
| 0x000B | OUT_OF_RANGE | common | error | No | stable | Argument is out of range. |
| 0x000C | NOT_FOUND | common | error | No | stable | Resource was not found. |
| 0x000D | ALREADY_EXISTS | common | error | No | draft | Resource already exists. |
| 0x000E | INTERNAL_ERROR | common | error | No | stable | Internal error. |
| 0x000F | UNAVAILABLE | common | warning | Yes | draft | Service is temporarily unavailable. |
| 0x0011 | FRAME_MAGIC_INVALID | frame | error | No | stable | Frame magic is invalid. |
| 0x0012 | FRAME_VERSION_UNSUPPORTED | frame | error | No | stable | Frame version is not supported. |
| 0x0013 | FRAME_HEADER_INVALID | frame | error | No | stable | Frame header is invalid. |
| 0x0014 | FRAME_LENGTH_INVALID | frame | error | No | stable | Frame payload length or total length is invalid. |
| 0x0015 | FRAME_PAYLOAD_TYPE_INVALID | frame | error | No | stable | Frame payload type is invalid. |
| 0x0016 | FRAME_CRC_ERROR | frame | warning | Yes | stable | Frame CRC check failed. |
| 0x0017 | FRAME_FRAGMENT_INVALID | frame | error | No | stable | Frame fragment metadata is invalid. |
| 0x0018 | FRAME_FRAGMENT_MISSING | frame | warning | Yes | stable | One or more frame fragments are missing. |
| 0x0019 | FRAME_REASSEMBLY_TIMEOUT | frame | warning | Yes | stable | Frame reassembly timed out. |
| 0x001A | FRAME_TOO_LARGE | frame | error | No | stable | Frame exceeds the negotiated maximum size. |
| 0x001B | TRANSPORT_MTU_EXCEEDED | frame | error | No | stable | Transport MTU was exceeded. |
| 0x001C | TRANSPORT_WRITE_FAILED | frame | warning | Yes | draft | Transport write failed. |
| 0x001D | TRANSPORT_READ_FAILED | frame | warning | Yes | draft | Transport read failed. |
| 0x001E | TRANSPORT_DISCONNECTED | frame | warning | Yes | stable | Transport disconnected. |
| 0x0021 | CONTROL_OPCODE_INVALID | control | error | No | stable | Control opcode is invalid. |
| 0x0022 | CONTROL_PAYLOAD_INVALID | control | error | No | stable | Control payload is invalid. |
| 0x0023 | RESERVED_CONTROL_BODY_ENCODING_UNSUPPORTED | control | error | No | reserved | Historical control body encoding negotiation error. AXTP v1 implementations must not emit it. |
| 0x0024 | CONTROL_OPEN_REQUIRED | control | error | No | stable | Session has not completed CONTROL OPEN. |
| 0x0025 | CONTROL_OPEN_REJECTED | control | error | No | stable | Control OPEN was rejected. |
| 0x0026 | RESERVED_CONTROL_PROFILE_UNSUPPORTED | control | error | No | reserved | Historical header profile negotiation error. AXTP v1 implementations must not emit it. |
| 0x0027 | CONTROL_NEGOTIATION_FAILED | control | error | No | stable | Control negotiation failed. |
| 0x0028 | CONTROL_SESSION_INVALID | control | error | No | stable | SessionId is invalid. |
| 0x0029 | CONTROL_SESSION_EXPIRED | control | error | No | stable | Session has expired. |
| 0x002A | CONTROL_RESUME_FAILED | control | error | No | stable | Session resume failed. |
| 0x002B | CONTROL_ACK_TARGET_INVALID | control | error | No | stable | ACK/NACK target type is invalid. |
| 0x002C | CONTROL_WINDOW_EXCEEDED | control | warning | Yes | stable | Flow-control window was exceeded. |
| 0x002D | CONTROL_HEARTBEAT_TIMEOUT | control | warning | Yes | stable | Control heartbeat timed out. |
| 0x0031 | RPC_ENCODING_UNSUPPORTED | rpc | error | No | stable | RPC encoding is not supported. |
| 0x0032 | RPC_OP_INVALID | rpc | error | No | stable | RPC operation is invalid. |
| 0x0033 | RPC_PAYLOAD_INVALID | rpc | error | No | stable | RPC payload is invalid. |
| 0x0034 | RPC_BODY_ENCODING_UNSUPPORTED | rpc | error | No | stable | RPC body encoding is not supported. |
| 0x0035 | RPC_BODY_DECODE_FAILED | rpc | error | No | stable | RPC body decoding failed. |
| 0x0036 | RPC_METHOD_NOT_FOUND | rpc | error | No | stable | MethodId or method name is not registered. |
| 0x0037 | RPC_METHOD_NOT_SUPPORTED | rpc | error | No | stable | Method exists but is not supported by the current device. |
| 0x0038 | RPC_METHOD_DISABLED | rpc | error | No | draft | Method is disabled. |
| 0x0039 | RPC_REQUEST_ID_INVALID | rpc | error | No | stable | RPC requestId is invalid. |
| 0x003A | RPC_PARAM_MISSING | rpc | error | No | stable | Required RPC parameter is missing. |
| 0x003B | RPC_PARAM_INVALID | rpc | error | No | stable | RPC parameters are invalid. |
| 0x003C | RPC_PARAM_OUT_OF_RANGE | rpc | error | No | stable | RPC parameter is out of range. |
| 0x003D | RPC_EXECUTION_FAILED | rpc | error | No | stable | RPC method execution failed. |
| 0x003E | RPC_RESPONSE_TIMEOUT | rpc | warning | Yes | stable | RPC response timed out. |
| 0x003F | RPC_BATCH_UNSUPPORTED | rpc | error | No | draft | RPC batch is not supported. |
| 0x0040 | RPC_BATCH_PARTIAL_FAILED | rpc | error | No | draft | One or more RPC batch items failed. |
| 0x0101 | DEVICE_INFO_UNAVAILABLE | device | warning | Yes | stable | Device information is unavailable. |
| 0x0102 | DEVICE_REBOOT_FAILED | device | error | No | draft | Device reboot failed. |
| 0x0103 | DEVICE_FACTORY_RESET_FAILED | device | error | No | draft | Device factory reset failed. |
| 0x0104 | DEVICE_LOW_POWER | device | warning | Yes | draft | Device power is low. |
| 0x0105 | DEVICE_OVER_TEMPERATURE | device | warning | Yes | draft | Device temperature is too high. |
| 0x0106 | DEVICE_STORAGE_FULL | device | error | No | stable | Device storage is full. |
| 0x0107 | DEVICE_MODE_CONFLICT | device | error | No | stable | Device mode conflicts with the requested operation. |
| 0x0108 | DEVICE_RESOURCE_BUSY | device | warning | Yes | stable | Device resource is busy. |
| 0x0109 | DEVICE_HARDWARE_FAILURE | device | error | No | draft | Device hardware failure. |
| 0x0201 | CAPABILITY_NOT_FOUND | capability | error | No | stable | Capability does not exist. |
| 0x0202 | CAPABILITY_DOMAIN_NOT_FOUND | capability | error | No | stable | Capability domain does not exist. |
| 0x0203 | CAPABILITY_METHOD_UNSUPPORTED | capability | error | No | stable | Method capability is not supported. |
| 0x0204 | CAPABILITY_EVENT_UNSUPPORTED | capability | error | No | stable | Event capability is not supported. |
| 0x0205 | CAPABILITY_STREAM_UNSUPPORTED | capability | error | No | stable | Stream capability is not supported. |
| 0x0206 | CAPABILITY_ENCODING_UNSUPPORTED | capability | error | No | stable | Encoding capability is not supported. |
| 0x0207 | CAPABILITY_NEGOTIATION_FAILED | capability | error | No | stable | Business capability negotiation failed. |
| 0x0208 | CAPABILITY_LIMIT_EXCEEDED | capability | error | No | stable | Capability limit was exceeded. |
| 0x0401 | FW_IMAGE_INVALID | firmware | error | No | stable | Firmware image is invalid. |
| 0x0402 | FW_IMAGE_TYPE_UNSUPPORTED | firmware | error | No | stable | Firmware image type is not supported. |
| 0x0403 | FW_VERSION_UNSUPPORTED | firmware | error | No | stable | Firmware version is not supported. |
| 0x0404 | FW_VERSION_TOO_OLD | firmware | error | No | draft | Firmware version is too old. |
| 0x0405 | FW_TRANSFER_NOT_STARTED | firmware | error | No | stable | Firmware transfer has not started. |
| 0x0406 | FW_TRANSFER_ALREADY_STARTED | firmware | error | No | draft | Firmware transfer has already started. |
| 0x0407 | FW_CHUNK_INVALID | firmware | error | No | stable | Firmware chunk is invalid. |
| 0x0408 | FW_CHUNK_CRC_ERROR | firmware | warning | Yes | stable | Firmware chunk CRC failed. |
| 0x0409 | FW_SIZE_MISMATCH | firmware | error | No | stable | Firmware size does not match the declared size. |
| 0x040A | FW_HASH_MISMATCH | firmware | error | No | stable | Firmware hash does not match the declared verification value. |
| 0x040B | FW_VERIFY_FAILED | firmware | error | No | stable | Firmware verification failed. |
| 0x040C | FW_APPLY_FAILED | firmware | error | No | stable | Firmware apply failed. |
| 0x040D | FW_ROLLBACK_FAILED | firmware | error | No | draft | Firmware rollback failed. |
| 0x040E | FW_STORAGE_NOT_ENOUGH | firmware | error | No | stable | Not enough storage for firmware update. |
| 0x040F | FW_DEVICE_NOT_READY | firmware | warning | Yes | stable | Device is not ready for firmware update. |
| 0x0410 | FW_REBOOT_REQUIRED | firmware | error | No | draft | Reboot is required before continuing. |
| 0x0501 | STREAM_NOT_FOUND | stream | error | No | stable | Stream context does not exist. |
| 0x0502 | STREAM_TIMEOUT | stream | warning | Yes | stable | Stream timed out. |
| 0x0503 | STREAM_CRC_ERROR | stream | warning | Yes | stable | Stream chunk CRC check failed. |
| 0x0504 | STREAM_PAYLOAD_INVALID | stream | error | No | stable | Stream payload is invalid. |
| 0x0505 | STREAM_ID_INVALID | stream | error | No | stable | StreamId is invalid. |
| 0x0506 | STREAM_NOT_OPEN | stream | error | No | stable | Stream is not open. |
| 0x0507 | STREAM_ALREADY_OPEN | stream | error | No | draft | Stream is already open. |
| 0x0508 | STREAM_SEQ_INVALID | stream | error | No | stable | Stream seqId is invalid. |
| 0x0509 | STREAM_SEQ_DUPLICATED | stream | error | No | draft | Stream seqId is duplicated. |
| 0x050A | STREAM_CHUNK_MISSING | stream | warning | Yes | stable | Stream chunk is missing. |
| 0x050B | STREAM_OFFSET_INVALID | stream | error | No | stable | Stream cursor or offset is invalid. |
| 0x050C | STREAM_WINDOW_FULL | stream | warning | Yes | stable | Stream receive window is full. |
| 0x050D | STREAM_BACKPRESSURE | stream | warning | Yes | draft | Stream receiver reported backpressure. |
| 0x050E | STREAM_RESUME_UNSUPPORTED | stream | error | No | stable | Stream resume is not supported. |
| 0x050F | STREAM_RESUME_FAILED | stream | error | No | stable | Stream resume failed. |
| 0x0510 | STREAM_CLOSED | stream | error | No | stable | Stream is closed. |
| 0x0511 | STREAM_TRANSFER_ABORTED | stream | error | No | stable | Stream transfer was aborted. |
| 0x0801 | MEDIA_SOURCE_NOT_FOUND | video | error | No | stable | Requested media source does not exist. |
| 0x0802 | MEDIA_SOURCE_UNAVAILABLE | video | warning | Yes | stable | Requested media source is currently unavailable. |
| 0x0803 | MEDIA_CODEC_UNSUPPORTED | video | error | No | stable | Requested media codec or sample format is unsupported. |
| 0x0804 | MEDIA_RESOLUTION_UNSUPPORTED | video | error | No | stable | Requested video resolution is unsupported. |
| 0x0805 | MEDIA_FRAMERATE_UNSUPPORTED | video | error | No | stable | Requested video frame rate is unsupported. |
| 0x0806 | MEDIA_BITRATE_UNSUPPORTED | video | error | No | draft | Requested media bitrate is unsupported. |
| 0x0807 | MEDIA_STREAM_START_FAILED | video | warning | Yes | stable | Device failed to start the requested media stream. |
| 0x0808 | MEDIA_STREAM_STOP_FAILED | video | warning | Yes | draft | Device failed to stop the media stream. |
| 0x0809 | MEDIA_FRAME_DROPPED | video | warning | Yes | draft | Media frame was dropped. |
| 0x080B | MEDIA_VIDEO_SIGNAL_LOST | video | warning | Yes | draft | Video signal was lost. |
| 0x090A | MEDIA_AUDIO_DEVICE_NOT_FOUND | audio | error | No | draft | Audio device was not found. |
| 0x1001 | FILE_NOT_FOUND | file | error | No | stable | File does not exist. |
| 0x1002 | FILE_ALREADY_EXISTS | file | error | No | draft | File already exists. |
| 0x1003 | FILE_PERMISSION_DENIED | file | error | No | stable | File permission denied. |
| 0x1004 | FILE_PATH_INVALID | file | error | No | stable | File path is invalid. |
| 0x1005 | FILE_TYPE_UNSUPPORTED | file | error | No | stable | File type is not supported. |
| 0x1006 | FILE_TOO_LARGE | file | error | No | stable | File is too large. |
| 0x1007 | FILE_READ_FAILED | file | warning | Yes | stable | File read failed. |
| 0x1008 | FILE_WRITE_FAILED | file | warning | Yes | stable | File write failed. |
| 0x1009 | FILE_DELETE_FAILED | file | error | No | draft | File delete failed. |
| 0x100A | FILE_TRANSFER_FAILED | file | warning | Yes | stable | File transfer failed. |
| 0x100B | FILE_VERIFY_FAILED | file | error | No | stable | File verification failed. |
| 0x100C | FILE_STORAGE_FULL | file | error | No | stable | File storage is full. |
| 0x1201 | DIAG_TEST_NOT_FOUND | diagnostic | error | No | draft | Diagnostic test was not found. |
| 0x1202 | DIAG_TEST_UNSUPPORTED | diagnostic | error | No | draft | Diagnostic test is not supported. |
| 0x1203 | DIAG_TEST_RUNNING | diagnostic | error | No | draft | Diagnostic test is already running. |
| 0x1204 | DIAG_TEST_FAILED | diagnostic | error | No | draft | Diagnostic test failed. |
| 0x1205 | DIAG_METRIC_UNAVAILABLE | diagnostic | warning | Yes | draft | Diagnostic metric is unavailable. |
| 0x1206 | DIAG_LOOPBACK_FAILED | diagnostic | error | No | draft | Diagnostic loopback failed. |
| 0x1401 | SEC_AUTH_REQUIRED | auth | error | No | draft | Authentication is required. |
| 0x1402 | SEC_AUTH_FAILED | auth | error | No | draft | Authentication failed. |
| 0x1403 | SEC_PERMISSION_DENIED | auth | error | No | draft | Security permission denied. |
| 0x1404 | SEC_ENCRYPTION_REQUIRED | auth | error | No | draft | Encryption is required. |
| 0x1405 | SEC_DECRYPT_FAILED | auth | error | No | draft | Decryption failed. |
| 0x1406 | SEC_SIGNATURE_INVALID | auth | error | No | draft | Signature is invalid. |
| 0x1407 | SEC_CERT_INVALID | auth | error | No | draft | Certificate is invalid. |
| 0x1408 | SEC_TOKEN_EXPIRED | auth | error | No | draft | Security token expired. |
| 0x7F01 | LEGACY_CMD_UNMAPPED | legacy | error | No | stable | Legacy CmdValue is not mapped to an AXTP method. |
| 0x7F02 | LEGACY_STATUS_UNMAPPED | legacy | error | No | stable | Legacy status is not mapped to an AXTP ErrorCode. |
| 0x7F03 | LEGACY_PAYLOAD_INVALID | legacy | error | No | stable | Legacy payload is invalid. |
| 0x7F04 | LEGACY_PAYLOAD_TOO_SHORT | legacy | error | No | stable | Legacy payload is too short. |
| 0x7F05 | LEGACY_PAYLOAD_TOO_LONG | legacy | error | No | stable | Legacy payload is too long. |
| 0x7F06 | LEGACY_FIELD_UNSUPPORTED | legacy | error | No | stable | Legacy field cannot be adapted. |
| 0x7F07 | LEGACY_CAPABILITY_CONFLICT | legacy | error | No | stable | Legacy capability conflicts with AXTP capability. |
| 0x7F08 | LEGACY_RESPONSE_TIMEOUT | legacy | warning | Yes | stable | Legacy response timed out. |

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
- Required Methods: `device.getInfo`, `capability.supportedMethods`, `firmware.begin`, `firmware.end`, `firmware.verify`, `firmware.apply`, `display.getBrightness`, `display.setBrightness`
- Required Events: `firmware.updateProgress`, `firmware.updateCompleted`, `firmware.updateFailed`, `display.brightnessChanged`
- Required Errors: `SUCCESS`, `RPC_METHOD_NOT_FOUND`, `RPC_PARAM_INVALID`, `STREAM_NOT_FOUND`, `STREAM_CRC_ERROR`, `BUSY`
- Notes: -

---

## AXTP-MVP-HID

- Status: `stable`
- Added in v1.0.0
- Extends: `AXTP-MVP`
- Required Methods: `device.getInfo`, `capability.supportedMethods`, `firmware.begin`, `firmware.end`, `firmware.verify`, `firmware.apply`, `display.getBrightness`, `display.setBrightness`
- Required Events: `firmware.updateProgress`, `firmware.updateCompleted`, `firmware.updateFailed`, `display.brightnessChanged`
- Required Errors: `SUCCESS`, `RPC_METHOD_NOT_FOUND`, `RPC_PARAM_INVALID`, `STREAM_NOT_FOUND`, `STREAM_CRC_ERROR`, `BUSY`
- Notes: -

---
