# AXTP Protocol Draft Intake

`docs/protocol/` 是业务协议方案输入与评审区，不是最终协议事实源。

这里的文档用于沉淀产品/架构师提出的业务流程、候选 method/event/schema/error/capability/profile、旧协议线索和评审结论。只有被评审采纳、反向确认到 `docs/specs/2-registry/**` 与 `docs/specs/3-codec/02-Capability-Types.md`（涉及 profile/MVP 时同步确认 `docs/specs/2-registry/05-Profiles-Registry.md`），并写入 `registry/` 或 `registry/domains/<domain>/domain.yaml` 的内容，才进入正式生成路径。

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
        ↓ reverse-confirm Registry and Capability Types specs, plus Profiles Registry when profiles/MVP change
registry/**/*.yaml + registry/domains/**/*.yaml
        ↓
Codex skill: generate-axtp-protocol
        ↓
protocol/axtp.protocol.yaml
        ↓
docs/generated/*、tooling/*、runtime 子仓库 generated 产物
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
| 采纳 | 内部评审确认后的草案 | `adopt-protocol-draft` 读取草案、specs 和现有 YAML，拒绝未确认 `[REVIEW-*]`，反向确认 Registry/Capability Types specs，涉及 profile/MVP 时同步 Profiles Registry，固定草案状态，写入 YAML | `docs/protocol/**`、`docs/specs/2-registry/**` 与 `docs/specs/3-codec/02-Capability-Types.md`、`registry/**`、`registry/domains/**` | formal proposal + YAML 机器事实源 |
| 修订 | 已采纳或已生成的协议事实需要语义修正、字段删除、字段废弃、重命名或扩展 | `amend-adopted-protocol` 读取 adopted proposal、specs、YAML 和 generated 现状，判断兼容性，记录 amendment，修正 YAML 并重新生成 | `docs/protocol/**`、`docs/specs/2-registry/**` 与 `docs/specs/3-codec/02-Capability-Types.md`、`registry/**`、`registry/domains/**`、Generator 生成产物 | amended proposal + 更新后的 YAML/生成物 |
| 生成 | YAML 事实源已更新，需要刷新正式产物 | `generate-axtp-protocol` 从 YAML 运行 Generator pipeline 并验证输出 | 生成产物 | `protocol/axtp.protocol.yaml`、`docs/generated/*`、tooling/runtime generated 产物 |

草案阶段不得写 registry YAML，不得直接生成最终协议；采纳阶段不得采纳 `[REVIEW-ASK]` 或 `[REVIEW-BLOCKER]` 标记的事实；修订阶段不得绕过 adopted proposal 和 YAML 直接改 generated；生成阶段不得从 Markdown 推断新协议事实，只从 YAML 生成。

如果输入还是端到端场景、UI 原型或用户 story，不要直接进入协议草案；先使用 `docs/dev/skills/10-plan-protocol-flow/SKILL.md` 输出 `docs/flows/<scenario>.md`，把协议步骤、已有覆盖、协议缺口和 UI-only 行为分清楚。

采纳阶段也不应该靠人照着 Markdown 手填 YAML；应使用 `docs/dev/skills/30-adopt-protocol-draft/SKILL.md` 固化草案到 specs/YAML 的转译、编号、冲突检查和源级验证流程。

已采纳协议的语义变更不应回到普通草案流程，也不应直接手改生成物；应使用 `docs/dev/skills/40-amend-adopted-protocol/SKILL.md` 记录修订依据、判断兼容性、修正 adopted proposal/specs/YAML，并重新运行 Generator。

## 使用规则

- 新增业务必须先按 `docs/specs/2-registry/01-Naming-and-Taxonomy.md`确定 `domain.feature`。
- 业务 method、event、error、capability、schema、profile 的稳定事实必须写入 YAML。
- `docs/protocol/<domain>/<domain.feature>.md` 中的 method/event wire name 可以作为评审输入；采纳前不得视为当前协议合同。
- 未进入 migration approved 状态的旧协议材料，应先在本目录或交互式 skill 中完成 domain-feature 分类和待确认问题整理。
- 不得从本目录直接生成 `protocol/axtp.protocol.yaml`；必须经过评审确认、Registry/Capability Types/Profiles specs 反向确认、registry YAML，再由 `generate-axtp-protocol` 生成。
- 研发只根据采纳后的 generated 产物开发和上架 feature，不依赖未采纳草案。
- 已采纳协议如果要删除字段、收窄枚举/范围、改名、废弃或新增字段，必须先判断当前事实是 `draft/experimental` 还是 `mvp/stable`；draft 可按确认事实修正，stable/MVP 默认走 deprecate 或版本化替代。

## 采纳检查

采纳一份业务文档前必须确认：

- capability ID 使用 `domain.feature`，不使用字段级 `Config / State / Scan / Connection` 作为 feature。
- method/event 命名符合配置型、状态型、动作型、流型或导出型模板。
- 新增 ID、`bitOffset` 和 schema fieldId 不与现有 YAML 冲突。
- `docs/specs/2-registry/**` 与 `docs/specs/3-codec/02-Capability-Types.md` 已完成反向确认；如果涉及 profile 或 MVP 合同，`docs/specs/2-registry/05-Profiles-Registry.md` 也已同步确认。
- 旧协议适配只登记确定的 legacy CmdValue、状态码和 payload 映射；未知项保留为待确认问题。
- 运行 `generate-axtp-protocol` 后，`protocol/axtp.protocol.yaml` 与 `docs/generated/*` 能完整反映采纳结果。

## 协议审核标记

`docs/protocol/<domain>/<domain.feature>.md` 直接使用以下标记进行人工审核：

- `[REVIEW-DRAFT]`：草案已归类，但业务语义、字段或 legacy 映射仍在整理中。
- `[REVIEW-OK]`：命名、归属和接口方向符合 Naming/YAML mapping specs，可进入人工确认或 registry 草案。
- `[REVIEW-FIX]`：进入 registry 前必须修正文档、方法清单、错误策略、schema 或生成路径描述。
- `[REVIEW-ASK]`：需要产品、设备实现或 legacy 行为确认后才能写入 `legacyRefs` 或 YAML。
- `[REVIEW-BLOCKER]`：当前文档定位会误导新协议生成，必须先重写或拆分。


## Domain 状态矩阵

本表用于让研发、测试和产品快速判断每个 domain 当前走到哪里。`Generated` 统计当前 generated protocol 中已经落地的方法和事件数量；`video` / `audio` 的 P0 stream 优先级表示要同时采纳 RPC 建流/关流控制面和 STREAM 数据面字段约束。

| Domain | Drafts | Review | Generated | Priority | Next Step |
|---|---:|---|---:|---|---|
| audio | 12 | ASK | 5 | 旁路高覆盖 / P0 stream | 已进入 generated；后续按修订流程维护，同时补齐 audio stream 控制面和 STREAM 数据面确认。 |
| auth | 3 | ASK | 0 | 待排期 | 补产品/设备/legacy 确认。 |
| camera | 7 | ASK | 0 | P3/P4 | 补产品/设备/legacy 确认。 |
| capability | 1 | ASK | 0 | 待排期 | 补产品/设备/legacy 确认。 |
| device | 8 | ASK | 0 | P1 | 补产品/设备/legacy 确认，优先进入采纳批次。 |
| diagnostic | 10 | ASK | 0 | P5 | 补产品/设备/legacy 确认。 |
| display | 6 | ASK | 0 | 待排期 | 补产品/设备/legacy 确认。 |
| file | 2 | ASK | 0 | 待排期 | 补产品/设备/legacy 确认。 |
| firmware | 3 | ASK | 0 | 旁路高覆盖 | 补产品/设备/legacy 确认。 |
| input | 5 | ASK | 0 | 待排期 | 补产品/设备/legacy 确认。 |
| log | 3 | ASK | 0 | 待排期 | 补产品/设备/legacy 确认。 |
| network | 6 | ASK | 0 | 旁路高覆盖 | 补产品/设备/legacy 确认。 |
| output | 1 | ASK | 0 | P2b | 补产品/设备/legacy 确认。 |
| privacy | 3 | ASK | 0 | 待排期 | 补产品/设备/legacy 确认。 |
| room | 5 | ASK | 0 | P7 | 补产品/设备/legacy 确认。 |
| signage | 5 | ASK | 0 | P7 | 补产品/设备/legacy 确认。 |
| storage | 6 | ASK | 0 | 待排期 | 补产品/设备/legacy 确认。 |
| stream | 2 | ASK | 0 | P0 data-plane plumbing | Phase 1 需要通用 STREAM open/data/close 语义支撑 audio/video；具体业务参数仍由 audio/video profile 定义。 |
| system | 5 | ASK | 0 | P1 | 补产品/设备/legacy 确认，优先进入采纳批次。 |
| video | 12 | ASK | 0 | P0 stream | 先补 video stream RPC 控制面和 STREAM 数据面确认；这是 P0 媒体流主线。 |

## 协议采纳/生成优先级

本表用于安排后续从草案到 YAML、再到 generated 产物的顺序。统计依据为 `docs/legacy-migration/classification/legacy-protocol-classification.csv` 和 `docs/legacy-migration/classification/README.md`；当前 `docs/generated/protocol.md` 只有 `audio.algorithm` 已生成，其余业务域大多仍是草案状态。

| 优先级 | 生成批次 | Legacy 覆盖 | 当前状态 | 建议动作 |
|---|---|---:|---|---|
| P1 | `device.*` / `system.*`：[`device.info`](device/device.info.md)、[`device.identity`](device/device.identity.md)、[`device.state`](device/device.state.md)、[`device.childDevice`](device/device.childDevice.md)、[`system.lifecycle`](system/system.lifecycle.md)、[`system.initialization`](system/system.initialization.md)、[`system.time`](system/system.time.md) | 64 条，覆盖 AXDP / Rooms / Signage / VM33 | 草案已存在，未进入 generated | 最先采纳生成。它们是设备识别、状态读取、重启、初始化、时间同步等通用底座，后续业务和工具都依赖这些基础事实。 |
| P2 | [`video.framing`](video/video.framing.md) | 22 条，主要来自 AXDP，少量 VM33 | 草案已存在，未进入 generated | 紧跟 P1 生成。framing mode 是 legacy 高频控制项，也会影响 camera tracking、布局和画面输出的语义边界。 |
| P2b | [`output.layout`](output/output.layout.md) / [`video.layout`](video/video.layout.md) | 28 条，`output.layout` 20 条、`video.layout` 8 条 | 草案已存在，未进入 generated | 原始优先级清单未单列，但 legacy 覆盖高。若近期要做输出画面、拼接、多画面或分屏，建议插在 P2 后、camera 控制前。 |
| P3 | [`camera.focus`](camera/camera.focus.md)、[`camera.zoom`](camera/camera.zoom.md)、[`camera.ptz`](camera/camera.ptz.md) | 20 条，覆盖 AXDP / VM33 | 草案已存在，未进入 generated | 按同一 camera control 批次采纳。focus 和 zoom 命中多，PTZ 条目少但和控制体验强相关，适合一起确认 schema 与状态事件。 |
| P4 | [`camera.image`](camera/camera.image.md)、[`camera.exposure`](camera/camera.exposure.md)、[`camera.calibration`](camera/camera.calibration.md)、[`camera.whiteBalance`](camera/camera.whiteBalance.md) | 12 条直接归类；VM33 Camera 配置另有 whiteBalance 字段线索 | 草案已存在，未进入 generated；`camera.image` 有低置信度拆分问题 | 先补 VM33 Camera 配置字段，再采纳 image/exposure/calibration；whiteBalance 当前分类 CSV 没有直接命中，建议随 camera 配置批次保留，但放在本批次后段确认。 |
| P5 | `diagnostic.*` 产测：[`diagnostic.networkTest`](diagnostic/diagnostic.networkTest.md)、[`diagnostic.manufacturing`](diagnostic/diagnostic.manufacturing.md)、[`diagnostic.selfTest`](diagnostic/diagnostic.selfTest.md)、[`diagnostic.audioTest`](diagnostic/diagnostic.audioTest.md)、[`diagnostic.inputTest`](diagnostic/diagnostic.inputTest.md)、[`diagnostic.storageTest`](diagnostic/diagnostic.storageTest.md)、[`diagnostic.videoTest`](diagnostic/diagnostic.videoTest.md)、[`diagnostic.kvmTest`](diagnostic/diagnostic.kvmTest.md) | 33 条，覆盖 AXDP / Rooms / VM33 | 草案已存在，未进入 generated | 面向工厂和维修闭环，建议在用户侧 camera / video 基础能力之后生成；如果产线接入排期更早，可把 `diagnostic.manufacturing` 与 `diagnostic.networkTest` 提前成 P3b。 |
| P6 | AXTP core / `axtpctl` | 不属于 legacy business 分类；core 已在 `registry/core/**`、`registry/schema/**`、`registry/error/**` 和 generated 中存在 | Core 已生成；`axtpctl` 属于工具/SDK 跟随项 | 不作为普通业务草案插队。每完成一批业务生成后，再让 `axtpctl` 命令、测试向量和 runtime 示例跟随 generated 事实更新。 |
| P7 | `room.*` / `signage.*`：[`room.source`](room/room.source.md)、[`room.layout`](room/room.layout.md)、[`room.schedule`](room/room.schedule.md)、[`room.participant`](room/room.participant.md)、[`signage.playlist`](signage/signage.playlist.md)、[`signage.schedule`](signage/signage.schedule.md)、[`signage.osd`](signage/signage.osd.md)、[`signage.media`](signage/signage.media.md) | 28 条，主要来自 Rooms / Signage / VM33 | 草案已存在，未进入 generated | 放后面生成。它们更偏产品场景和应用层编排；若 Rooms 业务先启动，可单独把 `room.source` 提前，因为它有 11 条 legacy 命中。 |

### 旁路高覆盖候选

以下能力不在本轮主优先级清单里，但 legacy 覆盖量高，排期时不应遗漏：

| 候选能力 | Legacy 覆盖 | 建议 |
|---|---:|---|
| [`network.wifi`](network/network.wifi.md)、[`network.ip`](network/network.ip.md)、[`network.ap`](network/network.ap.md) | 38 条 | 若设备上线、配网或发现流程先行，应作为 P1 后的并行批次。 |
| [`firmware.update`](firmware/firmware.update.md) / [`firmware.updatePolicy`](firmware/firmware.updatePolicy.md) | 22 条 | 跨 AXDP / Rooms / Signage / VM33，适合在基础 device/system 生成后启动采纳。 |
| [`audio.volume`](audio/audio.volume.md)、[`audio.input`](audio/audio.input.md)、[`audio.recording`](audio/audio.recording.md) | 31 条 | `audio.algorithm` 已 generated；这些可作为音频第二批。 |
| [`video.stream`](video/video.stream.md)、[`video.ndi`](video/video.ndi.md)、[`video.rtsp`](video/video.rtsp.md) | 23 条 | 与 framing、camera、layout 相关，建议等 P2/P3 的控制面边界稳定后采纳。 |
