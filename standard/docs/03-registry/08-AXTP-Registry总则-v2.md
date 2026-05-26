# 08《AXTP Registry 总则》

版本：v1.1 Draft  
状态：MVP Registry 治理规范（精简版）  
适用范围：AXTP Registry 系统统一治理规则、ID 分配、命名规范、生命周期、Legacy Mapping、Vendor Extension

---

## 1. Registry 定位

Registry 是 AXTP 协议落地的**单一事实源**，统一管理：

```text
PayloadType / Control Opcode / RPC Encoding / RPC Operation / Stream Profile
MethodId / EventId / ErrorCode / CapabilityId / SchemaId / FieldId
Vendor Extension / Legacy Mapping
```

最终目标：

```text
registry/*.yaml + schema/*.yaml
    ↓ Generator v1
Markdown 文档 / C++ enum / struct / descriptor / TLV skeleton / 测试向量
```

---

## 2. 设计原则

### 2.1 单一事实源

所有可枚举、可分配、可生成的协议对象必须在 Registry 中注册。不得在代码、文档、测试脚本中私自新增未注册 ID。

### 2.2 Header 与业务解耦

Frame Header 只识别 `PayloadType = CONTROL / RPC / STREAM`。业务对象（video/audio/ota/file/brightness 等）必须注册在 Method/Event/Stream/Capability/Schema Registry 中，不得出现在 Frame Header。

### 2.3 ID 稳定优先

进入 `stable` 状态的 ID 不得改变语义。语义变化时新增 ID，不修改旧 ID。

### 2.4 向前兼容

允许新增：methodId / eventId / errorCode / capabilityId / optional 字段 / vendor extension / Stream Profile。

禁止：修改 stable methodId 含义、修改 stable fieldId 类型、修改 stable enum value 含义、删除旧字段后复用编号、把 optional 字段改成 required、改变默认字节序。

---

## 3. Registry 文件组织

```text
registry/
├── core/
│   ├── payload_type.yaml
│   ├── control_opcode.yaml
│   ├── rpc_encoding.yaml
│   ├── rpc_op.yaml
│   └── stream_profile.yaml
├── domain/
│   └── domain_registry.yaml
├── method/
│   ├── method_registry.yaml
│   └── method_registry_mvp.yaml
├── event/
│   ├── event_registry.yaml
│   └── event_registry_mvp.yaml
├── error/
│   ├── error_code.yaml
│   └── error_code_mvp.yaml
├── capability/
│   ├── capability_registry.yaml
│   └── capability_registry_mvp.yaml
├── schema/
│   ├── common_fields.yaml
│   ├── control_schema.yaml
│   ├── rpc_schema.yaml
│   └── business_schema.yaml
├── legacy/
│   ├── legacy_cmd_mapping.yaml
│   ├── legacy_error_mapping.yaml
│   └── legacy_payload_mapping.yaml
└── vendor/
    └── vendor_registry.yaml
```

`*_mvp.yaml` 用于第一阶段实现，Generator v1 只读取 MVP 文件。

---

## 4. Registry 对象通用字段

```yaml
id: 0x0101
name: device.getInfo
kind: method
status: stable
domain: device
version:
  since: 1.0.0
  deprecated: null
  removed: null
description: Get basic device information.
owner: core
mvp: true
legacy:
  cmdValue: null
  source: null
```

| 字段 | 必填 | 说明 |
|---|---|---|
| `id` | 是 | 数值 ID，必须唯一 |
| `name` | 是 | 可读名称，例如 `device.getInfo` |
| `kind` | 是 | `method/event/error/capability/enum/schema` |
| `status` | 是 | 生命周期状态 |
| `domain` | 视情况 | 所属业务域 |
| `version.since` | 是 | 首次引入版本 |
| `version.deprecated` | 否 | 废弃版本 |
| `description` | 是 | 简短描述 |
| `owner` | 是 | `core/vendor/legacy/experimental` |
| `mvp` | 是 | 是否属于 MVP 必须实现 |
| `legacy` | 否 | 老协议映射信息 |

---

## 5. 生命周期状态

| status | 含义 | 可生成代码 | 可用于生产 |
|---|---|---:|---:|
| `draft` | 草案 | 可选 | 否 |
| `experimental` | 实验性 | 可选 | 否 |
| `mvp` | MVP 必须实现 | 是 | 可用于试产 |
| `stable` | 稳定 | 是 | 是 |
| `deprecated` | 已废弃但保留兼容 | 是 | 不建议新增使用 |
| `reserved` | 保留编号 | 否 | 否 |
| `removed` | 已移除 | 否 | 否 |

推荐流转：`draft → experimental → mvp → stable → deprecated`

`deprecated` 规则：ID 不得复用；Generator 仍应生成兼容 enum；文档中应标记替代项；新业务不得继续引用。

---

## 6. 命名规范

### 6.1 Domain 命名

小写单词：`device / capability / brightness / display / video / audio / stream / file / firmware / log / diagnostic / input / network / storage / sensor / vendor`

### 6.2 Method 命名

格式：`domain.verbObject`

推荐动词：`get / set / list / open / close / start / stop / begin / end / verify / apply / abort / resume / subscribe / unsubscribe`

示例：`device.getInfo / brightness.set / firmware.begin / stream.open`

### 6.3 Event 命名

格式：`domain.objectChanged / domain.actionStarted / domain.actionCompleted / domain.actionFailed / domain.error`

示例：`device.statusChanged / brightness.changed / firmware.updateCompleted / stream.error`

### 6.4 ErrorCode 命名

全大写蛇形：`SUCCESS / INVALID_PARAM / CRC_ERROR / FIRMWARE_VERIFY_FAILED`

### 6.5 Capability 命名

格式：`domain.capabilityName`

示例：`protocol.payloadType.control / rpc.encoding.binary / firmware.resume / brightness.range`

---

## 7. ID 编码规则

| 对象 | 宽度 | 使用位置 |
|---|---:|---|
| `payloadType` | `uint8` | Frame Header |
| `controlOpcode` | `uint8` | Control Payload |
| `rpcEncoding` | `uint8` | RPC Payload |
| `rpcOp` | `uint8` | RPC Payload |
| `streamProfile` | `uint16` | Registry / Capability / RPC 建流，不出现在 STREAM Payload |
| `methodId` | `uint16` | RPC Request/Response |
| `eventId` | `uint16` | RPC Event |
| `errorCode` | `uint16` | Control/RPC/Stream 错误 |
| `capabilityId` | `uint16` | Capability Registry |
| `fieldId` | `uint8` | TLV Schema |

所有多字节数值线上字节序遵循 Little-Endian。

---

## 8. Core Registry ID 范围

### 8.1 PayloadType

| ID | 名称 | 说明 |
|---:|---|---|
| `0x00` | `RESERVED` | 保留 |
| `0x01` | `CONTROL` | 协议信令 |
| `0x02` | `RPC` | 结构化业务命令、响应、事件 |
| `0x03` | `STREAM` | 连续数据、大块数据 |
| `0x04-0x7E` | `RESERVED` | AXTP Core 保留 |
| `0x7F` | `VENDOR` | 不建议使用 |
| `0x80-0xFF` | `RESERVED` | 未来扩展 |

MVP 只实现：`CONTROL / RPC / STREAM`

### 8.2 Control Opcode

| 范围 | 用途 |
|---:|---|
| `0x00` | 保留 |
| `0x01-0x1F` | Core Control Opcode |
| `0x20-0x3F` | Control 扩展 |
| `0x40-0x6F` | 实验性 |
| `0x70-0x7E` | 厂商扩展 |
| `0x7F` | Vendor Escape |
| `0x80-0xFF` | 保留 |

MVP Control Opcode：`OPEN / ACCEPT / HEARTBEAT / HEARTBEAT_ACK / ACK / NACK / CLOSE / CLOSE_ACK`

### 8.3 RPC Encoding

| ID | 名称 | 说明 |
|---:|---|---|
| `0x00` | `NONE` | 无 body |
| `0x01` | `JSON` | DS-RPC Text Profile body |
| `0x02` | `BINARY` | AXTP Binary RPC body |
| `0x03` | `CBOR` | CBOR body |
| `0x04` | `MSGPACK` | MessagePack body |
| `0x06-0x7E` | `RESERVED` | 保留 |
| `0x7F` | `VENDOR` | 厂商私有 |

MVP 必须实现：`JSON / BINARY`。二进制 Body 的 TLV8 / TLV16 / RAW_BYTES / CBOR_BODY 由 `bodyEncoding` 表达，不占用 `rpcEncoding` 枚举。

### 8.4 RPC Operation

| ID | 名称 | 说明 |
|---:|---|---|
| `0x00` | `HELLO` | 服务端问候 / 认证挑战 |
| `0x01` | `HELLO_ACK` | 保留 |
| `0x02` | `IDENTIFY` | 客户端身份确认 |
| `0x03` | `IDENTIFIED` | 服务端确认会话就绪 |
| `0x04` | `REIDENTIFY` | 会话参数更新 |
| `0x05` | `SUBSCRIBE` | 保留 |
| `0x06` | `EVENT` | 事件通知 |
| `0x07` | `REQUEST` | 请求 |
| `0x08` | `REQUEST_RESPONSE` | 请求响应 |
| `0x09` | `REQUEST_BATCH` | 批量请求 |
| `0x0A` | `REQUEST_BATCH_RESPONSE` | 批量响应 |
| `0x0E` | `BYE` | 关闭请求 |
| `0x0F` | `BYE_ACK` | 关闭确认 |

MVP 必须实现：`HELLO / IDENTIFY / IDENTIFIED / EVENT / REQUEST / REQUEST_RESPONSE`。Batch 可延后。

### 8.5 Stream Profile

Stream Profile 是具体可建流协议档案，不是 STREAM 数据包字段。STREAM 数据包只携带 `streamId / seqId / cursor / data`，Profile 由 RPC 建流方法协商并绑定到 `streamId`。

| profileId | 名称 | 说明 |
|---:|---|---|
| `0x0000` | `reserved` | 保留 |
| `0x0101` | `firmware.ota` | 固件升级数据块上传 |
| `0x0201` | `file.upload` | 文件上传 |
| `0x0202` | `file.download` | 文件下载 |
| `0x0401` | `log.realtime` | 实时日志 |
| `0x1001` | `media.video` | 视频帧流 |
| `0x1002` | `media.audio` | 音频帧流 |
| `0x3001` | `control.hid_raw` | HID/KVM 原始输入 |
| `0x4001` | `sensor.sample` | 传感器采样 |
| `0x8001` | `legacy.tunnel` | 旧协议连续字节流隧道 |
| `0xF001-0xFFFF` | `vendor.*` | 厂商私有 |

MVP 必须实现：`firmware.ota`。`file.upload / file.download / log.realtime` 可选。

---

## 9. Domain Registry 规则

| Domain | 说明 | MVP |
|---|---|---:|
| `device` | 设备基础信息 | 是 |
| `capability` | 能力查询 | 是 |
| `brightness` | 亮度控制 | 是 |
| `firmware` | 固件升级控制面 | 是 |
| `stream` | 流控制面 | 是 |
| `event` | 事件订阅 | 是 |
| `display` | 显示控制 | 否 |
| `video` | 视频控制 | 否 |
| `audio` | 音频控制 | 否 |
| `file` | 文件控制 | 否 |
| `log` | 日志控制 | 否 |
| `diagnostic` | 诊断 / 产测 | 否 |
| `input` | 输入 / KVM | 否 |
| `network` | 网络配置 | 否 |
| `storage` | 存储管理 | 否 |
| `sensor` | 传感器 | 否 |
| `vendor` | 厂商私有扩展 | 否 |

---

## 10. MethodId 分配规则

MethodId 使用 `uint16`，按 domain 分段：

| 范围 | Domain |
|---:|---|
| `0x0000-0x00FF` | reserved |
| `0x0100-0x01FF` | `device.*` |
| `0x0200-0x02FF` | `session.*` |
| `0x0300-0x03FF` | `capability.*` |
| `0x0400-0x04FF` | `system.*` |
| `0x0500-0x05FF` | `display.*` |
| `0x0600-0x06FF` | `brightness.*` |
| `0x0700-0x07FF` | `video.*` |
| `0x0800-0x08FF` | `audio.*` |
| `0x0900-0x09FF` | `stream.*` |
| `0x0A00-0x0AFF` | `file.*` |
| `0x0B00-0x0BFF` | `firmware.*` |
| `0x0C00-0x0CFF` | `log.*` |
| `0x0D00-0x0DFF` | `diagnostic.*` |
| `0x0E00-0x0EFF` | `network.*` |
| `0x0F00-0x0FFF` | `storage.*` |
| `0x1000-0x10FF` | `input.*` |
| `0x1100-0x11FF` | `sensor.*` |
| `0x7000-0x7FFF` | `vendor.*` |
| `0x8000-0xFFFF` | reserved（留给 eventId） |

Method 条目格式：

```yaml
methods:
  - id: 0x0602
    name: brightness.set
    kind: method
    status: mvp
    domain: brightness
    description: Set current brightness value.
    schema:
      params: BrightnessSetParams
      result: BrightnessSetResult
    errors:
      - INVALID_PARAM
      - DEVICE_BUSY
    events:
      - brightness.changed
    legacy:
      cmdValue: 0xC0021
      source: AXDP_HID
    mvp: true
```

Method 规则：
- `methodId` 不得重复；`methodName` 不得重复
- `methodId` 所在范围必须匹配 `domain`
- `params` 和 `result` 必须引用已注册 schema
- `errors` 必须引用已注册 errorCode
- 如果 method 会触发事件，应在 `events` 中声明
- 如果 method 来自老协议，应填写 `legacy`

---

## 11. EventId 分配规则

EventId 使用 `uint16`，采用高位区间与 MethodId 分离：

| 范围 | Domain |
|---:|---|
| `0x8000-0x80FF` | reserved |
| `0x8100-0x81FF` | `device.*` |
| `0x8300-0x83FF` | `capability.*` |
| `0x8500-0x85FF` | `display.*` |
| `0x8600-0x86FF` | `brightness.*` |
| `0x8700-0x87FF` | `video.*` |
| `0x8800-0x88FF` | `audio.*` |
| `0x8900-0x89FF` | `stream.*` |
| `0x8A00-0x8AFF` | `file.*` |
| `0x8B00-0x8BFF` | `firmware.*` |
| `0x8C00-0x8CFF` | `log.*` |
| `0x8D00-0x8DFF` | `diagnostic.*` |
| `0x9000-0x90FF` | `input.*` |
| `0xF000-0xFFFF` | vendor/reserved |

Event 规则：
- Event 必须通过 `PayloadType = RPC` 且 `rpcOp = EVENT` 承载
- Event 不应直接使用 `PayloadType = STREAM`
- 高频二进制数据应走 STREAM，事件只上报状态变化或统计摘要
- Event data 必须引用 schema

---

## 12. ErrorCode 分配规则

ErrorCode 使用 `uint16`：

| 范围 | 分类 |
|---:|---|
| `0x0000-0x00FF` | Common |
| `0x0100-0x01FF` | Frame / Transport |
| `0x0200-0x02FF` | Control |
| `0x0300-0x03FF` | RPC |
| `0x0400-0x04FF` | Stream |
| `0x0500-0x05FF` | Capability |
| `0x0600-0x06FF` | Firmware |
| `0x0700-0x07FF` | File |
| `0x0800-0x08FF` | Media |
| `0x0900-0x09FF` | Security（暂缓） |
| `0x7000-0x7FFF` | Vendor |
| `0x8000-0xFFFF` | Reserved |

ErrorCode 规则：
- 成功码统一使用 `SUCCESS = 0x0000`
- `retryable` 必须明确
- Control、RPC、Stream 都应使用同一 ErrorCode Registry

---

## 13. CapabilityId 分配规则

| 范围 | 分类 |
|---:|---|
| `0x0000-0x00FF` | reserved |
| `0x0100-0x01FF` | protocol |
| `0x0200-0x02FF` | rpc |
| `0x0300-0x03FF` | stream |
| `0x1000-0x1FFF` | business |
| `0x7000-0x7FFF` | vendor |
| `0x8000-0xFFFF` | reserved |

Capability 规则：
- 协议能力可在 `CONTROL OPEN / ACCEPT` 中协商
- 业务能力必须通过 RPC 查询（`capability.getAll`）
- Capability 不等于 Method；Method 是否可调用由 Capability 与 Method Registry 共同判断

---

## 14. Schema Registry 规则

Schema 用于描述 RPC params、result、event data、Stream Profile 建流上下文、control body。

Schema 规则：
- Schema 名称必须唯一
- 同一 Schema 内 `fieldId` 不得重复
- `fieldId` 不得复用已废弃字段编号
- 所有字段类型必须来自 Type System
- TLV 编码规则遵循 06《AXTP TLV Schema 编码规范》
- 字段编号规则遵循 07《AXTP Schema 字段编号规范》

---

## 15. Stream Subtype Registry 规则

STREAM 内部子类型注册表包括：`mediaType / codecId / fileType / firmwareImageType / logType / controlDataType / sensorType`

Stream Profile 规则：
- Stream Profile 表示具体可建流协议档案（`firmware.ota / file.upload / log.realtime`）
- 具体业务类型由 RPC 建流参数/响应和 Registry Profile 定义表达，并绑定到 `streamId`
- STREAM packet 不携带 `streamProfile` 或 metadata 字段
- 不得新增 PayloadType 来表达 video/audio/ota/file

---

## 16. Legacy Mapping 规则

老协议适配必须记录在 Registry 中。

```yaml
legacyMappings:
  - source: AXDP_HID
    legacyCmdValue: 0xC0021
    axtpMethodId: 0x0706
    axtpMethodName: video.setMode
    direction: request_response
    payload:
      legacyEncoding: fixed_struct
      axtpRpcEncoding: BINARY
      axtpBodyEncoding: TLV
      schema: VideoSetModeParams
    statusMapping:
      legacySuccess: 0x00
      axtpSuccess: SUCCESS
```

Legacy Mapping 规则：
- 老协议 `CmdValue` 可映射为 AXTP `methodId`，但不强制数值相同
- 如果数值相同有利于迁移，可保留原 CmdValue 低 16 位作为 methodId
- 老协议固定 payload 必须映射到 AXTP Schema
- 老协议状态码必须映射到 AXTP ErrorCode

MVP 优先适配：设备信息 / 能力查询 / 亮度设置查询 / 固件升级 / 基础 ACK/NACK / 基础错误码

---

## 17. Vendor Extension 规则

- 厂商扩展不得污染 Core ID 空间
- 厂商扩展必须声明 vendorId
- 厂商扩展不得改变 Core method/event/error/capability 的语义
- 厂商扩展应使用 vendor range

---

## 18. Versioning 规则

Registry 版本采用语义化版本 `MAJOR.MINOR.PATCH`：

| 变化 | 版本变化 |
|---|---|
| 新增 optional 字段 | MINOR |
| 新增 method/event/capability | MINOR |
| 新增 errorCode | MINOR |
| 修正文档描述，不改语义 | PATCH |
| 修改 stable 字段类型 | MAJOR，原则上禁止 |
| 修改 stable ID 语义 | MAJOR，原则上禁止 |

Protocol Version（Frame/Header/Wire Format）与 Registry Version（Method/Event/Error/Capability/Schema）相互独立。新增 methodId 不需要升级 Protocol Version。

---

## 19. Generator v1 校验规则

必须校验：

```text
ID 唯一性 / name 唯一性 / ID 范围合法性 / domain 与 ID 范围匹配
status 合法性 / schema 引用存在 / errorCode 引用存在
event 引用存在 / capability 引用存在 / legacy mapping 指向合法 method
fieldId 不重复 / fieldId 不复用 deprecated 字段
required 字段必须无 default 或具有明确 default 策略
```

---

## 20. MVP Registry 范围

### 20.1 MVP Core

```text
PayloadType:    CONTROL / RPC / STREAM
Control Opcode: OPEN / ACCEPT / HEARTBEAT / HEARTBEAT_ACK / ACK / NACK / CLOSE / CLOSE_ACK
RPC Op:         HELLO / IDENTIFY / IDENTIFIED / EVENT / REQUEST / REQUEST_RESPONSE
RPC Encoding:   JSON / BINARY
Stream Profile: firmware.ota
```

### 20.2 MVP Method

```text
device.getInfo / device.getVersion / device.getStatus
capability.getAll / capability.getDomain
brightness.get / brightness.set / brightness.getRange
firmware.getInfo / firmware.begin / firmware.end / firmware.verify / firmware.apply / firmware.abort
stream.open / stream.close / stream.getStatus
event.subscribe / event.unsubscribe
```

### 20.3 MVP Event

```text
device.statusChanged / capability.changed / brightness.changed
firmware.updateProgress / firmware.updateCompleted / firmware.updateFailed
stream.opened / stream.closed / stream.error
```

### 20.4 MVP ErrorCode

```text
SUCCESS / UNKNOWN_ERROR / INVALID_PARAM / UNSUPPORTED_METHOD
UNSUPPORTED_PAYLOAD_TYPE / UNSUPPORTED_ENCODING / TIMEOUT / DEVICE_BUSY
CRC_ERROR / FRAME_TOO_LARGE / SESSION_EXPIRED
STREAM_NOT_FOUND / STREAM_TIMEOUT / FIRMWARE_VERIFY_FAILED / FIRMWARE_ABORTED
```

### 20.5 MVP Capability

```text
protocol.payloadType.control / protocol.payloadType.rpc / protocol.payloadType.stream
rpc.encoding.json / rpc.encoding.binary / rpc.encoding.tlvStruct
stream.kind.ota / brightness.range / firmware.update / firmware.resume
```

---

## 21. Registry Review 规则

新增或修改 Registry 条目时，必须检查：

```text
1. 是否已有等价方法/事件/能力
2. 是否属于正确 domain
3. ID 是否在正确范围
4. 命名是否符合规范
5. 是否需要 schema
6. 是否需要 errorCode
7. 是否影响老协议兼容
8. 是否进入 MVP
```

---

## 22. 禁止事项

```text
在代码里硬编码未注册 methodId
复用 deprecated ID
把业务类型新增为 PayloadType
把事件直接放进 STREAM
把 ACK/NACK 做成业务 method
修改 stable 字段类型
把 optional 字段改成 required
在不同文档中手工维护不同 ID 表
老协议适配只写文字不进 legacy mapping
```
