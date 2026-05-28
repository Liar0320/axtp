是的，这部分应该主要放在 03《AXTP Transport Profiles》里，但不要只放在 03。更准确的拆法是：

01：定义“物理角色”和“逻辑角色”可以分离的总原则
03：完整列出各 Transport/Profile 的连接流程、Header Profile、角色映射
04：只定义 OPEN / ACCEPT / READY 的抽象状态机
05：只定义 Hello / Identify / Identified 的 RPC 会话状态机

也就是说：

03 负责“某种传输场景下到底谁先连、谁发 OPEN、谁发 Hello、用什么 Frame Profile”。
04/05 负责“这些消息本身的通用语义”。

⸻

1. 你这个“物理 Server / 逻辑 Server 反转”的判断非常重要

AXTP 里必须明确区分两个概念：

Physical Client / Physical Server
Logical Client / Logical Server

Physical Client / Server

指底层连接方向：

TCP connect 的发起方 = Physical Client
TCP listen/accept 的一方 = Physical Server
WebSocket connect 的发起方 = Physical Client
WebSocket endpoint 提供方 = Physical Server
USB HID Host/App = Physical Client
USB HID Device = Physical Server
BLE Central/App = Physical Client
BLE Peripheral/Device = Physical Server

Logical Client / Server

指 AXTP 业务角色：

Logical Client = 控制者 / 调用者 / UI / 云端控制面
Logical Server = 能力提供者 / 设备能力拥有者

普通本地设备连接里，二者通常一致：

App / PC / Cloud Gateway = Physical Client + Logical Client
Device                 = Physical Server + Logical Server

但云端反连场景会反转：

Device 主动连接 Cloud WebSocket
Device = Physical Client + Logical Server
Cloud  = Physical Server + Logical Client

这个必须写进规范，否则 Hello 方向会让实现者困惑。

⸻

2. 核心规则：Hello 永远由 Logical Server 发，不由 Physical Server 发

这是最关键的抽象。

你不应该把 Hello 的发送方绑定成“TCP Server”或“WebSocket Server”。

应该定义为：

Hello MUST be sent by the AXTP Logical Server.

也就是：

谁提供能力，谁发 Hello。
谁拥有 method/event/stream/capability，谁是 Logical Server。

所以：

本地 TCP / HID / BLE 场景

设备是 Physical Server
设备也是 Logical Server
所以设备发 Hello

Cloud WebSocket 反连场景

Cloud 是 Physical Server
设备是 Physical Client
但设备仍然是能力提供者
所以设备是 Logical Server
因此设备主动连接 Cloud 后，仍然由设备发 Hello

这不是破坏协议，而是把协议从“物理连接方向”中解耦出来。

⸻

3. OPEN 由谁发？

这里要比 Hello 更谨慎。

我建议定义：

OPEN 由 Physical Client 发起，用于打开底层 AXTP 逻辑通道。
Hello 由 Logical Server 发起，用于打开 RPC 业务会话。

这样就能同时解释所有场景。

普通 HID / TCP / BLE

App 是 Physical Client
App 发送 OPEN
Device 是 Physical Server
Device 回复 ACCEPT
Device 是 Logical Server
Device 发送 Hello

流程：

App/Client  -> Device/Server: OPEN
Device      -> App: ACCEPT
Device      -> App: Hello
App         -> Device: Identify
Device      -> App: Identified
App         -> Device: capability.supportedMethods

设备反连 Cloud WebSocket

Device 是 Physical Client
Device 发送 OPEN
Cloud 是 Physical Server
Cloud 回复 ACCEPT
Device 是 Logical Server
Device 发送 Hello
Cloud 是 Logical Client
Cloud 发送 Identify
Device 回复 Identified
Cloud 查询 capability.supportedMethods

流程：

Device      -> Cloud: OPEN
Cloud       -> Device: ACCEPT
Device      -> Cloud: Hello
Cloud       -> Device: Identify
Device      -> Cloud: Identified
Cloud       -> Device: capability.supportedMethods

这非常干净。

⸻

4. 03 文档应该新增一章：Connection Role Mapping

建议在 03《Transport Profiles》里新增：

## Transport Connection Role Mapping

内容包括四张表。

⸻

4.1 通用角色定义表

角色	含义	负责动作
Physical Client	底层连接发起方	建立 transport connection，发送 OPEN
Physical Server	底层监听/接收方	接收 OPEN，返回 ACCEPT/REJECT
Logical Client	AXTP 调用方 / 控制方	Identify，调用 request，订阅 event
Logical Server	AXTP 能力提供方	发送 Hello，校验 Identify，提供 methods/events/streams

核心规则：

OPEN follows the physical connection direction.
Hello follows the logical service direction.

中文：

OPEN 顺着物理连接方向发送。
Hello 顺着逻辑服务方向发送。

这句话非常关键。

⸻

4.2 场景矩阵

Transport Profile	Physical Client	Physical Server	Logical Client	Logical Server	Frame Profile	Hello Sender
AXTP-TCP-LOCAL	App/PC	Device	App/PC	Device	STANDARD_FRAME	Device
AXTP-WS-LOCAL	App/PC	Device	App/PC	Device	STANDARD_FRAME	Device
AXTP-HID-64	Host/App	HID Device	Host/App	Device	COMPACT_FRAME	Device
AXTP-BLE-RPC	Central/App	Peripheral Device	App	Device	COMPACT_FRAME	Device
AXTP-UART	Initiator	Responder	Usually Host	Usually Device	COMPACT_FRAME_CRC	Device
AXTP-WS-CLOUD-REVERSE	Device	Cloud	Cloud	Device	STANDARD_FRAME	Device
AXTP-TCP-CLOUD-REVERSE	Device	Cloud	Cloud	Device	STANDARD_FRAME	Device

这个表应该放在 03。

⸻

5. 连接流程示例也放在 03

03 不仅要写表，还要写每个场景的完整时序。

5.1 本地 TCP / WebSocket 到设备

Transport Profile: AXTP-TCP-LOCAL / AXTP-WS-LOCAL
Frame Profile: STANDARD_FRAME
Physical Client: App / PC
Physical Server: Device
Logical Client: App / PC
Logical Server: Device
App/PC  -> Device: TCP/WebSocket connect
App/PC  -> Device: CONTROL OPEN
Device  -> App/PC: CONTROL ACCEPT
Device  -> App/PC: RPC Hello
App/PC  -> Device: RPC Identify
Device  -> App/PC: RPC Identified
App/PC  -> Device: capability.supportedMethods

⸻

5.2 USB HID 到设备

Transport Profile: AXTP-HID-64
Frame Profile: COMPACT_FRAME
Physical Client: USB Host / App
Physical Server: HID Device
Logical Client: Host / App
Logical Server: Device
Host/App -> Device: HID open/report channel ready
Host/App -> Device: CONTROL OPEN
Device   -> Host/App: CONTROL ACCEPT
Device   -> Host/App: RPC Hello
Host/App -> Device: RPC Identify
Device   -> Host/App: RPC Identified
Host/App -> Device: capability.supportedMethods

⸻

5.3 BLE 到设备

Transport Profile: AXTP-BLE-RPC
Frame Profile: COMPACT_FRAME
Physical Client: BLE Central / App
Physical Server: BLE Peripheral / Device
Logical Client: App
Logical Server: Device
App      -> Device: BLE scan/connect/discover characteristics
App      -> Device: CONTROL OPEN
Device   -> App: CONTROL ACCEPT
Device   -> App: RPC Hello
App      -> Device: RPC Identify
Device   -> App: RPC Identified
App      -> Device: capability.supportedMethods

⸻

5.4 设备反连 Cloud WebSocket

这是你重点提到的场景，必须单独写。

Transport Profile: AXTP-WS-CLOUD-REVERSE
Frame Profile: STANDARD_FRAME
Physical Client: Device
Physical Server: Cloud
Logical Client: Cloud
Logical Server: Device
Device -> Cloud: WebSocket connect
Device -> Cloud: CONTROL OPEN
Cloud  -> Device: CONTROL ACCEPT
Device -> Cloud: RPC Hello
Cloud  -> Device: RPC Identify
Device -> Cloud: RPC Identified
Cloud  -> Device: capability.supportedMethods

解释：

Although Cloud is the WebSocket server, it is not the AXTP Logical Server in this profile.
The device is still the AXTP Logical Server because it owns the exposed methods, events and streams.
Therefore the device sends Hello after the AXTP link is accepted.

中文：

虽然 Cloud 是 WebSocket 物理服务端，但在该 Profile 中，Cloud 是 AXTP Logical Client。
设备主动连接 Cloud，但设备仍然是能力提供者，因此设备是 AXTP Logical Server。
所以 ACCEPT 后由设备发送 Hello。

⸻

6. 这会不会破坏“Server 回复 ACCEPT 后立即 Hello”的设计？

不会，只是要改成更精确的说法。

原来如果写成：

Server sends Hello after ACCEPT.

应该改成：

Logical Server sends Hello after the link is accepted.

但在反连 Cloud 场景中，ACCEPT 是 Cloud 发的，Hello 是 Device 发的，所以不能要求“发 ACCEPT 的一方发 Hello”。

更通用的规则应该是：

After ACCEPT, the AXTP Logical Server MUST send Hello.

然后根据场景：

场景	ACCEPT 发送方	Hello 发送方	是否同一方
本地 TCP / HID / BLE	Device	Device	是
Cloud Reverse WS	Cloud	Device	否

所以原先“ACCEPT + Hello 连发”只适用于：

Physical Server == Logical Server

比如本地设备场景。

对于 Cloud Reverse：

Physical Server != Logical Server

不能连发 ACCEPT + Hello，因为 ACCEPT 在 Cloud，Hello 在 Device。

流程自然多一个方向切换：

Device -> Cloud: OPEN
Cloud  -> Device: ACCEPT
Device -> Cloud: Hello

这仍然是合理的。

⸻

7. 要不要把这个放进 04/05？

03 写完整场景。

04 和 05 只需要补抽象规则。

04 Control Session 应补充

OPEN is sent by the Physical Client of the selected Transport Profile.
ACCEPT or REJECT is sent by the Physical Server.
OPEN/ACCEPT establishes the AXTP link session only. It does not determine which endpoint is the Logical Server.

中文：

OPEN 由当前 Transport Profile 的 Physical Client 发送。
ACCEPT/REJECT 由 Physical Server 返回。
OPEN/ACCEPT 只建立 AXTP Link Session，不决定哪一端是 Logical Server。

⸻

05 RPC Session 应补充

Hello is sent by the AXTP Logical Server after the AXTP link session is accepted.
The Logical Server is the endpoint that owns and exposes AXTP requests, events, streams and capability data.
In most local device profiles, Physical Server and Logical Server are the same endpoint. In reverse cloud connection profiles, the Physical Client may be the Logical Server.

中文：

Hello 由 AXTP Logical Server 在 Link Session 被接受后发送。
Logical Server 是拥有并暴露 AXTP requests、events、streams 和 capability 数据的一端。
在大多数本地设备 Profile 中，Physical Server 与 Logical Server 是同一端。在云端反连 Profile 中，Physical Client 可能是 Logical Server。

⸻

8. protocol.yaml 里也应该表达这个

以后 protocol.yaml 的 transports 里建议增加：

transports:
  - name: AXTP-WS-CLOUD-REVERSE
    transport: websocket
    frameProfile: STANDARD_FRAME
    physicalClient: device
    physicalServer: cloud
    logicalClient: cloud
    logicalServer: device
    openSender: physicalClient
    acceptSender: physicalServer
    helloSender: logicalServer

本地 HID：

transports:
  - name: AXTP-HID-64
    transport: hid
    frameProfile: COMPACT_FRAME
    physicalClient: host
    physicalServer: device
    logicalClient: host
    logicalServer: device
    openSender: physicalClient
    acceptSender: physicalServer
    helloSender: logicalServer

这样生成的 protocol.md 就能自动生成每个 Profile 的连接流程。

⸻

9. 最终建议

你的这个内容应该这样落地：

01：增加角色分离原则
03：完整展开每个 Transport Profile 的角色映射、Header/Profile、连接流程
04：定义 OPEN/ACCEPT 跟随 Physical Client/Server
05：定义 Hello 跟随 Logical Server
protocol.yaml：在 transports 中加入 physical/logical role mapping
protocol.md：自动生成“Connection Lifecycle by Transport Profile”

最关键的一句话是：

OPEN follows the physical connection direction; Hello follows the logical service direction.

中文可以定成：

OPEN 顺着物理连接方向发送；Hello 顺着逻辑服务方向发送。

这句话能彻底解释：

本地 TCP/HID/BLE：设备既是物理 Server，也是逻辑 Server，所以设备发 Hello。
Cloud Reverse WebSocket：设备是物理 Client，但仍是逻辑 Server，所以设备主动连接云端后，由设备发 Hello。