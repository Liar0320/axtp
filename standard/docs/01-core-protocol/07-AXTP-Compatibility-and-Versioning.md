# 07《AXTP Compatibility and Versioning》

> Status: AXTP v1 Core Freeze Candidate
> Spec Version: 1.0.0-rc1
> Change Policy: Clarification-only before v1.0.0
> Scope: Core compatibility / versioning / legacy migration rules

版本：v1.0.0-rc1
状态：AXTP v1 Core Freeze Candidate
适用范围：USB HID、BLE、UART、TCP、WebSocket、旧 AXDP/Alpha/Beta/Common/CmdValue 类协议、旧 JSON-RPC/二进制 RPC/OTA/RawStream/LogStream 协议迁移

---

## 1. 文档目的

本文档定义旧协议迁移到 AXTP（Unified Transport Frame Protocol）的适配原则、映射规则、兼容模式和 MVP 实现路径。

本文档不重新设计 AXTP Core Protocol，而是回答以下落地问题：

```text
旧 HID / BLE / UART 协议如何接入 AXTP？
旧 CmdValue 如何映射为 AXTP methodId？
旧 JSON-RPC / BinaryRPC 如何映射为 AXTP RPC？
旧 Firmware / OTA / RawStream / LogStream 如何映射为 AXTP STREAM？
旧状态码如何映射为 AXTP ErrorCode？
旧能力表如何映射为 AXTP Capability Registry？
旧设备如何在不大改固件的情况下逐步兼容 AXTP？
```

---

## 2. 迁移总原则

### 2.1 不推翻旧协议

旧协议已经包含大量可复用资产：

```text
CmdValue
固定二进制 payload
设备能力表
升级协议
产测协议
日志协议
旧错误码
旧事件上报
```

AXTP 迁移的目标不是推翻旧协议，而是：

```text
保留旧协议语义
统一外层传输框架
统一 method / event / error / capability registry
统一新旧协议的 SDK 表达
```

### 2.2 新协议统一三类 PayloadType

AXTP v1 只保留三类顶层 PayloadType：

| PayloadType | 名称 | 旧协议映射方向 |
|---:| --- |---|
| `0x01` | `CONTROL` | 旧连接控制、ACK、NACK、心跳、恢复 |
| `0x02` | `RPC` | 旧 JSON-RPC、BinaryRPC、CmdValue 命令 |
| `0x03` | `STREAM` | 旧 OTA、文件块、日志流、RawStream、HID Raw |

旧协议中的业务类型不得继续膨胀为新的顶层 PayloadType。

例如：

```text
旧 Firmware Payload    -> AXTP STREAM / RPC 建流 profile = firmware.ota
旧 RawStream Payload   -> AXTP STREAM / RPC 建流 profile = media.video、sensor.sample 或 legacy.tunnel
旧 LogStream Payload   -> AXTP STREAM / RPC 建流 profile = log.realtime 或 log.bundle
旧 BinaryRPC Payload   -> AXTP RPC / rpcEncoding = BINARY
旧 JSON-RPC Payload    -> AXTP RPC / rpcEncoding = JSON
```

### 2.3 Header 不理解业务

AXTP Frame Header 只负责：

```text
Frame 边界
PayloadType
长度
分片
CRC
路由
```

它不负责：

```text
CmdValue
methodName
firmware
video
audio
log
diagnostic / factory test
display brightness
```

旧协议的业务语义必须下沉到：

```text
RPC.methodId
RPC.body
RPC 建流 profile
STREAM.streamId / seqId / cursor / data
Registry mapping
```

### 2.4 旧协议兼容优先采用 Adapter，不污染 AXTP Core

不建议为了兼容旧协议修改 AXTP Frame Header。  
推荐新增：

```text
Legacy Adapter Layer
```

位置如下：

```text
Application / SDK
    ↓
AXTP RPC / STREAM API
    ↓
Legacy Adapter Layer
    ↓
Old HID / Old BLE / Old UART Protocol
```

或者：

```text
Old App / Old Host
    ↓
Legacy Protocol
    ↓
Device Legacy Adapter
    ↓
AXTP Core Runtime
```

---

## 3. 迁移架构

### 3.1 推荐架构

```text
+--------------------------------------------------+
| Business API                                     |
| device.getInfo / display.setBrightness / firmware.begin |
+--------------------------------------------------+
| AXTP Registry                                    |
| MethodId / EventId / ErrorCode / Capability      |
+--------------------------------------------------+
| AXTP RPC / STREAM                                |
| requestId / methodId / profile / streamId / data |
+--------------------------------------------------+
| Legacy Adapter                                   |
| CmdValue / Old Payload / Old Status / Old ACK    |
+--------------------------------------------------+
| Old Transport                                    |
| HID / BLE / UART / Vendor Frame                  |
+--------------------------------------------------+
```

### 3.2 Adapter 的职责

Legacy Adapter 负责：

```text
1. 识别旧协议包（协议嗅探，见 §3.3）
2. 解析旧 CmdValue / Payload / Status
3. 查 legacy_mapping.yaml
4. 转换为 AXTP methodId / params / result / errorCode
5. 对 STREAM 数据转换 profile 建流关系与 streamId / seqId / cursor / data
6. 保留无法结构化的旧字段到 legacy.* 扩展字段
```

Adapter 不负责：

```text
1. 修改 AXTP Header
2. 新增业务 PayloadType
3. 绕过 Registry 直接调用业务逻辑
4. 在 C++ 代码中硬编码大量旧协议分支
```

---

### 3.3 协议嗅探（Protocol Sniffing）

当设备固件升级为 AXTP 后，旧版 App 仍可能通过 BLE/HID 连接。设备端必须在收到第一个字节时即判断协议类型，不得等待超时。

**Standard Frame 判定（TCP/WebSocket Binary/USB Bulk）：**

```cpp
bool isAxtpStandardFrame(const uint8_t* buf, size_t len) {
    if (len < 2) return false;
    return buf[0] == 0x41 && buf[1] == 0x58; // Magic: 'A' 'X'
}

void dispatchFrame(const uint8_t* buf, size_t len) {
    if (isAxtpStandardFrame(buf, len)) {
        axtpParser.feed(buf, len);
    } else {
        legacyAdapter.feed(buf, len);
    }
}
```

**Compact Frame 判定（BLE/HID/UART）：**

Compact Frame 无 Magic，依赖传输层帧边界。判定策略：

1. 读取第一个字节 `VT`，高 4 bit 为 Version，低 4 bit 为 PayloadType
2. 若 Version == `0x01` 且 PayloadType ∈ `{0x01, 0x02, 0x03}`，视为 AXTP Compact Frame
3. 否则抛给 Legacy Adapter

```cpp
bool isAxtpCompactFrame(uint8_t firstByte) {
    uint8_t version     = (firstByte >> 4) & 0x0F;
    uint8_t payloadType = firstByte & 0x0F;
    return version == 0x01 && payloadType >= 0x01 && payloadType <= 0x03;
}
```

**原则**：嗅探逻辑必须是无状态的 O(1) 判定，不得引入缓冲区等待。判定失败即走 Legacy 路径，不得丢弃数据。

---

## 4. 旧 CmdValue 到 AXTP MethodId 的映射

### 4.1 不建议直接把所有 CmdValue 当作 methodId

旧协议中的 `CmdValue` 很像 AXTP 的 `methodId`，但存在几个风险：

```text
1. 旧 CmdValue 可能超过 uint16 范围
2. 不同旧协议域可能存在编号冲突
3. 旧命名可能不符合 AXTP domain.method 规范
4. 旧 CmdValue 中可能混入版本、设备族、方向位
5. 旧协议可能没有 requestId / eventId / errorCode 的统一语义
```

因此，AXTP 不要求直接复用旧 CmdValue 作为线上 `methodId`。

### 4.2 推荐策略：新 methodId + legacyCmdValue

推荐采用双字段映射：

```text
AXTP methodId:        uint16，进入正式 MethodId Registry
legacyCmdValue:       uint32，保留旧协议命令号
legacyProtocol:       enum，标识旧协议来源
legacyDomain:         enum/string，标识 Alpha / Beta / Common / Vendor
```

示例：

```yaml
- methodId: 0x0706
  methodName: video.setMode
  domain: video
  status: mvp
  legacy:
    protocol: AXDP_HID
    domain: Common
    cmdValue: 0x000C0021
    oldName: CommonSetVideoMode
```

这样做的好处：

```text
1. AXTP methodId 保持稳定、紧凑、可生成 SDK
2. 老协议 CmdValue 完整保留，不丢失历史兼容信息
3. 多套旧协议可映射到同一个新 method
4. 同一个新 method 可根据设备 capability 选择不同 legacy backend
```

### 4.3 允许直接复用 CmdValue 的条件

只有同时满足以下条件，才允许直接复用旧 CmdValue 作为 `methodId`：

```text
1. CmdValue <= 0xFFFF
2. 无跨域冲突
3. 命令语义清晰稳定
4. 未来不会与 AXTP MethodId 分段规划冲突
5. 已经在 method_registry.yaml 中声明为 stable
```

否则必须使用：

```text
new methodId + legacy.cmdValue
```

---

## 5. 旧协议域到 AXTP Domain 的映射

### 5.1 Alpha / Beta / Common 收敛原则

旧协议可能按设备族或历史阶段划分为：

```text
Alpha
Beta
Common
Vendor
```

AXTP 不建议继续把这些作为业务方法一级域。  
它们应该变成兼容属性，而不是 methodName 的前缀。

错误示例：

```text
alpha.getUpgradeInfo
beta.getDeviceInfo
common.setVideoMode
```

推荐示例：

```text
firmware.getInfo
firmware.begin
firmware.verify
device.getInfo
video.setMode
display.setBrightness
```

对应旧协议来源写入 legacy 字段：

```yaml
legacy:
  protocol: AXDP_HID
  domain: Alpha
  cmdValue: 0x000A0001
  oldName: AlphaUpgradeInfo
```

### 5.2 Domain 映射表

| 旧协议域 / 类型 | AXTP Domain | 说明 |
| --- |---| --- |
| Alpha Upgrade | `firmware.*` | 升级、镜像、校验、回滚 |
| Beta Device | `device.*` | 设备信息、版本、状态 |
| Common Video | `video.*` | 视频模式、分辨率、帧率、编码 |
| Common Display | `display.*` | 屏幕、电源、输入源、布局 |
| Common Brightness | `display.*` | 亮度、自动亮度、范围 |
| Factory / Production Test | `diagnostic.*` | 产测、自检、报告、指标 |
| HID Raw / KVM | `input.*` + `profile=control.hid_raw` | 低频走 RPC，高频走 STREAM |
| OTA Chunk | `firmware.*` + `profile=firmware.ota` | 控制面 RPC，数据面 STREAM |
| Log Stream | `log.*` + `profile=log.realtime` | 控制面 RPC，数据面 STREAM |
| File Transfer | `file.*` + `profile=file.upload/file.download` | 控制面 RPC，数据面 STREAM |
| Vendor Private | `vendor.*` | 厂商扩展 |

---

## 6. 旧 JSON-RPC 到 AXTP RPC 的映射

### 6.1 Unframed 旧 JSON-RPC

旧 JSON-RPC 示例（迁移前）：

```json
{
  "jsonrpc": "2.0",
  "id": 1001,
  "method": "device.getStatus",
  "params": {}
}
```

迁移为 AXTP DS-RPC 格式：

```json
{
  "sid": "28378462323",
  "op": 7,
  "d": {
    "id": "000003e9",
    "method": "GetDeviceStatus",
    "params": {}
  }
}
```

迁移时，有两种模式。两种模式的边界必须严格区分：DS-RPC Text Profile 可以通过 Adapter 接收旧 JSON-RPC object；Framed AXTP RPC 不得把完整 JSON-RPC envelope 作为新的 wire payload。

#### 模式 A：WebSocket Text / HTTP 调试模式

可继续保持 Unframed JSON-RPC 作为 Legacy/Debug 输入：

```text
Transport = WebSocket Text / HTTP
Frame Header = none
Input        = legacy JSON-RPC request object
Output       = DS-RPC Text Profile object 或 Adapter 调用结果
```

适合：

```text
调试工具
浏览器
本地开发
Mock Server
```

#### 模式 B：Framed AXTP RPC

使用 AXTP Frame 承载映射后的 AXTP RPC，不承载 JSON-RPC envelope：

```text
AXTP Frame Header
  payloadType = RPC

RPC Payload
  rpcEncoding = JSON
  rpcOp       = REQUEST
  requestId   = 0x000003e9
  methodId    = registry(device.getStatus)
  bodyEncoding = JSON
  body        = 旧 JSON-RPC params/result 对象，不包含 jsonrpc/id/method 外壳
```

迁移器必须丢弃或映射旧 envelope 字段：

| 旧 JSON-RPC 字段 | AXTP v1 位置 |
| --- |---|
| `jsonrpc` | 丢弃；仅用于识别 Legacy 输入 |
| `id` | `requestId` |
| `method` | `method_registry.yaml -> methodId` |
| `params` | RPC body |
| `result` | RPC response body |
| `error` | RPC statusCode + error body |

### 6.2 JSON method 到 methodId

映射规则：

```text
JSON methodName -> method_registry.yaml -> methodId
```

示例：

```yaml
- methodId: 0x0105
  methodName: device.getStatus
  domain: device
  jsonrpc:
    method: device.getStatus
```

---

## 7. 旧 BinaryRPC 到 AXTP RPC 的映射

### 7.1 旧 BinaryRPC 结构

旧 BinaryRPC 可能包含：

```text
rpcId
methodId / CmdValue
rpcFlags
metadataLength
dataLength
metadata
data
```

迁移为 AXTP 后：

```text
旧 rpcId              -> AXTP requestId
旧 methodId/CmdValue  -> AXTP methodId + legacyCmdValue
旧 rpcFlags           -> AXTP rpcOp / rpcFlags
旧 metadata           -> AXTP TLV body 或 params
旧 data               -> AXTP body 或 STREAM data
旧 status             -> AXTP errorCode / statusCode
```

### 7.2 RPC 与 STREAM 的拆分规则

如果旧 BinaryRPC 携带的是结构化小参数：

```text
亮度设置
设备信息查询
模式设置
状态查询
```

映射为：

```text
payloadType = RPC
rpcEncoding = BINARY
bodyEncoding = TLV8
```

如果旧 BinaryRPC 携带的是大块数据：

```text
固件 chunk
文件 chunk
日志 blob
图片帧
HID raw report 高频流
```

映射为：

```text
payloadType = STREAM
```

不得把大块数据继续长期放在 RPC body 中。

---

## 8. 旧 Firmware / OTA 协议迁移

### 8.1 迁移目标

旧固件升级协议通常包含：

```text
begin
write / chunk
end
verify
apply
abort
resume
transferId
seqId
offset
totalLength
chunkLength
chunkCrc32
```

AXTP 的迁移目标：

```text
RPC 控制 OTA 流程
STREAM 承载 OTA chunk
CONTROL ACK/NACK 负责可靠传输
CRC32 / SHA256 负责 chunk 或镜像级完整性
```

### 8.2 旧 Firmware method 到 AXTP method

| 旧语义 | AXTP method | PayloadType |
| --- |---| --- |
| firmware.begin / upgrade.start | `firmware.begin` | RPC |
| firmware.write / writeChunk | `STREAM OTA chunk` | STREAM |
| firmware.end | `firmware.end` | RPC |
| firmware.verify | `firmware.verify` | RPC |
| firmware.apply | `firmware.apply` | RPC |
| firmware.abort | `firmware.abort` | RPC |
| firmware.resume | `firmware.resume` | RPC |
| firmware.getProgress | `firmware.getProgress` | RPC |

### 8.3 OTA Chunk 字段映射

| 旧字段 | AXTP 字段 | 位置 |
| --- |---| --- |
| `transferId` | `transferId` | STREAM Header / metadata |
| `seqId` | `seqId` | STREAM Header |
| `offset` | `offset` | STREAM Header / metadata |
| `totalLength` | `totalLength` | firmware.begin result 或 STREAM metadata |
| `chunkLength` | `dataLength` | STREAM Header |
| `chunkCrc32` | `chunkCrc32` | STREAM metadata |
| `imageType` | `imageType` | STREAM metadata |
| `sha256` | `imageHash` | firmware.begin / verify |

### 8.4 OTA ACK/NACK 映射

旧 ACK/NACK 映射为 AXTP Control：

```text
payloadType = CONTROL
opcode = ACK / NACK
targetType = STREAM_CHUNK
streamId / transferId
seqId
offset
reasonCode
```

---

## 9. 旧 RawStream / Media / Sensor 迁移

### 9.1 RawStream 迁移规则

旧 RawStream：

```text
streamId
streamType
seqId
timestamp
flags
dataLength
data
```

AXTP STREAM：

```text
streamId
seqId
cursor
data
```

映射表：

| 旧 streamType | AXTP Stream Profile（RPC 建流协商） | 说明 |
| --- |---| --- |
| `raw.audio` | `media.audio`（通过 RPC audio.startCapture 协商） | cursorUnit=timestampUs |
| `raw.video` | `media.video`（通过 RPC video.startPreview 协商） | cursorUnit=timestampUs |
| `raw.sensor` | `sensor.sample`（通过 RPC sensor.startStream 协商） | cursorUnit=sampleIndex |
| `raw.custom` | `vendor.private`（通过 RPC stream.open 协商） | 厂商自定义 |

### 9.2 Media 不进入 PayloadType

错误迁移：

```text
payloadType = VIDEO
payloadType = AUDIO
```

正确迁移：

```text
payloadType = STREAM
  （profile 由 RPC video.startPreview / audio.startCapture 建流时协商，
   绑定到 streamId，不在 STREAM L2 Header 中）
```

---

## 10. 旧 LogStream 迁移

### 10.1 LogStream 字段映射

旧 LogStream：

```text
streamId
seqId
timestamp
level
moduleId
encoding
messageLength
message
```

AXTP：

```text
payloadType = STREAM
  （profile=log.realtime 由 RPC log.startStream 建流时协商，绑定到 streamId）
streamId
seqId
cursor  （timestampUs）
data:   log bytes
```

### 10.2 日志控制命令

日志控制命令走 RPC：

```text
log.setLevel
log.getLevel
log.startStream
log.stopStream
log.export
log.clear
```

日志数据走 STREAM：

```text
RPC log.startStream -> profile=log.realtime -> streamId
STREAM packet -> streamId / seqId / cursor / data
```

---

## 11. 旧 FileTransfer 迁移

### 11.1 控制面映射

| 旧语义 | AXTP method | PayloadType |
| --- |---| --- |
| open file | `file.open` | RPC |
| read file | `file.read` 或 `file.beginTransfer` | RPC |
| write file | `file.write` 或 `file.beginTransfer` | RPC |
| close file | `file.close` | RPC |
| delete file | `file.delete` | RPC |
| list file | `file.list` | RPC |
| verify file | `file.verify` | RPC |

### 11.2 数据面映射

```text
payloadType = STREAM
  （profile=file.upload/file.download 由 RPC file.beginTransfer 建流时协商，绑定到 streamId）
```

---

## 12. 旧 HID Raw / KVM / 输入控制迁移

### 12.1 拆分原则

低频输入控制：

```text
input.sendKey
input.sendMouse
input.sendTouch
input.sendHidReport
```

可走：

```text
payloadType = RPC
```

高频输入流：

```text
keyboard raw stream
mouse raw stream
hid raw report stream
touch raw stream
kvm input stream
```

应走：

```text
payloadType = STREAM
  （profile=control.hid_raw 由 RPC input.openKvm 建流时协商，绑定到 streamId）
```

### 12.2 不建议把 KVM 当成普通 RPC 长期传输

KVM / HID Raw 高频数据具有连续性和低延迟要求。  
如果全部走 RPC，会产生：

```text
requestId 开销过大
响应模型不自然
延迟抖动增加
队列阻塞
```

因此推荐：

```text
RPC 负责 openKvm / closeKvm / setKvmMode
STREAM 负责 HID raw data
CONTROL 负责 ACK/NACK / WINDOW_UPDATE
```

---

## 13. 旧 Capability 表迁移

### 13.1 迁移目标

旧设备能力表通常描述：

```text
设备支持哪些命令
支持哪些固件升级能力
支持哪些视频/音频/显示能力
支持哪些产测能力
支持哪些传输方式
支持哪些 HID/BLE report
```

AXTP 拆成两类能力：

```text
协议能力：通过 CONTROL OPEN/ACCEPT 协商
业务能力：通过 capability.* RPC 查询
```

### 13.2 协议能力映射

| 旧能力 | AXTP capability / control TLV |
| --- |---|
| max report size | `maxFrameSize` / `maxPayloadSize` |
| BLE MTU | `mtu` |
| 是否支持 ACK | `ackMode` |
| 是否支持分片 | `fragmentation` |
| 是否支持压缩 | `compression` |
| 是否支持加密 | `encryption` |
| 是否支持 JSON | `rpcEncoding.JSON` |
| 是否支持二进制 | `rpcEncoding.BINARY` |

### 13.3 业务能力映射

| 旧能力 | AXTP capability |
| --- |---|
| 支持命令列表 | `capability.supportedMethods` / `supportedMethods` |
| 支持事件列表 | `supportedEvents` |
| 支持升级 | `firmware.supported` |
| 支持断点续传 | `firmware.resumeSupported` |
| 支持亮度范围 | `display.brightnessMin / display.brightnessMax / display.brightnessStep` |
| 支持视频模式 | `video.modes` |
| 支持日志导出 | `log.exportSupported` |
| 支持产测 | `diagnostic.supportedTests` |

---

## 14. 旧错误码 / 状态码迁移

### 14.1 映射原则

旧协议可能存在：

```text
0 = success
1 = fail
2 = busy
3 = invalid parameter
4 = timeout
vendor-specific status
```

AXTP 必须映射为统一 `ErrorCode`：

```text
RPC response.statusCode
CONTROL statusCode / reasonCode
STREAM NACK reasonCode
```

### 14.2 默认映射表

| 旧状态 | AXTP ErrorCode | 说明 |
|---:|---:| --- |
| `0` | `0x0000 SUCCESS` | 成功 |
| `1` | `0x0001 UNKNOWN_ERROR` | 通用失败 |
| `2` | `0x0005 BUSY` | 设备忙 |
| `3` | `0x030B RPC_PARAM_INVALID` | 参数错误 |
| `4` | `0x0006 TIMEOUT` | 超时 |
| `5` | `0x0306 RPC_METHOD_NOT_FOUND` | 命令不支持 |
| `6` | `0x0408 STREAM_SEQ_INVALID` | 分块序号错误 |
| `7` | `0x060B FW_VERIFY_FAILED` | 固件校验失败 |
| `>= 0x80` | `0x7000+ VENDOR_ERROR` | 厂商私有 |

### 14.3 保留旧错误详情

转换后仍应保留旧状态：

```yaml
error:
  code: 0x030B
  name: RPC_PARAM_INVALID
  legacy:
    status: 3
    rawStatus: 0x03
    message: "old invalid parameter"
```

---

## 15. 旧事件迁移

### 15.1 旧事件分类

旧事件通常来源于：

```text
主动上报 command
notification packet
interrupt report
state changed packet
log event
factory test event
```

AXTP 统一映射为：

```text
payloadType = RPC
rpcOp = EVENT
methodOrEventId = eventId
bodyEncoding = TLV8 / JSON
```

### 15.2 高频事件例外

如果旧事件是高频连续数据，例如：

```text
sensor sample
hid report
video frame
log line
```

应映射为：

```text
payloadType = STREAM
```

而不是 RPC EVENT。

---

## 16. 旧协议帧封装策略

### 16.1 Native AXTP 模式

设备固件已支持 AXTP：

```text
Host -> AXTP Frame -> Device
```

特点：

```text
最佳长期方案
Registry 直接驱动 SDK
不需要旧协议透传
```

### 16.2 Adapter 模式

设备固件暂不支持 AXTP，由 Host 或 Gateway 转换：

```text
Host AXTP API
  ↓
Legacy Adapter
  ↓
Old HID/BLE Frame
  ↓
Old Device
```

特点：

```text
适合 MVP
设备固件改动小
可快速验证 Method/Event/Error/Capability Registry
```

### 16.3 Tunnel 模式

临时透传旧协议包：

```text
RPC 建流请求:
  profile = legacy.tunnel
  legacyProtocol = AXDP_HID
  legacyCmdValue = xxx

STREAM packet:
  streamId
  seqId
  cursor
  data = old raw packet
```

Tunnel 模式仅用于：

```text
调试
灰度迁移
未完成解析的旧命令
厂商私有保底通道
```

不得作为长期主路径。

---

## 17. 兼容协商

### 17.1 CONTROL OPEN 中声明兼容能力

建议在 CONTROL OPEN / ACCEPT 中加入以下 TLV：

| 字段 | 类型 | 说明 |
| --- |---| --- |
| `legacySupported` | bitmap | 支持哪些旧协议 |
| `legacyMode` | enum | native / adapter / tunnel / dual_stack |
| `legacyVersion` | string/uint16 | 旧协议版本 |
| `legacyMaxPacketSize` | uint16 | 旧协议最大包 |
| `legacyCmdNamespace` | enum | CmdValue 命名空间 |

示例：

```yaml
control.helloAck:
  legacySupported:
    - AXDP_HID
    - OLD_BINARY_RPC
  legacyMode: adapter
  legacyVersion: 0x0102
  legacyMaxPacketSize: 64
```

### 17.2 Capability 中声明业务兼容能力

业务层通过 RPC 查询：

```text
capability.getAll
capability.getDomain
capability.hasMethod
capability.supportedMethods
```

返回：

```yaml
legacyMappings:
  - methodId: 0x0101
    methodName: device.getInfo
    legacyCmdValue: 0x000B0002
    legacyName: BetaDeviceInfo
```

---

## 18. legacy_mapping.yaml 规范

### 18.1 文件目的

`legacy_mapping.yaml` 是老协议迁移的核心文件。  
它描述：

```text
旧协议命令号
旧协议名称
旧 payload 格式
新 methodId
新 methodName
新 params/result schema
错误码映射
能力映射
实现状态
```

### 18.2 顶层结构

```yaml
version: 1
protocols:
  - id: AXDP_HID
    name: AXDP HID Legacy Protocol
    cmdValueType: uint32
    byteOrder: little_endian
    transport:
      - HID
      - BLE

mappings:
  - legacy:
      protocol: AXDP_HID
      domain: Common
      cmdValue: 0x000C0021
      oldName: CommonSetVideoMode
    axtp:
      methodId: 0x0706
      methodName: video.setMode
      payloadType: RPC
      rpcEncoding: BINARY
      bodyEncoding: TLV
    schemas:
      request: VideoSetModeRequest
      response: CommonResult
    errors:
      statusField: status
      mappingTable: legacy_status_default
    status: mvp
```

### 18.3 必填字段

| 字段 | 必填 | 说明 |
| --- |---| --- |
| `legacy.protocol` | 是 | 旧协议名称 |
| `legacy.cmdValue` | 是 | 旧命令号 |
| `legacy.oldName` | 建议 | 旧命令名 |
| `axtp.methodId` | 是 | 新 MethodId |
| `axtp.methodName` | 是 | 新方法名 |
| `axtp.payloadType` | 是 | RPC 或 STREAM |
| `schemas.request` | 建议 | 请求 Schema |
| `schemas.response` | 建议 | 响应 Schema |
| `status` | 是 | draft / mvp / stable / deprecated |

---

## 19. 旧固定结构 Payload 到 TLV Schema 的映射

### 19.1 固定结构保留策略

旧协议常使用固定结构，例如：

```text
byte0 = mode
byte1 = flags
byte2 = value
```

迁移有两种方式。

#### 方式 A：转为 AXTP TLV

```text
old byte0 -> fieldId 0x01 mode
old byte1 -> fieldId 0x02 flags
old byte2 -> fieldId 0x03 value
```

适合：

```text
新 SDK
新设备
需要字段演进
需要跨语言解析
```

#### 方式 B：RAW_BYTES 透传（短期兼容）

```text
bodyEncoding = RAW_BYTES
schema = LegacyCommonSetVideoModeRawBytes
```

适合：

```text
强兼容
极低带宽
固件不方便改动
```

MVP 推荐：

```text
对新方法使用 TLV8
对旧命令短期允许 RAW_BYTES
但必须登记 legacyMapping 和兼容 schema
```

### 19.2 字段映射示例

```yaml
schemas:
  LegacyCommonSetVideoModeRawBytes:
    encoding: RAW_BYTES
    fields:
      - name: mode
        offset: 0
        type: uint8
      - name: flags
        offset: 1
        type: uint8

  VideoSetModeRequest:
    encoding: TLV
    fields:
      - id: 0x01
        name: mode
        type: enum
        enum: VideoMode
      - id: 0x02
        name: flags
        type: bitmap
```

---

## 20. 迁移阶段

### 20.1 Phase 0：盘点旧协议

产物：

```text
legacy_inventory.xlsx / yaml
```

需要盘点：

```text
CmdValue
命令名
方向 request/response/event
payload 格式
状态码
所属设备族
是否高频
是否大块数据
是否用于 OTA / 日志 / 产测
```

### 20.2 Phase 1：MVP Adapter

目标：不改设备固件，先让新 SDK 通过 Adapter 调旧设备。

必须支持：

```text
device.getInfo
capability.getAll
display.getBrightness
display.setBrightness
firmware.begin
STREAM OTA chunk
firmware.verify
IDENTIFY.eventSubscriptions
REIDENTIFY.eventSubscriptions
```

### 20.3 Phase 2：Dual Stack

设备同时支持：

```text
旧协议
AXTP Native
```

Host 通过 OPEN / capability 判断使用哪一路。

### 20.4 Phase 3：Native AXTP

设备主路径切换到 AXTP：

```text
旧协议只保留维护模式
新功能只进入 AXTP Registry
```

### 20.5 Phase 4：Deprecate Legacy

旧协议命令进入：

```text
deprecated
reserved
removed from default SDK
```

但不得复用旧编号。

---

## 21. Generator 对迁移的要求

Generator v1 必须读取：

```text
method_registry.yaml
event_registry.yaml
error_code.yaml
capability_registry.yaml
legacy_mapping.yaml
schema/*.yaml
```

并生成：

```text
C++ MethodId enum
C++ LegacyCmdValue enum
C++ legacy mapping table
C++ error mapping table
Markdown migration table
JSON test vectors
Adapter skeleton
```

### 21.1 C++ 输出示例

```cpp
enum class MethodId : uint16_t {
    DeviceGetInfo = 0x0101,
    VideoSetMode = 0x0706,
};

enum class LegacyProtocol : uint16_t {
    AXDP_HID = 0x0001,
};

struct LegacyMethodMapping {
    LegacyProtocol protocol;
    uint32_t legacyCmdValue;
    MethodId methodId;
    const char* methodName;
};

static constexpr LegacyMethodMapping kLegacyMethodMappings[] = {
    {LegacyProtocol::AXDP_HID, 0x000C0021, MethodId::VideoSetMode, "video.setMode"},
};
```

---

## 22. C++ Adapter 实现要求

### 22.1 最小接口

```cpp
class LegacyAdapter {
public:
    bool DecodeLegacyPacket(const uint8_t* data, size_t len, AxtpMessage& out);
    bool EncodeLegacyPacket(const AxtpMessage& in, std::vector<uint8_t>& out);
    bool MapLegacyError(uint32_t legacyStatus, AxtpErrorCode& out);
    bool FindMethodByCmdValue(uint32_t cmdValue, MethodId& out);
};
```

### 22.2 解码流程

```text
1. Parse old frame
2. Extract legacy protocol / cmdValue / payload / status
3. Lookup legacy_mapping.yaml generated table
4. Convert cmdValue -> methodId
5. Convert old payload -> TLV8 schema or RAW_BYTES legacy body
6. Convert old status -> AXTP ErrorCode
7. Output AxtpMessage
```

### 22.3 编码流程

```text
1. Receive AXTP methodId + params
2. Lookup legacy mapping
3. Convert TLV params -> old payload
4. Pack old frame
5. Send via old transport
```

---

## 23. MVP 必须迁移的旧协议能力

MVP 阶段只迁移最小闭环，不要求覆盖所有旧命令。

### 23.1 必须迁移的 RPC 命令

| AXTP method | 说明 |
| --- |---|
| `device.getInfo` | 验证旧设备信息查询 |
| `device.getStatus` | 验证状态查询 |
| `capability.getAll` | 验证旧能力表转换 |
| `display.getBrightness` | 验证简单查询 |
| `display.setBrightness` | 验证简单设置 |
| `firmware.begin` | 验证 OTA 控制面 |
| `firmware.verify` | 验证 OTA 校验 |
| `IDENTIFY.eventSubscriptions` | 验证初始事件订阅 |
| `REIDENTIFY.eventSubscriptions` | 验证事件订阅更新 |

### 23.2 必须迁移的 Stream Profile

| profileName | 说明 |
| --- |---|
| `firmware.ota` | 固件 chunk |
| `log.realtime` | 可选，调试阶段建议支持 |
| `control.hid_raw` | 可选，仅当 MVP 包含 HID Raw / KVM |

### 23.3 必须迁移的错误码

```text
OK
FAILED
BUSY
RPC_PARAM_INVALID
RPC_METHOD_NOT_FOUND
TIMEOUT
FRAME_CRC_ERROR
STREAM_SEQ_INVALID
FW_VERIFY_FAILED
LEGACY_UNSUPPORTED_CMD
LEGACY_PAYLOAD_PARSE_FAILED
```

---

## 24. 测试向量要求

迁移文档必须配套测试向量。

### 24.1 必须提供的测试向量

```text
legacy_device_get_info_request.hex
legacy_device_get_info_response.hex
axtp_device_get_info_request.hex
axtp_device_get_info_response.hex
legacy_display_brightness_set_request.hex
axtp_display_brightness_set_request.hex
legacy_status_to_axtp_error.json
legacy_ota_chunk_to_axtp_stream.hex
legacy_event_to_axtp_event.hex
```

### 24.2 对比测试

每条迁移测试都必须验证：

```text
旧请求 -> AXTP 请求
AXTP 请求 -> 旧请求
旧响应 -> AXTP 响应
旧错误 -> AXTP ErrorCode
旧事件 -> AXTP Event
旧大块数据 -> AXTP STREAM
```

---

## 25. 验收标准

本迁移规范达到 MVP 可落地状态，必须满足：

```text
1. legacy_mapping.yaml 能描述至少 8 个 MVP method
2. Generator 能生成 C++ legacy mapping table
3. C++ Demo 能通过 Adapter 调用旧 device.getInfo
4. C++ Demo 能通过 Adapter 调用旧 display.setBrightness
5. C++ Demo 能把旧 OTA chunk 映射为 AXTP STREAM OTA
6. 旧 status 能映射为 AXTP ErrorCode
7. 旧事件能映射为 AXTP RPC EVENT
8. 旧协议不要求修改 AXTP Core Header
9. 新功能默认注册到 AXTP Registry，不再新增旧协议命令
```

---

## 26. 与其他文档的关系

| 文档 | 关系 |
| --- |---|
| `02-AXTP-Frame-and-Payload-Spec.md` | 定义 Frame / PayloadType / Profile |
| `04-AXTP-Control-Session-Spec.md` | 定义 OPEN / ACK / NACK / RESUME |
| `05-AXTP-RPC-Session-Spec.md` | 定义 RPC request/response/event 映射 |
| `06-AXTP-Stream-Spec.md` | 定义 OTA / File / Log / Media 数据面 |
| `02-type-system/01-AXTP-Type-System基础类型规范.md` | 定义基础类型（待创建） |
| `02-type-system/02-AXTP-TLV-Schema编码规范.md` | 定义 TLV body 映射（待创建） |
| `08-AXTP-Protocol-Definition-Mapping-Spec.md` | 定义 Protocol Definition 映射规则 |
| `09-AXTP-Methods-Registry-Spec.md` | 定义 methods 元模型与 methodId 约束 |
| `11-AXTP-Errors-Registry-Spec.md` | 定义 errors 元模型与错误码映射 |
| `12-AXTP-Types-and-Capability-Spec.md` | 定义 types 元模型与 v1 capability 范围 |
| `13-AXTP-Profiles-Registry-Spec.md` | 定义 profiles 元模型与实现范围 |

---

## 27. 总结

AXTP 老协议迁移的核心不是把旧协议逐字节搬进新协议，而是建立一层稳定的兼容映射：

```text
旧 CmdValue        -> AXTP methodId + legacyCmdValue
旧 Payload         -> AXTP TLV8 Schema / RAW_BYTES legacy body
旧 Status          -> AXTP ErrorCode
旧 Event           -> AXTP EventId
旧 Capability      -> AXTP Capability Registry
旧 Firmware Chunk  -> AXTP STREAM + profile=firmware.ota
旧 RawStream       -> AXTP STREAM + profile=media.video / sensor.sample / control.hid_raw
旧 LogStream       -> AXTP STREAM + profile=log.realtime
```

最终目标：

```text
旧设备可继续工作
新 SDK 使用统一 AXTP API
Registry 成为唯一事实源
Generator 生成映射代码
C++ Demo 可以跑通旧协议兼容链路
新功能不再回到旧协议体系扩展
```
