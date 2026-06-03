# Protocol Draft Template

Use this structure when creating `docs/protocol/<domain>/<domain.feature>.md`. Replace bracketed placeholders and delete irrelevant rows, but keep the major sections.

```markdown
# AXTP <domain.feature> 协议草案

## 协议审核标记

| 标记 | 对象 | 结论 | 后续动作 |
|---|---|---|---|
| [REVIEW-DRAFT] | <domain.feature> capability | 本文是根据业务需求创建的协议草案，不是最终事实源。 | 产品/架构/研发确认后进入采纳 workflow。 |
| [REVIEW-ASK] | legacy 映射 | 旧协议命令、字段或状态码仍需确认。 | 采纳前补齐 legacyRefs 或明确 adapter-only。 |

## 文档定位

本文是 `docs/protocol` 评审输入，不是最终协议事实源。采纳后，稳定事实必须反向确认到 `docs/specs/08-13`，再写入 `registry/` 或 `registry/domains/<domain>/domain.yaml`，并由 Generator 生成 `protocol/axtp.protocol.yaml` 和 `docs/generated/*`。

## 业务需求

| 项 | 内容 |
|---|---|
| 需求来源 | <user/product/architecture input> |
| 目标用户 | <operator/app/device/cloud/etc> |
| 目标行为 | <plain-language behavior> |
| 当前实现程度 | <Not drafted / Drafted only / Partially adopted / Adopted> |

## Domain 边界

| 项 | 决策 |
|---|---|
| Domain | `<domain>` |
| Feature | `<domain.feature>` |
| Capability | `<domain.feature>` |
| 不属于本文 | <non-goals and adjacent features> |

## 协议决策

| 决策点 | 结论 | 理由 |
|---|---|---|
| 新增/修改/复用 | <Create / Modify / Reuse> | <why> |
| 控制面 | RPC method/event | 业务控制不进入 Frame Header。 |
| 数据面 | <None / STREAM created by RPC> | 连续数据才走 STREAM。 |
| WebSocket | RPC-only | WebSocket Unframed JSON 不承载 STREAM。 |

## 候选 Capability

| Capability | 状态 | 说明 |
|---|---|---|
| `<domain.feature>` | draft | <description> |

## 候选 Methods

| Method | Params Schema | Result Schema | 说明 | Review |
|---|---|---|---|---|
| `<domain>.<action>` | `<ActionParams>` | `<ActionResult>` | <description> | [REVIEW-DRAFT] |

## 候选 Events

| Event | Schema | 触发时机 | Review |
|---|---|---|---|
| `<domain>.<stateChanged>` | `<StateChangedEvent>` | <trigger> | [REVIEW-DRAFT] |

## 候选 Schemas

### `<SchemaName>`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `<field>` | `<type>` | yes | <description> | [REVIEW-DRAFT] |

## 候选 Errors

| Error | 类别 | 说明 | Review |
|---|---|---|---|
| `<DOMAIN_FEATURE_ERROR>` | business | <description> | [REVIEW-DRAFT] |

## Legacy 待映射

| 来源 | 候选映射 | 状态 | 说明 |
|---|---|---|---|
| <AXDP / Rooms / VM33 / Signage / other> | `<domain.feature>` | [REVIEW-ASK] | <unknowns> |

## Registry 草案输入

采纳本文后，domain YAML 至少应包含：

```yaml
capabilities:
  - name: <domain.feature>
    status: draft

methods:
  - name: <domain>.<action>
    id: TBD after adoption
    bitOffset: TBD after adoption
    requestSchema: <ActionParams>
    responseSchema: <ActionResult>
    capabilities:
      - <domain.feature>
```

## 采纳检查清单

- [ ] 08 已确认 domain.feature 粒度和 method/event 命名。
- [ ] 09 已确认 Domain/ID 规划和生成链路。
- [ ] 10 已确认 methodId、bitOffset、request/response schema。
- [ ] 11 已确认 eventId、eventMasks bitOffset、event schema。
- [ ] 12 已确认 errorCode 范围和错误归属。
- [ ] 13 已确认 schema fieldId、capabilityId、supportedMethods。
- [ ] YAML 写入后 Generator 能完整生成 `protocol/axtp.protocol.yaml` 和 `docs/generated/*`。

## 待确认问题

1. <question>
```
