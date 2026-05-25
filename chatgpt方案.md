我建议做一个明确的架构裁决：

**AXTP / UFTP 的 Frame 层 `CONTROL.HELLO / HELLO_ACK` 保留为唯一的“连接级握手”；DS-JSONRPC 层不再定义 `op=HELLO / HELLO_ACK` 作为正式协议流程，只保留为兼容模式或改名为应用层 `session.identify`。**

这样代码里只需要一套连接状态机，不会出现“Frame 层 hello 已经 ready，但 JSONRPC 层 hello 还没 ready”的双状态问题。

---

## 1. 现在问题的本质

你现在遇到的不是“两个 hello 名字冲突”这么简单，而是 **两个层级都在试图管理 session 生命周期**。

目前设计里，Frame 层已经有：

```text
CONTROL.HELLO
CONTROL.HELLO_ACK
CONTROL.HEARTBEAT
CONTROL.RESUME
CONTROL.CLOSE
```

它负责连接建立、恢复、关闭、心跳、分片、压缩、加密、payload 类型协商等 transport runtime 行为。前面协议草案里也已经明确：`CONTROL` 属于 `Transport Runtime`，不是业务协议；`PayloadType` 只负责选择 parser，不表达业务语义。

而 DS-JSONRPC 层的 `op=hello/helloack`，本质上更像 OBS-WebSocket 的应用会话握手：告诉对方“我是哪个 RPC 协议版本、支持哪些请求、事件、认证方式”。这就开始和 Frame 层抢生命周期控制权。

所以如果两套都保留，代码会变成：

```text
TransportSessionState
  CONNECTED
  CONTROL_HELLO_SENT
  CONTROL_READY

JsonRpcSessionState
  JSONRPC_HELLO_SENT
  JSONRPC_READY

BusinessState
  IDENTIFIED
  AUTHENTICATED
```

这会非常别扭，而且不同传输方式还会出现各种例外。

---

## 2. 推荐分层：一个连接握手，两个能力阶段

应该拆成两类东西：

| 阶段                   | 归属                   |             是否必须 | 作用                                                     |
| -------------------- | -------------------- | ---------------: | ------------------------------------------------------ |
| Transport Handshake  | AXTP Frame / CONTROL | 必须，Framed Mode 下 | 建立 AXTP 会话、协商 frame/profile/payload/parser/分片/压缩/加密/心跳 |
| Application Identify | RPC 层 method         |         可选或按业务要求 | 识别客户端/设备、认证、业务能力、method/event/capability registry      |

也就是说：

```text
CONTROL.HELLO       = 连接级握手
session.identify    = 应用级识别
capability.get      = 业务能力查询
auth.login / auth.challenge = 应用认证
```

不要再让 JSONRPC 自己也拥有 `hello/helloack` 生命周期。

---

## 3. 正式流程建议

### Framed Mode：HID / BLE / UART / TCP / WebSocket Binary

这是 AXTP 的主流程：

```text
Transport Connected
    ↓
AXTP CONTROL.HELLO
    ↓
AXTP CONTROL.HELLO_ACK
    ↓
TRANSPORT_READY
    ↓
RPC_JSON / RPC_BINARY: session.identify   可选
    ↓
APP_READY
```

`CONTROL.HELLO` 只协商传输和解析能力，例如：

```json
{
  "axtpVersion": "1.0",
  "headerProfile": ["standard", "compact"],
  "payloadTypes": ["RPC_JSON", "RPC_BINARY", "RAW_BINARY"],
  "maxFrameSize": 4096,
  "fragment": true,
  "compression": ["none", "zstd"],
  "encryption": ["none", "tls", "noise"],
  "heartbeatIntervalMs": 30000,
  "resume": true
}
```

`CONTROL.HELLO_ACK` 返回实际选择结果：

```json
{
  "sessionId": "s-001",
  "axtpVersion": "1.0",
  "headerProfile": "standard",
  "payloadTypes": ["RPC_JSON", "RPC_BINARY", "RAW_BINARY"],
  "maxFrameSize": 2048,
  "compression": "none",
  "encryption": "none",
  "heartbeatIntervalMs": 30000
}
```

然后业务层再走普通 RPC：

```json
{
  "op": 1,
  "id": "req-001",
  "method": "session.identify",
  "params": {
    "clientName": "desktop-app",
    "clientVersion": "1.2.0",
    "schemaVersion": "2026.05",
    "wantCapabilities": true
  }
}
```

这样非常清楚：**CONTROL 管链路，RPC 管业务。**

---

## 4. DS-JSONRPC 的 `hello/helloack` 应该怎么处理

我建议直接做三条规则。

### 规则一：正式 DS-JSONRPC 不再定义 `op=HELLO / HELLO_ACK`

DS-JSONRPC 的 `op` 只保留 RPC 语义：

```text
REQUEST
RESPONSE
EVENT
BATCH_REQUEST
BATCH_RESPONSE
```

这和你之前的 Binary RPC 映射更一致：Binary RPC 只是 JSON RPC 的低带宽表达，`rpcOp` 用来描述请求、响应、事件、批量等 RPC 语义，不应该再承担 transport handshake。

推荐 op 表：

```text
0x01 REQUEST
0x02 RESPONSE
0x03 EVENT
0x04 BATCH_REQUEST
0x05 BATCH_RESPONSE
```

不要再放：

```text
0x00 HELLO
0x01 HELLO_ACK
```

否则 RPC 层又变成 session 层。

---

### 规则二：OBS-WebSocket 风格 hello 只作为 Legacy / Unframed 兼容

如果你想保留类似 OBS-WebSocket 的体验，可以把它放进兼容章节：

```text
Legacy DS-JSONRPC Unframed Mode
```

适用于：

```text
WebSocket Text
HTTP debug
浏览器调试工具
不带 AXTP Frame 的纯 JSON 通道
```

在这个模式下，因为没有 AXTP Frame，也没有 `CONTROL` payload，所以可以允许：

```text
DS-JSONRPC HELLO
DS-JSONRPC IDENTIFY
DS-JSONRPC IDENTIFIED
```

但这不是 AXTP 主流程，而是一个 adapter。

协议内部可以这样映射：

```text
Legacy JSONRPC Hello
    ↓
构造 TransportContext
    ↓
标记为 TRANSPORT_READY
    ↓
进入普通 RPC Dispatcher
```

也就是说，兼容层可以存在，但核心代码不要同时跑两套 hello。

---

### 规则三：Framed Mode 下收到 JSONRPC hello，要么拒绝，要么兼容映射

建议规范写清楚：

```text
在 AXTP Framed Mode 下，CONTROL.HELLO/HELLO_ACK 是唯一合法的连接级握手。
在 TRANSPORT_READY 之前，除 CONTROL 外的 PayloadType 一律拒绝。
在 TRANSPORT_READY 之后，DS-JSONRPC op=HELLO 被视为 legacy alias，可映射为 session.identify，或者返回 deprecated error。
```

推荐行为：

| 场景                                              | 行为                                      |
| ----------------------------------------------- | --------------------------------------- |
| Framed Mode 下，CONTROL 未 ready，收到 RPC_JSON hello | 返回协议错误或断开                               |
| Framed Mode 下，CONTROL 已 ready，收到 RPC_JSON hello | 兼容映射到 `session.identify`，并告警 deprecated |
| Unframed Mode 下，收到 RPC_JSON hello               | 允许，走 legacy adapter                     |
| 新实现                                             | 不发送 RPC hello，只发送 `session.identify`    |

---

## 5. 字段归属建议

这一点很关键，不然后面还会继续混。

| 字段 / 能力                          | 放在哪里                                  | 原因               |
| -------------------------------- | ------------------------------------- | ---------------- |
| AXTP version                     | CONTROL.HELLO                         | 影响 Frame 解析      |
| Header profile                   | CONTROL.HELLO                         | 影响 Header layout |
| PayloadType 支持列表                 | CONTROL.HELLO                         | 影响 parser 分发     |
| maxFrameSize / MTU               | CONTROL.HELLO                         | 影响分片             |
| Fragment / ACK / CRC             | CONTROL.HELLO                         | transport 行为     |
| Compression / Encryption         | CONTROL.HELLO                         | transport 行为     |
| Heartbeat interval               | CONTROL.HELLO                         | session runtime  |
| Resume token                     | CONTROL.HELLO / RESUME                | 连接恢复             |
| RPC schema version               | `session.identify` 或 `rpc.getSchema`  | RPC 层能力          |
| method registry version          | `session.identify` / `capability.get` | 业务能力             |
| event registry version           | `session.identify` / `capability.get` | 业务能力             |
| device model / firmware / serial | `device.getInfo` 或 `session.identify` | 业务/设备信息          |
| auth challenge / token           | `auth.*` 或 `session.identify`         | 应用授权，不是 frame 解析 |
| subscribe event                  | `event.subscribe`                     | 业务事件             |

你之前的草案里也已经有一个正确方向：HELLO 协商 `Version / PayloadType / Encoding / Compression / Encryption / Fragment`，但不协商业务能力，业务能力属于 Business Layer 而不是 Transport Layer。

---

## 6. 代码实现模型

代码上建议只有一个主状态机：

```text
TransportSession
  DISCONNECTED
  CONNECTED
  NEGOTIATING
  TRANSPORT_READY
  CLOSING
  CLOSED
```

RPC 层不要再维护 `JSONRPC_HELLO_READY` 这种状态。RPC 层只依赖：

```text
transportSession.isReady()
```

伪代码大概是：

```ts
function onFrame(frame) {
  switch (frame.payloadType) {
    case CONTROL:
      controlRuntime.handle(frame.payload)
      return

    case RPC_JSON:
    case RPC_BINARY:
      if (!transportSession.isReady()) {
        throw ProtocolError("SESSION_NOT_READY")
      }
      rpcDispatcher.handle(frame.payload)
      return

    case RAW_BINARY:
      if (!transportSession.isReady()) {
        throw ProtocolError("SESSION_NOT_READY")
      }
      rawBinaryDispatcher.handle(frame.payload)
      return
  }
}
```

RPC 层这样处理：

```ts
function onRpcMessage(msg) {
  switch (msg.op) {
    case REQUEST:
      dispatchMethod(msg.method, msg.params)
      return

    case RESPONSE:
      matchPendingRequest(msg.id)
      return

    case EVENT:
      dispatchEvent(msg.event)
      return
  }
}
```

不要出现：

```ts
case HELLO:
case HELLO_ACK:
```

除非在 legacy adapter 里。

---

## 7. 我建议最终文档怎么改

可以在 AXTP 仓库里做一次规范性收敛：

```text
01-core-protocol
  明确 CONTROL.HELLO 是唯一 Framed Mode 连接握手

02-type-system / ds-jsonrpc
  删除正式 op=HELLO / HELLO_ACK
  op 只保留 REQUEST / RESPONSE / EVENT / BATCH

04-compatibility
  增加 Legacy OBS-like JSONRPC Handshake Adapter
  说明它只适用于 Unframed WebSocket Text / Debug

05-demo
  Framed demo 全部改为：
    CONTROL.HELLO
    CONTROL.HELLO_ACK
    RPC session.identify
    RPC normal requests

ds-jsonrpc 文档
  把 hello/helloack 改为：
    session.identify
    session.identified 或普通 response
```

最终应该形成这句话：

```text
AXTP has one transport handshake: CONTROL.HELLO / CONTROL.HELLO_ACK.
RPC layer does not own transport lifecycle.
Application identity and capability discovery are normal RPC methods.
Legacy JSON-RPC hello is only an unframed compatibility adapter.
```

---

我的结论很明确：**不要保留两套平级 hello。保留 Frame 层 CONTROL hello 作为唯一连接级握手；把 DS-JSONRPC hello 降级为兼容模式，正式协议中改成 `session.identify` / `capability.get` 这类普通 RPC 方法。**

这样分层最干净，代码实现也最自然。
