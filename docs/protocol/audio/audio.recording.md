# AXTP 音频录制协议方案

版本：v0.2

归属域：`audio`

Capability ID：`audio.recording`

数据面：`stream`

文件结果：`file`

适用范围：音频调试、产测抓音、问题定位、上位机实时监听、算法前后数据录制、文件化录制导出。

---

## 协议审核标记（人工复核）

| 标记 | 条目 | 审核结论 | 后续动作 |
|---|---|---|---|
| `[REVIEW-OK]` | `audio.recording` capability | 录制业务控制面归 `audio`，数据面归 `stream`，文件结果归 `file`，符合 08/09 taxonomy。 | 可作为 `registry/domains/audio/domain.yaml` 草案输入。 |
| `[REVIEW-OK]` | `audio.startRecording` / `audio.stopRecording` / `audio.cancelRecording` / `audio.getRecordingState` | 业务域创建、关闭和查询业务流，不使用常规 `stream.open`。 | 进入 registry 时按本文 schema 拆分 request/response。 |
| `[REVIEW-OK]` | `audio.recordingStateChanged` / `audio.recordingProgressReported` | 状态变化和周期进度归业务域，公共 stream 层只承载数据面和可选流控。 | 进入 registry 时分配或复用 eventId。 |
| `[REVIEW-FIX]` | 文件模式与 `file` 域方法 | 当前 `docs/protocol/file/file.transfer.md` 仍是 blocker，本文不把 `file.getInfo` / `file.download` / `file.delete` 写成已定稿合同。 | file 域重写后同步文件查询、下载、删除方法名和 `fileRef` schema。 |
| `[REVIEW-ASK]` | AXDP `CommonAudioRecord` / `CommonAudioRecordStart` / `CommonAudioRecordStop` / `CommonAudioRecordData` | 旧协议可能用于产测抓音或工厂录音，不一定全部属于通用音频录制能力。 | 人工确认后再写 `legacyRefs`；产测专用流程可由 `diagnostic.audioTest` 触发并复用 `audio.recording`。 |
| `[REVIEW-ASK]` | `deliveryMode=file` | 本文补充了 `fileId` 生命周期、保留策略和权限字段，但具体持久化策略需要设备侧确认。 | 确认后写入 registry schema、能力字段和 file 域互操作说明。 |

---

## 1. 文档定位

`audio.recording` 定义设备侧音频录制任务的控制面。它回答：

1. 设备支持哪些录制源、格式、采样率、位深、通道数和输出方式。
2. 如何创建录制任务并取得 `recordingId`。
3. 实时输出时如何取得 `streamId` 并接收音频 chunk。
4. 文件输出时如何取得录制完成后的 `fileId`。
5. 如何查询、停止、取消录制任务。
6. 状态和进度如何通知客户端。
7. 旧 AXDP 音频录制命令如何迁移或保留为待确认适配项。

本方案是业务协议方案和人工评审输入。采纳后，稳定事实必须写入 `registry/domains/audio/domain.yaml` 或对应 registry YAML，并由 Generator 生成 `protocol/axtp.protocol.yaml` 和 `docs/generated/*`。本文不直接分配 numeric methodId、eventId、schema fieldId 或 stream profile ID；数值以 registry/generated 为准。

---

## 2. 域边界

| 内容 | 归属 | 说明 |
|---|---|---|
| 录制源、格式、采样率、通道、开始、停止、取消、状态 | `audio.recording` | 音频录制业务生命周期。 |
| `streamId`、`seqId`、`cursor`、payload、ACK/window/pause/resume/abort | `stream` | 统一数据面和可选公共流控。 |
| 文件查询、下载、删除、断点续传 | `file` | `audio` 只返回 `fileId` / `fileRef`，不承载文件数据。 |
| 产测流程编排、测试结果判定 | `diagnostic.audioTest` | 可以调用或复用 `audio.recording`，但不重新定义音频数据面。 |
| 音频算法参数 | `audio.algorithm` | 录制源可引用 `algorithm_input` / `algorithm_output`，但不配置算法参数。 |
| EQ 参数 | `audio.eq` | 录制可以抓取 EQ 前后链路，EQ 配置仍归 `audio.eq`。 |

关键原则：

```text
audio 负责录什么和何时录。
stream 负责怎么传音频数据。
file 负责录完后如何取文件。
diagnostic 负责产测流程编排，不拥有通用音频录制协议。
```

---

## 3. 非目标

`audio.recording` 不负责：

1. 不定义常规 `stream.open`，也不要求客户端先打开 stream。
2. 不把音频数据塞进普通 RPC response。
3. 不定义 UAC、会议、播放、路由、音量或算法配置。
4. 不定义通用文件传输协议。
5. 不承诺所有 legacy 工厂抓音命令都直接映射为通用录制能力。

正确调用路径：

```text
audio.startRecording
  -> 返回 recordingId
  -> deliveryMode=stream 时同时返回 streamId
  -> 后续音频数据走 stream 数据面

audio.stopRecording
  -> 正常停止采集
  -> deliveryMode=file 时返回 fileId 或 fileRef
```

---

## 4. 核心接口

| 类型 | 名称 | 说明 |
|---|---|---|
| capability | `audio.recording` | 音频录制能力块。 |
| method | `audio.getRecordingCapabilities` | 查询录制能力、默认值和约束。 |
| method | `audio.startRecording` | 创建录制任务。 |
| method | `audio.stopRecording` | 正常停止录制任务并产出最终结果。 |
| method | `audio.cancelRecording` | 取消任务并丢弃未完成结果。 |
| method | `audio.getRecordingState` | 查询指定录制任务状态。 |
| event | `audio.recordingStateChanged` | 录制状态变化通知。 |
| event | `audio.recordingProgressReported` | 录制进度周期上报。 |

`audio.getRecordingCapabilities` 是 audio 域内的细粒度能力查询；全局 capability discovery 只负责发现设备是否支持 `audio.recording` 能力块以及暴露哪些 methods/events。

---

## 5. 核心模型

### 5.1 录制源

推荐源名称如下。设备必须通过 `audio.getRecordingCapabilities` 声明实际支持的源。

| source | 说明 |
|---|---|
| `mic_raw` | 麦克风原始采集数据。 |
| `mic_processed` | 麦克风处理后数据。 |
| `uplink_raw` | 上行链路原始数据。 |
| `uplink_processed` | 上行处理后数据，通常送给远端、UAC、网络会议或编码器。 |
| `downlink_raw` | 下行接收原始数据。 |
| `downlink_playback` | 下行播放前数据。 |
| `aec_reference` | AEC 回声参考信号。 |
| `algorithm_input` | 音频算法输入。 |
| `algorithm_output` | 音频算法输出。 |
| `speaker_output` | 扬声器输出数据。 |

### 5.2 输出模式

| deliveryMode | 说明 | start response | 完成结果 |
|---|---|---|---|
| `stream` | 实时通过 stream 数据面输出音频 chunk。 | `recordingId` + `streamId` | `finalCursor` / `finalSeqId` / `bytesProduced` |
| `file` | 设备内部写入文件，完成后暴露文件引用。 | `recordingId` | `fileId` 或 `fileRef` |

MVP 推荐 `deliveryMode=stream`。`deliveryMode=file` 需要设备确认存储空间、保留策略、权限和 file 域方法名。

### 5.3 音频格式

| 字段 | 类型 | 说明 |
|---|---|---|
| `format` | enum | `pcm` 或 `wav`。stream 模式 MVP 使用 `pcm`；file 模式可使用 `wav`。 |
| `sampleRate` | uint32 | 采样率，单位 Hz。 |
| `bitDepth` | uint8 | 位深，例如 `16`、`24`、`32`。 |
| `sampleFormat` | enum | 可选，推荐 `s16le`、`s24le`、`s32le`、`float32le`。 |
| `channels` | uint8 | 通道数。 |
| `channelMask` | uint8[] | 可选，选择物理或逻辑通道索引。 |
| `chunkDurationMs` | uint16 | stream 模式下每个音频 chunk 的目标时长。 |

PCM 默认规则：

1. 未声明 `sampleFormat` 时，按 `bitDepth` 推导为 little-endian signed PCM。
2. 多通道默认 interleaved。
3. `payloadBytesPerChunk = sampleRate * channels * bytesPerSample * chunkDurationMs / 1000`。

示例：

```text
48000 Hz * 2 channels * 2 bytes * 20 ms / 1000 = 3840 bytes
```

### 5.4 录制状态

| state | 说明 |
|---|---|
| `starting` | 设备已接受请求，正在准备音频链路或 stream/file 资源。 |
| `recording` | 正在录制。 |
| `stopping` | 正在停止采集、关闭 stream 或写文件尾。 |
| `completed` | 正常完成。 |
| `failed` | 录制失败，结果不可用或不完整。 |
| `cancelled` | 已取消，未完成结果应被丢弃。 |

`unsupported` 不作为录制任务状态；不支持能力、源或格式时，RPC 返回错误。

### 5.5 标识符和时间

| 字段 | 说明 |
|---|---|
| `recordingId` | 录制任务 ID，由设备生成，在当前 session 或设备定义的保留窗口内唯一。 |
| `streamId` | stream 数据面 ID，由 stream runtime 分配，`deliveryMode=stream` 时由 `audio.startRecording` 返回。 |
| `seqId` | 每个 `streamId` 内从 0 开始递增的数据包序号。 |
| `cursor` | stream header 游标，语义由 `cursorUnit` 决定。 |
| `cursorUnit` | 推荐 `byteOffset`、`timestampUs` 或 `sampleIndex`。`recording_audio` 默认 `byteOffset`，`realtime_audio` 默认 `timestampUs`。 |
| `timestampUs` | 音频 chunk 对应的采样起始时间；无法取得采样时间时使用设备发送时间。 |
| `startedAtMs` / `endedAtMs` | 设备时钟下的任务开始/结束时间，单位毫秒。 |

---

## 6. `audio.getRecordingCapabilities`

### 6.1 请求

```json
{
  "method": "audio.getRecordingCapabilities",
  "params": {}
}
```

可选按源查询：

```json
{
  "method": "audio.getRecordingCapabilities",
  "params": {
    "source": "mic_raw"
  }
}
```

### 6.2 返回

```json
{
  "result": {
    "supported": true,
    "capability": "audio.recording",
    "maxConcurrentRecordings": 1,
    "defaultDeliveryMode": "stream",
    "deliveryModes": ["stream", "file"],
    "sources": [
      {
        "source": "mic_raw",
        "formats": ["pcm"],
        "sampleRates": [16000, 32000, 48000],
        "bitDepths": [16, 24, 32],
        "sampleFormats": ["s16le", "s24le", "s32le"],
        "channelCounts": [1, 2, 4, 6],
        "supportsChannelMask": true,
        "defaultSampleRate": 48000,
        "defaultBitDepth": 16,
        "defaultChannels": 2
      },
      {
        "source": "uplink_processed",
        "formats": ["pcm", "wav"],
        "sampleRates": [16000, 48000],
        "bitDepths": [16],
        "channelCounts": [1, 2]
      }
    ],
    "stream": {
      "profiles": ["recording_audio", "realtime_audio"],
      "defaultProfile": "recording_audio",
      "cursorUnits": ["byteOffset", "timestampUs", "sampleIndex"],
      "chunkDurationMs": [10, 20, 40],
      "preferredChunkDurationMs": 20,
      "maxPayloadBytes": 8192,
      "supportsSeqId": true,
      "supportsCursor": true,
      "supportsResume": false,
      "supportsMissingRanges": false
    },
    "file": {
      "formats": ["wav", "pcm"],
      "maxDurationMs": 600000,
      "maxBytes": 104857600,
      "defaultRetentionMs": 86400000,
      "requiresExplicitDelete": false
    },
    "multiSource": {
      "supported": false,
      "modes": []
    },
    "progress": {
      "supported": true,
      "defaultIntervalMs": 1000,
      "minIntervalMs": 200
    }
  }
}
```

### 6.3 能力字段规则

1. 客户端必须以 `sources[]` 中的实际能力为准，不得只按全局默认值构造请求。
2. `maxConcurrentRecordings=1` 时，第二个互斥录制请求返回 `BUSY` 或 `INVALID_STATE`。
3. `deliveryModes` 中不包含 `file` 时，客户端不得请求文件录制。
4. `stream.supportsResume=false` 时，断线后不能要求设备从旧 cursor 自动续传；客户端可以重新创建任务。
5. `file.requiresExplicitDelete=false` 时，设备可以按 `defaultRetentionMs` 自动清理文件。

---

## 7. `audio.startRecording`

### 7.1 请求字段

请求必须满足：`source` 和 `sources` 二选一；MVP 只要求支持 `source`。

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `source` | enum | 条件必填 | 单源录制源。 |
| `sources` | object[] | 条件必填 | 多源录制配置。 |
| `deliveryMode` | enum | 否 | `stream` 或 `file`；默认来自 capabilities。 |
| `format` | enum | 是 | `pcm` 或 `wav`。 |
| `sampleRate` | uint32 | 是 | 采样率，单位 Hz。 |
| `bitDepth` | uint8 | 是 | 位深。 |
| `sampleFormat` | enum | 否 | PCM 采样格式。 |
| `channels` | uint8 | 单源必填 | 通道数。 |
| `channelMask` | uint8[] | 否 | 要录制的通道索引。 |
| `durationMs` | uint32 | 否 | 期望录制时长；缺省表示由客户端显式停止。 |
| `maxDurationMs` | uint32 | 否 | 客户端可接受的最大时长，设备可用于防护。 |
| `streamProfile` | string | stream 模式可选 | 默认 `recording_audio`。 |
| `cursorUnit` | enum | stream 模式可选 | 默认随 stream profile。 |
| `chunkDurationMs` | uint16 | stream 模式可选 | 默认来自 capabilities。 |
| `progressIntervalMs` | uint32 | 否 | 进度事件间隔；低于能力最小值时返回 `OUT_OF_RANGE`。 |
| `metadata` | object | 否 | 调试工具、caseId、备注等非路由字段。 |

### 7.2 stream 模式请求

```json
{
  "method": "audio.startRecording",
  "params": {
    "source": "mic_raw",
    "format": "pcm",
    "sampleRate": 48000,
    "bitDepth": 16,
    "sampleFormat": "s16le",
    "channels": 2,
    "durationMs": 30000,
    "deliveryMode": "stream",
    "streamProfile": "recording_audio",
    "cursorUnit": "byteOffset",
    "chunkDurationMs": 20,
    "progressIntervalMs": 1000
  }
}
```

### 7.3 stream 模式返回

```json
{
  "result": {
    "recordingId": "rec_001",
    "state": "recording",
    "deliveryMode": "stream",
    "streamId": 201,
    "streamProfile": "recording_audio",
    "cursorUnit": "byteOffset",
    "source": "mic_raw",
    "format": "pcm",
    "sampleRate": 48000,
    "bitDepth": 16,
    "sampleFormat": "s16le",
    "channels": 2,
    "chunkDurationMs": 20,
    "payloadBytesPerChunk": 3840,
    "cursor": 0,
    "nextSeqId": 0,
    "startedAtMs": 1710000000000
  }
}
```

### 7.4 file 模式请求

```json
{
  "method": "audio.startRecording",
  "params": {
    "source": "uplink_processed",
    "format": "wav",
    "sampleRate": 48000,
    "bitDepth": 16,
    "sampleFormat": "s16le",
    "channels": 2,
    "durationMs": 30000,
    "deliveryMode": "file",
    "progressIntervalMs": 1000,
    "metadata": {
      "caseId": "issue-1024"
    }
  }
}
```

### 7.5 file 模式返回

```json
{
  "result": {
    "recordingId": "rec_002",
    "state": "recording",
    "deliveryMode": "file",
    "source": "uplink_processed",
    "format": "wav",
    "sampleRate": 48000,
    "bitDepth": 16,
    "sampleFormat": "s16le",
    "channels": 2,
    "cursor": 0,
    "cursorUnit": "byteOffset",
    "startedAtMs": 1710000000000
  }
}
```

file 模式开始时不返回 `streamId`。录制完成后，`audio.stopRecording` response 或 `audio.recordingStateChanged` event 返回 `fileId` / `fileRef`。

### 7.6 多源扩展

多源录制必须由 capabilities 声明 `multiSource.supported=true` 后才能使用。

```json
{
  "method": "audio.startRecording",
  "params": {
    "sources": [
      {
        "source": "mic_raw",
        "trackId": 0,
        "channels": 6,
        "channelMask": [0, 1, 2, 3, 4, 5]
      },
      {
        "source": "aec_reference",
        "trackId": 1,
        "channels": 2
      }
    ],
    "multiSourceMode": "separate_tracks",
    "format": "pcm",
    "sampleRate": 48000,
    "bitDepth": 16,
    "deliveryMode": "stream",
    "streamProfile": "recording_audio"
  }
}
```

多源封装模式：

| multiSourceMode | 说明 |
|---|---|
| `interleaved` | 多个源按约定顺序交织在同一个 payload 中。 |
| `separate_tracks` | 一个 `streamId` 内包含多个 track，chunk metadata 标识 `trackId`。 |
| `multi_stream` | 每个 source 返回独立 `streamId`，共享同一个 `recordingId`。 |

MVP 不要求实现多源录制。进入 registry 前必须为多源模式补充稳定 schema。

---

## 8. stream 数据面

### 8.1 数据包模型

`deliveryMode=stream` 时，音频数据通过 stream 数据面传输。JSON 示例用于说明字段语义；二进制 STREAM 帧只在 header 中携带 `streamId`、`seqId`、`cursor`，业务 metadata 由 stream context 或数据面 payload profile 解释。

```json
{
  "streamId": 201,
  "seqId": 0,
  "cursor": 0,
  "cursorUnit": "byteOffset",
  "timestampUs": 1710000000000000,
  "payloadType": "audio_chunk",
  "source": "mic_raw",
  "format": "pcm",
  "sampleRate": 48000,
  "channels": 2,
  "bitDepth": 16,
  "sampleFormat": "s16le",
  "chunkDurationMs": 20,
  "payloadBytes": 3840,
  "payload": "base64:AAAA..."
}
```

下一包：

```json
{
  "streamId": 201,
  "seqId": 1,
  "cursor": 3840,
  "cursorUnit": "byteOffset",
  "timestampUs": 1710000000020000,
  "payloadType": "audio_chunk",
  "payloadBytes": 3840,
  "payload": "base64:BBBB..."
}
```

### 8.2 `seqId` 规则

1. `seqId` 在每个 `streamId` 内独立计数。
2. 第一包为 `0`，每发送一个 `audio_chunk` 加 `1`。
3. 用于检测丢包、乱序和重复包。
4. `seqId` 不表示时间戳或字节偏移。

### 8.3 `cursor` 规则

`cursor` 的单位由 `cursorUnit` 决定：

| cursorUnit | cursor 含义 | 推荐场景 |
|---|---|---|
| `byteOffset` | 当前 chunk 在录制对象中的起始字节偏移。 | 可靠录制、问题复现、文件化导出。 |
| `timestampUs` | 当前 chunk 的采样起始时间戳，单位微秒。 | 实时监听、低延迟预览。 |
| `sampleIndex` | 当前 chunk 的第一帧采样序号。 | 需要无歧义音频采样定位的实现。 |

`recording_audio` profile 默认使用 `byteOffset`。如果使用 `byteOffset`：

```text
seqId=0 cursor=0    payloadBytes=3840
seqId=1 cursor=3840 payloadBytes=3840
seqId=2 cursor=7680 payloadBytes=3840
```

如果接收端收到 `seqId=0` 和 `seqId=2`，则 `seqId=1` 缺失；缺失字节范围大概率为 `3840..7679`。

### 8.4 stream profile

| profile | 目标 | reliability | ordered | ackMode | cursorUnit | backpressurePolicy |
|---|---|---|---|---|---|---|
| `recording_audio` | 录制导出、问题定位、产测抓音 | `reliable` | true | `window` | `byteOffset` | `pause_producer` |
| `realtime_audio` | 实时监听、低延迟预览 | `best_effort` | true | `periodic` 或 `none` | `timestampUs` | `drop_old_chunks` |

`recording_audio` 完整性优先，可以接受较高延迟，不应静默丢数据。`realtime_audio` 低延迟优先，可以接受少量丢包，不建议重传过旧音频。

---

## 9. `audio.getRecordingState`

### 9.1 请求

```json
{
  "method": "audio.getRecordingState",
  "params": {
    "recordingId": "rec_001"
  }
}
```

### 9.2 stream 模式返回

```json
{
  "result": {
    "recordingId": "rec_001",
    "state": "recording",
    "deliveryMode": "stream",
    "streamId": 201,
    "streamProfile": "recording_audio",
    "cursorUnit": "byteOffset",
    "source": "mic_raw",
    "format": "pcm",
    "sampleRate": 48000,
    "bitDepth": 16,
    "sampleFormat": "s16le",
    "channels": 2,
    "durationMs": 12000,
    "bytesProduced": 2304000,
    "cursor": 2304000,
    "nextSeqId": 600,
    "startedAtMs": 1710000000000
  }
}
```

### 9.3 file 模式返回

```json
{
  "result": {
    "recordingId": "rec_002",
    "state": "recording",
    "deliveryMode": "file",
    "source": "uplink_processed",
    "format": "wav",
    "sampleRate": 48000,
    "bitDepth": 16,
    "channels": 2,
    "durationMs": 12000,
    "bytesWritten": 2304044,
    "cursor": 2304044,
    "cursorUnit": "byteOffset",
    "startedAtMs": 1710000000000
  }
}
```

### 9.4 终态返回

终态任务在设备保留窗口内仍可查询。超过保留窗口后返回 `NOT_FOUND`。

```json
{
  "result": {
    "recordingId": "rec_002",
    "state": "completed",
    "deliveryMode": "file",
    "durationMs": 30000,
    "bytesWritten": 5760044,
    "finalCursor": 5760044,
    "fileRef": {
      "fileId": "file_audio_rec_002",
      "name": "audio_rec_002.wav",
      "mimeType": "audio/wav",
      "size": 5760044,
      "createdAtMs": 1710000030000,
      "expiresAtMs": 1710086430000
    },
    "endedAtMs": 1710000030000
  }
}
```

---

## 10. `audio.stopRecording`

### 10.1 请求

```json
{
  "method": "audio.stopRecording",
  "params": {
    "recordingId": "rec_001"
  }
}
```

### 10.2 stream 模式返回

```json
{
  "result": {
    "recordingId": "rec_001",
    "state": "completed",
    "deliveryMode": "stream",
    "streamId": 201,
    "durationMs": 30000,
    "bytesProduced": 5760000,
    "finalCursor": 5760000,
    "finalSeqId": 1499,
    "endedAtMs": 1710000030000
  }
}
```

### 10.3 file 模式返回

```json
{
  "result": {
    "recordingId": "rec_002",
    "state": "completed",
    "deliveryMode": "file",
    "durationMs": 30000,
    "bytesWritten": 5760044,
    "finalCursor": 5760044,
    "fileRef": {
      "fileId": "file_audio_rec_002",
      "name": "audio_rec_002.wav",
      "mimeType": "audio/wav",
      "size": 5760044,
      "createdAtMs": 1710000030000,
      "expiresAtMs": 1710086430000
    },
    "endedAtMs": 1710000030000
  }
}
```

### 10.4 停止规则

1. 正常停止必须使用 `audio.stopRecording`。
2. `recording` 状态下可停止；`starting` 状态下设备可以等待启动完成后停止，也可以返回 `INVALID_STATE`。
3. `completed` / `failed` / `cancelled` 状态下重复停止应返回当前终态，或返回 `INVALID_STATE`；具体策略进入 registry 前应固定。
4. stream 模式下，最后一个音频 chunk 必须先发送，再发布 `completed` 状态事件。
5. file 模式下，设备必须写完文件尾或索引后才能返回 `fileRef`。

---

## 11. `audio.cancelRecording`

### 11.1 请求

```json
{
  "method": "audio.cancelRecording",
  "params": {
    "recordingId": "rec_001",
    "reason": "user_request"
  }
}
```

### 11.2 返回

```json
{
  "result": {
    "recordingId": "rec_001",
    "state": "cancelled",
    "reason": "user_request",
    "endedAtMs": 1710000012000
  }
}
```

### 11.3 取消规则

1. `starting` / `recording` / `stopping` 状态可以取消。
2. `completed` 后不允许取消；如需删除文件，由 file 域执行。
3. file 模式取消后，设备应删除临时文件或将临时文件标记为不可见。
4. stream 模式取消后，设备应释放 `streamId`，并停止发送后续 chunk。
5. 取消会触发 `audio.recordingStateChanged(state=cancelled)`。

---

## 12. 事件

### 12.1 `audio.recordingStateChanged`

触发条件：

1. 录制进入 `starting` 或 `recording`。
2. 客户端停止录制。
3. 达到 `durationMs` 或设备最大时长自动停止。
4. 录制完成。
5. 客户端取消录制。
6. stream 异常中止。
7. 文件写入失败、存储空间不足或音频设备不可用。

stream 开始事件：

```json
{
  "event": "audio.recordingStateChanged",
  "params": {
    "recordingId": "rec_001",
    "previousState": "starting",
    "state": "recording",
    "deliveryMode": "stream",
    "streamId": 201,
    "streamProfile": "recording_audio",
    "cursor": 0,
    "cursorUnit": "byteOffset",
    "nextSeqId": 0,
    "timestampMs": 1710000000000
  }
}
```

stream 完成事件：

```json
{
  "event": "audio.recordingStateChanged",
  "params": {
    "recordingId": "rec_001",
    "previousState": "stopping",
    "state": "completed",
    "deliveryMode": "stream",
    "streamId": 201,
    "finalCursor": 5760000,
    "finalSeqId": 1499,
    "durationMs": 30000,
    "reason": "user_stop",
    "timestampMs": 1710000030000
  }
}
```

file 完成事件：

```json
{
  "event": "audio.recordingStateChanged",
  "params": {
    "recordingId": "rec_002",
    "previousState": "stopping",
    "state": "completed",
    "deliveryMode": "file",
    "fileRef": {
      "fileId": "file_audio_rec_002",
      "name": "audio_rec_002.wav",
      "mimeType": "audio/wav",
      "size": 5760044,
      "createdAtMs": 1710000030000,
      "expiresAtMs": 1710086430000
    },
    "finalCursor": 5760044,
    "durationMs": 30000,
    "reason": "duration_reached",
    "timestampMs": 1710000030000
  }
}
```

失败事件：

```json
{
  "event": "audio.recordingStateChanged",
  "params": {
    "recordingId": "rec_001",
    "previousState": "recording",
    "state": "failed",
    "deliveryMode": "stream",
    "streamId": 201,
    "error": {
      "code": "UNAVAILABLE",
      "reason": "audio_device_lost",
      "message": "Audio device is unavailable"
    },
    "timestampMs": 1710000012000
  }
}
```

### 12.2 `audio.recordingProgressReported`

进度是周期性上报，使用 `Reported`，不使用 `Changed`。

stream 模式：

```json
{
  "event": "audio.recordingProgressReported",
  "params": {
    "recordingId": "rec_001",
    "state": "recording",
    "deliveryMode": "stream",
    "streamId": 201,
    "durationMs": 12000,
    "bytesProduced": 2304000,
    "cursor": 2304000,
    "cursorUnit": "byteOffset",
    "nextSeqId": 600,
    "timestampMs": 1710000012000
  }
}
```

file 模式：

```json
{
  "event": "audio.recordingProgressReported",
  "params": {
    "recordingId": "rec_002",
    "state": "recording",
    "deliveryMode": "file",
    "durationMs": 12000,
    "bytesWritten": 2304044,
    "cursor": 2304044,
    "cursorUnit": "byteOffset",
    "timestampMs": 1710000012000
  }
}
```

事件节流规则：

1. 默认间隔由 capabilities 的 `progress.defaultIntervalMs` 给出。
2. 状态变化事件不受进度节流限制。
3. 设备在资源紧张时可以降低进度频率，但不得省略终态事件。

---

## 13. 与 `stream.abort` 的关系

`stream.abort` 只用于异常释放，不替代正常停止。

正常路径：

```text
audio.stopRecording(recordingId)
```

异常路径：

```text
stream.abort(streamId)
  -> stream 层释放数据面资源
  -> audio 层将 recordingId 转为 failed 或 cancelled
  -> audio.recordingStateChanged 上报终态
```

`stream.abort` 适用场景：

1. 接收端崩溃或不再接收数据。
2. transport 断开。
3. 流控检测到不可恢复错误。
4. 调试工具强制释放资源。

事件示例：

```json
{
  "event": "audio.recordingStateChanged",
  "params": {
    "recordingId": "rec_001",
    "previousState": "recording",
    "state": "failed",
    "deliveryMode": "stream",
    "streamId": 201,
    "error": {
      "code": "CANCELED",
      "reason": "stream_aborted",
      "message": "Stream was aborted by receiver"
    },
    "timestampMs": 1710000012000
  }
}
```

---

## 14. 与 file 域的关系

`deliveryMode=file` 时，`audio` 域负责创建录制任务并生成音频文件，完成后返回 `fileRef`。

```json
{
  "fileRef": {
    "fileId": "file_audio_rec_002",
    "name": "audio_rec_002.wav",
    "mimeType": "audio/wav",
    "size": 5760044,
    "sha256": "optional-lowercase-hex",
    "createdAtMs": 1710000030000,
    "expiresAtMs": 1710086430000
  }
}
```

`fileRef` 字段规则：

1. `fileId` 是跨域文件引用，供 file 域后续查询或传输。
2. `name`、`mimeType`、`size`、`createdAtMs` 应尽量在录制完成时返回，减少额外查询。
3. `sha256` 可选；设备无法实时计算时可以省略。
4. `expiresAtMs` 可选；存在时表示自动清理时间。
5. file 域正式协议重写前，本文不固定文件查询、下载、删除方法名。

权限和隐私规则：

1. 音频录制属于敏感能力，设备可以要求 session 权限、用户授权或调试模式。
2. 权限不足返回 `PERMISSION_DENIED`。
3. 文件默认保留时间必须由 capabilities 或产品策略声明。
4. 设备应避免把录音文件暴露给未授权 session。

---

## 15. 与 diagnostic 域的关系

产测、工厂录音或自动化诊断可以由 `diagnostic.audioTest` 编排：

```text
diagnostic.runAudioTest
  -> 内部调用 audio.startRecording
  -> 收集 stream/file 结果
  -> 判定测试结果
```

边界规则：

1. `diagnostic` 可以决定何时录、录多久、如何判定结果。
2. `audio.recording` 仍然负责录制任务生命周期和音频数据面。
3. legacy 工厂抓音命令如果只在产测中使用，优先登记为 `diagnostic.audioTest` 的流程适配，而不是暴露为通用用户能力。

---

## 16. 错误处理

优先复用 registry 中的 common error code。错误的具体字段放入 `error.data`。

| code | 典型场景 |
|---|---|
| `NOT_SUPPORTED` | 不支持 `audio.recording`、指定源、格式、采样率、位深或输出模式。 |
| `INVALID_ARGUMENT` | 参数类型错误、缺少必填字段、`source` 与 `sources` 同时出现。 |
| `OUT_OF_RANGE` | `durationMs`、`chunkDurationMs`、`progressIntervalMs` 或通道索引越界。 |
| `INVALID_STATE` | 当前状态不允许停止、取消或重复开始互斥任务。 |
| `BUSY` | 音频链路、录制资源或目标 source 被占用。 |
| `RESOURCE_EXHAUSTED` | 存储空间不足、stream buffer 不足或达到并发上限。 |
| `PERMISSION_DENIED` | 当前 session 无录音权限或文件读取权限。 |
| `NOT_FOUND` | `recordingId` 或完成后的 `fileId` 不存在。 |
| `UNAVAILABLE` | 音频设备不可用、链路未初始化或设备处于不可录制模式。 |
| `TIMEOUT` | 启动、停止、写文件尾或 stream drain 超时。 |
| `INTERNAL_ERROR` | 设备内部错误。 |

错误示例：

```json
{
  "error": {
    "code": "NOT_SUPPORTED",
    "message": "sampleRate is not supported by source",
    "data": {
      "field": "sampleRate",
      "value": 96000,
      "source": "mic_raw",
      "supported": [16000, 32000, 48000]
    }
  }
}
```

---

## 17. Legacy AXDP 映射

以下映射只作为评审输入。未完成人工确认前，不应直接写入 `legacyRefs`。

| legacy | wire | 已知行为 | AXTP 映射建议 | 评审状态 |
|---|---|---|---|---|
| `CommonAudioRecord` | `0xC0025 / 0x0025 -> 0x00A5` | request 为 `uint32 BE mic_mask`，注释为工厂录音；case 空，未读取 payload，无 callback。 | 待确认。若是通用抓音，可适配 `audio.startRecording`；若是产测流程，归 `diagnostic.audioTest`。 | `[REVIEW-ASK]` |
| `CommonAudioRecordStart` | `0xC0063 / 0x0063 -> 0x00E3` | request 为 `uint16 BE max_time_seconds`；response 至少 8B：`support`、`audio_type`、`sample_rate`、`channel`、`bit_width`。 | 可适配 `audio.startRecording`，把 `max_time_seconds` 映射为 `durationMs` 或 `maxDurationMs`。 | `[REVIEW-ASK]` |
| `CommonAudioRecordStop` | `0xC0064 / 0x0064 -> 0x00E4` | request 无 payload；response 至少 2B：`data_len`。 | 可适配 `audio.stopRecording`，`data_len` 映射为 `bytesProduced` 或 `finalCursor`，具体单位需确认。 | `[REVIEW-ASK]` |
| `CommonAudioRecordData` | `0xBFFE5 / 0xFFE5 -> 0x0065` | 设备上报 raw payload；注释说明原应为 `0xC0065` 且下位机错误。 | 映射为 stream 数据面 `payloadType=audio_chunk`，不新增 `audio.record.data` RPC 方法。 | `[REVIEW-ASK]` |

兼容命名说明：

1. migration generated 中的 `audio.record.start` / `audio.record.stop` / `audio.record.data` 是候选兼容名，不是本文推荐的最终 wire name。
2. 最终新协议使用 `audio.startRecording` / `audio.stopRecording`。
3. raw 音频数据必须归 stream 数据面，不作为普通 RPC method。

---

## 18. Binary / TLV 映射建议

JSON 中使用可读字段；二进制映射进入 registry 前再分配 fieldId。

| 字段 | 建议类型 | 说明 |
|---|---|---|
| `recordingId` | string 或 uint32 handle | RPC 控制面任务 ID。 |
| `streamId` | uint32 | STREAM header 字段。 |
| `seqId` | uint32 或 uint64 | STREAM header 字段。 |
| `cursor` | uint64 | STREAM header 字段。 |
| `cursorUnit` | enum uint8 | stream context 字段。 |
| `timestampUs` | uint64 | chunk metadata。 |
| `payloadType` | enum uint8 | `audio_chunk`。 |
| `source` / `sourceId` | enum uint8 | 音频录制源。 |
| `format` | enum uint8 | `pcm` / `wav`。 |
| `sampleRate` | uint32 | Hz。 |
| `channels` | uint8 | 通道数。 |
| `bitDepth` | uint8 | 位深。 |
| `sampleFormat` | enum uint8 | PCM 采样格式。 |
| `chunkDurationMs` | uint16 | chunk 时长。 |
| `payloadLength` | uint32 | payload 长度。 |
| `payload` | bytes | 音频数据。 |

`sourceId` 候选值：

| sourceId | source |
|---|---|
| `0x01` | `mic_raw` |
| `0x02` | `mic_processed` |
| `0x03` | `uplink_raw` |
| `0x04` | `uplink_processed` |
| `0x05` | `downlink_raw` |
| `0x06` | `downlink_playback` |
| `0x07` | `aec_reference` |
| `0x08` | `algorithm_input` |
| `0x09` | `algorithm_output` |
| `0x0A` | `speaker_output` |

候选数字值只用于后续 registry 评审；JSON 协议继续使用字符串枚举。

---

## 19. 推荐 MVP

MVP 方法：

```text
audio.getRecordingCapabilities
audio.startRecording
audio.stopRecording
audio.getRecordingState
```

MVP 事件：

```text
audio.recordingStateChanged
audio.recordingProgressReported
```

MVP 能力：

| 项 | 要求 |
|---|---|
| source | 单源，至少 `mic_raw` 或设备主录制源。 |
| deliveryMode | `stream`。 |
| format | `pcm`。 |
| sampleRate | 至少 `48000` 或设备主采样率。 |
| bitDepth | `16`。 |
| channels | `1` / `2`，或设备声明的主通道数。 |
| chunkDurationMs | 推荐 `20`。 |
| streamProfile | `recording_audio`。 |
| cursorUnit | `byteOffset`。 |
| stop | 支持 `audio.stopRecording` 正常停止。 |
| error | 支持 common error code 和 `error.data.field`。 |

可选增强：

```text
audio.cancelRecording
deliveryMode=file
multiSource
channelMask
realtime_audio profile
cursorUnit=sampleIndex
resume_from_cursor
missingRanges
fileRef.sha256
```

---

## 20. Registry 草案拆分清单

进入 `registry/domains/audio/domain.yaml` 时，建议拆分为：

| registry 对象 | 建议名称 |
|---|---|
| capability | `audio.recording` |
| methods | `audio.getRecordingCapabilities`、`audio.startRecording`、`audio.stopRecording`、`audio.cancelRecording`、`audio.getRecordingState` |
| events | `audio.recordingStateChanged`、`audio.recordingProgressReported` |
| schemas | `RecordingCapabilities`、`RecordingSourceCapability`、`StartRecordingRequest`、`RecordingState`、`RecordingProgress`、`RecordingFileRef` |
| stream profiles | `recording_audio`、`realtime_audio`，或按 stream profile registry 命名规则收敛为正式名称 |
| payload type | `audio_chunk` |
| legacyRefs | 仅写入人工确认后的 AXDP 命令映射 |

采纳前检查：

1. file 域 blocker 已处理，`fileRef` 与 file 方法名一致。
2. stream profile 命名和 ID 已在 stream profile registry 中确认。
3. `cursorUnit` 默认值与 stream spec 一致。
4. legacy AXDP 工厂抓音是否归 `audio.recording` 已确认。
5. 每个 schema 字段都有类型、必填规则、单位和枚举范围。
6. 至少补充一个 stream 模式正向测试向量和一个错误测试向量。

---

## 21. 最终结论

`audio.recording` 是音频录制、抓音和录制导出的业务能力块。它负责录制任务生命周期；`stream` 负责实时数据面；`file` 负责完成后的文件访问；`diagnostic` 只负责产测流程编排。

普通业务调用方不需要显式调用 `stream.open`。正常停止必须走 `audio.stopRecording`；`stream.abort` 仅用于异常释放。旧 AXDP 录音命令在人工确认前只保留为待确认 legacy 线索，不直接进入最终 registry 合同。
