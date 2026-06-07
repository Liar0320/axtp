# AXTP 文档中心

`docs/` 是 AXTP 协议治理的活跃文档区，包含业务输入、流程设计、协议草案、架构说明、生成参考、legacy 迁移、conformance 用例和发版管理。

不要把业务输入、流程文档、协议草案或 legacy 迁移材料直接当实现合同。当前实现事实来自 `registry/**/*.yaml`、`registry/domains/**/*.yaml`、`protocol/axtp.protocol.yaml` 和 `docs/generated/**`。

## 阅读路径

| 目标 | 推荐阅读顺序 |
|---|---|
| 先看懂 AXTP | `specs/README.md` -> `specs/1-core/01-Overview.md` |
| 查看当前实现合同 | `generated/protocol.md` 或 `generated/protocol.json` |
| 快速接入 runtime | `guides/quickstart.md` -> `generated/protocol.md` -> `conformance/README.md` |
| 从产品需求开始 | `business/README.md` -> `business/<requirement>.md` |
| 设计端到端交互 | `business/README.md` -> `dev/skills/10-plan-protocol-flow/SKILL.md` -> `flows/README.md` |
| 起草或评审协议 | `protocol/README.md` -> `protocol/<domain>/<domain.feature>.md` -> `dev/skills/**` |
| 运行生成器和维护流程 | `guides/how-to-use.md` -> `dev/skills/README.md` -> `../generators/README.md` |
| 查看跨语言架构边界 | `architecture/README.md` |
| 追踪 legacy 迁移 | `legacy-migration/README.md` |
| 验收 runtime 行为 | `conformance/README.md` |
| 准备发版 | `release/README.md` |

## 文档分区

| 分区 | 路径 | 读者 | 用途 | 手写 |
|---|---|---|---|---:|
| 正式规范 | `docs/specs/` | 协议维护者、runtime/tool 作者 | wire format、session、registry、codec、tooling、versioning 规则 | 是 |
| 业务需求 | `docs/business/` | 产品、架构、研发、测试 | PRD、用户目标、约束、开放问题 | 是 |
| 交互流程 | `docs/flows/` | 产品、架构、App、固件、后端、测试 | 场景级时序图、协议覆盖和缺口 | 是 |
| 协议草案 | `docs/protocol/` | 协议维护者和评审者 | registry 采纳前的 RFC、草案和评审记录 | 是 |
| 架构说明 | `docs/architecture/` | 架构、协议维护者、runtime 作者 | 跨语言协议边界和设计原则 | 是 |
| 生成参考 | `docs/generated/` | 研发、测试、SDK/tool 作者 | 当前 generated 协议参考 | 否 |
| 接入指南 | `docs/guides/` | 维护者和接入者 | 仓库使用、quickstart、conformance、workflow 示例 | 是 |
| Dev 文档 | `docs/dev/` | 协议维护者和自动化 agent | 协议生命周期 skills、Generator 和维护流程 | 是 |
| Legacy 迁移 | `docs/legacy-migration/` | 协议维护者、legacy adapter 作者 | 证据、分类、迁移计划、generated 候选 | 部分 |
| Conformance | `docs/conformance/` | runtime/tool 作者和测试 | 跨 runtime 行为用例、profiles、fixtures、schemas | 是 |
| Release | `docs/release/` | 维护者和发布自动化 | changelog、版本治理、release checklist、runtime 对齐 | 是 |

## 权威边界

```text
docs/business/**                         原始业务输入，不是协议合同
docs/flows/**                            场景级交互方案，不是协议合同
docs/protocol/**                         RFC / 草案 / 评审输入
docs/specs/**                            人工维护的正式规则
registry/**/*.yaml + registry/domains/** 手写机器事实源
protocol/axtp.protocol.yaml              Generated Protocol IR
docs/generated/**                        Generated 人读/机读参考
docs/conformance/**                      Runtime 行为验收输入
```

如果 specs 表格与 YAML 或 generated 输出冲突，应修正事实源或规范规则后重新生成，不要维护第二套活跃事实。
