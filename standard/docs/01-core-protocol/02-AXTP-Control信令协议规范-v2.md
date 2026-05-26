# 02《AXTP Control 信令协议规范》

版本：v0.2 Draft  
状态：MVP Control 子协议规范（精简版）  
适用范围：`PayloadType = CONTROL` 的 Payload 结构、Opcode、TLV 字段、会话建连、心跳、ACK/NACK、恢复、关闭、流控  
前置文档：01《AXTP 整体协议规范》  
后续文档：03《AXTP RPC 协议与二进制映射规范》、04《AXTP Stream 流式传输协议规范》

---

## 1. 文档目的

本文档定义 `PayloadType = CONTROL` 时的 Payload 内部结构、Opcode 语义、TLV 字段、会话状态机和 MVP 实现范围。

`PayloadType = CONTROL` 不是"没有 Payload"。Frame Payload 必须交给 ControlParser 解析，结构为：

```text
opcode / controlId / statusCode / bodyEncoding / TLV body
```

CONTROL 只负责协议运行时控制面（建连、心跳、ACK/NACK、恢复、关闭、流控），不承载业务命令。业务命令使用 `PayloadType = RPC`，连续数据使用 `PayloadType = STREAM`。

---

## 2. Control Payload 结构

### 2.1 Standard Control Payload（9B 固定头）

| 字段 | 偏移 | 长度 | 类型 | 说明 |
|---|---:|---:|---|---|
| `opcode` | 0 | 1B | uint8 | 控制操作类型 |
| `flags` | 1 | 1B | uint8 bitmap | 控制消息标志 |
| `controlId` | 2 | 2B | uint16 | 请求/响应匹配序号 |
| `statusCode` | 4 | 2B | uint16 | 控制操作状态码 |
| `bodyEncoding` | 6 | 1B | uint8 enum | body 编码方式 |
| `bodyLen` | 7 | 2B | uint16 | body 长度 |
| `body` | 9 | N | bytes | 控制负载 |

### 2.2 Compact Control Payload（2B 固定头）

| 字段 | 偏移 | 长度 | 类型 | 说明 |
|---|---:|---:|---|---|
| `opcode` | 0 | 1B | uint8 | 控制操作类型 |
| `controlId` | 1 | 1B | uint8 | 请求/响应匹配序号 |
| `body` | 2 | N | bytes | 默认按 TLV 解析 |

Compact 约定：`bodyEncoding = TLV`，`bodyLen = Frame.payloadLength - 2`，`statusCode` 和 `flags` 通过 TLV 字段携带。

### 2.3 Profile 选择

| 传输 | 推荐 Control Payload |
|---|---|
| TCP / WebSocket Binary / USB Bulk | Standard |
| BLE / USB HID / UART / 低端 MCU | Compact |

---

## 3. Control Flags（Standard 专用）

| bit | 名称 | 说明 |
|---:|---|---|
| 0 | `SUCCESS` | 控制操作成功 |
| 1 | `ERROR` | 控制操作失败 |
| 2 | `HAS_BODY` | 存在 body |
| 3 | `RETRYABLE` | 可重试 |
| 4 | `URGENT` | 高优先级 |
| 5 | `ACK_REQUIRED` | 对端应返回 Control ACK |
| 6-7 | `RESERVED` | 保留，置 0 |

Compact 无固定 flags 字段，需要时使用 TLV `0x1A controlFlags`。

---

## 4. Control Opcode Registry

| opcode | 名称 | 方向 | body | MVP | 说明 |
|---:|---|---|---|---|---|
| `0x00` | `RESERVED` | - | 否 | 是 | 不得使用 |
| `0x01` | `OPEN` | Client→Peer | 是 | 是 | 发起协议会话 |
| `0x02` | `ACCEPT` | Peer→Client | 是 | 是 | 返回协商结果 |
| `0x03` | `HEARTBEAT` | 双向 | 可选 | 是 | 心跳保活 |
| `0x04` | `HEARTBEAT_ACK` | 双向 | 可选 | 是 | 心跳响应 |
| `0x05` | `ACK` | 双向 | 是 | 是 | 确认 Frame/Message/Stream Chunk/Control |
| `0x06` | `NACK` | 双向 | 是 | 是 | 否认或请求重传 |
| `0x07` | `RESUME` | Client→Peer | 是 | P1 | 会话恢复 |
| `0x08` | `RESUME_ACK` | Peer→Client | 是 | P1 | 会话恢复响应 |
| `0x09` | `CLOSE` | 双向 | 可选 | 是 | 主动关闭会话 |
| `0x0A` | `CLOSE_ACK` | 双向 | 可选 | 是 | 关闭确认 |
| `0x0B` | `SESSION_RESET` | 双向 | 是 | 是 | 强制重置会话 |
| `0x0C` | `WINDOW_UPDATE` | 双向 | 是 | P1 | 更新接收窗口 |
| `0x0D` | `PING` | 双向 | 可选 | P1 | 延迟与链路探测 |
| `0x0E` | `PONG` | 双向 | 可选 | P1 | 链路探测响应 |
| `0x0F` | `GOAWAY` | 双向 | 可选 | P2 | 拒绝新消息，准备关闭 |
| `0x10-0x6F` | `RESERVED` | - | - | - | 标准扩展保留 |
| `0x70-0x7E` | `EXPERIMENTAL` | - | 可选 | 否 | 实验用途 |
| `0x7F` | `VENDOR` | 双向 | 是 | 否 | 厂商私有 |

HEARTBEAT 用于保活（我还在线），PING 用于 RTT 测量（可携带 timestamp/nonce）。MVP 只需实现 HEARTBEAT/HEARTBEAT_ACK。

---

## 5. Control StatusCode

| 范围 | 类别 |
|---:|---|
| `0x0000` | NONE（请求或无需状态） |
| `0x0064` | SUCCESS |
| `0x0100-0x01FF` | FRAME_ERROR |
| `0x0200-0x02FF` | CONTROL_ERROR |
| `0x0300-0x03FF` | SESSION_ERROR |
| `0x0400-0x04FF` | NEGOTIATION_ERROR |
| `0x0500-0x05FF` | ACK_ERROR |
| `0x0600-0x06FF` | RESUME_ERROR |
| `0x0700-0x07FF` | FLOW_CONTROL_ERROR |
| `0x7000-0x7FFF` | VENDOR_ERROR |

MVP 必须实现的状态码：

| statusCode | 名称 |
|---:|---|
| `0x0000` | `NONE` |
| `0x0064` | `SUCCESS` |
| `0x0201` | `UNSUPPORTED_OPCODE` |
| `0x0202` | `MALFORMED_CONTROL_PAYLOAD` |
| `0x0203` | `UNSUPPORTED_BODY_ENCODING` |
| `0x0301` | `SESSION_NOT_READY` |
| `0x0302` | `INVALID_SESSION` |
| `0x0401` | `VERSION_NOT_SUPPORTED` |
| `0x0402` | `PROFILE_NOT_SUPPORTED` |
| `0x0403` | `NO_COMMON_PAYLOAD_TYPE` |
| `0x0404` | `NO_COMMON_RPC_ENCODING` |
| `0x0501` | `UNKNOWN_MESSAGE_ID` |
| `0x0502` | `MISSING_FRAGMENT` |
| `0x0503` | `CRC_ERROR` |
| `0x0601` | `RESUME_TOKEN_INVALID` |
| `0x0701` | `WINDOW_OVERFLOW` |

---

## 6. Control BodyEncoding

| bodyEncoding | 名称 | MVP |
|---:|---|---|
| `0x00` | `NONE` | 是 |
| `0x01` | `TLV` | 是 |
| `0x02` | `FIXED_STRUCT` | 否 |
| `0x03` | `CBOR` | 否 |
| `0x7F` | `VENDOR` | 否 |

收到不支持的 bodyEncoding 必须返回 NACK 或 CONTROL ERROR。Compact 默认 TLV，不携带此字段。

---

## 7. Control TLV 结构

短 TLV：`type(1B) + length(1B) + value(N)`。

当 `length = 0xFF` 时，后接 `uint16 extendedLength` 再接 value（扩展长度）。MVP 可暂不使用扩展长度，但 Parser 必须识别 `0xFF` 并在不支持时返回格式错误。

未知 TLV 字段必须跳过，不得断开连接。非 repeated 字段重复出现必须返回 `MALFORMED_CONTROL_PAYLOAD`（strict mode）。

### 7.1 通用 TLV 字段

| TLV type | 名称 | 类型 | MVP |
|---:|---|---|---|
| `0x01` | `sessionId` | uint32 | 是 |
| `0x02` | `protocolVersion` | uint8 | 是 |
| `0x03` | `headerProfile` | uint8 | 是 |
| `0x04` | `maxFrameSize` | uint16/uint32 | 是 |
| `0x05` | `maxPayloadSize` | uint16 | P1 |
| `0x06` | `mtu` | uint16 | 是 |
| `0x07` | `supportedPayloadTypes` | bitmap | 是 |
| `0x08` | `supportedRpcEncodings` | bitmap | 是 |
| `0x09` | `reserved` | - | 否（历史字段，不得使用） |
| `0x0A` | `heartbeatIntervalMs` | uint16/uint32 | 是 |
| `0x0B` | `ackMode` | uint8 | 是 |
| `0x0C` | `windowSize` | uint16 | P1 |
| `0x0D` | `compression` | bitmap | P2 |
| `0x0E` | `encryption` | bitmap | P2 |
| `0x0F` | `timestamp` | uint64 | P1 |
| `0x10` | `reasonCode` | uint16 | 是 |
| `0x11` | `messageId` | uint16 | 是 |
| `0x12` | `frameIndex` | uint8 | 是 |
| `0x13` | `frameCount` | uint8 | P1 |
| `0x14` | `missingRanges` | bytes | P1 |
| `0x15` | `streamId` | uint32 | P1 |
| `0x16` | `seqId` | uint32 | P1 |
| `0x17` | `offset` | uint64 | P1 |
| `0x18` | `resumeToken` | bytes | P1 |
| `0x19` | `errorDetail` | string/bytes | P1 |
| `0x1A` | `controlFlags` | uint8 bitmap | P1 |
| `0x1B` | `statusCode` | uint16 | 是 |
| `0x1C` | `nonce` | bytes | P1 |
| `0x1D` | `rttMs` | uint16/uint32 | P2 |
| `0x1E` | `selectedRpcEncoding` | uint8 | 是 |
| `0x1F` | `reserved` | - | 否（历史字段，不得使用） |

### 7.2 ACK/NACK 相关字段

| TLV type | 名称 | 类型 | MVP |
|---:|---|---|---|
| `0x20` | `targetType` | uint8 | 是 |
| `0x21` | `targetOpcode` | uint8 | P1 |
| `0x22` | `targetControlId` | uint16/uint8 | P1 |
| `0x23` | `retryAfterMs` | uint16/uint32 | P1 |
| `0x24` | `receivedCount` | uint16/uint32 | P2 |
| `0x25` | `expectedCount` | uint16/uint32 | P2 |

### 7.3 Vendor 字段

| TLV type | 名称 |
|---:|---|
| `0x70-0x7E` | `experimental` |
| `0x7F` | `vendorData` |

---

## 8. Bitmap 编码

### 8.1 PayloadType Bitmap

| bit | PayloadType |
|---:|---|
| 0 | CONTROL |
| 1 | RPC |
| 2 | STREAM |

示例：`0x07` = 支持 CONTROL/RPC/STREAM。

### 8.2 RPC Encoding Bitmap

| bit | rpcEncoding |
|---:|---|
| 0 | JSON |
| 1 | BINARY |
| 2 | CBOR |
| 3 | MSGPACK |
| 4-31 | RESERVED |

示例：`0x03` = JSON/BINARY。TLV/RAW_BYTES 属于 RPC Body Encoding，不属于此 bitmap。

### 8.3 Stream Profile 能力

Stream Profile 不使用 bitmap 协商，通过 `capability.*` 或 `stream.profile.*` 返回具体 Profile ID 列表。STREAM packet 只携带 `streamId/seqId/cursor/data`，Profile 只在建流控制面和本地 Stream Context 中存在。

---

## 9. ACK TargetType

| targetType | 名称 | MVP |
|---:|---|---|
| `0x01` | `FRAME` | 是 |
| `0x02` | `MESSAGE` | 是 |
| `0x03` | `STREAM_CHUNK` | P1 |
| `0x04` | `CONTROL` | 是 |
| `0x05` | `SESSION` | P1 |
| `0x7F` | `VENDOR` | 否 |

---

## 10. ACK Mode

| ackMode | 名称 | 说明 |
|---:|---|---|
| `0x00` | `NONE` | 默认不确认 |
| `0x01` | `FRAME_ACK` | 按 Frame 确认 |
| `0x02` | `MESSAGE_ACK` | 按完整 Message 确认（MVP 推荐） |
| `0x03` | `STREAM_CHUNK_ACK` | 按 Stream Chunk 确认 |
| `0x04` | `SELECTIVE_ACK` | 选择性确认/缺失范围 |
| `0x05` | `RESERVED` | 历史模式，新实现不得使用 |

ACK 触发由 OPEN 协商的 ackMode 和 Control `ACK_REQUIRED` flag 决定，Frame Header 不表达确认请求。

---

## 11. 会话状态机

```text
DISCONNECTED → TRANSPORT_CONNECTED → OPEN_SENT/OPEN_RECEIVED → SESSION_READY → CLOSING → CLOSED

SESSION_READY → (transport lost) → SUSPENDED → (RESUME) → SESSION_READY

ANY_STATE → (SESSION_RESET) → TRANSPORT_CONNECTED or CLOSED
```

SESSION_READY 前只允许 CONTROL OPEN/ACCEPT/CLOSE/SESSION_RESET，不得处理 RPC/STREAM。

`sessionId` 由 ACCEPT 分配，只在 RESUME/CLOSE/SESSION_RESET 等会话类 Control 消息中引用。普通 RPC 与 STREAM 帧不携带 sessionId。

---

## 12. OPEN / ACCEPT

OPEN 协商协议运行时能力，不协商业务能力。业务能力在 SESSION_READY 后通过 `capability.getAll` 查询。

### 12.1 OPEN 请求字段

| 字段 | TLV | 必须 |
|---|---:|---|
| `protocolVersion` | `0x02` | 是 |
| `headerProfile` | `0x03` | 是 |
| `maxFrameSize` | `0x04` | 是 |
| `mtu` | `0x06` | 是 |
| `supportedPayloadTypes` | `0x07` | 是 |
| `supportedRpcEncodings` | `0x08` | 是 |
| `heartbeatIntervalMs` | `0x0A` | 是 |
| `ackMode` | `0x0B` | 是 |
| `windowSize` | `0x0C` | P1 |

### 12.2 ACCEPT 响应字段

| 字段 | TLV | 必须 |
|---|---:|---|
| `sessionId` | `0x01` | 是 |
| `protocolVersion` | `0x02` | 是 |
| `headerProfile` | `0x03` | 是 |
| `maxFrameSize` | `0x04` | 是 |
| `mtu` | `0x06` | 是 |
| `supportedPayloadTypes` | `0x07` | 是 |
| `selectedRpcEncoding` | `0x1E` | 是 |
| `heartbeatIntervalMs` | `0x0A` | 是 |
| `ackMode` | `0x0B` | 是 |
| `windowSize` | `0x0C` | P1 |
| `resumeToken` | `0x18` | P1 |

### 12.3 OPEN 示例（Standard）

```text
opcode=0x01 flags=0x04 controlId=0x0001 statusCode=0x0000 bodyEncoding=0x01

Body TLV:
02 01 01        // protocolVersion = 1
03 01 02        // headerProfile = Compact
04 02 00 02     // maxFrameSize = 512
06 02 F7 00     // mtu = 247
07 01 07        // supportedPayloadTypes = CONTROL/RPC/STREAM
08 01 03        // supportedRpcEncodings = JSON/BINARY
0A 02 E8 03     // heartbeatIntervalMs = 1000
0B 01 02        // ackMode = MESSAGE_ACK
```

### 12.4 ACCEPT 示例（Standard）

```text
opcode=0x02 flags=0x05 controlId=0x0001 statusCode=0x0064 bodyEncoding=0x01

Body TLV:
01 04 78 56 34 12  // sessionId = 0x12345678
02 01 01           // protocolVersion = 1
03 01 02           // headerProfile = Compact
04 02 F4 01        // maxFrameSize = 500
06 02 F7 00        // mtu = 247
07 01 07           // payloadTypes = CONTROL/RPC/STREAM
1E 01 02           // selectedRpcEncoding = BINARY
0A 02 E8 03        // heartbeatIntervalMs = 1000
0B 01 02           // ackMode = MESSAGE_ACK
```

### 12.5 协商失败处理

| 失败原因 | statusCode | 处理 |
|---|---|---|
| Header Version 不支持 | `VERSION_NOT_SUPPORTED` | 返回 ACCEPT(ERROR)，断开连接 |
| headerProfile 不支持 | `PROFILE_NOT_SUPPORTED` | 返回 ACCEPT(ERROR)，body 填写支持列表 |
| payloadType 无交集 | `NO_COMMON_PAYLOAD_TYPE` | 返回 ACCEPT(ERROR) |
| rpcEncoding 无交集 | `NO_COMMON_RPC_ENCODING` | 返回 ACCEPT(ERROR)，body 填写支持列表 |
| MTU 不满足最小要求 | `MTU_TOO_SMALL` | 返回 ACCEPT(ERROR) |
| OPEN 格式非法 | — | 直接断开，不发响应 |

Client 收到 ACCEPT(ERROR) 后可根据 body 调整参数重试，最多 3 次。

---

## 13. HEARTBEAT / HEARTBEAT_ACK

HEARTBEAT 可无 body，也可携带 `timestamp(0x0F)`。HEARTBEAT_ACK 必须使用相同 controlId，statusCode = SUCCESS。

推荐：`heartbeatIntervalMs = 1000~5000`，连续 3 次未收到 HEARTBEAT_ACK 则认为连接异常。

---

## 14. ACK / NACK

ACK 确认 Frame/Message/Control/Stream Chunk 已收到，不表示业务执行成功。业务结果由 `PayloadType=RPC, rpcOp=RESPONSE` 表达。

ACK 示例（确认 Frame）：
```text
opcode=0x05 flags=0x04 controlId=0x0002 statusCode=0x0064 bodyEncoding=TLV
Body: 20 01 01 / 11 02 7B 00 / 12 02 03 00  // targetType=FRAME, messageId=123, frameIndex=3
```

NACK 示例（CRC 错误）：
```text
opcode=0x06 flags=ERROR|HAS_BODY controlId=0x0003 statusCode=CRC_ERROR bodyEncoding=TLV
Body: 20 01 01 / 11 02 7B 00 / 12 02 03 00 / 10 02 03 05
```

收到 NACK 后：FRAME → 重传指定 frameIndex；MESSAGE → 重传缺失分片；CONTROL → 重发或关闭会话。

---

## 15. RESUME / RESUME_ACK（P1）

RESUME 用于 BLE 重连、USB 重插等场景恢复逻辑会话。MVP 可保留字段但不实现完整恢复。

RESUME 请求字段：`sessionId(0x01)`, `resumeToken(0x18)`, `messageId(0x11)`, `streamId(0x15)`, `seqId(0x16)`, `offset(0x17)`。

RESUME_ACK 成功返回 `sessionId/windowSize/messageId/streamId/seqId/offset`；失败返回 `RESUME_TOKEN_INVALID` 或 `INVALID_SESSION`，客户端应重新 OPEN。

---

## 16. CLOSE / CLOSE_ACK

CLOSE 可无 body，也可携带 `reasonCode(0x10)`：

| reasonCode | 名称 |
|---:|---|
| `0x0001` | `NORMAL_CLOSE` |
| `0x0002` | `IDLE_TIMEOUT` |
| `0x0003` | `PROTOCOL_ERROR` |
| `0x0004` | `AUTH_REQUIRED` |
| `0x0005` | `DEVICE_REBOOTING` |
| `0x0006` | `TRANSPORT_LOST` |
| `0x0007` | `UPGRADE_REQUIRED` |

CLOSE_ACK 使用相同 controlId，statusCode = SUCCESS。严重错误可直接发 SESSION_RESET 或断开连接。

---

## 17. SESSION_RESET

SESSION_RESET 用于强制重置会话（协议状态机异常、连续解析失败、安全策略要求等）。

应携带 `reasonCode` 和可选 `errorDetail`。收到后：清理 session 状态，丢弃未完成 Message，关闭或回到 TRANSPORT_CONNECTED，如需继续通信重新 OPEN。

---

## 18. WINDOW_UPDATE（P1）

用于 STREAM OTA/FILE/LOG 等高吞吐场景的流控。字段：`targetType(0x20)`, `streamId(0x15)`, `seqId(0x16)`, `windowSize(0x0C)`, `offset(0x17)`。

---

## 19. Control 分片规则

CONTROL Payload 应尽量小，不建议分片。如超过单帧容量，使用 AXTP Frame Fragment 机制，完整重组后才交给 ControlParser。

MVP 建议限制 Control Payload 不超过单 Frame；超过则返回 NACK 或协商更大的 maxFrameSize。

---

## 20. 安全边界

必须校验：payloadLength 是否足够、opcode 是否支持、bodyLen 是否越界、TLV length 是否越界、OPEN 是否出现在合法状态、controlId 是否匹配、协商参数是否可接受。

以下字段来自对端，不得直接信任，必须有本地上限：`maxFrameSize`, `windowSize`, `heartbeatIntervalMs`, `errorDetail`, `vendorData`, `resumeToken`, `offset`, `seqId`。

MVP 推荐本地限制：
```text
maxControlPayloadSize <= 512B
maxTlvCount <= 64
maxErrorDetailSize <= 128B
minHeartbeatIntervalMs >= 500
maxHeartbeatIntervalMs <= 60000
```

---

## 21. MVP 实现范围

### 21.1 必须实现的 Opcode

```text
OPEN / ACCEPT / HEARTBEAT / HEARTBEAT_ACK / ACK / NACK / CLOSE / CLOSE_ACK / SESSION_RESET
```

### 21.2 可暂缓的 Opcode

```text
RESUME / RESUME_ACK / WINDOW_UPDATE / PING / PONG / GOAWAY / VENDOR
```

### 21.3 必须实现的 TLV

```text
sessionId / protocolVersion / headerProfile / maxFrameSize / mtu
supportedPayloadTypes / supportedRpcEncodings / heartbeatIntervalMs / ackMode
reasonCode / messageId / frameIndex / targetType / statusCode / selectedRpcEncoding
```

### 21.4 可暂不实现

```text
完整会话恢复 / 滑动窗口流控 / STREAM_CHUNK_ACK / CBOR Control Body
控制消息分片 / 压缩协商 / 加密协商 / PING/PONG RTT 测量
```

---

## 22. 版本与兼容策略

新增标准 Opcode 使用 `0x10-0x6F` 范围，新增前必须更新 Control Opcode Registry、Generator 常量和 C++ enum。

新增 TLV 字段必须保证旧 Parser 可跳过未知字段，不得改变已有字段语义，不得复用 deprecated 字段。

修改 Standard 或 Compact Control Payload 固定头布局必须升级 AXTP Header Version；新增 TLV 字段或 Opcode 不需要升级。

---

## 23. 与后续文档的关系

| 文档 | 关系 |
|---|---|
| 03《RPC 协议》 | CONTROL 建立 Session 后，RPC 才能承载业务命令 |
| 04《Stream 协议》 | STREAM 由 RPC 打开，CONTROL ACK/NACK/WINDOW_UPDATE 负责传输确认和流控 |
| Registry | CONTROL 不进入 Method Registry，业务命令通过 RPC 查询 capability |
