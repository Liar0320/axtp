# 03《AXTP RPC 协议与二进制映射规范》

版本：v0.2 Draft  
状态：MVP RPC 子协议规范（精简版）  
适用范围：`PayloadType = RPC` 的 Payload 结构、DS-RPC Text Profile 映射、Binary-RPC 映射、TLV Body、MethodId/EventId、Request/Response/Event/Batch  
前置文档：01《AXTP 整体协议规范》、02《AXTP Control 信令协议规范》  
后续文档：04《AXTP Stream 流式传输协议规范》、Registry 文档

---

## 1. 文档目的

本文档定义 `PayloadType = RPC` 时的业务控制协议。RPC 负责业务控制面（设备查询、参数设置、能力查询、事件上报等），不负责协议运行时控制（属于 CONTROL）和连续数据传输（属于 STREAM）。

AXTP v1 不再区分 `RPC_JSON` / `RPC_BINARY`，统一为：

```text
Frame Header.payloadType = RPC
RPC Payload.rpcEncoding = JSON / BINARY / CBOR / MSGPACK
```

---

## 2. MessageId 与 requestId 的边界

| 字段 | 所属层 | 作用 |
|---|---|---|
| `messageId` | Frame Layer | 分片重组、ACK/NACK、传输排错 |
| `requestId` | RPC Layer | 匹配业务请求和业务响应 |
| `streamId` | Stream Layer | 标识连续数据流 |
| `seqId` | Stream Layer | 标识流内数据块序号 |

requestId 规则：
- 保留值：`0x00000000`（EVENT 固定填此值，普通 Request 不得使用）
- 从 `0x00000001` 开始递增，按 uint32 自然回绕（跳过 0）
- 同一 Session 内未收到 Response 的 requestId 不得复用

Text Profile 编码：固定 8 位十六进制字符串（如 `"00000001"`）。Binary Profile：4B little-endian uint32。

---

## 3. rpcEncoding 注册表

| rpcEncoding | 名称 | MVP |
|---:|---|---|
| `0x00` | `UNSPECIFIED` | 否 |
| `0x01` | `JSON` | 是 |
| `0x02` | `BINARY` | 是 |
| `0x03` | `CBOR` | 可选 |
| `0x04` | `MSGPACK` | 可选 |
| `0x05` | `FIXED_STRUCT` | 可选 |
| `0x7F` | `VENDOR` | 否 |

MVP 必须实现 JSON 和 BINARY，BINARY 的 bodyEncoding 至少支持 NONE 和 TLV。

---

## 4. rpcOp 注册表

| rpcOp | 名称 | requestId | methodId/eventId | MVP |
|---:|---|---|---|---|
| `0x01` | `REQUEST` | 是 | methodId | 是 |
| `0x02` | `RESPONSE` | 是 | methodId | 是 |
| `0x03` | `EVENT` | 否（填 0） | eventId | 是 |
| `0x04` | `BATCH_REQUEST` | 是 | batch item 指定 | P1 |
| `0x05` | `BATCH_RESPONSE` | 是 | batch item 指定 | P1 |
| `0x06` | `CANCEL` | 是 | 可选 | P1 |
| `0x07` | `NOTIFY` | 可选 | methodId | P1 |

---

## 5. RPC Flags

| Bit | 名称 | 说明 |
|---:|---|---|
| 0 | `SUCCESS` | Response 成功 |
| 1 | `ERROR` | Response 失败 |
| 2 | `HAS_BODY` | 存在 body |
| 3 | `ONEWAY` | 单向调用，不要求响应 |
| 4 | `COMPRESSED_BODY` | body 已压缩 |
| 5 | `BODY_SCHEMA_ID_PRESENT` | 携带 body schemaId |
| 6-7 | `RESERVED` | 保留，置 0 |

约束：SUCCESS 与 ERROR 不应同时置 1；RESPONSE 必须设置 SUCCESS 或 ERROR 之一；EVENT 只根据是否有数据设置 HAS_BODY。

---

## 6. bodyEncoding 注册表

| bodyEncoding | 名称 | MVP |
|---:|---|---|
| `0x00` | `NONE` | 是 |
| `0x01` | `TLV` | 是 |
| `0x02` | `JSON` | 是（rpcEncoding=JSON 时） |
| `0x03` | `CBOR` | 可选 |
| `0x04` | `MSGPACK` | 可选 |
| `0x05` | `FIXED_STRUCT` | 可选 |
| `0x06` | `RAW_BYTES` | 可选（旧协议适配） |
| `0x7F` | `VENDOR` | 否 |

`RAW_BYTES` 只允许旧协议适配层使用，必须通过 legacyMapping 在 Registry 中声明对应 methodId，不得作为绕过 Registry 的逃生门。

---

## 7. statusCode

REQUEST 中填 0，EVENT 中非状态事件填 0。

MVP 必须实现的状态码：

| statusCode | 名称 |
|---:|---|
| `0x0000` | `NONE` |
| `0x0064` | `SUCCESS` |
| `0x0100` | `UNKNOWN_ERROR` |
| `0x0101` | `INVALID_REQUEST` |
| `0x0102` | `METHOD_NOT_FOUND` |
| `0x0103` | `INVALID_PARAMS` |
| `0x0104` | `UNSUPPORTED_ENCODING` |
| `0x0105` | `UNSUPPORTED_METHOD` |
| `0x0106` | `DEVICE_BUSY` |
| `0x0107` | `TIMEOUT` |
| `0x0108` | `PERMISSION_DENIED` |
| `0x0109` | `RESOURCE_NOT_FOUND` |
| `0x010A` | `INTERNAL_ERROR` |

RPC Error 表达业务失败（methodId 不存在、参数非法、权限不足等）；Control NACK 表达传输失败（CRC 错误、分片缺失、会话未就绪等）。两者不得混用。

---

## 8. MethodId 与 EventId

methodId 和 eventId 均为 uint16，由 Registry 统一分配。

DS-RPC Text Profile 中的方法名/事件名（PascalCase）与 Binary 中的 uint16 ID 一一对应：

```text
"SetBrightness" ↔ methodId = 0x0602
"BrightnessChanged" ↔ eventId = 0x8601
```

Binary RPC Payload 中 `methodOrEventId` 字段复用：REQUEST/RESPONSE 时为 methodId，EVENT 时为 eventId。

---

## 9. DS-RPC Text Profile

DS-RPC 是 AXTP 的 Debug/Legacy Text Adapter，适用于 WebSocket Text、HTTP API、CLI、浏览器调试工具。**不是生产必须路径**，生产路径始终使用 AXTP Framed Mode。

DS-RPC 不使用 AXTP Frame Header。所有消息使用统一三字段 Envelope：

```json
{ "sid": "<session-id>", "op": <opcode>, "d": { ... } }
```

`sid` 是 transport-level session routing key，在 TextCodec 边界被消费，不透传给上层业务逻辑。

### 9.1 DS-RPC Opcode 表

| op | 名称 | 方向 | 说明 |
|---|---|---|---|
| `0` | `Hello` | Server→Client | Legacy Adapter 连接建立 |
| `1` | `HelloAck` | Client→Server | Legacy Adapter 确认，返回 sid |
| `2` | `Heartbeat` | 双向 | Legacy Adapter 心跳 |
| `3` | `HeartbeatAck` | 双向 | Legacy Adapter 心跳响应 |
| `5` | `Subscribe` | Client→Server | 订阅事件 |
| `6` | `Event` | Server→Client | 服务端推送事件 |
| `7` | `Request` | Client→Server | 发起 RPC 调用 |
| `8` | `RequestResponse` | Server→Client | 返回 RPC 结果 |
| `10` | `BatchRequest` | Client→Server | 批量 RPC 请求 |
| `11` | `BatchResponse` | Server→Client | 批量 RPC 响应 |
| `12` | `RESERVED_STREAM_DATA` | - | 保留，STREAM 数据必须使用 Framed Mode |
| `13` | `FragmentAck` | 双向 | 分片确认 |
| `14` | `Bye` | 双向 | Legacy Adapter 断开 |
| `15` | `ByeAck` | 双向 | Legacy Adapter 断开确认 |

Hello/HelloAck/Heartbeat/Bye 只属于 DS-RPC Legacy Adapter。新实现如已支持 AXTP Framed Mode，不应把这些 op 作为正式连接生命周期。

### 9.2 Request（op=7）

```json
{ "sid": "28378462323", "op": 7, "d": { "id": "00000001", "method": "SetBrightness", "params": { "value": 80 } } }
```

`id` 为固定 8 位十六进制，对应 Binary uint32 requestId；`method` 为 PascalCase，对应 methodId；`params` 对应 Binary body。

### 9.3 RequestResponse（op=8）

成功：
```json
{ "sid": "28378462323", "op": 8, "d": { "id": "00000001", "method": "SetBrightness", "status": { "result": true, "code": 100 }, "result": { "value": 80 } } }
```

失败：
```json
{ "sid": "28378462323", "op": 8, "d": { "id": "00000001", "method": "SetBrightness", "status": { "result": false, "code": 300, "comment": "Value out of range" } } }
```

`status.result=true` → flags.SUCCESS；`status.code=100` → statusCode=SUCCESS。

### 9.4 Event（op=6）

```json
{ "sid": "28378462323", "op": 6, "d": { "event": "BrightnessChanged", "eventInstanceId": "00000021", "timestamp": 1747649200000, "data": { "value": 80, "source": "local" } } }
```

### 9.5 方法名与事件名命名规范

方法名：PascalCase，动词开头（`GetDeviceInfo`, `SetBrightness`, `StartScreenShare`）。  
事件名：PascalCase，名词+状态后缀（`BrightnessChanged`, `FirmwareUpdateCompleted`）。

### 9.6 DS-RPC 与 Binary 字段映射

| DS-RPC 字段 | Binary 字段 | 说明 |
|---|---|---|
| `op` | `rpcOp` | op=7→REQUEST, op=8→RESPONSE, op=6→EVENT |
| `sid` | Session Context（不在 Binary Payload 中） | TextCodec 边界处理 |
| `d.id` | `requestId` | Text 为 8 位十六进制，Binary 为 4B LE uint32 |
| `d.method` | `methodId` | PascalCase 名称映射到 uint16 |
| `d.event` | `eventId` | PascalCase 名称映射到 uint16 |
| `d.params` / `d.result` / `d.data` | `body` | JSON object ↔ TLV |
| `d.status.result` | `flags SUCCESS/ERROR` | true→SUCCESS, false→ERROR |
| `d.status.code` | `statusCode` | 成功时 100 |

---

## 10. Binary RPC Standard Payload（17B 固定头）

| 字段 | 长度 | 类型 | 说明 |
|---|---:|---|---|
| `rpcEncoding` | 1B | uint8 | Binary 模式为 `0x02` |
| `rpcOp` | 1B | uint8 | REQUEST/RESPONSE/EVENT |
| `flags` | 1B | uint8 | RPC flags |
| `reserved` | 1B | uint8 | 保留，填 0 |
| `requestId` | 4B | uint32 | 请求 ID，EVENT 填 0 |
| `methodOrEventId` | 2B | uint16 | methodId 或 eventId |
| `statusCode` | 2B | uint16 | Response 状态码 |
| `bodyEncoding` | 1B | uint8 | body 编码 |
| `bodyLen` | 4B | uint32 | body 长度 |
| `body` | N | bytes | params/result/event data |

固定头 17B，所有多字节字段 Little-Endian。

---

## 11. Binary RPC Compact Payload（10B 固定头）

| 字段 | 长度 | 类型 | 说明 |
|---|---:|---|---|
| `rpcOp` | 1B | uint8 | REQUEST/RESPONSE/EVENT |
| `flags` | 1B | uint8 | RPC flags |
| `requestId` | 4B | uint32 | 请求 ID，EVENT 填 0 |
| `methodOrEventId` | 2B | uint16 | methodId 或 eventId |
| `statusCode` | 2B | uint16 | Response 状态码 |
| `body` | N | TLV | 默认 TLV body |

Compact 约定：`rpcEncoding=BINARY`，`bodyEncoding=TLV`，`bodyLen=Frame.payloadLength-10`。不携带 rpcEncoding/reserved/bodyEncoding/bodyLen 字段。

---

## 12. TLV Body 编码

TLV 基本结构：`type(1B) + length(1B) + value(N)`，扩展长度由 TLV Schema 文档定义。

TLV 字段 ID 由 Method Registry 的 schema 定义，不在 RPC 协议中硬编码。

示例（brightness.set）：

```text
JSON params: { "value": 80 }
TLV body:    01 01 50
             fieldId=0x01, length=1, value=80
```

---

## 13. Request / Response / Event 示例

### 13.1 SetBrightness Request（Compact Binary）

```text
01 04 01 00 00 00 02 06 00 00 01 01 50
rpcOp=REQUEST, flags=HAS_BODY, requestId=1, methodId=0x0602, statusCode=NONE
body: value=80
```

### 13.2 SetBrightness Response 成功（Compact Binary）

```text
02 05 01 00 00 00 02 06 64 00 01 01 50
rpcOp=RESPONSE, flags=SUCCESS|HAS_BODY, requestId=1, methodId=0x0602, statusCode=100
body: value=80
```

### 13.3 BrightnessChanged Event（Compact Binary）

```text
03 04 00 00 00 00 01 86 00 00 01 01 50 02 01 01
rpcOp=EVENT, flags=HAS_BODY, requestId=0, eventId=0x8601
body: value=80, source=local
```

---

## 14. Batch RPC（P1）

Batch 用于一次发送多个 RPC 请求，减少 RTT。MVP 可暂不实现，收到 Batch 请求时返回 `UNSUPPORTED_RPC_OP`。

外层 RPC：`rpcOp=BATCH_REQUEST`，body 包含 `batchFlags + itemCount + item[]`，每个 item 含 `requestId + methodId + bodyLen + body`。

执行策略：`SERIAL`（顺序，对应 haltOnFailure=true）、`PARALLEL`（并行）、`BEST_EFFORT`（尽力，对应 haltOnFailure=false）。

---

## 15. RPC 与 STREAM 的协作

大量业务采用 RPC 控制面 + STREAM 数据面模式：

```text
OTA:
  RPC firmware.begin → 返回 streamId, profile=firmware.ota
  STREAM packet: streamId/seqId/cursor/data
  RPC firmware.verify → 校验固件
  RPC firmware.apply → 应用固件

文件传输:
  RPC file.beginTransfer → 返回 transferId
  STREAM packet: streamId/seqId/cursor/data
  RPC file.endTransfer

视频预览:
  RPC video.startPreview → 返回 streamId
  STREAM packet: streamId/seqId/cursor/data
  RPC stream.close
```

---

## 16. 老协议 CmdValue 适配

旧协议 CmdValue 可直接映射为 AXTP methodId，不建议推翻旧命令表重新编号。

```yaml
legacyMappings:
  - legacyCmdValue: 0xC0021
    axtpMethodId: 0xC0021
    axtpMethodName: video.setMode
    bodyEncoding: FIXED_STRUCT
```

若旧 CmdValue 超过 uint16，三种处理方案：
- **方案 A**：Standard Binary RPC 扩展字段支持 uint32 methodId（TCP/USB Bulk）
- **方案 B**：建立 legacyMethodAlias 映射到 uint16 methodId（BLE/HID Compact）
- **方案 C**：使用 vendor method range `0x7000-0x7FFF`（临时兼容）

---

## 17. Method Schema 与 Generator

RPC 的 params/result/eventData 必须由 schema 描述：

```yaml
methods:
  - id: 0x0602
    name: brightness.set
    params:
      - fieldId: 0x01
        name: value
        type: uint8
        required: true
        range: [0, 100]
    result:
      - fieldId: 0x01
        name: value
        type: uint8
```

Generator v1 输入：`method_registry.yaml`, `event_registry.yaml`, `error_code.yaml`, `capability_registry.yaml`, `tlv_schema.yaml`。

Generator v1 输出：C++ MethodId/EventId/ErrorCode enum、method/event descriptor table、TLV field constants、JSON methodName↔methodId 映射、legacy CmdValue↔methodId 映射、Markdown 注册表、基础测试向量。

---

## 18. MVP 实现范围

### 18.1 必须实现

```text
rpcEncoding = JSON / BINARY
rpcOp = REQUEST / RESPONSE / EVENT
Compact Binary RPC Header（10B）
bodyEncoding = NONE / TLV / JSON
uint16 methodId / eventId / statusCode
uint32 requestId
method name ↔ methodId 映射
TLV body encode/decode
```

### 18.2 MVP 方法范围

```text
device.getInfo / capability.getAll
brightness.get / brightness.set
firmware.begin / firmware.verify / firmware.apply
stream.open / stream.close
event.subscribe / event.unsubscribe
```

### 18.3 MVP 事件范围

```text
device.statusChanged / brightness.changed
firmware.updateProgress / firmware.updateCompleted / firmware.updateFailed
stream.opened / stream.closed / stream.error
```

### 18.4 可暂不实现

```text
Batch RPC / CANCEL / ONEWAY / CBOR / MSGPACK
压缩 body / 加密 body / 动态 schema 下载
```

---

## 19. 安全与鲁棒性要求

RPC Parser 必须满足：
- bodyLen 不得超过 Frame.payloadLength
- TLV length 不得越界
- 未知 methodId 返回 METHOD_NOT_FOUND
- 不支持的 rpcEncoding 返回 UNSUPPORTED_ENCODING
- requestId 必须原样返回，Response 必须匹配已有 pending request
- Event 不得被当作 Response 处理
- 所有整数解析必须显式处理字节序，不允许直接 reinterpret_cast 网络字节流为 C++ struct

---

## 20. 版本与兼容策略

新增 methodId/eventId 不需要修改 RPC 协议版本，只需更新 Registry 和 Generator 输出。

新增可选 body 字段不需要修改方法版本，旧设备可忽略未知 TLV 字段。

修改已有字段语义属于破坏性变更，必须新增 method version 或新增 methodId。

废弃字段不得立即复用 fieldId，应标记 `deprecated: true`。

---

## 21. 与后续文档的关系

| 文档 | 关系 |
|---|---|
| 01《整体协议规范》 | Frame Header、PayloadType、Fragment、CRC |
| 02《Control 信令规范》 | CONTROL 建立 Session，不承载业务方法 |
| 04《Stream 流式传输规范》 | STREAM 数据面，RPC 只负责控制面 |
| Type System / TLV Schema | body 字段类型和编码规则 |
| MethodId/EventId/ErrorCode/Capability 注册表 | 业务语义单一事实源 |
| 老协议适配规范 | CmdValue/legacy payload 到 RPC 的映射 |
| Generator v1 实现规范 | 从 registry 生成 C++ 和 Markdown |
