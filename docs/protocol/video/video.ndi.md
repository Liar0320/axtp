# AXTP video.ndi 协议草案

版本：v0.1

归属域：`video`

Capability ID：`video.ndi`

适用范围：NDI 视频输出服务的启用、发现、源名称、输出规格和服务状态。

---

## 协议审核标记（人工复核）

| 标记 | 条目 | 审核结论 | 后续动作 |
|---|---|---|---|
| `[REVIEW-OK]` | `video.ndi` capability | 本文是按 08 taxonomy 创建的单 feature 治理草案。 | 人工确认业务语义、schema 和 legacyRefs 后进入 `registry/domains/video/domain.yaml`。 |
| `[REVIEW-ASK]` | legacy 映射 | legacy 映射需从 `docs/protocol/legacy-classification/` 中按 `target_capability` 筛选后人工确认。 | 落 registry 前补充确定的旧协议命令、字段路径和覆盖状态。 |

---

## 1. 文档定位

`video.ndi` 定义：NDI 视频输出服务的启用、发现、源名称、输出规格和服务状态。

本文只描述 `video.ndi` 这一项 capability。稳定事实必须写入 `registry/domains/video/domain.yaml` 或相关 registry YAML，再由 Generator 生成 `protocol/axtp.protocol.yaml` 与 `docs/generated/*`。

---

## 2. 域边界

负责：

- `video.ndi` 的能力发现、配置、状态、动作或事件。
- 与 `video.ndi` 直接相关的 method/event/schema 草案。
- 已确认 legacy 协议到 `video.ndi` 的语义归类。

不负责：

- NDI 服务配置不等同于 AXTP `video.stream` 数据面，也不归基础 network。
- method/event 数值 ID 分配；数值以 registry/generated 为准。
- 未确认旧协议 payload 的稳定映射。

---

## 3. 候选 Methods / Events

| 类型 | 名称 | 说明 |
|---|---|---|
| method | `video.getNdiCapabilities` | 查询 NDI 服务能力。 |
| method | `video.setNdiConfig` | 设置 NDI 服务配置。 |
| method | `video.getNdiConfig` | 查询 NDI 服务配置。 |
| method | `video.resetNdiConfig` | 恢复 NDI 默认配置。 |
| event | `video.ndiConfigChanged` | NDI 配置变化。 |
| event | `video.ndiStateChanged` | NDI 运行状态变化。 |

候选名称用于评审和 registry 草案输入。采纳时必须按 08 的配置型、状态型、动作型、流型或导出型模板复核。

---

## 4. Legacy 待映射

| 来源 | 旧协议条目 | 候选映射 | 状态 |
|---|---|---|---|
| AXDP / Rooms / VM33 / Signage | 待从 `docs/protocol/legacy-classification/` 筛选 | `video.ndi` | `[REVIEW-ASK]` |

---

## 5. Registry 草案输入

```yaml
capabilities:
  - id: video.ndi
    name: video.ndi capability
    status: draft
    methods:
      - video.getNdiCapabilities
      - video.setNdiConfig
      - video.getNdiConfig
      - video.resetNdiConfig
    events:
      - video.ndiConfigChanged
      - video.ndiStateChanged
```

---

## 6. 后续确认

1. 确认 `video.ndi` 的 MVP 范围和可选能力。
2. 确认 method/event 是否复用已有 registry 条目或新增 draft 条目。
3. 确认 schema 字段、错误码、权限和状态枚举。
4. 确认 legacyRefs 覆盖范围后再写入 YAML。
