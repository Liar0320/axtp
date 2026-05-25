# 19《AXTP OTA Stream Demo》v1.0

> 文档状态：MVP Demo 规范  
> 所属目录：05-demo  
> 依赖文档：  
> - 01《AXTP-整体协议规范》  
> - 02《AXTP-Control信令协议规范》  
> - 03《AXTP-RPC协议与二进制映射规范》  
> - 04《AXTP-Stream流式传输协议规范》  
> - 05《AXTP-Type-System基础类型规范》  
> - 06《AXTP-TLV-Schema编码规范》  
> - 09《AXTP-MethodId注册表》  
> - 10《AXTP-EventId注册表》  
> - 11《AXTP-ErrorCode注册表》  
> - 12《AXTP-Capability注册表》  
> - 13《AXTP-MVP最小实现注册表》  
> - 14《AXTP-老协议适配与迁移规范》


> **同步状态**：本文档的 STREAM 数据面已同步 `04-AXTP-Stream流式传输协议规范 v1.1` 的 16B L2 Header 模型（`streamId / seqId / cursor / data`）。OTA 业务属性通过 `firmware.begin` 建立并绑定到 `streamId`，不得放入 STREAM Header。

---

## 1. 文档目的

本文档定义 AXTP 在 OTA 固件升级场景下的端到端 Demo 方案。

OTA 是 AXTP MVP 阶段必须跑通的关键链路之一，因为它同时验证：

```text
CONTROL: 会话建立、ACK/NACK、断线恢复、窗口更新
RPC:     升级流程控制、参数协商、状态查询、错误响应
STREAM:  固件块传输、offset、seqId、chunkCrc32、断点续传
EVENT:   升级进度、完成、失败、重启提示
```

本文档的目标不是重新定义 OTA 协议，而是说明如何使用 AXTP 已定义的三类 PayloadType 完成 OTA：

```text
PayloadType = CONTROL  -> 协议控制、ACK/NACK、RESUME
PayloadType = RPC      -> OTA 控制面方法
PayloadType = STREAM   -> OTA 固件块数据面
```

---

## 2. 设计原则

### 2.1 RPC 控制流程，STREAM 承载数据

OTA 不应该只用 RPC 分包传输全部固件。

推荐模型：

```text
firmware.begin      -> RPC
firmware.writeChunk -> 仅用于极小包兼容，不作为主路径
STREAM OTA chunk    -> 主数据通道
firmware.end        -> RPC
firmware.verify     -> RPC
firmware.apply      -> RPC
firmware.abort      -> RPC
firmware.resume     -> RPC
```

即：

```text
RPC 负责“我要升级什么、升级到哪、是否结束、是否校验、是否应用”
STREAM 负责“连续传输固件二进制块”
CONTROL 负责“可靠性、ACK/NACK、窗口、恢复”
```

---

### 2.2 Frame 分片与 OTA 分块必须区分

OTA Demo 中必须明确两层分块：

| 层级 | 字段 | 作用 |
|---|---|---|
| AXTP Frame 层 | `messageId / frameIndex / frameCount` | 解决单个 AXTP Payload 超过传输 MTU 的分片 |
| STREAM 业务层 | `transferId / seqId / offset / chunkIndex` | 解决固件文件被拆成多个 OTA chunk 传输 |

不得用 `frameIndex` 表示 OTA chunk 序号。

正确关系：

```text
一个 OTA chunk 可以由一个或多个 AXTP Frame 承载
同一个 OTA chunk 的 AXTP Frame 共享同一个 messageId
不同 OTA chunk 使用不同 seqId/chunkIndex/offset
```

---

### 2.3 完整性校验分层

OTA Demo 中建议至少有三层校验：

| 层级 | 校验字段 | 说明 |
|---|---|---|
| Frame 层 | CRC16 | 校验单个 AXTP Frame |
| Chunk 层 | chunkCrc32 | 校验单个 OTA chunk |
| Image 层 | imageHash / sha256 | 校验完整固件镜像 |

MVP 必须实现：

```text
Frame CRC16
chunkCrc32
imageSize
imageCrc32 或 imageSha256
```

---

### 2.4 Stop-and-Wait 先跑通，Sliding Window 后优化

MVP 优先使用 Stop-and-Wait：

```text
发送 1 个 OTA chunk
等待 CONTROL ACK
继续发送下一个 chunk
```

P1 阶段再启用 Sliding Window：

```text
连续发送 N 个 OTA chunk
按窗口或范围 ACK/NACK
缺失 chunk 重传
```

---

## 3. Demo 支持范围

### 3.1 必须支持的传输

MVP 必须至少跑通：

```text
WebSocket Binary + Standard Header
HID 64B Report + Compact Header
```

P1 建议补充：

```text
BLE GATT + Compact Header
```

---

### 3.2 必须支持的 payloadType

| payloadType | 名称 | OTA 用途 |
|---:|---|---|
| `0x01` | `CONTROL` | OPEN、ACK、NACK、RESUME、WINDOW_UPDATE |
| `0x02` | `RPC` | firmware.begin / end / verify / apply / abort / resume |
| `0x03` | `STREAM` | OTA 固件块传输 |

---

### 3.3 必须支持的 RPC Encoding

| 场景 | 推荐 |
|---|---|
| WebSocket Binary | Binary RPC + TLV Body |
| HID Compact | Compact Binary RPC + TLV Body |
| BLE Compact | Compact Binary RPC + TLV Body |
| 调试工具 | DS-RPC Text Profile 可选 |

MVP 的二进制主路径：

```text
PayloadType = RPC
rpcEncoding = BINARY
bodyEncoding = TLV
```

---

## 4. OTA Demo 总体流程

完整 OTA 流程如下：

```text
1. Transport Connected

2. CONTROL OPEN
3. CONTROL ACCEPT

4. RPC capability.getAll
5. RPC firmware.getInfo

6. RPC firmware.begin
   -> device returns transferId, streamId, chunkSize, windowSize, acceptedOffset

7. STREAM OTA chunk #0
8. CONTROL ACK

9. STREAM OTA chunk #1
10. CONTROL ACK

11. ...

12. RPC firmware.end

13. RPC firmware.verify
   -> device verifies imageCrc32 / imageSha256

14. RPC firmware.apply

15. EVENT firmware.updateCompleted
16. EVENT firmware.rebootRequired

17. Device reboot
18. CONTROL RESUME or reconnect
19. RPC firmware.getInfo
```

---

## 5. OTA 状态机

### 5.1 状态定义

| 状态 | 名称 | 说明 |
|---|---|---|
| `IDLE` | 空闲 | 未进行升级 |
| `NEGOTIATING` | 协商中 | 正在执行 firmware.begin |
| `TRANSFERRING` | 传输中 | 正在接收 STREAM OTA chunk |
| `PAUSED` | 暂停 | 传输暂停，可恢复 |
| `VERIFYING` | 校验中 | 正在校验完整镜像 |
| `READY_TO_APPLY` | 待应用 | 镜像校验通过，等待 apply |
| `APPLYING` | 应用中 | 正在切换固件或写入分区 |
| `REBOOTING` | 重启中 | 设备准备重启 |
| `COMPLETED` | 完成 | 升级完成 |
| `FAILED` | 失败 | 升级失败 |
| `ABORTED` | 已中止 | 主动取消升级 |

---

### 5.2 状态转换

```text
IDLE
  -> NEGOTIATING
  -> TRANSFERRING
  -> VERIFYING
  -> READY_TO_APPLY
  -> APPLYING
  -> REBOOTING
  -> COMPLETED

TRANSFERRING
  -> PAUSED
  -> TRANSFERRING

TRANSFERRING
  -> FAILED

ANY
  -> ABORTED
```

---

## 6. MethodId 使用

OTA Demo 使用以下 MVP 方法。

| methodId | methodName | 作用 |
|---:|---|---|
| `0x0101` | `device.getInfo` | 获取设备基础信息 |
| `0x0301` | `capability.getAll` | 获取协议与业务能力 |
| `0x0B01` | `firmware.getInfo` | 获取当前固件信息 |
| `0x0B02` | `firmware.begin` | 开始 OTA |
| `0x0B03` | `firmware.end` | 结束 OTA chunk 传输 |
| `0x0B04` | `firmware.verify` | 校验固件 |
| `0x0B05` | `firmware.apply` | 应用固件 |
| `0x0B06` | `firmware.abort` | 中止升级 |
| `0x0B07` | `firmware.resume` | 恢复升级 |
| `0x0B08` | `firmware.getProgress` | 查询升级进度 |

> `firmware.writeChunk` 仅作为兼容方法保留，不作为 OTA Stream Demo 的主路径。

---

## 7. EventId 使用

| eventId | eventName | 说明 |
|---:|---|---|
| `0x8B01` | `firmware.updateStarted` | 升级开始 |
| `0x8B02` | `firmware.updateProgress` | 升级进度 |
| `0x8B03` | `firmware.updateCompleted` | 升级完成 |
| `0x8B04` | `firmware.updateFailed` | 升级失败 |
| `0x8B05` | `firmware.verifyStarted` | 校验开始 |
| `0x8B06` | `firmware.verifyCompleted` | 校验完成 |
| `0x8B07` | `firmware.rebootRequired` | 需要重启 |
| `0x8B08` | `firmware.rollbackStarted` | 回滚开始 |
| `0x8B09` | `firmware.rollbackCompleted` | 回滚完成 |

---

## 8. Stream Profile 使用

OTA 固件块使用：

```text
RPC firmware.begin:
  profile = firmware.ota
  -> streamId

STREAM packet:
  streamId / seqId / cursor / data
```

推荐 Stream Profile 编号：

| profileId | 名称 | 说明 |
|---:|---|---|
| `0x0101` | `firmware.ota` | 固件升级数据流 |

---

## 9. firmware.begin

### 9.1 请求语义

`firmware.begin` 用于启动 OTA 协商。

主机发送：

```text
methodName = firmware.begin
methodId   = 0x0B02
```

设备返回：

```text
transferId
streamId
acceptedOffset
chunkSize
windowSize
sessionToken/resumeToken
```

---

### 9.2 请求参数

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `imageType` | enum<uint8> | 是 | 固件镜像类型 |
| `imageSize` | uint32/uint64 | 是 | 固件总大小 |
| `imageVersion` | string | 是 | 目标版本 |
| `imageCrc32` | uint32 | 建议 | 固件整体 CRC32 |
| `imageSha256` | bytes[32] | 建议 | 固件整体 SHA256 |
| `chunkSizeHint` | uint16 | 否 | 主机期望 chunk 大小 |
| `windowSizeHint` | uint16 | 否 | 主机期望窗口大小 |
| `flags` | bitmap<uint16> | 否 | 是否允许断点续传、是否强制升级等 |

---

### 9.3 响应结果

| 字段 | 类型 | 说明 |
|---|---|---|
| `transferId` | uint32 | 本次 OTA 传输 ID |
| `streamId` | uint32 | OTA STREAM 数据通道 ID |
| `acceptedOffset` | uint64 | 设备接受的起始 offset |
| `chunkSize` | uint16 | 协商后的 chunk 大小 |
| `windowSize` | uint16 | 协商后的发送窗口 |
| `resumeToken` | bytes | 断点续传令牌 |
| `otaState` | enum<uint8> | 当前 OTA 状态 |

---

### 9.4 TLV 示例

#### firmware.begin Request Body

```text
01 01 01                         // imageType = MCU_FIRMWARE
02 04 00 00 10 00                // imageSize = 1048576
03 05 31 2E 32 2E 33             // imageVersion = "1.2.3"
04 04 78 56 34 12                // imageCrc32 = 0x12345678
06 02 00 04                      // chunkSizeHint = 1024
07 02 01 00                      // windowSizeHint = 1
```

#### firmware.begin Response Body

```text
01 04 01 00 00 00                // transferId = 1
02 08 00 00 00 00 00 00 00 00    // acceptedOffset = 0
03 02 00 04                      // chunkSize = 1024
04 02 01 00                      // windowSize = 1
05 04 11 22 33 44                // resumeToken
06 01 02                         // otaState = TRANSFERRING
07 04 01 00 00 00                // streamId = 1
```

---

## 10. STREAM OTA Chunk

### 10.1 AXTP Stream Packet

OTA 固件块使用统一的 STREAM L2 Header。WebSocket Binary / TCP / USB Bulk / HID / BLE 都使用同一语义，只是外层 Frame Header 和 MTU 不同：

```text
+-------------------------+
| streamId   uint32       |
+-------------------------+
| seqId      uint32       |
+-------------------------+
| cursor     uint64       |
+-------------------------+
| data...                 |
+-------------------------+
```

字段定义：

| 字段 | 长度 | 说明 |
|---|---:|---|
| `streamId` | 4B | `firmware.begin` 返回的 STREAM 通道 ID |
| `seqId` | 4B | OTA chunk 序号 |
| `cursor` | 8B | 当前 chunk 在固件镜像中的字节偏移 |
| `data` | N | 固件数据 |

`profile = firmware.ota`、`transferId`、`imageType`、`imageSize`、`chunkSize`、`hash` 等 OTA 上下文由 `firmware.begin` 建立，并在本地流上下文中绑定到 `streamId`。STREAM 包内不得重复携带 `profile / streamProfile / metadataEncoding / metadataLen / transferId`。

### 10.2 MTU 与 chunkSize

`chunkSize` 必须由 `firmware.begin` 按链路能力协商，且满足：

```text
chunkSize <= maxPayloadLength - 16
```

其中 `16` 是 STREAM L2 Header 长度。若外层 AXTP Frame 还需要在更小 MTU 上分片，Frame 层负责用 `messageId / frameIndex / frameCount` 还原同一个 STREAM packet；OTA 层不得用 Frame 分片字段表示 chunk 序号。

---

### 10.3 OTA Chunk Metadata

OTA chunk metadata 使用 TLV：

| fieldId | 字段 | 类型 | 说明 |
|---:|---|---|---|
| `0x01` | `chunkIndex` | uint32 | chunk 序号 |
| `0x02` | `chunkSize` | uint16 | 当前 chunk 数据长度 |
| `0x03` | `chunkCrc32` | uint32 | 当前 chunk CRC32 |
| `0x04` | `imageType` | enum<uint8> | 固件镜像类型 |
| `0x05` | `flags` | bitmap<uint16> | FIRST/LAST/RETRANSMIT |
| `0x06` | `totalChunks` | uint32 | 总 chunk 数 |
| `0x07` | `compressed` | bool | 是否压缩 |
| `0x08` | `encrypted` | bool | 是否加密 |

MVP 必须实现：

```text
chunkIndex
chunkSize
chunkCrc32
ackPolicy
```

---

### 10.4 OTA 可靠性策略

STREAM L2 Header 不携带 flags。OTA 的首块、末块、重传、压缩、加密和 ACK 策略由 `firmware.begin` 建立的 Stream Context 表达；传输过程中的确认使用 CONTROL ACK/NACK，目标类型为 `STREAM_CHUNK`。

---

## 11. CONTROL ACK / NACK

### 11.1 ACK 目标类型

OTA Chunk 的 ACK 不应该做成 RPC Response，而应该使用 CONTROL ACK：

```text
payloadType = CONTROL
opcode      = ACK
targetType  = STREAM_CHUNK
```

ACK Body TLV：

| fieldId | 字段 | 类型 | 说明 |
|---:|---|---|---|
| `0x20` | `targetType` | uint8 | STREAM_CHUNK |
| `0x15` | `transferId` | uint32 | OTA transferId |
| `0x16` | `seqId` | uint32 | 已确认 chunk |
| `0x17` | `offset` | uint64 | 已确认 offset |
| `0x21` | `ackRangeStart` | uint32 | 范围 ACK 起点 |
| `0x22` | `ackRangeEnd` | uint32 | 范围 ACK 终点 |

MVP Stop-and-Wait 只需要：

```text
targetType
transferId
seqId
offset
```

---

### 11.2 NACK

NACK Body TLV：

| fieldId | 字段 | 类型 | 说明 |
|---:|---|---|---|
| `0x20` | `targetType` | uint8 | STREAM_CHUNK |
| `0x15` | `transferId` | uint32 | OTA transferId |
| `0x16` | `seqId` | uint32 | 失败 chunk |
| `0x17` | `offset` | uint64 | 失败 offset |
| `0x10` | `reasonCode` | uint16 | 错误原因 |
| `0x14` | `missingRanges` | bytes | 缺失范围 |

常见 NACK reason：

| reasonCode | 名称 |
|---:|---|
| `0x0602` | `FIRMWARE_CHUNK_CRC_MISMATCH` |
| `0x0603` | `FIRMWARE_OFFSET_MISMATCH` |
| `0x0604` | `FIRMWARE_TRANSFER_TIMEOUT` |
| `0x0605` | `FIRMWARE_IMAGE_TOO_LARGE` |
| `0x0401` | `STREAM_INVALID_SEQ` |

---

## 12. Stop-and-Wait 示例

### 12.1 交互流程

```text
Host -> Device: STREAM OTA chunk seqId=0 offset=0
Device -> Host: CONTROL ACK target=STREAM_CHUNK seqId=0

Host -> Device: STREAM OTA chunk seqId=1 offset=1024
Device -> Host: CONTROL ACK target=STREAM_CHUNK seqId=1

Host -> Device: STREAM OTA chunk seqId=2 offset=2048
Device -> Host: CONTROL NACK target=STREAM_CHUNK seqId=2 reason=CRC_MISMATCH

Host -> Device: STREAM OTA chunk seqId=2 offset=2048 RETRANSMIT
Device -> Host: CONTROL ACK target=STREAM_CHUNK seqId=2
```

---

### 12.2 Host 发送逻辑

```pseudo
transfer = firmware.begin(imageInfo)

offset = transfer.acceptedOffset
seqId = offset / transfer.chunkSize

while offset < imageSize:
    data = read(image, offset, transfer.chunkSize)
    crc = crc32(data)

    sendStreamOtaChunk(
        transferId = transfer.transferId,
        seqId = seqId,
        offset = offset,
        chunkCrc32 = crc,
        data = data,
        needAck = true
    )

    ack = waitControlAckOrNack(seqId, timeoutMs)

    if ack.type == ACK:
        offset += len(data)
        seqId += 1
        continue

    if ack.type == NACK:
        if ack.reason is retryable:
            retransmit same chunk
        else:
            firmware.abort()
            fail

firmware.end()
firmware.verify()
firmware.apply()
```

---

## 13. Sliding Window 示例

P1 阶段可以启用 Sliding Window。

### 13.1 协商窗口

窗口大小由以下来源确定：

```text
CONTROL OPEN / ACCEPT windowSize
firmware.begin windowSize
CONTROL WINDOW_UPDATE
```

最终使用：

```text
effectiveWindowSize = min(transportWindowSize, otaWindowSize, deviceBufferWindow)
```

---

### 13.2 发送流程

```text
Host sends seqId = 0,1,2,3
Device ACK range 0-3

Host sends seqId = 4,5,6,7
Device NACK seqId = 6
Host retransmits seqId = 6
Device ACK range 4-7
```

MVP 可以不实现 Sliding Window，但协议字段必须为后续保留。

---

## 14. 断点续传

### 14.1 断线恢复流程

```text
1. BLE/HID/WebSocket 断开
2. 重新连接 Transport
3. CONTROL OPEN
4. CONTROL RESUME(sessionId, resumeToken)
5. CONTROL RESUME_ACK(acceptedOffset, lastSeqId)
6. RPC firmware.resume
7. Host 从 acceptedOffset 继续发送 STREAM OTA chunk
```

---

### 14.2 firmware.resume 请求参数

| 字段 | 类型 | 说明 |
|---|---|---|
| `transferId` | uint32 | 原 OTA 传输 ID |
| `resumeToken` | bytes | begin 返回的恢复令牌 |
| `imageCrc32` | uint32 | 镜像校验 |
| `imageSha256` | bytes[32] | 镜像哈希 |

---

### 14.3 firmware.resume 响应结果

| 字段 | 类型 | 说明 |
|---|---|---|
| `acceptedOffset` | uint64 | 设备已接受的偏移 |
| `lastSeqId` | uint32 | 最后确认的 seqId |
| `chunkSize` | uint16 | 当前 chunk 大小 |
| `otaState` | enum<uint8> | OTA 状态 |

---

## 15. firmware.end / verify / apply

### 15.1 firmware.end

表示主机已经发送完所有 OTA chunk。

请求：

```text
transferId
totalBytesSent
totalChunks
```

响应：

```text
receivedBytes
receivedChunks
otaState
```

---

### 15.2 firmware.verify

要求设备校验完整镜像。

请求：

```text
transferId
imageCrc32
imageSha256
```

响应：

```text
verifyResult
otaState = READY_TO_APPLY
```

设备在校验过程中可发送：

```text
firmware.verifyStarted
firmware.verifyCompleted
firmware.updateFailed
```

---

### 15.3 firmware.apply

要求设备应用固件。

请求：

```text
transferId
applyMode
```

`applyMode`：

| 值 | 名称 | 说明 |
|---:|---|---|
| `0x01` | `APPLY_NOW` | 立即应用 |
| `0x02` | `APPLY_ON_REBOOT` | 下次重启应用 |
| `0x03` | `STAGE_ONLY` | 仅暂存 |

响应：

```text
otaState = APPLYING 或 REBOOTING
rebootRequired = true/false
```

---

## 16. WebSocket Binary OTA Demo

### 16.1 使用 Standard Header

WebSocket Binary Demo 推荐：

```text
Header Profile = Standard
PayloadType = CONTROL / RPC / STREAM
CRC16 = enabled
chunkSize = 1024 或 4096
windowSize = 1 for MVP
```

---

### 16.2 典型参数

| 参数 | 推荐值 |
|---|---:|
| `maxFrameSize` | 4096 或 8192 |
| `otaChunkSize` | 1024 / 2048 / 4096 |
| `windowSize` | 1 |
| `ackMode` | per chunk |
| `crc16` | enabled |
| `chunkCrc32` | enabled |

---

### 16.3 WebSocket Binary 发送伪代码

```javascript
async function otaOverWebSocketBinary(ws, imageBytes) {
  await sendControlHello(ws);

  const begin = await rpcCall(ws, "firmware.begin", {
    imageType: 1,
    imageSize: imageBytes.length,
    imageVersion: "1.2.3",
    imageCrc32: crc32(imageBytes),
    chunkSizeHint: 1024,
    windowSizeHint: 1
  });

  let offset = begin.acceptedOffset;
  let seqId = offset / begin.chunkSize;

  while (offset < imageBytes.length) {
    const chunk = imageBytes.slice(offset, offset + begin.chunkSize);

    sendStreamChunk(ws, {
      streamId: begin.streamId,
      seqId,
      cursor: offset,
      chunkCrc32: crc32(chunk),
      data: chunk,
      needAck: true
    });

    await waitAck(seqId);

    offset += chunk.length;
    seqId += 1;
  }

  await rpcCall(ws, "firmware.end", { transferId: begin.transferId });
  await rpcCall(ws, "firmware.verify", {
    transferId: begin.transferId,
    imageCrc32: crc32(imageBytes)
  });
  await rpcCall(ws, "firmware.apply", {
    transferId: begin.transferId,
    applyMode: "APPLY_NOW"
  });
}
```

---

## 17. HID Compact OTA Demo

### 17.1 HID 64B Report 约束

HID 64B Report 通常可用负载非常有限。

推荐：

```text
ReportId: 1B，可选
AXTP Compact Header: 4B
CRC8 Footer: 1B
可用 Frame Payload: 58B（含 1B ReportId 时）
可用 STREAM data: 42B（58B - 16B L2 Header）
```

因此 OTA chunk 可能需要拆成多个 AXTP Frame。

---

### 17.2 HID 推荐参数

| 参数 | 推荐值 |
|---|---:|
| HID Report Size | 64B |
| Header Profile | Compact |
| CRC16 | enabled |
| Stream Payload | Compact |
| OTA chunk size | 128B / 256B |
| Frame payload size | 54B 左右 |
| ACK mode | per chunk |
| windowSize | 1 |

---

### 17.3 HID 分层示例

```text
OTA chunk size = 128B
HID frame payload capacity = 54B

一个 OTA chunk 可能需要：
Frame 0: metadata + data[0..x]
Frame 1: data[x..y]
Frame 2: data[y..127]
```

所有这些 Frame：

```text
共享同一个 messageId
frameIndex = 0,1,2
frameCount = 3
```

当设备收到完整 chunk 并通过 chunkCrc32 后，再发送：

```text
CONTROL ACK targetType = STREAM_CHUNK
```

---

## 18. BLE Compact OTA Demo

### 18.1 BLE MTU 约束

BLE 可用 Payload 取决于 ATT MTU：

```text
ATT payload = MTU - 3
AXTP available = ATT payload - CompactHeader - CRC16
```

例如：

```text
MTU = 247
ATT payload = 244
Compact Header = 7
CRC16 = 2
可用 Payload = 235
```

---

### 18.2 BLE 推荐参数

| 参数 | 推荐值 |
|---|---:|
| ATT MTU | 247 |
| Header Profile | Compact |
| OTA chunk size | 512B / 1024B |
| ACK mode | per chunk 或 per N chunks |
| windowSize | 1 for MVP, 4 for P1 |
| Write Mode | Write Without Response + CONTROL ACK |
| Notify | Device -> Host |

---

### 18.3 BLE 恢复建议

BLE 断线概率较高，MVP 应至少实现：

```text
firmware.begin 返回 resumeToken
firmware.getProgress 返回 acceptedOffset
firmware.resume 支持从 acceptedOffset 继续
```

P1 实现：

```text
CONTROL RESUME
```

---

## 19. 错误处理

### 19.1 OTA 常见错误

| errorCode | 名称 | 说明 |
|---:|---|---|
| `0x0000` | `OK` | 成功 |
| `0x0601` | `FIRMWARE_BEGIN_FAILED` | 开始升级失败 |
| `0x0602` | `FIRMWARE_CHUNK_CRC_MISMATCH` | chunk CRC 不匹配 |
| `0x0603` | `FIRMWARE_OFFSET_MISMATCH` | offset 不匹配 |
| `0x0604` | `FIRMWARE_TRANSFER_TIMEOUT` | 传输超时 |
| `0x0605` | `FIRMWARE_IMAGE_TOO_LARGE` | 固件过大 |
| `0x0606` | `FIRMWARE_VERIFY_FAILED` | 固件校验失败 |
| `0x0607` | `FIRMWARE_APPLY_FAILED` | 应用失败 |
| `0x0608` | `FIRMWARE_UNSUPPORTED_IMAGE` | 不支持的镜像 |
| `0x0609` | `FIRMWARE_VERSION_REJECTED` | 版本被拒绝 |
| `0x060A` | `FIRMWARE_ABORTED` | 升级已中止 |
| `0x060B` | `FIRMWARE_RESUME_FAILED` | 恢复失败 |

---

### 19.2 错误返回位置

| 错误类型 | 返回位置 |
|---|---|
| RPC 参数错误 | RPC Response `statusCode` |
| chunk CRC 错误 | CONTROL NACK |
| Frame CRC 错误 | CONTROL NACK 或直接丢弃 |
| 完整镜像校验失败 | RPC firmware.verify Response |
| 升级过程异步失败 | EVENT firmware.updateFailed |

---

## 20. 老协议适配

### 20.1 旧 OTA 命令映射

如果旧协议存在以下命令：

```text
AlphaUpgradeInfo
AlphaUpgradeStart
AlphaUpgradeData
AlphaUpgradeEnd
AlphaUpgradeVerify
AlphaUpgradeApply
```

建议映射为：

| 旧命令 | AXTP 映射 |
|---|---|
| `AlphaUpgradeInfo` | `firmware.getInfo` |
| `AlphaUpgradeStart` | `firmware.begin` |
| `AlphaUpgradeData` | `STREAM OTA chunk` |
| `AlphaUpgradeEnd` | `firmware.end` |
| `AlphaUpgradeVerify` | `firmware.verify` |
| `AlphaUpgradeApply` | `firmware.apply` |

---

### 20.2 legacyCmdValue 策略

旧协议中的 `CmdValue` 不应强制塞入 AXTP `methodId`，特别是旧值超过 `uint16` 或包含协议族前缀时。

建议使用：

```yaml
legacy:
  protocol: AXDP_HID
  cmdValue: 0xA0001
  adapter: AlphaUpgradeInfoAdapter
```

AXTP 新方法保持稳定：

```yaml
id: 0x0B01
name: firmware.getInfo
```

---

### 20.3 旧 OTA Payload 到 TLV 映射

旧固定结构：

```text
offset:uint32
length:uint16
crc32:uint32
data:bytes
```

AXTP 映射：

| 旧字段 | AXTP 字段 |
|---|---|
| `offset` | Stream `offset` |
| `length` | metadata `chunkSize` |
| `crc32` | metadata `chunkCrc32` |
| `data` | Stream `data` |

---

## 21. capability 要求

设备必须通过 `capability.getAll` 或 `capability.getDomain("firmware")` 声明 OTA 能力。

建议返回：

| 字段 | 类型 | 说明 |
|---|---|---|
| `firmware.upgradeSupported` | bool | 是否支持 OTA |
| `firmware.resumeSupported` | bool | 是否支持断点续传 |
| `firmware.rollbackSupported` | bool | 是否支持回滚 |
| `firmware.supportedImageTypes` | array<enum> | 支持的镜像类型 |
| `firmware.maxImageSize` | uint32/uint64 | 最大固件大小 |
| `firmware.chunkSizeMin` | uint16 | 最小 chunk |
| `firmware.chunkSizeMax` | uint16 | 最大 chunk |
| `firmware.windowSizeMax` | uint16 | 最大窗口 |
| `firmware.hashAlgorithms` | bitmap | CRC32 / SHA256 |
| `stream.otaSupported` | bool | 是否支持 STREAM OTA |

---

## 22. Generator v1 要求

Generator v1 应从 Registry 输出：

```text
FirmwareMethodId enum
FirmwareEventId enum
FirmwareErrorCode enum
OtaState enum
ImageType enum
Stream Profile Registry constants
TLV field constants
firmware.begin request/response schema
firmware.resume request/response schema
ota chunk metadata schema
```

C++ 头文件示例：

```cpp
enum class MethodId : uint16_t {
    FirmwareGetInfo = 0x0B01,
    FirmwareBegin = 0x0B02,
    FirmwareEnd = 0x0B03,
    FirmwareVerify = 0x0B04,
    FirmwareApply = 0x0B05,
    FirmwareAbort = 0x0B06,
    FirmwareResume = 0x0B07,
    FirmwareGetProgress = 0x0B08,
};

enum class StreamProfile : uint16_t {
    FirmwareOta = 0x0101,
};

enum class FirmwareErrorCode : uint16_t {
    ChunkCrcMismatch = 0x0602,
    OffsetMismatch = 0x0603,
    VerifyFailed = 0x0606,
};
```

---

## 23. C++ Demo v1 要求

C++ Demo v1 至少包含：

```text
utpf_frame_encoder
utpf_frame_decoder
control_ack_nack
rpc_firmware_begin
stream_ota_chunk_encoder
stream_ota_chunk_decoder
firmware_transfer_session
crc16
crc32
mock_device_flash
```

Host 侧最小类：

```cpp
class OtaClient {
public:
    Result begin(const FirmwareImage& image);
    Result sendChunk(uint32_t seqId, uint64_t offset, ByteSpan data);
    Result end();
    Result verify();
    Result apply();
    Result resume();
    Result abort();
};
```

Device 侧最小类：

```cpp
class OtaReceiver {
public:
    RpcResponse onFirmwareBegin(const RpcRequest& req);
    ControlPayload onStreamChunk(const StreamPayload& chunk);
    RpcResponse onFirmwareEnd(const RpcRequest& req);
    RpcResponse onFirmwareVerify(const RpcRequest& req);
    RpcResponse onFirmwareApply(const RpcRequest& req);
};
```

---

## 24. 测试用例

### 24.1 P0 必测

| 编号 | 测试项 | 预期 |
|---|---|---|
| `OTA-001` | 正常 begin | 返回 transferId |
| `OTA-002` | 单 chunk 发送 | 返回 ACK |
| `OTA-003` | 多 chunk Stop-and-Wait | 全部 ACK |
| `OTA-004` | chunk CRC 错误 | 返回 NACK |
| `OTA-005` | 重传 chunk | 返回 ACK |
| `OTA-006` | firmware.end | 返回成功 |
| `OTA-007` | firmware.verify | 返回成功 |
| `OTA-008` | firmware.apply | 返回成功或 rebootRequired |
| `OTA-009` | 进度事件 | 收到 firmware.updateProgress |
| `OTA-010` | 完成事件 | 收到 firmware.updateCompleted |

---

### 24.2 P1 必测

| 编号 | 测试项 | 预期 |
|---|---|---|
| `OTA-101` | 断线恢复 | 从 acceptedOffset 继续 |
| `OTA-102` | Sliding Window | 支持范围 ACK |
| `OTA-103` | offset mismatch | 返回 NACK |
| `OTA-104` | verify failed | 返回 firmware.updateFailed |
| `OTA-105` | abort | 状态变为 ABORTED |
| `OTA-106` | rollback | 回滚成功或返回不支持 |

---

## 25. 验收标准

OTA Stream Demo 通过标准：

```text
1. 能完成 CONTROL OPEN / ACCEPT
2. 能通过 RPC firmware.begin 创建 OTA transfer
3. 能通过 STREAM OTA chunk 传输完整固件
4. 每个 chunk 能被 CONTROL ACK/NACK 确认
5. chunk CRC 错误能触发 NACK 与重传
6. firmware.end 能正确结束传输
7. firmware.verify 能校验完整镜像
8. firmware.apply 能进入应用或重启流程
9. 设备能发出 firmware.updateProgress / completed / failed 事件
10. WebSocket Binary 和 HID Compact 至少各跑通一条链路
```

---

## 26. MVP 实现边界

### 26.1 MVP 必须实现

```text
firmware.begin
firmware.end
firmware.verify
firmware.apply
firmware.abort
STREAM OTA chunk
CONTROL ACK
CONTROL NACK
chunkCrc32
imageCrc32
Stop-and-Wait
firmware.updateProgress
firmware.updateCompleted
firmware.updateFailed
```

---

### 26.2 MVP 可以暂缓

```text
Sliding Window
SHA256 强制校验
加密 OTA
压缩 OTA
差分 OTA
A/B 分区切换
回滚
多镜像并行升级
断点续传强一致
签名验签
```

---

## 27. 总结

AXTP OTA Stream Demo 的核心模型是：

```text
RPC 控制升级生命周期
STREAM 传输固件数据块
CONTROL ACK/NACK 保证可靠性
Event 上报异步进度和结果
Registry 统一 method/event/error/capability
Generator 输出 C++ 可消费代码
```

这条链路一旦跑通，就说明 AXTP 的三类 PayloadType 已经形成完整闭环：

```text
CONTROL -> 协议运行时可靠性
RPC     -> 业务控制面
STREAM  -> 高吞吐数据面
```

OTA Demo 是 AXTP MVP 从“协议文档”走向“可运行实现”的关键验证用例。
