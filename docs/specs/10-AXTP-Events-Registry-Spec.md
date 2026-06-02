# 10《AXTP Events Registry Spec》

> Status: AXTP v1 Protocol Definition Meta Spec
> Spec Version: 1.0.0-rc1
> Scope: `events:` entries, eventId allocation, event payload generation

版本：v1.0.0-rc1
状态：Protocol Definition 元规范
适用范围：`registry/event/` 与 `registry/domains/<domain>/domain.yaml` 中 event 源条目的字段、约束和生成规则

---

## 1. 文档定位

本文档只定义 event registry 的元模型，不手写完整 EventId 表。具体 event 内容必须写入 `registry/event/` 或 `registry/domains/<domain>/domain.yaml`；`protocol/axtp.protocol.yaml` 中的 `events:` 由 Generator 聚合生成。

新增业务 event 默认写入 `registry/domains/<domain>/domain.yaml`。`registry/event/event_registry.yaml` 只承载 Core/MVP 已采纳 event；业务 event 晋升为 Core/MVP 时必须迁移并删除 domain 中的原条目，不得两边重复定义。

---

## 2. 事件设计原则

- 事件名使用过去式或状态变化语义（`device.statusChanged`，不是 `device.changeStatus`）
- 事件不替代 Response：Response 回答请求是否成功，Event 通知后续状态变化
- 接收端必须允许忽略未知事件
- 每个事件必须绑定事件数据 Schema，不允许只定义事件名而不定义数据结构
- 事件订阅使用域级掩码（`eventMasks`），由 RPC `IDENTIFY / REIDENTIFY` 声明；每个事件在其 Domain 内分配唯一 `bitOffset`（0-255）；MVP 阶段设备可采用全量广播模式


## 3. events 条目结构

```yaml
events:
  - name: device.statusChanged
    id: 0x0101
    bitOffset: 0
    domain: device
    since: 1.0.0
    status: stable
    eventSchema: DeviceStatusChangedEvent
    severity: info
```

---

## 4. 字段定义

| 字段 | 必填 | 说明 |
|---|---:|---|
| `name` | 是 | event name，必须为 `domain.eventName` |
| `id` | 是 | uint16，Binary-RPC eventId，wire 上使用 |
| `bitOffset` | 是 | uint8，该 event 在所属 domain 的 `eventMasks` bitmask 中的 bit 位置，domain 内从 0 开始，domain 内唯一 |
| `domain` | 是 | 与 name 前缀一致 |
| `since` | 是 | 首次引入版本 |
| `status` | 是 | `draft / experimental / stable / deprecated / reserved` |
| `eventSchema` | 是 | 必须引用已注册 schema 名称 |
| `severity` | 否 | `info / warning / error / critical` |
| `trigger` | 否 | 触发来源，仅用于文档和测试 |
| `capabilities` | 否 | 关联能力，仅用于文档和 profile 约束 |

---

## 5. 约束

1. `eventId` 在所有 events 中必须唯一。
2. `bitOffset` 在同一 `domain` 内必须唯一，从 0 开始连续分配，stable 后不得复用。
3. `name` 在所有 events 中必须唯一。
4. stable eventId 不得复用；废弃只能标记 `deprecated`。
5. `eventSchema` 必须存在。
6. Event 必须通过 `PayloadType = RPC` 且 `rpcOp = EVENT` 承载。
7. STREAM 数据不得作为 Event 直接承载；Event 只能通知状态或结果。
8. `eventMasks` 中的 `bitOffset` 必须与 `bitOffset` 一致，由 `axtpc` 从 `events[].bitOffset` 自动派生。
9. v1 Core 不强制完整 event capability discovery；事件能力可在 v2 Capability Model 中描述。
10. eventId 必须按与 MethodId 相同的 domain 分段分配，event mask DomainId、eventId 高字节与同 domain methodId 高字节必须一致。
11. 事件 domain 必须来自已治理的 domain 词表；`output`、`room`、`signage` 事件分别描述输出边界变化、会议室/协作空间变化和数字标牌业务变化。

---

## 6. 生成规则

`axtpc` 必须从源 YAML 聚合出的 `events:` 生成：

```text
generated/protocol.md Events Reference
generated/schema event payload schema
generated/cpp event enum          // eventId 值
generated/cpp event bitmap enum   // bitOffset 值（按 domain 分组）
generated/ts event enum
generated/conformance event payload validation cases
```

`eventMasks` 中每个 domain 的 bitmask 由该 domain 下所有 events 的 `bitOffset` 自动派生：domain 内第 N bit 置 1 表示 `bitOffset=N` 的 event 已订阅。v1 MVP 设备可采用全量广播模式，忽略 `eventMasks`。
