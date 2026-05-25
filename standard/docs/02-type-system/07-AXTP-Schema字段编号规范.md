# 07《AXTP Schema 字段编号规范》

版本：v1.0  
状态：MVP Draft  
适用范围：AXTP TLV Schema、Control TLV、RPC Body Schema、Stream Profile Context Schema、Registry YAML、Generator v1、C++ Demo v1、老协议适配层

---

## 1. 文档目的

本文档定义 AXTP 协议中 **Schema 字段编号** 的分配、使用、复用、废弃、保留和兼容规则。

在 AXTP 中，TLV 数据线上只携带：

```text
fieldId
length
value
```

字段名称、字段类型、字段含义、默认值、是否必填、是否废弃等信息不在线上传输，而是由外部 schema 或 registry 解释。

因此，字段编号规范是以下模块之间的共同约束：

```text
TLV Encoder / Decoder
RPC Binary Body
Control TLV Body
Stream Profile Context
Method Registry
Event Registry
Capability Registry
Generator v1
C++ Demo v1
老协议适配层
```

本文档解决的问题是：

```text
1. fieldId 应该如何分配
2. fieldId 是否允许在不同 schema 中复用
3. 公共字段和业务字段如何隔离
4. 字段废弃后是否可以复用编号
5. 老协议字段如何映射到 AXTP fieldId
6. Generator 如何根据 schema 生成稳定代码
7. C++ Parser 如何处理未知字段和废弃字段
```

---

## 2. 设计原则

### 2.1 fieldId 是局部语义，不是全局语义

默认情况下，`fieldId` 的含义只在当前 schema 内有效。

例如：

```text
brightness.set.params:
  fieldId 0x01 = value:uint8

firmware.begin.params:
  fieldId 0x01 = imageType:uint8
```

这两个 `0x01` 不冲突，因为它们属于不同的 method schema。

---

### 2.2 公共字段必须全局稳定

虽然普通业务字段允许局部复用，但以下字段属于公共字段，应在所有 schema 中保持一致语义：

```text
requestId
sessionId
messageId
streamId
transferId
seqId
offset
statusCode
errorCode
reasonCode
timestamp
vendorData
```

公共字段应使用本文档规定的公共字段编号范围。

---

### 2.3 字段编号一旦发布不得复用

在同一个 schema 内，字段编号一旦进入正式版本，即使字段被废弃，也不得复用给新的字段。

例如：

```yaml
fields:
  - id: 0x03
    name: oldMode
    type: uint8
    deprecated: true

# 后续不能把 0x03 改成 newMode
```

正确做法是：

```yaml
fields:
  - id: 0x03
    name: oldMode
    type: uint8
    deprecated: true

  - id: 0x04
    name: newMode
    type: uint8
```

---

### 2.4 低编号优先给高频字段

在 TLV 编码中，fieldId 是 1 Byte，因此所有字段编号占用相同字节数。

但为了可读性、人工分析和兼容历史命令，建议：

```text
0x01-0x0F：高频核心字段
0x10-0x1F：公共扩展字段
0x20-0x5F：业务字段
0x60-0x7E：未来扩展字段
0x7F：vendorData / escape
```

---

### 2.5 Schema 外置，线上不传字段名

TLV Payload 不携带字段名。

线上数据：

```text
01 01 50
```

必须依赖 schema 才能解释为：

```text
fieldId = 0x01
length  = 0x01
value   = 0x50

在 brightness.set.params 中：
  value = 80
```

---

## 3. fieldId 基础定义

AXTP TLV 的 `fieldId` 在 MVP 中固定为：

| 字段 | 长度 | 说明 |
|---|---:|---|
| `fieldId` | 1B | 字段编号，范围 `0x01-0xFF` |
| `length` | 1B / extended | 字段值长度 |
| `value` | N | 字段值 |

`fieldId = 0x00` 保留，不得使用。

```text
0x00 = RESERVED / INVALID
```

接收端遇到 `fieldId = 0x00` 时：

```text
MVP 建议：返回 TLV_INVALID_FIELD_ID
调试模式：可记录错误并丢弃整个 TLV body
```

---

## 4. fieldId 范围分配

### 4.1 总体范围

| 范围 | 名称 | 用途 |
|---:|---|---|
| `0x00` | `INVALID` | 禁用，保留 |
| `0x01-0x1F` | `COMMON_OR_CORE` | 公共字段或当前 schema 核心字段 |
| `0x20-0x5F` | `DOMAIN_FIELDS` | 业务域字段 |
| `0x60-0x7E` | `EXTENSION_FIELDS` | 当前 schema 扩展字段 |
| `0x7F` | `VENDOR_DATA` | 厂商私有数据或 escape 字段 |
| `0x80-0xBF` | `RESERVED_EXTENDED` | 预留给未来扩展字段编号机制 |
| `0xC0-0xEF` | `VENDOR_FIELDS` | 厂商私有字段 |
| `0xF0-0xFF` | `SYSTEM_RESERVED` | 系统保留，不建议业务使用 |

---

### 4.2 MVP 推荐使用范围

MVP 阶段建议只使用：

```text
0x01-0x5F
0x7F
```

暂时不要使用：

```text
0x80-0xFF
```

这样能降低 Generator v1 和 C++ Demo v1 的实现复杂度。

---

## 5. 公共字段编号表

以下字段属于 AXTP 公共字段。只要出现在 Control、RPC 或 Stream Profile Context 中，其字段编号、类型和语义应保持一致。

| fieldId | 字段名 | 类型 | 说明 |
|---:|---|---|---|
| `0x01` | `sessionId` | `uint32` | 会话 ID，仅用于 Control Session Context |
| `0x02` | `protocolVersion` | `uint8` | 协议版本 |
| `0x03` | `profileId` | `uint8` | Header Profile，例如 Standard / Compact |
| `0x04` | `messageId` | `uint32` | AXTP Frame MessageId |
| `0x05` | `requestId` | `uint32` | RPC 请求 ID |
| `0x06` | `streamId` | `uint32` | Stream ID |
| `0x07` | `transferId` | `uint32` | 文件 / OTA 传输 ID |
| `0x08` | `seqId` | `uint32` | Stream 数据序号 |
| `0x09` | `offset` | `uint64` | 文件 / OTA 偏移 |
| `0x0A` | `chunkIndex` | `uint32` | 分块序号 |
| `0x0B` | `chunkSize` | `uint32` | 分块大小 |
| `0x0C` | `totalSize` | `uint64` | 总大小 |
| `0x0D` | `timestamp` | `uint64` | 时间戳 |
| `0x0E` | `statusCode` | `uint16` | 状态码 |
| `0x0F` | `errorCode` | `uint16` | 错误码 |
| `0x10` | `reasonCode` | `uint16` | 原因码 |
| `0x11` | `targetType` | `uint8` | ACK/NACK 目标类型 |
| `0x12` | `frameIndex` | `uint16` | Frame 分片序号 |
| `0x13` | `frameCount` | `uint16` | Frame 分片总数 |
| `0x14` | `missingRanges` | `bytes` | 缺失分片范围 |
| `0x15` | `windowSize` | `uint16` | 滑动窗口大小 |
| `0x16` | `mtu` | `uint16` | 传输 MTU |
| `0x17` | `maxFrameSize` | `uint32` | 最大 Frame 大小 |
| `0x18` | `maxPayloadSize` | `uint32` | 最大 Payload 大小 |
| `0x19` | `heartbeatIntervalMs` | `uint32` | 心跳间隔 |
| `0x1A` | `resumeToken` | `bytes` | 会话恢复令牌 |
| `0x1B` | `flags` | `bitmap32` | 标志位 |
| `0x1C` | `encoding` | `uint8` | 编码类型 |
| `0x1D` | `schemaVersion` | `uint16` | Schema 版本 |
| `0x1E` | `traceId` | `bytes` | 调试追踪 ID |
| `0x1F` | `reservedCommon` | `bytes` | 公共保留 |

注意：

```text
公共字段不是要求每个 schema 都必须使用这些 fieldId。
而是当某个 schema 需要表达这些公共语义时，应优先使用上述编号。
```

---

## 6. 业务字段编号规则

### 6.1 业务字段推荐范围

业务字段推荐使用：

```text
0x20-0x5F
```

用于当前 method、event 或 metadata schema 的普通字段。

例如：

```yaml
schema: brightness.set.params
fields:
  - id: 0x20
    name: value
    type: uint8
    required: true

  - id: 0x21
    name: transitionMs
    type: uint16
    required: false
```

---

### 6.2 为什么业务字段不从 0x01 开始

在非常小的局部 schema 中，业务字段从 `0x01` 开始也可以工作。

但为了让公共字段和业务字段长期可维护，推荐业务字段从 `0x20` 开始。

这样同一个 TLV body 中同时出现公共字段和业务字段时，不会混淆：

```text
0x05 = requestId
0x0E = statusCode
0x20 = value
0x21 = transitionMs
```

---

### 6.3 MVP 简化规则

MVP 阶段可以允许两种模式：

```text
strict mode:
  0x01-0x1F 只用于公共字段
  0x20-0x5F 用于业务字段

compact mode:
  当前 schema 内字段可从 0x01 开始
  但必须在 schema 中声明 scope = local
```

推荐默认使用 `strict mode`。

只有在 BLE/HID 极低带宽或兼容旧协议时，才使用 `compact mode`。

---

## 7. 字段作用域

### 7.1 作用域类型

每个 schema 必须声明字段作用域。

| scope | 说明 | 是否允许复用 fieldId |
|---|---|---|
| `global` | 全局公共字段 | 不允许语义变化 |
| `domain` | 某个业务域内有效 | 同一 domain 内不建议复用 |
| `method` | 某个 method 的 params/result 内有效 | 不同 method 可复用 |
| `event` | 某个 event 的 data 内有效 | 不同 event 可复用 |
| `streamProfile` | 某个 Stream Profile 的 RPC 建流上下文内有效 | 不同 Profile 可复用 |
| `vendor` | 厂商私有 | 厂商自行维护 |

---

### 7.2 推荐作用域

| 场景 | 推荐 scope |
|---|---|
| Control TLV | `global` + `control` |
| RPC params | `method` |
| RPC result | `method` |
| RPC event data | `event` |
| Stream Profile 建流上下文 | `streamProfile` |
| Capability 描述 | `domain` |
| 老协议适配字段 | `method` + `legacy` |

---

## 8. Schema 命名规范

Schema 名称必须稳定、唯一、可被 Generator 引用。

### 8.1 Method Params Schema

格式：

```text
<methodName>.params
```

示例：

```text
device.getInfo.params
brightness.set.params
firmware.begin.params
```

---

### 8.2 Method Result Schema

格式：

```text
<methodName>.result
```

示例：

```text
device.getInfo.result
brightness.set.result
firmware.begin.result
```

---

### 8.3 Event Data Schema

格式：

```text
<eventName>.data
```

示例：

```text
brightness.changed.data
firmware.updateProgress.data
stream.error.data
```

---

### 8.4 Stream Profile Context Schema

格式：

```text
stream.<profileName>.context
```

示例：

```text
stream.firmware.ota.context
stream.file.upload.context
stream.file.download.context
stream.log.realtime.context
```

---

## 9. Schema YAML 描述格式

Generator v1 不应从 Markdown 表格反向解析字段。

字段定义的单一事实源应是 YAML 或 JSON。

推荐 YAML 结构：

```yaml
schemaId: brightness.set.params
version: 1
scope: method
owner: brightness
encoding: tlv
mode: strict
fields:
  - id: 0x20
    name: value
    type: uint8
    required: true
    range: [0, 100]
    description: Brightness value in percent.

  - id: 0x21
    name: transitionMs
    type: uint16
    required: false
    default: 0
    description: Transition duration in milliseconds.
```

---

## 10. 字段定义属性

每个字段建议支持以下属性。

| 属性 | 必填 | 说明 |
|---|---|---|
| `id` | 是 | fieldId，十六进制或整数 |
| `name` | 是 | 字段名 |
| `type` | 是 | AXTP Type System 类型 |
| `required` | 是 | 是否必填 |
| `default` | 否 | 默认值 |
| `range` | 否 | 数值范围 |
| `enum` | 否 | 枚举引用 |
| `bitmap` | 否 | bitmap 引用 |
| `repeated` | 否 | 是否数组 |
| `packed` | 否 | 数组是否 packed |
| `deprecated` | 否 | 是否废弃 |
| `since` | 否 | 引入版本 |
| `until` | 否 | 最后有效版本 |
| `legacy` | 否 | 老协议映射信息 |
| `description` | 否 | 描述 |

---

## 11. 字段分配流程

新增字段必须按以下流程进行：

```text
1. 确认字段属于哪个 schema
2. 检查该 schema 是否已有等价字段
3. 选择字段范围
   - 公共语义：使用公共字段编号
   - 业务字段：使用 0x20-0x5F
   - 扩展字段：使用 0x60-0x7E
   - 厂商字段：使用 0xC0-0xEF
4. 在 schema YAML 中新增字段
5. 标记 since 版本
6. 更新 Markdown 文档
7. 运行 generator
8. 运行测试向量
```

禁止直接在代码中手写新 fieldId 而不更新 schema。

---

## 12. 字段废弃规则

字段废弃时，不得删除原字段定义。

应标记：

```yaml
  - id: 0x22
    name: oldMode
    type: uint8
    required: false
    deprecated: true
    since: 1
    until: 2
    description: Deprecated. Use mode instead.
```

并新增新字段：

```yaml
  - id: 0x23
    name: mode
    type: uint8
    required: false
    since: 2
```

Generator 应继续生成废弃字段常量，但可以加 deprecated 标记。

C++ 可以生成：

```cpp
[[deprecated("Use mode instead")]]
static constexpr uint8_t kOldMode = 0x22;
```

---

## 13. 字段保留规则

当某个字段编号因历史原因不能使用，但也没有具体字段时，应声明为 reserved。

```yaml
reserved:
  - id: 0x24
    reason: Reserved for legacy mode byte.
```

Parser 遇到 reserved 字段：

```text
如果 length 合法：可以跳过
如果 strict validation：可以返回 SCHEMA_RESERVED_FIELD_PRESENT
```

---

## 14. 字段复用规则

### 14.1 同一 schema 内禁止复用

同一 schema 中禁止出现两个字段使用同一个 `id`。

错误示例：

```yaml
fields:
  - id: 0x20
    name: value
    type: uint8

  - id: 0x20
    name: mode
    type: uint8
```

Generator 必须报错。

---

### 14.2 不同 method schema 可复用

以下是允许的：

```yaml
schemaId: brightness.set.params
fields:
  - id: 0x20
    name: value
    type: uint8
```

```yaml
schemaId: audio.setVolume.params
fields:
  - id: 0x20
    name: value
    type: uint8
```

因为它们作用域不同。

---

### 14.3 公共字段不得语义复用

以下是禁止的：

```yaml
fields:
  - id: 0x06
    name: brightness
    type: uint8
```

因为 `0x06` 在公共字段中表示 `streamId`。

如果 schema 使用 `mode: strict`，Generator 必须阻止这种定义。

---

## 15. Compact Mode 字段编号规则

Compact Mode 用于极低带宽或老协议兼容。

在 Compact Mode 下，允许业务字段从 `0x01` 开始：

```yaml
schemaId: brightness.set.params
mode: compact
scope: method
fields:
  - id: 0x01
    name: value
    type: uint8
```

但必须满足：

```text
1. schema 明确声明 mode = compact
2. 不得与该 schema 内的公共字段混用
3. Generator 输出时必须标记 compact schema
4. 文档中必须说明该 schema 的 fieldId 为局部编号
```

MVP 推荐：

```text
Control TLV 使用 strict mode
RPC Binary Body 可使用 compact mode 兼容老协议
Stream Profile Context 使用 strict mode
```

---

## 16. 老协议字段映射规则

老协议适配是 AXTP MVP 的重要目标。

许多旧协议可能没有 TLV，而是固定结构或 CmdValue + raw payload。

适配时应将旧字段映射到 AXTP schema。

### 16.1 固定结构映射示例

旧协议：

```text
CmdValue = 0xC0021
Payload:
  byte0 = videoMode
  byte1 = fps
  byte2 = widthLow
  byte3 = widthHigh
  byte4 = heightLow
  byte5 = heightHigh
```

AXTP schema：

```yaml
schemaId: video.setMode.params
legacy:
  cmdValue: 0xC0021
  layout: fixed
fields:
  - id: 0x20
    name: videoMode
    type: uint8
    legacy:
      offset: 0
      length: 1

  - id: 0x21
    name: fps
    type: uint8
    legacy:
      offset: 1
      length: 1

  - id: 0x22
    name: width
    type: uint16
    legacy:
      offset: 2
      length: 2
      endian: little

  - id: 0x23
    name: height
    type: uint16
    legacy:
      offset: 4
      length: 2
      endian: little
```

---

### 16.2 老协议字段缺失

如果 AXTP 新字段在老协议中不存在，应声明：

```yaml
legacy:
  unsupported: true
```

或指定默认值：

```yaml
legacy:
  default: 0
```

---

### 16.3 老协议字段不可表达

如果老协议字段无法无损映射，应声明：

```yaml
legacy:
  mapping: lossy
  note: Old protocol only supports 0/1 mode, AXTP supports enum range.
```

Generator 应在兼容层代码中保留该提示。

---

## 17. Control TLV 字段编号策略

Control TLV 应优先使用公共字段编号。

示例：HELLO Body

```yaml
schemaId: control.hello.body
scope: global
mode: strict
fields:
  - id: 0x02
    name: protocolVersion
    type: uint8
    required: true

  - id: 0x03
    name: profileId
    type: uint8
    required: true

  - id: 0x16
    name: mtu
    type: uint16
    required: false

  - id: 0x17
    name: maxFrameSize
    type: uint32
    required: false

  - id: 0x19
    name: heartbeatIntervalMs
    type: uint32
    required: false
```

---

## 18. RPC Schema 字段编号策略

RPC Params / Result 字段建议使用业务字段范围。

示例：brightness.set.params

```yaml
schemaId: brightness.set.params
scope: method
mode: strict
fields:
  - id: 0x20
    name: value
    type: uint8
    required: true
    range: [0, 100]

  - id: 0x21
    name: transitionMs
    type: uint16
    required: false
    default: 0
```

示例：brightness.set.result

```yaml
schemaId: brightness.set.result
scope: method
mode: strict
fields:
  - id: 0x20
    name: appliedValue
    type: uint8
    required: true

  - id: 0x21
    name: actualTransitionMs
    type: uint16
    required: false
```

---

## 19. Event Schema 字段编号策略

Event Data 字段也使用业务字段范围。

示例：

```yaml
schemaId: brightness.changed.data
scope: event
mode: strict
fields:
  - id: 0x20
    name: value
    type: uint8
    required: true

  - id: 0x21
    name: source
    type: enum
    enum: BrightnessChangeSource
    required: false

  - id: 0x0D
    name: timestamp
    type: uint64
    required: false
```

这里 `timestamp` 使用公共字段编号 `0x0D` 是允许的。

---

## 20. Stream Profile Context 字段编号策略

Stream Profile 建流上下文应优先使用公共字段编号。

示例：OTA Context

```yaml
schemaId: stream.firmware.ota.context
scope: streamProfile
mode: strict
fields:
  - id: 0x07
    name: transferId
    type: uint32
    required: true

  - id: 0x09
    name: offset
    type: uint64
    required: true

  - id: 0x0A
    name: chunkIndex
    type: uint32
    required: true

  - id: 0x0B
    name: chunkSize
    type: uint32
    required: true

  - id: 0x20
    name: chunkCrc32
    type: uint32
    required: false

  - id: 0x21
    name: imageType
    type: enum
    enum: FirmwareImageType
    required: false
```

---

## 21. Vendor 字段规则

厂商私有字段有两种形式。

### 21.1 单字段 vendorData

使用：

```text
fieldId = 0x7F
```

内容为厂商自定义 bytes。

```yaml
  - id: 0x7F
    name: vendorData
    type: bytes
    required: false
```

适合简单私有扩展。

---

### 21.2 Vendor 字段范围

如果厂商需要多个私有字段，可以使用：

```text
0xC0-0xEF
```

但必须声明 vendor namespace：

```yaml
vendor:
  vendorId: 0x1234
  namespace: acme.display
```

字段示例：

```yaml
fields:
  - id: 0xC0
    name: acmePanelMode
    type: uint8
    vendor: acme.display
```

---

## 22. 扩展字段编号机制预留

`0x80-0xBF` 预留给未来扩展字段编号机制。

可能用途包括：

```text
1. 双字节 fieldId
2. typed TLV
3. schema local dictionary
4. compressed field table
5. vendor escaped field space
```

MVP 不实现这些机制。

接收端在 MVP 阶段遇到 `0x80-0xBF`：

```text
如果 length 合法：可以跳过
如果 strict mode：可以返回 UNSUPPORTED_EXTENDED_FIELD
```

---

## 23. 字段顺序规则

### 23.1 普通编码

普通 TLV 编码不要求字段顺序。

以下两种等价：

```text
20 01 50 21 02 E8 03
```

```text
21 02 E8 03 20 01 50
```

---

### 23.2 Canonical Encoding

用于测试向量、签名、hash、文档示例时，必须使用 Canonical Encoding。

Canonical Encoding 要求：

```text
1. fieldId 按升序排列
2. 同一 fieldId 的 repeated 字段保持原数组顺序
3. 不编码 optional 且等于默认值的字段
4. 不编码 deprecated 字段，除非兼容老协议需要
```

---

## 24. 重复字段规则

默认情况下，非 repeated 字段不得重复出现。

如果重复出现：

```text
strict parser: 返回 DUPLICATE_FIELD
lenient parser: 使用最后一个值，但必须记录 warning
```

Repeated 字段可以重复出现：

```text
20 01 01
20 01 02
20 01 03
```

表示：

```json
[1, 2, 3]
```

---

## 25. Unknown Field 规则

接收端遇到未知字段时：

```text
1. 读取 fieldId
2. 读取 length
3. 校验 length 不越界
4. 跳过 value
```

不得因为未知字段直接拒绝整个消息，除非：

```text
1. schema 声明 rejectUnknown = true
2. unknown 字段 length 非法
3. unknown 字段位于系统保留范围且 strict mode 开启
```

---

## 26. Required 字段校验规则

解析完成后，Parser 必须检查 required 字段是否存在。

如果缺失：

```text
返回 SCHEMA_REQUIRED_FIELD_MISSING
```

错误详情应包含：

```text
schemaId
fieldId
fieldName
```

MVP C++ Demo 可以只返回 fieldId。

---

## 27. Default 字段规则

如果 optional 字段缺失，但 schema 定义了 default：

```yaml
  - id: 0x21
    name: transitionMs
    type: uint16
    required: false
    default: 0
```

Parser 应在解码后的对象中填入默认值。

但注意：

```text
线上没有传输该字段
反序列化对象中可以有默认值
重新序列化时可省略默认值
```

---

## 28. 错误码建议

字段编号相关错误建议进入 ErrorCode 注册表。

| 错误名 | 说明 |
|---|---|
| `TLV_INVALID_FIELD_ID` | fieldId 为 0x00 或非法 |
| `TLV_DUPLICATE_FIELD` | 非 repeated 字段重复 |
| `TLV_UNKNOWN_REQUIRED_FIELD` | 未知字段被要求强校验 |
| `TLV_LENGTH_OVERFLOW` | length 越界 |
| `SCHEMA_REQUIRED_FIELD_MISSING` | 必填字段缺失 |
| `SCHEMA_TYPE_MISMATCH` | 字段类型不匹配 |
| `SCHEMA_RESERVED_FIELD_PRESENT` | 出现 reserved 字段 |
| `SCHEMA_DEPRECATED_FIELD_PRESENT` | 出现废弃字段，且 strict 模式禁止 |
| `SCHEMA_FIELD_RANGE_ERROR` | 数值超出 range |
| `SCHEMA_UNSUPPORTED_EXTENDED_FIELD` | 不支持扩展字段编号 |

---

## 29. Generator v1 要求

Generator v1 必须检查：

```text
1. 同一 schema 内 fieldId 不重复
2. fieldId 不为 0x00
3. strict mode 下业务字段不得占用公共字段编号
4. deprecated 字段不得被删除
5. reserved 字段不得被新字段占用
6. required 字段必须没有 default 冲突
7. enum / bitmap 引用必须存在
8. legacy offset 不得越界
9. schemaId 必须唯一
```

Generator v1 应输出：

```text
1. C++ fieldId 常量
2. C++ schema descriptor
3. Markdown 字段表
4. JSON/YAML 校验结果
5. 测试向量辅助信息
```

---

## 30. C++ 常量生成示例

输入：

```yaml
schemaId: brightness.set.params
fields:
  - id: 0x20
    name: value
    type: uint8
  - id: 0x21
    name: transitionMs
    type: uint16
```

输出：

```cpp
namespace axtp::schema::brightness_set_params {

static constexpr uint8_t kValue = 0x20;
static constexpr uint8_t kTransitionMs = 0x21;

} // namespace axtp::schema::brightness_set_params
```

---

## 31. C++ Schema Descriptor 示例

```cpp
static constexpr FieldDescriptor kBrightnessSetParamsFields[] = {
    {0x20, "value", FieldType::UInt8, FieldRule::Required},
    {0x21, "transitionMs", FieldType::UInt16, FieldRule::Optional},
};

static constexpr SchemaDescriptor kBrightnessSetParamsSchema = {
    "brightness.set.params",
    1,
    SchemaScope::Method,
    SchemaMode::Strict,
    kBrightnessSetParamsFields,
    2,
};
```

MVP Demo 可以不实现完整反射，但必须至少生成 fieldId 常量和基础 descriptor。

---

## 32. MVP 必须实现范围

MVP 阶段必须支持：

```text
1. fieldId = 1B
2. fieldId 0x00 禁用
3. fieldId 0x01-0x5F 可用
4. fieldId 0x7F vendorData
5. strict / compact 两种模式声明
6. 同一 schema 内禁止重复 fieldId
7. required / optional / default
8. deprecated / reserved
9. unknown field 跳过
10. schema YAML 到 C++ 常量生成
```

MVP 阶段暂不实现：

```text
1. 双字节 fieldId
2. typed TLV
3. 动态 schema 协商
4. 字段级压缩字典
5. 完整反射系统
6. 自动版本迁移器
```

---

## 33. 测试向量建议

本规范后续应提供以下测试向量：

```text
1. 正常字段编号解析
2. fieldId = 0x00 错误
3. unknown field 跳过
4. required 字段缺失
5. duplicate field 错误
6. deprecated 字段解析
7. reserved 字段出现
8. strict mode 公共字段冲突
9. compact mode 局部字段编号
10. legacy fixed payload 映射到 TLV schema
```

---

## 34. 示例：brightness.set 完整 Schema

```yaml
schemaId: brightness.set.params
version: 1
scope: method
owner: brightness
encoding: tlv
mode: strict
fields:
  - id: 0x20
    name: value
    type: uint8
    required: true
    range: [0, 100]
    since: 1
    description: Brightness value in percent.

  - id: 0x21
    name: transitionMs
    type: uint16
    required: false
    default: 0
    since: 1
    description: Brightness transition duration in milliseconds.

reserved:
  - id: 0x22
    reason: Reserved for legacy auto-brightness byte.
```

对应 TLV：

```text
20 01 50
21 02 E8 03
```

含义：

```text
value = 80
transitionMs = 1000
```

---

## 35. 示例：firmware.begin 完整 Schema

```yaml
schemaId: firmware.begin.params
version: 1
scope: method
owner: firmware
encoding: tlv
mode: strict
fields:
  - id: 0x20
    name: imageType
    type: enum
    enum: FirmwareImageType
    required: true

  - id: 0x21
    name: imageSize
    type: uint64
    required: true

  - id: 0x22
    name: imageVersion
    type: string
    required: false

  - id: 0x23
    name: sha256
    type: fixed_bytes
    length: 32
    required: false

  - id: 0x24
    name: chunkSize
    type: uint32
    required: false
    default: 1024
```

---

## 36. 与后续文档的关系

本文档为字段编号治理规范。

后续文档应引用本文档：

```text
08-AXTP-Registry总则.md
09-AXTP-MethodId注册表.md
10-AXTP-EventId注册表.md
11-AXTP-ErrorCode注册表.md
12-AXTP-Capability注册表.md
13-AXTP-MVP最小实现注册表.md
14-AXTP-老协议适配与迁移规范.md
15-AXTP-Generator-v1实现规范.md
16-AXTP-Cpp-Demo实现规范.md
```

---

## 37. 总结

AXTP 的 Schema 字段编号规范可以概括为：

```text
fieldId 是 TLV 的最小语义索引；
普通业务字段默认局部有效；
公共字段全局稳定；
字段编号一旦发布不得复用；
老协议通过 schema legacy 映射接入；
Generator 以 schema YAML 为唯一事实源生成代码和文档。
```

MVP 阶段应优先保证：

```text
编号稳定
未知字段可跳过
废弃字段不复用
老协议可映射
C++ 常量可生成
测试向量可验证
```
