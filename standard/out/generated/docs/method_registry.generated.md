# Method Registry

| methodId | name | domain | status | request | response | legacy |
|---:|---|---|---|---|---|---|
| `0x0101` | `device.getInfo` | device | mvp | DeviceGetInfoRequest | DeviceGetInfoResponse | 720898 |
| `0x0301` | `capability.getAll` | capability | mvp | CapabilityGetAllRequest | CapabilityGetAllResponse | - |
| `0x0601` | `brightness.get` | brightness | mvp | BrightnessGetRequest | BrightnessGetResponse | - |
| `0x0602` | `brightness.set` | brightness | mvp | BrightnessSetRequest | CommonEmptyResponse | 720962 |
| `0x0B02` | `firmware.begin` | firmware | mvp | FirmwareBeginRequest | FirmwareBeginResponse | - |
| `0x0B03` | `firmware.end` | firmware | mvp | FirmwareEndRequest | CommonEmptyResponse | - |
| `0x0B04` | `firmware.verify` | firmware | mvp | FirmwareVerifyRequest | CommonEmptyResponse | - |
| `0x0B05` | `firmware.apply` | firmware | mvp | FirmwareApplyRequest | CommonEmptyResponse | - |
