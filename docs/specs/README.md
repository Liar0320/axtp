# AXTP Specs

`docs/specs/` 是 AXTP 的正式规范区，回答“AXTP 的规则是什么”。这里的 Markdown 规范不替代 `registry/**/*.yaml` 与 `registry/domains/**/*.yaml` 的机器事实源角色，也不承载未评审业务草案。

## 先读哪几篇

如果只想先看懂 AXTP 怎么连、线上怎么传，按下面顺序读：

```text
1-core/01  总览：AXTP 分成哪几层，有哪两条连接路径
1-core/03  Wire format：有 Frame Header 时，Header + Payload + CRC 怎么排
1-core/04  Transport：不同连接方式下，谁先发 OPEN / Hello / Identify
1-core/05  CONTROL 细节：OPEN / ACCEPT / HEARTBEAT / CLOSE；ACK / NACK 预留
1-core/06  RPC 细节：JSON / CBOR / MSGPACK / JSON_BINARY 与 sid/op/d
1-core/07  STREAM 细节：16B STREAM Header + data，P0 用于 audio/video 媒体流
```

两条主线要分开看：

| 主线 | 适用传输 | 线上结构 | 能力 |
|---|---|---|---|
| 有 Frame Header | `AXTP-USB-HID`、`AXTP-TCP` | `Standard Frame Header(12B) + Payload(N) + CRC16(2B)` | CONTROL / RPC / STREAM |
| 无 Frame Header | `AXTP-WS-JSON`、`AXTP-WS-CLOUD-REVERSE` | `WebSocket message payload = JSON { sid, op, d }` | RPC-only |

无 Frame Header 路径没有 CONTROL、STREAM、CRC16、JSON_BINARY RPC 15B Header，也不参与 CONTROL ACK/NACK / RESUME。

## 分组导航

| 分组 | 文档 | 角色 |
|---|---|---|
| Core | `1-core/01-Overview.md` | 协议总览 |
| Core | `1-core/02-Protocol-Framework.md` | 协议框架 |
| Core | `1-core/03-Frame-and-Payload.md` | Frame/Payload wire format |
| Core | `1-core/04-Transport-Profiles.md` | Transport profiles |
| Core | `1-core/05-Control-Session.md` | CONTROL session |
| Core | `1-core/06-RPC-Session.md` | RPC session |
| Core | `1-core/07-Stream-Data-Plane.md` | STREAM data plane |
| Core | `1-core/08-Low-Bandwidth-Degradation.md` | 低带宽降级 |
| Registry | `2-registry/01-Naming-and-Taxonomy.md` | Domain-feature-method-event 命名治理 |
| Registry | `2-registry/02-Methods-Registry.md` | Method registry 元模型与 MethodId 表 |
| Registry | `2-registry/03-Events-Registry.md` | Event registry 元模型与 EventId 表 |
| Registry | `2-registry/04-Errors-Registry.md` | Error registry 元模型与 ErrorCode 表 |
| Registry | `2-registry/05-Profiles-Registry.md` | Profile 元模型与 MVP 最小实现表 |
| Codec | `3-codec/01-Type-System.md` | 基础类型系统 |
| Codec | `3-codec/02-Capability-Types.md` | Schema / Capability 元模型与 CapabilityId 表 |
| Codec | `3-codec/03-TLV-Encoding.md` | TLV schema 编码 |
| Codec | `3-codec/04-Schema-Numbering.md` | Schema fieldId 编号 |
| Tooling | `4-tooling/01-YAML-Mapping.md` | Registry 总则、Protocol Definition 映射、ID/Domain 规划 |
| Tooling | `4-tooling/02-Generator-V1.md` | Generator v1 实现规范 |
| Tooling | `4-tooling/03-Versioning.md` | 兼容与版本治理 |

## 阅读路径

| 读者 | 推荐路径 |
|---|---|
| 新读者 / 实现者 | Core 分组：`1-core/01` -> `1-core/03` -> `1-core/04` -> `1-core/05` -> `1-core/06` -> `1-core/07` |
| 协议维护者 | Registry 分组 + `3-codec/02-Capability-Types.md` + Tooling 分组 |
| 低带宽或 HID/BLE 降级评审 | 先读 `1-core/08-Low-Bandwidth-Degradation.md`，再回到 Core wire/session 文档对齐边界 |

## 权威边界

实现事实源仍为 `registry/**/*.yaml` 与 `registry/domains/**/*.yaml`。如果 specs 表格与 YAML/generated 发生冲突，以 YAML/generated 为实现事实源，并应回修 specs。

新增业务协议先进入 `docs/protocol/<domain>/<domain.feature>.md` 作为草案输入；内部评审确认后，再反向确认 Registry 分组和 `3-codec/02-Capability-Types.md`，涉及 profile/MVP 合同时同步确认 `2-registry/05-Profiles-Registry.md`，然后写入 YAML 并由 Generator 生成正式产物。未采纳草案不是研发实现合同。

```text
docs/protocol/**                         草案和评审输入
docs/specs/**                            规则、治理和规范说明
registry/**/*.yaml + registry/domains/** Generator 的手写机器输入
protocol/axtp.protocol.yaml              Generator 输出的 Protocol IR
docs/generated/**                        Generator 输出的协议参考
```
