# 12《AXTP Capability 注册表》

版本：v1.0  
状态：MVP Draft  
所属体系：AXTP Registry  
依赖文档：

- 00《AXTP 协议总览与落地路线》
- 01《AXTP 整体协议规范》
- 02《AXTP Control 信令协议规范》
- 03《AXTP RPC 协议与二进制映射规范》
- 04《AXTP Stream 流式传输协议规范》
- 05《AXTP Type System 基础类型规范》
- 06《AXTP TLV Schema 编码规范》
- 07《AXTP Schema 字段编号规范》
- 08《AXTP Registry 总则》
- 09《AXTP MethodId 注册表》
- 10《AXTP EventId 注册表》
- 11《AXTP ErrorCode 注册表》

---

## 1. 文档目的

本文档定义 AXTP 协议体系中的 Capability Registry。

Capability Registry 用于描述：

```text
设备支持什么协议能力
设备支持什么业务能力
设备支持哪些方法、事件、流类型、编码、限制和扩展
```

它是 AXTP 协议能否真正落地的关键注册表之一。

原因是：

```text
协议框架解决“怎么传”
Method Registry 解决“有哪些命令”
Capability Registry 解决“当前设备实际支持哪些命令和能力”
```

不同设备、不同固件版本、不同传输方式，不可能支持完全相同的能力。

因此 AXTP 必须通过 Capability Registry 建立统一的能力表达方式。

---

## 2. Capability 的定位

Capability 不是业务命令本身。

Capability 是对设备能力、协议能力、传输能力和业务功能的声明。

例如：

```text
支持 CONTROL / RPC / STREAM
支持 Binary RPC
支持 TLV Body
支持 OTA Stream
支持 brightness.set
支持 firmware.begin
支持 firmware.updateProgress 事件
最大 Frame Size = 512
BLE MTU = 247
支持 Sliding Window = 8
支持 brightness 范围 0-100
```

这些都属于 Capability。

---

## 3. Capability 与 CONTROL OPEN 的关系

AXTP 中有两类能力发现机制：

```text
CONTROL OPEN / ACCEPT
RPC capability.*
```

二者职责不同。

### 3.1 CONTROL OPEN 负责协议级能力协商

CONTROL OPEN 只协商协议运行时必须知道的能力。

例如：

```text
protocolVersion
headerProfile
maxFrameSize
mtu
supportedPayloadTypes
supportedRpcEncodings
heartbeatIntervalMs
ackMode
windowSize
compression
encryption
```

这些能力会影响 Frame Parser、Control Parser、RPC Parser 和 Stream Parser 的工作方式。

因此必须在连接早期完成协商。

### 3.2 capability.* RPC 负责业务能力查询

业务能力不应该放进 CONTROL OPEN。

例如：

```text
brightness 支持范围
是否支持 OTA
支持哪些 firmware imageType
是否支持 video stream
支持哪些 methodId
支持哪些 eventId
支持哪些 codec
支持哪些文件类型
```

这些能力属于业务层，应通过 RPC 查询。

推荐方法：

```text
capability.getAll
capability.getDomain
capability.hasMethod
capability.getLimits
capability.getStreams
capability.getFirmware
```

---

## 4. Capability 分类

AXTP Capability 分为六大类。

```text
Capability
├── protocol capability
├── transport capability
├── rpc capability
├── stream capability
├── business capability
└── vendor capability
```

| 类别 | 说明 | 发现方式 |
|---|---|---|
| protocol capability | 协议版本、PayloadType、Header Profile | CONTROL OPEN + RPC |
| transport capability | MTU、最大包长、窗口、ACK 模式 | CONTROL OPEN + RPC |
| rpc capability | RPC 编码、bodyEncoding、methodId 支持 | CONTROL OPEN + RPC |
| stream capability | Stream Profile ID、窗口、断点续传、CRC | RPC |
| business capability | brightness、firmware、file、video 等业务能力 | RPC |
| vendor capability | 厂商私有能力 | RPC |

---

## 5. CapabilityId 编号规划

CapabilityId 使用 `uint16`。

```text
0x0000-0x00FF  通用能力
0x0100-0x01FF  协议能力
0x0200-0x02FF  传输能力
0x0300-0x03FF  RPC 能力
0x0400-0x04FF  STREAM 能力
0x0500-0x05FF  设备基础能力
0x0600-0x06FF  显示 / 亮度能力
0x0700-0x07FF  视频能力
0x0800-0x08FF  音频能力
0x0900-0x09FF  文件能力
0x0A00-0x0AFF  固件 / OTA 能力
0x0B00-0x0BFF  日志能力
0x0C00-0x0CFF  诊断能力
0x0D00-0x0DFF  输入 / KVM 能力
0x0E00-0x0EFF  网络能力
0x0F00-0x0FFF  存储能力
0x7000-0x7FFF  厂商私有能力
0x8000-0xFFFF  保留
```

---

## 6. Capability 条目结构

Capability Registry 的标准条目格式如下：

```yaml
- id: 0x0101
  name: protocol.payloadTypes
  domain: protocol
  status: mvp
  type: bitmap
  description: Supported AXTP payload types.
  values:
    CONTROL: 0x01
    RPC: 0x02
    STREAM: 0x04
  discovery:
    controlHello: true
    rpc: true
  relatedMethods:
    - capability.getAll
    - capability.getDomain
  since: 1.0.0
```

字段说明：

| 字段 | 说明 |
|---|---|
| id | capabilityId |
| name | capability 名称 |
| domain | 所属域 |
| status | draft / mvp / stable / deprecated / reserved |
| type | bool / uint / enum / bitmap / object / array |
| description | 描述 |
| values | 枚举或 bitmap 值 |
| range | 数值范围 |
| discovery | 是否可通过 OPEN 或 RPC 查询 |
| relatedMethods | 相关 RPC 方法 |
| relatedEvents | 相关事件 |
| relatedStreams | 相关 Stream 类型 |
| legacyMapping | 老协议适配关系 |
| since | 引入版本 |
| deprecatedSince | 废弃版本 |

---

## 7. 通用能力注册表

| capabilityId | name | 类型 | 状态 | 说明 |
|---:|---|---|---|---|
| `0x0001` | `common.deviceClass` | enum | mvp | 设备类别 |
| `0x0002` | `common.vendorId` | uint16 | mvp | 厂商 ID |
| `0x0003` | `common.productId` | uint16 | mvp | 产品 ID |
| `0x0004` | `common.model` | string | mvp | 型号 |
| `0x0005` | `common.serialNumber` | string | mvp | SN |
| `0x0006` | `common.hardwareVersion` | string | mvp | 硬件版本 |
| `0x0007` | `common.firmwareVersion` | string | mvp | 固件版本 |
| `0x0008` | `common.protocolVersion` | string | mvp | AXTP 协议版本 |

---

## 8. 协议能力注册表

| capabilityId | name | 类型 | 状态 | 说明 |
|---:|---|---|---|---|
| `0x0101` | `protocol.payloadTypes` | bitmap | mvp | 支持的 PayloadType |
| `0x0102` | `protocol.headerProfiles` | bitmap | mvp | 支持的 Header Profile |
| `0x0103` | `protocol.frameVersion` | uint8 | mvp | Frame Header 版本 |
| `0x0104` | `reserved` | - | reserved | 历史扩展头能力位，v1 不使用 |
| `0x0105` | `protocol.frameCrcProfiles` | bitmap | mvp | Frame CRC 能力：Standard=CRC16，Compact=CRC8 |
| `0x0106` | `protocol.extendedCrc` | bitmap | draft | 扩展 CRC 能力，例如 CRC32 |
| `0x0107` | `protocol.compression` | bitmap | draft | 支持的压缩方式 |
| `0x0108` | `protocol.encryption` | bitmap | draft | 支持的加密方式 |
| `0x0109` | `protocol.sessionResume` | bool | mvp | 是否支持会话恢复 |
| `0x010A` | `protocol.windowUpdate` | bool | mvp | 是否支持 WINDOW_UPDATE |

### 8.1 protocol.payloadTypes bitmap

| Bit | 名称 | PayloadType |
|---:|---|---:|
| 0 | CONTROL | `0x01` |
| 1 | RPC | `0x02` |
| 2 | STREAM | `0x03` |

示例：

```text
0b00000111 = CONTROL + RPC + STREAM
```

---

## 9. 传输能力注册表

| capabilityId | name | 类型 | 状态 | 说明 |
|---:|---|---|---|---|
| `0x0201` | `transport.type` | enum | mvp | 当前传输类型 |
| `0x0202` | `transport.mtu` | uint16 | mvp | 当前 MTU |
| `0x0203` | `transport.maxFrameSize` | uint32 | mvp | 最大 Frame 大小 |
| `0x0204` | `transport.maxPayloadSize` | uint16 | mvp | 最大 Payload 大小 |
| `0x0205` | `transport.ackMode` | enum | mvp | ACK 模式 |
| `0x0206` | `transport.windowSize` | uint16 | mvp | 默认滑动窗口大小 |
| `0x0207` | `transport.timeoutMs` | uint32 | mvp | 默认超时时间 |
| `0x0208` | `transport.maxRetry` | uint8 | mvp | 默认最大重试次数 |
| `0x0209` | `transport.fragment` | bool | mvp | 是否支持 Frame 分片 |
| `0x020A` | `transport.reorder` | bool | draft | 是否允许乱序重组 |

### 9.1 transport.type enum

| 值 | 名称 |
|---:|---|
| `0x01` | `BLE` |
| `0x02` | `HID` |
| `0x03` | `UART` |
| `0x04` | `USB_BULK` |
| `0x05` | `TCP` |
| `0x06` | `WEBSOCKET_BINARY` |
| `0x07` | `WEBSOCKET_TEXT` |
| `0x08` | `MOCK` |

### 9.2 transport.ackMode enum

| 值 | 名称 | 说明 |
|---:|---|---|
| `0x00` | `NONE` | 不使用 ACK |
| `0x01` | `FRAME_ACK` | 按 Frame 确认 |
| `0x02` | `MESSAGE_ACK` | 按 Message 确认 |
| `0x03` | `STREAM_CHUNK_ACK` | 按 Stream Chunk 确认 |
| `0x04` | `SELECTIVE_ACK` | 选择性确认 / 缺失范围 |

---

## 10. RPC 能力注册表

| capabilityId | name | 类型 | 状态 | 说明 |
|---:|---|---|---|---|
| `0x0301` | `rpc.encodings` | bitmap | mvp | 支持的 RPC 编码 |
| `0x0302` | `rpc.bodyEncodings` | bitmap | mvp | 支持的 Body 编码 |
| `0x0303` | `rpc.maxRequestBodySize` | uint32 | mvp | 最大请求体 |
| `0x0304` | `rpc.maxResponseBodySize` | uint32 | mvp | 最大响应体 |
| `0x0305` | `rpc.batch` | bool | draft | 是否支持 Batch |
| `0x0306` | `rpc.event` | bool | mvp | 是否支持 Event |
| `0x0307` | `rpc.methodBitmap` | bytes | mvp | 支持的方法位图 |
| `0x0308` | `rpc.eventBitmap` | bytes | mvp | 支持的事件位图 |
| `0x0309` | `reserved` | - | reserved | 历史 requestId 宽度协商位；v1 固定为 uint32 |

### 10.1 rpc.encodings bitmap

| Bit | 名称 |
|---:|---|
| 0 | `JSON` |
| 1 | `BINARY` |
| 2 | `CBOR` |
| 3 | `MSGPACK` |

### 10.2 rpc.bodyEncodings bitmap

| Bit | 名称 |
|---:|---|
| 0 | `NONE` |
| 1 | `TLV` |
| 2 | `FIXED_STRUCT` |
| 3 | `CBOR` |
| 4 | `RAW_BYTES` |

---

## 11. STREAM 能力注册表

| capabilityId | name | 类型 | 状态 | 说明 |
|---:|---|---|---|---|
| `0x0401` | `stream.profiles` | list<uint16> / bitmap | mvp | 支持的 Stream Profile ID 列表或小型 Profile bitmap 摘要 |
| `0x0402` | `stream.maxChunkSize` | uint32 | mvp | 最大业务 chunk |
| `0x0403` | `stream.maxStreamCount` | uint8 | mvp | 最大并发流数量 |
| `0x0404` | `stream.reliableModes` | bitmap | mvp | 支持的可靠性模式 |
| `0x0405` | `stream.resume` | bool | mvp | 是否支持断点续传 |
| `0x0406` | `stream.windowSize` | uint16 | mvp | Stream 默认窗口大小 |
| `0x0407` | `stream.chunkCrc32` | bool | mvp | 是否支持 chunkCrc32 |
| `0x0408` | `stream.objectHash` | bitmap | draft | 支持的对象级 hash |
| `0x0409` | `stream.qos` | bool | draft | 是否支持 QoS |

### 11.1 stream.profiles

Stream Profile 是具体可建流协议档案。能力值推荐使用 `list<uint16>` 返回完整 profileId；低带宽 OPEN 摘要可使用 bitmap，但 bitmap 只能表达 MVP 小集合。

| profileId | Profile |
|---:|---|
| `0x0101` | `firmware.ota` |
| `0x0201` | `file.upload` |
| `0x0202` | `file.download` |
| `0x0401` | `log.realtime` |
| `0x8001` | `legacy.tunnel` |

说明：

```text
Stream Profile 存在于 Registry/Capability/Stream Context 中，不存在于 STREAM L2 Header。
```

### 11.2 stream.reliableModes bitmap

| Bit | 模式 | 说明 |
|---:|---|---|
| 0 | `BEST_EFFORT` | 不保证可靠 |
| 1 | `STOP_AND_WAIT` | 停等确认 |
| 2 | `SLIDING_WINDOW` | 滑动窗口 |

---

## 12. 设备基础能力注册表

| capabilityId | name | 类型 | 状态 | 说明 |
|---:|---|---|---|---|
| `0x0501` | `device.reboot` | bool | mvp | 是否支持重启 |
| `0x0502` | `device.factoryReset` | bool | mvp | 是否支持恢复出厂 |
| `0x0503` | `device.rename` | bool | draft | 是否支持设备重命名 |
| `0x0504` | `device.statusReport` | bool | mvp | 是否支持状态上报 |
| `0x0505` | `device.timeSync` | bool | draft | 是否支持时间同步 |

---

## 13. 显示与亮度能力注册表

| capabilityId | name | 类型 | 状态 | 说明 |
|---:|---|---|---|---|
| `0x0601` | `brightness.supported` | bool | mvp | 是否支持亮度控制 |
| `0x0602` | `brightness.min` | uint16 | mvp | 最小亮度 |
| `0x0603` | `brightness.max` | uint16 | mvp | 最大亮度 |
| `0x0604` | `brightness.step` | uint16 | mvp | 亮度步进 |
| `0x0605` | `brightness.autoMode` | bool | mvp | 是否支持自动亮度 |
| `0x0606` | `brightness.schedule` | bool | draft | 是否支持亮度计划 |
| `0x0610` | `display.supported` | bool | draft | 是否支持显示控制 |
| `0x0611` | `display.inputSources` | bitmap | draft | 支持的输入源 |
| `0x0612` | `display.resolutions` | array | draft | 支持的分辨率 |
| `0x0613` | `display.rotation` | bool | draft | 是否支持旋转 |
| `0x0614` | `display.layout` | bool | draft | 是否支持布局控制 |

---

## 14. 视频能力注册表

| capabilityId | name | 类型 | 状态 | 说明 |
|---:|---|---|---|---|
| `0x0701` | `video.supported` | bool | draft | 是否支持视频控制 |
| `0x0702` | `video.sources` | array | draft | 视频源列表 |
| `0x0703` | `video.codecs` | bitmap | draft | 支持的视频编码 |
| `0x0704` | `video.resolutions` | array | draft | 支持的分辨率 |
| `0x0705` | `video.frameRates` | array | draft | 支持帧率 |
| `0x0706` | `video.bitrateRange` | object | draft | 码率范围 |
| `0x0707` | `video.previewStream` | bool | draft | 是否支持预览流 |
| `0x0708` | `video.captureFrame` | bool | draft | 是否支持截图 |

---

## 15. 音频能力注册表

| capabilityId | name | 类型 | 状态 | 说明 |
|---:|---|---|---|---|
| `0x0801` | `audio.supported` | bool | draft | 是否支持音频控制 |
| `0x0802` | `audio.inputDevices` | array | draft | 输入设备 |
| `0x0803` | `audio.outputDevices` | array | draft | 输出设备 |
| `0x0804` | `audio.codecs` | bitmap | draft | 支持音频编码 |
| `0x0805` | `audio.sampleRates` | array | draft | 支持采样率 |
| `0x0806` | `audio.volumeRange` | object | draft | 音量范围 |
| `0x0807` | `audio.mute` | bool | draft | 是否支持静音 |

---

## 16. 文件能力注册表

| capabilityId | name | 类型 | 状态 | 说明 |
|---:|---|---|---|---|
| `0x0901` | `file.supported` | bool | mvp | 是否支持文件传输 |
| `0x0902` | `file.types` | bitmap | mvp | 支持的 fileType |
| `0x0903` | `file.maxFileSize` | uint64 | mvp | 最大文件大小 |
| `0x0904` | `file.resume` | bool | mvp | 是否支持断点续传 |
| `0x0905` | `file.verify` | bitmap | mvp | 支持的校验算法 |
| `0x0906` | `file.list` | bool | draft | 是否支持文件列表 |
| `0x0907` | `file.delete` | bool | draft | 是否支持删除 |

---

## 17. 固件 / OTA 能力注册表

| capabilityId | name | 类型 | 状态 | 说明 |
|---:|---|---|---|---|
| `0x0A01` | `firmware.supported` | bool | mvp | 是否支持固件升级 |
| `0x0A02` | `firmware.imageTypes` | bitmap | mvp | 支持的 imageType |
| `0x0A03` | `firmware.maxImageSize` | uint64 | mvp | 最大镜像大小 |
| `0x0A04` | `firmware.chunkSize` | uint32 | mvp | 推荐 chunk 大小 |
| `0x0A05` | `firmware.resume` | bool | mvp | 是否支持断点续传 |
| `0x0A06` | `firmware.verify` | bitmap | mvp | 支持的校验算法 |
| `0x0A07` | `firmware.rollback` | bool | draft | 是否支持回滚 |
| `0x0A08` | `firmware.abSlot` | bool | draft | 是否支持 A/B 分区 |
| `0x0A09` | `firmware.applyRequiresReboot` | bool | mvp | 应用固件是否需要重启 |

### 17.1 firmware.verify bitmap

| Bit | 算法 |
|---:|---|
| 0 | `CRC32` |
| 1 | `MD5` |
| 2 | `SHA1` |
| 3 | `SHA256` |
| 4 | `SIGNATURE` |

MVP 推荐：

```text
CRC32 + SHA256
```

---

## 18. 日志能力注册表

| capabilityId | name | 类型 | 状态 | 说明 |
|---:|---|---|---|---|
| `0x0B01` | `log.supported` | bool | mvp | 是否支持日志能力 |
| `0x0B02` | `log.levels` | bitmap | mvp | 支持日志等级 |
| `0x0B03` | `log.stream` | bool | mvp | 是否支持实时日志流 |
| `0x0B04` | `log.export` | bool | draft | 是否支持日志导出 |
| `0x0B05` | `log.categories` | bitmap | draft | 支持日志分类 |
| `0x0B06` | `log.clear` | bool | draft | 是否支持清空日志 |

---

## 19. 诊断能力注册表

| capabilityId | name | 类型 | 状态 | 说明 |
|---:|---|---|---|---|
| `0x0C01` | `diagnostic.supported` | bool | mvp | 是否支持诊断 |
| `0x0C02` | `diagnostic.selfTest` | bool | mvp | 是否支持自检 |
| `0x0C03` | `diagnostic.metrics` | bitmap | mvp | 支持的指标 |
| `0x0C04` | `diagnostic.temperature` | bool | draft | 是否支持温度读取 |
| `0x0C05` | `diagnostic.voltage` | bool | draft | 是否支持电压读取 |
| `0x0C06` | `diagnostic.loopback` | bool | draft | 是否支持回环测试 |

---

## 20. 输入 / KVM 能力注册表

| capabilityId | name | 类型 | 状态 | 说明 |
|---:|---|---|---|---|
| `0x0D01` | `input.supported` | bool | draft | 是否支持输入控制 |
| `0x0D02` | `input.keyboard` | bool | draft | 是否支持键盘 |
| `0x0D03` | `input.mouse` | bool | draft | 是否支持鼠标 |
| `0x0D04` | `input.touch` | bool | draft | 是否支持触控 |
| `0x0D05` | `input.hidRaw` | bool | draft | 是否支持 HID Raw |
| `0x0D06` | `input.kvm` | bool | draft | 是否支持 KVM |

---

## 21. 网络能力注册表

| capabilityId | name | 类型 | 状态 | 说明 |
|---:|---|---|---|---|
| `0x0E01` | `network.supported` | bool | draft | 是否支持网络配置 |
| `0x0E02` | `network.wifi` | bool | draft | 是否支持 Wi-Fi |
| `0x0E03` | `network.ethernet` | bool | draft | 是否支持以太网 |
| `0x0E04` | `network.ipv4` | bool | draft | 是否支持 IPv4 |
| `0x0E05` | `network.ipv6` | bool | draft | 是否支持 IPv6 |

---

## 22. 存储能力注册表

| capabilityId | name | 类型 | 状态 | 说明 |
|---:|---|---|---|---|
| `0x0F01` | `storage.supported` | bool | draft | 是否支持存储管理 |
| `0x0F02` | `storage.capacity` | uint64 | draft | 存储容量 |
| `0x0F03` | `storage.freeSpace` | uint64 | draft | 剩余空间 |
| `0x0F04` | `storage.format` | bool | draft | 是否支持格式化 |

---

## 23. Vendor Capability

厂商私有能力范围：

```text
0x7000-0x7FFF
```

Vendor capability 必须满足：

```text
1. 不得覆盖标准 capabilityId
2. 必须带 vendorId
3. 必须带 capability name
4. 必须带 type
5. 必须声明是否影响互操作
```

示例：

```yaml
- id: 0x7001
  name: vendor.aw.customLedMatrix
  domain: vendor
  vendorId: 0x1234
  status: draft
  type: object
  description: Vendor-specific LED matrix capability.
  interoperable: false
```

---

## 24. Capability 查询方法

Capability 相关方法定义在 MethodId 注册表中。

MVP 必须实现：

| methodId | methodName | 说明 |
|---:|---|---|
| `0x0301` | `capability.getAll` | 获取完整能力摘要 |
| `0x0302` | `capability.getDomain` | 获取指定 domain 能力 |
| `0x0303` | `capability.hasMethod` | 判断 methodId 是否支持 |
| `0x0304` | `capability.getLimits` | 获取协议和传输限制 |

建议后续实现：

| methodId | methodName | 说明 |
|---:|---|---|
| `0x0305` | `capability.hasEvent` | 判断 eventId 是否支持 |
| `0x0306` | `capability.getStreams` | 获取 Stream 能力 |
| `0x0307` | `capability.getFirmware` | 获取固件升级能力 |
| `0x0308` | `capability.negotiate` | 业务能力协商 |

---

## 25. capability.getAll 返回结构

### 25.1 JSON 表达

```json
{
  "protocol": {
    "payloadTypes": ["CONTROL", "RPC", "STREAM"],
    "headerProfiles": ["COMPACT"],
    "frameVersion": 1,
    "frameCrcProfiles": {
      "STANDARD": "CRC16",
      "COMPACT": "CRC8"
    },
    "sessionResume": true
  },
  "transport": {
    "type": "HID",
    "mtu": 64,
    "maxFrameSize": 64,
    "maxPayloadSize": 58,
    "ackMode": "MESSAGE_ACK",
    "windowSize": 1
  },
  "rpc": {
    "encodings": ["BINARY"],
    "bodyEncodings": ["TLV"],
    "event": true
  },
  "stream": {
    "kinds": ["OTA", "FILE", "LOG"],
    "maxChunkSize": 48,
    "resume": true,
    "chunkCrc32": true
  },
  "business": {
    "brightness": {
      "supported": true,
      "min": 0,
      "max": 100,
      "step": 1,
      "autoMode": true
    },
    "firmware": {
      "supported": true,
      "imageTypes": ["MCU_FIRMWARE"],
      "verify": ["CRC32", "SHA256"],
      "resume": true
    }
  }
}
```

### 25.2 TLV 表达

TLV 表达不要求所有能力一次性返回。

MVP 推荐返回摘要：

```text
capability.getAll.result
  protocol.payloadTypes
  protocol.headerProfiles
  transport.mtu
  transport.maxFrameSize
  rpc.encodings
  rpc.bodyEncodings
  stream.profiles
  brightness.supported
  firmware.supported
```

复杂能力可通过 `capability.getDomain` 查询。

---

## 26. capability.getDomain 参数

参数：

| 字段 | fieldId | 类型 | 说明 |
|---|---:|---|---|
| domain | `0x01` | enum/string | 能力域 |

支持 domain：

```text
protocol
transport
rpc
stream
device
brightness
video
audio
file
firmware
log
diagnostic
input
network
storage
vendor
```

---

## 27. capability.hasMethod 参数与结果

参数：

| 字段 | fieldId | 类型 | 说明 |
|---|---:|---|---|
| methodId | `0x01` | uint16 | 方法 ID |

结果：

| 字段 | fieldId | 类型 | 说明 |
|---|---:|---|---|
| supported | `0x01` | bool | 是否支持 |
| reasonCode | `0x02` | uint16 | 不支持原因 |
| minFirmwareVersion | `0x03` | string | 最低固件版本 |

---

## 28. Capability 与 Method 的关系

Method Registry 表示协议定义了哪些方法。

Capability 表示当前设备实际支持哪些方法。

因此：

```text
MethodId 存在，不代表设备必须支持。
设备是否支持，必须通过 Capability 判断。
```

例如：

```text
firmware.rollback 已注册
但某个 MCU 设备没有 A/B 分区
所以 capability firmware.rollback = false
```

---

## 29. Capability 与 Event 的关系

Event Registry 表示协议定义了哪些事件。

Capability 表示当前设备是否会上报该事件。

例如：

```text
firmware.updateProgress 已注册
如果设备支持 OTA，则通常应支持该事件
```

但某些极简设备可能只支持：

```text
firmware.updateCompleted
firmware.updateFailed
```

不支持进度事件。

---

## 30. Capability 与 Stream 的关系

StreamProfile 存在，不代表当前设备支持该 Stream。

例如：

```text
STREAM 协议支持 OTA / FILE / LOG / MEDIA
但某个设备只支持 OTA
```

此时 capability 应返回：

```text
stream.profiles = OTA
```

---

## 31. Capability 与老协议适配

老协议中常见能力来源包括：

```text
设备信息命令
能力矩阵命令
Feature bitmap
CmdValue 支持表
固件版本判断
产品型号判断
```

迁移到 AXTP 后，不建议继续让上层直接判断旧字段。

应统一转换为 Capability Registry。

### 31.1 老协议映射示例

| 老协议能力 | AXTP capability | 说明 |
|---|---|---|
| `CmdValue 0xC0021 exists` | `video.supported = true` | 支持视频模式设置 |
| `CmdValue 0xB0002 exists` | `common.deviceInfo = true` | 支持设备信息读取 |
| `AlphaUpgradeInfo exists` | `firmware.supported = true` | 支持升级 |
| `FeatureBitmap.bit0` | `brightness.supported = true` | 支持亮度 |
| `FeatureBitmap.bit1` | `firmware.resume = true` | 支持续传 |

### 31.2 legacyMapping 字段

```yaml
- id: 0x0A01
  name: firmware.supported
  domain: firmware
  type: bool
  status: mvp
  legacyMapping:
    source: AXDP
    rule: "AlphaUpgradeInfo command exists"
    legacyCmdValues:
      - 0xA0001
```

---

## 32. MVP Capability 集合

MVP 阶段必须实现以下能力。

### 32.1 Protocol MVP

```text
protocol.payloadTypes
protocol.headerProfiles
protocol.frameVersion
protocol.frameCrcProfiles
protocol.sessionResume
protocol.windowUpdate
```

### 32.2 Transport MVP

```text
transport.type
transport.mtu
transport.maxFrameSize
transport.maxPayloadSize
transport.ackMode
transport.windowSize
transport.timeoutMs
transport.maxRetry
transport.fragment
```

### 32.3 RPC MVP

```text
rpc.encodings
rpc.bodyEncodings
rpc.maxRequestBodySize
rpc.maxResponseBodySize
rpc.event
rpc.methodBitmap
rpc.eventBitmap
```

### 32.4 Stream MVP

```text
stream.profiles
stream.maxChunkSize
stream.maxStreamCount
stream.reliableModes
stream.resume
stream.windowSize
stream.chunkCrc32
```

### 32.5 Business MVP

```text
common.deviceClass
common.vendorId
common.productId
common.model
common.serialNumber
common.hardwareVersion
common.firmwareVersion
brightness.supported
brightness.min
brightness.max
brightness.step
brightness.autoMode
firmware.supported
firmware.imageTypes
firmware.maxImageSize
firmware.chunkSize
firmware.resume
firmware.verify
firmware.applyRequiresReboot
log.supported
log.stream
diagnostic.supported
diagnostic.selfTest
```

---

## 33. capability_registry_mvp.yaml 示例

```yaml
registry: capability
version: 1.0.0

capabilities:
  - id: 0x0101
    name: protocol.payloadTypes
    domain: protocol
    status: mvp
    type: bitmap
    values:
      CONTROL: 0x01
      RPC: 0x02
      STREAM: 0x04
    discovery:
      controlHello: true
      rpc: true

  - id: 0x0202
    name: transport.mtu
    domain: transport
    status: mvp
    type: uint16
    discovery:
      controlHello: true
      rpc: true

  - id: 0x0301
    name: rpc.encodings
    domain: rpc
    status: mvp
    type: bitmap
    values:
      JSON: 0x01
      BINARY: 0x02
      CBOR: 0x04
      MSGPACK: 0x08
    discovery:
      controlHello: true
      rpc: true

  - id: 0x0401
    name: stream.profiles
    domain: stream
    status: mvp
    type: list<uint16>
    values:
      firmware.ota: 0x0101
      file.upload: 0x0201
      file.download: 0x0202
      log.realtime: 0x0401
      media.video: 0x1001
      media.audio: 0x1002
      control.hid_raw: 0x3001
      sensor.sample: 0x4001
    discovery:
      controlHello: false
      rpc: true

  - id: 0x0601
    name: brightness.supported
    domain: brightness
    status: mvp
    type: bool
    discovery:
      controlHello: false
      rpc: true

  - id: 0x0A01
    name: firmware.supported
    domain: firmware
    status: mvp
    type: bool
    discovery:
      controlHello: false
      rpc: true
    legacyMapping:
      source: AXDP
      rule: "AlphaUpgradeInfo command exists"
```

---

## 34. Generator v1 输出要求

Generator v1 读取 Capability Registry 后，应至少生成：

```text
AxtpCapabilityId enum
AxtpCapabilityDescriptor 表
Capability domain 分组表
Capability 类型信息
Capability 默认值
Capability legacyMapping 元数据
Markdown 能力表
```

C++ 示例：

```cpp
enum class AxtpCapabilityId : uint16_t {
    ProtocolPayloadTypes = 0x0101,
    TransportMtu = 0x0202,
    RpcEncodings = 0x0301,
    StreamProfiles = 0x0401,
    BrightnessSupported = 0x0601,
    FirmwareSupported = 0x0A01,
};
```

Capability descriptor 示例：

```cpp
struct AxtpCapabilityDescriptor {
    uint16_t id;
    const char* name;
    const char* domain;
    AxtpValueType type;
    AxtpRegistryStatus status;
};
```

---

## 35. C++ Demo v1 要求

C++ Demo v1 至少需要实现：

```text
1. 设备启动时构造 CapabilitySet
2. ACCEPT 返回协议能力摘要
3. capability.getAll 返回完整 MVP capability
4. capability.getDomain 返回指定 domain
5. capability.hasMethod 判断 methodId
6. capability 控制 brightness / firmware / stream 是否可用
```

示例流程：

```text
Client -> CONTROL OPEN
Server -> CONTROL ACCEPT，返回 protocol/transport/rpc/stream 摘要

Client -> RPC capability.getAll
Server -> 返回完整能力集

Client -> RPC capability.hasMethod(methodId = brightness.set)
Server -> supported = true

Client -> RPC brightness.set
Server -> 执行
```

---

## 36. 错误处理

Capability 查询相关错误码来自 ErrorCode Registry。

常用错误：

| errorCode | 名称 | 场景 |
|---:|---|---|
| `0x0000` | `OK` | 查询成功 |
| `0x0304` | `RPC_METHOD_NOT_FOUND` | capability 方法不存在 |
| `0x0305` | `RPC_METHOD_NOT_SUPPORTED` | 当前设备不支持 |
| `0x0501` | `CAPABILITY_NOT_FOUND` | capabilityId 不存在 |
| `0x0502` | `CAPABILITY_DOMAIN_NOT_FOUND` | domain 不存在 |
| `0x0503` | `CAPABILITY_NOT_SUPPORTED` | 能力不支持 |
| `0x0504` | `CAPABILITY_NEGOTIATION_FAILED` | 能力协商失败 |

---

## 37. 测试向量建议

Capability Registry 至少应提供以下测试向量：

```text
1. ACCEPT 返回 protocol.payloadTypes
2. ACCEPT 返回 transport.mtu
3. capability.getAll JSON 返回
4. capability.getAll Binary TLV 返回
5. capability.getDomain(domain=firmware)
6. capability.hasMethod(methodId=brightness.set) success
7. capability.hasMethod(methodId=video.startPreview) unsupported
8. capability.getDomain(domain=unknown) error
9. 老协议 CmdValue 映射为 capability
```

---

## 38. 落地原则

Capability Registry 的落地原则是：

```text
协议能力尽早协商
业务能力通过 RPC 查询
Method 存在不代表设备支持
Event 存在不代表设备会上报
StreamProfile 存在不代表设备支持该流
老协议能力必须统一映射为 Capability
Capability YAML 是唯一事实源
```

---

## 39. 总结

Capability Registry 是 AXTP 设备协议从“固定命令表”走向“可发现、可协商、可生成、可兼容”的关键。

最终结构如下：

```text
CONTROL OPEN
  ↓
协议能力 / 传输能力快速协商

RPC capability.*
  ↓
完整业务能力查询

Capability Registry
  ↓
驱动 Method / Event / Stream / OTA / File / Brightness 等功能是否可用

Generator
  ↓
生成 C++ capability enum / descriptor / parser / 文档
```

MVP 阶段不追求完整覆盖所有业务域。

MVP 只需要保证：

```text
设备可识别
协议能力可协商
业务能力可查询
method 支持性可判断
OTA / brightness / log / diagnostic 基础能力可表达
老协议能力可映射
```

这样 AXTP 才能从协议设计真正进入可实现、可测试、可迁移的工程落地阶段。
