# 05《AXTP RPC Session Spec》

> Status: AXTP v1 Core Freeze Candidate
> Spec Version: 1.0.0-rc1
> Change Policy: Clarification-only before v1.0.0
> Scope: Core wire format / state machine / compatibility rules

版本：v1.0.0-rc1
状态：AXTP v1 Core Freeze Candidate
适用范围：RPC Payload 结构、op+d Envelope、sid、JSON/BINARY 编码、MethodId/EventId、Hello/Identify/Request/Response/Event/Batch
前置文档：01《AXTP Protocol Framework》、02《AXTP Frame and Payload Spec》、04《AXTP Control Session Spec》
后续文档：06《AXTP Stream Spec》、Registry 文档

---

## 0. 速读：RPC 有 JSON 和 Binary 两种线上形态

RPC 是业务控制面，承载 Hello / Identify / Request / Response / Event。它可以直接跑在 WebSocket Unframed JSON 上，也可以作为 `PayloadType=RPC` 放进 Standard Frame。

| 路径 | 线上结构 | session 表达 | 典型用途 |
|---|---|---|---|
| WebSocket Unframed JSON | `WebSocket message payload = JSON { sid, op, d }` | `sid` 在 JSON Envelope 中 | 浏览器、云端、轻量 RPC |
| Standard Framed + RPC JSON | `Frame Header(payloadType=RPC) + UTF-8 JSON { sid, op, d } + CRC16` | `sid` 在 JSON Payload 中 | 调试、诊断、实现便利 |
| Standard Framed + RPC Binary | `Frame Header(payloadType=RPC) + Binary RPC Header(11B) + body + CRC16` | Link session 由 CONTROL 管理，Payload 不携带 `sid` | 嵌入式、高吞吐路径 |

Binary RPC 11B 固定头：

```text
rpcEncoding(1) + rpcOp(1) + requestId(4)
  + methodOrEventId(2) + statusCode(2) + bodyEncoding(1)
```

三个 ID 的边界：

| 字段 | 所在层 | 作用 |
|---|---|---|
| `sid` | RPC JSON Envelope | JSON/TextCodec 的 session 路由与恢复；Binary Payload 不携带 |
| `requestId` | RPC Payload | 匹配 Request / Response；不用于 Frame 分片 |
| `messageId` | Frame Header | 标识完整 Frame Message 及其分片；不匹配 RPC Response |

最小 JSON 调用：

```json
{ "sid": "28378462323", "op": 7, "d": { "id": 1, "method": "device.getInfo" } }
```

最小 Binary 调用：

```text
Frame(payloadType=RPC)
  RPC Binary Header:
    rpcEncoding=BINARY, rpcOp=REQUEST, requestId=1,
    methodOrEventId=device.getInfo, statusCode=SUCCESS, bodyEncoding=TLV8
  body: TLV params
```

---

## 1. 文档目的

本文档定义 `PayloadType = RPC` 时的业务控制协议。RPC 负责业务控制面（设备查询、参数设置、能力查询、事件上报等），不负责协议运行时控制（属于 CONTROL）和连续数据传输（属于 STREAM）。

AXTP RPC 采用与 OBS-WebSocket 相同的 `{ "sid": string, "op": number, "d": object }` Envelope 结构。AXTP v1 Core 当前支持 `rpcEncoding=JSON` 与 `rpcEncoding=BINARY`：JSON 用于 WebSocket Unframed JSON 和 framed JSON，BINARY 用于 Standard Framed 嵌入式/高吞吐路径。CBOR 和 MessagePack 保留为后续扩展。

---

## 2. 协议分层与编码模式

```text
Transport
  ↓
AXTP Frame Header (payloadType=RPC)
  ↓
RPC Payload
  ├── JSON Mode:   UTF-8 JSON text, { "sid": "...", "op": N, "d": {...} }
  └── Binary Mode: Fixed 11B binary header + TLV body
```

| 编码模式 | rpcEncoding | 适用场景 |
| --- | --- | --- |
| JSON | `0x01` | WebSocket Unframed JSON、framed JSON、CLI、浏览器集成 |
| Binary | `0x02` | AXTP-USB-HID、AXTP-TCP 等 Standard Framed 场景 |
| CBOR | `0x03` | 后续扩展 |
| MessagePack | `0x04` | 后续扩展 |

JSON 使用 sid+op+d 语义结构。Binary 使用固定二进制头，语义与 op+d 一一对应（sid 由 CONTROL 层 session 管理，不出现在 Binary Payload 中）。

---

## 3. Envelope 结构

所有 JSON 消息使用统一三字段 Envelope：

```json
{ "sid": "28378462323", "op": 6, "d": { ... } }
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `sid` | string | Session ID，由服务端在 Identified 中分配；TextCodec 边界消费，不透传给业务逻辑 |
| `op` | uint8 | 操作码，见 §4 |
| `d` | object | 消息数据块，结构由 op 决定 |

`sid` 的作用：

- **路由**：网关场景下一个连接承载多个逻辑 session，`sid` 区分路由目标
- **恢复**：断线重连时客户端携带旧 `sid` 发 Identify，服务端可恢复 session 状态
- Hello（op=0）是连接建立后第一条消息，此时尚无 session，`sid` 填空字符串 `""`
- Identified（op=3）中服务端分配并返回 `sid`，客户端后续所有消息必须携带此 `sid`
- Binary 模式下 `sid` 不出现在 Payload 中，session 由 CONTROL OPEN/ACCEPT 管理

---

## 4. RPC op 注册表

op 数值与老协议对齐，生命周期 op 保留为独立 op。

| op | 名称 | 方向 | 说明 |
| ---: | --- | --- | --- |
| `0` | `Hello` | Server→Client | 连接建立后服务端立即发送，携带版本和认证要求 |
| `1` | `HelloAck` | — | **Reserved**，保留编号与老协议对齐，当前不使用 |
| `2` | `Identify` | Client→Server | 客户端身份、版本、认证、订阅意图；可携带旧 `sid` 恢复 session |
| `3` | `Identified` | Server→Client | 确认就绪，分配并返回 `sid` |
| `4` | `Reidentify` | Client→Server | 修改订阅或会话参数，不重新认证 |
| `5` | `Subscribe` | — | **Reserved**，保留编号与老协议对齐，当前不使用（订阅通过 Identify/Reidentify 的 `eventSubscriptions` 字段完成） |
| `6` | `Event` | Server→Client | 低频状态事件推送 |
| `7` | `Request` | Client→Server | 发起 RPC 调用 |
| `8` | `RequestResponse` | Server→Client | 返回 RPC 结果 |
| `9` | `RequestBatch` | Client→Server | 批量 RPC 请求 |
| `10` | `RequestBatchResponse` | Server→Client | 批量 RPC 响应 |
| `11` | — | — | **Reserved**，保留未分配 |
| `12` | — | — | **Reserved**，保留未分配 |
| `14` | `Bye` | Client→Server | 应用层优雅关闭，可携带关闭原因 |
| `15` | `ByeAck` | Server→Client | 确认关闭，服务端完成清理后发送 |

op=13 保留未分配。Reserved op 收到时必须忽略，不得返回错误。

MVP 必须实现：`Hello / Identify / Identified / Event / Request / RequestResponse`。其余可延后。

---

## 5. Hello（op=0）

服务端在 WebSocket/TCP 连接建立后立即发送，无需客户端请求。

```json
{
  "sid": "",
  "op": 0,
  "d": {
    "axtpVersion": "1.0.0",
    "rpcVersion": 1,
    "authentication": {
      "challenge": "...",
      "salt": "..."
    }
  }
}
```

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `axtpVersion` | string | 是 | 服务端协议版本 |
| `rpcVersion` | uint32 | 是 | RPC 协议版本，当前为 1 |
| `authentication` | object | 否 | 认证挑战，不需要认证时省略 |

`sid` 填 `""`，此时 session 尚未建立。

---

## 6. Identify（op=2）

客户端收到 Hello 后发送。

```json
{
  "sid": "",
  "op": 2,
  "d": {
    "rpcVersion": 1,
    "authentication": "...",
    "eventMasks": "850101",
    "resumeSid": "28378462323"
  }
}
```

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `rpcVersion` | uint32 | 是 | 客户端期望的 RPC 版本 |
| `authentication` | string | 条件 | Hello 要求认证时必填，HMAC 响应 |
| `eventMasks` | string | 否 | 域级事件订阅掩码，Hex 字符串编码，格式见 §16；省略或空字符串表示不订阅任何事件 |
| `resumeSid` | string | 否 | 断线重连时携带旧 `sid`，请求恢复 session |

> **兼容说明**：旧字段 `eventSubscriptions: uint32` 已废弃，新实现必须使用 `eventMasks`。MVP 阶段设备可忽略 `eventMasks` 并默认推送核心事件（全量广播模式），P1 阶段再实现按掩码过滤。

新连接时 `sid` 填 `""`；断线重连时 `sid` 填 `""` 但 `d.resumeSid` 携带旧 session ID。

---

## 7. Identified（op=3）

服务端验证通过后发送，分配 `sid`。

```json
{
  "sid": "28378462323",
  "op": 3,
  "d": {
    "negotiatedRpcVersion": 1
  }
}
```

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `negotiatedRpcVersion` | uint32 | 是 | 协商后的 RPC 版本 |

客户端收到 Identified 后提取 `sid`，后续所有消息必须携带此 `sid`。

---

## 8. Reidentify（op=4）

客户端在已建立 session 后修改订阅，不重新认证。

```json
{
  "sid": "28378462323",
  "op": 4,
  "d": {
    "eventMasks": "850301"
  }
}
```

`eventMasks` 格式与 Identify 相同（见 §6）。服务端处理后再次发送 Identified（op=3）确认。

---

## 9. Request（op=7）

### 9.1 d-block 结构

```json
{
  "id": 1,
  "method": "display.setBrightness",
  "params": {
    "value": 80
  }
}
```

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | uint32 | 是 | 请求 ID，从 1 开始递增，uint32 自然回绕（跳过 0） |
| `method` | string | 是 | 方法名，`domain.verbObject` 格式，对应 Registry methodId |
| `params` | object | 否 | 请求参数，无参数时可省略 |

`id` 规则：

- 保留值 `0`：Event 固定填此值，普通 Request 不得使用
- 同一 Session 内未收到 RequestResponse 的 `id` 不得复用
- `id` 在收到对应 RequestResponse 或超时（推荐 30s）后方可复用

### 9.2 示例

```json
{
  "sid": "28378462323",
  "op": 7,
  "d": {
    "id": 1,
    "method": "display.setBrightness",
    "params": {
      "value": 80
    }
  }
}
```

---

## 10. RequestResponse（op=8）

每个 RequestResponse 必须携带 `status` 对象，`result` 仅在有业务数据时出现。

### 10.1 成功 d-block（有返回值）

```json
{
  "id": 1,
  "status": {
    "ok": true,
    "code": 0
  },
  "result": {
    "value": 80
  }
}
```

### 10.2 成功 d-block（无返回值）

```json
{
  "id": 1,
  "status": {
    "ok": true,
    "code": 0
  }
}
```

### 10.3 失败 d-block

```json
{
  "id": 1,
  "status": {
    "ok": false,
    "code": 603,
    "msg": "Value out of range",
    "details": {
      "max": 100
    }
  }
}
```

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | uint32 | 是 | 对应 Request 的 id |
| `status` | object | 是 | 每个响应必须携带，描述执行结果 |
| `status.ok` | bool | 是 | 请求是否成功完成 |
| `status.code` | uint32 | 是 | 状态码或错误码；`0` 表示成功，非 0 表示失败或异常状态 |
| `status.msg` | string | 否 | 可选但推荐的人类可读提示，不得作为程序分支判断依据；`ok=true` 时通常省略 |
| `status.details` | object | 否 | 机器可读的错误上下文 |
| `result` | object | 否 | 业务返回数据，无返回值时省略 |

`status` 和业务 `result` 可同时出现（成功且有数据）。`status.ok=false` 或 `status.code != 0` 时不得携带业务 `result`。

文本编码中的 `status.code` 使用 uint32，便于与 JSON-RPC / MCP / 外部系统错误码适配；当前 AXTP ErrorCode Registry 的规范码值仍位于 uint16 范围内。

### 10.4 示例

```json
{
  "sid": "28378462323",
  "op": 8,
  "d": {
    "id": 1,
    "status": {
      "ok": true,
      "code": 0
    },
    "result": {
      "value": 80
    }
  }
}
```

```json
{
  "sid": "28378462323",
  "op": 8,
  "d": {
    "id": 1,
    "status": {
      "ok": false,
      "code": 603,
      "msg": "Value out of range"
    }
  }
}
```

---

## 11. Event（op=6）

```json
{
  "event": "display.brightnessChanged",
  "intent": 1,
  "data": {
    "value": 80,
    "source": "local"
  }
}
```

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `event` | string | 是 | 事件名，PascalCase，对应 Registry eventId |
| `intent` | uint32 | 是 | 订阅分类位，对应 Identify `eventSubscriptions` 位图中的某一位，客户端用于过滤 |
| `data` | object | 否 | 事件数据，无数据时可省略 |

Event 不携带 `id`（Binary 中 requestId 填 0）。

### 11.1 示例

```json
{
  "sid": "28378462323",
  "op": 6,
  "d": {
    "event": "display.brightnessChanged",
    "intent": 1,
    "data": {
      "value": 80,
      "source": "local"
    }
  }
}
```

---

## 12. RequestBatch（op=9）

```json
{
  "id": 100,
  "haltOnFailure": true,
  "executionType": 0,
  "requests": [
    { "method": "display.setBrightness", "params": { "value": 80 } },
    { "method": "SetDisplayContent", "params": { "content": "hello" } }
  ]
}
```

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | uint32 | 是 | 批量请求 ID |
| `haltOnFailure` | bool | 否 | 遇到失败是否停止，默认 false |
| `executionType` | uint32 | 否 | 0=SerialRealtime，1=SerialFrame，2=Parallel |
| `requests` | array | 是 | 请求列表，每项含 `method` 和可选 `params` |

---

## 13. RequestBatchResponse（op=10）

```json
{
  "id": 100,
  "results": [
    { "status": { "ok": true, "code": 0 }, "result": { "value": 80 } },
    { "status": { "ok": false, "code": 603, "msg": "Content too long" } }
  ]
}
```

`results` 数组与 `requests` 数组一一对应。

---

## 14. 方法名与事件名规范

### 14.1 方法名

格式：`domain.verbObject`，camelCase

推荐动词：`get / set / list / open / close / start / stop / begin / end / verify / apply / abort / resume / subscribe / unsubscribe`

示例：`device.getInfo / display.setBrightness / firmware.begin / stream.open`

### 14.2 事件名

格式：`domain.objectChanged / domain.actionCompleted / domain.actionFailed / domain.error`

示例：`display.brightnessChanged / firmware.updateCompleted / stream.error`

### 14.3 与 Binary methodId/eventId 的映射

方法名和事件名与 Binary 中的 uint16 ID 一一对应，由 Registry 统一管理：

```text
"display.setBrightness"      ↔ methodId = 0x0602
"display.brightnessChanged"  ↔ eventId  = 0x0607
```

---

## 15. 会话生命周期

AXTP 将会话生命周期分为两层，两层职责严格分离：

```text
Transport 层（CONTROL，Framed Mode）：
  Physical connected
    → CONTROL OPEN
    → CONTROL ACCEPT
    → FRAMING_READY

Application 层（RPC，所有模式）：
  FRAMING_READY / WebSocket connected
    → Hello (op=0)        Logical Server→Logical Client
    → Identify (op=2)     Logical Client→Logical Server
    → Identified (op=3)   Logical Server→Logical Client，分配 sid
    → APP_READY
    → capability.supportedMethods
    → Request / Event / Reidentify
```

Hello 由 AXTP Logical Server 发送——即拥有并暴露 methods/events/streams 的一端。在本地设备场景中，Physical Server 与 Logical Server 是同一端（设备）。在云端反连场景中，设备是 Physical Client 但仍是 Logical Server，因此仍由设备发 Hello（详见 03《Transport Profiles》§3.0）。

| OBS-WebSocket | AXTP 对应 | 说明 |
| --- | --- | --- |
| `Hello` | `Hello (op=0)` | 直接对应，服务端主动发送 |
| `Identify` | `Identify (op=2)` | 直接对应，客户端认证+订阅 |
| `Identified` | `Identified (op=3)` | 直接对应，分配 sid |
| `Reidentify` | `Reidentify (op=4)` | 直接对应，修改订阅 |

WebSocket Unframed JSON 模式下，CONTROL 层不存在，Hello/Identify/Identified 是唯一的连接建立机制。Standard Framed 模式下，CONTROL OPEN/ACCEPT 先于 Hello/Identify 执行，两者不冲突。

APP_READY 后，v1 Core 唯一强制能力发现入口是 `capability.supportedMethods`。该方法返回当前设备、当前固件、当前会话、当前鉴权状态下支持的 methodId 集合。完整 `capability.getAll` / `capability.query` / capability schema 属于 v2/P1 扩展，不作为 v1 Core 必选项。

---

## 16. 事件订阅

低频状态事件走 RPC Event（op=6），高频连续数据走 STREAM。

```text
低频状态变化（亮度变化、固件进度、设备状态）：
  RPC Event (op=6)

高频连续数据（视频帧、音频帧、传感器采样、OTA 数据块）：
  RPC 控制面（Request op=7）+ STREAM 数据面
```

### 16.1 域级事件订阅掩码（eventMasks）

事件订阅使用**域级二进制掩码（Domain-Scoped Event Mask）**，而非旧的 `eventSubscriptions: uint32` 全局位图。

**格式**：`eventMasks` 是一个 Hex 字符串，由一个或多个 Domain Block 拼接而成：

```text
Domain Block = [DomainId: 1B] + [MaskLen: 1B] + [Bitmask: N B (Little-Endian)]
```

| 字段 | 长度 | 说明 |
| --- | --- | --- |
| `DomainId` | 1B | 事件所属域 ID（与 EventId 高字节对齐，见 11《AXTP Events Registry Spec》） |
| `MaskLen` | 1B | Bitmask 字节数 N（1-32），高水位截断：只发到最高有效字节 |
| `Bitmask` | N B | 该域的事件订阅掩码，Little-Endian，Bit 0 对应 bitOffset=0 |

**Domain ID 与 EventId 的对应关系**：

| DomainId | 对应 EventId 范围 | 域名 |
| --- | --- | --- |
| `0x01` | `0x0100-0x01FF` | `device.*` |
| `0x02` | `0x0200-0x02FF` | `capability.*` |
| `0x03` | `0x0300-0x03FF` | `system.*` |
| `0x04` | `0x0400-0x04FF` | `firmware.*` |
| `0x05` | `0x0500-0x05FF` | `stream.*` |
| `0x06` | `0x0600-0x06FF` | `display.*` |
| `0x0A` | `0x0A00-0x0AFF` | `input.*` |
| `0x0B` | `0x0B00-0x0BFF` | `output.*` |
| `0x0C` | `0x0C00-0x0CFF` | `room.*` |
| `0x0D` | `0x0D00-0x0DFF` | `signage.*` |

**高水位截断规则**：如果某域只用到 Bit 3，`MaskLen` 必须为 1，不得发送多余字节。

**示例**：订阅 `display.*` 域的 Bit 0（brightnessChanged）和 `firmware.*` 域的 Bit 0/1（updateProgress/updateCompleted）：

```text
eventMasks = "060101 040103"（去掉空格后为 "060101040103"）

解析：
  DomainId=0x06, MaskLen=1, Bitmask=0x01  → display.brightnessChanged (Bit 0)
  DomainId=0x04, MaskLen=1, Bitmask=0x03  → firmware.updateProgress (Bit 0) + firmware.updateCompleted (Bit 1)
```

**设备端过滤（O(1) 判定）**：

```cpp
bool isEventSubscribed(const uint8_t* bitmask, uint8_t maskLen, uint8_t bitOffset) {
    uint8_t byteIndex = bitOffset / 8;
    uint8_t bitIndex  = bitOffset % 8;
    if (byteIndex >= maskLen) return false;
    return (bitmask[byteIndex] & (1 << bitIndex)) != 0;
}
```

### 16.2 MVP 阶段简化

MVP 阶段设备可采用"全量广播模式"：忽略 `eventMasks`，只要 App 进入 APP_READY 状态，设备产生的所有核心事件无条件推送。P1 阶段再实现按掩码过滤。

初始订阅在 Identify（op=2）的 `eventMasks` 字段声明。运行时修改订阅使用 Reidentify（op=4）。

事件掩码的 DomainId 与 EventId 高字节对齐，并与同 domain 的 MethodId 高字节一致。例如 `display.*` method/event 均使用 `0x06xx`，DomainId 均为 `0x06`。方法能力掩码和事件订阅掩码格式相同、DomainId 空间相同，但 bitOffset 来源不同：生成器必须分别从 `methods[].bitOffset` 和 `events[].bitOffset` 派生。

---

## 17. RPC 与 STREAM 的协作

```text
OTA:
  RPC firmware.begin → 返回 streamId, profile=firmware.ota
  STREAM packet: streamId/seqId/cursor/data
  RPC firmware.verify → 校验固件
  RPC firmware.apply → 应用固件

文件传输:
  RPC file.beginTransfer → 返回 streamId
  STREAM packet: streamId/seqId/cursor/data
  RPC file.endTransfer

视频预览:
  RPC video.startPreview → 返回 streamId
  STREAM packet: streamId/seqId/cursor/data
  RPC stream.close
```

---

## 18. 后续对象编码

MessagePack 和 CBOR 保留为后续扩展，不属于 AXTP v1 Core 必选实现。

若后续启用 MessagePack 或 CBOR，它们必须复用 JSON 的 sid/op/d 语义，不得复用 Binary RPC 11B Header，也不得改变 methodId/eventId/errorCode registry。

当前实现入口只要求 `rpcEncoding=JSON` 与 `rpcEncoding=BINARY`。

---

## 19. Binary RPC 编码

Binary 模式面向 Standard Framed 设备，使用统一 11B 固定二进制头承载 op+d 语义。AXTP v1 Core 不再区分 RPC Standard/Compact Payload；Compact 低带宽降级见 18《AXTP Low-Bandwidth Degradation》。

### 19.1 Binary Payload（11B 固定头）

| 字段 | 长度 | 类型 | 说明 |
| --- | ---: | --- | --- |
| `rpcEncoding` | 1B | uint8 | 首字节，v1 Core 使用 `0x01=JSON / 0x02=BINARY` |
| `rpcOp` | 1B | uint8 | op 值，见 §4 |
| `requestId` | 4B | uint32 | 请求 ID，EVENT 填 0 |
| `methodOrEventId` | 2B | uint16 | methodId 或 eventId |
| `statusCode` | 2B | uint16 | `0x0000=SUCCESS`，非 0 为 ErrorCode Registry 错误码 |
| `bodyEncoding` | 1B | uint8 | 仅 `rpcEncoding=BINARY` 时有效，v1 Core 使用 `0x01=TLV8` |
| `body` | N | bytes | 由 bodyEncoding 决定 |

固定头 11B，所有多字节字段 Little-Endian。body 长度 = `Frame.payloadLength - 11`。

### 19.2 Parser 分发规则

接收方读取 RPC Payload 首字节 `rpcEncoding` 后分发：

| rpcEncoding | Parser |
| ---: | --- |
| `0x01` JSON | JSON sid/op/d parser |
| `0x02` BINARY | Binary 11B header parser |
| `0x03` CBOR | 后续扩展 |
| `0x04` MSGPACK | 后续扩展 |

JSON 模式下不使用 Binary 11B Header，`bodyEncoding` 字段不存在。CBOR/MSGPACK 若后续启用，也不得复用 Binary 11B Header。

### 19.3 bodyEncoding

| bodyEncoding | 名称 | 说明 |
| ---: | --- | --- |
| `0x00` | `NONE` | 无 body，或非 Binary 编码内部占位 |
| `0x01` | `TLV8` | `fieldId:uint8 + length:uint8 + value` |
| `0x02` | `TLV16` | 支持扩展长度的 TLV |
| `0x03` | `RAW_BYTES` | 原始字节，由 method schema 或 profile 解释 |
| `0x04` | `CBOR_BODY` | Binary RPC 内部使用 CBOR body |

MVP 必须实现 `NONE` 和 `TLV8`。`bodyEncoding` 只在 `rpcEncoding=BINARY` 时有语义。

### 19.4 statusCode

`statusCode` 复用 ErrorCode Registry：

- Request / Event：必须填 `0x0000`
- Response 成功：必须填 `0x0000`
- Response 失败：填 ErrorCode Registry 中的非 0 错误码

Binary RESPONSE 中 `statusCode` 与 JSON `status.code` 对应，不再维护独立 RPC statusCode 表。当前 Binary Header 的 `statusCode` 为 uint16，映射到文本 `status.code:uint32` 时零扩展；`statusCode == 0` 等价于 `status.ok=true`；`statusCode != 0` 等价于 `status.ok=false`。

### 19.5 Binary 与 op+d 语义映射

| op+d 字段 | Binary 字段 | 说明 |
| --- | --- | --- |
| `op` | `rpcOp` | 直接对应 |
| `d.id` | `requestId` | uint32，Event 填 0 |
| `d.method` | `methodOrEventId` | 方法名映射到 uint16 methodId |
| `d.event` | `methodOrEventId` | 事件名映射到 uint16 eventId |
| `d.intent` | body 或本地订阅上下文 | Binary 固定头不携带 intent |
| `d.params` / `d.result` / `d.data` | `body` | JSON object ↔ TLV |
| `d.status.ok` | `statusCode == 0` | bool 不单独入 Binary Header，由 statusCode 推导 |
| `d.status.code` | `statusCode` | 状态码，0=成功，非 0=错误码 |

---

## 20. TLV Body 编码

TLV 基本结构：`type(1B) + length(1B) + value(N)`，扩展长度格式见 16《AXTP TLV Schema Encoding》。

TLV 字段 ID 由 Method Registry 的 schema 定义，不在 RPC 协议中硬编码。fieldId 范围分配见 17《AXTP Schema Field Numbering》。

示例（SetBrightness）：

```text
JSON params: { "value": 80 }
TLV body:    01 01 50
             fieldId=0x01, length=1, value=80
```

---

## 21. 完整示例

### 21.1 SetBrightness（JSON）

Request：

```json
{
  "sid": "28378462323",
  "op": 7,
  "d": {
    "id": 1,
    "method": "display.setBrightness",
    "params": {
      "value": 80
    }
  }
}
```

Response 成功：

```json
{
  "sid": "28378462323",
  "op": 8,
  "d": {
    "id": 1,
    "status": {
      "ok": true,
      "code": 0
    },
    "result": {
      "value": 80
    }
  }
}
```

Response 失败：

```json
{
  "sid": "28378462323",
  "op": 8,
  "d": {
    "id": 1,
    "status": {
      "ok": false,
      "code": 603,
      "msg": "Value out of range",
      "details": {
        "max": 100
      }
    }
  }
}
```

### 21.2 BrightnessChanged（JSON Event）

```json
{
  "sid": "28378462323",
  "op": 6,
  "d": {
    "event": "display.brightnessChanged",
    "intent": 1,
    "data": {
      "value": 80,
      "source": "local"
    }
  }
}
```

### 21.3 SetBrightness（Binary）

```text
Request:
02 07 01 00 00 00 02 06 00 00 01 01 01 50
rpcEncoding=BINARY(2), rpcOp=Request(7), requestId=1, methodId=0x0602, statusCode=SUCCESS, bodyEncoding=TLV8
body: fieldId=1, len=1, value=80

Response 成功:
02 08 01 00 00 00 02 06 00 00 01 01 01 50
rpcEncoding=BINARY(2), rpcOp=RequestResponse(8), requestId=1, methodId=0x0602, statusCode=SUCCESS, bodyEncoding=TLV8
body: fieldId=1, len=1, value=80
```

### 21.4 OpenStream（JSON）

Request：

```json
{
  "sid": "28378462323",
  "op": 7,
  "d": {
    "id": 2,
    "method": "stream.open",
    "params": {
      "profile": "firmware.ota",
      "direction": "upload",
      "totalSize": 1048576,
      "sha256": "abc123..."
    }
  }
}
```

Response：

```json
{
  "sid": "28378462323",
  "op": 8,
  "d": {
    "id": 2,
    "status": {
      "ok": true,
      "code": 0
    },
    "result": {
      "streamId": 33,
      "profile": "firmware.ota",
      "chunkSize": 512,
      "ackMode": "stop_and_wait",
      "cursorUnit": "byteOffset"
    }
  }
}
```

### 21.5 FirmwareUpdateCompleted（JSON Event）

```json
{
  "sid": "28378462323",
  "op": 6,
  "d": {
    "event": "firmware.updateCompleted",
    "intent": 4,
    "data": {
      "imageType": "mcu",
      "version": "2.1.0"
    }
  }
}
```

### 21.6 完整连接流程（JSON）

```text
[连接建立]
Server → Client:
  { "sid": "", "op": 0, "d": { "axtpVersion": "1.0.0", "rpcVersion": 1 } }

Client → Server:
  { "sid": "", "op": 2, "d": { "rpcVersion": 1, "eventMasks": "850101" } }

Server → Client:
  { "sid": "28378462323", "op": 3, "d": { "negotiatedRpcVersion": 1 } }

[业务调用]
Client → Server:
  { "sid": "28378462323", "op": 7, "d": { "id": 1, "method": "device.getInfo" } }

Server → Client:
  { "sid": "28378462323", "op": 8, "d": { "id": 1, "status": { "ok": true, "code": 0 }, "result": { "model": "AX100", "version": "1.0.0" } } }

[断线重连]
Client → Server:
  { "sid": "", "op": 2, "d": { "rpcVersion": 1, "resumeSid": "28378462323" } }

Server → Client:
  { "sid": "28378462323", "op": 3, "d": { "negotiatedRpcVersion": 1 } }
```

---

## 22. 与 MCP 的兼容性

AXTP RPC 使用 `status` 对象描述执行结果，与 JSON-RPC 2.0 / MCP 的 `result / error` 互斥模式不同，但可通过适配层转换：

```text
AXTP Request (op=7)          → MCP tool call      (method, params)
AXTP RequestResponse (op=8)  → MCP tool result    (status.ok=true → result; status.ok=false → error)
AXTP Event (op=6)            → MCP notification   (event, data)
```

适配层转换规则：

```text
AXTP → MCP:
  status.ok == true   → { "result": d.result }
  status.ok == false  → { "error": { "code": <mapped>, "message": status.msg, "data": status.details } }

MCP → AXTP:
  result present    → { "status": { "ok": true, "code": 0 }, "result": result }
  error present     → { "status": { "ok": false, "code": <mapped>, "msg": error.message, "details": error.data } }
```

主要差异：

- AXTP `id` 为 uint32，MCP `id` 为 string/number（可直接转换）
- AXTP `sid` 无 MCP 对应物，适配层在 MCP 边界消费
- AXTP `status.code` 使用 AXTP ErrorCode Registry，MCP 使用 JSON-RPC 错误码（需映射）

---

## 23. 老协议 CmdValue 适配

旧协议 CmdValue 不直接塞进 AXTP `methodId:uint16`。兼容层必须通过 Legacy Mapping 将旧 CmdValue 映射到 AXTP MethodId，并在边界处完成 payload/status 转换。

```yaml
legacyMappings:
  - legacyCmdValue: 0xC0021
    axtpMethodId: 0x0402
    axtpMethodName: SetVideoMode
    bodyEncoding: RAW_BYTES
```

Binary Payload 使用 uint16 methodOrEventId。超出 0xFFFF 的旧 CmdValue 必须通过 `legacy_mapping.yaml` 建立唯一映射，不得改变 AXTP MethodId 宽度。

---

## 24. requestId 与 messageId 的边界

| 字段 | 所属层 | 作用 |
| --- | --- | --- |
| `messageId` | Frame Layer | 分片重组、ACK/NACK、传输排错 |
| `sid` | RPC Session Layer | session 路由与恢复，TextCodec 边界消费 |
| `requestId` | RPC Layer | 匹配业务请求和业务响应 |
| `streamId` | Stream Layer | 标识连续数据流 |
| `seqId` | Stream Layer | 标识流内数据块序号 |

这五个 ID 服务于不同层级，不得相互替代。

---

## 25. 安全与鲁棒性要求

RPC Parser 必须满足：

- body 长度不得超过 Frame.payloadLength
- TLV length 不得越界
- 未知 methodId 返回 `RPC_METHOD_NOT_FOUND`
- 不支持的 rpcEncoding 返回 `RPC_ENCODING_UNSUPPORTED`
- requestId 必须原样返回，RequestResponse 必须匹配已有 pending request
- Event 不得被当作 RequestResponse 处理
- Identified 前收到 Request 必须返回 `status.ok=false, status.code=SESSION_NOT_READY`，不得处理业务请求
- 所有整数解析必须显式处理字节序，不允许直接 reinterpret_cast 网络字节流为 C++ struct

---

## 26. MVP 实现范围

### 26.1 必须实现

```text
rpcEncoding = JSON / BINARY
op = Hello(0) / Identify(2) / Identified(3) / Event(6) / Request(7) / RequestResponse(8)
sid+op+d Envelope（JSON）
Binary RPC Header（11B）
TLV body encode/decode
uint16 methodId / eventId
uint32 id（requestId）
method ↔ methodId 映射 / event ↔ eventId 映射
业务 result / status.ok / status.code / status.msg / status.details 结构
```

### 26.2 MVP 方法范围

```text
device.getInfo / capability.supportedMethods
display.getBrightness / display.setBrightness
firmware.begin / firmware.end / firmware.verify / firmware.apply
```

### 26.3 MVP 事件范围

```text
display.brightnessChanged
firmware.updateProgress / firmware.updateCompleted / firmware.updateFailed
```

### 26.4 可暂不实现

```text
RequestBatch / RequestBatchResponse
Reidentify
Bye / ByeAck
stream.open / stream.close
device.statusChanged / stream.opened / stream.closed / stream.error
MessagePack / CBOR
压缩 body / 加密 body
```

---

## 27. 版本与兼容策略

新增 methodId/eventId 不需要修改 RPC 协议版本，只需更新 Registry 和 Generator 输出。

新增可选 body 字段不需要修改方法版本，旧设备可忽略未知 TLV 字段。

修改已有字段语义属于破坏性变更，必须新增 method version 或新增 methodId。

废弃字段不得立即复用 fieldId，应标记 `deprecated: true`。

---

## 28. 与后续文档的关系

| 文档 | 关系 |
| --- | --- |
| 02《AXTP Frame and Payload Spec》 | Frame Header、PayloadType、Fragment、CRC |
| 04《AXTP Control Session Spec》 | CONTROL 建立 Session，不承载业务方法 |
| 06《AXTP Stream Spec》 | STREAM 数据面，RPC 只负责控制面 |
| 15《AXTP Type System》 | wire 类型定义（uint8/string/bitmap/array/object） |
| 16《AXTP TLV Schema Encoding》 | body 字段 TLV 编码格式、扩展长度、canonical encoding |
| 17《AXTP Schema Field Numbering》 | schema-local fieldId 分配、废弃规则 |
| MethodId/EventId/ErrorCode/Capability 注册表 | 业务语义单一事实源 |
| 老协议适配规范 | CmdValue/legacy payload 到 RPC 的映射 |
| Generator v1 实现规范 | 从 registry 生成 C++ 和 Markdown |
