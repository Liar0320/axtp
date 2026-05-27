# 05《AXTP 连接场景与调用流程规范》

版本：v0.2 Draft
状态：MVP 场景参考规范（精简版）
适用范围：AXTP 在不同传输层和拓扑组合下的完整调用流程、Profile 选择、Session 生命周期、错误处理
前置文档：01-04《AXTP 核心协议规范》

---

## 1. 架构裁决

AXTP v1 只有一条正式生产路径：

```text
AXTP Framed Mode
  PayloadType = CONTROL / RPC / STREAM
  WebSocket Binary / TCP / USB Bulk → Standard Frame Profile
  HID / BLE / UART → Compact Frame Profile
```

**L2 Payload Header 说明：**

- Control Payload：统一 5B 固定头（opcode/controlId/statusCode + TLV body），所有传输场景共用，不区分 Standard/Compact
- RPC Binary Payload：统一 11B 固定头，所有传输场景共用
- STREAM Payload：Standard 16B / Compact 8B，在 RPC 建流阶段协商

WebSocket Text / HTTP JSON 只作为 Debug 或 Legacy Adapter，不承载正式 STREAM，不参与 CONTROL ACK/NACK / RESUME，不作为生产客户端必须实现的协议路径。

---

## 2. 场景总览

| 场景 | 传输层 | Frame Profile | 拓扑 | 典型用途 |
| --- | --- | --- | --- | --- |
| A | TCP | Standard | 直连 | PC App ↔ 设备 |
| B | WebSocket Binary | Standard | 直连 | Web App / Native App ↔ 设备 |
| C | USB HID | Standard（默认）/ Compact（协商降级） | 直连 | PC ↔ USB 设备 |
| D | BLE GATT | Compact | 直连 | 手机 ↔ 蓝牙设备（含断线重连） |
| E | UART + COBS | Compact | 直连 | MCU ↔ 主控 |
| F | WebSocket Binary → BLE/HID | Standard + Compact | 网关中继 | App ↔ 网关 ↔ 设备 |
| G | WebSocket Binary（多设备路由） | Standard | 多设备 | App ↔ 网关 ↔ 多台设备 |
| H | WebSocket Text（DS-RPC Debug Adapter） | Unframed | 调试 / Legacy | 浏览器 / curl ↔ 设备 |
| I | 老协议适配 | Standard / Compact | 适配层 | 旧客户端 ↔ AXTP 适配器 ↔ 设备 |

---

## 3. 通用约定

### 3.1 统一连接状态机

每个正式 AXTP Framed Session 维护四状态机：

```text
DISCONNECTED
    │  传输层连接建立
    ▼
LINK_CONNECTED
    │  CONTROL OPEN / ACCEPT 完成
    ▼
FRAMING_READY
    │  RPC Hello / Identify / Identified 三步完成
    │  或 authRequired=false 直接进入
    ▼
APP_READY
```

| 状态 | 允许的操作 | 拒绝的操作 |
| --- | --- | --- |
| LINK_CONNECTED | 仅 CONTROL 包（OPEN） | 所有 RPC / STREAM |
| FRAMING_READY | RPC Hello / Identify / Identified / capability.getAll | 需要鉴权的业务 RPC |
| APP_READY | 所有已注册 RPC 和 STREAM | — |

WebSocket Text / HTTP JSON Debug Adapter：WebSocket 升级或 HTTP 认证完成后直接进入 FRAMING_READY，该捷径只适用于 Debug/Legacy Adapter。

### 3.2 CONTROL 与 RPC 的职责边界

| 字段 / 能力 | 归属 |
| --- | --- |
| AXTP 协议版本、Header Profile、maxFrameSize、supportedPayloadTypes、rpcEncoding、压缩/加密、心跳间隔、resumeToken | CONTROL OPEN / RESUME |
| challengeString / authRequired / rpcVersion | Hello（op=0，Server→Client） |
| clientName / authResponse | Identify（op=2，Client→Server） |
| negotiatedRpcVersion / sid | Identified（op=3，Server→Client） |
| 设备型号 / 固件版本 | device.getInfo |
| 能力列表 | capability.getAll |

### 3.3 业务流程通用骨架

```text
① 传输层连接建立
② CONTROL OPEN / ACCEPT          ← Framed Mode 必须；Debug Adapter 可跳过
   [State: FRAMING_READY]
③ RPC Hello (op=0)                ← Server 主动推送
④ RPC Identify (op=2)             ← Client 回应
⑤ RPC Identified (op=3)           ← Server 确认
   [State: APP_READY]
⑥ RPC capability.getAll
⑦ RPC device.getInfo
⑧ 业务 RPC
⑨ STREAM 数据流（需先通过 RPC 建立 Stream Context）
⑩ CONTROL HEARTBEAT（周期性）
⑪ CONTROL CLOSE / 传输层断开
```

---
## 4. 场景 A：TCP 直连（Standard Profile）

### 4.1 Profile 选择

| 项目 | 选择 |
| --- | --- |
| Header Profile | Standard |
| CRC | CRC16-CCITT-FALSE |
| rpcEncoding | BINARY + TLV（推荐）；JSON 可选用于调试 |
| ackMode | NO_ACK（TCP 保证可靠传输） |

### 4.2 完整调用流程

**阶段 1：TCP 连接 + AXTP Session 建立**

```text
Client → Server: TCP SYN / SYN-ACK / ACK
Client → Server: CONTROL OPEN
  [Standard Frame] Magic=AX Ver=1 PT=0x01
  opcode=OPEN controlId=0x0001 statusCode=0x0000
  body TLV: protocolVersion=1, headerProfile=STANDARD, maxFrameSize=4096,
            mtu=1460, supportedPayloadTypes=0x07, supportedRpcEncodings=0x03,
            heartbeatIntervalMs=30000, ackMode=NO_ACK
Server → Client: CONTROL ACCEPT
  opcode=ACCEPT controlId=0x0001 statusCode=0x0000
  body TLV: sessionId=0x12345678, protocolVersion=1, headerProfile=STANDARD,
            maxFrameSize=4096, selectedRpcEncoding=BINARY,
            heartbeatIntervalMs=30000, ackMode=NO_ACK, resumeToken=<token>
[State: FRAMING_READY]
```

**阶段 2：应用层身份认证**

```text
Server → Client: RPC Hello (op=0)
  body: challengeString="<random>", authRequired=true, rpcVersion="2026.05"
Client → Server: RPC Identify (op=2)
  body: clientName="desktop-app", clientVersion="1.2.0",
        rpcVersion="2026.05", authResponse="<hmac-sha256>"
Server → Client: RPC Identified (op=3)
  body: sid="<session-id>", negotiatedRpcVersion="2026.05"
[State: APP_READY]
```

免鉴权模式（authRequired=false）：Client 省略 authResponse，Server 直接回 Identified。

**阶段 3：能力查询与设备信息**

```text
Client → Server: RPC REQUEST capability.getAll (requestId=0x00000001)
Server → Client: RPC REQUEST_RESPONSE capability.getAll
  body: capabilities=[{domain:"device",...},{domain:"display",...},...]

Client → Server: RPC REQUEST device.getInfo (requestId=0x00000002)
Server → Client: RPC REQUEST_RESPONSE device.getInfo
  body: deviceId="screen-001", firmwareVersion="2.1.0", model="AX-Display-Pro"
```

**阶段 4：业务 RPC（亮度控制）**

```text
Client → Server: RPC REQUEST display.setBrightness (requestId=0x00000003)
  body: value=80 (TLV)
Server → Client: RPC REQUEST_RESPONSE display.setBrightness, status.ok=true, status.code=SUCCESS
Server → Client: RPC EVENT display.brightnessChanged
  body: value=80, previousValue=60
```

**阶段 5：OTA 固件升级（RPC + STREAM）**

```text
Client → Server: RPC REQUEST firmware.begin (requestId=0x00000004)
  body: totalSize=1048576, verifyType=md5, verifyValue="abc123...", chunkSize=4096
Server → Client: RPC REQUEST_RESPONSE firmware.begin
  body: streamId=0x00000009, ackMode=STOP_AND_WAIT
[Stream Context OPEN: streamId=0x00000009]

Client → Server: STREAM chunk seqId=0
  PT=0x03, streamId=0x00000009, seqId=0, cursor=0, data=[4096B]
Server → Client: CONTROL ACK, targetType=STREAM_CHUNK, streamId=0x00000009, seqId=0

Client → Server: STREAM chunk seqId=1, cursor=4096, data=[4096B]
Server → Client: CONTROL ACK, seqId=1
... (重复直到所有 chunk 发送完毕)

Client → Server: RPC REQUEST firmware.verify (requestId=0x00000005)
  body: streamId=0x00000009
Server → Client: RPC REQUEST_RESPONSE firmware.verify, status.ok=true, status.code=SUCCESS
Server → Client: RPC EVENT firmware.updateCompleted
  body: version="2.2.0"
[Stream Context CLOSED: streamId=0x00000009]
```

**阶段 6：心跳与关闭**

```text
Client → Server: CONTROL HEARTBEAT, body: timestamp=1716624000000
Server → Client: CONTROL HEARTBEAT_ACK, body: timestamp=..., serverTimestamp=...
（间隔由 OPEN 协商，超过 3 个周期无响应视为断开）

Client → Server: CONTROL CLOSE, body: reason=NORMAL_CLOSE
Server → Client: CONTROL CLOSE_ACK
[TCP FIN / RST] [SESSION_CLOSED]
```

### 4.3 错误处理

| 错误场景 | 处理方式 |
| --- | --- |
| CRC 校验失败 | 接收方发送 CONTROL NACK(FRAME_CRC_ERROR)，发送方重传或关闭连接 |
| RPC 方法不存在 | Server 返回 RPC REQUEST_RESPONSE，`status.ok=false, status.code=RPC_METHOD_NOT_FOUND` |
| STREAM chunk 丢失 | Server 发送 CONTROL NACK(STREAM_CHUNK_MISSING)，Client 重传对应 seqId |
| TCP 连接断开 | 重新建立 TCP 连接，重新执行 OPEN 握手（TCP 无 RESUME 语义） |
| 版本不兼容 | Server 返回 ACCEPT statusCode=FRAME_VERSION_UNSUPPORTED，关闭连接 |

### 4.4 关键约束

```text
1. TCP 是字节流，接收方必须按 Magic(2B)+Header(10B)+PayloadLength+CRC(2B) 重组 Frame；
2. 不得假设一次 TCP recv() 恰好包含一个完整 Frame；
3. STREAM 数据必须在 firmware.begin 返回 streamId 后才能发送；
4. TCP 断线后不支持 RESUME，必须重新 OPEN 握手。
```

---
## 5. 场景 B：WebSocket Binary 直连（Standard Profile）

与场景 A 的差异仅在传输层：

| 项目 | TCP（场景 A） | WebSocket Binary（场景 B） |
| --- | --- | --- |
| 帧边界 | 需要 Magic 扫描重组 | WebSocket 消息天然有边界 |
| 连接建立 | TCP 三次握手 | TCP + HTTP Upgrade 握手 |
| 断线重连 | 重新 OPEN | 重新 OPEN（WebSocket 无 RESUME） |
| Profile | Standard | Standard（相同） |
| 其余流程 | — | 与场景 A 完全相同 |

**连接建立：**

```text
Client → Server: HTTP GET /axtp (Upgrade: websocket)
Server → Client: HTTP 101 Switching Protocols
[WebSocket Connected]
```

之后的 OPEN/ACCEPT、Hello/Identify/Identified、capability.getAll、业务 RPC、OTA STREAM、心跳、关闭流程与场景 A 完全一致。每个 AXTP Frame 作为一个独立的 WebSocket Binary Message 发送。

### 关键约束

```text
1. MVP 推荐：一个 WebSocket Binary Message 承载一个 AXTP Frame；
2. 不建议在一个 WebSocket Message 中打包多个 AXTP Frame；
3. WebSocket 断线后不支持 RESUME，必须重新 OPEN 握手；
4. 生产环境推荐 wss://（TLS）。
```

---

## 6. 场景 C：USB HID 直连

### 6.1 Profile 选择

| 项目 | 选择 |
| --- | --- |
| Frame Header Profile | Standard（默认）；Report Size ≤ 64B 时通过 CONTROL OPEN 协商降级为 Compact |
| 可用 Payload（Standard，64B Report） | 48B（64B - 12B Header - 2B CRC16 - 1B ReportID - 1B padding） |
| 可用 Payload（Compact，64B Report） | 58B（64B - 4B Header - 1B CRC8 - 1B ReportID） |
| CRC | Standard: CRC16-CCITT-FALSE；Compact: CRC8-MAXIM |
| rpcEncoding | BINARY + TLV |
| ackMode | ON_DEMAND_ACK（HID 无内建可靠性） |
| 分片 | Standard: 最多 254 片；Compact: 最多 15 片（FrameIndex/FrameCount 各 4 bit） |

### 6.2 完整调用流程

**Session 建立（Standard，Report Size > 64B 或默认）：**

```text
Host → Device: HID Report [CONTROL OPEN]
  [Standard Frame] Magic=AX Ver=1 PT=0x01
  opcode=OPEN controlId=0x0001 statusCode=0x0000
  body TLV: protocolVersion=1, headerProfile=STANDARD, maxFrameSize=<report_size>,
            supportedProfiles=[STANDARD,COMPACT], mtu=<report_size>,
            supportedPayloadTypes=0x07, heartbeatIntervalMs=5000, ackMode=ON_DEMAND_ACK
Device → Host: HID Report [CONTROL ACCEPT]
  opcode=ACCEPT controlId=0x0001 statusCode=0x0000
  body TLV: sessionId=0x00000001, protocolVersion=1, headerProfile=STANDARD,
            maxFrameSize=<report_size>, selectedRpcEncoding=BINARY,
            heartbeatIntervalMs=5000, ackMode=ON_DEMAND_ACK
[State: FRAMING_READY]
```

**Profile 降级协商（Report Size ≤ 64B）：**

```text
Host → Device: CONTROL OPEN
  body TLV: maxFrameSize=64, supportedProfiles=[STANDARD,COMPACT], ...
Device → Host: CONTROL ACCEPT
  body TLV: headerProfile=COMPACT, maxFrameSize=58, ...
[后续帧使用 Compact Frame Profile]
```

**分片示例（capability.getAll 响应超过 58B）：**

```text
Host → Device: HID Report [RPC REQUEST capability.getAll]
  VT=0x12 Len=12 MsgId=0x02 FrameInfo=0x11

Device → Host: HID Report [RPC REQUEST_RESPONSE frag 0/3]
  VT=0x12 Len=54 MsgId=0x03 FrameInfo=0x03 (FrIdx=0, FrCnt=3)
Device → Host: HID Report [RPC REQUEST_RESPONSE frag 1/3]
  VT=0x12 Len=54 MsgId=0x03 FrameInfo=0x13 (FrIdx=1, FrCnt=3)
Device → Host: HID Report [RPC REQUEST_RESPONSE frag 2/3]
  VT=0x12 Len=30 MsgId=0x03 FrameInfo=0x23 (FrIdx=2, FrCnt=3)
[Host 重组 3 片 → 完整 RPC REQUEST_RESPONSE]

Host → Device: HID Report [CONTROL ACK]
  opcode=ACK, targetType=MESSAGE, messageId=0x03
```

**OTA（HID 场景，Stop-and-Wait）：**

```text
Host → Device: RPC REQUEST firmware.begin
  body: totalSize=1048576, chunkSize=48（适配 HID 58B 可用空间）
Device → Host: RPC REQUEST_RESPONSE firmware.begin
  body: streamId=0x01, ackMode=STOP_AND_WAIT

Host → Device: STREAM chunk seqId=0 [48B data]
  VT=0x13 Len=56 MsgId=0x06, streamId=0x01, seqId=0, cursor=0
Device → Host: CONTROL ACK seqId=0
Host → Device: STREAM chunk seqId=1 [48B data]
... (约 21845 次完成 1MB OTA)
```

### 6.3 错误处理

| 错误场景 | 处理方式 |
| --- | --- |
| CRC8 校验失败 | 发送 CONTROL NACK(FRAME_CRC_ERROR)，重传对应 Frame |
| 分片超时未完整到达 | 发送 CONTROL NACK(FRAME_REASSEMBLY_TIMEOUT)，重传整个 Message |
| USB 设备拔出 | 传输层断开，重新插入后重新 OPEN 握手 |

### 6.4 关键约束

```text
1. HID Report 边界即帧边界，Standard Profile 依赖 Magic 做额外校验，Compact Profile 依赖 Report 边界；
2. 每个 HID Report 承载一个 Frame（含分片），不跨 Report 拼接；
3. Compact FrameCount 最大 15，单个 Message 最大 15 × 58B = 870B；Standard 无此限制；
4. 超过单 Message 上限的数据必须通过 STREAM seqId/cursor 分块；
5. OTA chunkSize 应适配 HID 可用 Payload（Standard: ≤ 32B；Compact: ≤ 42B，扣除 STREAM Header 16B）；
6. HID 心跳间隔推荐 1s-5s。
```

---

## 7. 场景 D：BLE GATT 直连（Compact Frame Profile，含断线重连）

### 7.1 Profile 选择

| 项目 | 选择 |
| --- | --- |
| Frame Header Profile | Compact（ATT 有固定帧边界） |
| 可用 Payload | ~179B（185B ATT MTU - 4B Header - 1B CRC8 - 1B ATT opcode） |
| CRC | CRC8-MAXIM |
| ackMode | ON_DEMAND_ACK |
| RESUME | 支持（BLE 断线重连频繁） |
| 心跳间隔 | 5s-30s（低功耗要求） |

### 7.2 完整调用流程

**BLE 连接建立：**

```text
Central → Peripheral: BLE Scan / Connect Request
Peripheral → Central: BLE Connection Established
Central → Peripheral: ATT MTU Exchange (185B)
[BLE Connected, ATT MTU=185B]
```

**AXTP Session 建立：**

```text
Central → Peripheral: BLE ATT Write [CONTROL OPEN]
  [Compact Frame] VT=0x11 Len=N MsgId=0x01 FrameInfo=0x11
  opcode=OPEN controlId=0x0001 statusCode=0x0000
  body TLV: protocolVersion=1, headerProfile=COMPACT, maxFrameSize=179,
            mtu=179, supportedPayloadTypes=0x07,
            heartbeatIntervalMs=10000, ackMode=ON_DEMAND_ACK
Peripheral → Central: BLE ATT Notify [CONTROL ACCEPT]
  opcode=ACCEPT controlId=0x0001 statusCode=0x0000
  body TLV: sessionId=0xABCD1234, resumeToken=<16B token>,
            heartbeatIntervalMs=10000, ackMode=ON_DEMAND_ACK
[State: FRAMING_READY]
(resumeToken 保存到本地，用于断线恢复)
```

业务流程（Hello/Identify/Identified、capability.getAll、RPC、STREAM）与场景 C（HID）相同，使用 Compact Frame。

**BLE 断线与 RESUME：**

```text
[BLE 连接断开]
... (等待重连)
Central → Peripheral: BLE Reconnect
[BLE Connection Established]

Central → Peripheral: CONTROL RESUME
  body: sessionId=0xABCD1234, resumeToken=<16B token>,
        streamId=0x00000009（可选）, lastSeqId=673（可选）, offset=1376256（可选）
Peripheral → Central: CONTROL RESUME_ACK statusCode=SUCCESS
  body: sessionId=0xABCD1234, streamId=0x00000009, seqId=673, offset=1376256
[State: FRAMING_READY（恢复）]
(OTA 从 offset=1376256 继续，无需重传已确认数据)

Central → Peripheral: STREAM chunk seqId=674, cursor=1376256, data=[...]
... (继续 OTA)
```

**RESUME 失败（token 过期、设备重启）：**

```text
Central → Peripheral: CONTROL RESUME
Peripheral → Central: CONTROL RESUME_ACK statusCode=CONTROL_SESSION_INVALID
(降级为重新 OPEN 握手，OTA 从头开始)
```

### 7.3 错误处理

| 错误场景 | 处理方式 |
| --- | --- |
| BLE 断线 | 重连后发送 CONTROL RESUME，携带 resumeToken |
| RESUME token 过期 | 降级为重新 OPEN，OTA 从头开始 |
| ATT MTU 协商失败 | 使用默认 23B MTU，chunkSize 相应缩小 |

### 7.4 关键约束

```text
1. resumeToken 必须持久化到本地存储，断线后才能使用；
2. RESUME 携带的 lastSeqId/offset 必须是已收到 ACK 的最后一个值；
3. BLE 心跳间隔推荐 10s-30s，过短会增加功耗；
4. Compact FrameCount 最大 15，单个 Message 最大 15 × 179B ≈ 2.6KB；
5. OTA chunkSize 应适配 BLE 可用 Payload（≤ 179B - STREAM Header 16B = 163B）；
6. BLE 场景不建议并发多个 STREAM，带宽有限。
```

---

## 8. 场景 E：UART 直连（Compact Profile + COBS 帧边界）

### 8.1 传输层帧边界：COBS

UART 是字节流，Compact Profile 没有 Magic，必须在传输层增加帧边界机制。推荐使用 COBS（Consistent Overhead Byte Stuffing）：

```text
UART 字节流结构：
  [0x00] [COBS encoded AXTP Compact Frame] [0x00] [COBS encoded ...] [0x00]

0x00 作为帧分隔符，COBS 保证 Payload 中不出现 0x00。
接收方扫描 0x00 定位帧边界，解 COBS 后得到 Compact Frame。
```

### 8.2 Profile 选择

| 项目 | 选择 |
| --- | --- |
| Frame Header Profile | Compact（MCU 内存极小） |
| 帧边界 | COBS + 0x00 分隔符 |
| CRC | CRC8-MAXIM |
| rpcEncoding | BINARY + TLV |
| ackMode | ON_DEMAND_ACK |
| 心跳间隔 | 1s-5s（UART 无连接状态，需频繁心跳检测断线） |

### 8.3 完整调用流程

**Session 建立：**

```text
Host → Device: UART [0x00 + COBS(CONTROL OPEN) + 0x00]
  解 COBS 后: [Compact Frame] VT=0x11 Len=N MsgId=0x01 FrameInfo=0x11
  opcode=OPEN controlId=0x0001 statusCode=0x0000
  body TLV: protocolVersion=1, headerProfile=COMPACT, maxFrameSize=128,
        mtu=128, heartbeatIntervalMs=2000, ackMode=ON_DEMAND_ACK
Device → Host: UART [0x00 + COBS(CONTROL ACCEPT) + 0x00]
  opcode=ACCEPT controlId=0x0001 statusCode=0x0000
  body TLV: sessionId=0x00000001, heartbeatIntervalMs=2000
[State: FRAMING_READY]
```

**重同步（字节丢失场景）：**

```text
[接收到损坏数据，COBS 解码失败]
[等待下一个 0x00 分隔符，丢弃当前帧]
Host → Device: CONTROL NACK(FRAME_CRC_ERROR)（如果 CRC8 校验失败）
Device → Host: 重传上一帧
```

### 8.4 关键约束

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

Gateway 维护两条独立的 AXTP Session，负责 Profile 转换，不修改业务语义。

### 9.2 Gateway 职责

```text
1. 维护两条独立 Session：App↔Gateway（Standard）和 Gateway↔Device（Compact）
2. Standard Frame → 解析 → 提取 Payload → 重新封装为 Compact Frame → 发送给 Device
3. Compact Frame  → 解析 → 提取 Payload → 重新封装为 Standard Frame → 发送给 App
4. 不修改 Payload 内容（CONTROL / RPC / STREAM 语义不变）
5. 维护 SourceId/DestinationId 映射
```

### 9.3 Profile 转换规则

| 转换方向 | 操作 |
| --- | --- |
| Standard → Compact | 去掉 Magic(2B)、SourceId(1B)、DestinationId(1B)；MessageId 截断为 uint8；FrameIndex/FrameCount 压缩为 4bit；CRC16 → CRC8 |
| Compact → Standard | 补充 Magic(AX)、SourceId/DestinationId（从路由表查）；MessageId 扩展为 uint16；FrameIndex/FrameCount 扩展为 uint8；CRC8 → CRC16 |
| Payload | 不修改，原样透传 |

### 9.4 完整调用流程

**双侧 Session 建立：**

```text
App → Gateway: WS Binary CONTROL OPEN
Gateway → Device: BLE/HID CONTROL OPEN
Device → Gateway: BLE/HID CONTROL ACCEPT
Gateway → App: WS Binary CONTROL ACCEPT
[App-Gateway: FRAMING_READY] [Gateway-Device: FRAMING_READY]
```

**RPC 转发（亮度控制）：**

```text
App → Gateway: Standard RPC REQUEST display.setBrightness (requestId=0x00000003, value=80)
Gateway → Device: Compact RPC REQUEST display.setBrightness (requestId=0x00000003, value=80)
Device → Gateway: Compact RPC REQUEST_RESPONSE status.ok=true, status.code=SUCCESS
Gateway → App: Standard RPC REQUEST_RESPONSE status.ok=true, status.code=SUCCESS
Device → Gateway: Compact RPC EVENT display.brightnessChanged
Gateway → App: Standard RPC EVENT display.brightnessChanged
```

requestId 在转发时保持不变，确保 App 能正确匹配 Request/Response。

**STREAM 转发（OTA）：**

```text
App → Gateway: Standard RPC firmware.begin → Standard RPC REQUEST_RESPONSE streamId=0x09
App → Gateway: Standard STREAM chunk seqId=0 [4096B data]
Gateway: 将 4096B 数据按 BLE MTU 拆分为多个 Compact STREAM 分片
Gateway → Device: Compact STREAM frag 0, seqId=0, cursor=0 [163B]
Gateway → Device: Compact STREAM frag 1, seqId=0, cursor=163 [163B]
...
Device → Gateway: Compact ACK seqId=0
Gateway → App: Standard ACK seqId=0
```

### 9.5 关键约束

```text
1. Gateway 必须独立维护两侧的 Session 状态机，不能共享；
2. Gateway 侧 BLE/HID 断线时，应向 App 侧发送 CONTROL NACK 或 RPC ERROR；
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

### 10.2 路由规则

```text
App → Device A: SourceId=0x01, DestinationId=0x10
App → Device B: SourceId=0x01, DestinationId=0x11
Device A → App: SourceId=0x10, DestinationId=0x01
广播（App → 所有设备）: DestinationId=0x7F
```

### 10.3 完整调用流程

**多设备 Session 建立：**

```text
App → Gateway: OPEN (DstId=0x20)
Gateway → Device A: OPEN (DstId=0x10)
Gateway → Device B: OPEN (DstId=0x11)
Device A → Gateway: ACCEPT
Device B → Gateway: ACCEPT
Gateway → App: ACCEPT (body: connectedDevices=[0x10, 0x11])
[State: FRAMING_READY]
```

**定向 RPC（App → Device A）：**

```text
App → Gateway: RPC display.setBrightness (SrcId=0x01, DstId=0x10)
Gateway → Device A: RPC display.setBrightness (SrcId=0x01, DstId=0x10)
Device A → Gateway: RPC REQUEST_RESPONSE (SrcId=0x10, DstId=0x01)
Gateway → App: RPC REQUEST_RESPONSE (SrcId=0x10, DstId=0x01)
```

**广播 RPC（App → 所有设备）：**

```text
App → Gateway: RPC display.setBrightness (DstId=0x7F)
Gateway → Device A: RPC display.setBrightness
Gateway → Device B: RPC display.setBrightness
Device A → Gateway: RESPONSE
Device B → Gateway: RESPONSE
Gateway → App: RESPONSE (A)
Gateway → App: RESPONSE (B)
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

不使用 AXTP Frame Header。适用于浏览器 JS、curl、Postman、DevTools 等无法处理二进制帧的工具。**这不是生产路径。**

### 11.1 DS-RPC 消息格式

每条 WebSocket Text Message 是一个 JSON 对象：

```json
{
  "sid": "a1b2c3d4",
  "op": 1,
  "d": { ... }
}
```

| op 值 | 含义 |
| --- | --- |
| 0 | HELLO |
| 2 | IDENTIFY |
| 3 | IDENTIFIED |
| 6 | EVENT |
| 7 | REQUEST |
| 8 | REQUEST_RESPONSE |
| 9 | REQUEST_BATCH |
| 10 | REQUEST_BATCH_RESPONSE |

WebSocket 升级后设备进入 FRAMING_READY，并按 03《RPC 协议》执行 Hello/Identify/Identified 应用层握手。

### 11.2 完整调用流程

**连接建立：**

```text
Browser → Device: HTTP GET /axtp/debug (Upgrade: websocket)
Device → Browser: HTTP 101 Switching Protocols
[State: FRAMING_READY]
(Device 发送 Hello，等待 Identify)
```

**应用层身份认证：**

```text
Device → Browser: DS-RPC Hello
  {"sid":"","op":0,"d":{
    "challengeString":"<random>","authRequired":true,"rpcVersion":"2026.05"}}

Browser → Device: DS-RPC Identify
  {"sid":"","op":2,"d":{
    "clientName":"browser-debug","clientVersion":"1.0.0",
    "rpcVersion":"2026.05","authResponse":"<hmac-sha256>"}}

Device → Browser: DS-RPC Identified
  {"sid":"a1b2c3d4","op":3,"d":{
    "negotiatedRpcVersion":"2026.05"}}
[State: APP_READY, sid="a1b2c3d4"]
```

**业务 RPC：**

```text
Browser → Device: DS-RPC REQUEST display.setBrightness
  {"sid":"a1b2c3d4","op":7,"d":{"id":"00000002","method":"display.setBrightness","params":{"value":80}}}
Device → Browser: DS-RPC RESPONSE display.setBrightness
  {"sid":"a1b2c3d4","op":8,"d":{"id":"00000002","status":{"ok":true,"code":0}}}
Device → Browser: DS-RPC EVENT display.brightnessChanged
  {"sid":"a1b2c3d4","op":6,"d":{"event":"display.brightnessChanged","data":{"value":80,"previous":60}}}
```

**关闭：**

```text
Browser → Device: WebSocket Close Frame
Device → Browser: WebSocket Close Frame
[State: DISCONNECTED]
```

### 11.3 与 Framed Mode 的对应关系

| Debug Adapter（DS-RPC） | Framed Mode（AXTP） |
| --- | --- |
| WebSocket Upgrade | CONTROL OPEN/ACCEPT |
| Hello (op=0) | RPC Hello |
| Identify (op=2) | RPC Identify |
| Identified (op=3) | RPC Identified |
| REQUEST (op=7) | RPC REQUEST |
| REQUEST_RESPONSE (op=8) | RPC REQUEST_RESPONSE |
| EVENT (op=6) | RPC EVENT |
| WebSocket Close | CONTROL CLOSE |
| 无对应 | CONTROL HEARTBEAT（WebSocket 有 Ping/Pong） |
| 无对应 | CONTROL RESUME（Unframed 不支持） |
| 无对应 | STREAM（DS-RPC 不承载高吞吐数据面） |

Legacy 兼容：旧版 Debug Adapter 中的 `session.identify` 方法必须在适配层转换为 Identify(op=2)，不得进入 AXTP Method Registry。

### 11.4 关键约束

```text
1. sid 必须在每条消息中携带；首次 Hello 的 sid 为空字符串 ""；
2. DS-RPC 不承载 STREAM 数据，OTA/视频流必须使用 Framed Mode；
3. requestId 在 DS-RPC 中为 8 位十六进制字符串（如 "00000001"），内部解析为 uint32；
4. 不支持 RESUME，WebSocket 断线后重新连接并重新执行三步握手；
5. 生产环境不应暴露 DS-RPC 端点，仅用于开发调试。
```

---

## 12. 场景 I：老协议适配（Legacy Client → AXTP Adapter → Device）

### 12.1 拓扑

```text
+----------------+  旧协议  +----------+  AXTP  +----------+
| Legacy Client  | ←───────→ | Adapter  | ←─────→ |  Device  |
+----------------+           +----------+         +----------+
```

### 12.2 适配场景分类

| 旧协议类型 | 适配方式 |
| --- | --- |
| 旧 HID CmdValue | CmdValue → methodId 映射（通过 legacyMapping Registry） |
| 旧 JSON-RPC | rpcEncoding=JSON + methodId 映射（字段名可能需要重命名） |
| 旧 Binary RPC | rpcEncoding=BINARY + bodyEncoding=RAW_BYTES（旧 body 原样放入） |
| 旧 OTA/RawStream | STREAM + profile=legacy.tunnel（旧数据流透传） |
| 旧错误码 | errorCode Registry 映射 |

### 12.3 完整调用流程

**旧 HID CmdValue 适配：**

```text
Legacy Client → Adapter: 旧 HID Report (CmdValue=0x0042, Payload=[displayBrightness=80])
Adapter: 查 legacyMapping: CmdValue=0x0042 → methodId=display.setBrightness, params={value:80}
Adapter → Device: AXTP RPC REQUEST display.setBrightness, body: value=80 (TLV)
Device → Adapter: AXTP RPC REQUEST_RESPONSE status.ok=true, status.code=SUCCESS
Adapter: 反向映射 SUCCESS → 旧 ACK 格式
Adapter → Legacy Client: 旧 HID ACK (CmdValue=0x0042 OK)
```

**旧 JSON-RPC 适配：**

```text
Legacy Client → Adapter: {"method":"setBrightness","params":{"level":80},"id":1}
Adapter: 字段映射: setBrightness → display.setBrightness, params.level → params.value
Adapter → Device: AXTP RPC REQUEST display.setBrightness, body: value=80
Device → Adapter: AXTP RPC REQUEST_RESPONSE
Adapter → Legacy Client: {"result":{"ok":true},"id":1}
```

**旧 OTA 流适配（RAW_BYTES 透传）：**

```text
Legacy Client → Adapter: 旧 OTA Begin (totalSize=1048576)
Adapter → Device: AXTP RPC firmware.begin (totalSize=1048576, profile=legacy.ota)
Device → Adapter: AXTP RPC REQUEST_RESPONSE (streamId=0x09)
Adapter → Legacy Client: 旧 OTA Begin ACK

Legacy Client → Adapter: 旧 OTA Chunk [512B]
Adapter → Device: AXTP STREAM (streamId=0x09, seqId=0, bodyEncoding=RAW_BYTES, data=[512B])
Device → Adapter: AXTP ACK
Adapter → Legacy Client: 旧 OTA Chunk ACK
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
4. 如果旧协议无 Session 概念，Adapter 在旧客户端连接时自动发起 AXTP OPEN。
```

---
## 13. 场景对比总结

### 13.1 Frame Profile 选择速查

| 传输层 | Frame Profile | 理由 |
| --- | --- | --- |
| TCP | Standard | 字节流需要 Magic 同步；带宽充足 |
| WebSocket Binary | Standard | 消息边界由 WS 提供，但 Standard 保持一致性 |
| USB HID | Standard（默认）；Report Size ≤ 64B 时协商降级 Compact | Report 边界固定；Standard 优先，带宽紧张时降级 |
| BLE GATT | Compact | ATT 边界固定；MTU 小，节省开销 |
| UART | Compact + COBS | 无边界，需传输层 framing；MCU 内存小 |
| 网关（App 侧） | Standard | 需要 SourceId/DestinationId 路由 |
| 网关（Device 侧） | 取决于 Device 传输层 | BLE/UART → Compact；TCP/WS → Standard |

> Control Payload 固定 5B 头，不随 Frame Profile 变化。STREAM Payload 的 Standard/Compact 在 RPC 建流时单独协商。

### 13.2 Session 恢复能力

| 场景 | 支持 RESUME | 说明 |
| --- | --- | --- |
| TCP | 否 | TCP 断线即重新 OPEN |
| WebSocket Binary | 否 | WS 断线即重新 OPEN |
| USB HID | 否 | USB 拔插即重新 OPEN |
| BLE GATT | 是 | 断线重连后发送 RESUME，携带 resumeToken |
| UART | 否（可选） | UART 无连接状态，通常重新 OPEN |
| 网关 | 取决于 Device 侧 | Device 侧 BLE 支持 RESUME |

### 13.3 STREAM 支持能力

| 场景 | 支持 STREAM | 推荐 chunkSize | 说明 |
| --- | --- | --- | --- |
| TCP | 是 | 4096B | 带宽充足 |
| WebSocket Binary | 是 | 4096B | 同 TCP |
| USB HID | 是（受限） | ≤ 42B | HID Report 64B，扣除 Header 后约 42B |
| BLE GATT | 是（受限） | ≤ 163B | ATT MTU 185B，扣除 Header 后约 163B |
| UART | 不推荐 | ≤ 64B | 带宽约 11.5KB/s，OTA 极慢 |
| DS-RPC（场景 H） | 否 | — | DS-RPC 不承载 STREAM 数据面 |

### 13.4 调用流程通用骨架

无论哪种场景，AXTP 调用流程都遵循同一骨架：

```text
1. 传输层连接建立（TCP/WS/BLE/HID/UART）
2. CONTROL OPEN / ACCEPT（协商协议能力）← Framed Mode 必须；Unframed 跳过
   [State: FRAMING_READY]
3. RPC Hello（op=0，Server 推送）
4. RPC Identify（op=2，Client 回应）
5. RPC Identified（op=3，Server 确认）
   [State: APP_READY]
6. RPC capability.getAll
7. RPC device.getInfo
8. 业务 RPC（命令、查询、事件订阅）
9. STREAM（如需要：OTA、视频、文件）
10. CONTROL HEARTBEAT（保活，周期性）
11. CONTROL CLOSE / CLOSE_ACK（正常关闭）
12. 传输层断开
```

差异只在步骤 1（传输层）和步骤 2（Profile 选择），步骤 3-9 的业务语义完全一致。这正是 AXTP 统一协议栈的核心价值：**换传输层不换业务逻辑**。
