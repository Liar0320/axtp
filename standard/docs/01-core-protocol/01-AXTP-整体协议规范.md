# 01《AXTP 整体协议规范》

版本：v0.1 Draft  
状态：MVP 协议底座规范  
适用范围：AXTP Frame Layer、Header Profile、PayloadType、分片、校验、会话生命周期、版本策略  
前置文档：00《AXTP 协议总览与落地路线》  
后续文档：02《AXTP Control 信令协议规范》、03《AXTP RPC 协议与二进制映射规范》、04《AXTP Stream 流式传输协议规范》

---

## 1. 文档目的

本文档定义 AXTP（Auditoryworks Transport Protocol）的整体协议结构。

本文档重点规定以下内容：

```text
1. AXTP 的协议分层；
2. AXTP Frame 的职责边界；
3. Standard / Compact 两种 Header Profile；
4. PayloadType 三分类：CONTROL / RPC / STREAM；
5. MessageId、Fragment、CRC 的语义；
6. Session 建立、恢复、关闭的基本流程；
7. AXTP 与不同传输方式的适配原则；
8. 协议版本、扩展、兼容策略；
9. MVP 阶段必须实现的最小协议能力。
```

本文档不展开以下内容的内部字段细节：

```text
CONTROL Payload 内部结构；
RPC Payload 内部结构；
STREAM Payload 内部结构；
TLV Schema 编码；
Method / Event / Error / Capability Registry；
老协议适配映射；
Generator / SDK 实现细节。
```

这些内容由后续独立文档定义。

---

## 2. 设计目标

AXTP 的设计目标是为多种设备传输方式提供统一的帧协议骨架，使 BLE、USB HID、UART、TCP、WebSocket Binary、USB Bulk 等传输可以共享同一套业务协议体系。

### 2.1 统一传输帧结构

不同底层传输可以使用不同 Header Profile，但必须共享相同的核心语义：

```text
PayloadType
PayloadLength
MessageId
Fragment
CRC
```

### 2.2 PayloadType 极简稳定

AXTP v1 只定义三种 PayloadType：

```text
CONTROL
RPC
STREAM
```

不允许把以下业务类型提升为 Frame Header 的 PayloadType：

```text
VIDEO
AUDIO
FILE
OTA
LOG
KVM
BRIGHTNESS
DISPLAY
DIAGNOSTIC
```

这些业务语义必须下沉到 RPC Method、Event、Stream Profile、Metadata 和 Registry 中。

### 2.3 Header 与业务彻底解耦

Frame Header 只负责传输帧级问题：

```text
帧边界
长度
Payload 解析器选择
分片
校验
可选路由
传输行为标志
```

Frame Header 不负责：

```text
业务命令
业务事件
设备能力
音视频编码
OTA 状态
文件类型
亮度值
```

### 2.4 同一业务语义支持 DS-RPC Text 与二进制

AXTP 不把 DS-RPC Text Profile 和 Binary-RPC 设计成两套业务协议。

它们统一归属：

```text
PayloadType = RPC
```

再由 RPC Payload 内部字段区分：

```text
rpcEncoding = JSON / BINARY / CBOR / TLV / FIXED_STRUCT
```

### 2.5 控制面与数据面分离

AXTP 将业务交互分成：

```text
RPC    = 结构化业务控制面
STREAM = 连续数据 / 大块数据 / 高吞吐数据面
```

例如：

```text
firmware.begin       -> RPC
firmware image chunk -> STREAM
firmware.verify      -> RPC

video.setResolution  -> RPC
video frame          -> STREAM

brightness.set       -> RPC
brightness.changed   -> RPC Event
```

---

## 3. 协议分层

AXTP 推荐分层如下：

```text
+--------------------------------------------------+
| Business Layer                                   |
| device / display / brightness / video / ota ...  |
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

各层职责如下：

| 层级 | 职责 | 不应该做的事 |
|---|---|---|
| Transport Layer | 负责字节传输、连接、MTU、Report、Socket | 不理解 AXTP 业务语义 |
| AXTP Frame Layer | 负责帧头、长度、PayloadType、分片、CRC | 不理解 methodId / streamProfile |
| Payload Layer | 根据 PayloadType 解析 CONTROL / RPC / STREAM | 不直接管理底层传输 |
| Registry Layer | 定义 Method / Event / Error / Capability | 不定义 Frame Header |
| Business Layer | 实现具体设备业务 | 不直接操作 Frame 字段 |

---

## 4. 术语定义

| 术语 | 含义 |
|---|---|
| Frame | AXTP 的最小传输帧，由 Header、Payload、可选 Footer 组成 |
| Message | 一次完整的逻辑消息，可以由一个或多个 Frame 组成 |
| Payload | Frame 中由 PayloadType 指定解析器解析的数据区 |
| PayloadType | 选择一级 Payload Parser 的字段，只能是 CONTROL / RPC / STREAM |
| Header Profile | Header 布局类型，例如 Standard Profile 和 Compact Profile |
| Fragment | 当一个 Message 超过单个 Frame 容量时产生的分片 |
| MessageId | 标识一次完整 Message 的 ID，同一 Message 的所有 Fragment 共享同一 MessageId |
| FrameIndex | 当前分片序号 |
| FrameCount | 分片总数 |
| CRC | Frame 级完整性校验 |
| Session | 逻辑通信会话，由 CONTROL HELLO / HELLO_ACK 建立 |
| Control Plane | 协议运行时控制面，使用 PayloadType = CONTROL |
| RPC Plane | 业务控制面，使用 PayloadType = RPC |
| Stream Plane | 业务数据面，使用 PayloadType = STREAM |

---

## 5. 协议模式

AXTP 支持两类运行模式：

```text
Framed Mode
Unframed Mode
```

### 5.1 Framed Mode

Framed Mode 使用 AXTP Frame Header。

适用传输：

```text
BLE
USB HID
UART
TCP
WebSocket Binary
USB Bulk
本地 Mock Binary Transport
```

特点：

```text
有统一 Header
有 PayloadType
可支持分片
可支持 CRC
可支持 ACK / NACK
可支持 CONTROL / RPC / STREAM
```

### 5.2 Unframed Mode

Unframed Mode 不使用 AXTP Frame Header。

适用传输：

```text
WebSocket Text
HTTP Debug API
本地调试工具
```

推荐用途：

```text
调试
浏览器工具
快速验证 DS-RPC Text Profile
开发阶段抓包
```

Unframed Mode 只能直接承载 DS-RPC Text Profile 语义，不承载 AXTP Frame Header。

在 Unframed Mode 中：

```text
没有 AXTP Header
没有 Frame-level CRC
没有 Frame Fragment
没有 PayloadType 字段
```

如果需要 STREAM、分片、CRC、ACK/NACK，必须使用 Framed Mode。

---

## 6. Header Profile

AXTP v1 定义两种 Header Profile：

```text
Standard Profile  — 12B Header + CRC16(2B) Footer
Compact Profile   — 4B Header  + CRC8(1B)  Footer
```

### 6.0 两种 Profile 完整对比

| 字段 | Standard | Compact | 说明 |
| --- | --- | --- | --- |
| Magic | 2B `0x41 0x58`（ASCII `AX`） | 无 | Compact 依赖底层传输帧边界（HID Report / BLE ATT） |
| Version | 1B uint8 | 高 4 bit（in VT） | Standard 独立字段；Compact 与 PayloadType 合并 |
| Flags | 无 | 无 | v1 两个 Profile 均无 Flags |
| PayloadType | 1B enum | 低 4 bit（in VT） | |
| PayloadLength | 2B uint16（最大 65535B） | 1B uint8（最大 255B） | |
| SourceId | 1B uint8 | 无 | Compact 点对点，无需路由 |
| DestinationId | 1B uint8 | 无 | |
| MessageId | 2B uint16 | 1B uint8 | |
| FrameIndex | 1B uint8（最大 254） | 高 4 bit（最大 15） | |
| FrameCount | 1B uint8（最大 255） | 低 4 bit（最大 15） | |
| **Header 合计** | **12B** | **4B** | |
| CRC | CRC16（2B Footer） | CRC8（1B Footer） | |
| **总帧开销** | **14B** | **5B** | |
| HID 64B 可用 Payload | — | 58B（64-4-1-1 ReportID） | |
| BLE 185B MTU 可用 Payload | — | 179B（185-4-1-1 ATT） | |
| TCP 可用 Payload | 65521B（65535-14） | — | |

**Compact Profile 不包含 Magic 的理由：** HID Report 和 BLE ATT 均有固定帧边界，接收端无需扫描字节流找帧头，Magic 的同步作用在这里没有意义。UART 场景应在传输层使用 COBS/SLIP 编码解决帧边界，而不是依赖 Magic。

### 6.1 Standard Profile

Standard Profile 适用于高带宽或需要路由能力的传输。

推荐用于：

```text
TCP
WebSocket Binary
USB Bulk
网关 / 中继
多设备总线
桌面端工具
```

特点：

```text
字段完整
支持 SourceId / DestinationId
支持完整 uint16 PayloadLength
支持完整 Fragment 字段
便于调试和扩展
```

### 6.2 Compact Profile

Compact Profile 适用于低带宽、固定点对点链路。

推荐用于：

```text
BLE
USB HID
UART
MCU
低功耗设备
固定主从链路
```

特点：

```text
Header 较小
不包含 SourceId / DestinationId
MessageId 较短
FrameIndex / FrameCount 紧凑编码
适合 HID Report 和 BLE MTU
```

### 6.3 Profile 选择原则

| 场景 | 推荐 Profile |
|---|---|
| TCP 直连设备 | Standard |
| WebSocket Binary | Standard |
| USB Bulk | Standard |
| 网关转发多设备 | Standard |
| BLE GATT | Compact |
| USB HID Report | Compact |
| UART 点对点 | Compact |
| MCU 内存极小 | Compact |

---

## 7. 字节序与基础编码约定

### 7.1 字节序

AXTP 所有层（Frame Header、Control Payload、RPC Payload、Stream Header、TLV Body）的多字节整数统一采用：

```text
Little-Endian
```

例如：

```text
uint16 0x1234 -> 34 12
uint32 0x12345678 -> 78 56 34 12
uint64 0x0000000000000400 -> 00 04 00 00 00 00 00 00
```

选择 Little-Endian 的理由：

1. 目标平台（ARM Cortex-M MCU、x86 PC、Android）均为 Little-Endian，避免每次收发做字节序转换；
2. Type System（05 规范）、TLV Schema（06 规范）、Stream Header（04 规范）均已采用 Little-Endian，全局统一；
3. BLE ATT、USB HID、USB Bulk 等目标传输层本身也是 Little-Endian。

如果某旧协议适配层使用 Big-Endian，必须在兼容文档中明确标注，并由适配层在边界处完成字节序转换，不得将 Big-Endian 字节流直接交给 AXTP Parser。

### 7.2 整数类型

AXTP Core Header 中只使用无符号整数：

```text
uint8
uint16
uint32
```

STREAM offset 等大范围字段由 Stream 文档定义，可使用 uint64。

### 7.3 字符串编码

AXTP Core Header 不直接包含字符串。

当 Payload 内部需要字符串时，统一使用：

```text
UTF-8
```

### 7.4 Reserved 字段

所有 Reserved 字段：

```text
发送方必须置 0；
接收方必须忽略未知位；
未来版本可以赋予新语义。
```

---

## 8. PayloadType

### 8.1 PayloadType 定义

AXTP v1 固定三种 PayloadType：

| ID | 名称 | 说明 |
|---:|---|---|
| `0x01` | `CONTROL` | 协议运行时控制信令 |
| `0x02` | `RPC` | 结构化业务请求、响应、事件、Batch |
| `0x03` | `STREAM` | 连续数据、大块数据、高吞吐数据 |

### 8.2 PayloadType 职责

PayloadType 只负责选择一级 Payload Parser：

```text
CONTROL -> ControlParser
RPC     -> RpcParser
STREAM  -> StreamParser
```

PayloadType 不表达具体业务类型。

错误示例：

```text
payloadType = VIDEO
payloadType = OTA
payloadType = FILE
payloadType = BRIGHTNESS
```

正确示例：

```text
payloadType = RPC
methodId = brightness.set

payloadType = RPC
methodId = firmware.begin

payloadType = STREAM
streamId = firmware.begin 返回的流通道 ID

payloadType = STREAM
streamId = video.startPreview 返回的流通道 ID
```

说明：`streamProfile`、`mediaType`、`fileType`、`imageType` 等业务语义只能出现在 RPC 建流参数、RPC 建流响应或 Registry 的 Stream Profile 定义中，不得出现在 Frame Header 或 STREAM L2 Header 中。

### 8.3 PayloadType 与业务域关系

| 业务行为 | PayloadType |
|---|---|
| 建连、心跳、ACK、NACK | CONTROL |
| 设备信息查询 | RPC |
| 设置亮度 | RPC |
| 视频参数设置 | RPC |
| 视频帧 | STREAM |
| 音频帧 | STREAM |
| 文件块 | STREAM |
| OTA chunk | STREAM |
| 实时日志 | STREAM |
| 业务事件上报 | RPC |

---

## 9. Standard Header 规范

### 9.1 Standard Header Layout

Standard Header 固定长度为 12 Bytes，无 Flags 字段。

```text
+--------+--------+--------+--------+
| Magic0 | Magic1 | Ver    | PType  |
+--------+--------+--------+--------+
| PayloadLength   | SrcId  | DstId  |
+--------+--------+--------+--------+
| MessageId       | FrIdx  | FrCnt  |
+--------+--------+--------+--------+
| Payload ...                    |
+--------------------------------+
| CRC16                          |
+--------------------------------+
```

字节布局：

```text
Offset  0: Magic[0](1)  Magic[1](1)  Version(1)  PayloadType(1)
Offset  4: PayloadLength(2)  SourceId(1)  DestinationId(1)
Offset  8: MessageId(2)  FrameIndex(1)  FrameCount(1)
Offset 12: Payload starts
Footer:    CRC16(2)，位于 Payload 末尾
```

v1 Standard Header 不包含 Flags、可变头长度字段或 padding 字节。解析器根据 `Version = 0x01` 固定读取 12B Header。

### 9.2 Standard Header 字段表

| 字段 | 偏移 | 长度 | 类型 | 说明 |
| --- | ---: | ---: | --- | --- |
| `Magic[0]` | 0 | 1B | uint8 | 固定 `0x41`，ASCII `A` |
| `Magic[1]` | 1 | 1B | uint8 | 固定 `0x58`，ASCII `X` |
| `Version` | 2 | 1B | uint8 | Header 解析版本，当前 `0x01` |
| `PayloadType` | 3 | 1B | enum | CONTROL / RPC / STREAM |
| `PayloadLength` | 4 | 2B | uint16 | Payload 字节数，不含 Header 和 CRC，最大 65535B |
| `SourceId` | 6 | 1B | uint8 | 源逻辑节点 |
| `DestinationId` | 7 | 1B | uint8 | 目标逻辑节点 |
| `MessageId` | 8 | 2B | uint16 | 逻辑 Message ID |
| `FrameIndex` | 10 | 1B | uint8 | 当前分片序号，从 0 开始，最大 254 |
| `FrameCount` | 11 | 1B | uint8 | 分片总数，未分片时为 1，最大 255 |
| `CRC16` | — | 2B | uint16 | Frame 校验，位于 Payload 末尾（Footer） |

### 9.3 Magic

`Magic` 为 2 字节，固定值 `0x41 0x58`（ASCII `AX`），用于帧同步和快速识别。

2 字节 Magic 的误触发概率为 1/65536（约 0.0015%），在 TCP 字节流失步恢复时比 1 字节 Magic 更高效。

接收端在 WAIT_MAGIC 状态下：先等待 `0x41`，再确认下一字节是 `0x58`，否则继续扫描。

### 9.4 Version

`Version` 表示 Header 固定解析规则。v1 Header 固定 12B，解析器根据 Version 值确定 Header 长度，不需要额外的头长度字段。

MVP：

```text
Version = 0x01  →  Header 固定 12B
```

**Version 升级规则：**

Version 只在以下情况升级：

```text
Header 字段顺序变化
Header 固定字段长度变化（例如 v2 扩展为 14B）
Header 字段语义不兼容变化
PayloadType 编码规则变化
```

以下情况不需要升级 Version：

```text
新增 methodId / eventId / errorCode / capabilityId
新增 Stream Profile / TLV 字段 / RPC encoding / Control opcode
```

这些属于 Registry 或 Payload 内部扩展。

**版本协商与兼容策略：**

接收端收到未知 Version 时，必须返回 `UNSUPPORTED_VERSION` 并拒绝该帧，不得尝试猜测 Header 长度。

如果未来 v2 需要扩展 Header（例如增加 Priority、QoS 字段），迭代方式如下：

```text
1. 在 HELLO 阶段协商双方支持的 Version 列表：
   Client HELLO: supportedVersions = [0x01, 0x02]
   Server HELLO_ACK: selectedVersion = 0x01  ← 取双方最高公共版本

2. 整个 Session 内统一使用协商后的 Version，不混用。

3. v2 Header 若需要可变长度，必须在 v2 规范中重新定义解析规则；
   v1 接收端看到 Version=0x02 直接拒绝，不会误解析。
```

这样 v1 和 v2 设备可以通过 HELLO 降级协商，互操作不受影响。

### 9.5 PayloadLength

`PayloadLength` 表示当前 Frame 中 Payload 的字节长度，类型为 uint16，最大 65535B。

实际场景中单个 AXTP Frame 的 Payload 通常不超过 4KB。超过 64KB 的数据应通过 STREAM 的 seqId/cursor 机制分块传输，而不是依赖单个 Frame 承载。

不包含：

```text
Header
Footer CRC16
底层传输包头
HID Report ID
BLE ATT Header
TCP Length Prefix
```

接收方必须校验：

```text
实际读取 Payload 字节数 == PayloadLength
```

否则应返回或记录：

```text
FRAME_LENGTH_MISMATCH
```

### 9.6 SourceId / DestinationId

`SourceId` 与 `DestinationId` 表示 AXTP 逻辑端点，不等同于 IP、MAC、USB 地址。

示例：

| ID | 逻辑端点 |
|---:|---|
| `0x01` | PC App |
| `0x02` | Browser App |
| `0x03` | Mobile App |
| `0x10` | Main Device |
| `0x11` | Camera Module |
| `0x12` | Audio Module |
| `0x20` | Gateway |
| `0x7F` | Broadcast / Reserved |

MVP 中，如果是点对点链路，可固定：

```text
SourceId = 0x01
DestinationId = 0x10
```

Compact Profile 不包含这两个字段。

### 9.7 MessageId

`MessageId` 标识一次完整逻辑 Message，类型为 uint16。

规则：

```text
1. 未分片 Message 也必须有 MessageId；
2. 同一 Message 的所有 Fragment 必须共享同一个 MessageId；
3. Request / Response 匹配不依赖 MessageId，而依赖 RPC requestId；
4. MessageId 用于 Frame 层分片重组、ACK/NACK 和排错；
5. MessageId 可循环使用，但未完成 Message 不得复用。
```

uint16 可表示 65535 个并发 Message ID，远超实际并发上限（maxPendingRpc=8，maxReassemblyMessages=4），与 Compact Profile 的 MessageId 宽度统一。

### 9.8 FrameIndex / FrameCount

Standard Profile 中 FrameIndex 和 FrameCount 各占 1B（uint8）。

未分片时：

```text
FrameIndex = 0
FrameCount = 1
```

分片时：

```text
FrameIndex = 0 ... FrameCount - 1
FrameCount > 1，最大 255
```

接收方必须检查：

```text
FrameIndex < FrameCount
```

否则视为非法分片。

**分片上限对比：**

| Profile | FrameIndex | FrameCount | 最大分片数 |
| --- | --- | --- | --- |
| Standard | uint8（1B） | uint8（1B） | 255 |
| Compact | 高 4 bit | 低 4 bit | 15 |

Standard Profile 的 255 片上限在实际场景中已经足够：TCP/WebSocket 上 MTU 通常 4KB+，255 片可覆盖约 1MB 的消息。超过此限制的数据应通过 STREAM 的 seqId/cursor 机制传输，而不是依赖 Frame 分片。

---

## 10. Compact Header 规范

### 10.1 Compact Header Layout

Compact Header 固定长度为 4 Bytes，无 Flags 字段，使用 CRC8 Footer。

```text
+--------+--------+--------+--------+
| VT     | PayLen | MsgId  | FrInfo |
+--------+--------+--------+--------+
| Payload ...                    |
+--------------------------------+
| CRC8                           |
+--------------------------------+
```

字节布局：

```text
Offset  0: VT(1)           高4bit=Version，低4bit=PayloadType
Offset  1: PayloadLength(1) uint8，最大255B
Offset  2: MessageId(1)     uint8
Offset  3: FrameInfo(1)     高4bit=FrameIndex，低4bit=FrameCount
Offset  4: Payload starts
Footer:    CRC8(1)，位于 Payload 末尾
```

### 10.2 Compact Header 字段表

| 字段 | 偏移 | 长度 | 类型 | 说明 |
| --- | ---: | ---: | --- | --- |
| `VT` | 0 | 1B | bitfield | 高 4 bit = Version，低 4 bit = PayloadType |
| `PayloadLength` | 1 | 1B | uint8 | Payload 字节数，不含 Header 和 CRC，最大 255B |
| `MessageId` | 2 | 1B | uint8 | 逻辑 Message ID |
| `FrameInfo` | 3 | 1B | bitfield | 高 4 bit = FrameIndex，低 4 bit = FrameCount |
| `CRC8` | — | 1B | uint8 | Frame 校验，位于 Payload 末尾（Footer） |

### 10.3 VT 字段

```text
VT 高 4 bit = Version（当前 0x1）
VT 低 4 bit = PayloadType
```

示例：

```text
Version = 1，PayloadType = RPC(0x02) → VT = 0x12
Version = 1，PayloadType = STREAM(0x03) → VT = 0x13
```

### 10.4 FrameInfo 字段

```text
FrameInfo 高 4 bit = FrameIndex（0–15）
FrameInfo 低 4 bit = FrameCount（1–15）
```

未分片时：

```text
FrameInfo = 0x01  // FrameIndex=0, FrameCount=1
```

分片示例（共 3 片）：

```text
FrameInfo = 0x03  // 第 1 片
FrameInfo = 0x13  // 第 2 片
FrameInfo = 0x23  // 第 3 片
```

### 10.5 CRC8 算法

Compact Profile 使用 CRC8 替代 CRC16，节省 1B Footer 开销。

推荐算法：

```text
CRC8-MAXIM（也称 CRC8/1-Wire）
Polynomial: 0x31
Initial:    0x00
Reflect In: true
Reflect Out: true
XorOut:     0x00
```

CRC8 覆盖范围：Compact Header（4B）+ Payload。

### 10.6 两个 Profile 完整对比

Standard Profile 用于需要帧同步、路由、较大 Payload 与较高并发的链路；Compact Profile 用于底层已有可靠边界、且每字节开销都敏感的链路。

Compact Profile 相比 Standard Profile，不包含：

```text
Magic（2B）
独立 Version 字段（合并到 VT 高 4 bit）
独立 PayloadType 字段（合并到 VT 低 4 bit）
SourceId / DestinationId
独立 FrameIndex / FrameCount（合并到 FrameInfo）
```

| 字段 | Standard | Compact |
| --- | --- | --- |
| Magic | 2B `0x41 0x58` (`AX`) | 无 |
| Version | 1B | 高 4 bit（in VT） |
| Flags | 无 | 无 |
| PayloadType | 1B | 低 4 bit（in VT） |
| PayloadLength | 2B uint16（最大 65535B） | 1B uint8（最大 255B） |
| SourceId | 1B | 无 |
| DestinationId | 1B | 无 |
| MessageId | 2B uint16 | 1B uint8 |
| FrameIndex | 1B uint8（最大 254） | 高 4 bit（最大 15） |
| FrameCount | 1B uint8（最大 255） | 低 4 bit（最大 15） |
| **Header 合计** | **12B** | **4B** |
| CRC | CRC16（2B Footer） | CRC8（1B Footer） |
| **总开销** | **14B** | **5B** |

HID 64B Report 可用 Payload：`64 - 4 - 1 = 59B`（去掉 HID Report ID 1B 后为 58B）。

### 10.7 Compact Profile 是否需要 Magic

Compact Profile v1 不定义 Magic 字段。

原因：

```text
1. Compact 的主要目标链路是 HID Report、BLE ATT、固定 MCU packet 等已有帧边界的传输；
2. 1B Magic 只能把误触发概率降到 1/256，收益有限；
3. 1B Magic 会把 Compact 总开销从 5B 提升到 6B，在 HID 64B Report 中直接少 1B Payload；
4. Compact 已有 CRC8 覆盖 Header + Payload，可检测绝大多数短帧误收和比特错误；
5. 字节流重同步是 Transport Framing 问题，不应把 Compact Header 重新做成半个 Standard Header。
```

如果底层传输没有天然帧边界，例如 UART raw stream 或 TCP raw stream，有三种合法选择：

```text
1. 使用 Standard Profile，依赖 2B Magic + PayloadLength + CRC16 做同步；
2. 在传输适配层增加 COBS / SLIP / length-prefix 等 framing，再承载 Compact Frame；
3. 定义私有 Transport Preamble，但该 Preamble 不属于 AXTP Compact Header。
```

因此，Compact Profile 的解析入口必须来自底层 packet 边界或传输适配层边界；接收端不得在无边界字节流中仅靠 Compact Header 扫描同步。

### 10.8 Compact Profile 的适用限制

因此它默认适用于：

```text
点对点连接
短消息
低并发
低带宽
有限分片数量
```

如果需要以下能力，应使用 Standard Profile：

```text
多设备路由
中继转发
大量并发 Message
超过 15 个分片的大包（Standard 支持最多 255 片）
需要强抓包自描述 Magic
```

---

## 11. Frame 级行为设计说明

AXTP v1 的 Standard Profile 和 Compact Profile 均不包含 Flags 字段。

**去掉 Flags 的理由：**

- `RESPONSE` / `ERROR`：下沉到 Control Payload 的 statusCode 和 RPC Payload 的 rpcOp，Frame 层不需要重复表达
- `COMPRESSED` / `ENCRYPTED`：属于 Payload 编码方式，在 bodyEncoding 或 HELLO 协商中表达，Frame 层的 1 个 bit 无法携带算法参数
- `NEED_ACK`：通过 HELLO 协商全局 ackMode，或在 Stream Context 中 per-stream 协商，不需要 per-frame 标志
- `EXT_CRC`：CRC 算法在 HELLO 协商时确定，整个 Session 内固定，不需要 per-frame 标志

如果未来需要 per-frame 行为标志，应通过升级 Version 在新版本 Header 中引入，而不是在 v1 中预留占位字节。

---

## 12. Header 扩展策略

AXTP v1 不定义可变头长度字段，也不定义 Frame Extension Header。Standard Header 固定为 12B，Compact Header 固定为 4B。

如果未来需要扩展 Header，例如增加 priority、timestamp、traceId、crc32、extendedAddress、qosHint 等 Frame 级字段，必须通过升级 `Version` 定义新的 Header Profile 解析规则。v1 解析器只需根据 `Version = 0x01` 读取固定长度 Header；遇到未知 Version 应拒绝解析，而不是尝试猜测 Header 长度。

---

## 13. CRC 与完整性校验

### 13.1 CRC 按 Profile 选择

| Profile | CRC 算法 | Footer 大小 | 覆盖范围 |
| --- | --- | --- | --- |
| Standard | CRC16-CCITT-FALSE | 2B | Header(12B) + Payload |
| Compact | CRC8-MAXIM | 1B | Header(4B) + Payload |

CRC 字段均位于 Frame 末尾（Footer），按 AXTP v1 全局 Little-Endian 写入。

不覆盖：

```text
CRC 字段自身
底层传输头（HID Report ID、BLE ATT Header、TCP Length Prefix）
```

### 13.2 CRC16 算法（Standard Profile）

```text
CRC16-CCITT-FALSE
Polynomial: 0x1021
Initial:    0xFFFF
Reflect In: false
Reflect Out: false
XorOut:     0x0000
```

### 13.3 CRC8 算法（Compact Profile）

```text
CRC8-MAXIM（CRC8/1-Wire）
Polynomial: 0x31
Initial:    0x00
Reflect In: true
Reflect Out: true
XorOut:     0x00
```

CRC8 在 HID/BLE 场景下节省 1B Footer 开销，且对 4B Header + 最大 255B Payload 的短帧提供足够的错误检测能力（汉明距离 4，可检测所有 1-3 bit 错误）。

### 13.4 业务层完整性校验

对于需要端到端完整性保证的业务对象（OTA 固件、文件传输），应在 RPC 建流参数或 Stream Context 中声明 `hashAlgo = sha256 / crc32`，由业务层校验整体数据完整性。Frame 层 CRC 只负责单帧传输错误检测。

### 13.5 校验失败处理

接收方发现 CRC 错误时：

```text
1. 丢弃该 Frame；
2. 如果能识别 MessageId / FrameIndex，可发送 CONTROL NACK；
3. 如果无法可靠识别 Header，则只记录错误，不发送 NACK；
4. 不得将错误 Payload 交给上层 Parser。
```

---

## 14. Message 与 Fragment

### 14.1 Message 概念

一个 Message 是一次完整逻辑消息。

例如：

```text
一个 CONTROL HELLO
一个 RPC Request
一个 RPC Response
一个 RPC Event
一个 STREAM chunk
```

如果 Message 超过单帧最大 Payload，则拆分成多个 Frame。

### 14.2 Fragment 规则

同一 Message 的所有 Fragment 必须满足：

```text
MessageId 相同
PayloadType 相同
FrameCount 相同
FrameIndex 从 0 递增到 FrameCount - 1
```

接收方应在所有 Fragment 到齐后，再将完整 Message Payload 交给 Payload Parser。

### 14.3 分片与业务分块的区别

Frame Fragment 是传输层分片。

业务分块是业务数据面分块。

两者不能混淆。

示例：

```text
Frame Fragment:
  一个 RPC response 太大，被拆成 3 个 AXTP Frame。

STREAM chunk:
  OTA 文件按 4KB 分成多个 chunk，每个 chunk 是一个业务分块。

如果某个 4KB OTA chunk 又超过单帧容量，
这个 chunk 本身还可以被 AXTP Frame Fragment 再拆分。
```

### 14.4 MessageId 与 RPC requestId 的区别

| 字段 | 所属层 | 作用 |
|---|---|---|
| `MessageId` | Frame Layer | 分片重组、ACK/NACK、排错 |
| `requestId` | RPC Payload | RPC Request / Response 匹配 |
| `streamId` | STREAM Payload | 标识一条业务流 |
| `seqId` | STREAM Payload | 标识流内顺序 |

规则：

```text
RPC response 必须使用 requestId 匹配 request；
不能用 MessageId 替代 requestId；
STREAM 顺序必须使用 streamId + seqId；
不能用 MessageId 替代 seqId。
```

---

## 15. 最大长度与 MTU 适配

### 15.1 最大 Frame 长度

实际单帧长度由以下因素共同决定：

```text
Header Profile
Transport MTU
PayloadLength 字段宽度
设备内存
协商结果
```

### 15.2 推荐默认值

| 传输 | Profile | 推荐 MaxFrameSize |
|---|---|---:|
| BLE | Compact | 20B / 185B / 247B，取决于 MTU |
| USB HID | Compact | 64B 或 1024B，取决于 Report Size |
| UART | Compact | 64B - 512B |
| TCP | Standard | 4KB - 64KB |
| WebSocket Binary | Standard | 4KB - 64KB |
| USB Bulk | Standard | 16KB - 64KB |

实际值必须在 CONTROL HELLO / HELLO_ACK 中协商。

无论底层传输允许多大的包，v1 单个 Frame 的 `MaxPayloadSize` 都不得超过 `65535`，因为 `PayloadLength` 固定为 `uint16`。更大的业务对象必须通过 Frame 分片或 STREAM 业务分块传输。

### 15.3 MaxPayloadSize

```text
MaxPayloadSize = MaxFrameSize - HeaderSize - FooterSize - TransportOverhead
```

各 Profile 的 Header 大小：

| Profile | HeaderSize | FooterSize | HID 64B Report 可用 Payload |
| --- | --- | --- | --- |
| Standard | 12B | 2B | — |
| Compact | 4B | 1B | 59B（64B - 4B - 1B），若含 1B HID Report ID 则为 58B |

例如 Compact Profile + HID 64B Report：

```text
HeaderSize = 4B
FooterSize = 1B
MaxFrameSize = 64B
MaxPayloadSize = 59B
MaxPayloadSizeWithReportId = 58B
```

例如 Standard Profile + TCP（MTU 1460B）：

```text
HeaderSize = 12B
FooterSize = 2B
MaxFrameSize = 1460B
MaxPayloadSize = 1446B
```

---

## 16. Session 生命周期

AXTP Framed Mode 推荐使用 CONTROL 信令建立 Session。

### 16.1 Session 建立

基本流程：

```text
Transport Connected
    ↓
Client -> CONTROL HELLO
    ↓
Server -> CONTROL HELLO_ACK
    ↓
SESSION READY
```

HELLO 用于协商：

```text
protocolVersion
headerProfile
maxFrameSize
maxPayloadSize
supportedPayloadTypes
supportedRpcEncodings
ackMode
windowSize
heartbeatInterval
```

注意：

```text
HELLO 只协商协议运行时能力；
业务能力和具体 Stream Profile 支持列表通过 RPC capability.* 或 stream.profile.* 查询。
```

### 16.2 Session Ready 后的业务流程

进入 Ready 后，允许发送：

```text
RPC Request
RPC Event
STREAM Data
CONTROL Heartbeat
CONTROL ACK/NACK
```

但建议业务初始化顺序为：

```text
CONTROL HELLO / HELLO_ACK
    ↓
RPC capability.getAll
    ↓
RPC device.getInfo
    ↓
业务命令 / 事件订阅 / Stream 打开
```

### 16.3 Heartbeat

Heartbeat 用于保持 Session 活跃。

推荐：

```text
低功耗 BLE: 5s - 30s
HID / UART: 1s - 5s
TCP / WebSocket: 10s - 60s
```

具体值由 CONTROL HELLO 协商。

### 16.4 Session 恢复

当底层连接短暂断开后，可通过：

```text
CONTROL RESUME
CONTROL RESUME_ACK
```

恢复 Session。

恢复内容可以包括：

```text
sessionId
resumeToken
lastMessageId
streamId
lastSeqId
offset
```

具体字段由 Control 和 Stream 文档定义。

### 16.5 Session 关闭

正常关闭流程：

```text
Peer A -> CONTROL CLOSE
Peer B -> CONTROL CLOSE_ACK
Transport Closed
```

异常关闭：

```text
Transport Error
Timeout
CRC Storm
Protocol Violation
Session Reset
```

---

## 17. ACK / NACK 模型

### 17.1 ACK 所属层

AXTP 的 ACK/NACK 统一由 CONTROL Payload 承载：

```text
PayloadType = CONTROL
opcode = ACK / NACK
```

### 17.2 ACK 目标类型

ACK/NACK 可以确认不同层级对象：

```text
FRAME
MESSAGE
STREAM_CHUNK
CONTROL
```

Frame Header 不表达“需要确认”。是否确认、确认对象和确认粒度都由 CONTROL Payload 与会话协商的 ackMode 表达。

### 17.3 ACK 模式

MVP 支持两种模式：

```text
NO_ACK
ON_DEMAND_ACK
```

后续可扩展：

```text
EVERY_FRAME_ACK
SELECTIVE_ACK
STREAM_CHUNK_ACK
```

### 17.4 MVP 推荐

MVP 推荐：

```text
CONTROL: 重要信令需要 ACK
RPC: 默认 request/response 自带业务确认，Frame 可不强制 ACK
STREAM OTA / FILE: 需要 ACK/NACK 或窗口确认
MEDIA STREAM: 默认不逐帧 ACK，可使用统计事件或 NACK
```

---

## 18. 传输适配原则

### 18.1 BLE

BLE 推荐：

```text
Compact Profile
较小 MaxFrameSize
TLV / Binary RPC
STREAM 使用小 chunk
必要时 Stop-and-Wait
```

约束：

```text
MTU 小
吞吐有限
重连常见
需要 RESUME
```

### 18.2 USB HID

HID 推荐：

```text
Compact Profile
Report 内承载完整或分片 AXTP Frame
保留旧 CmdValue 到 methodId 的映射
```

约束：

```text
Report Size 固定
可能有 Report ID
低层已有消息边界但仍建议保留 AXTP Header
```

### 18.3 UART

UART 推荐：

```text
Standard Profile，或 Compact Profile + 传输层 framing
如果使用 Compact Profile，必须额外定义 COBS / SLIP / length-prefix 等边界机制
强制 Frame CRC
限制最大分片数量
```

约束：

```text
字节流无边界
容易丢字节
需要重同步
```

如果使用 Compact Profile 且无 Magic，UART 应额外定义 Transport Framing 或 COBS/SLIP 类边界编码。

### 18.4 TCP

TCP 推荐：

```text
Standard Profile
可选 Length Prefix
可使用较大 MaxFrameSize
```

注意：

```text
TCP 是字节流，不保留消息边界；
接收方必须按 AXTP Header + PayloadLength + CRC 重组 Frame。
```

### 18.5 WebSocket Binary

WebSocket Binary 推荐：

```text
Standard Profile
一个 WebSocket Binary Message 可以承载一个或多个 AXTP Frame
```

MVP 建议：

```text
一个 WebSocket Binary Message 承载一个 AXTP Frame
```

便于实现和调试。

### 18.6 WebSocket Text

WebSocket Text 不使用 AXTP Frame。

它用于：

```text
DS-RPC Text Profile
```

不能承载 AXTP STREAM 二进制数据。

---

## 19. 错误处理原则

### 19.1 Frame 层错误

Frame 层错误包括：

```text
BAD_MAGIC
UNSUPPORTED_VERSION
UNSUPPORTED_PAYLOAD_TYPE
INVALID_FLAGS
PAYLOAD_LENGTH_MISMATCH
CRC_ERROR
FRAGMENT_OUT_OF_RANGE
FRAGMENT_TIMEOUT
MESSAGE_REASSEMBLY_FAILED
```

Frame 层错误应进入 ErrorCode Registry 的 Frame / Transport 区间。

### 19.2 Payload 层错误

Payload 层错误包括：

```text
CONTROL_OPCODE_UNSUPPORTED
RPC_ENCODING_UNSUPPORTED
RPC_METHOD_NOT_FOUND
STREAM_PROFILE_UNSUPPORTED
STREAM_ID_INVALID
```

Payload 层错误不应通过 Header 字段表达，应通过 CONTROL NACK、RPC Error Response 或 Stream Error Event 表达。

### 19.3 未知字段处理

通用原则：

```text
未知 Header Version: 拒绝
未知 PayloadType: 拒绝
未知 Flag 且非 Reserved: 拒绝或忽略，取决于文档定义
未知 Control TLV: 忽略
未知 RPC optional field: 忽略
未知 Stream Profile 上下文字段: 忽略
未知 methodId: RPC method not found
```

---

## 20. 版本与兼容策略

### 20.1 Version 的边界

AXTP Header Version 只描述 Frame Header 固定解析规则。

Version 不用于表达：

```text
业务版本
设备固件版本
Registry 版本
Capability 版本
Stream 版本
```

这些应通过 RPC 或 Capability 查询。

### 20.2 向后兼容原则

允许兼容扩展：

```text
新增 methodId
新增 eventId
新增 errorCode
新增 capabilityId
新增 Control opcode
新增 TLV 字段
新增 Stream Profile
新增 rpcEncoding
```

不兼容变更：

```text
Header 字段长度变化
Header 字段顺序变化
PayloadLength 语义变化
PayloadType 编码重定义
CRC 覆盖范围变化
```

不兼容变更必须升级 Header Version。

### 20.3 Registry 版本

Registry 应有独立版本，例如：

```text
registryVersion = 0.1.0
```

它不等同于：

```text
Header Version
Protocol Version
Firmware Version
```

---

## 21. 安全与可靠性边界

### 21.1 MVP 安全边界

MVP 阶段可以不实现加密，但必须保留：

```text
ENCRYPTED flag
HELLO 中的 encryption capability
错误码 UNSUPPORTED_ENCRYPTION
```

### 21.2 输入校验

接收方必须校验：

```text
PayloadLength 是否超过协商上限
FrameCount 是否合理
FrameIndex 是否越界
CRC 是否正确
PayloadType 是否支持
Version 是否支持
```

不允许在校验前分配超大内存。

### 21.3 资源限制

实现必须限制：

```text
最大并发 Message 数
最大重组缓存大小
Fragment 超时时间
最大 STREAM 数量
最大 RPC pending request 数量
```

MVP 推荐默认：

```text
maxPendingRpc = 8
maxReassemblyMessages = 4
fragmentTimeoutMs = 3000
maxOpenStreams = 2
```

---

## 22. MVP 最小实现要求

AXTP Core MVP 必须实现：

```text
1. Standard Header 编解码；
2. Compact Header 编解码；
3. PayloadType = CONTROL / RPC / STREAM；
4. 固定 Header 基础解析；
5. PayloadLength 校验；
6. Standard CRC16 与 Compact CRC8 校验；
7. MessageId 生成；
8. 未分片 Message 收发；
9. 基础 Fragment 重组；
10. CONTROL HELLO / HELLO_ACK 的承载能力；
11. RPC Request / Response / Event 的承载能力；
12. STREAM chunk 的承载能力；
13. 基础错误码返回；
14. 基础测试向量。
```

MVP 可以暂不实现：

```text
Compression
Encryption
Sliding Window
复杂 QoS
多设备路由
Batch RPC
Stream Selective ACK
动态 Header Version 升级
```

但这些字段和扩展点必须在规范中保留。

---

## 23. 最小端到端流程

AXTP MVP 应至少跑通以下流程：

```text
Transport Connected
    ↓
CONTROL HELLO
    ↓
CONTROL HELLO_ACK
    ↓
RPC capability.getAll
    ↓
RPC device.getInfo
    ↓
RPC brightness.set
    ↓
RPC Event brightness.changed
    ↓
RPC firmware.begin
    ↓
STREAM OTA chunk
    ↓
CONTROL ACK / NACK
    ↓
RPC firmware.verify
    ↓
RPC Event firmware.updateCompleted
    ↓
CONTROL CLOSE
```

这条链路同时验证：

```text
CONTROL 信令
RPC 请求响应
RPC 事件
STREAM 数据面
ACK/NACK
Method Registry
Event Registry
ErrorCode Registry
Capability Registry
Frame 编解码
CRC
分片
```

---

## 24. 与后续文档的关系

本文档只定义 AXTP Core Frame 层和总体协议边界。

后续文档分工如下：

| 文档 | 负责内容 |
|---|---|
| 02《AXTP Control 信令协议规范》 | CONTROL Payload、Opcode、HELLO、ACK/NACK、RESUME、CLOSE |
| 03《AXTP RPC 协议与二进制映射规范》 | RPC Payload、JSON/Binary 映射、requestId、methodId、eventId |
| 04《AXTP Stream 流式传输协议规范》 | Stream L2 Header（streamId/seqId/cursor）、Stream Context、ACK/NACK、窗口、断点续传 |
| Type System | 基础类型、字节序、数组、对象、enum、bitmap |
| TLV Schema | TLV 编码、字段 ID、嵌套、扩展长度 |
| Registry | Method / Event / Error / Capability 单一事实源 |
| Compatibility | 老协议 CmdValue / Payload / Error / Capability 映射 |
| Generator | 从 Registry / Schema 生成代码和文档 |
| C++ Demo | 最小运行实现和测试样例 |

---

## 25. 实现建议

### 25.1 模块划分

C++ MVP 推荐模块：

```text
axtp_frame.h / .cpp
axtp_standard_header.h / .cpp
axtp_compact_header.h / .cpp
axtp_crc16.h / .cpp
axtp_crc8.h / .cpp
axtp_reassembly.h / .cpp
axtp_transport.h
axtp_control_payload.h / .cpp
axtp_rpc_payload.h / .cpp
axtp_stream_payload.h / .cpp
```

### 25.2 Parser 顺序

推荐接收侧处理顺序：

```text
Read Frame Header
    ↓
Validate Version / PayloadType / PayloadLength
    ↓
Read Payload
    ↓
Validate CRC16
    ↓
Fragment Reassembly
    ↓
Dispatch by PayloadType
    ↓
ControlParser / RpcParser / StreamParser
```

### 25.3 发送顺序

推荐发送侧处理顺序：

```text
Build Payload
    ↓
Select PayloadType
    ↓
Assign MessageId
    ↓
Fragment if needed
    ↓
Build Header
    ↓
Calculate CRC16
    ↓
Send via Transport
```

---

## 26. 规范性要求关键词

本文档使用以下关键词：

| 关键词 | 含义 |
|---|---|
| 必须 | 实现不可省略，否则不兼容 AXTP |
| 应该 | 推荐实现，除非有明确理由 |
| 可以 | 可选能力 |
| 不得 | 禁止行为 |
| MVP | 第一阶段最小可落地实现范围 |

---

## 27. 总结

AXTP 整体协议的核心是：

```text
Frame Header 只做传输帧；
PayloadType 只选 Parser；
CONTROL 管协议运行时；
RPC 管业务控制面；
STREAM 管业务数据面；
业务语义进入 Registry；
代码由 Generator 消费 Registry / Schema 生成。
```

AXTP v1 的 PayloadType 固定为：

```text
0x01 CONTROL
0x02 RPC
0x03 STREAM
```

这是后续 Control、RPC、Stream、Type System、Registry、Compatibility、Generator、C++ Demo 的共同基础。
