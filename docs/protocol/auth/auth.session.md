# AXTP auth.session 协议草案

版本：v0.1

归属域：`auth`

Capability ID：`auth.session`

适用范围：认证会话、登录状态和会话生命周期。

---

## 协议审核标记（人工复核）

| 标记 | 条目 | 审核结论 | 后续动作 |
|---|---|---|---|
| `[REVIEW-DRAFT]` | `auth.session` capability | 本文是按 08 taxonomy 创建的单 feature 治理草案。 | 人工确认业务语义、schema 和 legacyRefs 后进入 `registry/domains/auth/domain.yaml`。 |
| `[REVIEW-ASK]` | legacy 映射 | legacy 映射需从 `docs/protocol/legacy-classification/` 中按 `target_capability` 筛选后人工确认。 | 落 registry 前补充确定的旧协议命令、字段路径和覆盖状态。 |

---

## 1. 文档定位

`auth.session` 定义：认证会话、登录状态和会话生命周期。

本文只描述 `auth.session` 这一项 capability。稳定事实必须写入 `registry/domains/auth/domain.yaml` 或相关 registry YAML，再由 Generator 生成 `protocol/axtp.protocol.yaml` 与 `docs/generated/*`。

---

## 2. 域边界

负责：

- `auth.session` 的能力发现、配置、状态、动作或事件。
- 与 `auth.session` 直接相关的 method/event/schema 草案。
- 已确认 legacy 协议到 `auth.session` 的语义归类。

不负责：

- 不承载其他 capability feature 的业务语义；跨域关系通过 schema 字段、引用或数据面 stream/file 表达。
- method/event 数值 ID 分配；数值以 registry/generated 为准。
- 未确认旧协议 payload 的稳定映射。

---

## 3. 候选 Methods / Events

| 类型 | 名称 | 说明 |
|---|---|---|
| method | `auth.getSessionCapabilities` | 查询 `auth.session` 能力范围。 |
| method | `auth.getSessionConfig` | 查询 `auth.session` 配置。 |
| method | `auth.setSessionConfig` | 设置 `auth.session` 配置。 |
| method | `auth.resetSessionConfig` | 恢复 `auth.session` 默认配置。 |
| event | `auth.sessionConfigChanged` | `auth.session` 配置变化。 |

候选名称用于评审和 registry 草案输入。采纳时必须按 08 的配置型、状态型、动作型、流型或导出型模板复核。

---

## 4. Legacy 待映射

| 来源 | 旧协议条目 | 候选映射 | 状态 |
|---|---|---|---|
| AXDP / Rooms / VM33 / Signage | 待从 `docs/protocol/legacy-classification/` 筛选 | `auth.session` | `[REVIEW-ASK]` |

---

## 5. Registry 草案输入

```yaml
capabilities:
  - id: auth.session
    name: auth.session capability
    status: draft
    methods:
      - auth.getSessionCapabilities
      - auth.getSessionConfig
      - auth.setSessionConfig
      - auth.resetSessionConfig
    events:
      - auth.sessionConfigChanged
```

---

## 6. 后续确认

1. 确认 `auth.session` 的 MVP 范围和可选能力。
2. 确认 method/event 是否复用已有 registry 条目或新增 draft 条目。
3. 确认 schema 字段、错误码、权限和状态枚举。
4. 确认 legacyRefs 覆盖范围后再写入 YAML。
