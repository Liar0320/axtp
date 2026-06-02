# 10《AXTP EventId 注册表》

版本：v1.1 Draft
状态：MVP EventId 注册表（精简版）
适用范围：AXTP RPC EventId 分配、Domain 分段、MVP 事件集合、老协议事件适配

---
## 1. EventId 在协议中的位置

事件只属于 RPC 层：

```text
AXTP Frame Header
  payloadType = RPC
    ↓
RPC Payload
  rpcOp = EVENT
  eventId = xxx
  bodyEncoding = NONE / TLV8 / TLV16 / RAW_BYTES / CBOR_BODY
  body = event data
```

EventId 不应出现在 Frame Header、Control Payload Header 或 Stream Payload Header 中。

---

## 2. 事件设计原则

- 事件名使用 feature 模板，表达变化、进度、结果或上报（`network.wifiStateChanged`，不是 `network.changeWifiState`）
- 事件不替代 Response：Response 回答请求是否成功，Event 通知后续状态变化
- 接收端必须允许忽略未知事件
- 每个事件必须绑定事件数据 Schema，不允许只定义事件名而不定义数据结构
- 事件订阅使用域级掩码（`eventMasks`），由 RPC `IDENTIFY / REIDENTIFY` 声明；每个事件在其 Domain 内分配唯一 `bitOffset`（0-255）；MVP 阶段设备可采用全量广播模式

---

## 2.1 bitOffset 分配规则

每个事件在其 Domain 内分配一个唯一的、自增的 `bitOffset`（0 到 255）。`bitOffset` 与 EventId 低字节无关，独立分配，由 Registry 管理。

`eventMasks` 中的 DomainId 等于 EventId 的高字节（如 `display.*` 事件 EventId 为 `0x85xx`，DomainId = `0x85`）。

设备端判定某事件是否被订阅：

```cpp
bool isEventSubscribed(const uint8_t* bitmask, uint8_t maskLen, uint8_t bitOffset) {
    uint8_t byteIndex = bitOffset / 8;
    uint8_t bitIndex  = bitOffset % 8;
    if (byteIndex >= maskLen) return false;
    return (bitmask[byteIndex] & (1 << bitIndex)) != 0;
}
```

---

## 3. EventId 分段规划

EventId 使用 `uint16`，从 `0x8000` 开始分配，与 MethodId 区分。

| 范围 | Domain | 说明 |
|---:| --- |---|
| `0x8000-0x80FF` | reserved | 保留 |
| `0x8100-0x81FF` | `device.*` | 设备基础事件 |
| `0x8200-0x82FF` | reserved | 保留 |
| `0x8300-0x83FF` | `capability.*` | 能力变化事件 |
| `0x8400-0x84FF` | `system.*` | 系统状态事件 |
| `0x8500-0x85FF` | `display.*` | 显示类事件 |
| `0x8600-0x86FF` | `camera.*` | 摄像头事件 |
| `0x8700-0x87FF` | `video.*` | 视频控制面事件 |
| `0x8800-0x88FF` | `audio.*` | 音频控制面事件 |
| `0x8900-0x89FF` | `stream.*` | 流状态事件 |
| `0x8A00-0x8AFF` | `file.*` | 文件传输事件 |
| `0x8B00-0x8BFF` | `firmware.*` | OTA / 固件升级事件 |
| `0x8C00-0x8CFF` | `log.*` | 日志事件 |
| `0x8D00-0x8DFF` | `diagnostic.*` | 诊断 / 产测事件 |
| `0x8E00-0x8EFF` | `network.*` | 网络事件 |
| `0x8F00-0x8FFF` | `storage.*` | 存储事件 |
| `0x9000-0x90FF` | `input.*` | 输入 / KVM 事件 |
| `0x9100-0x91FF` | `sensor.*` | 传感器事件 |
| `0x9200-0x92FF` | `auth.*` | 认证事件 |
| `0x9300-0x93FF` | `privacy.*` | 隐私事件 |
| `0x9400-0x94FF` | `output.*` | 输出源 / 路由 / 布局事件 |
| `0x9500-0x95FF` | `room.*` | 会议室 / 协作空间事件 |
| `0x9600-0x96FF` | `signage.*` | 数字标牌事件 |
| `0xF000-0xFFFF` | `vendor.*` | 厂商私有事件 |

---

## 4. MVP EventId 注册表

MVP EventId 表以 `registry/event/event_registry.yaml` 与 `registry/domains/<domain>/domain.yaml` 为事实源。当前 AXTP v1 MVP 只包含下列已注册为 `mvp` 的事件；其他事件即使出现在后续规划表中，也不得视为当前 MVP 实现合同。

| eventId | eventName | Domain | bitOffset | 状态 | 说明 |
| ---: | --- | --- | ---: | --- | --- |
| `0x8507` | `display.brightnessChanged` | display | 0 | mvp | 亮度变化 |
| `0x8B02` | `firmware.otaProgressReported` | firmware | 0 | mvp | OTA 进度上报 |
| `0x8B03` | `firmware.otaStateChanged` | firmware | 1 | mvp | OTA 状态变化 |
| `0x8B04` | `firmware.otaResultReported` | firmware | 2 | mvp | OTA 结果上报 |

说明：当前 registry YAML 尚未完成本轮 domain-feature 迁移；本 source 表使用目标主名称，旧事件名只在 legacy / deprecated / migration 说明中出现。

---

## 5. 完整 EventId 规划

以下表格是领域规划草案，用于保留编号空间和讨论未来能力；当前实现状态以 `registry/event/event_registry.yaml`、`registry/domains/<domain>/domain.yaml` 及生成产物为准。

### 5.1 device 事件

| eventId | eventName | 状态 | 说明 |
|---:| --- |---| --- |
| `0x8101` | `device.stateChanged` | draft | 设备状态变化 |
| `0x8102` | `device.powerStateChanged` | draft | 电源状态变化 |
| `0x8103` | `device.indicatorConfigChanged` | draft | 指示灯/蜂鸣配置变化 |
| `0x8104` | `device.inventoryChanged` | draft | 设备库存/子模块信息变化 |
| `0x8105` | `device.childDeviceStateChanged` | draft | 子设备状态变化 |

### 5.2 reserved / session 说明

`session` 与 `event` 不作为业务 EventId 域。事件订阅集合属于 RPC 会话状态，由 `IDENTIFY / REIDENTIFY.eventSubscriptions` 管理；变更失败必须通过 RPC status 返回，不额外分配 `event.subscribed / event.unsubscribed` 事件。

`CONTROL` 的 `OPEN / CLOSE / RESUME` 是协议运行时信令，不应注册为 EventId。

### 5.3 capability 事件

| eventId | eventName | 状态 | 说明 |
|---:| --- |---| --- |
| `0x8301` | `capability.registryChanged` | draft | 能力注册表变化 |
| `0x8302` | `capability.methodStateChanged` | draft | 支持的方法集合变化 |
| `0x8303` | `capability.limitStateChanged` | draft | 设备限制参数变化 |

### 5.4 system 事件

| eventId | eventName | 状态 | 说明 |
|---:| --- |---| --- |
| `0x8401` | `system.timeConfigChanged` | draft | 系统时间配置变化 |
| `0x8402` | `system.lifecycleStateChanged` | draft | 生命周期状态变化 |
| `0x8403` | `system.resetStateChanged` | draft | 重置流程状态变化 |
| `0x8404` | `system.initializationStateChanged` | draft | 初始化状态变化 |
| `0x8405` | `system.licenseStateChanged` | draft | 系统级 license 状态变化 |

### 5.5 display 事件

| eventId | eventName | 状态 | 说明 |
|---:| --- |---| --- |
| `0x8501` | `display.powerStateChanged` | draft | 显示电源状态变化 |
| `0x8502` | `display.colorConfigChanged` | draft | 色彩配置变化 |
| `0x8503` | `display.backlightConfigChanged` | draft | 背光配置变化 |
| `0x8504` | `display.inputStateChanged` | draft | 显示输入状态变化 |
| `0x8505` | `display.outputStateChanged` | draft | 显示输出状态变化 |
| `0x8507` | `display.brightnessChanged` | mvp | 亮度值变化 |
| `0x8508` | `display.brightnessConfigChanged` | draft | 亮度配置变化 |

### 5.6 camera 事件

摄像头控制面事件归入 `camera.*`；视频帧数据本身仍必须通过 STREAM 承载。

| eventId | eventName | 状态 | 说明 |
|---:| --- |---| --- |
| `0x8601` | `camera.imageConfigChanged` | draft | 图像配置变化 |
| `0x8602` | `camera.exposureConfigChanged` | draft | 曝光配置变化 |
| `0x8603` | `camera.whiteBalanceConfigChanged` | draft | 白平衡配置变化 |
| `0x8604` | `camera.focusStateChanged` | draft | 对焦状态变化 |
| `0x8605` | `camera.zoomStateChanged` | draft | 变焦状态变化 |
| `0x8606` | `camera.ptzStateChanged` | draft | PTZ 状态变化 |
| `0x8607` | `camera.calibrationStateChanged` | draft | 校准状态变化 |

### 5.7 video 事件

视频帧数据本身不通过 Event 承载，应通过 `PayloadType = STREAM` 承载。

| eventId | eventName | 状态 | 说明 |
|---:| --- |---| --- |
| `0x8701` | `video.framingConfigChanged` | draft | 视频构图配置变化 |
| `0x8702` | `video.outputTransformConfigChanged` | draft | 输出变换配置变化 |
| `0x8703` | `video.encoderConfigChanged` | draft | 编码配置变化 |
| `0x8704` | `video.layoutConfigChanged` | draft | 视频布局配置变化 |
| `0x8705` | `video.sceneConfigChanged` | draft | 视频场景配置变化 |
| `0x8706` | `video.streamStateChanged` | draft | 视频业务流状态变化 |
| `0x8707` | `video.rtspConfigChanged` | draft | RTSP 配置变化 |
| `0x8708` | `video.ndiConfigChanged` | draft | NDI 配置变化 |

### 5.8 audio 事件

| eventId | eventName | 状态 | 说明 |
|---:| --- |---| --- |
| `0x8801` | `audio.algorithmConfigChanged` | draft | 音频算法配置变化 |
| `0x8802` | `audio.eqConfigChanged` | draft | EQ 配置变化 |
| `0x8803` | `audio.volumeStateChanged` | draft | 音量状态变化 |
| `0x8804` | `audio.routingConfigChanged` | draft | 音频路由配置变化 |
| `0x8805` | `audio.recordingStreamStateChanged` | draft | 音频录制流状态变化 |
| `0x8806` | `audio.playbackStateChanged` | draft | 播放状态变化 |

### 5.9 stream 事件

| eventId | eventName | 状态 | 说明 |
|---:| --- |---| --- |
| `0x8901` | `stream.flowControlStateChanged` | draft | 公共流控状态变化 |
| `0x8902` | `stream.windowUpdated` | draft | 流控窗口变化 |
| `0x8903` | `stream.statsReported` | draft | STREAM 统计上报 |
| `0x8904` | `stream.errorReported` | draft | STREAM 数据面错误上报 |

### 5.10 file 事件

| eventId | eventName | 状态 | 说明 |
|---:| --- |---| --- |
| `0x8A01` | `file.transferStateChanged` | draft | 文件传输状态变化 |
| `0x8A02` | `file.transferProgressReported` | draft | 文件传输进度上报 |
| `0x8A03` | `file.storageStateChanged` | draft | 文件存储状态变化 |

### 5.11 firmware 事件

| eventId | eventName | 状态 | 说明 |
|---:| --- |---| --- |
| `0x8B01` | `firmware.infoChanged` | draft | 固件信息变化 |
| `0x8B02` | `firmware.otaProgressReported` | mvp | OTA 进度上报 |
| `0x8B03` | `firmware.otaStateChanged` | mvp | OTA 状态变化 |
| `0x8B04` | `firmware.otaResultReported` | mvp | OTA 结果上报 |
| `0x8B05` | `firmware.updatePolicyChanged` | draft | 固件更新策略变化 |

### 5.12 log 事件

| eventId | eventName | 状态 | 说明 |
|---:| --- |---| --- |
| `0x8C01` | `log.streamStateChanged` | draft | 实时日志流状态变化 |
| `0x8C02` | `log.exportStateChanged` | draft | 日志导出状态变化 |
| `0x8C03` | `log.exportProgressReported` | draft | 日志导出进度上报 |
| `0x8C04` | `log.filesChanged` | draft | 日志文件列表变化 |

### 5.13 diagnostic 事件

| eventId | eventName | 状态 | 说明 |
|---:| --- |---| --- |
| `0x8D01` | `diagnostic.selfTestStateChanged` | draft | 自检状态变化 |
| `0x8D02` | `diagnostic.selfTestProgressReported` | draft | 自检进度上报 |
| `0x8D03` | `diagnostic.networkTestStateChanged` | draft | 网络测试状态变化 |
| `0x8D04` | `diagnostic.audioTestStateChanged` | draft | 音频测试状态变化 |
| `0x8D05` | `diagnostic.videoTestStateChanged` | draft | 视频测试状态变化 |
| `0x8D06` | `diagnostic.reportExportStateChanged` | draft | 诊断报告导出状态变化 |
| `0x8D07` | `diagnostic.reportExportProgressReported` | draft | 诊断报告导出进度上报 |

### 5.14 input / KVM 事件

| eventId | eventName | 状态 | 说明 |
|---:| --- |---| --- |
| `0x9001` | `input.keyConfigChanged` | draft | 按键配置变化 |
| `0x9002` | `input.hidConfigChanged` | draft | HID 配置变化 |
| `0x9003` | `input.sourceStateChanged` | draft | 输入源状态变化 |
| `0x9004` | `input.kvmStateChanged` | draft | KVM 状态变化 |
| `0x9005` | `input.gpioStateChanged` | draft | GPIO 状态变化 |

### 5.15 network 事件

| eventId | eventName | 状态 | 说明 |
|---:| --- |---| --- |
| `0x8E01` | `network.interfaceStateChanged` | draft | 网络接口状态变化 |
| `0x8E02` | `network.ipConfigChanged` | draft | IP 配置变化 |
| `0x8E03` | `network.wifiConfigChanged` | draft | Wi-Fi 配置变化 |
| `0x8E04` | `network.wifiStateChanged` | draft | Wi-Fi 状态变化 |
| `0x8E05` | `network.wifiScanResultReported` | draft | Wi-Fi 扫描结果上报 |
| `0x8E06` | `network.apConfigChanged` | draft | AP 配置变化 |
| `0x8E07` | `network.apStateChanged` | draft | AP 状态变化 |
| `0x8E08` | `network.apClientChanged` | draft | AP 客户端变化 |
| `0x8E09` | `network.serviceEndpointStateChanged` | draft | 服务端点状态变化 |

### 5.16 storage 事件

| eventId | eventName | 状态 | 说明 |
|---:| --- |---| --- |
| `0x8F01` | `storage.sdCardStateChanged` | draft | SD 卡状态变化 |
| `0x8F02` | `storage.diskStateChanged` | draft | 磁盘状态变化 |
| `0x8F03` | `storage.volumeStateChanged` | draft | 卷状态变化 |
| `0x8F04` | `storage.mediaChanged` | draft | 媒体资源变化 |
| `0x8F05` | `storage.recordingChanged` | draft | 录制资源变化 |
| `0x8F06` | `storage.indexStateChanged` | draft | 存储索引状态变化 |

### 5.17 sensor 事件

| eventId | eventName | 状态 | 说明 |
|---:| --- |---| --- |
| `0x9101` | `sensor.stateChanged` | draft | 传感器状态变化 |
| `0x9102` | `sensor.sampleStreamStateChanged` | draft | 采样流状态变化 |
| `0x9103` | `sensor.sampleReported` | draft | 低频采样上报 |

### 5.18 auth 事件

| eventId | eventName | 状态 | 说明 |
|---:| --- |---| --- |
| `0x9201` | `auth.sessionStateChanged` | draft | 认证会话状态变化 |
| `0x9202` | `auth.permissionStateChanged` | draft | 权限状态变化 |
| `0x9203` | `auth.tokenStateChanged` | draft | token 状态变化 |

### 5.19 privacy 事件

| eventId | eventName | 状态 | 说明 |
|---:| --- |---| --- |
| `0x9301` | `privacy.coverStateChanged` | draft | 隐私盖状态变化 |
| `0x9302` | `privacy.modeConfigChanged` | draft | 隐私模式配置变化 |
| `0x9303` | `privacy.stateChanged` | draft | 隐私状态变化 |

### 5.20 output 事件

| eventId | eventName | 状态 | 说明 |
|---:| --- |---| --- |
| `0x9401` | `output.sourceChanged` | draft | 输出源变化 |
| `0x9402` | `output.routingChanged` | draft | 输出路由变化 |
| `0x9403` | `output.layoutChanged` | draft | 输出布局变化 |

### 5.21 room 事件

| eventId | eventName | 状态 | 说明 |
|---:| --- |---| --- |
| `0x9501` | `room.infoChanged` | draft | 会议室信息变化 |
| `0x9502` | `room.scheduleChanged` | draft | 日程变化 |
| `0x9503` | `room.sourceChanged` | draft | 会议室输入源变化 |
| `0x9504` | `room.layoutChanged` | draft | 会议室布局变化 |
| `0x9505` | `room.participantChanged` | draft | 参会者变化 |

### 5.22 signage 事件

| eventId | eventName | 状态 | 说明 |
|---:| --- |---| --- |
| `0x9601` | `signage.mediaChanged` | draft | 标牌媒体变化 |
| `0x9602` | `signage.playlistChanged` | draft | 播放列表变化 |
| `0x9603` | `signage.scheduleChanged` | draft | 播放计划变化 |
| `0x9604` | `signage.playbackStateChanged` | draft | 播放状态变化 |
| `0x9605` | `signage.osdChanged` | draft | OSD 配置变化 |

---

## 6. Event Schema 规范

每个事件必须绑定一个事件数据 Schema，推荐使用 TLV Schema。

### 6.1 通用事件字段

| fieldId | 字段名 | 类型 | 说明 |
|---:| --- |---| --- |
| `0x01` | `timestamp` | uint64 | 事件发生时间 |
| `0x02` | `sequence` | uint32 | 事件序号 |
| `0x03` | `source` | uint16 | 事件来源模块 |
| `0x04` | `severity` | uint8 enum | 事件严重级别 |
| `0x05` | `reasonCode` | uint16 | 原因码 |
| `0x06` | `errorCode` | uint16 | 错误码 |
| `0x07` | `message` | string | 可读消息 |
| `0x7F` | `vendorData` | bytes | 厂商私有数据 |

### 6.2 severity 枚举

| 值 | 名称 | 说明 |
|---:| --- |---|
| `0x00` | `INFO` | 普通信息 |
| `0x01` | `WARNING` | 警告 |
| `0x02` | `ERROR` | 错误 |
| `0x03` | `CRITICAL` | 严重错误 |

---

## 7. MVP 事件 Schema

### 7.1 device.stateChanged

| fieldId | 字段名 | 类型 | 必填 | 说明 |
|---:| --- |---| --- |---|
| `0x01` | `timestamp` | uint64 | 否 | 时间戳 |
| `0x20` | `oldStatus` | uint8 enum | 否 | 旧状态 |
| `0x21` | `newStatus` | uint8 enum | 是 | 新状态 |
| `0x22` | `reasonCode` | uint16 | 否 | 状态变化原因 |

状态枚举：`0x00=UNKNOWN / 0x01=IDLE / 0x02=BUSY / 0x03=UPDATING / 0x04=ERROR`

### 7.2 display.brightnessChanged

| fieldId | 字段名 | 类型 | 必填 | 说明 |
|---:| --- |---| --- |---|
| `0x01` | `timestamp` | uint64 | 否 | 时间戳 |
| `0x20` | `oldValue` | uint8 | 否 | 旧亮度 |
| `0x21` | `newValue` | uint8 | 是 | 新亮度 |
| `0x22` | `source` | uint8 enum | 否 | 来源（`0x01=RPC / 0x02=LOCAL_KEY / 0x03=AUTO / 0x04=SCHEDULE`） |

### 7.3 firmware.otaProgressReported

| fieldId | 字段名 | 类型 | 必填 | 说明 |
|---:| --- |---| --- |---|
| `0x01` | `timestamp` | uint64 | 否 | 时间戳 |
| `0x20` | `transferId` | uint32 | 是 | OTA 传输 ID |
| `0x21` | `receivedBytes` | uint64 | 是 | 已接收字节数 |
| `0x22` | `totalBytes` | uint64 | 是 | 总字节数 |
| `0x23` | `percent` | uint8 | 否 | 进度百分比 |
| `0x24` | `stage` | uint8 enum | 否 | 当前阶段（`0x01=TRANSFER / 0x02=VERIFY / 0x03=INSTALL / 0x04=REBOOT`） |

### 7.4 firmware.otaStateChanged

| fieldId | 字段名 | 类型 | 必填 | 说明 |
|---:| --- |---| --- |---|
| `0x01` | `timestamp` | uint64 | 否 | 时间戳 |
| `0x20` | `transferId` | uint32 | 是 | OTA 传输 ID |
| `0x21` | `oldState` | uint8 enum | 否 | 旧 OTA 状态 |
| `0x22` | `newState` | uint8 enum | 是 | 新 OTA 状态 |
| `0x23` | `reasonCode` | uint16 | 否 | 状态变化原因 |

状态枚举：`0x00=UNKNOWN / 0x01=NEGOTIATING / 0x02=TRANSFERRING / 0x03=VERIFYING / 0x04=INSTALLING / 0x05=COMPLETED / 0x06=FAILED / 0x07=CANCELED`

### 7.5 firmware.otaResultReported

| fieldId | 字段名 | 类型 | 必填 | 说明 |
|---:| --- |---| --- |---|
| `0x01` | `timestamp` | uint64 | 否 | 时间戳 |
| `0x20` | `transferId` | uint32 | 是 | OTA 传输 ID |
| `0x21` | `result` | uint8 enum | 是 | OTA 结果（`0x01=SUCCESS / 0x02=FAILED / 0x03=ROLLED_BACK`） |
| `0x22` | `newVersion` | string | 否 | 新固件版本 |
| `0x23` | `rebootRequired` | bool | 否 | 是否需要重启 |
| `0x24` | `errorCode` | uint16 | 否 | 失败错误码 |
| `0x25` | `message` | string | 否 | 错误描述 |

---

## 8. Event 与 Method 的关系

| Method | 可能触发的 Event |
| --- |---|
| `display.setBrightness` | `display.brightnessChanged` |
| `video.openStream` | `video.streamStateChanged` |
| `log.openStream` | `log.streamStateChanged` |
| `file.beginTransfer` | `file.transferStateChanged` / `file.transferProgressReported` |
| `firmware.beginOta` | `firmware.otaStateChanged` / `firmware.otaProgressReported` |
| `firmware.verifyOtaFiles` | `firmware.otaStateChanged` / `firmware.otaResultReported` |
| `firmware.installOta` | `firmware.otaStateChanged` / `firmware.otaResultReported` |

Method Registry 中通过 `emits` 字段声明关联事件。

---

## 9. Event 与 Capability 的关系

设备是否支持某个事件，通过 Capability Registry 暴露。v1 Core 只强制 `capability.supportedMethods`；事件能力发现属于 v2/P1 Capability Model。

---

## 10. Event 与 ErrorCode 的关系

事件可以携带 `errorCode`，但事件本身不等于错误。错误码必须来自 ErrorCode Registry。

---

## 11. Event 与 Control 的关系

Control 层的 ACK/NACK、OPEN、HEARTBEAT 不应作为 Event 上报。CONTROL 是协议运行时信令，EVENT 是业务层异步通知，二者可以相关但不能混用。

---

## 12. 老协议事件适配规则

旧协议中常见状态上报迁移为 AXTP Event：

| 旧协议语义 | AXTP Event |
| --- |---|
| 设备状态变化 | `device.stateChanged` |
| 亮度变化上报 | `display.brightnessChanged` |
| OTA 进度上报 | `firmware.otaProgressReported` |
| OTA 状态变化 | `firmware.otaStateChanged` |
| OTA 成功/失败结果 | `firmware.otaResultReported` |
| 视频流开启/关闭通知 | `video.streamStateChanged` |
| 日志流开启/关闭通知 | `log.streamStateChanged` |
| 流异常通知 | 业务域 `*.streamStateChanged` 或公共 `stream.errorReported` |

旧规划中的 `stream.opened / stream.closed / stream.error` 仅作为迁移别名保留；新主事件必须归属业务域或公共 `stream.flowControl`。

如果老协议中存在独立事件 CmdValue，可以保留其值作为 `legacyId`，但不建议直接作为 AXTP EventId。

如果旧协议没有事件只能轮询状态，MVP 阶段可以同时支持轮询方法（如 `display.getBrightness`）和事件上报（如 `display.brightnessChanged`）。

---

## 13. Generator v1 校验规则

Generator 必须执行以下校验：

```text
eventId 不重复 / eventName 不重复 / eventId 范围与 domain 匹配
status 合法 / schema 引用必须存在 / capability 引用必须存在
legacy mapping 的 axtpEventId 必须存在
```
