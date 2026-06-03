# AXTP log.export 协议草案

版本：v0.1

归属域：`log`

Capability ID：`log.export`

适用范围：日志导出任务、导出状态、导出进度和导出结果文件引用。

---

## 协议审核标记（人工复核）

| 标记 | 条目 | 审核结论 | 后续动作 |
|---|---|---|---|
| `[REVIEW-OK]` | `log.export` capability | 本文是按 08 taxonomy 创建的单 feature 治理草案。 | 人工确认业务语义、schema 和 legacyRefs 后进入 `registry/domains/log/domain.yaml`。 |
| `[REVIEW-ASK]` | legacy 映射 | legacy 映射需从 `docs/protocol/legacy-classification/` 中按 `target_capability` 筛选后人工确认。 | 落 registry 前补充确定的旧协议命令、字段路径和覆盖状态。 |

---

## 1. 文档定位

`log.export` 定义：日志导出任务、导出状态、导出进度和导出结果文件引用。

本文只描述 `log.export` 这一项 capability。稳定事实必须写入 `registry/domains/log/domain.yaml` 或相关 registry YAML，再由 Generator 生成 `protocol/axtp.protocol.yaml` 与 `docs/generated/*`。

---

## 2. 域边界

负责：

- `log.export` 的能力发现、配置、状态、动作或事件。
- 与 `log.export` 直接相关的 method/event/schema 草案。
- 已确认 legacy 协议到 `log.export` 的语义归类。

不负责：

- 不承载其他 capability feature 的业务语义；跨域关系通过 schema 字段、引用或数据面 stream/file 表达。
- method/event 数值 ID 分配；数值以 registry/generated 为准。
- 未确认旧协议 payload 的稳定映射。

---

## 3. 候选 Methods / Events

| 类型 | 名称 | 说明 |
|---|---|---|
| method | `log.createExport` | 创建日志导出任务。 |
| method | `log.getExportState` | 查询日志导出状态。 |
| method | `log.cancelExport` | 取消日志导出任务。 |
| event | `log.exportStateChanged` | 日志导出状态变化。 |
| event | `log.exportProgressReported` | 日志导出进度上报。 |

候选名称用于评审和 registry 草案输入。采纳时必须按 08 的配置型、状态型、动作型、流型或导出型模板复核。

---

## 4. Legacy 待映射

| 来源 | 旧协议条目 | 候选映射 | 状态 |
|---|---|---|---|
| AXDP / Rooms / VM33 / Signage | 待从 `docs/protocol/legacy-classification/` 筛选 | `log.export` | `[REVIEW-ASK]` |

---

## 5. Registry 草案输入

```yaml
capabilities:
  - id: log.export
    name: log.export capability
    status: draft
    methods:
      - log.createExport
      - log.getExportState
      - log.cancelExport
    events:
      - log.exportStateChanged
      - log.exportProgressReported
```

---

## 6. 后续确认

1. 确认 `log.export` 的 MVP 范围和可选能力。
2. 确认 method/event 是否复用已有 registry 条目或新增 draft 条目。
3. 确认 schema 字段、错误码、权限和状态枚举。
4. 确认 legacyRefs 覆盖范围后再写入 YAML。
