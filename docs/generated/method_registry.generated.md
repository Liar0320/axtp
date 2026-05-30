# Method Registry

| methodId | name | domain | status | request | response | legacy |
|---:|---|---|---|---|---|---|
| `0x0101` | `device.getInfo` | device | mvp | DeviceGetInfoRequest | DeviceGetInfoResponse | - |
| `0x0301` | `capability.supportedMethods` | capability | mvp | CapabilitySupportedMethodsRequest | CapabilitySupportedMethodsResponse | - |
| `0x0501` | `display.getBrightness` | display | mvp | DisplayGetBrightnessRequest | DisplayGetBrightnessResponse | - |
| `0x0502` | `display.setBrightness` | display | mvp | DisplaySetBrightnessRequest | CommonEmptyResponse | - |
| `0x0901` | `stream.open` | stream | draft | StreamOpenRequest | StreamOpenResponse | - |
| `0x0B02` | `firmware.begin` | firmware | mvp | FirmwareBeginRequest | FirmwareBeginResponse | - |
| `0x0B03` | `firmware.end` | firmware | mvp | FirmwareEndRequest | FirmwareEndResponse | - |
| `0x0B04` | `firmware.verify` | firmware | mvp | FirmwareVerifyRequest | FirmwareVerifyResponse | - |
| `0x0B05` | `firmware.apply` | firmware | mvp | FirmwareApplyRequest | FirmwareApplyResponse | - |
