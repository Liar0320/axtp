# 13《AXTP Profiles Registry Spec》

> Status: AXTP v1 Protocol Definition Meta Spec
> Spec Version: 1.0.0-rc1
> Scope: `profiles:` entries, MVP profile composition, transport/frame constraints

版本：v1.0.0-rc1
状态：Protocol Definition 元规范
适用范围：`registry/capability/` 与 `registry/domains/<domain>/domain.yaml` 中 profile 源条目的字段、约束和生成规则

---

## 1. 文档定位

本文档只定义 implementation profile 的元模型，不手写完整 MVP 清单。具体 profile 内容必须写入 `registry/capability/` 或 `registry/domains/<domain>/domain.yaml`；`protocol/axtp.protocol.yaml` 中的 `profiles:` 由 Generator 聚合生成。

新增业务 profile 默认写入 `registry/domains/<domain>/domain.yaml`。只有 Core/MVP profile 或已采纳的共享 profile 才写入核心 registry；晋升时必须迁移并删除 domain 中的原 profile，不得两边重复定义。

---

## 2. profiles 条目结构

```yaml
profiles:
  - name: AXTP-MVP-HID
    since: 1.0.0
    status: stable
    requiredMethods:
      - capability.supportedMethods
      - device.getInfo
    requiredEvents: []
    requiredTypes:
      - DeviceInfo
    requiredErrors:
      - SUCCESS
      - RPC_METHOD_NOT_FOUND
    transportProfiles:
      - AXTP-USB-HID
    frameProfile: STANDARD_FRAME
```

---

## 3. 字段定义

| 字段 | 必填 | 说明 |
|---|---:|---|
| `name` | 是 | Profile 名称 |
| `since` | 是 | 首次引入版本 |
| `status` | 是 | `draft / stable / deprecated` |
| `requiredMethods` | 是 | 必须引用 `methods[].name` |
| `requiredEvents` | 是 | 必须引用 `events[].name`，可为空 |
| `requiredTypes` | 否 | 必须引用 `types` |
| `requiredErrors` | 是 | 必须引用 `errors[].name` |
| `transportProfiles` | 是 | 必须引用 `transports[].name` |
| `frameProfile` | 条件必填 | 单一 Frame Profile 的 profile 必填，必须与 transportProfiles 的固定映射一致 |
| `frameProfiles` | 条件必填 | 聚合 profile 可使用，列出允许的 Frame Profile 集合 |
| `notes` | 否 | 实现说明 |

---

## 4. 约束

1. `profiles[].name` 必须唯一。
2. Profile 不得要求未定义 method/event/type/error。
3. Profile 使用 `frameProfile` 时，必须与每个 `transportProfiles[].frameProfile` 一致。
4. Profile 使用 `frameProfiles` 时，必须覆盖每个 `transportProfiles[].frameProfile`，且不得引入未被 transportProfiles 使用的 Frame Profile。
5. AXTP v1 不允许在同一 session 内切换 Frame Profile。
6. 当前 v1 Core profile 不得引用 `COMPACT_FRAME` 或 `AXTP-HID-64`；低带宽降级 profile 必须进入 17《AXTP Low-Bandwidth Degradation》。
7. WebSocket Unframed JSON profile 不得要求 STREAM 或 CONTROL。
8. Profile 的具体内容进入 `registry/` 或 `registry/domains/` YAML；新增 Profile 不应修改 08-13 元规范。

---

## 5. 生成规则

`axtpc` 必须从 `profiles:` 生成：

```text
generated/protocol.md Profiles Reference
generated/bitmap per-profile method bitmap
generated/conformance profile coverage tests
generated/cpp profile descriptors
generated/ts profile descriptors
```

---

## 6. v1 推荐 Profile

v1 Protocol Definition 可以包含以下 profile，但具体必选内容由源 YAML 定义：

```text
AXTP-MVP
AXTP-MVP-HID
AXTP-HID-MEDIA
AXTP-WS-JSON
AXTP-WS-CLOUD-REVERSE
```

这些 profile 必须遵守 01-07 Core Freeze 文档中定义的 Transport Profile 到 Frame Profile 固定映射。
