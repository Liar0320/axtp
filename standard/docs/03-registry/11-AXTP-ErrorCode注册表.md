# 11《AXTP ErrorCode 注册表》

版本：v1.0  
状态：MVP Draft  
适用范围：AXTP Control / RPC / Stream / Registry / Generator / C++ Demo

---

## 1. 文档目的

本文档定义 AXTP 协议中的统一错误码注册表。

ErrorCode 用于表达：

```text
协议解析错误
Control 信令错误
RPC 调用错误
Stream 传输错误
业务执行错误
能力不支持错误
老协议适配错误
厂商扩展错误
```

ErrorCode 的目标不是替代日志，也不是承载详细错误文本，而是提供一个稳定、可机器处理、可跨语言生成 SDK 枚举的错误分类体系。

---

## 2. ErrorCode 的使用位置

AXTP ErrorCode 可以出现在以下位置：

```text
Control Payload.statusCode
RPC Response.statusCode
RPC Event.data.errorCode
STREAM NACK.reasonCode
TLV field: errorCode
C++ SDK Result.code
老协议适配层 legacyStatus -> errorCode
```

其中：

| 位置 | 用途 |
|---|---|
| `Control.statusCode` | 表达 OPEN / ACK / NACK / RESUME / CLOSE 等控制信令结果 |
| `RPC Response.statusCode` | 表达一次方法调用是否成功 |
| `STREAM NACK.reasonCode` | 表达流数据包失败原因 |
| `Event.data.errorCode` | 表达异步错误事件 |
| `SDK Result.code` | 给业务代码判断错误类型 |

---

## 3. 基本设计原则

### 3.1 ErrorCode 必须稳定

已经发布为 `stable` 的 ErrorCode 不允许改变语义。

错误码可以新增、废弃、保留，但不得复用已发布编号。

### 3.2 ErrorCode 只表达错误类别

ErrorCode 只表达机器可判断的错误类别。

详细错误信息应通过：

```text
errorMessage
errorDetail
vendorErrorCode
legacyStatus
traceId
```

等字段携带。

### 3.3 成功也是一种状态码

AXTP 保留 `0x0000` 作为统一成功码。

```text
0x0000 = OK
```

所有 Response / ACK 成功时，推荐使用该值。

### 3.4 跨层错误码统一注册

Control、RPC、Stream、Capability、OTA、File 等错误不应各自定义局部状态码，而应进入统一 ErrorCode Registry。

---

## 4. ErrorCode 编码格式

ErrorCode 使用：

```text
uint16
```

字节序遵循《05-AXTP-Type-System基础类型规范.md》中的统一字节序规则。

推荐在 C++ 中映射为：

```cpp
enum class AxtpErrorCode : uint16_t
```

---

## 5. ErrorCode 范围规划

| 范围 | 分类 | 说明 |
|---:|---|---|
| `0x0000-0x00FF` | Common | 通用成功与通用错误 |
| `0x0100-0x01FF` | Frame / Transport | 帧、Header、长度、CRC、分片、传输错误 |
| `0x0200-0x02FF` | Control | OPEN、ACK、NACK、RESUME、Session 控制错误 |
| `0x0300-0x03FF` | RPC | RPC 解析、方法、参数、响应错误 |
| `0x0400-0x04FF` | Stream | Stream 数据面、分块、窗口、续传错误 |
| `0x0500-0x05FF` | Capability | 能力发现、协商、不支持错误 |
| `0x0600-0x06FF` | Firmware / OTA | 固件升级错误 |
| `0x0700-0x07FF` | File | 文件传输与文件系统错误 |
| `0x0800-0x08FF` | Media | 视频、音频、媒体流错误 |
| `0x0900-0x09FF` | Device / System | 设备状态、系统资源、电源、存储等错误 |
| `0x0A00-0x0AFF` | Security | 认证、权限、加密、签名错误 |
| `0x0B00-0x0BFF` | Diagnostic | 诊断、产测、自检错误 |
| `0x7000-0x7EFF` | Vendor | 厂商私有错误 |
| `0x7F00-0x7FFF` | Legacy Adapter | 老协议适配错误 |
| `0x8000-0xFFFF` | Reserved | 保留 |

---

## 6. Common 通用错误码

| ErrorCode | 名称 | 说明 | MVP |
|---:|---|---|---|
| `0x0000` | `OK` | 成功 | 是 |
| `0x0001` | `UNKNOWN_ERROR` | 未知错误 | 是 |
| `0x0002` | `NOT_IMPLEMENTED` | 功能未实现 | 是 |
| `0x0003` | `NOT_SUPPORTED` | 当前设备或当前模式不支持 | 是 |
| `0x0004` | `INVALID_STATE` | 当前状态不允许执行 | 是 |
| `0x0005` | `BUSY` | 设备忙 | 是 |
| `0x0006` | `TIMEOUT` | 操作超时 | 是 |
| `0x0007` | `CANCELED` | 操作被取消 | 是 |
| `0x0008` | `RESOURCE_EXHAUSTED` | 资源不足 | 是 |
| `0x0009` | `PERMISSION_DENIED` | 权限不足 | 是 |
| `0x000A` | `INVALID_ARGUMENT` | 参数无效 | 是 |
| `0x000B` | `OUT_OF_RANGE` | 参数越界 | 是 |
| `0x000C` | `NOT_FOUND` | 资源不存在 | 是 |
| `0x000D` | `ALREADY_EXISTS` | 资源已存在 | 否 |
| `0x000E` | `INTERNAL_ERROR` | 内部错误 | 是 |
| `0x000F` | `UNAVAILABLE` | 服务暂不可用 | 否 |

---

## 7. Frame / Transport 错误码

| ErrorCode | 名称 | 说明 | MVP |
|---:|---|---|---|
| `0x0101` | `FRAME_MAGIC_INVALID` | Frame Magic 不正确 | 是 |
| `0x0102` | `FRAME_VERSION_UNSUPPORTED` | Frame Version 不支持 | 是 |
| `0x0103` | `FRAME_HEADER_INVALID` | Header 字段非法 | 是 |
| `0x0104` | `FRAME_LENGTH_INVALID` | PayloadLength 或总长度非法 | 是 |
| `0x0105` | `FRAME_PAYLOAD_TYPE_INVALID` | PayloadType 非法 | 是 |
| `0x0106` | `FRAME_CRC_ERROR` | CRC 校验失败 | 是 |
| `0x0107` | `FRAME_FRAGMENT_INVALID` | 分片字段非法 | 是 |
| `0x0108` | `FRAME_FRAGMENT_MISSING` | 缺失分片 | 是 |
| `0x0109` | `FRAME_REASSEMBLY_TIMEOUT` | 分片重组超时 | 是 |
| `0x010A` | `FRAME_TOO_LARGE` | Frame 超过协商上限 | 是 |
| `0x010B` | `TRANSPORT_MTU_EXCEEDED` | 超过传输 MTU | 是 |
| `0x010C` | `TRANSPORT_WRITE_FAILED` | 传输写入失败 | 否 |
| `0x010D` | `TRANSPORT_READ_FAILED` | 传输读取失败 | 否 |
| `0x010E` | `TRANSPORT_DISCONNECTED` | 传输连接断开 | 是 |

---

## 8. Control 错误码

| ErrorCode | 名称 | 说明 | MVP |
|---:|---|---|---|
| `0x0201` | `CONTROL_OPCODE_INVALID` | Control opcode 非法 | 是 |
| `0x0202` | `CONTROL_PAYLOAD_INVALID` | Control Payload 结构非法 | 是 |
| `0x0203` | `CONTROL_BODY_ENCODING_UNSUPPORTED` | Control bodyEncoding 不支持 | 是 |
| `0x0204` | `CONTROL_OPEN_REQUIRED` | 会话尚未 CONNECT | 是 |
| `0x0205` | `CONTROL_OPEN_REJECTED` | CONNECT 被拒绝 | 是 |
| `0x0206` | `CONTROL_PROFILE_UNSUPPORTED` | Header Profile 不支持 | 是 |
| `0x0207` | `CONTROL_NEGOTIATION_FAILED` | 协商失败 | 是 |
| `0x0208` | `CONTROL_SESSION_INVALID` | SessionId 无效 | 是 |
| `0x0209` | `CONTROL_SESSION_EXPIRED` | Session 已过期 | 是 |
| `0x020A` | `CONTROL_RESUME_FAILED` | 会话恢复失败 | 是 |
| `0x020B` | `CONTROL_ACK_TARGET_INVALID` | ACK/NACK targetType 非法 | 是 |
| `0x020C` | `CONTROL_WINDOW_EXCEEDED` | 超出流控窗口 | 是 |
| `0x020D` | `CONTROL_HEARTBEAT_TIMEOUT` | 心跳超时 | 是 |

---

## 9. RPC 错误码

| ErrorCode | 名称 | 说明 | MVP |
|---:|---|---|---|
| `0x0301` | `RPC_ENCODING_UNSUPPORTED` | rpcEncoding 不支持 | 是 |
| `0x0302` | `RPC_OP_INVALID` | rpcOp 非法 | 是 |
| `0x0303` | `RPC_PAYLOAD_INVALID` | RPC Payload 结构非法 | 是 |
| `0x0304` | `RPC_BODY_ENCODING_UNSUPPORTED` | bodyEncoding 不支持 | 是 |
| `0x0305` | `RPC_BODY_DECODE_FAILED` | Body 解码失败 | 是 |
| `0x0306` | `RPC_METHOD_NOT_FOUND` | methodId 不存在 | 是 |
| `0x0307` | `RPC_METHOD_NOT_SUPPORTED` | 方法存在但当前设备不支持 | 是 |
| `0x0308` | `RPC_METHOD_DISABLED` | 方法被禁用 | 否 |
| `0x0309` | `RPC_REQUEST_ID_INVALID` | requestId 非法 | 是 |
| `0x030A` | `RPC_PARAM_MISSING` | 缺少必填参数 | 是 |
| `0x030B` | `RPC_PARAM_INVALID` | 参数格式非法 | 是 |
| `0x030C` | `RPC_PARAM_OUT_OF_RANGE` | 参数越界 | 是 |
| `0x030D` | `RPC_EXECUTION_FAILED` | 方法执行失败 | 是 |
| `0x030E` | `RPC_RESPONSE_TIMEOUT` | RPC 响应超时 | 是 |
| `0x030F` | `RPC_BATCH_UNSUPPORTED` | 不支持 Batch | 否 |
| `0x0310` | `RPC_BATCH_PARTIAL_FAILED` | Batch 部分失败 | 否 |

---

## 10. Stream 错误码

| ErrorCode | 名称 | 说明 | MVP |
|---:|---|---|---|
| `0x0401` | `STREAM_PROFILE_UNSUPPORTED` | streamProfile 不支持 | 是 |
| `0x0402` | `STREAM_PAYLOAD_INVALID` | Stream Payload 结构非法 | 是 |
| `0x0403` | `STREAM_ID_INVALID` | streamId 无效 | 是 |
| `0x0404` | `STREAM_NOT_OPEN` | Stream 未打开 | 是 |
| `0x0405` | `STREAM_ALREADY_OPEN` | Stream 已打开 | 否 |
| `0x0406` | `STREAM_SEQ_INVALID` | seqId 非法 | 是 |
| `0x0407` | `STREAM_SEQ_DUPLICATED` | seqId 重复 | 否 |
| `0x0408` | `STREAM_CHUNK_MISSING` | 缺失 chunk | 是 |
| `0x0409` | `STREAM_CHUNK_CRC_ERROR` | chunkCrc 校验失败 | 是 |
| `0x040A` | `STREAM_OFFSET_INVALID` | offset 非法 | 是 |
| `0x040B` | `STREAM_WINDOW_FULL` | 接收窗口满 | 是 |
| `0x040C` | `STREAM_BACKPRESSURE` | 接收端反压 | 否 |
| `0x040D` | `STREAM_RESUME_UNSUPPORTED` | 不支持续传 | 是 |
| `0x040E` | `STREAM_RESUME_FAILED` | 续传失败 | 是 |
| `0x040F` | `STREAM_CLOSED` | Stream 已关闭 | 是 |
| `0x0410` | `STREAM_TRANSFER_ABORTED` | 传输被中止 | 是 |

---

## 11. Capability 错误码

| ErrorCode | 名称 | 说明 | MVP |
|---:|---|---|---|
| `0x0501` | `CAPABILITY_NOT_FOUND` | 能力不存在 | 是 |
| `0x0502` | `CAPABILITY_DOMAIN_NOT_FOUND` | 能力域不存在 | 是 |
| `0x0503` | `CAPABILITY_METHOD_UNSUPPORTED` | 方法能力不支持 | 是 |
| `0x0504` | `CAPABILITY_EVENT_UNSUPPORTED` | 事件能力不支持 | 是 |
| `0x0505` | `CAPABILITY_STREAM_UNSUPPORTED` | Stream 能力不支持 | 是 |
| `0x0506` | `CAPABILITY_ENCODING_UNSUPPORTED` | 编码能力不支持 | 是 |
| `0x0507` | `CAPABILITY_NEGOTIATION_FAILED` | 业务能力协商失败 | 是 |
| `0x0508` | `CAPABILITY_LIMIT_EXCEEDED` | 超过能力限制 | 是 |

---

## 12. Firmware / OTA 错误码

| ErrorCode | 名称 | 说明 | MVP |
|---:|---|---|---|
| `0x0601` | `FW_IMAGE_INVALID` | 固件镜像非法 | 是 |
| `0x0602` | `FW_IMAGE_TYPE_UNSUPPORTED` | 固件镜像类型不支持 | 是 |
| `0x0603` | `FW_VERSION_UNSUPPORTED` | 固件版本不支持 | 是 |
| `0x0604` | `FW_VERSION_TOO_OLD` | 固件版本过旧 | 否 |
| `0x0605` | `FW_TRANSFER_NOT_STARTED` | 固件传输未开始 | 是 |
| `0x0606` | `FW_TRANSFER_ALREADY_STARTED` | 固件传输已开始 | 否 |
| `0x0607` | `FW_CHUNK_INVALID` | 固件分块非法 | 是 |
| `0x0608` | `FW_CHUNK_CRC_ERROR` | 固件分块 CRC 错误 | 是 |
| `0x0609` | `FW_SIZE_MISMATCH` | 固件大小不匹配 | 是 |
| `0x060A` | `FW_HASH_MISMATCH` | 固件 Hash 不匹配 | 是 |
| `0x060B` | `FW_VERIFY_FAILED` | 固件校验失败 | 是 |
| `0x060C` | `FW_APPLY_FAILED` | 固件应用失败 | 是 |
| `0x060D` | `FW_ROLLBACK_FAILED` | 固件回滚失败 | 否 |
| `0x060E` | `FW_STORAGE_NOT_ENOUGH` | 升级存储空间不足 | 是 |
| `0x060F` | `FW_DEVICE_NOT_READY` | 设备不满足升级条件 | 是 |
| `0x0610` | `FW_REBOOT_REQUIRED` | 需要重启后继续 | 否 |

---

## 13. File 错误码

| ErrorCode | 名称 | 说明 | MVP |
|---:|---|---|---|
| `0x0701` | `FILE_NOT_FOUND` | 文件不存在 | 是 |
| `0x0702` | `FILE_ALREADY_EXISTS` | 文件已存在 | 否 |
| `0x0703` | `FILE_PERMISSION_DENIED` | 文件权限不足 | 是 |
| `0x0704` | `FILE_PATH_INVALID` | 文件路径非法 | 是 |
| `0x0705` | `FILE_TYPE_UNSUPPORTED` | 文件类型不支持 | 是 |
| `0x0706` | `FILE_TOO_LARGE` | 文件过大 | 是 |
| `0x0707` | `FILE_READ_FAILED` | 文件读取失败 | 是 |
| `0x0708` | `FILE_WRITE_FAILED` | 文件写入失败 | 是 |
| `0x0709` | `FILE_DELETE_FAILED` | 文件删除失败 | 否 |
| `0x070A` | `FILE_TRANSFER_FAILED` | 文件传输失败 | 是 |
| `0x070B` | `FILE_VERIFY_FAILED` | 文件校验失败 | 是 |
| `0x070C` | `FILE_STORAGE_FULL` | 存储空间不足 | 是 |

---

## 14. Media 错误码

| ErrorCode | 名称 | 说明 | MVP |
|---:|---|---|---|
| `0x0801` | `MEDIA_SOURCE_NOT_FOUND` | 媒体源不存在 | 是 |
| `0x0802` | `MEDIA_SOURCE_UNAVAILABLE` | 媒体源不可用 | 是 |
| `0x0803` | `MEDIA_CODEC_UNSUPPORTED` | 编解码格式不支持 | 是 |
| `0x0804` | `MEDIA_RESOLUTION_UNSUPPORTED` | 分辨率不支持 | 是 |
| `0x0805` | `MEDIA_FRAMERATE_UNSUPPORTED` | 帧率不支持 | 是 |
| `0x0806` | `MEDIA_BITRATE_UNSUPPORTED` | 码率不支持 | 否 |
| `0x0807` | `MEDIA_STREAM_START_FAILED` | 媒体流启动失败 | 是 |
| `0x0808` | `MEDIA_STREAM_STOP_FAILED` | 媒体流停止失败 | 否 |
| `0x0809` | `MEDIA_FRAME_DROPPED` | 媒体帧丢失 | 否 |
| `0x080A` | `MEDIA_AUDIO_DEVICE_NOT_FOUND` | 音频设备不存在 | 否 |
| `0x080B` | `MEDIA_VIDEO_SIGNAL_LOST` | 视频信号丢失 | 否 |

---

## 15. Device / System 错误码

| ErrorCode | 名称 | 说明 | MVP |
|---:|---|---|---|
| `0x0901` | `DEVICE_INFO_UNAVAILABLE` | 设备信息不可用 | 是 |
| `0x0902` | `DEVICE_REBOOT_FAILED` | 设备重启失败 | 否 |
| `0x0903` | `DEVICE_FACTORY_RESET_FAILED` | 恢复出厂失败 | 否 |
| `0x0904` | `DEVICE_LOW_POWER` | 电量或供电不足 | 否 |
| `0x0905` | `DEVICE_OVER_TEMPERATURE` | 设备过温 | 否 |
| `0x0906` | `DEVICE_STORAGE_FULL` | 设备存储满 | 是 |
| `0x0907` | `DEVICE_MODE_CONFLICT` | 当前模式冲突 | 是 |
| `0x0908` | `DEVICE_RESOURCE_BUSY` | 设备资源占用 | 是 |
| `0x0909` | `DEVICE_HARDWARE_FAILURE` | 硬件故障 | 否 |

---

## 16. Security 错误码

| ErrorCode | 名称 | 说明 | MVP |
|---:|---|---|---|
| `0x0A01` | `SEC_AUTH_REQUIRED` | 需要认证 | 否 |
| `0x0A02` | `SEC_AUTH_FAILED` | 认证失败 | 否 |
| `0x0A03` | `SEC_PERMISSION_DENIED` | 权限不足 | 否 |
| `0x0A04` | `SEC_ENCRYPTION_REQUIRED` | 需要加密通道 | 否 |
| `0x0A05` | `SEC_DECRYPT_FAILED` | 解密失败 | 否 |
| `0x0A06` | `SEC_SIGNATURE_INVALID` | 签名非法 | 否 |
| `0x0A07` | `SEC_CERT_INVALID` | 证书非法 | 否 |
| `0x0A08` | `SEC_TOKEN_EXPIRED` | Token 过期 | 否 |

安全错误码进入注册表，但不属于 MVP 必须实现范围。

---

## 17. Diagnostic 错误码

| ErrorCode | 名称 | 说明 | MVP |
|---:|---|---|---|
| `0x0B01` | `DIAG_TEST_NOT_FOUND` | 测试项不存在 | 否 |
| `0x0B02` | `DIAG_TEST_UNSUPPORTED` | 测试项不支持 | 否 |
| `0x0B03` | `DIAG_TEST_RUNNING` | 测试正在运行 | 否 |
| `0x0B04` | `DIAG_TEST_FAILED` | 测试失败 | 否 |
| `0x0B05` | `DIAG_METRIC_UNAVAILABLE` | 指标不可用 | 否 |
| `0x0B06` | `DIAG_LOOPBACK_FAILED` | 回环测试失败 | 否 |

---

## 18. Vendor 错误码

厂商私有错误码范围：

```text
0x7000-0x7EFF
```

建议按厂商内部模块继续划分，但不得占用 AXTP 标准错误码范围。

厂商错误应同时携带：

```text
vendorId
vendorErrorCode
vendorErrorMessage
```

示例：

```yaml
- code: 0x7001
  name: VENDOR_DEVICE_CUSTOM_ERROR
  category: vendor
  owner: vendor
  status: draft
```

---

## 19. Legacy Adapter 错误码

老协议适配错误码范围：

```text
0x7F00-0x7FFF
```

| ErrorCode | 名称 | 说明 | MVP |
|---:|---|---|---|
| `0x7F01` | `LEGACY_CMD_UNMAPPED` | 旧 CmdValue 未映射到 methodId | 是 |
| `0x7F02` | `LEGACY_STATUS_UNMAPPED` | 旧状态码未映射到 ErrorCode | 是 |
| `0x7F03` | `LEGACY_PAYLOAD_INVALID` | 旧 Payload 结构非法 | 是 |
| `0x7F04` | `LEGACY_PAYLOAD_TOO_SHORT` | 旧 Payload 长度不足 | 是 |
| `0x7F05` | `LEGACY_PAYLOAD_TOO_LONG` | 旧 Payload 长度过长 | 是 |
| `0x7F06` | `LEGACY_FIELD_UNSUPPORTED` | 旧字段无法适配 | 是 |
| `0x7F07` | `LEGACY_CAPABILITY_CONFLICT` | 旧能力与 AXTP 能力冲突 | 是 |
| `0x7F08` | `LEGACY_RESPONSE_TIMEOUT` | 旧协议响应超时 | 是 |

---

## 20. MVP ErrorCode 最小集合

C++ Demo v1 和 Generator v1 必须至少实现以下错误码：

```text
OK
UNKNOWN_ERROR
NOT_IMPLEMENTED
NOT_SUPPORTED
INVALID_STATE
BUSY
TIMEOUT
INVALID_ARGUMENT
OUT_OF_RANGE
NOT_FOUND
INTERNAL_ERROR

FRAME_MAGIC_INVALID
FRAME_VERSION_UNSUPPORTED
FRAME_HEADER_INVALID
FRAME_LENGTH_INVALID
FRAME_PAYLOAD_TYPE_INVALID
FRAME_CRC_ERROR
FRAME_FRAGMENT_MISSING
FRAME_REASSEMBLY_TIMEOUT
FRAME_TOO_LARGE
TRANSPORT_DISCONNECTED

CONTROL_OPCODE_INVALID
CONTROL_PAYLOAD_INVALID
CONTROL_OPEN_REQUIRED
CONTROL_OPEN_REJECTED
CONTROL_SESSION_INVALID
CONTROL_ACK_TARGET_INVALID
CONTROL_HEARTBEAT_TIMEOUT

RPC_ENCODING_UNSUPPORTED
RPC_OP_INVALID
RPC_PAYLOAD_INVALID
RPC_BODY_DECODE_FAILED
RPC_METHOD_NOT_FOUND
RPC_METHOD_NOT_SUPPORTED
RPC_PARAM_MISSING
RPC_PARAM_INVALID
RPC_PARAM_OUT_OF_RANGE
RPC_EXECUTION_FAILED
RPC_RESPONSE_TIMEOUT

STREAM_PROFILE_UNSUPPORTED
STREAM_PAYLOAD_INVALID
STREAM_ID_INVALID
STREAM_NOT_OPEN
STREAM_SEQ_INVALID
STREAM_CHUNK_MISSING
STREAM_CHUNK_CRC_ERROR
STREAM_WINDOW_FULL
STREAM_RESUME_FAILED
STREAM_TRANSFER_ABORTED

CAPABILITY_NOT_FOUND
CAPABILITY_METHOD_UNSUPPORTED
CAPABILITY_STREAM_UNSUPPORTED
CAPABILITY_LIMIT_EXCEEDED

FW_IMAGE_INVALID
FW_TRANSFER_NOT_STARTED
FW_CHUNK_INVALID
FW_CHUNK_CRC_ERROR
FW_HASH_MISMATCH
FW_VERIFY_FAILED
FW_APPLY_FAILED
FW_STORAGE_NOT_ENOUGH

LEGACY_CMD_UNMAPPED
LEGACY_STATUS_UNMAPPED
LEGACY_PAYLOAD_INVALID
```

---

## 21. ErrorCode 与 RPC Response 的关系

RPC Response 推荐结构：

```text
rpcOp = RESPONSE
requestId = 原请求 requestId
methodId = 原请求 methodId
statusCode = ErrorCode
body = result 或 error detail
```

成功：

```text
statusCode = 0x0000 OK
body = result
```

失败：

```text
statusCode = 非 OK ErrorCode
body = error detail TLV
```

错误详情 TLV 建议字段：

| fieldId | 名称 | 类型 | 说明 |
|---:|---|---|---|
| `0x01` | `errorCode` | uint16 | AXTP ErrorCode |
| `0x02` | `errorMessage` | string | 简短错误信息 |
| `0x03` | `errorDetail` | bytes/string | 详细错误信息 |
| `0x04` | `legacyStatus` | uint16/uint32 | 老协议状态码 |
| `0x05` | `vendorErrorCode` | uint32 | 厂商错误码 |
| `0x06` | `traceId` | bytes/string | 调试追踪 ID |

---

## 22. ErrorCode 与 Control ACK / NACK 的关系

Control ACK 成功时：

```text
opcode = ACK
statusCode = OK
```

Control NACK 失败时：

```text
opcode = NACK
statusCode = 对应 ErrorCode
body TLV:
  targetType
  messageId
  frameIndex
  streamId
  seqId
  reasonCode
```

其中 `reasonCode` 推荐直接使用 ErrorCode。

---

## 23. ErrorCode 与 Stream 的关系

Stream 数据包本身不直接塞复杂错误对象。

Stream 失败推荐通过 Control NACK 或 RPC Event 上报：

```text
CONTROL NACK:
  reasonCode = STREAM_CHUNK_CRC_ERROR

RPC EVENT:
  eventId = stream.error
  data.errorCode = STREAM_RESUME_FAILED
```

---

## 24. 老协议状态码映射原则

老协议状态码迁移到 AXTP 时应遵循：

```text
旧协议成功状态 -> OK
旧协议参数错误 -> RPC_PARAM_INVALID / INVALID_ARGUMENT
旧协议忙 -> BUSY
旧协议超时 -> TIMEOUT
旧协议不支持 -> NOT_SUPPORTED / RPC_METHOD_NOT_SUPPORTED
旧协议 CRC 错误 -> FRAME_CRC_ERROR 或 STREAM_CHUNK_CRC_ERROR
旧协议升级校验失败 -> FW_VERIFY_FAILED / FW_HASH_MISMATCH
无法映射 -> LEGACY_STATUS_UNMAPPED
```

示例：

| Legacy Status | 含义 | AXTP ErrorCode |
|---:|---|---|
| `0x00` | success | `OK` |
| `0x01` | failed | `UNKNOWN_ERROR` |
| `0x02` | invalid parameter | `RPC_PARAM_INVALID` |
| `0x03` | unsupported command | `RPC_METHOD_NOT_SUPPORTED` |
| `0x04` | busy | `BUSY` |
| `0x05` | timeout | `TIMEOUT` |
| `0x06` | crc error | `FRAME_CRC_ERROR` 或 `STREAM_CHUNK_CRC_ERROR` |
| 未知 | 未映射 | `LEGACY_STATUS_UNMAPPED` |

---

## 25. YAML 单一事实源示例

```yaml
errorCodes:
  - code: 0x0000
    name: OK
    category: common
    status: stable
    mvp: true
    description: Operation completed successfully.

  - code: 0x0306
    name: RPC_METHOD_NOT_FOUND
    category: rpc
    status: mvp
    mvp: true
    description: The requested methodId is not registered.
    retryable: false

  - code: 0x0409
    name: STREAM_CHUNK_CRC_ERROR
    category: stream
    status: mvp
    mvp: true
    description: Stream chunk CRC validation failed.
    retryable: true

  - code: 0x7F02
    name: LEGACY_STATUS_UNMAPPED
    category: legacy
    status: mvp
    mvp: true
    description: Legacy status code cannot be mapped to AXTP error code.
```

---

## 26. Generator v1 输出要求

Generator v1 必须从 `error_code.yaml` 生成：

```text
C++ enum class AxtpErrorCode
C++ error category 判断函数
C++ error name 字符串表
C++ retryable 判断函数
Markdown 错误码表
JSON 错误码索引
```

示例 C++ 输出：

```cpp
enum class AxtpErrorCode : uint16_t {
    OK = 0x0000,
    UNKNOWN_ERROR = 0x0001,
    RPC_METHOD_NOT_FOUND = 0x0306,
    STREAM_CHUNK_CRC_ERROR = 0x0409,
    LEGACY_STATUS_UNMAPPED = 0x7F02,
};

bool IsRetryable(AxtpErrorCode code);
const char* ToString(AxtpErrorCode code);
AxtpErrorCategory GetErrorCategory(AxtpErrorCode code);
```

---

## 27. C++ Demo v1 使用要求

C++ Demo v1 必须覆盖以下错误路径：

```text
非法 Magic -> FRAME_MAGIC_INVALID
非法 PayloadType -> FRAME_PAYLOAD_TYPE_INVALID
CRC 错误 -> FRAME_CRC_ERROR
未 CONNECT 直接 RPC -> CONTROL_OPEN_REQUIRED
未知 methodId -> RPC_METHOD_NOT_FOUND
参数缺失 -> RPC_PARAM_MISSING
参数越界 -> RPC_PARAM_OUT_OF_RANGE
未打开 stream 发送 chunk -> STREAM_NOT_OPEN
OTA chunk CRC 错误 -> FW_CHUNK_CRC_ERROR 或 STREAM_CHUNK_CRC_ERROR
旧 CmdValue 无映射 -> LEGACY_CMD_UNMAPPED
```

---

## 28. 测试向量建议

后续 TestVector 文档中应至少提供：

```text
RPC success response: statusCode = OK
RPC unknown method: statusCode = RPC_METHOD_NOT_FOUND
RPC invalid param: statusCode = RPC_PARAM_INVALID
Control NACK crc error: statusCode = FRAME_CRC_ERROR
Stream chunk crc error: reasonCode = STREAM_CHUNK_CRC_ERROR
Firmware verify failed: statusCode = FW_VERIFY_FAILED
Legacy unmapped status: statusCode = LEGACY_STATUS_UNMAPPED
```

---

## 29. 后续演进规则

ErrorCode 演进必须遵循：

```text
只新增，不复用
stable 错误码语义不可变
deprecated 错误码仍需保留解析
vendor 错误码不得进入标准范围
legacy 错误码只用于适配层
错误详情通过 TLV 扩展，不通过新增大量细碎错误码解决
```

---

## 30. 总结

AXTP ErrorCode 注册表的核心目标是：

```text
统一错误表达
稳定跨层分类
便于 SDK 生成
便于老协议迁移
便于 C++ Demo 和测试向量落地
```

MVP 阶段必须优先覆盖：

```text
Frame 解析错误
Control 会话错误
RPC 方法与参数错误
Stream 数据错误
Firmware OTA 错误
Legacy Adapter 错误
```

这样可以保证协议在最小实现阶段已经具备完整的问题定位和自动化测试能力。
