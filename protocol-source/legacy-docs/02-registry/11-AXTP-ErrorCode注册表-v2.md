# 11《AXTP ErrorCode 注册表》

版本：v1.1 Draft
状态：MVP ErrorCode 注册表（精简版）
适用范围：AXTP Control / RPC / Stream 统一错误码分配与使用规则

---
## 1. ErrorCode 的使用位置

| 位置 | 用途 |
|---|---|
| `Control.statusCode` | OPEN / ACK / NACK / RESUME / CLOSE 等控制信令结果 |
| `RPC Response.status.code` / Binary `statusCode` | 一次方法调用是否成功 |
| `STREAM NACK.reasonCode` | 流数据包失败原因 |
| `Event.data.errorCode` | 异步错误事件 |

---

## 2. 基本设计原则

- 已发布为 `stable` 的 ErrorCode 不允许改变语义；可新增、废弃、保留，但不得复用已发布编号
- ErrorCode 只表达机器可判断的错误类别；详细错误信息通过 RPC `status.msg / status.details`、Control `errorDetail`、厂商 `vendorErrorCode / vendorErrorMessage`、legacyStatus、traceId 等字段携带
- `0x0000 = SUCCESS`，所有 Response / ACK 成功时必须使用该值
- Control、RPC、Stream、Capability、OTA、File 等错误统一进入 ErrorCode Registry，不各自定义局部状态码
- ErrorCode 使用 `uint16`，字节序 Little-Endian

---

## 3. ErrorCode 范围规划

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

## 4. Common 通用错误码

| ErrorCode | 名称 | 说明 | MVP |
|---:|---|---|---|
| `0x0000` | `SUCCESS` | 成功 | 是 |
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

## 5. Frame / Transport 错误码

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

## 6. Control 错误码

| ErrorCode | 名称 | 说明 | MVP |
|---:|---|---|---|
| `0x0201` | `CONTROL_OPCODE_INVALID` | Control opcode 非法 | 是 |
| `0x0202` | `CONTROL_PAYLOAD_INVALID` | Control Payload 结构非法 | 是 |
| `0x0203` | `CONTROL_BODY_ENCODING_UNSUPPORTED` | Control bodyEncoding 不支持 | 是 |
| `0x0204` | `CONTROL_OPEN_REQUIRED` | 会话尚未 OPEN | 是 |
| `0x0205` | `CONTROL_OPEN_REJECTED` | OPEN 被拒绝 | 是 |
| `0x0206` | `RESERVED_CONTROL_PROFILE_UNSUPPORTED` | 历史 Header Profile 协商错误，v1 新实现不得产生 | 是 |
| `0x0207` | `CONTROL_NEGOTIATION_FAILED` | 协商失败 | 是 |
| `0x0208` | `CONTROL_SESSION_INVALID` | SessionId 无效 | 是 |
| `0x0209` | `CONTROL_SESSION_EXPIRED` | Session 已过期 | 是 |
| `0x020A` | `CONTROL_RESUME_FAILED` | 会话恢复失败 | 是 |
| `0x020B` | `CONTROL_ACK_TARGET_INVALID` | ACK/NACK targetType 非法 | 是 |
| `0x020C` | `CONTROL_WINDOW_EXCEEDED` | 超出流控窗口 | 是 |
| `0x020D` | `CONTROL_HEARTBEAT_TIMEOUT` | 心跳超时 | 是 |

---

## 7. RPC 错误码

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

## 8. Stream 错误码

| ErrorCode | 名称 | 说明 | MVP |
|---:|---|---|---|
| `0x0401` | `STREAM_NOT_FOUND` | streamId 对应的 Stream Context 不存在 | 是 |
| `0x0402` | `STREAM_TIMEOUT` | Stream 超时 | 是 |
| `0x0403` | `STREAM_CRC_ERROR` | Stream chunk CRC 校验失败 | 是 |
| `0x0404` | `STREAM_PAYLOAD_INVALID` | Stream Payload 结构非法 | 是 |
| `0x0405` | `STREAM_ID_INVALID` | streamId 无效 | 是 |
| `0x0406` | `STREAM_NOT_OPEN` | Stream 未打开 | 是 |
| `0x0407` | `STREAM_ALREADY_OPEN` | Stream 已打开 | 否 |
| `0x0408` | `STREAM_SEQ_INVALID` | seqId 非法 | 是 |
| `0x0409` | `STREAM_SEQ_DUPLICATED` | seqId 重复 | 否 |
| `0x040A` | `STREAM_CHUNK_MISSING` | 缺失 chunk | 是 |
| `0x040B` | `STREAM_OFFSET_INVALID` | offset 非法 | 是 |
| `0x040C` | `STREAM_WINDOW_FULL` | 接收窗口满 | 是 |
| `0x040D` | `STREAM_BACKPRESSURE` | 接收端反压 | 否 |
| `0x040E` | `STREAM_RESUME_UNSUPPORTED` | 不支持续传 | 是 |
| `0x040F` | `STREAM_RESUME_FAILED` | 续传失败 | 是 |
| `0x0410` | `STREAM_CLOSED` | Stream 已关闭 | 是 |
| `0x0411` | `STREAM_TRANSFER_ABORTED` | 传输被中止 | 是 |

---

## 9. Capability 错误码

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

## 10. Firmware / OTA 错误码

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

## 11. File 错误码

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

## 12. Media 错误码

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

## 13. Device / System 错误码

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

## 14. Security 错误码

安全错误码进入注册表，但不属于 MVP 必须实现范围。

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

---

## 15. Diagnostic 错误码

| ErrorCode | 名称 | 说明 | MVP |
|---:|---|---|---|
| `0x0B01` | `DIAG_TEST_NOT_FOUND` | 测试项不存在 | 否 |
| `0x0B02` | `DIAG_TEST_UNSUPPORTED` | 测试项不支持 | 否 |
| `0x0B03` | `DIAG_TEST_RUNNING` | 测试正在运行 | 否 |
| `0x0B04` | `DIAG_TEST_FAILED` | 测试失败 | 否 |
| `0x0B05` | `DIAG_METRIC_UNAVAILABLE` | 指标不可用 | 否 |
| `0x0B06` | `DIAG_LOOPBACK_FAILED` | 回环测试失败 | 否 |

---

## 16. Vendor 错误码

厂商私有错误码范围：`0x7000-0x7EFF`。建议按厂商内部模块继续划分，不得占用 AXTP 标准错误码范围。厂商错误应同时携带 `vendorId / vendorErrorCode / vendorErrorMessage`。

---

## 17. Legacy Adapter 错误码

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


## 18. 保留范围

| 范围 | 说明 |
|---:|---|
| `0x8000-0xFFFF` | AXTP 保留，不得使用 |

---

## 19. ErrorCode 通用字段

```yaml
id: 0x0000
name: SUCCESS
kind: error
status: stable
category: common
retryable: false
description: Operation succeeded.
owner: core
mvp: true
legacy:
  legacyStatus: null
  source: null
```

| 字段 | 必填 | 说明 |
|---|---|---|
| `id` | 是 | uint16，全局唯一 |
| `name` | 是 | 全大写蛇形，如 `RPC_PARAM_INVALID` |
| `kind` | 是 | 固定 `error` |
| `status` | 是 | 生命周期状态 |
| `category` | 是 | 所属分类 |
| `retryable` | 是 | 是否可重试 |
| `description` | 是 | 简短描述 |
| `owner` | 是 | `core/vendor/legacy` |
| `mvp` | 是 | 是否属于 MVP 必须实现 |
| `legacy` | 否 | 老协议状态码映射 |

---

## 20. MVP ErrorCode 集合

```text
SUCCESS                           0x0000
UNKNOWN_ERROR                     0x0001
NOT_IMPLEMENTED                   0x0002
NOT_SUPPORTED                     0x0003
INVALID_STATE                     0x0004
BUSY                              0x0005
TIMEOUT                           0x0006
CANCELED                          0x0007
RESOURCE_EXHAUSTED                0x0008
PERMISSION_DENIED                 0x0009
INVALID_ARGUMENT                  0x000A
OUT_OF_RANGE                      0x000B
NOT_FOUND                         0x000C
INTERNAL_ERROR                    0x000E
FRAME_VERSION_UNSUPPORTED         0x0102
FRAME_CRC_ERROR                   0x0106
FRAME_FRAGMENT_MISSING            0x0108
CONTROL_PAYLOAD_INVALID           0x0202
CONTROL_OPEN_REJECTED             0x0205
CONTROL_NEGOTIATION_FAILED        0x0207
RPC_ENCODING_UNSUPPORTED          0x0301
RPC_METHOD_NOT_FOUND              0x0306
RPC_PARAM_INVALID                 0x030B
STREAM_NOT_FOUND                  0x0401
STREAM_TIMEOUT                    0x0402
STREAM_CRC_ERROR                  0x0403
FW_VERIFY_FAILED                  0x060B
FW_TRANSFER_NOT_STARTED           0x0605
```

---

## 21. ErrorCode 与 RPC Response 的关系

RPC Response 中的文本 `status.code` 与 Binary `statusCode` 字段直接使用 ErrorCode：

```text
status.code/statusCode = 0x0000 → SUCCESS
status.code/statusCode = 0x030B → RPC_PARAM_INVALID
status.code/statusCode = 0x0306 → RPC_METHOD_NOT_FOUND
```

规则：
- 文本 Response 必须携带 `status.ok` 和 `status.code`
- 成功响应必须携带 `status.ok=true, status.code=SUCCESS(0x0000)`
- 失败响应必须携带 `status.ok=false` 和非零 `status.code`
- Binary Response 的 `statusCode` 必须与文本 `status.code` 语义一致
- `status.code/statusCode` 必须引用已注册的 ErrorCode
- RPC Response 不得使用 Frame 层错误码（0x0100-0x01FF）

---

## 22. ErrorCode 与 CONTROL ACK/NACK 的关系

CONTROL NACK 的 `reasonCode` 字段使用 ErrorCode：

```text
reasonCode = 0x0106 → FRAME_CRC_ERROR
reasonCode = 0x010A → FRAME_TOO_LARGE
reasonCode = 0x0401 → STREAM_NOT_FOUND
```

规则：
- CONTROL NACK 应优先使用 Frame/Transport 类错误码（0x0100-0x01FF）
- Stream 相关 NACK 使用 Stream 类错误码（0x0400-0x04FF）
- CONTROL NACK 不得使用业务层错误码（如 Firmware 类）

---

## 23. ErrorCode 与 Stream 的关系

Stream 错误通过两种方式上报：

| 错误类型 | 上报方式 |
|---|---|
| 传输层问题（CRC 错误、seqId 不连续、streamId 不存在） | CONTROL NACK，`reasonCode` 使用 Stream 类错误码 |
| 业务层问题（OTA sha256 不匹配、视频帧解码失败） | RPC Event `stream.error`，`errorCode` 使用对应业务类错误码 |

Stream 错误码使用规则：
- `STREAM_NOT_FOUND (0x0401)` → streamId 不存在时的 NACK
- `STREAM_TIMEOUT (0x0402)` → 流超时时的 NACK 或 Event
- `STREAM_PAYLOAD_INVALID (0x0404)` → 数据包超过 maxDataSize 或 Payload 结构非法时的 NACK
- `STREAM_SEQ_INVALID (0x0408)` → seqId 不连续时的 NACK

---

## 24. 老协议状态码映射

老协议状态码必须映射到 AXTP ErrorCode，记录在 `legacy_error_mapping.yaml`：

```yaml
legacyErrorMappings:
  - source: AXDP_HID
    legacyStatus: 0x00
    axtpErrorCode: 0x0000
    axtpErrorName: SUCCESS
  - source: AXDP_HID
    legacyStatus: 0x01
    axtpErrorCode: 0x030B
    axtpErrorName: RPC_PARAM_INVALID
  - source: AXDP_HID
    legacyStatus: 0x02
    axtpErrorCode: 0x0005
    axtpErrorName: BUSY
```

映射规则：
- 老协议成功码统一映射为 `SUCCESS (0x0000)`
- 老协议错误码必须映射到语义最接近的 AXTP ErrorCode
- 无法映射的老协议错误码使用 `LEGACY_STATUS_UNMAPPED (0x7F02)`
- 映射关系必须进入 Registry，不得在代码中硬编码

---

## 25. Generator v1 校验规则

```text
ErrorCode ID 唯一性
ErrorCode name 唯一性
ID 范围合法性（不得使用保留范围）
status 合法性
retryable 字段必须明确
deprecated ErrorCode 不得复用 ID
legacy mapping 指向合法 ErrorCode
```
