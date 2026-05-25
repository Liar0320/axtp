# 05《AXTP 连接场景与调用流程规范》

版本：v0.1 Draft
状态：MVP 场景参考规范
适用范围：AXTP 在不同传输层和拓扑组合下的完整调用流程、Profile 选择、Session 生命周期、错误处理
前置文档：01《AXTP 整体协议规范》、02《AXTP Control 信令协议规范》、03《AXTP RPC 协议与二进制映射规范》、04《AXTP Stream 流式传输协议规范》

---

## 1. 文档目的

本文档回答一个具体问题：**在不同的连接组合下，AXTP 的完整调用流程是什么？**

协议规范文档（01-04）定义了每一层的字段和语义，但没有把它们串联成端到端的场景。本文档补充这一部分，覆盖以下维度：

```text
传输层类型：TCP / WebSocket Binary / USB HID / BLE / UART
拓扑结构：直连 / 网关中继 / 多设备路由
客户端类型：Native App / 浏览器 / 调试工具 / 老协议客户端
Header Profile：Standard / Compact
数据类型：纯 RPC / RPC + STREAM / 老协议透传
```

每个场景包含：

```text
1. 拓扑图
2. Profile 选择理由
3. 完整调用流程（Session 建立 → 业务 → 关闭）
4. 错误与重连处理
5. 关键约束与注意事项
```

---

## 1.1 架构裁决

综合 AXTP 当前 Frame 设计、WebSocket STREAM 需求、以及外部方案评审，本文档采用以下裁决：

```text
AXTP v1 只有一条正式生产路径：
  AXTP Framed Mode
  PayloadType = CONTROL / RPC / STREAM
  WebSocket Binary / TCP / USB Bulk 使用 Standard Profile
  HID / BLE / UART 使用 Compact Profile

WebSocket Text / HTTP JSON 只作为 Debug 或 Legacy Adapter：
  不承载正式 STREAM
  不参与 CONTROL ACK/NACK / RESUME
  不作为生产客户端必须实现的协议路径
```

这意味着 WebSocket 场景并不牺牲 STREAM 能力。正式 WebSocket 客户端应使用：

```text
WebSocket Binary
  -> AXTP Standard Frame
  -> CONTROL OPEN / ACCEPT
  -> RPC session.challenge / session.identify / session.identified
  -> RPC capability.getAll
  -> RPC stream.open
  -> STREAM data
```

DS-RPC / JSON Text 的定位是：

```text
curl / Postman / DevTools / 简单管理后台
Legacy JSON-RPC 工具兼容
人工排查问题
```

它不是 AXTP 的第二套生产状态机。实现上应优先完成：

```text
FramedCodec + ControlRuntime + RpcRuntime + StreamRuntime
```

然后按需增加：

```text
DsRpcDebugAdapter -> 映射到同一个 RpcRuntime
```

---

## 2. 场景总览

| 场景 | 传输层 | Profile | 拓扑 | 典型用途 |
| --- | --- | --- | --- | --- |
| A | TCP | Standard | 直连 | PC App ↔ 设备 |
| B | WebSocket Binary | Standard | 直连 | Web App / Native App ↔ 设备 |
| C | USB HID | Compact | 直连 | PC ↔ USB 设备 |
| D | BLE GATT | Compact | 直连 | 手机 ↔ 蓝牙设备（含断线重连） |
| E | UART + COBS | Compact | 直连 | MCU ↔ 主控 |
| F | WebSocket Binary → BLE/HID | Standard + Compact | 网关中继 | App ↔ 网关 ↔ 设备 |
| G | WebSocket Binary（多设备路由） | Standard | 多设备 | App ↔ 网关 ↔ 多台设备 |
| H | WebSocket Text（DS-RPC Debug Adapter） | Unframed | 调试 / Legacy | 浏览器 / curl ↔ 设备 |
| I | 老协议适配 | Standard / Compact | 适配层 | 旧客户端 ↔ AXTP 适配器 ↔ 设备 |

---

## 3. 通用约定

### 3.1 流程图符号

```text
──→   单向消息发送
←──   单向消息接收
[State: XXX]   连接状态变更
(底层拦截)     由 Framer/Transport 层处理，不上报业务层
(路由到业务层) 由 RPC Router 分发到业务处理函数
```

### 3.2 Frame 表示方式

流程图中的 Frame 简写格式：

```text
[Standard Frame] Magic=AX Ver=1 PT=0x01 Len=N SrcId=X DstId=Y MsgId=M FrIdx=I FrCnt=C CRC16
[Compact Frame]  VT=0xXX Len=N MsgId=M FrameInfo=0xXX CRC8
```

- `PT`：PayloadType（0x01=CONTROL, 0x02=RPC, 0x03=STREAM）
- `VT`：Version(4bit) + PayloadType(4bit) 合并字节（Compact 专用）
- `FrIdx/FrCnt`：分片索引 / 分片总数（从 0 开始）

### 3.3 统一连接状态机

每个正式 AXTP Framed Session 维护一个四状态机。**RPC 层不拥有独立的传输 Session 状态**，只查询 `session.isReady()`。

```text
DISCONNECTED
    │  传输层连接建立（TCP Accept / BLE Connect / HID Attach）
    ▼
LINK_CONNECTED
    │  CONTROL OPEN / ACCEPT 完成（Framed Mode）
    │  Debug Adapter 可在 WebSocket Text 升级后隐式跳过
    ▼
FRAMING_READY
    │  RPC session.challenge / session.identify / session.identified 三步完成
    │  或设备为免鉴权模式（authRequired=false，直接进入）
    ▼
APP_READY
```

各状态下允许的操作：

| 状态 | 允许的操作 | 拒绝的操作 |
| --- | --- | --- |
| LINK_CONNECTED | 仅 CONTROL 包（OPEN） | 所有 RPC / STREAM |
| FRAMING_READY | `session.challenge`（Server 推送）、`session.identify`（Client 发送）、`capability.getAll`（无鉴权方法） | 需要鉴权的业务 RPC |
| APP_READY | 所有已注册 RPC 和 STREAM | — |

**WebSocket Text / HTTP JSON Debug Adapter**：WebSocket 升级或 HTTP 认证完成后可直接构造 Debug TransportContext，进入 FRAMING_READY。该捷径只适用于 Debug/Legacy Adapter，不适用于正式生产连接。

### 3.4 CONTROL 与 RPC 的职责边界

两个握手阶段负责完全不同的生命周期，**不得混用**：

| 字段 / 能力 | 归属 | 原因 |
| --- | --- | --- |
| AXTP 协议版本 | `CONTROL OPEN` | 影响 Frame 解析 |
| Header Profile（Standard/Compact） | `CONTROL OPEN` | 影响 Header 布局 |
| maxFrameSize / MTU | `CONTROL OPEN` | 影响分片策略 |
| 支持的 PayloadType 列表 | `CONTROL OPEN` | 影响 Parser 分发 |
| rpcEncoding（JSON/BINARY/TLV） | `CONTROL OPEN` | 影响 RPC 解码器选择 |
| 压缩 / 加密协商 | `CONTROL OPEN` | Transport 行为 |
| 心跳间隔 | `CONTROL OPEN` | Session Runtime |
| resumeToken | `CONTROL OPEN / RESUME` | 连接恢复 |
| challengeString / authRequired / rpcVersion | `session.challenge`（Server→Client EVENT） | Server 主动推送，触发 Client 鉴权流程 |
| 客户端名称 / 版本 / authResponse | `session.identify`（Client→Server REQUEST） | 业务身份 + 鉴权凭据，不影响帧解析 |
| negotiatedRpcVersion | `session.identified`（Server→Client EVENT） | Server 确认鉴权通过，进入 APP_READY |
| 设备型号 / 固件版本 | `device.getInfo` | 业务信息 |
| 能力列表 | `capability.getAll` | 业务能力查询 |
| 事件订阅 | `event.subscribe` | 业务事件 |

> **关于 DS-RPC `op=Hello/HelloAck`**：这是 Debug/Legacy Adapter 的兼容字段。在 Framed Mode 下，新实现不得发送 `op=Hello/HelloAck`；如果收到，可映射为 `session.identify` 并返回 deprecated 警告。正式 RPC 语义只保留：`REQUEST / RESPONSE / EVENT / BATCH_REQUEST / BATCH_RESPONSE`。

### 3.5 业务流程通用顺序

所有场景共享以下骨架流程，各阶段是否执行取决于传输层和业务需求：

```text
① 传输层连接建立
        │
② CONTROL OPEN / ACCEPT          ← 正式 Framed Mode 必须；Debug Adapter 可跳过
        │  [State: FRAMING_READY]
③ RPC EVENT session.challenge     ← Server 主动推送（含 challengeString / authRequired）
④ RPC REQUEST session.identify    ← Client 回应（含 clientName / authResponse）
⑤ RPC EVENT session.identified   ← Server 确认（含 negotiatedRpcVersion）
        │  [State: APP_READY]
⑥ RPC capability.getAll              ← 推荐：获取设备能力列表
⑦ RPC device.getInfo                 ← 推荐：获取设备基本信息
        │
⑧ 业务 RPC（brightness.set / camera.setZoom / ...）
⑨ STREAM 数据流（OTA / 视频 / 文件）  ← 需要先通过 RPC 建立 Stream Context
        │
⑩ CONTROL HEARTBEAT（周期性）         ← 按协商的 heartbeatIntervalMs 发送
⑪ CONTROL CLOSE / 传输层断开
```

---

## 4. 场景 A：TCP 直连（Standard Profile）

### 4.1 拓扑

```text
+----------+          TCP Socket          +----------+
|  PC App  | ←─────────────────────────→ |  Device  |
+----------+                             +----------+
  Client                                   Server
  SrcId=0x01                               SrcId=0x10
```

PC App 作为 Client 主动发起 TCP 连接，Device 作为 Server 监听端口。

### 4.2 Profile 选择

| 项目 | 选择 | 理由 |
| --- | --- | --- |
| Header Profile | Standard | TCP 带宽充足，需要 SourceId/DestinationId 路由字段，Magic 用于字节流失步恢复 |
| PayloadLength | uint16（最大 65535B） | TCP 单帧可承载大 Payload |
| CRC | CRC16-CCITT-FALSE | Standard Profile 固定算法 |
| rpcEncoding | BINARY + TLV | 生产路径推荐；JSON 可选用于调试 |
| ackMode | NO_ACK（MVP） | TCP 保证可靠传输，Frame 层不需要额外 ACK |

### 4.3 完整调用流程

#### 阶段 A-1：TCP 连接建立

```text
Client                                    Server
  |                                          |
  |──── TCP SYN ────────────────────────────→|
  |←─── TCP SYN-ACK ────────────────────────|
  |──── TCP ACK ────────────────────────────→|
  |                                          |
  [TCP Connected]
```

#### 阶段 A-2：AXTP Session 建立

```text
Client                                    Server
  |                                          |
  |──── CONTROL OPEN ──────────────────────→|
  |     [Standard Frame]                     |
  |     Magic=AX Ver=1 PT=0x01               |
  |     Len=N SrcId=0x01 DstId=0x10          |
  |     MsgId=0x0001 FrIdx=0 FrCnt=1         |
  |     opcode=OPEN                         |
  |     body: protocolVersion=1              |
  |           headerProfile=STANDARD         |
  |           maxFrameSize=4096              |
  |           mtu=1460                       |
  |           supportedPayloadTypes=0x07     |
  |           supportedRpcEncodings=0x03     |
  |           heartbeatIntervalMs=30000      |
  |           ackMode=NO_ACK                 |
  |     CRC16=0xXXXX                         |
  |                                          |
  |←─── CONTROL ACCEPT ──────────────────|
  |     opcode=ACCEPT                     |
  |     body: sessionId=0x12345678           |
  |           protocolVersion=1              |
  |           headerProfile=STANDARD         |
  |           maxFrameSize=4096              |
  |           selectedRpcEncoding=BINARY     |
  |           heartbeatIntervalMs=30000      |
  |           ackMode=NO_ACK                 |
  |           resumeToken=<token>            |
  |                                          |
  [State: FRAMING_READY]
  (sessionId=0x12345678 写入双方 Session Context)
  (后续所有帧不再携带 sessionId)
```

#### 阶段 A-3：应用层身份认证（Challenge / Identify / Identified）

仿照 obs-websocket 的三步握手。Server 在 ACCEPT 后主动推送 Challenge，Client 回应 Identify，Server 确认 Identified。

```text
Client                                    Server
  |                                          |
  |←─── RPC EVENT session.challenge ────────| (Server 主动推送)
  |     PT=0x02 rpcEncoding=BINARY           |
  |     rpcOp=EVENT                          |
  |     eventId=session.challenge            |
  |     body: challengeString="<random>"     |
  |           authRequired=true              |
  |           rpcVersion="2026.05"           |
  |                                          |
  |──── RPC REQUEST session.identify ───────→| (路由到业务层)
  |     rpcOp=REQUEST requestId=0x00000002   |
  |     methodId=session.identify            |
  |     body: clientName="desktop-app"       |
  |           clientVersion="1.2.0"          |
  |           rpcVersion="2026.05"           |
  |           authResponse="<hmac-sha256>"   | ← 无密码时省略
  |                                          |
  |←─── RPC EVENT session.identified ───────| (Server 确认)
  |     rpcOp=EVENT                          |
  |     eventId=session.identified           |
  |     body: negotiatedRpcVersion="2026.05" |
  |                                          |
  [State: APP_READY]
```

> 如果设备为免鉴权模式（如普通鼠标），Server 推送的 `session.challenge` 中 `authRequired=false`，Client 发送 `session.identify` 时省略 `authResponse` 字段，Server 直接回 `session.identified`。

#### 阶段 A-4：能力查询与设备信息

```text
Client                                    Server
  |                                          |
  |──── RPC REQUEST capability.getAll ──────→|
  |     PT=0x02 rpcEncoding=BINARY           |
  |     rpcOp=REQUEST requestId=0x00000001   |
  |     methodId=capability.getAll           |
  |                                          |
  |←─── RPC RESPONSE capability.getAll ─────|
  |     rpcOp=RESPONSE requestId=0x00000001  |
  |     flags=SUCCESS|HAS_BODY               |
  |     body: capabilities=[                 |
  |       {domain:"device", methods:[...]},  |
  |       {domain:"brightness", ...},        |
  |       {domain:"firmware", ...}           |
  |     ]                                    |
  |                                          |
  |──── RPC REQUEST device.getInfo ─────────→|
  |     requestId=0x00000002                 |
  |                                          |
  |←─── RPC RESPONSE device.getInfo ────────|
  |     body: deviceId="screen-001"          |
  |           firmwareVersion="2.1.0"        |
  |           model="AX-Display-Pro"         |
```

#### 阶段 A-5：业务 RPC（亮度控制）

```text
Client                                    Server
  |                                          |
  |──── RPC REQUEST brightness.set ─────────→|
  |     requestId=0x00000003                 |
  |     body: value=80 (TLV)                 |
  |                                          |
  |←─── RPC RESPONSE brightness.set ────────|
  |     flags=SUCCESS                        |
  |     statusCode=SUCCESS(0x0064)           |
  |                                          |
  |←─── RPC EVENT brightness.changed ───────|
  |     rpcOp=EVENT requestId=0x00000000     |
  |     eventId=brightness.changed           |
  |     body: value=80 previousValue=60      |
```

#### 阶段 A-6：OTA 固件升级（RPC + STREAM）

```text
Client                                    Server
  |                                          |
  |──── RPC REQUEST firmware.begin ─────────→|
  |     requestId=0x00000004                 |
  |     body: totalSize=1048576              |
  |           hashAlgo=sha256                |
  |           hash="abc123..."               |
  |           chunkSize=4096                 |
  |                                          |
  |←─── RPC RESPONSE firmware.begin ────────|
  |     flags=SUCCESS|HAS_BODY               |
  |     body: streamId=0x00000009            |
  |           ackMode=STOP_AND_WAIT          |
  |                                          |
  [Stream Context OPEN: streamId=0x00000009]
  |                                          |
  |──── STREAM chunk #0 ────────────────────→|
  |     PT=0x03                              |
  |     streamId=0x00000009 seqId=0          |
  |     cursor=0 data=[4096B]                |
  |                                          |
  |←─── CONTROL ACK ────────────────────────|
  |     targetType=STREAM_CHUNK              |
  |     streamId=0x00000009 seqId=0          |
  |                                          |
  |──── STREAM chunk #1 ────────────────────→|
  |     seqId=1 cursor=4096 data=[4096B]     |
  |                                          |
  |←─── CONTROL ACK ────────────────────────|
  |     seqId=1                              |
  |                                          |
  ... (重复直到所有 chunk 发送完毕)
  |                                          |
  |──── RPC REQUEST firmware.verify ────────→|
  |     requestId=0x00000005                 |
  |     body: streamId=0x00000009            |
  |                                          |
  |←─── RPC RESPONSE firmware.verify ───────|
  |     flags=SUCCESS                        |
  |                                          |
  |←─── RPC EVENT firmware.updateCompleted ─|
  |     eventId=firmware.updateCompleted     |
  |     body: version="2.2.0"               |
  |                                          |
  [Stream Context CLOSED: streamId=0x00000009]
```

#### 阶段 A-7：心跳保活

```text
Client                                    Server
  |                                          |
  |──── CONTROL HEARTBEAT ──────────────────→|
  |     opcode=HEARTBEAT                     |
  |     body: timestamp=1716624000000        |
  |                                          |
  |←─── CONTROL HEARTBEAT_ACK ──────────────|
  |     body: timestamp=1716624000000        |
  |           serverTimestamp=1716624000005  |
```

心跳间隔由 OPEN 协商（此例 30s）。超过 3 个心跳周期无响应则视为连接断开。

#### 阶段 A-8：正常关闭

```text
Client                                    Server
  |                                          |
  |──── CONTROL CLOSE ──────────────────────→|
  |     opcode=CLOSE                         |
  |     body: reason=NORMAL_CLOSE            |
  |                                          |
  |←─── CONTROL CLOSE_ACK ──────────────────|
  |                                          |
  [TCP FIN / RST]
  [SESSION_CLOSED]
```

### 4.4 错误处理

| 错误场景 | 处理方式 |
| --- | --- |
| CRC 校验失败 | 接收方发送 CONTROL NACK(CRC_ERROR)，发送方重传或关闭连接 |
| RPC 方法不存在 | Server 返回 RPC RESPONSE flags=ERROR statusCode=RPC_METHOD_NOT_FOUND |
| STREAM chunk 丢失 | Server 发送 CONTROL NACK(STREAM_CHUNK_MISSING)，Client 重传对应 seqId |
| TCP 连接断开 | 重新建立 TCP 连接，重新执行 OPEN 握手（TCP 无 RESUME 语义） |
| CONNECT 版本不兼容 | Server 返回 ACCEPT flags=ERROR statusCode=VERSION_MISMATCH，关闭连接 |

### 4.5 关键约束

```text
1. TCP 是字节流，接收方必须按 Magic(2B) + Header(10B) + PayloadLength + CRC(2B) 重组 Frame；
2. 不得假设一次 TCP recv() 恰好包含一个完整 Frame；
3. STREAM 数据必须在 firmware.begin 返回 streamId 后才能发送；
4. OTA 期间不建议并发其他 STREAM，RPC 可以并发；
5. TCP 断线后不支持 RESUME，必须重新 OPEN 握手。
```

---

## 5. 场景 B：WebSocket Binary 直连（Standard Profile）

### 5.1 拓扑

```text
+----------+     WebSocket Binary (ws://)    +----------+
|  App     | ←──────────────────────────────→|  Device  |
+----------+                                 +----------+
  Client                                       Server
  SrcId=0x01                                   SrcId=0x10
```

WebSocket 提供消息边界，每个 WebSocket Binary Message 承载一个 AXTP Frame（MVP 推荐）。

### 5.2 与场景 A 的差异

| 项目 | TCP（场景 A） | WebSocket Binary（场景 B） |
| --- | --- | --- |
| 帧边界 | 需要 Magic 扫描重组 | WebSocket 消息天然有边界 |
| Magic 作用 | 字节流失步恢复 | 仍保留（Standard Profile 固定包含） |
| 连接建立 | TCP 三次握手 | TCP + HTTP Upgrade 握手 |
| 断线重连 | 重新 CONNECT | 重新 CONNECT（WebSocket 无 RESUME） |
| Profile | Standard | Standard（相同） |
| 其余流程 | — | 与场景 A 完全相同 |

WebSocket Binary 的 AXTP 调用流程与 TCP 场景 A 完全一致，差异仅在传输层。

### 5.3 完整调用流程

#### 阶段 B-1：WebSocket 连接建立

```text
Client                                    Server
  |                                          |
  |──── HTTP GET /axtp (Upgrade: websocket) →|
  |←─── HTTP 101 Switching Protocols ────────|
  |                                          |
  [WebSocket Connected]
```

#### 阶段 B-2 至 B-8：与场景 A 完全相同

Session 建立（CONNECT/ACCEPT）、session.identify、能力查询、业务 RPC、OTA STREAM、心跳、关闭流程与场景 A 一致，此处不重复。

唯一区别：每个 AXTP Frame 作为一个独立的 WebSocket Binary Message 发送，接收方直接从 WebSocket Message 边界读取完整 Frame，无需扫描 Magic 重组。

### 5.4 关键约束

```text
1. MVP 推荐：一个 WebSocket Binary Message 承载一个 AXTP Frame；
2. 不建议在一个 WebSocket Message 中打包多个 AXTP Frame（增加实现复杂度）；
3. WebSocket 断线后不支持 RESUME，必须重新 OPEN 握手；
4. 如果需要 STREAM 高吞吐，WebSocket Binary 是比 WebSocket Text 更合适的选择；
5. 生产环境推荐 wss://（TLS），不使用 ws://。
```

---

## 6. 场景 C：USB HID 直连（Compact Profile）

### 6.1 拓扑

```text
+----------+     USB HID Report (64B)     +----------+
|  PC App  | ←───────────────────────────→|  Device  |
+----------+                              +----------+
  Host                                      HID Device
  (HID Driver)
```

USB HID 使用固定大小的 Report（通常 64B），每个 Report 承载一个 AXTP Compact Frame 或分片。

### 6.2 Profile 选择

| 项目 | 选择 | 理由 |
| --- | --- | --- |
| Header Profile | Compact | HID Report 有固定边界，无需 Magic；4B Header 节省 Report 空间 |
| 可用 Payload | 58B | 64B - 4B Header - 1B CRC8 - 1B ReportID = 58B |
| CRC | CRC8-MAXIM | Compact Profile 固定算法 |
| rpcEncoding | BINARY + TLV | 低带宽场景推荐 |
| ackMode | ON_DEMAND_ACK | HID 无内建可靠性，重要消息需要 ACK |
| 分片 | 最多 15 片 | Compact FrameIndex/FrameCount 各 4 bit |

### 6.3 完整调用流程

#### C-1：USB 枚举（传输层，AXTP 不参与）

```text
Host                                      Device
  |                                          |
  |──── USB Enumerate ──────────────────────→|
  |←─── HID Descriptor ─────────────────────|
  |                                          |
  [HID Device Ready]
```

#### C-2：AXTP Session 建立

```text
Host                                      Device
  |                                          |
  |──── HID Report [CONTROL OPEN] ─────────→|
  |     [Compact Frame]                      |
  |     VT=0x11 Len=N MsgId=0x01             |
  |     FrameInfo=0x11 (FrIdx=0, FrCnt=1)    |
  |     opcode=OPEN                         |
  |     body: protocolVersion=1              |
  |           headerProfile=COMPACT          |
  |           maxFrameSize=58                |
  |           mtu=58                         |
  |           supportedPayloadTypes=0x03     |
  |           supportedRpcEncodings=0x02     |
  |           heartbeatIntervalMs=5000       |
  |           ackMode=ON_DEMAND_ACK          |
  |     CRC8=0xXX                            |
  |                                          |
  |←─── HID Report [CONTROL ACCEPT] ─────|
  |     opcode=ACCEPT                     |
  |     body: sessionId=0x00000001           |
  |           protocolVersion=1              |
  |           headerProfile=COMPACT          |
  |           maxFrameSize=58                |
  |           selectedRpcEncoding=BINARY     |
  |           heartbeatIntervalMs=5000       |
  |           ackMode=ON_DEMAND_ACK          |
  |                                          |
  [State: FRAMING_READY]
```

#### C-3：能力查询（含分片示例）

capability.getAll 响应可能超过 58B，需要分片：

```text
Host                                      Device
  |                                          |
  |──── HID Report [RPC REQUEST] ───────────→|
  |     VT=0x12 Len=12 MsgId=0x02            |
  |     FrameInfo=0x11 (FrIdx=0, FrCnt=1)    |
  |     rpcOp=REQUEST requestId=0x01         |
  |     methodId=capability.getAll           |
  |     CRC8=0xXX                            |
  |                                          |
  |←─── HID Report [RPC RESPONSE frag 0/3] ─|
  |     VT=0x12 Len=54 MsgId=0x03            |
  |     FrameInfo=0x03 (FrIdx=0, FrCnt=3)    |
  |     [首片 RPC Payload 头 + 部分 body]     |
  |     CRC8=0xXX                            |
  |                                          |
  |←─── HID Report [RPC RESPONSE frag 1/3] ─|
  |     VT=0x12 Len=54 MsgId=0x03            |
  |     FrameInfo=0x13 (FrIdx=1, FrCnt=3)    |
  |     [body 续]                            |
  |     CRC8=0xXX                            |
  |                                          |
  |←─── HID Report [RPC RESPONSE frag 2/3] ─|
  |     VT=0x12 Len=30 MsgId=0x03            |
  |     FrameInfo=0x23 (FrIdx=2, FrCnt=3)    |
  |     [body 末尾]                          |
  |     CRC8=0xXX                            |
  |                                          |
  [Host 重组 3 片 → 完整 RPC RESPONSE]
  |                                          |
  |──── HID Report [CONTROL ACK] ───────────→|
  |     opcode=ACK targetType=MESSAGE        |
  |     messageId=0x03                       |
```

#### C-4：业务 RPC（亮度控制）

```text
Host                                      Device
  |                                          |
  |──── HID Report [RPC REQUEST brightness.set] →|
  |     MsgId=0x04 FrameInfo=0x11            |
  |     requestId=0x02 methodId=brightness.set|
  |     body: value=80                       |
  |                                          |
  |←─── HID Report [RPC RESPONSE] ──────────|
  |     MsgId=0x05 flags=SUCCESS             |
  |                                          |
  |←─── HID Report [RPC EVENT brightness.changed] |
  |     rpcOp=EVENT eventId=brightness.changed|
  |     body: value=80                       |
```

#### C-5：OTA（HID 场景，Stop-and-Wait）

HID 带宽有限（64B/Report），OTA 使用 Stop-and-Wait 模式，每包等待 ACK 后再发下一包：

```text
Host                                      Device
  |                                          |
  |──── RPC REQUEST firmware.begin ─────────→|
  |     body: totalSize=1048576 chunkSize=48 |
  |     (chunkSize 适配 HID 58B 可用空间)     |
  |                                          |
  |←─── RPC RESPONSE firmware.begin ────────|
  |     body: streamId=0x01 ackMode=STOP_AND_WAIT|
  |                                          |
  |──── STREAM chunk seqId=0 [48B data] ────→|
  |     VT=0x13 Len=56 MsgId=0x06            |
  |     streamId=0x01 seqId=0 cursor=0       |
  |                                          |
  |←─── CONTROL ACK seqId=0 ────────────────|
  |                                          |
  |──── STREAM chunk seqId=1 [48B data] ────→|
  ... (重复，约 21845 次完成 1MB OTA)
```

#### C-6：正常关闭

```text
Host                                      Device
  |                                          |
  |──── HID Report [CONTROL CLOSE] ─────────→|
  |←─── HID Report [CONTROL CLOSE_ACK] ─────|
  |                                          |
  [USB HID 连接保持，AXTP Session 关闭]
```

注意：USB HID 连接本身不会因 AXTP CLOSE 而断开，只是 AXTP Session 结束。

### 6.4 错误处理

| 错误场景 | 处理方式 |
| --- | --- |
| CRC8 校验失败 | 发送 CONTROL NACK(CRC_ERROR)，重传对应 Frame |
| 分片超时未完整到达 | 发送 CONTROL NACK(FRAGMENT_TIMEOUT)，重传整个 Message |
| USB 设备拔出 | 传输层断开，重新插入后重新 OPEN 握手 |
| Report 丢失 | ON_DEMAND_ACK 模式下超时重传 |

### 6.5 关键约束

```text
1. Compact Profile 无 Magic，依赖 HID Report 边界定位帧头；
2. 每个 HID Report 承载一个 Compact Frame（含分片），不跨 Report 拼接；
3. Compact FrameCount 最大 15，单个 Message 最大 15 × 58B = 870B；
4. 超过 870B 的数据必须通过 STREAM seqId/cursor 分块，不能依赖 Frame 分片；
5. OTA 场景 chunkSize 应适配 HID 可用 Payload（≤ 58B - STREAM Header 8B = 50B）；
6. HID 心跳间隔推荐 1s-5s（比 TCP 更短，因为 HID 无 keepalive 机制）。
```

---

## 7. 场景 D：BLE GATT 直连（Compact Profile，含断线重连）

### 7.1 拓扑

```text
+----------+     BLE GATT (ATT MTU 185B)    +----------+
|  Mobile  | ←──────────────────────────────→|  Device  |
+----------+                                 +----------+
  Central                                      Peripheral
  (GATT Client)                               (GATT Server)
```

BLE 使用 ATT 协议，每个 ATT PDU 承载一个 Compact Frame 或分片。ATT MTU 协商后可用 Payload 约 179B（185B - 4B Header - 1B CRC8 - 1B ATT opcode）。

### 7.2 Profile 选择

| 项目 | 选择 | 理由 |
| --- | --- | --- |
| Header Profile | Compact | BLE ATT 有固定帧边界，无需 Magic；4B Header 节省 MTU |
| 可用 Payload | ~179B | 185B ATT MTU - 4B Header - 1B CRC8 - 1B ATT opcode |
| CRC | CRC8-MAXIM | Compact Profile 固定算法 |
| rpcEncoding | BINARY + TLV | 低带宽场景 |
| ackMode | ON_DEMAND_ACK | BLE 链路层有重传，但 AXTP 层仍需 ACK 确认重要消息 |
| RESUME | 支持 | BLE 断线重连频繁，RESUME 避免重新握手 |
| 心跳间隔 | 5s-30s | 低功耗要求 |

### 7.3 完整调用流程

#### 阶段 1：BLE 连接建立（传输层）

```text
Central                                   Peripheral
  |                                          |
  |──── BLE Scan ───────────────────────────→|
  |←─── BLE Advertise ──────────────────────|
  |──── BLE Connect Request ────────────────→|
  |←─── BLE Connection Established ─────────|
  |──── ATT MTU Exchange (185B) ────────────→|
  |←─── ATT MTU Confirmed ──────────────────|
  |                                          |
  [BLE Connected, ATT MTU=185B]
```

#### D-2：AXTP Session 建立（BLE）

```text
Central                                   Peripheral
  |                                          |
  |──── BLE ATT Write [CONTROL OPEN] ──────→|
  |     [Compact Frame]                      |
  |     VT=0x11 Len=N MsgId=0x01             |
  |     FrameInfo=0x11                       |
  |     opcode=OPEN                         |
  |     body: protocolVersion=1              |
  |           headerProfile=COMPACT          |
  |           maxFrameSize=179               |
  |           mtu=179                        |
  |           supportedPayloadTypes=0x07     |
  |           heartbeatIntervalMs=10000      |
  |           ackMode=ON_DEMAND_ACK          |
  |     CRC8=0xXX                            |
  |                                          |
  |←─── BLE ATT Notify [CONTROL ACCEPT] ─|
  |     opcode=ACCEPT                     |
  |     body: sessionId=0xABCD1234           |
  |           resumeToken=<16B token>        |
  |           heartbeatIntervalMs=10000      |
  |           ackMode=ON_DEMAND_ACK          |
  |                                          |
  [State: FRAMING_READY]
  (sessionId=0xABCD1234 写入双方 Session Context)
  (resumeToken 保存到本地，用于断线恢复)
```

#### D-3：业务流程

与场景 C（HID）相同，使用 Compact Frame，此处不重复。

#### D-6：BLE 断线与 RESUME

BLE 断线是常见场景（信号弱、手机锁屏、距离过远）。RESUME 允许恢复逻辑 Session 而无需重新握手：

```text
Central                                   Peripheral
  |                                          |
  [BLE 连接断开]
  |                                          |
  ... (等待重连)
  |                                          |
  |──── BLE Reconnect ──────────────────────→|
  |←─── BLE Connection Established ─────────|
  |                                          |
  |──── CONTROL RESUME ─────────────────────→|
  |     opcode=RESUME                        |
  |     body: sessionId=0xABCD1234           |
  |           resumeToken=<16B token>        |
  |           streamId=0x00000009  (可选)    |
  |           lastSeqId=673        (可选)    |
  |           offset=1376256       (可选)    |
  |                                          |
  |←─── CONTROL RESUME_ACK ─────────────────|
  |     flags=SUCCESS                        |
  |     body: sessionId=0xABCD1234           |
  |           streamId=0x00000009            |
  |           seqId=673                      |
  |           offset=1376256                 |
  |                                          |
  [State: FRAMING_READY（恢复）]
  (OTA 从 offset=1376256 继续，无需重传已确认数据)
  |                                          |
  |──── STREAM chunk seqId=674 ─────────────→|
  |     cursor=1376256 data=[...]            |
  ... (继续 OTA)
```

RESUME 失败时（token 过期、设备重启）：

```text
Central                                   Peripheral
  |                                          |
  |──── CONTROL RESUME ─────────────────────→|
  |                                          |
  |←─── CONTROL RESUME_ACK flags=ERROR ─────|
  |     statusCode=SESSION_NOT_FOUND         |
  |                                          |
  (降级为重新 OPEN 握手，OTA 从头开始)
  |──── CONTROL OPEN ──────────────────────→|
  ...
```

#### D-7：正常关闭（BLE）

```text
Central                                   Peripheral
  |                                          |
  |──── CONTROL CLOSE ──────────────────────→|
  |←─── CONTROL CLOSE_ACK ──────────────────|
  |                                          |
  [BLE Disconnect]
  [SESSION_CLOSED]
```

### 7.4 错误处理

| 错误场景 | 处理方式 |
| --- | --- |
| BLE 断线 | 重连后发送 CONTROL RESUME，携带 resumeToken |
| RESUME token 过期 | 降级为重新 OPEN，OTA 从头开始 |
| ATT MTU 协商失败 | 使用默认 23B MTU，chunkSize 相应缩小 |
| BLE 链路层重传耗尽 | 传输层断开，触发 RESUME 流程 |

### 7.5 关键约束

```text
1. resumeToken 必须持久化到本地存储，断线后才能使用；
2. RESUME 携带的 lastSeqId/offset 必须是已收到 ACK 的最后一个值，不能是发送方的发送位置；
3. BLE 心跳间隔推荐 10s-30s，过短会增加功耗；
4. Compact FrameCount 最大 15，单个 Message 最大 15 × 179B ≈ 2.6KB；
5. OTA chunkSize 应适配 BLE 可用 Payload（≤ 179B - STREAM Header 8B = 171B）；
6. BLE 场景不建议并发多个 STREAM，带宽有限。
```

---

## 8. 场景 E：UART 直连（Compact Profile + COBS 帧边界）

### 8.1 拓扑

```text
+----------+     UART (115200 bps)     +----------+
|  MCU/PC  | ←─────────────────────── →|  Device  |
+----------+                           +----------+
  Host                                   Peripheral
```

UART 是字节流，没有帧边界。Compact Profile 没有 Magic，必须在传输层增加帧边界机制。推荐使用 COBS（Consistent Overhead Byte Stuffing）编码。

### 8.2 传输层帧边界：COBS

```text
UART 字节流结构：
  [0x00] [COBS encoded AXTP Compact Frame] [0x00] [COBS encoded ...] [0x00]

0x00 作为帧分隔符，COBS 保证 Payload 中不出现 0x00。
接收方扫描 0x00 定位帧边界，解 COBS 后得到 Compact Frame。
```

### 8.3 Profile 选择

| 项目 | 选择 | 理由 |
| --- | --- | --- |
| Header Profile | Compact | MCU 内存极小，4B Header 节省资源 |
| 帧边界 | COBS + 0x00 分隔符 | Compact 无 Magic，UART 无边界，必须额外定义 |
| CRC | CRC8-MAXIM | Compact Profile 固定算法 |
| rpcEncoding | BINARY + TLV | MCU 场景，不使用 JSON |
| ackMode | ON_DEMAND_ACK | UART 无内建可靠性 |
| 心跳间隔 | 1s-5s | UART 无连接状态，需要频繁心跳检测断线 |

### 8.4 完整调用流程

#### 阶段 1：UART 初始化（传输层）

```text
Host                                      Device
  |                                          |
  [打开串口，配置波特率 115200, 8N1]
  [双方清空接收缓冲区]
  |                                          |
  [UART Ready]
```

#### E-2：AXTP Session 建立（UART）

```text
Host                                      Device
  |                                          |
  |──── UART [0x00 + COBS(CONTROL OPEN) + 0x00] →|
  |     解 COBS 后得到 Compact Frame:        |
  |     VT=0x11 Len=N MsgId=0x01             |
  |     FrameInfo=0x11                       |
  |     opcode=OPEN                         |
  |     body: protocolVersion=1              |
  |           headerProfile=COMPACT          |
  |           maxFrameSize=128               |
  |           mtu=128                        |
  |           heartbeatIntervalMs=2000       |
  |           ackMode=ON_DEMAND_ACK          |
  |     CRC8=0xXX                            |
  |                                          |
  |←─── UART [0x00 + COBS(CONTROL ACCEPT) + 0x00] |
  |     opcode=ACCEPT                     |
  |     body: sessionId=0x00000001           |
  |           heartbeatIntervalMs=2000       |
  |                                          |
  [State: FRAMING_READY]
```

#### E-3：业务 RPC（UART）

```text
Host                                      Device
  |                                          |
  |──── UART [COBS(RPC REQUEST brightness.set)] →|
  |     requestId=0x01 body: value=80        |
  |                                          |
  |←─── UART [COBS(RPC RESPONSE)] ──────────|
  |     flags=SUCCESS                        |
  |                                          |
  |←─── UART [COBS(RPC EVENT brightness.changed)] |
  |     body: value=80                       |
```

#### E-4：重同步（字节丢失场景）

UART 容易丢字节，导致 COBS 解码失败：

```text
Host                                      Device
  |                                          |
  [接收到损坏数据，COBS 解码失败]
  |                                          |
  [等待下一个 0x00 分隔符，丢弃当前帧]
  |                                          |
  |──── CONTROL NACK(CRC_ERROR) ────────────→|
  |     (如果 CRC8 校验失败)                 |
  |                                          |
  |←─── 重传上一帧 ──────────────────────────|
```

### 8.5 关键约束

```text
1. 必须在传输层实现 COBS 编码/解码，AXTP 层不感知；
2. 接收方必须实现超时机制：帧内字节间隔超过 T_frame_timeout 则丢弃当前帧；
3. UART 无连接状态，心跳超时后 Host 应重新发送 OPEN；
4. 不建议在 UART 上传输大文件 OTA（带宽约 11.5KB/s @ 115200bps）；
5. 如果必须 OTA，chunkSize 应尽量小（≤ 64B），并使用 Stop-and-Wait。
```

---

## 9. 场景 F：网关中继（WebSocket Binary → BLE/HID，Standard + Compact）

### 9.1 拓扑

```text
+----------+  WebSocket Binary  +----------+  BLE/HID  +----------+
|   App    | ←────────────────→ | Gateway  | ←────────→ |  Device  |
+----------+  Standard Profile  +----------+  Compact   +----------+
  SrcId=0x01                     SrcId=0x20              SrcId=0x10
```

Gateway 是协议转换节点，对 App 侧使用 Standard Profile，对 Device 侧使用 Compact Profile。Gateway 负责 Profile 转换，不修改业务语义。

### 9.2 Gateway 的职责

```text
1. 维护两条独立的 AXTP Session：
   - App ↔ Gateway Session（Standard Profile）
   - Gateway ↔ Device Session（Compact Profile）

2. 转换规则：
   - Standard Frame → 解析 → 提取 Payload → 重新封装为 Compact Frame → 发送给 Device
   - Compact Frame  → 解析 → 提取 Payload → 重新封装为 Standard Frame → 发送给 App

3. 不修改 Payload 内容（CONTROL / RPC / STREAM 语义不变）

4. 维护 SourceId/DestinationId 映射：
   - App SrcId=0x01 → Gateway 内部映射 → Device SrcId=0x10
```

### 9.3 完整调用流程

#### F-1：双侧 Session 建立

```text
App                    Gateway                   Device
 |                        |                         |
 |── WS Binary OPEN ────→|                         |
 |                        |── BLE/HID CONNECT ───────→|
 |                        |←── BLE/HID ACCEPT ───|
 |←── WS Binary ACCEPT─|                         |
 |                        |                         |
 [App-Gateway: FRAMING_READY]   [Gateway-Device: FRAMING_READY]
```

两条 Session 独立建立，Gateway 在两侧都完成 OPEN 握手后才向 App 返回 ACCEPT。

#### F-2：RPC 转发（亮度控制）

```text
App                    Gateway                   Device
 |                        |                         |
 |── Standard RPC ────────→|                         |
 |   PT=0x02 BINARY        |                         |
 |   requestId=0x00000003  |                         |
 |   methodId=brightness.set|                        |
 |   body: value=80        |                         |
 |                        |── Compact RPC ──────────→|
 |                        |   PT=0x02 BINARY         |
 |                        |   requestId=0x00000003   |
 |                        |   methodId=brightness.set|
 |                        |   body: value=80         |
 |                        |                         |
 |                        |←── Compact RPC RESPONSE ─|
 |                        |   flags=SUCCESS          |
 |←── Standard RPC RESPONSE|                         |
 |   flags=SUCCESS         |                         |
 |                        |                         |
 |                        |←── Compact RPC EVENT ────|
 |                        |   brightness.changed     |
 |←── Standard RPC EVENT ─|                         |
 |   brightness.changed    |                         |
```

Gateway 转发时保持 requestId 不变，确保 App 能正确匹配 Request/Response。

#### F-3：STREAM 转发（OTA）

```text
App                    Gateway                   Device
 |                        |                         |
 |── Standard RPC firmware.begin ─────────────────→ |
 |   (经 Gateway 转发)     |                         |
 |←── Standard RPC RESPONSE streamId=0x09 ──────── |
 |                        |                         |
 |── Standard STREAM chunk seqId=0 ───────────────→ |
 |   PT=0x03 streamId=0x09|                         |
 |   [4096B data]         |                         |
 |                        |                         |
 |                        | (Gateway 将 4096B 数据   |
 |                        |  按 BLE MTU 拆分为多个   |
 |                        |  Compact STREAM 分片)    |
 |                        |                         |
 |                        |── Compact STREAM frag 0 →|
 |                        |   seqId=0 cursor=0 [171B]|
 |                        |── Compact STREAM frag 1 →|
 |                        |   seqId=0 cursor=171 [171B]|
 |                        |── Compact STREAM frag 2 →|
 |                        |   seqId=0 cursor=342 [...B]|
 |                        |                         |
 |                        |←── Compact ACK seqId=0 ─|
 |←── Standard ACK seqId=0|                         |
```

Gateway 在 STREAM 转发时负责 MTU 适配：将 App 侧的大 chunk 拆分为 Device 侧 BLE MTU 可承载的小分片。

### 9.4 Profile 转换规则

| 转换方向 | 操作 |
| --- | --- |
| Standard → Compact | 去掉 Magic(2B)、SourceId(1B)、DestinationId(1B)；MessageId 截断为 uint8；FrameIndex/FrameCount 压缩为 4bit；CRC16 → CRC8 |
| Compact → Standard | 补充 Magic(AX)、SourceId/DestinationId（从路由表查）；MessageId 扩展为 uint16；FrameIndex/FrameCount 扩展为 uint8；CRC8 → CRC16 |
| Payload | 不修改，原样透传 |

### 9.5 关键约束

```text
1. Gateway 必须独立维护两侧的 Session 状态机，不能共享；
2. Gateway 侧 BLE/HID 断线时，应向 App 侧发送 CONTROL NACK 或 RPC ERROR，不能静默丢弃；
3. STREAM MTU 适配由 Gateway 负责，App 侧不感知 BLE MTU 限制；
4. requestId 在转发时保持不变，Gateway 不重新分配；
5. Gateway 不解析 RPC body 内容，只做 Frame 层转换。
```

---

## 10. 场景 G：多设备路由（Standard Profile，SourceId/DestinationId）

### 10.1 拓扑

```text
+----------+  WebSocket Binary  +----------+  TCP/BLE  +----------+
|   App    | ←────────────────→ | Gateway  | ←────────→ | Device A |
+----------+  Standard Profile  +----------+            | SrcId=0x10|
  SrcId=0x01                     SrcId=0x20             +----------+
                                                         +----------+
                                                        | Device B |
                                                        | SrcId=0x11|
                                                         +----------+
```

Gateway 通过 Standard Profile 的 SourceId/DestinationId 字段实现多设备路由。

### 10.2 SourceId/DestinationId 路由规则

```text
App → Device A：
  SourceId=0x01, DestinationId=0x10

App → Device B：
  SourceId=0x01, DestinationId=0x11

Device A → App：
  SourceId=0x10, DestinationId=0x01

Device B → App：
  SourceId=0x11, DestinationId=0x01

广播（App → 所有设备）：
  DestinationId=0x7F（保留广播地址）
```

### 10.3 完整调用流程

#### G-1：多设备 Session 建立

```text
App                    Gateway              Device A         Device B
 |                        |                    |                |
 |── OPEN ──────────────→|                    |                |
 |   DstId=0x20           |── OPEN ──────────→|                |
 |                        |   DstId=0x10       |                |
 |                        |── OPEN ──────────────────────────→ |
 |                        |   DstId=0x11       |                |
 |                        |←── ACCEPT ──────|                |
 |                        |←── ACCEPT ─────────────────────  |
 |←── ACCEPT ──────────|                    |                |
 |   body: connectedDevices=[0x10, 0x11]       |                |
 |                        |                    |                |
 [State: FRAMING_READY]
```

#### G-2：定向 RPC（App → Device A）

```text
App                    Gateway              Device A
 |                        |                    |
 |── RPC brightness.set ─→|                    |
 |   SrcId=0x01           |                    |
 |   DstId=0x10           |── RPC brightness.set ──────────────→|
 |                        |   SrcId=0x01 DstId=0x10             |
 |                        |←── RPC RESPONSE ───|
 |←── RPC RESPONSE ───────|                    |
 |   SrcId=0x10 DstId=0x01|                    |
```

#### G-3：广播 RPC（App → 所有设备）

```text
App                    Gateway              Device A         Device B
 |                        |                    |                |
 |── RPC brightness.set ─→|                    |                |
 |   DstId=0x7F           |── RPC ────────────→|                |
 |                        |── RPC ─────────────────────────────→|
 |                        |←── RESPONSE ───────|                |
 |                        |←── RESPONSE ───────────────────────  |
 |←── RESPONSE (A) ───────|                    |                |
 |←── RESPONSE (B) ───────|                    |                |
```

### 10.4 关键约束

```text
1. Compact Profile 不含 SourceId/DestinationId，多设备路由必须使用 Standard Profile；
2. Gateway 维护设备 ID 注册表，设备连接时注册 SrcId，断线时注销；
3. 广播地址 0x7F 由 Gateway 展开为多个单播，不透传给设备；
4. 同一 App 对不同设备的 requestId 空间独立，不共享。
```

---

## 11. 场景 H：WebSocket Text 调试（DS-RPC Debug Adapter）

### 11.1 拓扑

```text
+----------+  WebSocket Text (ws://)  +----------+
| Browser  | ←──────────────────────→ |  Device  |
| / curl   |   DS-RPC JSON Envelope   | (Debug)  |
+----------+                          +----------+
```

不使用 AXTP Frame Header。适用于浏览器 JS、curl、Postman、DevTools 等无法处理二进制帧的工具。

**这不是生产路径。** 生产客户端应使用场景 B（WebSocket Binary + Standard Profile），从而获得 STREAM、ACK/NACK、RESUME、统一 CONTROL 生命周期等能力。

### 11.2 DS-RPC 消息格式

Unframed Mode 下，每条 WebSocket Text Message 是一个 JSON 对象：

```json
{
  "sid": "a1b2c3d4",
  "op": 1,
  "d": { ... }
}
```

- `sid`：Session ID，由 Device 在连接建立时分配，后续每条消息都携带
- `op`：RPC 操作类型，只保留 RPC 语义（不承担 transport 生命周期）

| op 值 | 含义 |
| --- | --- |
| 1 | REQUEST |
| 2 | RESPONSE |
| 3 | EVENT |
| 4 | BATCH_REQUEST |
| 5 | BATCH_RESPONSE |

> **注意**：DS-RPC Debug Adapter 中 `op` 不再包含 `Hello(0)/HelloAck(1)` 等 transport 级别操作。这些操作在 Framed Mode 下由 `CONTROL OPEN/ACCEPT` 承担；在 Debug Adapter 下，WebSocket 升级或 HTTP 认证结果会构造 Debug TransportContext，设备直接进入 FRAMING_READY 状态。

### 11.3 完整调用流程

#### H-1：WebSocket 连接建立

```text
Browser                                   Device
  |                                          |
  |──── HTTP GET /axtp/debug ───────────────→|
  |     Upgrade: websocket                   |
  |←─── HTTP 101 Switching Protocols ────────|
  |                                          |
  [State: FRAMING_READY]
  (Device 分配 sid="a1b2c3d4"，等待 session.identify)
```

WebSocket 升级完成后，Device 隐式跳过 CONTROL 阶段，直接进入 FRAMING_READY。该行为只适用于 Debug/Legacy Adapter，不适用于正式生产连接。

#### H-2：应用层身份认证（Challenge / Identify / Identified）

DS-RPC Debug Adapter 同样遵循三步握手。WebSocket 升级后 Server 主动推送 `session.challenge` EVENT，Client 回应 `session.identify` REQUEST，Server 确认 `session.identified` EVENT。

```text
Browser                                   Device
  |                                          |
  |←─── DS-RPC EVENT session.challenge ─────| (Server 主动推送)
  |     {"sid":"","op":3,"d":{               |
  |       "event":"session.challenge",       |
  |       "data":{                           |
  |         "challengeString":"<random>",    |
  |         "authRequired":true,             |
  |         "rpcVersion":"2026.05"           |
  |       }                                  |
  |     }}                                   |
  |                                          |
  |──── DS-RPC REQUEST session.identify ────→| (路由到业务层)
  |     {"sid":"","op":1,"d":{               |
  |       "id":"00000001",                   |
  |       "method":"session.identify",       |
  |       "params":{                         |
  |         "clientName":"browser-debug",    |
  |         "clientVersion":"1.0.0",         |
  |         "rpcVersion":"2026.05",          |
  |         "authResponse":"<hmac-sha256>"   |
  |       }                                  |
  |     }}                                   |
  |                                          |
  |←─── DS-RPC EVENT session.identified ────| (Server 确认)
  |     {"sid":"a1b2c3d4","op":3,"d":{       |
  |       "event":"session.identified",      |
  |       "data":{                           |
  |         "negotiatedRpcVersion":"2026.05" |
  |       }                                  |
  |     }}                                   |
  |                                          |
  [State: APP_READY, sid="a1b2c3d4"]
  (sid 由 Device 在 session.identified EVENT 中分配，后续每条消息都携带)
```

> 如果设备为免鉴权模式（`authRequired=false`），Client 发送 `session.identify` 时省略 `authResponse` 字段，Server 直接回 `session.identified`。

#### H-3：业务 RPC

```text
Browser                                   Device
  |                                          |
  |──── DS-RPC REQUEST brightness.set ──────→|
  |     {"sid":"a1b2c3d4","op":1,"d":{       |
  |       "id":"00000002",                   |
  |       "method":"brightness.set",         |
  |       "params":{"value":80}              |
  |     }}                                   |
  |                                          |
  |←─── DS-RPC RESPONSE brightness.set ─────|
  |     {"sid":"a1b2c3d4","op":2,"d":{       |
  |       "id":"00000002",                   |
  |       "status":100,                      |
  |       "result":{}                        |
  |     }}                                   |
  |                                          |
  |←─── DS-RPC EVENT brightness.changed ────|
  |     {"sid":"a1b2c3d4","op":3,"d":{       |
  |       "event":"brightness.changed",      |
  |       "data":{"value":80,"previous":60}  |
  |     }}                                   |
```

#### H-4：关闭

```text
Browser                                   Device
  |                                          |
  |──── WebSocket Close Frame ──────────────→|
  |←─── WebSocket Close Frame ───────────────|
  |                                          |
  [State: DISCONNECTED]
```

### 11.4 与 Framed Mode 的对应关系

| Debug Adapter（DS-RPC） | Framed Mode（AXTP） | 说明 |
| --- | --- | --- |
| WebSocket Upgrade | CONTROL OPEN/ACCEPT | Unframed 隐式跳过 CONTROL |
| `session.challenge` (op=3 EVENT, Server→Client) | RPC EVENT `session.challenge` | 完全相同的 RPC 事件 |
| `session.identify` (op=1 REQUEST, Client→Server) | RPC REQUEST `session.identify` | 完全相同的 RPC 方法 |
| `session.identified` (op=3 EVENT, Server→Client) | RPC EVENT `session.identified` | 完全相同的 RPC 事件 |
| REQUEST (op=1) | RPC REQUEST | 相同语义 |
| RESPONSE (op=2) | RPC RESPONSE | 相同语义 |
| EVENT (op=3) | RPC EVENT | 相同语义 |
| WebSocket Close | CONTROL CLOSE | 关闭语义等价 |
| 无对应 | CONTROL HEARTBEAT | WebSocket 有 Ping/Pong 机制 |
| 无对应 | CONTROL RESUME | Unframed 不支持断线恢复 |
| 无对应 | STREAM | DS-RPC 不承载高吞吐数据面 |

> **Legacy 兼容说明**：如果旧客户端发送 `op=0`（Hello）或 `op=1`（HelloAck），Device 可将其映射为 `session.identify` 并返回 deprecated 警告，但新实现不得发送这些 op 值。

### 11.5 关键约束

```text
1. sid 必须在每条消息中携带，Device 用它查找 Session Context；
2. 首次消息（session.challenge EVENT）的 sid 字段为空字符串 ""，
   Device 在 session.identified EVENT 中分配并返回 sid，后续每条消息都携带；
3. DS-RPC 不承载 STREAM 数据，OTA/视频流必须使用 Framed Mode；
4. requestId 在 DS-RPC 中为 8 位十六进制字符串（如 "00000001"），
   内部解析为 uint32 后与 Binary 模式语义一致；
5. 不支持 RESUME，WebSocket 断线后重新连接并重新执行三步握手；
6. 生产环境不应暴露 DS-RPC 端点，仅用于开发调试。
```

---

## 12. 场景 I：老协议适配（Legacy Client → AXTP Adapter → Device）

### 12.1 拓扑

```text
+----------------+  旧协议  +----------+  AXTP  +----------+
| Legacy Client  | ←───────→ | Adapter  | ←─────→ |  Device  |
| (旧 HID/BLE/   |           | (协议转换)|         | (AXTP)   |
|  JSON-RPC)     |           +----------+         +----------+
+----------------+
```

Adapter 是协议转换层，对旧客户端保持旧协议接口，对 Device 使用 AXTP。

### 12.2 适配场景分类

| 旧协议类型 | 适配方式 | 说明 |
| --- | --- | --- |
| 旧 HID CmdValue | CmdValue → methodId 映射 | 通过 legacyMapping Registry 转换 |
| 旧 JSON-RPC | rpcEncoding=JSON + methodId 映射 | 字段名可能需要重命名 |
| 旧 Binary RPC | rpcEncoding=BINARY + bodyEncoding=RAW_BYTES | 旧 body 原样放入 RPC body |
| 旧 OTA/RawStream | STREAM + profile=legacy.tunnel | 旧数据流透传 |
| 旧错误码 | errorCode Registry 映射 | 旧错误码 → AXTP ErrorCode |

### 12.3 完整调用流程（旧 HID CmdValue 适配）

#### I-1：旧客户端发送旧 HID 命令

```text
Legacy Client              Adapter                    Device
  |                           |                          |
  |── 旧 HID Report ─────────→|                          |
  |   CmdValue=0x0042         |                          |
  |   Payload=[brightness=80] |                          |
  |                           |                          |
  |                           | [查 legacyMapping]       |
  |                           | CmdValue=0x0042          |
  |                           | → methodId=brightness.set|
  |                           | → params={value:80}      |
  |                           |                          |
  |                           |── AXTP RPC REQUEST ──────→|
  |                           |   methodId=brightness.set|
  |                           |   body: value=80 (TLV)   |
  |                           |                          |
  |                           |←── AXTP RPC RESPONSE ────|
  |                           |   flags=SUCCESS          |
  |                           |                          |
  |                           | [反向映射]               |
  |                           | SUCCESS → 旧 ACK 格式    |
  |←── 旧 HID ACK ────────────|                          |
  |   CmdValue=0x0042 OK      |                          |
```

#### I-2：旧 JSON-RPC 适配

```text
Legacy Client              Adapter                    Device
  |                           |                          |
  |── 旧 JSON-RPC ────────────→|                          |
  |   {"method":"setBrightness"|                         |
  |    "params":{"level":80}  |                          |
  |    "id":1}                |                          |
  |                           |                          |
  |                           | [字段映射]               |
  |                           | setBrightness            |
  |                           | → brightness.set         |
  |                           | params.level → params.value|
  |                           |                          |
  |                           |── AXTP RPC REQUEST ──────→|
  |                           |   methodId=brightness.set|
  |                           |   body: value=80         |
  |                           |                          |
  |                           |←── AXTP RPC RESPONSE ────|
  |                           |                          |
  |←── 旧 JSON-RPC Response ──|                          |
  |   {"result":{"ok":true}   |                          |
  |    "id":1}                |                          |
```

#### I-3：旧 OTA 流适配（RAW_BYTES 透传）

```text
Legacy Client              Adapter                    Device
  |                           |                          |
  |── 旧 OTA Begin ───────────→|                          |
  |   totalSize=1048576       |                          |
  |                           |── AXTP RPC firmware.begin→|
  |                           |   body: totalSize=1048576|
  |                           |         profile=legacy.ota|
  |                           |←── AXTP RPC RESPONSE ────|
  |                           |   streamId=0x09          |
  |←── 旧 OTA Begin ACK ──────|                          |
  |                           |                          |
  |── 旧 OTA Chunk [512B] ────→|                          |
  |                           |── AXTP STREAM ───────────→|
  |                           |   streamId=0x09 seqId=0  |
  |                           |   bodyEncoding=RAW_BYTES  |
  |                           |   data=[512B 旧格式数据]  |
  |                           |←── AXTP ACK ─────────────|
  |←── 旧 OTA Chunk ACK ──────|                          |
  ... (重复)
```

### 12.4 legacyMapping 规则

```text
1. 所有 CmdValue → methodId 映射必须在 Registry 中声明；
2. 不得绕过 Registry 直接透传未知 CmdValue；
3. 旧协议字段名与 AXTP 字段名不同时，Adapter 负责重命名；
4. 旧错误码必须映射到 AXTP ErrorCode Registry 中的对应值；
5. 旧协议中没有对应的 AXTP 概念（如旧心跳格式），由 Adapter 转换为 CONTROL HEARTBEAT。
```

### 12.5 关键约束

```text
1. Adapter 对旧客户端保持旧协议接口不变，旧客户端无需修改；
2. Adapter 对 Device 侧使用完整 AXTP（Standard 或 Compact Profile）；
3. RAW_BYTES bodyEncoding 只允许旧协议适配层使用，新业务不得使用；
4. 旧协议的 Session 概念（如果有）由 Adapter 映射到 AXTP CONTROL OPEN/CLOSE；
5. 如果旧协议无 Session 概念，Adapter 在旧客户端连接时自动发起 AXTP OPEN。
```

---

## 13. 场景对比总结

### 13.1 Profile 选择速查

| 传输层 | Profile | 理由 |
| --- | --- | --- |
| TCP | Standard | 字节流需要 Magic 同步；带宽充足 |
| WebSocket Binary | Standard | 消息边界由 WS 提供，但 Standard 保持一致性 |
| USB HID | Compact | Report 边界固定，无需 Magic；节省 Report 空间 |
| BLE GATT | Compact | ATT 边界固定；MTU 小，节省开销 |
| UART | Compact + COBS | 无边界，需传输层 framing；MCU 内存小 |
| 网关（App 侧） | Standard | 需要 SourceId/DestinationId 路由 |
| 网关（Device 侧） | Compact | 取决于 Device 传输层 |

### 13.2 Session 恢复能力

| 场景 | 支持 RESUME | 说明 |
| --- | --- | --- |
| TCP | 否 | TCP 断线即重新 CONNECT |
| WebSocket Binary | 否 | WS 断线即重新 CONNECT |
| USB HID | 否 | USB 拔插即重新 CONNECT |
| BLE GATT | 是 | 断线重连后发送 RESUME，携带 resumeToken |
| UART | 否（可选） | UART 无连接状态，通常重新 CONNECT |
| 网关 | 取决于 Device 侧 | Device 侧 BLE 支持 RESUME |

### 13.3 STREAM 支持能力

| 场景 | 支持 STREAM | 推荐 chunkSize | 说明 |
| --- | --- | --- | --- |
| TCP | 是 | 4096B | 带宽充足 |
| WebSocket Binary | 是 | 4096B | 同 TCP |
| USB HID | 是（受限） | ≤ 50B | HID Report 64B，扣除 Header 后约 50B |
| BLE GATT | 是（受限） | ≤ 171B | ATT MTU 185B，扣除 Header 后约 171B |
| UART | 不推荐 | ≤ 64B | 带宽约 11.5KB/s，OTA 极慢 |
| DS-RPC（场景 H） | 否 | — | DS-RPC 不承载 STREAM 数据面 |

### 13.4 调用流程通用骨架

无论哪种场景，AXTP 调用流程都遵循同一骨架：

```text
1. 传输层连接建立（TCP/WS/BLE/HID/UART）
       ↓
2. CONTROL OPEN / ACCEPT（协商协议能力）← Framed Mode 必须；Unframed 跳过
       ↓  [State: FRAMING_READY]
3. RPC EVENT session.challenge（Server 推送，含 challengeString / authRequired）
4. RPC REQUEST session.identify（Client 回应，含 clientName / authResponse）
5. RPC EVENT session.identified（Server 确认，含 negotiatedRpcVersion）
       ↓  [State: APP_READY]
6. RPC capability.getAll（查询业务能力）
       ↓
7. RPC device.getInfo（获取设备信息）
       ↓
8. 业务 RPC（命令、查询、事件订阅）
       ↓
9. STREAM（如需要：OTA、视频、文件）
       ↓
10. CONTROL HEARTBEAT（保活，周期性）
       ↓
11. CONTROL CLOSE / CLOSE_ACK（正常关闭）
       ↓
12. 传输层断开
```

差异只在步骤 1（传输层）和步骤 2（Profile 选择），步骤 3-9 的业务语义完全一致。这正是 AXTP 统一协议栈的核心价值：**换传输层不换业务逻辑**。
