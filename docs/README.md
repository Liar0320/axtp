# AXTP Docs

`docs/` 里既有正式规范，也有草案、生成物、工程说明和历史材料。读文档时先判断它属于哪一类；不要把草案或归档材料当成当前实现合同。

## 读者路径

| 目标 | 阅读顺序 |
|---|---|
| 先看懂 AXTP 是什么 | `specs/00-AXTP-Overview.md` -> `specs/README.md` |
| 查当前实现合同 | `generated/protocol.md` 或 `generated/protocol.json` |
| 从业务场景梳理协议交互 | `flows/README.md` -> 对应 `flows/<scenario>.md` -> `protocol/README.md` |
| 新增业务协议 | `protocol/README.md` -> `protocol/<domain>/<domain.feature>.md` -> 对应 `dev/skills/**` |
| 使用工具、SDK、runtime | `guides/how-to-use.md` -> `dev/AXTP_*` -> `../runtimes/cpp-core/ARCHITECTURE.md` |
| 追溯旧协议迁移 | `legacy-protocols/`、`migration/`、`legacy-classification/` |

## 文档分区

| 分组 | 路径 | 谁读 | 什么时候读 | 手写 |
|---|---|---|---|---:|
| Active specs | `docs/specs/` | 架构、协议维护者、runtime/SDK 研发 | 理解正式规则、wire format、命名治理、Generator 合同 | 是 |
| Flow plans | `docs/flows/` | 产品、架构、App/固件/后台、测试 | 从业务 story、UI 原型或端到端交互梳理协议步骤和缺口 | 是 |
| Draft intake | `docs/protocol/` | 产品、架构、协议维护者、业务研发、测试 | 新业务起草、评审和采纳前确认 | 是 |
| Generated reference | `docs/generated/` | 研发、测试、工具、SDK | 实现和验收当前协议 | 否 |
| Guides | `docs/guides/` | 所有人 | 查命令、跑 Generator、用 CLI/SDK/runtime、看完整例子 | 是 |
| Dev docs | `docs/dev/` | runtime/SDK/tool 研发、Codex/Claude 等自动化代理 | 工程设计、代码规范、协议 workflow skill | 是 |
| Demo docs | `docs/demo/` | 研发、测试、评审 | 仍有阅读价值的 active 示例场景和端到端验证思路 | 是 |
| Migration workspace | `docs/migration/` | 协议维护者、legacy 适配研发 | 旧协议迁移工作区；不是最终事实源 | 部分 |
| Legacy classification | `docs/legacy-classification/` | 协议维护者、legacy 适配研发 | 旧协议材料到候选 AXTP domain.feature 的分类 intake | 由脚本刷新 |
| Legacy evidence | `docs/legacy-protocols/` | 协议维护者、legacy 适配研发 | AXDP、VM33、Rooms、NearHub 等原始输入资料 | 是 |
| Archive | `docs/archive/` | 架构、维护者 | 追溯旧草稿、历史 demo、source 迁移材料和未来草案 | 否，除非归档新材料 |

## 权威边界

```text
docs/protocol/**                         草案与评审输入
registry/**/*.yaml + registry/domains/** 手写机器事实源
protocol/axtp.protocol.yaml              Generator 输出的 Protocol IR
docs/generated/**                        Generator 输出的人读/机器读参考
```

当前正式 specs 编号为 `00-19`。`08` 是 domain-feature 命名治理入口；`09-14` 是 registry、schema/capability、profile/MVP 治理入口。实现事实以 YAML 和 generated 产物为准；如果 specs 表格与 YAML/generated 冲突，应回修 specs，不维护第二套 active 事实源。
