# AXTP output.layout 协议草案

版本：v0.1

归属域：`output`

Capability ID：`output.layout`

适用范围：设备输出端的画面布局、幕墙/拼接/画中画输出模式、输出画布上的窗口排列。

---

## 协议审核标记（人工复核）

| 标记 | 条目 | 审核结论 | 后续动作 |
|---|---|---|---|
| `[REVIEW-DRAFT]` | `output.layout` capability | 08/09/10/11/13 已有 output 域和 layout 能力规划，当前缺少 `docs/protocol/output/output.layout.md` 草案。 | 产品/架构/研发确认业务语义、schema 和 legacyRefs 后进入采纳 workflow。 |
| `[REVIEW-OK]` | domain-feature | 输出画面布局归 `output.layout`；它描述输出端画布布局，不替代 `video.layout`、`room.layout` 或 `display.output`。 | 采纳时反向确认 08/09 的边界说明是否需要补充。 |
| `[REVIEW-DRAFT]` | `output.getLayoutConfig` / `output.setLayoutConfig` / `output.layoutChanged` | 10/11 已规划对应 method/event 名称和 ID 范围，但 YAML 尚未采纳。 | 采纳时写入 `registry/domains/output/domain.yaml`，并重新生成。 |
| `[REVIEW-ASK]` | legacy 映射 | Rooms / VM33 中有多条输出布局、幕墙和输出模式相关旧接口已分类到 `output.layout`，但 payload 字段和状态映射仍需确认。 | 落 registry 前补齐确定的旧协议命令、字段路径、状态码和覆盖范围。 |

---

## 1. 文档定位

本文是 `docs/protocol` 评审输入，不是最终协议事实源。采纳后，稳定事实必须反向确认到 `docs/specs/08-13`，再写入 `registry/domains/output/domain.yaml` 或相关 registry YAML，并由 Generator 生成 `protocol/axtp.protocol.yaml` 和 `docs/generated/*`。

当前实现程度：

| 项 | 状态 | 证据 |
|---|---|---|
| 协议草案 | Not drafted -> 本文新增 | 此前没有 `docs/protocol/output/output.layout.md` |
| Specs 规划 | Planned | 09 分配 `output` 域；10 规划 `output.getLayoutConfig` / `output.setLayoutConfig`；11 规划 `output.layoutChanged`；13 规划 `output.layout` capability |
| YAML 事实 | Not adopted | 未在 `registry/**` 或 `registry/domains/**` 中发现 `output.layout` |
| Generated | Not generated | 未在 `protocol/axtp.protocol.yaml` 或 `docs/generated/protocol.md` 中发现 `output.layout` |

---

## 2. 业务需求

| 项 | 内容 |
|---|---|
| 需求来源 | “添加一个控制设备输出画面布局的协议” |
| 目标用户 | App / Host / Cloud 控制端 |
| 目标设备 | 具备一个或多个物理/逻辑输出端的设备，例如 HDMI/Type-C 输出、幕墙、拼接输出或 BYOM 输出 |
| 目标行为 | 控制端查询或设置输出端画布上的窗口布局、输出模式、拼接/画中画参数，并接收布局变化事件 |

---

## 3. Domain 边界

`output.layout` 定义设备输出端的“画布布局”：哪些输出端使用什么布局模式、画布尺寸如何描述、窗口在输出画布中的位置和层级如何排列。

负责：

- 输出端 layout 能力发现、当前配置查询、配置设置和变化事件。
- 幕墙、拼接、画中画、单画面、多窗口等输出端布局模式。
- 输出画布坐标、窗口矩形、层级、缩放策略和应用策略。
- 已确认 legacy 协议到 `output.layout` 的语义归类。

不负责：

- 视频内容构图、自动取景、多路视频混合模板；这些归 `video.layout` / `video.framing`。
- 会议室场景、协作空间场景编排；这些归 `room.layout` / `room.scene`。
- 显示输出端口状态、端口启停、分辨率或链路状态；这些归 `display.output` 或 `output.source`。
- 输入到输出的源选择和路由关系；这些归 `output.source` / `output.routing`，本文只引用 source/routing 标识。
- 连续视频/音频数据传输；数据面仍由对应业务域通过 RPC 建流并绑定 STREAM。

---

## 4. 协议决策

| 决策点 | 结论 | 理由 |
|---|---|---|
| 新增/修改/复用 | Create `output.layout` 草案 | `video.layout`、`room.layout`、`display.output` 已存在，但没有覆盖输出端幕墙/拼接/输出模式这一能力块。 |
| 控制面 | RPC method/event | 布局配置是业务控制面，不进入 Frame Header。 |
| 数据面 | None | 本文只设置布局参数；连续媒体数据不由本文承载。 |
| WebSocket | RPC-only | WebSocket Unframed JSON 可承载 JSON RPC 调用，但不承载 STREAM。 |
| Numeric ID | 使用 specs 规划值作为采纳参考 | 最终实现事实以 YAML/generated 为准，采纳时需反向确认 10/11/13。 |

---

## 5. 候选 Capability

| Capability | 状态 | 说明 |
|---|---|---|
| `output.layout` | draft | 输出端画面布局能力，覆盖幕墙、拼接、画中画、单画面、多窗口输出模式。 |

Capability 字段建议：

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `supportedModes` | array<OutputLayoutMode> | yes | 支持的布局模式集合。 | `[REVIEW-DRAFT]` |
| `maxWindows` | uint16 | yes | 单个 layout 中可配置的最大窗口数量。 | `[REVIEW-DRAFT]` |
| `maxOutputs` | uint16 | yes | 单次 layout 配置可影响的最大输出端数量。 | `[REVIEW-DRAFT]` |
| `supportsAtomicApply` | bool | yes | 是否支持原子应用布局配置。 | `[REVIEW-DRAFT]` |
| `supportsPreview` | bool | no | 是否支持先预览后应用。 | `[REVIEW-ASK]` |

---

## 6. 候选 Methods

| Method | Specs 规划 | Params Schema | Result Schema | 说明 | Review |
|---|---|---|---|---|---|
| `output.getLayoutConfig` | `0x0B05` | `OutputLayoutGetParams` | `OutputLayoutConfigResult` | 查询一个或多个输出端的当前布局配置。 | `[REVIEW-DRAFT]` |
| `output.setLayoutConfig` | `0x0B06` | `OutputLayoutSetParams` | `OutputLayoutSetResult` | 设置输出端布局配置，可选择立即应用或暂存。 | `[REVIEW-DRAFT]` |
| `output.getLayoutCapabilities` | TBD after adoption | `OutputLayoutCapabilitiesParams` | `OutputLayoutCapabilities` | 查询布局能力范围；10 当前未规划该 method，采纳时需决定是否新增，或由 capability 查询统一覆盖。 | `[REVIEW-ASK]` |

候选名称用于评审和 registry 草案输入。采纳时必须按 08 的配置型、状态型、动作型、流型或导出型模板复核。

---

## 7. 候选 Events

| Event | Specs 规划 | Schema | 触发时机 | Review |
|---|---|---|---|---|
| `output.layoutChanged` | `0x0B03` | `OutputLayoutChangedEvent` | 当前输出布局被本协议、设备本地操作、旧协议 adapter 或自动策略改变。 | `[REVIEW-DRAFT]` |

---

## 8. 候选 Schemas

### `OutputLayoutMode`

| Value | 说明 | Review |
|---|---|---|
| `single` | 单输出单画面。 | `[REVIEW-DRAFT]` |
| `pip` | 画中画输出布局。 | `[REVIEW-DRAFT]` |
| `split` | 分屏布局。 | `[REVIEW-DRAFT]` |
| `wall` | 幕墙/拼接布局。 | `[REVIEW-DRAFT]` |
| `custom` | 自定义窗口矩形布局。 | `[REVIEW-DRAFT]` |

### `OutputLayoutGetParams`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `outputIds` | array<string> | no | 需要查询的输出端 ID；为空表示查询默认输出端或全部可见输出端。 | `[REVIEW-DRAFT]` |
| `includeCapabilities` | bool | no | 是否在结果中带回能力摘要。 | `[REVIEW-ASK]` |

### `OutputLayoutCapabilitiesParams`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `outputIds` | array<string> | no | 需要查询能力的输出端 ID；为空表示查询默认输出端或全部可见输出端。 | `[REVIEW-ASK]` |

### `OutputLayoutCapabilities`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `supportedModes` | array<OutputLayoutMode> | yes | 支持的布局模式集合。 | `[REVIEW-DRAFT]` |
| `maxWindows` | uint16 | yes | 单个 layout 中可配置的最大窗口数量。 | `[REVIEW-DRAFT]` |
| `maxOutputs` | uint16 | yes | 单次 layout 配置可影响的最大输出端数量。 | `[REVIEW-DRAFT]` |
| `supportsAtomicApply` | bool | yes | 是否支持原子应用布局配置。 | `[REVIEW-DRAFT]` |
| `supportsPreview` | bool | no | 是否支持先预览后应用。 | `[REVIEW-ASK]` |

### `OutputLayoutSetParams`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `layout` | OutputLayoutConfig | yes | 目标布局配置。 | `[REVIEW-DRAFT]` |
| `applyPolicy` | OutputLayoutApplyPolicy | no | 应用策略，默认 `immediate`。 | `[REVIEW-DRAFT]` |
| `expectedRevision` | uint32 | no | 乐观并发版本号；不匹配时返回冲突错误。 | `[REVIEW-DRAFT]` |

### `OutputLayoutConfig`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `layoutId` | string | no | 控制端或设备生成的布局标识。 | `[REVIEW-DRAFT]` |
| `revision` | uint32 | no | 设备维护的布局版本。 | `[REVIEW-DRAFT]` |
| `mode` | OutputLayoutMode | yes | 输出布局模式。 | `[REVIEW-DRAFT]` |
| `outputs` | array<OutputTargetRef> | yes | 该布局作用的输出端集合。 | `[REVIEW-DRAFT]` |
| `canvas` | OutputCanvas | yes | 输出画布坐标系。 | `[REVIEW-DRAFT]` |
| `windows` | array<OutputLayoutWindow> | yes | 输出画布上的窗口集合。 | `[REVIEW-DRAFT]` |

### `OutputTargetRef`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `outputId` | string | yes | 物理或逻辑输出端 ID。 | `[REVIEW-DRAFT]` |
| `connector` | string | no | HDMI / Type-C / virtual / wall 等连接器或输出类型提示。 | `[REVIEW-ASK]` |

### `OutputCanvas`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `width` | uint32 | yes | 输出画布宽度，单位由 `unit` 决定。 | `[REVIEW-DRAFT]` |
| `height` | uint32 | yes | 输出画布高度，单位由 `unit` 决定。 | `[REVIEW-DRAFT]` |
| `unit` | enum | yes | `pixel` 或 `normalized10000`。 | `[REVIEW-DRAFT]` |

### `OutputLayoutWindow`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `windowId` | string | yes | 布局内窗口 ID。 | `[REVIEW-DRAFT]` |
| `sourceRef` | string | no | 引用 `output.source` / `output.routing` 已定义的源或路由标识；本文不定义源本身。 | `[REVIEW-DRAFT]` |
| `rect` | Rect | yes | 窗口在 canvas 中的位置和尺寸。 | `[REVIEW-DRAFT]` |
| `zOrder` | uint16 | no | 层级，数值越大越靠前。 | `[REVIEW-DRAFT]` |
| `scaleMode` | enum | no | `fit` / `fill` / `stretch` / `crop`。 | `[REVIEW-DRAFT]` |
| `visible` | bool | no | 是否显示该窗口，默认 true。 | `[REVIEW-DRAFT]` |

### `Rect`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `x` | int32 | yes | 左上角 X。 | `[REVIEW-DRAFT]` |
| `y` | int32 | yes | 左上角 Y。 | `[REVIEW-DRAFT]` |
| `width` | uint32 | yes | 宽度。 | `[REVIEW-DRAFT]` |
| `height` | uint32 | yes | 高度。 | `[REVIEW-DRAFT]` |

### `OutputLayoutApplyPolicy`

| Value | 说明 | Review |
|---|---|---|
| `immediate` | 立即应用。 | `[REVIEW-DRAFT]` |
| `staged` | 暂存，不立即切换。 | `[REVIEW-ASK]` |
| `atomic` | 原子切换，失败则保持旧布局。 | `[REVIEW-DRAFT]` |

### `OutputLayoutConfigResult`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `layouts` | array<OutputLayoutConfig> | yes | 查询到的布局配置。 | `[REVIEW-DRAFT]` |
| `capabilities` | OutputLayoutCapabilities | no | 可选能力摘要。 | `[REVIEW-ASK]` |

### `OutputLayoutSetResult`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `layoutId` | string | no | 已应用或暂存的布局 ID。 | `[REVIEW-DRAFT]` |
| `revision` | uint32 | yes | 应用后的布局版本。 | `[REVIEW-DRAFT]` |
| `applied` | bool | yes | 是否已立即应用。 | `[REVIEW-DRAFT]` |

### `OutputLayoutChangedEvent`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `outputIds` | array<string> | yes | 发生布局变化的输出端。 | `[REVIEW-DRAFT]` |
| `layoutId` | string | no | 当前布局 ID。 | `[REVIEW-DRAFT]` |
| `revision` | uint32 | yes | 变化后的布局版本。 | `[REVIEW-DRAFT]` |
| `reason` | enum | no | `rpc` / `local` / `legacyAdapter` / `autoPolicy`。 | `[REVIEW-DRAFT]` |

---

## 9. 候选 Errors

| Error | 类别 | 说明 | Review |
|---|---|---|---|
| `OUTPUT_LAYOUT_UNSUPPORTED` | business | 设备不支持请求的布局模式、窗口数量、输出端组合或缩放策略。 | `[REVIEW-DRAFT]` |
| `OUTPUT_LAYOUT_CONFLICT` | business | `expectedRevision` 与当前布局版本不一致，或布局与当前路由/输出状态冲突。 | `[REVIEW-DRAFT]` |
| `OUTPUT_LAYOUT_RESOURCE_LIMIT` | business | 超过设备窗口、画布、拼接或硬件合成资源限制。 | `[REVIEW-DRAFT]` |
| `OUTPUT_TARGET_NOT_FOUND` | business | 指定的 `outputId` 不存在或当前不可用。 | `[REVIEW-DRAFT]` |

普通参数错误仍优先复用 RPC 通用错误。采纳时需反向确认 12 中 `0x0B00-0x0BFF` Output 错误范围。

---

## 10. Legacy 待映射

`docs/protocol/legacy-classification/output.md` 已将多条 Rooms / VM33 输出布局类旧接口分类到 `output.layout`，但当前清单缺少稳定 payload 字段映射和状态码映射，采纳前不得直接写入 registry legacy mapping。

| 来源 | 旧协议条目 | 候选映射 | 状态 | 说明 |
|---|---|---|---|---|
| Rooms | `GetSceneOutConfig` | `output.getLayoutConfig` | `[REVIEW-ASK]` | 需要确认返回字段是否描述输出画布/窗口布局，还是房间场景配置。 |
| Rooms | `SetWorkSceneOutPlayMode` / `GetWorkSceneOutPlayMode` | `output.setLayoutConfig` / `output.getLayoutConfig` | `[REVIEW-ASK]` | 需要确认 playMode 枚举与 `OutputLayoutMode` 的映射。 |
| Rooms | `SetHdmiOutPlayMode` / `GetHdmiOutPlayMode` | `output.setLayoutConfig` / `output.getLayoutConfig` | `[REVIEW-ASK]` | 需要确认 HDMI 输出 ID、模式枚举和错误返回。 |
| Rooms | `SetTypecOutPlayMode` / `GetTypecOutPlayMode` | `output.setLayoutConfig` / `output.getLayoutConfig` | `[REVIEW-ASK]` | 需要确认 Type-C 输出是否与 HDMI 使用同一 schema。 |
| Rooms | `SetByomOutPlayMode` / `GetByomOutPlayMode` | `output.setLayoutConfig` / `output.getLayoutConfig` | `[REVIEW-ASK]` | 需要确认 BYOM 输出是否为独立 outputId。 |
| VM33 | `Curtain.SetCurtainLayout` / `Curtain.GetCurtainLayout` | `output.setLayoutConfig` / `output.getLayoutConfig` | `[REVIEW-ASK]` | 需要确认幕墙行列、窗口矩形和拼接策略字段。 |
| VM33 | `Curtain.SetPlayStream` / `Curtain.SetPlayStrategy` | `output.setLayoutConfig` | `[REVIEW-ASK]` | 需要拆分 layout 与 source/routing 语义，避免把路由写进 layout。 |
| VM33 | `Curtain.GetOutputInterface` | `output.getLayoutConfig` 或 `output.source` | `[REVIEW-ASK]` | 名称更像输出接口能力，可能应归 `output.source`，需复核。 |

---

## 11. Registry 草案输入

采纳本文后，domain YAML 至少应包含以下事实。数值以 10/11/13 反向确认后的 YAML 为准：

```yaml
capabilities:
  - name: output.layout
    status: draft
    methods:
      - output.getLayoutConfig
      - output.setLayoutConfig
    events:
      - output.layoutChanged

methods:
  - name: output.getLayoutConfig
    id: 0x0B05 # planned in specs, confirm during adoption
    bitOffset: TBD after adoption
    requestSchema: OutputLayoutGetParams
    responseSchema: OutputLayoutConfigResult
    capabilities:
      - output.layout

  - name: output.setLayoutConfig
    id: 0x0B06 # planned in specs, confirm during adoption
    bitOffset: TBD after adoption
    requestSchema: OutputLayoutSetParams
    responseSchema: OutputLayoutSetResult
    capabilities:
      - output.layout

events:
  - name: output.layoutChanged
    id: 0x0B03 # planned in specs, confirm during adoption
    bitOffset: TBD after adoption
    eventSchema: OutputLayoutChangedEvent
    capabilities:
      - output.layout
```

---

## 12. 采纳检查清单

- [ ] 08 已确认 `output.layout` 与 `video.layout` / `room.layout` / `display.output` 的边界。
- [ ] 09 已确认 `output` DomainId、ID range 和生成链路。
- [ ] 10 已确认 `output.getLayoutConfig` / `output.setLayoutConfig` 的 methodId、bitOffset、request/response schema。
- [ ] 11 已确认 `output.layoutChanged` 的 eventId、eventMasks bitOffset 和 event schema。
- [ ] 12 已确认 Output 错误码是否新增，以及是否复用通用 RPC 错误。
- [ ] 13 已确认 `output.layout` capabilityId、schema fieldId 和 supportedMethods。
- [ ] legacy 映射已从 Rooms / VM33 旧接口中筛出确定 payload、状态码和字段路径。
- [ ] YAML 写入后 Generator 能完整生成 `protocol/axtp.protocol.yaml` 和 `docs/generated/*`。

---

## 13. 待确认问题

1. `output.getLayoutCapabilities` 是否需要成为正式 method，还是通过 `capability.supportedMethods` 和 `output.getLayoutConfig(includeCapabilities=true)` 覆盖？
2. `OutputCanvas.unit` 是否使用 pixel、normalized10000，还是允许二者都支持？
3. `sourceRef` 应引用 `output.source` 还是 `output.routing` 的对象 ID？是否需要统一命名为 `routeId`？
4. Rooms 的 SceneOutConfig 与 room scene 是否存在重叠？哪些字段应留在 `room.layout`，哪些归 `output.layout`？
5. VM33 Curtain 类旧接口中哪些是 layout，哪些是 source/routing/interface？采纳前需要逐条确认。
6. 是否需要 staged/preview/atomic apply 三种应用策略，还是 MVP 只保留 immediate？
