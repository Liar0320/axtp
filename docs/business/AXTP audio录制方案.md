# AXTP audio录制方案

# Audio 音频流录制协议方案



版本：v0\.1  

归属域：`audio`  

数据面：`stream`  

适用场景：音频调试、产测抓音、问题定位、上位机实时监听、算法前后数据录制、文件化录制导出。



---



## 1\. 设计目标



音频流录制协议用于控制设备采集并输出指定音频链路的数据，例如：



```Plain Text
mic_raw
uplink_processed
downlink_playback
aec_reference
algorithm_input
algorithm_output
speaker_output
```



协议需要支持：



```Plain Text
1. 查询录制能力；
2. 创建录制任务；
3. 返回 recordingId 和 streamId；
4. 支持实时流式输出；
5. 支持录制到文件；
6. 支持 streamId / seqId / cursor；
7. 支持查询录制状态；
8. 支持停止、取消；
9. 支持状态事件和进度事件；
10. 支持与 stream 流控层协作。
```



---



## 2\. 域职责划分



```Plain Text
audio
  负责音频录制业务控制面：
  录制源、采样率、通道数、位深、格式、开始、停止、状态、文件结果。

stream
  负责统一数据面：
  streamId、seqId、cursor、payloadType、payload、timestamp、可选 ack/window/pause/resume/abort。

file
  负责录制文件下载、查询、删除。

diagnostic
  如果录制用于产测流程，可以由 diagnostic 触发；
  但通用录制能力仍归 audio。
```



关键原则：



```Plain Text
audio 负责“录什么”；
stream 负责“怎么传”；
file 负责“录完后怎么取文件”。
```



---



## 3\. 不建议的设计



不要让上位机先调用：



```Plain Text
stream.open
```



再调用 audio 录制。



也不要把音频数据直接放进：



```Plain Text
audio.startRecording 的普通 RPC response
```



正确方式是：



```Plain Text
audio.startRecording 创建录制任务
audio.startRecording 返回 recordingId + streamId
后续音频数据通过 stream 数据面输出
```



---



## 4\. 方法清单



推荐方法：



```Plain Text
audio.getRecordingCapabilities
audio.startRecording
audio.stopRecording
audio.cancelRecording
audio.getRecordingState
```



推荐事件：



```Plain Text
audio.recordingStateChanged
audio.recordingProgressReported
```



如果需要文件模式配合：



```Plain Text
file.getInfo
file.download
file.delete
```



如果需要高级 stream 流控，可选使用：



```Plain Text
stream.getState
stream.getStats
stream.ack
stream.windowUpdate
stream.pause
stream.resume
stream.abort
```



但普通业务调用方不要求直接调用这些 `stream.*` 方法。



---



# 5\. 录制模式



协议支持两种录制输出方式：



```Plain Text
stream
  实时通过 stream 数据面输出音频数据。

file
  设备内部录制为文件，录制完成后返回 fileId。
```



推荐字段：



```Plain Text
deliveryMode: stream | file
```



---



## 6\. audio\.getRecordingCapabilities



### 6\.1 用途



查询设备支持哪些音频录制源、格式、采样率、通道数、位深、最大录制时长、输出方式等。



### 6\.2 请求



```JSON
{
  "method": "audio.getRecordingCapabilities",
  "params": {}
}
```



### 6\.3 返回



```JSON
{
  "result": {
    "supported": true,
    "sources": [
      "mic_raw",
      "mic_processed",
      "uplink_raw",
      "uplink_processed",
      "downlink_raw",
      "downlink_playback",
      "aec_reference",
      "algorithm_input",
      "algorithm_output",
      "speaker_output"
    ],
    "formats": ["pcm", "wav"],
    "sampleRates": [16000, 32000, 48000],
    "bitDepths": [16, 24, 32],
    "channelCounts": [1, 2, 4, 6, 8],
    "deliveryModes": ["stream", "file"],
    "streamProfiles": [
      "realtime_audio",
      "recording_audio"
    ],
    "defaultStreamProfile": "recording_audio",
    "maxDurationMs": 600000,
    "supportsMultiSource": true,
    "supportsChannelMask": true,
    "supportsCursor": true,
    "supportsSeqId": true,
    "supportsResume": false,
    "chunkDurationMs": [10, 20, 40],
    "preferredChunkDurationMs": 20,
    "maxPayloadBytes": 8192
  }
}
```



### 6\.4 字段说明



```Plain Text
sources
  支持的录制点位。

formats
  支持的音频格式。stream 模式推荐 pcm；file 模式可以是 wav 或 pcm。

sampleRates
  支持的采样率。

bitDepths
  支持的位深。

channelCounts
  支持的通道数。

deliveryModes
  支持 stream / file。

streamProfiles
  支持的 stream profile。

defaultStreamProfile
  默认流控 profile。

maxDurationMs
  最大录制时长。

supportsMultiSource
  是否支持同时录制多个源。

supportsChannelMask
  是否支持指定通道掩码。

chunkDurationMs
  支持的音频 chunk 时长。
```



---



# 7\. 音频录制源定义



推荐录制源：



```Plain Text
mic_raw
  麦克风原始采集数据。

mic_processed
  麦克风处理后数据。

uplink_raw
  上行链路原始数据。

uplink_processed
  上行处理后数据，通常是送给远端、UAC、网络会议的音频。

downlink_raw
  下行接收原始数据。

downlink_playback
  下行播放前数据。

aec_reference
  AEC 回声参考信号。

algorithm_input
  音频算法输入。

algorithm_output
  音频算法输出。

speaker_output
  扬声器输出数据。
```



---



# 8\. audio\.startRecording



## 8\.1 用途



创建音频录制任务。



当 `deliveryMode = stream` 时，必须返回：



```Plain Text
recordingId
streamId
```



当 `deliveryMode = file` 时，必须返回：



```Plain Text
recordingId
```



录制完成后返回：



```Plain Text
fileId
```



---



## 8\.2 实时流录制请求



```JSON
{
  "method": "audio.startRecording",
  "params": {
    "source": "mic_raw",
    "format": "pcm",
    "sampleRate": 48000,
    "bitDepth": 16,
    "channels": 2,
    "durationMs": 30000,
    "deliveryMode": "stream",
    "streamProfile": "recording_audio",
    "chunkDurationMs": 20
  }
}
```



## 8\.3 实时流录制返回



```JSON
{
  "result": {
    "recordingId": "rec_001",
    "streamId": 201,
    "state": "recording",
    "deliveryMode": "stream",
    "streamProfile": "recording_audio",
    "source": "mic_raw",
    "format": "pcm",
    "sampleRate": 48000,
    "bitDepth": 16,
    "channels": 2,
    "chunkDurationMs": 20,
    "payloadBytesPerChunk": 3840,
    "cursor": 0,
    "nextSeqId": 0,
    "startedAtMs": 1710000000000
  }
}
```



### 8\.4 字节数计算



对于 PCM：



```Plain Text
payloadBytesPerChunk = sampleRate * channels * bytesPerSample * chunkDurationMs / 1000
```



示例：



```Plain Text
48kHz / 16bit / 2ch / 20ms
= 48000 * 2 * 2 * 20 / 1000
= 3840 bytes
```



---



## 8\.5 文件录制请求



```JSON
{
  "method": "audio.startRecording",
  "params": {
    "source": "uplink_processed",
    "format": "wav",
    "sampleRate": 48000,
    "bitDepth": 16,
    "channels": 2,
    "durationMs": 30000,
    "deliveryMode": "file"
  }
}
```



## 8\.6 文件录制返回



```JSON
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
    "cursor": 0,
    "startedAtMs": 1710000000000
  }
}
```



说明：



```Plain Text
deliveryMode = file 时不返回 streamId。
录制结束后通过 audio.stopRecording 或 recordingStateChanged 返回 fileId。
```



---



# 9\. 多源录制



如果设备支持多源录制，可以使用 `sources`。



```JSON
{
  "method": "audio.startRecording",
  "params": {
    "sources": [
      {
        "source": "mic_raw",
        "channels": 6,
        "channelMask": [0, 1, 2, 3, 4, 5]
      },
      {
        "source": "aec_reference",
        "channels": 2
      }
    ],
    "format": "pcm",
    "sampleRate": 48000,
    "bitDepth": 16,
    "durationMs": 30000,
    "deliveryMode": "stream",
    "streamProfile": "recording_audio"
  }
}
```



返回：



```JSON
{
  "result": {
    "recordingId": "rec_003",
    "streamId": 202,
    "state": "recording",
    "deliveryMode": "stream",
    "streamProfile": "recording_audio",
    "sources": [
      {
        "source": "mic_raw",
        "channels": 6
      },
      {
        "source": "aec_reference",
        "channels": 2
      }
    ],
    "cursor": 0,
    "nextSeqId": 0
  }
}
```



多源录制的数据封装方式需要由能力声明决定：



```Plain Text
interleaved
  多源交织在同一个 payload 中。

separate_tracks
  一个 stream 中包含多个 track。

multi_stream
  每个 source 返回一个独立 streamId。
```



MVP 推荐：



```Plain Text
single source
```



多源作为扩展。



---



# 10\. Stream 数据面：音频数据包结构



当 `deliveryMode = stream` 时，音频数据通过 stream 数据面传输。



## 10\.1 音频 chunk 示例



```JSON
{
  "streamId": 201,
  "seqId": 0,
  "cursor": 0,
  "timestampMs": 1710000000000,
  "payloadType": "audio_chunk",
  "source": "mic_raw",
  "format": "pcm",
  "sampleRate": 48000,
  "channels": 2,
  "bitDepth": 16,
  "chunkDurationMs": 20,
  "payload": "base64:AAAA..."
}
```



下一包：



```JSON
{
  "streamId": 201,
  "seqId": 1,
  "cursor": 3840,
  "timestampMs": 1710000000020,
  "payloadType": "audio_chunk",
  "source": "mic_raw",
  "format": "pcm",
  "sampleRate": 48000,
  "channels": 2,
  "bitDepth": 16,
  "chunkDurationMs": 20,
  "payload": "base64:BBBB..."
}
```



---



## 10\.2 字段说明



```Plain Text
streamId
  音频数据流 ID，由 audio.startRecording 返回。

seqId
  当前 stream 内递增的数据包序号。
  每发送一个 audio chunk 加 1。

cursor
  当前 audio chunk 在本次录制流中的字节偏移。
  推荐单位 byte。
  第一个 chunk 为 0。
  下一包 cursor = 上一包 cursor + 上一包 payloadBytes。

timestampMs
  当前 chunk 对应的采样起始时间戳或设备发送时间戳。
  如果能提供采样起始时间，优先使用采样起始时间。

payloadType
  固定为 audio_chunk。

source
  音频录制源。

format
  pcm / wav。
  stream 模式推荐 pcm。

sampleRate
  采样率。

channels
  通道数。

bitDepth
  位深。

chunkDurationMs
  当前 chunk 时长。

payload
  音频数据。
  JSON 示例中用 base64。
  二进制 stream 数据面中直接承载 bytes。
```



---



# 11\. seqId / cursor 规则



## 11\.1 seqId



```Plain Text
1. seqId 从 0 开始。
2. 每发送一个 audio_chunk 加 1。
3. 用于检测丢包、乱序、重复包。
4. seqId 不表示字节偏移。
```



## 11\.2 cursor



```Plain Text
1. cursor 表示当前 chunk 在录制流中的起始字节偏移。
2. cursor 从 0 开始。
3. cursor 必须单调递增。
4. 下一包 cursor = 上一包 cursor + 上一包 payloadBytes。
5. cursor 用于断点续传、缺失范围定位、录制进度查询。
```



示例：



```Plain Text
seqId=0 cursor=0    payloadBytes=3840
seqId=1 cursor=3840 payloadBytes=3840
seqId=2 cursor=7680 payloadBytes=3840
```



如果收到：



```Plain Text
seqId=0 cursor=0
seqId=2 cursor=7680
```



说明：



```Plain Text
seqId=1 缺失。
缺失数据范围大概率为 cursor 3840 ~ 7679。
```



---



# 12\. streamProfile 选择



## 12\.1 recording\_audio



推荐用于音频录制导出。



```JSON
{
  "profile": "recording_audio",
  "reliability": "reliable",
  "ordered": true,
  "ackMode": "window",
  "lossRecovery": "resume_from_cursor",
  "backpressurePolicy": "pause_producer",
  "supportsResume": true,
  "supportsMissingRanges": true
}
```



适合：



```Plain Text
录制导出
问题定位
产测抓音
算法前后数据保存
```



特点：



```Plain Text
完整性优先。
可以接受较高延迟。
不应静默丢数据。
```



---



## 12\.2 realtime\_audio



推荐用于实时监听。



```JSON
{
  "profile": "realtime_audio",
  "reliability": "best_effort",
  "ordered": true,
  "ackMode": "periodic",
  "lossRecovery": "none",
  "backpressurePolicy": "drop_old_chunks"
}
```



适合：



```Plain Text
实时监听
低延迟预览
临时音频监控
```



特点：



```Plain Text
低延迟优先。
可接受少量丢包。
不建议重传过旧音频。
```



---



# 13\. audio\.getRecordingState



## 13\.1 请求



```JSON
{
  "method": "audio.getRecordingState",
  "params": {
    "recordingId": "rec_001"
  }
}
```



## 13\.2 stream 模式返回



```JSON
{
  "result": {
    "recordingId": "rec_001",
    "state": "recording",
    "deliveryMode": "stream",
    "streamId": 201,
    "streamProfile": "recording_audio",
    "source": "mic_raw",
    "format": "pcm",
    "sampleRate": 48000,
    "bitDepth": 16,
    "channels": 2,
    "durationMs": 12000,
    "bytesProduced": 2304000,
    "cursor": 2304000,
    "nextSeqId": 600,
    "startedAtMs": 1710000000000
  }
}
```



## 13\.3 file 模式返回



```JSON
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
    "startedAtMs": 1710000000000
  }
}
```



---



# 14\. audio\.stopRecording



## 14\.1 用途



停止录制任务。



对于 stream 模式：



```Plain Text
停止音频采集；
关闭 audio 业务流；
释放内部 stream；
返回 finalCursor / finalSeqId。
```



对于 file 模式：



```Plain Text
停止音频采集；
写文件尾；
生成 fileId；
返回 fileId。
```



---



## 14\.2 stream 模式请求



```JSON
{
  "method": "audio.stopRecording",
  "params": {
    "recordingId": "rec_001"
  }
}
```



## 14\.3 stream 模式返回



```JSON
{
  "result": {
    "recordingId": "rec_001",
    "state": "completed",
    "deliveryMode": "stream",
    "streamId": 201,
    "durationMs": 30000,
    "bytesProduced": 5760000,
    "finalCursor": 5760000,
    "finalSeqId": 1499
  }
}
```



---



## 14\.4 file 模式返回



```JSON
{
  "result": {
    "recordingId": "rec_002",
    "state": "completed",
    "deliveryMode": "file",
    "durationMs": 30000,
    "bytesWritten": 5760044,
    "finalCursor": 5760044,
    "fileId": "file_audio_rec_002"
  }
}
```



---



# 15\. audio\.cancelRecording



## 15\.1 用途



取消录制任务并丢弃结果。



```JSON
{
  "method": "audio.cancelRecording",
  "params": {
    "recordingId": "rec_001",
    "reason": "user_request"
  }
}
```



返回：



```JSON
{
  "result": {
    "recordingId": "rec_001",
    "state": "cancelled"
  }
}
```



规则：



```Plain Text
recording / stopping 前可以取消。
completed 后不允许取消。
file 模式 cancel 后可以删除临时文件。
stream 模式 cancel 后应释放 streamId。
```



---



# 16\. 录制状态枚举



```Plain Text
idle
recording
stopping
completed
failed
cancelled
unsupported
```



说明：



```Plain Text
idle
  当前无录制任务。

recording
  正在录制。

stopping
  正在停止录制、写文件尾或关闭 stream。

completed
  录制完成。

failed
  录制失败。

cancelled
  已取消。

unsupported
  不支持。
```



---



# 17\. audio\.recordingStateChanged



## 17\.1 触发条件



```Plain Text
1. 录制开始；
2. 录制停止；
3. 录制完成；
4. 录制失败；
5. 录制取消；
6. stream 异常中止；
7. 文件写入失败。
```



---



## 17\.2 stream 模式开始事件



```JSON
{
  "event": "audio.recordingStateChanged",
  "params": {
    "recordingId": "rec_001",
    "state": "recording",
    "deliveryMode": "stream",
    "streamId": 201,
    "streamProfile": "recording_audio",
    "cursor": 0,
    "nextSeqId": 0,
    "timestampMs": 1710000000000
  }
}
```



## 17\.3 stream 模式完成事件



```JSON
{
  "event": "audio.recordingStateChanged",
  "params": {
    "recordingId": "rec_001",
    "state": "completed",
    "deliveryMode": "stream",
    "streamId": 201,
    "finalCursor": 5760000,
    "finalSeqId": 1499,
    "durationMs": 30000,
    "timestampMs": 1710000030000
  }
}
```



## 17\.4 file 模式完成事件



```JSON
{
  "event": "audio.recordingStateChanged",
  "params": {
    "recordingId": "rec_002",
    "state": "completed",
    "deliveryMode": "file",
    "fileId": "file_audio_rec_002",
    "finalCursor": 5760044,
    "durationMs": 30000,
    "timestampMs": 1710000030000
  }
}
```



## 17\.5 失败事件



```JSON
{
  "event": "audio.recordingStateChanged",
  "params": {
    "recordingId": "rec_001",
    "state": "failed",
    "deliveryMode": "stream",
    "streamId": 201,
    "errorCode": "stream_aborted",
    "message": "Stream was aborted by receiver",
    "timestampMs": 1710000012000
  }
}
```



---



# 18\. audio\.recordingProgressReported



进度是周期性上报，所以使用 `Reported`，不要使用 `Changed`。



```JSON
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
    "nextSeqId": 600,
    "timestampMs": 1710000012000
  }
}
```



file 模式：



```JSON
{
  "event": "audio.recordingProgressReported",
  "params": {
    "recordingId": "rec_002",
    "state": "recording",
    "deliveryMode": "file",
    "durationMs": 12000,
    "bytesWritten": 2304044,
    "cursor": 2304044,
    "timestampMs": 1710000012000
  }
}
```



---



# 19\. 与 stream\.abort 的关系



正常停止录制必须使用：



```Plain Text
audio.stopRecording
```



不要用：



```Plain Text
stream.abort
```



替代正常停止。



`stream.abort` 只用于异常情况：



```Plain Text
1. 接收端崩溃；
2. Client 不再接收；
3. transport 断开；
4. 低层流控检测到不可恢复错误；
5. 调试工具强制释放。
```



当 `stream.abort` 发生时，audio 域应收到通知，并将录制任务转为：



```Plain Text
failed
cancelled
```



取决于 abort 原因。



事件示例：



```JSON
{
  "event": "audio.recordingStateChanged",
  "params": {
    "recordingId": "rec_001",
    "state": "failed",
    "deliveryMode": "stream",
    "streamId": 201,
    "errorCode": "stream_aborted",
    "reason": "receiver_error"
  }
}
```



---



# 20\. 与 file 域关系



如果 `deliveryMode = file`，录制完成后返回：



```Plain Text
fileId
```



然后通过 file 域下载：



```JSON
{
  "method": "file.getInfo",
  "params": {
    "fileId": "file_audio_rec_002"
  }
}
```



返回：



```JSON
{
  "result": {
    "fileId": "file_audio_rec_002",
    "name": "audio_rec_002.wav",
    "mimeType": "audio/wav",
    "size": 5760044,
    "createdAtMs": 1710000030000
  }
}
```



下载：



```Plain Text
file.download
```



删除：



```Plain Text
file.delete
```



---



# 21\. 与 diagnostic 域关系



如果录制是产测流程的一部分，可以由 diagnostic 发起：



```Plain Text
diagnostic.startAudioCaptureTest
```



但底层通用能力仍应复用：



```Plain Text
audio.startRecording
audio.stopRecording
```



不要单独在 diagnostic 里重新定义一套音频录制数据面。



---



# 22\. 错误处理



推荐错误码：



```Plain Text
UnsupportedCapability
  不支持音频录制、指定 source、指定 format、指定 sampleRate 等。

InvalidParams
  参数类型错误、范围越界、source 非法。

Conflict
  当前已有互斥录制任务，或 source 被占用。

ServerBusy
  音频链路繁忙。

StorageFull
  file 模式下存储空间不足。

StreamError
  stream 数据面异常。

Unavailable
  音频设备不可用。

PermissionDenied
  当前权限不允许录制音频。

DurationExceeded
  超过最大录制时长。
```



错误示例：



```JSON
{
  "error": {
    "code": "InvalidParams",
    "message": "sampleRate is not supported",
    "data": {
      "field": "sampleRate",
      "value": 96000,
      "supported": [16000, 32000, 48000]
    }
  }
}
```



---



# 23\. Capability 注册建议



建议新增 capability：



```Plain Text
audio.recording
```



对应方法：



```Plain Text
audio.getRecordingCapabilities
audio.startRecording
audio.stopRecording
audio.cancelRecording
audio.getRecordingState
```



对应事件：



```Plain Text
audio.recordingStateChanged
audio.recordingProgressReported
```



如果 stream 流控能力单独注册：



```Plain Text
stream.flowControl
```



对应：



```Plain Text
stream.getState
stream.getStats
stream.ack
stream.windowUpdate
stream.pause
stream.resume
stream.abort
```



---



# 24\. Binary / TLV 映射建议



JSON 中使用可读字段：



```Plain Text
streamId
seqId
cursor
payloadType
payload
sampleRate
channels
bitDepth
```



Binary / TLV 中可以映射为：



```Plain Text
streamId: uint32
seqId: uint32 or uint64
cursor: uint64
timestampMs: uint64
payloadType: uint8
sampleRate: uint32
channels: uint8
bitDepth: uint8
chunkDurationMs: uint16
payloadLength: uint32
payload: bytes
```



推荐 `payloadType`：



```Plain Text
0x02 = audio_chunk
```



推荐 `sourceId`：



```Plain Text
0x01 = mic_raw
0x02 = mic_processed
0x03 = uplink_raw
0x04 = uplink_processed
0x05 = downlink_raw
0x06 = downlink_playback
0x07 = aec_reference
0x08 = algorithm_input
0x09 = algorithm_output
0x0A = speaker_output
```



数字 ID 只用于二进制映射，JSON 协议中继续使用字符串。



---



# 25\. 推荐 MVP



MVP 推荐实现：



```Plain Text
audio.getRecordingCapabilities
audio.startRecording
audio.stopRecording
audio.getRecordingState
audio.recordingStateChanged
audio.recordingProgressReported
```



MVP 支持：



```Plain Text
单 source
deliveryMode = stream
format = pcm
sampleRate = 48000
bitDepth = 16
channels = 1 / 2
chunkDurationMs = 20
streamProfile = recording_audio
```



可选增强：



```Plain Text
deliveryMode = file
multiSource
channelMask
realtime_audio profile
resume_from_cursor
missingRanges
```



---



# 26\. 最终接口清单



```Plain Text
audio.getRecordingCapabilities
audio.startRecording
audio.stopRecording
audio.cancelRecording
audio.getRecordingState

audio.recordingStateChanged
audio.recordingProgressReported
```



核心数据面字段：



```Plain Text
streamId
seqId
cursor
timestampMs
payloadType = audio_chunk
source
format
sampleRate
channels
bitDepth
chunkDurationMs
payload
```



核心结论：



```Plain Text
audio 负责录制业务生命周期；
stream 负责统一数据面；
普通业务调用方不需要显式调用 stream.*；
正常停止录制必须走 audio.stopRecording；
stream.abort 只用于异常释放。
```



