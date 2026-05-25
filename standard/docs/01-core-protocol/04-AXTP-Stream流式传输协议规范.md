# 04《AXTP Stream 流式传输协议规范》

版本：v1.1  
状态：MVP / Draft  
适用范围：AXTP v1.x  
文件名：04-AXTP-Stream流式传输协议规范.md

---

## 0. 本次重写说明

本文档基于最新的 STREAM 流式传输方案重新整理。

与上一版相比，本版做出以下关键调整：

1. `PayloadType = STREAM` 不再携带 `streamProfile / mediaType / fileType / otaType` 等业务类型字段。
2. STREAM 数据面统一采用固定 16 Bytes L2 Header。
3. `streamId` 不再只是数据包字段，而是由 RPC 控制面协商出来的“流通道 ID”。
4. 视频、音频、OTA、文件、日志、KVM、Sensor 等业务类型全部在 RPC 控制面完成协商。
5. STREAM 数据面只做高速、连续、低判断成本的数据透传。
6. ACK / NACK / WINDOW_UPDATE 仍由 `PayloadType = CONTROL` 承载。
7. Stream 数据包的业务语义由 `streamId -> Stream Context` 查表决定。
8. Frame 分片与 Stream 业务分块严格分离。

本版的核心思想是：

```text
RPC 控制面负责协商与建流
+
STREAM 数据面负责无脑透传
+
CONTROL 信令面负责可靠性与流控
```

---

## 1. 设计目标

AXTP STREAM 协议用于承载高吞吐、连续性、大块或实时数据。

典型场景包括：

```text
视频帧
音频帧
OTA 固件块
文件块
实时日志
日志归档
KVM / HID Raw
传感器采样流
截图块
厂商私有二进制流
```

STREAM 协议的目标不是表达业务语义，而是提供一个稳定、轻量、低成本的数据面。

设计目标如下：

| 目标 | 说明 |
|---|---|
| 极简数据面 | 每个 STREAM 包只包含必要通道信息、顺序信息和位置/时间信息 |
| 控制面解耦 | 业务类型、编码、大小、可靠性、窗口、校验等通过 RPC 协商 |
| Header 固定 | STREAM L2 Header 固定 16 Bytes，便于 C/C++ 自然对齐 |
| 适合 DMA | Header 为 `4 + 4 + 8` 排列，不需要 `#pragma pack(1)` |
| 适合高吞吐 | 数据面不再解析业务字段，直接按 streamId 投递 |
| 适合低带宽 | BLE/HID 使用 Compact Frame，但 STREAM L2 Header 保持一致 |
| 易实现 | Parser 只需读取 `streamId / seqId / cursor` 三个字段 |
| 易扩展 | 新增视频/日志/OTA/传感器类型只扩展 Stream Profile，不改 Header |

---

## 2. 协议分层

STREAM 位于 AXTP Frame Layer 之上、业务数据之下。

```text
Transport
  ↓
AXTP Frame Header (L1)
  payloadType = STREAM
  payloadLength = 16 + dataLength
  messageId / frameIndex / frameCount
  ↓
STREAM Payload Header (L2)
  streamId
  seqId
  cursor
  ↓
Stream Data
  opaque bytes
```

三层职责如下：

| 层级 | 负责内容 | 不负责内容 |
|---|---|---|
| Frame Header (L1) | 帧边界、长度、分片、CRC、路由、PayloadType | 业务类型、视频参数、OTA 参数 |
| Stream Header (L2) | 流通道、顺序、位置/时间游标 | streamProfile、codec、fileType、chunkCrc |
| Stream Data | 真正业务数据 | 通用协议解析 |

---

## 3. 与 CONTROL / RPC 的关系

AXTP 只有三类 PayloadType：

| PayloadType | 名称 | 职责 |
|---:|---|---|
| `0x01` | `CONTROL` | 协议信令、ACK/NACK、恢复、流控 |
| `0x02` | `RPC` | 业务控制面、查询、配置、事件 |
| `0x03` | `STREAM` | 连续数据、大块数据、高吞吐数据面 |

STREAM 不独立完成建流。

任何 STREAM 数据发送之前，必须先通过 RPC 建立 Stream Context。

典型流程：

```text
CONTROL.OPEN
  ↓
CONTROL.ACCEPT
  ↓
RPC capability.getAll
  ↓
RPC stream.open / video.startPreview / firmware.begin / file.beginTransfer
  ↓
RPC response 返回 streamId
  ↓
STREAM data packets
  ↓
CONTROL ACK / NACK / WINDOW_UPDATE
  ↓
RPC stream.close / firmware.end / file.endTransfer
```

---

## 4. 核心原则

### 4.1 STREAM Header 不表达业务类型

STREAM Header 中不允许出现：

```text
streamProfile
mediaType
fileType
imageType
controlType
codec
logLevel
moduleId
chunkCrc32
```

这些信息必须在 RPC 控制面协商，并绑定到 `streamId`。

错误设计：

```text
STREAM Header:
  streamId
  profile = firmware.ota   // 错误：业务类型不得放入 STREAM Header
  imageType = MCU_FIRMWARE
  seqId
  offset
```

推荐设计：

```text
RPC firmware.begin:
  imageType = MCU_FIRMWARE
  size = 1048576
  hash = ...
  chunkSize = 512

RPC response:
  streamId = 0x00000021

STREAM Packet:
  streamId = 0x00000021
  seqId = 0
  cursor = 0
  data = firmware bytes
```

### 4.2 streamId 是通道，不是类型

`streamId` 是当前 Session 内的逻辑流通道 ID。

它指向一个 Stream Context：

```text
streamId -> Stream Context
```

Stream Context 由 RPC 建立，包含：

```text
业务域：video / audio / firmware / file / log / input / sensor
方向：upload / download / duplex
编码：H264 / OPUS / RAW / UTF8 / binary
可靠性：best-effort / reliable
ACK 模式：none / batch / stop-and-wait / sliding-window
窗口大小：windowSize
游标单位：timestampUs / byteOffset / sampleIndex
最大数据包：maxDataSize
对象大小：totalSize
完整性：sha256 / crc32 / none
```

### 4.3 STREAM 数据面不做方法调用

STREAM 数据包不是 RPC 请求，也不是 RPC 响应。

STREAM 数据包没有：

```text
methodId
requestId
rpcOp
statusCode
bodyEncoding
```

如果需要控制流，应使用 RPC 或 CONTROL。

### 4.4 STREAM 数据面不做业务解析

通用 StreamParser 只解析 16 Bytes Header。

之后根据 `streamId` 找到 Stream Context，然后把 `data` 交给对应业务处理器。

```text
StreamParser
  ↓
read streamId / seqId / cursor
  ↓
lookup StreamContext
  ↓
dispatch data bytes
```

### 4.5 L1 分片与 L2 业务分块必须区分

AXTP Frame 分片用于解决传输 MTU 限制。

STREAM `seqId / cursor` 用于业务流顺序与位置。

二者不能混用。

---

## 5. STREAM Payload 总体结构

当 AXTP Frame Header 中：

```text
payloadType = STREAM
```

Frame Payload 必须解释为：

```text
+-------------------------------+
| STREAM Header (16 Bytes)      |
+-------------------------------+
| Stream Data (N Bytes)         |
+-------------------------------+
```

其中：

```text
payloadLength = 16 + dataLength
```

`dataLength` 不在 STREAM Header 中重复出现，由 L1 Frame Header 的 `payloadLength` 推导得到。

Compact Profile 中 `PayloadLength` 为 uint8，协议层单帧 STREAM data 理论上限为：

```text
maxStreamDataPerFrame = 255 - 16 = 239B
```

实际 HID/BLE/UART 传输还必须同时受底层 MTU、Report 长度、ATT 开销和窗口策略约束。

---

## 6. STREAM Header 固定结构

### 6.1 Header Layout

```text
+----------------+----------------+
| streamId:uint32                 |
+----------------+----------------+
| seqId:uint32                    |
+----------------+----------------+
| cursor:uint64                   |
+---------------------------------+
| data...                         |
+---------------------------------+
```

固定头长度：

```text
16 Bytes
```

### 6.2 字段定义

| 字段 | 类型 | 长度 | 说明 |
|---|---:|---:|---|
| `streamId` | `uint32` | 4B | 流通道 ID，由 RPC 控制面分配 |
| `seqId` | `uint32` | 4B | 当前 stream 内的数据包序号 |
| `cursor` | `uint64` | 8B | 通用游标，含义由 Stream Context 决定 |
| `data` | `bytes` | N | 真实业务数据 |

### 6.3 字节序

所有整数默认使用 AXTP Type System 规定的 Little Endian。

例如：

```text
streamId = 1
seqId    = 2
cursor   = 0x0000000000000400
```

编码为：

```text
01 00 00 00
02 00 00 00
00 04 00 00 00 00 00 00
```

### 6.4 C/C++ 自然对齐

推荐 C++ 定义：

```cpp
struct AxtpStreamHeader {
    uint32_t streamId;
    uint32_t seqId;
    uint64_t cursor;
};
static_assert(sizeof(AxtpStreamHeader) == 16);
```

字段顺序采用 `4 + 4 + 8`，在常见 C/C++ ABI 下自然对齐为 16 Bytes。

实现仍必须注意：

1. 线上字节序固定为 Little Endian。
2. 不应直接把网络字节 memcpy 到结构体后跨平台使用。
3. 解析器应显式读取字段并做 endian 转换。
4. 不应依赖编译器 `#pragma pack(1)`。

---

## 7. 字段语义

### 7.1 streamId

`streamId` 标识当前 Session 内的一条逻辑流。

规则：

| 规则 | 说明 |
|---|---|
| `0x00000000` | 保留，不得用于普通业务流 |
| `0x00000001-0x7FFFFFFF` | 标准动态 streamId |
| `0x80000000-0xEFFFFFFF` | 预留扩展 |
| `0xF0000000-0xFFFFFFFF` | Vendor / Debug 保留 |

MVP 要求：

```text
streamId 必须由接收端或 Stream Owner 分配；
同一 Session 内不得重复使用未关闭的 streamId；
streamId 关闭后，MVP 阶段不建议复用。
```

**streamId 分配方规则：**

| 场景 | 分配方 | 返回方式 |
| --- | --- | --- |
| Client 发起 `stream.open` / `firmware.begin` 等建流 RPC | Server（设备端）分配 | RPC Response 的 `result.streamId` |
| Server 主动推送流（如设备主动上报日志、事件触发的媒体流） | Server（设备端）分配 | RPC Event 的 `eventData.streamId` |
| 双向流（双端均可发送数据） | 发起建流的一方对端分配 | RPC Response 或 Event 中返回 |

规则：

```text
streamId 始终由接收数据的一方（或流的 Owner）分配，发起方不得自行指定 streamId；
分配方在 RPC Response 或 Event 中将 streamId 告知对端；
发送方收到 streamId 后，才可开始发送 STREAM 数据包。
```

### 7.2 seqId

`seqId` 是 stream 内的数据包序号。

规则：

| 规则 | 说明 |
|---|---|
| 起始值 | 默认从 0 开始 |
| 增长方式 | 每发送一个完整 STREAM Packet 加 1 |
| 回绕 | 按 `uint32` 自然回绕 |
| 作用 | 排序、丢包检测、ACK/NACK、重传 |

**seqId 是 per-stream 的，不是全局唯一的。**

不同 streamId 的 STREAM 包可以拥有相同的 seqId 值，这是合法的。接收端必须以 `(streamId, seqId)` 二元组作为唯一标识，而不能仅凭 seqId 区分数据包。

`seqId` 不等于 Frame `messageId`。

| 字段 | 所属层 | 用途 |
|---|---|---|
| `messageId` | L1 Frame | Frame 分片重组 |
| `seqId` | L2 Stream | 业务流数据包顺序 |

### 7.3 cursor

`cursor` 是 64-bit 通用游标。

它的含义由 Stream Context 中的 `cursorUnit` 决定。

| 场景 | cursorUnit | cursor 含义 |
|---|---|---|
| 视频 | `timestampUs` | 帧时间戳 |
| 音频 | `sampleIndex` / `timestampUs` | 音频采样位置或时间戳 |
| OTA | `byteOffset` | 固件镜像字节偏移 |
| 文件上传 | `byteOffset` | 文件字节偏移 |
| 日志 | `timestampUs` | 日志产生时间 |
| HID Raw | `timestampUs` | 输入事件时间 |
| Sensor | `sampleIndex` / `timestampUs` | 采样序号或时间 |

禁止在 STREAM Header 中新增 `offset`、`timestamp`、`chunkIndex` 等重复字段。

如果业务需要这些语义，必须通过 `cursorUnit` 解释 `cursor`。

---

## 8. Stream Context

### 8.1 Stream Context 是什么

Stream Context 是通过 RPC 创建的流描述对象。

它保存 `streamId` 的全部业务语义。

示例：

```yaml
streamId: 0x00000021
domain: firmware
profile: firmware.ota
transferId: 0x00000001
direction: upload
reliability: reliable
ackMode: stop_and_wait
cursorUnit: byteOffset
chunkSize: 512
totalSize: 1048576
hashAlgo: sha256
hash: "..."
```

STREAM 数据包中只携带：

```text
streamId
seqId
cursor
data
```

### 8.2 Stream Context 生命周期

```text
CREATED
  ↓
OPENING
  ↓
OPEN
  ↓
ACTIVE
  ↓
DRAINING
  ↓
CLOSED
```

状态说明：

| 状态 | 说明 |
|---|---|
| `CREATED` | 本地创建待发送 RPC |
| `OPENING` | 建流 RPC 已发出，等待响应 |
| `OPEN` | 已获得 streamId，但尚未传输数据 |
| `ACTIVE` | 正在传输 STREAM 数据 |
| `DRAINING` | 已停止发送，等待 ACK / 完成确认 |
| `CLOSED` | 流关闭，streamId 失效 |

**发送端约束：** 发送端必须在收到建流 RPC 的 Response（即进入 `OPEN` 状态）之后，才能发送第一包 STREAM 数据。在 `OPENING` 状态下不得发送任何 STREAM 数据包。

**接收端非法转换处理规则：**

| 接收端当前状态 | 收到的消息 | 处理方式 |
| --- | --- | --- |
| `OPENING` | STREAM 数据包（RPC Response 尚未到达） | 缓冲最多 4 包等待 RPC Response；超出则丢弃并发送 `NACK(STREAM_NOT_READY)` |
| `OPEN` | STREAM 数据包 | 合法，自动转入 `ACTIVE` 状态 |
| `DRAINING` | 新的 STREAM 数据包 | 发送 `NACK(STREAM_DRAINING)`，拒绝接收 |
| `CLOSED` | 任何 STREAM 数据包 | 发送 `NACK(STREAM_CLOSED)`，丢弃数据 |
| 任意状态 | streamId 不存在的 STREAM 数据包 | 发送 `NACK(STREAM_NOT_FOUND)`，丢弃数据 |

### 8.3 Stream Context 建立方式

AXTP 支持两类建流方式。

#### 方式 A：通用 stream.open

适用于通用文件、日志、传感器、厂商私有流。

```json
{
  "axtp": "1.0",
  "op": "request",
  "id": 1001,
  "method": "stream.open",
  "params": {
    "profile": "log.realtime",
    "direction": "download",
    "reliability": "best_effort",
    "cursorUnit": "timestampUs"
  }
}
```

响应：

```json
{
  "axtp": "1.0",
  "op": "response",
  "id": 1001,
  "method": "stream.open",
  "status": {
    "ok": true,
    "code": 100
  },
  "result": {
    "streamId": 17,
    "maxDataSize": 1024,
    "ackMode": "none"
  }
}
```

#### 方式 B：领域方法隐式建流

适用于业务语义强的方法，例如：

```text
video.startPreview
firmware.begin
file.beginTransfer
log.startStream
input.openKvm
```

例如 OTA：

```json
{
  "axtp": "1.0",
  "op": "request",
  "id": 2001,
  "method": "firmware.begin",
  "params": {
    "imageType": "mcu",
    "totalSize": 1048576,
    "sha256": "...",
    "preferredChunkSize": 512
  }
}
```

响应：

```json
{
  "axtp": "1.0",
  "op": "response",
  "id": 2001,
  "method": "firmware.begin",
  "status": {
    "ok": true,
    "code": 100
  },
  "result": {
    "streamId": 33,
    "profile": "firmware.ota",
    "chunkSize": 512,
    "ackMode": "stop_and_wait",
    "cursorUnit": "byteOffset"
  }
}
```

---

## 9. Stream Profile Registry

虽然 STREAM Header 不携带业务类型，但 Registry 中仍需要维护 Stream Profile。

### 9.1 Profile 命名

推荐命名：

```text
media.video
media.audio
media.av_mixed
file.upload
file.download
firmware.ota
log.realtime
log.bundle
control.hid_raw
sensor.sample
vendor.private
```

### 9.2 MVP Stream Profile

| Profile | 说明 | cursorUnit | 默认可靠性 |
|---|---|---|---|
| `firmware.ota` | OTA 固件块上传 | `byteOffset` | `reliable` |
| `file.upload` | 文件上传 | `byteOffset` | `reliable` |
| `file.download` | 文件下载 | `byteOffset` | `reliable` |
| `log.realtime` | 实时日志 | `timestampUs` | `best_effort` |
| `media.video` | 视频帧 | `timestampUs` | `best_effort` |
| `media.audio` | 音频帧 | `timestampUs` / `sampleIndex` | `best_effort` |
| `control.hid_raw` | HID/KVM 原始输入 | `timestampUs` | `reliable` / `best_effort` |
| `sensor.sample` | 传感器采样 | `timestampUs` / `sampleIndex` | `best_effort` |

---

## 10. 可靠性模型

STREAM 本身不在 Header 中携带 ACK 字段。

可靠性由 Stream Context 决定，确认消息由 CONTROL 承载。

### 10.1 ackMode

| ackMode | 说明 | 适用场景 |
|---|---|---|
| `none` | 不确认 | 视频、音频、实时传感器 |
| `batch` | 批量确认 | 日志、传感器、弱可靠流 |
| `stop_and_wait` | 每包确认 | HID/BLE OTA MVP |
| `sliding_window` | 滑动窗口 | WebSocket/TCP/USB Bulk OTA |
| `selective_repeat` | 选择性重传 | 高带宽文件传输 |

### 10.2 ACK Payload

ACK 使用 `PayloadType = CONTROL`。

推荐 TLV：

| 字段 | 类型 | 说明 |
|---|---|---|
| `targetType` | enum | `STREAM` |
| `streamId` | uint32 | 被确认的流 |
| `ackSeqId` | uint32 | 已确认的最大连续 seqId |
| `ackCursor` | uint64 | 已确认的位置 |
| `windowSize` | uint16 | 可选，剩余窗口 |

### 10.3 NACK Payload

NACK 使用 `PayloadType = CONTROL`。

推荐 TLV：

| 字段 | 类型 | 说明 |
|---|---|---|
| `targetType` | enum | `STREAM` |
| `streamId` | uint32 | 目标流 |
| `baseSeqId` | uint32 | 缺失范围起点 |
| `missingRanges` | bytes | 缺失 seqId 范围 |
| `reasonCode` | uint16 | 失败原因 |

### 10.4 WINDOW_UPDATE

`WINDOW_UPDATE` 也使用 CONTROL。

用于滑动窗口或接收端背压。

推荐字段：

| 字段 | 类型 | 说明 |
|---|---|---|
| `streamId` | uint32 | 流 ID |
| `availableWindow` | uint32 | 当前可接收包数或字节数 |

**ackMode 与 WINDOW_UPDATE 的关系：**

`ackMode` 是 per-stream 的协商结果，在 RPC 建流阶段（`stream.open` / `firmware.begin` 等）确定，决定该流的初始可靠性模式。`WINDOW_UPDATE` 是运行时动态调整机制，在 CONTROL 层发送，可以在流运行过程中扩大或收缩窗口。两者不冲突，分工如下：

| 机制 | 层级 | 时机 | 作用 |
| --- | --- | --- | --- |
| `ackMode` | Stream Context（RPC 协商） | 建流时一次性确定 | 决定初始确认模式和初始窗口语义 |
| `WINDOW_UPDATE` | CONTROL 信令（运行时） | 流运行过程中随时发送 | 动态调整接收窗口大小，实现背压 |

`stop_and_wait` 等价于 `windowSize = 1` 的 `sliding_window`，是其退化形式。接收端可以通过发送 `WINDOW_UPDATE(availableWindow=0)` 暂停发送端，通过 `WINDOW_UPDATE(availableWindow=N)` 恢复，无论 `ackMode` 是何值。
| `ackSeqId` | uint32 | 已接收最大连续 seqId |
| `ackCursor` | uint64 | 已提交位置 |

---

## 11. Frame 分片与 Stream 分块

### 11.1 Frame 分片

Frame 分片属于 L1。

用于将一个完整 STREAM Packet 切分到多个传输帧中。

```text
STREAM Packet = Stream Header + Stream Data
```

如果该 Packet 超过单帧 MTU，则由 Frame Layer 分片。

```text
Frame[0]
  messageId = 100
  frameIndex = 0
  frameCount = 3
  payload = STREAM packet slice 0

Frame[1]
  messageId = 100
  frameIndex = 1
  frameCount = 3
  payload = STREAM packet slice 1

Frame[2]
  messageId = 100
  frameIndex = 2
  frameCount = 3
  payload = STREAM packet slice 2
```

接收端必须先完成 L1 重组，再解析 STREAM Header。

### 11.2 Stream 业务分块

Stream 业务分块属于 L2。

例如 OTA 固件 1MB，每 512B 一个 STREAM Packet：

```text
Packet 0: seqId=0, cursor=0,    data[0..511]
Packet 1: seqId=1, cursor=512,  data[512..1023]
Packet 2: seqId=2, cursor=1024, data[1024..1535]
```

### 11.3 推荐原则

MVP 推荐：

```text
优先让每个 STREAM Packet 不超过单帧可承载大小，
避免频繁触发 Frame 分片。
```

也就是说，OTA/File 的 `chunkSize` 应在建流时根据 MTU 协商得到。

---

## 12. 各业务场景映射

### 12.1 OTA / Firmware

控制面：

```text
firmware.begin
firmware.end
firmware.verify
firmware.apply
firmware.abort
firmware.resume
```

数据面：

```text
PayloadType = STREAM
streamId = firmware.begin 返回值
seqId = chunkIndex
cursor = byteOffset
data = firmware chunk bytes
```

示例：

```text
streamId = 33
seqId    = 0
cursor   = 0
data     = firmware[0..511]
```

OTA 不应在 STREAM Header 中携带：

```text
imageType
totalSize
sha256
chunkCrc32
```

这些信息由 `firmware.begin` 或 Stream Context 协商。

如果需要 per-chunk CRC32，MVP 推荐二选一：

1. 由接收端计算后在 CONTROL ACK/NACK 中反馈。
2. 作为 `firmware.ota` Profile 的业务数据尾部扩展，而不是 STREAM Header 字段。

### 12.2 File Transfer

控制面：

```text
file.beginTransfer
file.endTransfer
file.abortTransfer
file.resumeTransfer
file.verify
```

数据面：

```text
streamId = file.beginTransfer 返回值
seqId = chunkIndex
cursor = byteOffset
data = file bytes
```

### 12.3 Media Video

控制面：

```text
video.startPreview
video.stopPreview
stream.setParams
stream.requestKeyFrame
```

数据面：

```text
streamId = video.startPreview 返回值
seqId = frameIndex
cursor = timestampUs
data = encoded frame bytes
```

关键帧标记不放入 STREAM Header。

推荐方式：

1. 编码格式自身携带关键帧信息，例如 H264/H265 NAL。
2. 必要时使用 media profile 的数据前缀。
3. 通过 RPC `stream.requestKeyFrame` 请求关键帧。

### 12.4 Media Audio

控制面：

```text
audio.startStream
audio.stopStream
```

数据面：

```text
streamId = audio.startStream 返回值
seqId = audio packet index
cursor = timestampUs 或 sampleIndex
data = encoded audio bytes
```

### 12.5 Realtime Log

控制面：

```text
log.startStream
log.stopStream
log.setFilter
```

数据面：

```text
streamId = log.startStream 返回值
seqId = log packet index
cursor = timestampUs
data = log payload bytes
```

日志等级、模块、编码建议通过 `log.startStream` 的 filter/profile 协商，或在 log profile 的业务数据内部表达。

### 12.6 HID Raw / KVM

控制面：

```text
input.openKvm
input.closeKvm
input.setKvmMode
```

数据面：

```text
streamId = input.openKvm 返回值
seqId = report index
cursor = timestampUs
data = HID report bytes
```

### 12.7 Sensor Stream

控制面：

```text
sensor.openStream
sensor.closeStream
sensor.setRate
```

数据面：

```text
streamId = sensor.openStream 返回值
seqId = sample packet index
cursor = timestampUs 或 sampleIndex
data = sensor sample bytes
```

---

## 13. STREAM Flags 的处理策略

本版 STREAM Header 不定义独立 flags 字段。

原因：

1. 固定 16 Bytes Header 更稳定。
2. AXTP v1 Frame Header 也不包含 flags，L1 只负责 framing、length、messageId、fragment 和 CRC。
3. 业务 flags 应由 Stream Profile 或业务数据内部表达。
4. ACK/NACK、错误、流控由 CONTROL 表达。

建议映射：

| 需求 | 推荐位置 |
|---|---|
| 加密 | Session Security / Stream Context |
| 压缩 | bodyEncoding / Stream Context |
| 关键帧 | 编码数据内部 / media profile |
| 最后一块 | RPC end / cursor + totalSize 判断 |
| 需要 ACK | Stream Context ackMode |
| 错误 | CONTROL NACK / RPC error / Event |
| 优先级 | Stream Context |

---

## 14. 完整性与校验

### 14.1 Frame CRC

Frame CRC 属于 L1。

用于发现单帧传输错误。

```text
CRC(Frame Header + Payload)
```

不包含 CRC 字段本身。

### 14.2 Stream 对象级校验

对象级校验属于业务层。

例如 OTA / File：

```text
firmware.begin:
  sha256 = ...

STREAM packets:
  data = chunks

firmware.verify:
  device verifies sha256
```

### 14.3 Chunk 级校验

Chunk 级校验不是 STREAM Header 固定字段。

如确实需要，可以通过以下方式实现：

| 方式 | 说明 |
|---|---|
| CONTROL ACK/NACK 携带 crc | 接收端反馈计算结果 |
| Profile 定义 chunk trailer | data 尾部追加 crc32 |
| Profile 定义 chunk prefix | data 前部追加 chunk header |
| 禁用 chunk crc | 只依赖 Frame CRC + object hash |

MVP 推荐：

```text
HID/BLE OTA：Compact Frame CRC8 + stop_and_wait ACK + final sha256
WebSocket/TCP OTA：Standard Frame CRC16 + sliding_window ACK + final sha256
```

---

## 15. 流控与背压

流控由 CONTROL 承载，不占用 STREAM Header。

### 15.1 基础参数

Stream Context 中应包含：

| 参数 | 说明 |
|---|---|
| `windowSize` | 最大在途 STREAM Packet 数 |
| `maxInFlightBytes` | 最大在途字节数 |
| `maxDataSize` | 单个 STREAM Packet 的 data 最大长度 |
| `ackInterval` | 批量 ACK 间隔 |
| `rateLimit` | 可选，发送速率限制 |

### 15.2 背压流程

```text
Sender sends STREAM packets
  ↓
Receiver buffer near full
  ↓
Receiver sends CONTROL WINDOW_UPDATE availableWindow=0
  ↓
Sender pauses
  ↓
Receiver drains buffer
  ↓
Receiver sends CONTROL WINDOW_UPDATE availableWindow=N
  ↓
Sender resumes
```

---

## 16. 断点续传

断点续传由 RPC + CONTROL 协作完成。

### 16.1 恢复状态

接收端至少需要保存：

| 字段 | 说明 |
|---|---|
| `streamId` | 原 streamId |
| `profile` | stream profile |
| `lastSeqId` | 最后连续接收 seqId |
| `lastCursor` | 最后提交位置 |
| `objectId` | 文件/固件对象 ID |
| `hash` | 对象 hash |
| `resumeToken` | 恢复令牌 |

### 16.2 恢复流程

```text
Transport reconnect
  ↓
CONTROL RESUME(sessionId, resumeToken)
  ↓
CONTROL RESUME_ACK
  ↓
RPC firmware.resume / file.resumeTransfer
  ↓
Response returns new or reused streamId, nextCursor
  ↓
Sender continues STREAM from nextCursor
```

MVP 建议：

```text
断线后允许重新分配 streamId；
业务对象通过 transferId / objectId / resumeToken 识别；
不要依赖旧 streamId 永久有效。
```

---

## 17. 多路复用

AXTP 允许同一 Session 内存在多个并发 stream。

例如：

```text
streamId = 11  media.video
streamId = 12  media.audio
streamId = 21  log.realtime
streamId = 33  firmware.ota
```

调度原则：

| 场景 | 策略 |
|---|---|
| 实时媒体 | 低延迟优先，允许丢包 |
| OTA/File | 可靠优先，允许排队 |
| Log | 低优先级，可丢弃 |
| HID Raw | 低延迟优先 |

优先级不写入 STREAM Header。

优先级通过 Stream Context 表达。

---

## 18. Standard / Compact Profile 适配

### 18.1 Standard Profile

适用于：

```text
WebSocket Binary
TCP
USB Bulk
高带宽 HID
```

使用：

```text
Standard AXTP Frame Header
+
STREAM Header 16B
+
Data
+
CRC16 Footer
```

### 18.2 Compact Profile

适用于：

```text
BLE
USB HID 64B Report
UART
MCU
```

使用：

```text
Compact AXTP Frame Header
+
STREAM Header 16B
+
Data
+
CRC8 Footer
```

本版不再定义独立 Compact Stream Header。

原因：

1. 保持 StreamParser 一致。
2. 避免 Standard / Compact 数据面出现两套语义。
3. 16B Header 对齐稳定，C/C++ 实现简单。
4. BLE/HID 的裁剪应发生在 L1 Frame Header，而不是 L2 Stream Header。

若未来极低带宽场景确实需要进一步压缩，应作为 AXTP v2 或 negotiated extension 处理，不进入 MVP。

**BLE 传输使用 STREAM 的 MTU 前置检查规则：**

BLE 默认 ATT MTU 为 23 字节，去除 ATT 头后有效载荷仅 20 字节，无法容纳 Compact Frame Header（4B）+ STREAM L2 Header（16B）+ CRC8 Footer（1B）= 21 字节，更无法携带任何业务数据。

因此，在 BLE 传输上使用 STREAM 时，必须遵守以下规则：

```text
1. 在 CONTROL OPEN 阶段协商 MTU；
2. 协商后的有效 Payload 空间必须满足：
   可用字节 >= Compact Frame Header(4B) + STREAM L2 Header(16B) + CRC8 Footer(1B) + 最小业务数据长度(建议 1B)
   即 ATT 有效载荷至少 22B；
3. 如果 MTU 协商结果不满足此条件，不得在该连接上开启 STREAM；
   应退回到纯 RPC 模式，或要求对端重新协商更大的 MTU；
4. 推荐在支持 BLE 5.0 DLE 的设备上将 MTU 协商至 185B 或 247B，
   以获得合理的有效载荷比（87%–90%）。
```

BLE MTU 与有效载荷对照：

| BLE ATT MTU | Compact Header (4B) | L2 Stream Header (16B) | CRC8 Footer | 可用数据 | 有效载荷比 |
| --- | --- | --- | --- | --- | --- |
| 23B（默认） | 4B | 16B | 1B | 2B | 9% |
| 64B（DLE 最小） | 4B | 16B | 1B | 43B | 67% |
| 185B（DLE 典型） | 4B | 16B | 1B | 164B | 89% |
| 247B（DLE 最大） | 4B | 16B | 1B | 226B | 91% |

---

## 19. 与旧协议的映射

### 19.1 旧 RawStream

旧结构：

```text
streamId
streamType
seqId
timestamp
flags
dataLength
data
```

映射到 AXTP：

| 旧字段 | 新位置 |
|---|---|
| `streamId` | STREAM Header `streamId` |
| `streamType` | RPC Stream Context `profile` |
| `seqId` | STREAM Header `seqId` |
| `timestamp` | STREAM Header `cursor`，cursorUnit=timestampUs |
| `flags` | Stream Context / data profile |
| `dataLength` | Frame Header `payloadLength - 16` |
| `data` | Stream Data |

### 19.2 旧 Firmware Payload

旧结构：

```text
rpcId
methodId
transferId
seqId
offset
totalLength
chunkLength
chunkCrc32
data
```

映射到 AXTP：

| 旧字段 | 新位置 |
|---|---|
| `rpcId` | RPC `requestId` |
| `methodId` | `firmware.begin/end/verify/apply` |
| `transferId` | Stream Context / firmware result |
| `seqId` | STREAM Header `seqId` |
| `offset` | STREAM Header `cursor` |
| `totalLength` | `firmware.begin.params.totalSize` |
| `chunkLength` | Frame `payloadLength - 16` |
| `chunkCrc32` | profile trailer 或 CONTROL ACK/NACK |
| `data` | Stream Data |

### 19.3 旧 LogStream

旧结构：

```text
streamId
seqId
timestamp
level
moduleId
encoding
messageLength
message
```

映射到 AXTP：

| 旧字段 | 新位置 |
|---|---|
| `streamId` | STREAM Header `streamId` |
| `seqId` | STREAM Header `seqId` |
| `timestamp` | STREAM Header `cursor` |
| `level` | log profile / log data |
| `moduleId` | log profile / log data |
| `encoding` | Stream Context `encoding` |
| `messageLength` | Frame `payloadLength - 16` |
| `message` | Stream Data |

---

## 20. 编码示例

### 20.1 最小 STREAM Packet

语义：

```text
streamId = 1
seqId = 0
cursor = 0
data = AA BB CC DD
```

L2 STREAM Payload：

```text
01 00 00 00   // streamId
00 00 00 00   // seqId
00 00 00 00 00 00 00 00   // cursor
AA BB CC DD   // data
```

### 20.2 OTA 第 2 个 chunk

语义：

```text
streamId = 33
seqId = 1
cursor = 512
data = firmware[512..1023]
```

Header：

```text
21 00 00 00   // streamId = 33
01 00 00 00   // seqId = 1
00 02 00 00 00 00 00 00   // cursor = 512
```

后接 512 Bytes 固件数据。

### 20.3 视频帧

语义：

```text
streamId = 11
seqId = 120
cursor = 1716537600000000  // timestampUs
data = H264 access unit
```

业务类型 H264 不在 STREAM Header 中出现，而由 `video.startPreview` 的响应绑定到 `streamId = 11`。

---

## 21. Parser 实现要求

### 21.1 解析流程

```text
parse AXTP Frame Header
  ↓
if payloadType != STREAM: dispatch other parser
  ↓
ensure payloadLength >= 16
  ↓
read streamId:uint32
read seqId:uint32
read cursor:uint64
  ↓
data = payload[16:]
  ↓
lookup StreamContext by streamId
  ↓
validate seqId / cursor / window
  ↓
dispatch data to profile handler
```

### 21.2 错误处理

| 错误 | 处理 |
|---|---|
| `payloadLength < 16` | 丢弃 Frame，发送 CONTROL NACK |
| `streamId = 0` | 丢弃，返回 INVALID_STREAM_ID |
| 未找到 Stream Context | 丢弃，返回 STREAM_NOT_FOUND |
| seqId 重复 | 幂等处理或丢弃 |
| seqId 缺失 | 根据 ackMode 发送 NACK |
| cursor 非法 | 发送 STREAM_CURSOR_ERROR |
| data 超过 maxDataSize | 发送 STREAM_PACKET_TOO_LARGE |

**CONTROL NACK 与 stream.error 事件的职责边界：**

两者解决不同层级的问题，不得混用：

| 场景 | 使用机制 | 接收端动作 |
| --- | --- | --- |
| Frame CRC 错误 | `CONTROL NACK` | 发送端重传该 Frame |
| seqId 不连续（传输层丢包） | `CONTROL NACK` | 发送端重传对应 STREAM Packet |
| streamId 不存在 | `CONTROL NACK(STREAM_NOT_FOUND)` | 发送端停止该流 |
| Stream Context 状态非法（如 CLOSED 状态收到数据） | `CONTROL NACK(STREAM_CLOSED)` | 发送端停止该流 |
| 接收端内存耗尽，无法继续接收 | `CONTROL NACK` + `WINDOW_UPDATE(availableWindow=0)` | 发送端暂停，等待 WINDOW_UPDATE 恢复 |
| 业务数据校验失败（如 OTA sha256 不匹配） | `stream.error` event（RPC 事件） | 业务层决定是否重试或中止，通过 RPC 关流 |
| 接收端业务处理超时或异常 | `stream.error` event（RPC 事件） | 业务层熔断，通过 RPC 关流 |
| 流内容格式错误（如视频帧解码失败） | `stream.error` event（RPC 事件） | 业务层决定是否跳过或中止 |

原则：**传输层问题用 NACK，业务层问题用 stream.error。** NACK 触发重传或流控，stream.error 触发业务熔断逻辑。

### 21.3 零拷贝建议

C/C++ 实现建议：

1. L1 完成 Frame reassembly 后，不复制 data。
2. StreamParser 只读取前 16B。
3. data 以 `span<uint8_t>` / pointer + length 传给业务处理器。
4. OTA/File 写入可直接从 data buffer 写 flash/file。

---

## 22. Generator v1 影响

Generator v1 不需要为 STREAM Header 生成复杂结构。

必须生成：

```text
Stream Profile Registry constants
Stream Profile descriptor
cursorUnit enum
ackMode enum
reliability enum
stream.open schema
firmware.begin schema
file.beginTransfer schema
log.startStream schema
```

不应生成：

```text
每种业务一套 Stream Header
VideoStreamHeader
OtaStreamHeader
FileStreamHeader
LogStreamHeader
```

通用 C++ 类型：

```cpp
struct AxtpStreamPacketView {
    uint32_t streamId;
    uint32_t seqId;
    uint64_t cursor;
    ByteSpan data;
};
```

---

## 23. C++ Demo v1 要求

C++ Demo v1 必须实现：

```text
StreamHeader encode/decode
StreamContextTable
STREAM Packet dispatch
Stop-and-Wait ACK for OTA
Best-effort log stream
Frame fragment reassembly before Stream parsing
Legacy RawStream adapter
```

最小端到端链路：

```text
CONTROL OPEN
  ↓
RPC firmware.begin
  ↓
STREAM firmware chunk seqId=0 cursor=0
  ↓
CONTROL ACK streamId=... ackSeqId=0
  ↓
STREAM firmware chunk seqId=1 cursor=512
  ↓
CONTROL ACK streamId=... ackSeqId=1
  ↓
RPC firmware.end
  ↓
RPC firmware.verify
  ↓
RPC firmware.apply
```

---

## 24. MVP 实现范围

MVP 必须支持：

| 能力 | 是否必须 |
|---|---|
| `PayloadType = STREAM` | 必须 |
| 16B STREAM Header | 必须 |
| streamId 查表 | 必须 |
| seqId 顺序检测 | 必须 |
| cursor 解析 | 必须 |
| OTA stop-and-wait | 必须 |
| CONTROL ACK/NACK | 必须 |
| Frame 分片重组后再解析 STREAM | 必须 |
| Legacy RawStream 映射 | 建议 |
| Sliding Window | P1 |
| 多路复用调度 | P1 |
| Media Stream | P1 |
| Sensor Stream | P2 |
| Compact Stream Header | 不进入 MVP |

---

## 25. 测试向量建议

至少提供以下测试向量：

1. STREAM Header encode/decode。
2. `payloadLength < 16` 错误。
3. 未知 streamId 错误。
4. OTA seqId 连续接收。
5. OTA seqId 缺失触发 NACK。
6. cursor = byteOffset 的 OTA 写入。
7. cursor = timestampUs 的 log/media 分发。
8. Frame 分片重组后解析 STREAM。
9. 旧 RawStream 转换为新 STREAM Packet。
10. 多 streamId 并发分发。

---

## 26. 验收标准

本规范落地后，应满足：

```text
1. 所有 STREAM 数据包均使用同一个 16B Header。
2. 通用 StreamParser 不需要知道 video/audio/ota/file/log。
3. streamId 可以唯一定位 Stream Context。
4. OTA/File 可通过 seqId + cursor 完成可靠写入与断点续传。
5. 视频/音频/日志可通过 best-effort 模式低成本传输。
6. ACK/NACK/WINDOW_UPDATE 均通过 CONTROL 实现。
7. 新增业务流类型不需要修改 Frame Header 或 Stream Header。
8. 旧 RawStream/Firmware/LogStream 可以通过 Legacy Adapter 映射到新模型。
```

---

## 27. 总结

AXTP STREAM v1.1 的核心是：

```text
PayloadType = STREAM
  ↓
固定 16B Stream Header
  ↓
streamId / seqId / cursor
  ↓
opaque data
```

所有业务差异都下沉到：

```text
RPC 建流参数
Stream Context
Stream Profile Registry
业务数据格式
```

因此，STREAM 数据面不再是“带一堆业务 metadata 的通用容器”，而是一个真正适合高吞吐和硬件实现的极简数据通道。
