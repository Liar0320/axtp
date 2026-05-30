---
name: axtp-patterns
description: AXTP 协议规范库的当前工作模式、文件组织、三段式 Generator 流程和 Registry/Domain YAML 治理规则
version: 2.0.0
source: local-repo-current
---

# AXTP 协议规范库工作模式

适用于本仓库所有协议文档、Registry YAML、Generator 和生成产物修改。

## 当前目录模型

```text
docs/specs/                         # 00-20 规范文档
docs/source/                        # 规划、迁移、legacy、审查材料
docs/generated/                     # Generator 产物，不手写
registry/                           # 唯一机器事实源根目录
registry/core/                      # 协议元信息与核心枚举
registry/method|event|error/        # Core/MVP/已采纳公共事实
registry/capability|schema|legacy/  # Core/MVP/共享 schema、能力、legacy 映射
registry/domains/<domain>/domain.yaml # 新增业务域事实源
protocol/axtp.protocol.yaml         # Generator 生成的 Protocol IR，不手写
generators/                         # TypeScript generator
tooling/mcp/                        # Generator 产物，不手写
tooling/test-vectors/               # Generator 产物，不手写
runtimes/*/generated/               # Generator 产物，不手写
```

旧 `standard/` 路径已经不是当前工作流入口。

## 三段式生成法

```text
registry/ + registry/domains/
  -> validate sources
  -> build protocol/axtp.protocol.yaml
  -> emit docs/generated, tooling/mcp, runtime generated, test vectors
```

推荐命令：

```bash
cd generators
npm run build
npm test
node dist/cli.js validate-sources --spec ..
node dist/cli.js generate --spec ..
node dist/cli.js validate-protocol --spec ..
git diff --check
```

`generate --spec ..` 是当前主命令。它会生成 Protocol IR 和全套仓库约定位置的产物。

## Registry / Domain 治理

- `registry/` 是唯一机器事实源根目录。
- 新增业务默认只写 `registry/domains/<domain>/domain.yaml`。
- `registry/method|event|error|capability|schema|legacy/` 只放 Core/MVP/公共/已采纳事实。
- 同一个 method/event/type/error/capability/profile 不得同时在 core registry 和 domain YAML 中重复定义。
- domain 业务晋升 Core/MVP 时必须迁移，不得复制；保持 ID、fieldId、bit_offset 和语义不变。
- `protocol/axtp.protocol.yaml` 和所有 generated 目录都不得手写。

## 新增业务逻辑

使用 `/axtp-add-domain` skill 交互式完成。手动执行时也遵守同一流程：

1. 读取 `docs/specs/08-13` 与 `docs/source/09-13`。
2. 检查 `registry/**/*.yaml` 与 `registry/domains/**/*.yaml` 是否已有等价条目。
3. 默认写入 `registry/domains/<domain>/domain.yaml`。
4. 只在 Core/MVP 晋升、公共 schema、核心常量或 legacy 映射时修改核心 `registry/` 文件。
5. 运行三段式 generator。

## 设计原则

- AXTP v1 Core 当前主线是 Standard Framed 和 WebSocket Unframed JSON。
- Compact/HID-64/BLE/UART 属于低带宽降级，见 `docs/specs/17-AXTP-Low-Bandwidth-Degradation.md`。
- Control Payload 固定 5B 头。
- RPC Binary 固定 11B 头。
- STREAM Header 固定 16B：`streamId:uint32`、`seqId:uint32`、`cursor:uint64`。
- HID 当前主推 `AXTP-USB-HID` 高速模式，不是 HID-64 低带宽模式。
- OTA/对象校验字段优先使用 `verifyType` + `verifyValue`。

## 提交规范

本仓库倾向 Conventional Commits：

| 类型 | 用途 |
|---|---|
| `docs:` | 规范文档修改 |
| `feat:` | 新增协议能力或 generator 能力 |
| `fix:` | 修正错误描述或字段定义 |
| `chore:` | 工具链、配置、依赖 |

提交消息用英文动词短句，描述做了什么。
