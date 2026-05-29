# 12《AXTP Capability 注册表》

版本：v1.1 Draft
状态：MVP Capability Registry 规范（精简版）
适用范围：AXTP Capability 分类、CapabilityId 编号、条目结构、查询方法、MVP 集合、老协议适配

---

## 1. Capability 定位

Capability 是对设备能力、协议能力、传输能力和业务功能的声明，不是业务命令本身。

两类能力发现机制：

| 机制 | 职责 |
| --- |---|
| `CONTROL OPEN / ACCEPT` | 协议运行时参数协商（protocolVersion、maxFrameSize、maxPayloadSize、mtu、supportedPayloadTypes、supportedRpcEncodings、heartbeatIntervalMs、ackMode、windowSize） |
| `RPC capability.*` | 业务能力查询（display 亮度范围、OTA 支持、firmware imageType、video stream、methodId 支持、eventId 支持、codec、文件类型） |

规则：
- 影响 Frame/Control/RPC/Stream Parser 工作方式的能力必须在 CONTROL OPEN 阶段协商
- 业务能力不得放进 CONTROL OPEN，必须通过 RPC 查询
- MethodId 存在不代表设备必须支持；设备是否支持必须通过 Capability 判断
- StreamProfile 存在不代表设备支持该流；必须通过 `stream.profiles` capability 判断

---

## 2. Capability 分类

| 类别 | 说明 | 发现方式 |
| --- |---| --- |
| protocol capability | 协议版本、PayloadType、Frame Profile | CONTROL OPEN + RPC |
| transport capability | MTU、最大包长、窗口、ACK 模式 | CONTROL OPEN + RPC |
| rpc capability | RPC 编码、bodyEncoding、methodId 支持 | CONTROL OPEN + RPC |
| stream capability | Stream Profile ID、窗口、断点续传、CRC | RPC |
| business capability | display、firmware、file、video 等业务能力 | RPC |
| vendor capability | 厂商私有能力 | RPC |

---

## 3. CapabilityId 编号规划

CapabilityId 使用 `uint16`：

```text
0x0000-0x00FF  通用能力
0x0100-0x01FF  协议能力
0x0200-0x02FF  传输能力
0x0300-0x03FF  RPC 能力
0x0400-0x04FF  STREAM 能力
0x0500-0x05FF  设备基础能力
0x0600-0x06FF  显示能力
0x0700-0x07FF  视频能力
0x0800-0x08FF  音频能力
0x0900-0x09FF  文件能力
0x0A00-0x0AFF  固件 / OTA 能力
0x0B00-0x0BFF  日志能力
0x0C00-0x0CFF  诊断能力
0x0D00-0x0DFF  输入 / KVM 能力
0x0E00-0x0EFF  网络能力
0x0F00-0x0FFF  存储能力
0x1000-0x10FF  传感器能力
0x1100-0x11FF  认证能力
0x1200-0x12FF  隐私能力
0x7000-0x7FFF  厂商私有能力
0x8000-0xFFFF  保留
```

---

## 4. Capability 条目结构

```yaml
- id: 0x0101
  name: protocol.payloadTypes
  domain: protocol
  domainId: 0x01        # capability.supportedMethods 或 v2 capability.getAll 响应中的 DomainId
  bitOffset: 0          # 该 capability 在 Domain 内的掩码位偏移
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
    - capability.supportedMethods
    - capability.getAll
    - capability.getDomain
  since: 1.0.0
```

| 字段 | 说明 |
| --- | --- |
| `id` | capabilityId |
| `name` | capability 名称 |
| `domain` | 所属域 |
| `domainId` | `capability.supportedMethods` 或 v2 `capability.getAll` 响应中的 DomainId（1B），与 MethodId 高字节对齐 |
| `bitOffset` | 该 capability 在 Domain 内的掩码位偏移（0-255），由 Registry 自增分配 |
| `status` | draft / mvp / stable / deprecated / reserved |
| `type` | bool / uint / enum / bitmap / object / array |
| `description` | 描述 |
| `values` | 枚举或 bitmap 值 |
| `range` | 数值范围 |
| `discovery` | 是否可通过 OPEN 或 RPC 查询 |
| `relatedMethods` | 相关 RPC 方法 |
| `relatedEvents` | 相关事件 |
| `relatedStreams` | 相关 Stream 类型 |
| `legacyMapping` | 老协议适配关系 |
| `since` | 引入版本 |
| `deprecatedSince` | 废弃版本 |

---

## 4.1 capability.supportedMethods 响应格式：域级方法掩码

AXTP v1 Core 唯一强制能力发现入口是 `capability.supportedMethods`。它返回当前设备、当前固件、当前会话、当前鉴权状态下支持的 methodId 集合。

`capability.supportedMethods` 的 Binary 响应使用域级二进制掩码链（Domain Mask Packets Chain）：

```text
Domain Block = [DomainId: 1B] + [MaskLen: 1B] + [MethodBitmask: N B (Little-Endian)]
```

完整 `capability.getAll` 响应属于 v2/P1 Capability Model，不作为 v1 Core 必选项。

## 4.2 capability.getAll 响应格式：域级掩码（v2/P1）

`capability.getAll` 的 Binary 响应使用**域级二进制掩码链（Domain Mask Packets Chain）**，而非 JSON 键值对列表。

**格式**：

```text
Domain Block = [DomainId: 1B] + [MaskLen: 1B] + [Bitmask: N B (Little-Endian)]
```

- `DomainId`：与 MethodId 高字节对齐（如 `display.*` 的 DomainId = `0x05`）
- `MaskLen`：Bitmask 字节数，高水位截断（只发到最高有效字节）
- `Bitmask`：该域的能力掩码，Bit N 对应 `bitOffset=N` 的 capability

**高水位截断规则**：如果某域只用到 bitOffset=3，`MaskLen` 必须为 1，不得发送多余字节。

**MVP 设备示例**（支持 protocol 域 Bits 0-2、display 域 Bit 0、firmware 域 Bits 0-1）：

```text
Binary: 01 01 07  05 01 01  0B 01 03
        |________|  |________|  |________|
         domain=0x01  domain=0x05  domain=0x0B
```

**JSON 编码（WebSocket/HTTP Debug）**：

```json
{
  "result": {
    "capabilityMasks": "010107050101 0B0103"
  }
}
```

**DomainId 与 MethodId 范围对应关系**：

| DomainId | MethodId 范围 | 域名 |
| --- | --- | --- |
| `0x01` | `0x0100-0x01FF` | `device.*` |
| `0x03` | `0x0300-0x03FF` | `capability.*` |
| `0x04` | `0x0400-0x04FF` | `system.*` |
| `0x05` | `0x0500-0x05FF` | `display.*` |
| `0x06` | `0x0600-0x06FF` | `camera.*` |
| `0x07` | `0x0700-0x07FF` | `video.*` |
| `0x08` | `0x0800-0x08FF` | `audio.*` |
| `0x09` | `0x0900-0x09FF` | `stream.*` |
| `0x0A` | `0x0A00-0x0AFF` | `file.*` |
| `0x0B` | `0x0B00-0x0BFF` | `firmware.*` |

**C++ 解析（O(1) 安全寻址）**：

```cpp
bool isCapabilitySupported(const uint8_t* bitmask, uint8_t maskLen, uint8_t bitOffset) {
    uint8_t byteIndex = bitOffset / 8;
    uint8_t bitIndex  = bitOffset % 8;
    if (byteIndex >= maskLen) return false;
    return (bitmask[byteIndex] & (1 << bitIndex)) != 0;
}
```

---

## 5. 通用能力注册表

| capabilityId | name | domainId | bitOffset | 类型 | 状态 | 说明 |
| ---: | --- | ---: | ---: | --- | --- | --- |
| `0x0001` | `common.deviceClass` | `0x01` | 0 | enum | mvp | 设备类别 |
| `0x0002` | `common.vendorId` | `0x01` | 1 | uint16 | mvp | 厂商 ID |
| `0x0003` | `common.productId` | `0x01` | 2 | uint16 | mvp | 产品 ID |
| `0x0004` | `common.model` | `0x01` | 3 | string | mvp | 型号 |
| `0x0005` | `common.serialNumber` | `0x01` | 4 | string | mvp | SN |
| `0x0006` | `common.hardwareVersion` | `0x01` | 5 | string | mvp | 硬件版本 |
| `0x0007` | `common.firmwareVersion` | `0x01` | 6 | string | mvp | 固件版本 |
| `0x0008` | `common.protocolVersion` | string | mvp | AXTP 协议版本 |

---

## 6. 协议能力注册表

| capabilityId | name | 类型 | 状态 | 说明 |
|---:| --- |---| --- |---|
| `0x0101` | `protocol.payloadTypes` | bitmap | mvp | 支持的 PayloadType |
| `0x0102` | `reserved` | - | reserved | 历史 Header Profile 能力位，v1 不使用 |
| `0x0103` | `protocol.frameVersion` | uint8 | mvp | Frame Header 版本 |
| `0x0104` | `reserved` | - | reserved | 历史扩展头能力位，v1 不使用 |
| `0x0105` | `protocol.frameCrcProfiles` | bitmap | mvp | Frame CRC 能力：Standard=CRC16，Compact=CRC8 |
| `0x0106` | `protocol.extendedCrc` | bitmap | draft | 扩展 CRC 能力 |
| `0x0107` | `protocol.compression` | bitmap | draft | 支持的压缩方式 |
| `0x0108` | `protocol.encryption` | bitmap | draft | 支持的加密方式 |
| `0x0109` | `protocol.sessionResume` | bool | mvp | 是否支持会话恢复 |
| `0x010A` | `protocol.windowUpdate` | bool | mvp | 是否支持 WINDOW_UPDATE |

### 6.1 protocol.payloadTypes bitmap

| Bit | 名称 | PayloadType |
|---:| --- |---:|
| 0 | CONTROL | `0x01` |
| 1 | RPC | `0x02` |
| 2 | STREAM | `0x03` |

---

## 7. 传输能力注册表

| capabilityId | name | 类型 | 状态 | 说明 |
|---:| --- |---| --- |---|
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

### 7.1 transport.type enum

| 值 | 名称 |
|---:| --- |
| `0x01` | `BLE` |
| `0x02` | `HID` |
| `0x03` | `UART` |
| `0x04` | `USB_BULK` |
| `0x05` | `TCP` |
| `0x06` | `WEBSOCKET_BINARY` |
| `0x07` | `WEBSOCKET_TEXT` |
| `0x08` | `MOCK` |

### 7.2 transport.ackMode enum

| 值 | 名称 | 说明 |
|---:| --- |---|
| `0x00` | `NONE` | 不使用 ACK |
| `0x01` | `FRAME_ACK` | 按 Frame 确认 |
| `0x02` | `MESSAGE_ACK` | 按 Message 确认 |
| `0x03` | `STREAM_CHUNK_ACK` | 按 Stream Chunk 确认 |
| `0x04` | `SELECTIVE_ACK` | 选择性确认 / 缺失范围 |

---

## 8. RPC 能力注册表

| capabilityId | name | 类型 | 状态 | 说明 |
|---:| --- |---| --- |---|
| `0x0301` | `rpc.encodings` | bitmap | mvp | 支持的 RPC 编码 |
| `0x0302` | `rpc.bodyEncodings` | bitmap | mvp | 支持的 Body 编码 |
| `0x0303` | `rpc.maxRequestBodySize` | uint32 | mvp | 最大请求体 |
| `0x0304` | `rpc.maxResponseBodySize` | uint32 | mvp | 最大响应体 |
| `0x0305` | `rpc.batch` | bool | draft | 是否支持 Batch |
| `0x0306` | `rpc.event` | bool | mvp | 是否支持 Event |
| `0x0307` | `rpc.methodBitmap` | bytes | mvp | 支持的方法位图 |
| `0x0308` | `rpc.eventBitmap` | bytes | mvp | 支持的事件位图 |
| `0x0309` | `reserved` | - | reserved | 历史 requestId 宽度协商位；v1 固定为 uint32 |

### 8.1 rpc.encodings bitmap

| Bit | 名称 |
|---:| --- |
| 0 | `JSON` |
| 1 | `BINARY` |
| 2 | `CBOR` |
| 3 | `MSGPACK` |

### 8.2 rpc.bodyEncodings bitmap

| Bit | 名称 |
|---:| --- |
| 0 | `NONE` |
| 1 | `TLV8` |
| 2 | `TLV16` |
| 3 | `RAW_BYTES` |
| 4 | `CBOR_BODY` |

---
## 9. STREAM 能力注册表

| capabilityId | name | 类型 | 状态 | 说明 |
|---:| --- |---| --- |---|
| `0x0401` | `stream.profiles` | list<uint16> / bitmap | mvp | 支持的 Stream Profile ID 列表 |
| `0x0402` | `stream.maxChunkSize` | uint32 | mvp | 最大业务 chunk |
| `0x0403` | `stream.maxStreamCount` | uint8 | mvp | 最大并发流数量 |
| `0x0404` | `stream.reliableModes` | bitmap | mvp | 支持的可靠性模式 |
| `0x0405` | `stream.resume` | bool | mvp | 是否支持断点续传 |
| `0x0406` | `stream.windowSize` | uint16 | mvp | Stream 默认窗口大小 |
| `0x0407` | `stream.chunkCrc32` | bool | mvp | 是否支持 chunkCrc32 |
| `0x0408` | `stream.objectHash` | bitmap | draft | 支持的对象级 hash |
| `0x0409` | `stream.qos` | bool | draft | 是否支持 QoS |

### 9.1 stream.profiles

Stream Profile 是具体可建流协议档案，存在于 Registry/Capability/Stream Context 中，不存在于 STREAM L2 Header。

| profileId | Profile |
|---:| --- |
| `0x0101` | `firmware.ota` |
| `0x0002` | `file.transfer` |
| `0x0401` | `log.realtime` |
| `0x8001` | `legacy.tunnel` |

### 9.2 stream.reliableModes bitmap

| Bit | 模式 | 说明 |
|---:| --- |---|
| 0 | `BEST_EFFORT` | 不保证可靠 |
| 1 | `STOP_AND_WAIT` | 停等确认 |
| 2 | `SLIDING_WINDOW` | 滑动窗口 |

---

## 10. 设备基础能力注册表

| capabilityId | name | 类型 | 状态 | 说明 |
|---:| --- |---| --- |---|
| `0x0501` | `device.reboot` | bool | mvp | 是否支持重启 |
| `0x0502` | `device.factoryReset` | bool | mvp | 是否支持恢复出厂 |
| `0x0503` | `device.rename` | bool | draft | 是否支持设备重命名 |
| `0x0504` | `device.statusReport` | bool | mvp | 是否支持状态上报 |
| `0x0505` | `device.timeSync` | bool | draft | 是否支持时间同步 |

---

## 11. 显示能力注册表

| capabilityId | name | 类型 | 状态 | 说明 |
|---:| --- |---| --- |---|
| `0x0601` | `display.brightness` | bool | mvp | 是否支持亮度控制 |
| `0x0602` | `display.brightnessMin` | uint16 | mvp | 最小亮度 |
| `0x0603` | `display.brightnessMax` | uint16 | mvp | 最大亮度 |
| `0x0604` | `display.brightnessStep` | uint16 | mvp | 亮度步进 |
| `0x0605` | `display.brightnessAutoMode` | bool | mvp | 是否支持自动亮度 |
| `0x0606` | `display.brightnessSchedule` | bool | draft | 是否支持亮度计划 |
| `0x0610` | `display.supported` | bool | draft | 是否支持显示控制 |
| `0x0611` | `display.inputSources` | bitmap | draft | 支持的输入源 |
| `0x0612` | `display.resolutions` | array | draft | 支持的分辨率 |
| `0x0613` | `display.rotation` | bool | draft | 是否支持旋转 |
| `0x0614` | `display.layout` | bool | draft | 是否支持布局控制 |

---

## 12. 视频能力注册表

| capabilityId | name | 类型 | 状态 | 说明 |
|---:| --- |---| --- |---|
| `0x0701` | `video.supported` | bool | draft | 是否支持视频控制 |
| `0x0702` | `video.sources` | array | draft | 视频源列表 |
| `0x0703` | `video.codecs` | bitmap | draft | 支持的视频编码 |
| `0x0704` | `video.resolutions` | array | draft | 支持的分辨率 |
| `0x0705` | `video.frameRates` | array | draft | 支持帧率 |
| `0x0706` | `video.bitrateRange` | object | draft | 码率范围 |
| `0x0707` | `video.previewStream` | bool | draft | 是否支持预览流 |
| `0x0708` | `video.captureFrame` | bool | draft | 是否支持截图 |

---

## 13. 音频能力注册表

| capabilityId | name | 类型 | 状态 | 说明 |
|---:| --- |---| --- |---|
| `0x0801` | `audio.supported` | bool | draft | 是否支持音频控制 |
| `0x0802` | `audio.inputDevices` | array | draft | 输入设备 |
| `0x0803` | `audio.outputDevices` | array | draft | 输出设备 |
| `0x0804` | `audio.codecs` | bitmap | draft | 支持音频编码 |
| `0x0805` | `audio.sampleRates` | array | draft | 支持采样率 |
| `0x0806` | `audio.volumeRange` | object | draft | 音量范围 |
| `0x0807` | `audio.mute` | bool | draft | 是否支持静音 |

---

## 14. 文件能力注册表

| capabilityId | name | 类型 | 状态 | 说明 |
|---:| --- |---| --- |---|
| `0x0901` | `file.supported` | bool | mvp | 是否支持文件传输 |
| `0x0902` | `file.types` | bitmap | mvp | 支持的 fileType |
| `0x0903` | `file.maxFileSize` | uint64 | mvp | 最大文件大小 |
| `0x0904` | `file.resume` | bool | mvp | 是否支持断点续传 |
| `0x0905` | `file.verify` | bitmap | mvp | 支持的校验算法 |
| `0x0906` | `file.list` | bool | draft | 是否支持文件列表 |
| `0x0907` | `file.delete` | bool | draft | 是否支持删除 |

---

## 15. 固件 / OTA 能力注册表

| capabilityId | name | 类型 | 状态 | 说明 |
|---:| --- |---| --- |---|
| `0x0A01` | `firmware.supported` | bool | mvp | 是否支持固件升级 |
| `0x0A02` | `firmware.imageTypes` | bitmap | mvp | 支持的 imageType |
| `0x0A03` | `firmware.maxImageSize` | uint64 | mvp | 最大镜像大小 |
| `0x0A04` | `firmware.chunkSize` | uint32 | mvp | 推荐 chunk 大小 |
| `0x0A05` | `firmware.resume` | bool | mvp | 是否支持断点续传 |
| `0x0A06` | `firmware.verify` | bitmap | mvp | 支持的校验算法 |
| `0x0A07` | `firmware.rollback` | bool | draft | 是否支持回滚 |
| `0x0A08` | `firmware.abSlot` | bool | draft | 是否支持 A/B 分区 |
| `0x0A09` | `firmware.applyRequiresReboot` | bool | mvp | 应用固件是否需要重启 |

### 15.1 firmware.verify bitmap

| Bit | 算法 |
|---:| --- |
| 0 | `CRC32` |
| 1 | `MD5` |
| 2 | `SHA1` |
| 3 | `SHA256` |
| 4 | `SIGNATURE` |

MVP 推荐：`CRC32 + SHA256`

---

## 16. 日志能力注册表

| capabilityId | name | 类型 | 状态 | 说明 |
|---:| --- |---| --- |---|
| `0x0B01` | `log.supported` | bool | mvp | 是否支持日志能力 |
| `0x0B02` | `log.levels` | bitmap | mvp | 支持日志等级 |
| `0x0B03` | `log.stream` | bool | mvp | 是否支持实时日志流 |
| `0x0B04` | `log.export` | bool | draft | 是否支持日志导出 |
| `0x0B05` | `log.categories` | bitmap | draft | 支持日志分类 |
| `0x0B06` | `log.clear` | bool | draft | 是否支持清空日志 |

---

## 17. 诊断能力注册表

| capabilityId | name | 类型 | 状态 | 说明 |
|---:| --- |---| --- |---|
| `0x0C01` | `diagnostic.supported` | bool | mvp | 是否支持诊断 |
| `0x0C02` | `diagnostic.selfTest` | bool | mvp | 是否支持自检 |
| `0x0C03` | `diagnostic.metrics` | bitmap | mvp | 支持的指标 |
| `0x0C04` | `diagnostic.temperature` | bool | draft | 是否支持温度读取 |
| `0x0C05` | `diagnostic.voltage` | bool | draft | 是否支持电压读取 |
| `0x0C06` | `diagnostic.loopback` | bool | draft | 是否支持回环测试 |

---

## 18. 输入 / KVM 能力注册表

| capabilityId | name | 类型 | 状态 | 说明 |
|---:| --- |---| --- |---|
| `0x0D01` | `input.supported` | bool | draft | 是否支持输入控制 |
| `0x0D02` | `input.keyboard` | bool | draft | 是否支持键盘 |
| `0x0D03` | `input.mouse` | bool | draft | 是否支持鼠标 |
| `0x0D04` | `input.touch` | bool | draft | 是否支持触控 |
| `0x0D05` | `input.hidRaw` | bool | draft | 是否支持 HID Raw |
| `0x0D06` | `input.kvm` | bool | draft | 是否支持 KVM |

---

## 19. 网络能力注册表

| capabilityId | name | 类型 | 状态 | 说明 |
|---:| --- |---| --- |---|
| `0x0E01` | `network.supported` | bool | draft | 是否支持网络配置 |
| `0x0E02` | `network.wifi` | bool | draft | 是否支持 Wi-Fi |
| `0x0E03` | `network.ethernet` | bool | draft | 是否支持以太网 |
| `0x0E04` | `network.ipv4` | bool | draft | 是否支持 IPv4 |
| `0x0E05` | `network.ipv6` | bool | draft | 是否支持 IPv6 |

---

## 20. 存储能力注册表

| capabilityId | name | 类型 | 状态 | 说明 |
|---:| --- |---| --- |---|
| `0x0F01` | `storage.supported` | bool | draft | 是否支持存储管理 |
| `0x0F02` | `storage.capacity` | uint64 | draft | 存储容量 |
| `0x0F03` | `storage.freeSpace` | uint64 | draft | 剩余空间 |
| `0x0F04` | `storage.format` | bool | draft | 是否支持格式化 |

---

## 21. 传感器能力注册表

| capabilityId | name | 类型 | 状态 | 说明 |
|---:| --- |---| --- |---|
| `0x1001` | `sensor.supported` | bool | draft | 是否支持传感器能力 |
| `0x1002` | `sensor.types` | bitmap | draft | 支持的传感器类型 |
| `0x1003` | `sensor.stream` | bool | draft | 是否支持传感器采样流 |

---

## 22. 认证能力注册表

| capabilityId | name | 类型 | 状态 | 说明 |
|---:| --- |---| --- |---|
| `0x1101` | `auth.supported` | bool | draft | 是否支持认证 |
| `0x1102` | `auth.token` | bool | draft | 是否支持 token |
| `0x1103` | `auth.permission` | bool | draft | 是否支持权限查询 |

---

## 23. 隐私能力注册表

| capabilityId | name | 类型 | 状态 | 说明 |
|---:| --- |---| --- |---|
| `0x1201` | `privacy.supported` | bool | draft | 是否支持隐私控制 |
| `0x1202` | `privacy.mode` | bool | draft | 是否支持隐私模式 |
| `0x1203` | `privacy.mask` | bool | draft | 是否支持隐私遮挡区域 |

---

## 24. Vendor Capability

厂商私有能力范围：`0x7000-0x7FFF`

规则：
- 不得覆盖标准 capabilityId
- 必须带 vendorId
- 必须带 capability name
- 必须带 type
- 必须声明是否影响互操作

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

## 25. Capability 查询方法

v1 Core 必须实现：

| methodId | methodName | 说明 |
|---:| --- |---|
| `0x0301` | `capability.supportedMethods` | 获取当前会话可调用 methodId 集合 |

v2/P1 建议后续实现：

| methodId | methodName | 说明 |
|---:| --- |---|
| `0x0302` | `capability.getAll` | 获取完整能力摘要 |
| `0x0303` | `capability.getDomain` | 获取指定 domain 能力 |
| `0x0304` | `capability.hasMethod` | 判断 methodId 是否支持 |
| `0x0305` | `capability.getLimits` | 获取协议和传输限制 |
| `0x0306` | `capability.hasEvent` | 判断 eventId 是否支持 |
| `0x0307` | `capability.getStreams` | 获取 Stream 能力 |
| `0x0308` | `capability.getFirmware` | 获取固件升级能力 |
| `0x0309` | `capability.negotiate` | 业务能力协商 |

---

## 26. capability.getAll 返回结构（v2/P1）

### 23.1 JSON 表达

```json
{
  "protocol": {
    "payloadTypes": ["CONTROL", "RPC", "STREAM"],
    "frameProfile": "COMPACT_FRAME",
    "frameVersion": 1,
    "frameCrcProfiles": { "STANDARD": "CRC16", "COMPACT": "CRC8" },
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
    "profiles": ["firmware.ota"],
    "maxChunkSize": 48,
    "resume": true,
    "chunkCrc32": true
  },
  "business": {
    "display": { "brightness": { "supported": true, "min": 0, "max": 100, "step": 1 } },
    "firmware": { "supported": true, "imageTypes": ["MCU_FIRMWARE"], "verify": ["CRC32", "SHA256"], "resume": true }
  }
}
```

### 23.2 TLV 表达

v2/P1 推荐返回摘要（复杂能力通过 `capability.getDomain` 查询）：

```text
capability.getAll.result
  protocol.payloadTypes / protocol.frameProfile
  transport.mtu / transport.maxFrameSize
  rpc.encodings / rpc.bodyEncodings
  stream.profiles
  display.brightness / firmware.supported
```

---

## 27. capability.getDomain 参数

参数：

| 字段 | fieldId | 类型 | 说明 |
| --- |---:| --- |---|
| domain | `0x01` | enum/string | 能力域 |

支持 domain：`protocol / transport / rpc / stream / device / display / camera / video / audio / file / firmware / log / diagnostic / input / network / storage / sensor / auth / privacy / vendor`

---

## 28. capability.hasMethod 参数与结果

参数：

| 字段 | fieldId | 类型 | 说明 |
| --- |---:| --- |---|
| methodId | `0x01` | uint16 | 方法 ID |

结果：

| 字段 | fieldId | 类型 | 说明 |
| --- |---:| --- |---|
| supported | `0x01` | bool | 是否支持 |
| reasonCode | `0x02` | uint16 | 不支持原因 |
| minFirmwareVersion | `0x03` | string | 最低固件版本 |

---

## 29. Capability 与 Method / Event / Stream 的关系

- Method Registry 表示协议定义了哪些方法；Capability 表示当前设备实际支持哪些方法
- Event Registry 表示协议定义了哪些事件；Capability 表示当前设备是否会上报该事件
- StreamProfile 存在不代表当前设备支持该 Stream；必须通过 `stream.profiles` capability 判断

---

## 30. 老协议适配

老协议能力（设备信息命令、能力矩阵命令、Feature bitmap、CmdValue 支持表）必须统一转换为 Capability Registry，不得继续让上层直接判断旧字段。

| 老协议能力 | AXTP capability | 说明 |
| --- |---| --- |
| `CmdValue 0xC0021 exists` | `video.supported = true` | 支持视频模式设置 |
| `AlphaUpgradeInfo exists` | `firmware.supported = true` | 支持升级 |
| `FeatureBitmap.bit0` | `display.brightness = true` | 支持亮度 |
| `FeatureBitmap.bit1` | `firmware.resume = true` | 支持续传 |

legacyMapping 字段：

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

## 31. MVP Capability 集合

MVP Capability 集合以 `standard/registry/capability_registry.yaml` 为事实源，采用单项能力或单项配置值表达。下列集合是当前 AXTP v1 MVP 合同。

| capabilityId | capabilityName | Type | 说明 |
|---:| --- |---| --- |
| `0x0001` | `protocol.payload.control` | bool | 支持 CONTROL payload |
| `0x0002` | `protocol.payload.rpc` | bool | 支持 RPC payload |
| `0x0003` | `protocol.payload.stream` | bool | 支持 STREAM payload |
| `0x0101` | `device.info` | bool | 支持 device.getInfo |
| `0x0301` | `capability.supportedMethods` | bool | 支持 capability.supportedMethods |
| `0x0601` | `display.brightness` | bool | 支持亮度控制 |
| `0x0602` | `display.brightnessMin` | uint16 | 最小亮度值 |
| `0x0603` | `display.brightnessMax` | uint16 | 最大亮度值 |
| `0x0604` | `display.brightnessStep` | uint16 | 亮度步进 |
| `0x0B01` | `firmware.ota` | object | 支持基于 STREAM 的 OTA |

---

## 32. Generator v1 校验规则

```text
CapabilityId 唯一性 / name 唯一性 / ID 范围合法性
status 合法性 / type 合法性
deprecated Capability 不得复用 ID
legacyMapping 指向合法 Capability
```
