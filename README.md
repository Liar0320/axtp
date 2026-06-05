# AXTP

AXTP（Auditoryworks Transport Protocol）是一套面向设备控制、事件通知和连续数据流的传输无关协议框架。本仓库维护 AXTP 的规范、协议事实源、Generator、生成产物、C++/Flutter runtime、SDK 和调试工具。

AXTP 的核心约定是：业务方案先进入草案，评审采纳后写入 YAML 事实源，再由 Generator 生成所有机器消费产物。不要手写生成文件。

```text
业务需求 / 旧协议材料
  -> docs/protocol/<domain>/<domain.feature>.md
  -> 评审采纳 + docs/specs/08-13 反向确认（涉及 profile/MVP 时同时确认 14）
  -> registry/**/*.yaml + registry/domains/**/*.yaml
  -> protocol/axtp.protocol.yaml
  -> docs/generated/* + tooling/* + runtime generated headers
```

## Start Here

| 读者目标 | 最短路径 |
|---|---|
| 第一次读仓库 | 先读 [docs/README.md](docs/README.md)，再读 [docs/specs/00-AXTP-Overview.md](docs/specs/00-AXTP-Overview.md) |
| 理解协议怎么在线上传 | [docs/specs/README.md](docs/specs/README.md) -> 00 / 02 / 03 / 04 / 05 / 06 |
| 查当前可实现协议 | [docs/generated/protocol.md](docs/generated/protocol.md) 和 [docs/generated/protocol.json](docs/generated/protocol.json) |
| 新增或修改业务协议 | [docs/protocol/README.md](docs/protocol/README.md) -> 对应 `docs/dev/skills/**` |
| 运行 Generator 或 CLI/SDK/runtime | [docs/guides/how-to-use.md](docs/guides/how-to-use.md) |
| C++ runtime/SDK 接入 | [docs/dev/AXTP_CPP_RUNTIME_PATTERNS.md](docs/dev/AXTP_CPP_RUNTIME_PATTERNS.md)、[docs/dev/AXTP_CORE_API_DESIGN.md](docs/dev/AXTP_CORE_API_DESIGN.md) 和 [docs/dev/AXTP_SDK_API_DESIGN.md](docs/dev/AXTP_SDK_API_DESIGN.md) |
| Flutter runtime 接入 | [docs/dev/AXTP_FLUTTER_RUNTIME_PATTERNS.md](docs/dev/AXTP_FLUTTER_RUNTIME_PATTERNS.md) 和 [runtimes/flutter/README.md](runtimes/flutter/README.md) |
| 研发启动会材料 | [docs/dev/AXTP_RD_KICKOFF_GUIDE.md](docs/dev/AXTP_RD_KICKOFF_GUIDE.md) |

## Repository Layout

| 路径 | 角色 | 手动维护 |
|---|---|---:|
| `docs/specs/` | 正式规范和治理规则：wire format、transport、registry、类型系统、Generator 规则 | 是 |
| `docs/protocol/` | 业务协议草案与评审输入；不是 Generator 机器输入 | 是 |
| `registry/` | Core/MVP/共享/legacy 已采纳机器事实源 | 是 |
| `registry/domains/` | 已采纳业务域机器事实源，新增普通业务默认落点 | 是 |
| `protocol/axtp.protocol.yaml` | Generator 聚合输出的 Protocol IR | 否 |
| `docs/generated/` | Generator 输出的人读协议参考和 JSON | 否 |
| `tooling/mcp/`、`tooling/test-vectors/` | Generator 输出的工具 JSON 和测试向量 | 否 |
| `generators/` | TypeScript Generator 源码 | 是 |
| `runtimes/cpp/core/` | C++ protocol core/runtime，`include/generated/` 除外 | 部分 |
| `runtimes/cpp/sdk/` | C++ 应用层 SDK | 部分 |
| `runtimes/cpp/tools/axtpctl/` | AXTP CLI 调试工具 | 是 |
| `runtimes/flutter/` | Flutter/Dart runtime、dynamic client、mock transport 和 generated registry | 部分 |

`docs/protocol/` 和根目录 `protocol/` 名字相近，但角色不同：前者是草案目录，后者当前只包含生成后的 `protocol/axtp.protocol.yaml`。

## Protocol Model

AXTP 分为五层：Transport 负责连接和字节传输，Frame 负责边界、长度、分片和 CRC，Payload 只分发 CONTROL/RPC/STREAM，Registry 定义 method/event/error/schema/capability/profile，Business 实现真实设备业务逻辑。

```text
Business   device / display / firmware / network / stream / ...
Registry   method / event / error / schema / capability / profile
Payload    CONTROL(0x01) / RPC(0x02) / STREAM(0x03)
Frame      Standard Frame Header / length / fragment / CRC
Transport  USB HID / TCP / WebSocket / future low-bandwidth paths
```

| Transport profile | Wire path | Payload support |
|---|---|---|
| `AXTP-USB-HID` | Standard Frame | CONTROL / RPC / STREAM |
| `AXTP-TCP` | Standard Frame | CONTROL / RPC / STREAM |
| `AXTP-WS-JSON` | WebSocket JSON message | RPC JSON only |
| `AXTP-WS-CLOUD-REVERSE` | WebSocket JSON message | RPC JSON only |

业务类型不要进入 Frame Header 或顶层 PayloadType。比如固件更新、音视频、日志和文件块应通过 RPC 建立业务语义，再用 STREAM 承载连续数据。

## Protocol Lifecycle

当前仓库按六个阶段维护协议；完整 skill 索引见 [docs/dev/skills/README.md](docs/dev/skills/README.md)：

| 阶段 | Skill / 入口 | 输入 | 输出 |
|---|---|---|---|
| 路由 | [axtp-protocol-workflow](docs/dev/skills/00-axtp-protocol-workflow/SKILL.md) | 不确定处于哪个阶段的需求 | 明确应该起草、采纳、修订、生成还是实现 |
| Stage 10 流程 | [plan-protocol-flow](docs/dev/skills/10-plan-protocol-flow/SKILL.md) | 业务场景、用户 story、UI 原型、端到端交互 | `docs/flows/<scenario>.md`，列出协议步骤、已有覆盖和缺口；协议缺口再转 20/40 |
| 起草 | [draft-business-protocol](docs/dev/skills/20-draft-business-protocol/SKILL.md) | 产品需求、架构草图、旧协议线索 | `docs/protocol/<domain>/<domain.feature>.md` |
| 采纳 | [adopt-protocol-draft](docs/dev/skills/30-adopt-protocol-draft/SKILL.md) | 已评审确认的草案 | `docs/specs/08-13` 对齐记录；涉及 profile/MVP 时同步 14；写入 `registry/**/*.yaml` / `registry/domains/**/*.yaml` |
| 修订 | [amend-adopted-protocol](docs/dev/skills/40-amend-adopted-protocol/SKILL.md) | 已采纳或已生成协议的语义变更 | amendment 记录 + 更新后的草案/specs/YAML + generated 产物 |
| 生成 | [generate-axtp-protocol](docs/dev/skills/50-generate-axtp-protocol/SKILL.md) | 已更新的 YAML 事实源 | Protocol IR、generated docs、tooling JSON、test vectors、runtime generated headers |

`docs/specs/**` 是协议规则和治理依据，`docs/flows/**` 是业务场景到协议交互的桥接文档，`docs/protocol/**` 是草案、评审和修订记录，`registry/**/*.yaml` 与 `registry/domains/**/*.yaml` 才是 Generator 的机器输入。仓库不要求研发照着 Markdown 手工填写生成产物；场景到协议清单由 Stage 10 `plan-protocol-flow` 梳理，草案到 YAML 的采纳动作由 `adopt-protocol-draft` 固化流程，已采纳协议的语义修正由 `amend-adopted-protocol` 管理，YAML 到产物的动作由 `generate-axtp-protocol` 完成。

## Quick Start

安装 Generator 依赖：

```bash
pnpm --dir generators install
```

构建并校验协议事实源：

```bash
pnpm --dir generators build
pnpm --dir generators validate:sources
```

重新生成协议产物：

```bash
pnpm --dir generators generate
pnpm --dir generators validate:protocol
```

运行 Generator 测试：

```bash
pnpm --dir generators test
```

提交前建议检查：

```bash
git diff --check
```

如果本机 `pnpm` 因依赖构建审批阻塞脚本，可临时加上：

```bash
--config.verify-deps-before-run=false
```

## Source Boundaries

可以手动修改：

- `docs/specs/**`
- `docs/protocol/**`
- `docs/guides/**`
- `docs/dev/**`
- `registry/**/*.yaml`
- `registry/domains/**/*.yaml`
- `generators/src/**`
- `runtimes/**` 中非 generated 的代码

不要手动修改：

- `protocol/axtp.protocol.yaml`
- `docs/generated/**`
- `tooling/mcp/*.generated.json`
- `tooling/test-vectors/**`
- `runtimes/cpp/core/include/generated/**`
- `generators/src/__snapshots__/**`

生成结果不符合预期时，应回到草案、specs、YAML 事实源或 Generator 逻辑修正，再重新生成。

## Current Snapshot

当前生成协议包含：

| 类型 | 数量 / 内容 |
|---|---|
| Methods | 4 |
| Events | 1 |
| Errors | 154 |
| Profiles | `AXTP-MVP`、`AXTP-MVP-HID` |
| Transports | `AXTP-USB-HID`、`AXTP-TCP`、`AXTP-WS-JSON`、`AXTP-WS-CLOUD-REVERSE` |

以 [docs/generated/protocol.md](docs/generated/protocol.md) 和 [docs/generated/protocol.json](docs/generated/protocol.json) 作为研发、测试和工具集成的当前协议参考。

## Development Notes

- 新业务先进入 `docs/protocol/<domain>/<domain.feature>.md` 草案，不直接写 generated 产物。
- 评审完成后再采纳到 YAML；有 `[REVIEW-ASK]`、`[REVIEW-FIX]` 或 `[REVIEW-BLOCKER]` 的事实不得进入 YAML。
- 新增或修改 YAML 后必须运行 Generator，让协议文档、工具 JSON、测试向量和 runtime generated headers 保持一致。
- C++ runtime 推荐从 `AxtpEndpoint + BasicBroker<>` 接入；应用层 SDK 使用方式见 [docs/dev/AXTP_SDK_API_DESIGN.md](docs/dev/AXTP_SDK_API_DESIGN.md)。

## TODO List
- 各种业务协议完整
- 设备发现协议整合
