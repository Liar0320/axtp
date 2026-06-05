# AXTP Business Requirements

`docs/business/` 用于存放 AXTP 工作中最上游、最原始的业务需求概要。

这里保存还没有被拆成协议交互流程或协议草案的需求输入。业务需求可以来自产品规划、客户场景、UI 草图、集成诉求、现场反馈，或仍需要产品语义解释的旧协议行为。

本目录不是协议合同。文档应尽量保留需求意图、业务背景、用户目标、约束和开放问题，让后续 `docs/flows/**` 与 `docs/protocol/**` 可以追溯到原始业务来源。

## 边界

| 路径 | 角色 | 能否作为实现合同 |
|---|---|---:|
| `docs/business/<requirement>.md` | 原始业务需求、背景、目标、约束、开放问题 | 否 |
| `docs/flows/<scenario>.md` | 从业务需求拆出的场景级协议交互方案 | 否 |
| `docs/protocol/<domain>/<domain.feature>.md` | domain.feature 协议草案和评审输入 | 否，除非已采纳并生成 |
| `registry/**/*.yaml`、`registry/domains/**/*.yaml` | 已采纳的机器可读协议事实 | 是 |
| `protocol/axtp.protocol.yaml`、`docs/generated/**` | 生成后的协议参考 | 是 |

## 工作流

```text
产品想法 / 客户诉求 / 现场反馈 / UI 草图 / 旧协议需求
  -> docs/business/<requirement>.md
  -> Stage 10 plan-protocol-flow
  -> docs/flows/<scenario>.md
  -> docs/protocol/<domain>/<domain.feature>.md
  -> registry/**/*.yaml + registry/domains/**/*.yaml
  -> protocol/axtp.protocol.yaml + docs/generated/**
```

如果一份需求已经描述了端到端交互，应使用 `docs/dev/skills/10-plan-protocol-flow/SKILL.md` 拆成 `docs/flows/<scenario>.md`。如果它已经明确指出某个缺失或需要修订的协议能力，应继续创建或修订 `docs/protocol/<domain>/<domain.feature>.md`。

## 建议模板

```markdown
# <业务需求名称>

## 背景

说明这个需求为什么存在、由谁提出、解决当前哪个产品或集成缺口。

## 用户目标

说明用户、操作员、设备、App 或集成方想完成什么。

## 范围

本需求包含什么。

## 非目标

本需求不解决什么。

## 场景

- 场景 1
- 场景 2

## 约束

- 产品、设备、固件、网络、兼容性、时延、安全、隐私或部署约束。

## 旧协议线索

- 关联旧协议文件、命令、日志、SDK 行为或历史文档。

## 开放问题

- [REVIEW-ASK] 需要产品、架构、固件、App、后台或旧协议行为确认的问题。

## 下一步

- 创建或更新 `docs/flows/<scenario>.md`
- 使用 `docs/dev/skills/10-plan-protocol-flow/SKILL.md` 梳理协议交互
- 创建或更新 `docs/protocol/<domain>/<domain.feature>.md`
```

## 命名

文件名优先使用简短的 kebab-case，并尽量来自需求或场景名称，例如：

- `audio-algorithm-level-control.md`
- `display-layout-control.md`
- `firmware-ota-policy.md`

当一份业务需求会拆到多个协议领域时，保留原始 business 文档不拆散，在“下一步”里链接到多个 flow 或 protocol 文档。
