# AXTP v1 Core Freeze Review Report

> Generated: 2026-05-29
> Reviewer: Claude Code
> Scope: 00-13 号规范文档前后一致性审查
> Basis: codex-review.md 中定义的 v1 Core 决策基准

---

## 1. Summary

| 项目 | 结果 |
|---|---|
| Overall status | **基本一致，存在若干 MINOR 问题** |
| Blocking issues | 0 |
| Non-blocking issues | 7 |
| Recommended freeze status | **AXTP v1 Core Freeze Candidate — 可冻结，建议修正后正式冻结** |

01-07 文档已全部标注 `AXTP v1 Core Freeze Candidate`，核心决策（Frame Profile 固定绑定、16B Stream Header、READY 预留、capability.supportedMethods 唯一强制、WebSocket Text 降级）均已落入文档。08-13 文档作为 Protocol Definition 元规范，与 01-07 整体一致。

主要问题集中在：
1. 05 文档中 Hello 字段名 `obsWebSocketVersion` 与文档叙述不一致（遗留字段名）
2. 05 文档示例中使用了已废弃的 `eventSubscriptions: uint32`
3. 05 文档章节编号错乱（§14 内部用 §16.x，§21 内部用 §19.x）
4. 02 文档对 UART 的 Frame Profile 描述与 03 文档存在细微差异
5. 00-Overview 中 USB HID 条目出现重复行（用户编辑引入）
6. 08 文档 `registryVersion` 说明中仍写 `request/event/type/error/profile`，未同步为 `method`
7. 07 文档引用了不存在的 `05-AXTP-Type-System基础类型规范.md` 和 `06-AXTP-TLV-Schema编码规范.md`

---

## 2. Document-by-document Review

### 00-AXTP-Overview.md

| Check Item | Status | Finding | Recommendation |
|---|---|---|---|
| 只讲架构，不写具体业务 method/event | PASS | 无具体 method/event 列表 | — |
| 明确 AXTP 分层 | PASS | 5 层架构清晰 | — |
| 明确三类 Payload | PASS | CONTROL/RPC/STREAM 均有说明 | — |
| Transport Profile 决定 Frame Profile | PASS | §6 明确说明 | — |
| v1 不做 Header 动态协商 | PASS | §6 明确 | — |
| WebSocket Text / HTTP JSON 是 Debug/Legacy | PASS | §3 和 §9 均有说明 | — |
| v1 Capability 只要求 capability.supportedMethods | PASS | §9 明确 | — |
| USB HID 条目重复 | WARN | §3 表格中 USB HID 出现两行（STANDARD_FRAME 和 COMPACT_FRAME），第一行描述为"ARM设备"，与 01-07 的 HID-64 固定 Compact 表述不完全一致 | 建议合并为一行，注明 HID-64 使用 COMPACT_FRAME，HID High Speed 可定义独立 Standard Profile |

---

### 01-AXTP-Protocol-Framework.md

| Check Item | Status | Finding | Recommendation |
|---|---|---|---|
| 只讲架构，不写具体业务 method/event | PASS | 无业务清单 | — |
| 明确 AXTP 分层 | PASS | §2 五层架构清晰 | — |
| 明确三类 Payload | PASS | §5 清晰 | — |
| Transport Profile 决定 Frame Profile | PASS | §4 明确固定映射表 | — |
| Frame Profile 绑定 L1 + L2 | PASS | §4 说明 | — |
| v1 不做 Header 动态协商 | PASS | §4 明确 | — |
| WebSocket Text / HTTP JSON 是 Debug/Legacy | PASS | §3 明确 | — |
| v1 Capability 只要求 capability.supportedMethods | PASS | §7 明确 | — |
| READY 处理 | PASS | §6 说明 READY 为可选预留 | — |
| Freeze Candidate 状态标记 | PASS | 文档头已标注 | — |

---

### 02-AXTP-Frame-and-Payload-Spec.md

| Check Item | Status | Finding | Recommendation |
|---|---|---|---|
| STANDARD_FRAME = STANDARD_L1 + v1 L2 | PASS | §6 明确，但写法为 `STANDARD_FRAME = STANDARD_L1 + v1 L2 Payload Header` | 可统一为 `STANDARD_L1 + STANDARD_L2` 与其他文档对齐 |
| COMPACT_FRAME = COMPACT_L1 + v1 L2 | PASS | §6 明确，同上 | 同上 |
| Magic 用于识别 Frame Profile | PASS | §7.3 明确 | — |
| 禁止 v1 L1/L2 混搭 | PASS | §6 明确 | — |
| 移除 Header Profile 协商 | PASS | §6 明确"不支持运行时 Header Profile 协商" | — |
| Control Payload Header 固定 5B | PASS | §6 L2 说明 | — |
| RPC Binary Payload Header 固定 11B | PASS | §6 L2 说明 | — |
| Stream Payload Header 固定 16B | PASS | §6 L2 说明 | — |
| 移除 8B Stream Header | PASS | 无 8B 相关内容 | — |
| PayloadType 清楚区分 CONTROL/RPC/STREAM | PASS | §5 清晰 | — |
| UART Frame Profile 描述 | WARN | §15 表格中 UART 写为"Standard 或 Compact+framing"，而 01/03 文档固定为 Compact+framing | 建议统一为 Compact+framing（COBS/SLIP/length-prefix），与 01/03 对齐 |
| Freeze Candidate 状态标记 | PASS | 文档头已标注 | — |

---

### 03-AXTP-Transport-Profiles.md

| Check Item | Status | Finding | Recommendation |
|---|---|---|---|
| AXTP-WS 固定 STANDARD_FRAME | PASS | §1、§13.1 明确 | — |
| AXTP-TCP 固定 STANDARD_FRAME | PASS | §1、§13.1 明确 | — |
| AXTP-HID-64 固定 COMPACT_FRAME | PASS | §6.1、§13.1 明确 | — |
| AXTP-BLE-RPC 固定 COMPACT_FRAME | PASS | §7.1、§13.1 明确 | — |
| AXTP-UART 具备 sync/length/crc-capable framing | PASS | §8 使用 COBS，§8.2 明确 CRC8 | — |
| 删除每个 transport 中的 Header 动态协商 | PASS | 无动态协商内容 | — |
| 同一 endpoint/profile 只使用一种 Frame Profile | PASS | §13.1 明确 | — |
| 如需不同 Header 必须选择不同 Transport Profile | PASS | §6.1 HID High Speed 说明 | — |
| WebSocket Text 明确为 Debug/Legacy | PASS | §1、§11 明确 | — |
| L2 Payload Header 统一说明 | PASS | §1 明确 5B/11B/16B | — |
| Freeze Candidate 状态标记 | PASS | 文档头已标注 | — |

---

### 04-AXTP-Control-Session-Spec.md

| Check Item | Status | Finding | Recommendation |
|---|---|---|---|
| OPEN/ACCEPT/REJECT/READY/CLOSE 定义清楚 | PASS | §3 Opcode Registry 完整 | — |
| OPEN/ACCEPT 只协商运行参数 | PASS | §10 明确，§10 说明"不协商 Header Profile" | — |
| OPEN/ACCEPT 不协商 Header Profile | PASS | §10 明确 | — |
| READY 作为可选第三步确认名称 | PASS | §3 opcode 0x03 说明"三步协商预留" | — |
| ACK 未被用于握手第三步名称 | PASS | §3 明确"ACK/NACK 不得作为握手第三步名称" | — |
| Control Payload Header 固定 5B | PASS | §2.1 明确 | — |
| ACCEPT 后 Hello 允许立即发送 | PASS | §9 状态机 FRAMING_READY 后进入 RPC 层 | — |
| TLV 0x03 历史字段处理 | PASS | §5.1 标注为 `reserved`（历史 headerProfile 字段，v1 不得使用） | — |
| TLV 0x09 历史字段处理 | PASS | §5.1 标注为 `reserved`（历史字段，不得使用） | — |
| Freeze Candidate 状态标记 | PASS | 文档头已标注 | — |

---

### 05-AXTP-RPC-Session-Spec.md

| Check Item | Status | Finding | Recommendation |
|---|---|---|---|
| Hello/Identify/Identified 流程清楚 | PASS | §5-7 定义清晰 | — |
| Hello 属于 RPC 会话层 | PASS | §15 明确两层分离 | — |
| Identify 处理鉴权和 Client 信息 | PASS | §6 明确 | — |
| RPC Binary Payload Header 固定 11B | PASS | §19.1 明确 | — |
| JSON-RPC 与 Binary-RPC 映射存在但不强制 WS Text 生产路径 | PASS | §2 明确 JSON 只用于 Debug/CLI | — |
| capability.supportedMethods 作为 v1 能力发现入口 | PASS | §15 明确 | — |
| capability.getAll 不作为 v1 必选 | PASS | §15 明确 | — |
| Hello 字段名 `obsWebSocketVersion` | WARN | §5 Hello 字段表中写的是 `obsWebSocketVersion`，但 §19.6 示例中也用了该字段名。文档叙述中说"AXTP 版本"，字段名却是 OBS-WebSocket 遗留名称，语义不清 | 建议改为 `axtpVersion` 或 `protocolVersion`，与 §5 d-block 示例中的 `axtpVersion` 对齐 |
| 废弃字段 `eventSubscriptions` 仍出现在示例 | WARN | §19.6 完整连接流程示例中仍使用 `"eventSubscriptions": 33`，而 §6 已说明该字段废弃，应使用 `eventMasks` | 建议将 §19.6 示例更新为 `eventMasks` 格式 |
| 章节编号错乱 | MINOR | §14 内部标题用 §16.1/16.2/16.3；§21 内部标题用 §19.1/19.2/19.4/19.5/19.6，与实际章节号不符 | 建议统一章节编号 |
| Freeze Candidate 状态标记 | PASS | 文档头已标注 | — |

---

### 06-AXTP-Stream-Spec.md

| Check Item | Status | Finding | Recommendation |
|---|---|---|---|
| Stream Header 统一 16B | PASS | §3 明确"固定 16B Standard Header，适用于所有传输场景" | — |
| 移除 8B Compact Stream Header | PASS | 无 8B 相关内容 | — |
| stream.open 只协商业务参数 | PASS | §4.2 建流参数均为业务参数 | — |
| stream.open 不协商 headerSize | PASS | 无 headerSize 协商 | — |
| cursor 字段语义支持多种 cursorUnit | PASS | §3.2 明确 timestampUs/byteOffset/sampleIndex | — |
| seqId 为 32-bit | PASS | §3.1 明确 uint32 | — |
| resume/retransmit/ack/credit 语义匹配 16B Header | PASS | §6/§10 完整 | — |
| WebSocket Text / HTTP JSON 不承载生产 STREAM | PASS | §13.3 表格明确 DS-RPC 不承载 STREAM | — |
| Freeze Candidate 状态标记 | PASS | 文档头已标注 | — |

---

### 07-AXTP-Compatibility-and-Versioning.md

| Check Item | Status | Finding | Recommendation |
|---|---|---|---|
| 定义 wire format freeze | PASS | §2 明确 PayloadType 不膨胀 | — |
| 定义 reserved 字段规则 | PASS | §2.3 说明 Header 不理解业务 | — |
| 定义 stable ID 不复用 | N/A | 07 文档定位是迁移规范，不是 versioning 规范；stable ID 规则在 09/11 文档中定义 | 建议在 07 文档中补充一节"v1 Core Freeze Rules"，引用 02 的 wire format freeze 和 09/11 的 ID 不复用规则 |
| 定义 Frame Profile 不在 session 内切换 | PASS | §2.2 说明 PayloadType 统一 | — |
| 定义 specVersion 与 registryVersion 分离 | N/A | 07 文档未明确提及，该规则在 08 文档中定义 | 建议 07 文档引用 08 的 specVersion/registryVersion 分离规则 |
| 说明 08-13 是 Protocol Definition 元规范 | PASS | §26 引用了 08-13 文档 | — |
| 说明 generated 产物不得手写修改 | N/A | 07 文档未提及，该规则在 08 文档中定义 | 建议 07 文档补充一句引用 |
| 引用了不存在的文档 | WARN | §26 引用了 `05-AXTP-Type-System基础类型规范.md` 和 `06-AXTP-TLV-Schema编码规范.md`，这两个文件在当前仓库中不存在（路径为 `02-type-system/` 目录下） | 建议修正引用路径，或标注为"待创建" |
| Freeze Candidate 状态标记 | PASS | 文档头已标注 | — |

---

### 08-AXTP-Protocol-Definition-Mapping-Spec.md

| Check Item | Status | Finding | Recommendation |
|---|---|---|---|
| 顶层结构包含 methods/events/types/errors/profiles | PASS | §2 YAML 结构完整 | — |
| specVersion 与 registryVersion 分离 | PASS | §2 明确 | — |
| registryVersion 说明文字 | WARN | §2 说明"request/event/type/error/profile 增量使用 registryVersion"，其中 `request` 应为 `method` | 建议改为"method/event/type/error/profile 增量" |
| JSON-RPC 到 Binary-RPC 映射 | PASS | §3 完整 | — |
| protocol.md 生成规则 | PASS | §5 完整 | — |
| axtpc 命令契约 | PASS | §6 完整 | — |
| 稳定性规则 | PASS | §7 完整 | — |

---

### 09-AXTP-Methods-Registry-Spec.md

| Check Item | Status | Finding | Recommendation |
|---|---|---|---|
| 只定义元模型，不手写业务列表 | PASS | §1 明确 | — |
| methods 条目结构完整 | PASS | §2 YAML 示例完整 | — |
| methodId 唯一性约束 | PASS | §4.1 | — |
| name 必须 domain.action | PASS | §4.3 | — |
| stable methodId 不复用 | PASS | §4.4 | — |
| capability.supportedMethods bitmap 从 methods 派生 | PASS | §4.8 | — |
| 生成规则完整 | PASS | §5 | — |

---

### 10-AXTP-Events-Registry-Spec.md

| Check Item | Status | Finding | Recommendation |
|---|---|---|---|
| 只定义元模型，不手写业务列表 | PASS | §1 明确 | — |
| events 条目结构完整 | PASS | §2 YAML 示例完整 | — |
| Event 通过 PayloadType=RPC 承载 | PASS | §4.5 明确 | — |
| STREAM 数据不得作为 Event 直接承载 | PASS | §4.6 明确 | — |
| stable eventId 不复用 | PASS | §4.3 | — |

---

### 11-AXTP-Errors-Registry-Spec.md

| Check Item | Status | Finding | Recommendation |
|---|---|---|---|
| 只定义元模型，不手写错误码清单 | PASS | §1 明确 | — |
| errors 条目结构完整 | PASS | §2 YAML 示例完整 | — |
| 错误码分段清晰 | PASS | §4 分段表完整 | — |
| stable errorCode 不复用 | PASS | §6.3 | — |
| JSON-RPC 与 Binary statusCode 映射 | PASS | §5 完整 | — |

---

### 12-AXTP-Types-and-Capability-Spec.md

| Check Item | Status | Finding | Recommendation |
|---|---|---|---|
| 只定义元模型，不手写业务 schema | PASS | §1 明确 | — |
| types 条目结构完整 | PASS | §2 YAML 示例完整 | — |
| fieldId 规则完整 | PASS | §4 完整 | — |
| v1 Capability 只实现 capability.supportedMethods | PASS | §6 明确 | — |
| capability.getAll 保留到 v2 | PASS | §7 明确 | — |
| method bitmap 从 methods 派生 | PASS | §6 明确 | — |

---

### 13-AXTP-Profiles-Registry-Spec.md

| Check Item | Status | Finding | Recommendation |
|---|---|---|---|
| 只定义元模型，不手写 MVP 清单 | PASS | §1 明确 | — |
| profiles 条目结构完整 | PASS | §2 YAML 示例完整 | — |
| requiredMethods 引用 methods[].name | PASS | §3 明确 | — |
| frameProfile 必须与 transportProfiles 固定映射一致 | PASS | §4.3 | — |
| v1 不允许同一 session 内切换 Frame Profile | PASS | §4.4 | — |
| HID/BLE/UART Compact profile 不得要求 WS Text 生产 STREAM | PASS | §4.5 | — |

---

## 3. Cross-document Conflicts

| Conflict | Documents | Severity | Resolution |
|---|---|---|---|
| UART Frame Profile 描述不一致 | 02 §15 写"Standard 或 Compact+framing"；01 §4、03 §8 固定为 Compact+framing | MINOR | 以 01/03 为准，02 §15 改为 Compact+framing |
| 02 文档 Frame Profile 命名写法 | 02 §6 写 `STANDARD_FRAME = STANDARD_L1 + v1 L2 Payload Header`；00/01/03 写 `STANDARD_L1 + STANDARD_L2` | MINOR | 建议 02 统一为 `STANDARD_L1 + STANDARD_L2` |
| 05 Hello 字段名 `obsWebSocketVersion` | 05 §5 字段表；05 §19.6 示例 | MINOR | 改为 `axtpVersion`，与 §5 d-block 示例对齐 |
| 05 废弃字段 `eventSubscriptions` 仍在示例中 | 05 §19.6 | MINOR | 更新为 `eventMasks` 格式 |
| 07 引用不存在的文档路径 | 07 §26 | MINOR | 修正为 `02-type-system/` 路径或标注待创建 |
| 08 registryVersion 说明中用 `request` | 08 §2 | MINOR | 改为 `method` |

---

## 4. Deprecated / Removed Concepts

| Concept | Current Location | Action |
|---|---|---|
| `supportedHeaderProfiles` / `preferredHeaderProfile` / `selectedHeaderProfile` | 已不存在于任何文档 | DONE — 已清除 |
| `Bootstrap Header` / `Header Profile Negotiation` | 已不存在于任何文档 | DONE — 已清除 |
| `8B Stream Header` / `Compact Stream Header` | 已不存在于任何文档 | DONE — 已清除 |
| `streamHeaderSize` / `streamHeaderMode` | 已不存在于任何文档 | DONE — 已清除 |
| `capability.getAll` 作为 v1 必选 | 已不存在；05 §15、12 §7 明确为 v2 | DONE — 已清除 |
| `eventSubscriptions: uint32` | 05 §6 标注废弃，但 §19.6 示例仍使用 | PENDING — 需更新示例 |
| Control TLV `0x03` (headerProfile) | 04 §5.1 标注为 `reserved`（历史字段，v1 不得使用） | DONE — 已标注 |
| Control TLV `0x09` (历史字段) | 04 §5.1 标注为 `reserved` | DONE — 已标注 |
| Control TLV `0x1A` (controlFlags) | 04 §5.1 标注为废弃 | DONE — 已标注 |
| Control TLV `0x1B` (statusCode in TLV) | 04 §5.1 标注为废弃 | DONE — 已标注 |
| `RESERVED_CONTROL_BODY_ENCODING_UNSUPPORTED` | 04 §4 标注为历史保留 | DONE — 已标注 |
| `RESERVED_CONTROL_PROFILE_UNSUPPORTED` | 04 §4 标注为历史保留 | DONE — 已标注 |

---

## 5. Required Minimal Changes

以下是建议的最小必要修改（均为 MINOR，不影响 Freeze Candidate 状态）：

| File | Change |
|---|---|
| [00-AXTP-Overview.md](standard/docs/00-overview/00-AXTP-Overview.md) | §3 表格中 USB HID 两行合并，注明 HID-64 使用 COMPACT_FRAME，HID High Speed 可定义独立 Standard Profile |
| [02-AXTP-Frame-and-Payload-Spec.md](standard/docs/01-core-protocol/02-AXTP-Frame-and-Payload-Spec.md) | §6 Frame Profile 命名统一为 `STANDARD_L1 + STANDARD_L2` / `COMPACT_L1 + COMPACT_L2`；§15 UART 改为 Compact+framing |
| [05-AXTP-RPC-Session-Spec.md](standard/docs/01-core-protocol/05-AXTP-RPC-Session-Spec.md) | §5 字段表 `obsWebSocketVersion` 改为 `axtpVersion`；§19.6 示例 `eventSubscriptions` 改为 `eventMasks`；修正 §14/§21 内部章节编号 |
| [07-AXTP-Compatibility-and-Versioning.md](standard/docs/01-core-protocol/07-AXTP-Compatibility-and-Versioning.md) | §26 修正 `05-AXTP-Type-System基础类型规范.md` 和 `06-AXTP-TLV-Schema编码规范.md` 的引用路径；补充一节引用 v1 Core Freeze Rules |
| [08-AXTP-Protocol-Definition-Mapping-Spec.md](standard/docs/03-registry/08-AXTP-Protocol-Definition-Mapping-Spec.md) | §2 `registryVersion` 说明中 `request` 改为 `method` |

---

## 6. Freeze Readiness

| 项目 | 结论 |
|---|---|
| Ready for Core Freeze Candidate | **Yes** |
| Blocking issues before freeze | 无 |
| Required fixes before freeze | 上述 5 项 MINOR 修改（均为措辞/示例/引用问题，不涉及 wire format） |
| Optional improvements | 07 文档补充 v1 Core Freeze Rules 一节，引用 specVersion/registryVersion 分离和 stable ID 不复用规则 |

**结论：** 01-07 核心协议文档已全部标注 `AXTP v1 Core Freeze Candidate`，所有 v1 Core 决策（Frame Profile 固定绑定、16B Stream Header、READY 预留、capability.supportedMethods 唯一强制、WebSocket Text 降级）均已正确落入文档，无互相冲突的 Header/Profile 协商方案，无旧方案残留（8B Stream Header、动态 Header 协商、capability.getAll v1 必选）。08-13 元规范文档与 01-07 整体一致，methods/events/errors/types/profiles 命名已统一。

可以进入第二阶段（最小必要修改）。
