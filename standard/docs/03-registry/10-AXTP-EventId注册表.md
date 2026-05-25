# 10《AXTP EventId 注册表》

版本：v1.0  
状态：MVP Draft  
适用范围：AXTP Registry / RPC Event / Generator v1 / C++ Demo v1 / 老协议事件适配

---

## 1. 文档目的

本文档定义 AXTP 协议中的 `EventId` 注册规则与首版事件集合。

`EventId` 用于在 `PayloadType = RPC` 且 `rpcOp = EVENT` 时标识业务事件。

事件用于表达设备主动上报的状态变化、异步结果、异常告警、进度通知与流状态变化。

本文档目标是：

1. 固定 AXTP EventId 的分段规则。
2. 定义 MVP 阶段必须实现的事件。
3. 定义完整业务域的事件规划。
4. 定义 Event 与 Method、ErrorCode、Capability、Schema 的关系。
5. 定义老协议事件 / 状态上报到 AXTP EventId 的迁移方式。
6. 为 Generator v1 和 C++ Demo v1 提供可消费的事件注册表结构。

---

## 2. EventId 在协议中的位置

事件只属于 RPC 层，不属于 Frame Header，也不属于 Stream Header。

```text
AXTP Frame Header
  payloadType = RPC
    ↓
RPC Payload
  rpcOp = EVENT
  eventId = xxx
  bodyEncoding = TLV / JSON / CBOR / BINARY
  body = event data
```

EventId 不应出现在：

```text
Frame Header
Control Payload Header
Stream Payload Header
```

这些层只负责传输和解析，不直接理解业务事件。

---

## 3. 事件设计原则

### 3.1 事件表达“已经发生的事实”

事件名应使用过去式或状态变化语义，例如：

```text
device.statusChanged
brightness.changed
firmware.updateProgress
stream.closed
```

不推荐：

```text
device.changeStatus
brightness.set
firmware.update
stream.close
```

因为这些更像命令，不是事件。

---

### 3.2 事件不替代 Response

RPC Response 用于回答一次请求是否执行成功。

Event 用于异步通知后续状态变化。

例如：

```text
RPC Request: brightness.set
RPC Response: 设置请求已接受 / 已完成
RPC Event: brightness.changed
```

对于 OTA：

```text
RPC Request: firmware.begin
RPC Response: 返回 transferId
STREAM: 传输 OTA chunk
RPC Event: firmware.updateProgress
RPC Event: firmware.updateCompleted
```

---

### 3.3 事件必须可订阅、可过滤、可忽略

接收端必须允许忽略未知事件。

事件订阅建议由以下方法完成：

```text
event.subscribe
event.unsubscribe
event.getSubscriptions
```

MVP 阶段也可以允许设备默认推送核心事件。

---

### 3.4 事件数据必须有 Schema

每个事件必须绑定事件数据 Schema。

不允许只定义事件名而不定义数据结构。

事件数据 Schema 推荐使用 TLV Schema 描述。

---

## 4. EventId 分段规划

EventId 使用 `uint16`。

推荐从 `0x8000` 开始分配业务事件，便于与 MethodId 区分。

| 范围 | Domain | 说明 |
|---:|---|---|
| `0x8000-0x80FF` | reserved | 保留 |
| `0x8100-0x81FF` | `device.*` | 设备基础事件 |
| `0x8200-0x82FF` | `session.*` | 业务会话事件 |
| `0x8300-0x83FF` | `capability.*` | 能力变化事件 |
| `0x8400-0x84FF` | `system.*` | 系统状态事件 |
| `0x8500-0x85FF` | `display.*` | 显示类事件 |
| `0x8600-0x86FF` | `brightness.*` | 亮度事件 |
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
| `0x9200-0x92FF` | `ai.*` | AI / 算法事件 |
| `0xF000-0xFFFF` | `vendor.*` | 厂商私有事件 |

---

## 5. MVP EventId 注册表

MVP 阶段只实现能够支撑最小闭环的事件。

最小闭环包括：

```text
设备状态
能力变化
亮度变化
事件订阅结果
Stream 开关与错误
OTA 进度与结果
```

| eventId | eventName | Domain | 状态 | 说明 |
|---:|---|---|---|---|
| `0x8101` | `device.statusChanged` | device | mvp | 设备基础状态变化 |
| `0x8102` | `device.errorOccurred` | device | mvp | 设备错误发生 |
| `0x8301` | `capability.changed` | capability | mvp | 设备业务能力变化 |
| `0x8601` | `brightness.changed` | brightness | mvp | 亮度变化 |
| `0x8901` | `stream.opened` | stream | mvp | 流已打开 |
| `0x8902` | `stream.closed` | stream | mvp | 流已关闭 |
| `0x8903` | `stream.error` | stream | mvp | 流发生错误 |
| `0x8B01` | `firmware.updateStarted` | firmware | mvp | 固件升级开始 |
| `0x8B02` | `firmware.updateProgress` | firmware | mvp | 固件升级进度 |
| `0x8B03` | `firmware.updateCompleted` | firmware | mvp | 固件升级完成 |
| `0x8B04` | `firmware.updateFailed` | firmware | mvp | 固件升级失败 |
| `0x8201` | `event.subscribed` | session | mvp | 事件订阅成功 |
| `0x8202` | `event.unsubscribed` | session | mvp | 事件取消订阅成功 |

---

## 6. 完整 EventId 规划

### 6.1 device 事件

| eventId | eventName | 状态 | 说明 |
|---:|---|---|---|
| `0x8101` | `device.statusChanged` | mvp | 设备状态变化 |
| `0x8102` | `device.errorOccurred` | mvp | 设备错误发生 |
| `0x8103` | `device.online` | draft | 设备上线 |
| `0x8104` | `device.offline` | draft | 设备离线 |
| `0x8105` | `device.rebooting` | draft | 设备即将重启 |
| `0x8106` | `device.factoryResetStarted` | draft | 恢复出厂开始 |
| `0x8107` | `device.factoryResetCompleted` | draft | 恢复出厂完成 |

---

### 6.2 session / event 事件

| eventId | eventName | 状态 | 说明 |
|---:|---|---|---|
| `0x8201` | `event.subscribed` | mvp | 事件订阅成功 |
| `0x8202` | `event.unsubscribed` | mvp | 事件取消订阅成功 |
| `0x8203` | `event.subscriptionChanged` | draft | 事件订阅集合变化 |
| `0x8204` | `session.businessReady` | draft | 业务会话就绪 |
| `0x8205` | `session.businessClosed` | draft | 业务会话关闭 |

说明：

`CONTROL` 的 `OPEN / CLOSE / RESUME` 是协议运行时信令，不应注册为 EventId。这里的 `session.*` 只表达业务层会话状态。

---

### 6.3 capability 事件

| eventId | eventName | 状态 | 说明 |
|---:|---|---|---|
| `0x8301` | `capability.changed` | mvp | 设备能力集合变化 |
| `0x8302` | `capability.methodChanged` | draft | 支持的方法集合变化 |
| `0x8303` | `capability.streamChanged` | draft | 支持的流能力变化 |
| `0x8304` | `capability.limitChanged` | draft | 设备限制参数变化 |

---

### 6.4 system 事件

| eventId | eventName | 状态 | 说明 |
|---:|---|---|---|
| `0x8401` | `system.timeChanged` | draft | 系统时间变化 |
| `0x8402` | `system.configChanged` | draft | 系统配置变化 |
| `0x8403` | `system.lowPower` | draft | 进入低功耗状态 |
| `0x8404` | `system.overTemperature` | draft | 系统过温 |
| `0x8405` | `system.resourceLow` | draft | 系统资源不足 |

---

### 6.5 display 事件

| eventId | eventName | 状态 | 说明 |
|---:|---|---|---|
| `0x8501` | `display.powerChanged` | draft | 显示电源状态变化 |
| `0x8502` | `display.inputSourceChanged` | draft | 输入源变化 |
| `0x8503` | `display.resolutionChanged` | draft | 分辨率变化 |
| `0x8504` | `display.layoutChanged` | draft | 布局变化 |
| `0x8505` | `display.signalLost` | draft | 信号丢失 |
| `0x8506` | `display.signalRestored` | draft | 信号恢复 |

---

### 6.6 brightness 事件

| eventId | eventName | 状态 | 说明 |
|---:|---|---|---|
| `0x8601` | `brightness.changed` | mvp | 亮度值变化 |
| `0x8602` | `brightness.autoModeChanged` | draft | 自动亮度模式变化 |
| `0x8603` | `brightness.scheduleTriggered` | draft | 亮度计划触发 |

---

### 6.7 video 事件

| eventId | eventName | 状态 | 说明 |
|---:|---|---|---|
| `0x8701` | `video.sourceChanged` | draft | 视频源变化 |
| `0x8702` | `video.modeChanged` | draft | 视频模式变化 |
| `0x8703` | `video.signalLost` | draft | 视频信号丢失 |
| `0x8704` | `video.signalRestored` | draft | 视频信号恢复 |
| `0x8705` | `video.streamStarted` | draft | 视频流开始 |
| `0x8706` | `video.streamStopped` | draft | 视频流停止 |
| `0x8707` | `video.frameDropped` | draft | 视频丢帧告警 |

说明：

视频帧数据本身不通过 Event 承载，应通过 `PayloadType = STREAM` 承载。

---

### 6.8 audio 事件

| eventId | eventName | 状态 | 说明 |
|---:|---|---|---|
| `0x8801` | `audio.volumeChanged` | draft | 音量变化 |
| `0x8802` | `audio.muteChanged` | draft | 静音状态变化 |
| `0x8803` | `audio.deviceChanged` | draft | 音频设备变化 |
| `0x8804` | `audio.streamStarted` | draft | 音频流开始 |
| `0x8805` | `audio.streamStopped` | draft | 音频流停止 |
| `0x8806` | `audio.clippingDetected` | draft | 爆音或削波检测 |

---

### 6.9 stream 事件

| eventId | eventName | 状态 | 说明 |
|---:|---|---|---|
| `0x8901` | `stream.opened` | mvp | 流已打开 |
| `0x8902` | `stream.closed` | mvp | 流已关闭 |
| `0x8903` | `stream.error` | mvp | 流发生错误 |
| `0x8904` | `stream.paused` | draft | 流已暂停 |
| `0x8905` | `stream.resumed` | draft | 流已恢复 |
| `0x8906` | `stream.qosChanged` | draft | QoS 参数变化 |
| `0x8907` | `stream.statsUpdated` | draft | 流统计信息更新 |
| `0x8908` | `stream.windowUpdated` | draft | 流控窗口变化 |

---

### 6.10 file 事件

| eventId | eventName | 状态 | 说明 |
|---:|---|---|---|
| `0x8A01` | `file.transferStarted` | draft | 文件传输开始 |
| `0x8A02` | `file.transferProgress` | draft | 文件传输进度 |
| `0x8A03` | `file.transferCompleted` | draft | 文件传输完成 |
| `0x8A04` | `file.transferFailed` | draft | 文件传输失败 |
| `0x8A05` | `file.changed` | draft | 文件变化 |

---

### 6.11 firmware 事件

| eventId | eventName | 状态 | 说明 |
|---:|---|---|---|
| `0x8B01` | `firmware.updateStarted` | mvp | 固件升级开始 |
| `0x8B02` | `firmware.updateProgress` | mvp | 固件升级进度 |
| `0x8B03` | `firmware.updateCompleted` | mvp | 固件升级完成 |
| `0x8B04` | `firmware.updateFailed` | mvp | 固件升级失败 |
| `0x8B05` | `firmware.verifyStarted` | draft | 固件校验开始 |
| `0x8B06` | `firmware.verifyCompleted` | draft | 固件校验完成 |
| `0x8B07` | `firmware.rebootRequired` | draft | 升级后需要重启 |
| `0x8B08` | `firmware.rollbackStarted` | draft | 回滚开始 |
| `0x8B09` | `firmware.rollbackCompleted` | draft | 回滚完成 |

---

### 6.12 log 事件

| eventId | eventName | 状态 | 说明 |
|---:|---|---|---|
| `0x8C01` | `log.levelChanged` | draft | 日志等级变化 |
| `0x8C02` | `log.streamStarted` | draft | 日志流开始 |
| `0x8C03` | `log.streamStopped` | draft | 日志流停止 |
| `0x8C04` | `log.exportCompleted` | draft | 日志导出完成 |
| `0x8C05` | `log.critical` | draft | 严重日志事件 |

---

### 6.13 diagnostic 事件

| eventId | eventName | 状态 | 说明 |
|---:|---|---|---|
| `0x8D01` | `diagnostic.testStarted` | draft | 诊断测试开始 |
| `0x8D02` | `diagnostic.testProgress` | draft | 诊断测试进度 |
| `0x8D03` | `diagnostic.testCompleted` | draft | 诊断测试完成 |
| `0x8D04` | `diagnostic.testFailed` | draft | 诊断测试失败 |
| `0x8D05` | `diagnostic.metricAlarm` | draft | 指标告警 |
| `0x8D06` | `diagnostic.temperatureAlarm` | draft | 温度告警 |

---

### 6.14 input / KVM 事件

| eventId | eventName | 状态 | 说明 |
|---:|---|---|---|
| `0x9001` | `input.deviceAttached` | draft | 输入设备接入 |
| `0x9002` | `input.deviceDetached` | draft | 输入设备断开 |
| `0x9003` | `input.kvmOpened` | draft | KVM 已开启 |
| `0x9004` | `input.kvmClosed` | draft | KVM 已关闭 |
| `0x9005` | `input.permissionDenied` | draft | 输入权限不足 |

---

## 7. Event Schema 规范

每个事件必须绑定一个事件数据 Schema。

推荐事件数据统一使用 TLV Schema。

### 7.1 通用事件字段

| fieldId | 字段名 | 类型 | 说明 |
|---:|---|---|---|
| `0x01` | `timestamp` | uint64 | 事件发生时间 |
| `0x02` | `sequence` | uint32 | 事件序号 |
| `0x03` | `source` | uint16 | 事件来源模块 |
| `0x04` | `severity` | uint8 enum | 事件严重级别 |
| `0x05` | `reasonCode` | uint16 | 原因码 |
| `0x06` | `errorCode` | uint16 | 错误码 |
| `0x07` | `message` | string | 可读消息 |
| `0x7F` | `vendorData` | bytes | 厂商私有数据 |

### 7.2 severity 枚举

| 值 | 名称 | 说明 |
|---:|---|---|
| `0x00` | `INFO` | 普通信息 |
| `0x01` | `WARNING` | 警告 |
| `0x02` | `ERROR` | 错误 |
| `0x03` | `CRITICAL` | 严重错误 |

---

## 8. MVP 事件 Schema 示例

### 8.1 device.statusChanged

| fieldId | 字段名 | 类型 | 必填 | 说明 |
|---:|---|---|---|---|
| `0x01` | `timestamp` | uint64 | 否 | 时间戳 |
| `0x20` | `oldStatus` | uint8 enum | 否 | 旧状态 |
| `0x21` | `newStatus` | uint8 enum | 是 | 新状态 |
| `0x22` | `reasonCode` | uint16 | 否 | 状态变化原因 |

状态枚举：

| 值 | 名称 |
|---:|---|
| `0x00` | `UNKNOWN` |
| `0x01` | `IDLE` |
| `0x02` | `BUSY` |
| `0x03` | `UPDATING` |
| `0x04` | `ERROR` |

---

### 8.2 brightness.changed

| fieldId | 字段名 | 类型 | 必填 | 说明 |
|---:|---|---|---|---|
| `0x01` | `timestamp` | uint64 | 否 | 时间戳 |
| `0x20` | `oldValue` | uint8 | 否 | 旧亮度 |
| `0x21` | `newValue` | uint8 | 是 | 新亮度 |
| `0x22` | `source` | uint8 enum | 否 | 来源 |

source 枚举：

| 值 | 名称 |
|---:|---|
| `0x01` | `RPC` |
| `0x02` | `LOCAL_KEY` |
| `0x03` | `AUTO` |
| `0x04` | `SCHEDULE` |

---

### 8.3 stream.opened

| fieldId | 字段名 | 类型 | 必填 | 说明 |
|---:|---|---|---|---|
| `0x01` | `timestamp` | uint64 | 否 | 时间戳 |
| `0x20` | `streamId` | uint32 | 是 | 流 ID |
| `0x21` | `profileId` | uint16 | 是 | Stream Profile ID |
| `0x22` | `mode` | uint8 enum | 否 | 可靠性模式 |

---

### 8.4 stream.error

| fieldId | 字段名 | 类型 | 必填 | 说明 |
|---:|---|---|---|---|
| `0x01` | `timestamp` | uint64 | 否 | 时间戳 |
| `0x20` | `streamId` | uint32 | 是 | 流 ID |
| `0x21` | `errorCode` | uint16 | 是 | 错误码 |
| `0x22` | `seqId` | uint32 | 否 | 相关数据块序号 |
| `0x23` | `message` | string | 否 | 错误描述 |

---

### 8.5 firmware.updateProgress

| fieldId | 字段名 | 类型 | 必填 | 说明 |
|---:|---|---|---|---|
| `0x01` | `timestamp` | uint64 | 否 | 时间戳 |
| `0x20` | `transferId` | uint32 | 是 | OTA 传输 ID |
| `0x21` | `receivedBytes` | uint64 | 是 | 已接收字节数 |
| `0x22` | `totalBytes` | uint64 | 是 | 总字节数 |
| `0x23` | `percent` | uint8 | 否 | 进度百分比 |
| `0x24` | `stage` | uint8 enum | 否 | 当前阶段 |

stage 枚举：

| 值 | 名称 |
|---:|---|
| `0x01` | `TRANSFER` |
| `0x02` | `VERIFY` |
| `0x03` | `APPLY` |
| `0x04` | `REBOOT` |

---

### 8.6 firmware.updateCompleted

| fieldId | 字段名 | 类型 | 必填 | 说明 |
|---:|---|---|---|---|
| `0x01` | `timestamp` | uint64 | 否 | 时间戳 |
| `0x20` | `transferId` | uint32 | 是 | OTA 传输 ID |
| `0x21` | `newVersion` | string | 否 | 新固件版本 |
| `0x22` | `rebootRequired` | bool | 否 | 是否需要重启 |

---

### 8.7 firmware.updateFailed

| fieldId | 字段名 | 类型 | 必填 | 说明 |
|---:|---|---|---|---|
| `0x01` | `timestamp` | uint64 | 否 | 时间戳 |
| `0x20` | `transferId` | uint32 | 是 | OTA 传输 ID |
| `0x21` | `errorCode` | uint16 | 是 | 错误码 |
| `0x22` | `failedStage` | uint8 enum | 否 | 失败阶段 |
| `0x23` | `message` | string | 否 | 错误描述 |

---

## 9. Event 与 Method 的关系

事件通常由方法触发，但二者不是一一对应。

| Method | 可能触发的 Event |
|---|---|
| `brightness.set` | `brightness.changed` |
| `stream.open` | `stream.opened` / `stream.error` |
| `stream.close` | `stream.closed` |
| `firmware.begin` | `firmware.updateStarted` |
| `firmware.verify` | `firmware.updateProgress` / `firmware.updateFailed` |
| `firmware.apply` | `firmware.updateCompleted` / `firmware.rebootRequired` |
| `event.subscribe` | `event.subscribed` |
| `event.unsubscribe` | `event.unsubscribed` |

Generator 可以根据 Method Registry 中的 `emits` 字段建立关联。

示例：

```yaml
methods:
  - id: 0x0602
    name: brightness.set
    emits:
      - brightness.changed
```

---

## 10. Event 与 Capability 的关系

设备是否支持某个事件，应通过 Capability Registry 暴露。

推荐能力字段：

```text
supportedEvents
supportedEventDomains
eventSubscriptionSupported
maxEventSubscriptions
defaultEnabledEvents
```

MVP 阶段至少支持：

```text
capability.getAll 返回 supportedEvents
```

---

## 11. Event 与 ErrorCode 的关系

事件可以携带 `errorCode`，但事件本身不等于错误。

例如：

```text
firmware.updateFailed
  errorCode = AXTP_ERR_FIRMWARE_CRC_MISMATCH
```

```text
stream.error
  errorCode = AXTP_ERR_STREAM_SEQ_MISSING
```

错误码必须来自 ErrorCode Registry。

---

## 12. Event 与 Control 的关系

Control 层的 ACK/NACK、OPEN、HEARTBEAT 不应作为 Event 上报。

原因：

```text
CONTROL 是协议运行时信令
EVENT 是业务层异步通知
```

例如：

```text
CONTROL NACK
```

表示传输层或协议层确认失败。

```text
stream.error
```

表示业务流发生错误。

二者可以相关，但不能混用。

---

## 13. 老协议事件适配规则

### 13.1 旧状态上报适配为 Event

旧协议中常见状态上报可以迁移为：

| 旧协议语义 | AXTP Event |
|---|---|
| 设备状态变化 | `device.statusChanged` |
| 设备错误码上报 | `device.errorOccurred` |
| 亮度变化上报 | `brightness.changed` |
| OTA 进度上报 | `firmware.updateProgress` |
| OTA 成功上报 | `firmware.updateCompleted` |
| OTA 失败上报 | `firmware.updateFailed` |
| 流开启通知 | `stream.opened` |
| 流关闭通知 | `stream.closed` |
| 流异常通知 | `stream.error` |

---

### 13.2 旧 CmdValue Event 迁移

如果老协议中存在独立事件 CmdValue，可以保留其值作为 `legacyId`，但不建议直接作为 AXTP EventId。

推荐写法：

```yaml
events:
  - id: 0x8601
    name: brightness.changed
    domain: brightness
    status: mvp
    legacy:
      protocol: AXDP_HID
      legacyId: 0xC1021
      legacyName: CommonBrightnessChanged
```

---

### 13.3 旧 Polling 模式迁移

如果旧协议没有事件，只能轮询状态，则 AXTP 可以提供两种兼容方式：

1. 保留轮询方法，例如 `brightness.get`。
2. 新增事件上报，例如 `brightness.changed`。

MVP 阶段可以同时支持轮询和事件。

---

## 14. Event Registry YAML 示例

```yaml
registry:
  name: axtp_event_registry
  version: 1.0.0
  idType: uint16
  idRange: "0x8000-0xFFFF"

events:
  - id: 0x8601
    name: brightness.changed
    domain: brightness
    status: mvp
    description: Brightness value changed.
    payloadType: RPC
    rpcOp: EVENT
    bodyEncoding:
      - TLV
      - JSON
    schema: BrightnessChangedEvent
    severity: info
    relatedMethods:
      - brightness.set
      - brightness.increase
      - brightness.decrease
    capability: cap.event.brightness.changed
    since: 1.0.0

  - id: 0x8B02
    name: firmware.updateProgress
    domain: firmware
    status: mvp
    description: Firmware update progress notification.
    payloadType: RPC
    rpcOp: EVENT
    bodyEncoding:
      - TLV
      - JSON
    schema: FirmwareUpdateProgressEvent
    severity: info
    relatedMethods:
      - firmware.begin
      - firmware.verify
      - firmware.apply
    capability: cap.event.firmware.updateProgress
    since: 1.0.0
```

---

## 15. JSON Event 示例

```json
{
  "op": "event",
  "event": "brightness.changed",
  "eventId": 34305,
  "data": {
    "oldValue": 60,
    "newValue": 80,
    "source": "RPC"
  }
}
```

其中：

```text
34305 = 0x8601
```

---

## 16. Binary Event 示例

```text
Frame Header:
  payloadType = RPC

RPC Payload:
  rpcEncoding     = BINARY
  rpcOp           = EVENT
  requestId       = 0x00000000
  methodOrEventId = 0x8601
  statusCode      = 0x0000
  bodyEncoding    = TLV
  bodyLen         = 6

Body TLV:
  20 01 3C        // oldValue = 60
  21 01 50        // newValue = 80
```

说明：

Event 不需要 requestId 匹配，因此 `requestId = 0`。

---

## 17. Generator v1 要求

Generator v1 必须从 Event Registry 生成：

```text
EventId enum
Event name string table
EventId ↔ eventName 映射表
Event schema descriptor
Event capability descriptor
Markdown 事件表
C++ Event Decoder skeleton
```

C++ 示例：

```cpp
enum class AxtpEventId : uint16_t {
    DeviceStatusChanged = 0x8101,
    DeviceErrorOccurred = 0x8102,
    CapabilityChanged = 0x8301,
    BrightnessChanged = 0x8601,
    StreamOpened = 0x8901,
    StreamClosed = 0x8902,
    StreamError = 0x8903,
    FirmwareUpdateStarted = 0x8B01,
    FirmwareUpdateProgress = 0x8B02,
    FirmwareUpdateCompleted = 0x8B03,
    FirmwareUpdateFailed = 0x8B04,
};
```

---

## 18. C++ Demo v1 必须实现事件

C++ Demo v1 至少实现以下事件的编码与解码：

```text
brightness.changed
stream.opened
stream.closed
stream.error
firmware.updateProgress
firmware.updateCompleted
firmware.updateFailed
```

Demo 推荐流程：

```text
client -> RPC brightness.set
server -> RPC response success
server -> EVENT brightness.changed

client -> RPC firmware.begin
server -> EVENT firmware.updateStarted
client -> STREAM OTA chunk
server -> EVENT firmware.updateProgress
server -> EVENT firmware.updateCompleted
```

---

## 19. MVP event_registry.yaml

```yaml
events:
  - id: 0x8101
    name: device.statusChanged
    domain: device
    status: mvp
    schema: DeviceStatusChangedEvent

  - id: 0x8102
    name: device.errorOccurred
    domain: device
    status: mvp
    schema: DeviceErrorOccurredEvent

  - id: 0x8301
    name: capability.changed
    domain: capability
    status: mvp
    schema: CapabilityChangedEvent

  - id: 0x8601
    name: brightness.changed
    domain: brightness
    status: mvp
    schema: BrightnessChangedEvent

  - id: 0x8901
    name: stream.opened
    domain: stream
    status: mvp
    schema: StreamOpenedEvent

  - id: 0x8902
    name: stream.closed
    domain: stream
    status: mvp
    schema: StreamClosedEvent

  - id: 0x8903
    name: stream.error
    domain: stream
    status: mvp
    schema: StreamErrorEvent

  - id: 0x8B01
    name: firmware.updateStarted
    domain: firmware
    status: mvp
    schema: FirmwareUpdateStartedEvent

  - id: 0x8B02
    name: firmware.updateProgress
    domain: firmware
    status: mvp
    schema: FirmwareUpdateProgressEvent

  - id: 0x8B03
    name: firmware.updateCompleted
    domain: firmware
    status: mvp
    schema: FirmwareUpdateCompletedEvent

  - id: 0x8B04
    name: firmware.updateFailed
    domain: firmware
    status: mvp
    schema: FirmwareUpdateFailedEvent

  - id: 0x8201
    name: event.subscribed
    domain: session
    status: mvp
    schema: EventSubscribedEvent

  - id: 0x8202
    name: event.unsubscribed
    domain: session
    status: mvp
    schema: EventUnsubscribedEvent
```

---

## 20. 测试向量建议

后续 TestVector 文档应至少覆盖：

```text
1. JSON brightness.changed event
2. Binary TLV brightness.changed event
3. Binary TLV firmware.updateProgress event
4. Binary TLV stream.error event
5. unknown eventId skip / report
6. unsupported event subscription error
7. deprecated event compatibility
```

---

## 21. 验收标准

本注册表完成后，应满足：

1. 所有 MVP EventId 唯一。
2. 所有 MVP Event 均有 Schema。
3. 所有事件均属于 `PayloadType = RPC`。
4. 所有事件均可由 Generator 生成枚举和映射表。
5. C++ Demo 能解析 `brightness.changed`、`stream.error`、`firmware.updateProgress`。
6. 老协议状态上报能映射到 AXTP Event。
7. 未知 EventId 不导致协议解析失败。

---

## 22. 总结

AXTP EventId Registry 的核心定位是：

```text
MethodId 负责命令
EventId 负责异步事实
ErrorCode 负责失败原因
Capability 负责是否支持
Schema 负责字段结构
```

MVP 阶段优先实现：

```text
device.statusChanged
brightness.changed
stream.opened
stream.closed
stream.error
firmware.updateProgress
firmware.updateCompleted
firmware.updateFailed
```

这组事件已经足够支撑最小设备控制、状态变化、流传输与 OTA 闭环。
