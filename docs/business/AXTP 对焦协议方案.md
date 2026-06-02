# AXTP 对焦协议方案

# Camera Focus 协议方案 v0\.1



## 1\. 归属域



Focus 相关能力归属：



```Plain Text
camera
```



原因：



```Plain Text
Focus 属于摄像头采集链路与镜头控制能力，不属于 video 输出构图，也不属于 diagnostic 校准流程。
```



注意区分：



```Plain Text
camera.*
  普通运行时对焦控制，例如自动对焦、手动对焦、对焦位置。

diagnostic.*
  产测/维修/工厂标定，例如 AF calibration。
```



---



## 2\. 方法清单



推荐定义以下方法：



```Plain Text
camera.getFocusCapabilities
camera.setFocusMode
camera.getFocusMode
camera.setFocusPosition
camera.getFocusPosition
camera.triggerAutoFocus
camera.stopFocus
camera.getFocusState
```



推荐定义以下事件：



```Plain Text
camera.focusModeChanged
camera.focusPositionChanged
camera.focusStateChanged
```



---



## 3\. Focus Mode



### 3\.1 对焦模式枚举



```Plain Text
manual
  手动对焦。上位机通过 focusPosition 控制对焦位置。

auto
  自动对焦。设备自动完成一次或持续对焦，具体行为由设备能力决定。

continuous_auto
  连续自动对焦。设备持续根据画面变化调整焦点。

one_shot_auto
  单次自动对焦。触发后完成一次对焦，然后停止。

fixed
  固定焦。设备不支持运行时调焦。

unsupported
  不支持对焦控制。
```



如果第一版不想太复杂，可以先支持：



```Plain Text
manual
auto
continuous_auto
fixed
```



---



## 4\. 查询 Focus 能力



### 方法



```Plain Text
camera.getFocusCapabilities
```



### 请求



```JSON
{
  "method": "camera.getFocusCapabilities",
  "params": {}
}
```



### 返回



```JSON
{
  "result": {
    "supported": true,
    "modes": [
      "manual",
      "auto",
      "continuous_auto",
      "one_shot_auto"
    ],
    "defaultMode": "continuous_auto",
    "position": {
      "supported": true,
      "min": 0,
      "max": 1023,
      "step": 1,
      "defaultValue": 512
    },
    "triggerAutoFocus": {
      "supported": true,
      "targets": [
        "center",
        "region",
        "full_frame"
      ]
    },
    "regionFocus": {
      "supported": true,
      "coordinateUnit": "normalized"
    }
  }
}
```



### 字段说明



```Plain Text
supported:
  是否支持 focus 控制。

modes:
  支持的对焦模式。

defaultMode:
  默认对焦模式。

position:
  手动对焦位置能力范围。

triggerAutoFocus:
  是否支持触发一次自动对焦。

regionFocus:
  是否支持指定区域对焦。
```



---



## 5\. 设置对焦模式



### 方法



```Plain Text
camera.setFocusMode
```



### 请求



```JSON
{
  "method": "camera.setFocusMode",
  "params": {
    "mode": "manual"
  }
}
```



### 返回



```JSON
{
  "result": {
    "mode": "manual",
    "state": "idle"
  }
}
```



### 事件



```JSON
{
  "event": "camera.focusModeChanged",
  "params": {
    "mode": "manual",
    "reason": "user_request"
  }
}
```



---



## 6\. 查询对焦模式



### 方法



```Plain Text
camera.getFocusMode
```



### 请求



```JSON
{
  "method": "camera.getFocusMode",
  "params": {}
}
```



### 返回



```JSON
{
  "result": {
    "mode": "manual"
  }
}
```



---



## 7\. 设置手动对焦位置



### 方法



```Plain Text
camera.setFocusPosition
```



### 请求



```JSON
{
  "method": "camera.setFocusPosition",
  "params": {
    "position": 320
  }
}
```



### 返回



```JSON
{
  "result": {
    "position": 320,
    "mode": "manual",
    "state": "idle"
  }
}
```



### 规则



```Plain Text
1. setFocusPosition 主要用于 manual 模式。
2. 如果当前不是 manual 模式，设备可以：
   a. 返回 Conflict；
   b. 或自动切换到 manual 模式后应用。
3. 推荐第一版采用显式规则：必须先 camera.setFocusMode(mode=manual)，再 setFocusPosition。
4. position 范围必须来自 camera.getFocusCapabilities。
```



### 事件



```JSON
{
  "event": "camera.focusPositionChanged",
  "params": {
    "position": 320,
    "mode": "manual",
    "reason": "user_request"
  }
}
```



---



## 8\. 查询手动对焦位置



### 方法



```Plain Text
camera.getFocusPosition
```



### 请求



```JSON
{
  "method": "camera.getFocusPosition",
  "params": {}
}
```



### 返回



```JSON
{
  "result": {
    "position": 320,
    "range": {
      "min": 0,
      "max": 1023,
      "step": 1
    },
    "mode": "manual"
  }
}
```



---



## 9\. 触发一次自动对焦



### 方法



```Plain Text
camera.triggerAutoFocus
```



### 请求：中心对焦



```JSON
{
  "method": "camera.triggerAutoFocus",
  "params": {
    "target": "center"
  }
}
```



### 请求：全画面对焦



```JSON
{
  "method": "camera.triggerAutoFocus",
  "params": {
    "target": "full_frame"
  }
}
```



### 请求：区域对焦



```JSON
{
  "method": "camera.triggerAutoFocus",
  "params": {
    "target": "region",
    "region": {
      "x": 0.35,
      "y": 0.30,
      "width": 0.30,
      "height": 0.25,
      "unit": "normalized"
    }
  }
}
```



### 返回



```JSON
{
  "result": {
    "accepted": true,
    "state": "focusing"
  }
}
```



### 字段说明



```Plain Text
target:
  center / full_frame / region

region:
  区域对焦坐标。
  推荐使用 normalized 坐标，范围 0.0 - 1.0。
```



---



## 10\. 停止对焦动作



### 方法



```Plain Text
camera.stopFocus
```



### 请求



```JSON
{
  "method": "camera.stopFocus",
  "params": {}
}
```



### 返回



```JSON
{
  "result": {
    "state": "idle"
  }
}
```



### 适用场景



```Plain Text
1. 停止正在进行的一次自动对焦。
2. 停止连续自动对焦。
3. 停止某些设备上的 focus scan 动作。
```



如果设备不支持停止，可以返回：



```Plain Text
UnsupportedCapability
```



---



## 11\. 查询对焦状态



### 方法



```Plain Text
camera.getFocusState
```



### 请求



```JSON
{
  "method": "camera.getFocusState",
  "params": {}
}
```



### 返回



```JSON
{
  "result": {
    "state": "focused",
    "mode": "continuous_auto",
    "position": 512,
    "confidence": 0.92
  }
}
```



### Focus State 枚举



```Plain Text
idle
  当前没有对焦动作。

focusing
  正在对焦。

focused
  已完成对焦。

failed
  对焦失败。

locked
  焦点锁定。

unavailable
  暂不可用，例如 camera 未打开。

unsupported
  不支持对焦状态查询。
```



---



## 12\. 对焦状态事件



### 事件



```Plain Text
camera.focusStateChanged
```



### 示例：开始对焦



```JSON
{
  "event": "camera.focusStateChanged",
  "params": {
    "state": "focusing",
    "mode": "one_shot_auto",
    "reason": "trigger_auto_focus"
  }
}
```



### 示例：对焦完成



```JSON
{
  "event": "camera.focusStateChanged",
  "params": {
    "state": "focused",
    "mode": "one_shot_auto",
    "position": 536,
    "confidence": 0.94,
    "reason": "focus_completed"
  }
}
```



### 示例：对焦失败



```JSON
{
  "event": "camera.focusStateChanged",
  "params": {
    "state": "failed",
    "mode": "one_shot_auto",
    "reason": "low_contrast"
  }
}
```



---



## 13\. 推荐字段规范



```Plain Text
mode:
  当前对焦模式。
  manual / auto / continuous_auto / one_shot_auto / fixed

position:
  手动对焦位置。
  类型建议 uint16 或 uint32。
  范围由 getFocusCapabilities 返回。

state:
  当前对焦状态。
  idle / focusing / focused / failed / locked / unavailable / unsupported

target:
  自动对焦目标。
  center / full_frame / region

region:
  区域对焦范围。

confidence:
  对焦置信度，范围 0.0 - 1.0。

reason:
  状态变化原因。
```



---



## 14\. 与 AF Calibration 的关系



Focus 控制与 AF Calibration 必须分开：



```Plain Text
camera.setFocusMode
camera.setFocusPosition
camera.triggerAutoFocus
  运行时对焦控制。

diagnostic.startAfCalibration
diagnostic.getAfCalibrationState
  工厂/产测/维修标定流程。
```



不要把 AF calibration 放进 camera focus 运行时协议。



---



## 15\. 推荐 MVP 方法



第一版至少实现：



```Plain Text
camera.getFocusCapabilities
camera.setFocusMode
camera.getFocusMode
camera.setFocusPosition
camera.getFocusPosition
camera.triggerAutoFocus
camera.getFocusState
camera.focusStateChanged
```



可选：



```Plain Text
camera.stopFocus
camera.focusModeChanged
camera.focusPositionChanged
```



---



## 16\. 旧协议映射建议



如果老协议里有：



```Plain Text
CommonSetManualFocusPosition
```



建议映射为：



```Plain Text
camera.setFocusPosition
```



如果老协议里有：



```Plain Text
CommonSetAutoFocus
CommonTriggerAutoFocus
```



建议映射为：



```Plain Text
camera.setFocusMode
camera.triggerAutoFocus
```



---



## 17\. 错误处理



建议错误码：



```Plain Text
UnsupportedCapability
  设备不支持 focus 控制或某个 focus 能力。

InvalidParams
  position 越界、mode 非法、region 坐标非法。

Conflict
  当前模式不允许设置该参数。
  例如当前 mode=continuous_auto 时直接 setFocusPosition。

ServerBusy
  摄像头正在执行其他互斥动作，例如 PTZ、framing 切换、AF calibration。

Unavailable
  摄像头未打开或当前视频链路不可用。
```



错误示例：



```JSON
{
  "error": {
    "code": "InvalidParams",
    "message": "focus position out of range",
    "data": {
      "field": "position",
      "min": 0,
      "max": 1023
    }
  }
}
```



---



## 18\. Capability 注册建议



在 capability 中增加：



```Plain Text
camera.focus
```



对应方法：



```Plain Text
camera.getFocusCapabilities
camera.setFocusMode
camera.getFocusMode
camera.setFocusPosition
camera.getFocusPosition
camera.triggerAutoFocus
camera.stopFocus
camera.getFocusState
```



对应事件：



```Plain Text
camera.focusModeChanged
camera.focusPositionChanged
camera.focusStateChanged
```



---



## 19\. 最终推荐接口清单



```Plain Text
camera.getFocusCapabilities

camera.setFocusMode
camera.getFocusMode
camera.focusModeChanged

camera.setFocusPosition
camera.getFocusPosition
camera.focusPositionChanged

camera.triggerAutoFocus
camera.stopFocus

camera.getFocusState
camera.focusStateChanged
```



