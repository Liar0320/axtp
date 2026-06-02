# AXTP画面输出配置方案

# Video Framing / Composition 协议方案 v0\.1



## 1\. 归属域



Framing 相关能力归属：



```Plain Text
video
```



原因：



```Plain Text
framing 控制的是最终视频输出画面的构图、裁切、追踪、分屏、画中画等输出效果，
不属于 camera 的采集参数，也不属于 display 的本机屏幕显示参数。
```



---



## 2\. 总体拆分原则



不要把所有东西都塞进一个 `video.setFramingConfig`。建议拆成三类：



```Plain Text
video.setFramingMode / video.getFramingMode
  选择当前视频构图模式。

video.setFramingConfig / video.getFramingConfig
  配置当前构图模式下的专属参数，例如 split_screen 的分屏数量、speaker_tracking 的延迟、region_tracking 的区域。

video.setOutputTransform / video.getOutputTransform
  配置通用输出画面变换，例如镜像、旋转、输出比例、裁切策略。

video.setPipConfig / video.getPipConfig
  配置画中画模式，因为 PIP 结构复杂，建议独立成一组协议。
```



最终推荐接口：



```Plain Text
video.getFramingCapabilities

video.setFramingMode
video.getFramingMode
video.framingModeChanged

video.setFramingConfig
video.getFramingConfig
video.framingConfigChanged

video.setOutputTransform
video.getOutputTransform
video.outputTransformChanged

video.setPipConfig
video.getPipConfig
video.pipConfigChanged
```



---



# 3\. Framing Mode



## 3\.1 FramingMode 枚举



推荐第一版支持：



```Plain Text
manual
  手动构图，不自动追踪/裁切。

auto_framing
  自动取景，自动把人物或主体放入画面。

panoramic
  全景/宽画幅模式。

smart_tracking
  智能追踪模式，通常根据人形或主体进行跟踪。

speaker_tracking
  说话人追踪模式，通常由音频 beam / DOA / VAD 驱动视频构图。

split_screen
  分屏构图，根据人形/人物检测将画面分成多个区域。

region_tracking
  区域追踪，追踪指定画面区域。

picture_in_picture
  画中画模式，主画面 + 小窗画面组合输出。

custom
  厂商或客户自定义构图模式。
```



如果第一版想更收敛，MVP 可以先支持：



```Plain Text
manual
auto_framing
speaker_tracking
split_screen
picture_in_picture
```



---



# 4\. 查询 Framing 能力



## 4\.1 方法



```Plain Text
video.getFramingCapabilities
```



## 4\.2 请求



```Plain Text
{
  "method": "video.getFramingCapabilities",
  "params": {}
}
```



## 4\.3 返回



```Plain Text
{
  "result": {
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
    "modeCapabilities": {
      "speaker_tracking": {
        "delayMs": {
          "supported": true,
          "defaultValue": 800,
          "range": {
            "min": 0,
            "max": 5000,
            "step": 100
          }
        },
        "holdMs": {
          "supported": true,
          "defaultValue": 1500,
          "range": {
            "min": 0,
            "max": 10000,
            "step": 100
          }
        }
      },
      "split_screen": {
        "maxSplitCount": {
          "supported": true,
          "defaultValue": 4,
          "range": {
            "min": 2,
            "max": 8,
            "step": 1
          }
        },
        "autoAdjust": {
          "supported": true,
          "defaultValue": true
        },
        "layouts": ["grid", "horizontal", "vertical", "auto"]
      },
      "region_tracking": {
        "maxRegions": 4,
        "coordinateUnit": "normalized"
      },
      "picture_in_picture": {
        "maxWindows": 2,
        "positions": [
          "top_left",
          "top_right",
          "bottom_left",
          "bottom_right",
          "custom"
        ],
        "sizeRange": {
          "min": 0.1,
          "max": 0.5,
          "step": 0.05
        }
      }
    },
    "outputTransform": {
      "mirrorModes": [
        "none",
        "flip_horizontal",
        "flip_vertical",
        "flip_both"
      ],
      "rotations": [0, 90, 180, 270],
      "aspectRatios": [
        "auto",
        "16:9",
        "4:3",
        "1:1",
        "9:16"
      ],
      "scaleModes": [
        "fit",
        "fill",
        "crop",
        "stretch"
      ]
    }
  }
}
```



## 4\.4 说明



`video.getFramingCapabilities` 同时返回：



```Plain Text
1. 支持哪些 framingMode；
2. 每种 mode 支持哪些专属参数；
3. 通用 outputTransform 支持哪些翻转、旋转、比例、缩放策略；
4. PIP 支持哪些窗口位置、数量和大小范围。
```



---



# 5\. 设置 Framing Mode



## 5\.1 方法



```Plain Text
video.setFramingMode
```



## 5\.2 请求



```Plain Text
{
  "method": "video.setFramingMode",
  "params": {
    "mode": "split_screen"
  }
}
```



## 5\.3 返回



```Plain Text
{
  "result": {
    "mode": "split_screen",
    "state": "applied"
  }
}
```



## 5\.4 查询



```Plain Text
{
  "method": "video.getFramingMode",
  "params": {}
}
```



返回：



```Plain Text
{
  "result": {
    "mode": "split_screen"
  }
}
```



## 5\.5 事件



```Plain Text
video.framingModeChanged
```



```Plain Text
{
  "event": "video.framingModeChanged",
  "params": {
    "mode": "split_screen",
    "reason": "user_request"
  }
}
```



---



# 6\. Framing Config：模式专属参数



`video.setFramingConfig` 用于配置不同 `framingMode` 下的专属参数。



## 6\.1 方法



```Plain Text
video.setFramingConfig
video.getFramingConfig
video.framingConfigChanged
```



## 6\.2 总体结构



```Plain Text
{
  "method": "video.setFramingConfig",
  "params": {
    "splitScreen": {
      "maxSplitCount": 4,
      "autoAdjust": true,
      "layout": "auto"
    }
  }
}
```



这里建议 JSON 对象使用 lowerCamelCase：



```Plain Text
autoFraming
panoramic
smartTracking
speakerTracking
splitScreen
regionTracking
pictureInPicture
```



而 `framingMode` 枚举仍然使用 snake\_case：



```Plain Text
auto_framing
speaker_tracking
split_screen
region_tracking
picture_in_picture
```



这样符合方法枚举和 JSON 对象字段的常见习惯。



---



## 6\.3 auto\_framing 配置



```Plain Text
{
  "method": "video.setFramingConfig",
  "params": {
    "autoFraming": {
      "target": "people",
      "marginRatio": 0.12,
      "transitionSpeed": "normal"
    }
  }
}
```



字段：



```Plain Text
target:
  people / face / body / active_speaker / object

marginRatio:
  主体边缘留白比例，0.0 - 0.5。

transitionSpeed:
  slow / normal / fast。
```



---



## 6\.4 speaker\_tracking 配置



```Plain Text
{
  "method": "video.setFramingConfig",
  "params": {
    "speakerTracking": {
      "delayMs": 800,
      "holdMs": 1500,
      "minConfidence": 0.7,
      "fallbackMode": "auto_framing"
    }
  }
}
```



字段：



```Plain Text
delayMs:
  检测到说话人变化后，延迟多久切换画面。

holdMs:
  切换后至少保持多久，避免频繁抖动。

minConfidence:
  触发追踪所需的最小置信度。

fallbackMode:
  无有效说话人时回退到什么 framing mode。
```



---



## 6\.5 split\_screen 配置



`split_screen` 是一种 framingMode；分屏数量是该模式下的 config。



```Plain Text
{
  "method": "video.setFramingConfig",
  "params": {
    "splitScreen": {
      "maxSplitCount": 4,
      "autoAdjust": true,
      "layout": "auto"
    }
  }
}
```



字段：



```Plain Text
maxSplitCount:
  根据人形/人物检测自动分屏时允许的最大画面块数量。

splitCount:
  强制固定分屏数量。仅在设备支持固定分屏时使用。

autoAdjust:
  是否根据实际人数自动调整分屏数量。

layout:
  auto / grid / horizontal / vertical。
```



推荐优先使用：



```Plain Text
maxSplitCount
```



而不是：



```Plain Text
splitNumber
```



原因：



```Plain Text
maxSplitCount 表示“最多分成几屏”，更符合根据人数自动布局的语义；
splitNumber 容易被理解成编号，不建议使用。
```



---



## 6\.6 region\_tracking 配置



```Plain Text
{
  "method": "video.setFramingConfig",
  "params": {
    "regionTracking": {
      "regions": [
        {
          "id": "region_1",
          "x": 0.25,
          "y": 0.20,
          "width": 0.50,
          "height": 0.60,
          "unit": "normalized",
          "priority": 1
        }
      ],
      "fallbackMode": "auto_framing"
    }
  }
}
```



字段：



```Plain Text
regions:
  需要追踪的区域列表。

x / y / width / height:
  区域坐标，推荐使用 normalized，范围 0.0 - 1.0。

priority:
  多区域时的优先级。

fallbackMode:
  区域无效或目标丢失时的回退模式。
```



---



## 6\.7 panoramic 配置



```Plain Text
{
  "method": "video.setFramingConfig",
  "params": {
    "panoramic": {
      "mode": "wide",
      "stitching": true
    }
  }
}
```



字段：



```Plain Text
mode:
  wide / ultra_wide / full。

stitching:
  是否启用拼接。
```



---



## 6\.8 smart\_tracking 配置



```Plain Text
{
  "method": "video.setFramingConfig",
  "params": {
    "smartTracking": {
      "target": "person",
      "trackingSpeed": "normal",
      "lostTimeoutMs": 3000
    }
  }
}
```



字段：



```Plain Text
target:
  person / face / body / object。

trackingSpeed:
  slow / normal / fast。

lostTimeoutMs:
  目标丢失后保持追踪状态的时间。
```



---



## 6\.9 查询 Framing Config



查询全部：



```Plain Text
{
  "method": "video.getFramingConfig",
  "params": {}
}
```



返回：



```Plain Text
{
  "result": {
    "speakerTracking": {
      "delayMs": 800,
      "holdMs": 1500,
      "minConfidence": 0.7,
      "fallbackMode": "auto_framing"
    },
    "splitScreen": {
      "maxSplitCount": 4,
      "autoAdjust": true,
      "layout": "auto"
    },
    "regionTracking": {
      "regions": [],
      "fallbackMode": "auto_framing"
    }
  }
}
```



查询指定配置项：



```Plain Text
{
  "method": "video.getFramingConfig",
  "params": {
    "items": ["splitScreen", "speakerTracking"]
  }
}
```



---



## 6\.10 Framing Config 事件



```Plain Text
video.framingConfigChanged
```



```Plain Text
{
  "event": "video.framingConfigChanged",
  "params": {
    "splitScreen": {
      "maxSplitCount": 4,
      "autoAdjust": true,
      "layout": "auto"
    },
    "reason": "user_request"
  }
}
```



---



# 7\. Output Transform：通用输出画面变换



翻转、旋转、输出比例、缩放策略不建议塞到某个 framingMode 里，因为它们通常对所有模式都生效。



## 7\.1 方法



```Plain Text
video.setOutputTransform
video.getOutputTransform
video.outputTransformChanged
```



## 7\.2 设置输出画面变换



```Plain Text
{
  "method": "video.setOutputTransform",
  "params": {
    "mirrorMode": "flip_horizontal",
    "rotation": 0,
    "aspectRatio": "16:9",
    "scaleMode": "fit"
  }
}
```



## 7\.3 查询



```Plain Text
{
  "method": "video.getOutputTransform",
  "params": {}
}
```



返回：



```Plain Text
{
  "result": {
    "mirrorMode": "flip_horizontal",
    "rotation": 0,
    "aspectRatio": "16:9",
    "scaleMode": "fit"
  }
}
```



## 7\.4 字段说明



```Plain Text
mirrorMode:
  none / flip_horizontal / flip_vertical / flip_both。

rotation:
  0 / 90 / 180 / 270。

aspectRatio:
  auto / 16:9 / 4:3 / 1:1 / 9:16 / custom。

customAspectRatio:
  当 aspectRatio=custom 时使用，例如 { "width": 3, "height": 2 }。

scaleMode:
  fit / fill / crop / stretch。
```



## 7\.5 输出比例配置



如果需要自定义比例：



```Plain Text
{
  "method": "video.setOutputTransform",
  "params": {
    "aspectRatio": "custom",
    "customAspectRatio": {
      "width": 9,
      "height": 16
    },
    "scaleMode": "crop"
  }
}
```



## 7\.6 事件



```Plain Text
{
  "event": "video.outputTransformChanged",
  "params": {
    "mirrorMode": "flip_horizontal",
    "rotation": 0,
    "aspectRatio": "16:9",
    "scaleMode": "fit",
    "reason": "user_request"
  }
}
```



---



# 8\. PIP / Picture\-in\-Picture 配置



PIP 比较复杂，建议独立为 `video.setPipConfig`，不要塞进 `video.setFramingConfig` 的普通字段里。



`picture_in_picture` 可以是 `framingMode` 的一种，但 PIP 的窗口参数使用独立配置接口。



## 8\.1 方法



```Plain Text
video.setPipConfig
video.getPipConfig
video.pipConfigChanged
```



## 8\.2 设置 PIP



```Plain Text
{
  "method": "video.setPipConfig",
  "params": {
    "enabled": true,
    "main": {
      "source": "main_camera"
    },
    "overlay": {
      "source": "secondary_camera",
      "position": "bottom_right",
      "sizeRatio": 0.25,
      "marginRatio": 0.04
    }
  }
}
```



## 8\.3 自定义位置



```Plain Text
{
  "method": "video.setPipConfig",
  "params": {
    "enabled": true,
    "overlay": {
      "source": "secondary_camera",
      "position": "custom",
      "x": 0.70,
      "y": 0.70,
      "width": 0.25,
      "height": 0.20,
      "unit": "normalized"
    }
  }
}
```



## 8\.4 字段说明



```Plain Text
enabled:
  是否启用 PIP 配置。

main:
  主画面配置。

overlay:
  小窗配置。

source:
  画面来源，例如 main_camera / secondary_camera / content / hdmi / screen_share。

position:
  top_left / top_right / bottom_left / bottom_right / custom。

sizeRatio:
  小窗相对主画面的大小比例。

marginRatio:
  小窗边距比例。

x / y / width / height:
  自定义小窗位置与尺寸，推荐 normalized 坐标。
```



## 8\.5 查询 PIP



```Plain Text
{
  "method": "video.getPipConfig",
  "params": {}
}
```



返回：



```Plain Text
{
  "result": {
    "enabled": true,
    "main": {
      "source": "main_camera"
    },
    "overlay": {
      "source": "secondary_camera",
      "position": "bottom_right",
      "sizeRatio": 0.25,
      "marginRatio": 0.04
    }
  }
}
```



## 8\.6 事件



```Plain Text
{
  "event": "video.pipConfigChanged",
  "params": {
    "enabled": true,
    "overlay": {
      "source": "secondary_camera",
      "position": "bottom_right",
      "sizeRatio": 0.25
    },
    "reason": "user_request"
  }
}
```



---



# 9\. 是否需要 reset 方法



建议增加统一 reset：



```Plain Text
video.resetFramingConfig
video.resetOutputTransform
video.resetPipConfig
```



如果你们想减少方法数，也可以只提供：



```Plain Text
video.resetVideoCompositionConfig
```



但我更推荐分别 reset，语义更清楚。



## 9\.1 重置 Framing Config



```Plain Text
{
  "method": "video.resetFramingConfig",
  "params": {
    "items": ["splitScreen", "speakerTracking"]
  }
}
```



返回：



```Plain Text
{
  "result": {
    "splitScreen": {
      "maxSplitCount": 4,
      "autoAdjust": true,
      "layout": "auto"
    },
    "speakerTracking": {
      "delayMs": 800,
      "holdMs": 1500,
      "minConfidence": 0.7
    },
    "state": "applied"
  }
}
```



## 9\.2 重置 Output Transform



```Plain Text
{
  "method": "video.resetOutputTransform",
  "params": {}
}
```



返回：



```Plain Text
{
  "result": {
    "mirrorMode": "none",
    "rotation": 0,
    "aspectRatio": "auto",
    "scaleMode": "fit",
    "state": "applied"
  }
}
```



## 9\.3 重置 PIP



```Plain Text
{
  "method": "video.resetPipConfig",
  "params": {}
}
```



返回：



```Plain Text
{
  "result": {
    "enabled": false,
    "state": "applied"
  }
}
```



---



# 10\. 错误处理



建议错误码：



```Plain Text
UnsupportedCapability:
  设备不支持 framing、PIP、outputTransform 或某个具体 mode。

InvalidParams:
  参数类型错误、枚举非法、范围越界。

UnsupportedParameter:
  支持该能力，但不支持某个参数。

Conflict:
  参数组合冲突，例如 mode=picture_in_picture 但 pip 不支持 secondary_camera。

ServerBusy:
  视频链路繁忙，暂时不能应用。

Unavailable:
  视频输出未开启或当前通道不可用。
```



错误示例：



```Plain Text
{
  "error": {
    "code": "InvalidParams",
    "message": "splitScreen.maxSplitCount out of range",
    "data": {
      "field": "splitScreen.maxSplitCount",
      "min": 2,
      "max": 8
    }
  }
}
```



---



# 11\. 与其他域的边界



```Plain Text
camera:
  采集侧参数，例如 zoom、focus、exposure、whiteBalance、fieldOfView。

video:
  输出画面构图、追踪、分屏、PIP、镜像、旋转、比例、编码和输出流。

display:
  本机屏幕/OSD 显示，例如 OSD language、OSD mirror、屏幕亮度、显示布局。

audio:
  声源定位、beam 信息、音频算法。speaker_tracking 可以使用 audio 的 DOA/beam 结果，但配置仍属于 video framing。

sensor:
  陀螺仪、加速度计等传感器数据。
```



---



# 12\. 推荐 capability 注册



建议新增 capability ID：



```Plain Text
video.framing
video.outputTransform
video.pip
```

说明：

```Plain Text
Capability ID 使用 domain.feature 能力块。
framingMode、framingConfig、pipConfig 是方法/事件或 schema 层面的配置对象名，
不作为独立 capability ID。
```



对应方法：



```Plain Text
video.getFramingCapabilities

video.setFramingMode
video.getFramingMode
video.setFramingConfig
video.getFramingConfig
video.resetFramingConfig

video.setOutputTransform
video.getOutputTransform
video.resetOutputTransform

video.setPipConfig
video.getPipConfig
video.resetPipConfig
```



对应事件：



```Plain Text
video.framingModeChanged
video.framingConfigChanged
video.outputTransformChanged
video.pipConfigChanged
```



---



# 13\. 推荐 MVP 方法



如果第一版不想太大，建议 MVP 先做：



```Plain Text
video.getFramingCapabilities

video.setFramingMode
video.getFramingMode

video.setFramingConfig
video.getFramingConfig

video.setOutputTransform
video.getOutputTransform

video.framingModeChanged
video.framingConfigChanged
video.outputTransformChanged
```



PIP 可以作为第二阶段：



```Plain Text
video.setPipConfig
video.getPipConfig
video.pipConfigChanged
```



Reset 可以第一版就加，也可以第二版加：



```Plain Text
video.resetFramingConfig
video.resetOutputTransform
video.resetPipConfig
```



---



# 14\. 最终推荐接口清单



完整方案：



```Plain Text
video.getFramingCapabilities

video.setFramingMode
video.getFramingMode
video.framingModeChanged

video.setFramingConfig
video.getFramingConfig
video.resetFramingConfig
video.framingConfigChanged

video.setOutputTransform
video.getOutputTransform
video.resetOutputTransform
video.outputTransformChanged

video.setPipConfig
video.getPipConfig
video.resetPipConfig
video.pipConfigChanged
```



核心设计原则：



```Plain Text
framingMode:
  选择构图算法。

framingConfig:
  配置构图算法的专属参数。

outputTransform:
  配置通用输出画面变换，例如翻转、旋转、比例。

pipConfig:
  配置画中画，因为 PIP 结构复杂，建议独立。
```


