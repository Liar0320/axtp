你的理解可以落成一个很清晰的映射模型：

```text id="0mwdz6"
OBS-WebSocket:
  WebSocket
    └── op + d
          └── requestType / requestData / eventData

AXTP:
  AXTP Frame
    ├── CONTROL: OPEN / ACCEPT / PING / CLOSE
    ├── RPC_JSON / RPC_BINARY: op + d
    └── STREAM: 连续数据面
```

关键不是把 OBS-WebSocket 逐字段照搬，而是把它拆成两部分：

```text id="jv3vpy"
OBS 的 op 层      → AXTP RPC op 或 AXTP PayloadType
OBS 的 d 对象块   → AXTP RPC d-block
OBS 的高频事件    → AXTP STREAM 或 RPC EVENT
OBS 的请求/响应   → AXTP RPC REQUEST / RESPONSE
```

OBS-WebSocket 的官方协议就是 `{ "op": number, "d": object }` 这种 base object；`op` 表示 Hello、Identify、Event、Request、RequestResponse、RequestBatch 等消息类型，`d` 存放对应消息数据。它还支持 JSON 文本帧和 MessagePack 二进制帧两种编码。([GitHub][1])

---

## 1. 总体映射表

| OBS-WebSocket                                | AXTP 当前框架                          | 说明                               |
| -------------------------------------------- | ---------------------------------- | -------------------------------- |
| WebSocket 连接                                 | 物理连接 / TCP / WebSocket / HID / BLE | 底层通道                             |
| `obswebsocket.json` / `obswebsocket.msgpack` | `RPC_JSON` / `RPC_BINARY`          | 编码形态                             |
| `op`                                         | RPC `op` 或 AXTP `PayloadType`      | OBS 的 op 混合了生命周期、请求、事件；AXTP 应该拆层 |
| `d`                                          | RPC `d`                            | 业务语义块                            |
| `requestId: string`                          | `id: uint32`                       | 你的改法更适合二进制                       |
| `requestType`                                | `method` / `methodId`              | 字符串方法名或注册表 ID                    |
| `requestData`                                | `params`                           | 请求参数                             |
| `responseData`                               | `result`                           | 成功返回                             |
| `requestStatus`                              | `error` 或 status object            | 错误/状态                            |
| `eventType`                                  | `event`                            | 事件名                              |
| `eventData`                                  | `data`                             | 事件数据                             |
| `eventSubscriptions`                         | `event.subscribe` / `stream.open`  | 低频事件走 RPC，高频数据走 STREAM           |
| `RequestBatch`                               | `BATCH_REQUEST`                    | 批量请求                             |
| `RequestBatchResponse`                       | `BATCH_RESPONSE`                   | 批量响应                             |

---

## 2. 生命周期映射

OBS-WebSocket 的连接流程是：

```text id="995otu"
WebSocket connected
  ↓
Hello
  ↓
Identify
  ↓
Identified
  ↓
Request / Event / Batch
```

官方文档也明确要求：WebSocket 升级后，服务端立即发送 `Hello`；客户端收到后发送 `Identify`；服务端处理后返回 `Identified`；在 `Identified` 前客户端不能发送其他消息。([GitHub][1])

AXTP 建议改成：

```text id="f8fuo3"
Physical connected
  ↓
CONTROL.OPEN
  ↓
CONTROL.ACCEPT
  ↓
TRANSPORT_READY
  ↓
RPC session.identify / event.subscribe / stream.open
  ↓
APP_READY
```

映射关系是：

| OBS 流程       | AXTP 流程                                             | 建议                                    |
| ------------ | --------------------------------------------------- | ------------------------------------- |
| `Hello`      | 不直接映射到 Control Hello                                | OBS Hello 是应用 RPC 层 hello，不是 AXTP 传输层 |
| `Identify`   | `session.identify`                                  | 客户端应用身份、版本、认证、订阅意图                    |
| `Identified` | `session.identify` response 或 `session.ready` event | 应用层 ready                             |
| `Reidentify` | `session.update` / `event.subscribe`                | 修改订阅或应用会话参数                           |

也就是说，AXTP 的：

```text id="aux6jt"
CONTROL.OPEN / ACCEPT
```

对应的是“传输会话打开”。

OBS 的：

```text id="ufz3li"
Hello / Identify / Identified
```

对应的是“应用 RPC 会话识别”。

这两者不要混成一层。

---

## 3. RPC 请求/响应映射

OBS 请求：

```json id="78runj"
{
  "op": 6,
  "d": {
    "requestType": "SetCurrentProgramScene",
    "requestId": "f819dcf0-89cc-11eb-8f0e-382c4ac93b9c",
    "requestData": {
      "sceneName": "Scene 12"
    }
  }
}
```

AXTP JSON RPC 建议：

```json id="hji2bq"
{
  "op": 1,
  "d": {
    "id": 1001,
    "method": "scene.setCurrentProgram",
    "params": {
      "sceneName": "Scene 12"
    }
  }
}
```

AXTP Binary RPC 可以是：

```text id="tk2p2h"
op        uint8   = REQUEST
id        uint32  = 1001
methodId  uint32  = scene.setCurrentProgram 的注册表 ID
params    bytes   = CBOR / MessagePack / TLV / Protobuf
```

OBS 响应：

```json id="to8bbi"
{
  "op": 7,
  "d": {
    "requestType": "SetCurrentProgramScene",
    "requestId": "f819dcf0-89cc-11eb-8f0e-382c4ac93b9c",
    "requestStatus": {
      "result": true,
      "code": 100
    }
  }
}
```

AXTP 响应：

```json id="0zgxat"
{
  "op": 2,
  "d": {
    "id": 1001,
    "result": {
      "ok": true
    }
  }
}
```

错误时：

```json id="ul0uow"
{
  "op": 2,
  "d": {
    "id": 1001,
    "error": {
      "code": 608,
      "message": "Invalid sceneName",
      "data": {
        "field": "sceneName"
      }
    }
  }
}
```

这里建议 AXTP 不再保留 `requestStatus.result + code + comment` 这种 OBS 风格，而是使用更接近 JSON-RPC/MCP 的：

```text id="fup1rb"
result
error.code
error.message
error.data
```

这样后期转 MCP 会更顺。

---

## 4. 事件映射

OBS 事件：

```json id="ipded8"
{
  "op": 5,
  "d": {
    "eventType": "StudioModeStateChanged",
    "eventIntent": 1,
    "eventData": {
      "studioModeEnabled": true
    }
  }
}
```

AXTP 低频事件：

```json id="ha77ju"
{
  "op": 3,
  "d": {
    "event": "studioMode.stateChanged",
    "data": {
      "enabled": true
    }
  }
}
```

OBS 通过 `eventSubscriptions` 位图做 PubSub，且高频事件默认不订阅，需要显式订阅。([GitHub][1])

AXTP 可以把它拆成两种：

```text id="wq72by"
低频状态事件：
  RPC EVENT

高频连续数据：
  RPC 控制 + STREAM 数据面
```

例如音量表、传感器采样、日志流、视频预览、OTA 分片，不建议都塞进 RPC EVENT。

---

## 5. Stream 映射：OBS 的“高频事件”应该映射成 AXTP 的 STREAM

OBS-WebSocket 本身没有单独的底层 stream data plane。它主要通过 `Event` 和事件订阅表达状态变化，某些高频事件需要显式订阅。AXTP 可以比 OBS 做得更干净：**RPC 负责开关和参数协商，STREAM 负责连续数据传输。**

推荐模型：

```text id="up9dw3"
RPC:
  stream.open
  stream.pause
  stream.resume
  stream.close
  stream.setOption

STREAM:
  streamId
  seq
  timestamp
  flags
  payload bytes
```

### 5.1 打开 stream

```json id="m2jzkr"
{
  "op": 1,
  "d": {
    "id": 2001,
    "method": "stream.open",
    "params": {
      "source": "camera.preview",
      "format": "h264",
      "maxChunkSize": 1200,
      "rate": {
        "fps": 30
      }
    }
  }
}
```

响应：

```json id="wtsfjm"
{
  "op": 2,
  "d": {
    "id": 2001,
    "result": {
      "streamId": 17,
      "format": "h264",
      "chunkSize": 1024,
      "timebase": "us"
    }
  }
}
```

### 5.2 传输 stream 数据

AXTP Frame：

```text id="fnzd8x"
PayloadType = STREAM
```

STREAM Payload：

```text id="2o7qw0"
streamId   uint32
seq        uint32
timestamp  uint64
flags      uint16
length     uint16 / uint32
data       bytes
```

### 5.3 关闭 stream

```json id="gjtnkh"
{
  "op": 1,
  "d": {
    "id": 2002,
    "method": "stream.close",
    "params": {
      "streamId": 17,
      "reason": "client_stop"
    }
  }
}
```

响应：

```json id="8qmk96"
{
  "op": 2,
  "d": {
    "id": 2002,
    "result": {
      "closed": true
    }
  }
}
```

这套比 OBS 的高频事件机制更适合设备协议，因为它明确区分了：

```text id="u0l1ov"
控制面：RPC
数据面：STREAM
```

---

## 6. OBS Batch 映射

OBS 的 `RequestBatch` 是 `op=8`，其中包括 `requestId`、`haltOnFailure`、`executionType`、`requests` 数组；服务端用 `RequestBatchResponse` 返回结果。([GitHub][1])

AXTP 可以这样映射：

```json id="00u0z0"
{
  "op": 4,
  "d": {
    "id": 3001,
    "haltOnFailure": true,
    "execution": "serial",
    "requests": [
      {
        "method": "display.setBrightness",
        "params": {
          "value": 80
        }
      },
      {
        "method": "display.setContent",
        "params": {
          "content": "hello"
        }
      }
    ]
  }
}
```

响应：

```json id="7qry0g"
{
  "op": 5,
  "d": {
    "id": 3001,
    "results": [
      {
        "result": {
          "ok": true
        }
      },
      {
        "result": {
          "ok": true
        }
      }
    ]
  }
}
```

Binary RPC 里可以把每个 method 映射成 `methodId:uint32`，这样比字符串更省。

---

## 7. 推荐的 AXTP RPC op 表

我建议不要照搬 OBS 的 opcode 数值，而是保留你自己的语义：

```text id="vhngfk"
0x01 REQUEST
0x02 RESPONSE
0x03 EVENT
0x04 BATCH_REQUEST
0x05 BATCH_RESPONSE
0x06 CANCEL
0x07 PROGRESS
```

应用生命周期不要放进 opcode：

```text id="khhswl"
session.identify
session.update
event.subscribe
stream.open
stream.close
```

这样比 OBS 更规整。

OBS 的：

```text id="9wjoy7"
Hello
Identify
Identified
Reidentify
```

在 AXTP 中变成普通 RPC 方法或响应：

```text id="7xy64m"
session.identify
session.update
event.subscribe
```

OBS 的：

```text id="3558o2"
Request
RequestResponse
Event
RequestBatch
RequestBatchResponse
```

映射成 AXTP RPC op：

```text id="faynsj"
REQUEST
RESPONSE
EVENT
BATCH_REQUEST
BATCH_RESPONSE
```

---

## 8. Stream 场景对照表

| 场景         | OBS-WebSocket 做法                             | AXTP 推荐做法                               |
| ---------- | -------------------------------------------- | --------------------------------------- |
| 普通控制命令     | `Request`                                    | `RPC REQUEST`                           |
| 普通状态返回     | `RequestResponse`                            | `RPC RESPONSE`                          |
| 低频状态变化     | `Event`                                      | `RPC EVENT`                             |
| 事件订阅       | `Identify.eventSubscriptions` / `Reidentify` | `event.subscribe` / `event.unsubscribe` |
| 高频传感器数据    | 高容量 Event，需显式订阅                              | `stream.open` + `STREAM` payload        |
| 日志流        | 可用 Event，但不理想                                | `stream.open(source=log)` + `STREAM`    |
| OTA / 文件传输 | OBS 不适合                                      | `stream.open(kind=ota/file)` + `STREAM` |
| 视频/音频预览    | OBS WebSocket 不负责原始媒体流                       | `STREAM` payload                        |
| 批量控制       | `RequestBatch`                               | `BATCH_REQUEST`                         |
| 修改订阅       | `Reidentify`                                 | `event.subscribe` / `stream.setOption`  |

---

## 9. 一个完整的 OBS → AXTP 映射例子

### OBS 风格

```json id="10aspi"
{
  "op": 6,
  "d": {
    "requestType": "StartPreviewStream",
    "requestId": "abc",
    "requestData": {
      "source": "camera",
      "format": "h264"
    }
  }
}
```

### AXTP RPC 控制面

```json id="gytwr1"
{
  "op": 1,
  "d": {
    "id": 4001,
    "method": "stream.open",
    "params": {
      "source": "camera",
      "kind": "video.preview",
      "format": "h264"
    }
  }
}
```

响应：

```json id="2dso8u"
{
  "op": 2,
  "d": {
    "id": 4001,
    "result": {
      "streamId": 12,
      "format": "h264",
      "chunkSize": 1024
    }
  }
}
```

### AXTP STREAM 数据面

```text id="gpuy8l"
Frame {
  payloadType = STREAM
  payload = {
    streamId = 12
    seq = 1
    timestamp = 123456789
    flags = KEY_FRAME
    data = ...
  }
}
```

这就是最核心的映射原则：

```text id="6d2coa"
OBS 把控制、事件、高频数据倾向都放在 WebSocket RPC op+d 里；
AXTP 应该把控制留在 RPC，把连续数据迁移到 STREAM。
```

---

## 10. 最终建议

你现在这套协议可以这样对照 OBS-WebSocket：

```text id="nx069j"
OBS op+d envelope
  → AXTP RPC op+d envelope

OBS requestType/requestData
  → AXTP method/params

OBS requestId:string
  → AXTP id:uint32

OBS requestStatus/responseData
  → AXTP error/result

OBS Event
  → AXTP RPC EVENT

OBS high-volume Event
  → AXTP stream.open + STREAM data plane

OBS Hello/Identify/Identified
  → AXTP CONTROL.OPEN/ACCEPT + RPC session.identify
```

最重要的一句话是：

```text id="s15v8e"
AXTP 可以吸收 OBS-WebSocket 的 op+d 结构，但不要继承它把应用生命周期、事件订阅和高频数据都堆在 RPC 层里的做法；AXTP 应该用 RPC 管控制，用 STREAM 管连续数据。
```

[1]: https://raw.githubusercontent.com/obsproject/obs-websocket/master/docs/generated/protocol.md "raw.githubusercontent.com"
