---
name: axtp-patterns
description: AXTP 协议规范库的工作模式、文件组织、提交规范和 Registry 治理规则
version: 1.0.0
source: local-git-analysis
analyzed_commits: 20
---

# AXTP 协议规范库工作模式

从 git 历史分析提取，适用于所有对本仓库的修改。

## 提交规范

本仓库使用 Conventional Commits，类型分布：

| 类型 | 用途 | 示例 |
| --- | --- | --- |
| `docs:` | 规范文档修改（最常见，约 85%） | `docs: unify Control Payload to single 5B header` |
| `feat:` | 新增功能或协议能力 | `feat: align AXTP RPC status model` |
| `fix:` | 修正错误描述或字段定义 | `fix: correct CRC16 polynomial reference` |
| `chore:` | 工具链、配置、依赖 | `chore: update generator dependencies` |

提交消息风格：动词开头，描述"做了什么"而非"为什么"，英文，不超过 72 字符。

## 文件组织

```
standard/
├── docs/                    # 人类可读规范文档（Markdown）
│   ├── 00-overview/         # 协议总览与路线图
│   ├── 01-core-protocol/    # Frame/Control/RPC/Stream 核心规范
│   ├── 02-type-system/      # 类型系统与 TLV Schema
│   ├── 03-registry/         # Registry 治理与注册表文档
│   ├── 04-compatibility/    # 老协议适配
│   ├── 05-demo/             # Demo 规范与 MVP 验收
│   ├── 06-generator/        # Generator 实现规范
│   └── 07-cpp-demo/         # C++ Demo 实现规范
├── registry/                # YAML 注册表（单一事实源）
│   ├── method_registry.yaml
│   ├── event_registry.yaml
│   ├── capability_registry.yaml
│   ├── error_code.yaml
│   └── ...
├── schema/                  # TLV Schema 定义
└── generator/               # TypeScript Generator 工具
    ├── src/
    └── package.json
```

## 核心工作流

### 修改协议规范

1. 修改 `standard/docs/` 下对应文档
2. 如涉及 Registry（新增 method/event/capability），同步更新 `standard/registry/*.yaml`
3. 运行 `cd standard/generator && pnpm validate` 验证 registry 合法性
4. 提交时同时包含文档和 registry 变更

### 新增业务逻辑

使用 `/axtp-add-domain` skill 引导完成，或手动按以下顺序操作：
1. `standard/registry/method_registry.yaml` — 新增 method 条目
2. `standard/registry/event_registry.yaml` — 新增 event 条目（如有）
3. `standard/registry/capability_registry.yaml` — 新增 capability 条目
4. `standard/schema/` — 新增 schema YAML
5. `standard/docs/03-registry/` — 更新对应注册表文档

### 运行 Generator

```bash
cd standard/generator
pnpm build      # 编译
pnpm validate   # 校验 registry
pnpm generate   # 生成到 standard/out/generated/
```

## Registry 治理规则

- **ID 不得重复**：新增前先 `grep -n "0x{ID}" standard/registry/*.yaml` 确认
- **ID 范围必须匹配 domain**：见 `08-AXTP-Registry总则-v2.md` §10
- **stable 条目不得改变语义**：语义变化时新增 ID，不修改旧 ID
- **不得在代码中硬编码未注册 ID**：必须先注册再使用
- **新增 method/event 不需要升级 Protocol Version**：只升级 Registry Version

## 最常修改的文件

按修改频率排序（git 历史统计）：

1. `standard/docs/01-core-protocol/03-AXTP-RPC协议与二进制映射规范-v2.md` — RPC 核心规范
2. `standard/docs/05-demo/22-AXTP-MVP-Normative-Demo.md` — MVP 验收 Demo
3. `standard/docs/01-core-protocol/05-AXTP-连接场景与调用流程规范-v2.md` — 连接场景
4. `standard/docs/00-overview/00-AXTP-协议总览与落地路线.md` — 总览
5. `standard/registry/method_registry.yaml` — 方法注册表

修改这些文件时，通常需要同步检查其他文件的一致性。

## 文档命名规范

- 规范文档：`NN-AXTP-{Title}-v{N}.md`（数字前缀 + 版本后缀）
- Registry 文档：`NN-AXTP-{Name}注册表-v{N}.md`
- Demo 文档：`NN-AXTP-{Transport}-Demo.md`

## 协议设计原则（从 FAQ 提取）

- Control Payload 统一 5B 固定头，不区分 Standard/Compact Frame Profile
- RPC Binary 统一 11B 固定头，不区分 Standard/Compact
- STREAM Payload 保留 Standard(16B)/Compact(8B) 区分（带宽敏感）
- HID 默认 Standard Frame Profile，Report Size ≤ 64B 时协商降级 Compact
- OTA 校验字段用 `verifyType`+`verifyValue`（算法无关），MVP 默认 md5
- WebSocket JSON 是 Debug/Legacy 路径，不是生产路径
