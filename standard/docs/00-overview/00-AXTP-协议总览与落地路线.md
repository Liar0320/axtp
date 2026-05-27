# 00《AXTP 协议总览与落地路线》

版本：v0.1 Draft  
状态：MVP 落地规划稿  
适用范围：AXTP Core Protocol、Control、RPC、Stream、Type System、Registry、Generator、C++ Demo 统一入口文档

---

## 1. 文档目的

本文档是 AXTP 协议体系的总览文档，用于回答以下问题：

1. AXTP 是什么；
2. AXTP 为什么只保留 `CONTROL / RPC / STREAM` 三类 `PayloadType`；
3. 协议文档、类型系统、注册表、Demo、Generator、C++ 实现之间如何衔接；
4. 哪些内容属于 MVP 必须实现；
5. 哪些内容可以延后实现；
6. 如何从旧协议平滑迁移到 AXTP；
7. 如何让协议从文档设计真正落地到可运行代码。

本文档不是字段级协议定义文档。字段级细节分别由以下文档承载：

```text
01-core-protocol/01-AXTP-整体协议规范.md
01-core-protocol/02-AXTP-Control信令协议规范.md
01-core-protocol/03-AXTP-RPC协议与二进制映射规范.md
01-core-protocol/04-AXTP-Stream流式传输协议规范.md
01-core-protocol/05-AXTP-连接场景与调用流程规范.md
02-type-system/01-AXTP-Type-System基础类型规范.md
02-type-system/02-AXTP-TLV-Schema编码规范.md
03-registry/*.md
04-compatibility/*.md
05-demo/*.md
06-generator/*.md
07-cpp-demo/*.md
```

---

## 2. AXTP 是什么

AXTP，全称为：

```text
Auditoryworks Transport Protocol
```

中文可称为：

```text
Auditoryworks 传输协议
```

AXTP 的目标不是重新发明一种业务协议，而是为多种设备传输环境提供统一的协议骨架，使以下传输方式可以共享同一套：

```text
Frame Header
PayloadType
Control 信令
RPC 语义
Stream 数据面
Type System
Method / Event / Error / Capability Registry
Generator
SDK / Demo
```

目标覆盖的传输包括：

```text
BLE
USB HID
UART
TCP
WebSocket Binary
WebSocket Text
USB Bulk
本地 Mock Transport
```

目标覆盖的设备形态包括：

```text
MCU 设备
Linux 设备
Android 设备
Windows App
Browser App
网关 / 中继设备
音视频设备
数字标牌 / 显示设备
会议终端
产测工具
升级工具
```

---

## 3. AXTP 的核心问题

AXTP 主要解决以下问题：

### 3.1 多传输协议不统一

旧协议通常会在 HID、BLE、TCP、WebSocket 上分别设计不同命令格式，导致：

```text
同一个业务命令有多套协议表达
同一个错误码有多套定义
同一个能力字段有多套命名
同一个升级流程在不同传输上难以复用
```

AXTP 要求所有传输共享同一套业务语义，传输差异只体现在 Header Profile、MTU、分片、ACK 和编码方式上。

---

### 3.2 Header 容易被业务污染

如果把 `VIDEO / AUDIO / OTA / FILE / LOG / KVM` 都放进 Frame Header 的 `PayloadType`，Header 会迅速膨胀为业务注册表，导致协议难以稳定。

AXTP 规定：

```text
Frame Header 只负责传输帧级信息；
PayloadType 只负责选择一级 Payload Parser；
业务语义必须下沉到 RPC Method、Event、Stream Profile、Metadata 和 Registry 中。
```

---

### 3.3 DS-RPC Text Profile 和二进制协议割裂

旧方案中容易把文本 RPC 和 Binary-RPC 当成两套协议，最终造成：

```text
Text 有一套 methodName
Binary 有一套 cmdId
两边参数不一致
错误码不一致
事件不一致
SDK 无法统一生成
```

AXTP 规定：

```text
DS-RPC Text Profile 和 Binary-RPC 是同一套 RPC 语义的不同编码形式。
```

也就是说：

```text
methodName <-> methodId
eventName  <-> eventId
params     <-> TLV8 / TLV16 / CBOR / RAW_BYTES Body
result     <-> TLV8 / TLV16 / CBOR / RAW_BYTES Body
error      <-> errorCode
```

---

### 3.4 控制面和数据面混在一起

配置、查询、设置、状态上报属于控制面；视频帧、音频帧、文件块、OTA chunk、实时日志属于数据面。

AXTP 将其明确拆分为：

```text
RPC    = 业务控制面
STREAM = 业务数据面
```

例如：

```text
firmware.begin       -> RPC
firmware.verify      -> RPC
firmware image chunk -> STREAM

video.setResolution  -> RPC
video.startPreview   -> RPC
video frame          -> STREAM

file.beginTransfer   -> RPC
file chunk           -> STREAM

display.setBrightness       -> RPC
display.brightnessChanged   -> RPC Event
```

---

## 4. AXTP 协议总体分层

AXTP 推荐分层如下：

```text
+--------------------------------------------------+
| Business Layer                                   |
| device / display / video / firmware / stream ... |
+--------------------------------------------------+
| Registry Layer                                   |
| Method / Event / Error / Capability              |
+--------------------------------------------------+
| Payload Layer                                    |
| CONTROL / RPC / STREAM                           |
+--------------------------------------------------+
| AXTP Frame Layer                                 |
| Header / Length / Flags / MessageId / Fragment   |
+--------------------------------------------------+
| Transport Layer                                  |
| BLE / HID / UART / TCP / WebSocket / USB Bulk    |
+--------------------------------------------------+
```

各层职责如下：

| 层级 | 职责 | 不应该做的事 |
|---|---|---|
| Transport | 负责字节传输 | 不理解业务方法 |
| Frame | 负责边界、长度、分片、校验、路由 | 不理解 video/audio/ota/file |
| Payload | 选择 CONTROL/RPC/STREAM 解析器 | 不承载业务注册表 |
| Registry | 定义 method/event/error/capability | 不处理传输细节 |
| Business | 定义设备业务语义 | 不直接修改 Frame Header |

---

## 5. PayloadType 总体设计

AXTP v1 只保留三种 `PayloadType`：

```text
0x01 CONTROL
0x02 RPC
0x03 STREAM
```

### 5.1 PayloadType 表

| PayloadType | 名称 | 作用 | 典型内容 |
|---:|---|---|---|
| `0x01` | `CONTROL` | 协议运行时信令 | OPEN、ACCEPT、ACK、NACK、HEARTBEAT、RESUME、CLOSE |
| `0x02` | `RPC` | 结构化业务控制面 | request、response、event、batch |
| `0x03` | `STREAM` | 连续数据 / 大块数据面 | video frame、audio frame、OTA chunk、file chunk、log stream |

### 5.2 为什么不再区分 RPC_JSON / RPC_BINARY

AXTP 不再把 DS-RPC Text Profile 和 Binary-RPC 作为两个不同的 `PayloadType`。

旧模型：

```text
PayloadType = RPC_JSON
PayloadType = RPC_BINARY
```

新模型：

```text
PayloadType = RPC
  rpcEncoding = JSON / BINARY / MSGPACK / CBOR
  bodyEncoding = NONE / TLV8 / TLV16 / RAW_BYTES / CBOR_BODY
```

原因：

1. JSON 和 Binary 只是编码不同；
2. 它们应共享同一套 method/event/error/capability registry；
3. SDK 和 generator 可以从同一份 registry 同时生成 JSON 和二进制实现；
4. Header 不需要关心 RPC 内部编码。

---

### 5.3 为什么不再使用 RAW_BINARY，而改为 STREAM

旧模型中可能使用：

```text
PayloadType = RAW_BINARY
```

新模型改为：

```text
PayloadType = STREAM
```

原因：

1. `RAW_BINARY` 只强调“裸二进制”，没有表达“流式数据面”的协议语义；
2. 视频、音频、文件、OTA、日志都需要 streamId、seqId、offset、chunkIndex、timestamp、metadata、ACK/NACK、断点续传等通用机制；
3. `STREAM` 比 `RAW_BINARY` 更适合作为长期数据面模型；
4. `STREAM` 内部仍然可以承载裸数据，但不等于无结构数据。

---

## 6. 三类 Payload 的职责边界

### 6.1 CONTROL：协议运行时信令

`CONTROL` 只处理协议自身的生命周期和可靠传输控制。

典型信令：

```text
OPEN
ACCEPT
HEARTBEAT
HEARTBEAT_ACK
ACK
NACK
RESUME
RESUME_ACK
CLOSE
CLOSE_ACK
SESSION_RESET
WINDOW_UPDATE
PING
PONG
```

`CONTROL` 不承载业务命令。

以下内容不应属于 CONTROL：

```text
device.getInfo
display.setBrightness
firmware.begin
video.startPreview
file.beginTransfer
```

这些必须走 `RPC`。

---

### 6.2 RPC：业务控制面

`RPC` 负责所有结构化业务交互：

```text
request
response
event
batch request
batch response
```

典型方法：

```text
device.getInfo
capability.getAll
display.setBrightness
display.getBrightness
firmware.begin
firmware.verify
stream.open
stream.close
file.beginTransfer
log.setLevel
diagnostic.selfTest
```

RPC 内部通过 `rpcEncoding` 区分编码形式：

```text
JSON
BINARY
CBOR
MSGPACK
```

---

### 6.3 STREAM：业务数据面

`STREAM` 负责连续数据、大块数据、高吞吐数据。

典型数据：

```text
video frame
audio frame
AV mixed packet
OTA chunk
file chunk
realtime log
log bundle
sensor data
KVM raw input
HID raw report
screenshot chunk
```

STREAM 内部不再通过 Header 字段区分数据类型。RPC 建流阶段通过具体 Stream Profile 绑定 `streamId`：

```text
firmware.ota
file.upload / file.download
log.realtime
media.video / media.audio
control.hid_raw
sensor.sample
```

---

## 7. AXTP 文档体系

AXTP 文档建议按以下目录组织。

```text
docs/
├── 00-overview/
│   └── 00-AXTP-协议总览与落地路线.md
│
├── 01-core-protocol/
│   ├── 01-AXTP-整体协议规范.md
│   ├── 02-AXTP-Control信令协议规范.md
│   ├── 03-AXTP-RPC协议与二进制映射规范.md
│   ├── 04-AXTP-Stream流式传输协议规范.md
│   └── 05-AXTP-连接场景与调用流程规范.md
│
├── 02-type-system/
│   ├── 01-AXTP-Type-System基础类型规范.md
│   ├── 02-AXTP-TLV-Schema编码规范.md
│   └── 03-AXTP-Schema字段编号规范.md
│
├── 03-registry/
│   ├── 00-AXTP-Registry总则.md
│   ├── 01-AXTP-MethodId注册表.md
│   ├── 02-AXTP-EventId注册表.md
│   ├── 03-AXTP-ErrorCode注册表.md
│   ├── 04-AXTP-Capability注册表.md
│   └── 05-AXTP-MVP最小实现注册表.md
│
├── 04-compatibility/
│   └── 01-AXTP-老协议适配与迁移规范.md
│
├── 05-demo/
│   ├── 15-AXTP-WebSocket-JSON-RPC-Demo.md（Legacy / Non-normative）
│   ├── 02-AXTP-WebSocket-Binary-Demo.md
│   ├── 03-AXTP-HID-Compact-Demo.md
│   ├── 04-AXTP-BLE-Compact-Demo.md
│   └── 05-AXTP-OTA-Stream-Demo.md
│
├── 06-generator/
│   └── 01-AXTP-Generator-v1实现规范.md
│
└── 07-cpp-demo/
    └── 01-AXTP-Cpp-Demo实现规范.md
```

---

## 8. 各文档职责说明

### 8.1 00-AXTP-协议总览与落地路线.md

本文档。负责定义：

```text
整体目标
协议边界
三类 PayloadType
文档结构
MVP 路线
落地节奏
```

---

### 8.2 01-AXTP-整体协议规范.md

负责定义 AXTP Frame 层。

应包含：

```text
Frame Header
Standard Profile
Compact Profile
PayloadType
MessageId
Fragment
Flags
CRC
Version
Session 生命周期
```

---

### 8.3 02-AXTP-Control信令协议规范.md

负责定义 `PayloadType = CONTROL` 时的 Payload 格式。

应包含：

```text
Control Payload Header
Control Opcode
Control TLV
OPEN / ACCEPT
ACK / NACK
HEARTBEAT
RESUME
CLOSE
WINDOW_UPDATE
```

特别需要明确：

```text
PayloadType = CONTROL 不表示无 payload；
它表示 Frame Payload 必须交给 ControlParser 解析。
Control Payload 使用统一 5B 固定头（opcode/controlId/statusCode + TLV body），
不区分 Standard/Compact Frame Profile，所有传输场景共用同一结构。
```

---

### 8.4 03-AXTP-RPC协议与二进制映射规范.md

负责定义 `PayloadType = RPC`。

应包含：

```text
rpcEncoding
rpcOp
requestId
methodId / eventId
statusCode
bodyEncoding
DS-RPC Text Profile 映射
Binary-RPC 映射
TLV Body 映射
Event 映射
Batch 映射
```

---

### 8.5 04-AXTP-Stream流式传输协议规范.md

负责定义 `PayloadType = STREAM`。

应包含：

```text
STREAM L2 Header
streamId
seqId
cursor
data
RPC 建流与 Stream Profile 绑定
ACK / NACK
断点续传
滑动窗口
OTA / file / log 等 profile 的上下文约束
```

---

### 8.6 Type System 文档

负责让 registry、TLV、generator、C++ SDK 共享同一套类型规则。

应包含：

```text
基础类型
字节序
字符串编码
bool 编码
enum 编码
bitmap 编码
array 编码
object 编码
optional 字段
reserved 字段
TLV 编码
字段编号规范
```

---

### 8.7 Registry 文档

负责定义业务语义的唯一事实源。

应包含：

```text
MethodId
EventId
ErrorCode
CapabilityId
Domain
Params
Result
Event Data
Old Protocol Mapping
MVP Scope
```

---

### 8.8 Compatibility 文档

负责旧协议迁移。

应包含：

```text
旧 CmdValue 到 methodId 的映射
旧 payload 到 TLV schema 的映射
旧 error/status 到 errorCode 的映射
旧 capability 到新 capability registry 的映射
旧 OTA 到 firmware.* + STREAM OTA 的映射
旧 HID/BLE report 到 AXTP Frame 的映射
```

---

### 8.9 Demo 文档

负责验证协议能跑通。

应覆盖：

```text
WebSocket Text DS-RPC Profile
WebSocket Binary AXTP Frame
HID（Standard Profile，含 Compact 降级协商）
BLE Compact Profile
OTA Stream Demo
Mock Transport
```

---

### 8.10 Generator 文档

负责定义代码生成器 v1 的输入和输出。

输入：

```text
registry/*.yaml
schema/*.yaml
```

输出：

```text
Markdown 注册表
C++ enum
C++ struct skeleton
TLV field constants
error code constants
capability constants
测试向量
```

---

### 8.11 C++ Demo 文档

负责定义最小可运行 C++ 工程。

应包含：

```text
frame encoder / decoder
control parser
rpc parser
stream parser
tlv encoder / decoder
generated registry
mock client
mock server
unit test
```

---

## 9. Registry 是单一事实源

AXTP 落地时，不应把 Markdown 当作唯一事实源。

推荐关系是：

```text
registry YAML / schema YAML
        ↓
    generator
        ↓
Markdown 文档
C++ enum / struct
TLV encoder / decoder skeleton
JSON schema
测试向量
Demo 代码
```

也就是说：

```text
人读 Markdown；
机器读 YAML；
Generator 生成 SDK 和文档。
```

这能避免以下问题：

```text
文档里的 methodId 和代码里的 enum 不一致
JSON 参数和 TLV 字段不一致
错误码重复分配
事件表遗漏实现
旧协议映射长期失真
```

---

## 10. MVP 最小落地目标

AXTP MVP 不追求一次性覆盖全部业务，而是先跑通协议闭环。

### 10.1 MVP 必须验证的能力

MVP 必须验证以下链路：

```text
1. 建立会话
2. 协商协议能力
3. 发送 RPC 请求
4. 返回 RPC 响应
5. 上报 RPC Event
6. 发送 STREAM 数据
7. ACK / NACK 可靠确认
8. 错误码返回
9. Capability 查询
10. 老协议最小映射
```

---

### 10.2 MVP 推荐业务范围

MVP 第一阶段只建议实现以下 domain：

```text
device.*
capability.*
system.*
display.*
firmware.*
stream.*
```

暂缓完整实现：

```text
file.*
log.*
diagnostic.*
input.*
network.*
storage.*
sensor.*
auth.*
privacy.*
vendor.*
```

这些 domain 可以先在完整规划注册表中占位，但不进入 MVP 必须交付范围。

---

### 10.3 MVP 方法建议

MVP MethodId 建议先实现：

| Domain | Method | 作用 |
|---|---|---|
| device | `device.getInfo` | 获取设备基础信息 |
| device | `device.getVersion` | 获取版本信息 |
| capability | `capability.getAll` | 获取完整能力集 |
| capability | `capability.getDomain` | 获取指定域能力 |
| system | `system.getTime` | 获取系统时间 |
| system | `system.reboot` | 重启设备 |
| display | `display.getBrightness` | 获取亮度 |
| display | `display.setBrightness` | 设置亮度 |
| display | `display.getBrightnessRange` | 获取亮度范围 |
| firmware | `firmware.getInfo` | 获取固件信息 |
| firmware | `firmware.begin` | 开始升级 |
| firmware | `firmware.verify` | 校验固件 |
| firmware | `firmware.apply` | 应用固件 |
| firmware | `firmware.abort` | 中止升级 |
| stream | `stream.open` | 打开流 |
| stream | `stream.close` | 关闭流 |
| stream | `stream.getStatus` | 获取流状态 |
| rpc | `IDENTIFY.eventSubscriptions` | 初始事件订阅集合 |
| rpc | `REIDENTIFY.eventSubscriptions` | 更新事件订阅集合 |

---

### 10.4 MVP 事件建议

MVP EventId 建议先实现：

| Event | 作用 |
|---|---|
| `device.statusChanged` | 设备状态变化 |
| `capability.changed` | 能力变化 |
| `firmware.updateProgress` | 升级进度 |
| `firmware.updateCompleted` | 升级完成 |
| `firmware.updateFailed` | 升级失败 |
| `stream.opened` | 流已打开 |
| `stream.closed` | 流已关闭 |
| `stream.error` | 流错误 |

---

### 10.5 MVP Stream Profile 建议

MVP Stream 只建议先实现：

| profileId | profileName | 作用 | 是否 MVP |
|---|---|---|---|
| `0x0101` | `firmware.ota` | 固件升级块 | 是 |
| `0x0201` | `file.upload` | 文件上传 | 可选 |
| `0x0202` | `file.download` | 文件下载 | 可选 |
| `0x0401` | `log.realtime` | 简单日志流 | 可选 |
| `0x1001` | `media.video` | 视频流 | 暂缓 |
| `0x1002` | `media.audio` | 音频流 | 暂缓 |
| `0x3001` | `control.hid_raw` | KVM / HID Raw | 暂缓 |
| `0x4001` | `sensor.sample` | 传感器流 | 暂缓 |

Stream Profile 不写入 STREAM Header。RPC 建流返回 `streamId` 后，STREAM packet 只携带：

```text
streamId / seqId / cursor / data
```

MVP 最小 Stream 链路建议优先选择 OTA，因为它能同时验证：

```text
大块数据
分片
offset
chunkIndex
CRC
ACK / NACK
断点续传
RPC 控制面 + STREAM 数据面协作
```

---

## 11. MVP 最小可运行流程

### 11.1 Session 建立

```text
Client -> Server: CONTROL OPEN
Server -> Client: CONTROL ACCEPT
```

目标：验证 `PayloadType = CONTROL`、Control Payload 统一 5B 固定头、TLV body、sessionId、MTU、Frame Profile 协商、心跳参数。

---

### 11.2 能力查询

```text
Client -> Server: RPC capability.getAll
Server -> Client: RPC Response capability.getAll
```

目标：验证 RPC request/response、methodId、result body、capability registry。

---

### 11.3 设备信息查询

```text
Client -> Server: RPC device.getInfo
Server -> Client: RPC Response device.getInfo
```

目标：验证最基础业务 RPC。

---

### 11.4 亮度设置

```text
Client -> Server: RPC display.setBrightness
Server -> Client: RPC Response success
Server -> Client: RPC Event display.brightnessChanged
```

目标：验证 request/response/event 三种 RPC 语义。

---

### 11.5 OTA 流式升级

```text
Client -> Server: RPC firmware.begin
Server -> Client: RPC Response transferId

Client -> Server: STREAM OTA chunk #0
Server -> Client: CONTROL ACK

Client -> Server: STREAM OTA chunk #1
Server -> Client: CONTROL ACK

Client -> Server: RPC firmware.verify
Server -> Client: RPC Response success

Client -> Server: RPC firmware.apply
Server -> Client: RPC Response success
Server -> Client: RPC Event firmware.updateCompleted
```

目标：验证 RPC 控制面和 STREAM 数据面的完整协作。

---

## 12. 老协议适配策略

AXTP 不要求推翻旧协议，而是优先做兼容映射。

### 12.1 CmdValue 到 MethodId

如果旧协议已有 `CmdValue`，且其语义等价于“命令 ID”，则优先保留其数值或建立稳定映射。

示例：

```text
Old CmdValue -> AXTP methodId
```

适配原则：

```text
能保留则保留
不能保留则映射
映射必须进入 compatibility registry
禁止在代码里硬编码临时映射
```

---

### 12.2 旧 Payload 到 TLV Schema

旧协议的二进制 payload 应映射到 AXTP TLV schema。

示例：

```text
Old payload byte[0] -> fieldId 0x20 displayBrightnessValue
Old payload byte[1] -> fieldId 0x02 mode
```

这样 generator 可以同时生成：

```text
旧协议 parser
AXTP TLV parser
字段转换函数
```

---

### 12.3 旧错误码到 ErrorCode

旧协议中的 status、result、error 字段应统一映射到 AXTP ErrorCode。

示例：

```text
Old status = 0x00 -> SUCCESS
Old status = 0x01 -> RPC_PARAM_INVALID
Old status = 0x02 -> BUSY
```

---

### 12.4 旧能力表到 Capability Registry

旧 capability 表应转换为统一 capability registry。

目标是让上层应用只查询：

```text
capability.getAll
capability.getDomain
```

而不直接理解旧协议字段。

---

## 13. Generator v1 落地范围

Generator v1 不做完整 SDK，只做最小可用的代码生成和文档生成。

### 13.1 Generator v1 输入

```text
registry/method_registry.yaml
registry/event_registry.yaml
registry/error_code.yaml
registry/capability_registry.yaml
schema/*.yaml
compatibility/old_protocol_mapping.yaml
```

---

### 13.2 Generator v1 输出

```text
generated/axtp_method_id.h
generated/axtp_event_id.h
generated/axtp_error_code.h
generated/axtp_capability_id.h
generated/axtp_tlv_fields.h
generated/axtp_method_descriptor.cpp
docs/generated/*.md
test_vectors/*.json
test_vectors/*.hex
```

---

### 13.3 Generator v1 暂不实现

以下能力不进入 Generator v1：

```text
完整 RPC Stub 自动生成
完整异步 Client SDK
完整 Server Dispatch 框架
多语言 SDK
复杂反射系统
GUI 协议编辑器
```

---

## 14. C++ Demo v1 落地范围

C++ Demo v1 的目标是跑通协议链路，不追求 SDK 完整度。

### 14.1 推荐模块

```text
src/
├── axtp_frame.h / .cpp
├── axtp_control.h / .cpp
├── axtp_rpc.h / .cpp
├── axtp_stream.h / .cpp
├── axtp_tlv.h / .cpp
├── axtp_crc.h / .cpp
├── axtp_mock_transport.h / .cpp
├── generated/
│   ├── axtp_method_id.h
│   ├── axtp_event_id.h
│   ├── axtp_error_code.h
│   └── axtp_capability_id.h
└── main_demo.cpp
```

---

### 14.2 Demo 必须跑通的流程

```text
1. CONTROL OPEN / ACCEPT
2. RPC capability.getAll
3. RPC device.getInfo
4. RPC display.setBrightness
5. RPC Event display.brightnessChanged
6. RPC firmware.begin
7. STREAM OTA chunk
8. CONTROL ACK / NACK
9. RPC firmware.verify
10. RPC Event firmware.updateCompleted
```

---

## 15. 测试向量要求

为了确保不同语言、不同平台实现一致，AXTP 必须提供测试向量。

测试向量应至少包含：

```text
CONTROL OPEN hex
CONTROL ACCEPT hex
CONTROL ACK hex
CONTROL NACK hex
RPC device.getInfo JSON example
RPC device.getInfo binary hex
RPC display.setBrightness JSON example
RPC display.setBrightness binary hex
RPC Event display.brightnessChanged binary hex
STREAM OTA chunk hex
CRC error example
fragment example
```

每个测试向量应包含：

```text
name
description
input fields
encoded hex
decoded json
expected result
```

---

## 16. 版本治理策略

AXTP 版本分为三类：

```text
Protocol Version
Registry Version
Generator Version
```

### 16.1 Protocol Version

Protocol Version 只在 Frame Header 或 Payload 基础结构发生不兼容变化时升级。

例如：

```text
Frame Header 字段顺序变化
Frame Header 固定字段长度变化
PayloadType 语义变化
Control Payload 基础头变化
RPC Payload 基础头变化
Stream Payload 基础头变化
```

---

### 16.2 Registry Version

Registry Version 在 method、event、error、capability 变化时升级。

例如：

```text
新增 methodId
新增 eventId
新增 errorCode
新增 capabilityId
字段 deprecated
字段 optional 规则变化
```

---

### 16.3 Generator Version

Generator Version 表示代码生成工具版本。

它不应改变协议语义，只影响生成代码的结构、风格或辅助能力。

---

## 17. 延后实现内容

以下内容建议暂缓，不进入 MVP：

```text
完整视频流协议
完整音频流协议
复杂文件系统操作
复杂日志过滤
复杂诊断产测流程
KVM 高频输入流
多客户端权限系统
端到端加密
压缩协商
动态插件
多语言 SDK
Web GUI 协议管理器
```

这些内容可以在 AXTP Core、Type System、Registry、Generator v1 稳定后逐步补齐。

---

## 18. 落地阶段规划

### Phase 0：文档闭环

目标：完成协议骨架和 MVP 边界。

交付物：

```text
00-AXTP-协议总览与落地路线.md
01-AXTP-整体协议规范.md
02-AXTP-Control信令协议规范.md
03-AXTP-RPC协议与二进制映射规范.md
04-AXTP-Stream流式传输协议规范.md
Type System
TLV Schema
Registry 总则
MVP Registry
```

---

### Phase 1：Registry / Schema 结构化

目标：让 generator 可以读取协议定义。

交付物：

```text
method_registry.yaml
event_registry.yaml
error_code.yaml
capability_registry.yaml
tlv_schema.yaml
old_protocol_mapping.yaml
```

---

### Phase 2：Generator v1

目标：从 YAML 生成 C++ 常量、Markdown 表格、测试向量骨架。

交付物：

```text
generator.py 或 generator.cpp
generated/*.h
generated/*.md
test_vectors/*.json
```

---

### Phase 3：C++ Demo v1

目标：跑通最小协议链路。

交付物：

```text
Mock Client
Mock Server
Frame Encoder / Decoder
Control Parser
RPC Parser
Stream Parser
TLV Encoder / Decoder
MVP Demo Flow
```

---

### Phase 4：老协议适配

目标：让旧协议命令可以映射到 AXTP registry。

交付物：

```text
old cmd mapping
old payload adapter
old error mapping
old capability adapter
compatibility tests
```

---

### Phase 5：真实传输接入

目标：把 Mock Transport 替换为真实传输。

优先级：

```text
1. WebSocket Binary
2. USB HID
3. BLE
4. UART
5. TCP / USB Bulk
```

---

## 19. 最终验收标准

AXTP MVP 只有在满足以下条件后，才认为可以进入业务扩展阶段。

### 19.1 文档验收

```text
三类 PayloadType 定义清晰
Control / RPC / Stream 职责无重叠
Type System 可支撑 TLV 和 C++ 类型生成
Registry 有明确 ID 范围和命名规范
MVP Method/Event/Error/Capability 已定义
老协议适配策略已定义
```

---

### 19.2 工具验收

```text
Generator 可以读取 YAML
Generator 可以生成 C++ enum
Generator 可以生成 Markdown 表格
Generator 可以生成测试向量骨架
```

---

### 19.3 Demo 验收

```text
C++ Demo 可以完成 OPEN / ACCEPT
C++ Demo 可以完成 RPC request / response
C++ Demo 可以完成 RPC event
C++ Demo 可以发送 STREAM OTA chunk
C++ Demo 可以处理 ACK / NACK
C++ Demo 可以解析错误码
```

---

### 19.4 兼容验收

```text
至少 3 个旧 CmdValue 可以映射为 methodId
至少 1 个旧 capability 表可以转换为 capability.getAll
至少 1 条旧二进制 payload 可以转换为 TLV schema
至少 1 条旧错误码可以转换为 AXTP ErrorCode
```

---

## 20. 总结

AXTP 的核心不是增加更多协议字段，而是建立一条可落地的工程链路：

```text
三类 PayloadType
  ↓
Control / RPC / Stream 三套 Payload 规范
  ↓
Type System / TLV Schema
  ↓
Method / Event / Error / Capability Registry
  ↓
老协议兼容映射
  ↓
Generator v1
  ↓
C++ Demo
  ↓
真实传输接入
```

其中最重要的设计约束是：

```text
PayloadType 只保留 CONTROL / RPC / STREAM；
Header 不承载业务类型；
RPC 是业务控制面；
STREAM 是业务数据面；
Registry / Schema 是单一事实源；
Generator 和 Demo 是协议能否落地的验收标准。
```

AXTP v1 的目标不是一次性覆盖所有业务，而是先建立一套可持续演进、可生成代码、可兼容旧协议、可运行 Demo 的协议工程体系。
