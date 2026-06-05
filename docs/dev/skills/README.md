# AXTP Skills 索引

AXTP 协议相关 skill 目录使用阶段编号，方便人工按生命周期顺序浏览；每个
`SKILL.md` 里的 `name` 保持稳定的语义化名称，方便模型按用户意图触发。
后续如果要插入新的流程阶段，优先新增带编号的目录，不要随意改已有 skill 的
`name`。

## 生命周期 Skill

| 阶段 | 目录 | Skill 名称 | 什么时候用 | 默认写入范围 | 下一步 |
|---|---|---|---|---|---|
| 00 | [00-axtp-protocol-workflow](00-axtp-protocol-workflow/SKILL.md) | `axtp-protocol-workflow` | 需求还无法判断生命周期阶段 | 只做路由判断 | 10/20/30/40/50 之一，或 runtime 实现 |
| 10 | [10-plan-protocol-flow](10-plan-protocol-flow/SKILL.md) | `plan-protocol-flow` | 业务场景、用户 story、UI 原型或端到端交互需要映射协议流程 | `docs/flows/**` | 缺少草案走 20；已采纳协议需变更走 40 |
| 20 | [20-draft-business-protocol](20-draft-business-protocol/SKILL.md) | `draft-business-protocol` | 粗略需求、旧协议线索或流程缺口需要形成可评审协议草案 | `docs/protocol/**` | 人工评审后走 30 |
| 30 | [30-adopt-protocol-draft](30-adopt-protocol-draft/SKILL.md) | `adopt-protocol-draft` | 已评审草案需要采纳为正式协议事实 | adopted proposal、必要 specs、`registry/**`、`registry/domains/**` | 50 |
| 40 | [40-amend-adopted-protocol](40-amend-adopted-protocol/SKILL.md) | `amend-adopted-protocol` | 已采纳或已生成协议需要语义修正、删除、废弃、重命名、收窄或扩展 | adopted proposal、必要 specs/YAML、经 Generator 刷新的生成产物 | 50 |
| 50 | [50-generate-axtp-protocol](50-generate-axtp-protocol/SKILL.md) | `generate-axtp-protocol` | 已采纳 YAML 事实源需要刷新或验证生成产物 | generated artifacts；除非校验暴露源文件问题 | runtime/SDK/tool 实现或评审 |

## 编号规则

- `00` 固定作为总控路由，用于阶段不明确的请求。
- `10-50` 是当前协议生命周期的主要阶段。
- 预留空档给后续拆分，例如 `15-*` 可用于 legacy 迁移规划，`25-*` 可用于草案评审，`35-*` 可用于采纳校验，`60-*` 可用于 runtime binding。
- 除非刻意改变触发契约，否则不要给 `SKILL.md` 的 `name:` 增加数字前缀。

## 语言规则

- 父目录索引面向仓库维护者，默认使用中文。
- `SKILL.md` 可以使用中文正文，但 frontmatter 的 `name` 应保持短小、英文、kebab-case。
- `description` 建议保留英文或中英混合：它是触发判断的核心元数据，需要覆盖常见英文技术词、目录名和用户可能输入的中文业务语义。
