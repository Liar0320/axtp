# AXTP Specs

`docs/specs/` 是 AXTP 的正式规范区。`00-07` 定义 core protocol，`08` 前置定义 domain-feature-method-event 命名治理，`09-14` 在该命名治理下定义 registry 元模型和正式 registry 规划表，`15-18` 定义类型、TLV、字段编号和低带宽降级，`19` 定义 Generator。

## 先读哪几篇

如果只想先看懂 AXTP 怎么连、线上怎么传，按下面顺序读：

```text
00  总览：AXTP 分成哪几层，有哪两条连接路径
02  Wire format：有 Frame Header 时，Header + Payload + CRC 怎么排
03  Transport：不同连接方式下，谁先发 OPEN / Hello / Identify
04  CONTROL 细节：OPEN / ACCEPT / ACK / NACK 的 Payload
05  RPC 细节：JSON sid/op/d 与 Binary RPC Payload
06  STREAM 细节：16B STREAM Header + data
```

两条主线要分开看：

| 主线 | 适用传输 | 线上结构 | 能力 |
|---|---|---|---|
| 有 Frame Header | `AXTP-USB-HID`、`AXTP-TCP` | `Standard Frame Header(12B) + Payload(N) + CRC16(2B)` | CONTROL / RPC / STREAM |
| 无 Frame Header | `AXTP-WS-JSON`、`AXTP-WS-CLOUD-REVERSE` | `WebSocket message payload = JSON { sid, op, d }` | RPC-only |

无 Frame Header 路径没有 CONTROL、STREAM、CRC16、Binary RPC 11B Header，也不参与 CONTROL ACK/NACK / RESUME。

---

| 编号 | 文档 | 角色 |
|---|---|---|
| 00 | `00-AXTP-Overview.md` | 协议总览 |
| 01 | `01-AXTP-Protocol-Framework.md` | 协议框架 |
| 02 | `02-AXTP-Frame-and-Payload-Spec.md` | Frame/Payload wire format |
| 03 | `03-AXTP-Transport-Profiles.md` | Transport profiles |
| 04 | `04-AXTP-Control-Session-Spec.md` | CONTROL session |
| 05 | `05-AXTP-RPC-Session-Spec.md` | RPC session |
| 06 | `06-AXTP-Stream-Spec.md` | STREAM data plane |
| 07 | `07-AXTP-Compatibility-and-Versioning.md` | 兼容与版本治理 |
| 08 | `08-AXTP-Capability-Naming-and-Feature-Taxonomy.md` | Domain-feature-method-event 命名治理 |
| 09 | `09-AXTP-Protocol-Definition-Mapping-Spec.md` | Registry 总则、Protocol Definition 映射、ID/Domain 规划 |
| 10 | `10-AXTP-Methods-Registry-Spec.md` | Method registry 元模型与 MethodId 表 |
| 11 | `11-AXTP-Events-Registry-Spec.md` | Event registry 元模型与 EventId 表 |
| 12 | `12-AXTP-Errors-Registry-Spec.md` | Error registry 元模型与 ErrorCode 表 |
| 13 | `13-AXTP-Types-and-Capability-Spec.md` | Schema / Capability 元模型与 CapabilityId 表 |
| 14 | `14-AXTP-Profiles-Registry-Spec.md` | Profile 元模型与 MVP 最小实现表 |
| 15 | `15-AXTP-Type-System.md` | 基础类型系统 |
| 16 | `16-AXTP-TLV-Schema-Encoding.md` | TLV schema 编码 |
| 17 | `17-AXTP-Schema-Field-Numbering.md` | Schema fieldId 编号 |
| 18 | `18-AXTP-Low-Bandwidth-Degradation.md` | 低带宽降级 |
| 19 | `19-AXTP-Generator-v1实现规范.md` | Generator v1 实现规范 |

实现事实源仍为 `registry/**/*.yaml` 与 `registry/domains/**/*.yaml`。如果 specs 表格与 YAML/generated 发生冲突，以 YAML/generated 为实现事实源，并应回修 specs。

新增业务协议先进入 `docs/protocol/<domain>/<domain.feature>.md` 作为草案输入；内部评审确认后，再反向确认 08-13、写入 YAML 并由 Generator 生成正式产物。未采纳草案不是研发实现合同。

推荐实现阅读顺序：

```text
00-08  协议框架、wire format、会话、兼容和命名治理
15-17  基础类型、TLV 编码和 schema fieldId 规则
09-14  Protocol Definition、registry 表格和 MVP 合同
18-19  低带宽补充规范和 Generator 实现规范
```
