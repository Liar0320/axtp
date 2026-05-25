# 03《AXTP RPC 协议与二进制映射规范》

版本：v0.1 Draft  
状态：MVP RPC 子协议规范  
适用范围：`PayloadType = RPC` 的 Payload 结构、DS-RPC Text Profile 映射、Binary-RPC 映射、TLV Body、MethodId/EventId、Request/Response/Event/Batch、老协议 CmdValue 适配  
前置文档：00《AXTP 协议总览与落地路线》、01《AXTP 整体协议规范》、02《AXTP Control 信令协议规范》  
后续文档：04《AXTP Stream 流式传输协议规范》、02-AXTP-Type-System 基础类型规范、02-AXTP-TLV-Schema 编码规范、03-AXTP-Registry 总则、MethodId/EventId/ErrorCode/Capability 注册表

---

## 1. 文档目的

本文档定义 AXTP 中 `PayloadType = RPC` 时的业务控制协议。

在 01《AXTP 整体协议规范》中，AXTP Frame Header 已经收敛为三种 PayloadType：

```text
0x01 CONTROL
0x02 RPC
0x03 STREAM
```

本文档专门规定 `RPC` Payload 的内部结构，以及 DS-RPC Text Profile 与二进制表达之间的映射关系。

本文档重点解决以下问题：

```text
1. 当 Frame Header.payloadType = RPC 时，Payload 如何解析；
2. RPC 是否区分 DS-RPC Text / Binary-RPC / CBOR-RPC；
3. requestId、methodId、eventId、statusCode 的职责边界；
4. DS-RPC Text Profile 如何映射到 Binary-RPC；
5. Binary-RPC Payload 的标准结构和 Compact 结构；
6. TLV Body 如何表达 params、result、event data；
7. Request / Response / Event / Batch 如何统一表达；
8. RPC 与 CONTROL、STREAM 的边界；
9. 老协议 CmdValue 如何最小成本适配到 methodId；
10. Generator v1 和 C++ Demo v1 应该优先实现哪些内容。
```

本文档不定义具体业务方法表。具体 `methodId`、`eventId`、`errorCode`、`capabilityId` 由 Registry 文档定义。

---

## 2. 核心结论

`PayloadType = RPC` 表示当前 AXTP Frame 的 Payload 是一个结构化业务消息。

RPC 可以承载：

```text
业务请求 Request
业务响应 Response
业务事件 Event
批量请求 BatchRequest
批量响应 BatchResponse
```

RPC 不再作为多个 Frame PayloadType 存在。

也就是说，AXTP v1 不再定义：

```text
RPC_JSON
RPC_BINARY
RPC_CBOR
```

而是统一为：

```text
Frame Header.payloadType = RPC
RPC Payload.rpcEncoding = JSON / BINARY / CBOR / MSGPACK
```

这样可以保证 Frame Header 极简稳定，同时允许 RPC 内部根据场景选择不同编码。

---

## 3. RPC 的职责边界

### 3.1 RPC 负责什么

RPC 负责业务控制面。

包括：

```text
设备信息查询
设备状态查询
参数设置
能力查询
视频控制
音频控制
亮度控制
显示控制
文件传输控制
OTA 控制
日志控制
诊断控制
事件上报
事件订阅
业务错误返回
```

典型方法：

```text
device.getInfo
capability.getAll
brightness.set
video.setMode
audio.setVolume
file.beginTransfer
firmware.begin
firmware.verify
log.setLevel
diagnostic.selfTest
```

### 3.2 RPC 不负责什么

RPC 不负责协议运行时控制。

以下内容属于 `PayloadType = CONTROL`：

```text
OPEN
ACCEPT
HEARTBEAT
ACK
NACK
RESUME
CLOSE
WINDOW_UPDATE
SESSION_RESET
```

RPC 也不直接承载高频连续数据或大块数据。

以下内容属于 `PayloadType = STREAM`：

```text
video frame
audio frame
file chunk
OTA chunk
log stream
sensor stream
KVM raw input
```

### 3.3 判断规则

| 问题 | 应使用的 PayloadType |
|---|---|
| 是协议自身运行时信令吗？ | `CONTROL` |
| 是结构化业务命令、查询、响应、事件吗？ | `RPC` |
| 是连续数据、大块数据、裸数据块吗？ | `STREAM` |

---

## 4. RPC 与 Frame Header 的关系

完整结构如下：

```text
AXTP Frame
+-----------------------------+
| AXTP Frame Header           |
|   payloadType = RPC         |
|   payloadLength = N         |
|   messageId                 |
|   frameIndex / frameCount   |
+-----------------------------+
| RPC Payload                 |
|   rpcEncoding               |
|   rpcOp                     |
|   requestId                 |
|   methodId / eventId        |
|   statusCode                |
|   bodyEncoding              |
|   body                      |
+-----------------------------+
| Frame CRC Footer            |
+-----------------------------+
```

Frame Header 负责：

```text
Frame 边界
PayloadType 判断
PayloadLength
MessageId
Fragment
CRC
```

其中 CRC Footer 由外层 Frame Profile 决定：Standard Profile 使用 CRC16，Compact Profile 使用 CRC8。RPC Payload 不自行选择 Frame CRC 算法。

RPC Payload 负责：

```text
RPC 语义
Request / Response / Event
requestId 匹配
methodId / eventId 定位
statusCode 返回结果
body 编码
params / result / eventData
```

---

## 5. MessageId 与 requestId 的边界

### 5.1 MessageId

`messageId` 属于 AXTP Frame Layer。

用于标识一次完整 AXTP Message，主要服务于：

```text
Frame 分片
重组
ACK/NACK
CRC 校验
传输层排错
```

一个 RPC Payload 如果因 MTU 限制被拆成多个 Frame，这些 Frame 必须共享同一个 `messageId`。

### 5.2 requestId

`requestId` 属于 RPC Layer，逻辑类型固定为 uint32。

用于匹配：

```text
RPC Request
RPC Response
```

同一个 requestId 只在 RPC 语义中生效，不承担 Frame 分片职责。

**requestId 生成规则：**

| 规则 | 说明 |
| --- | --- |
| 保留值 | `0x00000000` 保留，不得用于普通 Request；EVENT 的 requestId 固定填 `0x00000000` |
| 起始值 | 发起方从 `0x00000001` 开始递增分配 |
| 增长方式 | 每发出一个 Request 加 1 |
| 回绕 | 按 uint32 自然回绕，回绕后从 `0x00000001` 继续（跳过 0） |
| 唯一性 | 同一 Session 内，未收到 Response 的 requestId 不得复用 |
| 回绕冲突 | 若回绕后下一个 requestId 仍有未完成的 Request，继续递增直到找到空闲值；若全部耗尽，应返回错误 `RPC_REQUEST_ID_EXHAUSTED` |

**Text / Binary 编码规则：**

| Profile | 编码 | 示例 |
|---|---|---|
| DS-RPC Text Profile | 固定 8 位十六进制字符串，大小写不敏感，推荐小写 | `"00000001"` |
| Binary Standard Profile | 4B little-endian uint32 | `01 00 00 00` |
| Binary Compact Profile | 4B little-endian uint32 | `01 00 00 00` |

JSON 字符串本身没有字节序。Text Profile 的 `id` 必须先按 8 位十六进制解析为 uint32；只有进入 Binary Profile 编码时才使用 little-endian 字节序。

`eventId` 专指 Event Registry 中的事件类型 ID，仍为 uint16。若需要标识某一次事件实例，使用 `eventInstanceId`，逻辑类型同样为 uint32；Text Profile 编码为 8 位十六进制字符串，Binary Profile 中应放入事件 body 或事件上下文 TLV。

示例：

```text
第 1 个 Request: requestId = 0x00000001
第 2 个 Request: requestId = 0x00000002
...
第 N 个 Request: requestId = 0xFFFFFFFF
第 N+1 个 Request: requestId = 0x00000001（回绕，跳过 0）
```

### 5.3 二者区别

| 字段 | 所属层 | 作用 |
|---|---|---|
| `messageId` | Frame Layer | 识别完整传输消息、分片重组、ACK/NACK |
| `requestId` | RPC Layer | 匹配业务请求和业务响应 |
| `streamId` | Stream Layer | 标识连续数据流 |
| `seqId` | Stream Layer | 标识流内数据块序号 |

示例：

```text
一次 brightness.set RPC 请求：
  messageId = 0x0022
  requestId = 0x00000041

如果该 RPC 被拆成 3 个 Frame：
  Frame 1: messageId = 0x0022, frameIndex = 0, frameCount = 3
  Frame 2: messageId = 0x0022, frameIndex = 1, frameCount = 3
  Frame 3: messageId = 0x0022, frameIndex = 2, frameCount = 3

RPC Payload 重组完成后：
  RpcParser 才读取 requestId = 0x00000041
```

---

## 6. RPC Payload 总体设计

RPC Payload 分为两类表示：

```text
1. JSON RPC Payload / DS-RPC Debug Adapter
2. Binary RPC Payload
```

但二者属于同一个 `PayloadType = RPC`。

### 6.1 RPC Payload 选择原则

| 场景 | 推荐 rpcEncoding |
|---|---|
| WebSocket Text / HTTP / CLI / 浏览器调试 | `JSON`（DS-RPC Debug Adapter，非生产路径） |
| TCP / WebSocket Binary / USB Bulk 生产路径 | `BINARY` 或 `CBOR`；调试时可用 JSON body |
| BLE / HID / UART / MCU | `BINARY` + `bodyEncoding=TLV` |
| 动态字段较多 | `CBOR` |
| 固定字段、高频命令 | `BINARY` + `FIXED_STRUCT` |
| MVP 第一阶段 | `JSON` + `BINARY`，二进制 body 推荐 `TLV` |

---

## 7. rpcEncoding 注册表

| rpcEncoding | 名称 | 说明 | MVP |
|---:|---|---|---|
| `0x00` | `UNSPECIFIED` | 未指定，仅用于错误检测 | 否 |
| `0x01` | `JSON` | JSON RPC payload/body；Framed Mode 不得承载完整 DS-RPC Envelope | 是 |
| `0x02` | `BINARY` | AXTP Binary RPC Header + Body | 是 |
| `0x03` | `CBOR` | CBOR 编码对象 | 可选 |
| `0x04` | `MSGPACK` | MessagePack 编码对象 | 可选 |
| `0x05` | `FIXED_STRUCT` | 固定结构体 RPC Body | 可选 |
| `0x7F` | `VENDOR` | 厂商私有 RPC 编码 | 否 |

MVP 阶段必须实现：

```text
JSON
BINARY
```

其中 BINARY 的 bodyEncoding 至少支持：

```text
NONE
TLV
```

---

## 8. rpcOp 注册表

RPC 操作类型用于表达 RPC 语义。

| rpcOp | 名称 | 说明 | 是否需要 requestId | 是否需要 methodId/eventId |
|---:|---|---|---|---|
| `0x01` | `REQUEST` | 业务请求 | 是 | methodId |
| `0x02` | `RESPONSE` | 业务响应 | 是 | methodId |
| `0x03` | `EVENT` | 业务事件 | 否，填 0 | eventId |
| `0x04` | `BATCH_REQUEST` | 批量请求 | 是 | batch 内 item 指定 |
| `0x05` | `BATCH_RESPONSE` | 批量响应 | 是 | batch 内 item 指定 |
| `0x06` | `CANCEL` | 取消未完成请求 | 是 | methodId 可选 |
| `0x07` | `NOTIFY` | 单向通知，无响应 | 否或可选 | methodId |

MVP 阶段必须实现：

```text
REQUEST
RESPONSE
EVENT
```

Batch 可在 P1 阶段实现。

---

## 9. RPC Flags

RPC Payload 内部 flags 只描述 RPC 语义。AXTP v1 Frame Header 没有 Flags 字段，RPC 不得依赖 Frame bit 表达成功、失败或确认请求。

| Bit | 名称 | 说明 |
|---:|---|---|
| 0 | `SUCCESS` | Response 成功 |
| 1 | `ERROR` | Response 失败 |
| 2 | `HAS_BODY` | 存在 body |
| 3 | `ONEWAY` | 单向调用，不要求响应 |
| 4 | `COMPRESSED_BODY` | RPC body 已压缩 |
| 5 | `BODY_SCHEMA_ID_PRESENT` | 携带 body schemaId |
| 6 | `RESERVED` | 保留 |
| 7 | `RESERVED` | 保留 |

约束：

```text
SUCCESS 与 ERROR 不应同时置 1。
REQUEST 通常不设置 SUCCESS / ERROR。
RESPONSE 必须设置 SUCCESS 或 ERROR 之一。
EVENT 通常只根据是否有数据设置 HAS_BODY。
```

---

## 10. bodyEncoding 注册表

`bodyEncoding` 用于说明 RPC body 如何解析。

| bodyEncoding | 名称 | 说明 | MVP |
| ---: | --- | --- | --- |
| `0x00` | `NONE` | 无 body | 是 |
| `0x01` | `TLV` | TLV 编码 body | 是 |
| `0x02` | `JSON` | JSON object body | 是，用于 rpcEncoding=JSON |
| `0x03` | `CBOR` | CBOR object body | 可选 |
| `0x04` | `MSGPACK` | MessagePack object body | 可选 |
| `0x05` | `FIXED_STRUCT` | 固定结构体 body | 可选 |
| `0x06` | `RAW_BYTES` | 原始字节，用于旧协议 body 透传 | 可选 |
| `0x7F` | `VENDOR` | 厂商私有 | 否 |

建议：

```text
rpcEncoding = JSON 时：bodyEncoding 通常为 JSON 或可省略。
rpcEncoding = BINARY 时：bodyEncoding 推荐 TLV。
低带宽 MVP：BINARY + TLV。
```

**旧协议透传策略（Legacy Passthrough）：**

旧协议命令透传分两种情况，按协议类型选择机制：

| 场景 | 机制 | 说明 |
| --- | --- | --- |
| 单次命令/响应（绝大多数旧命令） | `RPC + bodyEncoding=RAW_BYTES` | 旧命令 body 原样放入 RPC body，methodId 通过 legacyMapping 映射，受 Registry 约束 |
| 持续字节流（如旧协议的裸数据通道） | `STREAM + legacy.tunnel profile` | 通过 Stream Context 协商，仅用于无法拆解为单次 RPC 的连续流 |

`RAW_BYTES` 使用规则：

```text
1. 必须通过 legacyMapping 在 Registry 中声明对应的 methodId；
2. 不得作为绕过 Registry 的任意逃生门；
3. 接收端必须知道如何解析该 methodId 对应的 RAW_BYTES body；
4. 新协议方法不得使用 RAW_BYTES，只允许旧协议适配层使用。
```

删除 `LEGACY_BINARY`（原 `0x05`）：该枚举名与 `RAW_BYTES` 语义重叠，统一使用 `RAW_BYTES`。`13-MVP注册表` 中的 `LEGACY_BINARY` 引用应替换为 `RAW_BYTES`。

---

## 11. statusCode

`statusCode` 用于表达 RPC 执行结果。

### 11.1 statusCode 适用范围

`statusCode` 主要用于：

```text
RESPONSE
BATCH_RESPONSE item
部分 EVENT 中的状态事件
```

REQUEST 中 `statusCode` 应填 0。

EVENT 中如果不是状态事件，`statusCode` 应填 0。

### 11.2 最小状态码

| statusCode | 名称 | 说明 |
|---:|---|---|
| `0x0000` | `NONE` | 无状态，仅占位 |
| `0x0064` | `SUCCESS` | 成功，十进制 100 |
| `0x0100` | `UNKNOWN_ERROR` | 未知错误 |
| `0x0101` | `INVALID_REQUEST` | 请求格式错误 |
| `0x0102` | `METHOD_NOT_FOUND` | methodId 不存在 |
| `0x0103` | `INVALID_PARAMS` | 参数错误 |
| `0x0104` | `UNSUPPORTED_ENCODING` | 不支持的编码 |
| `0x0105` | `UNSUPPORTED_METHOD` | 当前设备不支持该方法 |
| `0x0106` | `DEVICE_BUSY` | 设备忙 |
| `0x0107` | `TIMEOUT` | 执行超时 |
| `0x0108` | `PERMISSION_DENIED` | 权限不足 |
| `0x0109` | `RESOURCE_NOT_FOUND` | 资源不存在 |
| `0x010A` | `INTERNAL_ERROR` | 内部错误 |

完整 ErrorCode 由后续 ErrorCode 注册表定义。

---

### 11.3 RPC Error 与 Control NACK 的边界

RPC Error 表达业务方法、参数、权限、资源、设备状态等 RPC 语义失败；Control NACK 表达传输确认、分片缺失、CRC、会话恢复、状态机等协议运行时失败。两者不得混用。

| 场景 | 使用 RPC Error | 使用 Control NACK |
|---|---|---|
| `methodId` 不存在 | 是 | 否 |
| 参数非法 | 是 | 否 |
| 权限不足 | 是 | 否 |
| 设备忙或资源不存在 | 是 | 否 |
| Frame CRC 错误 | 否 | 是 |
| Message 分片缺失 | 否 | 是 |
| STREAM chunk 缺失 | 否 | 是 |
| RESUME token 无效 | 否 | 是 |
| 未进入 `SESSION_READY` 即收到业务帧 | 否 | 是 |

同一个失败不得同时返回 RPC Error 和 Control NACK。若 RPC Payload 已成功解析并进入方法分发，后续业务失败使用 RPC Error；若失败发生在 Frame、Control、Session、ACK/NACK 层，使用 Control NACK 或 Control Error。

---

## 12. MethodId 与 EventId

### 12.1 methodId

`methodId` 是业务方法的二进制标识。

DS-RPC Text Profile 中的方法名：

```json
"method": "brightness.set"
```

在 Binary-RPC 中映射为：

```text
methodId = 0x0602
```

methodId 必须由 MethodId 注册表统一分配。

### 12.2 eventId

`eventId` 是业务事件的二进制标识。

DS-RPC Text Profile 中的事件名：

```json
"event": "brightness.changed"
```

在 Binary-RPC 中映射为：

```text
eventId = 0x8601
```

eventId 必须由 EventId 注册表统一分配。

### 12.3 methodId 与 eventId 的字段复用

Binary RPC Payload 中可使用同一个字段：

```text
methodOrEventId
```

解释规则：

| rpcOp | methodOrEventId 含义 |
|---|---|
| `REQUEST` | methodId |
| `RESPONSE` | methodId |
| `EVENT` | eventId |
| `BATCH_REQUEST` | batch item 中的 methodId |
| `BATCH_RESPONSE` | batch item 中的 methodId |

---

## 13. DS-RPC Text Profile 表达规范

DS-RPC（Digital Signage RPC）是 AXTP 的 Debug / Legacy Text Adapter，适用于 WebSocket Text、HTTP API、CLI、浏览器调试工具等文本链路。它参考 obs-websocket 消息结构设计，使用 JSON Envelope 表达调试请求、响应、事件，以及兼容模式下的 Hello、Heartbeat、Bye 等流程。

DS-RPC Text Adapter 不使用 AXTP Frame Header，也不改变 Framed Mode 中 `CONTROL / RPC / STREAM` 的三分法。AXTP v1 的正式生产路径是 Framed Mode；WebSocket 生产连接应使用 WebSocket Binary + AXTP Frame Header。

### 定位：可选的调试与浏览器层，不是生产必须路径

**AXTP Framed Mode 是唯一的生产路径。** 所有正式客户端——native app、嵌入式设备、服务端——都应使用 AXTP Frame Header，走 WebSocket Binary、TCP、BLE、HID 或 UART。这条路径实现统一，只有一套 Parser 和一套状态机，没有模式切换。

DS-RPC Text Profile 存在的理由是服务特定客户端场景，而非协议本身的完整性需求：

| 场景 | 说明 |
| --- | --- |
| 浏览器 JS 客户端 | 原生处理 JSON，解析二进制帧需要额外实现 |
| curl / Postman / DevTools 调试 | 工具链天然支持 JSON，不支持自定义二进制帧 |
| HTTP REST API 兼容 | JSON 可直接映射到 HTTP 请求体 |
| 人工排查问题 | JSON 可读，二进制帧不可读 |

如果所有客户端都是你控制的 native app 或嵌入式设备，DS-RPC Text Profile 对该项目没有价值，可以不实现。

推荐的实现策略：

```text
生产路径（必须实现）：
  AXTP Framed Mode
  WebSocket Binary / TCP / BLE / HID / UART
  CONTROL + RPC + STREAM 完整三层

调试层（按需实现）：
  DS-RPC Text Adapter
  WebSocket Text
  优先覆盖 Request / Response / Event / Batch
  Legacy 模式可覆盖 Hello / Heartbeat / Bye
  不承载高吞吐 STREAM 数据面
```

使用边界：

```text
Framed Mode:
  使用 AXTP Frame Header
  PayloadType = CONTROL / RPC / STREAM
  RPC JSON 只表达业务 RPC Payload，不承载完整 DS-RPC Envelope
  Hello / Heartbeat / Bye 必须使用 PayloadType=CONTROL

Text Adapter:
  不使用 AXTP Frame Header
  使用 DS-RPC Envelope 承载调试 RPC
  Legacy 模式可承载 Hello / Heartbeat / Bye
  不承载高吞吐 STREAM 数据面
```

DS-RPC Text Adapter 与 AXTP Framed Mode 是两个 Wire Profile。它们解码后可以映射到同一套内部 `ProtocolMessage`，但不得在同一条连接中混用。不同传输组合的完整流程见 05《AXTP 连接场景与调用流程规范》。

所有 DS-RPC JSON 消息使用统一的三字段 Envelope：

```json
{
  "sid": "<session-id>",
  "op": <opcode>,
  "d": { ... }
}
```

| 字段 | 类型 | 必须 | 说明 |
| --- | --- | --- | --- |
| `sid` | string | 是 | Transport-level session routing key，见 §13.0 |
| `op` | number | 是 | Opcode，标识消息类型，见 §13.1 Opcode 表 |
| `d` | object | 是 | 消息数据体，内容由 op 决定 |

---

### 13.0 sid 的语义与 Binary 模式的对称性

`sid` 是 DS-RPC Text Profile 的 **transport-level session routing key**，不是业务消息字段。

#### 为什么 Binary 模式不携带 sessionId

Binary/Framed Mode 中，**连接本身就是 session 的载体**。ACCEPT 把 sessionId 写入两端的 Session Context，后续所有 RPC / STREAM 帧都不再携带它——解析器直接从当前连接的 Session Context 读取：

```text
连接建立
  → CONTROL ACCEPT  (sessionId 写入 Session Context)
  → RPC Request        (不携带 sessionId，从连接上下文读)
  → RPC Response       (不携带 sessionId)
```

#### 为什么 DS-RPC 每条消息都携带 sid

WebSocket Text 连接同样是连接级 session，`sid` 并非用于路由，而是在 codec 层完成两件事：

1. 从 sessionMap 中查找对应的 Session Context
2. 做一次 session 合法性校验，防止消息混淆或重放

`sid` 的角色等价于 HTTP Cookie——每个请求都携带，但应用逻辑不需要在每个 handler 里处理它。

#### 统一内部模型中的处理规则

`sid` 不属于 `ProtocolMessage`，在 TextCodec 边界被消费和注入：

```text
TextCodec.decode(json):
  sid     = json["sid"]
  session = sessionMap.lookup(sid)      ← codec 层处理，不透传给上层
  message = parseMessage(json["op"], json["d"])
  return (session, message)             ← message 中不含 sid

TextCodec.encode(session, message):
  return { "sid": session.id, "op": ..., "d": ... }   ← codec 层注入

FramedCodec.decode(bytes):
  session = connectionContext.session   ← 从连接上下文读，不从消息读
  message = parsePayload(bytes)
  return (session, message)
```

两个 codec 的输出结构完全一致：`(session, ProtocolMessage)`，Session 状态机和业务逻辑对 wire format 无感知。

#### 两种模式的对称关系

| | DS-RPC Text | Binary Framed |
| --- | --- | --- |
| sessionId 在哪里 | 每条消息的 `sid` 字段 | 连接上下文（Session Context） |
| 谁处理它 | TextCodec | FramedCodec（隐式，从连接读） |
| ProtocolMessage 里有吗 | 否 | 否 |
| 语义是否等价 | 是 | 是 |

不对称只存在于 wire format 层，语义模型完全同步。

---

### 13.0.1 DS-RPC op 与 CONTROL opcode 的关系

DS-RPC 的 `op` 字段把 Framed Mode 中 CONTROL 和 RPC 两层的职责折叠进了同一个 Envelope。理解这个折叠关系有助于实现统一的内部模型。

#### CONTROL 的两类操作

CONTROL 的操作可以分为两类，性质不同：

**第一类：会话管理**——与 DS-RPC session ops 一一对应：

| CONTROL opcode | DS-RPC op | 语义 |
| --- | --- | --- |
| CONNECT / ACCEPT | op=0 Hello / op=1 HelloAck (Legacy) | 会话建立与能力协商 |
| HEARTBEAT / HEARTBEAT_ACK | op=2 Heartbeat / op=3 HeartbeatAck | 心跳保活 |
| CLOSE / CLOSE_ACK | op=14 Bye / op=15 ByeAck | 有序关闭会话 |

**第二类：传输控制**——DS-RPC 中无对应物：

| CONTROL opcode | 说明 | DS-RPC 为何不需要 |
| --- | --- | --- |
| ACK / NACK | 帧级确认与重传 | TCP/WebSocket 保证可靠传输 |
| WINDOW_UPDATE | 接收窗口流控 | 同上 |
| RESUME / RESUME_ACK | 断线后逻辑会话恢复 | WebSocket 重连即重新握手 |
| SESSION_RESET | 强制重置状态机 | 同上 |

DS-RPC 运行在 TCP/WebSocket 之上，可靠性由传输层保证，因此第二类操作完全不需要。Binary Framed Mode 需要支持 BLE、UART 等不可靠传输，第二类操作是必须的。

#### 为什么会话管理也不能合并进 Binary RPC

即使只看第一类操作，在 Binary Framed Mode 中也不能把它们合并进 `PayloadType=RPC`，原因有二：

**Bootstrap 问题**：CONNECT 必须在 RPC 层就绪之前完成。RpcParser 依赖 SESSION_READY 状态才能工作，而 SESSION_READY 由 CONNECT/ACCEPT 建立。如果 CONNECT 变成 RPC 操作，两者互相依赖，形成死锁：

```text
当前设计（正确）：
  payloadType=CONTROL → ControlParser 处理 OPEN（RpcParser 尚未启动）
  → SESSION_READY → RpcParser 启动，开始处理业务 RPC

合并后的问题：
  payloadType=RPC → RpcParser 处理 OPEN
  → 但 RpcParser 需要 SESSION_READY 才能工作 → 死锁
```

**优先级问题**：HEARTBEAT、ACK、NACK 必须在 RPC 队列拥塞时仍能被及时处理。独立的 `PayloadType=CONTROL` 允许实现为其分配更高的处理优先级，不受业务 RPC 积压影响。

#### 总结

```text
DS-RPC session ops（op=0/1/2/3/14/15）
  ≡  CONTROL 会话管理子集（OPEN/HEARTBEAT/CLOSE 及其 ACK）

DS-RPC 无对应
  ≡  CONTROL 传输控制子集（ACK/NACK/WINDOW_UPDATE/RESUME/SESSION_RESET）
```

两种模式在会话管理语义上完全等价，差异仅在于 Binary Framed Mode 额外承载了 DS-RPC 不需要的传输控制职责。

---

### 13.0.2 为什么在所有传输层（包括 WebSocket）都应始终携带 AXTP Frame

#### 核心洞察

在所有传输层——包括 WebSocket Binary——始终携带 AXTP Frame Header，是比"按传输层选择是否携带 Frame"更简单的实现策略。

#### 双模式的隐藏成本

如果允许 WebSocket 在不带 AXTP Frame Header 的情况下运行（即 Unframed/DS-RPC-only 模式），实现端需要维护两套独立的协议逻辑：

```text
Framed Mode（TCP / BLE / HID / UART）：
  FramedCodec → ControlParser → RpcParser → StreamParser
  Session 状态机由 CONTROL OPEN/ACCEPT 驱动

Unframed Mode（WebSocket Text/Binary）：
  TextCodec → DS-RPC Envelope Parser
  Session 状态机由 DS-RPC Hello/HelloAck 驱动
  sid 在每条消息中显式携带
```

这意味着：

- 两套 Codec（FramedCodec + TextCodec）
- 两套 Session 状态机（CONTROL 驱动 vs DS-RPC 驱动）
- 两套测试向量
- 两套调试路径
- 传输层切换时需要模式判断逻辑

#### 始终携带 Frame 的优势

如果 WebSocket Binary 也始终携带 AXTP Frame Header，整个协议栈收敛为单一路径：

```text
所有传输层（WebSocket Binary / TCP / BLE / HID / UART）：
  FramedCodec → ControlParser → RpcParser → StreamParser
  Session 状态机统一由 CONTROL OPEN/ACCEPT 驱动
  sessionId 隐式绑定到连接上下文，不在消息中携带
```

优势：

- **单一实现栈**：一套 Parser、一套状态机、一套测试向量
- **行为一致性**：WebSocket Binary 与 TCP 行为完全相同，无需模式切换
- **调试路径统一**：抓包格式一致，工具链复用
- **传输层透明**：业务逻辑对传输层无感知，换传输层不改代码

#### 推荐策略

```text
生产路径（所有传输层，包括 WebSocket Binary）：
  始终携带 AXTP Frame Header
  PayloadType = CONTROL / RPC / STREAM
  WebSocket Binary 与 TCP 使用相同的 Standard Profile（12B Header + CRC16）

调试/浏览器层（按需，不进入生产）：
  DS-RPC Text Profile（WebSocket Text）
  仅用于 curl / Postman / 浏览器 DevTools / 人工排查
  不承载 STREAM 数据面
  不作为正式客户端的实现路径
```

#### 结论

DS-RPC Text Profile 的存在价值是服务**无法处理二进制帧的调试工具和浏览器脚本**，而不是为了给 WebSocket 提供一种"更轻量"的运行模式。

对于所有可控的客户端（native app、嵌入式设备、服务端、SDK），应始终使用 AXTP Frame Header。这不是限制，而是简化：一套实现，覆盖所有传输层。

---

### 13.1 DS-RPC Debug Adapter Opcode 表

正式 AXTP RPC 语义只需要：

```text
Request
Response
Event
BatchRequest
BatchResponse
```

`Hello / HelloAck / Heartbeat / Bye` 只属于 DS-RPC Legacy Adapter。新实现如果已经支持 AXTP Framed Mode，不应把这些 op 作为正式连接生命周期；应用身份、认证和业务能力应使用普通 RPC 方法，例如 `session.identify`、`session.challenge`、`capability.getAll`。

| op | 名称 | 方向 | 说明 |
| --- | --- | --- | --- |
| `0` | `Hello` | Server → Client | Legacy Adapter 连接建立，发起调试会话能力说明 |
| `1` | `HelloAck` | Client → Server | Legacy Adapter 确认连接，返回 sid |
| `2` | `Heartbeat` | 双向 | Legacy Adapter 心跳保活 |
| `3` | `HeartbeatAck` | 双向 | Legacy Adapter 心跳响应 |
| `5` | `Subscribe` | Client → Server | 订阅事件 |
| `6` | `Event` | Server → Client | 服务端主动推送事件 |
| `7` | `Request` | Client → Server | 发起 RPC 调用 |
| `8` | `RequestResponse` | Server → Client | 返回 RPC 调用结果 |
| `10` | `BatchRequest` | Client → Server | 批量 RPC 请求 |
| `11` | `BatchResponse` | Server → Client | 批量 RPC 响应 |
| `12` | `RESERVED_STREAM_DATA` | - | 保留；AXTP v1 STREAM 数据必须使用 Framed Mode 的 16B L2 Header，不在 DS-RPC 中承载 |
| `13` | `FragmentAck` | 双向 | 分片确认 |
| `14` | `Bye` | 双向 | Legacy Adapter 主动断开连接 |
| `15` | `ByeAck` | 双向 | Legacy Adapter 断开确认 |

---

### 13.2 Legacy Hello / HelloAck

本节仅适用于 WebSocket Text / HTTP Debug 的 Legacy Adapter。Framed Mode 下，连接级握手只能使用 `PayloadType=CONTROL` 的 `CONNECT / ACCEPT`；如果在 Framed RPC 中收到 DS-RPC Hello，应拒绝或兼容映射为 `session.identify` 并返回 deprecated 警告。

**Hello（op=0）**，Server → Client，发起协议协商：

```json
{
  "sid": "",
  "op": 0,
  "d": {
    "protocol": "axtp",
    "version": 1,
    "deviceId": "screen-001",
    "deviceType": "display",
    "transport": {
      "type": "websocket",
      "maxPacketSize": 4096
    },
    "capabilities": {
      "event": true,
      "batch": true,
      "stream": true,
      "fragment": true
    }
  }
}
```

**HelloAck（op=1）**，Client → Server，确认连接并返回 sid：

```json
{
  "sid": "28378462323",
  "op": 1,
  "d": {
    "accepted": true,
    "version": 1,
    "heartbeatIntervalMs": 30000
  }
}
```

---

### 13.3 Heartbeat / HeartbeatAck

**Heartbeat（op=2）**：

```json
{
  "sid": "28378462323",
  "op": 2,
  "d": {
    "timestamp": 1747649200000
  }
}
```

**HeartbeatAck（op=3）**：

```json
{
  "sid": "28378462323",
  "op": 3,
  "d": {
    "timestamp": 1747649200000
  }
}
```

心跳规则：默认周期 30s，连续 3 次超时视为断开，BLE/HID 场景可降低频率。

---

### 13.4 Subscribe（op=5）

Client 订阅事件：

```json
{
  "sid": "28378462323",
  "op": 5,
  "d": {
    "id": "00000011",
    "mode": "replace",
    "events": [
      "BrightnessChanged",
      "DeviceStatusChanged"
    ]
  }
}
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | 固定 8 位十六进制订阅请求 ID |
| `mode` | string | `replace`（替换现有订阅）/ `append`（追加）/ `remove`（移除） |
| `events` | array | 事件名列表，PascalCase |

---

### 13.5 Request（op=7）

Client 发起 RPC 调用：

```json
{
  "sid": "28378462323",
  "op": 7,
  "d": {
    "id": "00000001",
    "method": "SetBrightness",
    "params": {
      "value": 80
    }
  }
}
```

| 字段 | 类型 | 必须 | 说明 |
| --- | --- | --- | --- |
| `id` | string | 是 | 固定 8 位十六进制请求 ID，同一 Session 内唯一，对应 Binary 的 uint32 `requestId` |
| `method` | string | 是 | 方法名，PascalCase，对应 Binary 的 `methodId` |
| `params` | object | 否 | 请求参数，对应 Binary 的 `body` |

规则：`id` 必须唯一；Response 必须返回对应 `id`；`id` 必须可解析为 uint32 且不得为 `"00000000"`；`method` 区分大小写；`params` 可为空对象。

---

### 13.6 RequestResponse（op=8）

**成功响应：**

```json
{
  "sid": "28378462323",
  "op": 8,
  "d": {
    "id": "00000001",
    "method": "SetBrightness",
    "status": {
      "result": true,
      "code": 100
    },
    "result": {
      "value": 80
    }
  }
}
```

**失败响应：**

```json
{
  "sid": "28378462323",
  "op": 8,
  "d": {
    "id": "00000001",
    "method": "SetBrightness",
    "status": {
      "result": false,
      "code": 300,
      "comment": "Value out of range"
    }
  }
}
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | 对应 Request 的 `id` |
| `method` | string | 对应 Request 的 `method` |
| `status.result` | bool | `true` = 成功，`false` = 失败 |
| `status.code` | number | 成功时必须为 `100`；失败时为非 100 错误码 |
| `status.comment` | string | 失败时建议填写，说明原因 |
| `result` | object | 成功时的返回数据，对应 Binary 的 `body` |

---

### 13.7 Event（op=6）

Server 主动推送事件：

```json
{
  "sid": "28378462323",
  "op": 6,
  "d": {
    "event": "BrightnessChanged",
    "eventInstanceId": "00000021",
    "timestamp": 1747649200000,
    "data": {
      "value": 80,
      "source": "local"
    }
  }
}
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `event` | string | 事件名，PascalCase，对应 Binary 的 Registry `eventId` |
| `eventInstanceId` | string | 固定 8 位十六进制事件实例 ID，用于去重和追踪 |
| `timestamp` | number | 事件发生时间，Unix 毫秒时间戳 |
| `data` | object | 事件数据，对应 Binary 的 `body` |

---

### 13.8 BatchRequest（op=10）

一次发送多个 Request：

```json
{
  "sid": "28378462323",
  "op": 10,
  "d": {
    "id": "00000031",
    "haltOnFailure": true,
    "requests": [
      {
        "method": "SetVolume",
        "params": { "value": 50 }
      },
      {
        "method": "SetBrightness",
        "params": { "value": 80 }
      }
    ]
  }
}
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | 固定 8 位十六进制 Batch 请求 ID |
| `haltOnFailure` | bool | `true` = 遇到失败立即停止后续请求 |
| `requests` | array | 请求列表，每项包含 `method` 和可选 `params` |

---

### 13.9 Bye / ByeAck

**Bye（op=14）**，主动断开：

```json
{
  "sid": "28378462323",
  "op": 14,
  "d": {
    "reason": "client disconnect"
  }
}
```

**ByeAck（op=15）**：

```json
{
  "sid": "28378462323",
  "op": 15,
  "d": {
    "accepted": true
  }
}
```

---

### 13.10 方法名与事件名命名规范

**方法名（method）**：PascalCase，动词开头：

```text
GetDeviceInfo
SetBrightness
StartScreenShare
StopScreenShare
OpenStream
CloseStream
```

**事件名（event）**：PascalCase，名词 + 状态后缀：

```text
BrightnessChanged
DeviceStatusChanged
FirmwareUpdateCompleted
StreamOpened
StreamClosed
```

---

### 13.11 低带宽紧凑字段映射

BLE/HID 场景可启用紧凑字段模式，字段名缩短：

| 标准字段 | 紧凑字段 |
| --- | --- |
| `sid` | `s` |
| `op` | `o` |
| `d` | `d`（不变） |
| `d.id` | `d.i` |
| `d.method` | `d.m` |
| `d.params` | `d.p` |

示例：

```json
{
  "s": "28378462323",
  "o": 7,
  "d": {
    "i": "00000001",
    "m": "SetVolume",
    "p": { "value": 50 }
  }
}
```

紧凑模式通过 Hello/HelloAck 协商启用，不得在未协商的情况下单方面使用。

---

## 14. Binary RPC Standard Payload

Binary RPC Standard Payload 用于 TCP、WebSocket Binary、USB Bulk，以及需要完整字段表达的场景。

### 14.1 Standard Binary RPC Layout

```text
+-------------+-------------+
| rpcEncoding | rpcOp       |
+-------------+-------------+
| flags       | reserved    |
+-------------+-------------+
| requestId                 |
+-------------+-------------+
| methodOrEventId           |
+-------------+-------------+
| statusCode                |
+-------------+-------------+
| bodyEncoding | bodyLen    |
+-------------+-------------+
| body...                   |
+---------------------------+
```

### 14.2 字段长度

| 字段 | 长度 | 类型 | 说明 |
|---|---:|---|---|
| `rpcEncoding` | 1B | uint8 | RPC 编码类型，Binary 模式为 `0x02` |
| `rpcOp` | 1B | uint8 | REQUEST / RESPONSE / EVENT |
| `flags` | 1B | uint8 | RPC flags |
| `reserved` | 1B | uint8 | 保留，必须填 0 |
| `requestId` | 4B | uint32 | 请求 ID，EVENT 填 0 |
| `methodOrEventId` | 2B | uint16 | methodId 或 eventId |
| `statusCode` | 2B | uint16 | Response 状态码 |
| `bodyEncoding` | 1B | uint8 | body 编码 |
| `bodyLen` | 4B | uint32 | body 长度 |
| `body` | N | bytes | params / result / event data |

Standard Binary RPC 固定头长度：

```text
1 + 1 + 1 + 1 + 4 + 2 + 2 + 1 + 4 = 17 Bytes
```

### 14.3 字节序

MVP 建议统一使用：

```text
Little Endian
```

原因：

```text
MCU / HID / BLE 场景下 C/C++ 实现成本较低；
旧 HID 协议通常更接近小端结构；
Generator 可统一生成 encode/decode 函数，避免直接 memcpy 造成跨平台问题。
```

注意：线上协议必须通过显式读写函数编码，不允许依赖宿主机结构体内存布局。

---

## 15. Binary RPC Compact Payload

Compact Binary RPC 用于 BLE、USB HID、UART、低带宽 MCU。

### 15.1 Compact Binary RPC Layout

```text
+-------------+-------------+
| rpcOp       | flags       |
+-------------+-------------+
| requestId                 |
+-------------+-------------+
| methodOrEventId           |
+-------------+-------------+
| statusCode                |
+-------------+-------------+
| body...                   |
+---------------------------+
```

### 15.2 字段长度

| 字段 | 长度 | 类型 | 说明 |
|---|---:|---|---|
| `rpcOp` | 1B | uint8 | REQUEST / RESPONSE / EVENT |
| `flags` | 1B | uint8 | RPC flags |
| `requestId` | 4B | uint32 | 请求 ID，EVENT 填 0 |
| `methodOrEventId` | 2B | uint16 | methodId 或 eventId |
| `statusCode` | 2B | uint16 | Response 状态码 |
| `body` | N | TLV | 默认 TLV body |

Compact Binary RPC 固定头长度：

```text
1 + 1 + 4 + 2 + 2 = 10 Bytes
```

Compact 模式默认约定：

```text
rpcEncoding = BINARY
bodyEncoding = TLV
bodyLen = Frame.payloadLength - 10
```

如果 `HAS_BODY = 0`，则 body 长度必须为 0。

### 15.3 Compact 模式的限制

Compact Binary RPC v1 不携带以下字段：

```text
rpcEncoding
reserved
bodyEncoding
bodyLen
schemaId
```

这些信息由 Header Profile、Capability 协商或 Method Registry 推导。

---

## 16. DS-RPC Text 与 Binary 映射关系

DS-RPC Text Profile 与 AXTP Binary RPC 的业务字段对应关系如下。该表只适用于 `Request / RequestResponse / Event / Batch`，不适用于 DS-RPC 的 Hello、Heartbeat、Bye 等连接管理信令：

| DS-RPC Envelope / d 字段 | Binary 字段 | 说明 |
| --- | --- | --- |
| `op`（数字） | `rpcOp` | 仅 `Request / RequestResponse / Event / Batch` 可映射到 Binary RPC 操作 |
| `sid` | Session 层（不在 Binary RPC Payload 中） | Session ID 由 CONTROL 层管理 |
| `d.id` | `requestId` | 请求响应匹配；Text 为 8 位十六进制字符串，Binary 为 4B little-endian uint32 |
| `d.method` | `methodId` | 方法名（PascalCase）映射到 uint16 ID |
| `d.event` | `eventId` | 事件名（PascalCase）映射到 uint16 ID |
| `d.eventInstanceId` | 事件 body / context | 事件实例 ID；Text 为 8 位十六进制字符串，Binary 中作为 TLV uint32 字段承载 |
| `d.params` | `body` | Request 参数，JSON 为 object，Binary 为 TLV |
| `d.result` | `body` | Response 成功数据，Binary 为 TLV |
| `d.status.result` | `RPC flags SUCCESS / ERROR` | `true` → SUCCESS，`false` → ERROR |
| `d.status.code` | `statusCode` | 成功时 100，失败时为错误码 |
| `d.status.comment` | `body` 中的 errorDetail 字段 | 失败原因描述 |
| `d.data` | `body` | Event 数据，Binary 为 TLV |

**op 数字与 rpcOp 枚举对应：**

| JSON op | DS-RPC 名称 | Binary rpcOp |
| --- | --- | --- |
| `7` | Request | `REQUEST (0x01)` |
| `8` | RequestResponse | `RESPONSE (0x02)` |
| `6` | Event | `EVENT (0x03)` |
| `10` | BatchRequest | `BATCH_REQUEST (0x04)` |
| `11` | BatchResponse | `BATCH_RESPONSE (0x05)` |

示例：JSON Request → Binary 映射：

```json
{
  "sid": "28378462323",
  "op": 7,
  "d": {
    "id": "00000001",
    "method": "SetBrightness",
    "params": { "value": 80 }
  }
}
```

映射为：

```text
rpcOp          = REQUEST (0x01)
requestId      = 0x00000001
methodId       = 0x0602  （SetBrightness 的注册 ID）
statusCode     = 0x0000
bodyEncoding   = TLV
body           = 01 01 50  （value=80）
```

---

## 17. TLV Body 编码

### 17.1 TLV 基本结构

```text
+---------+---------+---------+
| type    | length  | value   |
+---------+---------+---------+
```

字段：

| 字段 | 长度 | 说明 |
|---|---:|---|
| `type` | 1B | 字段 ID |
| `length` | 1B | value 长度 |
| `value` | N | 字段值 |

扩展长度由 TLV Schema 文档定义。

### 17.2 TLV 字段来源

TLV 字段 ID 不在 RPC 协议中硬编码，而由 Method Registry 的 schema 定义。

示例：

```yaml
method: brightness.set
methodId: 0x0602
params:
  - fieldId: 0x01
    name: value
    type: uint8
    required: true
```

### 17.3 brightness.set TLV 示例

JSON params：

```json
{
  "value": 80
}
```

TLV body：

```text
01 01 50
```

含义：

```text
fieldId = 0x01
length  = 0x01
value   = 0x50 = 80
```

### 17.4 多字段 TLV 示例

JSON params：

```json
{
  "value": 80,
  "autoMode": false
}
```

TLV body：

```text
01 01 50
02 01 00
```

含义：

```text
field 0x01: value = 80
field 0x02: autoMode = false
```

---

## 18. RPC Request

### 18.1 Request 语义

Request 表示客户端向设备或服务端发起一个业务请求。

Request 必须包含：

```text
requestId
methodId 或 method name
params body 可选
```

### 18.2 JSON + Binary Request 示例：SetBrightness

JSON（DS-RPC 格式）：

```json
{
  "sid": "28378462323",
  "op": 7,
  "d": {
    "id": "00000001",
    "method": "SetBrightness",
    "params": { "value": 80 }
  }
}
```

对应 Compact Binary RPC 字节：

```text
01 04 01 00 00 00 02 06 00 00 01 01 50
```

按 Little Endian 解释：

```text
01          rpcOp = REQUEST
04          flags = HAS_BODY
01 00 00 00 requestId = 0x00000001
02 06       methodId = 0x0602
00 00       statusCode = NONE
01 01 50    TLV body: value=80
```

---

## 19. RPC Response

### 19.1 Response 语义

Response 表示对 Request 的业务响应。

Response 必须包含：

```text
requestId
methodId
statusCode
success/error flags
result 或 error body 可选
```

### 19.2 成功响应

JSON（DS-RPC 格式）：

```json
{
  "sid": "28378462323",
  "op": 8,
  "d": {
    "id": "00000001",
    "method": "SetBrightness",
    "status": {
      "result": true,
      "code": 100
    },
    "result": {
      "value": 80
    }
  }
}
```

Compact Binary RPC：

```text
02 05 01 00 00 00 02 06 64 00 01 01 50
```

解释：

```text
02          rpcOp = RESPONSE
05          flags = SUCCESS | HAS_BODY
01 00 00 00 requestId = 0x00000001
02 06       methodId = 0x0602
64 00       statusCode = 100
01 01 50    TLV body: value=80
```

### 19.3 错误响应

JSON（DS-RPC 格式）：

```json
{
  "sid": "28378462323",
  "op": 8,
  "d": {
    "id": "00000001",
    "method": "SetBrightness",
    "status": {
      "result": false,
      "code": 300,
      "comment": "Value out of range"
    }
  }
}
```

Compact Binary RPC：

```text
02 06 01 00 00 00 02 06 03 01 01 01 01 02 0C 6F 75 74 20 6F 66 20 72 61 6E 67 65
```

解释：

```text
02          rpcOp = RESPONSE
06          flags = ERROR | HAS_BODY
01 00 00 00 requestId = 0x00000001
02 06       methodId = 0x0602
03 01       statusCode = 0x0103 INVALID_PARAMS
01 01 01    errorFieldId = 1
02 0C ...   reason = "out of range"
```

错误 body 的字段定义由 ErrorCode / Method Schema 文档规定。

---

## 20. RPC Event

### 20.1 Event 语义

Event 表示设备主动上报的业务事件。

Event 不要求请求方先发 Request，因此：

```text
requestId = 0x00000000
methodOrEventId = eventId
```

### 20.2 Event 示例：BrightnessChanged

JSON（DS-RPC 格式）：

```json
{
  "sid": "28378462323",
  "op": 6,
  "d": {
    "event": "BrightnessChanged",
    "eventInstanceId": "00000021",
    "timestamp": 1747649200000,
    "data": {
      "value": 80,
      "source": "local"
    }
  }
}
```

Compact Binary RPC：

```text
03 04 00 00 00 00 01 86 00 00 01 01 50 02 01 01
```

解释：

```text
03          rpcOp = EVENT
04          flags = HAS_BODY
00 00 00 00 requestId = 0x00000000
01 86       eventId = 0x8601 brightness.changed
00 00       statusCode = NONE
01 01 50    value = 80
02 01 01    source = local
```

---

## 21. Batch RPC

Batch RPC 用于一次性发送多个 RPC 请求，减少 RTT。

MVP 阶段可以暂不实现 Batch，但协议应保留结构。

### 21.1 JSON Batch Request（op=10）

```json
{
  "sid": "28378462323",
  "op": 10,
  "d": {
    "id": "00000031",
    "haltOnFailure": true,
    "requests": [
      {
        "method": "SetVolume",
        "params": { "value": 50 }
      },
      {
        "method": "SetBrightness",
        "params": { "value": 80 }
      }
    ]
  }
}
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | 固定 8 位十六进制 Batch 请求 ID |
| `haltOnFailure` | bool | `true` = 遇到失败立即停止后续请求 |
| `requests` | array | 请求列表，每项包含 `method` 和可选 `params` |

### 21.2 Binary Batch Request Body

Batch Request 的外层 RPC：

```text
rpcOp = BATCH_REQUEST
requestId = parse_hex_uint32(batchRequestId)
methodOrEventId = 0
bodyEncoding = TLV 或 BINARY_BATCH
```

Batch body 推荐结构：

```text
+------------+------------+
| batchFlags | itemCount  |
+------------+------------+
| item[0]                 |
+-------------------------+
| item[1]                 |
+-------------------------+
```

Batch item：

```text
+------------+------------+
| requestId               |
+------------+------------+
| methodId                |
+------------+------------+
| bodyLen                 |
+------------+------------+
| body...                 |
+-------------------------+
```

### 21.3 Batch 执行策略

| execType | 名称 | 说明 |
| --- | --- | --- |
| `0x00` | `SERIAL` | 按顺序执行，对应 `haltOnFailure=true` |
| `0x01` | `PARALLEL` | 可并行执行 |
| `0x02` | `BEST_EFFORT` | 尽力执行，不因单项失败中断，对应 `haltOnFailure=false` |

### 21.4 MVP 建议

MVP 阶段建议不实现 Batch，保留错误码：

```text
UNSUPPORTED_RPC_OP
```

当收到 Batch 请求时返回不支持。

---

## 22. RPC Cancel 与 Oneway

### 22.1 CANCEL

`CANCEL` 用于取消尚未完成的长耗时 RPC。

例如：

```text
firmware.verify
log.export
diagnostic.runTest
```

CANCEL Payload：

```text
rpcOp = CANCEL
requestId = 被取消的 requestId
methodId = 原 methodId，可选
```

### 22.2 ONEWAY

某些 RPC 可以声明为单向调用：

```text
flags.ONEWAY = 1
```

例如非常低频且不关心结果的通知类方法。

MVP 阶段不建议大量使用 ONEWAY，因为它会降低问题定位能力。

---

## 23. RPC 与 Capability

RPC 可用能力必须由 Capability Registry 描述。

设备可通过以下方法暴露能力：

```text
capability.getAll
capability.getDomain
capability.hasMethod
```

RPC 层需要依赖 capability 判断：

```text
当前 methodId 是否支持；
当前 rpcEncoding 是否支持；
当前 bodyEncoding 是否支持；
当前参数 schemaVersion 是否支持；
```

协议能力和业务能力的边界：

| 能力类型 | 获取方式 |
|---|---|
| 支持 PayloadType、Header Profile、MTU、窗口大小 | CONTROL OPEN / ACCEPT |
| 支持哪些业务方法、事件、参数范围、编解码能力 | RPC capability.* |

---

## 24. RPC 与 STREAM 的协作

大量业务采用：

```text
RPC 控制面 + STREAM 数据面
```

例如 OTA：

```text
RPC firmware.begin
  -> 返回 transferId, streamId, profile = firmware.ota

STREAM packet
  -> streamId / seqId / cursor / data

RPC firmware.verify
  -> 校验固件

RPC firmware.apply
  -> 应用固件
```

例如文件传输：

```text
RPC file.beginTransfer
  -> 返回 transferId

STREAM packet
  -> streamId / seqId / cursor / data 传输 file chunk

RPC file.endTransfer
  -> 结束传输
```

例如视频预览：

```text
RPC video.startPreview 或 stream.open
  -> 返回 streamId

STREAM packet
  -> streamId / seqId / cursor / data 传输视频帧

RPC stream.close
  -> 关闭视频流
```

RPC 负责生命周期和参数协商，STREAM 负责持续数据传输。

---

## 25. 老协议 CmdValue 适配

### 25.1 核心原则

如果旧协议中已经存在 `CmdValue`、`CommandId`、`Opcode` 等字段，并且它们本质上表示业务方法，则可以直接映射为 AXTP `methodId`。

不建议推翻旧命令表重新编号。

推荐策略：

```text
旧 CmdValue 保留为 methodId
旧 Payload 映射为 TLV body 或 FIXED_STRUCT body
旧返回码映射为 statusCode / errorCode
旧能力表映射为 capability registry
```

### 25.2 适配表结构

```yaml
legacyMappings:
  - legacyProtocol: AXDP-HID
    legacyCmdValue: 0xC0021
    axtpMethodId: 0xC0021
    axtpMethodName: video.setMode
    bodyEncoding: FIXED_STRUCT
    status: migrated
```

### 25.3 MethodId 长度问题

AXTP MVP 的 Binary RPC Compact Header 中 `methodOrEventId` 为 uint16。

如果旧协议 CmdValue 超过 uint16，例如：

```text
0xC0021
```

则有三种处理方式：

#### 方案 A：使用 Standard Binary RPC Extended MethodId

在 Standard Binary RPC 中通过扩展字段支持 uint32 methodId。

适合：

```text
需要完整保留旧 CmdValue；
TCP / USB Bulk / WebSocket Binary；
```

#### 方案 B：建立 legacyMethodAlias 映射表

将旧 CmdValue 映射到 AXTP uint16 methodId：

```text
legacyCmdValue = 0xC0021
methodId       = 0x0706 video.setMode
```

适合：

```text
BLE / HID Compact；
新协议重新规划 methodId 段；
```

#### 方案 C：使用 vendor method range

保留旧 CmdValue 的低 16 位作为厂商私有 methodId：

```text
methodId = 0x7000-0x7FFF vendor range
```

适合：

```text
临时兼容；
不希望立刻整理全部老协议；
```

MVP 建议：

```text
Compact Profile 使用 uint16 methodId；
老协议超长 CmdValue 通过 legacy mapping 表映射；
Generator v1 生成 legacy_to_method_id() 查找函数。
```

---

## 26. Method Schema 与 Generator

RPC 的 params/result/eventData 必须由 schema 描述，不能只靠人工表格。

### 26.1 Method Registry 示例

```yaml
methods:
  - id: 0x0602
    name: brightness.set
    domain: brightness
    since: 1.0.0
    stability: stable
    rpc:
      allowedEncodings:
        - JSON
        - BINARY
      defaultBodyEncoding: TLV
    params:
      - fieldId: 0x01
        name: value
        type: uint8
        required: true
        range: [0, 100]
    result:
      - fieldId: 0x01
        name: value
        type: uint8
        required: true
    errors:
      - INVALID_PARAMS
      - DEVICE_BUSY
    events:
      - brightness.changed
```

### 26.2 Generator v1 输入

Generator v1 至少读取：

```text
method_registry.yaml
event_registry.yaml
error_code.yaml
capability_registry.yaml
tlv_schema.yaml
```

### 26.3 Generator v1 输出

Generator v1 至少输出：

```text
C++ MethodId enum
C++ EventId enum
C++ ErrorCode enum
method descriptor table
event descriptor table
TLV field constants
JSON method name <-> methodId 映射
legacy CmdValue <-> methodId 映射
Markdown 注册表
基础测试向量
```

---

## 27. C++ Parser 推荐流程

### 27.1 Frame 到 RPC Payload

```cpp
ParseResult parseFrame(const uint8_t* data, size_t len) {
    Frame frame = parseAxtpFrame(data, len);

    if (!verifyCrc(frame)) {
        return error(CRC_ERROR);
    }

    switch (frame.payloadType) {
        case PayloadType::CONTROL:
            return parseControl(frame.payload);
        case PayloadType::RPC:
            return parseRpc(frame.payload, frame.profile);
        case PayloadType::STREAM:
            return parseStream(frame.payload);
        default:
            return error(UNSUPPORTED_PAYLOAD_TYPE);
    }
}
```

### 27.2 RPC Parser

```cpp
RpcMessage parseRpc(const ByteSpan& payload, HeaderProfile profile) {
    if (profile == HeaderProfile::Compact) {
        return parseCompactBinaryRpc(payload);
    }

    RpcEncoding encoding = peekRpcEncoding(payload);

    switch (encoding) {
        case RpcEncoding::JSON:
            return parseJsonRpc(payload);
        case RpcEncoding::BINARY:
            return parseStandardBinaryRpc(payload);
        case RpcEncoding::CBOR:
            return parseCborRpc(payload);
        default:
            throw UnsupportedEncoding();
    }
}
```

### 27.3 分发逻辑

```cpp
RpcResponse dispatchRpc(const RpcMessage& msg) {
    if (msg.op == RpcOp::EVENT) {
        return handleEvent(msg);
    }

    auto descriptor = registry.findMethod(msg.methodId);
    if (!descriptor) {
        return makeError(msg, ErrorCode::METHOD_NOT_FOUND);
    }

    if (!capability.supports(msg.methodId)) {
        return makeError(msg, ErrorCode::UNSUPPORTED_METHOD);
    }

    auto params = decodeBody(msg.body, descriptor->paramsSchema);
    if (!params.ok()) {
        return makeError(msg, ErrorCode::INVALID_PARAMS);
    }

    return descriptor->handler(params.value());
}
```

---

## 28. MVP 实现范围

### 28.1 MVP 必须实现

```text
PayloadType = RPC
rpcEncoding = JSON
rpcEncoding = BINARY
rpcOp = REQUEST / RESPONSE / EVENT
Compact Binary RPC Header
Standard Binary RPC Header 可选但建议实现
bodyEncoding = NONE / TLV / JSON
uint16 methodId
uint16 eventId
uint16 statusCode
uint32 requestId for Text / Compact / Standard
method name <-> methodId 映射
TLV body decode / encode
```

### 28.2 MVP 方法范围

建议 MVP 方法只覆盖：

```text
device.getInfo
capability.getAll
brightness.get
brightness.set
firmware.begin
firmware.verify
firmware.apply
stream.open
stream.close
event.subscribe
event.unsubscribe
```

### 28.3 MVP 事件范围

建议 MVP 事件只覆盖：

```text
device.statusChanged
brightness.changed
firmware.updateProgress
firmware.updateCompleted
firmware.updateFailed
stream.opened
stream.closed
stream.error
```

### 28.4 MVP 暂不实现

```text
Batch RPC
CANCEL
ONEWAY
CBOR
MSGPACK
压缩 body
加密 body
动态 schema 下载
复杂反射
完整 SDK
```

---

## 29. 测试向量建议

后续 TestVector 文档至少应包含以下 RPC 测试向量：

```text
1. DS-RPC Text device.getInfo request
2. DS-RPC Text device.getInfo response
3. Compact Binary RPC brightness.set request
4. Compact Binary RPC brightness.set response success
5. Compact Binary RPC brightness.set response invalid params
6. Compact Binary RPC brightness.changed event
7. RPC unsupported method error
8. RPC unknown encoding error
9. Fragmented RPC message reassembly
10. Legacy CmdValue to methodId mapping
```

每个测试向量应包含：

```text
语义说明
JSON 表达
Binary 字段展开
完整 Frame Hex
期望解析结果
期望错误码
```

---

## 30. 与其他文档的关系

| 文档 | 与本文关系 |
|---|---|
| 01《AXTP 整体协议规范》 | 定义 Frame Header、PayloadType、Fragment、CRC |
| 02《AXTP Control 信令协议规范》 | 定义 CONTROL，不承载业务方法 |
| 04《AXTP Stream 流式传输协议规范》 | 定义 STREAM 数据面，RPC 只负责控制面 |
| Type System 基础类型规范 | 定义 uint、bool、enum、bitmap、string、bytes 等类型 |
| TLV Schema 编码规范 | 定义 bodyEncoding=TLV 时的字段编码 |
| MethodId 注册表 | 定义 methodId、methodName、params、result |
| EventId 注册表 | 定义 eventId、eventName、eventData |
| ErrorCode 注册表 | 定义 statusCode / errorCode 语义 |
| Capability 注册表 | 定义设备支持哪些 RPC 能力 |
| 老协议适配规范 | 定义 CmdValue / legacy payload 到 RPC 的映射 |
| Generator v1 实现规范 | 定义如何从 registry 生成 C++ 和 Markdown |

---

## 31. 兼容与版本策略

### 31.1 新增方法

新增 methodId 不需要修改 RPC 协议版本。

只需要更新：

```text
MethodId Registry
Capability Registry
Generator 输出
```

### 31.2 新增事件

新增 eventId 不需要修改 RPC 协议版本。

只需要更新：

```text
EventId Registry
Capability Registry
Generator 输出
```

### 31.3 新增 body 字段

新增可选字段不需要修改方法版本，但必须满足：

```text
旧设备可忽略未知 TLV 字段；
新字段必须有默认行为；
required 字段不得随意新增；
```

### 31.4 修改字段语义

修改已有字段语义属于破坏性变更，必须：

```text
新增 method version；
或新增 methodId；
或在 schemaVersion 中明确区分；
```

### 31.5 废弃字段

废弃字段不得立即复用 fieldId。

建议标记：

```yaml
deprecated: true
removedIn: null
```

---

## 32. 安全与鲁棒性要求

RPC Parser 必须满足：

```text
1. bodyLen 不得超过 Frame.payloadLength；
2. TLV length 不得越界；
3. 未知 methodId 必须返回 METHOD_NOT_FOUND；
4. 不支持的 rpcEncoding 必须返回 UNSUPPORTED_ENCODING；
5. 不支持的 rpcOp 必须返回 UNSUPPORTED_RPC_OP；
6. requestId 必须原样返回；
7. Response 必须匹配已有 pending request；
8. Event 不得被当作 Response 处理；
9. 参数校验必须在 handler 调用前完成；
10. 所有整数解析必须显式处理字节序；
11. 不允许直接将网络字节流 reinterpret_cast 为 C++ struct；
12. 对超长 body、重复字段、非法 enum 值必须返回明确错误。
```

---

## 33. 推荐落地顺序

```text
1. 固定 RPC 基础枚举：rpcEncoding / rpcOp / flags / bodyEncoding；
2. 固定 Compact Binary RPC Header；
3. 实现 TLV encoder / decoder；
4. 实现 MethodId / EventId / ErrorCode enum；
5. 实现 JSON methodName <-> methodId 映射；
6. 实现 device.getInfo；
7. 实现 brightness.get / brightness.set；
8. 实现 brightness.changed event；
9. 实现 capability.getAll；
10. 实现 firmware.begin 与 STREAM OTA 协作；
11. 加入 legacy CmdValue 映射；
12. 生成测试向量；
13. 接入 C++ Demo；
14. 再扩展 Batch / CBOR / CANCEL。
```

---

## 34. 总结

AXTP RPC 子协议的核心设计是：

```text
PayloadType 保持极简：只有 RPC；
RPC 内部通过 rpcEncoding 区分 JSON / BINARY / CBOR；
JSON 和 Binary 共享同一套 Method/Event/Error/Capability Registry；
methodName 映射为 methodId；
eventName 映射为 eventId；
params/result/eventData 映射为 body；
低带宽优先使用 Compact Binary RPC + TLV Body；
旧协议 CmdValue 可通过 legacy mapping 平滑迁移；
Generator 以 registry/schema 为单一事实源生成代码和文档。
```

最终目标不是只定义一种 RPC 报文格式，而是建立一条可落地链路：

```text
Registry YAML
  ↓
Generator v1
  ↓
C++ enum / descriptor / encoder / decoder
  ↓
DS-RPC Text Demo
  ↓
Binary-RPC Demo
  ↓
老协议兼容层
  ↓
真实设备通信
```
