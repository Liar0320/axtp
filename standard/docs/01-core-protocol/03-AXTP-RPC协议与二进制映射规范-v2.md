# 03《AXTP RPC 协议与二进制映射规范》

版本：v1.1 Draft  
状态：MVP RPC 子协议规范  
适用范围：`PayloadType = RPC` 的 Payload 结构、op+d Envelope、sid、JSON/MessagePack/Binary 编码、MethodId/EventId、Hello/Identify/Request/Response/Event/Batch  
前置文档：01《AXTP 整体协议规范》、02《AXTP Control 信令协议规范》  
后续文档：04《AXTP Stream 流式传输协议规范》、Registry 文档

---

## 1. 文档目的

本文档定义 `PayloadType = RPC` 时的业务控制协议。RPC 负责业务控制面（设备查询、参数设置、能力查询、事件上报等），不负责协议运行时控制（属于 CONTROL）和连续数据传输（属于 STREAM）。

AXTP RPC 采用与 OBS-WebSocket 相同的 `{ "sid": string, "op": number, "d": object }` Envelope 结构，同时支持 JSON 文本帧和 MessagePack 二进制帧两种编码，以及面向嵌入式设备的 Binary-RPC 紧凑编码。op 数值与 OBS-WebSocket 对齐，生命周期 op（Hello/Identify/Identified/Reidentify）保留为独立 op，不映射为 RPC 方法。

---

## 2. 协议分层与编码模式

```text
Transport
  ↓
AXTP Frame Header (payloadType=RPC)
  ↓
RPC Payload
  ├── JSON Mode:        UTF-8 JSON text, { "sid": "...", "op": N, "d": {...} }
  ├── MessagePack Mode: MessagePack binary, same sid+op+d structure
  └── Binary Mode:      Fixed binary header + TLV/CBOR body
```

| 编码模式 | rpcEncoding | 适用场景 |
| --- | --- | --- |
| JSON | `0x01` | WebSocket Text、HTTP Debug、CLI、浏览器调试 |
| MessagePack | `0x04` | WebSocket Binary、高效文本协议场景 |
| Binary | `0x02` | BLE、HID、UART、TCP、USB Bulk 嵌入式场景 |
| CBOR | `0x03` | 可选，IoT 场景 |

JSON 和 MessagePack 使用相同的 sid+op+d 语义结构，仅编码格式不同。Binary 使用固定二进制头，语义与 op+d 一一对应（sid 由 CONTROL 层 session 管理，不出现在 Binary Payload 中）。

---

## 3. Envelope 结构

所有 JSON 和 MessagePack 消息使用统一三字段 Envelope：

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
- Identified（op=2）中服务端分配并返回 `sid`，客户端后续所有消息必须携带此 `sid`
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
    "obsWebSocketVersion": "1.0.0",
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
| `obsWebSocketVersion` | string | 是 | 服务端协议版本 |
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
    "eventSubscriptions": 33,
    "resumeSid": "28378462323"
  }
}
```

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `rpcVersion` | uint32 | 是 | 客户端期望的 RPC 版本 |
| `authentication` | string | 条件 | Hello 要求认证时必填，HMAC 响应 |
| `eventSubscriptions` | uint32 | 否 | 事件订阅位图，0 表示不订阅任何事件 |
| `resumeSid` | string | 否 | 断线重连时携带旧 `sid`，请求恢复 session |

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
    "eventSubscriptions": 65
  }
}
```

服务端处理后再次发送 Identified（op=3）确认。

---

## 9. Request（op=7）

### 9.1 d-block 结构

```json
{
  "id": 1,
  "method": "brightness.set",
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

### 9.2 示例

```json
{
  "sid": "28378462323",
  "op": 7,
  "d": {
    "id": 1,
    "method": "brightness.set",
    "params": {
      "value": 80
    }
  }
}
```

---

## 10. RequestResponse（op=8）

### 10.1 成功 d-block

```json
{
  "id": 1,
  "result": {
    "value": 80
  }
}
```

### 10.2 失败 d-block

```json
{
  "id": 1,
  "error": {
    "code": 603,
    "message": "Value out of range",
    "data": {
      "max": 100
    }
  }
}
```

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | uint32 | 是 | 对应 Request 的 id |
| `result` | object | 条件 | 成功时返回，与 `error` 互斥 |
| `error` | object | 条件 | 失败时返回，与 `result` 互斥 |
| `error.code` | uint16 | 是 | 错误码，来自 ErrorCode Registry |
| `error.message` | string | 是 | 人类可读错误描述 |
| `error.data` | object | 否 | 附加错误上下文 |

`result` 和 `error` 不得同时出现。无返回值的成功响应使用 `"result": {}`。

### 10.3 示例

```json
{
  "sid": "28378462323",
  "op": 8,
  "d": {
    "id": 1,
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
    "error": {
      "code": 603,
      "message": "Value out of range"
    }
  }
}
```

---

## 11. Event（op=6）

```json
{
  "event": "brightness.changed",
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
    "event": "brightness.changed",
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
    { "method": "brightness.set", "params": { "value": 80 } },
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
    { "result": { "value": 80 } },
    { "error": { "code": 603, "message": "Content too long" } }
  ]
}
```

`results` 数组与 `requests` 数组一一对应。

---

## 14. 方法名与事件名规范

### 16.1 方法名

格式：`domain.verbObject`，camelCase

推荐动词：`get / set / list / open / close / start / stop / begin / end / verify / apply / abort / resume / subscribe / unsubscribe`

示例：`device.getInfo / brightness.set / firmware.begin / stream.open`

### 16.2 事件名

格式：`domain.objectChanged / domain.actionCompleted / domain.actionFailed / domain.error`

示例：`brightness.changed / firmware.updateCompleted / stream.error`

### 16.3 与 Binary methodId/eventId 的映射

方法名和事件名与 Binary 中的 uint32 ID 一一对应，由 Registry 统一管理：

```text
"brightness.set"      ↔ methodId = 0x0602
"brightness.changed"  ↔ eventId  = 0x8601
```

---

## 15. 会话生命周期

AXTP 将会话生命周期分为两层，两层职责严格分离：

```text
Transport 层（CONTROL，Framed Mode）：
  Physical connected
    → CONTROL OPEN
    → CONTROL ACCEPT
    → TRANSPORT_READY

Application 层（RPC，所有模式）：
  TRANSPORT_READY / WebSocket connected
    → Hello (op=0)        Server→Client
    → Identify (op=2)     Client→Server
    → Identified (op=3)   Server→Client，分配 sid
    → APP_READY
    → Request / Event / Reidentify
```

| OBS-WebSocket | AXTP 对应 | 说明 |
| --- | --- | --- |
| `Hello` | `Hello (op=0)` | 直接对应，服务端主动发送 |
| `Identify` | `Identify (op=2)` | 直接对应，客户端认证+订阅 |
| `Identified` | `Identified (op=3)` | 直接对应，分配 sid |
| `Reidentify` | `Reidentify (op=4)` | 直接对应，修改订阅 |

Unframed 模式（WebSocket Text / MessagePack）下，CONTROL 层不存在，Hello/Identify/Identified 是唯一的连接建立机制。Framed 模式（Binary）下，CONTROL OPEN/ACCEPT 先于 Hello/Identify 执行，两者不冲突。

---

## 16. 事件订阅

低频状态事件走 RPC Event（op=6），高频连续数据走 STREAM。

```text
低频状态变化（亮度变化、固件进度、设备状态）：
  RPC Event (op=6)

高频连续数据（视频帧、音频帧、传感器采样、OTA 数据块）：
  RPC 控制面（Request op=7）+ STREAM 数据面
```

初始订阅在 Identify（op=2）的 `eventSubscriptions` 位图中声明。运行时修改订阅使用 Reidentify（op=4）。

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

## 18. MessagePack 编码

MessagePack 模式与 JSON 模式使用完全相同的 op+d 语义，仅将 JSON 对象序列化为 MessagePack 格式。

RPC Payload 首字节 `rpcEncoding = 0x04` 时，后续 Payload 按 MessagePack sid/op/d 对象解析。

MessagePack 优势：

- 比 JSON 体积小 20-30%
- 原生支持 bytes 类型（无需 base64）
- 解析速度更快

---

## 19. Binary RPC 编码

Binary 模式面向嵌入式设备，使用统一 11B 固定二进制头承载 op+d 语义，不再区分 RPC Standard/Compact Payload。外层 Frame Profile 已经负责 Standard/Compact 的链路开销优化，RPC 层只保留一套固定头。

### 19.1 Binary Payload（11B 固定头）

| 字段 | 长度 | 类型 | 说明 |
| --- | ---: | --- | --- |
| `rpcEncoding` | 1B | uint8 | 首字节，`0x01=JSON / 0x02=BINARY / 0x03=CBOR / 0x04=MSGPACK` |
| `rpcOp` | 1B | uint8 | op 值，见 §4 |
| `requestId` | 4B | uint32 | 请求 ID，EVENT 填 0 |
| `methodOrEventId` | 2B | uint16 | methodId 或 eventId |
| `statusCode` | 2B | uint16 | `0x0000=SUCCESS`，非 0 为 ErrorCode Registry 错误码 |
| `bodyEncoding` | 1B | uint8 | 仅 `rpcEncoding=BINARY` 时有效，`0x01=TLV8 / 0x02=TLV16 / ...` |
| `body` | N | bytes | 由 bodyEncoding 决定 |

固定头 11B，所有多字节字段 Little-Endian。body 长度 = `Frame.payloadLength - 11`。

### 19.2 Parser 分发规则

接收方读取 RPC Payload 首字节 `rpcEncoding` 后分发：

| rpcEncoding | Parser |
| ---: | --- |
| `0x01` JSON | JSON sid/op/d parser |
| `0x02` BINARY | Binary 11B header parser |
| `0x03` CBOR | CBOR sid/op/d parser |
| `0x04` MSGPACK | MessagePack sid/op/d parser |

JSON/CBOR/MSGPACK 模式下不使用 Binary 11B Header，`bodyEncoding` 字段不存在。若某个实现为了统一内部缓冲结构保留 `bodyEncoding`，必须填 `0x00` 并在编码输出时忽略。

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

Binary RESPONSE 中 `statusCode` 与 JSON/MessagePack 中 `error.code` 直接对应，不再维护独立 RPC statusCode 表。

### 19.5 Binary 与 op+d 语义映射

| op+d 字段 | Binary 字段 | 说明 |
| --- | --- | --- |
| `op` | `rpcOp` | 直接对应 |
| `d.id` | `requestId` | uint32，Event 填 0 |
| `d.method` | `methodOrEventId` | 方法名映射到 uint16 methodId |
| `d.event` | `methodOrEventId` | 事件名映射到 uint16 eventId |
| `d.intent` | body 或本地订阅上下文 | Binary 固定头不携带 intent |
| `d.params` / `d.result` / `d.data` | `body` | JSON object ↔ TLV |
| `d.error.code` | `statusCode` | 错误码 |

---

## 20. TLV Body 编码

TLV 基本结构：`type(1B) + length(1B) + value(N)`，扩展长度由 TLV Schema 文档定义。

TLV 字段 ID 由 Method Registry 的 schema 定义，不在 RPC 协议中硬编码。

示例（SetBrightness）：

```text
JSON params: { "value": 80 }
TLV body:    01 01 50
             fieldId=0x01, length=1, value=80
```

---

## 21. 完整示例

### 19.1 SetBrightness（JSON）

Request：

```json
{
  "sid": "28378462323",
  "op": 7,
  "d": {
    "id": 1,
    "method": "brightness.set",
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
    "error": {
      "code": 603,
      "message": "Value out of range",
      "data": {
        "max": 100
      }
    }
  }
}
```

### 19.2 BrightnessChanged（JSON Event）

```json
{
  "sid": "28378462323",
  "op": 6,
  "d": {
    "event": "brightness.changed",
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

### 19.4 OpenStream（JSON）

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

### 19.5 FirmwareUpdateCompleted（JSON Event）

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

### 19.6 完整连接流程（JSON）

```text
[连接建立]
Server → Client:
  { "sid": "", "op": 0, "d": { "obsWebSocketVersion": "1.0.0", "rpcVersion": 1 } }

Client → Server:
  { "sid": "", "op": 2, "d": { "rpcVersion": 1, "eventSubscriptions": 33 } }

Server → Client:
  { "sid": "28378462323", "op": 3, "d": { "negotiatedRpcVersion": 1 } }

[业务调用]
Client → Server:
  { "sid": "28378462323", "op": 7, "d": { "id": 1, "method": "device.getInfo" } }

Server → Client:
  { "sid": "28378462323", "op": 8, "d": { "id": 1, "result": { "model": "AX100", "version": "1.0.0" } } }

[断线重连]
Client → Server:
  { "sid": "", "op": 2, "d": { "rpcVersion": 1, "resumeSid": "28378462323" } }

Server → Client:
  { "sid": "28378462323", "op": 3, "d": { "negotiatedRpcVersion": 1 } }
```

---

## 22. 与 MCP 的兼容性

AXTP RPC 的 `method / id / params / result / error` 字段与 JSON-RPC 2.0 / MCP 高度兼容，后期适配 MCP Server 时：

```text
AXTP Request (op=7)          → MCP tool call      (method, params)
AXTP RequestResponse (op=8)  → MCP tool result    (result / error)
AXTP Event (op=6)            → MCP notification   (event, data)
```

主要差异：

- AXTP `id` 为 uint32，MCP `id` 为 string/number（可直接转换）
- AXTP `sid` 无 MCP 对应物，适配层在 MCP 边界消费
- AXTP `error.code` 使用 AXTP ErrorCode Registry，MCP 使用 JSON-RPC 错误码（需映射）

---

## 23. 老协议 CmdValue 适配

旧协议 CmdValue 不直接塞进 AXTP `methodId:uint16`。兼容层必须通过 Legacy Mapping 将旧 CmdValue 映射到 AXTP MethodId，并在边界处完成 payload/status 转换。

```yaml
legacyMappings:
  - legacyCmdValue: 0xC0021
    axtpMethodId: 0x0B02
    axtpMethodName: SetVideoMode
    bodyEncoding: FIXED_STRUCT
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
- 未知 methodId 返回 METHOD_NOT_FOUND
- 不支持的 rpcEncoding 返回 UNSUPPORTED_ENCODING
- requestId 必须原样返回，RequestResponse 必须匹配已有 pending request
- Event 不得被当作 RequestResponse 处理
- Identified 之前收到 Request 必须返回 error，不得处理业务请求
- 所有整数解析必须显式处理字节序，不允许直接 reinterpret_cast 网络字节流为 C++ struct

---

## 26. MVP 实现范围

### 26.1 必须实现

```text
rpcEncoding = JSON / BINARY
op = Hello(0) / Identify(2) / Identified(3) / Event(6) / Request(7) / RequestResponse(8)
sid+op+d Envelope（JSON 和 MessagePack）
Binary RPC Header（11B）
TLV body encode/decode
uint16 methodId / eventId
uint32 id（requestId）
method ↔ methodId 映射 / event ↔ eventId 映射
result / error.code / error.message / error.data 结构
```

### 26.2 MVP 方法范围

```text
device.getInfo / capability.getAll
brightness.get / brightness.set
firmware.begin / firmware.verify / firmware.apply
stream.open / stream.close
```

### 26.3 MVP 事件范围

```text
device.statusChanged / brightness.changed
firmware.updateProgress / firmware.updateCompleted / firmware.updateFailed
stream.opened / stream.closed / stream.error
```

### 26.4 可暂不实现

```text
RequestBatch / RequestBatchResponse
Reidentify
Bye / ByeAck
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
| 01《整体协议规范》 | Frame Header、PayloadType、Fragment、CRC |
| 02《Control 信令规范》 | CONTROL 建立 Session，不承载业务方法 |
| 04《Stream 流式传输规范》 | STREAM 数据面，RPC 只负责控制面 |
| Type System / TLV Schema | body 字段类型和编码规则 |
| MethodId/EventId/ErrorCode/Capability 注册表 | 业务语义单一事实源 |
| 老协议适配规范 | CmdValue/legacy payload 到 RPC 的映射 |
| Generator v1 实现规范 | 从 registry 生成 C++ 和 Markdown |
