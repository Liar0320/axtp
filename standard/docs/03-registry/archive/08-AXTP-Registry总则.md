# 08《AXTP Registry 总则》

版本：v1.0  
状态：MVP Draft  
所属目录：`03-registry/00-AXTP-Registry总则.md`  
依赖文档：

- `00-AXTP-协议总览与落地路线.md`
- `01-AXTP-整体协议规范.md`
- `02-AXTP-Control信令协议规范.md`
- `03-AXTP-RPC协议与二进制映射规范.md`
- `04-AXTP-Stream流式传输协议规范.md`
- `05-AXTP-Type-System基础类型规范.md`
- `06-AXTP-TLV-Schema编码规范.md`
- `07-AXTP-Schema字段编号规范.md`

---

## 1. 文档目的

本文档定义 AXTP Registry 系统的统一治理规则。

Registry 不是简单的 Markdown 表格，而是 AXTP 协议落地的 **单一事实源**。

它负责统一管理：

```text
PayloadType
Control Opcode
RPC Encoding
RPC Operation
Stream Profile
MethodId
EventId
ErrorCode
CapabilityId
SchemaId
FieldId
Vendor Extension
Legacy Mapping
```

Registry 的最终目标是支持：

```text
registry/*.yaml
schema/*.yaml
    ↓
Generator v1
    ↓
Markdown 文档
C++ enum / struct / descriptor
TLV encoder / decoder skeleton
RPC method descriptor
Event descriptor
ErrorCode descriptor
Capability descriptor
测试向量
```

也就是说：

```text
人工维护 YAML
机器生成文档和代码
```

而不是长期人工维护多份容易不一致的表格。

---

## 2. Registry 设计原则

### 2.1 单一事实源

所有可枚举、可分配、可生成的协议对象，都必须在 Registry 中注册。

例如：

```text
methodId
methodName
params schema
result schema
eventId
errorCode
capabilityId
legacyCmdValue
```

不得在 C++ 代码、Markdown 文档、测试脚本中私自新增未注册 ID。

---

### 2.2 Header 与业务解耦

AXTP Frame Header 只识别：

```text
PayloadType = CONTROL / RPC / STREAM
```

Header 不注册以下业务对象：

```text
video
audio
file
ota
brightness
log
kvm
sensor
```

这些业务对象必须注册在：

```text
Method Registry
Event Registry
Stream Registry
Capability Registry
Schema Registry
```

---

### 2.3 ID 稳定优先

一旦 ID 进入 `stable` 状态，不得随意变更语义。

包括：

```text
methodId
事件 eventId
错误码 errorCode
能力 capabilityId
字段 fieldId
枚举 enum value
```

如果语义需要变化，应新增 ID，而不是修改旧 ID。

---

### 2.4 向前兼容

新版本协议应尽量允许旧实现继续工作。

允许新增：

```text
新的 methodId
新的 eventId
新的 errorCode
新的 capabilityId
新的 optional 字段
新的 vendor extension
新的 Stream Profile
```

不允许破坏性修改：

```text
修改 stable methodId 的含义
修改 stable fieldId 的类型
修改 stable enum value 的含义
删除旧字段后复用编号
把 optional 字段改成 required 字段
改变默认字节序
改变成功/失败语义
```

---

### 2.5 MVP 优先

Registry 初期不追求一次性覆盖所有业务。

MVP 优先实现：

```text
device.*
capability.*
brightness.*
firmware.*
stream.*
event.subscribe / event.unsubscribe
基础 errorCode
基础 capabilityId
老协议 CmdValue 映射
```

MVP 目标是让第一版 C++ demo 能跑通完整链路，而不是把所有业务都注册完。

---

## 3. Registry 文件组织

建议目录结构：

```text
registry/
├── core/
│   ├── payload_type.yaml
│   ├── control_opcode.yaml
│   ├── rpc_encoding.yaml
│   ├── rpc_op.yaml
│   └── stream_profile.yaml
│
├── domain/
│   └── domain_registry.yaml
│
├── method/
│   ├── method_registry.yaml
│   └── method_registry_mvp.yaml
│
├── event/
│   ├── event_registry.yaml
│   └── event_registry_mvp.yaml
│
├── error/
│   ├── error_code.yaml
│   └── error_code_mvp.yaml
│
├── capability/
│   ├── capability_registry.yaml
│   └── capability_registry_mvp.yaml
│
├── stream/
│   ├── stream_type.yaml
│   ├── media_type.yaml
│   ├── codec_registry.yaml
│   ├── file_type.yaml
│   ├── firmware_image_type.yaml
│   ├── log_type.yaml
│   ├── control_data_type.yaml
│   └── sensor_type.yaml
│
├── schema/
│   ├── common_fields.yaml
│   ├── control_schema.yaml
│   ├── rpc_schema.yaml
│   ├── stream_schema.yaml
│   └── business_schema.yaml
│
├── legacy/
│   ├── legacy_cmd_mapping.yaml
│   ├── legacy_error_mapping.yaml
│   └── legacy_payload_mapping.yaml
│
└── vendor/
    └── vendor_registry.yaml
```

其中：

```text
*_mvp.yaml
```

用于第一阶段实现。

完整版本可以比 MVP 大，但 Generator v1 可以只读取 MVP 文件。

---

## 4. Registry 对象通用字段

所有 Registry 条目建议具备以下通用字段。

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
vendor: null
notes: null
```

### 4.1 通用字段说明

| 字段 | 必填 | 说明 |
|---|---|---|
| `id` | 是 | 数值 ID，必须唯一 |
| `name` | 是 | 可读名称，例如 `device.getInfo` |
| `kind` | 是 | `method/event/error/capability/enum/schema` |
| `status` | 是 | 生命周期状态 |
| `domain` | 视情况 | 所属业务域 |
| `version.since` | 是 | 首次引入版本 |
| `version.deprecated` | 否 | 废弃版本 |
| `version.removed` | 否 | 移除版本，通常不建议使用 |
| `description` | 是 | 简短描述 |
| `owner` | 是 | `core/vendor/legacy/experimental` |
| `mvp` | 是 | 是否属于 MVP 必须实现 |
| `legacy` | 否 | 老协议映射信息 |
| `vendor` | 否 | 厂商扩展信息 |
| `notes` | 否 | 补充说明 |

---

## 5. 生命周期状态

Registry 条目必须具备明确生命周期。

| status | 含义 | 是否可生成代码 | 是否可用于生产 |
|---|---|---:|---:|
| `draft` | 草案 | 可选 | 否 |
| `experimental` | 实验性 | 可选 | 否 |
| `mvp` | MVP 必须实现 | 是 | 可用于试产 |
| `stable` | 稳定 | 是 | 是 |
| `deprecated` | 已废弃但保留兼容 | 是 | 不建议新增使用 |
| `reserved` | 保留编号 | 否 | 否 |
| `removed` | 已移除 | 否 | 否 |

### 5.1 状态流转

推荐流转：

```text
draft
  ↓
experimental
  ↓
mvp
  ↓
stable
  ↓
deprecated
```

不推荐直接：

```text
draft → stable
```

### 5.2 deprecated 规则

当条目进入 `deprecated`：

- ID 不得复用。
- Generator 仍应生成兼容 enum。
- 文档中应标记替代项。
- 新业务不得继续引用。

示例：

```yaml
id: 0x0602
name: brightness.set
status: deprecated
replacement: display.brightness.set
version:
  since: 1.0.0
  deprecated: 1.3.0
```

---

## 6. 命名规范

### 6.1 Domain 命名

Domain 使用小写单词。

推荐：

```text
device
capability
brightness
display
video
audio
stream
file
firmware
log
diagnostic
input
network
storage
sensor
vendor
```

不推荐：

```text
Device
DEVICE
videoControl
firmware_ota
```

---

### 6.2 Method 命名

Method 使用：

```text
domain.verbObject
```

示例：

```text
device.getInfo
brightness.set
firmware.begin
firmware.verify
stream.open
stream.close
event.subscribe
```

推荐动词：

```text
get
set
list
open
close
start
stop
begin
end
verify
apply
abort
resume
subscribe
unsubscribe
```

不推荐：

```text
readBrightnessValueFromDevice
SetBrightness
brightnessSet
cmd_0x0602
```

---

### 6.3 Event 命名

Event 使用：

```text
domain.objectChanged
domain.actionStarted
domain.actionCompleted
domain.actionFailed
domain.error
```

示例：

```text
device.statusChanged
brightness.changed
firmware.updateProgress
firmware.updateCompleted
firmware.updateFailed
stream.opened
stream.closed
stream.error
```

---

### 6.4 ErrorCode 命名

ErrorCode 使用全大写蛇形命名。

示例：

```text
SUCCESS
INVALID_PARAM
UNSUPPORTED_METHOD
CRC_ERROR
SESSION_EXPIRED
STREAM_TIMEOUT
FIRMWARE_VERIFY_FAILED
```

---

### 6.5 Capability 命名

Capability 使用：

```text
domain.capabilityName
```

示例：

```text
protocol.payloadType.control
protocol.payloadType.rpc
protocol.payloadType.stream
rpc.encoding.json
rpc.encoding.binary
stream.kind.ota
firmware.resume
brightness.range
```

---

## 7. ID 编码规则

AXTP Registry 默认使用无符号整数 ID。

| 对象 | 默认宽度 | 说明 |
|---|---:|---|
| `payloadType` | `uint8` | Frame Header 中使用 |
| `controlOpcode` | `uint8` | Control Payload 中使用 |
| `rpcEncoding` | `uint8` | RPC Payload 中使用 |
| `rpcOp` | `uint8` | RPC Payload 中使用 |
| `streamProfile` | `uint16` | Registry / Capability / RPC 建流中使用，不出现在 STREAM Payload |
| `methodId` | `uint16` | RPC Request/Response 中使用 |
| `eventId` | `uint16` | RPC Event 中使用 |
| `errorCode` | `uint16` | Control/RPC/Stream 错误中使用 |
| `capabilityId` | `uint16` | Capability Registry 中使用 |
| `fieldId` | `uint8` | TLV Schema 中默认使用 |
| `schemaId` | `uint16` | 可选，用于 schema 注册 |

所有多字节数值的线上字节序遵循 `05-AXTP-Type-System基础类型规范.md`。

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
| `0x7F` | `VENDOR` | 不建议使用，优先走内部 vendor 字段 |
| `0x80-0xFF` | `RESERVED` | 未来扩展 |

MVP 只实现：

```text
CONTROL / RPC / STREAM
```

---

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

MVP Control Opcode：

```text
OPEN
ACCEPT
HEARTBEAT
HEARTBEAT_ACK
ACK
NACK
CLOSE
CLOSE_ACK
```

---

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

MVP 必须实现：

```text
JSON
BINARY
```

二进制 Body 的 TLV / RAW_BYTES / FIXED_STRUCT 由 `bodyEncoding` 表达，不占用 `rpcEncoding` 枚举。CBOR / MessagePack 可延后。

---

### 8.4 RPC Operation

| ID | 名称 | 说明 |
|---:|---|---|
| `0x01` | `REQUEST` | 请求 |
| `0x02` | `RESPONSE` | 响应 |
| `0x03` | `EVENT` | 事件 |
| `0x04` | `BATCH_REQUEST` | 批量请求 |
| `0x05` | `BATCH_RESPONSE` | 批量响应 |

MVP 必须实现：

```text
REQUEST
RESPONSE
EVENT
```

Batch 可延后。

---

### 8.5 Stream Profile

Stream Profile 是具体可建流协议档案，不是 STREAM 数据包字段，也不是 `MEDIA / FILE / OTA` 这类大类枚举。STREAM 数据包只携带 `streamId / seqId / cursor / data`，具体 Profile 由 RPC 建流方法协商并绑定到 `streamId`。

| profileId | 名称 | category | 说明 |
|---:|---|---|---|
| `0x0000` | `reserved` | - | 保留 |
| `0x0101` | `firmware.ota` | firmware | 固件升级数据块上传 |
| `0x0201` | `file.upload` | file | 文件上传 |
| `0x0202` | `file.download` | file | 文件下载 |
| `0x0401` | `log.realtime` | log | 实时日志 |
| `0x1001` | `media.video` | media | 视频帧流 |
| `0x1002` | `media.audio` | media | 音频帧流 |
| `0x3001` | `control.hid_raw` | control | HID/KVM 原始输入 |
| `0x4001` | `sensor.sample` | sensor | 传感器采样 |
| `0x8001` | `legacy.tunnel` | legacy | 旧协议连续字节流隧道 |
| `0xF001-0xFFFF` | `vendor.*` | vendor | 厂商私有 |

MVP 必须实现：

```text
firmware.ota
file.upload 可选
file.download 可选
log.realtime 可选
```

如果第一阶段只验证 OTA，则只需实现 `firmware.ota` Profile。不得在 STREAM L2 Header 中新增 Profile 字段。

---

## 9. Domain Registry 规则

Domain 用于管理业务方法、事件、能力和 schema。

### 9.1 推荐 Domain

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

### 9.2 Domain YAML 示例

```yaml
domains:
  - id: 0x01
    name: device
    status: stable
    description: Device information and lifecycle domain.
    methodRange: "0x0100-0x01FF"
    eventRange: "0x8100-0x81FF"
    capabilityRange: "0x1100-0x11FF"
    mvp: true

  - id: 0x06
    name: brightness
    status: mvp
    description: Brightness control domain.
    methodRange: "0x0600-0x06FF"
    eventRange: "0x8600-0x86FF"
    capabilityRange: "0x1600-0x16FF"
    mvp: true
```

---

## 10. MethodId 分配规则

### 10.1 MethodId 范围

MethodId 使用 `uint16`。

推荐按 domain 分段：

| 范围 | Domain | 说明 |
|---:|---|---|
| `0x0000-0x00FF` | reserved | 保留 |
| `0x0100-0x01FF` | `device.*` | 设备基础信息 |
| `0x0200-0x02FF` | `session.*` | 业务会话，暂缓 |
| `0x0300-0x03FF` | `capability.*` | 能力查询 |
| `0x0400-0x04FF` | `system.*` | 系统设置，暂缓 |
| `0x0500-0x05FF` | `display.*` | 显示控制 |
| `0x0600-0x06FF` | `brightness.*` | 亮度控制 |
| `0x0700-0x07FF` | `video.*` | 视频控制 |
| `0x0800-0x08FF` | `audio.*` | 音频控制 |
| `0x0900-0x09FF` | `stream.*` | 流控制面 |
| `0x0A00-0x0AFF` | `file.*` | 文件控制 |
| `0x0B00-0x0BFF` | `firmware.*` | 固件升级控制 |
| `0x0C00-0x0CFF` | `log.*` | 日志控制 |
| `0x0D00-0x0DFF` | `diagnostic.*` | 诊断 / 产测 |
| `0x0E00-0x0EFF` | `network.*` | 网络配置 |
| `0x0F00-0x0FFF` | `storage.*` | 存储管理 |
| `0x1000-0x10FF` | `input.*` | 输入 / KVM |
| `0x1100-0x11FF` | `sensor.*` | 传感器 |
| `0x7000-0x7FFF` | `vendor.*` | 厂商私有方法 |
| `0x8000-0xFFFF` | reserved | 不用于 methodId，优先留给 eventId |

---

### 10.2 Method 条目格式

```yaml
methods:
  - id: 0x0602
    name: brightness.set
    kind: method
    status: mvp
    domain: brightness
    description: Set current brightness value.
    rpc:
      request: true
      response: true
      event: false
      supportedEncodings:
        - JSON
        - BINARY
      supportedBodyEncodings:
        - TLV
    schema:
      params: BrightnessSetParams
      result: BrightnessSetResult
    errors:
      - INVALID_PARAM
      - UNSUPPORTED_METHOD
      - DEVICE_BUSY
    events:
      - brightness.changed
    capability:
      required:
        - brightness.set
    legacy:
      cmdValue: 0xC0021
      source: AXDP_HID
      payloadMapping: legacy.brightness.set
    version:
      since: 1.0.0
      deprecated: null
    mvp: true
```

### 10.3 Method 规则

- `methodId` 不得重复。
- `methodName` 不得重复。
- `methodId` 所在范围必须匹配 `domain`。
- `params` 和 `result` 必须引用已注册 schema。
- `errors` 必须引用已注册 errorCode。
- 如果 method 会触发事件，应在 `events` 中声明。
- 如果 method 依赖能力，应在 `capability.required` 中声明。
- 如果 method 来自老协议，应填写 `legacy`。

---

## 11. EventId 分配规则

### 11.1 EventId 范围

EventId 使用 `uint16`。

推荐采用高位区间，与 MethodId 分离。

| 范围 | Domain | 说明 |
|---:|---|---|
| `0x8000-0x80FF` | reserved | 保留 |
| `0x8100-0x81FF` | `device.*` | 设备事件 |
| `0x8300-0x83FF` | `capability.*` | 能力事件 |
| `0x8500-0x85FF` | `display.*` | 显示事件 |
| `0x8600-0x86FF` | `brightness.*` | 亮度事件 |
| `0x8700-0x87FF` | `video.*` | 视频事件 |
| `0x8800-0x88FF` | `audio.*` | 音频事件 |
| `0x8900-0x89FF` | `stream.*` | 流事件 |
| `0x8A00-0x8AFF` | `file.*` | 文件事件 |
| `0x8B00-0x8BFF` | `firmware.*` | 固件事件 |
| `0x8C00-0x8CFF` | `log.*` | 日志事件 |
| `0x8D00-0x8DFF` | `diagnostic.*` | 诊断事件 |
| `0x9000-0x90FF` | `input.*` | 输入 / KVM 事件 |
| `0xF000-0xFFFF` | vendor/reserved | 厂商与保留 |

---

### 11.2 Event 条目格式

```yaml
events:
  - id: 0x8601
    name: brightness.changed
    kind: event
    status: mvp
    domain: brightness
    description: Brightness value changed.
    schema:
      data: BrightnessChangedEvent
    severity: info
    delivery:
      reliable: true
      replayable: false
      subscribeRequired: true
    relatedMethods:
      - brightness.set
      - brightness.get
    version:
      since: 1.0.0
    mvp: true
```

### 11.3 Event 规则

- Event 必须通过 `PayloadType = RPC` 且 `rpcOp = EVENT` 承载。
- Event 不应直接使用 `PayloadType = STREAM`。
- 高频二进制数据应走 STREAM，事件只上报状态变化或统计摘要。
- Event data 必须引用 schema。
- 支持订阅的事件应声明 `subscribeRequired`。

---

## 12. ErrorCode 分配规则

### 12.1 ErrorCode 范围

ErrorCode 使用 `uint16`。

| 范围 | 分类 | 说明 |
|---:|---|---|
| `0x0000-0x00FF` | Common | 通用成功 / 通用错误 |
| `0x0100-0x01FF` | Frame / Transport | 帧、传输、CRC、分片错误 |
| `0x0200-0x02FF` | Control | Control 信令错误 |
| `0x0300-0x03FF` | RPC | RPC 解析、方法、参数错误 |
| `0x0400-0x04FF` | Stream | Stream 数据面错误 |
| `0x0500-0x05FF` | Capability | 能力不支持、协商失败 |
| `0x0600-0x06FF` | Firmware | OTA / 固件升级错误 |
| `0x0700-0x07FF` | File | 文件传输错误 |
| `0x0800-0x08FF` | Media | 音视频错误 |
| `0x0900-0x09FF` | Security | 鉴权、加密、权限错误，暂缓 |
| `0x7000-0x7FFF` | Vendor | 厂商私有错误 |
| `0x8000-0xFFFF` | Reserved | 保留 |

---

### 12.2 ErrorCode 条目格式

```yaml
errors:
  - code: 0x0000
    name: SUCCESS
    kind: error
    status: stable
    category: common
    description: Operation completed successfully.
    retryable: false
    severity: info
    mapsTo:
      http: 200
      jsonRpc: 0
    mvp: true

  - code: 0x0302
    name: INVALID_PARAM
    kind: error
    status: mvp
    category: rpc
    description: Request parameter is invalid.
    retryable: false
    severity: warning
    mvp: true
```

### 12.3 ErrorCode 规则

- 成功码统一使用 `SUCCESS = 0x0000`。
- 不同层级可复用通用错误码，但 domain 特有错误应注册独立码。
- `retryable` 必须明确。
- `severity` 必须明确。
- Control、RPC、Stream 都应使用同一 ErrorCode Registry。

---

## 13. CapabilityId 分配规则

Capability 分为两类：

```text
Protocol Capability
Business Capability
```

### 13.1 CapabilityId 范围

| 范围 | 分类 | 说明 |
|---:|---|---|
| `0x0000-0x00FF` | reserved | 保留 |
| `0x0100-0x01FF` | protocol | PayloadType、Header Profile、CRC 等 |
| `0x0200-0x02FF` | rpc | RPC Encoding、Batch、Event 等 |
| `0x0300-0x03FF` | stream | Stream Profile、窗口、断点续传等 |
| `0x1000-0x1FFF` | business | 业务能力 |
| `0x7000-0x7FFF` | vendor | 厂商私有能力 |
| `0x8000-0xFFFF` | reserved | 保留 |

---

### 13.2 Capability 条目格式

```yaml
capabilities:
  - id: 0x0101
    name: protocol.payloadType.control
    kind: capability
    status: stable
    category: protocol
    description: Device supports PayloadType CONTROL.
    valueType: bool
    default: true
    mvp: true

  - id: 0x1601
    name: brightness.range
    kind: capability
    status: mvp
    category: business
    domain: brightness
    description: Supported brightness value range.
    valueType: object
    schema: BrightnessRangeCapability
    mvp: true
```

### 13.3 Capability 规则

- 协议能力可在 `CONTROL OPEN / ACCEPT` 中协商。
- 业务能力必须通过 RPC 查询，例如 `capability.getAll`。
- Capability 不等于 Method。
- Method 是否可调用，应由 Capability 与 Method Registry 共同判断。

---

## 14. Schema Registry 规则

Schema Registry 用于描述 RPC params、result、event data、Stream Profile 建流上下文、control body。

### 14.1 Schema 条目格式

```yaml
schemas:
  - name: BrightnessSetParams
    kind: schema
    status: mvp
    domain: brightness
    encoding:
      - TLV
      - JSON
    fields:
      - id: 0x01
        name: value
        type: uint8
        required: true
        range:
          min: 0
          max: 100
        description: Brightness value in percent.
      - id: 0x02
        name: transitionMs
        type: uint16
        required: false
        default: 0
        description: Transition duration in milliseconds.
```

### 14.2 Schema 规则

- Schema 名称必须唯一。
- 同一 Schema 内 `fieldId` 不得重复。
- `fieldId` 不得复用已废弃字段编号。
- 所有字段类型必须来自 Type System。
- TLV 编码规则必须符合 `06-AXTP-TLV-Schema编码规范.md`。
- 字段编号规则必须符合 `07-AXTP-Schema字段编号规范.md`。

---

## 15. Stream Subtype Registry 规则

STREAM 内部还需要维护子类型注册表。

包括：

```text
mediaType
codecId
fileType
firmwareImageType
logType
controlDataType
sensorType
```

### 15.1 stream subtype 条目示例

```yaml
mediaTypes:
  - id: 0x01
    name: VIDEO
    status: stable
    description: Video media stream.

codecs:
  - id: 0x01
    name: H264
    status: stable
    mediaType: VIDEO
    description: H.264 video codec.

firmwareImageTypes:
  - id: 0x01
    name: MCU_FIRMWARE
    status: mvp
    description: MCU firmware image.
```

### 15.2 Stream Profile 规则

- Stream Profile 表示具体可建流协议档案，例如 `firmware.ota`、`file.upload`、`log.realtime`。
- 具体业务类型由 RPC 建流参数/响应和 Registry Profile 定义表达，并绑定到 `streamId`。
- STREAM packet 不携带 `streamProfile` 或 metadata 字段。
- 不得新增 PayloadType 来表达 video/audio/ota/file。

---

## 16. Legacy Mapping 规则

AXTP 需要兼容老协议，尤其是既有 HID/BLE 命令。

老协议适配必须记录在 Registry 中，而不是只写在迁移文档里。

### 16.1 Legacy Mapping 对象

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
    notes: Preserve legacy CmdValue semantics as methodId mapping.
```

### 16.2 Legacy Mapping 规则

- 老协议 `CmdValue` 可映射为 AXTP `methodId`，但不强制数值相同。
- 如果数值相同有利于迁移，可保留原 CmdValue 低 16 位作为 methodId。
- 老协议固定 payload 必须映射到 AXTP Schema。
- 老协议状态码必须映射到 AXTP ErrorCode。
- 老协议 ACK/NACK 必须映射到 AXTP Control ACK/NACK 或 RPC Response。

### 16.3 老协议适配优先级

MVP 优先适配：

```text
设备信息
能力查询
亮度设置/查询
固件升级
基础 ACK/NACK
基础错误码
```

---

## 17. Vendor Extension 规则

AXTP 允许厂商扩展，但必须受控。

### 17.1 Vendor 基本原则

- 厂商扩展不得污染 Core ID 空间。
- 厂商扩展必须声明 vendorId。
- 厂商扩展不得改变 Core method/event/error/capability 的语义。
- 厂商扩展应尽量使用 vendor range。

### 17.2 Vendor Registry 示例

```yaml
vendors:
  - vendorId: 0x0001
    name: ExampleVendor
    oui: null
    description: Example vendor extension namespace.

vendorMethods:
  - id: 0x7001
    name: vendor.example.customCommand
    vendorId: 0x0001
    status: experimental
    schema:
      params: VendorCustomCommandParams
      result: VendorCustomCommandResult
```

---

## 18. Versioning 规则

### 18.1 Registry 版本

Registry 版本采用语义化版本：

```text
MAJOR.MINOR.PATCH
```

示例：

```text
1.0.0
1.1.0
1.1.1
```

### 18.2 版本变化规则

| 变化 | 版本变化 |
|---|---|
| 新增 optional 字段 | MINOR |
| 新增 method/event/capability | MINOR |
| 新增 errorCode | MINOR |
| 修正文档描述，不改语义 | PATCH |
| 修复 schema 注释，不改 wire format | PATCH |
| 修改 stable 字段类型 | MAJOR，原则上禁止 |
| 修改 stable ID 语义 | MAJOR，原则上禁止 |
| 删除 stable method/event/error | MAJOR，原则上禁止 |

### 18.3 Protocol Version 与 Registry Version

两者不同：

```text
Protocol Version = Frame/Header/Wire Format 版本
Registry Version = Method/Event/Error/Capability/Schema 版本
```

新增 methodId 不需要升级 Protocol Version。

改变 Frame Header 固定字段才需要升级 Protocol Version。

---

## 19. Generator v1 校验规则

Generator v1 读取 Registry 时，必须执行以下校验。

### 19.1 必须校验

```text
ID 唯一性
name 唯一性
ID 范围合法性
domain 与 ID 范围匹配
status 合法性
schema 引用存在
errorCode 引用存在
event 引用存在
capability 引用存在
legacy mapping 指向合法 method
fieldId 不重复
fieldId 不复用 deprecated 字段
required 字段必须无 default 或具有明确 default 策略
```

### 19.2 建议校验

```text
method 命名是否符合 domain.verbObject
event 命名是否符合 domain.objectChanged 等规则
errorCode 是否全大写蛇形命名
capability 是否使用 domain.capabilityName
MVP method 是否具有完整 params/result schema
MVP method 是否具有测试向量
```

### 19.3 Generator v1 输出

MVP 输出：

```text
axtp_method_id.h
axtp_event_id.h
axtp_error_code.h
axtp_capability_id.h
axtp_payload_type.h
axtp_control_opcode.h
axtp_rpc_defs.h
axtp_stream_defs.h
axtp_schema_fields.h
registry_tables.md
registry_summary.json
```

---

## 20. Markdown 生成规则

Markdown 文档应由 Registry 生成，人工只维护 YAML。

生成文档应包括：

```text
MethodId 表
EventId 表
ErrorCode 表
Capability 表
Schema 字段表
Legacy Mapping 表
MVP 子集表
Deprecated 条目表
Vendor Extension 表
```

Markdown 表格中必须包含：

```text
ID
Name
Domain
Status
MVP
Description
Since
Deprecated
Legacy Mapping
```

---

## 21. C++ 命名生成规则

### 21.1 enum class

```cpp
enum class MethodId : uint16_t {
    DeviceGetInfo = 0x0101,
    BrightnessSet = 0x0602,
    FirmwareBegin = 0x0B02,
};
```

### 21.2 constexpr name 映射

```cpp
const char* ToString(MethodId id);
bool TryParseMethodId(uint16_t raw, MethodId* out);
```

### 21.3 Descriptor

```cpp
struct MethodDescriptor {
    uint16_t id;
    const char* name;
    const char* domain;
    const char* paramsSchema;
    const char* resultSchema;
    bool mvp;
};
```

---

## 22. MVP Registry 范围

第一阶段建议只注册以下内容。

### 22.1 MVP Core

```text
PayloadType:
  CONTROL
  RPC
  STREAM

Control Opcode:
  OPEN
  ACCEPT
  HEARTBEAT
  HEARTBEAT_ACK
  ACK
  NACK
  CLOSE
  CLOSE_ACK

RPC Op:
  REQUEST
  RESPONSE
  EVENT

RPC Encoding:
  JSON
  BINARY

Stream Profile:
  firmware.ota
```

### 22.2 MVP Method

```text
device.getInfo
device.getVersion
device.getStatus
capability.getAll
capability.getDomain
brightness.get
brightness.set
brightness.getRange
firmware.getInfo
firmware.begin
firmware.end
firmware.verify
firmware.apply
firmware.abort
stream.open
stream.close
stream.getStatus
event.subscribe
event.unsubscribe
```

### 22.3 MVP Event

```text
device.statusChanged
capability.changed
brightness.changed
firmware.updateProgress
firmware.updateCompleted
firmware.updateFailed
stream.opened
stream.closed
stream.error
```

### 22.4 MVP ErrorCode

```text
SUCCESS
UNKNOWN_ERROR
INVALID_PARAM
UNSUPPORTED_METHOD
UNSUPPORTED_PAYLOAD_TYPE
UNSUPPORTED_ENCODING
TIMEOUT
DEVICE_BUSY
CRC_ERROR
FRAME_TOO_LARGE
SESSION_EXPIRED
STREAM_NOT_FOUND
STREAM_TIMEOUT
FIRMWARE_VERIFY_FAILED
FIRMWARE_ABORTED
```

### 22.5 MVP Capability

```text
protocol.payloadType.control
protocol.payloadType.rpc
protocol.payloadType.stream
rpc.encoding.json
rpc.encoding.binary
rpc.encoding.tlvStruct
stream.kind.ota
brightness.range
firmware.update
firmware.resume
```

---

## 23. Registry Review 规则

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
9. 是否需要测试向量
10. 是否需要 C++ demo 覆盖
```

---

## 24. 禁止事项

以下行为禁止：

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

---

## 25. 与后续文档的关系

后续注册表文档必须遵循本文档。

```text
09-AXTP-MethodId注册表.md
10-AXTP-EventId注册表.md
11-AXTP-ErrorCode注册表.md
12-AXTP-Capability注册表.md
13-AXTP-MVP最小实现注册表.md
```

这些文档应尽量由 YAML Registry 生成。

人工可以维护说明文字，但 ID 表、字段表、枚举表必须由单一事实源生成。

---

## 26. 落地验收标准

Registry 总则完成后，认为可进入下一阶段的条件是：

```text
1. 已确定所有 Registry 文件目录。
2. 已确定 ID 分配规则。
3. 已确定 method/event/error/capability 命名规范。
4. 已确定生命周期状态。
5. 已确定 deprecated/reserved/vendor 规则。
6. 已确定 legacy mapping 字段。
7. 已确定 Generator v1 必须校验项。
8. 已确定 MVP Registry 范围。
```

当上述条件满足后，即可继续实现：

```text
09-AXTP-MethodId注册表.md
10-AXTP-EventId注册表.md
11-AXTP-ErrorCode注册表.md
12-AXTP-Capability注册表.md
13-AXTP-MVP最小实现注册表.md
```

---

## 27. 总结

AXTP Registry 的核心价值不是“列 ID 表”，而是建立一个可持续演进的协议资产库。

它必须同时服务于：

```text
协议文档
老协议迁移
二进制映射
TLV Schema
Capability 查询
Generator
C++ SDK
测试向量
```

最终目标是：

```text
一份 Registry YAML
生成所有文档、枚举、描述符和测试基础设施
```

只有做到这一点，AXTP 才能从协议设计真正进入工程落地。
