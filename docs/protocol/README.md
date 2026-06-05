# AXTP Protocol Draft Intake

`docs/protocol/` 是业务协议方案输入与评审区，不是最终协议事实源。

这里的文档用于沉淀产品/架构师提出的业务流程、候选 method/event/schema/error/capability/profile、旧协议线索和评审结论。只有被评审采纳、反向确认到 `docs/specs/08-13`（涉及 profile/MVP 时同步确认 `14`），并写入 `registry/` 或 `registry/domains/<domain>/domain.yaml` 的内容，才进入正式生成路径。

注意：`docs/protocol/` 是草案目录；根目录 `protocol/axtp.protocol.yaml` 是 Generator 输出的 Protocol IR。二者名字相近，但不能互相替代。

## 权威边界

| 路径 | 角色 | 能否作为实现合同 |
|---|---|---|
| `docs/protocol/<domain>/<domain.feature>.md` | 业务草案、评审记录、采纳/修订依据 | 否，除非已采纳且 generated 已刷新 |
| `registry/**/*.yaml`、`registry/domains/**/*.yaml` | 已采纳机器事实源 | 是，Generator 输入 |
| `protocol/axtp.protocol.yaml` | 聚合后的 Protocol IR | 是，但只读，不手写 |
| `docs/generated/protocol.md` / `.json` | 研发、测试、工具消费的当前协议参考 | 是，Generator 输出 |

## 生成路径

```text
业务场景、UI 原型、用户 story 或旧协议材料
        ↓
Codex skill: Stage 10 plan-protocol-flow
        ↓ scenario / protocol coverage / gap list
docs/flows/<scenario>.md
        ↓ protocol gap or confirmed protocol requirement
产品/架构师业务描述、草稿文档或旧协议材料
        ↓
Codex skill: draft-business-protocol
        ↓ search / reuse / modify / create draft
docs/protocol/<domain>/<domain.feature>.md 协议草案
        ↓ internal review / confirmation
Codex skill: adopt-protocol-draft
        ↓ reverse-confirm docs/specs/08-13 and 14 when profiles/MVP change
registry/**/*.yaml + registry/domains/**/*.yaml
        ↓
Codex skill: generate-axtp-protocol
        ↓
protocol/axtp.protocol.yaml
        ↓
docs/generated/*、tooling/*、runtimes/*/generated/*
        ↓ post-adoption semantic correction / field removal / deprecation / extension
Codex skill: amend-adopted-protocol
        ↓ update adopted proposal + specs/YAML
registry/**/*.yaml + registry/domains/**/*.yaml
        ↓
Codex skill: generate-axtp-protocol
        ↓
refreshed protocol/axtp.protocol.yaml + generated artifacts
```

## Skill 分工

完整 skill 索引见 `docs/dev/skills/README.md`。编号目录用于阶段排序，skill 名称仍使用语义化触发名。

| 阶段 | 触发输入 | Skill 做什么 | 允许修改 | 输出 |
|---|---|---|---|---|
| 总控路由 | 用户不确定应该起草、采纳、修订、生成还是实现 | `axtp-protocol-workflow` 判断生命周期阶段并路由到正确 skill | 按被路由阶段决定 | 明确下一步 workflow |
| Stage 10 流程 | 业务场景、用户 story、UI 原型、端到端交互 | [`plan-protocol-flow`](../dev/skills/10-plan-protocol-flow/SKILL.md) 遍历 story 步骤，查询 adopted/generated/draft 协议覆盖，输出协议交互方案和缺口 | `docs/flows/**` | 场景流程文档，带 sequence、步骤表、协议覆盖和下一步 skill |
| 草案 | 大白话需求、架构草图、旧协议片段或评审意见 | `draft-business-protocol` 遍历 `docs/protocol/**` 和 legacy 线索，判断复用、修改或新增 domain.feature 草案 | `docs/protocol/**` 草案和待确认问题 | 可评审协议草案，带候选接口、字段、legacyRefs 和 `[REVIEW-*]` 标记 |
| 采纳 | 内部评审确认后的草案 | `adopt-protocol-draft` 读取草案、specs 和现有 YAML，拒绝未确认 `[REVIEW-*]`，反向确认 08-13，涉及 profile/MVP 时同步 14，固定草案状态，写入 YAML | `docs/protocol/**`、`docs/specs/08-14`、`registry/**`、`registry/domains/**` | formal proposal + YAML 机器事实源 |
| 修订 | 已采纳或已生成的协议事实需要语义修正、字段删除、字段废弃、重命名或扩展 | `amend-adopted-protocol` 读取 adopted proposal、specs、YAML 和 generated 现状，判断兼容性，记录 amendment，修正 YAML 并重新生成 | `docs/protocol/**`、`docs/specs/08-14`、`registry/**`、`registry/domains/**`、Generator 生成产物 | amended proposal + 更新后的 YAML/生成物 |
| 生成 | YAML 事实源已更新，需要刷新正式产物 | `generate-axtp-protocol` 从 YAML 运行 Generator pipeline 并验证输出 | 生成产物 | `protocol/axtp.protocol.yaml`、`docs/generated/*`、tooling/runtime generated 产物 |

草案阶段不得写 registry YAML，不得直接生成最终协议；采纳阶段不得采纳 `[REVIEW-ASK]` 或 `[REVIEW-BLOCKER]` 标记的事实；修订阶段不得绕过 adopted proposal 和 YAML 直接改 generated；生成阶段不得从 Markdown 推断新协议事实，只从 YAML 生成。

如果输入还是端到端场景、UI 原型或用户 story，不要直接进入协议草案；先使用 `docs/dev/skills/10-plan-protocol-flow/SKILL.md` 输出 `docs/flows/<scenario>.md`，把协议步骤、已有覆盖、协议缺口和 UI-only 行为分清楚。

采纳阶段也不应该靠人照着 Markdown 手填 YAML；应使用 `docs/dev/skills/30-adopt-protocol-draft/SKILL.md` 固化草案到 specs/YAML 的转译、编号、冲突检查和源级验证流程。

已采纳协议的语义变更不应回到普通草案流程，也不应直接手改生成物；应使用 `docs/dev/skills/40-amend-adopted-protocol/SKILL.md` 记录修订依据、判断兼容性、修正 adopted proposal/specs/YAML，并重新运行 Generator。

## 使用规则

- 新增业务必须先按 08《AXTP Capability Naming and Feature Taxonomy》确定 `domain.feature`。
- 业务 method、event、error、capability、schema、profile 的稳定事实必须写入 YAML。
- `docs/protocol/<domain>/<domain.feature>.md` 中的 method/event wire name 可以作为评审输入；采纳前不得视为当前协议合同。
- 未进入 migration approved 状态的旧协议材料，应先在本目录或交互式 skill 中完成 domain-feature 分类和待确认问题整理。
- 不得从本目录直接生成 `protocol/axtp.protocol.yaml`；必须经过评审确认、08-13/14 反向确认、registry YAML，再由 `generate-axtp-protocol` 生成。
- 研发只根据采纳后的 generated 产物开发和上架 feature，不依赖未采纳草案。
- 已采纳协议如果要删除字段、收窄枚举/范围、改名、废弃或新增字段，必须先判断当前事实是 `draft/experimental` 还是 `mvp/stable`；draft 可按确认事实修正，stable/MVP 默认走 deprecate 或版本化替代。

## 采纳检查

采纳一份业务文档前必须确认：

- capability ID 使用 `domain.feature`，不使用字段级 `Config / State / Scan / Connection` 作为 feature。
- method/event 命名符合配置型、状态型、动作型、流型或导出型模板。
- 新增 ID、`bitOffset` 和 schema fieldId 不与现有 YAML 冲突。
- `docs/specs/08-13` 已完成反向确认；如果涉及 profile 或 MVP 合同，`docs/specs/14` 也已同步确认。
- 旧协议适配只登记确定的 legacy CmdValue、状态码和 payload 映射；未知项保留为待确认问题。
- 运行 `generate-axtp-protocol` 后，`protocol/axtp.protocol.yaml` 与 `docs/generated/*` 能完整反映采纳结果。

## 协议审核标记

`docs/protocol/<domain>/<domain.feature>.md` 直接使用以下标记进行人工审核：

- `[REVIEW-DRAFT]`：草案已归类，但业务语义、字段或 legacy 映射仍在整理中。
- `[REVIEW-OK]`：命名、归属和接口方向符合 08/09，可进入人工确认或 registry 草案。
- `[REVIEW-FIX]`：进入 registry 前必须修正文档、方法清单、错误策略、schema 或生成路径描述。
- `[REVIEW-ASK]`：需要产品、设备实现或 legacy 行为确认后才能写入 `legacyRefs` 或 YAML。
- `[REVIEW-BLOCKER]`：当前文档定位会误导新协议生成，必须先重写或拆分。


## 优先实现的协议文档

- `video/video.framing.md`
- `video/video.stream.md`
- `video/video.ndi.md`
- `video/video.rtsp.md`
- `network/network.wifi.md`
- `network/network.ap.md`
- `network/network.ip.md`
- `firmware/firmware.update.md`
- `camera/camera.focus.md`
- `audio/audio.recording.md`
