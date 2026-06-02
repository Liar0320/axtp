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
- 方法名格式：`domain.verbFeatureNoun`，feature 归属遵循 21《AXTP Capability Naming and Feature Taxonomy》
- 推荐动词：`get / set / list / open / close / start / stop / begin / end / verify / apply / abort / resume / subscribe / unsubscribe`
- 配置、状态、动作、流、导出必须使用不同模板；`stream.*` 不定义常规业务建流方法

---

## 3. MethodId Domain 分段

| 范围 | Domain | 说明 | MVP |
|---:|---|---|---:|
| `0x0000-0x00FF` | reserved | 保留 | 否 |
| `0x0100-0x01FF` | `device.*` | 设备基础信息与生命周期 | 是 |
| `0x0200-0x02FF` | `capability.*` | 能力查询与能力协商 | 是 |
| `0x0300-0x03FF` | `system.*` | 系统控制：重启、时间、重置、功耗 | 是 |
| `0x0400-0x04FF` | `firmware.*` | OTA / 固件升级控制面 | 是 |
| `0x0500-0x05FF` | `stream.*` | STREAM 控制面 | 是 |
| `0x0600-0x06FF` | `display.*` | 显示控制：亮度、分辨率、旋转、布局、输入源 | 是 |
| `0x0700-0x07FF` | `camera.*` | 摄像头：变焦、追踪、镜像、帧率、图像参数 | 可选 |
| `0x0800-0x08FF` | `video.*` | 视频编码与输出控制 | 可选 |
| `0x0900-0x09FF` | `audio.*` | 音频控制 | 可选 |
| `0x0A00-0x0AFF` | `input.*` | 输入、KVM、HID Raw 控制 | P1 |
| `0x0B00-0x0BFF` | `output.*` | 输出源、输出路由与输出布局 | P2 |
| `0x0C00-0x0CFF` | `room.*` | 会议室 / 协作空间业务 | P2 |
| `0x0D00-0x0DFF` | `signage.*` | 数字标牌业务 | P2 |
| `0x0E00-0x0EFF` | `network.*` | 网络配置 | P2 |
| `0x0F00-0x0FFF` | `storage.*` | 存储管理 | P2 |
| `0x1000-0x10FF` | `file.*` | 文件传输控制面 | P1 |
| `0x1100-0x11FF` | `log.*` | 日志控制面 | P1 |
| `0x1200-0x12FF` | `diagnostic.*` | 诊断、产测、链路测试 | P1 |
| `0x1300-0x13FF` | `sensor.*` | 传感器控制 | P2 |
| `0x1400-0x14FF` | `auth.*` | 认证与访问控制 | P2 |
| `0x1500-0x15FF` | `privacy.*` | 隐私遮挡与隐私状态 | P2 |
| `0x7000-0x7FFF` | `vendor.*` | 厂商私有方法 | 按需 |
| `0x8000-0xFFFF` | reserved | 保留，不用于 MethodId/EventId | 否 |

---

## 4. Method 条目字段

```yaml
id: 0x0602
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
| `schema.params` | 是 | 请求参数 Schema（registry YAML 中对应 `requestSchema`） |
| `schema.result` | 是 | 响应结果 Schema（registry YAML 中对应 `responseSchema`） |
| `errors` | 是 | 可能返回的错误码 |
| `events` | 否 | 可能触发的事件 |
| `capability.required` | 否 | 调用前需要满足的能力 |
| `legacy` | 否 | 老协议映射 |
| `mvp` | 是 | 是否属于 MVP |
| `priority` | 是 | `P0 / P1 / P2` |

---

## 5. MVP 最小方法集合

MVP 方法表以 `registry/method/method_registry.yaml` 与 `registry/domains/<domain>/domain.yaml` 为事实源。当前 AXTP v1 MVP 只包含下列已注册为 `mvp` 的方法；其他方法即使出现在后续规划表中，也不得视为当前 MVP 实现合同。

| methodId | methodName | Domain | 优先级 | 说明 |
|---:|---|---|---|---|
| `0x0101` | `device.getInfo` | device | P0 | 获取设备基础信息 |
| `0x0201` | `capability.supportedMethods` | capability | P0 | 获取当前会话可调用 methodId 集合 |
| `0x0601` | `display.getBrightness` | display | P0 | 获取当前亮度 |
| `0x0602` | `display.setBrightness` | display | P0 | 设置亮度 |
| `0x0402` | `firmware.beginOta` | firmware | P0 | 开始 OTA，返回 transferId/streamId |
| `0x0403` | `firmware.commitOtaBatch` | firmware | P0 | 提交已传输 OTA 数据批次 |
| `0x0404` | `firmware.verifyOtaFiles` | firmware | P0 | 校验 OTA 文件 |
| `0x0405` | `firmware.installOta` | firmware | P0 | 安装已校验 OTA |

说明：事件本身使用 EventId，通过 `rpcOp = EVENT` 承载。事件订阅集合由 RPC `IDENTIFY / REIDENTIFY` 的 `eventSubscriptions` 字段声明和更新，MVP 不再分配 `event.subscribe / event.unsubscribe` MethodId。当前 registry YAML 尚未完成本轮 domain-feature 迁移；本 source 表使用目标主名称，旧名只在迁移说明中出现。

---

## 6. 完整 MethodId 规划表

以下表格是领域规划草案，用于保留编号空间和讨论未来能力；当前实现状态以 `registry/method/method_registry.yaml`、`registry/domains/<domain>/domain.yaml` 及生成产物为准。

### 6.1 device.*

| methodId | methodName | 状态 | MVP | 说明 |
|---:|---|---|---:|---|
| `0x0101` | `device.getInfo` | mvp | 是 | 获取设备基础信息 |
| `0x0102` | `device.getIdentity` | draft | 否 | 获取设备身份字段 |
| `0x0103` | `device.getState` | draft | 否 | 获取设备状态 |
| `0x0104` | `device.getInventory` | draft | 否 | 获取设备库存/子模块信息 |
| `0x0105` | `device.setIndicatorConfig` | draft | 否 | 设置指示灯/蜂鸣提示配置 |
| `0x0106` | `device.getIndicatorConfig` | draft | 否 | 获取指示灯/蜂鸣提示配置 |
| `0x0107` | `device.getPowerState` | draft | 否 | 获取电源状态 |
| `0x0108` | `device.setPowerConfig` | draft | 否 | 设置设备电源配置 |
| `0x0109` | `device.getChildDeviceState` | draft | 否 | 获取子设备状态 |

### 6.2 capability.*

| methodId | methodName | 状态 | MVP | 说明 |
|---:|---|---|---:|---|
| `0x0201` | `capability.supportedMethods` | mvp | 是 | 获取当前会话可调用 methodId 集合 |
| `0x0202` | `capability.getRegistry` | draft | 否 | 获取完整能力注册表摘要 |
| `0x0203` | `capability.getDomainRegistry` | draft | 否 | 获取指定 domain 的能力摘要 |
| `0x0204` | `capability.hasMethod` | draft | 否 | 查询是否支持某方法 |
| `0x0205` | `capability.getLimits` | draft | 否 | 获取传输与资源限制 |
| `0x0206` | `capability.negotiate` | draft | 否 | 业务能力协商 |

协议能力优先通过 CONTROL OPEN / ACCEPT 协商；业务能力通过 `capability.*` RPC 查询。

### 6.3 system.*

| methodId | methodName | 状态 | MVP | 说明 |
|---:|---|---|---:|---|
| `0x0301` | `system.reboot` | draft | 否 | 重启设备 |
| `0x0302` | `system.getTimeConfig` | draft | 否 | 获取系统时间与时区配置 |
| `0x0303` | `system.setTimeConfig` | draft | 否 | 设置系统时间与时区配置 |
| `0x0304` | `system.reset` | draft | 否 | 执行系统级重置 |
| `0x0305` | `system.getLifecycleState` | draft | 否 | 获取生命周期状态 |
| `0x0306` | `system.startInitialization` | draft | 否 | 启动初始化流程 |
| `0x0307` | `system.getLicenseState` | draft | 否 | 获取系统级 license 状态 |

### 6.4 firmware.*

固件升级采用 RPC 控制面 + STREAM OTA 数据面：`firmware.beginOta -> STREAM OTA chunk -> firmware.commitOtaBatch -> firmware.verifyOtaFiles -> firmware.installOta`。

| methodId | methodName | 状态 | MVP | 说明 |
|---:|---|---|---:|---|
| `0x0401` | `firmware.getOtaCapabilities` | draft | 否 | 获取 OTA 能力 |
| `0x0402` | `firmware.beginOta` | mvp | 是 | 开始 OTA |
| `0x0403` | `firmware.commitOtaBatch` | mvp | 是 | 提交 OTA 数据批次 |
| `0x0404` | `firmware.verifyOtaFiles` | mvp | 是 | 校验 OTA 文件 |
| `0x0405` | `firmware.installOta` | mvp | 是 | 安装 OTA |
| `0x0406` | `firmware.cancelOta` | draft | 否 | 取消 OTA |
| `0x0407` | `firmware.rollbackOta` | draft | 否 | 回滚 OTA |
| `0x0408` | `firmware.getOtaState` | draft | 否 | 获取 OTA 状态 |
| `0x0409` | `firmware.getOtaTransferState` | draft | 否 | 获取 OTA 传输状态 |
| `0x040A` | `firmware.confirmOta` | draft | 否 | 确认 OTA 结果 |

### 6.5 stream.*

`stream.*` 只定义公共流控和数据面运行时能力，不按文件、固件、媒体、日志等业务类型建流。

| methodId | methodName | 状态 | MVP | 说明 |
|---:|---|---|---:|---|
| `0x0501` | `stream.getFlowControlState` | draft | 否 | 获取公共流控状态 |
| `0x0502` | `stream.updateWindow` | draft | 否 | 更新流控窗口 |
| `0x0503` | `stream.pause` | draft | 否 | 暂停指定 streamId 的数据面 |
| `0x0504` | `stream.resume` | draft | 否 | 恢复指定 streamId 的数据面 |
| `0x0505` | `stream.getStats` | draft | 否 | 获取 STREAM 统计 |

### 6.6 display.*

`display.*` 只保留显示设备自身能力；输出源、路由和布局归 `output.*`。

| methodId | methodName | 状态 | MVP | 说明 |
|---:|---|---|---:|---|
| `0x0601` | `display.getBrightness` | mvp | 是 | 获取当前亮度 |
| `0x0602` | `display.setBrightness` | mvp | 是 | 设置亮度 |
| `0x0603` | `display.getBrightnessCapabilities` | draft | 否 | 获取亮度范围、步进和模式能力 |
| `0x0604` | `display.getBrightnessConfig` | draft | 否 | 获取亮度配置 |
| `0x0605` | `display.setBrightnessConfig` | draft | 否 | 设置亮度配置 |
| `0x0606` | `display.resetBrightnessConfig` | draft | 否 | 重置亮度配置 |
| `0x0607` | `display.getPowerState` | draft | 否 | 获取显示电源状态 |
| `0x0608` | `display.setPowerConfig` | draft | 否 | 设置显示电源配置 |

### 6.7 camera.*

`camera.*` 定义摄像头控制面。视频帧数据由业务域建流方法创建并通过 STREAM 承载。

| methodId | methodName | 状态 | MVP | 说明 |
|---:|---|---|---:|---|
| `0x0701` | `camera.getImageConfig` | draft | 否 | 获取图像参数配置 |
| `0x0702` | `camera.setImageConfig` | draft | 否 | 设置图像参数配置 |
| `0x0703` | `camera.getExposureConfig` | draft | 否 | 获取曝光配置 |
| `0x0704` | `camera.setExposureConfig` | draft | 否 | 设置曝光配置 |
| `0x0705` | `camera.getWhiteBalanceConfig` | draft | 否 | 获取白平衡配置 |
| `0x0706` | `camera.setWhiteBalanceConfig` | draft | 否 | 设置白平衡配置 |
| `0x0707` | `camera.getFocusState` | draft | 否 | 获取对焦状态 |
| `0x0708` | `camera.triggerAutoFocus` | draft | 否 | 触发自动对焦 |
| `0x0709` | `camera.getZoomState` | draft | 否 | 获取变焦状态 |
| `0x070A` | `camera.setZoomConfig` | draft | 否 | 设置变焦配置 |
| `0x070B` | `camera.getPtzState` | draft | 否 | 获取 PTZ 状态 |
| `0x070C` | `camera.setPtzConfig` | draft | 否 | 设置 PTZ 配置 |

### 6.8 video.*

`video.*` 定义视频 framing、编码、叠加、场景和视频业务流。codec 是参数或 schema 字段，不作为 feature。

| methodId | methodName | 状态 | MVP | 说明 |
|---:|---|---|---:|---|
| `0x0801` | `video.getFramingConfig` | draft | 否 | 获取取景/构图配置 |
| `0x0802` | `video.setFramingConfig` | draft | 否 | 设置取景/构图配置 |
| `0x0803` | `video.getEncoderConfig` | draft | 否 | 获取编码配置 |
| `0x0804` | `video.setEncoderConfig` | draft | 否 | 设置编码配置 |
| `0x0805` | `video.getOutputTransformConfig` | draft | 否 | 获取输出变换配置 |
| `0x0806` | `video.setOutputTransformConfig` | draft | 否 | 设置输出变换配置 |
| `0x0807` | `video.getLayoutConfig` | draft | 否 | 获取视频布局配置 |
| `0x0808` | `video.setLayoutConfig` | draft | 否 | 设置视频布局配置 |
| `0x0809` | `video.getSceneConfig` | draft | 否 | 获取视频场景配置 |
| `0x080A` | `video.setSceneConfig` | draft | 否 | 设置视频场景配置 |
| `0x080B` | `video.openStream` | draft | 否 | 创建视频业务流 |
| `0x080C` | `video.closeStream` | draft | 否 | 关闭视频业务流 |
| `0x080D` | `video.getStreamState` | draft | 否 | 获取视频流状态 |
| `0x080E` | `video.getRtspConfig` | draft | 否 | 获取 RTSP 服务配置 |
| `0x080F` | `video.setRtspConfig` | draft | 否 | 设置 RTSP 服务配置 |
| `0x0810` | `video.getNdiConfig` | draft | 否 | 获取 NDI 服务配置 |
| `0x0811` | `video.setNdiConfig` | draft | 否 | 设置 NDI 服务配置 |

### 6.9 audio.*

`audio.*` 定义音频算法、EQ、音量、路由、录制和播放。音频业务流由 audio 域创建。

| methodId | methodName | 状态 | MVP | 说明 |
|---:|---|---|---:|---|
| `0x0901` | `audio.getAlgorithmConfig` | draft | 否 | 获取音频算法配置 |
| `0x0902` | `audio.setAlgorithmConfig` | draft | 否 | 设置音频算法配置 |
| `0x0903` | `audio.getEqConfig` | draft | 否 | 获取 EQ 配置 |
| `0x0904` | `audio.setEqConfig` | draft | 否 | 设置 EQ 配置 |
| `0x0905` | `audio.getVolumeState` | draft | 否 | 获取音量状态 |
| `0x0906` | `audio.setVolumeConfig` | draft | 否 | 设置音量配置 |
| `0x0907` | `audio.getRoutingConfig` | draft | 否 | 获取音频路由配置 |
| `0x0908` | `audio.setRoutingConfig` | draft | 否 | 设置音频路由配置 |
| `0x0909` | `audio.openRecordingStream` | draft | 否 | 创建音频录制流 |
| `0x090A` | `audio.closeRecordingStream` | draft | 否 | 关闭音频录制流 |
| `0x090B` | `audio.getPlaybackState` | draft | 否 | 获取播放状态 |
| `0x090C` | `audio.setPlaybackConfig` | draft | 否 | 设置播放配置 |

### 6.10 input.*

高频输入数据走 STREAM；低频输入控制走 RPC。

| methodId | methodName | 状态 | MVP | 说明 |
|---:|---|---|---:|---|
| `0x0A01` | `input.getKeyConfig` | draft | 否 | 获取按键配置 |
| `0x0A02` | `input.setKeyConfig` | draft | 否 | 设置按键配置 |
| `0x0A03` | `input.getHidConfig` | draft | 否 | 获取 HID 配置 |
| `0x0A04` | `input.setHidConfig` | draft | 否 | 设置 HID 配置 |
| `0x0A05` | `input.getSourceState` | draft | 否 | 获取输入源状态 |
| `0x0A06` | `input.setSourceConfig` | draft | 否 | 设置输入源配置 |
| `0x0A07` | `input.openKvm` | draft | 否 | 开启 KVM |
| `0x0A08` | `input.closeKvm` | draft | 否 | 关闭 KVM |
| `0x0A09` | `input.getGpioState` | draft | 否 | 获取 GPIO 状态 |
| `0x0A0A` | `input.setGpioConfig` | draft | 否 | 设置 GPIO 配置 |

### 6.11 output.*

| methodId | methodName | 状态 | MVP | 说明 |
|---:|---|---|---:|---|
| `0x0B01` | `output.getSourceConfig` | draft | 否 | 获取输出源配置 |
| `0x0B02` | `output.setSourceConfig` | draft | 否 | 设置输出源配置 |
| `0x0B03` | `output.getRoutingConfig` | draft | 否 | 获取输出路由配置 |
| `0x0B04` | `output.setRoutingConfig` | draft | 否 | 设置输出路由配置 |
| `0x0B05` | `output.getLayoutConfig` | draft | 否 | 获取输出布局配置 |
| `0x0B06` | `output.setLayoutConfig` | draft | 否 | 设置输出布局配置 |

### 6.12 room.*

| methodId | methodName | 状态 | MVP | 说明 |
|---:|---|---|---:|---|
| `0x0C01` | `room.getInfo` | draft | 否 | 获取会议室信息 |
| `0x0C02` | `room.getScheduleConfig` | draft | 否 | 获取日程配置 |
| `0x0C03` | `room.setScheduleConfig` | draft | 否 | 设置日程配置 |
| `0x0C04` | `room.getSourceConfig` | draft | 否 | 获取会议室输入源配置 |
| `0x0C05` | `room.setSourceConfig` | draft | 否 | 设置会议室输入源配置 |
| `0x0C06` | `room.getLayoutConfig` | draft | 否 | 获取会议室布局配置 |
| `0x0C07` | `room.setLayoutConfig` | draft | 否 | 设置会议室布局配置 |
| `0x0C08` | `room.getParticipantState` | draft | 否 | 获取参会者状态 |

### 6.13 signage.*

| methodId | methodName | 状态 | MVP | 说明 |
|---:|---|---|---:|---|
| `0x0D01` | `signage.listMedia` | draft | 否 | 列出标牌媒体 |
| `0x0D02` | `signage.getPlaylistConfig` | draft | 否 | 获取播放列表配置 |
| `0x0D03` | `signage.setPlaylistConfig` | draft | 否 | 设置播放列表配置 |
| `0x0D04` | `signage.getScheduleConfig` | draft | 否 | 获取播放计划配置 |
| `0x0D05` | `signage.setScheduleConfig` | draft | 否 | 设置播放计划配置 |
| `0x0D06` | `signage.getPlaybackState` | draft | 否 | 获取播放状态 |
| `0x0D07` | `signage.startPlayback` | draft | 否 | 开始播放 |
| `0x0D08` | `signage.stopPlayback` | draft | 否 | 停止播放 |
| `0x0D09` | `signage.getOsdConfig` | draft | 否 | 获取 OSD 配置 |
| `0x0D0A` | `signage.setOsdConfig` | draft | 否 | 设置 OSD 配置 |

### 6.14 network.*

`network.*` 覆盖接口、IP、Wi-Fi、AP、Bluetooth 与服务端点发现；RTSP/NDI/Dante 等服务配置归各自业务域。

| methodId | methodName | 状态 | MVP | 说明 |
|---:|---|---|---:|---|
| `0x0E01` | `network.getInterfaceState` | draft | 否 | 获取网络接口状态 |
| `0x0E02` | `network.getIpConfig` | draft | 否 | 获取 IP 配置 |
| `0x0E03` | `network.setIpConfig` | draft | 否 | 设置 IP 配置 |
| `0x0E04` | `network.getWifiConfig` | draft | 否 | 获取 Wi-Fi 配置 |
| `0x0E05` | `network.setWifiConfig` | draft | 否 | 设置 Wi-Fi 配置 |
| `0x0E06` | `network.scanWifi` | draft | 否 | 扫描 Wi-Fi |
| `0x0E07` | `network.connectWifi` | draft | 否 | 连接 Wi-Fi |
| `0x0E08` | `network.disconnectWifi` | draft | 否 | 断开 Wi-Fi |
| `0x0E09` | `network.getWifiState` | draft | 否 | 获取 Wi-Fi 状态 |
| `0x0E0A` | `network.getApConfig` | draft | 否 | 获取 AP 配置 |
| `0x0E0B` | `network.setApConfig` | draft | 否 | 设置 AP 配置 |
| `0x0E0C` | `network.startAp` | draft | 否 | 启动 AP |
| `0x0E0D` | `network.stopAp` | draft | 否 | 停止 AP |
| `0x0E0E` | `network.getApState` | draft | 否 | 获取 AP 状态 |
| `0x0E0F` | `network.getServiceEndpointState` | draft | 否 | 获取服务端点状态 |

### 6.15 storage.*

| methodId | methodName | 状态 | MVP | 说明 |
|---:|---|---|---:|---|
| `0x0F01` | `storage.getSdCardState` | draft | 否 | 获取 SD 卡状态 |
| `0x0F02` | `storage.formatSdCard` | draft | 否 | 格式化 SD 卡 |
| `0x0F03` | `storage.getDiskState` | draft | 否 | 获取磁盘状态 |
| `0x0F04` | `storage.getVolumeState` | draft | 否 | 获取卷状态 |
| `0x0F05` | `storage.listMedia` | draft | 否 | 列出媒体资源 |
| `0x0F06` | `storage.listRecordings` | draft | 否 | 列出录制资源 |
| `0x0F07` | `storage.rebuildIndex` | draft | 否 | 重建存储索引 |

### 6.16 file.*

文件数据块必须走 STREAM；文件业务流由 `file.*` 方法创建。

| methodId | methodName | 状态 | MVP | 说明 |
|---:|---|---|---:|---|
| `0x1001` | `file.beginTransfer` | draft | 否 | 开始文件传输 |
| `0x1002` | `file.endTransfer` | draft | 否 | 结束文件传输 |
| `0x1003` | `file.cancelTransfer` | draft | 否 | 取消文件传输 |
| `0x1004` | `file.resumeTransfer` | draft | 否 | 恢复文件传输 |
| `0x1005` | `file.getTransferState` | draft | 否 | 获取文件传输状态 |
| `0x1006` | `file.listStorage` | draft | 否 | 列出文件存储位置 |
| `0x1007` | `file.getStorageState` | draft | 否 | 获取文件存储状态 |

### 6.17 log.*

实时日志流归 `log.stream`，日志导出任务归 `log.export`。

| methodId | methodName | 状态 | MVP | 说明 |
|---:|---|---|---:|---|
| `0x1101` | `log.openStream` | draft | 否 | 创建实时日志流 |
| `0x1102` | `log.closeStream` | draft | 否 | 关闭实时日志流 |
| `0x1103` | `log.getStreamState` | draft | 否 | 获取实时日志流状态 |
| `0x1104` | `log.createExport` | draft | 否 | 创建日志导出任务 |
| `0x1105` | `log.getExportState` | draft | 否 | 获取日志导出状态 |
| `0x1106` | `log.cancelExport` | draft | 否 | 取消日志导出 |
| `0x1107` | `log.listFiles` | draft | 否 | 列出日志文件 |
| `0x1108` | `log.deleteFile` | draft | 否 | 删除日志文件 |

### 6.18 diagnostic.*

| methodId | methodName | 状态 | MVP | 说明 |
|---:|---|---|---:|---|
| `0x1201` | `diagnostic.runSelfTest` | draft | 否 | 执行设备自检 |
| `0x1202` | `diagnostic.runNetworkTest` | draft | 否 | 执行网络测试 |
| `0x1203` | `diagnostic.runAudioTest` | draft | 否 | 执行音频测试 |
| `0x1204` | `diagnostic.runVideoTest` | draft | 否 | 执行视频测试 |
| `0x1205` | `diagnostic.runStorageTest` | draft | 否 | 执行存储测试 |
| `0x1206` | `diagnostic.runInputTest` | draft | 否 | 执行输入测试 |
| `0x1207` | `diagnostic.startCalibration` | draft | 否 | 启动校准流程 |
| `0x1208` | `diagnostic.createReportExport` | draft | 否 | 创建诊断报告导出任务 |
| `0x1209` | `diagnostic.getReportExportState` | draft | 否 | 获取诊断报告导出状态 |

### 6.19 sensor.*

| methodId | methodName | 状态 | MVP | 说明 |
|---:|---|---|---:|---|
| `0x1301` | `sensor.getInfo` | draft | 否 | 获取传感器信息 |
| `0x1302` | `sensor.getState` | draft | 否 | 获取传感器状态 |
| `0x1303` | `sensor.openSampleStream` | draft | 否 | 打开采样流 |
| `0x1304` | `sensor.closeSampleStream` | draft | 否 | 关闭采样流 |

### 6.20 auth.*

| methodId | methodName | 状态 | MVP | 说明 |
|---:|---|---|---:|---|
| `0x1401` | `auth.createSession` | draft | 否 | 创建认证会话 |
| `0x1402` | `auth.closeSession` | draft | 否 | 关闭认证会话 |
| `0x1403` | `auth.refreshToken` | draft | 否 | 刷新访问令牌 |
| `0x1404` | `auth.getPermissionState` | draft | 否 | 查询权限状态 |

### 6.21 privacy.*

隐私遮挡属于通用业务域；具体云台、镜头盖、麦克风静音联动可以在 `camera.*`、`audio.*` 或 `vendor.*` 中扩展。

| methodId | methodName | 状态 | MVP | 说明 |
|---:|---|---|---:|---|
| `0x1501` | `privacy.getCoverState` | draft | 否 | 获取隐私盖状态 |
| `0x1502` | `privacy.setCoverConfig` | draft | 否 | 设置隐私盖配置 |
| `0x1503` | `privacy.getModeConfig` | draft | 否 | 获取隐私模式配置 |
| `0x1504` | `privacy.setModeConfig` | draft | 否 | 设置隐私模式配置 |
| `0x1505` | `privacy.getState` | draft | 否 | 获取隐私状态 |

---

## 7. 老协议适配 MethodId 表

老协议适配不要求保持原始 `CmdValue` 数值，但必须保留原有业务语义。映射必须记录在 `registry/legacy/legacy_mapping.yaml` 中。

如果老协议 `CmdValue` 超过 `uint16`，不应直接作为 `methodId` 使用，应映射为 AXTP 新 methodId，并在 `legacy.cmdValue` 中记录原值。

| 老协议来源 | legacy CmdValue | 旧命令语义 | AXTP methodId | AXTP methodName | MVP | 说明 |
|---|---:|---|---:|---|---:|---|
| AXDP_HID | `0xB0002` | BetaDeviceInfo | `0x0101` | `device.getInfo` | 是 | 设备信息查询 |
| AXDP_HID | `0xC0021` | CommonSetVideoMode | `0x0802` | `video.setFramingConfig` | 可选 | 视频模式设置迁移到 `video.framing` |
| AXDP_HID | `0xA0001` | AlphaUpgradeInfo | `0x0401` | `firmware.getOtaCapabilities` | 可选 | 固件升级信息查询迁移到 `firmware.ota` |
| Legacy HID/BLE | TBD | GetBrightness | `0x0601` | `display.getBrightness` | 是 | 若旧协议存在亮度查询命令，应映射到此方法 |
| Legacy HID/BLE | TBD | SetBrightness | `0x0602` | `display.setBrightness` | 是 | 若旧协议存在亮度设置命令，应映射到此方法 |
| Legacy HID/BLE | TBD | UpgradeBegin | `0x0402` | `firmware.beginOta` | 是 | 若旧协议存在升级开始命令，应映射到此方法 |
| Legacy HID/BLE | TBD | UpgradeEnd | `0x0403` | `firmware.commitOtaBatch` | 是 | 若旧协议存在升级结束命令，应映射到此方法 |
| Legacy HID/BLE | TBD | UpgradeVerify | `0x0404` | `firmware.verifyOtaFiles` | 是 | 若旧协议存在升级校验命令，应映射到此方法 |

TBD 表示需要从老协议表中补充具体 CmdValue，后续在 `registry/legacy/legacy_mapping.yaml` 中补齐。

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

Method 的 `capability.required` 必须引用 `domain.feature` 能力块。例如 `network.setWifiConfig`、`network.scanWifi`、`network.getWifiState` 均归属 `network.wifi`；`firmware.beginOta`、`firmware.installOta` 均归属 `firmware.ota`。

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
