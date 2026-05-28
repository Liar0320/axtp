# 13《AXTP-MVP 最小实现注册表》

版本：v1.1 Draft  
状态：MVP / Implementation Contract（精简版）  
适用范围：AXTP v1 第一阶段落地最小注册表集合

---

## 1. MVP 设计原则

### 1.1 只实现闭环，不追求全集

MVP 必须覆盖：建连、能力查询、基础 RPC 请求/响应、基础事件上报、基础参数设置、基础 Stream 数据传输、ACK/NACK、错误处理、老协议 CmdValue 兼容。

MVP 暂不覆盖：完整音视频能力、完整文件系统、完整日志系统、完整诊断系统、完整输入/KVM、完整网络配置、完整权限系统、完整安全加密、完整压缩、完整多路复用调度、复杂 Batch RPC、复杂对象 Schema 反射。

### 1.2 PayloadType 只保留三种

AXTP MVP 固定只实现三种 PayloadType：`CONTROL / RPC / STREAM`。

STREAM 数据包不携带 `streamProfile`。MVP 中具体 Profile（例如 `firmware.ota`）由 `firmware.begin` 等领域建流方法协商并绑定到 `streamId`；通用 `stream.open` 属于 P1 能力。

### 1.3 Registry / Schema 是单一事实源

MVP 文档中的表格用于阅读和审查，最终实现以 `registry/*.yaml` 和 `schema/*.yaml` 为单一事实源。

### 1.4 老协议优先兼容，不推翻重写

```text
旧 CmdValue -> AXTP methodId
旧 Payload -> AXTP TLV body 或 legacy bytes（bodyEncoding = RAW_BYTES）
旧 status -> AXTP errorCode
旧设备能力表 -> AXTP capability
旧 OTA chunk -> AXTP STREAM OTA
```

对于复杂旧结构，可先使用 `bodyEncoding = RAW_BYTES`，但必须在 Registry 中声明 legacyMapping。

---

## 2. MVP 实现总览

| 类别 | MVP 必须实现 | 延后实现 |
| --- |---| --- |
| PayloadType | CONTROL / RPC / STREAM | 新增 PayloadType |
| Header Profile | Compact 必须，Standard 建议 | Dynamic Header |
| Control | OPEN / ACCEPT / HEARTBEAT / HEARTBEAT_ACK / ACK / NACK / CLOSE / CLOSE_ACK | RESUME / SESSION_RESET / WINDOW_UPDATE 高级策略 |
| RPC Encoding | BINARY 必须，JSON 建议 | CBOR / MessagePack |
| RPC Op | HELLO / IDENTIFY / IDENTIFIED / EVENT / REQUEST / REQUEST_RESPONSE | BATCH |
| Stream Profile | firmware.ota 必须，file/log 建议 | media/kvm/sensor |
| Type System | uint / bool / enum / bitmap / string / bytes | nested object 高级约束 |
| TLV | short TLV 必须，extended length 建议 | packed array 高级优化 |
| Registry | Method/Event/Error/Capability | 完整业务全集 |

---

## 3. MVP PayloadType Registry

| ID | Name | Parser | MVP |
|---:| --- |---| --- |
| `0x01` | `CONTROL` | `ControlParser` | 必须 |
| `0x02` | `RPC` | `RpcParser` | 必须 |
| `0x03` | `STREAM` | `StreamParser` | 必须 |

---

## 4. MVP Header Profile

### 4.1 Compact Profile（必须）

```text
+--------+--------+--------+--------+
| VT     | PayLen | MsgId  | FrInfo |
+--------+--------+--------+--------+
| Payload...                        |
+-----------------------------------+
| CRC8                              |
+-----------------------------------+
```

| 字段 | 长度 | 说明 |
| --- |---:| --- |
| `VT` | 1B | 高 4bit version，低 4bit payloadType |
| `PayloadLength` | 1B | 最大 255B |
| `MessageId` | 1B | 逻辑 Message ID |
| `FrameInfo` | 1B | 高 4bit FrameIndex，低 4bit FrameCount |
| `CRC8` | 1B | Footer，覆盖 Header(4B) + Payload |

Compact Profile 不包含 Magic；必须运行在 HID/BLE 等已有 packet 边界的传输上，或由传输适配层额外提供 COBS / SLIP / length-prefix 等 framing。

### 4.2 Standard Profile（建议）

Standard Profile 建议在 WebSocket Binary / TCP demo 中支持。如果人力有限，MVP 顺序为：Compact Profile → Standard Profile。

---

## 5. MVP Control Opcode Registry

### 5.1 MVP 必须实现

| Opcode | Name | Direction | Body | 说明 |
|---:| --- |---| --- |---|
| `0x01` | `OPEN` | Client → Device | TLV | 建立协议会话，声明协议能力 |
| `0x02` | `ACCEPT` | Device → Client | TLV | 返回协商结果 |
| `0x03` | `HEARTBEAT` | Both | Optional TLV | 保活 |
| `0x04` | `HEARTBEAT_ACK` | Both | Optional TLV | 保活响应 |
| `0x05` | `ACK` | Both | TLV | 确认 Frame / Message / Stream Chunk |
| `0x06` | `NACK` | Both | TLV | 否认 Frame / Message / Stream Chunk |
| `0x09` | `CLOSE` | Both | Optional TLV | 主动关闭会话 |
| `0x0A` | `CLOSE_ACK` | Both | Optional TLV | 关闭确认 |

### 5.2 MVP 可延后

| Opcode | Name | 延后原因 |
|---:| --- |---|
| `0x07` | `RESUME` | 断点恢复可先由业务层 OTA resume 覆盖 |
| `0x08` | `RESUME_ACK` | 同上 |
| `0x0B` | `SESSION_RESET` | 可先使用 CLOSE + OPEN 重建 |
| `0x0C` | `WINDOW_UPDATE` | 第一版可使用固定窗口 |
| `0x0D` | `PING` | HEARTBEAT 已能覆盖基本保活 |
| `0x0E` | `PONG` | 同上 |

### 5.3 Control TLV MVP 字段

| fieldId | Name | Type | 用途 |
|---:| --- |---| --- |
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

### 5.4 ACK targetType

| Value | Name | 说明 |
|---:| --- |---|
| `0x01` | `FRAME` | 确认某个 Frame 分片 |
| `0x02` | `MESSAGE` | 确认完整 Message |
| `0x03` | `STREAM_CHUNK` | 确认某个 Stream Chunk |
| `0x04` | `CONTROL` | 确认某个 Control 消息 |

---
## 6. MVP RPC Registry

### 6.1 RPC Encoding

| ID | Name | MVP | 说明 |
|---:| --- |---| --- |
| `0x01` | `JSON` | 建议 | WebSocket Text / 调试 |
| `0x02` | `BINARY` | 必须 | HID / BLE / UART / MCU；bodyEncoding 推荐 TLV |
| `0x03` | `CBOR` | 延后 | 复杂对象 |
| `0x04` | `MSGPACK` | 延后 | 高级动态编码 |

`BINARY+TLV8` 不是独立 wire enum，只是 `rpcEncoding=BINARY + bodyEncoding=TLV8` 的推荐组合名称。

### 6.2 RPC Body Encoding

| ID | Name | MVP | 说明 |
|---:| --- |---| --- |
| `0x00` | `NONE` | 必须 | 无 body |
| `0x01` | `TLV8` | 必须 | 1B fieldId + 1B length 的结构化参数、结果和事件数据 |
| `0x02` | `TLV16` | 延后 | 扩展长度 TLV |
| `0x03` | `RAW_BYTES` | 延后 | 单次旧命令/响应 body 透传，必须声明 legacyMapping |
| `0x04` | `CBOR_BODY` | 延后 | Binary RPC 内嵌 CBOR body |

### 6.3 RPC Op

| rpcOp | Name | MVP |
|---:| --- |---|
| `0x00` | `HELLO` | 必须 |
| `0x02` | `IDENTIFY` | 必须 |
| `0x03` | `IDENTIFIED` | 必须 |
| `0x06` | `EVENT` | 必须 |
| `0x07` | `REQUEST` | 必须 |
| `0x08` | `REQUEST_RESPONSE` | 必须 |
| `0x09` | `REQUEST_BATCH` | 延后 |
| `0x0A` | `REQUEST_BATCH_RESPONSE` | 延后 |

---

## 7. MVP MethodId Registry

### 7.1 MVP 方法列表

本节与 `standard/registry/method_registry.yaml` 保持一致；未出现在 YAML 中的方法均视为 P1/P2 规划，不属于 AXTP v1 MVP 合同。

| methodId | methodName | Domain | MVP | 说明 |
|---:| --- |---| --- |---|
| `0x0101` | `device.getInfo` | `device` | 必须 | 获取设备基础信息 |
| `0x0301` | `capability.getAll` | `capability` | 必须 | 获取完整能力摘要 |
| `0x0501` | `display.getBrightness` | `display` | 必须 | 获取亮度 |
| `0x0502` | `display.setBrightness` | `display` | 必须 | 设置亮度 |
| `0x0B02` | `firmware.begin` | `firmware` | 必须 | 开始升级 |
| `0x0B03` | `firmware.end` | `firmware` | 必须 | 结束传输 |
| `0x0B04` | `firmware.verify` | `firmware` | 必须 | 校验固件 |
| `0x0B05` | `firmware.apply` | `firmware` | 必须 | 应用固件 |

### 7.2 MVP 方法分级

P0 必须实现：`device.getInfo / capability.getAll / display.getBrightness / display.setBrightness / firmware.begin / firmware.end / firmware.verify / firmware.apply`

P1 建议实现：`capability.getDomain / display.getBrightnessRange / stream.open / stream.close / stream.getStatus / firmware.getInfo / firmware.abort / firmware.resume / firmware.getProgress`

P2 延后：`network.* / audio.* / camera.* / video.* / input.* / storage.* / file.* / log.* / diagnostic.* / auth.* / privacy.* / sensor.* / vendor.*`

---

## 8. MVP EventId Registry

本节与 `standard/registry/event_registry.yaml` 保持一致；`stream.*` 和 `device.statusChanged` 等事件为后续规划，不属于当前 YAML MVP。

`bitOffset` 为该事件在其 Domain 内的掩码位偏移，用于 `eventMasks` 域级订阅（见 08《Registry 总则》§23）。

| eventId | eventName | Domain | domainId | bitOffset | MVP | 说明 |
| ---: | --- | --- | ---: | ---: | --- | --- |
| `0x8507` | `display.brightnessChanged` | `display` | `0x85` | 0 | 必须 | 亮度变化 |
| `0x8B02` | `firmware.updateProgress` | `firmware` | `0x8B` | 0 | 必须 | OTA 进度 |
| `0x8B03` | `firmware.updateCompleted` | `firmware` | `0x8B` | 1 | 必须 | OTA 完成 |
| `0x8B04` | `firmware.updateFailed` | `firmware` | `0x8B` | 2 | 必须 | OTA 失败 |

---

## 9. MVP ErrorCode Registry

本节与 `standard/registry/error_code.yaml` 保持一致。更完整的错误码规划见 11《AXTP ErrorCode 注册表》，未进入 YAML 的错误名不得作为当前实现的 wire 合同。

| errorCode | Name | Layer | Retryable | 说明 |
|---:| --- |---| --- |---|
| `0x0000` | `SUCCESS` | common | false | 成功 |
| `0x0001` | `UNKNOWN_ERROR` | common | false | 未知错误 |
| `0x0005` | `BUSY` | common | true | 设备或资源忙 |
| `0x0102` | `FRAME_VERSION_UNSUPPORTED` | frame | false | Frame Version 不支持 |
| `0x0106` | `FRAME_CRC_ERROR` | frame | true | Frame CRC 错误 |
| `0x0108` | `FRAME_FRAGMENT_MISSING` | frame | true | 缺失 Frame 分片 |
| `0x0201` | `CONTROL_OPCODE_INVALID` | control | false | Control Opcode 非法 |
| `0x0202` | `CONTROL_PAYLOAD_INVALID` | control | false | Control Payload 非法 |
| `0x0204` | `CONTROL_OPEN_REQUIRED` | control | false | 会话尚未完成 OPEN |
| `0x0205` | `CONTROL_OPEN_REJECTED` | control | false | OPEN 被拒绝 |
| `0x0206` | `CONTROL_PROFILE_UNSUPPORTED` | control | false | Header Profile 不支持 |
| `0x0207` | `CONTROL_NEGOTIATION_FAILED` | control | false | 协商失败 |
| `0x0208` | `CONTROL_SESSION_INVALID` | control | false | SessionId 无效 |
| `0x020A` | `CONTROL_RESUME_FAILED` | control | false | 会话恢复失败 |
| `0x020C` | `CONTROL_WINDOW_EXCEEDED` | control | true | 超出流控窗口 |
| `0x0301` | `RPC_ENCODING_UNSUPPORTED` | rpc | false | RPC 编码不支持 |
| `0x0306` | `RPC_METHOD_NOT_FOUND` | rpc | false | methodId 或 method name 不支持 |
| `0x030B` | `RPC_PARAM_INVALID` | rpc | false | RPC 参数非法 |
| `0x0401` | `STREAM_NOT_FOUND` | stream | false | Stream Context 不存在 |
| `0x0402` | `STREAM_TIMEOUT` | stream | true | Stream 超时 |
| `0x0403` | `STREAM_CRC_ERROR` | stream | true | Chunk CRC 错误 |
| `0x060B` | `FW_VERIFY_FAILED` | firmware | false | 固件校验失败 |

---

## 10. MVP Capability Registry

本节与 `standard/registry/capability_registry.yaml` 保持一致，采用”单项 bool / 单项配置值”能力风格。

`bitOffset` 为该 capability 在其 Domain 内的掩码位偏移，用于 `capabilityMasks` 域级响应（见 08《Registry 总则》§23）。

| capabilityId | capabilityName | domainId | bitOffset | Type | MVP |
| ---: | --- | ---: | ---: | --- | --- |
| `0x0001` | `protocol.payload.control` | `0x01` | 0 | `bool` | 必须 |
| `0x0002` | `protocol.payload.rpc` | `0x01` | 1 | `bool` | 必须 |
| `0x0003` | `protocol.payload.stream` | `0x01` | 2 | `bool` | 必须 |
| `0x0101` | `device.info` | `0x01` | 3 | `bool` | 必须 |
| `0x0301` | `capability.get` | `0x03` | 0 | `bool` | 必须 |
| `0x0601` | `display.brightness` | `0x05` | 0 | `bool` | 必须 |
| `0x0602` | `display.brightnessMin` | `0x05` | 1 | `uint16` | 必须 |
| `0x0603` | `display.brightnessMax` | `0x05` | 2 | `uint16` | 必须 |
| `0x0604` | `display.brightnessStep` | `0x05` | 3 | `uint16` | 必须 |
| `0x0B01` | `firmware.ota` | `0x0B` | 0 | `object` | 必须 |

---

## 11. MVP Stream Registry

### 11.1 Stream Profile

Stream Profile 是可建流协议档案，不是 STREAM 数据包字段。Profile 由 RPC 建流方法协商并绑定到 `streamId`。

| profileId | Name | Domain | MVP | 默认 cursorUnit | 默认可靠性 |
|---:| --- |---| --- |---| --- |
| `0x0001` | `firmware.ota` | firmware | 必须 | `byteOffset` | reliable |
| `0x0002` | `file.transfer` | file | 延后 | `byteOffset` | reliable |

### 11.2 OTA Stream MVP Metadata

| fieldId | Name | Type | 说明 |
|---:| --- |---| --- |
| `0x01` | `transferId` | `uint32` | 传输 ID |
| `0x02` | `imageType` | `uint8` | 镜像类型 |
| `0x03` | `offset` | `uint32` | 当前偏移 |
| `0x04` | `chunkIndex` | `uint32` | 当前块序号 |
| `0x05` | `chunkSize` | `uint16` | 当前块大小 |
| `0x06` | `chunkCrc32` | `uint32` | 当前块 CRC32 |
| `0x07` | `totalSize` | `uint32` | 总大小 |
| `0x08` | `totalHash` | `bytes` | 完整镜像 Hash，可选 |

### 11.3 imageType MVP

| imageType | Name | MVP |
|---:| --- |---|
| `0x01` | `MCU_FIRMWARE` | 必须 |
| `0x02` | `LINUX_FIRMWARE` | 建议 |
| `0x03` | `RESOURCE_PACKAGE` | 建议 |
| `0x7F` | `VENDOR_IMAGE` | 延后 |

---

## 12. MVP Type System 子集

| Type | MVP | 用途 |
| --- |---| --- |
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

## 13. MVP TLV 子集

MVP TLV 必须支持：

```text
fieldId:uint8 / length:uint8 / value:N
```

建议同时支持扩展长度：

```text
length = 0xFF / extendedLength:uint16 / value:N
```

解码器必须满足：支持未知字段跳过、字段顺序无关、required 字段校验、重复字段报错、deprecated 字段忽略、bytes passthrough。

编码器必须满足：按 fieldId 升序输出、不输出 default 值（除非 schema 要求）、不输出 unknown 字段、不输出 deprecated 字段。

---

## 14. MVP Schema 列表

### 14.1 Device

```text
DeviceGetInfoRequest / DeviceGetInfoResponse
DeviceGetVersionRequest / DeviceGetVersionResponse
DeviceGetStatusRequest / DeviceGetStatusResponse
DeviceStatusChangedEvent
```

### 14.2 Capability

```text
CapabilityGetAllRequest / CapabilityGetAllResponse
CapabilityGetDomainRequest / CapabilityGetDomainResponse
CapabilityChangedEvent
```

### 14.3 Display Brightness

```text
DisplayGetBrightnessRequest / DisplayGetBrightnessResponse
DisplaySetBrightnessRequest / DisplaySetBrightnessResponse
DisplayGetBrightnessRangeRequest / DisplayGetBrightnessRangeResponse
DisplayBrightnessChangedEvent
```

### 14.4 Stream

```text
StreamOpenRequest / StreamOpenResponse
StreamCloseRequest / StreamCloseResponse
StreamGetStatusRequest / StreamGetStatusResponse
StreamOpenedEvent / StreamClosedEvent / StreamErrorEvent
OtaStreamMetadata
```

### 14.5 Firmware

```text
FirmwareGetInfoRequest / FirmwareGetInfoResponse
FirmwareBeginRequest / FirmwareBeginResponse
FirmwareEndRequest / FirmwareEndResponse
FirmwareVerifyRequest / FirmwareVerifyResponse
FirmwareAbortRequest / FirmwareAbortResponse
FirmwareUpdateProgressEvent / FirmwareUpdateCompletedEvent / FirmwareUpdateFailedEvent
```

---

## 15. 老协议兼容 MVP

最小兼容目标：旧 CmdValue 可以映射到 AXTP methodId；旧 Payload 可以作为 RAW_BYTES body 传输；旧返回码可以映射到 AXTP errorCode；旧设备能力可以映射到 AXTP capability；旧 OTA 流程可以映射到 firmware.* + STREAM OTA。

每个从旧协议迁移的方法都应声明：

```yaml
legacyMapping:
  protocol: AXDP_HID
  cmdValue: 0xC0021
  oldName: CommonSetVideoMode
  bodyEncoding: RAW_BYTES
  migration: keep_cmd_value_as_method_id
```

MVP 旧协议方法适配：

| oldName | oldCmdValue | AXTP methodName | AXTP methodId | MVP |
| --- |---:| --- |---:| --- |
| `BetaDeviceInfo` | `0xB0002` | `device.getInfo` | `0x0101` 或保留旧值 | 必须 |
| `CommonSetBrightness` | TBD | `display.setBrightness` | `0x0502` | 必须 |
| `CommonGetBrightness` | TBD | `display.getBrightness` | `0x0501` | 必须 |
| `AlphaUpgradeInfo` | `0xA0001` | `firmware.getInfo` | `0x0B01` 或保留旧值 | 必须 |
| `AlphaUpgradeStart` | TBD | `firmware.begin` | `0x0B03` | 必须 |
| `AlphaUpgradeEnd` | TBD | `firmware.end` | `0x0B05` | 必须 |
| `AlphaUpgradeVerify` | TBD | `firmware.verify` | `0x0B06` | 必须 |

AXTP `methodId` 固定为 uint16，旧 CmdValue 可能超过 uint16，不得直接作为 methodId。旧 CmdValue 必须保存在 legacyMapping 中，并唯一映射到 AXTP MethodId。
