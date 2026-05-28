# AXTP Protocol Full Reference

> Status: Protocol Content Source
> Scope: Consolidated AXTP v1 business content and legacy migration reference

## 1. Purpose

This file consolidates AXTP v1 business protocol content for human review. The machine-readable source of truth is:

```text
protocol/axtp.protocol.yaml
```

The legacy hand-written 08-13 registry documents are retained at:

```text
protocol-source/legacy-docs/registry-v2/
```

## 2. Current v1 MVP Requests

| methodId | name | domain | request | response | status |
|---|---|---|---|---|---|
| `0x0101` | `device.getInfo` | `device` | `DeviceGetInfoRequest` | `DeviceGetInfoResponse` | mvp |
| `0x0301` | `capability.supportedMethods` | `capability` | `CapabilitySupportedMethodsRequest` | `CapabilitySupportedMethodsResponse` | mvp |
| `0x0501` | `display.getBrightness` | `display` | `DisplayGetBrightnessRequest` | `DisplayGetBrightnessResponse` | mvp |
| `0x0502` | `display.setBrightness` | `display` | `DisplaySetBrightnessRequest` | `CommonEmptyResponse` | mvp |
| `0x0B02` | `firmware.begin` | `firmware` | `FirmwareBeginRequest` | `FirmwareBeginResponse` | mvp |
| `0x0B03` | `firmware.end` | `firmware` | `FirmwareEndRequest` | `CommonEmptyResponse` | mvp |
| `0x0B04` | `firmware.verify` | `firmware` | `FirmwareVerifyRequest` | `CommonEmptyResponse` | mvp |
| `0x0B05` | `firmware.apply` | `firmware` | `FirmwareApplyRequest` | `CommonEmptyResponse` | mvp |

## 3. Current v1 MVP Events

| eventId | name | domain | payload | severity |
|---|---|---|---|---|
| `0x8507` | `display.brightnessChanged` | `display` | `DisplayBrightnessChangedEvent` | info |
| `0x8B02` | `firmware.updateProgress` | `firmware` | `FirmwareUpdateProgressEvent` | info |
| `0x8B03` | `firmware.updateCompleted` | `firmware` | `FirmwareUpdateCompletedEvent` | info |
| `0x8B04` | `firmware.updateFailed` | `firmware` | `FirmwareUpdateFailedEvent` | error |

## 4. Current Error Set

| code | name | category | status | retryable |
|---|---|---|---|---|
| `0x0000` | `SUCCESS` | common | mvp | false |
| `0x0001` | `UNKNOWN_ERROR` | common | mvp | false |
| `0x0005` | `BUSY` | common | mvp | true |
| `0x0102` | `FRAME_VERSION_UNSUPPORTED` | frame | mvp | false |
| `0x0106` | `FRAME_CRC_ERROR` | frame | mvp | true |
| `0x0108` | `FRAME_FRAGMENT_MISSING` | frame | mvp | true |
| `0x0201` | `CONTROL_OPCODE_INVALID` | control | mvp | false |
| `0x0202` | `CONTROL_PAYLOAD_INVALID` | control | mvp | false |
| `0x0204` | `CONTROL_OPEN_REQUIRED` | control | mvp | false |
| `0x0205` | `CONTROL_OPEN_REJECTED` | control | mvp | false |
| `0x0206` | `RESERVED_CONTROL_PROFILE_UNSUPPORTED` | control | reserved | false |
| `0x0207` | `CONTROL_NEGOTIATION_FAILED` | control | mvp | false |
| `0x0208` | `CONTROL_SESSION_INVALID` | control | mvp | false |
| `0x020A` | `CONTROL_RESUME_FAILED` | control | mvp | false |
| `0x020C` | `CONTROL_WINDOW_EXCEEDED` | control | mvp | true |
| `0x0301` | `RPC_ENCODING_UNSUPPORTED` | rpc | mvp | false |
| `0x0306` | `RPC_METHOD_NOT_FOUND` | rpc | mvp | false |
| `0x030B` | `RPC_PARAM_INVALID` | rpc | mvp | false |
| `0x0401` | `STREAM_NOT_FOUND` | stream | mvp | false |
| `0x0402` | `STREAM_TIMEOUT` | stream | mvp | true |
| `0x0403` | `STREAM_CRC_ERROR` | stream | mvp | true |
| `0x060B` | `FW_VERIFY_FAILED` | firmware | mvp | false |

## 5. Type Inventory

The v1 type set includes:

| type | role |
|---|---|
| `CommonEmptyRequest` | Empty request body. |
| `CommonEmptyResponse` | Empty response body. |
| `DeviceGetInfoRequest` | Empty device information request. |
| `DeviceGetInfoResponse` | Vendor, product, firmware version and serial number. |
| `CapabilitySupportedMethodsRequest` | Empty method bitmap request. |
| `CapabilitySupportedMethodsResponse` | Method count and derived methodId set. |
| `DisplayGetBrightnessRequest` | Empty brightness read request. |
| `DisplayGetBrightnessResponse` | Current brightness value. |
| `DisplaySetBrightnessRequest` | Target brightness and optional transition time. |
| `DisplayBrightnessChangedEvent` | Brightness event payload. |
| `FirmwareBeginRequest` | OTA metadata and preferred chunk size. |
| `FirmwareBeginResponse` | Stream allocation and stream transfer parameters. |
| `FirmwareEndRequest` | End transfer for a stream. |
| `FirmwareVerifyRequest` | Verify transferred firmware for a stream. |
| `FirmwareApplyRequest` | Apply verified firmware for a stream. |
| `FirmwareUpdateProgressEvent` | OTA progress event. |
| `FirmwareUpdateCompletedEvent` | OTA completion event. |
| `FirmwareUpdateFailedEvent` | OTA failure event. |
| `FirmwareOtaCapability` | Reserved object shape for future full capability modeling. |

## 6. v1 Profile

The `AXTP-MVP` profile requires:

- CONTROL, RPC and STREAM payload support.
- `device.getInfo`.
- `capability.supportedMethods`.
- display brightness get/set.
- firmware OTA begin/end/verify/apply.
- display brightness and firmware update events.
- method bitmap discovery derived from `requests[].methodId`.

Transport bindings are defined in `protocol/axtp.protocol.yaml`.

## 7. Legacy Mapping Notes

The current v1 protocol preserves known legacy command mappings as request metadata:

| request | legacy command | legacy name | payload format |
|---|---|---|---|
| `device.getInfo` | `0x000B0002` | `BetaDeviceInfo` | fixed_struct |
| `display.setBrightness` | `0x000B0042` | `BetaBrightnessSet` | fixed_struct |

Additional legacy material must be migrated into `protocol-source/legacy-inputs/` or summarized here before it is promoted into `protocol/axtp.protocol.yaml`.

