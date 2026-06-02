# AXTP Stream流控管理方案

# Stream 流控层协议设计文档



版本：v0\.1  

归属域：`stream`  

适用范围：视频流、音频流、文件传输、OTA、日志导出、传感器/状态上报等所有流式数据传输场景。



---



## 1\. 设计目标



`stream` 域用于抽象所有流式数据传输中的公共能力，包括：



```Plain Text
streamId
seqId
cursor
payloadType
payload
ack
windowUpdate
pause
resume
abort
stats
profile
```



它不负责具体业务语义。



具体业务仍然由各自业务域负责：



```Plain Text
video
  打开/关闭视频流，配置 codec、分辨率、帧率、码率等。

audio
  开始/停止音频录制，配置采样率、通道数、位深等。

file
  文件上传/下载，配置文件名、大小、hash 等。

firmware
  OTA 会话、manifest、批次、校验、安装、回滚等。

stream
  统一的数据面模型与可选流控能力。
```



核心原则：



```Plain Text
业务域负责“传什么”；
stream 域负责“怎么传”；
transport 负责“怎么搬运字节”。
```



---



## 2\. 非目标



`stream` 域不负责以下事项：



```Plain Text
1. 不负责打开具体业务流；
2. 不定义常规 stream.open；
3. 不承载 video/audio/file/firmware 的业务参数；
4. 不替代 video.openStream / audio.startRecording / file.beginUpload / firmware.beginOta；
5. 不作为业务正常关闭入口；
6. 不处理 codec、sampleRate、manifest、fileHash 等业务字段。
```



也就是说，不推荐：



```JSON
{
  "method": "stream.open",
  "params": {
    "profile": "realtime_video",
    "video": {
      "codec": "h264",
      "width": 1920,
      "height": 1080
    }
  }
}
```



而应由业务域创建流：



```JSON
{
  "method": "video.openStream",
  "params": {
    "source": "main_camera",
    "codec": "h264",
    "width": 1920,
    "height": 1080,
    "frameRate": 30,
    "streamProfile": "realtime_video"
  }
}
```



返回：



```JSON
{
  "result": {
    "streamId": 101,
    "streamProfile": "realtime_video",
    "cursor": 0,
    "nextSeqId": 0
  }
}
```



---



## 3\. 分层模型



```Plain Text
+--------------------------------------------------+
| Business Domain                                  |
| video / audio / file / firmware / log / sensor   |
|                                                  |
| 负责：业务参数、业务状态、业务生命周期              |
+---------------------------+----------------------+
                            |
                            | create internal stream
                            v
+--------------------------------------------------+
| Stream Domain                                    |
| streamId / seqId / cursor / profile / ack / flow |
|                                                  |
| 负责：统一数据面、流控、统计、异常中止              |
+---------------------------+----------------------+
                            |
                            | bytes/messages
                            v
+--------------------------------------------------+
| Transport                                        |
| WebSocket / TCP / USB / HID / BLE                |
|                                                  |
| 负责：实际传输载体                                |
+--------------------------------------------------+
```



---



## 4\. 业务域与 stream 域职责划分



|事项|归属域|说明|
|---|---|---|
|打开视频流|`video.openStream`|返回 `streamId`|
|关闭视频流|`video.closeStream`|正常关闭视频业务流|
|开始音频录制|`audio.startRecording`|`deliveryMode=stream` 时返回 `streamId`|
|停止音频录制|`audio.stopRecording`|负责写尾、生成文件或关闭流|
|文件上传|`file.beginUpload`|返回 `uploadId` 和 `streamId`|
|文件完成|`file.completeUpload`|校验 hash、落盘|
|OTA 会话|`firmware.beginOta`|管理 manifest、批次、校验、安装|
|流数据标识|`stream`|`streamId / seqId / cursor`|
|ACK / 窗口 / 暂停 / 恢复|`stream`|可选公开，高级流控或 SDK 内部使用|
|异常中止|`stream.abort`|兜底释放，不作为正常关闭入口|



---



## 5\. Stream 数据模型



所有流式数据包都必须遵守统一基础字段。



### 5\.1 通用数据包结构



```JSON
{
  "streamId": 101,
  "seqId": 0,
  "cursor": 0,
  "timestampUs": 1710000000000000,
  "payloadType": "video_chunk",
  "payload": "base64:AAAA..."
}
```



### 5\.2 通用字段说明



|字段|类型|必选|说明|
|---|---|---|---|
|`streamId`|`uint32`|是|流 ID，由业务域创建流时返回|
|`seqId`|`uint32/uint64`|是|当前 stream 内递增的数据包序号|
|`cursor`|`uint64`|是|当前 chunk 在该 stream 内的字节偏移|
|`timestampUs`|`uint64`|推荐|采集、编码或发送时间戳，单位微秒|
|`payloadType`|`string/enum`|是|数据类型，例如 `video_chunk`、`audio_chunk`、`file_chunk`|
|`payload`|`bytes/base64`|是|实际数据。JSON 示例中用 base64，二进制数据面直接使用 bytes|



---



## 6\. seqId / cursor 的区别



### 6\.1 seqId



`seqId` 表示包序号。



规则：



```Plain Text
1. 每个 streamId 内独立计数；
2. 从 0 开始；
3. 每发送一个 stream chunk 加 1；
4. 用于检测丢包、乱序、重复包；
5. 不表示字节位置；
6. 不表示帧号。
```



示例：



```Plain Text
seqId = 0
seqId = 1
seqId = 2
```



如果收到：



```Plain Text
seqId = 0
seqId = 2
```



说明：



```Plain Text
seqId = 1 的包可能丢失。
```



### 6\.2 cursor



`cursor` 表示字节偏移。



规则：



```Plain Text
1. 每个 streamId 内独立计数；
2. 第一个 chunk 的 cursor 为 0；
3. 下一包 cursor = 上一包 cursor + 上一包 payloadBytes；
4. 用于定位缺失数据范围；
5. 用于断点续传；
6. 不表示包序号；
7. 不表示帧号。
```



示例：



```Plain Text
seqId=0 cursor=0      payloadBytes=65536
seqId=1 cursor=65536  payloadBytes=65536
seqId=2 cursor=131072 payloadBytes=32768
```



如果缺失 `seqId=1`，则缺失范围大概率是：



```Plain Text
cursor 65536 ~ 131071
```



---



## 7\. payloadType



`payloadType` 用于区分 stream 中承载的数据类型。



推荐第一版定义：



```Plain Text
video_chunk
audio_chunk
file_chunk
firmware_chunk
log_chunk
telemetry_sample
```



说明：



|payloadType|说明|
|---|---|
|`video_chunk`|视频帧或视频编码数据分片|
|`audio_chunk`|音频 PCM / 编码音频分片|
|`file_chunk`|文件上传/下载分片|
|`firmware_chunk`|OTA 固件分片|
|`log_chunk`|日志导出分片|
|`telemetry_sample`|传感器或状态周期数据|



---



## 8\. Stream Profile



`streamProfile` 用于定义流控策略。



业务域创建流时可以显式传入，也可以使用默认值。



示例：



```JSON
{
  "method": "video.openStream",
  "params": {
    "source": "main_camera",
    "codec": "h264",
    "streamProfile": "realtime_video"
  }
}
```



返回：



```JSON
{
  "result": {
    "streamId": 101,
    "streamProfile": "realtime_video"
  }
}
```



---



## 9\. 内置 Stream Profile



### 9\.1 realtime\_video



适用于实时视频预览。



```JSON
{
  "profile": "realtime_video",
  "reliability": "best_effort",
  "ordered": true,
  "ackMode": "none",
  "lossRecovery": "request_key_frame",
  "backpressurePolicy": "drop_old_frames",
  "maxBufferBytes": 1048576,
  "highWatermarkBytes": 786432,
  "lowWatermarkBytes": 262144
}
```



特点：



```Plain Text
1. 低延迟优先；
2. 不默认重传历史视频包；
3. 丢包后通过 video.requestKeyFrame 重同步；
4. 背压时允许丢旧帧、降帧率或降码率；
5. 普通业务 App 不需要显式调用 stream.ack。
```



---



### 9\.2 realtime\_audio



适用于实时音频监听。



```JSON
{
  "profile": "realtime_audio",
  "reliability": "best_effort",
  "ordered": true,
  "ackMode": "periodic",
  "lossRecovery": "none",
  "backpressurePolicy": "drop_old_chunks",
  "maxBufferBytes": 262144,
  "highWatermarkBytes": 196608,
  "lowWatermarkBytes": 65536
}
```



特点：



```Plain Text
1. 低延迟优先；
2. 可接受少量丢包；
3. 不建议重传过旧音频数据；
4. 可通过 seqId / cursor 统计丢包。
```



---



### 9\.3 recording\_audio



适用于音频录制数据导出。



```JSON
{
  "profile": "recording_audio",
  "reliability": "reliable",
  "ordered": true,
  "ackMode": "window",
  "lossRecovery": "resume_from_cursor",
  "backpressurePolicy": "pause_producer",
  "maxBufferBytes": 1048576,
  "supportsResume": true,
  "supportsMissingRanges": true
}
```



特点：



```Plain Text
1. 完整性优先；
2. 支持 ACK；
3. 支持 cursor resume；
4. 允许较高延迟；
5. 不应丢弃数据。
```



---



### 9\.4 reliable\_file



适用于文件上传、文件下载、OTA、日志导出。



```JSON
{
  "profile": "reliable_file",
  "reliability": "reliable",
  "ordered": true,
  "ackMode": "window",
  "lossRecovery": "resume_from_cursor",
  "backpressurePolicy": "pause_producer",
  "maxBufferBytes": 4194304,
  "supportsResume": true,
  "supportsMissingRanges": true
}
```



特点：



```Plain Text
1. 完整性优先；
2. 必须支持 ACK；
3. 支持 cursor；
4. 支持 missingRanges；
5. 支持断点续传；
6. 不允许静默丢弃数据。
```



---



### 9\.5 telemetry



适用于传感器、beam 信息、状态周期上报。



```JSON
{
  "profile": "telemetry",
  "reliability": "best_effort",
  "ordered": false,
  "ackMode": "none",
  "lossRecovery": "none",
  "backpressurePolicy": "drop_old_samples",
  "maxBufferBytes": 65536
}
```



特点：



```Plain Text
1. 最新值优先；
2. 不强制有序；
3. 可丢弃旧 sample；
4. 不要求重传。
```



---



## 10\. Stream 公共方法



`stream` 域公共方法面向 SDK/runtime、高级调试工具或特殊低带宽传输优化场景。



普通业务 App 不要求直接调用这些方法。



### 10\.1 方法清单



```Plain Text
stream.getCapabilities
stream.getState
stream.getStats
stream.ack
stream.windowUpdate
stream.pause
stream.resume
stream.abort
```



不定义常规：



```Plain Text
stream.open
```



如果仓库中已有 `stream.close`，建议标记为 deprecated，或替换为：



```Plain Text
stream.abort
```



---



## 11\. stream\.getCapabilities



### 11\.1 用途



查询 stream 域支持的 profile、流控能力和数据面能力。



### 11\.2 请求



```JSON
{
  "method": "stream.getCapabilities",
  "params": {}
}
```



### 11\.3 返回



```JSON
{
  "result": {
    "profiles": [
      "realtime_video",
      "realtime_audio",
      "recording_audio",
      "reliable_file",
      "telemetry"
    ],
    "supportsSeqId": true,
    "supportsCursor": true,
    "supportsAck": true,
    "supportsWindowUpdate": true,
    "supportsPauseResume": true,
    "supportsMissingRanges": true,
    "supportsAbort": true,
    "maxConcurrentStreams": 8,
    "maxChunkSize": 262144,
    "preferredChunkSize": 65536
  }
}
```



---



## 12\. stream\.getState



### 12\.1 用途



查询指定 stream 的当前状态。



### 12\.2 请求



```JSON
{
  "method": "stream.getState",
  "params": {
    "streamId": 101
  }
}
```



### 12\.3 返回



```JSON
{
  "result": {
    "streamId": 101,
    "owner": "video",
    "profile": "realtime_video",
    "payloadType": "video_chunk",
    "state": "streaming",
    "cursor": 1048576,
    "nextSeqId": 16,
    "bytesSent": 1048576,
    "bytesAcked": 0,
    "bufferedBytes": 262144,
    "startedAtMs": 1710000000000
  }
}
```



### 12\.4 字段说明



|字段|说明|
|---|---|
|`owner`|创建该流的业务域，例如 `video`、`audio`、`file`、`firmware`|
|`profile`|当前 streamProfile|
|`payloadType`|当前流承载的数据类型|
|`state`|当前流状态|
|`cursor`|当前数据末尾偏移|
|`nextSeqId`|下一包将使用的 seqId|
|`bytesSent`|已发送字节数|
|`bytesAcked`|已确认字节数|
|`bufferedBytes`|当前缓冲区大小|



---



## 13\. stream\.getStats



### 13\.1 用途



查询 stream 统计信息。



### 13\.2 请求



```JSON
{
  "method": "stream.getStats",
  "params": {
    "streamId": 101
  }
}
```



### 13\.3 返回



```JSON
{
  "result": {
    "streamId": 101,
    "profile": "realtime_video",
    "state": "streaming",
    "bytesSent": 104857600,
    "packetsSent": 1600,
    "packetsLost": 2,
    "packetsRetransmitted": 0,
    "averageBitrateKbps": 4096,
    "bufferedBytes": 131072,
    "droppedPackets": 4,
    "droppedBytes": 262144
  }
}
```



---



## 14\. stream\.ack



### 14\.1 用途



确认接收进度。



主要用于：



```Plain Text
reliable_file
recording_audio
OTA
文件下载/上传
日志导出
```



实时视频通常不需要业务方显式 ACK。



### 14\.2 请求



```JSON
{
  "method": "stream.ack",
  "params": {
    "streamId": 301,
    "seqId": 15,
    "cursor": 1048576
  }
}
```



### 14\.3 带 missingRanges 的 ACK



```JSON
{
  "method": "stream.ack",
  "params": {
    "streamId": 301,
    "seqId": 15,
    "cursor": 524288,
    "missingRanges": [
      {
        "offset": 262144,
        "size": 65536
      }
    ]
  }
}
```



### 14\.4 返回



```JSON
{
  "result": {
    "streamId": 301,
    "ackedSeqId": 15,
    "ackedCursor": 1048576
  }
}
```



### 14\.5 语义



```Plain Text
seqId:
  表示接收端已经处理到哪个包序号。

cursor:
  表示接收端已经连续接收到哪个字节偏移。

missingRanges:
  表示接收端发现的缺失范围。
```



---



## 15\. stream\.windowUpdate



### 15\.1 用途



通知发送端当前接收窗口大小。



主要用于可靠传输、低带宽链路或接收端缓冲受限场景。



### 15\.2 请求



```JSON
{
  "method": "stream.windowUpdate",
  "params": {
    "streamId": 301,
    "availableWindowBytes": 1048576
  }
}
```



### 15\.3 返回



```JSON
{
  "result": {
    "streamId": 301,
    "availableWindowBytes": 1048576
  }
}
```



### 15\.4 语义



```Plain Text
availableWindowBytes:
  接收端当前还能接收的字节数。
```



发送端应根据该值控制发送速率。



---



## 16\. stream\.pause



### 16\.1 用途



暂停指定 stream 的数据发送或生产。



### 16\.2 请求



```JSON
{
  "method": "stream.pause",
  "params": {
    "streamId": 101,
    "reason": "receiver_buffer_full"
  }
}
```



### 16\.3 返回



```JSON
{
  "result": {
    "streamId": 101,
    "state": "paused"
  }
}
```



### 16\.4 规则



```Plain Text
1. 对 realtime_video，可以暂停发送，恢复时从新帧或新关键帧继续；
2. 对 reliable_file，不应丢弃数据，只应暂停 producer；
3. 对 telemetry，可以丢弃旧样本；
4. pause 不等于业务关闭。
```



---



## 17\. stream\.resume



### 17\.1 用途



恢复指定 stream 的数据发送或生产。



### 17\.2 请求：普通恢复



```JSON
{
  "method": "stream.resume",
  "params": {
    "streamId": 101
  }
}
```



### 17\.3 请求：从 cursor 恢复



```JSON
{
  "method": "stream.resume",
  "params": {
    "streamId": 301,
    "fromCursor": 1048576
  }
}
```



### 17\.4 请求：带 missingRanges 恢复



```JSON
{
  "method": "stream.resume",
  "params": {
    "streamId": 301,
    "missingRanges": [
      {
        "offset": 1048576,
        "size": 65536
      }
    ]
  }
}
```



### 17\.5 返回



```JSON
{
  "result": {
    "streamId": 301,
    "state": "streaming",
    "cursor": 1048576,
    "nextSeqId": 16
  }
}
```



### 17\.6 规则



```Plain Text
realtime_video:
  不要求从历史 cursor 补齐，通常从下一关键帧继续。

realtime_audio:
  不建议补太旧的音频数据。

recording_audio / reliable_file:
  应按 fromCursor 或 missingRanges 补齐数据。

telemetry:
  通常从最新 sample 继续。
```



---



## 18\. stream\.abort



### 18\.1 用途



异常中止指定 stream。



`stream.abort` 是兜底接口，不是业务正常关闭入口。



### 18\.2 请求



```JSON
{
  "method": "stream.abort",
  "params": {
    "streamId": 101,
    "reason": "receiver_error"
  }
}
```



### 18\.3 返回



```JSON
{
  "result": {
    "streamId": 101,
    "state": "aborted"
  }
}
```



### 18\.4 规则



```Plain Text
1. stream.abort 用于异常释放、调试、底层错误恢复；
2. 正常视频关闭必须使用 video.closeStream；
3. 正常音频录制停止必须使用 audio.stopRecording；
4. 正常文件上传完成必须使用 file.completeUpload；
5. 正常 OTA 取消必须使用 firmware.cancelOta；
6. stream.abort 触发后，owner 业务域应收到通知并清理业务资源。
```



---



## 19\. Stream 状态枚举



```Plain Text
idle
opening
streaming
pausing
paused
resuming
closing
closed
aborting
aborted
failed
unsupported
```



说明：



|状态|说明|
|---|---|
|`idle`|空闲|
|`opening`|正在创建|
|`streaming`|正在传输|
|`pausing`|正在暂停|
|`paused`|已暂停|
|`resuming`|正在恢复|
|`closing`|正常关闭中|
|`closed`|已正常关闭|
|`aborting`|异常中止中|
|`aborted`|已异常中止|
|`failed`|失败|
|`unsupported`|不支持|



---



## 20\. Stream 事件



### 20\.1 stream\.stateChanged



当 stream 状态变化时上报。



```JSON
{
  "event": "stream.stateChanged",
  "params": {
    "streamId": 101,
    "owner": "video",
    "profile": "realtime_video",
    "state": "streaming",
    "reason": "stream_started",
    "timestampMs": 1710000000000
  }
}
```



异常中止：



```JSON
{
  "event": "stream.stateChanged",
  "params": {
    "streamId": 101,
    "owner": "video",
    "profile": "realtime_video",
    "state": "aborted",
    "reason": "receiver_error",
    "timestampMs": 1710000000000
  }
}
```



---



### 20\.2 stream\.statsReported



周期性上报 stream 统计信息。



因为是周期性上报，所以使用 `Reported`，不要使用 `Changed`。



```JSON
{
  "event": "stream.statsReported",
  "params": {
    "streamId": 101,
    "owner": "video",
    "profile": "realtime_video",
    "state": "streaming",
    "bytesSent": 104857600,
    "packetsSent": 1600,
    "packetsLost": 2,
    "averageBitrateKbps": 4096,
    "bufferedBytes": 131072,
    "timestampMs": 1710000030000
  }
}
```



---



### 20\.3 stream\.flowControlChanged



当流控状态发生明显变化时上报，例如进入背压、退出背压、窗口变化。



```JSON
{
  "event": "stream.flowControlChanged",
  "params": {
    "streamId": 301,
    "profile": "reliable_file",
    "state": "backpressure",
    "availableWindowBytes": 0,
    "bufferedBytes": 4194304,
    "reason": "receiver_buffer_full",
    "timestampMs": 1710000000000
  }
}
```



退出背压：



```JSON
{
  "event": "stream.flowControlChanged",
  "params": {
    "streamId": 301,
    "profile": "reliable_file",
    "state": "normal",
    "availableWindowBytes": 1048576,
    "bufferedBytes": 1048576,
    "reason": "window_updated",
    "timestampMs": 1710000001000
  }
}
```



---



## 21\. 数据包扩展示例



### 21\.1 Video Chunk



```JSON
{
  "streamId": 101,
  "seqId": 0,
  "cursor": 0,
  "frameId": 0,
  "timestampUs": 1710000000000000,
  "payloadType": "video_chunk",
  "codec": "h264",
  "keyFrame": true,
  "frameStart": true,
  "frameEnd": false,
  "payload": "base64:AAAA..."
}
```



视频专属字段：



|字段|说明|
|---|---|
|`frameId`|视频帧编号|
|`codec`|`h264` / `h265` / `mjpeg` / `raw`|
|`keyFrame`|是否关键帧|
|`frameStart`|是否一帧开始|
|`frameEnd`|是否一帧结束|



---



### 21\.2 Audio Chunk



```JSON
{
  "streamId": 201,
  "seqId": 15,
  "cursor": 57600,
  "timestampMs": 1710000000300,
  "payloadType": "audio_chunk",
  "sampleRate": 48000,
  "channels": 2,
  "bitDepth": 16,
  "chunkDurationMs": 20,
  "payload": "base64:AAAA..."
}
```



音频专属字段：



|字段|说明|
|---|---|
|`sampleRate`|采样率|
|`channels`|通道数|
|`bitDepth`|位深|
|`chunkDurationMs`|每个音频 chunk 时长|



---



### 21\.3 File Chunk



```JSON
{
  "streamId": 301,
  "seqId": 8,
  "cursor": 524288,
  "timestampMs": 1710000000000,
  "payloadType": "file_chunk",
  "fileId": "file_001",
  "chunkOffset": 524288,
  "chunkSize": 65536,
  "crc32": "0x12345678",
  "payload": "base64:AAAA..."
}
```



文件专属字段：



|字段|说明|
|---|---|
|`fileId`|文件 ID|
|`chunkOffset`|当前 chunk 在文件内偏移|
|`chunkSize`|当前 chunk 大小|
|`crc32`|当前 chunk 校验值|



---



### 21\.4 Firmware Chunk



```JSON
{
  "streamId": 401,
  "seqId": 16,
  "cursor": 1048576,
  "timestampMs": 1710000000000,
  "payloadType": "firmware_chunk",
  "otaSessionId": "ota_001",
  "fileId": "app",
  "batchId": "batch_001",
  "chunkOffset": 1048576,
  "chunkSize": 65536,
  "crc32": "0x12345678",
  "payload": "base64:AAAA..."
}
```



OTA 专属字段：



|字段|说明|
|---|---|
|`otaSessionId`|OTA 会话 ID|
|`fileId`|OTA 包内文件 ID|
|`batchId`|OTA 批次 ID|
|`chunkOffset`|当前文件内偏移|
|`chunkSize`|当前分片大小|
|`crc32`|当前分片校验值|



---



## 22\. 调用流程示例



### 22\.1 实时视频



```Plain Text
sequenceDiagram
    participant C as Client
    participant V as video 域
    participant S as stream runtime
    participant T as transport

    C->>V: video.openStream(codec/resolution/frameRate/streamProfile)
    V->>S: create internal stream(profile=realtime_video)
    S-->>V: streamId=101, cursor=0, nextSeqId=0
    V-->>C: result(streamId=101)

    V->>V: start camera/encoder
    V->>S: push video frame/chunk
    S->>T: stream data(streamId, seqId, cursor, frameId, payload)
    T-->>C: video_chunk

    C->>V: video.closeStream(streamId=101)
    V->>S: close internal stream
    V-->>C: result(finalCursor, finalSeqId)
```



---



### 22\.2 可靠文件上传



```Plain Text
sequenceDiagram
    participant C as Client
    participant F as file 域
    participant S as stream runtime

    C->>F: file.beginUpload(size/hash/streamProfile=reliable_file)
    F->>S: create internal stream(profile=reliable_file)
    S-->>F: streamId=301
    F-->>C: uploadId, streamId

    loop chunks
        C->>S: file_chunk(streamId, seqId, cursor, payload)
        S-->>C: stream.ack(streamId, cursor)
    end

    C->>F: file.completeUpload(uploadId)
    F-->>C: fileId, hashVerified=true
```



---



## 23\. 错误处理



建议错误码：



```Plain Text
InvalidParams
  参数非法，例如 streamId 格式错误、cursor 越界。

StreamNotFound
  streamId 不存在。

UnsupportedCapability
  不支持对应 streamProfile 或流控能力。

UnsupportedProfile
  不支持指定 streamProfile。

InvalidState
  当前状态不允许该操作，例如 closed 后 resume。

Conflict
  操作冲突，例如业务域正在关闭，stream.abort 同时到达。

FlowControlViolation
  发送方超过窗口限制。

BufferOverflow
  接收或发送缓冲区溢出。

PermissionDenied
  当前权限不允许访问该 stream。

ServerBusy
  stream runtime 繁忙。
```



错误示例：



```JSON
{
  "error": {
    "code": "StreamNotFound",
    "message": "streamId not found",
    "data": {
      "streamId": 999
    }
  }
}
```



窗口违规：



```JSON
{
  "error": {
    "code": "FlowControlViolation",
    "message": "sender exceeded available window",
    "data": {
      "streamId": 301,
      "availableWindowBytes": 0
    }
  }
}
```



---



## 24\. Capability 注册建议



建议新增 capability：



```Plain Text
stream.flowControl
```



对应方法：



```Plain Text
stream.getCapabilities
stream.getState
stream.getStats
stream.ack
stream.windowUpdate
stream.pause
stream.resume
stream.abort
```



对应事件：



```Plain Text
stream.stateChanged
stream.statsReported
stream.flowControlChanged
```



能力返回示例：



```JSON
{
  "id": "stream.flowControl",
  "methods": [
    "stream.getCapabilities",
    "stream.getState",
    "stream.getStats",
    "stream.ack",
    "stream.windowUpdate",
    "stream.pause",
    "stream.resume",
    "stream.abort"
  ],
  "events": [
    "stream.stateChanged",
    "stream.statsReported",
    "stream.flowControlChanged"
  ]
}
```



---



## 25\. Binary / TLV 映射建议



JSON\-RPC 层使用可读字段：



```Plain Text
streamId
seqId
cursor
payloadType
payload
```



Binary / TLV 层可以映射为数字 ID：



```Plain Text
streamId: uint32
seqId: uint32 or uint64
cursor: uint64
payloadType: uint8
timestampUs: uint64
payloadLength: uint32
payload: bytes
```



推荐 `payloadType` 编码：



```Plain Text
0x01 = video_chunk
0x02 = audio_chunk
0x03 = file_chunk
0x04 = firmware_chunk
0x05 = log_chunk
0x06 = telemetry_sample
```



推荐 `streamProfile` 编码：



```Plain Text
0x01 = realtime_video
0x02 = realtime_audio
0x03 = recording_audio
0x04 = reliable_file
0x05 = telemetry
```



注意：



```Plain Text
数字 ID 仅用于二进制映射；
JSON 协议中继续使用可读字符串。
```



---



## 26\. 安全与资源限制



```Plain Text
1. stream 可能承载高带宽数据，必须受权限控制；
2. 高码率视频流不应默认允许在低带宽 transport 上启用；
3. raw video 必须受 capability 限制；
4. reliable_file / OTA 必须防止无限缓存；
5. maxConcurrentStreams 必须由 capability 声明；
6. stream.abort 必须通知 owner 业务域清理资源；
7. stream stats 不应泄露敏感 payload 内容；
8. Wi-Fi 密码、license、token 等敏感数据不应通过普通 telemetry stream 明文传输。
```



---



## 27\. 推荐 MVP



MVP 必须实现：



```Plain Text
streamId
seqId
cursor
payloadType
payload

streamProfile:
  realtime_video
  realtime_audio
  reliable_file

stream.getCapabilities
stream.getState
stream.abort
```



MVP 可选：



```Plain Text
stream.getStats
stream.ack
stream.windowUpdate
stream.pause
stream.resume
stream.stateChanged
stream.statsReported
stream.flowControlChanged
```



对于可靠文件/OTA，如果已有 SDK/runtime 自动 ACK，也可以先不把 `stream.ack` 暴露给普通业务调用方，但内部语义必须清楚。



---



## 28\. 最终接口清单



```Plain Text
stream.getCapabilities
stream.getState
stream.getStats
stream.ack
stream.windowUpdate
stream.pause
stream.resume
stream.abort

stream.stateChanged
stream.statsReported
stream.flowControlChanged
```



不定义：



```Plain Text
stream.open
```



不推荐常规使用：



```Plain Text
stream.close
```



如已有历史接口 `stream.close`，建议：



```Plain Text
1. 标记 deprecated；
2. 或迁移为 stream.abort；
3. 业务正常关闭统一走业务域自己的 close/stop/complete/cancel 方法。
```



---



## 29\. 核心结论



```Plain Text
stream 域是公共流控层，不是业务流入口。

业务域负责创建和关闭业务流：
  video.openStream / video.closeStream
  audio.startRecording / audio.stopRecording
  file.beginUpload / file.completeUpload
  firmware.beginOta / firmware.cancelOta

stream 域负责统一数据面和可选流控：
  streamId / seqId / cursor / payloadType / payload
  ack / windowUpdate / pause / resume / abort / stats

普通业务 App 可以不直接调用 stream.* 方法。
SDK/runtime 可以根据 streamProfile 自动完成流控。
```



