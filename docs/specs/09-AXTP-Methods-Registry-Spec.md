# 09《AXTP Methods Registry Spec》

> Status: AXTP v1 Protocol Definition Meta Spec
> Spec Version: 1.0.0-rc1
> Scope: `methods:` entries, methodId allocation, request/response generation

版本：v1.0.0-rc1
状态：Protocol Definition 元规范
适用范围：`protocol/axtp.protocol.yaml` 中 `methods:` 条目的字段、约束和生成规则

---

## 1. 文档定位

本文档只定义 method registry 的元模型，不手写完整 MethodId 表。具体 method 内容必须写入 `protocol/axtp.protocol.yaml` 的 `methods:`。

---

## 2. methods 条目结构

```yaml
methods:
  - name: device.getInfo
    methodId: 0x0101
    bitOffset: 0
    domain: device
    since: 1.0.0
    status: stable
    request:
      type: Empty
    response:
      type: DeviceInfo
    errors:
      - INVALID_PARAMS
      - DEVICE_BUSY
    capabilities:
      - device.info
```

---

## 3. 字段定义

| 字段 | 必填 | 说明 |
|---|---:|---|
| `name` | 是 | JSON-RPC method name，必须为 `domain.action` |
| `methodId` | 是 | uint16，Binary-RPC methodId，wire 上使用 |
| `bitOffset` | 是 | uint8，该 method 在所属 domain 的 `capability.supportedMethods` bitmap 中的 bit 位置，domain 内从 0 开始，domain 内唯一 |
| `domain` | 是 | 所属业务域，必须与 name 前缀一致 |
| `description` | 是 | 方法说明 |
| `since` | 是 | 首次引入版本 |
| `status` | 是 | `draft / experimental / stable / deprecated / reserved` |
| `request.type` | 是 | 必须引用 `types` 中存在的类型，空请求使用 `Empty`, 请求参数schema|
| `response.type` | 是 | 必须引用 `types` 中存在的类型，空响应使用 `Empty`, 响应结果schema|
| `errors` | 是 | 可能存在的错误码，必须引用 `errors` 中存在的 error name |
| `events` | 否 | 调用后可能触发的事件，必须引用 `events` 中存在的 event name |
| `capabilities` | 否 | 关联能力，v1 仅用于文档 |
| `legacy` | 否 | 旧协议映射，不参与 wire format |

---

## 4. 约束

1. `methodId` 在所有 methods 中必须唯一。
2. `bitOffset` 在同一 `domain` 内必须唯一，从 0 开始连续分配，stable 后不得复用。
3. `name` 在所有 methods 中必须唯一。
4. `name` 必须采用 `domain.action`，不得使用空格、驼峰 domain 或协议层保留词。
5. `methodId` stable 后不得复用；废弃只能标记 `deprecated`。
6. `request.type` / `response.type` 必须存在。
7. `errors[]` 必须存在于 `errors:`。
8. methodId 和 bitOffset 范围由 Protocol Plan 分配；具体业务分配只写入 `protocol.yaml`。
9. `capability.supportedMethods` bitmap 按 domain 分段，每个 domain 内第 N bit 对应该 domain 下 `bitOffset=N` 的 method。
10. methodId 的高字节定义 method DomainId；`capability.supportedMethods` 的 Domain Block 必须使用该高字节。

---

## 5. 生成规则

`axtpc` 必须从 `methods:` 生成：

```text
generated/protocol.md Methods Reference
generated/schema method request/response schema
generated/cpp method enum          // methodId 值
generated/cpp method bitmap enum   // bitOffset 值
generated/ts method enum
generated/bitmap method bitmap layout
generated/conformance method validation cases
```

bitmap layout 规则：`capability.supportedMethods` 返回的 bitmap 中，第 N bit（从 LSB 起）置 1 表示 `bitOffset=N` 的 method 当前可用。

---

## 6. v1 Capability 关系

AXTP v1 Core 只强制 `capability.supportedMethods`。该 method 返回当前设备、当前固件、当前会话、当前鉴权状态下可调用的 methodId 集合。

完整 Capability Model 不得作为 v1 methods 的前置条件。
