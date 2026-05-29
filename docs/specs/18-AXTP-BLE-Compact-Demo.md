# 18《AXTP BLE Compact Demo》

版本：v1.3  
状态：Superseded / Non-normative

本文档已被 22《AXTP MVP Normative Demo》取代。正式 BLE 实现以下列文档为准：

| 目标 | 使用文档 |
| --- | --- |
| BLE Compact MVP 完整流程 | `22-AXTP-MVP-Normative-Demo.md` |
| Compact Frame Header | `02-AXTP-Frame-and-Payload-Spec.md` |
| Control Payload（统一 5B 头） | `04-AXTP-Control-Session-Spec.md` |
| STREAM | `06-AXTP-Stream-Spec.md` |
| Legacy 迁移 | `07-AXTP-Compatibility-and-Versioning.md` |

BLE GATT 使用 Compact Frame Profile（4B Header + CRC8）。断线重连通过 CONTROL RESUME 恢复 Session。详见 05《连接场景与调用流程规范》§7。
