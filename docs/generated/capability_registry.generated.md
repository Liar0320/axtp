# Capability Registry

| capabilityId | name | domain | status | type | schema |
|---:|---|---|---|---|---|
| `0x0001` | `protocol.payload.control` | protocol | mvp | bool | - |
| `0x0002` | `protocol.payload.rpc` | protocol | mvp | bool | - |
| `0x0003` | `protocol.payload.stream` | protocol | mvp | bool | - |
| `0x0009` | `protocol.reservedRequestIdWidth` | protocol | reserved | reserved | - |
| `0x0101` | `device.info` | device | mvp | bool | - |
| `0x0201` | `capability.supportedMethods` | capability | mvp | bool | - |
| `0x0401` | `firmware.ota` | firmware | mvp | object | FirmwareOtaCapability |
| `0x050A` | `stream.hidMedia` | stream | draft | object | StreamHidMediaCapability |
| `0x0601` | `display.brightness` | display | mvp | bool | - |
| `0x0602` | `display.brightnessMin` | display | mvp | uint16 | - |
| `0x0603` | `display.brightnessMax` | display | mvp | uint16 | - |
| `0x0604` | `display.brightnessStep` | display | mvp | uint16 | - |
| `0x0E06` | `network.softAp` | network | draft | bool | - |
