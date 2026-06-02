# AXTP 文件流获取方案

# Log 日志流与日志文件获取协议方案



版本：v0\.1  

归属域：`log`  

数据面：`stream` / `file`  

适用范围：实时日志订阅、日志导出、日志文件打包、分模块日志过滤、按时间范围获取日志、诊断日志收集。



---



## 1\. 设计目标



`log` 域用于统一设备日志能力，包括：



```Plain Text
实时日志流订阅
日志等级过滤
日志模块过滤
按时间范围导出日志
日志文件列表查询
日志文件生成
日志文件下载
日志清理
日志状态查询
日志进度上报
```



日志数据有两种主要获取方式：



```Plain Text
1. 实时日志流
   通过 stream 数据面持续输出日志记录。

2. 日志文件
   设备生成日志文件，通过 file 域下载。
```



核心原则：



```Plain Text
log 负责“取什么日志”；
stream 负责“实时日志怎么流式传输”；
file 负责“日志文件怎么下载”。
```



---



## 2\. 域职责划分



|能力|归属域|说明|
|---|---|---|
|查询日志能力|`log.getCapabilities`|查询支持的等级、模块、导出格式等|
|开启实时日志流|`log.openStream`|创建日志流，返回 `streamId`|
|关闭实时日志流|`log.closeStream`|正常关闭日志流|
|查询日志流状态|`log.getStreamState`|查询实时日志订阅状态|
|创建日志导出任务|`log.createExport`|生成日志文件|
|查询导出状态|`log.getExportState`|查询日志文件生成进度|
|列出日志文件|`log.listFiles`|查询设备已有日志文件|
|删除日志文件|`log.deleteFiles`|删除日志文件|
|下载日志文件|`file.download`|通过 file 域下载日志文件|
|实时日志数据|`stream`|使用 `streamId / seqId / cursor / payloadType / payload`|
|异常中止|`stream.abort`|兜底释放，不作为正常关闭入口|



---



## 3\. 非目标



`log` 域不负责：



```Plain Text
1. 不负责通用文件下载，下载归 file 域；
2. 不负责底层 stream 流控，流控归 stream 域；
3. 不直接把大型日志文件塞进普通 RPC response；
4. 不替代 diagnostic 产测流程；
5. 不负责业务私有日志格式解析。
```



对于产测或故障诊断流程，可以由：



```Plain Text
diagnostic.collectLogs
```



触发日志收集，但底层仍复用：



```Plain Text
log.createExport
file.download
```



---



## 4\. 方法清单



推荐方法：



```Plain Text
log.getCapabilities
log.openStream
log.closeStream
log.getStreamState

log.createExport
log.getExportState
log.cancelExport

log.listFiles
log.getFileInfo
log.deleteFiles
```



配合 file 域：



```Plain Text
file.getInfo
file.download
file.delete
```



配合 stream 域：



```Plain Text
stream.getState
stream.getStats
stream.pause
stream.resume
stream.abort
```



普通业务调用方不需要直接调用 `stream.*`，SDK/runtime 可以根据 `streamProfile` 自动处理。



---



## 5\. 事件清单



```Plain Text
log.streamStateChanged
log.exportStateChanged
log.exportProgressReported
log.fileListChanged
```



其中：



```Plain Text
log.streamStateChanged
  实时日志流状态变化。

log.exportStateChanged
  日志导出任务状态变化。

log.exportProgressReported
  日志导出进度周期上报。

log.fileListChanged
  设备日志文件列表发生变化。
```



周期性进度使用 `Reported`，不要使用 `Changed`。



---



## 6\. 日志等级



推荐日志等级：



```Plain Text
trace
debug
info
warn
error
fatal
```



等级语义：



|level|说明|
|---|---|
|`trace`|最详细跟踪日志|
|`debug`|调试日志|
|`info`|普通运行信息|
|`warn`|警告|
|`error`|错误|
|`fatal`|严重错误|



过滤规则：



```Plain Text
minLevel = info
```



表示输出：



```Plain Text
info / warn / error / fatal
```



---



## 7\. 日志模块



日志模块由设备能力声明。



推荐模块示例：



```Plain Text
system
network
audio
video
camera
display
input
firmware
stream
file
storage
diagnostic
app
kernel
driver
vendor
```



模块过滤可以使用：



```JSON
{
  "modules": ["audio", "video", "firmware"]
}
```



如果不传 `modules`，表示全部模块。



---



## 8\. 日志格式



推荐支持：



```Plain Text
text
jsonl
binary
zip
tar
```



说明：



|format|说明|
|---|---|
|`text`|普通文本日志|
|`jsonl`|每行一个 JSON object|
|`binary`|设备私有二进制日志|
|`zip`|打包压缩|
|`tar`|打包归档|



实时日志流推荐：



```Plain Text
jsonl
text
```



日志文件导出推荐：



```Plain Text
zip
tar
text
jsonl
```



---



# 9\. log\.getCapabilities



## 9\.1 用途



查询设备日志能力。



## 9\.2 请求



```JSON
{
  "method": "log.getCapabilities",
  "params": {}
}
```



## 9\.3 返回



```JSON
{
  "result": {
    "supported": true,
    "levels": ["trace", "debug", "info", "warn", "error", "fatal"],
    "defaultLevel": "info",
    "modules": [
      "system",
      "network",
      "audio",
      "video",
      "camera",
      "firmware",
      "stream",
      "file",
      "diagnostic"
    ],
    "formats": ["text", "jsonl", "zip", "tar"],
    "stream": {
      "supported": true,
      "streamProfiles": ["telemetry", "reliable_file"],
      "defaultStreamProfile": "telemetry",
      "maxConcurrentStreams": 2,
      "maxLineLength": 4096,
      "supportsFollow": true
    },
    "export": {
      "supported": true,
      "maxTimeRangeSec": 604800,
      "supportsCompression": true,
      "supportsTimeRange": true,
      "supportsModuleFilter": true,
      "supportsLevelFilter": true,
      "maxExportSizeBytes": 268435456
    },
    "files": {
      "supported": true,
      "maxFileCount": 32,
      "retentionDays": 7
    }
  }
}
```



## 9\.4 字段说明



|字段|说明|
|---|---|
|`levels`|支持的日志等级|
|`modules`|支持的日志模块|
|`formats`|支持的日志输出格式|
|`stream.supported`|是否支持实时日志流|
|`stream.defaultStreamProfile`|默认日志流 profile|
|`export.supported`|是否支持日志文件导出|
|`export.maxTimeRangeSec`|最大可导出时间范围|
|`files.maxFileCount`|设备最多保留日志文件数量|
|`files.retentionDays`|日志文件保留天数|



---



# 10\. 实时日志流



## 10\.1 设计说明



实时日志流用于持续接收设备产生的日志。



典型场景：



```Plain Text
调试设备运行状态
远程问题定位
观察音视频链路
观察 OTA 升级过程
观察网络连接状态
```



实时日志流由：



```Plain Text
log.openStream
```



创建，返回：



```Plain Text
streamId
```



日志数据通过 `stream` 数据面传输。



---



## 10\.2 log\.openStream



### 请求



```JSON
{
  "method": "log.openStream",
  "params": {
    "minLevel": "info",
    "modules": ["system", "network", "audio", "video"],
    "format": "jsonl",
    "follow": true,
    "includeHistory": true,
    "historyLines": 200,
    "streamProfile": "telemetry"
  }
}
```



### 返回



```JSON
{
  "result": {
    "logStreamId": "log_stream_001",
    "streamId": 501,
    "state": "streaming",
    "minLevel": "info",
    "modules": ["system", "network", "audio", "video"],
    "format": "jsonl",
    "follow": true,
    "streamProfile": "telemetry",
    "cursor": 0,
    "nextSeqId": 0,
    "startedAtMs": 1710000000000
  }
}
```



## 10\.3 字段说明



|字段|说明|
|---|---|
|`logStreamId`|日志流业务 ID|
|`streamId`|stream 数据面 ID|
|`minLevel`|最小日志等级|
|`modules`|模块过滤|
|`format`|输出格式，推荐 `jsonl`|
|`follow`|是否持续跟随新日志|
|`includeHistory`|是否先输出历史日志|
|`historyLines`|输出最近多少行历史日志|
|`streamProfile`|stream profile，默认 `telemetry`|



## 10\.4 规则



```Plain Text
1. log.openStream 是实时日志流的业务入口；
2. 不通过 stream.open 创建日志流；
3. 成功后必须返回 streamId；
4. 实时日志默认使用 telemetry profile；
5. 如果需要可靠日志流，可以使用 reliable_file profile；
6. 普通 App 不需要显式调用 stream.ack；
7. 正常关闭必须调用 log.closeStream；
8. stream.abort 只用于异常释放。
```



---



# 11\. 实时日志 stream 数据结构



## 11\.1 JSONL 日志 chunk



如果 `format=jsonl`，每个 payload 可以包含一行或多行 JSONL。



```JSON
{
  "streamId": 501,
  "seqId": 0,
  "cursor": 0,
  "timestampMs": 1710000000000,
  "payloadType": "log_chunk",
  "format": "jsonl",
  "lineCount": 2,
  "payload": "base64:eyJ0cyI6MTcxMDAwMDAwMDAwMCwibGV2ZWwiOiJpbmZvIiwi..."
}
```



payload 解码后示例：



```Plain Text
{"ts":1710000000000,"level":"info","module":"system","message":"device started"}
{"ts":1710000000001,"level":"warn","module":"network","message":"wifi signal weak"}
```



## 11\.2 text 日志 chunk



```JSON
{
  "streamId": 501,
  "seqId": 1,
  "cursor": 512,
  "timestampMs": 1710000000020,
  "payloadType": "log_chunk",
  "format": "text",
  "lineCount": 2,
  "payload": "base64:WzIwMjYtMDYtMDIgMTA6MDA6MDBd..."
}
```



## 11\.3 字段说明



|字段|类型|说明|
|---|---|---|
|`streamId`|`uint32`|`log.openStream` 返回的 stream ID|
|`seqId`|`uint32/uint64`|日志 chunk 序号|
|`cursor`|`uint64`|日志流字节偏移|
|`timestampMs`|`uint64`|当前 chunk 生成时间|
|`payloadType`|`string`|固定为 `log_chunk`|
|`format`|`string`|`text` / `jsonl` / `binary`|
|`lineCount`|`uint32`|当前 chunk 包含日志行数|
|`payload`|`bytes/base64`|日志数据|



---



# 12\. log\.closeStream



## 12\.1 用途



正常关闭实时日志流。



## 12\.2 请求



```JSON
{
  "method": "log.closeStream",
  "params": {
    "logStreamId": "log_stream_001"
  }
}
```



也可以支持用 `streamId` 关闭：



```JSON
{
  "method": "log.closeStream",
  "params": {
    "streamId": 501
  }
}
```



## 12\.3 返回



```JSON
{
  "result": {
    "logStreamId": "log_stream_001",
    "streamId": 501,
    "state": "closed",
    "finalCursor": 1048576,
    "finalSeqId": 2047,
    "closedAtMs": 1710000100000
  }
}
```



## 12\.4 规则



```Plain Text
1. 正常关闭日志流必须调用 log.closeStream；
2. log.closeStream 负责停止日志订阅并释放内部 stream；
3. stream.abort 不应替代 log.closeStream；
4. 如果 stream 已异常中止，log.closeStream 可以返回 closed 或 StreamNotFound。
```



---



# 13\. log\.getStreamState



## 13\.1 请求



```JSON
{
  "method": "log.getStreamState",
  "params": {
    "logStreamId": "log_stream_001"
  }
}
```



## 13\.2 返回



```JSON
{
  "result": {
    "logStreamId": "log_stream_001",
    "streamId": 501,
    "state": "streaming",
    "minLevel": "info",
    "modules": ["system", "network", "audio", "video"],
    "format": "jsonl",
    "follow": true,
    "linesSent": 2048,
    "bytesSent": 1048576,
    "cursor": 1048576,
    "nextSeqId": 2048,
    "startedAtMs": 1710000000000
  }
}
```



---



# 14\. 日志流状态枚举



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



# 15\. log\.streamStateChanged



## 15\.1 打开事件



```JSON
{
  "event": "log.streamStateChanged",
  "params": {
    "logStreamId": "log_stream_001",
    "streamId": 501,
    "state": "streaming",
    "minLevel": "info",
    "modules": ["system", "network", "audio", "video"],
    "format": "jsonl",
    "timestampMs": 1710000000000
  }
}
```



## 15\.2 关闭事件



```JSON
{
  "event": "log.streamStateChanged",
  "params": {
    "logStreamId": "log_stream_001",
    "streamId": 501,
    "state": "closed",
    "finalCursor": 1048576,
    "finalSeqId": 2047,
    "timestampMs": 1710000100000
  }
}
```



## 15\.3 失败事件



```JSON
{
  "event": "log.streamStateChanged",
  "params": {
    "logStreamId": "log_stream_001",
    "streamId": 501,
    "state": "failed",
    "errorCode": "stream_aborted",
    "message": "Log stream aborted by receiver",
    "timestampMs": 1710000050000
  }
}
```



---



# 16\. 日志文件导出



## 16\.1 设计说明



日志文件导出适合：



```Plain Text
导出历史日志
导出崩溃日志
导出升级日志
导出一段时间内的模块日志
导出打包后的诊断日志
```



日志导出由 `log.createExport` 创建任务，完成后生成 `fileId`，再通过 `file.download` 下载。



---



# 17\. log\.createExport



## 17\.1 请求：导出最近日志



```JSON
{
  "method": "log.createExport",
  "params": {
    "name": "diagnostic_logs",
    "minLevel": "debug",
    "modules": ["system", "network", "audio", "video", "firmware"],
    "timeRange": {
      "type": "recent",
      "durationSec": 3600
    },
    "format": "zip",
    "compression": "zip"
  }
}
```



## 17\.2 请求：按绝对时间范围导出



```JSON
{
  "method": "log.createExport",
  "params": {
    "name": "logs_2026_06_02",
    "minLevel": "info",
    "modules": ["system", "firmware"],
    "timeRange": {
      "type": "absolute",
      "startTimeMs": 1710000000000,
      "endTimeMs": 1710003600000
    },
    "format": "jsonl",
    "compression": "none"
  }
}
```



## 17\.3 返回



```JSON
{
  "result": {
    "exportId": "log_export_001",
    "state": "exporting",
    "name": "diagnostic_logs",
    "format": "zip",
    "compression": "zip",
    "progress": 0,
    "startedAtMs": 1710000000000
  }
}
```



## 17\.4 字段说明



|字段|说明|
|---|---|
|`exportId`|日志导出任务 ID|
|`name`|导出文件名称前缀|
|`minLevel`|最小日志等级|
|`modules`|模块过滤|
|`timeRange`|时间范围|
|`format`|日志格式|
|`compression`|压缩方式|



## 17\.5 timeRange



支持：



```Plain Text
recent
absolute
all
```



recent 示例：



```JSON
{
  "type": "recent",
  "durationSec": 3600
}
```



absolute 示例：



```JSON
{
  "type": "absolute",
  "startTimeMs": 1710000000000,
  "endTimeMs": 1710003600000
}
```



all 示例：



```JSON
{
  "type": "all"
}
```



---



# 18\. log\.getExportState



## 18\.1 请求



```JSON
{
  "method": "log.getExportState",
  "params": {
    "exportId": "log_export_001"
  }
}
```



## 18\.2 导出中返回



```JSON
{
  "result": {
    "exportId": "log_export_001",
    "state": "exporting",
    "progress": 65,
    "bytesWritten": 5242880,
    "startedAtMs": 1710000000000,
    "updatedAtMs": 1710000005000
  }
}
```



## 18\.3 导出完成返回



```JSON
{
  "result": {
    "exportId": "log_export_001",
    "state": "completed",
    "progress": 100,
    "fileId": "file_log_export_001",
    "fileName": "diagnostic_logs_20260602_100000.zip",
    "mimeType": "application/zip",
    "size": 8388608,
    "createdAtMs": 1710000010000
  }
}
```



---



# 19\. log\.cancelExport



## 19\.1 请求



```JSON
{
  "method": "log.cancelExport",
  "params": {
    "exportId": "log_export_001",
    "reason": "user_request"
  }
}
```



## 19\.2 返回



```JSON
{
  "result": {
    "exportId": "log_export_001",
    "state": "cancelled"
  }
}
```



规则：



```Plain Text
1. exporting 阶段可以取消；
2. completed 后不允许取消，但可以删除生成的 file；
3. cancel 后应清理临时文件。
```



---



# 20\. 日志导出状态枚举



```Plain Text
pending
exporting
completed
failed
cancelled
unsupported
```



---



# 21\. log\.exportStateChanged



## 21\.1 导出开始



```JSON
{
  "event": "log.exportStateChanged",
  "params": {
    "exportId": "log_export_001",
    "state": "exporting",
    "progress": 0,
    "timestampMs": 1710000000000
  }
}
```



## 21\.2 导出完成



```JSON
{
  "event": "log.exportStateChanged",
  "params": {
    "exportId": "log_export_001",
    "state": "completed",
    "progress": 100,
    "fileId": "file_log_export_001",
    "fileName": "diagnostic_logs_20260602_100000.zip",
    "size": 8388608,
    "timestampMs": 1710000010000
  }
}
```



## 21\.3 导出失败



```JSON
{
  "event": "log.exportStateChanged",
  "params": {
    "exportId": "log_export_001",
    "state": "failed",
    "errorCode": "storage_full",
    "message": "No enough storage for log export",
    "timestampMs": 1710000005000
  }
}
```



---



# 22\. log\.exportProgressReported



周期性上报日志导出进度。



```JSON
{
  "event": "log.exportProgressReported",
  "params": {
    "exportId": "log_export_001",
    "state": "exporting",
    "progress": 65,
    "bytesWritten": 5242880,
    "timestampMs": 1710000005000
  }
}
```



规则：



```Plain Text
1. 周期性进度使用 Reported；
2. progress 范围 0-100；
3. 导出完成后应发送 exportStateChanged；
4. 进度上报频率由设备决定。
```



---



# 23\. 日志文件列表



## 23\.1 log\.listFiles



### 请求



```JSON
{
  "method": "log.listFiles",
  "params": {
    "limit": 20
  }
}
```



### 返回



```JSON
{
  "result": {
    "files": [
      {
        "fileId": "file_log_export_001",
        "name": "diagnostic_logs_20260602_100000.zip",
        "format": "zip",
        "mimeType": "application/zip",
        "size": 8388608,
        "createdAtMs": 1710000010000,
        "source": "export"
      },
      {
        "fileId": "file_crash_001",
        "name": "crash_20260602_093000.log",
        "format": "text",
        "mimeType": "text/plain",
        "size": 262144,
        "createdAtMs": 1709999400000,
        "source": "crash"
      }
    ]
  }
}
```



## 23\.2 字段说明



|字段|说明|
|---|---|
|`fileId`|文件 ID，用于 file\.download|
|`name`|文件名|
|`format`|日志格式|
|`mimeType`|MIME 类型|
|`size`|文件大小|
|`createdAtMs`|创建时间|
|`source`|文件来源，例如 export / crash / system / diagnostic|



---



## 23\.3 log\.getFileInfo



### 请求



```JSON
{
  "method": "log.getFileInfo",
  "params": {
    "fileId": "file_log_export_001"
  }
}
```



### 返回



```JSON
{
  "result": {
    "fileId": "file_log_export_001",
    "name": "diagnostic_logs_20260602_100000.zip",
    "format": "zip",
    "mimeType": "application/zip",
    "size": 8388608,
    "createdAtMs": 1710000010000,
    "source": "export",
    "downloadable": true
  }
}
```



---



## 23\.4 log\.deleteFiles



### 请求



```JSON
{
  "method": "log.deleteFiles",
  "params": {
    "fileIds": [
      "file_log_export_001",
      "file_crash_001"
    ]
  }
}
```



### 返回



```JSON
{
  "result": {
    "deleted": [
      "file_log_export_001",
      "file_crash_001"
    ],
    "failed": []
  }
}
```



---



# 24\. 日志文件下载



日志文件下载不由 `log` 域直接传输，而是使用 `file` 域。



## 24\.1 file\.getInfo



```JSON
{
  "method": "file.getInfo",
  "params": {
    "fileId": "file_log_export_001"
  }
}
```



## 24\.2 file\.download



```JSON
{
  "method": "file.download",
  "params": {
    "fileId": "file_log_export_001",
    "streamProfile": "reliable_file"
  }
}
```



返回：



```JSON
{
  "result": {
    "downloadId": "download_log_001",
    "streamId": 601,
    "streamProfile": "reliable_file",
    "fileId": "file_log_export_001",
    "size": 8388608,
    "cursor": 0,
    "nextSeqId": 0
  }
}
```



随后通过 stream 数据面发送：



```JSON
{
  "streamId": 601,
  "seqId": 0,
  "cursor": 0,
  "timestampMs": 1710000000000,
  "payloadType": "file_chunk",
  "fileId": "file_log_export_001",
  "chunkOffset": 0,
  "chunkSize": 65536,
  "payload": "base64:AAAA..."
}
```



---



# 25\. log\.fileListChanged



当日志文件列表变化时上报。



```JSON
{
  "event": "log.fileListChanged",
  "params": {
    "reason": "file_created",
    "file": {
      "fileId": "file_log_export_001",
      "name": "diagnostic_logs_20260602_100000.zip",
      "size": 8388608,
      "createdAtMs": 1710000010000
    },
    "timestampMs": 1710000010000
  }
}
```



删除文件：



```JSON
{
  "event": "log.fileListChanged",
  "params": {
    "reason": "file_deleted",
    "fileIds": [
      "file_log_export_001"
    ],
    "timestampMs": 1710000100000
  }
}
```



reason 枚举：



```Plain Text
file_created
file_deleted
file_rotated
retention_cleanup
user_request
unknown
```



---



# 26\. 与 stream 域关系



实时日志流推荐使用：



```Plain Text
streamProfile = telemetry
```



如果要求可靠传输，例如日志导出实时拉取，可以使用：



```Plain Text
streamProfile = reliable_file
```



实时日志流数据面使用：



```Plain Text
payloadType = log_chunk
```



核心字段：



```Plain Text
streamId
seqId
cursor
timestampMs
payloadType
format
lineCount
payload
```



正常关闭日志流：



```Plain Text
log.closeStream
```



异常释放：



```Plain Text
stream.abort
```



`stream.abort` 不应替代 `log.closeStream`。



---



# 27\. 与 file 域关系



日志文件获取统一通过 `file` 域下载：



```Plain Text
file.getInfo
file.download
file.delete
```



`log` 域负责：



```Plain Text
列出日志文件
创建导出文件
查询导出状态
管理日志文件元信息
```



`file` 域负责：



```Plain Text
文件下载数据面
断点续传
文件级 cursor
file_chunk
```



---



# 28\. 与 diagnostic 域关系



`diagnostic` 可以组织诊断流程，例如：



```Plain Text
diagnostic.collectReport
diagnostic.runFactoryTest
```



但日志采集底层建议复用：



```Plain Text
log.createExport
log.getExportState
file.download
```



不要在 `diagnostic` 里重复定义一套日志导出协议。



---



# 29\. 错误处理



推荐错误码：



```Plain Text
UnsupportedCapability
  不支持日志流、日志导出、指定 format、指定 module。

InvalidParams
  level 非法、module 不存在、timeRange 非法。

StreamNotFound
  logStreamId 或 streamId 不存在。

ExportNotFound
  exportId 不存在。

FileNotFound
  fileId 不存在。

StorageFull
  存储空间不足，无法导出日志。

PermissionDenied
  当前权限不允许读取日志。

ServerBusy
  日志系统繁忙。

TooManyStreams
  实时日志流数量超过上限。

TooManyExports
  导出任务数量超过上限。

InvalidState
  当前状态不允许该操作。
```



错误示例：



```JSON
{
  "error": {
    "code": "InvalidParams",
    "message": "Unsupported log module",
    "data": {
      "field": "modules[0]",
      "value": "unknown_module"
    }
  }
}
```



导出文件不存在：



```JSON
{
  "error": {
    "code": "ExportNotFound",
    "message": "log export not found",
    "data": {
      "exportId": "log_export_999"
    }
  }
}
```



---



# 30\. 安全与权限



日志可能包含敏感信息，因此必须遵守：



```Plain Text
1. 读取日志需要权限控制；
2. 生产环境可限制 trace/debug 日志；
3. 日志中不得明文输出 Wi-Fi 密码、token、license、私钥；
4. log.createExport 可以按权限限制模块范围；
5. log.openStream 可以按权限限制 minLevel；
6. 导出文件应有保留时间或数量限制；
7. 下载日志文件前应进行认证授权；
8. log.deleteFiles 应受权限控制。
```



---



# 31\. Capability 注册建议



建议新增 capability：



```Plain Text
log.stream
log.export
log.files
```



对应方法：



```Plain Text
log.getCapabilities

log.openStream
log.closeStream
log.getStreamState

log.createExport
log.getExportState
log.cancelExport

log.listFiles
log.getFileInfo
log.deleteFiles
```



对应事件：



```Plain Text
log.streamStateChanged
log.exportStateChanged
log.exportProgressReported
log.fileListChanged
```



---



# 32\. Binary / TLV 映射建议



JSON\-RPC 中使用可读字段：



```Plain Text
logStreamId
exportId
fileId
minLevel
modules
format
timeRange
streamId
seqId
cursor
payloadType
payload
```



Binary / TLV 中可以映射为：



```Plain Text
streamId: uint32
seqId: uint32/uint64
cursor: uint64
timestampMs: uint64
payloadType: uint8
level: uint8
moduleId: uint16
format: uint8
lineCount: uint16
payloadLength: uint32
payload: bytes
```



推荐 payloadType ID：



```Plain Text
0x05 = log_chunk
```



推荐 level ID：



```Plain Text
0x00 trace
0x01 debug
0x02 info
0x03 warn
0x04 error
0x05 fatal
```



推荐 format ID：



```Plain Text
0x01 text
0x02 jsonl
0x03 binary
0x04 zip
0x05 tar
```



数字 ID 只用于二进制映射，JSON 协议继续使用字符串。



---



# 33\. 推荐 MVP



MVP 推荐实现：



```Plain Text
log.getCapabilities

log.openStream
log.closeStream
log.getStreamState
log.streamStateChanged

log.createExport
log.getExportState
log.cancelExport
log.exportStateChanged
log.exportProgressReported

log.listFiles
log.getFileInfo
log.deleteFiles
```



MVP 推荐支持：



```Plain Text
实时日志流：
  format = jsonl / text
  streamProfile = telemetry
  payloadType = log_chunk

日志文件：
  format = zip / text
  file.download 使用 reliable_file
```



可选增强：



```Plain Text
按模块过滤
按时间范围导出
includeHistory
historyLines
二进制日志格式
日志脱敏策略
日志文件自动轮转事件
```



---



# 34\. 最终接口清单



```Plain Text
log.getCapabilities

log.openStream
log.closeStream
log.getStreamState

log.createExport
log.getExportState
log.cancelExport

log.listFiles
log.getFileInfo
log.deleteFiles

log.streamStateChanged
log.exportStateChanged
log.exportProgressReported
log.fileListChanged
```



配合：



```Plain Text
file.download
stream 数据面
```



---



# 35\. 核心结论



```Plain Text
log 域负责日志业务控制面：
  实时日志订阅、日志等级过滤、模块过滤、日志导出、日志文件列表。

stream 域负责实时日志数据面：
  streamId、seqId、cursor、payloadType=log_chunk、payload。

file 域负责日志文件下载：
  fileId、file.download、file_chunk、reliable_file。

实时日志流：
  log.openStream -> streamId -> log_chunk -> log.closeStream。

日志文件获取：
  log.createExport -> fileId -> file.download。

正常关闭日志流必须使用 log.closeStream；
底层异常释放才使用 stream.abort。
```



