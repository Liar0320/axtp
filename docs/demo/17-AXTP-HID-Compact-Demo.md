# 17《AXTP HID Demo》

版本：v1.3  
状态：Superseded / Non-normative

本文档已被 22《AXTP MVP Normative Demo》取代。正式 HID 实现以下列文档为准：

| 目标 | 使用文档 |
| --- | --- |
| HID MVP 完整流程 | `22-AXTP-MVP-Normative-Demo.md` |
| Frame Header（Standard/Compact） | `02-AXTP-Frame-and-Payload-Spec.md` |
| Control Payload（统一 5B 头） | `04-AXTP-Control-Session-Spec.md` |
| STREAM | `06-AXTP-Stream-Spec.md` |
| Legacy 迁移 | `07-AXTP-Compatibility-and-Versioning.md` |

HID 默认使用 Standard Frame Profile，Report Size ≤ 64B 时通过 CONTROL OPEN 协商降级为 Compact Profile。详见 05《连接场景与调用流程规范》§6。
