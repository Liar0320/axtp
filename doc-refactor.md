# AXTP 文档体系重构任务说明

请按照以下方案重构当前 AXTP 协议文档、registry/schema/generator 体系。目标是把当前分散、手写、业务内容混杂的协议文档，调整为“稳定规范层 + 协议定义层 + 生成产物层”的结构。

## 一、总体目标

当前协议体系中，Overview、08-13 文档、registry、schema、generator 的边界不够清晰。需要重构为以下模式：

text 08-13 定规则 Protocol Plan / Full Reference 定业务内容 protocol.yaml 定机器事实 protocol.md 定最终发布文档 

最终目标：

1. Overview 精简为协议架构入口，不再承载具体业务 method/event/schema。
2. 08-13 精简为 Protocol Definition 元规范，不再手写具体业务条目。
3. 新增或整理 Protocol Plan / Full Reference，作为全量业务内容和旧协议迁移参考。
4. 生成 protocol/axtp.protocol.yaml，作为唯一机器可读协议定义。
5. 根据 protocol.yaml 生成最终 generated/protocol.md、schema、SDK enum、bitmap、conformance tests。
6. protocol.md 不只是 method/event 列表，还要包含类似 obs-websocket protocol.md 的协议 overview、连接流程、架构说明、生产路径和兼容性说明。

---

## 二、文档层级调整

请将文档体系调整为三层。

### 1. 手写稳定层

这些文档长期稳定，只写协议原则、结构、元模型、治理规则：

text 00-AXTP-Overview.md 01-AXTP-Protocol-Framework.md 02-AXTP-Frame-and-Payload-Spec.md 03-AXTP-Transport-Profiles.md 04-AXTP-Control-Session-Spec.md 05-AXTP-RPC-Session-Spec.md 06-AXTP-Stream-Spec.md 07-AXTP-Compatibility-and-Versioning.md 08-AXTP-Protocol-Definition-Mapping-Spec.md 09-AXTP-Requests-Registry-Spec.md 10-AXTP-Events-Registry-Spec.md 11-AXTP-Errors-Registry-Spec.md 12-AXTP-Types-and-Capability-Spec.md 13-AXTP-Profiles-Registry-Spec.md 

### 2. 协议内容源

用于整合旧协议和全量业务内容，不作为最终发布协议：

text protocol-source/   AXTP-Protocol-Plan.md   AXTP-Protocol-Full-Reference.md   legacy-inputs/ 

其中 legacy-inputs 可包含现有旧协议素材：

text AXDP设备能力协议集.xlsx Commands_RPC.md VM33协议文档.pdf Rooms协议文档.pdf 数字标牌协议文档.pdf 

### 3. 机器定义与生成产物

text protocol/   axtp.protocol.yaml  generated/   protocol.md   schema/   cpp/   ts/   bitmap/   conformance/ 

---

## 三、Overview 重构要求

00-AXTP-Overview.md 必须精简，只保留架构性内容：

应包含：

1. AXTP 是什么。
2. 解决什么问题。
3. 支持哪些传输：TCP / WebSocket / USB HID / BLE / UART。
4. 核心分层：Transport Profile / Frame Profile / Payload Layer / RPC Session / Stream Session。
5. 三类 Payload：CONTROL / RPC / STREAM。
6. Frame Profile 固定绑定原则。
7. Protocol Definition 驱动原则。
8. v1 最小落地范围。
9. 非目标：v1 不实现完整 Capability，不把 HTTP JSON / WebSocket Text 作为生产 STREAM 路径。

不得包含：

1. 具体 method 列表。
2. 具体 event 列表。
3. 具体 errorCode 列表。
4. 具体业务能力字段。
5. 完整 schema。
6. 设备型号专属内容。

---

## 四、08-13 重构要求

08-13 不再作为具体业务注册表文档，而是作为 Protocol Definition 的元规范。

### 08：Protocol Definition Mapping Spec

定义：

1. JSON-RPC method name 如何映射 Binary methodId。
2. JSON-RPC id 如何映射 Binary requestId。
3. params/result 如何映射 TLV / CBOR / FixedStruct body。
4. event name 如何映射 eventId。
5. error 如何映射 statusCode / errorCode。
6. protocol.yaml 顶层结构。
7. overview、architecture、guide 区块如何生成到 protocol.md。

不得手写具体业务方法。

### 09：Requests Registry Spec

定义 requests: 条目的字段、约束和生成规则。

示例结构：

yaml requests:   - name: device.getInfo     methodId: 0x0101     domain: device     since: 1.0.0     status: stable     request:       type: Empty     response:       type: DeviceInfo     errors:       - INVALID_PARAMS       - DEVICE_BUSY 

必须规定：

1. methodId 唯一性。
2. name 必须采用 domain.action。
3. methodId stable 后不得复用。
4. request/response type 必须存在。
5. capability.supportedMethods bitmap 必须从 requests 自动派生。

不得手写完整 MethodId 表。

### 10：Events Registry Spec

定义 events: 条目的字段、约束和生成规则。

示例：

yaml events:   - name: device.statusChanged     eventId: 0x0201     domain: device     since: 1.0.0     status: stable     payload:       type: DeviceStatusChangedEvent 

不得手写完整 Event 表。

### 11：Errors Registry Spec

定义 errors: 条目的字段、错误码分段、JSON-RPC 与 Binary statusCode 映射规则。

示例：

yaml errors:   - name: INVALID_PARAMS     code: 0x0400     category: rpc     severity: error     message: Invalid parameters. 

不得手写完整错误码清单。

### 12：Types and Capability Spec

定义：

1. types: 如何描述结构。
2. fieldId 如何声明。
3. JSON Schema 如何生成。
4. TLV 编码表如何生成。
5. v1 Capability 只实现 capability.supportedMethods。
6. 完整 Capability Model 保留到 v2，不作为 v1 强制内容。

示例：

yaml types:   DeviceInfo:     fields:       - name: deviceId         fieldId: 1         type: string         required: true       - name: firmwareVersion         fieldId: 2         type: string         required: true 

### 13：Profiles Registry Spec

定义 profiles: 条目如何描述 MVP、HID、BLE、WS 等实现 Profile。

示例：

yaml profiles:   - name: AXTP-MVP-HID     requiredRequests:       - capability.supportedMethods       - device.getInfo     requiredEvents: []     transportProfiles:       - AXTP-HID-64     frameProfile: COMPACT_FRAME 

不得手写完整 MVP 清单，具体内容进入 protocol.yaml。

---

## 五、Protocol Definition 方案

新增 protocol/axtp.protocol.yaml，作为唯一机器可读协议定义。

它不是单纯 registry，而是完整协议定义，包含：

text protocol overview architecture guide frameProfiles transports payloadTypes control types requests events errors profiles 

推荐顶层结构：

yaml protocol:   name: AXTP   version: 1.0.0   specVersion: 1   registryVersion: 1.0.0  overview:   title: AXTP Protocol   summary: >     AXTP is a transport-independent device communication protocol designed for     control, binary RPC and high-throughput stream transfer across TCP,     WebSocket, USB HID, BLE and UART transports.   goals:     - Provide one unified protocol for control, RPC and stream data.     - Keep production clients small by using fixed frame profiles.     - Support both Standard and Compact binary paths.     - Keep full Capability modeling optional in v1.   nonGoals:     - Full dynamic UI capability modeling is not required in v1.     - WebSocket Text and HTTP JSON are debug or legacy adapter paths.     - STREAM is not carried over WebSocket Text or HTTP JSON in production.     - Header Profile is not negotiated dynamically in v1.  architecture:   layers:     - name: Transport Profile       description: Defines how AXTP runs over TCP, WebSocket, HID, BLE or UART.     - name: Frame Profile       description: Binds L1 Frame Header and L2 Payload Header into a fixed parser profile.     - name: Payload Layer       description: Carries CONTROL, RPC or STREAM payloads.     - name: RPC Session       description: Handles Hello, Identify, requests, responses, events and errors.     - name: Stream Session       description: Handles OTA, file, audio, video, log and sensor chunk transfer.    lifecycle:     - step: OPEN       from: Client       to: Server       description: Open an AXTP logical session and declare runtime limits.     - step: ACCEPT       from: Server       to: Client       description: Accept the session and return final runtime parameters.     - step: Hello       from: Server       to: Client       description: Announce RPC session rules, protocol version and authentication requirements.     - step: Identify       from: Client       to: Server       description: Submit client identity and optional authentication data.     - step: Identified       from: Server       to: Client       description: Confirm the RPC session is ready.     - step: capability.supportedMethods       from: Client       to: Server       description: Query the current session's supported method bitmap.  guide:   quickStart:     - title: Minimal Client Startup       steps:         - Connect using a Transport Profile.         - Send CONTROL OPEN.         - Wait for ACCEPT.         - Wait for Hello.         - Send Identify if required.         - Query capability.supportedMethods.         - Start RPC requests.  frameProfiles:   - name: STANDARD_FRAME     magic: "AXTP"     l1: STANDARD_L1     l2: STANDARD_L2   - name: COMPACT_FRAME     magic: 0xA7     l1: COMPACT_L1     l2: COMPACT_L2  transports:   - name: AXTP-WS     frameProfile: STANDARD_FRAME   - name: AXTP-TCP     frameProfile: STANDARD_FRAME   - name: AXTP-HID-64     frameProfile: COMPACT_FRAME     maxFrameSize: 64   - name: AXTP-BLE-RPC     frameProfile: COMPACT_FRAME 

---

## 六、当前已确定的协议设计决策

请将以下决策落入文档和 protocol.yaml。

### 1. Header / Frame Profile

v1 不做动态 Header 协商。

规则：

text Transport Profile 决定 Frame Profile。 Frame Profile 绑定 L1 和 L2。 Magic 决定 Frame Profile。 OPEN / ACCEPT / READY / Hello / RPC / Event / Control 均使用该 Transport Profile 对应的 Frame Profile。 

固定绑定：

text STANDARD_FRAME = STANDARD_L1 + STANDARD_L2 COMPACT_FRAME  = COMPACT_L1 + COMPACT_L2 

不支持 v1 混搭：

text STANDARD_L1 + COMPACT_L2 COMPACT_L1 + STANDARD_L2 

推荐映射：

text AXTP-WS        -> STANDARD_FRAME AXTP-TCP       -> STANDARD_FRAME AXTP-HID-64    -> COMPACT_FRAME AXTP-BLE-RPC   -> COMPACT_FRAME AXTP-UART      -> COMPACT_FRAME_CRC 或 COMPACT_FRAME 

### 2. L2 Payload Header

L2 Payload Header 不跟随 Standard/Compact 拆两套，除 Frame/Profile 外，Payload Header 尽量统一。

当前决策：

text Control Payload：统一 5B 固定头，所有传输场景共用。 RPC Binary Payload：统一 11B 固定头，所有传输场景共用。 STREAM Payload：统一 16B 固定头，所有生产传输场景共用。 

不要保留 8B Stream Header。

原因：

1. 8B header 的 seqId 太短，约 10MB 级别就会回绕。
2. STREAM 是长生命周期数据面，需要支持 OTA、文件、日志、音视频、resume、retransmit。
3. 为节省 8 字节引入 8B/16B 协商不划算。
4. v1 应统一 16B Stream Header。

推荐 Stream Header：

c struct AxtpStreamHeader {     uint32_t streamId;     uint32_t seq;     uint32_t position;     uint16_t chunkLength;     uint16_t flags; }; 

### 3. CONTROL / OPEN / ACCEPT / READY

默认流程：

text Client -> Server: OPEN Server -> Client: ACCEPT Server -> Client: Hello Client -> Server: Identify Server -> Client: Identified Client -> Server: capability.supportedMethods 

如果某些传输需要第三步确认，命名为：

text READY 

三步流程：

text Client -> Server: OPEN Server -> Client: ACCEPT Client -> Server: READY Server -> Client: Hello 

READY 语义：

text Client 已收到 ACCEPT，已应用 Server 裁定的运行参数，并准备好接收后续 AXTP 帧。 

### 4. Capability

v1 保留 capability 域，但不实现完整 Capability Model。

v1 只实现：

text capability.supportedMethods 

语义：

text 返回当前设备、当前固件、当前会话、当前鉴权状态下支持的 methodId 集合。 

capability.supportedMethods 使用 Method Bitmap。

完整 capability.getAll / capability.query / capability schema 留到 v2。

### 5. WebSocket Text / HTTP JSON

WebSocket Text / HTTP JSON 只作为 Debug 或 Legacy Adapter。

不得作为生产必选路径。

不得承载正式 STREAM。

不得参与 CONTROL ACK/NACK / RESUME。

---

## 七、Protocol Plan / Full Reference

请新增或整理：

text protocol-source/AXTP-Protocol-Full-Reference.md protocol-source/AXTP-Protocol-Plan.md 

### AXTP-Protocol-Full-Reference.md

用于整合旧协议中的业务内容，包括：

1. Commands_RPC.md 中的 RPC 命令。
2. AXDP 设备能力表中的设备能力。
3. VM33 / Rooms / 数字标牌协议中的业务命令和字段。
4. 旧错误码。
5. 旧事件。
6. 旧属性与状态字段。

该文件是业务参考，不是最终规范。

### AXTP-Protocol-Plan.md

用于说明：

1. 哪些业务域进入 v1。
2. 哪些业务域推迟到 v2。
3. 旧命令如何映射到 AXTP request。
4. 旧事件如何映射到 AXTP event。
5. 旧错误码如何映射到 AXTP error。
6. methodId / eventId / errorCode 分配策略。
7. v1 MVP Profile 需要哪些 request/event/type/error。
8. 哪些 schema 需要合并或重命名。

---

## 八、protocol.md 生成要求

generated/protocol.md 不能只是 method/event 表。

它应该类似 obs-websocket 的 protocol.md，包含协议介绍和 API Reference 两部分。

推荐结构：

text # AXTP Protocol  ## 1. Overview ## 2. Design Goals ## 3. Non-Goals ## 4. Architecture ## 5. Transport Profiles ## 6. Frame Profiles ## 7. Payload Types ## 8. Connection Lifecycle ## 9. Authentication Lifecycle ## 10. Capability Discovery in v1 ## 11. Stream Transfer Model ## 12. JSON-RPC and Binary-RPC Mapping ## 13. Production and Debug Paths ## 14. Compatibility Rules  # Reference  ## 15. Requests ## 16. Events ## 17. Types ## 18. Errors ## 19. Profiles ## 20. Method Bitmap Layout 

前半部分来自：

text protocol.overview protocol.architecture protocol.guide frameProfiles transports payloadTypes control stream compatibility 

后半部分来自：

text requests events types errors profiles 

---

## 九、生成器 / 编译器命名

不要把工具对外叫 generator。

推荐改名为：

text axtpc AXTP Protocol Compiler 

命令形式可以是：

bash axtpc validate protocol/axtp.protocol.yaml axtpc build protocol/axtp.protocol.yaml axtpc emit docs axtpc emit schema axtpc emit cpp axtpc emit ts axtpc emit bitmap axtpc emit conformance 

对外表述：

text AXTP 使用单一 Protocol Definition 文件描述全部 requests、events、types、errors、profiles、frameProfiles 和 transports。axtpc 从该定义生成 Markdown 协议文档、JSON Schema、C/C++/TypeScript 枚举、Method Bitmap 和一致性测试。 

---

## 十、兼容性和稳定性规则

08-13 必须固定以下治理规则：

1. specVersion 和 registryVersion 分离。
2. 08-13 的正文为 Normative Core，长期稳定。
3. 新增 method/event/error/profile 不应修改 08-13，只修改 protocol.yaml。
4. stable 的 methodId/eventId/errorCode 不得复用。
5. stable 条目不得删除，只能 deprecated。
6. schema 只能向后兼容扩展。
7. TLV fieldId 不得复用。
8. 未知 extension 字段必须被通用工具忽略。
9. generated 目录下的文件不得手写修改。
10. CI 必须验证 protocol.yaml 的唯一性、schema 完整性、ID 范围、引用完整性和 bitmap 生成一致性。

---

## 十一、执行顺序

请按以下顺序修改：

1. 精简 00-AXTP-Overview.md。
2. 重写 08-13，使其成为 Protocol Definition 元规范。
3. 新增 protocol-source/AXTP-Protocol-Full-Reference.md。
4. 新增 protocol-source/AXTP-Protocol-Plan.md。
5. 新增 protocol/axtp.protocol.yaml 初版。
6. 设计 axtpc 输入输出契约。
7. 生成或准备 generated/protocol.md 的模板结构。
8. 确保 protocol.md 前半部分包含 Overview / Architecture / Lifecycle / Compatibility，后半部分才是 Requests / Events / Types / Errors Reference。
9. 确保 capability v1 只包含 capability.supportedMethods。
10. 确保 Stream Header 统一为 16B。
11. 确保 Header/Profile v1 不做动态协商，而是由 Transport Profile 固定选择 Frame Profile。

---

## 十二、最终交付物

请最终给出以下文件或变更：

text 00-AXTP-Overview.md 08-AXTP-Protocol-Definition-Mapping-Spec.md 09-AXTP-Requests-Registry-Spec.md 10-AXTP-Events-Registry-Spec.md 11-AXTP-Errors-Registry-Spec.md 12-AXTP-Types-and-Capability-Spec.md 13-AXTP-Profiles-Registry-Spec.md  protocol-source/AXTP-Protocol-Full-Reference.md protocol-source/AXTP-Protocol-Plan.md  protocol/axtp.protocol.yaml  generated/protocol.md 或 docs/generated/protocol.md 的模板/初版 

实现时请注意：08-13 不要再放具体业务列表，具体业务内容应该进入 protocol.yaml 或 protocol-source。