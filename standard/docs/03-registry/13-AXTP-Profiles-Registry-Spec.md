# 13《AXTP Profiles Registry Spec》

> Status: AXTP v1 Protocol Definition Meta Spec
> Spec Version: 1.0.0-rc1
> Scope: `profiles:` entries, MVP profile composition, transport/frame constraints

版本：v1.0.0-rc1
状态：Protocol Definition 元规范
适用范围：`protocol/axtp.protocol.yaml` 中 `profiles:` 条目的字段、约束和生成规则

---

## 1. 文档定位

本文档只定义 implementation profile 的元模型，不手写完整 MVP 清单。具体 profile 内容必须写入 `protocol/axtp.protocol.yaml` 的 `profiles:`。

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
      - AXTP-HID-64
    frameProfile: COMPACT_FRAME
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
| `frameProfile` | 是 | 必须与 transportProfiles 的固定映射一致 |
| `notes` | 否 | 实现说明 |

---

## 4. 约束

1. `profiles[].name` 必须唯一。
2. Profile 不得要求未定义 method/event/type/error。
3. Profile 的 `frameProfile` 必须与每个 `transportProfiles[].frameProfile` 一致。
4. AXTP v1 不允许在同一 session 内切换 Frame Profile。
5. HID/BLE/UART Compact profile 不得要求 WebSocket Text / HTTP JSON 生产 STREAM。
6. Profile 的具体内容进入 `protocol.yaml`；新增 Profile 不应修改 08-13 元规范。

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

v1 Protocol Definition 可以包含以下 profile，但具体必选内容由 `protocol.yaml` 定义：

```text
AXTP-MVP
AXTP-MVP-HID
AXTP-MVP-BLE
AXTP-WS-BINARY
AXTP-TCP-BINARY
```

这些 profile 必须遵守 01-07 Core Freeze 文档中定义的 Transport Profile 到 Frame Profile 固定映射。
