# 08 Capability Taxonomy Migration Notes

本文件归档 08《AXTP Capability Naming and Feature Taxonomy》中曾用于迁移分析的新旧分类说明。正式 specs 正文只保留最终 capability feature 清单和命名规范。

## 原第 5 节迁移说明

本清单用于新增业务协议、legacy 迁移和 capability registry 整理。未列出的 feature 必须先按本规范判断粒度，再进入 registry。

### 5.1 Audio

```text
audio.algorithm
audio.eq
audio.volume
audio.mixer
audio.routing
audio.input
audio.output
audio.recording
audio.playback
audio.uac
audio.dante
```

迁移说明：

| 旧分类 | 新分类 | 说明 |
|---|---|---|
| `audio.source` | `audio.routing` / `audio.input` | 输入源选择归 input，输入输出关系归 routing。 |
| `audio.lineIn` | `audio.input` | line-in 是输入类型，不是独立 feature。 |
| `audio.backgroundMusic` | `audio.playback` | 避免使用业务定制名。 |
| `audio.algorithm` | `audio.algorithm` | 保留，用于 noise suppression / echo cancellation / auto gain control 等算法配置。 |
| `audio.eq` | `audio.eq` | 保留，EQ 结构复杂，独立于 algorithm。 |
| `audio.recording` | `audio.recording` | 用于音频录制、抓音、stream/file 输出。 |

### 5.2 Video

```text
video.framing
video.outputTransform
video.pip
video.encoder
video.osd
video.overlay
video.layout
video.scene
video.recording
video.stream
video.rtsp
video.ndi
```

迁移说明：

| 旧分类 | 新分类 | 说明 |
|---|---|---|
| `video.framingMode` | `video.framing` | mode 是字段或状态。 |
| `video.framingConfig` | `video.framing` | config 是方法或 schema。 |
| `video.wallLayout` | `video.layout` | 使用通用布局能力块。 |
| `video.presentationScene` | `video.scene` | 使用通用场景能力块。 |
| `video.liveStream` | `video.stream` | 直播属于视频流能力。 |
| `video.mjpeg` | `video.stream` / `video.encoder` | codec 不作为独立 feature。 |
| `video.rtsp` | `video.rtsp` | 保留，用于 RTSP 服务配置。 |
| `video.ndi` | `video.ndi` | 保留，用于 NDI 服务配置。 |

### 5.3 Camera

```text
camera.image
camera.exposure
camera.whiteBalance
camera.focus
camera.zoom
camera.ptz
camera.calibration
```

迁移说明：

| 旧分类 | 新分类 | 说明 |
|---|---|---|
| `camera.focusZoom` | `camera.focus` / `camera.zoom` / `camera.ptz` | focus、zoom、ptz 是不同能力块。 |

### 5.4 Display

```text
display.brightness
display.color
display.backlight
display.power
display.input
display.output
```

迁移说明：

| 旧分类 | 新分类 | 说明 |
|---|---|---|
| `display.brightnessMin` | `display.brightness` | min 是 brightness capabilities/config schema 字段。 |
| `display.brightnessMax` | `display.brightness` | max 是 brightness capabilities/config schema 字段。 |
| `display.brightnessStep` | `display.brightness` | step 是 brightness capabilities/config schema 字段。 |

### 5.5 Network

```text
network.interface
network.ip
network.wifi
network.ap
network.bluetooth
network.serviceEndpoint
```

迁移说明：

| 旧分类 | 新分类 | 说明 |
|---|---|---|
| `network.interfaces` | `network.interface` | feature 使用单数。 |
| `network.ipConfig` | `network.ip` | config 是方法或 schema。 |
| `network.dnsConfig` | `network.ip` | DNS 是 IP 配置字段组。 |
| `network.defaultRoute` | `network.ip` | route 是 IP 配置字段组。 |
| `network.wifiConfig` | `network.wifi` | Wi-Fi 不只包含配置，还包含扫描、连接和状态。 |
| `network.wifiScan` | `network.wifi` | scan 是动作方法。 |
| `network.wifiConnection` | `network.wifi` | connection 是状态或动作结果。 |
| `network.apConfig` | `network.ap` | config 是方法或 schema。 |
| `network.apState` | `network.ap` | state 是状态方法或事件。 |
| `network.softAp` | `network.ap` | SoftAP 是 AP 工作模式，不作为单独 feature。 |
| `network.bluetooth` | `network.bluetooth` | 保留。 |
| `network.serviceEndpoint` | `network.serviceEndpoint` | 保留，用于服务端点发现或控制服务入口信息。 |

`network.wifi` 下可包含方法：

```text
network.getWifiCapabilities
network.getWifiConfig
network.setWifiConfig
network.resetWifiConfig
network.scanWifi
network.connectWifi
network.disconnectWifi
network.getWifiState
network.wifiConfigChanged
network.wifiStateChanged
network.wifiScanResultReported
```

`network.ap` 下可包含方法：

```text
network.getApCapabilities
network.getApConfig
network.setApConfig
network.resetApConfig
network.startAp
network.stopAp
network.getApState
network.getApClients
network.apConfigChanged
network.apStateChanged
network.apClientChanged
```

RTSP / NDI / Dante / VISCA 等具体服务配置仍归各自业务域，不归 `network.serviceEndpoint`。

### 5.6 Storage

```text
storage.sdCard
storage.disk
storage.volume
storage.media
storage.recording
storage.index
```

迁移说明：

| 旧分类 | 新分类 | 说明 |
|---|---|---|
| `storage.mediaFiles` | `storage.media` | files 是资源集合，不作为 feature 后缀。 |
| `storage.recordingFiles` | `storage.recording` | recording 是能力块，文件列表是方法或 schema。 |
| `storage.fileIndex` | `storage.index` | index 是存储索引能力块。 |

### 5.7 Stream / File

Stream 只保留公共能力：

```text
stream.flowControl
```

可选：

```text
stream.profile
```

文件域保留：

```text
file.transfer
file.storage
```

必须删除或迁移以下分类：

| 旧分类 | 新分类 | 说明 |
|---|---|---|
| `stream.fileTransfer` | `file.transfer` | 文件传输是 file 业务域能力。 |
| `stream.firmwareTransfer` | `firmware.ota` | 固件传输是 OTA 业务流。 |
| `stream.mediaTransfer` | `video.stream` / `audio.recording` | 媒体流由媒体业务域创建。 |
| `stream.logTransfer` | `log.stream` / `log.export` | 日志实时流和导出任务归 log 域。 |
| `stream.previewStream` | `video.stream` | preview 是视频流用途，不是 stream feature。 |
| `stream.hidMedia` | `video.stream` / `audio.recording` / `stream.flowControl` | HID 是 transport，media 是业务分类。 |

### 5.8 Firmware

```text
firmware.info
firmware.ota
firmware.updatePolicy
```

迁移说明：

| 旧分类 | 新分类 | 说明 |
|---|---|---|
| `firmware.version` | `firmware.info` | version 是固件信息字段。 |
| `firmware.updateState` | `firmware.ota` | state 是 OTA 状态方法或事件。 |
| `firmware.updatePolicy` | `firmware.updatePolicy` | 保留，可选。 |

`firmware.ota` 下可包含方法：

```text
firmware.getOtaCapabilities
firmware.beginOta
firmware.getOtaState
firmware.getOtaTransferState
firmware.commitOtaBatch
firmware.verifyOtaFiles
firmware.installOta
firmware.confirmOta
firmware.rollbackOta
firmware.cancelOta
firmware.otaStateChanged
firmware.otaProgressReported
```

已 stable 的 `firmware.begin` / `firmware.end` / `firmware.verify` / `firmware.apply` 可以作为 v1 兼容方法保留；新增 OTA 方法优先使用带 `Ota` 的明确命名。

### 5.9 Device

```text
device.info
device.identity
device.state
device.power
device.indicator
device.button
device.inventory
device.childDevice
```

迁移说明：

| 旧分类 | 新分类 | 说明 |
|---|---|---|
| `device.status` | `device.state` | 统一使用 state 表达状态查询和变化。 |
| `device.capability` | `capability.registry` | capability 是独立域或注册表能力。 |
| `device.childDevices` | `device.childDevice` | feature 使用单数。 |

### 5.10 System

```text
system.time
system.lifecycle
system.reset
system.initialization
system.license
```

迁移说明：

| 旧分类 | 新分类 | 说明 |
|---|---|---|
| `system.timezone` | `system.time` | timezone 是 time 配置字段。 |
| `system.rebootPolicy` | `system.lifecycle` | 除非存在复杂策略，否则归生命周期能力。 |
| `system.license` | `system.license` | 仅用于系统级 license。 |

算法模块 license、产测写入、工厂授权更建议归 `diagnostic.*` 或 `vendor.*`。

### 5.11 Input

```text
input.key
input.hid
input.source
input.kvm
input.gpio
```

迁移说明：

| 旧分类 | 新分类 | 说明 |
|---|---|---|
| `ioinput.source` | `input.source` | 修正 domain 拼写。 |
| `input.gp` | `input.gpio` | 使用标准 GPIO 术语。 |
| 接听/挂断键、组合键、HID 上报开关 | `input.hid` / `input.key` | 按是否属于 HID 上报或本地按键能力归类。 |

### 5.12 Room / Collaboration

```text
room.info
room.schedule
room.source
room.layout
room.participant
```

迁移说明：

| 旧分类 | 新分类 | 说明 |
|---|---|---|
| `room.identity` | `room.info` | identity 是 room info 字段组。 |
| `room.inputSource` | `room.source` | source 已能表达输入源。 |
| `room.participantDevice` | `room.participant` | participant 是能力块，device 是字段或关系。 |

### 5.13 Signage

```text
signage.media
signage.playlist
signage.schedule
signage.playback
signage.osd
```

迁移说明：

| 旧分类 | 新分类 | 说明 |
|---|---|---|
| `signage.playbacksignage.osd` | `signage.playback` / `signage.osd` | 拼接错误，必须拆分。 |

### 5.14 Log

```text
log.stream
log.export
log.files
```

说明：

| Feature | 说明 |
|---|---|
| `log.stream` | 实时日志流。 |
| `log.export` | 日志导出任务。 |
| `log.files` | 日志文件列表、日志文件元信息、删除。 |

日志文件下载仍然使用 `file.download` 或 `file.transfer` 下的方法，不在 `log.files` 中承载二进制数据面。

### 5.15 Diagnostic / Manufacturing

```text
diagnostic.selfTest
diagnostic.networkTest
diagnostic.audioTest
diagnostic.videoTest
diagnostic.storageTest
diagnostic.inputTest
diagnostic.kvmTest
diagnostic.calibration
diagnostic.manufacturing
diagnostic.report
```

迁移说明：

| 旧分类 | 新分类 | 说明 |
|---|---|---|
| `diagnostic.buttonTest` | `diagnostic.inputTest` | 按键测试属于输入测试。 |
| `diagnostic.manufacturingIdentity` | `diagnostic.manufacturing` | identity 是产测信息字段。 |

产测、校准、license 写入、工厂参数写入建议归 `diagnostic.*` 或厂商私有 `vendor.*`。

### 5.16 Privacy / Auth / Capability

```text
privacy.cover
privacy.mode
privacy.state

auth.session
auth.permission
auth.token

capability.registry
```

说明：

| Feature | 说明 |
|---|---|
| `capability.registry` | 用于能力注册表查询与协商。 |
| `privacy.mode` | 隐私模式配置或切换。 |
| `privacy.state` | 隐私状态查询与变化通知。 |

---

## 原第 7 节当前仓库影响清单

以下条目来自当前仓库中已出现的能力、方法和事件命名，用于指导后续 registry 调整。

| 旧 ID / 名称 | 新 ID / 名称 | 迁移原因 | 兼容保留 | 涉及方法 | 涉及事件 |
|---|---|---|---|---|---|
| `network.softAp` | `network.ap` | SoftAP 是 AP 工作模式；AP 能力还包含 config/state/client。 | draft 可直接迁移，或保留 alias 一个版本。 | `network.getApInfo` 可演进为 `network.getApState` / `network.getApConfig`。 | `network.apInfoChanged` 可演进为 `network.apStateChanged` / `network.apConfigChanged`。 |
| `stream.hidMedia` | `video.stream` / `audio.recording` / `stream.flowControl` | HID 是 transport，media 是业务类型；stream 域不承担业务分类。 | draft 可迁移；如保留，只作为 profile 兼容说明。 | `stream.open` 迁移到 `video.openStream`、`audio.openRecordingStream` 或其他业务建流方法。 | `stream.opened`、`stream.error` 迁移到业务域 stream state/error 事件；公共流控错误保留在 stream/control 层。 |
| `stream.open` | 业务域 open stream 方法 | 常规 `stream.open` 会让 stream 域承载业务分类。 | draft 不建议晋升为 Core/MVP；如保留，限定为 P1 vendor/private 通用建流。 | `video.openStream`、`log.openStream`、`file.beginTransfer`、`firmware.beginOta`。 | 业务域 `streamStateChanged`。 |
| `display.brightnessMin` | `display.brightness` | min 是 brightness capability schema 字段，不是独立 feature。 | v1 MVP 字段级 fact 可兼容保留；v2 收敛到 schema。 | `display.getBrightness` / `display.setBrightness`；未来 `display.getBrightnessCapabilities`。 | `display.brightnessChanged`。 |
| `display.brightnessMax` | `display.brightness` | max 是 brightness capability schema 字段，不是独立 feature。 | v1 MVP 字段级 fact 可兼容保留；v2 收敛到 schema。 | 同上。 | 同上。 |
| `display.brightnessStep` | `display.brightness` | step 是 brightness capability schema 字段，不是独立 feature。 | v1 MVP 字段级 fact 可兼容保留；v2 收敛到 schema。 | 同上。 | 同上。 |
| `firmware.begin` / `firmware.end` / `firmware.verify` / `firmware.apply` | `firmware.beginOta` / `firmware.cancelOta` / `firmware.verifyOtaFiles` / `firmware.installOta` | 旧名可工作，但新模板应显式绑定 OTA feature。 | stable v1 方法保留；新增能力使用 Ota 后缀。 | 当前方法仍归属 `firmware.ota`。 | 当前事件仍归属 `firmware.ota`。 |
| `firmware.updateProgress` | `firmware.otaProgressReported` | update 是泛词，progress reported 更明确。 | stable v1 事件保留；新增事件使用推荐模板。 | `firmware.begin` / `firmware.verify` / `firmware.apply`。 | `firmware.updateProgress`。 |
| `firmware.updateCompleted` / `firmware.updateFailed` | `firmware.otaStateChanged` / `firmware.otaResultReported` | completed/failed 是 OTA 状态或结果。 | stable v1 事件保留；新增事件使用推荐模板。 | `firmware.verify` / `firmware.apply`。 | 当前完成/失败事件。 |

---
