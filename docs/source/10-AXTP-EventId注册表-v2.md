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

- 事件名使用过去式或状态变化语义（`device.statusChanged`，不是 `device.changeStatus`）
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
| `0xF000-0xFFFF` | `vendor.*` | 厂商私有事件 |

---

## 4. MVP EventId 注册表

MVP EventId 表以 `registry/event/event_registry.yaml` 与 `registry/domains/<domain>/domain.yaml` 为事实源。当前 AXTP v1 MVP 只包含下列已注册为 `mvp` 的事件；其他事件即使出现在后续规划表中，也不得视为当前 MVP 实现合同。

| eventId | eventName | Domain | bitOffset | 状态 | 说明 |
| ---: | --- | --- | ---: | --- | --- |
| `0x8507` | `display.brightnessChanged` | display | 0 | mvp | 亮度变化 |
| `0x8B02` | `firmware.updateProgress` | firmware | 0 | mvp | 固件升级进度 |
| `0x8B03` | `firmware.updateCompleted` | firmware | 1 | mvp | 固件升级完成 |
| `0x8B04` | `firmware.updateFailed` | firmware | 2 | mvp | 固件升级失败 |

---

## 5. 完整 EventId 规划

以下表格是领域规划草案，用于保留编号空间和讨论未来能力；当前实现状态以 `registry/event/event_registry.yaml`、`registry/domains/<domain>/domain.yaml` 及生成产物为准。

### 5.1 device 事件

| eventId | eventName | 状态 | 说明 |
|---:| --- |---| --- |
| `0x8101` | `device.statusChanged` | draft | 设备状态变化 |
| `0x8102` | `device.errorOccurred` | mvp | 设备错误发生 |
| `0x8103` | `device.online` | draft | 设备上线 |
| `0x8104` | `device.offline` | draft | 设备离线 |
| `0x8105` | `device.rebooting` | draft | 设备即将重启 |
| `0x8106` | `device.factoryResetStarted` | draft | 恢复出厂开始 |
| `0x8107` | `device.factoryResetCompleted` | draft | 恢复出厂完成 |

### 5.2 reserved / session 说明

`session` 与 `event` 不作为业务 EventId 域。事件订阅集合属于 RPC 会话状态，由 `IDENTIFY / REIDENTIFY.eventSubscriptions` 管理；变更失败必须通过 RPC status 返回，不额外分配 `event.subscribed / event.unsubscribed` 事件。

`CONTROL` 的 `OPEN / CLOSE / RESUME` 是协议运行时信令，不应注册为 EventId。

### 5.3 capability 事件

| eventId | eventName | 状态 | 说明 |
|---:| --- |---| --- |
| `0x8301` | `capability.changed` | draft | 设备能力集合变化 |
| `0x8302` | `capability.methodChanged` | draft | 支持的方法集合变化 |
| `0x8303` | `capability.streamChanged` | draft | 支持的流能力变化 |
| `0x8304` | `capability.limitChanged` | draft | 设备限制参数变化 |

### 5.4 system 事件

| eventId | eventName | 状态 | 说明 |
|---:| --- |---| --- |
| `0x8401` | `system.timeChanged` | draft | 系统时间变化 |
| `0x8402` | `system.configChanged` | draft | 系统配置变化 |
| `0x8403` | `system.lowPower` | draft | 进入低功耗状态 |
| `0x8404` | `system.overTemperature` | draft | 系统过温 |
| `0x8405` | `system.resourceLow` | draft | 系统资源不足 |

### 5.5 display 事件

| eventId | eventName | 状态 | 说明 |
|---:| --- |---| --- |
| `0x8501` | `display.powerChanged` | draft | 显示电源状态变化 |
| `0x8502` | `display.inputSourceChanged` | draft | 输入源变化 |
| `0x8503` | `display.resolutionChanged` | draft | 分辨率变化 |
| `0x8504` | `display.layoutChanged` | draft | 布局变化 |
| `0x8505` | `display.signalLost` | draft | 信号丢失 |
| `0x8506` | `display.signalRestored` | draft | 信号恢复 |
| `0x8507` | `display.brightnessChanged` | mvp | 亮度值变化 |
| `0x8508` | `display.brightnessAutoModeChanged` | draft | 自动亮度模式变化 |
| `0x8509` | `display.brightnessScheduleTriggered` | draft | 亮度计划触发 |

### 5.6 camera 事件

摄像头控制面事件归入 `camera.*`；视频帧数据本身仍必须通过 STREAM 承载。

| eventId | eventName | 状态 | 说明 |
|---:| --- |---| --- |
| `0x8601` | `camera.modeChanged` | draft | 摄像头模式变化 |
| `0x8602` | `camera.mirrorChanged` | draft | 镜像状态变化 |
| `0x8603` | `camera.zoomChanged` | draft | 变焦变化 |
| `0x8604` | `camera.trackingChanged` | draft | 跟踪状态变化 |

### 5.7 video 事件

视频帧数据本身不通过 Event 承载，应通过 `PayloadType = STREAM` 承载。

| eventId | eventName | 状态 | 说明 |
|---:| --- |---| --- |
| `0x8701` | `video.sourceChanged` | draft | 视频源变化 |
| `0x8702` | `video.modeChanged` | draft | 视频模式变化 |
| `0x8703` | `video.signalLost` | draft | 视频信号丢失 |
| `0x8704` | `video.signalRestored` | draft | 视频信号恢复 |
| `0x8705` | `video.streamStarted` | draft | 视频流开始 |
| `0x8706` | `video.streamStopped` | draft | 视频流停止 |
| `0x8707` | `video.frameDropped` | draft | 视频丢帧告警 |

### 5.8 audio 事件

| eventId | eventName | 状态 | 说明 |
|---:| --- |---| --- |
| `0x8801` | `audio.volumeChanged` | draft | 音量变化 |
| `0x8802` | `audio.muteChanged` | draft | 静音状态变化 |
| `0x8803` | `audio.deviceChanged` | draft | 音频设备变化 |
| `0x8804` | `audio.streamStarted` | draft | 音频流开始 |
| `0x8805` | `audio.streamStopped` | draft | 音频流停止 |
| `0x8806` | `audio.clippingDetected` | draft | 爆音或削波检测 |

### 5.9 stream 事件

| eventId | eventName | 状态 | 说明 |
|---:| --- |---| --- |
| `0x8901` | `stream.opened` | draft | 流已打开 |
| `0x8902` | `stream.closed` | draft | 流已关闭 |
| `0x8903` | `stream.error` | draft | 流发生错误 |
| `0x8904` | `stream.paused` | draft | 流已暂停 |
| `0x8905` | `stream.resumed` | draft | 流已恢复 |
| `0x8906` | `stream.qosChanged` | draft | QoS 参数变化 |
| `0x8907` | `stream.statsUpdated` | draft | 流统计信息更新 |
| `0x8908` | `stream.windowUpdated` | draft | 流控窗口变化 |

### 5.10 file 事件

| eventId | eventName | 状态 | 说明 |
|---:| --- |---| --- |
| `0x8A01` | `file.transferStarted` | draft | 文件传输开始 |
| `0x8A02` | `file.transferProgress` | draft | 文件传输进度 |
| `0x8A03` | `file.transferCompleted` | draft | 文件传输完成 |
| `0x8A04` | `file.transferFailed` | draft | 文件传输失败 |
| `0x8A05` | `file.changed` | draft | 文件变化 |

### 5.11 firmware 事件

| eventId | eventName | 状态 | 说明 |
|---:| --- |---| --- |
| `0x8B01` | `firmware.updateStarted` | draft | 固件升级开始 |
| `0x8B02` | `firmware.updateProgress` | mvp | 固件升级进度 |
| `0x8B03` | `firmware.updateCompleted` | mvp | 固件升级完成 |
| `0x8B04` | `firmware.updateFailed` | mvp | 固件升级失败 |
| `0x8B05` | `firmware.verifyStarted` | draft | 固件校验开始 |
| `0x8B06` | `firmware.verifyCompleted` | draft | 固件校验完成 |
| `0x8B07` | `firmware.rebootRequired` | draft | 升级后需要重启 |
| `0x8B08` | `firmware.rollbackStarted` | draft | 回滚开始 |
| `0x8B09` | `firmware.rollbackCompleted` | draft | 回滚完成 |

### 5.12 log 事件

| eventId | eventName | 状态 | 说明 |
|---:| --- |---| --- |
| `0x8C01` | `log.levelChanged` | draft | 日志等级变化 |
| `0x8C02` | `log.streamStarted` | draft | 日志流开始 |
| `0x8C03` | `log.streamStopped` | draft | 日志流停止 |
| `0x8C04` | `log.exportCompleted` | draft | 日志导出完成 |
| `0x8C05` | `log.critical` | draft | 严重日志事件 |

### 5.13 diagnostic 事件

| eventId | eventName | 状态 | 说明 |
|---:| --- |---| --- |
| `0x8D01` | `diagnostic.testStarted` | draft | 诊断测试开始 |
| `0x8D02` | `diagnostic.testProgress` | draft | 诊断测试进度 |
| `0x8D03` | `diagnostic.testCompleted` | draft | 诊断测试完成 |
| `0x8D04` | `diagnostic.testFailed` | draft | 诊断测试失败 |
| `0x8D05` | `diagnostic.metricAlarm` | draft | 指标告警 |
| `0x8D06` | `diagnostic.temperatureAlarm` | draft | 温度告警 |

### 5.14 input / KVM 事件

| eventId | eventName | 状态 | 说明 |
|---:| --- |---| --- |
| `0x9001` | `input.deviceAttached` | draft | 输入设备接入 |
| `0x9002` | `input.deviceDetached` | draft | 输入设备断开 |
| `0x9003` | `input.kvmOpened` | draft | KVM 已开启 |
| `0x9004` | `input.kvmClosed` | draft | KVM 已关闭 |
| `0x9005` | `input.permissionDenied` | draft | 输入权限不足 |

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

### 7.1 device.statusChanged

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

### 7.3 stream.opened

| fieldId | 字段名 | 类型 | 必填 | 说明 |
|---:| --- |---| --- |---|
| `0x01` | `timestamp` | uint64 | 否 | 时间戳 |
| `0x20` | `streamId` | uint32 | 是 | 流 ID |
| `0x21` | `profileId` | uint16 | 是 | Stream Profile ID |
| `0x22` | `mode` | uint8 enum | 否 | 可靠性模式 |

### 7.4 stream.error

| fieldId | 字段名 | 类型 | 必填 | 说明 |
|---:| --- |---| --- |---|
| `0x01` | `timestamp` | uint64 | 否 | 时间戳 |
| `0x20` | `streamId` | uint32 | 是 | 流 ID |
| `0x21` | `errorCode` | uint16 | 是 | 错误码 |
| `0x22` | `seqId` | uint32 | 否 | 相关数据块序号 |
| `0x23` | `message` | string | 否 | 错误描述 |

### 7.5 firmware.updateProgress

| fieldId | 字段名 | 类型 | 必填 | 说明 |
|---:| --- |---| --- |---|
| `0x01` | `timestamp` | uint64 | 否 | 时间戳 |
| `0x20` | `transferId` | uint32 | 是 | OTA 传输 ID |
| `0x21` | `receivedBytes` | uint64 | 是 | 已接收字节数 |
| `0x22` | `totalBytes` | uint64 | 是 | 总字节数 |
| `0x23` | `percent` | uint8 | 否 | 进度百分比 |
| `0x24` | `stage` | uint8 enum | 否 | 当前阶段（`0x01=TRANSFER / 0x02=VERIFY / 0x03=APPLY / 0x04=REBOOT`） |

### 7.6 firmware.updateCompleted

| fieldId | 字段名 | 类型 | 必填 | 说明 |
|---:| --- |---| --- |---|
| `0x01` | `timestamp` | uint64 | 否 | 时间戳 |
| `0x20` | `transferId` | uint32 | 是 | OTA 传输 ID |
| `0x21` | `newVersion` | string | 否 | 新固件版本 |
| `0x22` | `rebootRequired` | bool | 否 | 是否需要重启 |

### 7.7 firmware.updateFailed

| fieldId | 字段名 | 类型 | 必填 | 说明 |
|---:| --- |---| --- |---|
| `0x01` | `timestamp` | uint64 | 否 | 时间戳 |
| `0x20` | `transferId` | uint32 | 是 | OTA 传输 ID |
| `0x21` | `errorCode` | uint16 | 是 | 错误码 |
| `0x22` | `failedStage` | uint8 enum | 否 | 失败阶段 |
| `0x23` | `message` | string | 否 | 错误描述 |

---

## 8. Event 与 Method 的关系

| Method | 可能触发的 Event |
| --- |---|
| `display.setBrightness` | `display.brightnessChanged` |
| `stream.open` | `stream.opened` / `stream.error` |
| `stream.close` | `stream.closed` |
| `firmware.begin` | `firmware.updateProgress` |
| `firmware.verify` | `firmware.updateProgress` / `firmware.updateFailed` |
| `firmware.apply` | `firmware.updateCompleted` / `firmware.rebootRequired` |

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
| 设备状态变化 | `device.statusChanged` |
| 设备错误码上报 | `device.errorOccurred` |
| 亮度变化上报 | `display.brightnessChanged` |
| OTA 进度上报 | `firmware.updateProgress` |
| OTA 成功上报 | `firmware.updateCompleted` |
| OTA 失败上报 | `firmware.updateFailed` |
| 流开启通知 | `stream.opened` |
| 流关闭通知 | `stream.closed` |
| 流异常通知 | `stream.error` |

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
