AXTP 链路建连与业务鉴权 (消除 Dual Hello) 设计规范

文档定位：解决 AXTP 协议在落地过程中，由于底层链路协商与上层业务鉴权都需要“打招呼”，从而产生的术语冲突（Dual Hello）与状态机设计问题。

一、 冲突分析：把 "Hello" 还给业务应用

在 AXTP 架构中，存在两种截然不同的连接准备工作：

纯底层设备环境（如 BLE、USB HID、UART）：这里的网络极其简陋，需要一种底层机制来协商 MTU、分片大小和协议版本。

上层 Web/App 环境（如 WebSocket JSON-RPC）：底层 TCP 已经解决了物理协商，业务层需要进行 Token 交换、鉴权挑战（Challenge）和客户端身份注册。

重新定调：
在现代 Web 和 App 接口设计中（如 obs-websocket、Discord API），客户端认证通常被命名为 Hello。这是一个非常符合人类直觉且被广泛接受的习惯。
因此，AXTP 规范将 Hello 的命名权正式授予 L7 业务层（RPC）。为了消除歧义，底层 L2 帧控制层的建连信令将采用网络工程中最经典的术语：CONNECT。

二、 核心解法：OSI 模型职责切割 (The "Two-Stage" Handshake)

这两个阶段并不冲突，它们是串行发生的，负责完全不同的生命周期：

阶段 1：底层链路建连 (Link CONNECT)

信令：PayloadType = CONTROL, Opcode = CONNECT / CONNECT_ACK

业界对标：类似 MQTT 的 CONNECT / CONNACK，或 TCP 的 SYN / SYN-ACK。

职责：只谈物理参数。协商 MTU、max_frame_size、version。

是否必须：在 BLE / HID / TCP 二进制流中必须发生。在 WebSocket JSON 纯文本流中不存在（直接跳过）。

处理模块：sonic_framer / sonic_transport (底层 C 代码拦截并自动回复 CONNECT_ACK，对业务层完全透明)。

阶段 2：应用层鉴权 (Application Hello)

信令：PayloadType = RPC, 方法名定义为 session.hello 或 直接使用 op: "Hello"

业界对标：类似 HTTP 的 Login 请求，或 WebSocket 规范中的 Hello Event。

职责：只谈业务。交换 ClientName、Auth Token、密码 Challenge、订阅初始事件。

是否必须：如果设备需要鉴权，则必须发生；如果是免密纯透传设备，可以跳过此步骤直接调用业务方法。

处理模块：RPC_Router / Auth_Manager (业务开发人员编写的回调函数)。

三、 统一状态机 (Unified State Machine)

设备端的 AXTP 引擎（Sonic Engine），每个连接 (Session) 必须维护一个清晰的状态机。
共有 4 个状态：DISCONNECTED -> LINK_CONNECTED -> FRAMING_READY -> APP_READY。

场景 A：蓝牙 (BLE) 或 二进制 TCP 连接（完整两阶段流程）

[App Client]                                       [Device AXTP Server]
     |                                                      |
     | ==(1) 物理连接建立 (BLE Connect / TCP Accept) =====> |
     |                                                      | [State: LINK_CONNECTED]
     |                                                      |
     | ==(2) CONTROL: CONNECT (MTU=64, Ver=1) ============> | (底层拦截，处理MTU)
     | <====== CONTROL: CONNECT_ACK (MTU=64) ============== | 
     |                                                      | [State: FRAMING_READY]
     |                                                      |
     | ==(3) RPC: session.hello (Token="xxx") ============> | (路由到业务鉴权层)
     | <====== RPC: Response (OK, CapList) ================ |
     |                                                      | [State: APP_READY]
     |                                                      |
     | ==(4) RPC: camera.setZoom (或发 Stream) ===========> | (正常业务通信)


防丢规则：如果设备处于 FRAMING_READY 但没完成 session.hello 鉴权，此时收到 camera.setZoom，RPC 层直接返回 ERROR_UNAUTHORIZED (0x0401)。

场景 B：WebSocket JSON 纯文本连接 (隐式跳过阶段 1)

依据 15 号规范，WebSocket JSON 形态下，不存在 AXTP 的 16 字节物理帧头。此时，Web 端的 WebSocket 连上后，底层直接视为完成底层协商，进入等待鉴权状态。

[Web Client]                                       [Device AXTP Server]
     |                                                      |
     | ==(1) WebSocket Upgrade (ws://...) ================> |
     |                                                      | [State: FRAMING_READY] (隐式跳过 CONTROL_CONNECT)
     |                                                      |
     | ==(2) JSON-RPC: {"method":"session.hello"} ========> | (路由到业务层)
     | <====== JSON-RPC: {"result": {"status": "ok"}} ===== |
     |                                                      | [State: APP_READY]
     |                                                      |
     | ==(3) JSON-RPC: {"method":"camera.setZoom"} =======> | (正常业务通信)


四、 规范修改与落地 Action Items

为了将这个极其清爽的逻辑彻底落实，请在 axtp-standard 仓库中执行以下规范对齐：

修改点 1：控制面使用 CONNECT (更新 02 规范)

在 02-AXTP-Control信令规范.md 中，将建连信令正式定名为 CONTROL_CONNECT 与 CONTROL_CONNECT_ACK。
并增加安全约束声明：

CONTROL_CONNECT 仅代表底层传输管道建立。收到 CONNECT_ACK 后，客户端必须依据业务层要求，发送 RPC 的 Hello 鉴权指令，否则无法调用受保护的 methodId。

修改点 2：业务面保留 Hello (更新 09 Registry 规范)

在 registry/methods.yaml 中，明确建立核心基建 RPC 方法：

session.hello (用于处理客户端身份上报、Token 校验与密码挑战)。这也完美兼容了纯 JSON 场景下直接发 {"op":"Hello"} 的旧习惯。

修改点 3：C++ SDK (sonic-engine) 的架构解耦

在 sonic-engine/src 的代码中，明确两个 Switch-Case 的位置：

网络 I/O 模块 (L2 Framer)：专门写一个 switch(control_opcode)，拦截 CONNECT，自动回复 CONNECT_ACK。这部分代码写死在引擎底层。

业务路由模块 (L3 Router)：专门写一个 switch(rpc_method)，拦截 session.hello，将其抛给应用层的 on_auth_callback。

五、 总结

通过这种设计，我们实现了“网络归网络，业务归业务”的极致解耦。底层 C++ 研发看到 CONNECT 就知道要设置缓冲区和 MTU；前端 Web 研发连上 WebSocket 后，依然可以像往常一样发一个熟悉的 Hello 对象完成登录。这既是代码洁癖的胜利，也是工程落地效率的最佳保障。