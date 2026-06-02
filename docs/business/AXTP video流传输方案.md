# AXTP video流传输方案

请阅读当前 AXTP / 协议仓库，重点关注以下内容：



1. 协议域划分文档；

2. video 域已有协议文档；

3. stream 域已有协议文档；

4. capability 能力查询与协商文档；

5. RPC 方法注册表；

6. 事件注册表；

7. ErrorCode / Result / State 命名规范；

8. JSON\-RPC / Binary\-RPC / STREAM 数据面示例；

9. 之前已有的 audio recording / OTA / file upload 中关于 streamId / seqId / cursor 的设计。

    

目标：新增或重写一篇 **Video Stream 视频流传输协议文档**，并同步修正 stream 域的职责边界。



本次设计必须遵循以下最终原则：



```Plain Text
1. video 域负责视频业务流的创建、关闭、配置与状态。
2. stream 域不负责打开具体业务流，不定义常规 stream.open。
3. video.openStream 创建视频流并返回 streamId。
4. video.closeStream 正常关闭视频流。
5. stream 域只提供统一数据模型和可选公共流控能力。
6. stream.close 不作为主路径；如需保留底层异常释放能力，使用 stream.abort。
7. 普通业务调用方不需要显式调用 stream.ack / stream.windowUpdate / stream.pause / stream.resume。
8. SDK/runtime 可以根据 streamProfile 自动执行流控。
```



---



# 一、需要新增或修改的文档



请新增或更新以下文档：



```Plain Text
docs/protocol/video/VideoStream.md
docs/protocol/stream/StreamFlowControl.md
```



如果仓库已有对应目录或命名规范，请按现有结构放置。



同时需要同步更新：



```Plain Text
RPC 方法注册表
事件注册表
Capability 能力注册表
PayloadType / Stream Profile 相关定义表
JSON-RPC 示例
Binary-RPC / TLV 映射建议
```



---



# 二、Video Stream 总体设计



必须在文档开头明确：



```Plain Text
video = 视频业务控制面
stream = 统一流数据模型和可选流控面
transport = WebSocket / TCP / USB / HID / BLE 等实际传输层
```



职责划分：



```Plain Text
video.openStream:
  打开一路视频业务流。
  负责 source、codec、resolution、frameRate、bitrate、gop、pixelFormat 等视频业务参数。
  成功后返回 streamId。

video.closeStream:
  正常关闭视频业务流。
  负责停止 encoder / camera pipeline，释放视频资源，并关闭对应 streamId。

stream data model:
  负责所有流式数据的统一字段：
  streamId、seqId、cursor、payloadType、payload、timestamp。

stream flow control:
  负责可选公共流控：
  ack、windowUpdate、pause、resume、getState、getStats、abort。

stream.abort:
  用于异常释放或调试兜底。
  不作为业务流正常关闭入口。
```



必须强调：



```Plain Text
不要定义常规 stream.open。
不要让上位机通过 stream.open 打开视频流。
不要让 stream.open 承担 video/audio/file/firmware 的业务参数。
```



---



# 三、Video Stream 方法清单



Video 域需要定义或更新以下方法：



```Plain Text
video.getStreamCapabilities
video.openStream
video.closeStream
video.getStreamState
video.requestKeyFrame
video.setStreamConfig
video.getStreamConfig
```



Video 域事件：



```Plain Text
video.streamStateChanged
video.streamStatsReported
```



其中 MVP 至少包含：



```Plain Text
video.getStreamCapabilities
video.openStream
video.closeStream
video.getStreamState
video.requestKeyFrame
video.streamStateChanged
video.streamStatsReported
```



---



# 四、Stream 域方法清单



Stream 域不要定义常规：



```Plain Text
stream.open
```



Stream 域建议保留以下公共方法：



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



Stream 域事件：



```Plain Text
stream.stateChanged
stream.statsReported
stream.flowControlChanged
```



注意：



```Plain Text
stream.abort 是异常/强制释放接口。
业务正常关闭必须走 video.closeStream / audio.stopRecording / file.completeUpload / firmware.cancelOta。
```



如果仓库已有 `stream.close`，请标记为 deprecated，或者替换为：



```Plain Text
stream.abort
```



并在文档中说明：



```Plain Text
stream.close 不作为业务流常规关闭入口；
业务流应由创建它的业务域负责关闭。
```



---



# 五、video\.getStreamCapabilities



## 用途



查询设备支持的视频流能力，包括 source、codec、resolution、frameRate、bitrate、streamProfile、chunkSize、并发数量等。



## 请求



```JSON
{
  "method": "video.getStreamCapabilities",
  "params": {}
}
```



## 返回示例



```JSON
{
  "result": {
    "supported": true,
    "sources": [
      "main_camera",
      "secondary_camera",
      "hdmi",
      "mixed"
    ],
    "streams": [
      "main",
      "sub"
    ],
    "codecs": [
      "h264",
      "h265",
      "mjpeg",
      "raw"
    ],
    "pixelFormats": [
      "nv12",
      "yuy2",
      "rgb24"
    ],
    "resolutions": [
      {
        "width": 1920,
        "height": 1080
      },
      {
        "width": 1280,
        "height": 720
      }
    ],
    "frameRates": [15, 25, 30, 50, 60],
    "bitrateRangeKbps": {
      "min": 256,
      "max": 20000,
      "step": 128
    },
    "streamProfiles": [
      "realtime_video"
    ],
    "defaultStreamProfile": "realtime_video",
    "maxConcurrentStreams": 2,
    "supportsKeyFrameRequest": true,
    "supportsStats": true,
    "supportsCursor": true,
    "supportsSeqId": true,
    "supportsFrameId": true,
    "preferredChunkSize": 65536,
    "maxChunkSize": 262144
  }
}
```



说明：



```Plain Text
streamProfiles:
  video stream 支持的 streamProfile。
  实时视频默认使用 realtime_video。

defaultStreamProfile:
  如果 openStream 不传 streamProfile，设备默认采用该 profile。

preferredChunkSize:
  推荐 stream 数据 chunk 大小。

maxChunkSize:
  最大 stream 数据 chunk 大小。
```



---



# 六、video\.openStream



## 用途



打开一路 AXTP 视频流。



`video.openStream` 是视频业务流的唯一常规打开入口。



不要通过 `stream.open` 打开视频流。



## 请求：H\.264 实时视频



```JSON
{
  "method": "video.openStream",
  "params": {
    "source": "main_camera",
    "stream": "main",
    "codec": "h264",
    "width": 1920,
    "height": 1080,
    "frameRate": 30,
    "bitrateKbps": 4096,
    "gop": 30,
    "chunkSize": 65536,
    "streamProfile": "realtime_video"
  }
}
```



## 返回



```JSON
{
  "result": {
    "streamId": 101,
    "streamProfile": "realtime_video",
    "state": "opening",
    "source": "main_camera",
    "stream": "main",
    "codec": "h264",
    "width": 1920,
    "height": 1080,
    "frameRate": 30,
    "bitrateKbps": 4096,
    "gop": 30,
    "chunkSize": 65536,
    "cursor": 0,
    "nextSeqId": 0,
    "nextFrameId": 0
  }
}
```



## 请求：MJPEG



```JSON
{
  "method": "video.openStream",
  "params": {
    "source": "main_camera",
    "stream": "sub",
    "codec": "mjpeg",
    "width": 1280,
    "height": 720,
    "frameRate": 15,
    "quality": 80,
    "chunkSize": 65536,
    "streamProfile": "realtime_video"
  }
}
```



## 请求：Raw Video



```JSON
{
  "method": "video.openStream",
  "params": {
    "source": "main_camera",
    "codec": "raw",
    "pixelFormat": "nv12",
    "width": 640,
    "height": 360,
    "frameRate": 15,
    "chunkSize": 65536,
    "streamProfile": "realtime_video"
  }
}
```



## 规则



必须写明：



```Plain Text
1. video.openStream 成功后必须返回 streamId。
2. streamId 是后续视频数据面的唯一流标识。
3. cursor 初始值为 0。
4. nextSeqId 初始值通常为 0。
5. nextFrameId 初始值通常为 0。
6. 如果请求不传 streamProfile，默认使用 defaultStreamProfile。
7. streamProfile 用于选择 stream runtime 的流控策略。
8. 不要在 openStream 的普通 RPC response 中返回视频数据。
9. 不要要求调用方先调用 stream.open。
```



---



# 七、video\.closeStream



## 用途



正常关闭视频业务流。



`video.closeStream` 必须负责完整业务收尾：



```Plain Text
1. 停止编码器；
2. 停止或释放视频 pipeline 引用；
3. 停止向 streamId 发送数据；
4. 关闭底层 stream runtime；
5. 返回 finalCursor / finalSeqId / finalFrameId；
6. 触发 video.streamStateChanged。
```



## 请求



```JSON
{
  "method": "video.closeStream",
  "params": {
    "streamId": 101
  }
}
```



## 返回



```JSON
{
  "result": {
    "streamId": 101,
    "state": "closed",
    "finalCursor": 104857600,
    "finalSeqId": 1599,
    "finalFrameId": 899
  }
}
```



## 规则



```Plain Text
1. 正常关闭视频流必须调用 video.closeStream。
2. 不建议使用 stream.abort 替代 video.closeStream。
3. stream.abort 只用于异常释放、调试、底层错误恢复。
```



---



# 八、video\.getStreamState



## 请求



```JSON
{
  "method": "video.getStreamState",
  "params": {
    "streamId": 101
  }
}
```



## 返回



```JSON
{
  "result": {
    "streamId": 101,
    "streamProfile": "realtime_video",
    "state": "streaming",
    "source": "main_camera",
    "stream": "main",
    "codec": "h264",
    "width": 1920,
    "height": 1080,
    "frameRate": 30,
    "bitrateKbps": 4096,
    "cursor": 1048576,
    "nextSeqId": 16,
    "nextFrameId": 8,
    "framesSent": 8,
    "bytesSent": 1048576,
    "startedAtMs": 1710000000000
  }
}
```



状态枚举：



```Plain Text
opening
streaming
pausing
paused
closing
closed
failed
unsupported
```



---



# 九、video\.requestKeyFrame



## 用途



实时视频丢包后，推荐通过请求关键帧进行重同步。



## 请求



```JSON
{
  "method": "video.requestKeyFrame",
  "params": {
    "streamId": 101,
    "reason": "resync"
  }
}
```



## 返回



```JSON
{
  "result": {
    "streamId": 101,
    "accepted": true,
    "state": "keyframe_requested"
  }
}
```



必须说明：



```Plain Text
realtime_video profile 默认不要求重传历史视频 chunk。
如果 Client 检测到 seqId 跳跃或解码失败，优先调用 video.requestKeyFrame。
```



---



# 十、video\.setStreamConfig / video\.getStreamConfig



## 用途



用于查询或调整已打开视频流配置。



是否支持运行时修改由 capability 声明。



## 设置示例



```JSON
{
  "method": "video.setStreamConfig",
  "params": {
    "streamId": 101,
    "bitrateKbps": 2048,
    "frameRate": 30
  }
}
```



返回：



```JSON
{
  "result": {
    "streamId": 101,
    "bitrateKbps": 2048,
    "frameRate": 30,
    "state": "applied"
  }
}
```



如果需要重启：



```JSON
{
  "result": {
    "streamId": 101,
    "bitrateKbps": 2048,
    "state": "pending_restart",
    "requiresRestart": true
  }
}
```



---



# 十一、Stream 数据面：视频数据包结构



必须在 StreamFlowControl 或 VideoStream 文档中补充视频数据包结构。



## H\.264 chunk 示例



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



同一帧第二个 chunk：



```JSON
{
  "streamId": 101,
  "seqId": 1,
  "cursor": 65536,
  "frameId": 0,
  "timestampUs": 1710000000000000,
  "payloadType": "video_chunk",
  "codec": "h264",
  "keyFrame": true,
  "frameStart": false,
  "frameEnd": true,
  "payload": "base64:BBBB..."
}
```



下一帧：



```JSON
{
  "streamId": 101,
  "seqId": 2,
  "cursor": 98304,
  "frameId": 1,
  "timestampUs": 1710000000033333,
  "payloadType": "video_chunk",
  "codec": "h264",
  "keyFrame": false,
  "frameStart": true,
  "frameEnd": true,
  "payload": "base64:CCCC..."
}
```



## 字段说明



```Plain Text
streamId:
  当前视频流 ID。

seqId:
  当前 stream 内递增的数据包序号。

cursor:
  当前 chunk 在该 stream 中的字节偏移。

frameId:
  视频帧编号。
  同一帧多个 chunk 使用同一个 frameId。

timestampUs:
  当前帧采集或编码时间戳，单位 microsecond。

payloadType:
  video_chunk。

codec:
  h264 / h265 / mjpeg / raw。

keyFrame:
  是否关键帧。

frameStart:
  当前 chunk 是否是一帧的开始。

frameEnd:
  当前 chunk 是否是一帧的结束。

payload:
  视频数据。JSON 示例用 base64，二进制 stream 数据面直接承载 bytes。
```



---



# 十二、seqId / cursor / frameId 规则



文档必须明确三者区别：



```Plain Text
seqId:
  包序号。
  每发送一个 stream chunk 加 1。
  用于检测丢包、乱序、重复包。

cursor:
  字节偏移。
  每发送一个 payload 后按 payloadBytes 增长。
  用于定位缺失数据范围。

frameId:
  视频帧编号。
  同一帧多个 chunk 共享一个 frameId。
  新帧递增。
```



不要混用：



```Plain Text
不要用 frameId 检测 chunk 丢包。
不要用 seqId 表示字节偏移。
不要用 cursor 表示帧序号。
```



---



# 十三、编码格式规则



## H\.264 / H\.265



必须说明：



```Plain Text
1. payload 承载编码后的 NAL / access unit 数据。
2. 推荐一帧对应一个 access unit。
3. 一帧过大时可拆成多个 chunk。
4. keyFrame=true 表示 IDR / intra frame。
5. SPS/PPS/VPS 需要在关键帧前或关键帧中提供。
```



openStream 返回可包含：



```JSON
{
  "codecConfig": {
    "format": "annexb",
    "parameterSetsInKeyFrame": true
  }
}
```



## MJPEG



```Plain Text
1. 每帧是一个 JPEG 图片。
2. 每帧通常 keyFrame=true。
3. 一个 JPEG 帧可以拆成多个 chunk。
```



## Raw Video



```Plain Text
1. raw video 必须声明 pixelFormat。
2. 必须声明 width / height / stride。
3. 每帧可以拆成多个 chunk。
4. raw 数据量大，设备可以限制分辨率和帧率。
```



---



# 十四、realtime\_video profile



StreamFlowControl 文档中需要定义 `realtime_video` profile。



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



说明：



```Plain Text
realtime_video:
  低延迟优先。
  默认不要求 ACK。
  默认不重传历史 chunk。
  丢包后通过 video.requestKeyFrame 重同步。
  背压时允许丢旧帧或降低帧率/码率。
```



---



# 十五、Stream 公共流控接口



## 15\.1 stream\.getCapabilities



```JSON
{
  "method": "stream.getCapabilities",
  "params": {}
}
```



返回：



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
    "supportsAck": true,
    "supportsWindowUpdate": true,
    "supportsPauseResume": true,
    "supportsCursor": true,
    "supportsMissingRanges": true,
    "supportsAbort": true
  }
}
```



## 15\.2 stream\.getState



```JSON
{
  "method": "stream.getState",
  "params": {
    "streamId": 101
  }
}
```



返回：



```JSON
{
  "result": {
    "streamId": 101,
    "profile": "realtime_video",
    "owner": "video",
    "state": "streaming",
    "cursor": 1048576,
    "nextSeqId": 16,
    "bytesSent": 1048576,
    "bufferedBytes": 262144
  }
}
```



## 15\.3 stream\.getStats



```JSON
{
  "method": "stream.getStats",
  "params": {
    "streamId": 101
  }
}
```



返回：



```JSON
{
  "result": {
    "streamId": 101,
    "profile": "realtime_video",
    "bytesSent": 104857600,
    "packetsSent": 1600,
    "packetsLost": 2,
    "bufferedBytes": 131072,
    "averageBitrateKbps": 4096
  }
}
```



## 15\.4 stream\.ack



用于可靠流或 SDK/runtime 自动 ACK。



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



对 realtime\_video：



```Plain Text
stream.ack 通常不需要由业务 App 调用。
```



## 15\.5 stream\.windowUpdate



```JSON
{
  "method": "stream.windowUpdate",
  "params": {
    "streamId": 301,
    "availableWindowBytes": 1048576
  }
}
```



## 15\.6 stream\.pause / stream\.resume



```JSON
{
  "method": "stream.pause",
  "params": {
    "streamId": 101,
    "reason": "receiver_buffer_full"
  }
}
```



```JSON
{
  "method": "stream.resume",
  "params": {
    "streamId": 101
  }
}
```



对于 realtime\_video：



```Plain Text
resume 后可以从新关键帧继续，不要求补历史数据。
```



## 15\.7 stream\.abort



```JSON
{
  "method": "stream.abort",
  "params": {
    "streamId": 101,
    "reason": "receiver_error"
  }
}
```



返回：



```JSON
{
  "result": {
    "streamId": 101,
    "state": "aborted"
  }
}
```



必须写明：



```Plain Text
stream.abort 是异常释放接口。
正常关闭视频流应使用 video.closeStream。
```



---



# 十六、调用流程图



请在文档中加入以下流程描述或 Mermaid 图。



## 16\.1 正常视频流流程



```Plain Text
sequenceDiagram
    participant C as Client
    participant V as video 域
    participant S as stream runtime
    participant T as transport

    C->>V: video.openStream(codec/resolution/frameRate/streamProfile)
    V->>S: create internal stream(profile=realtime_video)
    S-->>V: streamId=101, cursor=0, nextSeqId=0
    V-->>C: result(streamId=101, state=opening)

    V->>V: start camera/encoder
    V->>S: bind video producer to streamId=101
    S-->>C: video.streamStateChanged(streaming)

    loop video data
        V->>S: push video frame/chunk
        S->>T: stream data(streamId, seqId, cursor, frameId, keyFrame, payload)
        T-->>C: video_chunk
    end

    C->>V: video.closeStream(streamId=101)
    V->>V: stop encoder/pipeline
    V->>S: close internal stream
    V-->>C: result(finalCursor, finalSeqId, finalFrameId)
```



## 16\.2 丢包重同步流程



```Plain Text
sequenceDiagram
    participant C as Client
    participant V as video 域
    participant S as stream runtime

    C->>C: detect seqId gap
    C->>V: video.requestKeyFrame(streamId=101, reason=resync)
    V->>V: request encoder IDR
    V->>S: push key frame
    S-->>C: video_chunk(keyFrame=true)
```



## 16\.3 异常释放流程



```Plain Text
sequenceDiagram
    participant C as Client
    participant S as stream 域
    participant V as video 域

    C->>S: stream.abort(streamId=101, reason=receiver_error)
    S->>V: notify owner video stream aborted
    V->>V: stop encoder/pipeline
    V-->>C: video.streamStateChanged(state=failed/closed)
```



---



# 十七、事件设计



## video\.streamStateChanged



```JSON
{
  "event": "video.streamStateChanged",
  "params": {
    "streamId": 101,
    "state": "streaming",
    "source": "main_camera",
    "codec": "h264",
    "width": 1920,
    "height": 1080,
    "frameRate": 30,
    "timestampMs": 1710000000000
  }
}
```



关闭：



```JSON
{
  "event": "video.streamStateChanged",
  "params": {
    "streamId": 101,
    "state": "closed",
    "finalCursor": 104857600,
    "finalSeqId": 1599,
    "finalFrameId": 899,
    "timestampMs": 1710000000000
  }
}
```



失败：



```JSON
{
  "event": "video.streamStateChanged",
  "params": {
    "streamId": 101,
    "state": "failed",
    "errorCode": "encoder_error",
    "message": "Video encoder failed",
    "timestampMs": 1710000000000
  }
}
```



## video\.streamStatsReported



统计是周期性上报，所以使用 `Reported`。



```JSON
{
  "event": "video.streamStatsReported",
  "params": {
    "streamId": 101,
    "state": "streaming",
    "framesSent": 900,
    "bytesSent": 104857600,
    "bitrateKbps": 4096,
    "frameRate": 30,
    "droppedFrames": 0,
    "keyFramesSent": 30,
    "cursor": 104857600,
    "nextSeqId": 1600,
    "nextFrameId": 900,
    "timestampMs": 1710000030000
  }
}
```



---



# 十八、多路视频流规则



必须说明：



```Plain Text
1. 每次 video.openStream 返回一个新的 streamId。
2. 不同 streamId 的 seqId / cursor / frameId 独立计数。
3. 每个 streamId 独立 close。
4. maxConcurrentStreams 由 video.getStreamCapabilities 声明。
```



示例：



```Plain Text
streamId=101 main h264 1080p30
streamId=102 sub mjpeg 720p15
```



---



# 十九、与 RTSP / NDI 的关系



必须说明：



```Plain Text
video.openStream:
  AXTP 内部流，通过 stream 数据面传输 video_chunk。

video.setRtspConfig:
  配置 RTSP 服务，外部播放器通过 rtsp:// URL 访问。

video.setNdiConfig:
  配置 NDI 输出，NDI 生态发现和接收。
```



不要把 RTSP URL 或 NDI sourceName 放进 `video.openStream`。



---



# 二十、错误处理



建议错误码：



```Plain Text
UnsupportedCapability:
  不支持 video stream、某 codec、某 source、某 pixelFormat。

InvalidParams:
  分辨率、帧率、码率、chunkSize 越界。

Conflict:
  编码器资源冲突、stream 数量超限、source 被占用。

ServerBusy:
  视频链路繁忙。

Unavailable:
  camera 或 video source 不可用。

PermissionDenied:
  当前权限不允许打开视频流。

EncoderError:
  编码器启动失败或运行失败。

StreamNotFound:
  streamId 不存在。

KeyFrameRequestUnsupported:
  不支持请求关键帧。
```



错误示例：



```JSON
{
  "error": {
    "code": "InvalidParams",
    "message": "frameRate is not supported",
    "data": {
      "field": "frameRate",
      "value": 120,
      "supported": [15, 25, 30, 50, 60]
    }
  }
}
```



---



# 二十一、Capability 注册建议



新增 capability：



```Plain Text
video.stream
stream.flowControl
```



`video.stream` 对应方法：



```Plain Text
video.getStreamCapabilities
video.openStream
video.closeStream
video.getStreamState
video.requestKeyFrame
video.setStreamConfig
video.getStreamConfig
```



`video.stream` 对应事件：



```Plain Text
video.streamStateChanged
video.streamStatsReported
```



`stream.flowControl` 对应方法：



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



`stream.flowControl` 对应事件：



```Plain Text
stream.stateChanged
stream.statsReported
stream.flowControlChanged
```



---



# 二十二、验收标准



完成后必须满足：



```Plain Text
1. VideoStream 文档明确 video 是业务控制面，stream 是数据面和公共流控面。
2. 文档不定义常规 stream.open。
3. video.openStream 是视频流常规创建入口。
4. video.closeStream 是视频流常规关闭入口。
5. stream.abort 只作为异常释放接口。
6. video.openStream 返回 streamId / streamProfile / cursor / nextSeqId / nextFrameId。
7. stream 数据面示例包含：
   streamId
   seqId
   cursor
   frameId
   timestampUs
   payloadType
   codec
   keyFrame
   frameStart
   frameEnd
   payload
8. 文档明确 seqId / cursor / frameId 的区别。
9. 文档定义 realtime_video streamProfile。
10. 文档说明普通业务 App 不需要显式调用 stream.ack/windowUpdate/pause/resume。
11. 文档说明 SDK/runtime 可以根据 streamProfile 自动执行流控。
12. 文档说明丢包重同步使用 video.requestKeyFrame。
13. 文档说明多路 streamId 独立计数。
14. 文档说明与 RTSP/NDI 的区别。
15. 方法注册表补充 video.* 和 stream.* 方法。
16. 事件注册表补充 video.* 和 stream.* 事件。
17. capability 注册表补充 video.stream 和 stream.flowControl。
```



---



# 二十三、不要做的事情



不要做：



```Plain Text
1. 不要定义常规 stream.open。
2. 不要让业务 App 先调用 stream.open 再调用 video.openStream。
3. 不要用 stream.close 作为视频流正常关闭入口。
4. 不要让 stream 域承载 codec/resolution/frameRate/bitrate 等视频业务参数。
5. 不要把视频大数据放进 video.openStream 的 RPC response。
6. 不要把 streamId 和 frameId 混用。
7. 不要只靠 frameId 检测丢包。
8. 不要用 seqId 表示字节位置。
9. 不要把 RTSP/NDI 配置混入 video.openStream。
10. 不要把周期统计事件命名为 Changed，应使用 Reported。
```



请按以上要求实现。修改完成后，请列出：



```Plain Text
1. 新增/修改的文件；
2. 新增的方法；
3. 新增的事件；
4. 新增的 capability ID；
5. 是否移除或避免定义 stream.open；
6. 是否将 stream.close 改为 stream.abort 或标记 deprecated；
7. 最终 video.openStream / video.closeStream / stream.abort 的职责边界；
8. 最终视频数据 chunk 结构；
9. 最终采用的 realtime_video profile 定义。
```



