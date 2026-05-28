# AXTP v1 Core Freeze Review Plan

## 1. 任务目标

在执行 08-13 文档重构、protocol/axtp.protocol.yaml 生成、generated/protocol.md 生成之前，必须先对 01-07 核心协议文档进行 AXTP v1 Core Freeze Review。

本任务的目标不是大规模重写 01-07，而是检查并修正 01-07 是否已经符合当前确定的 AXTP v1 Core 设计决策，确保后续 08-13、Protocol Definition、axtpc、protocol.md 都建立在稳定一致的核心协议之上。

核心原则：

text 先冻结 01-07 核心协议机制； 再重构 08-13 元规范； 最后生成 protocol.yaml / protocol.md。 

---

## 2. 本次 Review 的范围

请检查以下文档：

```text 
01-AXTP-Protocol-Framework.md 
02-AXTP-Frame-and-Payload-Spec.md 
03-AXTP-Transport-Profiles.md 
04-AXTP-Control-Session-Spec.md 
05-AXTP-RPC-Session-Spec.md 
06-AXTP-Stream-Spec.md 
07-AXTP-Compatibility-and-Versioning.md 
```

如果当前仓库中文件名略有不同，请按语义对应检查：

text 01 = 协议框架说明书 02 = Frame / Payload / Binary Header 规范 03 = Transport Profiles / HID / BLE / WS / TCP / UART 规范 04 = Control Session / OPEN / ACCEPT / READY 规范 05 = RPC Session / Hello / Identify / Binary RPC 规范 06 = Stream / OTA / File / Log / Media 流式传输规范 07 = Versioning / Compatibility / Migration / Freeze Rules 规范 

---

## 3. 本次 Review 的非目标

本次任务不要做以下事情：

```text 
1. 不要抽取旧协议业务内容。 
2. 不要生成完整 method/event/error registry。
3. 不要实现完整 Capability Model。 
4. 不要重写全部协议文档。 
5. 不要把业务 method/event/schema 清单塞进 01-07。 
6. 不要实现 axtpc。 
7. 不要生成最终 protocol.md。 
8. 不要引入新的 Header 动态协商机制。 
9. 不要恢复 8B Stream Header。 
10. 不要把 WebSocket Text / HTTP JSON 作为生产 STREAM 路径。
``` 

本轮只做：

```text 
1. 审查 01-07 是否自洽。 
2. 找出旧设计残留和冲突。 
3. 做最小必要修正。 
4. 给 01-07 加上 Core Freeze Candidate 状态。
``` 

---

## 4. 当前必须冻结的 AXTP v1 Core 决策

请以以下决策作为检查基准。

### 4.1 Header / Frame Profile 决策

AXTP v1 不做动态 Header Profile 协商。

必须采用以下规则：

```text 
Transport Profile 决定 Frame Profile。 
Frame Profile 固定绑定 L1 Frame Header 与 L2 Payload Header。 Magic 用于识别 Frame Profile。 
同一个 AXTP Session 内 Frame Profile 不切换。 
如需使用其他 Frame Profile，必须选择其他 Transport Profile 或重新 OPEN。 
```

固定绑定：

```text 
STANDARD_FRAME = STANDARD_L1 + STANDARD_L2
COMPACT_FRAME  = COMPACT_L1  + COMPACT_L2 
```

v1 不支持以下混搭：

```text 
STANDARD_L1 + COMPACT_L2 COMPACT_L1  + STANDARD_L2 
```

v1 不应再出现运行时协商字段：

```text 
supportedHeaderProfiles 
preferredHeaderProfile 
selectedHeaderProfile Bootstrap Header Header Profile Negotiation 
```

如果这些内容仍存在，请删除、降级为 v2 reserved，或改写为“v1 不支持”。

---

### 4.2 Transport Profile 到 Frame Profile 的默认映射

建议冻结以下映射：

```text 
AXTP-WS  -> STANDARD_FRAME 
AXTP-TCP       -> STANDARD_FRAME 
AXTP-HID-64    -> COMPACT_FRAME 
AXTP-BLE-RPC   -> COMPACT_FRAME 
AXTP-UART      -> COMPACT_FRAME_CRC 或 COMPACT_FRAME with CRC-capable framing 
```

如果当前文档中 UART 的命名尚未完全固定，可以使用以下表达：

```text 
AXTP-UART v1 MUST provide sync / length / crc-capable framing. The concrete profile MAY be named COMPACT_FRAME_CRC. 
```

不要让 UART 使用完全依赖传输边界的极简帧。

---

### 4.3 L2 Payload Header 决策

L2 Payload Header 应统一，不再按 Standard / Compact 拆两套。

必须冻结为：

```text 
Control Payload Header = 5B fixed RPC Binary Payload Header = 11B fixed STREAM Payload Header = 16B fixed 
```

请检查并移除以下旧设计残留：

```text 
STREAM Compact 8B Header STREAM Standard 16B / Compact 8B 协商 RPC 建流阶段协商 streamHeaderSize BLE / HID 专用 8B Stream Header 
```

统一写法：

```text 
STREAM Header v1 固定 16B，不区分 Standard/Compact，不在 RPC 建流阶段协商 Header 长度。 
```

推荐 16B Stream Header：

```c 
struct AxtpStreamHeader {     uint32_t streamId;     uint32_t seq;     uint32_t position;     uint16_t chunkLength;     uint16_t flags; }; 
```

---

### 4.4 CONTROL / OPEN / ACCEPT / READY 决策

默认连接流程：

```text 
Client -> Server: OPEN Server -> Client: ACCEPT Server -> Client: Hello Client -> Server: Identify Server -> Client: Identified Client -> Server: capability.supportedMethods 
```

如果特定传输需要第三步确认，统一命名为：

text READY 

三步流程：

text Client -> Server: OPEN Server -> Client: ACCEPT Client -> Server: READY Server -> Client: Hello 

READY 语义：

text Client 已收到 ACCEPT，已应用 Server 裁定的运行参数，并准备好接收后续 AXTP 帧。 READY 并非必须流程，目前置为reserved状态即可。

注意：

text ACK 不作为握手第三步名称。 ACK / NACK 只用于可靠传输、分片确认、Stream 确认或 Control 确认语义。 

OPEN / ACCEPT 只协商运行参数，例如：

text maxFrameSize maxPayloadSize fragmentMode ackMode crcMode windowSize sessionFlags 

OPEN / ACCEPT 不协商 Header Profile。

---

### 4.5 RPC Session 决策

RPC 会话流程：

text ACCEPT 后进入 RPC Session。 Server 发送 Hello。 Client 根据 Hello 判断是否需要 Identify。 Client 完成 Identify 后进入 RPC Ready。 Client 可调用 capability.supportedMethods。 

必须明确：

text Hello 属于 RPC 会话层。 OPEN / ACCEPT 属于 Control / Link Session 层。 Capability 属于业务发现层。 

不要把 Capability 放到 OPEN / ACCEPT 中。
关于逻辑和物理server得定义：OPEN 由 Physical Client 发起，用于打开底层 AXTP 逻辑通道。
Hello 由 Logical Server 发起，用于打开 RPC 业务会话。

---

### 4.6 Capability v1 决策

v1 保留 capability 域，但不实现完整 Capability Model。

v1 只要求：

text capability.supportedMethods 

语义：

text 返回当前设备、当前固件、当前会话、当前鉴权状态下支持的 methodId 集合。 

能力发现机制：

text Method Bitmap 是 v1 的轻量能力发现机制。 完整 capability.getAll / capability.query / capability schema 保留到 v2。 

请检查并修正以下旧表述：

text capability.getAll 是 v1 必选 完整 Capability Model 是 v1 Core method/event 必须强绑定 capability tree Client 必须先获取完整 capability 才能工作 

---

### 4.7 WebSocket Text / HTTP JSON 决策

必须统一定位：

text WebSocket Text JSON-RPC 只作为 Debug 或 Legacy Adapter。 HTTP JSON 只作为 Debug 或 Legacy Adapter。 二者不作为生产客户端必须实现路径。 二者不承载正式 STREAM。 二者不参与 CONTROL ACK/NACK / RESUME。 

生产路径应以 Binary RPC / Binary STREAM 为主。

---

### 4.8 Stream 决策

STREAM 是长生命周期数据面，需要支持：

text OTA 文件传输 日志导出 音频 视频 传感器数据 resume retransmit ack / credit flow control 

因此 v1 必须统一使用 16B Stream Header。

stream.open 阶段只协商业务参数，不协商 Header 长度：

text streamType direction chunkSize flowControl resume positionMode 

不要出现：

text streamHeaderMode = compact8 / standard16 streamSeqBits = 16 / 32 headerSize negotiation 

---

### 4.9 Compatibility 决策

07 文档必须明确以下冻结规则：

text 同一 session 内 Frame Profile 不切换。 stable wire field 不得改变长度和语义。 已发布 PayloadType 不得复用。 已发布 Control opcode 不得复用。 已发布 Stream flags bit 不得复用。 保留字段发送方 MUST 置 0。 接收方 SHOULD 忽略未知保留扩展。 新增传输 Profile 不得改变既有传输 Profile 的 wire format。 新增 Frame Profile 不得改变既有 Frame Profile 的解析规则。 specVersion 与 registryVersion 分离。 

---

## 5. Review 检查清单

请逐项检查并记录结果。

### 5.1 全局术语检查

检查 01-07 中是否统一使用以下术语：

text AXTP Client Server Transport Profile Frame Profile STANDARD_FRAME COMPACT_FRAME L1 Frame Header L2 Payload Header PayloadType CONTROL RPC STREAM OPEN ACCEPT REJECT READY Hello Identify Identified Capability Request Event methodId eventId errorCode streamId 

需要避免的混用：

text Full Header / Standard Header 混用 Compact Header / Compact L2 Header 混用 method / request 混用导致语义不清 ACK 被用于握手第三步 capability.getAll 被描述成 v1 必选 

建议统一：

text 对外 API 可称 Request。 二进制字段称 methodId。 第三步握手确认称 READY。 完整 capability.getAll 属于 v2 extension。 

---

### 5.2 旧方案残留检查

搜索并检查以下关键词：

text supportedHeaderProfiles preferredHeaderProfile selectedHeaderProfile Bootstrap Header Negotiation Header Header Profile Negotiation dynamic header negotiation Compact Stream Header 8B Stream Header streamHeaderSize streamHeaderMode capability.getAll full capability ACK third step WebSocket Text production HTTP JSON production 

如果发现，请判断：

text 是否应该删除？ 是否应该改成 v2 reserved？ 是否应该改写为 v1 不支持？ 是否只是历史说明，需要标注 deprecated？ 

---

### 5.3 线格式冻结检查

检查以下内容是否只有一个权威版本：

text L1 Standard Header L1 Compact Header L2 Control Payload Header = 5B L2 RPC Binary Payload Header = 11B L2 Stream Payload Header = 16B PayloadType values Control opcode values Stream flags Frame magic values 

不允许同一字段在不同文档中出现不同长度或不同语义。

---

### 5.4 状态机检查

检查以下状态机是否一致：

text Transport Connected   -> Client sends OPEN   -> Server returns ACCEPT or REJECT   -> optional Client sends READY   -> Server sends Hello   -> Client sends Identify when required   -> Server sends Identified   -> Client may call capability.supportedMethods   -> RPC Ready 

检查是否存在 Server 主动 OPEN、Client 未 OPEN 即接收业务帧、Client 先 capability.getAll 等冲突流程。

---

### 5.5 Debug / Legacy 路径检查

检查文档是否明确区分：

text Production Binary Path Debug / Legacy Adapter Path 

生产路径：

text Binary RPC over TCP / WS / HID / BLE / UART Binary STREAM over supported production transport 

Debug / Legacy：

text WebSocket Text JSON-RPC HTTP JSON 

Debug / Legacy 不应承载生产 STREAM，不应作为生产必选。

---

## 6. 各文档具体检查要求

### 6.1 01-AXTP-Protocol-Framework.md

检查重点：

text 1. 是否只讲架构，不写具体业务 method/event。 2. 是否明确 AXTP 分层。 3. 是否明确 CONTROL / RPC / STREAM 三类 Payload。 4. 是否明确 Transport Profile 决定 Frame Profile。 5. 是否明确 Frame Profile 绑定 L1 + L2。 6. 是否明确 v1 不做 Header 动态协商。 7. 是否明确 WebSocket Text / HTTP JSON 是 Debug / Legacy Adapter。 8. 是否明确 v1 Capability 只要求 capability.supportedMethods。 

修正原则：

text 保留架构叙述。 删除业务清单。 删除 Header 动态协商。 删除完整 capability v1 必选描述。 

---

### 6.2 02-AXTP-Frame-and-Payload-Spec.md

这是最重要的冻结文档。

检查重点：

text 1. STANDARD_FRAME 是否固定为 STANDARD_L1 + STANDARD_L2。 2. COMPACT_FRAME 是否固定为 COMPACT_L1 + COMPACT_L2。 3. Magic 是否用于识别 Frame Profile。 4. 是否禁止 v1 L1/L2 混搭。 5. 是否移除 Header Profile 协商。 6. Control Payload Header 是否固定 5B。 7. RPC Binary Payload Header 是否固定 11B。 8. Stream Payload Header 是否固定 16B。 9. 是否移除 8B Stream Header。 10. PayloadType 是否清楚区分 CONTROL / RPC / STREAM。 

修正原则：

text 本文件必须成为线格式唯一权威来源。 如果其他文件与 02 冲突，以 02 为准修正。 

---

### 6.3 03-AXTP-Transport-Profiles.md

检查重点：

text 1. AXTP-WS 是否固定 STANDARD_FRAME。 2. AXTP-TCP 是否固定 STANDARD_FRAME。 3. AXTP-HID-64 是否固定 COMPACT_FRAME。 4. AXTP-BLE-RPC 是否固定 COMPACT_FRAME。 5. AXTP-UART 是否具备 sync / length / crc-capable framing。 6. 是否删除每个 transport 中的 Header 动态协商。 7. 是否明确同一 endpoint/profile 只使用一种 Frame Profile。 8. 是否明确如需不同 Header，必须选择不同 Transport Profile。 

修正原则：

text Transport Profile 只选择 Frame Profile，不协商 Header Profile。 

---

### 6.4 04-AXTP-Control-Session-Spec.md

检查重点：

text 1. OPEN / ACCEPT / REJECT / READY / CLOSE / PING / PONG 是否定义清楚。 2. OPEN/ACCEPT 是否只协商运行参数。 3. OPEN/ACCEPT 是否不协商 Header Profile。 4. READY 是否作为可选第三步确认名称。 5. ACK 是否未被用于握手第三步名称。 6. Control Payload Header 是否固定 5B。 7. ACCEPT 后 Hello 是否允许立即发送。 8. 如果使用 READY，Hello 是否在 READY 后发送。 

修正原则：

text OPEN/ACCEPT 是逻辑会话建立，不是 Header 协商。 READY 表示 Client 已应用 ACCEPT 参数并准备好接收后续帧。 

---

### 6.5 05-AXTP-RPC-Session-Spec.md

检查重点：

text 1. Hello / Identify / Identified 流程是否清楚。 2. Hello 是否属于 RPC 会话层。 3. Identify 是否处理鉴权和 Client 信息。 4. RPC Binary Payload Header 是否固定 11B。 5. JSON-RPC 与 Binary-RPC 映射是否存在但不强制 WebSocket Text 生产路径。 6. capability.supportedMethods 是否作为 v1 能力发现入口。 7. capability.getAll 是否不作为 v1 必选。 8. Request / methodId 命名是否一致。 

修正原则：

text RPC 层负责业务调用和事件，不负责 L1/L2 Header 协商。 

---

### 6.6 06-AXTP-Stream-Spec.md

检查重点：

text 1. Stream Header 是否统一 16B。 2. 是否移除 8B Compact Stream Header。 3. stream.open 是否只协商业务参数。 4. stream.open 是否不协商 headerSize。 5. position 字段语义是否支持 byte offset / timestamp / sample index / frame index。 6. seq 是否为 32-bit。 7. resume / retransmit / ack / credit 语义是否匹配 16B Header。 8. WebSocket Text / HTTP JSON 是否不承载生产 STREAM。 

修正原则：

text STREAM 是生产数据面，不为节省 8B 引入两套 Header。 

---

### 6.7 07-AXTP-Compatibility-and-Versioning.md

检查重点：

text 1. 是否定义 wire format freeze。 2. 是否定义 reserved 字段规则。 3. 是否定义 stable ID 不复用。 4. 是否定义 PayloadType / Control opcode / Stream flags 不复用。 5. 是否定义 Frame Profile 不在 session 内切换。 6. 是否定义新增 Profile 的兼容方式。 7. 是否定义 specVersion 与 registryVersion 分离。 8. 是否说明 08-13 是 Protocol Definition 元规范。 9. 是否说明 generated 产物不得手写修改。 

修正原则：

text 07 必须支撑 08-13 的稳定性和 protocol.yaml 的长期治理。 

---

## 7. 输出 Review Report

第一阶段请不要直接大改文档。请先输出：

text AXTP-v1-Core-Freeze-Review-Report.md 

报告结构如下：

markdown # AXTP v1 Core Freeze Review Report  ## 1. Summary  - Overall status: - Blocking issues: - Non-blocking issues: - Recommended freeze status:  ## 2. Document-by-document Review  ### 01-AXTP-Protocol-Framework.md  | Check Item | Status | Finding | Recommendation | |---|---|---|---|  ### 02-AXTP-Frame-and-Payload-Spec.md  | Check Item | Status | Finding | Recommendation | |---|---|---|---|  ...  ## 3. Cross-document Conflicts  | Conflict | Documents | Severity | Resolution | |---|---|---|---|  ## 4. Deprecated / Removed Concepts  | Concept | Current Location | Action | |---|---|---|  ## 5. Required Minimal Changes  | File | Change | |---|---|  ## 6. Freeze Readiness  - Ready for Core Freeze Candidate: Yes/No - Required fixes before freeze: - Optional improvements: 

Status 建议使用：

text PASS WARN FAIL N/A 

Severity 建议使用：

text BLOCKER MAJOR MINOR CLARIFICATION 

---

## 8. 第二阶段：最小必要修改

在 Review Report 完成后，再进行最小必要修改。

允许修改：

text 1. 删除旧方案残留。 2. 修正术语不一致。 3. 修正线格式冲突。 4. 统一状态机。 5. 补充 v1 不支持 / v2 reserved 说明。 6. 添加 Freeze Candidate 状态头。 

不允许修改：

text 1. 新增大量业务 method/event 内容。 2. 引入新协议机制。 3. 改变已经确定的 v1 决策。 4. 重新引入 Header 动态协商。 5. 重新引入 8B Stream Header。 

---

## 9. 第三阶段：添加 Freeze Candidate 标记

当 01-07 修正完成后，请在每份文档头部添加类似状态块：

markdown --- title: AXTP Protocol Framework status: AXTP v1 Core Freeze Candidate specVersion: 1.0.0-rc1 changePolicy: Clarification-only before v1.0.0 scope: Core wire format / state machine / compatibility rules --- 

如果当前项目不使用 YAML front matter，可以改成普通 Markdown：

markdown > Status: AXTP v1 Core Freeze Candidate   > Spec Version: 1.0.0-rc1   > Change Policy: Clarification-only before v1.0.0   > Scope: Core wire format / state machine / compatibility rules 

后续正式冻结时改成：

text Status: AXTP v1 Core Frozen Spec Version: 1.0.0 Change Policy: Backward-compatible changes only 

---

## 10. 验收标准

本任务完成后，应满足：

text 1. 01-07 中不再存在互相冲突的 Header/Profile 协商方案。 2. 02 是 Frame / Payload 线格式的唯一权威来源。 3. 03 的 Transport Profile 均固定选择 Frame Profile。 4. 04 的 OPEN/ACCEPT/READY 流程一致。 5. 05 的 RPC Session 与 Capability v1 策略一致。 6. 06 的 Stream Header 统一为 16B。 7. 07 的兼容性规则足以支撑 v1 Core Freeze。 8. WebSocket Text / HTTP JSON 被明确降级为 Debug / Legacy Adapter。 9. capability.supportedMethods 是 v1 唯一强制 capability 入口。 10. 01-07 不承载具体业务 method/event/schema 清单。 11. 所有文档进入 AXTP v1 Core Freeze Candidate 状态。 

---

## 11. 推荐执行顺序

请按以下顺序工作：

text 1. 扫描 01-07 文档。 2. 搜索旧方案关键词。 3. 生成 AXTP-v1-Core-Freeze-Review-Report.md。 4. 等待确认或自行根据报告做最小必要修改。 5. 修正 01-07 文档。 6. 添加 Freeze Candidate 状态标记。 7. 输出修改摘要。 8. 不要开始 08-13 重构，除非 01-07 已通过 Core Freeze Candidate。 

---

## 12. 最终交付物

请交付：

text docs/review/AXTP-v1-Core-Freeze-Review-Report.md  修正后的： 01-AXTP-Protocol-Framework.md 02-AXTP-Frame-and-Payload-Spec.md 03-AXTP-Transport-Profiles.md 04-AXTP-Control-Session-Spec.md 05-AXTP-RPC-Session-Spec.md 06-AXTP-Stream-Spec.md 07-AXTP-Compatibility-and-Versioning.md 

如果文件名不同，请保持原文件名，只按语义修正。