# 02《AXTP Control 信令协议规范》

版本：v0.1 Draft  
状态：MVP Control 子协议规范  
适用范围：`PayloadType = CONTROL` 的 Payload 结构、Opcode、TLV 字段、会话建连、心跳、ACK/NACK、恢复、关闭、流控  
前置文档：00《AXTP 协议总览与落地路线》、01《AXTP 整体协议规范》  
后续文档：03《AXTP RPC 协议与二进制映射规范》、04《AXTP Stream 流式传输协议规范》、02-AXTP-Type-System 基础类型规范、02-AXTP-TLV-Schema 编码规范

---

## 1. 文档目的

本文档定义 AXTP 中 `PayloadType = CONTROL` 时的信令协议。

在 01《AXTP 整体协议规范》中，AXTP Frame Header 已经定义了三种 PayloadType：

```text
0x01 CONTROL
0x02 RPC
0x03 STREAM
```

本文档专门补齐 `CONTROL` 的 Payload 内部结构。

本规范重点解决以下问题：

```text
1. 当 Frame Header.payloadType = CONTROL 时，Payload 如何解析；
2. CONTROL Payload 是否可以携带负载消息；
3. HELLO / HELLO_ACK 如何协商协议能力；
4. ACK / NACK 如何确认 Frame、Message、Stream Chunk；
5. RESUME 如何支持断线恢复；
6. HEARTBEAT / PING 如何维持连接与检测链路质量；
7. CLOSE / SESSION_RESET 如何关闭或重置会话；
8. WINDOW_UPDATE 如何支持流控；
9. BLE / HID / UART 等低带宽环境下如何使用 Compact Control Payload；
10. C++ Parser / Generator v1 在 MVP 阶段需要实现哪些最小能力。
```

本文档不定义业务方法、业务事件、业务错误码和业务能力注册表。这些内容由后续 Registry 文档定义。

---

## 2. 核心结论

`PayloadType = CONTROL` 不是“没有 Payload”。

当 AXTP Frame Header 中：

```text
payloadType = CONTROL
```

时，Frame Payload 必须交给 `ControlParser` 解析。

也就是说：

```text
AXTP Frame
  Header.payloadType = CONTROL
  Payload             = Control Payload
```

`Control Payload` 由以下内容组成：

```text
opcode
control metadata
optional body
```

其中 `body` 可用于携带 HELLO 协商参数、ACK/NACK 目标、恢复 token、关闭原因、流控窗口等协议运行时信息。

---

## 3. CONTROL 的职责边界

### 3.1 CONTROL 负责什么

`CONTROL` 负责 AXTP 协议运行时控制面。

包括：

```text
会话建立
会话协商
心跳保活
链路探测
ACK / NACK
重传提示
会话恢复
会话关闭
会话重置
流控窗口更新
协议级错误反馈
```

### 3.2 CONTROL 不负责什么

`CONTROL` 不承载业务命令，不进入 Method Registry。

以下内容不应该放在 CONTROL 中：

```text
device.getInfo
capability.getAll
brightness.set
display.setPower
video.setResolution
audio.setVolume
firmware.begin
file.beginTransfer
log.export
diagnostic.selfTest
```

这些都必须使用：

```text
PayloadType = RPC
```

连续数据、大块数据、高吞吐数据必须使用：

```text
PayloadType = STREAM
```

例如：

```text
video frame
audio frame
firmware chunk
file chunk
log stream
kvm raw input
```

---

## 4. CONTROL 与 Frame Header 的关系

完整结构如下：

```text
+--------------------------------------------------+
| AXTP Frame Header                                |
| payloadType = CONTROL                            |
| payloadLength = Control Payload Length           |
| messageId = 当前控制消息的 Frame 层 MessageId     |
| frameIndex / frameCount = 如需分片则使用          |
+--------------------------------------------------+
| Control Payload                                  |
| opcode / flags / controlId / status / body       |
+--------------------------------------------------+
| Optional CRC Footer                              |
+--------------------------------------------------+
```

职责分工：

| 层级 | 字段 | 职责 |
|---|---|---|
| Frame Header | `payloadType` | 指定 Payload 由 ControlParser 解析 |
| Frame Header | `payloadLength` | 指定 Control Payload 的字节长度 |
| Frame Header | `messageId` | 标识一条完整 Control Message 的 Frame 层消息 |
| Frame Header | `frameIndex/frameCount` | 对大型 Control Payload 做 Frame 分片 |
| Control Payload | `opcode` | 指定控制操作，例如 HELLO / ACK / NACK |
| Control Payload | `controlId` | 匹配控制请求与控制响应 |
| Control Payload | `statusCode` | 表达控制操作执行结果 |
| Control Payload | `bodyEncoding/bodyLen/body` | 携带控制负载参数 |

原则：

```text
Frame Header 只解决“这一帧怎么传”；
Control Payload 解决“这条控制信令表达什么”。
```

---

## 5. CONTROL Payload 形态

AXTP 为 CONTROL 定义两种 Payload 形态：

```text
Standard Control Payload
Compact Control Payload
```

### 5.1 Standard Control Payload

Standard Control Payload 用于 TCP、WebSocket Binary、USB Bulk、调试工具、网关转发等带宽较充足的场景。

结构：

```text
+------------+------------+
| opcode     | flags      |
+------------+------------+
| controlId               |
+------------+------------+
| statusCode              |
+------------+------------+
| bodyEncoding | bodyLen   |
+------------+------------+
| body...                  |
+--------------------------+
```

字段长度：

| 字段 | 长度 | 类型 | 说明 |
|---|---:|---|---|
| `opcode` | 1B | uint8 | 控制操作类型 |
| `flags` | 1B | uint8 bitmap | 控制消息标志 |
| `controlId` | 2B | uint16 | 控制消息序号，用于请求/响应匹配 |
| `statusCode` | 2B | uint16 | 控制操作状态码 |
| `bodyEncoding` | 1B | uint8 enum | body 编码方式 |
| `bodyLen` | 2B | uint16 | body 长度 |
| `body` | N | bytes | 控制负载 |

固定头长度：

```text
9 Bytes
```

注意：这 9 字节是 Control Payload 内部头，不是 AXTP Frame Header。

### 5.2 Compact Control Payload

Compact Control Payload 用于 BLE、USB HID、UART、低端 MCU 等低带宽场景。

结构：

```text
+------------+------------+
| opcode     | controlId  |
+------------+------------+
| body...                  |
+--------------------------+
```

字段长度：

| 字段 | 长度 | 类型 | 说明 |
|---|---:|---|---|
| `opcode` | 1B | uint8 | 控制操作类型 |
| `controlId` | 1B | uint8 | 控制消息序号 |
| `body` | N | bytes | 默认按 TLV 解析 |

Compact 模式下约定：

```text
bodyEncoding = TLV
bodyLen      = Frame.payloadLength - 2
statusCode   = 如需表达，使用 TLV 字段携带
flags        = 如需表达，使用 TLV 字段携带
```

Compact Control Payload 固定头长度：

```text
2 Bytes
```

### 5.3 两种形态的选择

| 传输 | 推荐 Control Payload |
|---|---|
| TCP | Standard |
| WebSocket Binary | Standard |
| USB Bulk | Standard |
| Debug Tool | Standard |
| USB HID | Compact |
| BLE | Compact |
| UART | Compact |
| 低端 MCU | Compact |

MVP 阶段建议：

```text
高带宽实现 Standard；
低带宽实现 Compact；
协议栈内部统一映射为同一个 ControlMessage 结构。
```

---

## 6. 字节序与基础编码

除非后续 Type System 文档另有规定，AXTP Control v0.1 默认采用：

```text
整数：Little Endian
字符串：UTF-8
布尔值：0x00 = false，0x01 = true
枚举：uint8 或 uint16
bitmap：低 bit 表示低编号能力
TLV：type:uint8 + length:uint8 + value:bytes
```

说明：

```text
1. 协议线上编码固定，不随 CPU host endian 变化；
2. C++ SDK 必须在 encode/decode 时显式处理 endian；
3. Generator 生成的代码不得直接 memcpy 结构体到线上数据；
4. 所有多字节字段都必须通过 read_u16 / write_u16 / read_u32 / write_u32 等函数处理。
```

---

## 7. Control Opcode Registry

### 7.1 Opcode 表

| opcode | 名称 | 方向 | 是否有 body | 是否 MVP 必须 | 说明 |
|---:|---|---|---|---|---|
| `0x00` | `RESERVED` | - | 否 | 是 | 保留，不得使用 |
| `0x01` | `HELLO` | Client -> Peer | 是 | 是 | 发起协议会话 |
| `0x02` | `HELLO_ACK` | Peer -> Client | 是 | 是 | 返回协商结果 |
| `0x03` | `HEARTBEAT` | 双向 | 可选 | 是 | 心跳保活 |
| `0x04` | `HEARTBEAT_ACK` | 双向 | 可选 | 是 | 心跳响应 |
| `0x05` | `ACK` | 双向 | 是 | 是 | 确认 Frame / Message / Stream Chunk / Control |
| `0x06` | `NACK` | 双向 | 是 | 是 | 否认或请求重传 |
| `0x07` | `RESUME` | Client -> Peer | 是 | P1 | 会话恢复 |
| `0x08` | `RESUME_ACK` | Peer -> Client | 是 | P1 | 会话恢复响应 |
| `0x09` | `CLOSE` | 双向 | 可选 | 是 | 主动关闭会话 |
| `0x0A` | `CLOSE_ACK` | 双向 | 可选 | 是 | 关闭确认 |
| `0x0B` | `SESSION_RESET` | 双向 | 是 | 是 | 重置会话 |
| `0x0C` | `WINDOW_UPDATE` | 双向 | 是 | P1 | 更新接收窗口 |
| `0x0D` | `PING` | 双向 | 可选 | P1 | 延迟与链路探测 |
| `0x0E` | `PONG` | 双向 | 可选 | P1 | 链路探测响应 |
| `0x0F` | `GOAWAY` | 双向 | 可选 | P2 | 拒绝新消息，准备关闭 |
| `0x10-0x6F` | `RESERVED` | - | - | - | 标准扩展保留 |
| `0x70-0x7E` | `EXPERIMENTAL` | - | 可选 | 否 | 实验用途，不保证兼容 |
| `0x7F` | `VENDOR` | 双向 | 是 | 否 | 厂商私有控制信令 |

### 7.2 HEARTBEAT 与 PING 的区别

`HEARTBEAT` 用于保活：

```text
我还在线
连接未断
Session 仍有效
```

`PING` 用于链路测量：

```text
测 RTT
测链路延迟
测抖动
可携带 timestamp / nonce
```

MVP 阶段可以只实现 HEARTBEAT / HEARTBEAT_ACK。PING / PONG 可在 P1 阶段实现。

---

## 8. Control Result Flags

Standard Control Payload 中的 `flags` 字段只表达 Control Payload 自身的结果和处理提示，不映射到 Frame Header。AXTP v1 Frame Header 没有 Flags 字段。

| bit | 名称 | 说明 |
|---:|---|---|
| 0 | `SUCCESS` | 控制操作成功 |
| 1 | `ERROR` | 控制操作失败 |
| 2 | `HAS_BODY` | 存在 body |
| 3 | `RETRYABLE` | 该错误或操作可重试 |
| 4 | `URGENT` | 高优先级控制消息 |
| 5 | `ACK_REQUIRED` | 对端应返回 Control ACK |
| 6 | `RESERVED` | 保留 |
| 7 | `RESERVED` | 保留 |

Compact Control Payload 没有固定 `flags` 字段。如果需要表达 flags，使用 TLV 字段 `controlFlags`。

---

## 9. Control StatusCode

`statusCode` 用于表达控制操作结果。它不是业务 ErrorCode，但应与全局 ErrorCode 注册表共享大类编号，便于 SDK 统一处理。

### 9.1 推荐状态码范围

| 范围 | 名称 | 说明 |
|---:|---|---|
| `0x0000` | `NONE` | 无状态，通常用于请求 |
| `0x0064` | `SUCCESS` | 成功，十进制 100 |
| `0x0100-0x01FF` | `FRAME_ERROR` | Frame 层错误 |
| `0x0200-0x02FF` | `CONTROL_ERROR` | Control 协议错误 |
| `0x0300-0x03FF` | `SESSION_ERROR` | Session 错误 |
| `0x0400-0x04FF` | `NEGOTIATION_ERROR` | 协商错误 |
| `0x0500-0x05FF` | `ACK_ERROR` | ACK/NACK 相关错误 |
| `0x0600-0x06FF` | `RESUME_ERROR` | 会话恢复错误 |
| `0x0700-0x07FF` | `FLOW_CONTROL_ERROR` | 流控错误 |
| `0x7000-0x7FFF` | `VENDOR_ERROR` | 厂商私有错误 |

### 9.2 MVP 状态码

MVP 阶段建议至少实现：

| statusCode | 名称 | 说明 |
|---:|---|---|
| `0x0000` | `NONE` | 请求或无需状态 |
| `0x0064` | `SUCCESS` | 成功 |
| `0x0201` | `UNSUPPORTED_OPCODE` | 不支持的控制 Opcode |
| `0x0202` | `MALFORMED_CONTROL_PAYLOAD` | Control Payload 格式错误 |
| `0x0203` | `UNSUPPORTED_BODY_ENCODING` | 不支持的 bodyEncoding |
| `0x0301` | `SESSION_NOT_READY` | 会话未就绪 |
| `0x0302` | `INVALID_SESSION` | Session 无效 |
| `0x0401` | `VERSION_NOT_SUPPORTED` | 协议版本不支持 |
| `0x0402` | `PROFILE_NOT_SUPPORTED` | Header Profile 不支持 |
| `0x0403` | `NO_COMMON_PAYLOAD_TYPE` | 无共同 PayloadType |
| `0x0404` | `NO_COMMON_RPC_ENCODING` | 无共同 RPC 编码 |
| `0x0501` | `UNKNOWN_MESSAGE_ID` | 未知 MessageId |
| `0x0502` | `MISSING_FRAGMENT` | 缺失分片 |
| `0x0503` | `CRC_ERROR` | CRC 校验失败 |
| `0x0601` | `RESUME_TOKEN_INVALID` | Resume Token 无效 |
| `0x0701` | `WINDOW_OVERFLOW` | 流控窗口溢出 |

---

## 10. Control BodyEncoding

Standard Control Payload 使用 `bodyEncoding` 表示 body 编码方式。

| bodyEncoding | 名称 | 说明 | MVP |
|---:|---|---|---|
| `0x00` | `NONE` | 无 body | 是 |
| `0x01` | `TLV` | type-length-value 编码 | 是 |
| `0x02` | `FIXED_STRUCT` | 固定结构体编码 | 否 |
| `0x03` | `CBOR` | CBOR 编码 | 否 |
| `0x7F` | `VENDOR` | 厂商私有编码 | 否 |

MVP 阶段要求：

```text
1. 必须支持 NONE；
2. 必须支持 TLV；
3. 可以暂不支持 FIXED_STRUCT / CBOR / VENDOR；
4. 如果收到不支持的 bodyEncoding，必须返回 NACK 或 CONTROL ERROR。
```

Compact Control Payload 默认使用 TLV，不携带 bodyEncoding 字段。

---

## 11. Control TLV 基础结构

Control TLV 采用短 TLV 结构：

```text
+---------+---------+---------+
| type    | length  | value   |
+---------+---------+---------+
```

字段：

| 字段 | 长度 | 类型 | 说明 |
|---|---:|---|---|
| `type` | 1B | uint8 | 字段编号 |
| `length` | 1B | uint8 | value 长度 |
| `value` | N | bytes | 字段值 |

### 11.1 扩展长度

当 `length < 0xFF` 时：

```text
length = value 实际长度
```

当 `length = 0xFF` 时：

```text
后接 uint16 extendedLength
再接 value
```

结构：

```text
+---------+---------+----------------+---------+
| type    | 0xFF    | extendedLength | value   |
+---------+---------+----------------+---------+
```

MVP 阶段可以先不使用扩展长度，但 Parser 必须能识别 `0xFF` 并在不支持时返回格式错误，而不是误解析。

### 11.2 未知 TLV 字段处理

ControlParser 遇到未知 TLV 字段时：

```text
1. 如果字段位于标准保留范围，必须跳过；
2. 如果字段位于 vendor 范围，必须跳过；
3. 不得因为未知字段直接断开连接；
4. 如果字段长度越界，必须返回 MALFORMED_CONTROL_PAYLOAD。
```

### 11.3 重复 TLV 字段处理

Control Payload 的 TLV 解析默认使用 **strict mode**：

```text
非 repeated 字段重复出现 → 返回 MALFORMED_CONTROL_PAYLOAD，拒绝整个 Control Payload。
```

理由：Control Payload 承载协议协商参数（MTU、窗口大小、版本、ACK 目标等），"后者覆盖前者"的宽松策略会给有缺陷的实现或恶意构造的包提供覆盖协商结果的机会。

只有在 `06-TLV-Schema编码规范` 中显式标记 `repeated=true` 的字段才允许重复出现。当前允许重复的字段：

```text
supportedPayloadTypes   （bitmap，通常用单字段表达，不需要重复）
supportedRpcEncodings   （bitmap）
missingRanges           （NACK 中的缺失范围列表）
vendorData              （厂商私有扩展）
```

MVP 阶段推荐尽量使用 bitmap 字段，避免需要 repeated 语义。

---

## 12. Control TLV 字段注册表

### 12.1 通用字段

| TLV type | 名称 | 类型 | 说明 | MVP |
|---:|---|---|---|---|
| `0x01` | `sessionId` | uint32 | 会话 ID，仅绑定 Session Context | 是 |
| `0x02` | `protocolVersion` | uint8 | AXTP 协议版本 | 是 |
| `0x03` | `headerProfile` | uint8 | Standard / Compact | 是 |
| `0x04` | `maxFrameSize` | uint16 / uint32 | 最大 Frame 长度 | 是 |
| `0x05` | `maxPayloadSize` | uint16 | 最大 Payload 长度 | P1 |
| `0x06` | `mtu` | uint16 | 底层传输 MTU | 是 |
| `0x07` | `supportedPayloadTypes` | bitmap | 支持的 PayloadType | 是 |
| `0x08` | `supportedRpcEncodings` | bitmap | 支持的 RPC 编码 | 是 |
| `0x09` | `reserved` | - | 历史 `supportedStreamProfiles`，不得在新实现中使用 | 否 |
| `0x0A` | `heartbeatIntervalMs` | uint16 / uint32 | 心跳间隔 | 是 |
| `0x0B` | `ackMode` | uint8 | ACK 模式 | 是 |
| `0x0C` | `windowSize` | uint16 | 滑动窗口大小 | P1 |
| `0x0D` | `compression` | bitmap | 压缩能力 | P2 |
| `0x0E` | `encryption` | bitmap | 加密能力 | P2 |
| `0x0F` | `timestamp` | uint64 | 时间戳 | P1 |
| `0x10` | `reasonCode` | uint16 | 原因码 | 是 |
| `0x11` | `messageId` | uint16 | 被确认或引用的 MessageId | 是 |
| `0x12` | `frameIndex` | uint8 | 被确认或引用的 FrameIndex | 是 |
| `0x13` | `frameCount` | uint8 | 分片总数 | P1 |
| `0x14` | `missingRanges` | bytes | 缺失分片范围 | P1 |
| `0x15` | `streamId` | uint32 | 流 ID | P1 |
| `0x16` | `seqId` | uint32 | Stream Chunk 序号 | P1 |
| `0x17` | `offset` | uint64 | 文件 / OTA 偏移 | P1 |
| `0x18` | `resumeToken` | bytes | 恢复令牌 | P1 |
| `0x19` | `errorDetail` | string / bytes | 错误详情 | P1 |
| `0x1A` | `controlFlags` | uint8 bitmap | Compact Control 中携带 flags | P1 |
| `0x1B` | `statusCode` | uint16 | Compact Control 中携带 statusCode | 是 |
| `0x1C` | `nonce` | bytes | PING / PONG 随机数 | P1 |
| `0x1D` | `rttMs` | uint16 / uint32 | 往返延迟 | P2 |
| `0x1E` | `selectedRpcEncoding` | uint8 | 协商后的 RPC 编码 | 是 |
| `0x1F` | `reserved` | - | 历史 `selectedStreamProfileMask`，不得在新实现中使用 | 否 |

### 12.2 ACK/NACK 相关字段

| TLV type | 名称 | 类型 | 说明 | MVP |
|---:|---|---|---|---|
| `0x20` | `targetType` | uint8 | ACK/NACK 目标类型 | 是 |
| `0x21` | `targetOpcode` | uint8 | 目标 Control Opcode | P1 |
| `0x22` | `targetControlId` | uint16 / uint8 | 目标 ControlId | P1 |
| `0x23` | `retryAfterMs` | uint16 / uint32 | 建议重试时间 | P1 |
| `0x24` | `receivedCount` | uint16 / uint32 | 已接收数量 | P2 |
| `0x25` | `expectedCount` | uint16 / uint32 | 期望数量 | P2 |

### 12.3 Vendor 字段

| TLV type | 名称 | 类型 | 说明 |
|---:|---|---|---|
| `0x70-0x7E` | `experimental` | bytes | 实验字段 |
| `0x7F` | `vendorData` | bytes | 厂商私有字段 |

---

### 12.4 sessionId 携带规则

`sessionId` 只在 Control Session Context 中出现，由 HELLO_ACK 分配，并在 RESUME/CLOSE/SESSION_RESET 等会话类 Control 消息中引用。

普通 RPC 与 STREAM 业务帧不得在 Frame Header、RPC Header 或 STREAM L2 Header 中重复携带 `sessionId`。接收端根据当前连接绑定的 Session Context 解释后续业务交互；连接恢复后，RESUME 成功即重新绑定同一个 Session Context。

MVP 阶段 `sessionId` 固定使用 uint32。未来若需要 bytes 类型 Session ID，必须通过新的 capability 或协议版本协商，不得在同一 Profile 中混用。

---

## 13. Bitmap 编码规则

### 13.1 PayloadType Bitmap

`payloadType` 编号如下：

```text
CONTROL = 0x01
RPC     = 0x02
STREAM  = 0x03
```

Bitmap 位定义：

| bit | PayloadType |
|---:|---|
| 0 | CONTROL |
| 1 | RPC |
| 2 | STREAM |

示例：

```text
0b0000_0111 = 0x07 = 支持 CONTROL / RPC / STREAM
```

### 13.2 RPC Encoding Bitmap

| bit | rpcEncoding |
|---:|---|
| 0 | JSON |
| 1 | BINARY |
| 2 | CBOR |
| 3 | MSGPACK |
| 4 | FIXED_STRUCT |

示例：

```text
0x03 = JSON / BINARY
```

`TLV / RAW_BYTES` 属于 RPC Body Encoding，不属于 RPC Encoding。二进制 RPC 的推荐组合是 `rpcEncoding = BINARY + bodyEncoding = TLV`。

### 13.3 Stream Profile Capability

Stream Profile 能力不再使用大类 bitmap 协商。设备应通过 `capability.*` 或 `stream.profile.*` 返回具体 Profile ID 列表，例如：

```text
0x0101 = firmware.ota
0x0201 = file.upload
0x0202 = file.download
0x0401 = log.realtime
0x1001 = media.video
0x3001 = control.hid_raw
```

STREAM packet 本身只携带 `streamId / seqId / cursor / data`，Profile 只在建流控制面和本地 Stream Context 中存在。

---

## 14. ACK TargetType

ACK / NACK 必须明确确认目标。

| targetType | 名称 | 说明 |
|---:|---|---|
| `0x01` | `FRAME` | 确认某个 Frame 分片 |
| `0x02` | `MESSAGE` | 确认完整 Message |
| `0x03` | `STREAM_CHUNK` | 确认 Stream Chunk |
| `0x04` | `CONTROL` | 确认某条 Control 信令 |
| `0x05` | `SESSION` | 确认 Session 操作 |
| `0x7F` | `VENDOR` | 厂商私有目标 |

MVP 必须支持：

```text
FRAME
MESSAGE
CONTROL
```

P1 支持：

```text
STREAM_CHUNK
SESSION
```

---

## 15. ACK Mode

`ackMode` 用于 HELLO 协商后确定默认确认策略。

| ackMode | 名称 | 说明 |
|---:|---|---|
| `0x00` | `NONE` | 默认不确认 |
| `0x01` | `FRAME_ACK` | 按 Frame 确认 |
| `0x02` | `MESSAGE_ACK` | 按完整 Message 确认 |
| `0x03` | `STREAM_CHUNK_ACK` | 按 Stream Chunk 确认 |
| `0x04` | `SELECTIVE_ACK` | 选择性确认 / 缺失范围 |
| `0x05` | `RESERVED` | 历史按 Frame 标志自动确认模式，新实现不得使用 |

MVP 推荐：

```text
ackMode = MESSAGE_ACK
```

低带宽场景可采用：

```text
重要控制帧：Control flags.ACK_REQUIRED 或 Control ACK 目标
普通 HEARTBEAT：不强制 ACK，使用 HEARTBEAT_ACK 即可
STREAM OTA：P1 阶段再启用 STREAM_CHUNK_ACK
```

---

## 16. 会话状态机

### 16.1 状态定义

```text
DISCONNECTED
  ↓
TRANSPORT_CONNECTED
  ↓
HELLO_SENT / HELLO_RECEIVED
  ↓
SESSION_READY
  ↓
CLOSING
  ↓
CLOSED
```

如果支持恢复：

```text
SESSION_READY
  ↓ transport lost
SUSPENDED
  ↓ RESUME
SESSION_READY
```

如果发生严重错误：

```text
ANY_STATE
  ↓ SESSION_RESET
TRANSPORT_CONNECTED or CLOSED
```

### 16.2 状态说明

| 状态 | 说明 |
|---|---|
| `DISCONNECTED` | 底层连接不存在 |
| `TRANSPORT_CONNECTED` | TCP/BLE/HID/UART 等传输已建立 |
| `HELLO_SENT` | 已发送 HELLO，等待 HELLO_ACK |
| `HELLO_RECEIVED` | 已收到 HELLO，准备返回 HELLO_ACK |
| `SESSION_READY` | Control 协商完成，可发送 RPC / STREAM |
| `SUSPENDED` | 底层连接中断，但 session 可尝试恢复 |
| `CLOSING` | 正在关闭 |
| `CLOSED` | 已关闭 |

### 16.3 状态约束

在进入 `SESSION_READY` 前：

```text
允许：
  CONTROL HELLO
  CONTROL HELLO_ACK
  CONTROL CLOSE
  CONTROL SESSION_RESET

不建议允许：
  RPC
  STREAM
```

### 16.4 状态机失败路径测试向量

实现必须至少覆盖以下状态机失败路径：

| 场景 | 当前状态 | 输入 | 期望结果 |
|---|---|---|---|
| 未协商即收到 RPC | `TRANSPORT_CONNECTED` / `HELLO_SENT` | `PayloadType=RPC` | 返回或记录 `SESSION_NOT_READY`，不得进入 RPC Parser |
| 未协商即收到 STREAM | `TRANSPORT_CONNECTED` / `HELLO_SENT` | `PayloadType=STREAM` | 返回或记录 `SESSION_NOT_READY`，不得进入 STREAM Parser |
| 不支持的协议版本 | `HELLO_RECEIVED` | HELLO `protocolVersion` 不支持 | HELLO_ACK with `Control flags.ERROR` + `UNSUPPORTED_VERSION` |
| Profile 无公共交集 | `HELLO_RECEIVED` | `headerProfile` 无法协商 | HELLO_ACK with `Control flags.ERROR` + `UNSUPPORTED_HEADER_PROFILE` |
| sessionId 过期 | `SUSPENDED` | RESUME with expired `sessionId` | RESUME_ACK with `Control flags.ERROR` + `INVALID_SESSION` |
| resumeToken 无效 | `SUSPENDED` | RESUME with invalid `resumeToken` | RESUME_ACK with `Control flags.ERROR` + `RESUME_TOKEN_INVALID` |
| 关闭中收到业务帧 | `CLOSING` | RPC / STREAM | 拒绝业务帧，维持关闭流程 |
| 已关闭后收到业务帧 | `CLOSED` | RPC / STREAM | 丢弃或返回 transport-level close，不恢复 Session |

如果在 `SESSION_READY` 前收到 RPC / STREAM：

```text
必须丢弃或返回 SESSION_NOT_READY。
```

---

## 17. HELLO / HELLO_ACK

### 17.1 HELLO 目的

`HELLO` 用于建立 AXTP Session，并协商协议运行时能力。

HELLO 协商的是协议能力，不是业务能力。

协议能力包括：

```text
protocolVersion
headerProfile
maxFrameSize
mtu
supportedPayloadTypes
supportedRpcEncodings
heartbeatIntervalMs
ackMode
windowSize
```

业务能力不在 HELLO 中协商，例如：

```text
是否支持 brightness.set
是否支持 firmware.update
是否支持 H265
是否支持某个 methodId
```

业务能力必须在进入 `SESSION_READY` 后通过 RPC 查询：

```text
capability.getAll
capability.getDomain
capability.hasMethod
```

### 17.2 HELLO 请求字段

HELLO body 推荐携带：

| 字段 | TLV | 是否必须 | 说明 |
|---|---:|---|---|
| `protocolVersion` | `0x02` | 是 | AXTP 协议版本 |
| `headerProfile` | `0x03` | 是 | 当前期望使用的 Header Profile |
| `maxFrameSize` | `0x04` | 是 | 发送方最大 Frame 长度 |
| `mtu` | `0x06` | 是 | 传输 MTU |
| `supportedPayloadTypes` | `0x07` | 是 | 支持的 PayloadType bitmap |
| `supportedRpcEncodings` | `0x08` | 是 | 支持的 RPC Encoding bitmap |
| `heartbeatIntervalMs` | `0x0A` | 是 | 建议心跳间隔 |
| `ackMode` | `0x0B` | 是 | 建议 ACK 模式 |
| `windowSize` | `0x0C` | P1 | 建议窗口大小 |

### 17.3 HELLO_ACK 响应字段

HELLO_ACK body 推荐携带：

| 字段 | TLV | 是否必须 | 说明 |
|---|---:|---|---|
| `sessionId` | `0x01` | 是 | 分配的 sessionId |
| `protocolVersion` | `0x02` | 是 | 选定协议版本 |
| `headerProfile` | `0x03` | 是 | 选定 Header Profile |
| `maxFrameSize` | `0x04` | 是 | 协商后的最大 Frame |
| `mtu` | `0x06` | 是 | 协商后的 MTU |
| `supportedPayloadTypes` | `0x07` | 是 | 双方共同支持的 PayloadType |
| `selectedRpcEncoding` | `0x1E` | 是 | 默认 RPC Encoding |
| `heartbeatIntervalMs` | `0x0A` | 是 | 协商后的心跳间隔 |
| `ackMode` | `0x0B` | 是 | 协商后的 ACK 模式 |
| `windowSize` | `0x0C` | P1 | 协商后的窗口大小 |
| `resumeToken` | `0x18` | P1 | 可用于恢复的 token |

### 17.4 HELLO 示例

Standard Control Payload：

```text
opcode       = 0x01    // HELLO
flags        = 0x04    // HAS_BODY
controlId    = 0x0001
statusCode   = 0x0000
bodyEncoding = 0x01    // TLV
bodyLen      = N
```

Body TLV：

```text
02 01 01        // protocolVersion = 1
03 01 02        // headerProfile = Compact
04 02 00 02     // maxFrameSize = 512, little endian: 0x0200
06 02 F7 00     // mtu = 247
07 01 07        // supportedPayloadTypes = CONTROL/RPC/STREAM
08 01 03        // supportedRpcEncodings = JSON/BINARY
                // Stream Profile 列表通过 RPC capability.* 查询
0A 02 E8 03     // heartbeatIntervalMs = 1000
0B 01 02        // ackMode = MESSAGE_ACK
```

### 17.5 HELLO_ACK 示例

Standard Control Payload：

```text
opcode       = 0x02    // HELLO_ACK
flags        = 0x05    // SUCCESS | HAS_BODY
controlId    = 0x0001
statusCode   = 0x0064  // SUCCESS
bodyEncoding = 0x01    // TLV
bodyLen      = N
```

Body TLV：

```text
01 04 78 56 34 12     // sessionId = 0x12345678
02 01 01              // protocolVersion = 1
03 01 02              // selected headerProfile = Compact
04 02 F4 01           // negotiated maxFrameSize = 500
06 02 F7 00           // negotiated mtu = 247
07 01 07              // payloadTypes = CONTROL/RPC/STREAM
1E 01 02              // selectedRpcEncoding = BINARY
0A 02 E8 03           // heartbeatIntervalMs = 1000
0B 01 02              // ackMode = MESSAGE_ACK
```

### 17.6 HELLO 失败

如果无法协商，应返回 HELLO_ACK，将 `Control flags.ERROR` bit 置 1，并填写 statusCode。

示例：

```text
opcode       = HELLO_ACK
flags        = Control flags.ERROR | Control flags.HAS_BODY
controlId    = 原 HELLO controlId
statusCode   = VERSION_NOT_SUPPORTED
body:
  reasonCode
  errorDetail
```

如果连 Control Payload 都无法解析，可以直接断开底层连接。

**协商失败的完整处理规则：**

| 失败原因 | statusCode | 接收端动作 | 发送端动作 |
| --- | --- | --- | --- |
| Header Version 不支持 | `VERSION_NOT_SUPPORTED` | 返回 HELLO_ACK(ERROR)，断开连接 | 降级重试或放弃 |
| headerProfile 不支持 | `PROFILE_NOT_SUPPORTED` | 返回 HELLO_ACK(ERROR)，body 中填写支持的 profile 列表 | 改用对端支持的 profile 重新 HELLO |
| payloadType 集合无交集 | `NO_COMMON_PAYLOAD_TYPE` | 返回 HELLO_ACK(ERROR) | 放弃连接 |
| rpcEncoding 集合无交集 | `NO_COMMON_RPC_ENCODING` | 返回 HELLO_ACK(ERROR)，body 中填写支持的 encoding 列表 | 改用对端支持的 encoding 重新 HELLO |
| MTU 协商结果不满足最小要求 | `MTU_TOO_SMALL` | 返回 HELLO_ACK(ERROR) | 放弃连接或切换传输 |
| HELLO 格式非法（无法解析） | — | 直接断开底层连接，不发送任何响应 | — |

协商降级规则：

```text
1. Server 收到 HELLO 后，从 Client 提供的列表中选择自身支持的最优选项；
2. 如果某个字段 Client 未提供（可选字段），Server 使用自身默认值；
3. 如果必选字段无法协商，返回 HELLO_ACK(ERROR) 并在 body 中说明原因；
4. Client 收到 HELLO_ACK(ERROR) 后，可根据 body 中的提示调整参数重新发起 HELLO，
   最多重试 3 次，超过后断开连接。
```

---

## 18. HEARTBEAT / HEARTBEAT_ACK

### 18.1 HEARTBEAT 目的

HEARTBEAT 用于保活和检测 Session 是否仍然有效。

HEARTBEAT 不用于精确测量延迟；如需测量延迟，使用 PING/PONG。

### 18.2 HEARTBEAT 请求

HEARTBEAT 可无 body：

```text
opcode       = 0x03
flags        = 0x00
controlId    = 自增
statusCode   = 0x0000
bodyEncoding = NONE
bodyLen      = 0
```

也可携带 timestamp：

```text
0F 08 xx xx xx xx xx xx xx xx
```

### 18.3 HEARTBEAT_ACK 响应

HEARTBEAT_ACK 必须使用相同 controlId：

```text
opcode       = 0x04
controlId    = HEARTBEAT.controlId
statusCode   = SUCCESS
```

### 18.4 心跳超时

推荐规则：

```text
连续 N 次 HEARTBEAT 未收到 HEARTBEAT_ACK，则认为连接异常。
```

MVP 推荐：

```text
heartbeatIntervalMs = 1000 ~ 5000
missThreshold = 3
```

具体值由设备能力和传输稳定性决定。

---

## 19. ACK

### 19.1 ACK 目的

ACK 用于确认对端发送的对象已收到或已处理。

ACK 可以确认：

```text
Frame
Message
Control
Stream Chunk
Session 操作
```

### 19.2 ACK 触发规则

Frame Header 不表达确认请求。接收方是否发送 CONTROL ACK 由以下信息决定：

```text
1. HELLO / HELLO_ACK 协商得到的 ackMode；
2. Control Payload 中的 ACK_REQUIRED 语义；
3. RPC 或 STREAM 建立时协商的业务可靠性策略。
```

ACK 的目标由 body 中的 `targetType` 指定。若确认 Compact Frame 中的 MessageId，Control ACK body 使用 uint16 字段承载该值，并按 uint8 wire 值零扩展。

### 19.3 ACK Frame 示例

确认某个 Frame：

```text
opcode       = 0x05    // ACK
flags        = 0x04    // HAS_BODY
controlId    = 0x0002
statusCode   = 0x0064  // SUCCESS
bodyEncoding = TLV
```

Body TLV：

```text
20 01 01        // targetType = FRAME
11 02 7B 00     // messageId = 123
12 02 03 00     // frameIndex = 3
```

确认完整 Message：

```text
20 01 02        // targetType = MESSAGE
11 02 7B 00     // messageId = 123
```

确认 Control：

```text
20 01 04        // targetType = CONTROL
21 01 01        // targetOpcode = HELLO
22 02 01 00     // targetControlId = 1
```

### 19.4 ACK 是否表示业务成功

ACK 不表示业务方法执行成功。

例如：

```text
RPC brightness.set Frame 被 ACK
```

只表示该 Frame 或 Message 已收到，不表示 brightness.set 成功。

业务执行结果必须由：

```text
PayloadType = RPC
rpcOp = RESPONSE
statusCode = ...
```

表达。

---

## 20. NACK

### 20.1 NACK 目的

NACK 用于表达接收失败、校验失败、缺失分片、无法解析或希望对端重传。

### 20.2 NACK 示例

CRC 错误：

```text
opcode       = 0x06    // NACK
flags        = Control flags.ERROR | Control flags.HAS_BODY
controlId    = 0x0003
statusCode   = CRC_ERROR
bodyEncoding = TLV
```

Body TLV：

```text
20 01 01        // targetType = FRAME
11 02 7B 00     // messageId = 123
12 02 03 00     // frameIndex = 3
10 02 03 05     // reasonCode = CRC_ERROR, 示例
```

缺失分片：

```text
20 01 02        // targetType = MESSAGE
11 02 7B 00     // messageId = 123
14 04 03 00 05 00 // missingRanges = frame 3 to 5
```

### 20.3 NACK 后的行为

收到 NACK 后，发送方应根据目标类型处理：

| targetType | 推荐处理 |
|---|---|
| `FRAME` | 重传指定 frameIndex |
| `MESSAGE` | 重传缺失分片或整条 Message |
| `STREAM_CHUNK` | 根据 Stream 策略重传或跳过 |
| `CONTROL` | 重发控制信令或关闭会话 |
| `SESSION` | 重新 HELLO 或 SESSION_RESET |

MVP 阶段可以只支持：

```text
FRAME NACK
MESSAGE NACK
CONTROL NACK
```

---

## 21. RESUME / RESUME_ACK

### 21.1 RESUME 目的

RESUME 用于 BLE 重连、USB 重插、Wi-Fi 短暂中断等场景下恢复逻辑会话。

RESUME 是 P1 能力，MVP 可以先保留字段但不实现完整恢复。

### 21.2 RESUME 请求字段

| 字段 | TLV | 说明 |
|---|---:|---|
| `sessionId` | `0x01` | 要恢复的 session |
| `resumeToken` | `0x18` | HELLO_ACK 或历史会话中获得的恢复 token |
| `messageId` | `0x11` | 最后确认的 MessageId，可选 |
| `streamId` | `0x15` | 要恢复的 Stream，可选 |
| `seqId` | `0x16` | 最后确认的 Stream seqId，可选 |
| `offset` | `0x17` | 文件 / OTA 偏移，可选 |

### 21.3 RESUME 示例

```text
opcode       = 0x07    // RESUME
flags        = HAS_BODY
controlId    = 0x0004
statusCode   = NONE
bodyEncoding = TLV
```

Body TLV：

```text
01 04 78 56 34 12              // sessionId
18 08 xx xx xx xx xx xx xx xx  // resumeToken
15 04 09 00 00 00              // streamId = 9
16 04 A1 02 00 00              // lastSeqId = 673
17 08 00 00 10 00 00 00 00 00  // offset = 1048576
```

### 21.4 RESUME_ACK 响应

成功：

```text
opcode       = 0x08
flags        = SUCCESS | HAS_BODY
controlId    = RESUME.controlId
statusCode   = SUCCESS
```

Body TLV 可返回：

```text
sessionId
windowSize
messageId
streamId
seqId
offset
```

失败：

```text
statusCode = RESUME_TOKEN_INVALID / INVALID_SESSION
```

失败后客户端应重新走 HELLO。

---

## 22. CLOSE / CLOSE_ACK

### 22.1 CLOSE 目的

CLOSE 用于有序关闭 AXTP Session。

CLOSE 可以由任意一方发起。

### 22.2 CLOSE 字段

CLOSE 可无 body，也可携带 reasonCode：

```text
10 02 01 00     // reasonCode = NORMAL_CLOSE
```

推荐 reasonCode：

| reasonCode | 名称 | 说明 |
|---:|---|---|
| `0x0001` | `NORMAL_CLOSE` | 正常关闭 |
| `0x0002` | `IDLE_TIMEOUT` | 空闲超时 |
| `0x0003` | `PROTOCOL_ERROR` | 协议错误 |
| `0x0004` | `AUTH_REQUIRED` | 需要认证 |
| `0x0005` | `DEVICE_REBOOTING` | 设备重启 |
| `0x0006` | `TRANSPORT_LOST` | 底层连接断开 |
| `0x0007` | `UPGRADE_REQUIRED` | 需要升级协议或固件 |

### 22.3 CLOSE_ACK

收到 CLOSE 后，应返回 CLOSE_ACK：

```text
opcode       = 0x0A
controlId    = CLOSE.controlId
statusCode   = SUCCESS
```

随后双方可以关闭底层连接。

### 22.4 异常关闭

如果发生严重解析错误、CRC 错误过多、状态机混乱，可以直接发送 SESSION_RESET 或断开连接。

---

## 23. SESSION_RESET

### 23.1 SESSION_RESET 目的

SESSION_RESET 用于强制重置当前 AXTP Session。

典型场景：

```text
协议状态机异常
对端发送非法序列
连续解析失败
协商参数不可接受
安全策略要求重置
```

### 23.2 SESSION_RESET 字段

应携带：

```text
reasonCode
errorDetail 可选
```

示例：

```text
opcode       = 0x0B
flags        = Control flags.ERROR | Control flags.HAS_BODY
controlId    = 自增
statusCode   = SESSION_NOT_READY / INVALID_SESSION / MALFORMED_CONTROL_PAYLOAD
bodyEncoding = TLV
```

Body：

```text
10 02 03 00              // reasonCode = PROTOCOL_ERROR
19 0E 62 61 64 20 ...    // errorDetail = "bad state"
```

收到 SESSION_RESET 后：

```text
1. 清理 session 状态；
2. 丢弃未完成 Message；
3. 关闭或回到 TRANSPORT_CONNECTED；
4. 如需继续通信，重新 HELLO。
```

---

## 24. WINDOW_UPDATE

### 24.1 WINDOW_UPDATE 目的

WINDOW_UPDATE 用于流控，尤其适合：

```text
STREAM OTA
STREAM FILE
STREAM LOG
高吞吐 MEDIA
```

MVP 阶段可以不实现，P1 实现。

### 24.2 WINDOW_UPDATE 字段

| 字段 | TLV | 说明 |
|---|---:|---|
| `targetType` | `0x20` | MESSAGE 或 STREAM_CHUNK |
| `streamId` | `0x15` | 对应 Stream |
| `seqId` | `0x16` | 当前已处理 seqId |
| `windowSize` | `0x0C` | 新窗口大小 |
| `offset` | `0x17` | 文件 / OTA 已处理偏移 |

示例：

```text
20 01 03        // targetType = STREAM_CHUNK
15 04 09 00 00 00
16 04 A1 02 00 00
0C 02 08 00     // windowSize = 8
```

---

## 25. PING / PONG

### 25.1 PING 目的

PING / PONG 用于链路质量探测，不是保活的唯一机制。

PING 可携带：

```text
timestamp
nonce
```

PONG 应原样返回 nonce，并可携带 rttMs。

### 25.2 PING 示例

```text
opcode       = 0x0D
flags        = HAS_BODY
controlId    = 自增
bodyEncoding = TLV
```

Body：

```text
0F 08 xx xx xx xx xx xx xx xx   // timestamp
1C 04 11 22 33 44               // nonce
```

### 25.3 PONG 示例

```text
opcode       = 0x0E
controlId    = PING.controlId
statusCode   = SUCCESS
```

Body：

```text
1C 04 11 22 33 44
1D 02 1E 00     // rttMs = 30
```

---

## 26. Standard 与 Compact 的互操作

### 26.1 内部抽象

无论线上使用 Standard 还是 Compact，协议栈内部建议统一为：

```cpp
struct ControlMessage {
    uint8_t opcode;
    uint8_t flags;
    uint16_t controlId;
    uint16_t statusCode;
    uint8_t bodyEncoding;
    std::vector<Tlv> body;
};
```

Compact 解码时：

```text
flags        = 从 TLV controlFlags 读取，默认 0
statusCode   = 从 TLV statusCode 读取，请求默认 NONE，响应默认 SUCCESS 或 NONE
bodyEncoding = TLV
controlId    = uint8 扩展为 uint16
```

### 26.2 controlId 空间

Standard：

```text
controlId = uint16
```

Compact：

```text
controlId = uint8
```

Compact controlId 回绕规则：

```text
1. controlId 允许 0x01-0xFF 循环；
2. 0x00 可保留为“不需要匹配”；
3. 同一时间未完成 Control 请求数量不得超过 controlId 空间；
4. 对于 BLE/HID，建议最多同时挂起 1-4 条 Control 请求。
```

---

## 27. Control 分片规则

原则上 CONTROL Payload 应尽量小，不建议产生分片。

但在以下场景可能需要分片：

```text
HELLO 携带大量扩展能力；
errorDetail 很长；
vendorData 很大；
未来安全握手携带证书或公钥；
```

如果 Control Payload 超过单个 Frame 能力：

```text
使用 AXTP Frame Fragment 机制；
同一条 Control Message 的所有分片共享同一个 Frame.messageId；
Control Payload 只有在完整重组后才交给 ControlParser；
ACK/NACK 可以针对 Frame 或完整 Message。
```

MVP 阶段建议限制：

```text
Control Payload 不超过单 Frame；
超过则返回 NACK / MALFORMED_CONTROL_PAYLOAD 或协商更大的 maxFrameSize。
```

---

## 28. Control 安全边界

Control 是协议运行时入口，必须严格校验。

### 28.1 必须校验

```text
payloadLength 是否足够；
opcode 是否支持；
bodyLen 是否越界；
TLV length 是否越界；
HELLO 是否出现在合法状态；
HELLO_ACK 是否匹配 HELLO；
controlId 是否匹配；
statusCode 是否合法；
协商参数是否可接受；
窗口大小是否超过本地限制；
maxFrameSize 是否超过实现上限；
mtu 是否合理；
```

### 28.2 不得信任的字段

以下字段均来自对端，不得直接信任：

```text
maxFrameSize
maxPayloadSize
windowSize
heartbeatIntervalMs
errorDetail
vendorData
resumeToken
offset
seqId
```

实现必须有本地上限。

### 28.3 推荐本地限制

MVP 推荐：

```text
maxControlPayloadSize <= 512 Bytes
maxTlvCount <= 64
maxErrorDetailSize <= 128 Bytes
maxVendorDataSize <= 128 Bytes
minHeartbeatIntervalMs >= 500
maxHeartbeatIntervalMs <= 60000
```

---

## 29. 与 RPC / STREAM 的关系

### 29.1 CONTROL 与 RPC

CONTROL 建立 Session 后，RPC 才能承载业务命令。

示例流程：

```text
CONTROL HELLO
CONTROL HELLO_ACK
RPC capability.getAll
RPC device.getInfo
RPC brightness.set
```

CONTROL 不直接承载：

```text
capability.getAll
device.getInfo
brightness.set
```

### 29.2 CONTROL 与 STREAM

STREAM 通常由 RPC 控制打开，再由 STREAM 传输数据，再由 RPC 或 CONTROL 处理状态。

示例 OTA：

```text
RPC firmware.begin
STREAM OTA chunk
CONTROL ACK / NACK
RPC firmware.verify
RPC firmware.apply
```

CONTROL 只负责传输确认、窗口、恢复等运行时问题，不解释 OTA 业务语义。

---

## 30. 老协议适配建议

如果老协议中存在：

```text
HELLO
PING
ACK
NACK
RESET
```

可映射到 AXTP CONTROL Opcode。

如果老协议中存在：

```text
CmdValue = 获取设备信息
CmdValue = 设置亮度
CmdValue = 开始升级
```

这些不应映射到 CONTROL，而应映射到：

```text
PayloadType = RPC
methodId = old CmdValue 或新的 methodId
```

如果老协议中存在：

```text
OTA data block
file data block
log stream
video raw data
```

这些应映射到：

```text
RPC 建流:
  profile = firmware.ota / file.upload / file.download / log.realtime / media.video
  -> streamId

STREAM packet:
  streamId / seqId / cursor / data
```

迁移原则：

```text
老协议的链路控制命令 -> CONTROL
老协议的业务命令     -> RPC
老协议的数据块       -> STREAM
```

---

## 31. MVP 实现范围

### 31.1 MVP 必须实现的 Opcode

```text
HELLO
HELLO_ACK
HEARTBEAT
HEARTBEAT_ACK
ACK
NACK
CLOSE
CLOSE_ACK
SESSION_RESET
```

### 31.2 MVP 可暂缓的 Opcode

```text
RESUME
RESUME_ACK
WINDOW_UPDATE
PING
PONG
GOAWAY
VENDOR
```

### 31.3 MVP 必须实现的 BodyEncoding

```text
NONE
TLV
```

### 31.4 MVP 必须实现的 TLV

```text
sessionId
protocolVersion
headerProfile
maxFrameSize
mtu
supportedPayloadTypes
supportedRpcEncodings
heartbeatIntervalMs
ackMode
reasonCode
messageId
frameIndex
targetType
statusCode
```

### 31.5 MVP 必须支持的目标确认

```text
targetType = FRAME
targetType = MESSAGE
targetType = CONTROL
```

### 31.6 MVP 可以不支持

```text
完整会话恢复
滑动窗口流控
STREAM_CHUNK_ACK
CBOR Control Body
控制消息分片
压缩协商
加密协商
PING/PONG RTT 测量
```

---

## 32. C++ Parser 推荐流程

### 32.1 Frame 层

```text
1. 读取 Frame Header；
2. 校验 magic/version/profile；
3. 检查 payloadType；
4. 检查 payloadLength；
5. 校验 CRC；
6. 如为分片，先重组；
7. payloadType = CONTROL 时调用 ControlParser。
```

### 32.2 ControlParser

```text
1. 根据当前 Header Profile 判断 Standard / Compact Control Payload；
2. 解析 opcode；
3. 检查 opcode 是否支持；
4. 解析 controlId；
5. Standard 模式解析 flags/statusCode/bodyEncoding/bodyLen；
6. Compact 模式默认 bodyEncoding = TLV；
7. 检查 bodyLen 是否越界；
8. 若 bodyEncoding = TLV，解析 TLV 列表；
9. 根据 opcode 校验必填字段；
10. 进入 Control State Machine；
11. 生成响应或触发状态变化。
```

### 32.3 错误处理

如果 ControlParser 发现错误：

| 错误 | 推荐处理 |
|---|---|
| opcode 不支持 | 返回 NACK 或 CONTROL ERROR |
| bodyEncoding 不支持 | 返回 NACK |
| TLV 越界 | 返回 NACK，严重时 SESSION_RESET |
| HELLO 参数不可接受 | 返回 HELLO_ACK ERROR |
| 非法状态下收到 RPC | 返回 SESSION_NOT_READY 或丢弃 |
| 连续错误过多 | SESSION_RESET 或关闭连接 |

---

## 33. 测试向量建议

后续测试向量文档至少应覆盖：

```text
1. Standard HELLO
2. Standard HELLO_ACK
3. Compact HELLO
4. Compact HELLO_ACK
5. HEARTBEAT / HEARTBEAT_ACK
6. ACK Frame
7. ACK Message
8. NACK CRC_ERROR
9. CLOSE / CLOSE_ACK
10. SESSION_RESET
11. Unsupported Opcode
12. Malformed TLV
13. Unsupported BodyEncoding
14. Session Not Ready
```

每个测试向量应包含：

```text
Frame Header 字段
Control Payload 字段
完整 Hex
期望解析结果
期望状态变化
期望错误码
```

---

## 34. 实现验收标准

一个实现只有满足以下条件，才认为支持 AXTP CONTROL MVP：

```text
1. 能解析 Standard 或 Compact Control Payload；
2. 能完成 HELLO / HELLO_ACK；
3. 能进入 SESSION_READY；
4. 能定期发送并响应 HEARTBEAT；
5. 能发送和处理 ACK / NACK；
6. 能有序 CLOSE / CLOSE_ACK；
7. 能处理 SESSION_RESET；
8. 能拒绝非法 opcode；
9. 能拒绝格式错误的 TLV；
10. 能在未 ready 时阻止 RPC / STREAM；
11. 能按协商的 ackMode 和 Control ACK_REQUIRED 语义返回 ACK；
12. 能通过测试向量验证。
```

---

## 35. 版本与兼容策略

### 35.1 新增 Opcode

新增标准 Opcode 应使用：

```text
0x10-0x6F
```

新增前必须更新：

```text
Control Opcode Registry
Control 测试向量
Generator 常量
C++ enum
```

### 35.2 新增 TLV 字段

新增 TLV 字段必须保证：

```text
旧 Parser 可以跳过未知字段；
不得改变已有字段语义；
不得复用 deprecated 字段；
vendor 字段不得进入标准字段范围。
```

### 35.3 修改 Control Payload Header

如果修改 Standard 或 Compact Control Payload 固定头布局，必须升级 AXTP Header Version。

如果只是新增 TLV 字段或新增 Opcode，不需要升级 Frame Header Version。

---

## 36. 总结

AXTP CONTROL 是协议运行时控制面，不是业务命令层。

它的核心职责是：

```text
建立会话
协商协议能力
保持连接
确认和否认传输对象
支持恢复
支持关闭
支持流控
保护状态机
```

最终结构可以概括为：

```text
Frame Header
  payloadType = CONTROL
  payloadLength = Control Payload Length

Control Payload
  opcode
  controlId
  statusCode
  bodyEncoding
  TLV body
```

MVP 阶段必须优先跑通：

```text
HELLO / HELLO_ACK
HEARTBEAT / HEARTBEAT_ACK
ACK / NACK
CLOSE / CLOSE_ACK
SESSION_RESET
```

在此基础上，RPC 和 STREAM 才能稳定落地。
