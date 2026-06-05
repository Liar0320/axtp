# 07《AXTP Compatibility and Versioning》

> Status: AXTP v1 Core Freeze Candidate
> Spec Version: 1.0.0-rc1
> Change Policy: Clarification-only before v1.0.0
> Scope: Core compatibility / versioning / legacy migration rules

版本：v1.0.0-rc1
状态：AXTP v1 Core Freeze Candidate
适用范围：AXTP v1 wire format freeze 规则、版本策略、USB HID、TCP、WebSocket JSON、旧 AXDP/Alpha/Beta/Common/CmdValue 类协议、旧 JSON-RPC/二进制 RPC/固件更新/RawStream/LogStream 协议迁移

---

## 速读：兼容与迁移先看这里

本文件解决两个问题：哪些 AXTP 线格式已经冻结，以及旧协议怎么迁移到 AXTP。迁移时优先保持 AXTP Core 干净，不把旧业务类型塞进 Frame Header，也不新增 PayloadType。

迁移模式快速决策：

| 模式 | 何时使用 | 做法 | 不做的事 |
|---|---|---|---|
| Native AXTP | 新固件、新 App 或可同步升级的链路 | 直接使用 AXTP method/event/error/schema/stream profile | 不保留旧 wire envelope |
| Adapter | 旧设备或旧 App 仍需共存 | 在边界层解析旧 CmdValue / Payload，再映射到 AXTP RPC / STREAM | 不污染 AXTP Frame Header，不复用业务类型为 PayloadType |
| Tunnel | 短期无法拆解的私有数据或诊断链路 | 用 RAW_BYTES 或 vendor/profile 明确标注透传 | 不作为长期主协议设计 |

迁移检查清单：

```text
1. 判断入口：旧协议 sniffing、独立端口、URL path 或 transport profile。
2. 映射控制面：旧 CmdValue / JSON method -> AXTP methodId。
3. 映射数据面：firmware.update / file.transfer / media stream 数据块 -> RPC 建流 + STREAM data。
4. 映射状态：旧 status/error -> AXTP ErrorCode 或 RPC Response status。
5. 映射能力：旧 capability bits -> domain.feature capability 或 supportedMethods bitmap。
6. 固化事实：长期事实进入 registry YAML，临时兼容进入 legacy_mapping.yaml。
```

任何迁移都必须遵守 v1 冻结事实：Standard Frame Header 12B、CONTROL 5B、RPC Binary 11B、STREAM 16B、PayloadType 仅 CONTROL / RPC / STREAM。

---

## 0. Wire Format Freeze Rules

本节定义 AXTP v1 Core 的线格式冻结规则。所有实现必须遵守，所有后续扩展必须在此约束内进行。

### 0.1 已冻结的线格式

以下线格式在 v1.0.0 发布后不得修改：

| 对象 | 规范归属 | 冻结内容 |
|---|---|---|
| Standard L1 Frame Header | 02 §4 | 12B 固定布局，字段顺序/长度/语义不变 |
| Standard CRC | 02 §7 | CRC16-CCITT-FALSE，覆盖 Header(12B)+Payload |
| Control L2 Payload Header | 04 §2.1 | 5B 固定头：opcode/controlId/statusCode |
| RPC Binary L2 Payload Header | 05 §19.1 | 11B 固定头：rpcEncoding/rpcOp/requestId/methodOrEventId/statusCode/bodyEncoding |
| STREAM L2 Payload Header | 06 §3.1 | 16B 固定头：streamId/seqId/cursor |
| PayloadType 枚举值 | 02 §5 | CONTROL=0x01 / RPC=0x02 / STREAM=0x03 |
| 字节序 | 02 §9 | 所有多字节整数 Little-Endian |

### 0.2 不兼容变更规则（必须升级 Header Version）

以下变更属于不兼容变更，必须升级 AXTP Header `Version` 字段：

```text
- L1 Frame Header 字段长度、顺序或语义变化
- PayloadLength 语义变化
- PayloadType 编码重定义
- CRC 算法或覆盖范围变化
- Control L2 固定头布局变化
- RPC Binary L2 固定头布局变化
- STREAM L2 固定头布局变化
```

### 0.3 兼容扩展规则（不升级 Header Version）

以下变更属于兼容扩展，不需要升级 Header Version：

```text
- 新增 methodId / eventId / errorCode / capabilityId
- 新增 Control opcode（使用 0x10-0x6F 保留范围）
- 新增 Control TLV 字段（旧 Parser 可跳过未知字段）
- 新增 Stream Profile（不修改 STREAM Header 结构）
- 新增 rpcEncoding 类型
- 新增 Transport Profile（不修改既有 Transport Profile 的 wire format）
- 新增低带宽 Frame Profile（进入 18《AXTP Low-Bandwidth Degradation》，不修改 v1 Core Standard Frame）
```

### 0.4 ID 不复用规则

已发布的以下 ID 不得复用，即使已废弃：

```text
- PayloadType 值（0x01/0x02/0x03 已占用）
- Control opcode 值（0x00-0x10 已占用）
- Stream flags bit（已分配的 bit 不得重新定义语义）
- methodId / eventId / errorCode（deprecated 后保留编号，不得重新分配）
```

### 0.5 Reserved 字段规则

```text
- 发送方：reserved 字段必须置 0
- 接收方：必须忽略未知 reserved 字段，不得因此断开连接
- 不得将 reserved 字段用于私有扩展（使用 VENDOR/EXPERIMENTAL 范围）
```

### 0.6 Frame Profile 会话内不切换

```text
- 同一个 AXTP Session 内 Frame Profile 不切换
- Transport Profile 固定决定是否使用 Standard Frame（见 01 §4、03 §1）
- OPEN/ACCEPT 不协商 Header Profile
- 如需使用低带宽降级 Frame Profile，必须选择独立降级 Transport Profile 或重新 OPEN
```

### 0.7 specVersion 与 registryVersion 分离

```text
- specVersion（如 1.0.0）：Core wire format 修改时升级，对应 Header Version 字段
- registryVersion（如 0.1.0）：method/event/type/error/profile 增量时升级，不影响 wire format
- 两者独立演进，不得混用
```

### 0.8 Protocol Definition 与生成产物

```text
- 08 是 domain-feature 命名治理入口；09-14 文档是 Protocol Definition 与 registry 规范组，定义 registry/domain YAML 到 protocol/axtp.protocol.yaml 的映射约束
- registry/**/*.yaml 与 registry/domains/**/*.yaml 是具体业务内容的机器事实源
- protocol/axtp.protocol.yaml 是由 axtpc 聚合生成的 Protocol IR，不得手写修改
- generated/ 目录下的产物由 axtpc 生成，不得手写修改
- 如需修改生成产物，必须修改 registry/domain YAML 后重新生成
```

---

## 1. 文档目的

本文档定义旧协议迁移到 AXTP（Unified Transport Frame Protocol）的适配原则、映射规则、兼容模式和 Adapter 落地路径。

本文档不重新设计 AXTP Core Protocol，而是回答以下落地问题：

```text
旧 HID / BLE / UART 协议如何接入 AXTP？
旧 CmdValue 如何映射为 AXTP methodId？
旧 JSON-RPC / BinaryRPC 如何映射为 AXTP RPC？
旧 Firmware Update / RawStream / LogStream 如何映射为 AXTP STREAM？
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
| `0x03` | `STREAM` | 旧固件更新数据块、文件块、日志流、RawStream、HID Raw |

旧协议中的业务类型不得继续膨胀为新的顶层 PayloadType。

例如：

```text
旧 Firmware Payload    -> AXTP STREAM / RPC 建流 profile = firmware.update
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
| adopted method/event names, such as audio.setAlgorithmConfig |
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

**低带宽降级判定（HID-64/BLE/UART）：**

Compact/HID-64/BLE/UART 不属于 AXTP v1 Core 必选路径。若后续启用低带宽降级，嗅探规则必须在对应降级 profile 中定义，并遵守 18《AXTP Low-Bandwidth Degradation》的边界：不得改变 PayloadType、CONTROL/RPC/STREAM Payload Header 或 STREAM 16B Header。

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
firmware.getUpdateCapabilities
firmware.beginUpdate
firmware.verifyUpdatePackage
device.getState
video.setFramingConfig
audio.setAlgorithmConfig
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
| Common Display | `display.*` | 显示器自身能力，如屏幕、电源、亮度、分辨率 |
| Common Brightness | `display.*` | 亮度、自动亮度、范围 |
| Input Source / HID / GPIO | `input.*` | 输入源、按键、GPIO、KVM/HID；低频走 RPC，高频可走 STREAM |
| Output Source / Routing / Layout | `output.*` | 输出源、输出接口、输入到输出的路由、幕墙/拼接/画中画布局 |
| Meeting / Rooms | `room.*` | 会议室身份、日程、场景和参与设备；AXTP domain 使用单数 `room` |
| Digital Signage | `signage.*` | 数字标牌播放列表、播放计划、媒体、外观、播放状态 |
| Factory / Production Test | `diagnostic.*` | 产测、自检、报告、指标 |
| HID Raw / KVM | `input.*` + `profile=control.hid_raw` | 低频走 RPC，高频走 STREAM |
| 固件更新 Chunk | `firmware.*` + `profile=firmware.update` | 控制面 RPC，数据面 STREAM |
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

#### 模式 A：WebSocket Unframed JSON

WebSocket Unframed JSON 是正式 RPC-only 通道，也可以作为 Legacy Adapter 的入口：

```text
Transport = AXTP-WS-JSON / AXTP-WS-CLOUD-REVERSE
Frame Header = none
Input        = JSON sid/op/d envelope 或 Adapter 接收的 legacy JSON-RPC request object
Output       = JSON sid/op/d envelope 或 Adapter 调用结果
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

## 8. 旧 Firmware Update 协议迁移

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
RPC 控制固件更新流程
STREAM 承载固件更新数据块
CONTROL ACK/NACK 负责可靠传输
CRC32 / SHA256 负责 chunk 或镜像级完整性
```

### 8.2 旧 Firmware method 到 AXTP method

| 旧语义 | AXTP method | PayloadType |
| --- |---| --- |
| firmware.begin / upgrade.start | `firmware.beginUpdate`（候选，待草案采纳） | RPC |
| firmware.write / writeChunk | `STREAM 固件更新数据块` | STREAM |
| firmware.end | `firmware.commitUpdateBatch` 或 `firmware.cancelUpdate`（候选，待草案采纳） | RPC |
| firmware.verify | `firmware.verifyUpdatePackage`（候选，待草案采纳） | RPC |
| firmware.apply | `firmware.installUpdate`（候选，待草案采纳） | RPC |
| firmware.abort | `firmware.cancelUpdate`（候选，待草案采纳） | RPC |
| firmware.resume | `firmware.resumeUpdate`（候选，待草案采纳） | RPC |
| firmware.getProgress | `firmware.getUpdateTransferState`（候选，待草案采纳） | RPC |

### 8.3 旧固件更新 Chunk 字段映射

AXTP v1 STREAM Header 固定 16B，只含 `streamId / seqId / cursor`，不携带业务字段。
旧固件更新字段按以下规则分流：

| 旧字段 | AXTP 字段 | 位置 | 说明 |
| --- |---| --- | --- |
| `transferId` | `streamId` | STREAM Header（wire） | 由已采纳固件更新建流响应 分配，绑定到 Stream Context |
| `seqId` | `seqId` | STREAM Header（wire） | uint32，从 0 开始，自然回绕 |
| `offset` | `cursor` | STREAM Header（wire） | cursorUnit=byteOffset，见 06《Stream Spec》§3.2 |
| `totalLength` | `totalSize` | 已采纳固件更新建流参数（RPC 控制面） | 不在 STREAM Header 中 |
| `chunkLength` | 派生值 | `Frame.payloadLength - 16`（Frame Header） | 不在 STREAM Header 中，接收端从帧长度反推 |
| `chunkCrc32` | 可选 | profile trailer 或 CONTROL ACK/NACK body | 不在 STREAM Header 中 |
| `imageType` | `imageType` | 已采纳固件更新建流参数（RPC 控制面） | 不在 STREAM Header 中 |
| `sha256` | `verifyValue` | 已采纳固件更新建流参数 + 校验方法（RPC 控制面） | 不在 STREAM Header 中 |

### 8.4 旧固件更新 ACK/NACK 映射

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
| 支持命令列表 | generated registry 或后续已采纳的 capability 查询方法 |
| 支持事件列表 | `supportedEvents` |
| 支持升级 | `firmware.update` |
| 支持断点续传 | `firmware.resume` |
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
| `3` | `0x003B RPC_PARAM_INVALID` | 参数错误 |
| `4` | `0x0006 TIMEOUT` | 超时 |
| `5` | `0x0036 RPC_METHOD_NOT_FOUND` | 命令不支持 |
| `6` | `0x0508 STREAM_SEQ_INVALID` | 分块序号错误 |
| `7` | `0x040B FW_VERIFY_FAILED` | 固件校验失败 |
| `>= 0x80` | `0x7000+ VENDOR_ERROR` | 厂商私有 |

### 14.3 保留旧错误详情

转换后仍应保留旧状态：

```yaml
error:
  code: 0x003B
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
适合 Adapter baseline
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

示例（CONTROL OPEN body TLV 中携带 legacy 兼容字段）：

```yaml
# CONTROL OPEN body TLV（vendor 扩展字段，TLV type 0x70-0x7E 范围）
legacySupported:
  - AXDP_HID
  - OLD_BINARY_RPC
legacyMode: adapter
legacyVersion: 0x0102
legacyMaxPacketSize: 64
```

### 17.2 Capability 中声明业务兼容能力

业务层通过 generated registry、已采纳业务能力查询方法，或后续已采纳的 `capability.*` 方法查询。AXTP v1 Core 不再默认生成全局 supported-methods 查询方法。

`capability.getAll / capability.getDomain / capability.hasMethod` 只能作为 future compatibility reference，不能作为 v1 Adapter 的必选依赖。

返回：

```yaml
legacyMappings:
  - methodId: 0x0902
    methodName: audio.setAlgorithmConfig
    legacyCmdValue: 0x000B0002
    legacyName: ExampleLegacyAudioCommand
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

Adapter baseline 推荐：

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
是否用于固件更新 / 日志 / 产测
```

### 20.2 Phase 1：Adapter 骨架

目标：不改设备固件，先让新 SDK 通过 Adapter 调旧设备。具体业务 method 必须来自已采纳草案；本节只描述 Adapter 的能力范围，不声明当前 MVP 业务方法。

建议验证：

```text
generated registry 可被加载
已采纳业务 method 可通过 Adapter 调用
已采纳业务 event 可通过 Adapter 上报
STREAM chunk 可按已采纳业务 profile 映射
旧 status 可映射为 AXTP status.code/status.msg/status.ok
IDENTIFY.eventMasks
REIDENTIFY.eventMasks
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
registry/method/method_registry.yaml
registry/event/event_registry.yaml
registry/error/error_code.yaml
registry/capability/capability_registry.yaml
registry/legacy/legacy_mapping.yaml
registry/schema/*.yaml
registry/domains/<domain>/domain.yaml
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

## 23. 旧协议迁移样例能力

本节是历史迁移样例，不是当前 generated/MVP 业务合同。任何旧命令只有在对应业务草案采纳并写入 YAML 后，才能进入 generated 协议。

### 23.1 RPC 命令 intake 示例

| 候选 AXTP method / RPC 字段 | 说明 |
| --- |---|
| `device.getInfo` | 旧设备信息查询 intake，待 device 草案采纳 |
| `device.getStatus` | 旧状态查询 intake，待 device 草案采纳 |
| 后续已采纳 capability 查询方法 | 旧能力表转换 intake |
| `display.getBrightness` | 旧亮度查询 intake，待 display 草案采纳 |
| `display.setBrightness` | 旧亮度设置 intake，待 display 草案采纳 |
| `firmware.beginUpdate` | 旧固件更新控制面 intake，待 firmware.update 草案采纳 |
| `firmware.verifyUpdatePackage` | 旧固件更新校验入口，待 firmware.update 草案采纳 |
| `IDENTIFY.eventMasks` | 验证初始事件订阅 |
| `REIDENTIFY.eventMasks` | 验证事件订阅更新 |

### 23.2 必须迁移的 Stream Profile

| profileName | 说明 |
| --- |---|
| `firmware.update` | 固件 chunk |
| `log.realtime` | 可选，调试阶段建议支持 |
| `control.hid_raw` | 可选，仅当已采纳 profile 包含 HID Raw / KVM |

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
legacy_upd_chunk_to_axtp_stream.hex
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

本迁移规范达到可落地状态，必须满足：

```text
1. legacy_mapping.yaml 只包含已采纳业务草案对应的 legacy mapping
2. Generator 能生成 C++ legacy mapping table，且空 mapping 也能通过
3. C++ Demo 能通过 Adapter 调用至少一个已采纳业务 method
4. C++ Demo 能上报至少一个已采纳业务 event
5. C++ Demo 能把旧连续数据按已采纳业务 profile 映射为 AXTP STREAM
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
| `06-AXTP-Stream-Spec.md` | 定义 firmware.update / file.transfer / log / media 数据面 |
| `15-AXTP-Type-System.md` | 定义基础类型 |
| `16-AXTP-TLV-Schema-Encoding.md` | 定义 TLV body 映射 |
| `17-AXTP-Schema-Field-Numbering.md` | 定义 schema-local fieldId 规则 |
| `09-AXTP-Protocol-Definition-Mapping-Spec.md` | 定义 Protocol Definition 映射规则 |
| `10-AXTP-Methods-Registry-Spec.md` | 定义 methods 元模型与 methodId 约束 |
| `12-AXTP-Errors-Registry-Spec.md` | 定义 errors 元模型与错误码映射 |
| `13-AXTP-Types-and-Capability-Spec.md` | 定义 types 元模型与 v1 capability 范围 |
| `14-AXTP-Profiles-Registry-Spec.md` | 定义 profiles 元模型与实现范围 |
| `registry/legacy/legacy_mapping.yaml` | 保存已采纳的旧协议到 AXTP method/error 映射 |

---

## 26.1 Legacy Source 边界

旧协议兼容参考不得回流到 02/04/05/06 Core wire format，除非它描述的是已经被 AXTP v1 采纳的线格式规则。

| 内容类型 | 处理方式 |
|---|---|
| 旧 CmdValue / 旧 methodName | 稳定后以 `legacy` 字段进入 `registry/` 或 `registry/domains/` YAML |
| 旧状态码 | 写入 legacy error mapping，稳定后映射到 `errors[].code` |
| 旧事件名 / 旧推送格式 | 写入 legacy event mapping，稳定后映射到 `events[]` |
| 旧能力表 / Feature bitmap | 写入 legacy capability mapping；完整 Capability Model 仍属于 v2/P1 |
| 旧固件更新 / RawStream 字节流 | 映射到 RPC 建流 + STREAM profile，不得新增 PayloadType |

---

## 27. 总结

AXTP 老协议迁移的核心不是把旧协议逐字节搬进新协议，而是建立一层稳定的兼容映射：

```text
旧 CmdValue        -> AXTP methodId + legacyCmdValue
旧 Payload         -> AXTP TLV8 Schema / RAW_BYTES legacy body
旧 Status          -> AXTP ErrorCode
旧 Event           -> AXTP EventId
旧 Capability      -> AXTP Capability Registry
旧 Firmware Chunk  -> AXTP STREAM + profile=firmware.update
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
