# 1-core/05《AXTP Control Session Spec》

> Status: AXTP v1 Core Freeze Candidate
> Spec Version: 1.0.0-rc1
> Change Policy: Clarification-only before v1.0.0
> Scope: Core wire format / state machine / compatibility rules

版本：v1.0.0-rc1
状态：AXTP v1 Core Freeze Candidate
适用范围：`PayloadType = CONTROL` 的 Payload 结构、Opcode、TLV 字段、会话建连、心跳、关闭，以及预留的 ACK/NACK、恢复、流控
前置文档：`docs/specs/1-core/02-Protocol-Framework.md`、`docs/specs/1-core/03-Frame-and-Payload.md`、`docs/specs/1-core/04-Transport-Profiles.md`
后续文档：`docs/specs/1-core/06-RPC-Session.md`、`docs/specs/1-core/07-Stream-Data-Plane.md`

---

## 0. 速读：CONTROL 怎么在线上传

CONTROL 只存在于 Standard Framed 路径，用来建立 AXTP Framed Link Context、保活和关闭。业务命令不走 CONTROL，连续数据也不走 CONTROL。

```text
Standard Frame Header(payloadType=CONTROL)
  + Control Payload = opcode(1) + controlId(2) + statusCode(2) + TLV body(N)
  + CRC16(2)
```

Control Payload 固定头是 5B。`Frame.payloadLength` 包含这 5B 和后续 TLV body，因此：

```text
controlBodyLength = Frame.payloadLength - 5
```

OPEN / ACCEPT 建立的是传输方向上的 AXTP Framed Link Context，不决定谁是 Logical Server。RPC Hello 仍由 Logical Server 发送。

```mermaid
sequenceDiagram
    participant PC as Physical Client
    participant PS as Physical Server
    participant LC as Logical Client
    participant LS as Logical Server

    Note over PC,PS: Transport connected
    PC->>PS: CONTROL OPEN (payloadType=CONTROL, opcode=0x01)
    PS-->>PC: CONTROL ACCEPT (opcode=0x02, selectedRpcEncoding, optional sessionId)
    Note over PC,PS: FRAMING_READY
    LS-->>LC: RPC Hello
    LC->>LS: RPC Identify
    LS-->>LC: RPC Identified
```

ACK / NACK 也是 CONTROL Payload，不是 Frame Header 字段。Phase 1 只保留 opcode 和 TLV 字段，不要求 runtime 实现重传机制：

```text
ACK frame:
  Frame(payloadType=CONTROL)
  Control Payload(opcode=ACK, controlId, statusCode=SUCCESS)
  TLV body: targetType + messageId + frameIndex

NACK frame:
  Frame(payloadType=CONTROL)
  Control Payload(opcode=NACK, controlId, statusCode=<errorCode>)
  TLV body: targetType + messageId + frameIndex + optional reason/detail
```

WebSocket Unframed JSON 没有 CONTROL OPEN / ACCEPT / HEARTBEAT / CLOSE，也不参与 ACK/NACK 或 RESUME。

---

## 1. 文档目的

本文档定义 `PayloadType = CONTROL` 时的 Payload 内部结构、Opcode 语义、TLV 字段、会话状态机和 MVP 实现范围。

`PayloadType = CONTROL` 不是"没有 Payload"。Frame Payload 必须交给 ControlParser 解析，结构为：

```text
opcode / controlId / statusCode / TLV body
```

CONTROL 只负责协议运行时控制面（建连、心跳、关闭，以及后续预留的 ACK/NACK、恢复、流控），不承载业务命令。业务命令使用 `PayloadType = RPC`，连续数据使用 `PayloadType = STREAM`。

---

## 2. Control Payload 结构

### 2.1 统一 Control Payload（5B 固定头）

所有传输场景使用同一套 Control Payload 结构，不再区分 Standard/Compact：

| 字段 | 偏移 | 长度 | 类型 | 说明 |
|---|---:|---:|---|---|
| `opcode` | 0 | 1B | uint8 | 控制操作类型 |
| `controlId` | 1 | 2B | uint16 | 请求/响应匹配序号，Little-Endian |
| `statusCode` | 3 | 2B | uint16 | 控制操作状态码，`0x0000 = SUCCESS`，Little-Endian |
| `body` | 5 | N | bytes | TLV 编码，长度 = `Frame.payloadLength - 5` |

**设计说明：**

- `bodyEncoding` 字段已移除：Control body 固定 TLV，无需运行时切换编码
- `bodyLen` 字段已移除：body 长度从 Frame `payloadLength` 反推，不重复携带
- `flags` 字段已移除：`ACK_REQUIRED` 等语义通过 OPEN 协商的 `ackMode` 全局确定，不需要 per-frame 标志
- `controlId` 使用 uint16（0–65535），满足并发 Control 消息匹配需求
- `statusCode` 使用 uint16，直接复用 ErrorCode Registry（最高值 `0x7FFF`），成功时填 `0x0000`
- body 为空时 `Frame.payloadLength = 5`，不携带任何 TLV 字节

---

## 3. Control Opcode Registry

| opcode | 名称 | 方向 | body | MVP | 说明 |
| ---: | --- | --- | --- | --- | --- |
| `0x00` | `RESERVED` | - | 否 | 是 | 不得使用 |
| `0x01` | `OPEN` | Client→Server | 是 | 是 | 发起协议会话 |
| `0x02` | `ACCEPT` | Server→Client | 是 | 是 | 返回协商结果 |
| `0x03` | `READY` | Client→Server | 可选 | 预留 | 三步协商预留：Client 已应用 ACCEPT 参数并准备接收后续 AXTP 帧 |
| `0x04` | `HEARTBEAT` | 双向 | 可选 | 是 | 心跳保活 |
| `0x05` | `HEARTBEAT_ACK` | 双向 | 可选 | 是 | 心跳响应 |
| `0x06` | `ACK` | 双向 | 是 | 预留 | 确认 Frame/Message/Stream Chunk/Control；Phase 1 不实现严格重传 |
| `0x07` | `NACK` | 双向 | 是 | 预留 | 否认或请求重传；Phase 1 不实现严格重传 |
| `0x08` | `RESUME` | Client→Peer | 是 | P1 | 会话恢复 |
| `0x09` | `RESUME_ACK` | Peer→Client | 是 | P1 | 会话恢复响应 |
| `0x0A` | `CLOSE` | 双向 | 可选 | 是 | 主动关闭会话 |
| `0x0B` | `CLOSE_ACK` | 双向 | 可选 | 是 | 关闭确认 |
| `0x0C` | `SESSION_RESET` | 双向 | 是 | P1 | 强制重置会话 |
| `0x0D` | `WINDOW_UPDATE` | 双向 | 是 | P1 | 更新接收窗口 |
| `0x0E` | `PING` | 双向 | 可选 | P1 | 延迟与链路探测 |
| `0x0F` | `PONG` | 双向 | 可选 | P1 | 链路探测响应 |
| `0x10` | `GOAWAY` | 双向 | 可选 | P2 | 拒绝新消息，准备关闭 |
| `0x11-0x6F` | `RESERVED` | - | - | - | 标准扩展保留 |
| `0x70-0x7E` | `EXPERIMENTAL` | - | 可选 | 否 | 实验用途 |
| `0x7F` | `VENDOR` | 双向 | 是 | 否 | 厂商私有 |

HEARTBEAT 用于保活（我还在线），PING 用于 RTT 测量（可携带 timestamp/nonce）。MVP 只需实现 HEARTBEAT/HEARTBEAT_ACK。

`READY`（`0x03`）为可选三步协商预留字段，当前版本不作为必要实现项；默认握手只要求 OPEN / ACCEPT。收到 `READY` 时必须忽略，不得返回错误。ACK / NACK 不得作为握手第三步名称，只作为后续可靠传输、分片确认、Stream 确认或 Control 确认语义的预留扩展。

Opcode 分配范围：

| 范围 | 用途 |
|---:|---|
| `0x00` | 保留 |
| `0x01-0x1F` | AXTP Core Control Opcode |
| `0x20-0x3F` | Control 标准扩展 |
| `0x40-0x6F` | 实验性扩展 |
| `0x70-0x7E` | 厂商扩展 |
| `0x7F` | Vendor Escape |
| `0x80-0xFF` | 保留 |

新建连能力不得通过新增 Header Profile 协商实现；Frame Profile 由 Transport Profile 固定决定。

---

## 4. Control StatusCode

Control `statusCode` 直接使用 `docs/specs/2-registry/04-Errors-Registry.md`，不维护独立 Control 局部状态码。`0x0000 = SUCCESS` 表示成功；非 0 表示失败或异常状态，具体含义必须来自 ErrorCode Registry。

MVP Control 至少需要识别以下错误码：

| statusCode | 名称 |
|---:|---|
| `0x0000` | `SUCCESS` |
| `0x0012` | `FRAME_VERSION_UNSUPPORTED` |
| `0x0016` | `FRAME_CRC_ERROR` |
| `0x0018` | `FRAME_FRAGMENT_MISSING` |
| `0x0021` | `CONTROL_OPCODE_INVALID` |
| `0x0022` | `CONTROL_PAYLOAD_INVALID` |
| `0x0023` | `RESERVED_CONTROL_BODY_ENCODING_UNSUPPORTED`（历史保留，新实现不得产生） |
| `0x0024` | `CONTROL_OPEN_REQUIRED` |
| `0x0025` | `CONTROL_OPEN_REJECTED` |
| `0x0026` | `RESERVED_CONTROL_PROFILE_UNSUPPORTED`（历史保留，新实现不得产生） |
| `0x0027` | `CONTROL_NEGOTIATION_FAILED` |
| `0x0028` | `CONTROL_SESSION_INVALID` |
| `0x002A` | `CONTROL_RESUME_FAILED` |
| `0x002C` | `CONTROL_WINDOW_EXCEEDED` |

---

## 5. Control TLV 结构

短 TLV：`type(1B) + length(1B) + value(N)`。

当 `length = 0xFF` 时，后接 `uint16 extendedLength` 再接 value（扩展长度）。MVP 可暂不使用扩展长度，但 Parser 必须识别 `0xFF` 并在不支持时返回格式错误。

未知 TLV 字段必须跳过，不得断开连接。非 repeated 字段重复出现必须返回 `MALFORMED_CONTROL_PAYLOAD`（strict mode）。

### 5.1 通用 TLV 字段

| TLV type | 名称 | 类型 | MVP |
|---:|---|---|---|
| `0x01` | `sessionId` | uint32 | MVP 可选，P1/P2 链路恢复/诊断使用 |
| `0x02` | `protocolVersion` | uint8 | 是 |
| `0x03` | `reserved` | - | 否（历史 headerProfile 字段，v1 不得使用） |
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
| `0x11` | `messageId` | uint16 | 预留，ACK/NACK/P1 |
| `0x12` | `frameIndex` | uint8 | 预留，ACK/NACK/P1 |
| `0x13` | `frameCount` | uint8 | P1 |
| `0x14` | `missingRanges` | bytes | P1 |
| `0x15` | `streamId` | uint32 | P1 |
| `0x16` | `seqId` | uint32 | P1 |
| `0x17` | `offset` | uint64 | P1 |
| `0x18` | `resumeToken` | bytes | P1 |
| `0x19` | `errorDetail` | string/bytes | P1 |
| `0x1A` | `controlFlags` | uint8 bitmap | 废弃（flags 字段已从固定头移除） |
| `0x1B` | `statusCode` | uint16 | 废弃（statusCode 已在固定头中） |
| `0x1C` | `nonce` | bytes | P1 |
| `0x1D` | `rttMs` | uint16/uint32 | P2 |
| `0x1E` | `selectedRpcEncoding` | uint8 | 是 |
| `0x1F` | `reserved` | - | 否（历史字段，不得使用） |

### 5.2 ACK/NACK 相关字段

| TLV type | 名称 | 类型 | MVP |
|---:|---|---|---|
| `0x20` | `targetType` | uint8 | 预留，ACK/NACK/P1 |
| `0x21` | `targetOpcode` | uint8 | P1 |
| `0x22` | `targetControlId` | uint16/uint8 | P1 |
| `0x23` | `retryAfterMs` | uint16/uint32 | P1 |
| `0x24` | `receivedCount` | uint16/uint32 | P2 |
| `0x25` | `expectedCount` | uint16/uint32 | P2 |

### 5.3 Vendor 字段

| TLV type | 名称 |
|---:|---|
| `0x70-0x7E` | `experimental` |
| `0x7F` | `vendorData` |

---

## 6. Bitmap 编码

### 6.1 PayloadType Bitmap

| bit | PayloadType |
|---:|---|
| 0 | CONTROL |
| 1 | RPC |
| 2 | STREAM |

示例：`0x07` = 支持 CONTROL/RPC/STREAM。

### 6.2 RPC Encoding Bitmap

| bit | rpcEncoding |
|---:|---|
| 0 | JSON |
| 1 | BINARY |
| 2 | CBOR |
| 3 | MSGPACK |
| 4-31 | RESERVED |

示例：`0x03` = JSON/BINARY。TLV/RAW_BYTES 属于 RPC Body Encoding，不属于此 bitmap。

### 6.3 Stream Profile 能力

Stream Profile 不使用 bitmap 协商，通过 `capability.*` 或 `stream.profile.*` 返回具体 Profile ID 列表。STREAM packet 只携带 `streamId/seqId/cursor/data`，Profile 只在建流控制面和本地 Stream Context 中存在。

---

## 7. ACK TargetType

| targetType | 名称 | MVP |
|---:|---|---|
| `0x01` | `FRAME` | 预留，ACK/NACK/P1 |
| `0x02` | `MESSAGE` | 预留，ACK/NACK/P1 |
| `0x03` | `STREAM_CHUNK` | P1 |
| `0x04` | `CONTROL` | 预留，ACK/NACK/P1 |
| `0x05` | `SESSION` | P1 |
| `0x7F` | `VENDOR` | 否 |

---

## 8. ACK Mode

| ackMode | 名称 | 说明 |
|---:|---|---|
| `0x00` | `NONE` | 默认不确认 |
| `0x01` | `FRAME_ACK` | 按 Frame 确认 |
| `0x02` | `MESSAGE_ACK` | 按完整 Message 确认 |
| `0x03` | `STREAM_CHUNK_ACK` | 按 Stream Chunk 确认 |
| `0x04` | `SELECTIVE_ACK` | 选择性确认/缺失范围 |
| `0x05` | `RESERVED` | 历史模式，新实现不得使用 |

Phase 1 默认 `ackMode = NONE`，不要求 ACK/NACK 重传机制。ACK 触发由 OPEN 协商的 ackMode 与具体 Payload/Stream Context 策略决定，Frame Header 不表达确认请求。后续如果 STREAM、低带宽或固件传输场景需要严格确认，再启用对应 ackMode。

---

## 9. 会话状态机

AXTP 连接生命周期分为四个状态，与 05《连接场景与调用流程规范》§3.1 保持一致：

```text
DISCONNECTED
    │  传输层连接建立
    ▼
LINK_CONNECTED
    │  CONTROL OPEN / ACCEPT 完成
    ▼
FRAMING_READY
    │  RPC Hello / Identify / Identified 三步完成
    │  或 authRequired=false 直接进入
    ▼
APP_READY

FRAMING_READY → (transport lost) → LINK_CONNECTED（重连后重新 OPEN）
FRAMING_READY → (RESUME 成功) → APP_READY（BLE/UART 断线恢复）
ANY_STATE → (SESSION_RESET, P1) → LINK_CONNECTED or DISCONNECTED
```

| 状态 | 允许的操作 | 拒绝的操作 |
| --- | --- | --- |
| `LINK_CONNECTED` | 仅 CONTROL OPEN | 所有 RPC / STREAM |
| `FRAMING_READY` | RPC Hello / Identify / Identified | 业务 RPC / STREAM |
| `APP_READY` | 所有已注册 RPC 和 STREAM | — |

`sessionId` 是 ACCEPT 可选返回的 Link Context 标识。MVP 阶段 runtime 可以保存它用于日志追踪、调试和后续扩展，但普通 RPC / STREAM 不携带 `sessionId`，业务路由也不得依赖它。真正的业务会话由 RPC `sid` 表达。P1/P2 的 RESUME、SESSION_RESET、多链路追踪或网关内部链路管理可以再使用 `sessionId`。

---

## 10. OPEN / ACCEPT

OPEN / ACCEPT 协商协议运行时参数，不协商业务能力，也不协商 Header Profile。Frame Profile 由 Transport Profile 固定决定。业务能力不由 CONTROL 层发现；客户端应使用当前产品 generated registry，并通过已采纳业务方法或标准 RPC 错误完成运行时门禁。

OPEN 由当前 Transport Profile 的 Physical Client 发送；ACCEPT 由 Physical Server 返回。OPEN/ACCEPT 的核心价值是建立 framed transport 的运行上下文并协商运行参数，不决定哪一端是 Logical Server（见 `docs/specs/1-core/04-Transport-Profiles.md`§3.0）。

### 10.1 OPEN 请求字段

| 字段 | TLV | 必须 |
|---|---:|---|
| `protocolVersion` | `0x02` | 是 |
| `maxFrameSize` | `0x04` | 是 |
| `maxPayloadSize` | `0x05` | P1 |
| `mtu` | `0x06` | 是 |
| `supportedPayloadTypes` | `0x07` | 是 |
| `supportedRpcEncodings` | `0x08` | 是 |
| `heartbeatIntervalMs` | `0x0A` | 是 |
| `ackMode` | `0x0B` | 是，Phase 1 默认 NONE |
| `windowSize` | `0x0C` | P1 |

### 10.2 ACCEPT 响应字段

| 字段 | TLV | 必须 |
|---|---:|---|
| `sessionId` | `0x01` | MVP 可选，P1/P2 |
| `protocolVersion` | `0x02` | 是 |
| `maxFrameSize` | `0x04` | 是 |
| `maxPayloadSize` | `0x05` | P1 |
| `mtu` | `0x06` | 是 |
| `supportedPayloadTypes` | `0x07` | 是 |
| `selectedRpcEncoding` | `0x1E` | 是 |
| `heartbeatIntervalMs` | `0x0A` | 是 |
| `ackMode` | `0x0B` | 是，Phase 1 默认 NONE |
| `windowSize` | `0x0C` | P1 |
| `resumeToken` | `0x18` | P1 |

### 10.3 OPEN 示例

```text
opcode=0x01 controlId=0x0001 statusCode=0x0000

Body TLV:
02 01 01        // protocolVersion = 1
04 02 00 10     // maxFrameSize = 4096
06 02 C4 09     // mtu = 2500
07 01 07        // supportedPayloadTypes = CONTROL/RPC/STREAM
08 01 03        // supportedRpcEncodings = JSON/BINARY
0A 02 E8 03     // heartbeatIntervalMs = 1000
0B 01 00        // ackMode = NONE (Phase 1 default)
```

### 10.4 ACCEPT 示例

```text
opcode=0x02 controlId=0x0001 statusCode=0x0000

Body TLV:
01 04 78 56 34 12  // optional sessionId = 0x12345678, MVP only stores for trace/future resume
02 01 01           // protocolVersion = 1
04 02 00 10        // maxFrameSize = 4096
06 02 C4 09        // mtu = 2500
07 01 07           // payloadTypes = CONTROL/RPC/STREAM
1E 01 02           // selectedRpcEncoding = BINARY
0A 02 E8 03        // heartbeatIntervalMs = 1000
0B 01 00           // ackMode = NONE (Phase 1 default)
```

### 10.5 协商失败处理

| 失败原因 | statusCode | 处理 |
|---|---|---|
| Header Version 不支持 | `FRAME_VERSION_UNSUPPORTED` | 返回 ACCEPT(非 0 statusCode)，断开连接 |
| payloadType 无交集 | `CONTROL_NEGOTIATION_FAILED` | 返回 ACCEPT(非 0 statusCode)，details 中说明原因 |
| rpcEncoding 无交集 | `CONTROL_NEGOTIATION_FAILED` | 返回 ACCEPT(非 0 statusCode)，body 填写支持列表 |
| MTU 不满足最小要求 | `CONTROL_NEGOTIATION_FAILED` | 返回 ACCEPT(非 0 statusCode) |
| OPEN 格式非法 | — | 直接断开，不发响应 |

Client 收到 `statusCode != 0` 的 ACCEPT 后可根据 body 调整参数重试，最多 3 次。

---

## 11. HEARTBEAT / HEARTBEAT_ACK

HEARTBEAT 可无 body，也可携带 `timestamp(0x0F)`。HEARTBEAT_ACK 必须使用相同 controlId，statusCode = SUCCESS(0x0000)。

推荐：`heartbeatIntervalMs = 1000~5000`，连续 3 次未收到 HEARTBEAT_ACK 则认为连接异常。

---

## 12. ACK / NACK（预留，Phase 1 不实现）

ACK 确认 Frame/Message/Control/Stream Chunk 已收到，不表示业务执行成功。业务结果由 `PayloadType=RPC, rpcOp=REQUEST_RESPONSE` 表达。

Phase 1 不要求 runtime 实现 ACK/NACK 或严格重传机制。当前只保留 opcode、targetType、messageId、frameIndex 等字段，供后续 STREAM、低带宽链路、固件传输或选择性重传 profile 启用。

ACK 示例（确认 Frame）：
```text
opcode=0x06 controlId=0x0002 statusCode=0x0000
Body: 20 01 01 / 11 02 7B 00 / 12 01 03  // targetType=FRAME, messageId=123, frameIndex=3
```

NACK 示例（CRC 错误）：
```text
opcode=0x07 controlId=0x0003 statusCode=0x0016  // FRAME_CRC_ERROR
Body: 20 01 01 / 11 02 7B 00 / 12 01 03         // targetType=FRAME, messageId=123, frameIndex=3
```

收到 NACK 后的重传策略属于 P1/P2 扩展：FRAME → 重传指定 frameIndex；MESSAGE → 重传缺失分片；CONTROL → 重发或关闭会话。

---

## 13. RESUME / RESUME_ACK（P1）

RESUME 用于 BLE 重连、USB 重插等场景恢复逻辑会话。MVP 可保留字段但不实现完整恢复。

RESUME 请求字段：`sessionId(0x01)`, `resumeToken(0x18)`, `messageId(0x11)`, `streamId(0x15)`, `seqId(0x16)`, `offset(0x17)`。

RESUME_ACK 成功返回 `sessionId/windowSize/messageId/streamId/seqId/offset`；失败返回 `CONTROL_RESUME_FAILED` 或 `CONTROL_SESSION_INVALID`，客户端应重新 OPEN。

**resumeToken 格式**：服务端生成的不透明字节串，长度 8-32B，客户端不得解析其内容。Token 在 Session 关闭或设备重启后失效，不得跨 Session 复用。

---

## 14. CLOSE / CLOSE_ACK

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

CLOSE_ACK 使用相同 controlId，statusCode = SUCCESS(0x0000)。严重错误在 MVP 阶段可直接断开连接；P1 可发送 SESSION_RESET。

---

## 15. SESSION_RESET（P1）

SESSION_RESET 用于强制重置会话（协议状态机异常、连续解析失败、安全策略要求等）。MVP 不要求实现，可使用 CLOSE + 重新 OPEN 或直接断开连接替代。

应携带 `reasonCode` 和可选 `errorDetail`。收到后：清理 session 状态，丢弃未完成 Message，回到 LINK_CONNECTED 或 DISCONNECTED，如需继续通信重新 OPEN。

---

## 16. WINDOW_UPDATE（P1）

用于 STREAM firmware.update/file.transfer/log 等高吞吐场景的流控。字段：`targetType(0x20)`, `streamId(0x15)`, `seqId(0x16)`, `windowSize(0x0C)`, `offset(0x17)`。

---

## 17. Control 分片规则

CONTROL Payload 应尽量小，不建议分片。如超过单帧容量，使用 AXTP Frame Fragment 机制，完整重组后才交给 ControlParser。

MVP 建议限制 Control Payload 不超过单 Frame；超过时返回 `CONTROL_PAYLOAD_INVALID`、发送 CLOSE 或直接断开。后续启用 ACK/NACK 后，才使用 NACK 表达精确重传请求。

---

## 18. 安全边界

必须校验：payloadLength 是否足够（≥ 5B）、opcode 是否支持、TLV length 是否越界、OPEN 是否出现在合法状态、controlId 是否匹配、协商参数是否可接受。

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

## 19. MVP 实现范围

### 19.1 必须实现的 Opcode

```text
OPEN(0x01) / ACCEPT(0x02) / HEARTBEAT(0x04) / HEARTBEAT_ACK(0x05) / CLOSE(0x0A) / CLOSE_ACK(0x0B)
```

### 19.2 可暂缓的 Opcode

```text
READY(0x03，预留，非必要实现，收到时忽略) / ACK(0x06) / NACK(0x07) / RESUME(0x08) / RESUME_ACK(0x09) / SESSION_RESET(0x0C) / WINDOW_UPDATE(0x0D) / PING(0x0E) / PONG(0x0F) / GOAWAY(0x10) / VENDOR(0x7F)
```

### 19.3 必须实现的 TLV

```text
protocolVersion / maxFrameSize / mtu
supportedPayloadTypes / supportedRpcEncodings / heartbeatIntervalMs / ackMode
reasonCode / selectedRpcEncoding
```

`sessionId` 是 MVP 可选字段。实现可以解析并保存，但不得把它作为普通 RPC / STREAM 路由或业务会话判断依据。

### 19.4 可暂不实现

```text
ACK/NACK 重传 / 完整会话恢复 / 滑动窗口流控 / STREAM_CHUNK_ACK / CBOR Control Body
控制消息分片 / 压缩协商 / 加密协商 / PING/PONG RTT 测量
```

---

## 20. 版本与兼容策略

新增标准 Opcode 使用 `0x10-0x6F` 范围，新增前必须更新 Control Opcode Registry、Generator 常量和 C++ enum。

新增 TLV 字段必须保证旧 Parser 可跳过未知字段，不得改变已有字段语义，不得复用 deprecated 字段。

修改 Control Payload 固定头布局必须升级 AXTP Header Version；新增 TLV 字段或 Opcode 不需要升级。

---

## 21. 与后续文档的关系

| 文档 | 关系 |
|---|---|
| `docs/specs/1-core/06-RPC-Session.md` | CONTROL 建立 Session 后，RPC 才能承载业务命令 |
| `docs/specs/1-core/07-Stream-Data-Plane.md` | STREAM 由 RPC 打开；ACK/NACK/WINDOW_UPDATE 是后续严格传输确认和流控扩展 |
| Registry | CONTROL 不进入 Method Registry，业务命令通过 RPC 查询 capability |
