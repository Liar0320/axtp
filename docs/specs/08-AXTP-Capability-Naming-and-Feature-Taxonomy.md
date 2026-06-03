# 08《AXTP Capability Naming and Feature Taxonomy》

> Status: AXTP v1/v2 Capability Governance
> Spec Version: 0.1.0
> Scope: `domain.feature` capability naming, feature taxonomy, method/event naming templates, registry migration guidance

版本：v0.1.0
状态：Capability 命名与 Feature 分类规范
适用范围：`registry/capability/`、`registry/method/`、`registry/event/`、`registry/domains/<domain>/domain.yaml`、legacy 迁移映射和业务协议文档

---

## 0. 速读：命名治理只管“归属和粒度”

08 用来回答：一个业务能力应该放在哪个 domain、feature 该多粗、method/event 应该叫什么。它不分配 methodId / eventId / errorCode / capabilityId，具体编号和机器事实仍由 09-14 与 registry YAML 负责。

命名决策顺序：

```text
1. 先选 domain：device / display / firmware / network / stream / ...
2. 再选 feature：domain.feature，表达能力块，不表达字段名。
3. 再定义 method/event：method 表达动作，event 表达状态变化。
4. 最后进入 registry：普通业务事实默认写入 registry/domains/<domain>/domain.yaml。
```

`docs/protocol/<domain>/<domain.feature>.md` 中的每个协议方案草案，都必须先按本文件反向确认 domain、feature 粒度、method/event 命名模板和 stream 边界；确认通过后才能进入 09-13 的 ID、schema 和 registry 固化流程。

关键边界：

| 不要这样 | 应该这样 |
|---|---|
| `stream.fileTransfer` 表达业务类型 | `file.*` method 建流，STREAM 只承载 streamId/seqId/cursor/data |
| `network.wifiConfig` 作为 feature | `network.wifi` feature，config 是字段或方法 |
| 把旧 CmdValue 逐条变成 capability | 按 domain.feature 聚合能力 |
| 把 transport 名称写进业务 feature | transport/profile 由 03/14/18 表达 |

---

## 1. 文档定位

本文档定义 AXTP 能力分类中的 `domain.feature` 体系，用于统一能力块粒度、Capability ID 命名、RPC 方法命名、事件命名和 legacy 迁移归类。

本文档不直接登记具体 methodId / eventId / capability numeric id。机器可读事实仍以 `registry/**/*.yaml` 与 `registry/domains/**/*.yaml` 为准；本规范负责约束这些事实源中的命名与归属。

核心原则：

1. `domain.feature` 是能力块，不是字段名。
2. feature ID 必须稳定、适中粒度，不要过细。
3. 不要把 `Config` / `State` / `Mode` / `Policy` 这类字段词轻易放进 feature ID。
4. Capability ID 可以粗一点，method 可以细一点。
5. 配置、状态、动作、流、文件导出必须使用不同方法模板。
6. `stream` 域只负责公共流控和数据面，不按业务类型拆分。
7. 业务流由业务域创建，`stream` 只承载 `streamId` / `seqId` / `cursor` / `payloadType` / `payload` 和可选流控方法。
8. `codec`、`mode`、`state`、`config` 通常是 feature 下的字段或方法，不应直接成为独立 feature。

一句话规则：

```text
feature 是能力块；
method 才表达具体动作、配置、状态和事件。
```

推荐：

```text
network.wifi
video.framing
audio.algorithm
firmware.ota
log.export
stream.flowControl
```

不推荐：

```text
network.wifiConfig
network.wifiConnection
video.framingMode
video.framingConfig
firmware.updateState
stream.fileTransfer
```

---

## 2. 统一命名模型

AXTP 业务能力采用三层模型：

```text
domain
  大业务域，例如 audio / video / camera / network / firmware。

domain.feature
  能力块 / 功能块 / capability ID，例如 audio.algorithm。

domain.method
  具体 RPC 方法，例如 audio.getAlgorithmConfig。
```

约束：

1. `domain` 必须来自已治理的业务域词表。
2. `feature` 使用 lowerCamelCase；不得包含协议层 payload 类型、transport 名称或临时项目名。
3. Capability ID 默认使用 `domain.feature`，例如 `network.wifi`。
4. Method name 使用 `domain.verbFeatureNoun`，例如 `network.setWifiConfig`。
5. Event name 使用 `domain.featureNounChanged` 或 `domain.featureNounReported`，例如 `network.wifiConfigChanged`。
6. 字段名、枚举值、codec、mode、state、config、policy 默认放入 schema，不提升为 feature。

---

## 3. 方法与事件模板

### 3.1 配置型 Feature

适用于可配置对象：

```text
domain.getFeatureCapabilities
domain.getFeatureConfig
domain.setFeatureConfig
domain.resetFeatureConfig
domain.featureConfigChanged
```

示例：

```text
audio.algorithm
  audio.getAlgorithmCapabilities
  audio.getAlgorithmConfig
  audio.setAlgorithmConfig
  audio.resetAlgorithmConfig
  audio.algorithmConfigChanged

audio.eq
  audio.getEqCapabilities
  audio.getEqConfig
  audio.setEqConfig
  audio.resetEqConfig
  audio.eqConfigChanged

network.wifi
  network.getWifiCapabilities
  network.getWifiConfig
  network.setWifiConfig
  network.resetWifiConfig
  network.wifiConfigChanged
```

`network.wifi` 可以包含配置能力，但 Capability ID 不应命名为 `network.wifiConfig`。

### 3.2 状态型 Feature

适用于状态查询和状态变化通知：

```text
domain.getFeatureState
domain.featureStateChanged
```

示例：

```text
network.getWifiState
network.wifiStateChanged

network.getApState
network.apStateChanged

firmware.getOtaState
firmware.otaStateChanged
```

### 3.3 动作型 Feature

适用于扫描、连接、触发、安装、格式化、重启等动作：

```text
domain.scanFeature
domain.connectFeature
domain.disconnectFeature
domain.startFeature
domain.stopFeature
domain.triggerFeature
domain.installFeature
domain.formatFeature
domain.deleteFeature
```

示例：

```text
network.scanWifi
network.connectWifi
network.disconnectWifi

camera.triggerAutoFocus

firmware.installOta

storage.formatSdCard

system.reboot
```

### 3.4 流型 Feature

业务域负责创建和关闭业务流：

```text
domain.openFeatureStream
domain.closeFeatureStream
domain.getFeatureStreamState
domain.featureStreamStateChanged
```

如果命名更自然，也可以保留短名：

```text
video.openStream
video.closeStream
video.getStreamState
video.streamStateChanged

log.openStream
log.closeStream
log.getStreamState
log.streamStateChanged
```

必须明确：

```text
不要定义常规 stream.open。
业务流由业务域创建。
```

`stream` 域可以保留公共流控或数据面方法，例如 `stream.updateWindow`、`stream.pause`、`stream.resume`，但这些方法不得表达文件、固件、媒体或日志等业务分类。

### 3.5 文件导出型 Feature

适用于日志导出、诊断报告导出等异步导出任务：

```text
domain.createFeatureExport
domain.getFeatureExportState
domain.cancelFeatureExport
domain.featureExportStateChanged
domain.featureExportProgressReported
```

示例：

```text
log.createExport
log.getExportState
log.cancelExport
log.exportStateChanged
log.exportProgressReported

diagnostic.createReportExport
diagnostic.getReportExportState
diagnostic.cancelReportExport
diagnostic.reportExportStateChanged
diagnostic.reportExportProgressReported
```

---

## 4. 禁止与反例

### 4.1 不要把字段当 Feature

不推荐：

```text
video.framingMode
video.framingConfig
network.apState
firmware.updateState
```

推荐：

```text
video.framing
network.ap
firmware.ota
```

字段和状态放到方法或参数中：

```text
video.getFramingMode
video.setFramingConfig
network.getApState
firmware.getOtaState
```

### 4.2 不要把 Codec 当 Feature

不推荐：

```text
video.mjpeg
audio.opus
```

推荐：

```text
video.stream
  video.openStream(codec=mjpeg)

video.encoder
  video.setEncoderConfig(codec=mjpeg)

audio.recording
  audio.openRecordingStream(codec=opus)
```

### 4.3 不要让 Stream 域承担业务分类

不推荐：

```text
stream.fileTransfer
stream.firmwareTransfer
stream.mediaTransfer
stream.logTransfer
stream.previewStream
```

推荐：

```text
file.transfer
firmware.ota
video.stream
audio.recording
log.stream
stream.flowControl
```

原因：

```text
stream 域只负责公共流控和数据面；
文件、固件、媒体、日志是业务域能力。
```

### 4.4 不要过度使用 xxxConfig 作为 Capability ID

不推荐：

```text
network.wifiConfig
video.framingConfig
network.apConfig
```

推荐：

```text
network.wifi
video.framing
network.ap
```

方法里再使用 `Config`：

```text
network.getWifiConfig
video.setFramingConfig
network.getApConfig
```

---

## 5. 推荐 Domain.Feature 清单

本清单用于新增业务协议、legacy 迁移和 capability registry 整理。未列出的 feature 必须先按本规范判断粒度，再进入 registry。

本节只列 capability feature。Method、event、schema 字段和历史分类说明必须放入对应 `docs/protocol/<domain>/<domain.feature>.md`、registry 草案或 archive 说明中。

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

### 5.4 Display

```text
display.brightness
display.color
display.backlight
display.power
display.input
display.output
```

### 5.5 Network

```text
network.interface
network.ip
network.wifi
network.ap
network.bluetooth
network.serviceEndpoint
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

### 5.8 Firmware

```text
firmware.info
firmware.ota
firmware.updatePolicy
```

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

### 5.10 System

```text
system.time
system.lifecycle
system.reset
system.initialization
system.license
```

算法模块 license、产测写入、工厂授权更建议归 `diagnostic.*` 或 `vendor.*`。

### 5.11 Input

```text
input.key
input.hid
input.source
input.kvm
input.gpio
```

### 5.12 Room / Collaboration

```text
room.info
room.schedule
room.source
room.layout
room.participant
```

### 5.13 Signage

```text
signage.media
signage.playlist
signage.schedule
signage.playback
signage.osd
```

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

日志文件下载仍然使用 `file.transfer` 下的方法，不在 `log.files` 中承载二进制数据面。

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

## 6. Registry 同步规则

### 6.1 Capability Registry

新增 capability 默认使用 `domain.feature` 粗粒度能力块。字段级能力事实必须优先进入 feature capability schema，例如 `BrightnessCapability.min/max/step`，而不是新增 `display.brightnessMin`、`display.brightnessMax`、`display.brightnessStep`。

迁移旧 capability ID 时必须输出迁移表：

```text
旧 capability ID
新 capability ID
迁移原因
是否兼容保留
涉及方法
涉及事件
```

兼容策略：

1. stable capability 不删除，标记 deprecated 或 alias，并保留至少一个 minor 版本。
2. draft capability 可以直接迁移，但必须更新生成文档、profile 和测试快照。
3. 一个旧 capability 拆到多个新 feature 时，必须在迁移表说明拆分条件。
4. method / event 的 `capabilities[]` 必须指向新 feature；旧 capability 只作为兼容 alias。

### 6.2 Method Registry

方法命名不一定要一次性全部改掉，但方法必须归属到新 feature。

示例：

```text
network.setWifiConfig
  capability: network.wifi

network.scanWifi
  capability: network.wifi

network.getWifiState
  capability: network.wifi

video.setFramingMode
  capability: video.framing

firmware.begin
  capability: firmware.ota
```

新增方法应优先使用本规范模板。已有 stable 方法如果名称不完全符合模板，可以保留 wire 兼容；新版本可增加更清晰的 alias 方法，并在 legacy / compatibility 文档中说明映射。

### 6.3 Event Registry

事件必须表达变化、进度、结果或上报，不表达命令动作。

推荐事件名：

```text
domain.featureConfigChanged
domain.featureStateChanged
domain.featureProgressReported
domain.featureResultReported
domain.featureExportStateChanged
domain.featureExportProgressReported
```

示例：

```text
network.wifiConfigChanged
network.wifiStateChanged
firmware.otaStateChanged
firmware.otaProgressReported
log.exportProgressReported
```

已 stable 的旧事件名可以保留；新增 OTA、导出、流状态事件优先使用推荐模板。

### 6.4 ErrorCode、MVP Profile 与 Legacy Mapping

ErrorCode 不按 feature 复制。通用错误仍保留公共错误码，业务特有错误必须先判断是否能作为 schema 状态字段表达。

MVP 能力表必须使用新 feature 能力块；字段级限制进入 schema 或 `getFeatureCapabilities` 响应。

legacy 迁移映射必须先归类到新 `domain.feature`，再映射到 method/event：

```text
legacy command -> domain.feature -> method/event -> schema adapter
```

---

## 7. 当前仓库影响清单

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

## 8. Review Checklist

新增或迁移业务协议时，必须检查：

1. Capability ID 是否为 `domain.feature` 能力块，而不是字段、状态、配置或 codec。
2. Feature 粒度是否足够稳定，未来新增 config/state/action 时无需改名。
3. Method 是否使用配置、状态、动作、流或导出模板。
4. Event 是否表达变化、进度、结果或上报。
5. `stream` 域是否只处理公共流控和数据面。
6. 业务流是否由业务域创建，并绑定 `streamId`。
7. 字段级限制是否进入 schema 或 `getFeatureCapabilities` 响应。
8. legacy 命令是否先归类到新 `domain.feature`，再映射到 method/event。
9. MVP profile、capability registry、method registry、event registry 是否引用同一新 feature。
10. 旧 ID 是否有明确 alias / deprecation / compatibility 策略。
