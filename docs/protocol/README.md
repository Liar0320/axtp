# AXTP Protocol Draft Intake

`docs/protocol/` 是业务协议方案输入与评审区，不是最终协议事实源。

这里的文档用于沉淀产品/架构师提出的业务流程、候选 method/event/schema/error/capability/profile、旧协议线索和评审结论。只有被评审采纳、反向确认到 `docs/specs/08-13`，并写入 `registry/` 或 `registry/domains/<domain>/domain.yaml` 的内容，才进入正式生成路径。

## 生成路径

```text
产品/架构师业务描述、草稿文档或旧协议材料
        ↓
Codex skill: 添加业务协议
        ↓ search / reuse / modify / create draft
docs/protocol/<domain>/<domain.feature>.md 协议草案
        ↓ internal review / confirmation
Codex skill: 协议采纳
        ↓ reverse-confirm docs/specs/08-13
registry/**/*.yaml + registry/domains/**/*.yaml
        ↓
Generator: build protocol IR
        ↓
protocol/axtp.protocol.yaml
        ↓
docs/generated/*、tooling/*、runtimes/*/generated/*
```

## 双 skill 交互流程

| 阶段 | 触发输入 | Skill 做什么 | 允许修改 | 输出 |
|---|---|---|---|---|
| 添加业务协议 | 大白话需求、架构草图、旧协议片段或评审意见 | 遍历 `docs/protocol/<domain>/<domain.feature>.md` 和 `docs/protocol/legacy-classification/**`，判断现有草案是否可复用、是否需要优化，或是否要新增 domain.feature 草案 | `docs/protocol/**` 草案和待确认问题 | 可评审协议草案，带候选接口、字段、legacyRefs 和 `[REVIEW-*]` 标记 |
| 协议采纳 | 内部评审确认后的草案 | 将已确认内容反向确认回 08-13，补齐正式 registry 规则或表格，再写入 YAML 并运行 Generator | `docs/specs/08-13`、`registry/**`、`registry/domains/**` 和生成产物 | `protocol/axtp.protocol.yaml`、`docs/generated/*`、runtime/tooling 生成物 |

第一阶段不得写 registry YAML，不得直接生成最终协议；第二阶段不得采纳 `[REVIEW-ASK]` 或 `[REVIEW-BLOCKER]` 标记的事实。

## 使用规则

- 新增业务必须先按 08《AXTP Capability Naming and Feature Taxonomy》确定 `domain.feature`。
- 业务 method、event、error、capability、schema、profile 的稳定事实必须写入 YAML。
- `docs/protocol/<domain>/<domain.feature>.md` 中的 method/event wire name 可以作为评审输入；采纳前不得视为当前协议合同。
- 未进入 migration approved 状态的旧协议材料，应先在本目录或交互式 skill 中完成 domain-feature 分类和待确认问题整理。
- 不得从本目录直接生成 `protocol/axtp.protocol.yaml`；必须经过评审确认、08-13 反向确认、registry YAML 与 Generator。
- 研发只根据采纳后的 generated 产物开发和上架 feature，不依赖未采纳草案。

## 采纳检查

采纳一份业务文档前必须确认：

- capability ID 使用 `domain.feature`，不使用字段级 `Config / State / Scan / Connection` 作为 feature。
- method/event 命名符合配置型、状态型、动作型、流型或导出型模板。
- 新增 ID、`bitOffset` 和 schema fieldId 不与现有 YAML 冲突。
- `docs/specs/08-13` 已完成反向确认：命名、ID、method、event、error、schema、capability 规则与正式表格需要更新的地方已经更新。
- 旧协议适配只登记确定的 legacy CmdValue、状态码和 payload 映射；未知项保留为待确认问题。
- 运行 Generator 后，`protocol/axtp.protocol.yaml` 与 `docs/generated/*` 能完整反映采纳结果。

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
- `firmware/firmware.ota.md`
- `camera/camera.focus.md`
- `audio/audio.recording.md`
