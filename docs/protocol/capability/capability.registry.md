# AXTP capability.registry 协议草案

版本：v0.1

归属域：`capability`

Capability ID：`capability.registry`

适用范围：能力注册表查询、能力协商和 supported methods/events。

---

## 协议审核标记（人工复核）

| 标记 | 条目 | 审核结论 | 后续动作 |
|---|---|---|---|
| `[REVIEW-DRAFT]` | `capability.registry` capability | 本文是按 08 taxonomy 创建的单 feature 治理草案。 | 人工确认业务语义、schema 和 legacyRefs 后进入 `registry/domains/capability/domain.yaml`。 |
| `[REVIEW-ASK]` | legacy 映射 | legacy 映射需从 `docs/protocol/legacy-classification/` 中按 `target_capability` 筛选后人工确认。 | 落 registry 前补充确定的旧协议命令、字段路径和覆盖状态。 |

---

## 1. 文档定位

`capability.registry` 定义：能力注册表查询、能力协商和 supported methods/events。

本文只描述 `capability.registry` 这一项 capability。稳定事实必须写入 `registry/domains/capability/domain.yaml` 或相关 registry YAML，再由 Generator 生成 `protocol/axtp.protocol.yaml` 与 `docs/generated/*`。

---

## 2. 域边界

负责：

- `capability.registry` 的能力发现、配置、状态、动作或事件。
- 与 `capability.registry` 直接相关的 method/event/schema 草案。
- 已确认 legacy 协议到 `capability.registry` 的语义归类。

不负责：

- 业务 capability 内容由各 domain feature 定义；本 feature 只负责发现和协商。
- method/event 数值 ID 分配；数值以 registry/generated 为准。
- 未确认旧协议 payload 的稳定映射。

---

## 3. 候选 Methods / Events

| 类型 | 名称 | 说明 |
|---|---|---|
| method | `capability.getRegistryCapabilities` | 查询 `capability.registry` 能力范围。 |
| method | `capability.getRegistryConfig` | 查询 `capability.registry` 配置。 |
| method | `capability.setRegistryConfig` | 设置 `capability.registry` 配置。 |
| method | `capability.resetRegistryConfig` | 恢复 `capability.registry` 默认配置。 |
| event | `capability.registryConfigChanged` | `capability.registry` 配置变化。 |

候选名称用于评审和 registry 草案输入。采纳时必须按 08 的配置型、状态型、动作型、流型或导出型模板复核。

---

## 4. Legacy 待映射

| 来源 | 旧协议条目 | 候选映射 | 状态 |
|---|---|---|---|
| AXDP / Rooms / VM33 / Signage | 待从 `docs/protocol/legacy-classification/` 筛选 | `capability.registry` | `[REVIEW-ASK]` |

---

## 5. Registry 草案输入

```yaml
capabilities:
  - id: capability.registry
    name: capability.registry capability
    status: draft
    methods:
      - capability.getRegistryCapabilities
      - capability.getRegistryConfig
      - capability.setRegistryConfig
      - capability.resetRegistryConfig
    events:
      - capability.registryConfigChanged
```

---

## 6. 后续确认

1. 确认 `capability.registry` 的 MVP 范围和可选能力。
2. 确认 method/event 是否复用已有 registry 条目或新增 draft 条目。
3. 确认 schema 字段、错误码、权限和状态枚举。
4. 确认 legacyRefs 覆盖范围后再写入 YAML。
