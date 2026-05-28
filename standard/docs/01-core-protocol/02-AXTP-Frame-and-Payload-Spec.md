# 02《AXTP Frame and Payload Spec》

> Status: AXTP v1 Core Freeze Candidate
> Spec Version: 1.0.0-rc1
> Change Policy: Clarification-only before v1.0.0
> Scope: Core wire format / state machine / compatibility rules

版本：v1.0.0-rc1
状态：AXTP v1 Core Freeze Candidate
适用范围：AXTP Frame Layer、Frame Profile、PayloadType、分片、校验、会话生命周期、版本策略
前置文档：01《AXTP Protocol Framework》
后续文档：03《AXTP Transport Profiles》、04《AXTP Control Session Spec》、05《AXTP RPC Session Spec》、06《AXTP Stream Spec》

---

## 1. 文档目的

本文档定义 AXTP Frame 层的协议结构，包括：

- Standard / Compact 两种 Frame Profile 的字段定义
- PayloadType 三分类：CONTROL / RPC / STREAM
- MessageId、Fragment、CRC 的语义
- Session 建立、恢复、关闭的基本流程
- 协议版本、扩展、兼容策略
- MVP 阶段必须实现的最小协议能力

CONTROL / RPC / STREAM 的 Payload 内部结构、TLV Schema、Registry、老协议适配、Generator 均由后续独立文档定义。

---

## 2. 协议分层

```text
+--------------------------------------------------+
| Business Layer                                   |
| device / display / video / firmware / stream ... |
+--------------------------------------------------+
| Registry Layer                                   |
| Method / Event / Error / Capability              |
+--------------------------------------------------+
| Payload Layer                                    |
| CONTROL / RPC / STREAM                           |
+--------------------------------------------------+
| AXTP Frame Layer                                 |
| Header / Length / MessageId / Fragment / CRC     |
+--------------------------------------------------+
| Transport Layer                                  |
| BLE / HID / UART / TCP / WebSocket / USB Bulk    |
+--------------------------------------------------+
```

| 层级 | 职责 | 不应该做的事 |
|---|---|---|
| Transport | 字节传输、连接、MTU | 不理解 AXTP 业务语义 |
| AXTP Frame | 帧头、长度、PayloadType、分片、CRC | 不理解 methodId / streamProfile |
| Payload | 根据 PayloadType 解析 CONTROL / RPC / STREAM | 不直接管理底层传输 |
| Registry | 定义 Method / Event / Error / Capability | 不定义 Frame Header |
| Business | 实现具体设备业务 | 不直接操作 Frame 字段 |

---

## 3. 术语定义

| 术语 | 含义 |
| --- | --- |
| Frame | AXTP 最小传输帧，由 Header、Payload、可选 Footer 组成 |
| Message | 一次完整逻辑消息，可由一个或多个 Frame 组成 |
| PayloadType | 选择一级 Payload Parser 的字段，只能是 CONTROL / RPC / STREAM |
| Fragment | Message 超过单帧容量时产生的分片 |
| MessageId | 标识一次完整 Message 的 ID，同一 Message 的所有 Fragment 共享 |
| Session | 逻辑通信会话，由 CONTROL OPEN / ACCEPT 建立 |

### 3.1 错误码术语区分

协议中有三个含义不同的"状态码"字段，不得混用：

| 字段名 | 所在层 | 类型 | 说明 |
| --- | --- | --- | --- |
| `statusCode` | Control 固定头 | uint16 | Control 操作结果，来自 ErrorCode Registry，`0x0000 = SUCCESS` |
| `reasonCode` | Control TLV `0x10` | uint16 | CLOSE / SESSION_RESET 的关闭原因，来自 CLOSE reasonCode 枚举 |
| `status.code` | RPC JSON 响应 | uint32 | RPC 方法调用结果，来自 ErrorCode Registry，`0 = SUCCESS` |

三者均来自同一个 ErrorCode Registry，但字段名、位置和宽度不同。文档叙述中统一使用上述字段名，不得写成 `errorCode`。

---

## 4. 协议模式

### 4.1 Framed Mode

使用 AXTP Frame Header，适用于 BLE、USB HID、UART、TCP、WebSocket Binary、USB Bulk。支持 CONTROL / RPC / STREAM、分片、CRC、ACK/NACK。

### 4.2 Unframed Mode

不使用 AXTP Frame Header，适用于 WebSocket Text、HTTP Debug API。只承载 DS-RPC Text Profile，不支持 STREAM、分片、CRC、ACK/NACK。

同一条连接不得同时使用两种模式。AXTP v1 的正式生产路径是 Framed Mode；WebSocket Text / HTTP JSON 只作为 Debug 或 Legacy Adapter。

---

## 5. PayloadType

AXTP v1 固定三种 PayloadType：

| ID | 名称 | 作用 |
|---:|---|---|
| `0x01` | `CONTROL` | 协议运行时信令（OPEN、ACK、NACK、HEARTBEAT、RESUME、CLOSE） |
| `0x02` | `RPC` | 结构化业务控制面（request、response、event、batch） |
| `0x03` | `STREAM` | 连续数据 / 大块数据面（video frame、OTA chunk、file chunk） |

PayloadType 只负责选择一级 Payload Parser，不表达具体业务类型。以下用法是错误的：

```text
// 错误
payloadType = VIDEO / OTA / FILE / BRIGHTNESS

// 正确
payloadType = RPC,    methodId = display.setBrightness
payloadType = RPC,    methodId = firmware.begin
payloadType = STREAM, streamId = firmware.begin 返回的流通道 ID
```

`streamProfile`、`mediaType`、`fileType` 等业务语义只能出现在 RPC 建流参数或 Registry 的 Stream Profile 定义中，不得出现在 Frame Header 或 STREAM L2 Header 中。

| 业务行为 | PayloadType |
|---|---|
| 建连、心跳、ACK、NACK | CONTROL |
| 设备信息查询、设置亮度、视频参数设置、业务事件上报 | RPC |
| 视频帧、音频帧、文件块、OTA chunk、实时日志 | STREAM |

---

## 6. Frame Profile

AXTP v1 定义两种 Frame Profile：

- `STANDARD_FRAME = STANDARD_L1 + STANDARD_L2`
- `COMPACT_FRAME = COMPACT_L1 + COMPACT_L2`

Transport Profile 固定决定 Frame Profile；同一个 AXTP Session 内 Frame Profile 不切换。AXTP v1 不支持运行时 Header Profile 协商，也不支持 `STANDARD_L1 + COMPACT_L2` 或 `COMPACT_L1 + STANDARD_L2` 混搭。如需使用其他 Frame Profile，必须选择其他 Transport Profile 或重新 OPEN。

| 字段 | Standard | Compact | 说明 |
|---|---|---|---|
| Magic | 2B `0x41 0x58`（`AX`） | 无 | Compact 依赖底层传输帧边界 |
| Version | 1B uint8 | 高 4 bit（in VT） | |
| PayloadType | 1B enum | 低 4 bit（in VT） | |
| PayloadLength | 2B uint16（最大 65535B） | 1B uint8（最大 255B） | |
| SourceId | 1B uint8 | 无 | Compact 点对点，无需路由 |
| DestinationId | 1B uint8 | 无 | |
| MessageId | 2B uint16 | 1B uint8 | |
| FrameIndex | 1B uint8（最大 254） | 高 4 bit（最大 15） | |
| FrameCount | 1B uint8（最大 255） | 低 4 bit（最大 15） | |
| **Header 合计** | **12B** | **4B** | |
| CRC | CRC16-CCITT-FALSE（2B Footer） | CRC8-MAXIM（1B Footer） | |
| **总帧开销** | **14B** | **5B** | |

两种 Profile 均不包含 Flags 字段。ACK 模式在 OPEN 协商中确定；压缩/加密在 OPEN 协商中表达；这些信息不需要 per-frame 标志位。

**L2 Payload Header 与 Frame Profile 的关系：**

- **Control Payload**：统一 5B 固定头（opcode/controlId/statusCode + TLV body），不区分 Standard/Compact，所有传输场景共用同一结构
- **RPC Binary Payload**：统一 11B 固定头，不区分 Standard/Compact
- **STREAM Payload**：统一 16B 固定头，不区分 Standard/Compact，不在 RPC 建流阶段协商 Header 长度

**Frame Profile 选择原则：**

| 场景 | 推荐 Frame Profile |
|---|---|
| TCP / WebSocket Binary / USB Bulk / 网关 | Standard |
| BLE GATT / UART 点对点 / MCU 内存极小 | Compact |
| USB HID Report | HID-64 使用 Compact；HID High Speed 可定义独立 Standard Transport Profile |

---

## 7. Standard Header 规范

### 7.1 字节布局

```text
Offset  0: Magic[0](1)  Magic[1](1)  Version(1)  PayloadType(1)
Offset  4: PayloadLength(2)  SourceId(1)  DestinationId(1)
Offset  8: MessageId(2)  FrameIndex(1)  FrameCount(1)
Offset 12: Payload starts
Footer:    CRC16(2)，位于 Payload 末尾
```

### 7.2 字段表

| 字段 | 偏移 | 长度 | 类型 | 说明 |
|---|---:|---:|---|---|
| `Magic[0]` | 0 | 1B | uint8 | 固定 `0x41`（ASCII `A`） |
| `Magic[1]` | 1 | 1B | uint8 | 固定 `0x58`（ASCII `X`） |
| `Version` | 2 | 1B | uint8 | Header 解析版本，当前 `0x01` |
| `PayloadType` | 3 | 1B | enum | CONTROL=0x01 / RPC=0x02 / STREAM=0x03 |
| `PayloadLength` | 4 | 2B | uint16 | Payload 字节数，不含 Header 和 CRC |
| `SourceId` | 6 | 1B | uint8 | 源逻辑节点 |
| `DestinationId` | 7 | 1B | uint8 | 目标逻辑节点 |
| `MessageId` | 8 | 2B | uint16 | 逻辑 Message ID |
| `FrameIndex` | 10 | 1B | uint8 | 当前分片序号，从 0 开始 |
| `FrameCount` | 11 | 1B | uint8 | 分片总数，未分片时为 1 |
| `CRC16` | — | 2B | uint16 | Footer，覆盖 Header(12B) + Payload |

### 7.3 Magic

固定 `0x41 0x58`（ASCII `AX`），用于 TCP 字节流帧同步。接收端在 WAIT_MAGIC 状态下先等待 `0x41`，再确认 `0x58`，否则继续扫描。

### 7.4 Version

表示 Header 固定解析规则。v1 Header 固定 12B，解析器根据 Version 值确定 Header 长度。

Version 只在以下情况升级：Header 字段顺序/长度/语义不兼容变化，或 PayloadType 编码规则变化。新增 methodId / eventId / Stream Profile / TLV 字段等属于 Registry 或 Payload 内部扩展，不需要升级 Version。

接收端收到未知 Version 时，必须返回 `UNSUPPORTED_VERSION` 并拒绝该帧。版本协商在 OPEN 阶段完成：

```text
Client OPEN: supportedVersions = [0x01, 0x02]
Server ACCEPT: selectedVersion = 0x01  ← 取双方最高公共版本
```

### 7.5 SourceId / DestinationId

表示 AXTP 逻辑端点，不等同于 IP、MAC、USB 地址。MVP 点对点链路可固定 `SourceId=0x01, DestinationId=0x10`。`0xFF` 为广播地址。Compact Profile 不包含这两个字段。

### 7.6 MessageId

标识一次完整逻辑 Message（uint16）。规则：

- 未分片 Message 也必须有 MessageId
- 同一 Message 的所有 Fragment 必须共享同一 MessageId
- Request / Response 匹配依赖 RPC requestId，不依赖 MessageId
- MessageId 可循环使用，但未完成 Message 不得复用

### 7.7 FrameIndex / FrameCount

未分片时：`FrameIndex=0, FrameCount=1`。分片时：`FrameIndex` 从 0 递增到 `FrameCount-1`，最大 255 片。接收方必须检查 `FrameIndex < FrameCount`，否则视为非法分片。

---

## 8. Compact Header 规范

### 8.1 字节布局

```text
Offset  0: VT(1)            高4bit=Version，低4bit=PayloadType
Offset  1: PayloadLength(1)  uint8，最大 255B
Offset  2: MessageId(1)      uint8
Offset  3: FrameInfo(1)      高4bit=FrameIndex，低4bit=FrameCount
Offset  4: Payload starts
Footer:    CRC8(1)，位于 Payload 末尾
```

### 8.2 字段表

| 字段 | 偏移 | 长度 | 类型 | 说明 |
|---|---:|---:|---|---|
| `VT` | 0 | 1B | bitfield | 高 4 bit = Version，低 4 bit = PayloadType |
| `PayloadLength` | 1 | 1B | uint8 | Payload 字节数，最大 255B |
| `MessageId` | 2 | 1B | uint8 | 逻辑 Message ID |
| `FrameInfo` | 3 | 1B | bitfield | 高 4 bit = FrameIndex，低 4 bit = FrameCount |
| `CRC8` | — | 1B | uint8 | Footer，覆盖 Header(4B) + Payload |

### 8.3 VT 字段示例

```text
Version=1, PayloadType=RPC(0x02)    → VT = 0x12
Version=1, PayloadType=STREAM(0x03) → VT = 0x13
```

### 8.4 FrameInfo 字段示例

```text
未分片:         FrameInfo = 0x01  // FrameIndex=0, FrameCount=1
分片共3片第1片: FrameInfo = 0x03
分片共3片第2片: FrameInfo = 0x13
分片共3片第3片: FrameInfo = 0x23
```

### 8.5 Compact Profile 无 Magic 的原因

Compact 的主要目标链路（HID Report、BLE ATT、固定 MCU packet）均有固定帧边界，无需扫描字节流找帧头。1B Magic 只能把误触发概率降到 1/256，收益有限，却会把总开销从 5B 提升到 6B。Compact 已有 CRC8 覆盖 Header + Payload，可检测绝大多数短帧误收。

如果底层传输没有天然帧边界（如 UART raw stream），应使用 Standard Profile，或在传输适配层增加 COBS / SLIP / length-prefix 等 framing，再承载 Compact Frame。

---

## 9. 字节序与基础编码约定

AXTP 所有层的多字节整数统一采用 **Little-Endian**。

```text
uint16 0x1234 → 34 12
uint32 0x12345678 → 78 56 34 12
```

原因：目标平台（ARM Cortex-M、x86、Android）均为 Little-Endian，BLE ATT / USB HID / USB Bulk 等目标传输层也是 Little-Endian，避免每次收发做字节序转换。

旧协议适配层如使用 Big-Endian，必须在边界处完成字节序转换，不得将 Big-Endian 字节流直接交给 AXTP Parser。

Payload 内部字符串统一使用 UTF-8。Reserved 字段：发送方必须置 0，接收方必须忽略未知位。

---

## 10. CRC 与完整性校验

| Profile | 算法 | Footer | 覆盖范围 |
|---|---|---|---|
| Standard | CRC16-CCITT-FALSE（Poly=0x1021, Init=0xFFFF） | 2B | Header(12B) + Payload |
| Compact | CRC8-MAXIM（Poly=0x31, Init=0x00, Reflected） | 1B | Header(4B) + Payload |

CRC 不覆盖自身及底层传输头（HID Report ID、BLE ATT Header、TCP Length Prefix）。

接收方发现 CRC 错误时：丢弃该 Frame；如能识别 MessageId，可发送 CONTROL NACK；不得将错误 Payload 交给上层 Parser。

对于需要端到端完整性保证的业务对象（OTA 固件、文件传输），应在 RPC 建流参数中声明 `hashAlgo = sha256 / crc32`，由业务层校验整体数据完整性。Frame 层 CRC 只负责单帧传输错误检测。

---

## 11. Message 与 Fragment

### 11.1 Fragment 规则

同一 Message 的所有 Fragment 必须满足：MessageId 相同、PayloadType 相同、FrameCount 相同、FrameIndex 从 0 递增到 FrameCount-1。接收方应在所有 Fragment 到齐后，再将完整 Message Payload 交给 Payload Parser。

### 11.2 Frame Fragment 与业务分块的区别

| 概念 | 层级 | 说明 |
|---|---|---|
| Frame Fragment | Frame 层 | 一个 RPC response 太大，被拆成多个 AXTP Frame |
| STREAM chunk | 业务数据面 | OTA 文件按 4KB 分成多个 chunk，每个 chunk 是一个业务分块 |

两者可以叠加：一个 4KB OTA chunk 如果超过单帧容量，还可以被 Frame Fragment 再拆分。

### 11.3 ID 层级区分

| 字段 | 所属层 | 作用 |
|---|---|---|
| `MessageId` | Frame Layer | 分片重组、ACK/NACK、排错 |
| `requestId` | RPC Payload | RPC Request / Response 匹配 |
| `streamId` | STREAM Payload | 标识一条业务流 |
| `seqId` | STREAM Payload | 标识流内顺序 |

RPC response 必须使用 requestId 匹配 request，不能用 MessageId 替代。

---

## 12. MTU 与最大帧长度

实际单帧长度由 Frame Profile、Transport MTU、PayloadLength 字段宽度、设备内存和 OPEN/ACCEPT 运行参数共同决定。

| 传输 | Profile | 推荐 MaxFrameSize |
|---|---|---:|
| BLE | Compact | 20B / 185B / 247B（取决于 MTU） |
| USB HID | Compact | 64B 或 1024B（取决于 Report Size） |
| UART | Compact | 64B–512B |
| TCP | Standard | 4KB–64KB |
| WebSocket Binary | Standard | 4KB–64KB |
| USB Bulk | Standard | 16KB–64KB |

实际值必须在 CONTROL OPEN / ACCEPT 中协商。v1 单个 Frame 的 `MaxPayloadSize` 不得超过 65535（PayloadLength 为 uint16）。更大的业务对象通过 Frame 分片或 STREAM 业务分块传输。

```text
MaxPayloadSize = MaxFrameSize - HeaderSize - FooterSize - TransportOverhead

Compact + HID 64B Report:
  MaxPayloadSize = 64 - 4 - 1 - 1(ReportID) = 58B

Standard + TCP MTU 1460B:
  MaxPayloadSize = 1460 - 12 - 2 = 1446B
```

---

## 13. Session 生命周期

### 13.1 Session 建立

```text
Transport Connected
    ↓
Client → CONTROL OPEN   （协商 protocolVersion / maxFrameSize /
                          maxPayloadSize / fragmentMode / ackMode /
                          crcMode / windowSize / sessionFlags）
    ↓
Server → CONTROL ACCEPT
    ↓
FRAMING_READY
```

OPEN / ACCEPT 只协商运行参数，不协商 Header Profile。Frame Profile 已由 Transport Profile 固定决定。

### 13.2 Session Ready 后的业务初始化顺序

```text
CONTROL OPEN / ACCEPT
    ↓
RPC Hello（Server → Client）
    ↓
RPC Identify（Client → Server，按需鉴权）
    ↓
RPC Identified（Server → Client）
    ↓
RPC capability.supportedMethods
    ↓
RPC device.getInfo
    ↓
业务命令 / 事件订阅 / Stream 打开
```

### 13.3 Heartbeat

具体间隔由 CONTROL OPEN 协商。参考值：BLE 5–30s，HID/UART 1–5s，TCP/WebSocket 10–60s。

### 13.4 Session 恢复

底层连接短暂断开后，通过 `CONTROL RESUME / RESUME_ACK` 恢复 Session，可携带 sessionId、resumeToken、lastMessageId、streamId、lastSeqId、offset 等字段（详见 Control 文档）。

### 13.5 Session 关闭

```text
正常: Peer A → CONTROL CLOSE → Peer B → CONTROL CLOSE_ACK → Transport Closed
异常: Transport Error / Timeout / CRC Storm / Protocol Violation / Session Reset
```

---

## 14. ACK / NACK 模型

ACK/NACK 统一由 `PayloadType=CONTROL, opcode=ACK/NACK` 承载，可确认 FRAME / MESSAGE / STREAM_CHUNK / CONTROL 等不同层级对象。

MVP 支持两种链路确认模式：`NONE` 和 `MESSAGE_ACK`。后续可扩展 `FRAME_ACK`、`STREAM_CHUNK_ACK`、`SELECTIVE_ACK`。

MVP 推荐：
- CONTROL 重要信令需要 ACK
- RPC 默认 request/response 自带业务确认，Frame 可不强制 ACK
- STREAM OTA / FILE 需要 ACK/NACK 或窗口确认
- MEDIA STREAM 默认不逐帧 ACK

---

## 15. 传输适配原则

| 传输 | Profile | 关键约束 |
|---|---|---|
| BLE | Compact | MTU 小，重连常见，需要 RESUME，使用小 chunk |
| USB HID | Compact | Report Size 固定，可能有 Report ID |
| UART | Compact+framing | 字节流无边界，必须额外定义 COBS/SLIP/length-prefix |
| TCP | Standard | 字节流，接收方按 Header+PayloadLength+CRC 重组 Frame |
| WebSocket Binary | Standard | 建议一个 WS Message 承载一个 AXTP Frame |
| WebSocket Text | 无 Frame | 只承载 DS-RPC Text Profile，不能混入 AXTP Binary Frame |

---

## 16. 错误处理

### 16.1 Frame 层错误码

```text
BAD_MAGIC / UNSUPPORTED_VERSION / UNSUPPORTED_PAYLOAD_TYPE
FRAME_LENGTH_INVALID / FRAME_CRC_ERROR
FRAME_FRAGMENT_INVALID / FRAME_REASSEMBLY_TIMEOUT / FRAME_FRAGMENT_MISSING
```

### 16.2 Payload 层错误

通过 CONTROL NACK、RPC Error Response 或 Stream Error Event 表达，不通过 Header 字段表达。

### 16.3 未知字段处理原则

| 情况 | 处理 |
|---|---|
| 未知 Header Version | 拒绝 |
| 未知 PayloadType | 拒绝 |
| 未知 Control TLV | 忽略 |
| 未知 RPC optional field | 忽略 |
| 未知 methodId | RPC method not found |

---

## 17. 版本与兼容策略

**允许兼容扩展（不升级 Version）：** 新增 methodId / eventId / errorCode / capabilityId / Control opcode / TLV 字段 / Stream Profile / rpcEncoding。

**不兼容变更（必须升级 Version）：** Header 字段长度/顺序变化、PayloadLength 语义变化、PayloadType 编码重定义、CRC 覆盖范围变化。

Registry 应有独立版本（如 `registryVersion = 0.1.0`），与 Header Version 无关。

已发布的 PayloadType、Control opcode、Stream flags bit 不得复用。保留字段发送方必须置 0，接收方应该忽略未知保留扩展。新增 Transport Profile 不得改变既有 Transport Profile 的 wire format；新增 Frame Profile 不得改变既有 Frame Profile 的解析规则。

---

## 18. 安全与资源限制

MVP 阶段可以不实现加密，但必须在 OPEN 协商中保留 encryption capability 字段和 `UNSUPPORTED_ENCRYPTION` 错误码。

接收方必须在校验通过后再分配内存，并限制：

| 参数 | MVP 推荐默认值 |
| --- | --- |
| maxPendingRpc | 8 |
| maxReassemblyMessages | 4 |
| fragmentTimeoutMs | 3000 |
| maxOpenStreams | 2 |
| maxConcurrentMessages（Compact Profile） | 16 |

**Compact Profile 并发限制**：Compact Frame 的 MessageId 为 1B（0-255），同时在途的未完成 Message 数量不得超过 16（推荐），避免 MessageId 空间耗尽导致冲突。

**分片重组超时处理**：`fragmentTimeoutMs` 超时后，接收端必须：

1. 丢弃已收到的所有分片
2. 发送 `CONTROL NACK(FRAME_REASSEMBLY_TIMEOUT)`，携带 `messageId`
3. 等待发送端重传完整 Message

---

## 19. MVP 最小实现要求

必须实现：

```text
Standard Header 编解码 / Compact Header 编解码
PayloadType = CONTROL / RPC / STREAM 的承载能力
PayloadLength 校验 / CRC16 与 CRC8 校验
MessageId 生成 / 未分片 Message 收发 / 基础 Fragment 重组
基础错误码返回 / 基础测试向量
```

> Control Payload 使用统一 5B 固定头，不需要区分 Standard/Compact 实现。

可暂不实现（但规范中必须保留扩展点）：

```text
Compression / Encryption / Sliding Window / 复杂 QoS
多设备路由 / Batch RPC / Stream Selective ACK / 动态 Header Version 升级
```

---

## 20. 最小端到端验证流程

```text
Transport Connected → CONTROL OPEN → CONTROL ACCEPT
    → RPC Hello → RPC Identify → RPC Identified
    → RPC capability.supportedMethods → RPC device.getInfo
    → RPC display.setBrightness → RPC Event display.brightnessChanged
    → RPC firmware.begin → STREAM OTA chunk → CONTROL ACK/NACK
    → RPC firmware.verify → RPC Event firmware.updateCompleted
    → CONTROL CLOSE
```

此流程同时验证：CONTROL 信令、RPC 请求响应、RPC 事件、STREAM 数据面、ACK/NACK、Frame 编解码、CRC、分片、Method/Event/ErrorCode/Capability Registry。

---

## 21. 与后续文档的关系

| 文档 | 负责内容 |
|---|---|
| 02《Control 信令协议规范》 | CONTROL Payload、Opcode、OPEN、ACK/NACK、RESUME、CLOSE |
| 03《RPC 协议与二进制映射规范》 | RPC Payload、JSON/Binary 映射、requestId、methodId、eventId |
| 04《Stream 流式传输协议规范》 | Stream L2 Header、streamId/seqId/cursor、ACK/NACK、窗口、断点续传 |
| 05《连接场景与调用流程规范》 | 不同传输组合下的 Wire Profile 选择、建连流程、桥接方式 |
| Type System | 基础类型、字节序、数组、对象、enum、bitmap |
| TLV Schema | TLV 编码、字段 ID、嵌套、扩展长度 |
| Registry | Method / Event / Error / Capability 单一事实源 |
| Compatibility | 老协议 CmdValue / Payload / Error / Capability 映射 |

---

## 22. 规范性要求关键词

| 关键词 | 含义 |
|---|---|
| 必须 | 实现不可省略，否则不兼容 AXTP |
| 应该 | 推荐实现，除非有明确理由 |
| 可以 | 可选能力 |
| 不得 | 禁止行为 |
| MVP | 第一阶段最小可落地实现范围 |
