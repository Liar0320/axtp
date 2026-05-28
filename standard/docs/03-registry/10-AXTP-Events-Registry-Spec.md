# 10《AXTP Events Registry Spec》

> Status: AXTP v1 Protocol Definition Meta Spec
> Spec Version: 1.0.0-rc1
> Scope: `events:` entries, eventId allocation, event payload generation

版本：v1.0.0-rc1
状态：Protocol Definition 元规范
适用范围：`protocol/axtp.protocol.yaml` 中 `events:` 条目的字段、约束和生成规则

---

## 1. 文档定位

本文档只定义 event registry 的元模型，不手写完整 EventId 表。具体 event 内容必须写入 `protocol/axtp.protocol.yaml` 的 `events:`。

---

## 2. events 条目结构

```yaml
events:
  - name: device.statusChanged
    eventId: 0x8201
    bitmapId: 0
    domain: device
    since: 1.0.0
    status: stable
    payload:
      type: DeviceStatusChangedEvent
    severity: info
```

---

## 3. 字段定义

| 字段 | 必填 | 说明 |
|---|---:|---|
| `name` | 是 | event name，必须为 `domain.eventName` |
| `eventId` | 是 | uint16，Binary-RPC eventId，wire 上使用 |
| `bitmapId` | 是 | uint8，该 event 在所属 domain 的 `eventMasks` bitmask 中的 bit 位置（bitOffset），domain 内从 0 开始，domain 内唯一 |
| `domain` | 是 | 与 name 前缀一致 |
| `since` | 是 | 首次引入版本 |
| `status` | 是 | `draft / experimental / stable / deprecated / reserved` |
| `payload.type` | 是 | 必须引用 `types` 中存在的类型 |
| `severity` | 否 | `info / warning / error / critical` |
| `trigger` | 否 | 触发来源，仅用于文档和测试 |
| `capabilities` | 否 | 关联能力，仅用于文档和 profile 约束 |

---

## 4. 约束

1. `eventId` 在所有 events 中必须唯一。
2. `bitmapId` 在同一 `domain` 内必须唯一，从 0 开始连续分配，stable 后不得复用。
3. `name` 在所有 events 中必须唯一。
4. stable eventId 不得复用；废弃只能标记 `deprecated`。
5. `payload.type` 必须存在。
6. Event 必须通过 `PayloadType = RPC` 且 `rpcOp = EVENT` 承载。
7. STREAM 数据不得作为 Event 直接承载；Event 只能通知状态或结果。
8. `eventMasks` 中的 `bitOffset` 必须与 `bitmapId` 一致，由 `axtpc` 从 `events[].bitmapId` 自动派生。
9. v1 Core 不强制完整 event capability discovery；事件能力可在 v2 Capability Model 中描述。

---

## 5. 生成规则

`axtpc` 必须从 `events:` 生成：

```text
generated/protocol.md Events Reference
generated/schema event payload schema
generated/cpp event enum          // eventId 值
generated/cpp event bitmap enum   // bitmapId 值（按 domain 分组）
generated/ts event enum
generated/conformance event payload validation cases
```

`eventMasks` 中每个 domain 的 bitmask 由该 domain 下所有 events 的 `bitmapId` 自动派生：domain 内第 N bit 置 1 表示 `bitmapId=N` 的 event 已订阅。v1 MVP 设备可采用全量广播模式，忽略 `eventMasks`。
