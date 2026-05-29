# AXTP v1 Core Freeze Review Report

> 审查基准：codex-review.md（AXTP v1 Core Freeze Review Plan）
> 审查范围：01–07 核心协议文档
> 审查日期：2026-05-29
> 审查人：Claude Code

---

## 1. Summary

| 项目 | 结论 |
|---|---|
| Overall status | **PASS with MAJOR issues** |
| Blocking issues | 0 |
| MAJOR issues | 3 |
| MINOR issues | 4 |
| CLARIFICATION | 2 |
| Recommended freeze status | **Freeze Candidate — 需先修正 MAJOR 问题** |

**总体评价：**

01–07 文档的核心 wire format 设计已经自洽，旧方案残留（Header Profile 协商、8B Stream Header、capability.getAll 必选）已全部清除，Freeze Candidate 状态标记已就位。主要问题集中在三处：

1. **07 文档内容错位**：标题是"Compatibility and Versioning"，实际内容是旧协议迁移指南，缺少 codex-review.md 要求的 wire format freeze 规则。
2. **05 文档状态机术语不一致**：§15 使用 `TRANSPORT_READY`，其余所有文档统一使用 `FRAMING_READY`。
3. **07 §8.3 OTA 字段映射表与 06 STREAM Header 定义冲突**：映射表把 `totalLength`、`chunkLength` 写入"STREAM Header"，但 06 的 16B STREAM Header 只有 streamId/seqId/cursor。

---

## 2. Document-by-document Review

### 01-AXTP-Protocol-Framework.md

| Check Item | Status | Finding | Recommendation |
|---|---|---|---|
| 只讲架构，不写具体业务 method/event | PASS | 无业务清单，只有分层和职责边界 | — |
| 明确 AXTP 分层 | PASS | 5 层分层图清晰 | — |
| 明确 CONTROL / RPC / STREAM 三类 Payload | PASS | §5 有完整表格 | — |
| Transport Profile 决定 Frame Profile | PASS | §4 有固定映射表 | — |
| Frame Profile 绑定 L1 + L2 | PASS | §4 明确说明 | — |
| v1 不做 Header 动态协商 | PASS | §4 明确"OPEN/ACCEPT 只协商运行参数，不协商 Header Profile" | — |
| WebSocket Text / HTTP JSON 是 Debug/Legacy | PASS | §3 明确定位 | — |
| v1 Capability 只要求 capability.supportedMethods | PASS | §7 明确，capability.getAll 属于 v2/P1 | — |
| Freeze Candidate 状态标记 | PASS | 文档头部已有状态块 | — |

**结论：PASS**

---

### 02-AXTP-Frame-and-Payload-Spec.md

| Check Item | Status | Finding | Recommendation |
|---|---|---|---|
| STANDARD_FRAME = STANDARD_L1 + STANDARD_L2 | PASS | §6 明确定义 | — |
| COMPACT_FRAME = COMPACT_L1 + COMPACT_L2 | PASS | §6 明确定义 | — |
| Magic 用于识别 Frame Profile | PASS | §7.3 说明 Magic 用于 TCP 字节流帧同步 | — |
| 禁止 v1 L1/L2 混搭 | PASS | §6 明确"不支持 STANDARD_L1 + COMPACT_L2 混搭" | — |
| 移除 Header Profile 协商 | PASS | 无协商字段残留 | — |
| Control Payload Header 固定 5B | PASS | §6 L2 说明 | — |
| RPC Binary Payload Header 固定 11B | PASS | §6 L2 说明 | — |
| Stream Payload Header 固定 16B | PASS | §6 L2 说明 | — |
| 移除 8B Stream Header | PASS | 无残留 | — |
| PayloadType 区分 CONTROL / RPC / STREAM | PASS | §5 完整定义 | — |
| §21 与后续文档的关系——文档编号 | **WARN** | §21 使用旧编号："02《Control 信令协议规范》"、"03《RPC 协议》"、"04《Stream 流式传输规范》"、"05《连接场景与调用流程规范》"，与当前文件编号（04/05/06/03）不符 | 更新为当前编号 |
| Freeze Candidate 状态标记 | PASS | 文档头部已有状态块 | — |

**结论：PASS with MINOR（§21 交叉引用编号过时）**

---

### 03-AXTP-Transport-Profiles.md

| Check Item | Status | Finding | Recommendation |
|---|---|---|---|
| AXTP-WS 固定 STANDARD_FRAME | PASS | §1、§13.1 明确 | — |
| AXTP-TCP 固定 STANDARD_FRAME | PASS | §1、§13.1 明确 | — |
| AXTP-HID-64 固定 COMPACT_FRAME | PASS | §1、§6.1 明确 | — |
| AXTP-BLE-RPC 固定 COMPACT_FRAME | PASS | §1、§7.1 明确 | — |
| AXTP-UART 具备 sync/length/crc-capable framing | PASS | §8 使用 COBS，有完整说明 | — |
| 删除每个 transport 中的 Header 动态协商 | PASS | 无协商残留 | — |
| 同一 endpoint/profile 只使用一种 Frame Profile | PASS | §13.1 明确 | — |
| 如需不同 Header 必须选择不同 Transport Profile | PASS | §13.1 明确 | — |
| WebSocket Text 明确为 Debug/Legacy | PASS | §1、§11 明确 | — |
| 状态机与 04 一致 | PASS | §3.1 四状态机与 04 §9 完全一致 | — |
| 网关 MessageId 截断（uint16→uint8）未说明冲突风险 | **CLARIFICATION** | §9.3 只说"截断为 uint8"，未说明 MessageId > 255 时的处理策略 | 补充说明：网关应在 Standard→Compact 转换时重新分配 MessageId，或限制 Standard 侧 MessageId 在 0-255 范围内 |
| Freeze Candidate 状态标记 | PASS | 文档头部已有状态块 | — |

**结论：PASS with CLARIFICATION**

---

### 04-AXTP-Control-Session-Spec.md

| Check Item | Status | Finding | Recommendation |
|---|---|---|---|
| OPEN/ACCEPT/REJECT/READY/CLOSE/PING/PONG 定义清楚 | PASS | §3 Opcode Registry 完整 | — |
| OPEN/ACCEPT 只协商运行参数 | PASS | §10 明确 | — |
| OPEN/ACCEPT 不协商 Header Profile | PASS | §10 明确 | — |
| READY 作为可选第三步确认名称 | PASS | §3 opcode 0x03 标注"预留，非必要实现" | — |
| ACK 未被用于握手第三步 | PASS | §3 明确"ACK/NACK 不得作为握手第三步名称" | — |
| Control Payload Header 固定 5B | PASS | §2.1 完整定义 | — |
| ACCEPT 后 Hello 可立即发送 | PASS | §9 状态机说明 FRAMING_READY 后进入 RPC 阶段 | — |
| TLV 0x03 旧 headerProfile 字段已标注 reserved | PASS | §5.1 标注"历史 headerProfile 字段，v1 不得使用" | — |
| §21 与后续文档的关系——文档编号 | **WARN** | §21 使用"03《RPC 协议》"和"04《Stream 协议》"，应为"05《RPC Session Spec》"和"06《Stream Spec》" | 更新为当前编号 |
| Freeze Candidate 状态标记 | PASS | 文档头部已有状态块 | — |

**结论：PASS with MINOR（§21 交叉引用编号过时）**

---

### 05-AXTP-RPC-Session-Spec.md

| Check Item | Status | Finding | Recommendation |
|---|---|---|---|
| Hello/Identify/Identified 流程清楚 | PASS | §5–§7 完整定义 | — |
| Hello 属于 RPC 会话层 | PASS | §15 明确分层 | — |
| Identify 处理鉴权和 Client 信息 | PASS | §6 完整定义 | — |
| RPC Binary Payload Header 固定 11B | PASS | §19.1 完整定义 | — |
| JSON-RPC 与 Binary-RPC 映射存在但不强制 WS Text 生产路径 | PASS | §2 明确 JSON 只用于 Debug/CLI | — |
| capability.supportedMethods 作为 v1 能力发现入口 | PASS | §15 明确 | — |
| capability.getAll 不作为 v1 必选 | PASS | §15 明确"属于 v2/P1 扩展" | — |
| **§15 状态机使用 TRANSPORT_READY** | **FAIL** | §15 Transport 层状态机写的是 `TRANSPORT_READY`，但 02/03/04 统一使用 `FRAMING_READY`，术语不一致 | 将 §15 中的 `TRANSPORT_READY` 改为 `FRAMING_READY` |
| §28 与后续文档的关系——文档编号 | **WARN** | §28 使用"01《整体协议规范》"、"02《Control 信令规范》"、"04《Stream 流式传输规范》"，应为"02《Frame and Payload Spec》"、"04《Control Session Spec》"、"06《Stream Spec》" | 更新为当前编号 |
| Freeze Candidate 状态标记 | PASS | 文档头部已有状态块 | — |

**结论：FAIL（MAJOR：§15 TRANSPORT_READY 术语不一致）**

---

### 06-AXTP-Stream-Spec.md

| Check Item | Status | Finding | Recommendation |
|---|---|---|---|
| Stream Header 统一 16B | PASS | §3 明确"固定 16B Standard Header，适用于所有传输场景" | — |
| 移除 8B Compact Stream Header | PASS | 无残留 | — |
| stream.open 只协商业务参数 | PASS | §4.2 建流参数均为业务参数 | — |
| stream.open 不协商 headerSize | PASS | 无 headerSize 协商字段 | — |
| cursor 字段语义支持多种 cursorUnit | PASS | §3.2 完整定义 | — |
| seqId 为 32-bit | PASS | §3.1 uint32 | — |
| resume/retransmit/ack/credit 语义匹配 16B Header | PASS | §6、§10 完整定义 | — |
| WebSocket Text / HTTP JSON 不承载生产 STREAM | PASS | §1 设计目标中无 WS Text 路径 | — |
| Freeze Candidate 状态标记 | PASS | 文档头部已有状态块 | — |

**结论：PASS**

---

### 07-AXTP-Compatibility-and-Versioning.md

| Check Item | Status | Finding | Recommendation |
|---|---|---|---|
| 定义 wire format freeze 规则 | **FAIL** | 文档内容是旧协议迁移指南，不包含 wire format freeze 规则（stable wire field 不得改变长度/语义、已发布 ID 不得复用等） | 在文档开头增加 §0 "Wire Format Freeze Rules" 章节，或将 02/04/05/06 各自的"版本与兼容策略"节汇总到此处 |
| 定义 reserved 字段规则 | **FAIL** | 无 reserved 字段规则（发送方 MUST 置 0，接收方 SHOULD 忽略） | 同上，补充 freeze 规则章节 |
| 定义 stable ID 不复用 | **FAIL** | 无 PayloadType/Control opcode/Stream flags 不复用规则 | 同上 |
| 定义 Frame Profile 不在 session 内切换 | **FAIL** | 无此规则（该规则在 02 §6 有，但 07 未汇总） | 同上 |
| 定义 specVersion 与 registryVersion 分离 | **FAIL** | 无此规则（该规则在 08 §2 有，但 07 未汇总） | 同上 |
| 说明 08-13 是 Protocol Definition 元规范 | **FAIL** | 无此说明（在 08 §1 有，但 07 未引用） | 同上 |
| 说明 generated 产物不得手写修改 | **FAIL** | 无此说明 | 同上 |
| §8.3 OTA chunk 字段映射与 06 STREAM Header 冲突 | **FAIL** | §8.3 表格将 `totalLength`、`chunkLength` 映射到"STREAM Header"，但 06 的 16B STREAM Header 只有 streamId/seqId/cursor，无这两个字段 | 修正映射表：`offset` → `cursor`（cursorUnit=byteOffset）；`totalLength` → `firmware.begin.params.totalSize`；`chunkLength` → `Frame.payloadLength - 16`（派生值，不在 Header 中） |
| §17.1 使用 "control.helloAck" | **WARN** | §17.1 YAML 示例中出现 `control.helloAck:`，不是有效的 AXTP 概念，是旧协议残留 | 删除或替换为有效示例 |
| §26 引用 type-system 文档标注"待创建" | CLARIFICATION | §26 引用的 `02-type-system/01-AXTP-Type-System基础类型规范.md` 和 `02-type-system/02-AXTP-TLV-Schema编码规范.md` 标注"待创建" | 确认这两个文档的创建计划，或将引用改为 placeholder |
| Freeze Candidate 状态标记 | PASS | 文档头部已有状态块 | — |

**结论：FAIL（MAJOR：缺少 freeze 规则章节；§8.3 字段映射与 06 冲突）**

---

## 3. Cross-document Conflicts

| Conflict | Documents | Severity | Resolution |
|---|---|---|---|
| `TRANSPORT_READY` vs `FRAMING_READY` | 05 §15 vs 02/03/04 | MAJOR | 将 05 §15 中的 `TRANSPORT_READY` 改为 `FRAMING_READY` |
| OTA `totalLength`/`chunkLength` 映射到"STREAM Header" | 07 §8.3 vs 06 §3.1 | MAJOR | 修正 07 §8.3 映射表，与 06 §15 旧协议映射保持一致 |
| §21/§28 交叉引用编号过时 | 02 §21、04 §21、05 §28 | MINOR | 统一更新为当前文档编号 |
| 07 缺少 freeze 规则，freeze 规则散落在 02/04/05/06 各自的"版本与兼容策略"节 | 07 vs 02 §17、04 §20、05 §27、06 §17 | MAJOR | 在 07 增加 freeze 规则章节，或在 07 开头明确引用各文档的版本策略节 |

---

## 4. Deprecated / Removed Concepts

| Concept | Current Location | Status |
|---|---|---|
| Header Profile 动态协商（supportedHeaderProfiles / selectedHeaderProfile） | 04 §5.1 TLV 0x03 标注 reserved | 已清除 ✓ |
| 8B Compact Stream Header | 无残留 | 已清除 ✓ |
| streamHeaderSize / streamHeaderMode 协商 | 无残留 | 已清除 ✓ |
| capability.getAll 作为 v1 必选 | 01 §7、05 §15、07 §17.2 均标注为 v2/P1 | 已清除 ✓ |
| ACK 作为握手第三步 | 04 §3 明确禁止 | 已清除 ✓ |
| WebSocket Text 作为生产路径 | 02 §4.2、03 §1 明确为 Debug/Legacy | 已清除 ✓ |
| `control.helloAck`（旧协议残留） | 07 §17.1 YAML 示例 | **待清除** |
| `eventSubscriptions: uint32`（旧字段） | 05 §6 标注 deprecated | 已标注 ✓ |
| TLV 0x1A controlFlags、0x1B statusCode（固定头移除后废弃） | 04 §5.1 标注废弃 | 已标注 ✓ |

---

## 5. Required Minimal Changes

| File | Change | Priority |
|---|---|---|
| `05-AXTP-RPC-Session-Spec.md` | §15 将 `TRANSPORT_READY` 改为 `FRAMING_READY` | MAJOR |
| `07-AXTP-Compatibility-and-Versioning.md` | §8.3 修正 OTA chunk 字段映射表（`totalLength`/`chunkLength` 不在 STREAM Header 中） | MAJOR |
| `07-AXTP-Compatibility-and-Versioning.md` | 增加 §0 或 §1.x "Wire Format Freeze Rules" 章节，汇总 freeze 规则 | MAJOR |
| `07-AXTP-Compatibility-and-Versioning.md` | §17.1 删除 `control.helloAck` 示例 | MINOR |
| `02-AXTP-Frame-and-Payload-Spec.md` | §21 更新交叉引用编号（02→04, 03→05, 04→06, 05→03） | MINOR |
| `04-AXTP-Control-Session-Spec.md` | §21 更新交叉引用编号（03→05, 04→06） | MINOR |
| `05-AXTP-RPC-Session-Spec.md` | §28 更新交叉引用编号（01→02, 02→04, 04→06） | MINOR |
| `03-AXTP-Transport-Profiles.md` | §9.3 补充 MessageId 截断策略说明 | CLARIFICATION |

---

## 6. Freeze Readiness

| 文档 | Freeze 就绪 | 阻塞问题 |
|---|---|---|
| 01-AXTP-Protocol-Framework.md | ✅ 就绪 | 无 |
| 02-AXTP-Frame-and-Payload-Spec.md | ⚠️ 基本就绪 | §21 编号过时（MINOR） |
| 03-AXTP-Transport-Profiles.md | ✅ 就绪 | MessageId 截断说明（CLARIFICATION） |
| 04-AXTP-Control-Session-Spec.md | ⚠️ 基本就绪 | §21 编号过时（MINOR） |
| 05-AXTP-RPC-Session-Spec.md | ❌ 未就绪 | §15 TRANSPORT_READY 术语错误（MAJOR） |
| 06-AXTP-Stream-Spec.md | ✅ 就绪 | 无 |
| 07-AXTP-Compatibility-and-Versioning.md | ❌ 未就绪 | 缺少 freeze 规则章节；§8.3 字段映射冲突（MAJOR） |

**Ready for Core Freeze Candidate：No（需先修正 2 个 MAJOR 问题）**

**Required fixes before freeze：**

1. **05 §15**：`TRANSPORT_READY` → `FRAMING_READY`（1 行改动）
2. **07 §8.3**：修正 OTA chunk 字段映射表（与 06 §15 对齐）
3. **07**：增加 Wire Format Freeze Rules 章节

**Optional improvements（不阻塞 freeze）：**

- 02/04/05 交叉引用编号更新
- 03 §9.3 MessageId 截断策略补充说明
- 07 §17.1 删除 `control.helloAck` 残留

---

## 7. 附：旧方案关键词扫描结果

| 关键词 | 扫描结果 |
|---|---|
| `supportedHeaderProfiles` | 未发现 ✓ |
| `preferredHeaderProfile` | 未发现 ✓ |
| `selectedHeaderProfile` | 未发现 ✓ |
| `Bootstrap Header` | 未发现 ✓ |
| `Header Profile Negotiation` | 未发现 ✓ |
| `dynamic header negotiation` | 未发现 ✓ |
| `Compact Stream Header` / `8B Stream Header` | 未发现 ✓ |
| `streamHeaderSize` / `streamHeaderMode` | 未发现 ✓ |
| `capability.getAll`（作为 v1 必选） | 01/05/07 均标注为 v2/P1 ✓ |
| `ACK`（作为握手第三步） | 04 §3 明确禁止 ✓ |
| WebSocket Text 作为生产路径 | 02/03 明确为 Debug/Legacy ✓ |
| `TRANSPORT_READY` | **05 §15 发现，应为 FRAMING_READY** ⚠️ |
| `control.helloAck` | **07 §17.1 发现，旧协议残留** ⚠️ |
