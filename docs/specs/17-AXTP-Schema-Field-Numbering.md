# 17《AXTP Schema 字段编号规范》

版本：v1.0
状态：MVP 字段编号规范
适用范围：AXTP TLV Schema、Control TLV、RPC Body Schema、Stream Profile Context Schema、Registry YAML
前置文档：15《AXTP Type System 基础类型规范》、16《AXTP TLV Schema 编码规范》

---

## 0. 速读：fieldId 怎么分配和演进

fieldId 是 schema-local 的字段编号。线上 TLV 不传字段名，所以同一个 schema 内 fieldId 一旦发布就不能复用；不同 schema 可以复用相同 fieldId。

新增 schema 时从 `0x01` 开始连续分配：

```yaml
schema: ExampleLevelConfig
fields:
  - fieldId: 0x01
    name: level
    type: uint8
    required: true
  - fieldId: 0x02
    name: applyDelayMs
    type: uint16
    required: false
```

后续演进示例：

```yaml
fields:
  - fieldId: 0x01
    name: level
    type: uint8
    required: true
  - fieldId: 0x02
    name: applyDelayMs
    type: uint16
    required: false
    deprecated: true
  - fieldId: 0x03
    name: applyPolicy
    type: enum8
    required: false
```

规则速查：

| 操作 | 做法 |
|---|---|
| 新增字段 | 使用当前 schema 内未用过的新 fieldId，默认 optional |
| 废弃字段 | 标记 deprecated，保留 fieldId 占位 |
| 删除 stable required 字段 | 不允许；只能兼容保留或版本化 |
| 预留字段 | 标记 reserved，不得临时复用 |
| 厂商私有字段 | 使用 vendor 范围或 `0x7F` escape，必须限定作用域 |

---

## 1. 文档目的

本文档定义 AXTP 协议中 Schema 字段编号（fieldId）的分配、复用、废弃、保留和兼容规则。

TLV 数据线上只携带 `fieldId / length / value`，字段名称、类型、含义等信息由外部 schema 解释。因此字段编号规范是 TLV Encoder/Decoder、RPC Binary Body、Stream Profile Context、Registry 之间的共同约束。Control TLV 使用 02《Control 信令协议规范》定义的独立字段表。

---

## 2. 设计原则

- **fieldId 是局部语义**：默认情况下 fieldId 含义只在当前 schema 内有效，不同 method schema 可复用同一 fieldId
- **不设置跨 schema 公共固定字段**：`transferId / streamId / timestamp / errorCode` 等字段如需出现，也在各自 schema 内作为普通字段从 `0x01` 起编号
- **字段编号一旦发布不得复用**：同一 schema 内废弃字段的 fieldId 不得分配给新字段
- **Schema 外置，线上不传字段名**：TLV Payload 不携带字段名，必须依赖 schema 才能解释

---

## 3. fieldId 基础定义

 | 字段 | 长度 | 说明 |
 |---|---:|---|
 | `fieldId` | 1B | 字段编号，范围 `0x01-0xFF` |
 | `length` | 1B / extended | 字段值长度 |
 | `value` | N | 字段值 |

`fieldId = 0x00` 保留，不得使用。接收端遇到 `fieldId = 0x00` 时返回 `TLV_INVALID_FIELD_ID`。

---

## 4. fieldId 范围分配

| 范围 | 名称 | 用途 |
|---:|---|---|
| `0x00` | `INVALID` | 禁用，保留 |
| `0x01-0x5F` | `SCHEMA_FIELDS` | 当前 schema 的普通字段，推荐从 `0x01` 连续分配 |
| `0x60-0x7E` | `EXTENSION_FIELDS` | 当前 schema 扩展字段 |
| `0x7F` | `VENDOR_DATA` | 厂商私有数据或 escape 字段 |
| `0x80-0xBF` | `RESERVED_EXTENDED` | 预留给未来扩展字段编号机制 |
 | `0xC0-0xEF` | `VENDOR_FIELDS` | 厂商私有字段 |
 | `0xF0-0xFF` | `SYSTEM_RESERVED` | 系统保留，不建议业务使用 |

MVP 阶段建议只使用 `0x01-0x5F` 和 `0x7F`，暂不使用 `0x80-0xFF`。

---

## 5. 字段编号规则

每个 method params/result、event data、capability object 或 Stream Profile Context 都有自己的 schema-local 字段编号空间。字段应从 `0x01` 开始，按当前 schema 的自然字段顺序连续分配；不同 schema 可以复用相同 fieldId。

```yaml
schema: ExampleLevelConfig
fields:
  - id: 0x01
    name: level
    type: uint8
    required: true
  - id: 0x02
    name: applyDelayMs
    type: uint16
    required: false
```

RPC Binary Header 已经携带 `requestId / methodOrEventId / statusCode / bodyEncoding` 等 envelope 信息，这些字段不需要在每个 TLV body 中重复定义公共 fieldId。

---

## 6. 字段作用域

 | scope | 说明 | 是否允许复用 fieldId |
 |---|---|---|
 | `method` | 某个 method 的 params/result 内有效 | 不同 method 可复用 |
 | `event` | 某个 event 的 data 内有效 | 不同 event 可复用 |
 | `streamProfile` | 某个 Stream Profile 的 RPC 建流上下文内有效 | 不同 Profile 可复用 |
 | `vendor` | 厂商私有 | 厂商自行维护 |

推荐：Control TLV 使用 02 文档的 `control` 字段命名空间；RPC params/result 使用 `method`，RPC event data 使用 `event`，Stream Profile 建流上下文使用 `streamProfile`。

---

## 8. Schema 命名规范

| 类型 | 格式 | 示例 |
|---|---|---|
| Method Params | `<methodName>.params` | `audio.setAlgorithmConfig.params` |
| Method Result | `<methodName>.result` | `audio.setAlgorithmConfig.result` |
| Event Data | `<eventName>.data` | `audio.algorithmConfigChanged.data` |
| Stream Profile Context | `stream.<profileName>.context` | `stream.firmware.update.context` |

---

## 9. Schema YAML 描述格式

```yaml
schemaId: ExampleLevelConfig
version: 1
scope: method
owner: example
encoding: tlv
mode: strict
fields:
  - id: 0x20
    name: level
    type: uint8
    required: true
    range: [0, 3]
    since: 1

  - id: 0x21
    name: applyDelayMs
    type: uint16
    required: false
    default: 0
    since: 1

reserved:
  - id: 0x03
    reason: Reserved for legacy auto mode byte.
```

---

## 10. 字段定义属性

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

## 11. 字段废弃规则

字段废弃时，不得删除原字段定义，应标记：

```yaml
  - id: 0x22
    name: oldMode
    type: uint8
    deprecated: true
    since: 1
    until: 2
```

并新增新字段（使用新 id）：

```yaml
  - id: 0x04
    name: mode
    type: uint8
    since: 2
```

---

## 12. 字段保留规则

当某个字段编号因历史原因不能使用时，声明为 reserved：

```yaml
reserved:
  - id: 0x05
    reason: Reserved for legacy mode byte.
```

Parser 遇到 reserved 字段：length 合法时可跳过；strict mode 下可返回 `SCHEMA_RESERVED_FIELD_PRESENT`。

---

## 13. 字段复用规则

- 同一 schema 内禁止两个字段使用同一 `id`，Generator 必须报错
- 不同 method schema 可复用同一 fieldId（作用域不同）
- 字段语义只由当前 schema 决定；不存在需要跨 schema 保持固定含义的公共字段段

---

## 14. 老协议字段映射规则

旧协议固定结构映射示例：

```yaml
schemaId: video.setMode.params
legacy:
  cmdValue: 0xC0021
  layout: fixed
fields:
  - id: 0x01
    name: videoMode
    type: uint8
    legacy:
      offset: 0
      length: 1
  - id: 0x02
    name: fps
    type: uint8
    legacy:
      offset: 1
      length: 1
  - id: 0x03
    name: width
    type: uint16
    legacy:
      offset: 2
      length: 2
      endian: little
```

老协议字段缺失时声明 `legacy: {unsupported: true}` 或 `legacy: {default: 0}`。无损映射不可能时声明 `legacy: {mapping: lossy}`。

---

## 15. 各 Schema 类型的字段编号策略

**Control TLV**：使用 04《AXTP Control Session Spec》定义的 control schema-local 字段编号。

**RPC Params/Result**：当前 schema 内从 `0x01` 开始分配，scope=method。

**Event Data**：当前 schema 内从 `0x01` 开始分配，scope=event。

**Stream Profile Context**：当前 schema 内从 `0x01` 开始分配，scope=streamProfile。`transferId / offset / chunkSize` 等字段没有跨 schema 固定编号。

---

## 16. Vendor 字段规则

- 单字段 vendorData：使用 `fieldId = 0x7F`，type=bytes，适合简单私有扩展
- 多个私有字段：使用 `0xC0-0xEF`，必须声明 vendor namespace（vendorId + namespace）

---

## 17. 扩展字段编号机制预留

`0x80-0xBF` 预留给未来扩展字段编号机制（双字节 fieldId、typed TLV 等）。MVP 不实现这些机制。接收端在 MVP 阶段遇到 `0x80-0xBF`：length 合法时可跳过；strict mode 下可返回 `UNSUPPORTED_EXTENDED_FIELD`。

---

## 18. 字段顺序规则

普通 TLV 编码不要求字段顺序。Canonical Encoding（用于测试向量、签名、hash）要求：

1. fieldId 按升序排列
2. 同一 fieldId 的 repeated 字段保持原数组顺序
3. 不编码 optional 且等于默认值的字段
4. 不编码 deprecated 字段（除非兼容老协议需要）

---

## 19. 重复字段与 Unknown Field 规则

- 非 repeated 字段重复出现：strict parser 返回 `DUPLICATE_FIELD`；lenient parser 使用最后一个值并记录 warning
- Repeated 字段可重复出现，表示数组
- Unknown field：读取 fieldId → 读取 length → 校验不越界 → 跳过 value；不得因未知字段拒绝整个消息

---

## 20. Required 字段与 Default 字段规则

- Required 字段缺失：返回 `SCHEMA_REQUIRED_FIELD_MISSING`，错误详情包含 schemaId/fieldId/fieldName
- Optional 字段缺失且有 default：Parser 在解码后对象中填入默认值；线上没有传输该字段；重新序列化时可省略

---

## 21. 错误码

 | 错误名 | 说明 |
 |---|---|
 | `TLV_INVALID_FIELD_ID` | fieldId 为 0x00 或非法 |
 | `TLV_DUPLICATE_FIELD` | 非 repeated 字段重复 |
 | `TLV_LENGTH_OVERFLOW` | length 越界 |
 | `SCHEMA_REQUIRED_FIELD_MISSING` | 必填字段缺失 |
 | `SCHEMA_TYPE_MISMATCH` | 字段类型不匹配 |
 | `SCHEMA_RESERVED_FIELD_PRESENT` | 出现 reserved 字段 |
 | `SCHEMA_DEPRECATED_FIELD_PRESENT` | 出现废弃字段且 strict 模式禁止 |
 | `SCHEMA_FIELD_RANGE_ERROR` | 数值超出 range |
 | `SCHEMA_UNSUPPORTED_EXTENDED_FIELD` | 不支持扩展字段编号 |

---

## 22. MVP 必须实现范围

必须：fieldId=1B、fieldId 0x00 禁用、fieldId 0x01-0x5F 可用、fieldId 0x7F vendorData、schema-local 编号、同一 schema 内禁止重复 fieldId、required/optional/default、deprecated/reserved、unknown field 跳过

可暂缓：双字节 fieldId、typed TLV、动态 schema 协商、字段级压缩字典、完整反射系统、自动版本迁移器
