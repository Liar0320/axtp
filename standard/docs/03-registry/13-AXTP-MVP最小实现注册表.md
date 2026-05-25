# 13《AXTP-MVP 最小实现注册表》

版本：v1.0  
状态：MVP / Implementation Contract  
适用范围：AXTP v1 第一阶段落地、老协议最小适配、Generator v1、C++ Demo v1

---

## 1. 文档目的

本文档定义 AXTP 第一阶段必须实现的最小注册表集合。

它不是完整业务协议全集，而是用于回答以下问题：

```text
第一版到底要实现哪些 PayloadType？
第一版到底要实现哪些 Control Opcode？
第一版到底要实现哪些 RPC Method？
第一版到底要实现哪些 Event？
第一版到底要实现哪些 ErrorCode？
第一版到底要实现哪些 Capability？
第一版 Generator 要消费哪些 YAML？
第一版 C++ Demo 必须跑通哪些链路？
老协议最小兼容边界是什么？
```

本文档是 AXTP 从协议设计进入工程落地的最小实现合同。

---

## 2. MVP 设计原则

### 2.1 只实现闭环，不追求全集

MVP 不以覆盖所有设备能力为目标，而以跑通端到端协议闭环为目标。

MVP 必须覆盖：

```text
建连
能力查询
基础 RPC 请求/响应
基础事件上报
基础参数设置
基础 Stream 数据传输
ACK/NACK
错误处理
老协议 CmdValue 兼容
Generator 代码生成
C++ Demo 跑通
```

MVP 暂不覆盖：

```text
完整音视频能力
完整文件系统
完整日志系统
完整诊断系统
完整输入/KVM
完整网络配置
完整权限系统
完整安全加密
完整压缩
完整多路复用调度
复杂 Batch RPC
复杂对象 Schema 反射
```

---

### 2.2 PayloadType 只保留三种

AXTP MVP 固定只实现三种 PayloadType：

```text
CONTROL
RPC
STREAM
```

不再把以下类型作为顶层 PayloadType：

```text
RPC_JSON
RPC_BINARY
RAW_BINARY
VIDEO
AUDIO
OTA
FILE
LOG
```

这些全部下沉到 Payload 内部字段中：

```text
PayloadType = RPC
  rpcEncoding = JSON / BINARY
  bodyEncoding = TLV / RAW_BYTES

PayloadType = STREAM
  streamId / seqId / cursor / data
```

STREAM 数据包不携带 `streamProfile`。具体 Profile（例如 `firmware.ota`）由 `firmware.begin`、`stream.open` 等 RPC 建流方法协商并绑定到 `streamId`。

---

### 2.3 Registry / Schema 是单一事实源

MVP 文档中的表格用于阅读和审查，但最终实现应以 YAML 为单一事实源：

```text
registry/*.yaml
schema/*.yaml
```

Generator v1 读取 YAML，生成：

```text
C++ enum
C++ constants
method descriptor
event descriptor
error descriptor
capability descriptor
TLV field constants
Markdown 表格
测试向量骨架
```

---

### 2.4 老协议优先兼容，不推翻重写

如果旧协议已有稳定 CmdValue，应优先保留其数值，并映射为 AXTP methodId。

MVP 的兼容原则：

```text
旧 CmdValue -> AXTP methodId
旧 Payload -> AXTP TLV body 或 legacy bytes
旧 status -> AXTP errorCode
旧设备能力表 -> AXTP capability
旧 OTA chunk -> AXTP STREAM OTA
```

MVP 不要求一次性把所有旧协议字段改造成理想 TLV。对于复杂旧结构，可以先使用：

```text
bodyEncoding = RAW_BYTES
```

但必须在 Registry 中声明 legacyMapping。

---

## 3. MVP 实现总览

| 类别 | MVP 必须实现 | 延后实现 |
|---|---|---|
| PayloadType | CONTROL / RPC / STREAM | 新增 PayloadType |
| Header Profile | Compact 必须，Standard 建议 | Dynamic Header |
| Control | HELLO / HELLO_ACK / HEARTBEAT / ACK / NACK / CLOSE | RESUME / WINDOW_UPDATE 高级策略 |
| RPC Encoding | BINARY 必须，JSON 建议 | CBOR / MessagePack |
| RPC Op | REQUEST / RESPONSE / EVENT | BATCH |
| Stream Profile | firmware.ota 必须，file/log 建议 | media/kvm/sensor |
| Type System | uint / bool / enum / bitmap / string / bytes | nested object 高级约束 |
| TLV | short TLV 必须，extended length 建议 | packed array 高级优化 |
| Registry | Method/Event/Error/Capability | 完整业务全集 |
| Generator | enum/constants/descriptors | 完整 SDK |
| C++ Demo | client/server/mock transport | 多平台产品 SDK |

---

## 4. MVP PayloadType Registry

### 4.1 表格

| ID | Name | Parser | MVP | 说明 |
|---:|---|---|---|---|
| `0x01` | `CONTROL` | `ControlParser` | 必须 | 协议运行时控制 |
| `0x02` | `RPC` | `RpcParser` | 必须 | 结构化业务请求、响应、事件 |
| `0x03` | `STREAM` | `StreamParser` | 必须 | 连续数据、大块数据、OTA/File/Log Chunk |

---

### 4.2 YAML

```yaml
payloadTypes:
  - id: 0x01
    name: CONTROL
    parser: ControlParser
    status: mvp
    description: Protocol runtime control payload.

  - id: 0x02
    name: RPC
    parser: RpcParser
    status: mvp
    description: Structured business request, response and event payload.

  - id: 0x03
    name: STREAM
    parser: StreamParser
    status: mvp
    description: Continuous or bulk data payload.
```

---

## 5. MVP Header Profile

### 5.1 MVP 必须支持 Compact Profile

MVP 首先面向 HID / BLE / UART / MCU，因此必须支持 Compact Profile。

推荐 Compact Header：

```text
+--------+--------+--------+--------+
| VT     | PayLen | MsgId  | FrInfo |
+--------+--------+--------+--------+
| Payload...                    |
+--------------------------------+
| CRC8                           |
+--------------------------------+
```

字段：

| 字段 | 长度 | MVP 要求 |
|---|---:|---|
| `VT` | 1B | 高 4bit version，低 4bit payloadType |
| `PayloadLength` | 1B | 必须，最大 255B |
| `MessageId` | 1B | 必须 |
| `FrameInfo` | 1B | 必须，4bit index + 4bit count |
| `CRC8` | 1B | 必须 |

Compact Profile 不包含 Magic；必须运行在 HID/BLE 等已有 packet 边界的传输上，或由传输适配层额外提供 COBS / SLIP / length-prefix 等 framing。

---

### 5.2 Standard Profile 在 MVP 中的定位

Standard Profile 建议在 WebSocket Binary / TCP demo 中支持，但不是 C++ MVP 的硬性前置。

如果人力有限，MVP 顺序为：

```text
Compact Profile -> Standard Profile
```

---

## 6. MVP Control Opcode Registry

### 6.1 MVP 必须实现

| Opcode | Name | Direction | Body | 说明 |
|---:|---|---|---|---|
| `0x01` | `HELLO` | Client -> Device | TLV | 建立协议会话，声明协议能力 |
| `0x02` | `HELLO_ACK` | Device -> Client | TLV | 返回协商结果 |
| `0x03` | `HEARTBEAT` | Both | Optional TLV | 保活 |
| `0x04` | `HEARTBEAT_ACK` | Both | Optional TLV | 保活响应 |
| `0x05` | `ACK` | Both | TLV | 确认 Frame / Message / Stream Chunk |
| `0x06` | `NACK` | Both | TLV | 否认 Frame / Message / Stream Chunk |
| `0x09` | `CLOSE` | Both | Optional TLV | 主动关闭会话 |
| `0x0A` | `CLOSE_ACK` | Both | Optional TLV | 关闭确认 |

---

### 6.2 MVP 可延后

| Opcode | Name | 延后原因 |
|---:|---|---|
| `0x07` | `RESUME` | 断点恢复可先由业务层 OTA resume 覆盖 |
| `0x08` | `RESUME_ACK` | 同上 |
| `0x0B` | `SESSION_RESET` | 可先使用 CLOSE + HELLO 重建 |
| `0x0C` | `WINDOW_UPDATE` | 第一版可使用固定窗口 |
| `0x0D` | `PING` | HEARTBEAT 已能覆盖基本保活 |
| `0x0E` | `PONG` | 同上 |

---

### 6.3 Control TLV MVP 字段

| fieldId | Name | Type | 用途 |
|---:|---|---|---|
| `0x01` | `sessionId` | `uint32` | 会话 ID |
| `0x02` | `protocolVersion` | `uint8` | 协议版本 |
| `0x03` | `headerProfile` | `uint8` | Compact / Standard |
| `0x04` | `maxFrameSize` | `uint16` | 最大 Frame |
| `0x05` | `maxPayloadSize` | `uint16` | 最大 Payload |
| `0x06` | `mtu` | `uint16` | 传输 MTU |
| `0x07` | `supportedPayloadTypes` | `bitmap32` | 支持的 PayloadType |
| `0x08` | `supportedRpcEncodings` | `bitmap32` | 支持的 RPC Encoding |
| `0x09` | `reserved` | - | 历史 `supportedStreamProfiles`，新实现不得使用 |
| `0x0A` | `heartbeatIntervalMs` | `uint16` | 心跳间隔 |
| `0x0B` | `ackMode` | `uint8` | ACK 模式 |
| `0x0C` | `windowSize` | `uint16` | 固定窗口 |
| `0x10` | `reasonCode` | `uint16` | 关闭或错误原因 |
| `0x11` | `messageId` | `uint16` | 被确认的 Message |
| `0x12` | `frameIndex` | `uint8` | 被确认的 Frame |
| `0x13` | `frameCount` | `uint8` | 总分片数 |
| `0x15` | `streamId` | `uint32` | 被确认的 Stream |
| `0x16` | `seqId` | `uint32` | 被确认的 Stream Chunk |
| `0x20` | `targetType` | `uint8` | ACK/NACK 目标类型 |

---

### 6.4 ACK targetType

| Value | Name | 说明 |
|---:|---|---|
| `0x01` | `FRAME` | 确认某个 Frame 分片 |
| `0x02` | `MESSAGE` | 确认完整 Message |
| `0x03` | `STREAM_CHUNK` | 确认某个 Stream Chunk |
| `0x04` | `CONTROL` | 确认某个 Control 消息 |

---

## 7. MVP RPC Registry

### 7.1 RPC Encoding

| ID | Name | MVP | 说明 |
|---:|---|---|---|
| `0x01` | `JSON` | 建议 | WebSocket Text / 调试 |
| `0x02` | `BINARY` | 必须 | HID / BLE / UART / MCU；bodyEncoding 推荐 TLV |
| `0x03` | `CBOR` | 延后 | 复杂对象 |
| `0x04` | `MSGPACK` | 延后 | 高级动态编码 |

`BINARY+TLV` 不是独立 wire enum，只是 `rpcEncoding=BINARY + bodyEncoding=TLV` 的推荐组合名称。

### 7.1.1 RPC Body Encoding

| ID | Name | MVP | 说明 |
|---:|---|---|---|
| `0x00` | `NONE` | 必须 | 无 body |
| `0x01` | `TLV` | 必须 | 结构化参数、结果和事件数据 |
| `0x02` | `JSON` | 建议 | DS-RPC Text Profile body |
| `0x03` | `CBOR` | 延后 | 动态对象 |
| `0x05` | `FIXED_STRUCT` | 延后 | 老协议固定布局适配 |
| `0x06` | `RAW_BYTES` | 必须 | 单次旧命令/响应 body 透传，必须声明 legacyMapping |

---

### 7.2 RPC Op

| rpcOp | Name | MVP | 说明 |
|---:|---|---|---|
| `0x01` | `REQUEST` | 必须 | 请求 |
| `0x02` | `RESPONSE` | 必须 | 响应 |
| `0x03` | `EVENT` | 必须 | 事件 |
| `0x04` | `BATCH_REQUEST` | 延后 | 批量请求 |
| `0x05` | `BATCH_RESPONSE` | 延后 | 批量响应 |

---

## 8. MVP MethodId Registry

### 8.1 MVP 方法列表

MVP 只实现最小可验证业务闭环。

| methodId | methodName | Domain | MVP | 说明 |
|---:|---|---|---|---|
| `0x0101` | `device.getInfo` | `device` | 必须 | 获取设备基础信息 |
| `0x0102` | `device.getVersion` | `device` | 必须 | 获取硬件、固件、协议版本 |
| `0x0105` | `device.getStatus` | `device` | 必须 | 获取设备运行状态 |
| `0x0301` | `capability.getAll` | `capability` | 必须 | 获取完整能力摘要 |
| `0x0302` | `capability.getDomain` | `capability` | 建议 | 获取指定域能力 |
| `0x0601` | `brightness.get` | `brightness` | 必须 | 获取亮度 |
| `0x0602` | `brightness.set` | `brightness` | 必须 | 设置亮度 |
| `0x0603` | `brightness.getRange` | `brightness` | 建议 | 获取亮度范围 |
| `0x0901` | `stream.open` | `stream` | 必须 | 打开 Stream |
| `0x0902` | `stream.close` | `stream` | 必须 | 关闭 Stream |
| `0x0905` | `stream.getStatus` | `stream` | 建议 | 查询 Stream 状态 |
| `0x0B01` | `firmware.getInfo` | `firmware` | 必须 | 获取固件信息 |
| `0x0B03` | `firmware.begin` | `firmware` | 必须 | 开始升级 |
| `0x0B05` | `firmware.end` | `firmware` | 必须 | 结束传输 |
| `0x0B06` | `firmware.verify` | `firmware` | 必须 | 校验固件 |
| `0x0B07` | `firmware.apply` | `firmware` | 建议 | 应用固件 |
| `0x0B08` | `firmware.abort` | `firmware` | 必须 | 中止升级 |
| `0x0B09` | `firmware.resume` | `firmware` | 建议 | 断点续传 |
| `0x0B0A` | `firmware.getProgress` | `firmware` | 建议 | 查询升级进度 |
| `0x2001` | `event.subscribe` | `event` | 建议 | 订阅事件 |
| `0x2002` | `event.unsubscribe` | `event` | 建议 | 取消订阅事件 |

---

### 8.2 MVP 方法分级

#### P0 必须实现

```text
device.getInfo
device.getVersion
device.getStatus
capability.getAll
brightness.get
brightness.set
stream.open
stream.close
firmware.getInfo
firmware.begin
firmware.end
firmware.verify
firmware.abort
```

#### P1 建议实现

```text
capability.getDomain
brightness.getRange
stream.getStatus
firmware.apply
firmware.resume
firmware.getProgress
event.subscribe
event.unsubscribe
```

#### P2 延后

```text
video.*
audio.*
file.*
log.*
diagnostic.*
input.*
network.*
storage.*
```

---

### 8.3 Method YAML MVP

```yaml
methods:
  - id: 0x0101
    name: device.getInfo
    domain: device
    status: mvp
    requestSchema: DeviceGetInfoRequest
    responseSchema: DeviceGetInfoResponse
    errors:
      - OK
      - DEVICE_BUSY
      - INTERNAL_ERROR

  - id: 0x0301
    name: capability.getAll
    domain: capability
    status: mvp
    requestSchema: CapabilityGetAllRequest
    responseSchema: CapabilityGetAllResponse
    errors:
      - OK
      - UNSUPPORTED_METHOD
      - INTERNAL_ERROR

  - id: 0x0602
    name: brightness.set
    domain: brightness
    status: mvp
    requestSchema: BrightnessSetRequest
    responseSchema: BrightnessSetResponse
    events:
      - brightness.changed
    errors:
      - OK
      - INVALID_ARGUMENT
      - OUT_OF_RANGE
      - DEVICE_BUSY

  - id: 0x0B03
    name: firmware.begin
    domain: firmware
    status: mvp
    requestSchema: FirmwareBeginRequest
    responseSchema: FirmwareBeginResponse
    stream:
      kind: OTA
    events:
      - firmware.updateStarted
      - firmware.updateProgress
      - firmware.updateFailed
    errors:
      - OK
      - DEVICE_BUSY
      - UNSUPPORTED_CAPABILITY
      - INVALID_ARGUMENT
```

---

## 9. MVP EventId Registry

### 9.1 MVP 事件列表

| eventId | eventName | Domain | MVP | 说明 |
|---:|---|---|---|---|
| `0x8103` | `device.statusChanged` | `device` | 必须 | 设备状态变化 |
| `0x8301` | `capability.changed` | `capability` | 建议 | 能力变化 |
| `0x8601` | `brightness.changed` | `brightness` | 必须 | 亮度变化 |
| `0x8901` | `stream.opened` | `stream` | 必须 | Stream 打开 |
| `0x8902` | `stream.closed` | `stream` | 必须 | Stream 关闭 |
| `0x8905` | `stream.error` | `stream` | 必须 | Stream 错误 |
| `0x8B01` | `firmware.updateStarted` | `firmware` | 必须 | OTA 开始 |
| `0x8B02` | `firmware.updateProgress` | `firmware` | 必须 | OTA 进度 |
| `0x8B03` | `firmware.updateCompleted` | `firmware` | 必须 | OTA 完成 |
| `0x8B04` | `firmware.updateFailed` | `firmware` | 必须 | OTA 失败 |
| `0x8B07` | `firmware.rebootRequired` | `firmware` | 建议 | 需要重启 |

---

### 9.2 Event YAML MVP

```yaml
events:
  - id: 0x8601
    name: brightness.changed
    domain: brightness
    status: mvp
    schema: BrightnessChangedEvent
    trigger:
      - brightness.set
      - device local change

  - id: 0x8B02
    name: firmware.updateProgress
    domain: firmware
    status: mvp
    schema: FirmwareUpdateProgressEvent
    trigger:
      - firmware.begin
      - STREAM OTA chunk received

  - id: 0x8905
    name: stream.error
    domain: stream
    status: mvp
    schema: StreamErrorEvent
    trigger:
      - stream parser error
      - stream timeout
      - chunk crc error
```

---

## 10. MVP ErrorCode Registry

### 10.1 MVP 错误码

| errorCode | Name | Layer | Retryable | 说明 |
|---:|---|---|---|---|
| `0x0000` | `OK` | common | false | 成功 |
| `0x0001` | `UNKNOWN_ERROR` | common | false | 未知错误 |
| `0x0002` | `INVALID_ARGUMENT` | common | false | 参数非法 |
| `0x0003` | `UNSUPPORTED_METHOD` | rpc | false | 不支持的方法 |
| `0x0004` | `UNSUPPORTED_CAPABILITY` | capability | false | 不支持的能力 |
| `0x0005` | `DEVICE_BUSY` | common | true | 设备忙 |
| `0x0006` | `TIMEOUT` | common | true | 超时 |
| `0x0007` | `OUT_OF_RANGE` | common | false | 参数越界 |
| `0x0008` | `RESOURCE_NOT_FOUND` | common | false | 资源不存在 |
| `0x0101` | `FRAME_CRC_ERROR` | frame | true | Frame CRC 错误 |
| `0x0102` | `FRAME_LENGTH_ERROR` | frame | false | Frame 长度错误 |
| `0x0103` | `UNSUPPORTED_PAYLOAD_TYPE` | frame | false | 不支持的 PayloadType |
| `0x0201` | `CONTROL_BAD_OPCODE` | control | false | Control Opcode 非法 |
| `0x0202` | `CONTROL_NEGOTIATION_FAILED` | control | false | 协商失败 |
| `0x0301` | `RPC_BAD_ENCODING` | rpc | false | RPC 编码不支持 |
| `0x0302` | `RPC_BAD_REQUEST` | rpc | false | RPC 请求非法 |
| `0x0303` | `RPC_SCHEMA_MISMATCH` | rpc | false | Schema 不匹配 |
| `0x0401` | `STREAM_PROFILE_UNSUPPORTED` | stream | false | Stream Profile 不支持 |
| `0x0402` | `STREAM_SEQ_MISMATCH` | stream | true | Stream 序号不连续 |
| `0x0403` | `STREAM_CHUNK_CRC_ERROR` | stream | true | Chunk CRC 错误 |
| `0x0404` | `STREAM_TIMEOUT` | stream | true | Stream 超时 |
| `0x0601` | `FIRMWARE_BAD_IMAGE` | firmware | false | 固件镜像非法 |
| `0x0602` | `FIRMWARE_VERIFY_FAILED` | firmware | false | 固件校验失败 |
| `0x0603` | `FIRMWARE_ROLLBACK_REQUIRED` | firmware | false | 需要回滚 |

---

### 10.2 ErrorCode YAML MVP

```yaml
errors:
  - code: 0x0000
    name: OK
    layer: common
    status: mvp
    retryable: false
    description: Success.

  - code: 0x0002
    name: INVALID_ARGUMENT
    layer: common
    status: mvp
    retryable: false
    description: Request argument is invalid.

  - code: 0x0101
    name: FRAME_CRC_ERROR
    layer: frame
    status: mvp
    retryable: true
    description: Frame CRC check failed.

  - code: 0x0403
    name: STREAM_CHUNK_CRC_ERROR
    layer: stream
    status: mvp
    retryable: true
    description: Stream chunk CRC check failed.
```

---

## 11. MVP Capability Registry

### 11.1 协议能力

| capabilityId | capabilityName | Type | MVP | 说明 |
|---:|---|---|---|---|
| `0x0001` | `protocol.version` | `uint8` | 必须 | AXTP 协议版本 |
| `0x0002` | `protocol.payloadTypes` | `bitmap32` | 必须 | 支持的 PayloadType |
| `0x0003` | `protocol.headerProfiles` | `bitmap32` | 必须 | 支持的 Header Profile |
| `0x0004` | `protocol.rpcEncodings` | `bitmap32` | 必须 | 支持的 RPC Encoding |
| `0x0005` | `protocol.streamProfiles` | `list<uint16>` | 必须 | 支持的 Stream Profile ID 列表 |
| `0x0006` | `protocol.maxFrameSize` | `uint16` | 必须 | 最大 Frame |
| `0x0007` | `protocol.maxPayloadSize` | `uint16` | 必须 | 最大 Payload |
| `0x0008` | `protocol.mtu` | `uint16` | 必须 | MTU |
| `0x0009` | `protocol.ackModes` | `bitmap32` | 必须 | ACK 模式 |
| `0x000A` | `protocol.windowSize` | `uint16` | 建议 | 固定窗口 |
| `0x000B` | `protocol.frameCrcProfiles` | `bitmap32` | 必须 | Standard=CRC16，Compact=CRC8 |
| `0x000C` | `protocol.messageIdWidths` | `bitmap32` | 必须 | Standard=16bit，Compact=8bit |

---

### 11.2 业务能力

| capabilityId | capabilityName | Type | MVP | 说明 |
|---:|---|---|---|---|
| `0x0101` | `device.info` | `bool` | 必须 | 支持设备信息查询 |
| `0x0102` | `device.version` | `bool` | 必须 | 支持版本查询 |
| `0x0301` | `capability.query` | `bool` | 必须 | 支持 capability.getAll |
| `0x0601` | `brightness.control` | `bool` | 必须 | 支持亮度控制 |
| `0x0602` | `brightness.range` | `range` | 建议 | 亮度范围 |
| `0x0901` | `stream.control` | `bool` | 必须 | 支持 Stream 控制 |
| `0x0902` | `stream.ota` | `bool` | 必须 | 支持 OTA Stream |
| `0x0B01` | `firmware.info` | `bool` | 必须 | 支持固件信息查询 |
| `0x0B02` | `firmware.update` | `bool` | 必须 | 支持固件升级 |
| `0x0B03` | `firmware.resume` | `bool` | 建议 | 支持断点续传 |

---

### 11.3 Capability YAML MVP

```yaml
capabilities:
  - id: 0x0001
    name: protocol.version
    domain: protocol
    type: uint8
    status: mvp

  - id: 0x0002
    name: protocol.payloadTypes
    domain: protocol
    type: bitmap32
    status: mvp
    enumRef: PayloadType

  - id: 0x0601
    name: brightness.control
    domain: brightness
    type: bool
    status: mvp
    methods:
      - brightness.get
      - brightness.set

  - id: 0x0B02
    name: firmware.update
    domain: firmware
    type: bool
    status: mvp
    methods:
      - firmware.begin
      - firmware.end
      - firmware.verify
      - firmware.abort
    streamProfiles:
      - firmware.ota
```

---

## 12. MVP Stream Registry

### 12.1 Stream Profile

Stream Profile 是可建流协议档案，不是 STREAM 数据包字段。Profile 由 RPC 建流方法协商并绑定到 `streamId`。

| profileId | Name | Domain | MVP | 默认 cursorUnit | 默认可靠性 | 说明 |
|---:|---|---|---|---|---|---|
| `0x0101` | `firmware.ota` | firmware | 必须 | `byteOffset` | reliable | 固件升级数据块上传 |
| `0x0201` | `file.upload` | file | 建议 | `byteOffset` | reliable | 文件上传 |
| `0x0202` | `file.download` | file | 建议 | `byteOffset` | reliable | 文件下载 |
| `0x0401` | `log.realtime` | log | 建议 | `timestampUs` | best_effort | 实时日志 |
| `0x8001` | `legacy.tunnel` | legacy | 延后 | `byteOffset` | reliable | 旧协议连续字节流隧道 |

---

### 12.2 OTA Stream MVP Metadata

OTA Stream 必须支持以下 metadata：

| fieldId | Name | Type | 说明 |
|---:|---|---|---|
| `0x01` | `transferId` | `uint32` | 传输 ID |
| `0x02` | `imageType` | `uint8` | 镜像类型 |
| `0x03` | `offset` | `uint32` | 当前偏移 |
| `0x04` | `chunkIndex` | `uint32` | 当前块序号 |
| `0x05` | `chunkSize` | `uint16` | 当前块大小 |
| `0x06` | `chunkCrc32` | `uint32` | 当前块 CRC32 |
| `0x07` | `totalSize` | `uint32` | 总大小 |
| `0x08` | `totalHash` | `bytes` | 完整镜像 Hash，可选 |

---

### 12.3 imageType MVP

| imageType | Name | MVP | 说明 |
|---:|---|---|---|
| `0x01` | `MCU_FIRMWARE` | 必须 | MCU 固件 |
| `0x02` | `LINUX_FIRMWARE` | 建议 | Linux 固件 |
| `0x03` | `RESOURCE_PACKAGE` | 建议 | 资源包 |
| `0x7F` | `VENDOR_IMAGE` | 延后 | 厂商私有镜像 |

---

## 13. MVP Type System 子集

MVP 必须支持以下类型：

| Type | MVP | 用途 |
|---|---|---|
| `uint8` | 必须 | enum、flags、小数值 |
| `uint16` | 必须 | length、status、size |
| `uint32` | 必须 | id、offset、crc32 |
| `uint64` | 建议 | timestamp、大文件 offset |
| `bool` | 必须 | capability、状态 |
| `enum` | 必须 | PayloadType、imageType |
| `bitmap32` | 必须 | 能力集合 |
| `string` | 必须 | 设备名、版本号 |
| `bytes` | 必须 | Hash、legacy payload |
| `array` | 建议 | method/event/capability 列表 |
| `object` | 延后 | 复杂嵌套结构 |

---

## 14. MVP TLV 子集

MVP TLV 必须支持：

```text
fieldId:uint8
length:uint8
value:N
```

建议同时支持扩展长度：

```text
length = 0xFF
extendedLength:uint16
value:N
```

MVP 解码器必须满足：

```text
支持未知字段跳过
支持字段顺序无关
支持 required 字段校验
支持重复字段报错
支持 deprecated 字段忽略
支持 bytes passthrough
```

MVP 编码器必须满足：

```text
按 fieldId 升序输出
不输出 default 值，除非 schema 要求
不输出 unknown 字段
不输出 deprecated 字段
```

---

## 15. MVP Schema 列表

MVP 至少需要以下 Schema：

### 15.1 Device

```text
DeviceGetInfoRequest
DeviceGetInfoResponse
DeviceGetVersionRequest
DeviceGetVersionResponse
DeviceGetStatusRequest
DeviceGetStatusResponse
DeviceStatusChangedEvent
```

### 15.2 Capability

```text
CapabilityGetAllRequest
CapabilityGetAllResponse
CapabilityGetDomainRequest
CapabilityGetDomainResponse
CapabilityChangedEvent
```

### 15.3 Brightness

```text
BrightnessGetRequest
BrightnessGetResponse
BrightnessSetRequest
BrightnessSetResponse
BrightnessGetRangeRequest
BrightnessGetRangeResponse
BrightnessChangedEvent
```

### 15.4 Stream

```text
StreamOpenRequest
StreamOpenResponse
StreamCloseRequest
StreamCloseResponse
StreamGetStatusRequest
StreamGetStatusResponse
StreamOpenedEvent
StreamClosedEvent
StreamErrorEvent
OtaStreamMetadata
```

### 15.5 Firmware

```text
FirmwareGetInfoRequest
FirmwareGetInfoResponse
FirmwareBeginRequest
FirmwareBeginResponse
FirmwareEndRequest
FirmwareEndResponse
FirmwareVerifyRequest
FirmwareVerifyResponse
FirmwareAbortRequest
FirmwareAbortResponse
FirmwareUpdateProgressEvent
FirmwareUpdateCompletedEvent
FirmwareUpdateFailedEvent
```

---

## 16. 老协议兼容 MVP

### 16.1 兼容目标

MVP 兼容不是为了保留旧协议形态，而是为了让旧设备命令平滑进入 AXTP Registry。

最小兼容目标：

```text
旧 CmdValue 可以映射到 AXTP methodId
旧 Payload 可以作为 RAW_BYTES body 传输
旧返回码可以映射到 AXTP errorCode
旧设备能力可以映射到 AXTP capability
旧 OTA 流程可以映射到 firmware.* + STREAM OTA
```

---

### 16.2 legacyMapping 字段

每个从旧协议迁移的方法都应声明：

```yaml
legacyMapping:
  protocol: AXDP_HID
  cmdValue: 0xC0021
  oldName: CommonSetVideoMode
  bodyEncoding: RAW_BYTES
  migration: keep_cmd_value_as_method_id
```

---

### 16.3 MVP 旧协议方法适配

| oldName | oldCmdValue | AXTP methodName | AXTP methodId | MVP |
|---|---:|---|---:|---|
| `BetaDeviceInfo` | `0xB0002` | `device.getInfo` | `0x0101` 或保留旧值 | 必须 |
| `CommonSetBrightness` | TBD | `brightness.set` | `0x0602` | 必须 |
| `CommonGetBrightness` | TBD | `brightness.get` | `0x0601` | 必须 |
| `AlphaUpgradeInfo` | `0xA0001` | `firmware.getInfo` | `0x0B01` 或保留旧值 | 必须 |
| `AlphaUpgradeStart` | TBD | `firmware.begin` | `0x0B03` | 必须 |
| `AlphaUpgradeEnd` | TBD | `firmware.end` | `0x0B05` | 必须 |
| `AlphaUpgradeVerify` | TBD | `firmware.verify` | `0x0B06` | 必须 |

说明：如果产品必须保持 wire-level CmdValue 不变，可以采用旧 CmdValue 作为 methodId；如果希望进入 AXTP 新编号体系，则必须在 legacyMapping 中保存 oldCmdValue。

---

## 17. Generator v1 MVP 输出

Generator v1 必须读取：

```text
registry/payload_type.yaml
registry/control_opcode.yaml
registry/rpc_encoding.yaml
registry/rpc_op.yaml
registry/method_registry_mvp.yaml
registry/event_registry_mvp.yaml
registry/error_code_mvp.yaml
registry/capability_registry_mvp.yaml
registry/stream_profile.yaml
schema/*.yaml
```

Generator v1 必须输出：

```text
generated/axtp_payload_type.h
generated/axtp_control_opcode.h
generated/axtp_rpc_encoding.h
generated/axtp_rpc_op.h
generated/axtp_method_id.h
generated/axtp_event_id.h
generated/axtp_error_code.h
generated/axtp_capability_id.h
generated/axtp_stream_profile.h
generated/axtp_schema_descriptor.h
```

Generator v1 必须校验：

```text
ID 不重复
name 不重复
methodId 在合法范围内
eventId 在合法范围内
errorCode 在合法范围内
capabilityId 在合法范围内
引用的 schema 必须存在
引用的 error 必须存在
引用的 event 必须存在
legacy cmdValue 不得冲突
status 必须为 draft/mvp/stable/deprecated/reserved 之一
```

---

## 18. C++ Demo v1 MVP 链路

C++ Demo v1 必须跑通以下链路。

### 18.1 建连链路

```text
Client -> Device : CONTROL HELLO
Device -> Client : CONTROL HELLO_ACK
```

验收：

```text
协商 payloadTypes = CONTROL/RPC/STREAM
协商 rpcEncoding = BINARY
协商 bodyEncoding = TLV
通过 firmware.begin 协商 profile = firmware.ota，并返回 streamId
协商 maxFrameSize / mtu / ackMode
```

---

### 18.2 基础 RPC 链路

```text
Client -> Device : RPC REQUEST device.getInfo
Device -> Client : RPC RESPONSE OK + DeviceGetInfoResponse
```

验收：

```text
requestId 正确匹配
methodId 正确解析
TLV body 正确解码
errorCode = OK
```

---

### 18.3 亮度控制链路

```text
Client -> Device : RPC REQUEST brightness.set(value=80)
Device -> Client : RPC RESPONSE OK
Device -> Client : RPC EVENT brightness.changed(value=80)
```

验收：

```text
brightness.set 参数校验
越界时返回 OUT_OF_RANGE
成功时触发 brightness.changed
```

---

### 18.4 OTA Stream 链路

```text
Client -> Device : RPC REQUEST firmware.begin
Device -> Client : RPC RESPONSE OK + transferId
Client -> Device : STREAM OTA chunk #0
Device -> Client : CONTROL ACK target=STREAM_CHUNK
Client -> Device : STREAM OTA chunk #1
Device -> Client : CONTROL ACK target=STREAM_CHUNK
Client -> Device : RPC REQUEST firmware.end
Device -> Client : RPC RESPONSE OK
Client -> Device : RPC REQUEST firmware.verify
Device -> Client : RPC RESPONSE OK
Device -> Client : RPC EVENT firmware.updateCompleted
```

验收：

```text
streamId/transferId 正确关联
seqId 单调递增
chunkCrc32 校验成功
ACK 指向正确 streamId + seqId
verify 失败时返回 FIRMWARE_VERIFY_FAILED
```

---

### 18.5 错误链路

```text
Client -> Device : bad CRC frame
Device -> Client : CONTROL NACK target=FRAME reason=FRAME_CRC_ERROR

Client -> Device : brightness.set(value=255, range=0..100)
Device -> Client : RPC RESPONSE error=OUT_OF_RANGE

Client -> Device : STREAM OTA chunk bad crc32
Device -> Client : CONTROL NACK target=STREAM_CHUNK reason=STREAM_CHUNK_CRC_ERROR
```

---

## 19. MVP 测试向量要求

MVP 至少提供以下测试向量：

| 编号 | 名称 | 类型 |
|---|---|---|
| TV-001 | Compact CONTROL HELLO | hex |
| TV-002 | Compact CONTROL HELLO_ACK | hex |
| TV-003 | RPC Binary device.getInfo request | hex |
| TV-004 | RPC Binary device.getInfo response | hex |
| TV-005 | RPC Binary brightness.set request | hex |
| TV-006 | RPC Binary brightness.changed event | hex |
| TV-007 | STREAM OTA chunk | hex |
| TV-008 | CONTROL ACK stream chunk | hex |
| TV-009 | CONTROL NACK frame crc error | hex |
| TV-010 | RPC error response OUT_OF_RANGE | hex |

每个测试向量必须包含：

```text
输入字段
编码后 hex
解码后结构
预期结果
错误码
```

---

## 20. MVP 验收标准

AXTP MVP 只有满足以下条件，才视为落地完成：

```text
1. Compact Header 编解码通过测试
2. CONTROL HELLO / HELLO_ACK 可跑通
3. CONTROL ACK / NACK 可跑通
4. RPC BINARY + TLV REQUEST / RESPONSE 可跑通
5. RPC EVENT 可跑通
6. device.getInfo 可跑通
7. capability.getAll 可跑通
8. brightness.get / brightness.set 可跑通
9. firmware.begin / end / verify / abort 可跑通
10. STREAM OTA chunk 可跑通
11. chunkCrc32 错误可 NACK
12. errorCode 可统一映射
13. Generator v1 可生成 C++ enum/constants/descriptors
14. C++ Demo 可以完成建连 + RPC + Event + OTA Stream 最小链路
15. 至少一个旧协议 CmdValue 可以通过 legacyMapping 进入 AXTP 方法注册表
```

---

## 21. MVP 到 v1.0 Stable 的升级路线

### 21.1 MVP -> Alpha

```text
补齐 WebSocket DS-RPC Text Profile demo
补齐 Standard Header
补齐更多测试向量
补齐老协议 method mapping
```

### 21.2 Alpha -> Beta

```text
补齐 FILE stream
补齐 LOG stream
补齐 capability.getDomain
补齐 event.subscribe / unsubscribe
补齐 generator markdown 输出
```

### 21.3 Beta -> Stable

```text
补齐完整 MethodId 注册表
补齐完整 EventId 注册表
补齐完整 ErrorCode 注册表
补齐完整 Capability 注册表
补齐 C++ SDK 基础封装
补齐跨传输 demo
```

---

## 22. 总结

AXTP MVP 的目标不是一次性完成所有业务能力，而是建立一个可验证、可迁移、可生成、可运行的最小协议闭环。

MVP 的核心路径是：

```text
CONTROL 建连
  -> RPC 能力查询
  -> RPC 基础控制
  -> RPC 事件上报
  -> STREAM OTA 数据传输
  -> CONTROL ACK/NACK
  -> ErrorCode 统一处理
  -> Registry YAML
  -> Generator v1
  -> C++ Demo v1
```

一旦这条链路跑通，AXTP 就从协议设计进入工程落地阶段。
