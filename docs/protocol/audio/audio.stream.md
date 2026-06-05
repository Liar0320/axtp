# AXTP audio.stream 协议草案

版本：v0.1

归属域：`audio`

Capability ID：`audio.stream`

适用范围：设备通过 AXTP `PayloadType = STREAM` 向 Host 输出实时音频媒体流，包括投屏音频透传、实时监听、低延迟播放前音频桥接和 HID media 迁移。

依赖文档：`docs/specs/06-AXTP-Stream-Spec.md`、`docs/protocol/stream/stream.flowControl.md`、`docs/protocol/audio/audio.recording.md`、`docs/flows/device-streaming-audio-video.md`

---

## 协议审核标记

| 标记 | 对象 | 结论 | 后续动作 |
|---|---|---|---|
| `[REVIEW-DRAFT]` | `audio.stream` capability | 本文根据 NA20/NT10 投屏 flow 创建，用于实时音频媒体流，不复用 `audio.recording` 表达投屏播放音频。 | 产品/架构/研发确认后进入 `adopt-protocol-draft`。 |
| `[REVIEW-OK]` | domain.feature 粒度 | `audio.stream` 是音频域下的业务流能力；`stream` 域只提供公共数据面和可选流控。 | 采纳前按 08/09 再次复核 method/event 命名。 |
| `[REVIEW-DRAFT]` | `media.audio` profile | 推荐正式 profile 名称为 `media.audio`，保留 `realtime_audio` 作为 preset / legacy alias。 | 采纳时同步 `docs/specs/14` 和 stream profile registry。 |
| `[REVIEW-OK]` | AAC vs PCM | NA20 到上位机的投屏音频采用 AAC 透传；NA20/NT10 MVP 不要求 NA20 解码 PCM 后输出。PCM 仅保留为其他实时音频场景或未来产品确认的扩展。 | 采纳前确认 AAC `transportFormat` 是 `adts`、`latm`、`raw` 之一还是都支持。 |
| `[REVIEW-DRAFT]` | A/V 同步时钟 | 音视频同步同时使用 NT10 源媒体时间戳和 NA20 接收时钟；`cursor/timestampUs` 默认绑定 NT10 源媒体时钟，NA20 接收时钟用于 jitter/诊断。 | 采纳前固定 `clockDomain`、`receiverClockDomain`、`timestampBaseUs` 语义。 |
| `[REVIEW-ASK]` | legacy 映射 | `stream.hidMedia`、AXDP / Rooms / VM33 旧音频流条目尚未字段级确认。 | 落 registry 前补齐 legacyRefs 或明确 adapter-only。 |

## 1. 文档定位

本文是 `docs/protocol` 评审输入，不是最终协议事实源。采纳后，稳定事实必须反向确认到 `docs/specs/08-13`，涉及 profile/MVP 时同步确认 `docs/specs/14`，再写入 `registry/domains/audio/domain.yaml` 或相关 registry YAML，并由 `generate-axtp-protocol` 生成 `protocol/axtp.protocol.yaml` 和 `docs/generated/*`。

当前 generated 协议没有 adopted `audio.stream` 方法、事件、schema 或 profile；本文所有 methodId、eventId、capabilityId、profileId 和 schema fieldId 均为 `TBD after adoption`。

## 2. 业务需求

| 项 | 内容 |
|---|---|
| 需求来源 | `docs/flows/device-streaming-audio-video.md`，NA20 接收 NT10 H.264/AAC 投屏流后，经 USB HID/AXTP STREAM 输出给上位机播放。 |
| 目标用户 | 上位机播放服务、NA20 接收端固件、测试工具。 |
| 目标行为 | 上位机打开 NA20 的实时音频业务流，获得 `streamId`、codec/format、采样率、通道数、profile、同步组和时钟信息；随后通过 STREAM 数据面接收音频 chunk 并与视频同步播放。 |
| 当前实现程度 | Drafted only：本文已作为 `docs/protocol/audio/audio.stream.md` 草案存在，YAML/generated 尚未定义 `audio.stream`。 |

## 3. Domain 边界

| 项 | 决策 |
|---|---|
| Domain | `audio` |
| Feature | `audio.stream` |
| Capability | `audio.stream` |
| 负责 | 实时音频业务流能力、打开/关闭音频 stream、状态查询、状态事件、统计事件、音频 chunk envelope、投屏音频和其他低延迟音频桥接。 |
| 数据面 | AXTP `PayloadType = STREAM`，由 `audio.openStream` 返回的 `streamId` 绑定 codec/format/profile。 |
| 不负责 | 长时间抓音、问题定位录制和文件化录制，归 `audio.recording`；设备侧播放任务，归 `audio.playback`；UAC 服务配置，归 `audio.uac`；音量/路由/算法/EQ 分别归对应 audio feature；公共 ACK/window/pause/resume/abort 归 `stream.flowControl`。 |

关键边界：

```text
audio 负责“打开哪一路实时音频、用什么 codec/format 输出”。
stream 负责“streamId/seqId/cursor/data 怎么在数据面传”。
Host player 负责“解码、jitter buffer、A/V sync 和播放”。
```

## 4. 协议决策

| 决策点 | 结论 | 理由 |
|---|---|---|
| 新增/修改/复用 | Create new draft | `audio.recording` 可参考实时 PCM 数据面，但其业务语义是录制；投屏音频转发需要独立 `audio.stream`。 |
| 控制面 | `audio.openStream` / `audio.closeStream` / `audio.getStreamState` | 业务域创建和关闭业务流，不定义常规 `stream.open`。 |
| 数据面 | STREAM created by RPC | 连续音频 chunk 走 `PayloadType = STREAM`，STREAM header 保持 16B。 |
| Profile | `media.audio` + preset `realtime_audio` | 与 `docs/specs/06-AXTP-Stream-Spec.md` 中 `media.audio` 对齐，同时兼容现有 flowControl 草案中的 `realtime_audio`。 |
| WebSocket | RPC-only | WebSocket Unframed JSON 不承载 STREAM。 |
| 音频格式 | NA20/NT10 投屏路径使用 AAC 透传 | NA20 默认透传 NT10 AAC；Host 不支持 AAC 时，应提示不支持或走后续产品确认的扩展，不默认要求 NA20 PCM 输出。 |

## 5. 候选 Capability

| Capability | 状态 | 说明 |
|---|---|---|
| `audio.stream` | draft | 设备支持通过 AXTP STREAM 输出实时音频媒体流，包含 codec/format 能力、建流、关闭、状态和统计。 |

## 6. 候选 Methods

| Method | Params Schema | Result Schema | MVP | 说明 | Review |
|---|---|---|---:|---|---|
| `audio.getStreamCapabilities` | `AudioGetStreamCapabilitiesRequest` | `AudioStreamCapabilities` | yes | 查询实时音频源、codec/format、采样率、通道、profile、chunk 限制和同步能力。 | `[REVIEW-DRAFT]` |
| `audio.openStream` | `AudioOpenStreamRequest` | `AudioOpenStreamResponse` | yes | 打开一路实时音频业务流，返回 `streamId` 和 Stream Context 元数据。 | `[REVIEW-DRAFT]` |
| `audio.closeStream` | `AudioCloseStreamRequest` | `AudioCloseStreamResponse` | yes | 正常关闭一路音频业务流，停止 producer 并释放 Stream Context。 | `[REVIEW-DRAFT]` |
| `audio.getStreamState` | `AudioGetStreamStateRequest` | `AudioStreamState` | yes | 查询音频业务流状态、统计和同步元数据。 | `[REVIEW-DRAFT]` |
| `audio.getStreamConfig` | `AudioGetStreamConfigRequest` | `AudioStreamConfig` | no | 查询已打开流或默认流配置。 | `[REVIEW-DRAFT]` |
| `audio.setStreamConfig` | `AudioSetStreamConfigRequest` | `AudioSetStreamConfigResponse` | no | 修改可变配置，例如目标 chunkDuration；NA20/NT10 投屏 MVP 不用它请求 PCM fallback。 | `[REVIEW-ASK]` |

方法错误候选优先复用 adopted/common 错误：`SUCCESS`、`RPC_PARAM_INVALID`、`RPC_PARAM_OUT_OF_RANGE`、`CAPABILITY_STREAM_UNSUPPORTED`、`MEDIA_SOURCE_NOT_FOUND`、`MEDIA_SOURCE_UNAVAILABLE`、`MEDIA_CODEC_UNSUPPORTED`、`MEDIA_STREAM_START_FAILED`、`MEDIA_STREAM_STOP_FAILED`、`MEDIA_AUDIO_DEVICE_NOT_FOUND`、`STREAM_NOT_FOUND`、`STREAM_CLOSED`、`BUSY`、`DEVICE_RESOURCE_BUSY`。

## 7. 候选 Events

| Event | Schema | MVP | 触发时机 | Review |
|---|---|---:|---|---|
| `audio.streamStateChanged` | `AudioStreamStateChangedEvent` | yes | 音频流从 `opening`、`streaming`、`closing`、`closed`、`failed` 等状态变化。 | `[REVIEW-DRAFT]` |
| `audio.streamStatsReported` | `AudioStreamStatsReportedEvent` | yes | 周期性上报音频 stream 统计，例如 bytesSent、chunksSent、droppedChunks、bufferMs。 | `[REVIEW-DRAFT]` |

事件规则：

1. 音频 chunk 不通过 event 承载，必须走 STREAM。
2. `audio.streamStateChanged` 不替代 `audio.openStream` / `audio.closeStream` response。
3. 公共 stream 层错误可触发 `stream` / CONTROL 层处理；业务源断开、codec pipeline 失败等通过 `audio.streamStateChanged(state=failed)` 暴露。

## 8. 候选 Schemas

### 8.1 `AudioGetStreamCapabilitiesRequest`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `source` | string | no | 可选按音频源查询；省略表示查询全部实时音频源。 | `[REVIEW-DRAFT]` |

### 8.2 `AudioStreamCapabilities`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `supported` | bool | yes | 是否支持 `audio.stream`。 | `[REVIEW-DRAFT]` |
| `capability` | string | yes | 固定为 `audio.stream`。 | `[REVIEW-DRAFT]` |
| `sources` | `AudioStreamSource[]` | yes | 可打开的实时音频源。 | `[REVIEW-DRAFT]` |
| `streamProfiles` | string[] | yes | 推荐包含 `media.audio`。 | `[REVIEW-DRAFT]` |
| `profileAliases` | map | no | 例如 `realtime_audio -> media.audio`。 | `[REVIEW-DRAFT]` |
| `defaultStreamProfile` | string | yes | 默认 `media.audio`。 | `[REVIEW-DRAFT]` |
| `defaultProfilePreset` | string | no | 默认 `realtime_audio`。 | `[REVIEW-DRAFT]` |
| `cursorUnits` | enum[] | yes | `timestampUs`、`sampleIndex`；实时 AAC 默认 `timestampUs`。 | `[REVIEW-DRAFT]` |
| `maxConcurrentStreams` | uint8 | yes | 最大并发实时音频流数量。 | `[REVIEW-DRAFT]` |
| `preferredChunkDurationMs` | uint16 | no | 推荐 chunk 时长，例如 20 ms。 | `[REVIEW-DRAFT]` |
| `maxPayloadBytes` | uint32 | no | 单个 STREAM payload 中 audio data 最大大小，不含 16B STREAM header。 | `[REVIEW-DRAFT]` |
| `supportsSyncGroup` | bool | no | 是否可返回 `syncGroupId/castSessionId` 与其他媒体流同步。 | `[REVIEW-DRAFT]` |
| `timestampSources` | enum[] | no | `nt10_media_clock`、`na20_receive_clock`；表示可用于状态和诊断的时钟来源。 | `[REVIEW-DRAFT]` |
| `supportsReceiverTimestamp` | bool | no | 是否在状态/统计中暴露 NA20 接收时间戳。 | `[REVIEW-DRAFT]` |
| `flowControlManagedByRuntime` | bool | yes | 为 true 时普通 App 不需要直接调用 stream 流控方法。 | `[REVIEW-DRAFT]` |

### 8.3 `AudioStreamSource`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `sourceId` | string | yes | 源 ID，例如 `wireless_cast_audio`、`mic_processed`、`line_in`。 | `[REVIEW-DRAFT]` |
| `type` | enum | yes | `wireless_cast`、`mic`、`line_in`、`uac`、`mixed`、`playback_tap`。 | `[REVIEW-DRAFT]` |
| `label` | string | no | 人类可读名称。 | `[REVIEW-DRAFT]` |
| `codecs` | enum[] | yes | 编码音频候选，例如 `aac`、`opus`；PCM 仅在 source 明确支持 `format=pcm` 时使用。 | `[REVIEW-DRAFT]` |
| `formats` | enum[] | yes | `aac`、`pcm`、`wav`；NA20/NT10 `wireless_cast_audio` MVP 只要求 `aac`。 | `[REVIEW-DRAFT]` |
| `transportFormats` | enum[] | no | AAC 封装：`adts`、`latm`、`raw`；设备必须声明实际支持项。 | `[REVIEW-DRAFT]` |
| `sampleRates` | uint32[] | yes | 支持采样率。 | `[REVIEW-DRAFT]` |
| `channelCounts` | uint8[] | yes | 支持通道数。 | `[REVIEW-DRAFT]` |
| `sampleFormats` | enum[] | no | PCM 采样格式，例如 `s16le`、`s24le`、`float32le`。 | `[REVIEW-DRAFT]` |
| `chunkDurationMs` | uint16[] | no | 支持 chunk 时长。 | `[REVIEW-DRAFT]` |
| `defaultCodec` | enum | no | 默认 codec。 | `[REVIEW-DRAFT]` |
| `defaultFormat` | enum | yes | 默认格式。 | `[REVIEW-DRAFT]` |
| `defaultTransportFormat` | enum | no | AAC 默认封装，例如 `adts`；若多封装都支持，由能力声明默认值。 | `[REVIEW-DRAFT]` |
| `defaultSampleRate` | uint32 | yes | 默认采样率。 | `[REVIEW-DRAFT]` |
| `defaultChannels` | uint8 | yes | 默认通道数。 | `[REVIEW-DRAFT]` |

### 8.4 `AudioOpenStreamRequest`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `source` | string | yes | 音频源 ID，来自 `AudioStreamSource.sourceId`。 | `[REVIEW-DRAFT]` |
| `codec` | enum | no | `aac`、`opus`、`pcm`；PCM 可用 `format=pcm` 表达。 | `[REVIEW-DRAFT]` |
| `format` | enum | yes | `aac` 或 `pcm`。 | `[REVIEW-DRAFT]` |
| `transportFormat` | enum | no | AAC 封装：`adts`、`latm`、`raw`。 | `[REVIEW-ASK]` |
| `sampleRate` | uint32 | yes | 采样率，单位 Hz。 | `[REVIEW-DRAFT]` |
| `channels` | uint8 | yes | 通道数。 | `[REVIEW-DRAFT]` |
| `sampleFormat` | enum | no | PCM 采样格式；AAC 透传时省略。 | `[REVIEW-DRAFT]` |
| `chunkDurationMs` | uint16 | no | 目标 chunk 时长。 | `[REVIEW-DRAFT]` |
| `streamProfile` | string | no | 默认 `media.audio`；若传 `realtime_audio`，实现应归一化。 | `[REVIEW-DRAFT]` |
| `cursorUnit` | enum | no | `timestampUs` 或 `sampleIndex`；默认随 profile/format。 | `[REVIEW-DRAFT]` |
| `syncGroupId` | string | no | 与视频或其他音频流同步的组 ID；可由 Host 指定或设备返回。 | `[REVIEW-DRAFT]` |
| `castSessionId` | string | no | 上层投屏会话 ID；仅作为 video/audio 透明关联字段，不治理独立 `cast` domain。 | `[REVIEW-OK]` |
| `progressIntervalMs` | uint32 | no | stats event 周期；低于能力最小值时返回 `RPC_PARAM_OUT_OF_RANGE`。 | `[REVIEW-DRAFT]` |

### 8.5 `AudioOpenStreamResponse`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `streamId` | uint32 | yes | 分配的 STREAM 数据面 ID。 | `[REVIEW-DRAFT]` |
| `streamProfile` | string | yes | 归一化后的 profile，默认 `media.audio`。 | `[REVIEW-DRAFT]` |
| `profilePreset` | string | no | `realtime_audio`。 | `[REVIEW-DRAFT]` |
| `state` | enum | yes | `opening` 或 `streaming`。 | `[REVIEW-DRAFT]` |
| `source` | string | yes | 实际绑定的音频源。 | `[REVIEW-DRAFT]` |
| `codec` | enum | no | 实际 codec。 | `[REVIEW-DRAFT]` |
| `format` | enum | yes | 实际 format。 | `[REVIEW-DRAFT]` |
| `transportFormat` | enum | no | AAC 封装。 | `[REVIEW-ASK]` |
| `sampleRate` | uint32 | yes | 实际采样率。 | `[REVIEW-DRAFT]` |
| `channels` | uint8 | yes | 实际通道数。 | `[REVIEW-DRAFT]` |
| `sampleFormat` | enum | no | PCM 采样格式。 | `[REVIEW-DRAFT]` |
| `chunkDurationMs` | uint16 | no | 实际 chunk 时长。 | `[REVIEW-DRAFT]` |
| `payloadBytesPerChunk` | uint32 | no | PCM 固定时长时可返回；AAC 可省略。 | `[REVIEW-DRAFT]` |
| `cursorUnit` | enum | yes | `timestampUs` 或 `sampleIndex`。 | `[REVIEW-DRAFT]` |
| `cursor` | uint64 | yes | 初始 cursor，通常 0。 | `[REVIEW-DRAFT]` |
| `nextSeqId` | uint32 | yes | 初始 seqId，通常 0。 | `[REVIEW-DRAFT]` |
| `nextChunkId` | uint32 | no | 音频 chunk envelope 初始 chunkId。 | `[REVIEW-DRAFT]` |
| `ackMode` | enum | yes | 实时音频默认 `none` 或 `periodic`。 | `[REVIEW-DRAFT]` |
| `syncGroupId` | string | no | 与视频流相同的同步组 ID。 | `[REVIEW-DRAFT]` |
| `castSessionId` | string | no | 投屏会话 ID。 | `[REVIEW-ASK]` |
| `clockDomain` | string | no | `cursor/timestampUs` 所属时钟域，投屏场景默认 `nt10_media_clock`。 | `[REVIEW-DRAFT]` |
| `timestampBaseUs` | uint64 | no | NT10 源媒体时钟的时间戳基准。 | `[REVIEW-DRAFT]` |
| `receiverClockDomain` | string | no | NA20 接收时钟域，投屏场景默认 `na20_receive_clock`。 | `[REVIEW-DRAFT]` |
| `firstReceiveTimestampUs` | uint64 | no | NA20 收到首个音频 chunk 的接收时钟时间戳。 | `[REVIEW-DRAFT]` |
| `codecConfig` | object | no | AAC raw config、ADTS presence、PCM endian 等。 | `[REVIEW-DRAFT]` |

### 8.6 `AudioCloseStreamRequest` / `AudioCloseStreamResponse`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `streamId` | uint32 | yes | 要关闭的音频 stream。 | `[REVIEW-DRAFT]` |
| `drain` | bool | no | 是否发送已缓存的最后音频 chunk；实时音频默认 false 或短 drain。 | `[REVIEW-DRAFT]` |
| `timeoutMs` | uint32 | no | 关闭超时。 | `[REVIEW-DRAFT]` |
| `state` | enum | response yes | 关闭后状态，通常 `closed`。 | `[REVIEW-DRAFT]` |
| `finalSeqId` | uint32 | response no | 最后发送的 seqId。 | `[REVIEW-DRAFT]` |
| `finalCursor` | uint64 | response no | 最后 cursor。 | `[REVIEW-DRAFT]` |
| `bytesSent` | uint64 | response no | 总发送字节数。 | `[REVIEW-DRAFT]` |
| `closedAtMs` | uint64 | response no | 设备关闭时间。 | `[REVIEW-DRAFT]` |

### 8.7 `AudioStreamState`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `streamId` | uint32 | yes | 音频 stream ID。 | `[REVIEW-DRAFT]` |
| `state` | enum | yes | `opening`、`streaming`、`pausing`、`paused`、`closing`、`closed`、`aborting`、`aborted`、`failed`。 | `[REVIEW-DRAFT]` |
| `source` | string | yes | 音频源。 | `[REVIEW-DRAFT]` |
| `format` / `codec` | enum | yes/no | 当前音频格式和 codec。 | `[REVIEW-DRAFT]` |
| `sampleRate` | uint32 | yes | 采样率。 | `[REVIEW-DRAFT]` |
| `channels` | uint8 | yes | 通道数。 | `[REVIEW-DRAFT]` |
| `cursorUnit` | enum | yes | cursor 单位。 | `[REVIEW-DRAFT]` |
| `cursor` | uint64 | yes | 当前 cursor。 | `[REVIEW-DRAFT]` |
| `nextSeqId` | uint32 | yes | 下一包 seqId。 | `[REVIEW-DRAFT]` |
| `chunksSent` | uint64 | no | 已发送音频 chunk 数。 | `[REVIEW-DRAFT]` |
| `bytesSent` | uint64 | no | 已发送音频字节数。 | `[REVIEW-DRAFT]` |
| `droppedChunks` | uint64 | no | 背压或丢包策略导致的丢弃 chunk 数。 | `[REVIEW-DRAFT]` |
| `bufferMs` | uint32 | no | 设备侧音频缓存估计。 | `[REVIEW-DRAFT]` |
| `syncGroupId` | string | no | A/V 同步组。 | `[REVIEW-DRAFT]` |
| `clockDomain` | string | no | 源媒体时间戳时钟域，投屏场景默认 `nt10_media_clock`。 | `[REVIEW-DRAFT]` |
| `receiverClockDomain` | string | no | NA20 接收时钟域，投屏场景默认 `na20_receive_clock`。 | `[REVIEW-DRAFT]` |
| `receiverTimestampUs` | uint64 | no | 当前状态对应的 NA20 接收时钟时间戳。 | `[REVIEW-DRAFT]` |
| `startedAtMs` | uint64 | no | 设备开始时间。 | `[REVIEW-DRAFT]` |
| `errorCode` | string | no | 失败状态下的错误名。 | `[REVIEW-DRAFT]` |

### 8.8 `AudioChunkHeaderV1`

每个 `media.audio` STREAM data 建议以 `AudioChunkHeaderV1` 开头，然后承载 AAC access unit / ADTS frame / LATM/raw AAC data。PCM chunk 仅适用于非 NA20/NT10 MVP 的其他实时音频 source 或未来扩展。字段 ID 在二进制 payload envelope 内不是 TLV fieldId；采纳时仍需明确 wire endian 和 headerLength。

```text
+------------------------+
| headerVersion:uint8    | 1B  fixed 1
+------------------------+
| headerLength:uint8     | 1B  fixed 16
+------------------------+
| flags:uint16           | 2B  bit field
+------------------------+
| chunkId:uint32         | 4B
+------------------------+
| chunkOffset:uint32     | 4B
+------------------------+
| dataLength:uint32      | 4B
+------------------------+
| data bytes...          | N
```

`flags` 候选：

| Bit | 名称 | 说明 |
|---:|---|---|
| 0 | `chunkStart` | 当前 STREAM payload 是一个音频访问单元或音频 chunk 的开始。 |
| 1 | `chunkEnd` | 当前 STREAM payload 是一个音频访问单元或音频 chunk 的结束。 |
| 2 | `codecConfig` | 当前 payload 携带 AAC config / codec side data。 |
| 3 | `discontinuity` | 前面存在丢包、跳包、重同步或源时间戳不连续。 |
| 4 | `silence` | 当前 payload 是设备生成的静音补偿。 |
| 5-15 | reserved | 发送端置 0，接收端忽略未知 bit。 |

字段规则：

| 字段 | 规则 |
|---|---|
| `chunkId` | 每个音频访问单元或音频 chunk 加 1；同一个 chunk 被拆分时保持相同 `chunkId`。 |
| `chunkOffset` | 当前 payload 在该音频 chunk 内的字节偏移。 |
| `dataLength` | 当前 payload 中 `AudioChunkHeaderV1` 后的音频数据长度。 |
| `cursor` | STREAM header 中的 `cursor` 表示 `timestampUs` 或 `sampleIndex`，不得与 `chunkOffset` 混用。 |

## 9. Stream Profile

推荐正式 profile：

```json
{
  "streamProfile": "media.audio",
  "profilePreset": "realtime_audio",
  "legacyAliases": ["realtime_audio"],
  "domain": "audio",
  "direction": "device_to_host",
  "cursorUnit": "timestampUs",
  "reliability": "best_effort",
  "ordered": true,
  "ackMode": "none",
  "lossRecovery": "none",
  "backpressurePolicy": "drop_old_chunks",
  "maxBufferBytes": 262144,
  "highWatermarkBytes": 196608,
  "lowWatermarkBytes": 65536
}
```

规则：

- `media.audio` 低延迟优先。
- 实时音频不建议补太旧的历史 chunk。
- 丢包后 Host 可做静音补偿、丢弃过期 chunk 或等待下一 chunk，不要求设备重传旧音频。
- 需要完整性的抓音、产测和问题定位使用 `audio.recording` 的 `recording_audio` profile，不使用 `audio.stream`。
- 普通业务 App 不需要显式调用 `stream.ack`、`stream.windowUpdate`、`stream.pause` 或 `stream.resume`。

## 10. JSON 示例

示例用于评审 request/response/event 语义，不是 generated 事实源。JSON 示例只写 RPC `d` 数据块，不包裹外层 `sid` / `op` / `d` wire envelope。

### 10.1 查询能力

```json
{
  "id": 1,
  "method": "audio.getStreamCapabilities",
  "params": {}
}
```

```json
{
  "id": 1,
  "status": {
    "ok": true,
    "code": 0
  },
  "result": {
    "supported": true,
    "capability": "audio.stream",
    "sources": [
      {
        "sourceId": "wireless_cast_audio",
        "type": "wireless_cast",
        "label": "Wireless Cast Audio",
        "codecs": ["aac"],
        "formats": ["aac"],
        "transportFormats": ["adts", "latm", "raw"],
        "sampleRates": [48000],
        "channelCounts": [2],
        "chunkDurationMs": [10, 20],
        "defaultCodec": "aac",
        "defaultFormat": "aac",
        "defaultTransportFormat": "adts",
        "defaultSampleRate": 48000,
        "defaultChannels": 2
      }
    ],
    "streamProfiles": ["media.audio"],
    "profileAliases": {
      "realtime_audio": "media.audio"
    },
    "defaultStreamProfile": "media.audio",
    "defaultProfilePreset": "realtime_audio",
    "cursorUnits": ["timestampUs", "sampleIndex"],
    "maxConcurrentStreams": 1,
    "preferredChunkDurationMs": 20,
    "maxPayloadBytes": 8192,
    "supportsSyncGroup": true,
    "timestampSources": ["nt10_media_clock", "na20_receive_clock"],
    "supportsReceiverTimestamp": true,
    "flowControlManagedByRuntime": true
  }
}
```

### 10.2 打开 AAC 透传音频流

```json
{
  "id": 2,
  "method": "audio.openStream",
  "params": {
    "source": "wireless_cast_audio",
    "codec": "aac",
    "format": "aac",
    "transportFormat": "adts",
    "sampleRate": 48000,
    "channels": 2,
    "chunkDurationMs": 20,
    "streamProfile": "media.audio",
    "cursorUnit": "timestampUs",
    "syncGroupId": "cast_001"
  }
}
```

```json
{
  "id": 2,
  "status": {
    "ok": true,
    "code": 0
  },
  "result": {
    "streamId": 201,
    "streamProfile": "media.audio",
    "profilePreset": "realtime_audio",
    "state": "opening",
    "source": "wireless_cast_audio",
    "codec": "aac",
    "format": "aac",
    "transportFormat": "adts",
    "sampleRate": 48000,
    "channels": 2,
    "chunkDurationMs": 20,
    "cursorUnit": "timestampUs",
    "cursor": 0,
    "nextSeqId": 0,
    "nextChunkId": 0,
    "ackMode": "none",
    "syncGroupId": "cast_001",
    "castSessionId": "cast_session_001",
    "clockDomain": "nt10_media_clock",
    "timestampBaseUs": 0,
    "receiverClockDomain": "na20_receive_clock",
    "firstReceiveTimestampUs": 0,
    "codecConfig": {
      "transportFormat": "adts",
      "configInBand": true
    }
  }
}
```

### 10.3 请求非 MVP PCM 输出的失败响应

NA20/NT10 投屏路径已经确认采用 AAC 透传。除非后续产品明确增加 PCM 扩展，否则 Host 对 `wireless_cast_audio` 请求 PCM 输出应返回不支持，而不是默认要求 NA20 解码。

```json
{
  "id": 3,
  "method": "audio.openStream",
  "params": {
    "source": "wireless_cast_audio",
    "format": "pcm",
    "sampleFormat": "s16le",
    "sampleRate": 48000,
    "channels": 2,
    "chunkDurationMs": 20,
    "streamProfile": "media.audio",
    "cursorUnit": "sampleIndex",
    "syncGroupId": "cast_001"
  }
}
```

```json
{
  "id": 3,
  "status": {
    "ok": false,
    "code": 2051,
    "msg": "Requested audio format is unsupported for wireless_cast_audio.",
    "details": {
      "field": "format",
      "value": "pcm",
      "supported": ["aac"],
      "candidateError": "MEDIA_CODEC_UNSUPPORTED"
    }
  }
}
```

### 10.4 状态事件

```json
{
  "event": "audio.streamStateChanged",
  "intent": 1,
  "data": {
    "streamId": 201,
    "state": "streaming",
    "source": "wireless_cast_audio",
    "codec": "aac",
    "format": "aac",
    "transportFormat": "adts",
    "sampleRate": 48000,
    "channels": 2,
    "cursorUnit": "timestampUs",
    "cursor": 1710000000000000,
    "syncGroupId": "cast_001",
    "castSessionId": "cast_session_001",
    "clockDomain": "nt10_media_clock",
    "receiverClockDomain": "na20_receive_clock",
    "timestampMs": 1710000000000
  }
}
```

### 10.5 统计事件

```json
{
  "event": "audio.streamStatsReported",
  "intent": 1,
  "data": {
    "streamId": 201,
    "state": "streaming",
    "chunksSent": 500,
    "bytesSent": 983040,
    "droppedChunks": 0,
    "bufferMs": 40,
    "cursor": 1710000010000000,
    "cursorUnit": "timestampUs",
    "nextSeqId": 501,
    "syncGroupId": "cast_001",
    "receiverClockDomain": "na20_receive_clock",
    "receiverTimestampUs": 1710000010005000,
    "timestampMs": 1710000010000
  }
}
```

### 10.6 关闭音频流

```json
{
  "id": 4,
  "method": "audio.closeStream",
  "params": {
    "streamId": 201,
    "drain": false,
    "timeoutMs": 500
  }
}
```

```json
{
  "id": 4,
  "status": {
    "ok": true,
    "code": 0
  },
  "result": {
    "streamId": 201,
    "state": "closed",
    "finalSeqId": 501,
    "finalCursor": 1710000010000000,
    "bytesSent": 983040,
    "closedAtMs": 1710000010100
  }
}
```

### 10.7 请求不支持音频格式的失败响应

`0x0803 MEDIA_CODEC_UNSUPPORTED` 是现有 adopted 错误码，十进制为 `2051`。若后续 audio 域需要独立细分错误，候选错误码为 `TBD after adoption`。

```json
{
  "id": 5,
  "status": {
    "ok": false,
    "code": 2051,
    "msg": "Requested audio format is unsupported.",
    "details": {
      "field": "format",
      "value": "pcm",
      "supported": ["aac"],
      "candidateError": "MEDIA_CODEC_UNSUPPORTED"
    }
  }
}
```

## 11. STREAM 数据面

二进制 wire 仍为：

```text
AXTP Standard Frame(payloadType=STREAM)
  STREAM header: streamId:uint32 + seqId:uint32 + cursor:uint64
  data: AudioChunkHeaderV1 + audio bytes
```

JSON 诊断表示示例：

```json
{
  "streamId": 201,
  "seqId": 0,
  "cursor": 1710000000000000,
  "cursorUnit": "timestampUs",
  "chunkId": 0,
  "chunkOffset": 0,
  "codec": "aac",
  "transportFormat": "adts",
  "chunkStart": true,
  "chunkEnd": true,
  "payload": "base64:AAAA..."
}
```

非投屏 PCM 诊断示例：

下面示例只说明 `audio.stream` 作为通用实时音频能力时仍可扩展 PCM source；NA20/NT10 投屏 MVP 不要求该路径。

```json
{
  "streamId": 202,
  "seqId": 0,
  "cursor": 0,
  "cursorUnit": "sampleIndex",
  "chunkId": 0,
  "chunkOffset": 0,
  "format": "pcm",
  "sampleFormat": "s16le",
  "sampleRate": 48000,
  "channels": 2,
  "chunkDurationMs": 20,
  "payloadBytes": 3840,
  "payload": "base64:BBBB..."
}
```

实时丢包策略：

- `seqId` 不连续表示 stream chunk 缺失或乱序。
- 对 `media.audio`，默认不要求设备补历史 chunk。
- Host 可按 codec/format 做静音补偿、丢弃不完整 chunk、或等待下一完整 chunk。
- 若 `discontinuity` flag 为 true，Host 应重置相关 jitter buffer 或 decoder timeline。

## 12. 与其他 audio feature 的关系

| 能力 | 主要用途 | 与 `audio.stream` 的关系 |
|---|---|---|
| `audio.recording` | 抓音、产测、问题定位、文件化录制。 | 可以复用 STREAM 数据面模型，但业务生命周期是 recordingId，不是实时投屏播放。 |
| `audio.playback` | 设备侧播放任务和播放状态。 | 不代表 NA20 到 Host 的音频输出。 |
| `audio.uac` | USB Audio Class 服务能力和配置。 | 如果设备选择以 UAC 暴露音频，不走 AXTP STREAM；若走 AXTP，则使用 `audio.stream`。 |
| `audio.routing` / `audio.input` / `audio.output` | 音频端口、路径和输出目标配置。 | 可影响可用 source，但不创建实时媒体 STREAM。 |
| `audio.algorithm` | 音频算法参数。 | 可能影响处理后音频源，但不承载媒体数据。 |
| `video.stream` source proxy | 可选通过 NA20 启停 `wireless_cast` source。 | 若该 source 同时承载音视频，启动/停止可能影响 `audio.stream` 可用性；NA20 和 NT10 之间的实现细节不进入 AXTP wire。 |

## 13. 候选 Errors

| Error | 类别 | 说明 | Review |
|---|---|---|---|
| `CAPABILITY_STREAM_UNSUPPORTED` | adopted capability | 设备不支持 STREAM 数据面。 | `[REVIEW-OK]` |
| `MEDIA_SOURCE_NOT_FOUND` | adopted media | 请求的音频 source 不存在。 | `[REVIEW-OK]` |
| `MEDIA_SOURCE_UNAVAILABLE` | adopted media | 音频 source 当前不可用，例如 NT10 尚未开始投屏。 | `[REVIEW-OK]` |
| `MEDIA_CODEC_UNSUPPORTED` | adopted media | 请求的 codec、format 或 sampleFormat 不支持。 | `[REVIEW-OK]` |
| `MEDIA_STREAM_START_FAILED` | adopted media | 音频 pipeline 或 media bridge 启动失败。 | `[REVIEW-OK]` |
| `MEDIA_STREAM_STOP_FAILED` | adopted media | 音频 pipeline 停止失败。 | `[REVIEW-OK]` |
| `MEDIA_AUDIO_DEVICE_NOT_FOUND` | adopted audio draft | 音频设备或源设备不存在。 | `[REVIEW-DRAFT]` |
| `STREAM_NOT_FOUND` / `STREAM_CLOSED` | adopted stream | 关闭、查询或接收数据时 streamId 无效或已关闭。 | `[REVIEW-OK]` |
| `AUDIO_STREAM_SYNC_UNAVAILABLE` | candidate | 设备无法提供与视频一致的同步时钟或 syncGroup。 | `[REVIEW-ASK]` |

候选 `AUDIO_STREAM_SYNC_UNAVAILABLE` 的 numeric code 为 `TBD after adoption`；采纳前也可复用 `RPC_EXECUTION_FAILED` 或 `CAPABILITY_NEGOTIATION_FAILED` 表达。

## 14. Legacy 待映射

| 来源 | 旧协议条目 | 候选映射 | 状态 |
|---|---|---|---|
| `stream.hidMedia` | 历史 HID media draft | 视频迁到 `video.stream`，音频实时媒体迁到 `audio.stream`，公共流控留在 `stream.flowControl`。 | `[REVIEW-DRAFT]` |
| AXDP / Rooms / VM33 / Signage | 待从 `docs/legacy-classification/` 筛选音频流、音频播放、投屏音频相关条目 | `audio.stream`、`audio.recording` 或 `audio.playback`，按业务语义区分。 | `[REVIEW-ASK]` |
| NA20/NT10 私有投屏 | NT10 到 NA20 的无线媒体协议未提供 | 不映射为 AXTP wire；NA20 到 Host 的 USB HID 媒体桥使用 `audio.stream`。 | `[REVIEW-ASK]` |

## 15. Registry 草案输入

采纳本文后，domain YAML 至少应包含：

```yaml
capabilities:
  - id: audio.stream
    name: audio.stream capability
    status: draft
    methods:
      - audio.getStreamCapabilities
      - audio.openStream
      - audio.closeStream
      - audio.getStreamState
    events:
      - audio.streamStateChanged
      - audio.streamStatsReported

methods:
  - name: audio.getStreamCapabilities
    id: TBD after adoption
    bitOffset: TBD after adoption
    requestSchema: AudioGetStreamCapabilitiesRequest
    responseSchema: AudioStreamCapabilities
    capabilities:
      - audio.stream
  - name: audio.openStream
    id: TBD after adoption
    bitOffset: TBD after adoption
    requestSchema: AudioOpenStreamRequest
    responseSchema: AudioOpenStreamResponse
    capabilities:
      - audio.stream
    events:
      - audio.streamStateChanged
  - name: audio.closeStream
    id: TBD after adoption
    bitOffset: TBD after adoption
    requestSchema: AudioCloseStreamRequest
    responseSchema: AudioCloseStreamResponse
    capabilities:
      - audio.stream
    events:
      - audio.streamStateChanged
  - name: audio.getStreamState
    id: TBD after adoption
    bitOffset: TBD after adoption
    requestSchema: AudioGetStreamStateRequest
    responseSchema: AudioStreamState
    capabilities:
      - audio.stream

events:
  - name: audio.streamStateChanged
    id: TBD after adoption
    bitOffset: TBD after adoption
    eventSchema: AudioStreamStateChangedEvent
    capabilities:
      - audio.stream
  - name: audio.streamStatsReported
    id: TBD after adoption
    bitOffset: TBD after adoption
    eventSchema: AudioStreamStatsReportedEvent
    capabilities:
      - audio.stream

profiles:
  - name: media.audio
    id: TBD after adoption
    status: draft
    cursorUnit: timestampUs
    reliability: best_effort
```

## 16. 采纳检查清单

- [ ] 08 已确认 `audio.stream` 粒度，不与 `audio.recording`、`audio.playback`、`audio.uac` 重叠。
- [ ] 08 已确认短名 `audio.openStream` / `audio.closeStream` 可接受，或改为 `audio.openAudioStream` / `audio.closeAudioStream`。
- [ ] 09 已确认 `audio.*` method/event 所在 domain 分段。
- [ ] 10 已确认 methodId、bitOffset、request/response schema。
- [ ] 11 已确认 eventId、eventMasks bitOffset、event schema。
- [ ] 12 已确认错误码复用策略；是否新增 `AUDIO_STREAM_SYNC_UNAVAILABLE`。
- [ ] 13 已确认 schema fieldId、capabilityId、supportedMethods。
- [ ] 14 已确认 `media.audio` profile 与 `realtime_audio` alias。
- [ ] NA20/NT10 投屏 MVP 已确认 AAC 透传，不要求 NA20 PCM fallback。
- [ ] `AudioChunkHeaderV1` wire 结构、endianness、headerLength 和 flags 已确认。
- [ ] YAML 写入后 Generator 能完整生成 `protocol/axtp.protocol.yaml` 和 `docs/generated/*`。

## 17. 待确认问题

1. `[REVIEW-ASK]` AAC 透传的默认 `transportFormat` 是 `adts`、`latm`、`raw` 之一，还是三者都需要支持？
2. `[REVIEW-DRAFT]` 音频和视频时间戳来自 NT10 源媒体时钟和 NA20 接收时钟；采纳前需固定 `clockDomain` / `receiverClockDomain` 枚举名。
3. `[REVIEW-OK]` 不治理独立 `cast` / `cast.streaming` domain；`castSessionId` 只作为 video/audio 透明关联字段。
4. `[REVIEW-ASK]` NT10 断连时，NA20 是关闭 audio stream，还是保留 streamId 等待短时重连？
5. `[REVIEW-ASK]` `audio.setStreamConfig` 是否进入 MVP，还是 deferred 到 runtime config 需求出现后再采纳？
