# 06《AXTP Stream Spec》

> Status: AXTP v1 Core Freeze Candidate
> Spec Version: 1.0.0-rc1
> Change Policy: Clarification-only before v1.0.0
> Scope: Core wire format / state machine / compatibility rules

版本：v1.0.0-rc1
状态：AXTP v1 Core Freeze Candidate
适用范围：`PayloadType = STREAM` 的 Payload 结构、Stream Context、可靠性模型、断点续传、多路复用
前置文档：01《AXTP Protocol Framework》、02《AXTP Frame and Payload Spec》、04《AXTP Control Session Spec》、05《AXTP RPC Session Spec》

---

## 0. 速读：STREAM 是固定 16B Header + data

STREAM 只存在于 Standard Framed 路径，用来传连续数据。WebSocket Unframed JSON 是 RPC-only，不承载 STREAM。

```text
Standard Frame Header(payloadType=STREAM)
  + STREAM Payload = streamId(4) + seqId(4) + cursor(8) + data(N)
  + CRC16(2)
```

STREAM Header 固定 16B，不携带业务类型、codec、fileType、OTA 参数或视频参数。这些信息由 RPC 控制面建流时确定，并绑定到 `streamId`。

```mermaid
sequenceDiagram
    participant Client as Logical Client
    participant Server as Logical Server

    Client->>Server: RPC open/begin method
    Server-->>Client: RPC response(streamId, profile, cursorUnit, limits)
    Client->>Server: STREAM frame(streamId, seqId, cursor, data)
    Server-->>Client: CONTROL ACK/NACK (when negotiated)
```

三层 ID 不要混用：

| 字段 | 所在层 | 作用 |
|---|---|---|
| `messageId` | Frame Header | Frame 分片与重组 |
| `streamId` | STREAM Header | 已由 RPC 建流绑定的逻辑流 |
| `seqId` | STREAM Header | stream 内数据包顺序 |
| `cursor` | STREAM Header | 时间戳、字节偏移或采样序号，含义由 Stream Context 决定 |

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
| --- |---| --- |
| Frame Header (L1) | 帧边界、长度、分片、CRC | 业务类型、视频参数、OTA 参数 |
| Stream Header (L2) | 流通道、顺序、位置/时间游标 | streamProfile、codec、fileType |
| Stream Data | 真实业务数据 | 通用协议解析 |

---

## 3. STREAM Header

AXTP v1 只有一种 STREAM Header：固定 16B STREAM Header，适用于 Standard Framed 传输（AXTP-USB-HID / AXTP-TCP）。WebSocket Unframed JSON 是 RPC-only 通道，不承载 STREAM。

### 3.1 STREAM Header（16B）

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
| --- |---:|---:| --- |
| `streamId` | uint32 | 4B | 流通道 ID，由 RPC 控制面分配 |
| `seqId` | uint32 | 4B | stream 内数据包序号，从 0 开始，uint32 自然回绕 |
| `cursor` | uint64 | 8B | 通用游标，含义由 Stream Context 的 cursorUnit 决定 |

所有字段 Little-Endian。`payloadLength = 16 + dataLength`。

### 3.2 cursor 含义

| 场景 | cursorUnit | cursor 含义 |
| --- |---| --- |
| 视频/音频/日志/HID | `timestampUs` | 时间戳（微秒） |
| OTA/文件 | `byteOffset` | 字节偏移 |
| 传感器/音频 | `sampleIndex` | 采样序号 |

禁止在 STREAM Header 中新增 `offset`、`timestamp`、`chunkIndex` 等重复字段。

### 3.3 streamId 规则

| 范围 | 说明 |
| --- |---|
| `0x00000000` | 保留，不得使用 |
| `0x00000001-0x7FFFFFFF` | 标准动态 streamId |
| `0x80000000-0xEFFFFFFF` | 预留扩展 |
| `0xF0000000-0xFFFFFFFF` | Vendor/Debug 保留 |

streamId 始终由接收数据的一方（流的 Owner）分配，在 RPC Response 或 Event 中返回。发送方不得自行指定 streamId。

---

## 4. Stream Context

Stream Context 是通过 RPC 创建的流描述对象，**是接收端/发送端的本地运行时状态，不出现在 STREAM 帧 Header 中**。由 RPC 建流 Response 填充，绑定到 `streamId`。

字段分为两类：

**Wire 字段**（出现在 STREAM 帧 Header 中）：`streamId`、`seqId`、`cursor`

**本地字段**（仅存在于 Stream Context，不在 wire 上传输）：

```yaml
streamId: 0x00000021
profile: firmware.ota
direction: upload
reliability: reliable
ackMode: stop_and_wait
cursorUnit: byteOffset
chunkSize: 512
totalSize: 1048576
verifyType: md5
verifyValue: "d41d8cd98f00b204e9800998ecf8427e"
```

STREAM 数据包只携带 `streamId/seqId/cursor/data`，StreamParser 固定解析 16B Header，然后按 streamId 查表投递数据。

### 4.1 Stream Context 生命周期

```text
CREATED → OPENING → OPEN → ACTIVE → DRAINING → CLOSED
```

发送端必须在收到建流 RPC Response（进入 OPEN 状态）后才能发送 STREAM 数据。

接收端非法状态处理：

| 接收端状态 | 收到消息 | 处理 |
| --- | --- | --- |
| `OPENING` | STREAM 数据包 | 缓冲最多 4 包；超出则 NACK(STREAM_NOT_READY) |
| `DRAINING` | 新 STREAM 数据包 | NACK(STREAM_DRAINING) |
| `CLOSED` | 任何 STREAM 数据包 | NACK(STREAM_CLOSED) |
| 任意 | streamId 不存在 | NACK(STREAM_NOT_FOUND) |

### 4.1.1 streamId 资源回收规则

streamId 绑定了设备端的内存/Flash 句柄，必须有明确的回收机制，防止内存泄漏：

**超时回收**：任何处于 OPEN/ACTIVE 状态的 Stream，如果在 `streamIdleTimeoutMs`（推荐 30000ms）内没有收到任何 STREAM 数据包，设备必须：

1. 将 Stream Context 状态置为 CLOSED
2. 释放绑定的内存/Flash 句柄
3. 发送 `RPC Event stream.error`，携带 `streamId` 和 `reason=STREAM_TIMEOUT`

**Session 关闭时的批量回收**：当底层链路断开（CONTROL CLOSE、TCP 断开、BLE 断连）时，设备必须销毁该 Session 下所有 streamId 资源：

```text
Session 关闭触发 → 遍历 Session.streamContexts → 逐一 CLOSE → 释放资源
```

不得等待超时，必须立即同步回收。

**推荐资源限制参数**：

| 参数 | 推荐值 | 说明 |
| --- | --- | --- |
| `maxOpenStreams` | 2 | 同时 OPEN/ACTIVE 的最大 Stream 数 |
| `streamIdleTimeoutMs` | 30000 | 无数据超时后强制关闭 |
| `streamOpeningTimeoutMs` | 5000 | OPENING 状态等待 RPC Response 超时 |

### 4.2 建流方式

**方式 A：通用 stream.open（P1）**（适用于日志、传感器、厂商私有流）

```json
{
  "method": "stream.open",
  "params": {
    "profile": "log.realtime",
    "direction": "download",
    "reliability": "best_effort",
    "cursorUnit": "timestampUs"
  }
}
```
响应返回 `{ "streamId": 17, "maxDataSize": 1024, "ackMode": "none" }`。

**方式 B：领域方法隐式建流**（适用于 OTA、文件、视频等）

```json
{
  "method": "firmware.begin",
  "params": {
    "imageType": "mcu",
    "totalSize": 1048576,
    "verifyType": "md5",
    "verifyValue": "d41d8cd98f00b204e9800998ecf8427e",
    "preferredChunkSize": 512
  }
}
```
响应返回 `{ "streamId": 33, "profile": "firmware.ota", "chunkSize": 512, "ackMode": "stop_and_wait", "cursorUnit": "byteOffset" }`。

---

## 5. Stream Profile Registry

Stream Profile 是可建流协议档案，不是 STREAM Payload Header 字段。具体 profile 事实进入 `protocol/axtp.protocol.yaml` 的 `profiles:` 或后续 stream profile 定义；本文只规定 Stream Header 与 Stream Context 的 wire 边界。

| Profile | cursorUnit | 默认可靠性 | MVP |
| --- |---| --- |---|
| `firmware.ota` | `byteOffset` | `reliable` | 是 |
| `file.transfer` | `byteOffset` | `reliable` | P1 |
| `log.realtime` | `timestampUs` | `best_effort` | 可选 |
| `media.video` | `timestampUs` | `best_effort` | P1 |
| `media.audio` | `timestampUs`/`sampleIndex` | `best_effort` | P1 |
| `control.hid_raw` | `timestampUs` | `reliable`/`best_effort` | P1 |
| `sensor.sample` | `timestampUs`/`sampleIndex` | `best_effort` | P2 |

`profileId` 可作为 Protocol Definition 或 RPC 建流结果中的元数据出现，但不得写入 16B STREAM Header。新增 stream profile 不得修改 STREAM Header 结构。

---

## 6. 可靠性模型

### 6.1 ackMode

> **注意**：Stream Context 的 `ackMode` 是 Stream 层流控策略，与 CONTROL OPEN 协商的 Frame 层 `ackMode`（NONE/FRAME_ACK/MESSAGE_ACK/STREAM_CHUNK_ACK）是两套独立的概念，不得混淆。Frame 层 ackMode 控制 AXTP Frame 的确认粒度；Stream 层 ackMode 控制 Stream 数据块的流控模式。

| ackMode | 说明 | 适用场景 |
| --- |---| --- |
| `none` | 不确认 | 视频、音频、实时传感器 |
| `batch` | 批量确认 | 日志、弱可靠流 |
| `stop_and_wait` | 每包确认 | HID/BLE OTA MVP |
| `sliding_window` | 滑动窗口 | WebSocket/TCP/USB Bulk OTA |
| `selective_repeat` | 选择性重传 | 高带宽文件传输 |

ackMode 在 RPC 建流阶段确定（初始模式）；CONTROL WINDOW_UPDATE 在运行时动态调整窗口（背压）。`stop_and_wait` 等价于 `windowSize=1` 的 `sliding_window`。

### 6.2 ACK（CONTROL）

| 字段 | 类型 | 说明 |
| --- |---| --- |
| `targetType` | enum | `STREAM_CHUNK` |
| `streamId` | uint32 | 被确认的流 |
| `ackSeqId` | uint32 | 已确认的最大连续 seqId |
| `ackCursor` | uint64 | 已确认的位置 |
| `windowSize` | uint16 | 可选，剩余窗口 |

### 6.3 NACK（CONTROL）

| 字段 | 类型 | 说明 |
| --- |---| --- |
| `targetType` | enum | `STREAM_CHUNK` |
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
| --- |---| --- |
| Frame 分片 | L1 | 一个 STREAM Packet 超过 MTU，被拆成多个 Frame |
| Stream 业务分块 | L2 | OTA 固件按 512B 分成多个 STREAM Packet |

接收端必须先完成 L1 Frame 重组，再解析 STREAM Header。

MVP 推荐：OTA/File 的 chunkSize 在建流时根据 MTU 协商，避免频繁触发 Frame 分片。

---

## 8. 各业务场景映射

| 业务 | 控制面 RPC | streamId 来源 | seqId | cursor |
| --- |---| --- |---| --- |
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
- 对象级校验（业务层）：OTA/File 通过 `firmware.begin` 的 `verifyType` + `verifyValue` 字段声明，传输完成后由 `firmware.verify` 触发端到端校验
- Chunk 级校验（可选）：通过 CONTROL ACK/NACK 携带 crc，或在 Profile 数据尾部追加 crc32

### 9.1 verifyType / verifyValue 规范

`verifyType` 和 `verifyValue` 是通用校验字段，适用于所有需要端到端完整性保证的 Stream Profile（OTA、文件传输等）。

| `verifyType` | `verifyValue` 格式 | 说明 |
| --- | --- | --- |
| `md5` | 32 位小写十六进制字符串 | v1 MVP 默认，计算整个传输对象 |
| `sha256` | 64 位小写十六进制字符串 | 安全性更高，推荐用于生产 OTA |
| `crc32` | 8 位小写十六进制字符串 | 轻量校验，适合资源受限设备 |
| `none` | 空字符串或省略 | 不做端到端校验（不推荐用于 OTA） |

规则：

- `verifyType` 和 `verifyValue` 在 `firmware.begin` / `file.beginTransfer` 的 params 中声明
- `verifyValue` 是整个传输对象（完整固件镜像或完整文件）的校验值，不是单个 chunk 的校验值
- `firmware.verify` 调用时不需要重复传 `verifyValue`，设备从 Stream Context 中读取
- 校验失败时设备返回 `FW_VERIFY_FAILED` 错误码，不得应用固件

MVP 推荐：AXTP-USB-HID 或 AXTP-TCP 使用 Standard Frame CRC16 + sliding_window 或 stop_and_wait ACK + `verifyType=sha256`。HID-64/BLE/UART 等低带宽降级路径见 18《AXTP Low-Bandwidth Degradation》。

---

## 10. 断点续传

接收端保存：`streamId`, `profile`, `lastSeqId`, `lastCursor`, `objectId`, `verifyValue`, `resumeToken`。

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

## 12. 低带宽传输 MTU 前置检查

低带宽传输不属于 AXTP v1 Core 必选实现。若后续在 HID-64/BLE/UART 上启用 STREAM，必须先证明扣除外层 frame header 和 STREAM Header 后仍有业务数据空间。完整策略见 18《AXTP Low-Bandwidth Degradation》。

| 示例链路 | 前置要求 | 说明 |
| --- | --- | --- |
| HID-64 | 必须计算扣除 STREAM 16B 后的数据空间 | 仅作为降级路径 |
| BLE GATT | 必须协商 MTU | 默认 ATT MTU 过小，不适合 STREAM |
| UART | 必须有额外帧边界 | 不得裸跑无 Magic compact 字节流 |

---

## 13. 编码示例

### 13.1 STREAM Packet（最小）

```text
streamId=1, seqId=0, cursor=0, data=AA BB CC DD

01 00 00 00              // streamId (uint32)
00 00 00 00              // seqId (uint32)
00 00 00 00 00 00 00 00  // cursor (uint64)
AA BB CC DD              // data
```

### 13.2 STREAM Packet（OTA 第 2 个 chunk）

```text
streamId=33, seqId=1, cursor=512, data=firmware[512..1023]

21 00 00 00              // streamId=33
01 00 00 00              // seqId=1
00 02 00 00 00 00 00 00  // cursor=512
[512 bytes firmware data]
```

---

## 14. Parser 实现要求

解析流程：
```text
parse AXTP Frame Header
  → if payloadType != STREAM: dispatch other parser
  → ensure payloadLength >= 16
  → read streamId(4B) / seqId(4B) / cursor(8B)
  → data = payload[16:]
  → validate seqId / cursor / window
  → dispatch data to profile handler
```

错误处理：

| 错误 | 处理 |
| --- | --- |
| `payloadLength < headerSize` | 丢弃，CONTROL NACK |
| `streamId = 0` | 丢弃，CONTROL NACK(`STREAM_ID_INVALID`) |
| 未找到 Stream Context | 丢弃，STREAM_NOT_FOUND |
| seqId 重复 | 幂等处理或丢弃 |
| seqId 缺失 | 根据 ackMode 发送 NACK |
| data 超过 maxDataSize | CONTROL NACK(`STREAM_PAYLOAD_INVALID`) |

---

## 15. 旧协议映射

| 旧字段 | 新位置 |
| --- |---|
| `streamType` | RPC Stream Context `profile` |
| `timestamp` | STREAM Header `cursor`（cursorUnit=timestampUs） |
| `flags` | Stream Context / data profile |
| `dataLength` | Frame Header `payloadLength - 16` |
| OTA `offset` | STREAM Header `cursor`（cursorUnit=byteOffset） |
| OTA `totalLength` | `firmware.begin.params.totalSize` |
| OTA `chunkCrc32` | profile trailer 或 CONTROL ACK/NACK |
| Log `level`/`moduleId` | log profile / log data |

---

## 16. MVP 实现范围

| 能力 | 是否必须 |
| --- |---|
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

---

## 17. 版本与兼容策略

AXTP v1 STREAM Header 固定为 16B，不存在多 Profile 协商。新增业务流类型只扩展 Stream Profile Registry，不改 Header 结构。
