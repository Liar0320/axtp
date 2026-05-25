# 04《AXTP Stream 流式传输协议规范》

版本：v1.2 Draft  
状态：MVP STREAM 子协议规范（精简版）  
适用范围：`PayloadType = STREAM` 的 Payload 结构、Stream Context、可靠性模型、断点续传、多路复用  
前置文档：01《AXTP 整体协议规范》、02《AXTP Control 信令协议规范》、03《AXTP RPC 协议与二进制映射规范》

---

## 1. 设计目标

AXTP STREAM 提供极简、固定的数据面，承载视频帧、音频帧、OTA 固件块、文件块、实时日志、KVM/HID Raw、传感器采样等高吞吐连续数据。

核心原则：
- STREAM Header 固定 16B，不携带任何业务类型字段
- 业务类型、编码、可靠性等通过 RPC 控制面协商，绑定到 `streamId`
- ACK/NACK/WINDOW_UPDATE 由 `PayloadType = CONTROL` 承载
- L1 Frame 分片与 L2 Stream 业务分块严格分离

---

## 2. 协议分层

```text
Transport
  ↓
AXTP Frame Header (L1): payloadType=STREAM, payloadLength=16+dataLen, messageId/fragment/CRC
  ↓
STREAM Payload Header (L2): streamId / seqId / cursor
  ↓
Stream Data: opaque bytes
```

| 层级 | 负责 | 不负责 |
|---|---|---|
| Frame Header (L1) | 帧边界、长度、分片、CRC | 业务类型、视频参数、OTA 参数 |
| Stream Header (L2) | 流通道、顺序、位置/时间游标 | streamProfile、codec、fileType |
| Stream Data | 真实业务数据 | 通用协议解析 |

---

## 3. STREAM Header Profile

AXTP v1 定义两种 STREAM Header Profile，在 RPC 建流阶段协商，写入 Stream Context。

| Profile | 总长度 | 适用场景 |
| --- | ---: | --- |
| Standard | 16B | TCP / WebSocket Binary / USB Bulk |
| Compact | 8B | BLE / USB HID / UART（低带宽场景） |

### 3.1 Standard STREAM Header（16B）

```text
+------------------+
| streamId:uint32  |  4B
+------------------+
| seqId:uint32     |  4B
+------------------+
| cursor:uint64    |  8B
+------------------+
| data...          |  N
```

| 字段 | 类型 | 长度 | 说明 |
|---|---:|---:|---|
| `streamId` | uint32 | 4B | 流通道 ID，由 RPC 控制面分配 |
| `seqId` | uint32 | 4B | stream 内数据包序号，从 0 开始，uint32 自然回绕 |
| `cursor` | uint64 | 8B | 通用游标，含义由 Stream Context 的 cursorUnit 决定 |

### 3.2 Compact STREAM Header（8B）

```text
+------------------+
| streamId:uint16  |  2B
+------------------+
| seqId:uint16     |  2B
+------------------+
| cursor:uint32    |  4B
+------------------+
| data...          |  N
```

| 字段 | 类型 | 长度 | 说明 |
|---|---:|---:|---|
| `streamId` | uint16 | 2B | 流通道 ID，最大 65534 个并发流（0x0000 保留） |
| `seqId` | uint16 | 2B | stream 内数据包序号，从 0 开始，uint16 自然回绕（接收方必须处理回绕） |
| `cursor` | uint32 | 4B | 通用游标，最大 4GB 偏移（byteOffset）或 4G 微秒（timestampUs） |

**Compact Header 限制：**

- seqId uint16 最大 65535，BLE 163B/chunk 下约 10MB 回绕一次，接收方必须实现回绕检测
- cursor uint32 最大 4GB，适用于 MCU 固件 OTA 和小文件传输；超过 4GB 的传输必须使用 Standard Header
- streamId uint16 最大 65534，点对点场景完全够用

**Compact Header 节省效果：**

| 传输层 | Standard 数据空间 | Compact 数据空间 | 提升 |
| --- | ---: | ---: | ---: |
| BLE (ATT MTU 185B) | 163B | 171B | +5% |
| USB HID (64B Report) | 42B | 50B | +19% |

所有字段 Little-Endian。`payloadLength = headerSize + dataLength`，headerSize 由 Stream Context 的 `streamHeaderProfile` 决定。

### 3.3 Profile 选择与协商

`streamHeaderProfile` 由 Server 在建流 RPC Response 中返回，Client 按返回值解析和发送后续 STREAM 数据包。

Server 选择原则：

- 若协商的 `maxFrameSize ≤ 128B`（BLE/HID 场景）→ 优先返回 `compact`
- 若 `totalSize > 4GB` 或 `expectedSeqCount > 65535` → 必须返回 `standard`
- 其余情况 → 由 Server 根据传输层自行决定

Client 可在建流请求中通过 `preferredStreamHeaderProfile` 字段表达偏好，Server 可忽略。

建流 Response 示例（新增 `streamHeaderProfile` 字段）：

```json
{
  "streamId": 33,
  "profile": "firmware.ota",
  "chunkSize": 50,
  "ackMode": "stop_and_wait",
  "cursorUnit": "byteOffset",
  "streamHeaderProfile": "compact"
}
```

### 3.2 cursor 含义

| 场景 | cursorUnit | cursor 含义 |
|---|---|---|
| 视频/音频/日志/HID | `timestampUs` | 时间戳（微秒） |
| OTA/文件 | `byteOffset` | 字节偏移 |
| 传感器/音频 | `sampleIndex` | 采样序号 |

禁止在 STREAM Header 中新增 `offset`、`timestamp`、`chunkIndex` 等重复字段。

### 3.3 streamId 规则

| 范围 | 说明 |
|---|---|
| `0x00000000` | 保留，不得使用 |
| `0x00000001-0x7FFFFFFF` | 标准动态 streamId |
| `0x80000000-0xEFFFFFFF` | 预留扩展 |
| `0xF0000000-0xFFFFFFFF` | Vendor/Debug 保留 |

streamId 始终由接收数据的一方（流的 Owner）分配，在 RPC Response 或 Event 中返回。发送方不得自行指定 streamId。

---

## 4. Stream Context

Stream Context 是通过 RPC 创建的流描述对象，保存 streamId 的全部业务语义：

```yaml
streamId: 0x00000021
profile: firmware.ota
direction: upload
reliability: reliable
ackMode: stop_and_wait
cursorUnit: byteOffset
chunkSize: 512
totalSize: 1048576
hashAlgo: sha256
```

STREAM 数据包只携带 `streamId/seqId/cursor/data`，通用 StreamParser 按 Stream Context 的 `streamHeaderProfile` 决定解析 8B 还是 16B Header，然后按 streamId 查表投递数据。

### 4.1 Stream Context 生命周期

```text
CREATED → OPENING → OPEN → ACTIVE → DRAINING → CLOSED
```

发送端必须在收到建流 RPC Response（进入 OPEN 状态）后才能发送 STREAM 数据。

接收端非法状态处理：

| 接收端状态 | 收到消息 | 处理 |
|---|---|---|
| `OPENING` | STREAM 数据包 | 缓冲最多 4 包；超出则 NACK(STREAM_NOT_READY) |
| `DRAINING` | 新 STREAM 数据包 | NACK(STREAM_DRAINING) |
| `CLOSED` | 任何 STREAM 数据包 | NACK(STREAM_CLOSED) |
| 任意 | streamId 不存在 | NACK(STREAM_NOT_FOUND) |

### 4.2 建流方式

**方式 A：通用 stream.open**（适用于日志、传感器、厂商私有流）

```json
{ "method": "stream.open", "params": { "profile": "log.realtime", "direction": "download", "reliability": "best_effort", "cursorUnit": "timestampUs" } }
```
响应返回 `{ "streamId": 17, "maxDataSize": 1024, "ackMode": "none" }`。

**方式 B：领域方法隐式建流**（适用于 OTA、文件、视频等）

```json
{ "method": "firmware.begin", "params": { "imageType": "mcu", "totalSize": 1048576, "sha256": "...", "preferredChunkSize": 512 } }
```
响应返回 `{ "streamId": 33, "profile": "firmware.ota", "chunkSize": 512, "ackMode": "stop_and_wait", "cursorUnit": "byteOffset" }`。

---

## 5. Stream Profile Registry

| Profile | cursorUnit | 默认可靠性 | MVP |
|---|---|---|---|
| `firmware.ota` | `byteOffset` | `reliable` | 是 |
| `file.upload` | `byteOffset` | `reliable` | 可选 |
| `file.download` | `byteOffset` | `reliable` | 可选 |
| `log.realtime` | `timestampUs` | `best_effort` | 可选 |
| `media.video` | `timestampUs` | `best_effort` | P1 |
| `media.audio` | `timestampUs`/`sampleIndex` | `best_effort` | P1 |
| `control.hid_raw` | `timestampUs` | `reliable`/`best_effort` | P1 |
| `sensor.sample` | `timestampUs`/`sampleIndex` | `best_effort` | P2 |

---

## 6. 可靠性模型

### 6.1 ackMode

| ackMode | 说明 | 适用场景 |
|---|---|---|
| `none` | 不确认 | 视频、音频、实时传感器 |
| `batch` | 批量确认 | 日志、弱可靠流 |
| `stop_and_wait` | 每包确认 | HID/BLE OTA MVP |
| `sliding_window` | 滑动窗口 | WebSocket/TCP/USB Bulk OTA |
| `selective_repeat` | 选择性重传 | 高带宽文件传输 |

ackMode 在 RPC 建流阶段确定（初始模式）；CONTROL WINDOW_UPDATE 在运行时动态调整窗口（背压）。`stop_and_wait` 等价于 `windowSize=1` 的 `sliding_window`。

### 6.2 ACK（CONTROL）

| 字段 | 类型 | 说明 |
|---|---|---|
| `targetType` | enum | `STREAM` |
| `streamId` | uint32 | 被确认的流 |
| `ackSeqId` | uint32 | 已确认的最大连续 seqId |
| `ackCursor` | uint64 | 已确认的位置 |
| `windowSize` | uint16 | 可选，剩余窗口 |

### 6.3 NACK（CONTROL）

| 字段 | 类型 | 说明 |
|---|---|---|
| `targetType` | enum | `STREAM` |
| `streamId` | uint32 | 目标流 |
| `baseSeqId` | uint32 | 缺失范围起点 |
| `missingRanges` | bytes | 缺失 seqId 范围 |
| `reasonCode` | uint16 | 失败原因 |

**CONTROL NACK vs stream.error 事件：**
- 传输层问题（CRC 错误、seqId 不连续、streamId 不存在）→ CONTROL NACK，触发重传或流控
- 业务层问题（OTA sha256 不匹配、视频帧解码失败、业务处理超时）→ stream.error RPC 事件，触发业务熔断

---

## 7. Frame 分片与 Stream 分块

| 概念 | 层级 | 说明 |
|---|---|---|
| Frame 分片 | L1 | 一个 STREAM Packet 超过 MTU，被拆成多个 Frame |
| Stream 业务分块 | L2 | OTA 固件按 512B 分成多个 STREAM Packet |

接收端必须先完成 L1 Frame 重组，再解析 STREAM Header。

MVP 推荐：OTA/File 的 chunkSize 在建流时根据 MTU 协商，避免频繁触发 Frame 分片。

---

## 8. 各业务场景映射

| 业务 | 控制面 RPC | streamId 来源 | seqId | cursor |
|---|---|---|---|---|
| OTA | `firmware.begin/verify/apply/abort` | firmware.begin response | chunkIndex | byteOffset |
| 文件传输 | `file.beginTransfer/endTransfer` | beginTransfer response | chunkIndex | byteOffset |
| 视频 | `video.startPreview/stopPreview` | startPreview response | frameIndex | timestampUs |
| 音频 | `audio.startStream/stopStream` | startStream response | packetIndex | timestampUs |
| 日志 | `log.startStream/stopStream` | startStream response | packetIndex | timestampUs |
| HID/KVM | `input.openKvm/closeKvm` | openKvm response | reportIndex | timestampUs |
| 传感器 | `sensor.openStream/closeStream` | openStream response | sampleIndex | timestampUs/sampleIndex |

OTA 不应在 STREAM Header 中携带 imageType/totalSize/sha256/chunkCrc32，这些信息由 firmware.begin 或 Stream Context 协商。

---

## 9. 完整性与校验

- Frame CRC（L1）：发现单帧传输错误，覆盖 Frame Header + Payload
- 对象级校验（业务层）：OTA/File 通过 `firmware.begin.sha256` + `firmware.verify` 完成端到端校验
- Chunk 级校验（可选）：通过 CONTROL ACK/NACK 携带 crc，或在 Profile 数据尾部追加 crc32

MVP 推荐：HID/BLE OTA 使用 Compact Frame CRC8 + stop_and_wait ACK + final sha256；WebSocket/TCP OTA 使用 Standard Frame CRC16 + sliding_window ACK + final sha256。

---

## 10. 断点续传

接收端保存：`streamId`, `profile`, `lastSeqId`, `lastCursor`, `objectId`, `hash`, `resumeToken`。

恢复流程：
```text
Transport reconnect
  → CONTROL RESUME(sessionId, resumeToken)
  → CONTROL RESUME_ACK
  → RPC firmware.resume / file.resumeTransfer
  → Response 返回新 streamId 和 nextCursor
  → 发送端从 nextCursor 继续 STREAM
```

MVP 建议：断线后允许重新分配 streamId，业务对象通过 transferId/objectId/resumeToken 识别。

---

## 11. 多路复用

同一 Session 内允许多个并发 stream（如 video + audio + log + OTA）。优先级通过 Stream Context 表达，不写入 STREAM Header。

---

## 12. BLE 传输 MTU 前置检查

BLE 默认 ATT MTU 23B，去除 ATT 头后有效载荷仅 20B，无法容纳 Compact Frame Header(4B) + Compact STREAM Header(8B) + CRC8(1B) = 13B 以上的数据。在 BLE 上使用 STREAM 必须在 CONTROL OPEN 阶段协商 MTU，协商后有效 Payload 空间必须 ≥ 14B（Compact STREAM）或 ≥ 22B（Standard STREAM）。推荐协商至 185B 或 247B（BLE 5.0 DLE）。

| BLE ATT MTU | Standard 可用数据 | Compact 可用数据 | 有效载荷比（Compact） |
| --- | ---: | ---: | ---: |
| 23B（默认） | 不可用 | 不可用 | — |
| 64B | 43B | 51B | 80% |
| 185B | 163B | 171B | 92% |
| 247B | 225B | 233B | 94% |

---

## 13. 编码示例

### 13.1 Standard STREAM Packet（最小）

```text
streamId=1, seqId=0, cursor=0, data=AA BB CC DD

01 00 00 00              // streamId (uint32)
00 00 00 00              // seqId (uint32)
00 00 00 00 00 00 00 00  // cursor (uint64)
AA BB CC DD              // data
```

### 13.2 Standard STREAM Packet（OTA 第 2 个 chunk）

```text
streamId=33, seqId=1, cursor=512, data=firmware[512..1023]

21 00 00 00              // streamId=33
01 00 00 00              // seqId=1
00 02 00 00 00 00 00 00  // cursor=512
[512 bytes firmware data]
```

### 13.3 Compact STREAM Packet（BLE/HID OTA 第 2 个 chunk）

```text
streamId=1, seqId=1, cursor=50, data=firmware[50..99]

01 00        // streamId (uint16)
01 00        // seqId (uint16)
32 00 00 00  // cursor=50 (uint32)
[50 bytes firmware data]
```

---

## 14. Parser 实现要求

解析流程：
```text
parse AXTP Frame Header
  → if payloadType != STREAM: dispatch other parser
  → lookup StreamContext by streamId (peek first 2B or 4B)
  → determine headerSize from streamHeaderProfile (8 or 16)
  → ensure payloadLength >= headerSize
  → read streamId / seqId / cursor per profile
  → data = payload[headerSize:]
  → validate seqId / cursor / window
  → dispatch data to profile handler
```

错误处理：

| 错误 | 处理 |
| --- | --- |
| `payloadLength < headerSize` | 丢弃，CONTROL NACK |
| `streamId = 0` | 丢弃，INVALID_STREAM_ID |
| 未找到 Stream Context | 丢弃，STREAM_NOT_FOUND |
| seqId 重复 | 幂等处理或丢弃 |
| seqId 缺失 | 根据 ackMode 发送 NACK |
| data 超过 maxDataSize | STREAM_PACKET_TOO_LARGE |

---

## 15. 旧协议映射

| 旧字段 | 新位置 |
|---|---|
| `streamType` | RPC Stream Context `profile` |
| `timestamp` | STREAM Header `cursor`（cursorUnit=timestampUs） |
| `flags` | Stream Context / data profile |
| `dataLength` | Frame Header `payloadLength - headerSize`（8 或 16） |
| OTA `offset` | STREAM Header `cursor`（cursorUnit=byteOffset） |
| OTA `totalLength` | `firmware.begin.params.totalSize` |
| OTA `chunkCrc32` | profile trailer 或 CONTROL ACK/NACK |
| Log `level`/`moduleId` | log profile / log data |

---

## 16. MVP 实现范围

| 能力 | 是否必须 |
|---|---|
| `PayloadType = STREAM` | 必须 |
| 16B Standard STREAM Header | 必须 |
| 8B Compact STREAM Header | 必须（BLE/HID 场景） |
| streamHeaderProfile 协商 | 必须 |
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

---

## 17. 版本与兼容策略

STREAM Header 有 Standard（16B）和 Compact（8B）两种 Profile，通过 RPC 建流协商，写入 Stream Context，不得在运行时切换。新增业务流类型只扩展 Stream Profile Registry，不改 Header 结构。
