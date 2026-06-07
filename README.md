# AXTP

```text
     _    __  __  _______  ___
    / \   \ \/ /  |_   _| | __ \
   / _ \   >  <     | |   |  __/
  /_/ \_\ /_/\_\    |_|   |_|

  Auditoryworks Transport Protocol
  控制面。数据面。单一事实源。
```

AXTP（Auditoryworks Transport Protocol）是一套轻量、传输无关的设备通信协议标准，用于统一设备控制、能力发现、RPC、事件、流式数据以及低带宽链路适配。它面向 WebSocket、TCP、HID、BLE、UART 和 mock transport 等多种传输方式，并服务于多语言 runtime 生态。

本仓库是 AXTP 的 **核心规范仓库**：负责协议规范、registry 事实源、Generator、generated 参考文档、conformance 输入、发布治理以及 legacy 迁移材料。各语言 runtime 维护在独立仓库中，并把本仓库作为协议输入。

## 一览

| 项目 | 内容 |
|---|---|
| 协议 | AXTP，Auditoryworks Transport Protocol |
| 当前 Spec 辅助命令 | `scripts/print-spec-version.sh` |
| 事实源 | `registry/**/*.yaml` 和 `registry/domains/**/*.yaml` |
| 生成的协议 IR | `protocol/axtp.protocol.yaml` |
| 生成的参考文档 | `docs/generated/*` |
| Conformance 输入 | `docs/conformance/**` |
| 发布模型 | Git tag，格式为 `spec/vMAJOR.MINOR.PATCH` |
| Runtime 模型 | 外部多语言 runtime 仓库 |

## 为什么是 AXTP？

| 能力 | 对生态的价值 |
|---|---|
| 单一事实源 | Registry YAML 驱动 generated 协议参考、机器可读 IR、测试向量、runtime 元数据和 release artifact。 |
| 控制面 / 数据面分离 | CONTROL 和 RPC 管控制面，STREAM 管连续数据。固件、媒体、文件、日志、诊断等业务先通过 RPC 绑定语义，再通过 STREAM 传输字节。 |
| Registry-first 路由 | domain、method、event、error、schema、capability、profile 都被规整为稳定 registry 事实，runtime 可以构建直接派发表，而不是把协议判断写进 transport 代码。 |
| `requestId` 并发安全 | RPC 响应通过 `requestId` 关联请求，不依赖到达顺序，慢调用、重试和乱序响应不会污染会话状态。 |
| 跨 runtime 一致性 | `docs/conformance/**` 为 C、C++、TypeScript、Flutter、Python 和 mock 实现提供同一套行为合同。 |
| Legacy 迁移路径 | `docs/legacy-migration/**` 保存旧协议证据、分类、迁移计划和生成候选，只有经过评审采纳后才会进入 active spec contract。 |

## 多语言生态

| 仓库 | 角色 | 主要目标 | 消费内容 |
|---|---|---|---|
| [axtp](https://github.com/Mostorm-Labs/axtp) | Core spec | 协议事实、规范、Generator、conformance | 拥有协议事实源 |
| [axtp-c-runtime](https://github.com/Mostorm-Labs/axtp-c-runtime) | C runtime | IoT、MCU、低资源设备 | Spec tag、conformance cases |
| [axtp-cpp-runtime](https://github.com/Mostorm-Labs/axtp-cpp-runtime) | C++ runtime | Android、Linux 设备主控、native 控制服务 | generated protocol model、conformance cases |
| [axtp-ts-runtime](https://github.com/Mostorm-Labs/axtp-ts-runtime) | TypeScript runtime | Web、Node.js、后台服务 | generated protocol model、conformance cases |
| [axtp-flutter-runtime](https://github.com/Mostorm-Labs/axtp-flutter-runtime) | Flutter runtime | 跨端移动应用 | Spec tag、runtime metadata |
| [axtp-python-runtime](https://github.com/Mostorm-Labs/axtp-python-runtime) | Python runtime | AI、MCP、自动化、脚本集成 | Protocol IR、tool metadata |
| [axtp-mock-server](https://github.com/Mostorm-Labs/axtp-mock-server) | Mock server | 调试、验收、原型联调 | Protocol IR、conformance cases |

## 事实源模型

AXTP 通过分阶段工作流维护。草案和 legacy 证据是评审输入；registry YAML 和 generated 输出才是实现合同。

| 阶段 | 位置 | 作用 | 合同状态 |
|---|---|---|---|
| 业务输入 | `docs/business/` | 产品需求、PRD、原始场景、现场反馈 | 评审输入 |
| 交互流程 | `docs/flows/` | 场景时序图、业务到协议的交互流 | 评审输入 |
| RFC / 草案 | `docs/protocol/` | 采纳前的 domain-feature 协议提案 | 评审输入 |
| 正式规范 | `docs/specs/` | wire、session、registry、codec、tooling、versioning 的规范规则 | 人工维护规则 |
| 架构指导 | `docs/architecture/` | 如有跨语言架构说明，放在这里 | 人工维护指导 |
| Registry 事实 | `registry/`、`registry/domains/` | 机器可读的 method/event/schema/error/capability/profile 事实 | 实现合同 |
| 协议 IR | `protocol/axtp.protocol.yaml` | 聚合后的 generated 协议模型 | 生成合同 |
| Generated 文档 | `docs/generated/` | 人读和机器读的 generated 协议参考 | 生成合同 |
| Conformance | `docs/conformance/` | 跨 runtime 行为用例、fixtures、profiles、schemas | Runtime 校验输入 |
| Legacy 迁移 | `docs/legacy-migration/` | legacy 证据、分类、计划、generated 候选 | 迁移输入 |

不要手写 generated 产物。生成结果不符合预期时，应回到草案、正式规范、registry YAML 或 Generator 逻辑修正，然后重新生成。

## 仓库地图

| 路径 | 内容 |
|---|---|
| `KICKOFF.md` | 面向研发启动会的 Why / What / How 说明与推进框架。 |
| `ROADMAP.md` | 产品与技术迭代路线图。 |
| `docs/specs/` | AXTP 正式规范，按 core、registry、codec、tooling 分组。 |
| `docs/business/` | 业务需求和场景源材料。 |
| `docs/flows/` | 时序图和交互流。 |
| `docs/protocol/` | 采纳前的 RFC 和草案。 |
| `docs/guides/` | 外部接入指南和实用说明。 |
| `docs/dev/` | 协议维护者流程、Generator 指南、domain 采纳 skills。 |
| `docs/release/` | changelog、版本治理、release artifact、runtime 对齐规则。 |
| `docs/conformance/` | Runtime 仓库消费的 conformance cases 和 fixtures。 |
| `docs/legacy-migration/` | legacy 证据、分类、迁移计划、generated 迁移输出。 |
| `registry/` | core、capability、schema、error、profile 和已采纳业务域事实。 |
| `protocol/axtp.protocol.yaml` | 生成的聚合协议 IR。 |
| `generators/` | 主协议 Generator 实现和测试。 |
| `tooling/` | legacy 工具、migration 工具、MCP 元数据、测试向量、Wireshark 资产。 |
| `scripts/` | 校验、版本和 release artifact 脚本。 |

## 标准协议 SOP

| 步骤 | 动作 | 输出 |
|---:|---|---|
| 1 | 在 `docs/business/` 捕获需求。 | 人读业务来源。 |
| 2 | 当行为跨多条消息或多个角色时，在 `docs/flows/` 描述交互。 | 场景级协议流。 |
| 3 | 在 `docs/protocol/<domain>/<domain.feature>.md` 编写或更新 RFC。 | 可评审协议草案。 |
| 4 | 评审命名、schema、method、event、error、capability、profile 和兼容性。 | 已接受协议决策。 |
| 5 | 将已接受事实采纳到 `registry/` 或 `registry/domains/`。 | 机器可读事实源。 |
| 6 | 运行 Generator 和校验脚本。 | `protocol/axtp.protocol.yaml`、`docs/generated/*`、snapshots、test vectors。 |
| 7 | 当行为变化时更新 conformance 或 release 输入。 | Runtime 可验证协议合同。 |
| 8 | Runtime 仓库消费 spec tag、明确 commit 或 generated artifact。 | 可复现的语言 runtime 实现。 |

协议变更不应从 runtime 代码开始。Runtime 仓库是 spec 消费方，不是独立协议事实源。

## 快速开始

安装 Generator 依赖：

```bash
pnpm --dir generators install
```

构建并校验 source model：

```bash
pnpm --dir generators build
pnpm --dir generators validate:sources
```

重新生成协议输出：

```bash
pnpm --dir generators generate
pnpm --dir generators validate:protocol
```

运行 Generator 测试和 conformance 校验：

```bash
pnpm --dir generators test
scripts/validate-conformance.sh
```

构建本地 spec artifact：

```bash
scripts/build-spec-artifact.sh "$(scripts/print-spec-version.sh)"
```

## 导航

| 需求 | 阅读入口 |
|---|---|
| 第一次理解仓库 | [docs/README.md](docs/README.md) |
| 阅读正式规范 | [docs/specs/README.md](docs/specs/README.md) |
| 理解核心协议 | [docs/specs/1-core/01-Overview.md](docs/specs/1-core/01-Overview.md) |
| 研发最短接入 | [docs/guides/quickstart.md](docs/guides/quickstart.md) |
| 实用使用指南 | [docs/guides/how-to-use.md](docs/guides/how-to-use.md) |
| generated 协议参考 | [docs/generated/protocol.md](docs/generated/protocol.md) |
| 协议 RFC 工作流 | [docs/protocol/README.md](docs/protocol/README.md) |
| 维护者 skills | [docs/dev/skills/README.md](docs/dev/skills/README.md) |
| Conformance cases | [docs/conformance/README.md](docs/conformance/README.md) |
| 发布治理 | [docs/release/README.md](docs/release/README.md) |
| Legacy 迁移 | [docs/legacy-migration/README.md](docs/legacy-migration/README.md) |
| Roadmap | [ROADMAP.md](ROADMAP.md) |

## 贡献边界

| 应该做 | 不应该做 |
|---|---|
| 将原始需求放入 `docs/business/`。 | 把业务说明当成 runtime 合同。 |
| 将可评审提案放入 `docs/protocol/`。 | 为新行为跳过 RFC 评审直接写 registry。 |
| 将已接受事实放入 `registry/` 和 `registry/domains/`。 | 在 runtime 仓库里维护并行协议常量。 |
| 事实变更后重新生成 `protocol/axtp.protocol.yaml` 和 `docs/generated/*`。 | 手写 generated 协议产物。 |
| 将语言专属 API 设计放在 runtime 仓库。 | 把 C/C++/Flutter/TS/Python 专属 API 文档加回 core repo。 |
| Runtime 构建使用 spec tag 或明确 commit。 | 为可复现 runtime release 依赖浮动的 `main`。 |
