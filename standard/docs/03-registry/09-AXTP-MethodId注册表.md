# 09《AXTP MethodId 注册表》

版本：v1.0  
状态：MVP Draft  
所属目录：`03-registry/01-AXTP-MethodId注册表.md`  
依赖文档：

- `00-AXTP-协议总览与落地路线.md`
- `01-AXTP-整体协议规范.md`
- `02-AXTP-Control信令协议规范.md`
- `03-AXTP-RPC协议与二进制映射规范.md`
- `05-AXTP-Type-System基础类型规范.md`
- `06-AXTP-TLV-Schema编码规范.md`
- `07-AXTP-Schema字段编号规范.md`
- `08-AXTP-Registry总则.md`

---

## 1. 文档目的

本文档定义 AXTP RPC 业务方法的统一 `methodId` 注册表。

`methodId` 是 AXTP RPC 在二进制链路中的核心方法标识，用于映射 DS-RPC Text Profile 中的字符串 `method`，并作为老协议 `CmdValue` 迁移到 AXTP 的统一承载点。

本文档目标：

```text
1. 固定 methodId 的 domain 分段规则。
2. 给出当前业务需要的完整方法规划。
3. 给出 MVP 最小优先实现方法集合。
4. 给出老协议 CmdValue 到 methodId 的适配规则。
5. 为 Generator v1 和 C++ Demo v1 提供稳定输入。
```

---

## 2. MethodId 的位置

AXTP Header 只识别三类 PayloadType：

```text
CONTROL
RPC
STREAM
```

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

## 3. MethodId 基本规则

### 3.1 编码类型

`methodId` 使用：

```text
uint16
```

线上编码遵循 `05-AXTP-Type-System基础类型规范.md` 中规定的字节序。

### 3.2 唯一性

同一 AXTP Registry 中：

```text
methodId 不得重复
methodName 不得重复
```

### 3.3 稳定性

进入 `stable` 状态后的 `methodId` 不得改变语义。

如果方法语义发生不兼容变化，应新增方法，例如：

```text
firmware.beginV2
```

不得修改：

```text
firmware.begin
```

的既有语义。

### 3.4 命名规范

方法名采用：

```text
domain.verbObject
```

推荐动词：

```text
get
set
list
open
close
start
stop
begin
end
verify
apply
abort
resume
subscribe
unsubscribe
```

示例：

```text
device.getInfo
brightness.set
firmware.begin
stream.open
event.subscribe
```

---

## 4. MethodId Domain 分段

| 范围 | Domain | 说明 | MVP |
|---:|---|---|---:|
| `0x0000-0x00FF` | reserved | 保留 | 否 |
| `0x0100-0x01FF` | `device.*` | 设备基础信息与生命周期 | 是 |
| `0x0200-0x02FF` | `session.*` | 业务会话管理，暂缓 | 否 |
| `0x0300-0x03FF` | `capability.*` | 能力查询与能力协商 | 是 |
| `0x0400-0x04FF` | `system.*` | 系统设置，暂缓 | 否 |
| `0x0500-0x05FF` | `display.*` | 显示、画面、输入源 | 可选 |
| `0x0600-0x06FF` | `brightness.*` | 亮度控制 | 是 |
| `0x0700-0x07FF` | `video.*` | 视频控制面 | 可选 |
| `0x0800-0x08FF` | `audio.*` | 音频控制面 | 可选 |
| `0x0900-0x09FF` | `stream.*` | STREAM 控制面 | 是 |
| `0x0A00-0x0AFF` | `file.*` | 文件传输控制面 | P1 |
| `0x0B00-0x0BFF` | `firmware.*` | OTA / 固件升级控制面 | 是 |
| `0x0C00-0x0CFF` | `log.*` | 日志控制面 | P1 |
| `0x0D00-0x0DFF` | `diagnostic.*` | 诊断、产测、链路测试 | P1 |
| `0x0E00-0x0EFF` | `network.*` | 网络配置 | P2 |
| `0x0F00-0x0FFF` | `storage.*` | 存储管理 | P2 |
| `0x1000-0x10FF` | `input.*` | 输入、KVM、HID Raw 控制 | P1 |
| `0x1100-0x11FF` | `sensor.*` | 传感器控制 | P2 |
| `0x7000-0x7FFF` | `vendor.*` | 厂商私有方法 | 按需 |
| `0x8000-0xFFFF` | reserved | 不用于 MethodId，优先保留给 EventId | 否 |

---

## 5. Method 条目字段

Method Registry 的单个条目建议采用以下结构：

```yaml
id: 0x0602
name: brightness.set
kind: method
status: mvp
domain: brightness
description: Set current brightness value.
rpc:
  request: true
  response: true
  event: false
  supportedEncodings:
    - JSON
    - BINARY
  supportedBodyEncodings:
    - TLV
schema:
  params: BrightnessSetParams
  result: BrightnessSetResult
errors:
  - SUCCESS
  - INVALID_PARAM
  - UNSUPPORTED_METHOD
  - DEVICE_BUSY
events:
  - brightness.changed
capability:
  required:
    - brightness.set
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

字段说明：

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

## 6. MVP 最小方法集合

MVP 不追求覆盖全部业务，而是要跑通一条端到端链路：

```text
CONTROL OPEN / ACCEPT
  ↓
RPC capability.getAll
  ↓
RPC device.getInfo
  ↓
RPC brightness.set / brightness.get
  ↓
RPC firmware.begin
  ↓
STREAM OTA chunk
  ↓
RPC firmware.verify / firmware.apply
  ↓
RPC EVENT 上报进度与结果
```

因此 MethodId MVP 包含以下 domain：

```text
device.*
capability.*
brightness.*
stream.*
firmware.*
event.*
```

MVP 方法表：

| methodId | methodName | Domain | 优先级 | 说明 |
|---:|---|---|---|---|
| `0x0101` | `device.getInfo` | device | P0 | 获取设备基础信息 |
| `0x0102` | `device.getVersion` | device | P0 | 获取固件、硬件、协议版本 |
| `0x0103` | `device.getStatus` | device | P0 | 获取设备运行状态 |
| `0x0301` | `capability.getAll` | capability | P0 | 获取完整能力集 |
| `0x0302` | `capability.getDomain` | capability | P0 | 获取指定域能力 |
| `0x0303` | `capability.hasMethod` | capability | P1 | 查询是否支持某方法 |
| `0x0304` | `capability.getLimits` | capability | P0 | 获取 MTU、Frame、窗口等限制 |
| `0x0601` | `brightness.get` | brightness | P0 | 获取当前亮度 |
| `0x0602` | `brightness.set` | brightness | P0 | 设置亮度 |
| `0x0603` | `brightness.getRange` | brightness | P0 | 获取亮度范围 |
| `0x0901` | `stream.open` | stream | P0 | 打开 STREAM 数据通道 |
| `0x0902` | `stream.close` | stream | P0 | 关闭 STREAM 数据通道 |
| `0x0903` | `stream.getStatus` | stream | P1 | 查询流状态 |
| `0x0904` | `stream.getStats` | stream | P1 | 查询流统计 |
| `0x0B01` | `firmware.getInfo` | firmware | P0 | 获取当前固件信息 |
| `0x0B02` | `firmware.begin` | firmware | P0 | 开始升级，返回 transferId/streamId |
| `0x0B03` | `firmware.end` | firmware | P0 | 结束固件数据传输 |
| `0x0B04` | `firmware.verify` | firmware | P0 | 校验固件镜像 |
| `0x0B05` | `firmware.apply` | firmware | P0 | 应用固件 |
| `0x0B06` | `firmware.abort` | firmware | P0 | 中止升级 |
| `0x0B07` | `firmware.resume` | firmware | P1 | 断点续传 |
| `0x1201` | `event.subscribe` | event | P0 | 订阅事件 |
| `0x1202` | `event.unsubscribe` | event | P0 | 取消事件订阅 |
| `0x1203` | `event.list` | event | P1 | 查询可订阅事件 |

说明：

```text
0x1200-0x12FF 暂作为 event subscription method domain 使用。
事件本身仍使用 EventId，且通过 rpcOp = EVENT 承载。
```

---

## 7. 完整 MethodId 规划表

### 7.1 device.*

| methodId | methodName | 状态 | MVP | 说明 |
|---:|---|---|---:|---|
| `0x0101` | `device.getInfo` | mvp | 是 | 获取设备基础信息 |
| `0x0102` | `device.getVersion` | mvp | 是 | 获取版本信息 |
| `0x0103` | `device.getStatus` | mvp | 是 | 获取设备状态 |
| `0x0104` | `device.getSerialNumber` | draft | 否 | 获取序列号 |
| `0x0105` | `device.getModel` | draft | 否 | 获取设备型号 |
| `0x0106` | `device.setName` | draft | 否 | 设置设备名称 |
| `0x0107` | `device.getName` | draft | 否 | 获取设备名称 |
| `0x0108` | `device.reboot` | draft | 否 | 重启设备 |
| `0x0109` | `device.factoryReset` | draft | 否 | 恢复出厂设置 |
| `0x010A` | `device.identify` | draft | 否 | 设备识别，例如闪灯、蜂鸣 |

### 7.2 capability.*

| methodId | methodName | 状态 | MVP | 说明 |
|---:|---|---|---:|---|
| `0x0301` | `capability.getAll` | mvp | 是 | 获取完整能力集 |
| `0x0302` | `capability.getDomain` | mvp | 是 | 获取指定 domain 能力 |
| `0x0303` | `capability.hasMethod` | mvp | 是 | 查询是否支持某方法 |
| `0x0304` | `capability.getLimits` | mvp | 是 | 获取传输与资源限制 |
| `0x0305` | `capability.getPayloadTypes` | draft | 否 | 获取支持的 PayloadType |
| `0x0306` | `capability.getRpcEncodings` | draft | 否 | 获取 RPC 编码能力 |
| `0x0307` | `capability.getStreamProfiles` | draft | 否 | 获取 Stream 类型能力 |
| `0x0308` | `capability.getCodecs` | draft | 否 | 获取音视频编解码能力 |
| `0x0309` | `capability.negotiate` | draft | 否 | 业务能力协商 |

说明：

```text
协议能力优先通过 CONTROL OPEN / ACCEPT 协商。
业务能力通过 capability.* RPC 查询。
```

### 7.3 display.*

| methodId | methodName | 状态 | MVP | 说明 |
|---:|---|---|---:|---|
| `0x0501` | `display.getInfo` | draft | 否 | 获取显示设备信息 |
| `0x0502` | `display.getStatus` | draft | 否 | 获取显示状态 |
| `0x0503` | `display.setPower` | draft | 否 | 设置屏幕电源 |
| `0x0504` | `display.getPower` | draft | 否 | 获取屏幕电源状态 |
| `0x0505` | `display.setInputSource` | draft | 否 | 设置输入源 |
| `0x0506` | `display.getInputSource` | draft | 否 | 获取输入源 |
| `0x0507` | `display.setResolution` | draft | 否 | 设置输出分辨率 |
| `0x0508` | `display.getResolution` | draft | 否 | 获取输出分辨率 |
| `0x0509` | `display.setRotation` | draft | 否 | 设置旋转方向 |
| `0x050A` | `display.getRotation` | draft | 否 | 获取旋转方向 |
| `0x050B` | `display.setLayout` | draft | 否 | 设置多画面布局 |
| `0x050C` | `display.getLayout` | draft | 否 | 获取多画面布局 |

### 7.4 brightness.*

| methodId | methodName | 状态 | MVP | 说明 |
|---:|---|---|---:|---|
| `0x0601` | `brightness.get` | mvp | 是 | 获取当前亮度 |
| `0x0602` | `brightness.set` | mvp | 是 | 设置当前亮度 |
| `0x0603` | `brightness.getRange` | mvp | 是 | 获取亮度范围 |
| `0x0604` | `brightness.setAutoMode` | draft | 否 | 设置自动亮度 |
| `0x0605` | `brightness.getAutoMode` | draft | 否 | 获取自动亮度状态 |
| `0x0606` | `brightness.increase` | draft | 否 | 增加亮度 |
| `0x0607` | `brightness.decrease` | draft | 否 | 降低亮度 |
| `0x0608` | `brightness.setSchedule` | draft | 否 | 设置亮度计划 |
| `0x0609` | `brightness.getSchedule` | draft | 否 | 获取亮度计划 |

### 7.5 video.*

`video.*` 只定义视频控制面。视频帧数据必须走：

```text
RPC video.startPreview response:
  streamId
  profile = media.video

STREAM packet:
  streamId / seqId / cursor / data
```

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

### 7.6 audio.*

`audio.*` 只定义音频控制面。音频帧数据必须走：

```text
RPC audio.startStream response:
  streamId
  profile = media.audio

STREAM packet:
  streamId / seqId / cursor / data
```

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

### 7.7 stream.*

`stream.*` 是 STREAM 数据面的控制面。

| methodId | methodName | 状态 | MVP | 说明 |
|---:|---|---|---:|---|
| `0x0901` | `stream.open` | mvp | 是 | 打开数据流 |
| `0x0902` | `stream.close` | mvp | 是 | 关闭数据流 |
| `0x0903` | `stream.getStatus` | mvp | 是 | 获取流状态 |
| `0x0904` | `stream.getStats` | mvp | 是 | 获取流统计 |
| `0x0905` | `stream.pause` | draft | 否 | 暂停流 |
| `0x0906` | `stream.resume` | draft | 否 | 恢复流 |
| `0x0907` | `stream.setParams` | draft | 否 | 设置流参数 |
| `0x0908` | `stream.getParams` | draft | 否 | 获取流参数 |
| `0x0909` | `stream.setQos` | draft | 否 | 设置 QoS |
| `0x090A` | `stream.requestKeyFrame` | draft | 否 | 请求关键帧 |
| `0x090B` | `stream.subscribe` | draft | 否 | 订阅流 |
| `0x090C` | `stream.unsubscribe` | draft | 否 | 取消订阅流 |

### 7.8 file.*

文件数据块必须走：

```text
RPC file.beginTransfer / stream.open:
  profile = file.upload / file.download
  -> streamId

STREAM packet:
  streamId / seqId / cursor / data
```

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

### 7.9 firmware.*

固件升级采用：

```text
RPC 控制面 + STREAM OTA 数据面
```

即：

```text
firmware.begin     -> RPC
OTA chunk          -> STREAM
firmware.end       -> RPC
firmware.verify    -> RPC
firmware.apply     -> RPC
```

| methodId | methodName | 状态 | MVP | 说明 |
|---:|---|---|---:|---|
| `0x0B01` | `firmware.getInfo` | mvp | 是 | 获取固件信息 |
| `0x0B02` | `firmware.begin` | mvp | 是 | 开始升级 |
| `0x0B03` | `firmware.end` | mvp | 是 | 结束数据传输 |
| `0x0B04` | `firmware.verify` | mvp | 是 | 校验固件 |
| `0x0B05` | `firmware.apply` | mvp | 是 | 应用固件 |
| `0x0B06` | `firmware.abort` | mvp | 是 | 中止升级 |
| `0x0B07` | `firmware.resume` | mvp | 是 | 断点续传 |
| `0x0B08` | `firmware.getProgress` | draft | 否 | 获取升级进度 |
| `0x0B09` | `firmware.rollback` | draft | 否 | 固件回滚 |
| `0x0B0A` | `firmware.getSlots` | draft | 否 | 获取 A/B 分区信息 |

### 7.10 log.*

实时日志可走：

```text
RPC log.startStream / stream.open:
  profile = log.realtime
  -> streamId

STREAM packet:
  streamId / seqId / cursor / data
```

日志控制仍走 RPC。

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

### 7.11 diagnostic.*

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

### 7.12 input.*

高频输入数据可走：

```text
RPC input.openKvm / stream.open:
  profile = control.hid_raw
  controlDataType = KEYBOARD / MOUSE / TOUCH / HID_RAW
  -> streamId

STREAM packet:
  streamId / seqId / cursor / data
```

低频输入控制走 RPC。

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

### 7.13 event.*

事件本身不是 method，而是通过 `rpcOp = EVENT` 使用 EventId 承载。  
但事件订阅、取消订阅和事件列表查询属于 RPC method。

| methodId | methodName | 状态 | MVP | 说明 |
|---:|---|---|---:|---|
| `0x1201` | `event.subscribe` | mvp | 是 | 订阅事件 |
| `0x1202` | `event.unsubscribe` | mvp | 是 | 取消事件订阅 |
| `0x1203` | `event.list` | draft | 否 | 查询可订阅事件列表 |
| `0x1204` | `event.getLast` | draft | 否 | 获取最近一次事件快照 |

---

## 8. 老协议适配 MethodId 表

### 8.1 适配原则

老协议适配不要求保持原始 `CmdValue` 数值，但必须保留原有业务语义。

映射规则：

```text
老协议 CmdValue
  ↓
legacy_cmd_mapping.yaml
  ↓
AXTP methodId
  ↓
AXTP schema params/result
```

如果老协议 `CmdValue` 超过 `uint16`，不应直接作为 `methodId` 使用，应映射为 AXTP 新 methodId，并在 `legacy.cmdValue` 中记录原值。

### 8.2 MVP Legacy Mapping

| 老协议来源 | legacy CmdValue | 旧命令语义 | AXTP methodId | AXTP methodName | MVP | 说明 |
|---|---:|---|---:|---|---:|---|
| AXDP_HID | `0xB0002` | BetaDeviceInfo | `0x0101` | `device.getInfo` | 是 | 设备信息查询 |
| AXDP_HID | `0xC0021` | CommonSetVideoMode | `0x0706` | `video.setMode` | 可选 | 视频模式设置，P1 适配 |
| AXDP_HID | `0xA0001` | AlphaUpgradeInfo | `0x0B01` | `firmware.getInfo` | 是 | 固件升级信息查询 |
| Legacy HID/BLE | TBD | GetBrightness | `0x0601` | `brightness.get` | 是 | 若旧协议存在亮度查询命令，应映射到此方法 |
| Legacy HID/BLE | TBD | SetBrightness | `0x0602` | `brightness.set` | 是 | 若旧协议存在亮度设置命令，应映射到此方法 |
| Legacy HID/BLE | TBD | UpgradeBegin | `0x0B02` | `firmware.begin` | 是 | 若旧协议存在升级开始命令，应映射到此方法 |
| Legacy HID/BLE | TBD | UpgradeEnd | `0x0B03` | `firmware.end` | 是 | 若旧协议存在升级结束命令，应映射到此方法 |
| Legacy HID/BLE | TBD | UpgradeVerify | `0x0B04` | `firmware.verify` | 是 | 若旧协议存在升级校验命令，应映射到此方法 |

说明：

```text
TBD 表示需要从老协议表中补充具体 CmdValue。
本文档先固定 AXTP 侧 methodId，老协议数值后续在 legacy_cmd_mapping.yaml 中补齐。
```

### 8.3 Legacy Mapping YAML 示例

```yaml
legacyMappings:
  - source: AXDP_HID
    legacyCmdValue: 0xB0002
    legacyName: BetaDeviceInfo
    axtpMethodId: 0x0101
    axtpMethodName: device.getInfo
    direction: request_response
    payload:
      legacyEncoding: fixed_struct
      axtpRpcEncoding: BINARY
      axtpBodyEncoding: TLV
      paramsSchema: DeviceGetInfoParams
      resultSchema: DeviceInfoResult
    statusMapping:
      legacySuccess: 0x00
      axtpSuccess: SUCCESS
    mvp: true

  - source: AXDP_HID
    legacyCmdValue: 0xA0001
    legacyName: AlphaUpgradeInfo
    axtpMethodId: 0x0B01
    axtpMethodName: firmware.getInfo
    direction: request_response
    payload:
      legacyEncoding: fixed_struct
      axtpRpcEncoding: BINARY
      axtpBodyEncoding: TLV
      paramsSchema: FirmwareGetInfoParams
      resultSchema: FirmwareInfoResult
    statusMapping:
      legacySuccess: 0x00
      axtpSuccess: SUCCESS
    mvp: true
```

---

## 9. Method 与 Schema 的关系

每个 Method 必须引用：

```text
Params Schema
Result Schema
```

即使某方法没有参数，也必须显式声明：

```text
EmptyParams
```

即使某方法没有返回数据，也必须显式声明：

```text
EmptyResult
```

示例：

```yaml
methods:
  - id: 0x0101
    name: device.getInfo
    schema:
      params: EmptyParams
      result: DeviceInfoResult
```

这样 Generator 可以稳定生成：

```cpp
struct DeviceGetInfoParams {};
struct DeviceInfoResult {};
```

---

## 10. Method 与 ErrorCode 的关系

每个 Method 必须声明可能返回的错误码。

MVP 方法至少包含：

```text
SUCCESS
INVALID_PARAM
UNSUPPORTED_METHOD
DEVICE_BUSY
INTERNAL_ERROR
```

固件升级类方法还应包含：

```text
FIRMWARE_INVALID_IMAGE
FIRMWARE_VERIFY_FAILED
FIRMWARE_VERSION_REJECTED
FIRMWARE_STORAGE_FULL
FIRMWARE_ROLLBACK_REQUIRED
```

Stream 类方法还应包含：

```text
STREAM_NOT_FOUND
STREAM_BUSY
STREAM_UNSUPPORTED_KIND
STREAM_WINDOW_EXHAUSTED
STREAM_TIMEOUT
```

---

## 11. Method 与 Capability 的关系

Method 是否可调用，不应只由 Method Registry 判断，还应结合 Capability Registry。

例如：

```yaml
methods:
  - id: 0x0602
    name: brightness.set
    capability:
      required:
        - brightness.set
        - brightness.range
```

调用流程建议：

```text
1. 通过 capability.getAll 获取能力集。
2. 检查目标 method 是否在 supportedMethods 中。
3. 检查相关 capability 是否满足。
4. 发送 RPC Request。
5. 若设备不支持，应返回 UNSUPPORTED_METHOD 或 CAPABILITY_NOT_SUPPORTED。
```

---

## 12. Method 与 Event 的关系

如果 Method 会触发事件，应在条目中声明。

示例：

```yaml
methods:
  - id: 0x0602
    name: brightness.set
    events:
      - brightness.changed
```

对应行为：

```text
brightness.set 成功
  ↓
RPC Response SUCCESS
  ↓
如果事件已订阅，设备发送 brightness.changed EVENT
```

事件本身不使用 MethodId，而使用 EventId。

---

## 13. Generator v1 输出要求

Generator v1 读取 Method Registry 后，至少生成：

```text
1. C++ MethodId enum
2. methodId → methodName 映射表
3. methodName → methodId 查询表
4. MethodDescriptor 表
5. MVP Method 列表
6. Legacy CmdValue → methodId 映射表
7. Markdown Method 表格
```

### 13.1 C++ enum 示例

```cpp
enum class MethodId : uint16_t {
    DeviceGetInfo      = 0x0101,
    DeviceGetVersion   = 0x0102,
    DeviceGetStatus    = 0x0103,

    CapabilityGetAll   = 0x0301,
    CapabilityGetDomain= 0x0302,
    CapabilityHasMethod= 0x0303,
    CapabilityGetLimits= 0x0304,

    BrightnessGet      = 0x0601,
    BrightnessSet      = 0x0602,
    BrightnessGetRange = 0x0603,

    StreamOpen         = 0x0901,
    StreamClose        = 0x0902,
    StreamGetStatus    = 0x0903,
    StreamGetStats     = 0x0904,

    FirmwareGetInfo    = 0x0B01,
    FirmwareBegin      = 0x0B02,
    FirmwareEnd        = 0x0B03,
    FirmwareVerify     = 0x0B04,
    FirmwareApply      = 0x0B05,
    FirmwareAbort      = 0x0B06,
    FirmwareResume     = 0x0B07,

    EventSubscribe     = 0x1201,
    EventUnsubscribe   = 0x1202,
    EventList          = 0x1203,
};
```

### 13.2 MethodDescriptor 示例

```cpp
struct MethodDescriptor {
    uint16_t id;
    const char* name;
    const char* domain;
    const char* paramsSchema;
    const char* resultSchema;
    bool mvp;
};
```

---

## 14. Generator v1 校验规则

Generator 必须执行以下校验：

```text
methodId 不重复
methodName 不重复
methodId 范围与 domain 匹配
status 合法
mvp 条目必须 priority = P0 或 P1
params schema 必须存在
result schema 必须存在
errorCode 必须存在
event 引用必须存在
capability 引用必须存在
legacy mapping 的 axtpMethodId 必须存在
```

校验失败时，应停止生成。

---

## 15. C++ Demo v1 必须实现的方法

C++ Demo v1 只需要实现 P0 方法：

```text
device.getInfo
设备返回 DeviceInfoResult

capability.getAll
设备返回 CapabilitySet

brightness.get
设备返回当前亮度

brightness.set
设备设置亮度并返回 SUCCESS

firmware.getInfo
设备返回固件版本/分区/升级能力

firmware.begin
设备返回 transferId/streamId/chunkSize/windowSize

firmware.end
设备确认数据接收完成

firmware.verify
设备执行 hash/CRC 校验

firmware.apply
设备应用固件或返回 rebootRequired

stream.open
设备打开 STREAM 通道

stream.close
设备关闭 STREAM 通道

event.subscribe
主机订阅事件

event.unsubscribe
主机取消事件订阅
```

非 P0 方法可以只生成 enum，不实现 handler。

---

## 16. Method Handler 行为规范

设备端 RPC dispatcher 推荐流程：

```text
1. 解析 AXTP Frame。
2. 确认 payloadType = RPC。
3. 解析 RPC Payload。
4. 根据 methodId 查询 MethodDescriptor。
5. 若不存在，返回 UNSUPPORTED_METHOD。
6. 根据 descriptor 找到 params schema。
7. 解码 params。
8. 校验 required 字段和 range。
9. 调用 method handler。
10. 编码 result。
11. 返回 RPC Response。
```

对于未实现但已注册的方法：

```text
返回 METHOD_NOT_IMPLEMENTED
```

对于未注册的方法：

```text
返回 UNSUPPORTED_METHOD
```

---

## 17. MethodId 状态治理

### 17.1 draft

`draft` 可出现在文档和 YAML 中，但默认不要求 C++ Demo 实现。

### 17.2 mvp

`mvp` 必须生成代码，并应由 C++ Demo v1 实现。

### 17.3 stable

`stable` 可用于生产，不能修改语义。

### 17.4 deprecated

`deprecated` 仍生成 enum 和兼容映射，但不推荐新业务使用。

### 17.5 reserved

`reserved` 仅占位，不生成 handler。

---

## 18. method_registry_mvp.yaml 建议内容

```yaml
methods:
  - id: 0x0101
    name: device.getInfo
    kind: method
    status: mvp
    domain: device
    description: Get device basic information.
    schema:
      params: EmptyParams
      result: DeviceInfoResult
    errors:
      - SUCCESS
      - DEVICE_BUSY
      - INTERNAL_ERROR
    mvp: true
    priority: P0

  - id: 0x0301
    name: capability.getAll
    kind: method
    status: mvp
    domain: capability
    description: Get all supported capabilities.
    schema:
      params: EmptyParams
      result: CapabilitySetResult
    errors:
      - SUCCESS
      - DEVICE_BUSY
      - INTERNAL_ERROR
    mvp: true
    priority: P0

  - id: 0x0602
    name: brightness.set
    kind: method
    status: mvp
    domain: brightness
    description: Set brightness value.
    schema:
      params: BrightnessSetParams
      result: BrightnessSetResult
    errors:
      - SUCCESS
      - INVALID_PARAM
      - DEVICE_BUSY
      - CAPABILITY_NOT_SUPPORTED
    events:
      - brightness.changed
    mvp: true
    priority: P0

  - id: 0x0B02
    name: firmware.begin
    kind: method
    status: mvp
    domain: firmware
    description: Begin firmware update session.
    schema:
      params: FirmwareBeginParams
      result: FirmwareBeginResult
    errors:
      - SUCCESS
      - INVALID_PARAM
      - DEVICE_BUSY
      - FIRMWARE_VERSION_REJECTED
      - FIRMWARE_STORAGE_FULL
    events:
      - firmware.updateStarted
    mvp: true
    priority: P0
```

---

## 19. 测试向量建议

MethodId 注册表应配套生成以下测试向量：

```text
1. device.getInfo Request / Response
2. capability.getAll Request / Response
3. brightness.set Request / Response / brightness.changed Event
4. firmware.begin Request / Response
5. firmware.verify Request / Response / firmware.updateCompleted Event
6. unknown methodId Request / UNSUPPORTED_METHOD Response
7. registered but unimplemented method / METHOD_NOT_IMPLEMENTED Response
8. legacy CmdValue -> methodId mapping test
```

测试目标：

```text
确认 methodId 编码正确
确认 methodName 映射正确
确认 schema 引用正确
确认错误码路径正确
确认 legacy mapping 可用
```

---

## 20. 本文档结论

AXTP MethodId Registry 的核心目标不是一次性列出所有业务命令，而是建立一套可持续演进、可生成代码、可兼容老协议的方法治理体系。

第一阶段必须优先固定：

```text
device.*
capability.*
brightness.*
stream.*
firmware.*
event.subscribe / event.unsubscribe
```

并将老协议 `CmdValue` 逐步映射到 AXTP `methodId`。

最终落地路径：

```text
method_registry_mvp.yaml
  ↓
Generator v1
  ↓
C++ MethodId enum
RPC Dispatcher
Method Handler Skeleton
Markdown 注册表
测试向量
```

只要 MethodId、Schema、ErrorCode、Capability 四套 Registry 保持一致，AXTP RPC 就可以稳定落地到 HID、BLE、UART、TCP、WebSocket 等传输形态。
