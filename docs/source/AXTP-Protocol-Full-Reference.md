# AXTP Protocol Full Reference

> Status: Protocol Content Source
> Scope: Consolidated AXTP v1 business content and legacy migration reference

## 1. Purpose

This file consolidates AXTP v1 business protocol content for human review. The machine-readable source of truth is:

```text
registry/**/*.yaml
registry/domains/**/*.yaml
```

This source reference uses the target domain-feature names from 21《AXTP Capability Naming and Feature Taxonomy》. Some registry YAML entries still use the pre-migration names until the registry migration is executed.

The source/planning registry documents are retained at:

```text
docs/source/
```

## 2. Current v1 MVP Methods

| methodId | name | domain | request | response | status |
|---|---|---|---|---|---|
| `0x0101` | `device.getInfo` | `device` | `DeviceGetInfoRequest` | `DeviceGetInfoResponse` | stable |
| `0x0301` | `capability.supportedMethods` | `capability` | `CapabilitySupportedMethodsRequest` | `CapabilitySupportedMethodsResponse` | stable |
| `0x0501` | `display.getBrightness` | `display` | `DisplayGetBrightnessRequest` | `DisplayGetBrightnessResponse` | stable |
| `0x0502` | `display.setBrightness` | `display` | `DisplaySetBrightnessRequest` | `CommonEmptyResponse` | stable |
| `0x0B02` | `firmware.beginOta` | `firmware` | `FirmwareBeginRequest` | `FirmwareBeginResponse` | stable |
| `0x0B03` | `firmware.commitOtaBatch` | `firmware` | `FirmwareEndRequest` | `CommonEmptyResponse` | stable |
| `0x0B04` | `firmware.verifyOtaFiles` | `firmware` | `FirmwareVerifyRequest` | `CommonEmptyResponse` | stable |
| `0x0B05` | `firmware.installOta` | `firmware` | `FirmwareApplyRequest` | `CommonEmptyResponse` | stable |

## 3. Current v1 MVP Events

| eventId | name | domain | payload | severity |
|---|---|---|---|---|
| `0x8507` | `display.brightnessChanged` | `display` | `DisplayBrightnessChangedEvent` | info |
| `0x8B02` | `firmware.otaProgressReported` | `firmware` | `FirmwareUpdateProgressEvent` | info |
| `0x8B03` | `firmware.otaStateChanged` | `firmware` | `FirmwareUpdateCompletedEvent` | info |
| `0x8B04` | `firmware.otaResultReported` | `firmware` | `FirmwareUpdateFailedEvent` | error |

## 4. Current Error Set

| code | name | category | status | retryable |
|---|---|---|---|---|
| `0x0000` | `SUCCESS` | common | stable | false |
| `0x0001` | `UNKNOWN_ERROR` | common | stable | false |
| `0x0005` | `BUSY` | common | stable | true |
| `0x0102` | `FRAME_VERSION_UNSUPPORTED` | frame | stable | false |
| `0x0106` | `FRAME_CRC_ERROR` | frame | stable | true |
| `0x0108` | `FRAME_FRAGMENT_MISSING` | frame | stable | true |
| `0x0201` | `CONTROL_OPCODE_INVALID` | control | stable | false |
| `0x0202` | `CONTROL_PAYLOAD_INVALID` | control | stable | false |
| `0x0204` | `CONTROL_OPEN_REQUIRED` | control | stable | false |
| `0x0205` | `CONTROL_OPEN_REJECTED` | control | stable | false |
| `0x0206` | `RESERVED_CONTROL_PROFILE_UNSUPPORTED` | control | reserved | false |
| `0x0207` | `CONTROL_NEGOTIATION_FAILED` | control | stable | false |
| `0x0208` | `CONTROL_SESSION_INVALID` | control | stable | false |
| `0x020A` | `CONTROL_RESUME_FAILED` | control | stable | false |
| `0x020C` | `CONTROL_WINDOW_EXCEEDED` | control | stable | true |
| `0x0301` | `RPC_ENCODING_UNSUPPORTED` | rpc | stable | false |
| `0x0306` | `RPC_METHOD_NOT_FOUND` | rpc | stable | false |
| `0x030B` | `RPC_PARAM_INVALID` | rpc | stable | false |
| `0x0401` | `STREAM_NOT_FOUND` | stream | stable | false |
| `0x0402` | `STREAM_TIMEOUT` | stream | stable | true |
| `0x0403` | `STREAM_CRC_ERROR` | stream | stable | true |
| `0x060B` | `FW_VERIFY_FAILED` | firmware | stable | false |

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
| `FirmwareUpdateProgressEvent` | OTA progress reported event payload. |
| `FirmwareUpdateCompletedEvent` | OTA state changed event payload. |
| `FirmwareUpdateFailedEvent` | OTA result reported event payload. |
| `FirmwareOtaCapability` | Reserved object shape for future full capability modeling. |

## 6. v1 Profile

The `AXTP-MVP` profile requires:

- CONTROL, RPC and STREAM payload support.
- `device.getInfo`.
- `capability.supportedMethods`.
- display brightness get/set.
- firmware OTA begin/commit/verify/install.
- display brightness and firmware OTA events.
- method bitmap discovery derived from `methods[].bitOffset`.

Transport bindings are defined in Source YAML and emitted into the generated `protocol/axtp.protocol.yaml`.

## 7. Legacy Mapping Notes

The current v1 protocol preserves known legacy command mappings as request metadata:

| request | legacy command | legacy name | payload format |
|---|---|---|---|
| `device.getInfo` | `0x000B0002` | `BetaDeviceInfo` | fixed_struct |
| `display.setBrightness` | `0x000B0042` | `BetaBrightnessSet` | fixed_struct |

Deprecated registry aliases pending migration:

| old name | target source name |
|---|---|
| `firmware.begin` | `firmware.beginOta` |
| `firmware.end` | `firmware.commitOtaBatch` |
| `firmware.verify` | `firmware.verifyOtaFiles` |
| `firmware.apply` | `firmware.installOta` |
| `firmware.updateProgress` | `firmware.otaProgressReported` |
| `firmware.updateCompleted` | `firmware.otaStateChanged` |
| `firmware.updateFailed` | `firmware.otaResultReported` |

Additional legacy material must be summarized in `docs/source/AXTP-Legacy-Compatibility-Reference.md` before it is promoted into `registry/**/*.yaml` or `registry/domains/**/*.yaml`.
