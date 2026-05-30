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
registry/**/*.yaml + registry/domains/**/*.yaml
    ↓ Generator v1
protocol/axtp.protocol.yaml
    ↓ Generator v1
docs/generated/* / runtime generated artifacts / tooling generated artifacts
```

---

## 2. 设计原则

### 2.1 单一事实源

所有可枚举、可分配、可生成的协议对象必须在 Registry 中注册。不得在代码、文档、测试脚本中私自新增未注册 ID。

### 2.2 Header 与业务解耦

Frame Header 只识别 `PayloadType = CONTROL / RPC / STREAM`。业务对象（video/audio/ota/file/display 等）必须注册在 Method/Event/Stream/Capability/Schema Registry 中，不得出现在 Frame Header。

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
│   ├── protocol_meta.yaml
│   ├── rpc_encoding.yaml
│   ├── rpc_body_encoding.yaml
│   ├── rpc_op.yaml
│   └── stream_profile.yaml
├── method/
│   └── method_registry.yaml
├── event/
│   └── event_registry.yaml
├── error/
│   └── error_code.yaml
├── capability/
│   ├── capability_registry.yaml
│   └── mvp_profile.yaml
├── domains/
│   └── <domain>/
│       └── domain.yaml
├── schema/
│   ├── common_fields.yaml
│   ├── control_schema.yaml
│   ├── device_schema.yaml
│   ├── display_schema.yaml
│   ├── event_schema.yaml
│   ├── firmware_schema.yaml
│   ├── session_schema.yaml
│   └── stream_schema.yaml
├── legacy/
│   └── legacy_mapping.yaml
└── vendor/
    └── .gitkeep
```

`registry/` 是唯一机器事实源根目录。其中 `registry/method|event|error|capability|schema|legacy/` 保存核心/公共/已采纳事实，`registry/domains/<domain>/domain.yaml` 保存新增业务域事实。Generator v1 读取两类 Source YAML 后生成 `protocol/axtp.protocol.yaml`，不得手写 Protocol IR 或 generated 目录成果物。

新增业务默认只写 `registry/domains/<domain>/domain.yaml`，不同时复制到 `registry/method/`、`registry/event/`、`registry/schema/` 等核心文件。只有当该业务被治理为 MVP/Core 公共能力时，才执行晋升：保持原有 ID、fieldId、bitOffset 和语义不变，将条目迁入核心 registry，并从 domain YAML 删除对应条目，避免双事实源。

---

## 4. Registry 对象通用字段

```yaml
id: 0x0101
name: device.getInfo
kind: method
status: stable
domain: device
domainId: 0x01        # 域级掩码中的 DomainId（event/capability 可用；method 由 domain name 分组）
bitOffset: 0          # 域内 method/event 掩码位偏移，必须在同 domain 内连续
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
| --- | --- | --- |
| `id` | 是 | 数值 ID，必须唯一 |
| `name` | 是 | 可读名称，例如 `device.getInfo` |
| `kind` | 是 | `method/event/error/capability/enum/schema` |
| `status` | 是 | 生命周期状态 |
| `domain` | 视情况 | 所属业务域 |
| `domainId` | event/capability 必填 | 域级掩码中的 DomainId（1B），与 MethodId/EventId 高字节对齐；method 可由 `domain` 推导 |
| `bitOffset` | method/event 必填 | 该条目在 Domain 内的掩码位偏移（0-255），由 Registry 自增分配；capability 可按 v2 capability model 使用 |
| `version.since` | 是 | 首次引入版本 |
| `version.deprecated` | 否 | 废弃版本 |
| `description` | 是 | 简短描述 |
| `owner` | 是 | `core/vendor/legacy/experimental` |
| `mvp` | 是 | 是否属于 MVP 必须实现 |
| `legacy` | 否 | 老协议映射信息 |

---

## 5. 生命周期状态

| status | 含义 | 可生成代码 | 可用于生产 |
| --- |---|---:|---:|
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

小写单词：`device / capability / system / network / audio / camera / video / input / display / stream / firmware / storage / file / log / diagnostic / auth / privacy / sensor / vendor`

说明：`session` 是协议会话上下文，不作为业务 Domain 分配 MethodId；`event` 是 RPC 机制概念，不作为业务 Domain；`config` 仅用于老协议兼容映射，不作为 AXTP 原生业务域。

### 6.2 Method 命名

格式：`domain.verbObject`

推荐动词：`get / set / list / open / close / start / stop / begin / end / verify / apply / abort / resume / subscribe / unsubscribe`

示例：`device.getInfo / display.setBrightness / firmware.begin / stream.open`

### 6.3 Event 命名

格式：`domain.objectChanged / domain.actionStarted / domain.actionCompleted / domain.actionFailed / domain.error`

示例：`device.statusChanged / display.brightnessChanged / firmware.updateCompleted / stream.error`

### 6.4 ErrorCode 命名

全大写蛇形：`SUCCESS / INVALID_ARGUMENT / FRAME_CRC_ERROR / FW_VERIFY_FAILED`

### 6.5 Capability 命名

格式：`domain.capabilityName`

示例：`protocol.payloadType.control / rpc.encoding.binary / firmware.resume / display.brightness`

---

## 7. ID 编码规则

| 对象 | 宽度 | 使用位置 |
| --- |---:| --- |
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
|---:| --- |---|
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
|---:| --- |
| `0x00` | 保留 |
| `0x01-0x1F` | Core Control Opcode |
| `0x20-0x3F` | Control 扩展 |
| `0x40-0x6F` | 实验性 |
| `0x70-0x7E` | 厂商扩展 |
| `0x7F` | Vendor Escape |
| `0x80-0xFF` | 保留 |

MVP Control Opcode：`OPEN(0x01) / ACCEPT(0x02) / HEARTBEAT(0x04) / HEARTBEAT_ACK(0x05) / ACK(0x06) / NACK(0x07) / CLOSE(0x0A) / CLOSE_ACK(0x0B)`

预留 Opcode：`READY(0x03)` — 可选三步协商预留，当前版本非必要实现，收到时必须忽略

### 8.3 RPC Encoding

| ID | 名称 | 说明 |
|---:| --- |---|
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
|---:| --- |---|
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
|---:| --- |---|
| `0x0000` | `reserved` | 保留 |
| `0x0001` | `firmware.ota` | 固件升级数据块上传 |
| `0x0002` | `file.transfer` | 文件传输 |
| `0x0401` | `log.realtime` | 实时日志 |
| `0x1001` | `media.video` | 视频帧流 |
| `0x1002` | `media.audio` | 音频帧流 |
| `0x3001` | `control.hid_raw` | HID/KVM 原始输入 |
| `0x4001` | `sensor.sample` | 传感器采样 |
| `0x8001` | `legacy.tunnel` | 旧协议连续字节流隧道 |
| `0xF001-0xFFFF` | `vendor.*` | 厂商私有 |

MVP 必须实现：`firmware.ota`。`file.transfer / log.realtime` 可选或后续扩展。

---

## 9. Domain Registry 规则

| Domain | 说明 | MVP |
| --- |---|---:|
| `device` | 设备基础信息与生命周期 | 是 |
| `capability` | 能力查询与协商 | 是 |
| `system` | 系统控制：重启、时间同步、重置、功耗 | 是 |
| `firmware` | 固件升级控制面 | 是 |
| `stream` | 流控制面 | 是 |
| `display` | 显示控制：亮度、分辨率、旋转、布局、输入源 | 是 |
| `camera` | 摄像头：变焦、追踪、镜像、帧率、图像参数 | 否 |
| `video` | 视频编码与输出控制 | 否 |
| `audio` | 音频控制 | 否 |
| `input` | 输入源管理、KVM、HID | 否 |
| `network` | 网络配置 | 否 |
| `storage` | 存储管理 | 否 |
| `file` | 文件传输控制面 | 否 |
| `log` | 日志控制 | 否 |
| `diagnostic` | 诊断 / 产测 | 否 |
| `sensor` | 传感器 | 否 |
| `auth` | 认证与访问控制 | 否 |
| `privacy` | 隐私遮挡与隐私状态 | 否 |
| `vendor` | 厂商私有扩展 | 否 |

说明：`brightness` 不作为独立域，亮度控制方法、事件和能力归入 `display.*`。`boot / factory / screen / usb / bluetooth / misc` 等旧 HID 域只可映射到 `diagnostic.*` 或 `vendor.*`。`meeting / curtain / osd / mirror / ndi / overlay / amx` 等产品特定域只可映射到 `display.*`、`video.*` 或 `vendor.*` 的子能力。

---

## 10. MethodId 分配规则

MethodId 使用 `uint16`，按 domain 分段：

| 范围 | Domain |
|---:| --- |
| `0x0000-0x00FF` | reserved |
| `0x0100-0x01FF` | `device.*` |
| `0x0200-0x02FF` | `session.*`（协议层保留，暂缓） |
| `0x0300-0x03FF` | `capability.*` |
| `0x0400-0x04FF` | `system.*` |
| `0x0500-0x05FF` | `display.*` |
| `0x0600-0x06FF` | `camera.*` |
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
| `0x1200-0x12FF` | `auth.*` |
| `0x1300-0x13FF` | `privacy.*` |
| `0x7000-0x7FFF` | `vendor.*` |
| `0x8000-0xFFFF` | reserved（留给 eventId） |

Method 条目格式：

```yaml
methods:
  - id: 0x0502
    name: display.setBrightness
    kind: method
    status: mvp
    domain: display
    description: Set display brightness value.
    schema:
      params: DisplaySetBrightnessParams
      result: DisplaySetBrightnessResult
    errors:
      - RPC_PARAM_INVALID
      - BUSY
    events:
      - display.brightnessChanged
    legacy:
      cmdValue: null
      source: null
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
|---:| --- |
| `0x8000-0x80FF` | reserved |
| `0x8100-0x81FF` | `device.*` |
| `0x8300-0x83FF` | `capability.*` |
| `0x8400-0x84FF` | `system.*` |
| `0x8500-0x85FF` | `display.*` |
| `0x8600-0x86FF` | `camera.*` |
| `0x8700-0x87FF` | `video.*` |
| `0x8800-0x88FF` | `audio.*` |
| `0x8900-0x89FF` | `stream.*` |
| `0x8A00-0x8AFF` | `file.*` |
| `0x8B00-0x8BFF` | `firmware.*` |
| `0x8C00-0x8CFF` | `log.*` |
| `0x8D00-0x8DFF` | `diagnostic.*` |
| `0x8E00-0x8EFF` | `network.*` |
| `0x8F00-0x8FFF` | `storage.*` |
| `0x9000-0x90FF` | `input.*` |
| `0x9100-0x91FF` | `sensor.*` |
| `0x9200-0x92FF` | `auth.*` |
| `0xF000-0xFFFF` | vendor/reserved |

Event 规则：
- Event 必须通过 `PayloadType = RPC` 且 `rpcOp = EVENT` 承载
- Event 不应直接使用 `PayloadType = STREAM`
- 高频二进制数据应走 STREAM，事件只上报状态变化或统计摘要
- Event data 必须引用 schema
- 每个 Event 必须在其 Domain 内分配唯一 `bitOffset`（0-255），由 Registry 自增分配，用于 `eventMasks` 域级订阅掩码
- `domainId` 等于 EventId 高字节（如 `display.*` EventId 为 `0x85xx`，domainId = `0x85`）

---

## 12. ErrorCode 分配规则

ErrorCode 使用 `uint16`：

| 范围 | 分类 |
|---:| --- |
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
|---:| --- |
| `0x0000-0x00FF` | reserved |
| `0x0100-0x01FF` | protocol |
| `0x0200-0x02FF` | rpc |
| `0x0300-0x03FF` | stream |
| `0x1000-0x1FFF` | business |
| `0x7000-0x7FFF` | vendor |
| `0x8000-0xFFFF` | reserved |

Capability 规则：
- 协议运行参数可在 `CONTROL OPEN / ACCEPT` 中协商
- v1 Core 业务方法能力必须通过 RPC 查询（`capability.supportedMethods`）；完整 `capability.getAll` 属于 v2/P1
- Capability 不等于 Method；Method 是否可调用由 Capability 与 Method Registry 共同判断
- 每个 Capability 必须在其 Domain 内分配唯一 `bitOffset`（0-255），由 Registry 自增分配，用于 `capabilityMasks` 域级掩码响应
- `domainId` 与 MethodId 高字节对齐（如 `display.*` MethodId 为 `0x05xx`，domainId = `0x05`）

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
- Stream Profile 表示具体可建流协议档案（`firmware.ota / file.transfer / log.realtime`）
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

MVP 优先适配：设备信息 / 能力查询 / 显示亮度设置查询 / 固件升级 / 基础 ACK/NACK / 基础错误码

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
| --- |---|
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
device.getInfo
capability.supportedMethods
display.getBrightness / display.setBrightness
firmware.begin / firmware.end / firmware.verify / firmware.apply
```

### 20.3 MVP Event

```text
display.brightnessChanged
firmware.updateProgress / firmware.updateCompleted / firmware.updateFailed
```

### 20.4 MVP ErrorCode

```text
SUCCESS / UNKNOWN_ERROR / BUSY
FRAME_VERSION_UNSUPPORTED / FRAME_CRC_ERROR / FRAME_FRAGMENT_MISSING
CONTROL_OPCODE_INVALID / CONTROL_PAYLOAD_INVALID / CONTROL_OPEN_REQUIRED / CONTROL_OPEN_REJECTED
CONTROL_NEGOTIATION_FAILED / CONTROL_SESSION_INVALID / CONTROL_RESUME_FAILED / CONTROL_WINDOW_EXCEEDED
RPC_ENCODING_UNSUPPORTED / RPC_METHOD_NOT_FOUND / RPC_PARAM_INVALID
STREAM_NOT_FOUND / STREAM_TIMEOUT / STREAM_CRC_ERROR / FW_VERIFY_FAILED
```

### 20.5 MVP Capability

```text
protocol.payload.control / protocol.payload.rpc / protocol.payload.stream
device.info / capability.supportedMethods
display.brightness / display.brightnessMin / display.brightnessMax / display.brightnessStep
firmware.ota
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
为 method/event 新增条目时不分配 bitOffset
```

---

## 23. 域级二进制掩码体系（Domain-Scoped Mask）

AXTP 使用统一的域级二进制掩码体系，同时应用于：

- **能力查询**：v1 Core 使用 `capability.supportedMethods` 响应中的 method bitmap；v2/P1 可使用 `capability.getAll` 响应中的 `capabilityMasks`
- **事件订阅**：`IDENTIFY / REIDENTIFY` 请求中的 `eventMasks`

### 23.1 设计原则

- 按域划分，本地偏移，按需携带，二进制扁平流传输
- 每个 method/event 在其 Domain 内分配唯一 `bitOffset`（0-255），由 Registry 自增管理
- 不同 Domain 的 bitOffset 独立计数，互不干扰
- 设备端判定为 O(1) 位运算，无动态内存分配

### 23.2 线上格式

```text
Domain Mask Packets Chain = Domain Block × N

Domain Block = [DomainId: 1B] + [MaskLen: 1B] + [Bitmask: N B (Little-Endian)]
```

| 字段 | 长度 | 说明 |
| --- | --- | --- |
| `DomainId` | 1B | 域标识，与 MethodId/EventId 高字节对齐 |
| `MaskLen` | 1B | Bitmask 字节数（1-32），高水位截断 |
| `Bitmask` | N B | 该域的掩码，Little-Endian，Bit N 对应 bitOffset=N |

**高水位截断规则**：`MaskLen` 必须截断至最高有效字节。如果某域只用到 bitOffset=3，`MaskLen=1`，不得发送多余字节。

### 23.3 DomainId 映射表

| DomainId | MethodId/EventId 范围 | 域名 |
| --- | --- | --- |
| `0x01` | `0x0100-0x01FF` / `0x8100-0x81FF` | `device.*` |
| `0x03` | `0x0300-0x03FF` / `0x8300-0x83FF` | `capability.*` |
| `0x04` | `0x0400-0x04FF` / `0x8400-0x84FF` | `system.*` |
| `0x05` | `0x0500-0x05FF` / `0x8500-0x85FF` | `display.*` |
| `0x06` | `0x0600-0x06FF` / `0x8600-0x86FF` | `camera.*` |
| `0x07` | `0x0700-0x07FF` / `0x8700-0x87FF` | `video.*` |
| `0x08` | `0x0800-0x08FF` / `0x8800-0x88FF` | `audio.*` |
| `0x09` | `0x0900-0x09FF` / `0x8900-0x89FF` | `stream.*` |
| `0x0A` | `0x0A00-0x0AFF` / `0x8A00-0x8AFF` | `file.*` |
| `0x0B` | `0x0B00-0x0BFF` / `0x8B00-0x8BFF` | `firmware.*` |
| `0x0C` | `0x0C00-0x0CFF` / `0x8C00-0x8CFF` | `log.*` |
| `0x0D` | `0x0D00-0x0DFF` / `0x8D00-0x8DFF` | `diagnostic.*` |
| `0x0E` | `0x0E00-0x0EFF` / `0x8E00-0x8EFF` | `network.*` |
| `0x0F` | `0x0F00-0x0FFF` / `0x8F00-0x8FFF` | `storage.*` |
| `0x10` | `0x1000-0x10FF` / `0x9000-0x90FF` | `input.*` |
| `0x11` | `0x1100-0x11FF` / `0x9100-0x91FF` | `sensor.*` |
| `0x12` | `0x1200-0x12FF` / `0x9200-0x92FF` | `auth.*` |
| `0x70-0x7F` | vendor | `vendor.*` |

### 23.4 JSON 编码

在 JSON/WebSocket 模式下，Domain Mask Packets Chain 序列化为 Hex 字符串：

```json
{
  "eventMasks": "8501018B0103",
  "capabilityMasks": "010107050101"
}
```

### 23.5 C++ 解析（通用）

```cpp
bool isBitEnabled(const uint8_t* bitmask, uint8_t maskLen, uint8_t bitOffset) {
    uint8_t byteIndex = bitOffset / 8;
    uint8_t bitIndex  = bitOffset % 8;
    if (byteIndex >= maskLen) return false;
    return (bitmask[byteIndex] & (1 << bitIndex)) != 0;
}
```

同一函数适用于 `eventMasks` 和 `capabilityMasks` 的解析，无需区分。

### 23.6 Registry 要求

新增 method/event 条目时必须：

1. 在 YAML 中填写 `domainId` 和 `bitOffset`
2. `bitOffset` 在同一 Domain 内自增，不得重复
3. 废弃的 `bitOffset` 不得复用（标记 `deprecated: true` 后保留占位）
4. Generator 必须校验同一 Domain 内无 `bitOffset` 冲突
