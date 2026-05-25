# 22《AXTP MVP Normative Demo》

版本：v1.0
状态：Normative Example
适用范围：AXTP v1 MVP 端到端实现依据

依赖文档：

- 01《AXTP-整体协议规范》
- 02《AXTP-Control信令协议规范》
- 03《AXTP-RPC协议与二进制映射规范》
- 04《AXTP-Stream流式传输协议规范》
- 13《AXTP-MVP最小实现注册表》

---

## 1. 示例目标

本文档给出一条可以直接作为实现验收依据的 AXTP v1 MVP 链路。所有 Frame Header、Control Payload、RPC Payload、STREAM L2 Header、Registry 编号均引用上游规范，不在本文重新定义 wire format。

本文示例覆盖：

```text
CONTROL HELLO / HELLO_ACK
RPC capability.getAll
RPC device.getInfo
RPC brightness.set
RPC Event brightness.changed
RPC firmware.begin
STREAM OTA chunk
CONTROL ACK / NACK
RPC firmware.verify
RPC Event firmware.updateCompleted
CONTROL CLOSE / CLOSE_ACK
```

---

## 2. Profile 选择

MVP Demo 必须支持以下两种运行方式：

| 传输 | Header Profile | Frame CRC | 说明 |
|---|---|---|---|
| WebSocket Binary / TCP | Standard | CRC16 | 使用 `AX` Magic 与 12B Header |
| HID / BLE | Compact | CRC8 | 使用 4B Header，依赖底层 packet boundary |

业务流程完全相同。差异只存在于外层 Frame Profile、CRC Footer、PayloadLength/MessageId wire 宽度和底层 MTU。

---

## 3. Session 建立

### 3.1 HELLO

Client 发送 `PayloadType = CONTROL` 的 HELLO。

HELLO body 至少携带：

| 字段 | 来源 | 示例值 |
|---|---|---|
| `protocolVersion` | 02 Control | `0x01` |
| `headerProfile` | 01 Frame / 13 Registry | `STANDARD` 或 `COMPACT` |
| `maxFrameSize` | 02 Control | 传输允许的最大 Frame |
| `mtu` | 02 Control | 底层 MTU |
| `supportedPayloadTypes` | 13 Registry | CONTROL / RPC / STREAM |
| `supportedRpcEncodings` | 13 Registry | BINARY |
| `heartbeatIntervalMs` | 02 Control | `1000` |
| `ackMode` | 02 Control | `MESSAGE_ACK` |

### 3.2 HELLO_ACK

Device 返回 HELLO_ACK，并分配 `sessionId`。

`sessionId` 只绑定 Session Context。后续 RPC/STREAM Frame 不在 Header 或 Payload 中重复携带 `sessionId`。

---

## 4. Capability 查询

Client 发送 RPC Request：

| 字段 | 值 |
|---|---|
| `PayloadType` | RPC |
| `rpcEncoding` | BINARY |
| `rpcOp` | REQUEST |
| `requestId` | `0x00000001` |
| `methodId` | `capability.getAll` 对应 Registry 值 |
| `bodyEncoding` | TLV |

Device 返回 RPC Response，body 中至少包含：

```text
protocol.payloadTypes
protocol.headerProfiles
protocol.frameCrcProfiles
protocol.messageIdWidths
protocol.ackModes
rpc.encodings
stream.profiles
```

---

## 5. 设备信息与亮度控制

### 5.1 device.getInfo

Client 发送 RPC Request：

```text
methodId = device.getInfo
bodyEncoding = TLV
body = empty
```

Device 返回设备信息，例如：

```text
model
serialNumber
hardwareVersion
firmwareVersion
protocolVersion
```

### 5.2 brightness.set

Client 发送 RPC Request：

```text
methodId = brightness.set
body:
  level = 80
```

Device 返回 RPC Response：

```text
statusCode = SUCCESS
body:
  level = 80
```

随后 Device 可以发送 RPC Event：

```text
eventId = brightness.changed
body:
  level = 80
  reason = user_request
```

---

## 6. OTA 建流

Client 发送 RPC Request：

```text
methodId = firmware.begin
bodyEncoding = TLV
body:
  profile = firmware.ota
  imageType = application
  imageSize = <bytes>
  chunkSize = <preferred data bytes>
  hashAlgorithm = sha256
  hash = <image hash>
  ackMode = stop_and_wait
```

Device 返回：

```text
statusCode = SUCCESS
body:
  streamId = <uint32>
  acceptedChunkSize = <bytes>
  windowSize = 1
```

OTA 上下文绑定到 `streamId`。STREAM 包内不得重复携带 `profile / transferId / imageSize / hash / chunkSize`。

---

## 7. STREAM OTA 数据

每个 OTA chunk 使用 `PayloadType = STREAM`，Payload 为：

```text
STREAM L2 Header (16B)
Stream Data
```

STREAM L2 Header 字段引用 `04-AXTP-Stream流式传输协议规范`：

| 字段 | 示例 |
|---|---|
| `streamId` | firmware.begin 返回值 |
| `seqId` | 从 0 递增 |
| `cursor` | 当前固件偏移 |

`dataLength` 由外层 Frame `PayloadLength - 16` 推导，不在 L2 Header 中重复编码。

Compact Profile 的单帧 STREAM data 不得超过 `239B`，并且还必须满足 HID Report / BLE ATT MTU 的更小限制。

---

## 8. ACK / NACK

stop-and-wait OTA 示例：

```text
Client -> Device: STREAM streamId=9 seqId=0 cursor=0
Device -> Client: CONTROL ACK targetType=STREAM_CHUNK streamId=9 seqId=0

Client -> Device: STREAM streamId=9 seqId=1 cursor=N
Device -> Client: CONTROL ACK targetType=STREAM_CHUNK streamId=9 seqId=1

Client -> Device: STREAM streamId=9 seqId=2 cursor=2N
Device -> Client: CONTROL NACK targetType=STREAM_CHUNK streamId=9 seqId=2 statusCode=CRC_ERROR

Client -> Device: STREAM streamId=9 seqId=2 cursor=2N
Device -> Client: CONTROL ACK targetType=STREAM_CHUNK streamId=9 seqId=2
```

Frame Header 不携带确认请求标志。确认策略来自 HELLO ackMode 与 firmware.begin 建立的 Stream Context。

---

## 9. OTA 完成与验证

Client 完成所有 STREAM chunk 后发送 RPC Request：

```text
methodId = firmware.verify
body:
  streamId = 9
  hashAlgorithm = sha256
  hash = <image hash>
```

Device 返回：

```text
statusCode = SUCCESS
body:
  verified = true
```

Device 可以发送 RPC Event：

```text
eventId = firmware.updateCompleted
body:
  imageType = application
  result = success
```

---

## 10. 关闭会话

Client 发送 CONTROL CLOSE：

```text
reasonCode = NORMAL_CLOSE
```

Device 返回 CONTROL CLOSE_ACK。双方进入 CLOSED 状态。

---

## 11. 验收要求

实现必须通过以下场景：

```text
1. Standard Profile 跑通完整流程；
2. Compact Profile 跑通完整流程；
3. Standard CRC16 错误帧被拒绝；
4. Compact CRC8 错误帧被拒绝；
5. Compact MessageId > 0xFF 序列化失败；
6. Compact STREAM data > 239B 序列化失败；
7. STREAM chunk 缺失时返回 CONTROL NACK；
8. sessionId 只存在于 Session Context；
9. CLOSE / CLOSE_ACK 后拒绝新的 RPC / STREAM；
10. Demo 不依赖任何 Legacy/Outdated 文档字段。
```
