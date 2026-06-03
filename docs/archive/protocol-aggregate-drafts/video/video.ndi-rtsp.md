# AXTP的网络数据流方案

# Video NDI / RTSP 配置协议方案 v0\.1

## 协议审核标记（人工复核）

| 标记 | 对象 | 审核结论 | 后续动作 |
|---|---|---|---|
| `[REVIEW-OK]` | `video.ndi` / `video.rtsp` capability | NDI/RTSP 是视频输出或访问服务，不是基础 network 配置；feature ID 符合 `domain.feature` 规则。 | 可作为 video domain YAML 草案输入。 |
| `[REVIEW-OK]` | `video.setNdiConfig` / `video.getNdiConfig` / `video.ndiConfigChanged` / `video.setRtspConfig` / `video.getRtspConfig` / `video.rtspConfigChanged` | Config 方法和事件名称可保留；`ndiConfig` / `rtspConfig` 不作为 capability ID。 | 人工确认 schema 后进入 registry。 |
| `[REVIEW-ASK]` | AXDP `CommonSetNDIState` / `CommonGetNDIState` | 当前可映射到 `video.setNdiConfig` / `video.getNdiConfig`，但旧 state 可能只表示 enable/disable。 | 确认是否写入 `enabled` 字段，或需要独立 state query。 |
| `[REVIEW-ASK]` | AXDP `CommonSetRTSPStreamURL` / `CommonGetRTSPStreamURL` | 当前可映射到 `video.setRtspConfig` / `video.getRtspConfig`，但需确认旧语义是设置完整 URL、查询设备生成 URL，还是配置路径/端口。 | 确认 URL 字段方向；若旧实现存在指针或字符串处理问题，只记录语义映射，不继承 bug。 |
| `[REVIEW-FIX]` | RTSP/NDI 与 `video.stream` 边界 | 文档需要明确 RTSP/NDI 配置服务不等同于 AXTP `video.openStream` 数据流。 | 规范化阶段补充边界说明和 capability/method 归属表。 |



## 1\. 归属域



NDI 和 RTSP 都归属：



```Plain Text
video
```



原因：



```Plain Text
NDI 是网络视频输出能力。
RTSP 是视频流访问/输出服务。
它们虽然依赖网络，但不是基础网络配置。
```



边界规则：



```Plain Text
network:
  IP、DNS、网关、Wi-Fi、以太网、MAC、网络接口状态。

video:
  RTSP、NDI、SRT、RTMP、视频编码、输出流配置。

audio:
  Dante、UAC、音频链路、音频算法。

input:
  VISCA UDP/TCP、HID、KVM、控制输入。
```



---



# 2\. NDI Config 协议



## 2\.1 方法清单



```Plain Text
video.getNdiCapabilities
video.setNdiConfig
video.getNdiConfig
video.resetNdiConfig
video.ndiConfigChanged
video.ndiStateChanged
```



其中：



```Plain Text
video.ndiConfigChanged:
  NDI 配置变化事件。

video.ndiStateChanged:
  NDI 运行状态变化事件，例如 starting / running / error。
```



如果第一版想简化，可以先只实现：



```Plain Text
video.setNdiConfig
video.getNdiConfig
video.ndiConfigChanged
```



---



## 2\.2 video\.getNdiCapabilities



### 用途



查询设备 NDI 能力范围，例如是否支持 NDI、支持的模式、分辨率、帧率、编码格式、是否支持发现、是否支持多路输出等。



### 请求



```JSON
{
  "method": "video.getNdiCapabilities",
  "params": {}
}
```



### 返回



```JSON
{
  "result": {
    "supported": true,
    "versions": ["ndi_hx", "ndi_hx2", "ndi_hx3"],
    "defaultVersion": "ndi_hx2",
    "resolutions": ["720p", "1080p", "4k"],
    "frameRates": [25, 30, 50, 60],
    "colorFormats": ["nv12", "uyvy", "rgb"],
    "discoveryModes": ["auto", "manual"],
    "supportsSourceName": true,
    "supportsGroups": true,
    "supportsMulticast": false,
    "maxOutputs": 1
  }
}
```



字段说明：



```Plain Text
supported:
  是否支持 NDI。

versions:
  支持的 NDI 类型，例如 ndi_hx / ndi_hx2 / ndi_hx3。

resolutions:
  支持的输出分辨率。

frameRates:
  支持的输出帧率。

discoveryModes:
  NDI 发现模式。

supportsSourceName:
  是否支持配置 NDI source name。

supportsGroups:
  是否支持配置 NDI groups。

supportsMulticast:
  是否支持 multicast NDI。

maxOutputs:
  最大 NDI 输出路数。
```



---



## 2\.3 video\.setNdiConfig



### 用途



设置 NDI 输出配置，包括启用状态、sourceName、版本、输出规格、发现模式等。



### 请求



```JSON
{
  "method": "video.setNdiConfig",
  "params": {
    "enabled": true,
    "sourceName": "AX-Meeting-Bar",
    "version": "ndi_hx2",
    "resolution": "1080p",
    "frameRate": 30,
    "discoveryMode": "auto",
    "groups": ["public"],
    "interface": "eth0"
  }
}
```



### 返回



```JSON
{
  "result": {
    "enabled": true,
    "state": "running",
    "sourceName": "AX-Meeting-Bar",
    "version": "ndi_hx2",
    "resolution": "1080p",
    "frameRate": 30,
    "discoveryMode": "auto",
    "groups": ["public"],
    "interface": "eth0",
    "requiresRestart": false
  }
}
```



### 字段说明



```Plain Text
enabled:
  是否启用 NDI。

state:
  当前 NDI 运行状态。
  disabled / starting / running / stopping / error / unsupported。

sourceName:
  NDI 对外显示的源名称。

version:
  ndi_hx / ndi_hx2 / ndi_hx3。

resolution:
  输出分辨率，例如 720p / 1080p / 4k。

frameRate:
  输出帧率。

discoveryMode:
  auto / manual。

groups:
  NDI group 列表。

interface:
  使用哪个网络接口，例如 eth0 / wlan0。

requiresRestart:
  修改该配置后是否需要重启 NDI 服务或视频链路。
```



### 规则



```Plain Text
1. setNdiConfig 支持部分更新。
2. 未传入字段保持当前值不变。
3. 修改 enabled=true 时，设备应尝试启动 NDI 服务。
4. 修改 enabled=false 时，设备应停止 NDI 服务。
5. sourceName 不应为空。
6. interface 的 IP、DNS、网关等基础网络配置仍由 network 域负责。
7. 设置成功后返回最终生效配置，不要只返回 accepted。
8. 如果配置需要服务重启后生效，返回 requiresRestart=true 或 state=pending_restart。
```



---



## 2\.4 video\.getNdiConfig



### 请求



```JSON
{
  "method": "video.getNdiConfig",
  "params": {}
}
```



### 返回



```JSON
{
  "result": {
    "enabled": true,
    "state": "running",
    "sourceName": "AX-Meeting-Bar",
    "version": "ndi_hx2",
    "resolution": "1080p",
    "frameRate": 30,
    "discoveryMode": "auto",
    "groups": ["public"],
    "interface": "eth0",
    "actualAddress": "192.168.1.120"
  }
}
```



字段：



```Plain Text
actualAddress:
  当前 NDI 服务实际使用的 IP 地址。
```



---



## 2\.5 video\.resetNdiConfig



### 用途



将 NDI 配置恢复默认值。



### 请求



```JSON
{
  "method": "video.resetNdiConfig",
  "params": {}
}
```



### 返回



```JSON
{
  "result": {
    "enabled": false,
    "state": "disabled",
    "sourceName": "AX Device",
    "version": "ndi_hx2",
    "resolution": "1080p",
    "frameRate": 30,
    "discoveryMode": "auto",
    "groups": ["public"],
    "interface": "auto"
  }
}
```



---



## 2\.6 video\.ndiConfigChanged



配置变化事件：



```JSON
{
  "event": "video.ndiConfigChanged",
  "params": {
    "enabled": true,
    "sourceName": "AX-Meeting-Bar",
    "version": "ndi_hx2",
    "resolution": "1080p",
    "frameRate": 30,
    "discoveryMode": "auto",
    "reason": "user_request"
  }
}
```



---



## 2\.7 video\.ndiStateChanged



状态变化事件：



```JSON
{
  "event": "video.ndiStateChanged",
  "params": {
    "state": "running",
    "sourceName": "AX-Meeting-Bar",
    "actualAddress": "192.168.1.120",
    "reason": "service_started"
  }
}
```



失败示例：



```JSON
{
  "event": "video.ndiStateChanged",
  "params": {
    "state": "error",
    "errorCode": "network_unavailable",
    "message": "No active network interface",
    "reason": "service_start_failed"
  }
}
```



---



# 3\. RTSP Config 协议



## 3\.1 方法清单



```Plain Text
video.getRtspCapabilities
video.setRtspConfig
video.getRtspConfig
video.resetRtspConfig
video.rtspConfigChanged
video.rtspStateChanged
```



如果第一版想简化，可以先实现：



```Plain Text
video.setRtspConfig
video.getRtspConfig
video.rtspConfigChanged
```



---



## 3\.2 video\.getRtspCapabilities



### 用途



查询 RTSP 服务能力范围，例如是否支持 RTSP、最大路数、端口范围、认证方式、profile、是否支持主/子码流。



### 请求



```JSON
{
  "method": "video.getRtspCapabilities",
  "params": {}
}
```



### 返回



```JSON
{
  "result": {
    "supported": true,
    "maxStreams": 2,
    "streams": ["main", "sub"],
    "defaultStream": "main",
    "portRange": {
      "min": 1,
      "max": 65535,
      "defaultValue": 554
    },
    "authModes": ["none", "basic", "digest"],
    "defaultAuthMode": "digest",
    "transports": ["udp", "tcp"],
    "pathEditable": true,
    "supportsMulticast": false
  }
}
```



字段说明：



```Plain Text
maxStreams:
  最大 RTSP 输出路数。

streams:
  支持的流，例如 main / sub / third。

portRange:
  RTSP 服务端口范围。

authModes:
  none / basic / digest。

transports:
  udp / tcp。表示 RTSP/RTP 支持的传输方式。

pathEditable:
  是否允许配置 RTSP path。

supportsMulticast:
  是否支持 RTSP multicast。
```



---



## 3\.3 video\.setRtspConfig



### 用途



设置 RTSP 服务配置。



注意：如果设备是 RTSP Server，建议不要让上位机直接设置完整 URL，而是配置：



```Plain Text
enabled
port
path
authMode
stream
```



最终 URL 由设备在 `getRtspConfig` 返回。



### 请求：单路 RTSP



```JSON
{
  "method": "video.setRtspConfig",
  "params": {
    "enabled": true,
    "port": 554,
    "path": "/live/main",
    "stream": "main",
    "authMode": "digest",
    "username": "admin",
    "password": "12345678",
    "transport": "tcp"
  }
}
```



### 返回



```JSON
{
  "result": {
    "enabled": true,
    "state": "running",
    "port": 554,
    "path": "/live/main",
    "stream": "main",
    "authMode": "digest",
    "transport": "tcp",
    "url": "rtsp://192.168.1.120:554/live/main",
    "requiresRestart": false
  }
}
```



### 请求：多路 RTSP



如果设备支持 main/sub 多路配置：



```JSON
{
  "method": "video.setRtspConfig",
  "params": {
    "enabled": true,
    "streams": [
      {
        "stream": "main",
        "enabled": true,
        "path": "/live/main"
      },
      {
        "stream": "sub",
        "enabled": true,
        "path": "/live/sub"
      }
    ],
    "port": 554,
    "authMode": "digest",
    "username": "admin",
    "password": "12345678"
  }
}
```



### 返回



```JSON
{
  "result": {
    "enabled": true,
    "state": "running",
    "port": 554,
    "authMode": "digest",
    "streams": [
      {
        "stream": "main",
        "enabled": true,
        "path": "/live/main",
        "url": "rtsp://192.168.1.120:554/live/main"
      },
      {
        "stream": "sub",
        "enabled": true,
        "path": "/live/sub",
        "url": "rtsp://192.168.1.120:554/live/sub"
      }
    ]
  }
}
```



---



## 3\.4 video\.getRtspConfig



### 请求



```JSON
{
  "method": "video.getRtspConfig",
  "params": {}
}
```



### 返回



```JSON
{
  "result": {
    "enabled": true,
    "state": "running",
    "port": 554,
    "authMode": "digest",
    "transport": "tcp",
    "streams": [
      {
        "stream": "main",
        "enabled": true,
        "path": "/live/main",
        "url": "rtsp://192.168.1.120:554/live/main"
      },
      {
        "stream": "sub",
        "enabled": true,
        "path": "/live/sub",
        "url": "rtsp://192.168.1.120:554/live/sub"
      }
    ],
    "actualAddress": "192.168.1.120",
    "passwordConfigured": true
  }
}
```



注意：



```Plain Text
getRtspConfig 不应返回明文 password。
只返回 passwordConfigured。
```



---



## 3\.5 video\.resetRtspConfig



### 请求



```JSON
{
  "method": "video.resetRtspConfig",
  "params": {}
}
```



### 返回



```JSON
{
  "result": {
    "enabled": false,
    "state": "disabled",
    "port": 554,
    "authMode": "digest",
    "transport": "tcp",
    "streams": [
      {
        "stream": "main",
        "enabled": true,
        "path": "/live/main"
      }
    ]
  }
}
```



---



## 3\.6 video\.rtspConfigChanged



配置变化事件：



```JSON
{
  "event": "video.rtspConfigChanged",
  "params": {
    "enabled": true,
    "port": 554,
    "authMode": "digest",
    "streams": [
      {
        "stream": "main",
        "enabled": true,
        "path": "/live/main"
      }
    ],
    "reason": "user_request"
  }
}
```



---



## 3\.7 video\.rtspStateChanged



状态变化事件：



```JSON
{
  "event": "video.rtspStateChanged",
  "params": {
    "state": "running",
    "port": 554,
    "url": "rtsp://192.168.1.120:554/live/main",
    "reason": "service_started"
  }
}
```



失败示例：



```JSON
{
  "event": "video.rtspStateChanged",
  "params": {
    "state": "error",
    "errorCode": "port_conflict",
    "message": "RTSP port is already in use",
    "reason": "service_start_failed"
  }
}
```



---



# 4\. 状态枚举



NDI / RTSP 都可以复用服务状态枚举：



```Plain Text
disabled
starting
running
stopping
error
unsupported
pending_restart
```



字段规则：



```Plain Text
enabled:
  目标配置开关。

state:
  当前实际运行状态。

status:
  仅用于表达一次操作的执行结果，不用于表示当前服务状态。
```



---



# 5\. 安全规则



## 5\.1 RTSP 密码



```Plain Text
1. password 可以在 setRtspConfig 请求中出现。
2. getRtspConfig / rtspConfigChanged 不得回显明文 password。
3. 查询时只返回 passwordConfigured: true/false。
4. 日志中必须避免记录明文 password。
```



## 5\.2 URL 返回规则



如果 RTSP 由设备提供服务：



```Plain Text
setRtspConfig:
  配置 port/path/auth/stream。

getRtspConfig:
  返回设备根据当前 IP 计算出的 url。
```



不建议把完整 URL 作为唯一配置项，因为设备 IP 可能变化。



---



# 6\. 与 network 域的关系



```Plain Text
network.setIpConfig:
  配置 IP、网关、DNS。

video.setRtspConfig:
  配置 RTSP 服务是否启用、端口、路径、认证。

video.setNdiConfig:
  配置 NDI 是否启用、sourceName、版本、输出规格。
```



示例：



```Plain Text
设备 IP 从 192.168.1.100 改成 192.168.1.120：
  使用 network.setIpConfig。

RTSP path 从 /live/main 改成 /stream/main：
  使用 video.setRtspConfig。

NDI sourceName 从 AX-Device 改成 MeetingRoom-01：
  使用 video.setNdiConfig。
```



---



# 7\. 与 video encoder / stream 的关系



NDI / RTSP 依赖视频编码输出，但不等于编码参数本身。



可以有独立编码配置：



```Plain Text
video.setEncoderConfig
video.getEncoderConfig
```



NDI / RTSP 只引用输出规格或 stream：



```JSON
{
  "stream": "main",
  "resolution": "1080p",
  "frameRate": 30
}
```



如果编码配置由统一 encoder 管理，RTSP/NDI 可以只配置服务层字段：



```Plain Text
enabled
stream
port/path/sourceName
auth/discovery
```



---



# 8\. Capability 注册建议



建议新增 capability ID：



```Plain Text
video.ndi
video.rtsp
```

说明：

```Plain Text
Capability ID 使用 domain.feature 能力块。
ndiConfig / rtspConfig 是方法、事件或 schema 层面的配置对象名，
不作为独立 capability ID。
```



对应方法：



```Plain Text
video.getNdiCapabilities
video.setNdiConfig
video.getNdiConfig
video.resetNdiConfig

video.getRtspCapabilities
video.setRtspConfig
video.getRtspConfig
video.resetRtspConfig
```



对应事件：



```Plain Text
video.ndiConfigChanged
video.ndiStateChanged
video.rtspConfigChanged
video.rtspStateChanged
```



---



# 9\. 错误处理



建议错误码：



```Plain Text
UnsupportedCapability:
  不支持 NDI 或 RTSP。

InvalidParams:
  端口越界、path 非法、authMode 非法、sourceName 为空。

Conflict:
  端口冲突、服务互斥、stream 不存在。

PermissionDenied:
  当前权限不足，不能修改视频服务配置。

NetworkUnavailable:
  没有可用网络接口或 IP 地址。

ServerBusy:
  服务正在启动/停止，暂时不能修改。

Unavailable:
  视频输出链路不可用。
```



错误示例：RTSP 端口冲突



```JSON
{
  "error": {
    "code": "Conflict",
    "message": "RTSP port is already in use",
    "data": {
      "field": "port",
      "value": 554
    }
  }
}
```



错误示例：NDI sourceName 非法



```JSON
{
  "error": {
    "code": "InvalidParams",
    "message": "NDI sourceName must not be empty",
    "data": {
      "field": "sourceName"
    }
  }
}
```



---



# 10\. 推荐 MVP



第一版建议实现：



```Plain Text
video.setNdiConfig
video.getNdiConfig
video.ndiConfigChanged
video.ndiStateChanged

video.setRtspConfig
video.getRtspConfig
video.rtspConfigChanged
video.rtspStateChanged
```



如果你们已经有完整 capability 体系，再加：



```Plain Text
video.getNdiCapabilities
video.resetNdiConfig

video.getRtspCapabilities
video.resetRtspConfig
```



---



# 11\. 最终接口清单



完整方案：



```Plain Text
video.getNdiCapabilities
video.setNdiConfig
video.getNdiConfig
video.resetNdiConfig
video.ndiConfigChanged
video.ndiStateChanged

video.getRtspCapabilities
video.setRtspConfig
video.getRtspConfig
video.resetRtspConfig
video.rtspConfigChanged
video.rtspStateChanged
```



核心原则：



```Plain Text
NDI:
  网络视频输出能力，归 video.ndi。

RTSP:
  视频流访问服务，归 video.rtsp。

基础网络：
  IP、网关、DNS、Wi-Fi 仍归 network。
```
