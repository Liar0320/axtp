# 09《AXTP MethodId 注册表》

版本：v1.1 Draft
状态：MVP MethodId 注册表（精简版）
适用范围：AXTP RPC MethodId 分配、Domain 分段、MVP 方法集合、老协议适配

---
## 1. MethodId 的位置

`methodId` 只出现在：

```text
PayloadType = RPC
rpcOp = REQUEST / RESPONSE
```

典型二进制 RPC 结构：

```text
AXTP Frame Header
  payloadType = RPC

RPC Payload
  rpcEncoding = BINARY / JSON / CBOR / MSGPACK
  rpcOp       = REQUEST / RESPONSE / EVENT / BATCH
  requestId
  methodOrEventId
  statusCode
  bodyEncoding
  body
```

其中：

```text
REQUEST / RESPONSE:
  methodOrEventId = methodId

EVENT:
  methodOrEventId = eventId
```

---

## 2. MethodId 基本规则

- `methodId` 使用 `uint16`，线上编码 Little-Endian
- 同一 Registry 中 `methodId` 不得重复，`methodName` 不得重复
- 进入 `stable` 状态后不得改变语义；语义变化时新增方法（如 `firmware.beginV2`），不修改旧方法
- 方法名格式：`domain.verbObject`
- 推荐动词：`get / set / list / open / close / start / stop / begin / end / verify / apply / abort / resume / subscribe / unsubscribe`

---

## 3. MethodId Domain 分段

| 范围 | Domain | 说明 | MVP |
|---:|---|---|---:|
| `0x0000-0x00FF` | reserved | 保留 | 否 |
| `0x0100-0x01FF` | `device.*` | 设备基础信息与生命周期 | 是 |
| `0x0200-0x02FF` | `session.*` | 协议层保留，暂缓 | 否 |
| `0x0300-0x03FF` | `capability.*` | 能力查询与能力协商 | 是 |
| `0x0400-0x04FF` | `system.*` | 系统控制：重启、时间、重置、功耗 | 是 |
| `0x0500-0x05FF` | `display.*` | 显示控制：亮度、分辨率、旋转、布局、输入源 | 是 |
| `0x0600-0x06FF` | `camera.*` | 摄像头：变焦、追踪、镜像、帧率、图像参数 | 可选 |
| `0x0700-0x07FF` | `video.*` | 视频编码与输出控制 | 可选 |
| `0x0800-0x08FF` | `audio.*` | 音频控制 | 可选 |
| `0x0900-0x09FF` | `stream.*` | STREAM 控制面 | 是 |
| `0x0A00-0x0AFF` | `file.*` | 文件传输控制面 | P1 |
| `0x0B00-0x0BFF` | `firmware.*` | OTA / 固件升级控制面 | 是 |
| `0x0C00-0x0CFF` | `log.*` | 日志控制面 | P1 |
| `0x0D00-0x0DFF` | `diagnostic.*` | 诊断、产测、链路测试 | P1 |
| `0x0E00-0x0EFF` | `network.*` | 网络配置 | P2 |
| `0x0F00-0x0FFF` | `storage.*` | 存储管理 | P2 |
| `0x1000-0x10FF` | `input.*` | 输入、KVM、HID Raw 控制 | P1 |
| `0x1100-0x11FF` | `sensor.*` | 传感器控制 | P2 |
| `0x1200-0x12FF` | `auth.*` | 认证与访问控制 | P2 |
| `0x1300-0x13FF` | `privacy.*` | 隐私遮挡与隐私状态 | P2 |
| `0x7000-0x7FFF` | `vendor.*` | 厂商私有方法 | 按需 |
| `0x8000-0xFFFF` | reserved | 不用于 MethodId，保留给 EventId | 否 |

---

## 4. Method 条目字段

```yaml
id: 0x0502
name: display.setBrightness
kind: method
status: mvp
domain: display
description: Set display brightness value.
rpc:
  request: true
  response: true
  event: false
  supportedEncodings:
    - JSON
    - BINARY
  supportedBodyEncodings:
    - TLV8
schema:
  params: DisplaySetBrightnessParams
  result: DisplaySetBrightnessResult
errors:
  - SUCCESS
  - RPC_PARAM_INVALID
  - RPC_METHOD_NOT_SUPPORTED
  - BUSY
events:
  - display.brightnessChanged
capability:
  required:
    - display.brightness
legacy:
  cmdValue: null
  source: null
  payloadMapping: null
version:
  since: 1.0.0
  deprecated: null
mvp: true
priority: P0
```

| 字段 | 必填 | 说明 |
|---|---:|---|
| `id` | 是 | `uint16` 方法编号 |
| `name` | 是 | 方法名 |
| `kind` | 是 | 固定为 `method` |
| `status` | 是 | `draft / mvp / stable / deprecated / reserved` |
| `domain` | 是 | 所属业务域 |
| `description` | 是 | 方法说明 |
| `rpc.supportedEncodings` | 是 | 支持的 RPC body 编码 |
| `schema.params` | 是 | 请求参数 Schema |
| `schema.result` | 是 | 响应结果 Schema |
| `errors` | 是 | 可能返回的错误码 |
| `events` | 否 | 可能触发的事件 |
| `capability.required` | 否 | 调用前需要满足的能力 |
| `legacy` | 否 | 老协议映射 |
| `mvp` | 是 | 是否属于 MVP |
| `priority` | 是 | `P0 / P1 / P2` |

---

## 5. MVP 最小方法集合

MVP 方法表以 `standard/registry/method_registry.yaml` 为事实源。当前 AXTP v1 MVP 只包含下列已注册方法；其他方法即使出现在后续规划表中，也不得视为当前实现合同。

| methodId | methodName | Domain | 优先级 | 说明 |
|---:|---|---|---|---|
| `0x0101` | `device.getInfo` | device | P0 | 获取设备基础信息 |
| `0x0301` | `capability.supportedMethods` | capability | P0 | 获取当前会话可调用 methodId 集合 |
| `0x0501` | `display.getBrightness` | display | P0 | 获取当前亮度 |
| `0x0502` | `display.setBrightness` | display | P0 | 设置亮度 |
| `0x0B02` | `firmware.begin` | firmware | P0 | 开始升级，返回 transferId/streamId |
| `0x0B03` | `firmware.end` | firmware | P0 | 结束固件数据传输 |
| `0x0B04` | `firmware.verify` | firmware | P0 | 校验固件镜像 |
| `0x0B05` | `firmware.apply` | firmware | P0 | 应用固件 |

说明：事件本身使用 EventId，通过 `rpcOp = EVENT` 承载。事件订阅集合由 RPC `IDENTIFY / REIDENTIFY` 的 `eventSubscriptions` 字段声明和更新，MVP 不再分配 `event.subscribe / event.unsubscribe` MethodId。

---

## 6. 完整 MethodId 规划表

以下表格是领域规划草案，用于保留编号空间和讨论未来能力；当前实现状态以 `standard/registry/method_registry.yaml` 及生成产物为准。

### 6.1 device.*

| methodId | methodName | 状态 | MVP | 说明 |
|---:|---|---|---:|---|
| `0x0101` | `device.getInfo` | mvp | 是 | 获取设备基础信息 |
| `0x0102` | `device.getVersion` | draft | 否 | 获取版本信息 |
| `0x0103` | `device.getStatus` | draft | 否 | 获取设备状态 |
| `0x0104` | `device.getSerialNumber` | draft | 否 | 获取序列号 |
| `0x0105` | `device.getModel` | draft | 否 | 获取设备型号 |
| `0x0106` | `device.setName` | draft | 否 | 设置设备名称 |
| `0x0107` | `device.getName` | draft | 否 | 获取设备名称 |
| `0x0108` | `device.reboot` | draft | 否 | 重启设备 |
| `0x0109` | `device.factoryReset` | draft | 否 | 恢复出厂设置 |
| `0x010A` | `device.identify` | draft | 否 | 设备识别，例如闪灯、蜂鸣 |

### 6.2 capability.*

| methodId | methodName | 状态 | MVP | 说明 |
|---:|---|---|---:|---|
| `0x0301` | `capability.supportedMethods` | mvp | 是 | 获取当前会话可调用 methodId 集合 |
| `0x0302` | `capability.getAll` | draft | 否 | 获取完整能力集 |
| `0x0303` | `capability.getDomain` | draft | 否 | 获取指定 domain 能力 |
| `0x0304` | `capability.hasMethod` | draft | 否 | 查询是否支持某方法 |
| `0x0305` | `capability.getLimits` | draft | 否 | 获取传输与资源限制 |
| `0x0306` | `capability.getPayloadTypes` | draft | 否 | 获取支持的 PayloadType |
| `0x0307` | `capability.getRpcEncodings` | draft | 否 | 获取 RPC 编码能力 |
| `0x0308` | `capability.getStreamProfiles` | draft | 否 | 获取 Stream 类型能力 |
| `0x0309` | `capability.getCodecs` | draft | 否 | 获取音视频编解码能力 |
| `0x030A` | `capability.negotiate` | draft | 否 | 业务能力协商 |

协议能力优先通过 CONTROL OPEN / ACCEPT 协商；业务能力通过 `capability.*` RPC 查询。

### 6.3 system.*

| methodId | methodName | 状态 | MVP | 说明 |
|---:|---|---|---:|---|
| `0x0401` | `system.reboot` | draft | 否 | 重启设备 |
| `0x0402` | `system.setTime` | draft | 否 | 设置系统时间与时区 |
| `0x0403` | `system.getTime` | draft | 否 | 获取系统时间 |
| `0x0404` | `system.factoryReset` | draft | 否 | 恢复出厂设置 |
| `0x0405` | `system.getUptime` | draft | 否 | 获取系统运行时长 |
| `0x0406` | `system.setRebootSchedule` | draft | 否 | 设置定时重启 |
| `0x0407` | `system.getRebootSchedule` | draft | 否 | 获取定时重启配置 |
| `0x0408` | `system.setPowerSchedule` | draft | 否 | 设置定时开关机 |
| `0x0409` | `system.getPowerSchedule` | draft | 否 | 获取定时开关机配置 |
| `0x040A` | `system.shutdown` | draft | 否 | 关机 |

### 6.4 display.*

`display.*` 涵盖显示输出控制，包含亮度、分辨率、旋转、布局及输入源管理。

| methodId | methodName | 状态 | MVP | 说明 |
|---:|---|---|---:|---|
| `0x0501` | `display.getBrightness` | mvp | 是 | 获取当前亮度 |
| `0x0502` | `display.setBrightness` | mvp | 是 | 设置亮度 |
| `0x0503` | `display.getBrightnessRange` | draft | 否 | 获取亮度范围 |
| `0x0504` | `display.setBrightnessAutoMode` | draft | 否 | 设置自动亮度 |
| `0x0505` | `display.getBrightnessAutoMode` | draft | 否 | 获取自动亮度状态 |
| `0x0506` | `display.getInfo` | draft | 否 | 获取显示设备信息 |
| `0x0507` | `display.getStatus` | draft | 否 | 获取显示状态 |
| `0x0508` | `display.setPower` | draft | 否 | 设置屏幕电源 |
| `0x0509` | `display.getPower` | draft | 否 | 获取屏幕电源状态 |
| `0x050A` | `display.setResolution` | draft | 否 | 设置输出分辨率 |
| `0x050B` | `display.getResolution` | draft | 否 | 获取输出分辨率 |
| `0x050C` | `display.setRotation` | draft | 否 | 设置旋转方向 |
| `0x050D` | `display.getRotation` | draft | 否 | 获取旋转方向 |
| `0x050E` | `display.setLayout` | draft | 否 | 设置多画面布局 |
| `0x050F` | `display.getLayout` | draft | 否 | 获取多画面布局 |
| `0x0510` | `display.setInputSource` | draft | 否 | 设置输入源 |
| `0x0511` | `display.getInputSource` | draft | 否 | 获取输入源 |

### 6.5 camera.*

`camera.*` 只定义摄像头控制面。视频帧数据必须走 STREAM（`profile = media.video`）。

| methodId | methodName | 状态 | MVP | 说明 |
|---:|---|---|---:|---|
| `0x0601` | `camera.getInfo` | draft | 否 | 获取摄像头信息 |
| `0x0602` | `camera.setVideoMode` | draft | 否 | 设置视频模式（自动取景/演讲者追踪等） |
| `0x0603` | `camera.getVideoMode` | draft | 否 | 获取视频模式 |
| `0x0604` | `camera.setMirror` | draft | 否 | 设置镜像翻转 |
| `0x0605` | `camera.getMirror` | draft | 否 | 获取镜像状态 |
| `0x0606` | `camera.setZoom` | draft | 否 | 设置数字变焦 |
| `0x0607` | `camera.getZoom` | draft | 否 | 获取变焦信息 |
| `0x0608` | `camera.setFocusMode` | draft | 否 | 设置对焦模式 |
| `0x0609` | `camera.getFocusMode` | draft | 否 | 获取对焦模式 |
| `0x060A` | `camera.setImageParams` | draft | 否 | 设置图像参数（亮度/对比度/饱和度） |
| `0x060B` | `camera.getImageParams` | draft | 否 | 获取图像参数 |
| `0x060C` | `camera.setSpeakerTrack` | draft | 否 | 设置演讲者追踪配置 |
| `0x060D` | `camera.getSpeakerTrack` | draft | 否 | 获取演讲者追踪配置 |
| `0x060E` | `camera.getPeopleCount` | draft | 否 | 获取人数统计 |

### 6.6 video.*

`video.*` 只定义视频编码与输出控制面。视频帧数据必须走 STREAM（`profile = media.video`）。

| methodId | methodName | 状态 | MVP | 说明 |
|---:|---|---|---:|---|
| `0x0701` | `video.getSources` | draft | 否 | 获取视频源列表 |
| `0x0702` | `video.getSourceInfo` | draft | 否 | 获取视频源信息 |
| `0x0703` | `video.setSource` | draft | 否 | 设置当前视频源 |
| `0x0704` | `video.getSource` | draft | 否 | 获取当前视频源 |
| `0x0705` | `video.getMode` | draft | 否 | 获取视频模式 |
| `0x0706` | `video.setMode` | draft | 否 | 设置视频模式 |
| `0x0707` | `video.getResolution` | draft | 否 | 获取分辨率 |
| `0x0708` | `video.setResolution` | draft | 否 | 设置分辨率 |
| `0x0709` | `video.getFrameRate` | draft | 否 | 获取帧率 |
| `0x070A` | `video.setFrameRate` | draft | 否 | 设置帧率 |
| `0x070B` | `video.getCodec` | draft | 否 | 获取视频编码 |
| `0x070C` | `video.setCodec` | draft | 否 | 设置视频编码 |
| `0x070D` | `video.startPreview` | draft | 否 | 开始预览流 |
| `0x070E` | `video.stopPreview` | draft | 否 | 停止预览流 |
| `0x070F` | `video.captureFrame` | draft | 否 | 截图 |
| `0x0710` | `video.setImageParams` | draft | 否 | 设置图像参数 |
| `0x0711` | `video.getImageParams` | draft | 否 | 获取图像参数 |

### 6.6 audio.*

`audio.*` 只定义音频控制面。音频帧数据必须走 STREAM（`profile = media.audio`）。

| methodId | methodName | 状态 | MVP | 说明 |
|---:|---|---|---:|---|
| `0x0801` | `audio.getDevices` | draft | 否 | 获取音频设备列表 |
| `0x0802` | `audio.getDeviceInfo` | draft | 否 | 获取音频设备信息 |
| `0x0803` | `audio.setInputDevice` | draft | 否 | 设置输入设备 |
| `0x0804` | `audio.getInputDevice` | draft | 否 | 获取输入设备 |
| `0x0805` | `audio.setOutputDevice` | draft | 否 | 设置输出设备 |
| `0x0806` | `audio.getOutputDevice` | draft | 否 | 获取输出设备 |
| `0x0807` | `audio.setVolume` | draft | 否 | 设置音量 |
| `0x0808` | `audio.getVolume` | draft | 否 | 获取音量 |
| `0x0809` | `audio.setMute` | draft | 否 | 设置静音 |
| `0x080A` | `audio.getMute` | draft | 否 | 获取静音状态 |
| `0x080B` | `audio.startStream` | draft | 否 | 开始音频流 |
| `0x080C` | `audio.stopStream` | draft | 否 | 停止音频流 |

### 6.7 stream.*

`stream.*` 是 STREAM 数据面的控制面。

| methodId | methodName | 状态 | MVP | 说明 |
|---:|---|---|---:|---|
| `0x0901` | `stream.open` | draft | 否 | 打开数据流 |
| `0x0902` | `stream.close` | draft | 否 | 关闭数据流 |
| `0x0903` | `stream.getStatus` | draft | 否 | 获取流状态 |
| `0x0904` | `stream.getStats` | draft | 否 | 获取流统计 |
| `0x0905` | `stream.pause` | draft | 否 | 暂停流 |
| `0x0906` | `stream.resume` | draft | 否 | 恢复流 |
| `0x0907` | `stream.setParams` | draft | 否 | 设置流参数 |
| `0x0908` | `stream.getParams` | draft | 否 | 获取流参数 |
| `0x0909` | `stream.setQos` | draft | 否 | 设置 QoS |
| `0x090A` | `stream.requestKeyFrame` | draft | 否 | 请求关键帧 |
| `0x090B` | `stream.subscribe` | draft | 否 | 订阅流 |
| `0x090C` | `stream.unsubscribe` | draft | 否 | 取消订阅流 |

### 6.8 file.*

文件数据块必须走 STREAM（当前规划 profile = `file.transfer`）。

| methodId | methodName | 状态 | MVP | 说明 |
|---:|---|---|---:|---|
| `0x0A01` | `file.open` | draft | 否 | 打开文件 |
| `0x0A02` | `file.close` | draft | 否 | 关闭文件 |
| `0x0A03` | `file.read` | draft | 否 | 读取文件 |
| `0x0A04` | `file.write` | draft | 否 | 写入文件 |
| `0x0A05` | `file.delete` | draft | 否 | 删除文件 |
| `0x0A06` | `file.list` | draft | 否 | 列出文件 |
| `0x0A07` | `file.getInfo` | draft | 否 | 获取文件信息 |
| `0x0A08` | `file.beginTransfer` | draft | 否 | 开始文件传输 |
| `0x0A09` | `file.endTransfer` | draft | 否 | 结束文件传输 |
| `0x0A0A` | `file.abortTransfer` | draft | 否 | 中止文件传输 |
| `0x0A0B` | `file.resumeTransfer` | draft | 否 | 断点续传 |
| `0x0A0C` | `file.verify` | draft | 否 | 校验文件 |

### 6.9 firmware.*

固件升级采用 RPC 控制面 + STREAM OTA 数据面：`firmware.begin → STREAM OTA chunk → firmware.end → firmware.verify → firmware.apply`。

| methodId | methodName | 状态 | MVP | 说明 |
|---:|---|---|---:|---|
| `0x0B01` | `firmware.getInfo` | draft | 否 | 获取固件信息 |
| `0x0B02` | `firmware.begin` | mvp | 是 | 开始升级 |
| `0x0B03` | `firmware.end` | mvp | 是 | 结束数据传输 |
| `0x0B04` | `firmware.verify` | mvp | 是 | 校验固件 |
| `0x0B05` | `firmware.apply` | mvp | 是 | 应用固件 |
| `0x0B06` | `firmware.abort` | draft | 否 | 中止升级 |
| `0x0B07` | `firmware.resume` | draft | 否 | 断点续传 |
| `0x0B08` | `firmware.getProgress` | draft | 否 | 获取升级进度 |
| `0x0B09` | `firmware.rollback` | draft | 否 | 固件回滚 |
| `0x0B0A` | `firmware.getSlots` | draft | 否 | 获取 A/B 分区信息 |

### 6.10 log.*

实时日志可走 STREAM（`profile = log.realtime`）；日志控制走 RPC。

| methodId | methodName | 状态 | MVP | 说明 |
|---:|---|---|---:|---|
| `0x0C01` | `log.getLevel` | draft | 否 | 获取日志等级 |
| `0x0C02` | `log.setLevel` | draft | 否 | 设置日志等级 |
| `0x0C03` | `log.startStream` | draft | 否 | 开始实时日志流 |
| `0x0C04` | `log.stopStream` | draft | 否 | 停止实时日志流 |
| `0x0C05` | `log.export` | draft | 否 | 导出日志 |
| `0x0C06` | `log.clear` | draft | 否 | 清空日志 |
| `0x0C07` | `log.getCategories` | draft | 否 | 获取日志分类 |
| `0x0C08` | `log.setFilter` | draft | 否 | 设置日志过滤条件 |

### 6.11 diagnostic.*

| methodId | methodName | 状态 | MVP | 说明 |
|---:|---|---|---:|---|
| `0x0D01` | `diagnostic.ping` | draft | 否 | 业务层 Ping |
| `0x0D02` | `diagnostic.selfTest` | draft | 否 | 设备自检 |
| `0x0D03` | `diagnostic.getReport` | draft | 否 | 获取诊断报告 |
| `0x0D04` | `diagnostic.runTest` | draft | 否 | 执行指定测试 |
| `0x0D05` | `diagnostic.stopTest` | draft | 否 | 停止测试 |
| `0x0D06` | `diagnostic.getMetrics` | draft | 否 | 获取运行指标 |
| `0x0D07` | `diagnostic.getTemperature` | draft | 否 | 获取温度 |
| `0x0D08` | `diagnostic.getLinkQuality` | draft | 否 | 获取链路质量 |
| `0x0D09` | `diagnostic.loopback` | draft | 否 | 回环测试 |

### 6.12 input.*

高频输入数据走 STREAM（`profile = control.hid_raw`）；低频输入控制走 RPC。

| methodId | methodName | 状态 | MVP | 说明 |
|---:|---|---|---:|---|
| `0x1001` | `input.getDevices` | draft | 否 | 获取输入设备 |
| `0x1002` | `input.enable` | draft | 否 | 启用输入 |
| `0x1003` | `input.disable` | draft | 否 | 禁用输入 |
| `0x1004` | `input.sendKey` | draft | 否 | 发送按键 |
| `0x1005` | `input.sendMouse` | draft | 否 | 发送鼠标事件 |
| `0x1006` | `input.sendTouch` | draft | 否 | 发送触控事件 |
| `0x1007` | `input.openKvm` | draft | 否 | 开启 KVM |
| `0x1008` | `input.closeKvm` | draft | 否 | 关闭 KVM |
| `0x1009` | `input.setKvmMode` | draft | 否 | 设置 KVM 模式 |
| `0x100A` | `input.getKvmStatus` | draft | 否 | 获取 KVM 状态 |
| `0x100B` | `input.sendHidReport` | draft | 否 | 发送 HID Report |

### 6.13 network.*

`network.*` 覆盖 Wi-Fi、以太网、IP、NDI 等网络配置控制面。

| methodId | methodName | 状态 | MVP | 说明 |
|---:|---|---|---:|---|
| `0x0E01` | `network.getStatus` | draft | 否 | 获取网络状态 |
| `0x0E02` | `network.getInterfaces` | draft | 否 | 获取网络接口 |
| `0x0E03` | `network.setWifi` | draft | 否 | 设置 Wi-Fi |
| `0x0E04` | `network.getWifi` | draft | 否 | 获取 Wi-Fi 配置 |
| `0x0E05` | `network.setIpConfig` | draft | 否 | 设置 IP 配置 |
| `0x0E06` | `network.getIpConfig` | draft | 否 | 获取 IP 配置 |

### 6.14 storage.*

| methodId | methodName | 状态 | MVP | 说明 |
|---:|---|---|---:|---|
| `0x0F01` | `storage.getInfo` | draft | 否 | 获取存储信息 |
| `0x0F02` | `storage.listVolumes` | draft | 否 | 列出存储卷 |
| `0x0F03` | `storage.format` | draft | 否 | 格式化存储卷 |

### 6.15 sensor.*

| methodId | methodName | 状态 | MVP | 说明 |
|---:|---|---|---:|---|
| `0x1101` | `sensor.getInfo` | draft | 否 | 获取传感器信息 |
| `0x1102` | `sensor.getValue` | draft | 否 | 获取传感器当前值 |
| `0x1103` | `sensor.openStream` | draft | 否 | 打开传感器采样流 |
| `0x1104` | `sensor.closeStream` | draft | 否 | 关闭传感器采样流 |

### 6.16 auth.*

| methodId | methodName | 状态 | MVP | 说明 |
|---:|---|---|---:|---|
| `0x1201` | `auth.login` | draft | 否 | 登录或提交凭证 |
| `0x1202` | `auth.logout` | draft | 否 | 注销 |
| `0x1203` | `auth.refreshToken` | draft | 否 | 刷新访问令牌 |
| `0x1204` | `auth.getPermissions` | draft | 否 | 查询权限集合 |

### 6.17 privacy.*

隐私遮挡属于通用业务域；具体云台、镜头盖、麦克风静音联动可以在 `camera.*`、`audio.*` 或 `vendor.*` 中扩展。

| methodId | methodName | 状态 | MVP | 说明 |
|---:|---|---|---:|---|
| `0x1301` | `privacy.setMode` | draft | 否 | 设置隐私模式 |
| `0x1302` | `privacy.getMode` | draft | 否 | 获取隐私模式 |
| `0x1303` | `privacy.setMask` | draft | 否 | 设置隐私遮挡区域 |
| `0x1304` | `privacy.getMask` | draft | 否 | 获取隐私遮挡区域 |

---

## 7. 老协议适配 MethodId 表

老协议适配不要求保持原始 `CmdValue` 数值，但必须保留原有业务语义。映射必须记录在 `legacy_cmd_mapping.yaml` 中。

如果老协议 `CmdValue` 超过 `uint16`，不应直接作为 `methodId` 使用，应映射为 AXTP 新 methodId，并在 `legacy.cmdValue` 中记录原值。

| 老协议来源 | legacy CmdValue | 旧命令语义 | AXTP methodId | AXTP methodName | MVP | 说明 |
|---|---:|---|---:|---|---:|---|
| AXDP_HID | `0xB0002` | BetaDeviceInfo | `0x0101` | `device.getInfo` | 是 | 设备信息查询 |
| AXDP_HID | `0xC0021` | CommonSetVideoMode | `0x0706` | `video.setMode` | 可选 | 视频模式设置，P1 适配 |
| AXDP_HID | `0xA0001` | AlphaUpgradeInfo | `0x0B01` | `firmware.getInfo` | 是 | 固件升级信息查询 |
| Legacy HID/BLE | TBD | GetBrightness | `0x0501` | `display.getBrightness` | 是 | 若旧协议存在亮度查询命令，应映射到此方法 |
| Legacy HID/BLE | TBD | SetBrightness | `0x0502` | `display.setBrightness` | 是 | 若旧协议存在亮度设置命令，应映射到此方法 |
| Legacy HID/BLE | TBD | UpgradeBegin | `0x0B02` | `firmware.begin` | 是 | 若旧协议存在升级开始命令，应映射到此方法 |
| Legacy HID/BLE | TBD | UpgradeEnd | `0x0B03` | `firmware.end` | 是 | 若旧协议存在升级结束命令，应映射到此方法 |
| Legacy HID/BLE | TBD | UpgradeVerify | `0x0B04` | `firmware.verify` | 是 | 若旧协议存在升级校验命令，应映射到此方法 |

TBD 表示需要从老协议表中补充具体 CmdValue，后续在 `legacy_cmd_mapping.yaml` 中补齐。

---

## 8. Method 与 Schema 的关系

每个 Method 必须引用 `Params Schema` 和 `Result Schema`。即使没有参数或返回数据，也必须显式声明 `EmptyParams` / `EmptyResult`。

---

## 9. Method 与 ErrorCode 的关系

每个 Method 必须声明可能返回的错误码。MVP 方法至少包含：

```text
SUCCESS / INVALID_ARGUMENT / RPC_METHOD_NOT_SUPPORTED / BUSY / INTERNAL_ERROR
```

固件升级类方法还应包含：

```text
FW_IMAGE_INVALID / FW_VERIFY_FAILED / FW_VERSION_UNSUPPORTED
FW_STORAGE_NOT_ENOUGH / FW_ROLLBACK_FAILED
```

Stream 类方法还应包含：

```text
STREAM_NOT_FOUND / STREAM_WINDOW_FULL / STREAM_TIMEOUT
```

---

## 10. Method 与 Capability 的关系

Method 是否可调用，应结合 Capability Registry 判断。调用流程：

```text
1. 通过 capability.supportedMethods 获取 method bitmap
2. 检查目标 method 是否在 supportedMethods 中
3. 检查相关 capability 是否满足
4. 发送 RPC Request
5. 若设备不支持，返回 RPC_METHOD_NOT_SUPPORTED 或 CAPABILITY_METHOD_UNSUPPORTED
```

---

## 11. Method 与 Event 的关系

如果 Method 会触发事件，应在条目中声明（如 `display.setBrightness` 触发 `display.brightnessChanged`）。事件本身不使用 MethodId，而使用 EventId，通过 `rpcOp = EVENT` 承载。

---

## 12. Generator v1 校验规则

Generator 必须执行以下校验：

```text
methodId 不重复 / methodName 不重复 / methodId 范围与 domain 匹配
status 合法 / mvp 条目必须 priority = P0 或 P1
params schema 必须存在 / result schema 必须存在
errorCode 必须存在 / event 引用必须存在 / capability 引用必须存在
legacy mapping 的 axtpMethodId 必须存在
```

校验失败时，应停止生成。
