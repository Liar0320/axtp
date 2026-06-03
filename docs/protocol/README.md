# AXTP Business Protocol Intake

`docs/business/` 是业务协议 intake 与评审区，不是最终协议事实源。

业务文档用于沉淀需求、交互流程、字段候选、旧协议线索和评审结论。只有被采纳并写入 `registry/` 或 `registry/domains/<domain>/domain.yaml` 的内容，才进入正式生成路径。

## 生成路径

```text
业务需求或旧协议材料
        ↓
docs/protocol/<domain>/<domain.feature>.md 评审与归类
        ↓
registry/domains/<domain>/domain.yaml
        ↓
protocol/axtp.protocol.yaml
        ↓
docs/generated/*、tooling/*、runtimes/*/generated/*
```

## 使用规则

- 新增业务必须先按 08《AXTP Capability Naming and Feature Taxonomy》确定 `domain.feature`。
- 业务 method、event、error、capability、schema、profile 的稳定事实必须写入 YAML。
- `docs/protocol/<domain>` 中的 method/event wire name 可以作为评审输入；采纳前不得视为当前协议合同。
- 未进入 migration approved 状态的旧协议材料，应先在本目录或交互式 skill 中完成 domain-feature 分类和待确认问题整理。
- 不得从本目录直接生成 `protocol/axtp.protocol.yaml`；必须经过 registry YAML 与 Generator。

## 采纳检查

采纳一份业务文档前必须确认：

- capability ID 使用 `domain.feature`，不使用字段级 `Config / State / Scan / Connection` 作为 feature。
- method/event 命名符合配置型、状态型、动作型、流型或导出型模板。
- 新增 ID、`bitOffset` 和 schema fieldId 不与现有 YAML 冲突。
- 旧协议适配只登记确定的 legacy CmdValue、状态码和 payload 映射；未知项保留为待确认问题。
- 运行 Generator 后，`protocol/axtp.protocol.yaml` 与 `docs/generated/*` 能完整反映采纳结果。

## 协议审核标记

`docs/protocol/<domain>/<domain.feature>.md` 直接使用以下标记进行人工审核：

- `[REVIEW-OK]`：命名、归属和接口方向符合 08/09，可进入人工确认或 registry 草案。
- `[REVIEW-FIX]`：进入 registry 前必须修正文档、方法清单、错误策略、schema 或生成路径描述。
- `[REVIEW-ASK]`：需要产品、设备实现或 legacy 行为确认后才能写入 `legacyRefs` 或 YAML。
- `[REVIEW-BLOCKER]`：当前文档定位会误导新协议生成，必须先重写或拆分。


## 优先实现的协议文档

video/video.framing.md
video/video.stream.md
video/video.ndi.md
video/video.rtsp.md
network/network.wifi.md
network/network.ap.md
network/network.ip.md
firmware/firmware.ota.md
camera/camera.focus.md
audio/audio.recording.md
