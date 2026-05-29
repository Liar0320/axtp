# 12《AXTP Types and Capability Spec》

> Status: AXTP v1 Protocol Definition Meta Spec
> Spec Version: 1.0.0-rc1
> Scope: `types:` entries, fieldId rules, schema generation, v1 capability strategy

版本：v1.0.0-rc1
状态：Protocol Definition 元规范
适用范围：`protocol/axtp.protocol.yaml` 中 `types:` 和 v1 capability 策略的字段、约束和生成规则

---

## 1. 文档定位

本文档只定义 type / capability 元模型，不手写完整业务 schema 或能力树。具体类型内容必须写入 `protocol/axtp.protocol.yaml` 的 `types:`。

---

## 2. types 条目结构

```yaml
types:
  DeviceInfo:
    kind: object
    fields:
      - name: deviceId
        fieldId: 1
        type: string
        required: true
      - name: firmwareVersion
        fieldId: 2
        type: string
        required: true
```

---

## 3. 字段定义

| 字段 | 必填 | 说明 |
|---|---:|---|
| `kind` | 是 | `object / enum / bitmap / alias / bytes` |
| `fields[].name` | object 必填 | 字段名 |
| `fields[].fieldId` | object 必填 | TLV fieldId，1B，类型内唯一 |
| `fields[].type` | 是 | 基础类型或其他 type 引用 |
| `fields[].required` | 是 | 是否必填 |
| `fields[].default` | 否 | 默认值 |
| `fields[].deprecated` | 否 | 是否废弃 |
| `fields[].description` | 否 | 文档说明 |

---

## 4. fieldId 规则

1. 同一 type 内 `fieldId` 必须唯一。
2. stable 字段的 `fieldId` 不得复用。
3. 字段废弃后必须保留编号占位。
4. 新增字段应默认 optional，以保持向后兼容。
5. required 字段不得在 stable type 中删除。
6. 未知 optional field 必须被通用工具跳过。

---

## 5. 生成规则

`axtpc` 必须从 `types:` 生成：

```text
generated/protocol.md Types Reference
generated/schema JSON Schema
generated/cpp structs / descriptors / TLV codecs
generated/ts interfaces
generated/conformance schema validation cases
```

---

## 6. v1 Capability 策略

AXTP v1 Core 保留 capability 域，但不实现完整 Capability Model。

v1 Core 唯一强制能力发现 request：

```text
capability.supportedMethods
```

语义：

```text
返回当前设备、当前固件、当前会话、当前鉴权状态下支持的 methodId 集合。
```

`capability.supportedMethods` 的 method bitmap 按 domain 分段，由 `methods[].bitOffset` 自动派生：每个 domain 内第 N bit 置 1 表示该 domain 下 `bitOffset=N` 的 method 当前可用。

Binary 响应使用域级方法掩码链：

```text
Domain Block = [DomainId:1B] + [MaskLen:1B] + [MethodBitmask:N B Little-Endian]
```

| 字段 | 说明 |
|---|---|
| `DomainId` | 与 methodId 高字节对齐，例如 `display.*` methodId `0x05xx` 使用 `0x05` |
| `MaskLen` | bitmask 字节数，必须按最高有效 bit 截断，范围 `1-32` |
| `MethodBitmask` | Little-Endian bitset，Bit N 对应 `methods[].bitOffset=N` |

该格式只表达当前会话可调用 method 集合，不表达完整业务能力树。

---

## 7. v2 Capability Model

以下内容保留到 v2/P1，不作为 v1 Core 强制项：

```text
capability.getAll
capability.query
capability schema
完整业务能力树
按事件/流/profile 的复杂能力协商
```

v2 Capability Model 可以引用 `types:`，但不得改变 v1 method/event/error/type 的 stable wire format。完整设计草案迁移到 `protocol-source/future/AXTP-Capability-Model-v2.md`，不得回流为 v1 Core 必选项。
