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
CONTROL OPEN / ACCEPT
RPC capability.supportedMethods
RPC device.getInfo
RPC display.setBrightness
RPC Event display.brightnessChanged
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

| 传输 | Frame Profile | Frame CRC | Control Payload | 说明 |
| --- | --- | --- | --- | --- |
| WebSocket Binary / TCP | Standard | CRC16 | 统一 5B 固定头 | 使用 `AX` Magic 与 12B Frame Header |
| HID / BLE | Compact（或 Standard 降级） | CRC8 | 统一 5B 固定头 | 使用 4B Frame Header，依赖底层 packet boundary |

业务流程完全相同。差异只存在于外层 Frame Profile、CRC Footer、PayloadLength/MessageId wire 宽度和底层 MTU。Control Payload 结构在所有场景下相同。

---

## 3. Session 建立

### 3.1 OPEN

Client 发送 `PayloadType = CONTROL` 的 OPEN。

OPEN body 至少携带：

| 字段 | 来源 | 示例值 |
| --- |---| --- |
| `protocolVersion` | 02 Control | `0x01` |
| `maxFrameSize` | 02 Control | 传输允许的最大 Frame |
| `mtu` | 02 Control | 底层 MTU |
| `supportedPayloadTypes` | 13 Registry | CONTROL / RPC / STREAM |
| `supportedRpcEncodings` | 13 Registry | BINARY |
| `heartbeatIntervalMs` | 02 Control | `1000` |
| `ackMode` | 02 Control | `MESSAGE_ACK` |

### 3.2 ACCEPT

Device 返回 ACCEPT，并分配 `sessionId`。

`sessionId` 只绑定 Session Context。后续 RPC/STREAM Frame 不在 Header 或 Payload 中重复携带 `sessionId`。

---

## 3.5 应用层身份认证（Challenge / Identify / Identified）

ACCEPT 完成后，Device 主动发送 RPC Hello(op=0)，Client 回应 Identify(op=2)，Device 发送 Identified(op=3) 确认应用层就绪。

| 步骤 | 方向 | rpcOp | 方法 / 事件 | 关键字段 |
| --- | --- | --- | --- | --- |
| 1 | Server → Client | Hello(op=0) | - | `challengeString`、`authRequired`、`rpcVersion` |
| 2 | Client → Server | Identify(op=2) | - | `clientName`、`clientVersion`、`rpcVersion`、`authResponse`（无密码时省略）、`eventMasks`（域级事件订阅掩码） |
| 3 | Server → Client | Identified(op=3) | - | `sid`、`negotiatedRpcVersion` |

三步完成后进入 `APP_READY` 状态。

`eventMasks` 格式为 Hex 字符串，由 Domain Block 链拼接而成（见 08《Registry 总则》§23）。MVP 阶段设备可忽略 `eventMasks`，默认推送所有核心事件（全量广播模式）。

如果设备为免鉴权模式，Hello 中 `authRequired=false`，Client 发送 Identify 时省略 `authResponse`，Device 直接回 Identified。

---

## 4. Capability 查询

Client 发送 RPC Request：

| 字段 | 值 |
| --- |---|
| `PayloadType` | RPC |
| `rpcEncoding` | BINARY |
| `rpcOp` | REQUEST |
| `requestId` | `0x00000001` |
| `methodId` | `capability.supportedMethods` 对应 Registry 值 |
| `bodyEncoding` | TLV |

Device 返回 RPC Response，body 中至少包含 `capabilityMasks`（域级掩码 Hex 字符串）：

```text
protocol.payloadTypes
protocol.frameProfile
protocol.frameCrcProfiles
protocol.messageIdWidths
protocol.ackModes
rpc.encodings
stream.profiles
```

`capabilityMasks` 格式见 08《Registry 总则》§23 和 12《Capability 注册表》§4.1。

---

## 5. 设备信息与亮度控制

### 5.1 device.getInfo

Client 发送 RPC Request：

```text
methodId = device.getInfo
bodyEncoding = TLV8
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

### 5.2 display.setBrightness

Client 发送 RPC Request：

```text
methodId = display.setBrightness
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
eventId = display.brightnessChanged
body:
  level = 80
  reason = user_request
```

---

## 6. OTA 建流

Client 发送 RPC Request：

```text
methodId = firmware.begin
bodyEncoding = TLV8
body:
  profile = firmware.ota
  imageType = application
  imageSize = <bytes>
  chunkSize = <preferred data bytes>
  verifyType = md5          ← 校验算法，由设备 capability 声明支持范围
  verifyValue = <hex string> ← 对应算法的校验值
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

OTA 上下文绑定到 `streamId`。STREAM 包内不得重复携带 `profile / transferId / imageSize / verifyValue / chunkSize`。

---

## 7. STREAM OTA 数据

每个 OTA chunk 使用 `PayloadType = STREAM`，Payload 为：

```text
STREAM L2 Header (16B)
Stream Data
```

STREAM L2 Header 字段引用 `06-AXTP-Stream-Spec`：

| 字段 | 示例 |
| --- |---|
| `streamId` | firmware.begin 返回值 |
| `seqId` | 从 0 递增 |
| `cursor` | 当前固件偏移 |

`dataLength` 由外层 Frame `PayloadLength - 16` 推导，不在 L2 Header 中重复编码。

单帧 STREAM data 上限由传输层 MTU 和 Frame Profile 决定，必须满足 HID Report / BLE ATT MTU 的限制。

---

## 8. ACK / NACK

stop-and-wait OTA 示例：

```text
Client -> Device: STREAM streamId=9 seqId=0 cursor=0
Device -> Client: CONTROL ACK targetType=STREAM_CHUNK streamId=9 seqId=0

Client -> Device: STREAM streamId=9 seqId=1 cursor=N
Device -> Client: CONTROL ACK targetType=STREAM_CHUNK streamId=9 seqId=1

Client -> Device: STREAM streamId=9 seqId=2 cursor=2N
Device -> Client: CONTROL NACK targetType=STREAM_CHUNK streamId=9 seqId=2 statusCode=STREAM_CRC_ERROR

Client -> Device: STREAM streamId=9 seqId=2 cursor=2N
Device -> Client: CONTROL ACK targetType=STREAM_CHUNK streamId=9 seqId=2
```

Frame Header 不携带确认请求标志。确认策略来自 OPEN ackMode 与 firmware.begin 建立的 Stream Context。

---

## 9. OTA 完成与验证

Client 完成所有 STREAM chunk 后发送 RPC Request：

```text
methodId = firmware.verify
body:
  streamId = 9
  verifyType = md5
  verifyValue = <hex string>
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
1. Standard Frame Profile 跑通完整流程；
2. Compact Frame Profile 跑通完整流程；
3. Standard CRC16 错误帧被拒绝；
4. Compact CRC8 错误帧被拒绝；
5. Compact MessageId > 0xFF 序列化失败；
6. STREAM chunk 缺失时返回 CONTROL NACK；
7. sessionId 只存在于 Session Context；
8. CLOSE / CLOSE_ACK 后拒绝新的 RPC / STREAM；
9. Control Payload 使用统一 5B 固定头，两种 Frame Profile 下结构相同；
10. STREAM Header 固定 16B，所有传输场景一致；
11. Demo 不依赖任何 Legacy/Outdated 文档字段。
```
