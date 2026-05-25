# Capability Registry

| capabilityId | name | domain | status | type | schema |
|---:|---|---|---|---|---|
| `0x0001` | `protocol.payload.control` | protocol | mvp | bool | - |
| `0x0002` | `protocol.payload.rpc` | protocol | mvp | bool | - |
| `0x0003` | `protocol.payload.stream` | protocol | mvp | bool | - |
| `0x0101` | `device.info` | device | mvp | bool | - |
| `0x0201` | `session.identify` | session | mvp | bool | - |
| `0x0301` | `capability.get` | capability | mvp | bool | - |
| `0x0309` | `reserved.requestIdWidth` | reserved | reserved | reserved | - |
| `0x0601` | `brightness.get` | brightness | mvp | bool | - |
| `0x0602` | `brightness.set` | brightness | mvp | bool | - |
| `0x0603` | `brightness.event` | brightness | mvp | bool | - |
| `0x0B01` | `firmware.ota` | firmware | mvp | object | FirmwareOtaCapability |
