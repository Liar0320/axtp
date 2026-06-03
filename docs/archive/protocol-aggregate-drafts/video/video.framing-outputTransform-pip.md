# AXTP Video Framing / Composition 协议

本文定义 AXTP 中视频构图、追踪、输出变换与画中画相关控制面。本文是进入 `registry/domains/video/domain.yaml` 前的协议草案输入；正式 wire 合同以 registry YAML 与生成物为准。

## 协议审核处理结果

| 标记 | 对象 | 处理结论 | 后续动作 |
|---|---|---|---|
| `[REVIEW-OK]` | `video.framing` / `video.outputTransform` / `video.pip` | 采纳。画面构图、输出变换、PIP 均归 `video` 域；`framingMode` / `framingConfig` 只作为 method 或 schema noun。 | 作为 video domain YAML 草案输入。 |
| `[REVIEW-OK]` | `video.setFramingMode` / `video.setFramingConfig` / `video.setOutputTransform` / `video.setPipConfig` | 采纳。模式选择、模式参数、通用输出变换、PIP 配置分离。 | 本文补齐 schema、事件、错误与 legacy 映射。 |
| `[REVIEW-FIX]` | AXDP 追踪策略映射 | 已修正。`CommonSet/GetSpeakerTrackDelay`、`CommonSet/GetHorTrackingStrategy`、`CommonSet/GetVerTrackingStrategy` 不映射到 `video.setFramingMode`，改为 `video.setFramingConfig` 的 `speakerTracking.delayMs` 与 `trackingPolicy.*Strategy`。 | 更新 registry legacyRefs 时按本文映射执行。 |
| `[REVIEW-ASK]` | AXDP 构图与追踪命令 | 本文已将 `CommonGetPeopleNumber` 收敛到运行态 `video.getFramingState.peopleCount`，将 region/startup/strategy 收敛到 config。旧值枚举仍需设备确认。 | 未确认枚举不得写入强 legacy value mapping。 |
| `[REVIEW-ASK]` | AXDP 输出变换命令 | `CommonSet/GetMirrorState`、`CommonSet/GetFlipState` 归 `video.outputTransform.mirrorMode`；`CommonSet/GetVerticalScreenMode` 暂归 `video.outputTransform.orientation` / `rotation` / `aspectRatio` 候选映射。 | 确认垂直屏是旋转输出、裁切比例，还是算法构图预设。 |
| `[REVIEW-ASK]` | AXDP `CommonSet/GetAllChannelScanState` / `CommonSet/GetFrameRateSwitch` | 不进入 v1 `video.framing` 正式方法。前者可能是多摄通道扫描或取景源选择，后者更像 `video.stream` / encoder profile。 | 产品和设备行为确认后迁入 `video.stream`、`video.encoder` 或独立 multi-camera feature。 |

## 1. 范围与边界

### 1.1 Domain 归属

```text
video.framing
video.outputTransform
video.pip
```

`video.framing` 控制最终视频画面的取景、追踪、分屏和区域构图。它不控制传感器采集参数，也不控制本机屏幕显示参数。

`video.outputTransform` 控制构图完成后的通用输出变换，例如镜像、翻转、旋转、横竖屏、输出比例和缩放策略。

`video.pip` 控制 picture-in-picture 的主画面、小窗来源、位置、尺寸和叠放规则。`picture_in_picture` 可以作为一种 `framingMode`，但 PIP 的窗口结构不放入普通 `framingConfig`。

### 1.2 与其他域的边界

| Domain | 负责内容 | 不负责内容 |
|---|---|---|
| `camera` | 采集侧参数，例如 zoom、focus、exposure、whiteBalance、fieldOfView、传感器视角。 | 最终输出画面的追踪、裁切、分屏和 PIP。 |
| `video.framing` | 构图算法选择、自动取景、说话人追踪、智能追踪、分屏、区域追踪、运行态。 | 编码器参数、RTSP/NDI 服务、基础网络配置。 |
| `video.outputTransform` | 输出镜像、翻转、旋转、横竖屏、比例和缩放。 | OSD 镜像、水印和显示器 UI 镜像。 |
| `video.pip` | PIP 主画面、小窗和位置。 | 通用多画面 mixer 或复杂场景编排；复杂 mixer 可另归 `video.layout` / `video.scene`。 |
| `audio` | DOA、beam、VAD、声源定位状态和音频算法配置。 | 说话人追踪的画面切换策略。speaker tracking 可以消费 audio 结果，但配置仍归 video。 |
| `video.stream` | AXTP 视频业务流的创建、关闭、编码和传输状态。 | 取景算法和输出画面变换。 |

### 1.3 处理顺序

推荐设备内部处理顺序如下：

```text
camera capture
  -> camera image controls
  -> video.framing
  -> video.pip / simple composition
  -> video.outputTransform
  -> video.stream / RTSP / NDI / USB / HDMI output
```

坐标类字段默认描述 `video.framing` 后、`video.outputTransform` 前的画面坐标空间。若设备只能在 transform 后返回坐标，必须在能力中声明 `coordinateSpace`。

## 2. 命名和公共规则

### 2.1 命名规则

| 对象 | 规则 | 示例 |
|---|---|---|
| method / event | `domain.verbNoun` / `domain.nounChanged` | `video.setFramingMode` |
| JSON 字段 | lowerCamelCase | `speakerTracking.delayMs` |
| enum value | snake_case | `speaker_tracking` |
| capability | `domain.feature` | `video.framing` |

`framingMode`、`framingConfig`、`pipConfig`、`outputTransform` 是 schema 或 method 语义，不作为 capability ID。

### 2.2 坐标规则

除非能力中另行声明，矩形坐标使用 normalized 坐标：

```json
{
  "x": 0.25,
  "y": 0.2,
  "width": 0.5,
  "height": 0.6,
  "unit": "normalized"
}
```

规则：

- `x` / `y` 表示左上角。
- `width` / `height` 必须大于 0。
- normalized 值范围为 `0.0` 到 `1.0`。
- `x + width`、`y + height` 不得超过 `1.0`，除非设备声明支持越界裁切。

### 2.3 应用和持久化

配置型方法支持以下公共控制字段：

| 字段 | 类型 | 默认值 | 说明 |
|---|---|---:|---|
| `applyMode` | enum | `immediate` | `immediate` 立即应用，`on_next_frame` 下一帧边界应用，`deferred` 只保存不立即切换。 |
| `persist` | bool | `true` | 是否写入持久配置。设备不支持持久化时必须在能力中声明。 |
| `expectedConfigVersion` | uint32 | 省略 | 乐观并发控制。若版本不匹配，返回 `INVALID_STATE` 或 `RPC_PARAM_INVALID`。 |

响应中的 `state` 使用以下枚举：

```text
applied
pending
unchanged
```

请求无法应用时应返回错误，不应返回 `state=rejected`。

### 2.4 事件 reason

配置或状态变化事件的 `reason` 推荐使用：

```text
user_request
local_control
preset_loaded
scene_loaded
auto_policy
capability_changed
device_restore
fallback
error_recovery
```

## 3. Capability 与方法总览

### 3.1 Capability 注册

| capabilityId | name | 类型 | 状态 | 说明 |
|---:|---|---|---|---|
| `0x0801` | `video.framing` | object | draft | 构图、自动取景、追踪、分屏与运行态。 |
| `0x0802` | `video.outputTransform` | object | draft | 输出镜像、翻转、旋转、横竖屏、比例和缩放。 |
| `0x0803` | `video.pip` | object | draft | PIP 主画面、小窗和位置。 |

### 3.2 方法清单

| 方法 | Capability | 说明 | MVP |
|---|---|---|---|
| `video.getFramingCapabilities` | `video.framing`, `video.outputTransform`, `video.pip` | 查询构图、输出变换和 PIP 能力。 | 是 |
| `video.setFramingMode` | `video.framing` | 设置当前构图模式。 | 是 |
| `video.getFramingMode` | `video.framing` | 查询当前构图模式。 | 是 |
| `video.setFramingConfig` | `video.framing` | 设置构图模式参数与通用 tracking policy。 | 是 |
| `video.getFramingConfig` | `video.framing` | 查询构图配置。 | 是 |
| `video.resetFramingConfig` | `video.framing` | 恢复构图配置默认值。 | 可选 |
| `video.getFramingState` | `video.framing` | 查询运行态，例如人数、活跃目标、追踪状态。 | 是 |
| `video.setOutputTransform` | `video.outputTransform` | 设置通用输出变换。 | 是 |
| `video.getOutputTransform` | `video.outputTransform` | 查询通用输出变换。 | 是 |
| `video.resetOutputTransform` | `video.outputTransform` | 恢复输出变换默认值。 | 可选 |
| `video.setPipConfig` | `video.pip` | 设置 PIP 配置。 | 二阶段 |
| `video.getPipConfig` | `video.pip` | 查询 PIP 配置。 | 二阶段 |
| `video.resetPipConfig` | `video.pip` | 恢复 PIP 默认值。 | 可选 |

### 3.3 事件清单

| 事件 | Capability | 触发条件 | MVP |
|---|---|---|---|
| `video.framingModeChanged` | `video.framing` | 构图模式变化。 | 是 |
| `video.framingConfigChanged` | `video.framing` | 构图配置变化。 | 是 |
| `video.framingStateChanged` | `video.framing` | 人数、活跃目标、追踪状态等运行态变化。 | 是 |
| `video.outputTransformChanged` | `video.outputTransform` | 输出变换变化。 | 是 |
| `video.pipConfigChanged` | `video.pip` | PIP 配置变化。 | 二阶段 |

## 4. FramingMode

### 4.1 枚举

| 值 | 说明 |
|---|---|
| `manual` | 手动构图，不启用自动追踪或自动裁切。 |
| `auto_framing` | 自动取景，将人物或主体放入画面。 |
| `panoramic` | 全景或宽画幅模式。 |
| `smart_tracking` | 智能追踪，通常根据人形、脸、身体或目标检测进行跟踪。 |
| `speaker_tracking` | 说话人追踪，通常由 audio DOA、beam 或 VAD 结果驱动画面切换。 |
| `split_screen` | 分屏构图，根据人物或目标将画面分成多个区域。 |
| `region_tracking` | 区域追踪，跟踪指定区域内目标。 |
| `picture_in_picture` | 画中画模式，主画面加一个或多个小窗。 |
| `custom` | 厂商或项目自定义模式。必须配合 `customModeId` 或 vendor extension 使用。 |

MVP 推荐至少支持：

```text
manual
auto_framing
speaker_tracking
split_screen
```

`picture_in_picture` 可在 PIP 二阶段加入。

## 5. video.getFramingCapabilities

### 5.1 请求

```json
{
  "method": "video.getFramingCapabilities",
  "params": {}
}
```

### 5.2 返回

```json
{
  "result": {
    "framing": {
      "supported": true,
      "modes": [
        "manual",
        "auto_framing",
        "panoramic",
        "smart_tracking",
        "speaker_tracking",
        "split_screen",
        "region_tracking",
        "picture_in_picture"
      ],
      "defaultMode": "auto_framing",
      "coordinateUnits": ["normalized"],
      "coordinateSpace": "pre_output_transform",
      "supportsPartialConfigUpdate": true,
      "supportsState": true,
      "supportsPersistence": true,
      "modeCapabilities": {
        "auto_framing": {
          "targets": ["people", "face", "body", "active_speaker"],
          "marginRatio": { "min": 0.0, "max": 0.5, "step": 0.01, "defaultValue": 0.12 },
          "transitionSpeeds": ["slow", "normal", "fast"]
        },
        "speaker_tracking": {
          "delayMs": { "min": 0, "max": 5000, "step": 100, "defaultValue": 800 },
          "holdMs": { "min": 0, "max": 10000, "step": 100, "defaultValue": 1500 },
          "fallbackModes": ["manual", "auto_framing", "panoramic"]
        },
        "split_screen": {
          "maxSplitCount": { "min": 2, "max": 8, "step": 1, "defaultValue": 4 },
          "layouts": ["auto", "grid", "horizontal", "vertical"],
          "supportsFixedSplitCount": true
        },
        "region_tracking": {
          "maxRegions": 4,
          "coordinateUnits": ["normalized"]
        }
      },
      "trackingPolicy": {
        "horizontalStrategies": ["auto", "center_priority", "smooth", "lock"],
        "verticalStrategies": ["auto", "face_priority", "body_priority", "smooth", "lock"],
        "noTargetStrategies": ["keep_last", "wide", "startup_position", "manual"]
      }
    },
    "outputTransform": {
      "supported": true,
      "mirrorModes": ["none", "flip_horizontal", "flip_vertical", "flip_both"],
      "rotations": [0, 90, 180, 270],
      "orientations": ["landscape", "portrait", "auto"],
      "aspectRatios": ["auto", "16:9", "4:3", "1:1", "9:16", "custom"],
      "scaleModes": ["fit", "fill", "crop", "stretch"],
      "supportsCustomCrop": true
    },
    "pip": {
      "supported": true,
      "maxOverlayWindows": 2,
      "sources": ["main_camera", "secondary_camera", "content", "hdmi", "screen_share"],
      "positions": ["top_left", "top_right", "bottom_left", "bottom_right", "custom"],
      "sizeRatio": { "min": 0.1, "max": 0.5, "step": 0.05, "defaultValue": 0.25 }
    }
  }
}
```

### 5.3 说明

`video.getFramingCapabilities` 返回三类信息：

- 支持哪些 `framingMode`。
- 每种 mode 支持哪些专属配置字段和范围。
- 通用 `outputTransform` 与 `pip` 的能力范围。

设备不支持 PIP 时仍可返回 `pip.supported=false`，调用方据此隐藏 PIP 方法。

## 6. Framing Mode 方法

### 6.1 video.setFramingMode

```json
{
  "method": "video.setFramingMode",
  "params": {
    "mode": "speaker_tracking",
    "applyMode": "immediate",
    "persist": true
  }
}
```

响应：

```json
{
  "result": {
    "mode": "speaker_tracking",
    "state": "applied",
    "configVersion": 12,
    "requiresRestart": false
  }
}
```

规则：

- `mode` 必须出现在 `framing.modes` 能力中。
- `mode=custom` 时必须提供 `customModeId` 或 vendor extension。
- `mode=picture_in_picture` 要求 `video.pip` capability 可用；窗口参数通过 `video.setPipConfig` 设置。
- 切换 mode 不应清空其他 mode 的已保存配置。

### 6.2 video.getFramingMode

```json
{
  "method": "video.getFramingMode",
  "params": {}
}
```

响应：

```json
{
  "result": {
    "mode": "speaker_tracking",
    "customModeId": null,
    "configVersion": 12
  }
}
```

### 6.3 video.framingModeChanged

```json
{
  "event": "video.framingModeChanged",
  "params": {
    "mode": "speaker_tracking",
    "previousMode": "auto_framing",
    "state": "applied",
    "reason": "user_request",
    "configVersion": 12,
    "timestampMs": 1717392000000
  }
}
```

## 7. Framing Config

`video.setFramingConfig` 用于配置构图算法参数。它支持局部更新，未出现的字段保持不变。

### 7.1 schema 总体结构

正式请求使用 `config` 容器，避免配置字段和公共控制字段混在同一层：

```json
{
  "method": "video.setFramingConfig",
  "params": {
    "config": {
      "speakerTracking": {
        "delayMs": 800,
        "holdMs": 1500
      },
      "trackingPolicy": {
        "horizontalStrategy": "smooth",
        "verticalStrategy": "face_priority"
      }
    },
    "applyMode": "immediate",
    "persist": true,
    "expectedConfigVersion": 11
  }
}
```

响应：

```json
{
  "result": {
    "state": "applied",
    "updatedItems": ["speakerTracking", "trackingPolicy"],
    "configVersion": 12
  }
}
```

`FramingConfig` 可包含以下字段：

```text
autoFraming
panoramic
smartTracking
speakerTracking
splitScreen
regionTracking
trackingPolicy
```

PIP 不放在 `FramingConfig` 中，使用 `video.setPipConfig`。

### 7.2 autoFraming

```json
{
  "autoFraming": {
    "target": "people",
    "marginRatio": 0.12,
    "minConfidence": 0.6,
    "transitionSpeed": "normal",
    "fallbackMode": "panoramic"
  }
}
```

| 字段 | 类型 | 说明 |
|---|---|---|
| `target` | enum | `people`、`face`、`body`、`active_speaker`、`object`。 |
| `marginRatio` | number | 主体边缘留白比例，推荐范围 `0.0` 到 `0.5`。 |
| `minConfidence` | number | 触发自动构图的最小检测置信度，范围 `0.0` 到 `1.0`。 |
| `transitionSpeed` | enum | `slow`、`normal`、`fast`。 |
| `fallbackMode` | enum | 无有效目标时回退的 mode。 |

### 7.3 panoramic

```json
{
  "panoramic": {
    "mode": "wide",
    "stitching": true,
    "dewarpMode": "auto"
  }
}
```

| 字段 | 类型 | 说明 |
|---|---|---|
| `mode` | enum | `wide`、`ultra_wide`、`full`。 |
| `stitching` | bool | 是否启用拼接。 |
| `dewarpMode` | enum | `off`、`auto`、`low_latency`、`quality_first`。 |

### 7.4 smartTracking

```json
{
  "smartTracking": {
    "target": "person",
    "trackingSpeed": "normal",
    "lostTimeoutMs": 3000,
    "fallbackMode": "auto_framing"
  }
}
```

| 字段 | 类型 | 说明 |
|---|---|---|
| `target` | enum | `person`、`face`、`body`、`object`。 |
| `trackingSpeed` | enum | `slow`、`normal`、`fast`。 |
| `lostTimeoutMs` | uint32 | 目标丢失后保持追踪状态的时间。 |
| `fallbackMode` | enum | 目标丢失后的回退 mode。 |

### 7.5 speakerTracking

```json
{
  "speakerTracking": {
    "delayMs": 800,
    "holdMs": 1500,
    "minConfidence": 0.7,
    "switchStrategy": "stable",
    "fallbackMode": "auto_framing"
  }
}
```

| 字段 | 类型 | 说明 |
|---|---|---|
| `delayMs` | uint32 | 检测到说话人变化后延迟多久切换。AXDP `SpeakerTrackDelay` 的旧单位是秒，适配层必须转换为毫秒。 |
| `holdMs` | uint32 | 切换后至少保持多久，避免频繁抖动。 |
| `minConfidence` | number | 声源定位或说话人识别触发阈值。 |
| `switchStrategy` | enum | `fast`、`stable`、`balanced`。 |
| `fallbackMode` | enum | 无有效说话人时回退的 mode。 |

### 7.6 splitScreen

```json
{
  "splitScreen": {
    "maxSplitCount": 4,
    "splitCount": null,
    "autoAdjust": true,
    "layout": "auto"
  }
}
```

| 字段 | 类型 | 说明 |
|---|---|---|
| `maxSplitCount` | uint8 | 自动分屏时允许的最大画面块数量。 |
| `splitCount` | uint8 或 null | 强制固定分屏数量。仅在设备支持固定分屏时使用。 |
| `autoAdjust` | bool | 是否根据实际人数自动调整分屏数量。 |
| `layout` | enum | `auto`、`grid`、`horizontal`、`vertical`。 |

命名使用 `maxSplitCount`，不使用 `splitNumber`。`splitNumber` 容易被理解为编号。

### 7.7 regionTracking

```json
{
  "regionTracking": {
    "regions": [
      {
        "id": "region_1",
        "x": 0.25,
        "y": 0.2,
        "width": 0.5,
        "height": 0.6,
        "unit": "normalized",
        "priority": 1
      }
    ],
    "fallbackMode": "auto_framing"
  }
}
```

| 字段 | 类型 | 说明 |
|---|---|---|
| `regions` | array | 需要追踪的区域列表。 |
| `id` | string | 区域 ID，调用方提供。 |
| `priority` | uint8 | 多区域时的优先级，数值越小优先级越高。 |
| `fallbackMode` | enum | 区域无效或目标丢失时回退的 mode。 |

### 7.8 trackingPolicy

`trackingPolicy` 是跨 `auto_framing`、`smart_tracking`、`speaker_tracking`、`region_tracking` 复用的追踪策略配置。AXDP 的水平/垂直追踪策略、无目标策略和启动位置都应归入此对象，而不是归入 `setFramingMode`。

```json
{
  "trackingPolicy": {
    "horizontalStrategy": "smooth",
    "verticalStrategy": "face_priority",
    "noTargetStrategy": "wide",
    "startupPosition": {
      "enabled": true,
      "mode": "preset",
      "presetId": "home"
    }
  }
}
```

| 字段 | 类型 | 说明 |
|---|---|---|
| `horizontalStrategy` | enum | `auto`、`center_priority`、`smooth`、`lock`。 |
| `verticalStrategy` | enum | `auto`、`face_priority`、`body_priority`、`smooth`、`lock`。 |
| `noTargetStrategy` | enum | `keep_last`、`wide`、`startup_position`、`manual`。 |
| `startupPosition.enabled` | bool | 是否启用启动位置策略。 |
| `startupPosition.mode` | enum | `preset`、`coordinates`、`home`。 |
| `startupPosition.presetId` | string | `mode=preset` 时使用。 |
| `startupPosition.region` | object | `mode=coordinates` 时使用 normalized rectangle。 |

### 7.9 video.getFramingConfig

查询全部：

```json
{
  "method": "video.getFramingConfig",
  "params": {}
}
```

响应：

```json
{
  "result": {
    "config": {
      "speakerTracking": {
        "delayMs": 800,
        "holdMs": 1500,
        "minConfidence": 0.7,
        "switchStrategy": "stable",
        "fallbackMode": "auto_framing"
      },
      "splitScreen": {
        "maxSplitCount": 4,
        "splitCount": null,
        "autoAdjust": true,
        "layout": "auto"
      },
      "trackingPolicy": {
        "horizontalStrategy": "smooth",
        "verticalStrategy": "face_priority",
        "noTargetStrategy": "wide"
      }
    },
    "configVersion": 12
  }
}
```

查询指定项：

```json
{
  "method": "video.getFramingConfig",
  "params": {
    "items": ["splitScreen", "speakerTracking", "trackingPolicy"]
  }
}
```

### 7.10 video.resetFramingConfig

```json
{
  "method": "video.resetFramingConfig",
  "params": {
    "items": ["splitScreen", "speakerTracking"],
    "persist": true
  }
}
```

响应：

```json
{
  "result": {
    "state": "applied",
    "resetItems": ["splitScreen", "speakerTracking"],
    "config": {
      "splitScreen": {
        "maxSplitCount": 4,
        "splitCount": null,
        "autoAdjust": true,
        "layout": "auto"
      },
      "speakerTracking": {
        "delayMs": 800,
        "holdMs": 1500,
        "minConfidence": 0.7,
        "switchStrategy": "stable",
        "fallbackMode": "auto_framing"
      }
    },
    "configVersion": 13
  }
}
```

### 7.11 video.framingConfigChanged

```json
{
  "event": "video.framingConfigChanged",
  "params": {
    "changedItems": ["splitScreen"],
    "config": {
      "splitScreen": {
        "maxSplitCount": 4,
        "splitCount": null,
        "autoAdjust": true,
        "layout": "auto"
      }
    },
    "reason": "user_request",
    "configVersion": 13,
    "timestampMs": 1717392000000
  }
}
```

## 8. Framing State

运行态不是配置。人数、活跃目标、当前追踪区域、检测置信度等必须通过 `video.getFramingState` 或 `video.framingStateChanged` 表达。

### 8.1 状态枚举

```text
idle
detecting
tracking
transitioning
degraded
unavailable
```

### 8.2 video.getFramingState

```json
{
  "method": "video.getFramingState",
  "params": {
    "includeDetections": false,
    "includeRegions": true
  }
}
```

响应：

```json
{
  "result": {
    "mode": "speaker_tracking",
    "state": "tracking",
    "peopleCount": 3,
    "activeTarget": {
      "id": "person_2",
      "type": "person",
      "confidence": 0.91,
      "region": {
        "x": 0.42,
        "y": 0.18,
        "width": 0.2,
        "height": 0.44,
        "unit": "normalized"
      }
    },
    "activeSpeaker": {
      "targetId": "person_2",
      "confidence": 0.84,
      "source": "audio_doa"
    },
    "regions": [],
    "configVersion": 13,
    "timestampMs": 1717392000000
  }
}
```

### 8.3 video.framingStateChanged

```json
{
  "event": "video.framingStateChanged",
  "params": {
    "mode": "speaker_tracking",
    "state": "transitioning",
    "previousState": "tracking",
    "peopleCount": 3,
    "activeTargetId": "person_3",
    "reason": "auto_policy",
    "timestampMs": 1717392001000
  }
}
```

事件频率规则：

- 人数、状态、活跃目标变化时可以立即上报。
- 高频检测框不应无节制使用 Changed 事件上报。若后续需要连续检测流，应另定义 stats/reporting 或 stream 类接口。
- `CommonGetPeopleNumber` 类旧接口适配到 `peopleCount`，不得适配到 `getFramingConfig`。

## 9. Output Transform

输出变换对所有 framing mode 生效，处理位置在构图和 PIP 之后、编码和输出之前。

### 9.1 schema

```json
{
  "transform": {
    "mirrorMode": "flip_horizontal",
    "rotation": 0,
    "orientation": "landscape",
    "aspectRatio": "16:9",
    "scaleMode": "fit"
  }
}
```

| 字段 | 类型 | 说明 |
|---|---|---|
| `mirrorMode` | enum | `none`、`flip_horizontal`、`flip_vertical`、`flip_both`。 |
| `rotation` | uint16 | `0`、`90`、`180`、`270`。 |
| `orientation` | enum | `landscape`、`portrait`、`auto`。 |
| `aspectRatio` | enum | `auto`、`16:9`、`4:3`、`1:1`、`9:16`、`custom`。 |
| `customAspectRatio` | object | `aspectRatio=custom` 时使用，例如 `{ "width": 3, "height": 2 }`。 |
| `scaleMode` | enum | `fit`、`fill`、`crop`、`stretch`。 |
| `crop` | object | 自定义裁切矩形，设备支持 `supportsCustomCrop` 时可用。 |

### 9.2 video.setOutputTransform

```json
{
  "method": "video.setOutputTransform",
  "params": {
    "transform": {
      "mirrorMode": "flip_horizontal",
      "rotation": 0,
      "orientation": "landscape",
      "aspectRatio": "16:9",
      "scaleMode": "fit"
    },
    "persist": true
  }
}
```

响应：

```json
{
  "result": {
    "state": "applied",
    "transform": {
      "mirrorMode": "flip_horizontal",
      "rotation": 0,
      "orientation": "landscape",
      "aspectRatio": "16:9",
      "scaleMode": "fit"
    },
    "configVersion": 7
  }
}
```

### 9.3 video.getOutputTransform

```json
{
  "method": "video.getOutputTransform",
  "params": {}
}
```

响应：

```json
{
  "result": {
    "transform": {
      "mirrorMode": "flip_horizontal",
      "rotation": 0,
      "orientation": "landscape",
      "aspectRatio": "16:9",
      "scaleMode": "fit"
    },
    "configVersion": 7
  }
}
```

### 9.4 自定义比例和裁切

```json
{
  "method": "video.setOutputTransform",
  "params": {
    "transform": {
      "aspectRatio": "custom",
      "customAspectRatio": {
        "width": 9,
        "height": 16
      },
      "scaleMode": "crop"
    }
  }
}
```

### 9.5 video.resetOutputTransform

```json
{
  "method": "video.resetOutputTransform",
  "params": {
    "persist": true
  }
}
```

响应：

```json
{
  "result": {
    "state": "applied",
    "transform": {
      "mirrorMode": "none",
      "rotation": 0,
      "orientation": "auto",
      "aspectRatio": "auto",
      "scaleMode": "fit"
    },
    "configVersion": 8
  }
}
```

### 9.6 video.outputTransformChanged

```json
{
  "event": "video.outputTransformChanged",
  "params": {
    "transform": {
      "mirrorMode": "flip_horizontal",
      "rotation": 0,
      "orientation": "landscape",
      "aspectRatio": "16:9",
      "scaleMode": "fit"
    },
    "reason": "user_request",
    "configVersion": 8,
    "timestampMs": 1717392000000
  }
}
```

### 9.7 垂直屏映射

正式协议不新增 `verticalScreenMode` 字段。垂直屏应由以下字段组合表达：

```json
{
  "orientation": "portrait",
  "aspectRatio": "9:16",
  "rotation": 90,
  "scaleMode": "crop"
}
```

AXDP `CommonSetVerticalScreenMode` / `CommonGetVerticalScreenMode` 可作为候选 legacyRefs，但必须先确认旧设备行为：

- 若旧命令只启用竖屏裁切，映射到 `orientation=portrait`、`aspectRatio=9:16`。
- 若旧命令实际旋转输出，必须同时映射 `rotation=90` 或 `rotation=270`。
- 若旧命令改变构图算法而不是输出变换，不得写入 `video.outputTransform` legacyRefs。

## 10. PIP / Picture-in-Picture

`picture_in_picture` 是一种 framing mode；PIP 窗口参数使用 `video.setPipConfig` 独立配置。

### 10.1 schema

```json
{
  "config": {
    "enabled": true,
    "main": {
      "source": "main_camera",
      "framingMode": "auto_framing"
    },
    "overlays": [
      {
        "id": "overlay_1",
        "source": "secondary_camera",
        "position": "bottom_right",
        "sizeRatio": 0.25,
        "marginRatio": 0.04,
        "zOrder": 1
      }
    ]
  }
}
```

| 字段 | 类型 | 说明 |
|---|---|---|
| `enabled` | bool | 是否启用 PIP 配置。启用配置不一定自动切换 `framingMode`。 |
| `main.source` | string | 主画面来源，例如 `main_camera`、`content`。 |
| `main.framingMode` | enum | 主画面内部使用的 framing mode，设备不支持时可省略。 |
| `overlays` | array | 小窗列表，数量不得超过 `pip.maxOverlayWindows`。 |
| `overlays[].source` | string | 小窗来源。 |
| `position` | enum | `top_left`、`top_right`、`bottom_left`、`bottom_right`、`custom`。 |
| `sizeRatio` | number | 小窗相对输出画面的大小比例。 |
| `marginRatio` | number | 小窗边距比例。 |
| `x` / `y` / `width` / `height` | number | `position=custom` 时使用 normalized 坐标。 |
| `zOrder` | uint8 | 多小窗叠放顺序。 |

### 10.2 video.setPipConfig

```json
{
  "method": "video.setPipConfig",
  "params": {
    "config": {
      "enabled": true,
      "main": {
        "source": "main_camera"
      },
      "overlays": [
        {
          "id": "overlay_1",
          "source": "secondary_camera",
          "position": "bottom_right",
          "sizeRatio": 0.25,
          "marginRatio": 0.04
        }
      ]
    },
    "persist": true
  }
}
```

响应：

```json
{
  "result": {
    "state": "applied",
    "configVersion": 4
  }
}
```

### 10.3 自定义位置

```json
{
  "method": "video.setPipConfig",
  "params": {
    "config": {
      "enabled": true,
      "overlays": [
        {
          "id": "overlay_1",
          "source": "secondary_camera",
          "position": "custom",
          "x": 0.7,
          "y": 0.7,
          "width": 0.25,
          "height": 0.2,
          "unit": "normalized"
        }
      ]
    }
  }
}
```

### 10.4 video.getPipConfig

```json
{
  "method": "video.getPipConfig",
  "params": {}
}
```

响应：

```json
{
  "result": {
    "config": {
      "enabled": true,
      "main": {
        "source": "main_camera"
      },
      "overlays": [
        {
          "id": "overlay_1",
          "source": "secondary_camera",
          "position": "bottom_right",
          "sizeRatio": 0.25,
          "marginRatio": 0.04
        }
      ]
    },
    "configVersion": 4
  }
}
```

### 10.5 video.resetPipConfig

```json
{
  "method": "video.resetPipConfig",
  "params": {
    "persist": true
  }
}
```

响应：

```json
{
  "result": {
    "state": "applied",
    "config": {
      "enabled": false,
      "main": {
        "source": "main_camera"
      },
      "overlays": []
    },
    "configVersion": 5
  }
}
```

### 10.6 video.pipConfigChanged

```json
{
  "event": "video.pipConfigChanged",
  "params": {
    "config": {
      "enabled": true,
      "overlays": [
        {
          "id": "overlay_1",
          "source": "secondary_camera",
          "position": "bottom_right",
          "sizeRatio": 0.25
        }
      ]
    },
    "reason": "user_request",
    "configVersion": 5,
    "timestampMs": 1717392000000
  }
}
```

## 11. 错误处理

错误码必须引用正式 ErrorCode registry。本文不新增局部错误名。

| 场景 | 推荐 ErrorCode |
|---|---|
| 方法不存在或未注册 | `RPC_METHOD_NOT_FOUND` |
| 设备有 capability 但当前方法不可用 | `CAPABILITY_METHOD_UNSUPPORTED` |
| 不支持某 capability 或 mode | `NOT_SUPPORTED` 或 `CAPABILITY_NOT_FOUND` |
| 参数类型错误、枚举非法、范围越界 | `RPC_PARAM_INVALID` |
| 当前状态不允许切换或版本冲突 | `INVALID_STATE` |
| 设备或视频资源忙 | `BUSY` 或 `DEVICE_RESOURCE_BUSY` |
| 指定 source 不存在 | `MEDIA_SOURCE_NOT_FOUND` |
| 指定 source 暂不可用 | `MEDIA_SOURCE_UNAVAILABLE` |
| legacy 字段无法无损适配 | `LEGACY_FIELD_UNSUPPORTED` |

错误响应示例：

```json
{
  "error": {
    "code": "RPC_PARAM_INVALID",
    "message": "splitScreen.maxSplitCount out of range",
    "data": {
      "field": "config.splitScreen.maxSplitCount",
      "min": 2,
      "max": 8
    }
  }
}
```

## 12. Legacy 映射建议

legacyRefs 只能记录已确认的旧命令、旧状态码和 payload 语义。下表中的 `pending` 表示分类方向明确但旧枚举值仍需设备确认。

### 12.1 AXDP HID

| Legacy command | CmdValue | AXTP 映射 | 状态 | 说明 |
|---|---|---|---|---|
| `CommonSetVideoMode` | `0xC0021 / 0x0021 -> 0x00A1` | `video.setFramingMode` | pending | 源码注释 `0=全景, 1=智能跟踪`，候选映射 `panoramic` / `smart_tracking`。 |
| `CommonGetVideoMode` | `0xC0022 / 0x0022 -> 0x00A2` | `video.getFramingMode` | pending | 旧返回长度可能为 1/2/4B，需要确认枚举值。 |
| `CommonGetPeopleNumber` | `0xC0023 / 0x0023 -> 0x00A3` | `video.getFramingState.peopleCount` | fixed | 运行态，不是 config。 |
| `CommonSetVideoTrackMode` | `0xC0031 / 0x0031 -> 0x00B1` | `video.setFramingMode` | pending | 旧 `VideoTrackMode(0..6)` 枚举未确认。 |
| `CommonGetVideoTrackMode` | `0xC0032 / 0x0032 -> 0x00B2` | `video.getFramingMode` | pending | 同上。 |
| `CommonSetSpeakerTrackDelay` | `0xC0035 / 0x0035 -> 0x00B5` | `video.setFramingConfig.config.speakerTracking.delayMs` | fixed | 旧单位是秒，适配层转换为毫秒。 |
| `CommonGetSpeakerTrackDelay` | `0xC0036 / 0x0036 -> 0x00B6` | `video.getFramingConfig.config.speakerTracking.delayMs` | fixed | 同上。 |
| `CommonGetRegionTracking` | `0xC0115 / 0x0115 -> 0x0195` | `video.getFramingConfig.config.regionTracking` | pending | 旧 payload 是 raw bytes，未确认 schema。 |
| `CommonSetRegionTracking` | `0xC0116 / 0x0116 -> 0x0196` | `video.setFramingConfig.config.regionTracking` | pending | 旧 payload 未明确。 |
| `CommonSetNoTargetStrategyState` | `0xC0119 / 0x0119 -> 0x0199` | `video.setFramingConfig.config.trackingPolicy.noTargetStrategy` | pending | 当前生成分类误挂 `firmware.ota`，若语义确认为无目标追踪策略，应迁回 `video.framing`。 |
| `CommonGetNoTargetStrategyState` | `0xC011A / 0x011A -> 0x019A` | `video.getFramingConfig.config.trackingPolicy.noTargetStrategy` | pending | 同上。 |
| `CommonSetStartupPosition` | `0xC011B / 0x011B -> 0x019B` | `video.setFramingConfig.config.trackingPolicy.startupPosition` | pending | 旧值是 EnableState/value，需要确认是否 preset、home 或 coordinates。 |
| `CommonGetStartupPosition` | `0xC011C / 0x011C -> 0x019C` | `video.getFramingConfig.config.trackingPolicy.startupPosition` | pending | 同上。 |
| `CommonSetHorTrackingStrategy` | `0xC0126 / 0x0126 -> 0x01A6` | `video.setFramingConfig.config.trackingPolicy.horizontalStrategy` | fixed | 修正 review 中错误映射，不再指向 `setFramingMode`。 |
| `CommonGetHorTrackingStrategy` | `0xC0127 / 0x0127 -> 0x01A7` | `video.getFramingConfig.config.trackingPolicy.horizontalStrategy` | fixed | 旧枚举值仍需确认。 |
| `CommonSetVerTrackingStrategy` | `0xC0128 / 0x0128 -> 0x01A8` | `video.setFramingConfig.config.trackingPolicy.verticalStrategy` | fixed | 修正 review 中错误映射。 |
| `CommonGetVerTrackingStrategy` | `0xC0129 / 0x0129 -> 0x01A9` | `video.getFramingConfig.config.trackingPolicy.verticalStrategy` | fixed | 旧枚举值仍需确认。 |
| `CommonSetMirrorState` | `0xC0033 / 0x0033 -> 0x00B3` | `video.setOutputTransform.transform.mirrorMode` | fixed | `enabled=true` 候选为 `flip_horizontal`。需与 flip 合并为 `flip_both`。 |
| `CommonGetMirrorState` | `0xC0034 / 0x0034 -> 0x00B4` | `video.getOutputTransform.transform.mirrorMode` | fixed | 同上。 |
| `CommonSetFlipState` | `0xC004C / 0x004C -> 0x00CC` | `video.setOutputTransform.transform.mirrorMode` | fixed | `enabled=true` 候选为 `flip_vertical`。需与 mirror 合并为 `flip_both`。 |
| `CommonGetFlipState` | `0xC004D / 0x004D -> 0x00CD` | `video.getOutputTransform.transform.mirrorMode` | fixed | 同上。 |
| `CommonSetVerticalScreenMode` | `0xC0144 / 0x0144 -> 0x01C4` | `video.setOutputTransform.transform.orientation` / `rotation` / `aspectRatio` | pending | 需确认旧行为。 |
| `CommonGetVerticalScreenMode` | `0xC0145 / 0x0145 -> 0x01C5` | `video.getOutputTransform.transform.orientation` / `rotation` / `aspectRatio` | pending | 同上。 |
| `CommonSetSplitScreenNumber` | `0xC0037 / 0x0037 -> 0x00B7` | `video.setFramingConfig.config.splitScreen.splitCount` | pending | 若旧命令控制自动分屏数量则归 framing；若控制固定 mixer layout，则归 `video.layout`。 |
| `CommonGetSplitScreenNumber` | `0xC0038 / 0x0038 -> 0x00B8` | `video.getFramingConfig.config.splitScreen.splitCount` | pending | 同上。 |
| `CommonSetPiPMode` | `0xC0134 / 0x0134 -> 0x01B4` | `video.setPipConfig.config.enabled` 或 `video.setFramingMode(picture_in_picture)` | pending | 需确认旧值是 enable/disable、mode，还是复杂布局。 |
| `CommonGetPiPMode` | `0xC0135 / 0x0135 -> 0x01B5` | `video.getPipConfig` 或 `video.getFramingMode` | pending | 同上。 |
| `CommonGetAllChannelScanState` | `0xC0192 / 0x0192 -> 0x0212` | 暂不写入 `video.framing` | ask | 可能是多摄通道扫描、Wi-Fi 全信道扫描或 stream source scan。 |
| `CommonSetAllChannelScanState` | `0xC0193 / 0x0193 -> 0x0213` | 暂不写入 `video.framing` | ask | 同上。 |
| `CommonSetFrameRateSwitch` | `0xC0202 / 0x0202 -> 0x0282` | 暂不写入 `video.framing` | ask | 更像 `video.stream` / `video.encoder` profile。 |
| `CommonGetFrameRateSwitch` | `0xC0203 / 0x0203 -> 0x0283` | 暂不写入 `video.framing` | ask | 同上。 |

### 12.2 Rooms / VM33

| Legacy source | Legacy object | AXTP 映射 | 说明 |
|---|---|---|---|
| Rooms WS JSON | `SetAlgMode` / `GetAlgMode` | `video.setFramingMode` / `video.getFramingMode` | `Manual`、`AutoFraming`、`SmartTracking`、`SpeakerTracking` 分别映射到 `manual`、`auto_framing`、`smart_tracking`、`speaker_tracking`。旧文档中的 `SpeakerTacking` 拼写视为同义 typo。 |
| Rooms WS JSON | `GetDevInfo.algCapacity` | `video.getFramingCapabilities.framing.modes` | 旧 bitmask 可转为 modes 列表。bit 顺序需按旧实现确认。 |
| VM33 HTTP JSON | `Config.MultiSet:Video.mode` | `video.setFramingMode` | 若旧 `Video` 对象同时包含算法参数，其他字段进入 `video.setFramingConfig`。 |

## 13. Registry 草案摘要

### 13.1 方法注册建议

| Method | Request schema | Response schema | Capability | Errors |
|---|---|---|---|---|
| `video.getFramingCapabilities` | `VideoGetFramingCapabilitiesRequest` | `VideoGetFramingCapabilitiesResponse` | `video.framing`, `video.outputTransform`, `video.pip` | `SUCCESS`, `RPC_METHOD_NOT_FOUND` |
| `video.setFramingMode` | `VideoSetFramingModeRequest` | `VideoSetFramingModeResponse` | `video.framing` | `SUCCESS`, `RPC_PARAM_INVALID`, `NOT_SUPPORTED`, `INVALID_STATE`, `BUSY` |
| `video.getFramingMode` | `CommonEmptyRequest` | `VideoGetFramingModeResponse` | `video.framing` | `SUCCESS`, `RPC_METHOD_NOT_FOUND` |
| `video.setFramingConfig` | `VideoSetFramingConfigRequest` | `VideoSetFramingConfigResponse` | `video.framing` | `SUCCESS`, `RPC_PARAM_INVALID`, `NOT_SUPPORTED`, `INVALID_STATE`, `BUSY` |
| `video.getFramingConfig` | `VideoGetFramingConfigRequest` | `VideoGetFramingConfigResponse` | `video.framing` | `SUCCESS`, `RPC_METHOD_NOT_FOUND`, `RPC_PARAM_INVALID` |
| `video.resetFramingConfig` | `VideoResetFramingConfigRequest` | `VideoResetFramingConfigResponse` | `video.framing` | `SUCCESS`, `RPC_PARAM_INVALID`, `BUSY` |
| `video.getFramingState` | `VideoGetFramingStateRequest` | `VideoGetFramingStateResponse` | `video.framing` | `SUCCESS`, `RPC_METHOD_NOT_FOUND`, `MEDIA_SOURCE_UNAVAILABLE` |
| `video.setOutputTransform` | `VideoSetOutputTransformRequest` | `VideoSetOutputTransformResponse` | `video.outputTransform` | `SUCCESS`, `RPC_PARAM_INVALID`, `NOT_SUPPORTED`, `INVALID_STATE`, `BUSY` |
| `video.getOutputTransform` | `CommonEmptyRequest` | `VideoGetOutputTransformResponse` | `video.outputTransform` | `SUCCESS`, `RPC_METHOD_NOT_FOUND` |
| `video.resetOutputTransform` | `VideoResetOutputTransformRequest` | `VideoResetOutputTransformResponse` | `video.outputTransform` | `SUCCESS`, `BUSY` |
| `video.setPipConfig` | `VideoSetPipConfigRequest` | `VideoSetPipConfigResponse` | `video.pip` | `SUCCESS`, `RPC_PARAM_INVALID`, `NOT_SUPPORTED`, `MEDIA_SOURCE_NOT_FOUND`, `MEDIA_SOURCE_UNAVAILABLE`, `BUSY` |
| `video.getPipConfig` | `CommonEmptyRequest` | `VideoGetPipConfigResponse` | `video.pip` | `SUCCESS`, `RPC_METHOD_NOT_FOUND` |
| `video.resetPipConfig` | `VideoResetPipConfigRequest` | `VideoResetPipConfigResponse` | `video.pip` | `SUCCESS`, `BUSY` |

### 13.2 事件注册建议

| Event | Event schema | Capability | Severity |
|---|---|---|---|
| `video.framingModeChanged` | `VideoFramingModeChangedEvent` | `video.framing` | info |
| `video.framingConfigChanged` | `VideoFramingConfigChangedEvent` | `video.framing` | info |
| `video.framingStateChanged` | `VideoFramingStateChangedEvent` | `video.framing` | info |
| `video.outputTransformChanged` | `VideoOutputTransformChangedEvent` | `video.outputTransform` | info |
| `video.pipConfigChanged` | `VideoPipConfigChangedEvent` | `video.pip` | info |

### 13.3 MVP Profile

第一阶段建议纳入：

```text
video.getFramingCapabilities
video.setFramingMode
video.getFramingMode
video.setFramingConfig
video.getFramingConfig
video.getFramingState
video.setOutputTransform
video.getOutputTransform
video.framingModeChanged
video.framingConfigChanged
video.framingStateChanged
video.outputTransformChanged
```

第二阶段加入：

```text
video.resetFramingConfig
video.resetOutputTransform
video.setPipConfig
video.getPipConfig
video.resetPipConfig
video.pipConfigChanged
```

## 14. 设计约束

1. 不把 mode、config、state 混成一个大接口。
2. 不把 `CommonGetPeopleNumber` 这类运行态映射到 config。
3. 不把 horizontal/vertical tracking strategy 映射到 `setFramingMode`。
4. 不把 output mirror/flip/rotation 塞进某个 framing mode。
5. 不将 PIP window schema 放入普通 `FramingConfig`。
6. 不为 `framingMode`、`framingConfig`、`pipConfig` 创建 capability ID。
7. 未确认旧枚举值之前，只写 pending legacyRefs，不写强 value mapping。
