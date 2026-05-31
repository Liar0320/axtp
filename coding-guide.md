# AXTP C++ Runtime 渐进式实现 Roadmap

本文档用于指导 Codex / AI Agent / 开发者逐步实现 AXTP C++ Runtime。  
目标是按照清晰的分层边界，从当前 AXTP 协议解析开始，逐步扩展到 Transport、Broker、业务层和 Legacy 老协议兼容。

---

## 1. 总体目标

第一阶段实现一套可维护、可测试、可逐步扩展的 AXTP C++ Runtime。

最终目标架构：

text Transport   ↓ AxtpInboundProcessor   ↓ AxtpCore   ↓ AxtpBroker   ↓ Business Layer  Business Result   ↓ AxtpBroker   ↓ AxtpCore   ↓ AxtpOutboundProcessor   ↓ Transport 

核心原则：

text 1. Transport 只负责 bytes in/out，不解析协议。 2. AxtpInboundProcessor 只负责 bytes -> Frame -> Message -> Payload。 3. AxtpOutboundProcessor 只负责 Payload -> Message -> Frame -> bytes。 4. AxtpCore 负责协议状态、Session、RPC、Stream、PendingCalls。 5. AxtpBroker 负责业务调度、中间件、队列、流控、日志、业务路由。 6. Business Layer 只处理强类型业务对象，不接触 Frame/Message/Raw bytes。 7. Legacy 老协议兼容只能出现在 legacy/ 和 mux/ 目录，不得污染 Core/Broker/Business。 8. AxtpCore 不持有线程；Transport 可以持有 I/O 线程；Broker/Executor 可以持有业务线程。 

---

## 2. 最终命名定稿

### 2.1 协议核心

text AxtpCore 

职责：

text - 协议核心 - 处理归一化后的 ControlPayload / RpcPayload / StreamPayload - 管理 ControlSession / RpcDispatcher / StreamSession - 管理 SessionManager / PendingCallTable - 根据 SessionContext 决定出站走 AXTP 或 Legacy 

---

### 2.2 入站处理链

text AxtpInboundProcessor   - FrameDecoder   - MessageReassembler   - PayloadDecoder   - JsonRpcDecoder 

职责：

text Transport bytes   -> FrameDecoder   -> MessageReassembler   -> PayloadDecoder   -> ControlPayload / RpcPayload / StreamPayload 

说明：

text MessageReassembler 使用 Reassembler，而不是 Assembler， 因为它负责把被 Frame 分片拆开的 Message 重新组装回来。 

---

### 2.3 出站处理链

text AxtpOutboundProcessor   - PayloadEncoder   - MessageFragmenter   - FrameEncoder   - JsonRpcEncoder 

职责：

text ControlPayload / RpcPayload / StreamPayload   -> PayloadEncoder   -> MessageFragmenter   -> FrameEncoder   -> Transport bytes 

---

### 2.4 Transport

text ITransport TcpTransport WebSocketTransport HidTransport BleTransport UartTransport MockTransport 

职责：

text - 真实 I/O - bind(IByteSink&) - open() - close() - sendBytes() - profile() 

Transport 不得解析 Frame、Message、Payload、MethodId。

---

### 2.5 Broker

text AxtpBroker   - BrokerTask   - BrokerContext   - MiddlewareChain   - BusinessRouter   - BrokerFlowControl   - BusinessExecutor 

职责：

text - 接收 AxtpCore 投递的业务任务 - 运行中间件 - 执行权限、校验、限流、日志 - 路由 methodId/eventId/streamId - 投递业务队列 - 执行业务 handler - 将结果回传给 AxtpCore 

---

### 2.6 Legacy 兼容层

text ProtocolMux LegacyProtocolAdapter LegacyFrameDecoder LegacyFrameEncoder LegacyCommand LegacyMethodMapper LegacyErrorMapper 

职责：

text Legacy bytes   -> LegacyProtocolAdapter   -> normalized RpcPayload / StreamPayload / ControlPayload   -> AxtpCore 

Legacy 逻辑不得出现在 AxtpBroker 和 Business Layer 中。

---

## 3. 推荐目录结构

text include/axtp/   model/     bytes.h     result.h     error.h     frame.h     message.h     payload.h     protocol_types.h    io/     byte_reader.h     byte_writer.h     byte_buffer.h     byte_sink.h     byte_writer_sink.h    inbound/     axtp_inbound_processor.h     frame_decoder.h     message_reassembler.h     payload_decoder.h     json_rpc_decoder.h    outbound/     axtp_outbound_processor.h     payload_encoder.h     message_fragmenter.h     frame_encoder.h     json_rpc_encoder.h    core/     axtp_core.h     control_session.h     rpc_dispatcher.h     stream_session.h     session_context.h     session_manager.h     pending_call_table.h    transport/     transport.h     transport_profile.h     mock_transport.h     tcp_transport.h     websocket_transport.h     hid_transport.h     ble_transport.h     uart_transport.h    broker/     axtp_broker.h     broker_task.h     broker_context.h     middleware_chain.h     business_router.h     broker_flow_control.h     business_executor.h    legacy/     legacy_protocol_adapter.h     legacy_frame_decoder.h     legacy_frame_encoder.h     legacy_command.h     legacy_method_mapper.h     legacy_error_mapper.h    mux/     protocol_mux.h    generated/     method_traits.h     schema_types.h     schema_codec.h     legacy_method_map.h  src/   inbound/   outbound/   core/   transport/   broker/   legacy/   mux/ 

---

## 4. 基础模型

### 4.1 Protocol Types

cpp using Bytes = std::vector<uint8_t>;  enum class PayloadType : uint8_t {     Control = 0x01,     Rpc     = 0x02,     Stream  = 0x03, };  enum class RpcOp : uint8_t {     Request  = 0x01,     Response = 0x02,     Event    = 0x03,     Error    = 0x04, };  enum class RpcEncoding : uint8_t {     Json   = 0x01,     Binary = 0x02, };  enum class SourceProtocol : uint8_t {     AxtpV1 = 0x01,     Legacy = 0x02, };  enum class ProtocolMode : uint8_t {     AxtpV1,     Legacy,     AutoDetect, }; 

---

### 4.2 Frame / Message / Payload

cpp struct FrameHeader {     uint8_t version = 1;     PayloadType payloadType = PayloadType::Rpc;     uint8_t flags = 0;     uint16_t fragmentIndex = 0;     uint32_t messageId = 0;     uint32_t payloadLength = 0; };  struct Frame {     FrameHeader header;     Bytes payload; };  struct Message {     uint32_t messageId = 0;     PayloadType payloadType = PayloadType::Rpc;     Bytes body; };  struct PayloadMeta {     SourceProtocol sourceProtocol = SourceProtocol::AxtpV1;     uint32_t sessionId = 0;     uint32_t requestId = 0;     uint32_t legacySequence = 0; };  struct RpcPayload {     RpcOp op = RpcOp::Request;     RpcEncoding encoding = RpcEncoding::Binary;     uint32_t requestId = 0;     uint32_t methodOrEventId = 0;     PayloadMeta meta;     Bytes body; };  struct ControlPayload {     uint8_t opcode = 0;     PayloadMeta meta;     Bytes body; };  struct StreamPayload {     uint32_t streamId = 0;     uint32_t sequence = 0;     PayloadMeta meta;     Bytes data; }; 

---

## 5. Phase 1：基础模型与 Byte IO

### 目标

实现所有层共享的基础对象和字节读写工具。

### 需要实现

text model/   bytes.h   result.h   error.h   frame.h   message.h   payload.h   protocol_types.h  io/   byte_reader.h   byte_writer.h   byte_buffer.h 

### Codex 任务

text 实现 AXTP 基础模型层。  要求： 1. 不依赖 Transport。 2. 不依赖 AxtpCore。 3. 不包含业务逻辑。 4. ByteReader / ByteWriter 使用 little-endian。 5. Frame / Message / Payload 类型可以独立 include。 6. 提供基础单元测试。 

### 验收标准

text 1. ByteReader/ByteWriter 可读写 u8/u16/u32/u64。 2. ByteBuffer 支持 append、consume、peek。 3. Frame/Message/Payload 类型可编译通过。 4. 不出现业务 method handler。 

---

## 6. Phase 2：实现 AxtpInboundProcessor

### 目标

完整实现当前协议版本的入站解析。

text bytes   -> FrameDecoder   -> Frame   -> MessageReassembler   -> Message   -> PayloadDecoder   -> ControlPayload / RpcPayload / StreamPayload 

---

### 6.1 IByteSink

cpp class IByteSink { public:     virtual ~IByteSink() = default;     virtual void onBytes(const uint8_t* data, size_t size) = 0; }; 

---

### 6.2 FrameDecoder

职责：

text 1. 接收任意大小 bytes。 2. 处理半包、粘包、多包。 3. 校验 magic/version/headerSize/payloadLength。 4. 输出 Frame。 5. 不理解 Message。 6. 不理解 Payload。 7. 不理解 RPC。 

接口：

cpp class IFrameSink { public:     virtual ~IFrameSink() = default;     virtual void onFrame(Frame frame) = 0; };  class FrameDecoder { public:     explicit FrameDecoder(IFrameSink& next);      void onBytes(const uint8_t* data, size_t size);  private:     void parseLoop();  private:     IFrameSink& next_;     ByteBuffer buffer_; }; 

---

### 6.3 MessageReassembler

职责：

text 1. 接收 Frame。 2. 判断单帧 / 多帧。 3. 按 messageId + fragmentIndex 重组。 4. 输出 Message。 5. 处理重复片、缺片、payloadType mismatch、message too large。 6. 不解析 RPC。 

接口：

cpp class IMessageSink { public:     virtual ~IMessageSink() = default;     virtual void onMessage(Message message) = 0; };  class MessageReassembler : public IFrameSink { public:     explicit MessageReassembler(IMessageSink& next);      void onFrame(Frame frame) override;  private:     IMessageSink& next_; }; 

---

### 6.4 PayloadDecoder

职责：

text 1. 接收 Message。 2. 根据 payloadType 解出 Control/RPC/Stream envelope。 3. 只解 envelope，不解业务 schema。 4. 不调用业务 handler。 

接口：

cpp class IPayloadSink { public:     virtual ~IPayloadSink() = default;      virtual void onControl(ControlPayload payload) = 0;     virtual void onRpc(RpcPayload payload) = 0;     virtual void onStream(StreamPayload payload) = 0; };  class PayloadDecoder : public IMessageSink { public:     explicit PayloadDecoder(IPayloadSink& next);      void onMessage(Message message) override;  private:     IPayloadSink& next_; }; 

---

### 6.5 AxtpInboundProcessor

cpp class AxtpInboundProcessor : public IByteSink { public:     explicit AxtpInboundProcessor(IPayloadSink& sink)         : payloadDecoder_(sink),           messageReassembler_(payloadDecoder_),           frameDecoder_(messageReassembler_) {}      void onBytes(const uint8_t* data, size_t size) override {         frameDecoder_.onBytes(data, size);     }  private:     PayloadDecoder payloadDecoder_;     MessageReassembler messageReassembler_;     FrameDecoder frameDecoder_; }; 

### Codex 任务

text 实现 AXTP 当前版本入站处理器。  要求： 1. AxtpInboundProcessor 实现 IByteSink。 2. FrameDecoder 只能输出 Frame。 3. MessageReassembler 只能输出 Message。 4. PayloadDecoder 负责 Control/RPC/Stream envelope。 5. 不引入通用 Codec Factory。 6. 当前版本字段可以写死，但只能写在 decoder/reassembler 内部。 

### 验收标准

text 1. 输入半个 frame，不输出 payload。 2. 输入一个完整 frame，输出对应 payload。 3. 输入两个粘在一起的 frame，输出两个 payload。 4. 输入分片 frame，重组成一个 Message。 5. 输入非法 magic，可以 resync 或报错。 6. PayloadDecoder 能解 RpcPayload 的 op/encoding/requestId/methodId/body。 

---

## 7. Phase 3：实现 AxtpOutboundProcessor

### 目标

完整实现当前协议版本的出站编码。

text ControlPayload / RpcPayload / StreamPayload   -> PayloadEncoder   -> Message   -> MessageFragmenter   -> Frame   -> FrameEncoder   -> bytes 

---

### 7.1 IByteWriter

cpp class IByteWriter { public:     virtual ~IByteWriter() = default;     virtual void writeBytes(const uint8_t* data, size_t size) = 0; }; 

---

### 7.2 PayloadEncoder

职责：

text 1. ControlPayload -> Message。 2. RpcPayload -> Message。 3. StreamPayload -> Message。 4. 只编码 payload envelope。 5. 不编码业务 schema。 

cpp class PayloadEncoder { public:     Message encodeControl(const ControlPayload& payload);     Message encodeRpc(const RpcPayload& payload);     Message encodeStream(const StreamPayload& payload); }; 

---

### 7.3 MessageFragmenter

职责：

text 1. 根据 maxFrameSize 拆 Message。 2. 生成 messageId。 3. 生成 fragmentIndex。 4. 设置 first/last/hasMore flags。 

cpp class MessageFragmenter { public:     explicit MessageFragmenter(size_t maxFrameSize);      std::vector<Frame> fragment(Message message);  private:     uint32_t nextMessageId_ = 1;     size_t maxFrameSize_; }; 

---

### 7.4 FrameEncoder

cpp class FrameEncoder { public:     Bytes encode(const Frame& frame); }; 

---

### 7.5 AxtpOutboundProcessor

cpp class AxtpOutboundProcessor { public:     explicit AxtpOutboundProcessor(IByteWriter& writer)         : writer_(writer) {}      void sendControl(ControlPayload payload) {         auto msg = payloadEncoder_.encodeControl(payload);         sendMessage(std::move(msg));     }      void sendRpcRequest(RpcPayload payload) {         auto msg = payloadEncoder_.encodeRpc(payload);         sendMessage(std::move(msg));     }      void sendRpcResponse(RpcPayload payload) {         auto msg = payloadEncoder_.encodeRpc(payload);         sendMessage(std::move(msg));     }      void sendRpcError(RpcPayload payload) {         auto msg = payloadEncoder_.encodeRpc(payload);         sendMessage(std::move(msg));     }      void sendEvent(RpcPayload payload) {         auto msg = payloadEncoder_.encodeRpc(payload);         sendMessage(std::move(msg));     }      void sendStream(StreamPayload payload) {         auto msg = payloadEncoder_.encodeStream(payload);         sendMessage(std::move(msg));     }  private:     void sendMessage(Message msg) {         auto frames = messageFragmenter_.fragment(std::move(msg));         for (auto& frame : frames) {             auto bytes = frameEncoder_.encode(frame);             writer_.writeBytes(bytes.data(), bytes.size());         }     }  private:     IByteWriter& writer_;     PayloadEncoder payloadEncoder_;     MessageFragmenter messageFragmenter_;     FrameEncoder frameEncoder_; }; 

### Codex 任务

text 实现 AXTP 当前版本出站处理器。  要求： 1. PayloadEncoder 只编码 envelope。 2. MessageFragmenter 负责分片和 messageId。 3. FrameEncoder 只负责 frame header + payload bytes。 4. OutboundProcessor 不直接理解业务 handler。 5. OutboundProcessor 通过 IByteWriter 输出 bytes。 

### 验收标准

text 1. RpcPayload 可编码成 bytes。 2. bytes 再进入 InboundProcessor 能还原成同一个 RpcPayload。 3. 大 Message 可被分片，再由 MessageReassembler 还原。 4. Control/Stream/Rpc 都有 round-trip 测试。 

---

## 8. Phase 4：实现 AxtpCore

### 目标

串起入站、出站和协议状态。

text AxtpInboundProcessor -> AxtpCore -> AxtpOutboundProcessor 

AxtpCore 处理：

text - ControlSession - RpcDispatcher - StreamSession - SessionManager - PendingCallTable 

此阶段可以先不接 Broker，可以临时使用简单 handler map。

---

### 8.1 AxtpCore 初版

cpp class AxtpCore : public IPayloadSink, public IByteSink, public IByteWriter { public:     AxtpCore()         : inbound_(*this),           outbound_(*this) {}      void onBytes(const uint8_t* data, size_t size) override {         inbound_.onBytes(data, size);     }      void writeBytes(const uint8_t* data, size_t size) override {         outboundQueue_.push(Bytes(data, data + size));     }      void onControl(ControlPayload payload) override {         controlSession_.handle(std::move(payload));     }      void onRpc(RpcPayload payload) override {         rpcDispatcher_.handle(std::move(payload));     }      void onStream(StreamPayload payload) override {         streamSession_.handle(std::move(payload));     }      std::optional<Bytes> tryPopOutboundBytes() {         return outboundQueue_.tryPop();     }  private:     AxtpInboundProcessor inbound_;     AxtpOutboundProcessor outbound_;      ControlSession controlSession_;     RpcDispatcher rpcDispatcher_;     StreamSession streamSession_;     PendingCallTable pendingCalls_;      Queue<Bytes> outboundQueue_; }; 

### Codex 任务

text 实现 AxtpCore v1。  要求： 1. Core 实现 IByteSink，作为入站 bytes 入口。 2. Core 实现 IByteWriter，作为 OutboundProcessor bytes 出口。 3. Core 不持有线程。 4. Core 不直接读写 socket/transport。 5. Core 不解析 frame 字段。 6. Core 可以先内置简单 RpcDispatcher handler map。 

### 验收标准

text 1. core.onBytes(encodedRpcRequest) 能触发 RPC handler。 2. handler 返回 response 后，core.tryPopOutboundBytes() 能拿到 encoded response。 3. ControlSession 能处理 OPEN/PING/CLOSE 基本消息。 4. PendingCallTable 能匹配 response。 

---

## 9. Phase 5：加入 Transport 抽象

### 目标

引入真实 I/O 边界，但 Core 仍不持有线程。

---

### 9.1 ITransport

cpp class ITransport { public:     virtual ~ITransport() = default;      virtual void bind(IByteSink& sink) = 0;     virtual void open() = 0;     virtual void close() = 0;     virtual void sendBytes(const uint8_t* data, size_t size) = 0;     virtual TransportProfile profile() const = 0; }; 

---

### 9.2 TransportProfile

cpp enum class TransportKind {     Tcp,     WebSocket,     Hid,     Ble,     Uart,     Mock,     Custom, };  enum class AxtpWireMode {     FramedBinary,     WebSocketJsonRpc, };  struct TransportProfile {     TransportKind kind = TransportKind::Custom;     ProtocolMode protocolMode = ProtocolMode::AxtpV1;     AxtpWireMode wireMode = AxtpWireMode::FramedBinary;     RpcEncoding defaultRpcEncoding = RpcEncoding::Binary;      bool messageOriented = false;     bool supportsTextMessage = false;     bool supportsBinaryMessage = true;      size_t preferredFrameSize = 4096; }; 

---

### 9.3 Core 绑定 Transport

cpp class AxtpCore : public IPayloadSink, public IByteSink, public IByteWriter { public:     void attachTransport(ITransport& transport) {         transport_ = &transport;         transport_->bind(*this);     }      void flushOutbound() {         while (auto bytes = outboundQueue_.tryPop()) {             if (transport_) {                 transport_->sendBytes(bytes->data(), bytes->size());             }         }     }  private:     ITransport* transport_ = nullptr; }; 

---

### 9.4 MockTransport

cpp class MockTransport : public ITransport { public:     void bind(IByteSink& sink) override {         sink_ = &sink;     }      void open() override {}      void close() override {}      void injectIncoming(const Bytes& bytes) {         if (sink_) {             sink_->onBytes(bytes.data(), bytes.size());         }     }      void sendBytes(const uint8_t* data, size_t size) override {         outgoing_.push(Bytes(data, data + size));     }      TransportProfile profile() const override {         return profile_;     }      std::optional<Bytes> tryPopOutgoing() {         return outgoing_.tryPop();     }  private:     IByteSink* sink_ = nullptr;     Queue<Bytes> outgoing_;     TransportProfile profile_; }; 

### Codex 任务

text 实现 ITransport 和 MockTransport。  要求： 1. Core 通过 attachTransport 绑定 transport。 2. Transport 收到 bytes 后调用 IByteSink::onBytes。 3. Core 出站通过 flushOutbound 调用 transport.sendBytes。 4. Core 不创建线程。 5. MockTransport 用于测试，不依赖真实 socket。 

### 验收标准

text 1. MockTransport.injectIncoming() 能驱动 Core。 2. Core.flushOutbound() 能把 response 写入 MockTransport.outgoing。 3. 测试不依赖真实 socket。 

---

## 10. Phase 6：加入 TcpTransport / WebSocketTransport

### 目标

接入真实 Transport。

### 线程原则

text 1. AxtpCore 不持有线程。 2. TcpTransport 可以持有 I/O 线程，也可以使用外部 poll/event loop。 3. WebSocketTransport 可以持有自己的 event loop，也可以使用外部 event loop。 4. 同一个 Core 的 onBytes 必须串行调用。 5. 业务线程不得直接调用 transport.sendBytes。 

### TcpTransport 初版建议

第一版优先做 ManualPoll：

text transport.poll(); core.flushOutbound(); 

之后再加 OwnThread 模式。

### Codex 任务

text 实现最小 TcpTransport。  要求： 1. 支持 bind/open/close/sendBytes/profile。 2. 第一版可以是阻塞 poll 模式。 3. 不在多个线程并发调用 sink.onBytes。 4. sendBytes 可直接发送或先入 txQueue。 

### 验收标准

text 1. TCP client 发送 AXTP frame，Core 能解析。 2. Core response 能从 TCP 发回。 3. 多个 frame 粘包场景正常。 

---

## 11. Phase 7：加入 AxtpBroker

### 目标

把业务 handler 从 Core 里抽出去，形成：

text AxtpCore -> AxtpBroker -> Business 

---

### 11.1 BrokerTask

cpp enum class BrokerTaskType {     RpcRequest,     RpcEvent,     StreamOpen,     StreamData,     StreamClose,     ControlNotice, };  enum class BrokerPriority {     High,     Normal,     Low, };  struct BrokerContext {     uint32_t sessionId = 0;     uint32_t requestId = 0;     uint32_t methodOrEventId = 0;     RpcEncoding encoding = RpcEncoding::Binary;     SourceProtocol sourceProtocol = SourceProtocol::AxtpV1;      std::string traceId;     uint64_t receivedAtMs = 0;     uint64_t deadlineMs = 0; };  struct BrokerTask {     BrokerTaskType type;     BrokerPriority priority = BrokerPriority::Normal;     BrokerContext context;      RpcPayload rpc;     StreamPayload stream;     ControlPayload control; }; 

---

### 11.2 IBrokerSink

cpp class IBrokerSink { public:     virtual ~IBrokerSink() = default;      virtual void onBrokerRpcResponse(RpcPayload payload) = 0;     virtual void onBrokerRpcError(RpcPayload payload) = 0;     virtual void onBrokerEvent(RpcPayload payload) = 0;     virtual void onBrokerStream(StreamPayload payload) = 0; }; 

---

### 11.3 AxtpBroker

cpp class AxtpBroker { public:     explicit AxtpBroker(IBrokerSink& sink)         : sink_(sink) {}      void submit(BrokerTask task);      void poll(size_t maxTasks = 16);      template <typename Handler>     void registerMethod(uint32_t methodId, Handler&& handler) {         router_.registerMethod(methodId, std::forward<Handler>(handler));     }  private:     IBrokerSink& sink_;      MiddlewareChain middleware_;     BrokerFlowControl flowControl_;     BusinessRouter router_;     BusinessExecutor executor_; }; 

---

### 11.4 Core 接入 Broker

cpp class AxtpCore     : public IPayloadSink     , public IByteSink     , public IByteWriter     , public IBrokerSink { public:     explicit AxtpCore(AxtpBroker& broker)         : broker_(broker),           inbound_(*this),           outbound_(*this) {}      void onRpc(RpcPayload payload) override {         if (payload.op == RpcOp::Request) {             BrokerTask task;             task.type = BrokerTaskType::RpcRequest;             task.context.sessionId = payload.meta.sessionId;             task.context.requestId = payload.requestId;             task.context.methodOrEventId = payload.methodOrEventId;             task.context.encoding = payload.encoding;             task.context.sourceProtocol = payload.meta.sourceProtocol;             task.rpc = std::move(payload);              broker_.submit(std::move(task));             return;         }          if (payload.op == RpcOp::Response) {             pendingCalls_.resolve(payload.requestId, std::move(payload));             return;         }          if (payload.op == RpcOp::Error) {             pendingCalls_.reject(payload.requestId, std::move(payload));             return;         }          if (payload.op == RpcOp::Event) {             BrokerTask task;             task.type = BrokerTaskType::RpcEvent;             task.context.sessionId = payload.meta.sessionId;             task.context.methodOrEventId = payload.methodOrEventId;             task.context.sourceProtocol = payload.meta.sourceProtocol;             task.rpc = std::move(payload);              broker_.submit(std::move(task));             return;         }     }      void onBrokerRpcResponse(RpcPayload payload) override {         outbound_.sendRpcResponse(std::move(payload));     }  private:     AxtpBroker& broker_; }; 

### Codex 任务

text 实现 AxtpBroker 并将 RPC request 从 Core 迁移到 Broker。  要求： 1. Core 不再直接持有业务 handler map。 2. Broker 负责 registerMethod。 3. Broker 接收 BrokerTask。 4. Broker 处理完成后通过 IBrokerSink 回调 Core。 5. 第一版 Broker 可以 ManualPoll。 6. Broker 暂不需要线程池。 

### 验收标准

text 1. core.onBytes(request) -> broker.submit(task)。 2. broker.poll() 执行业务 handler。 3. handler 返回 response。 4. Core 收到 broker response 后走 outbound。 5. MockTransport 能收到 response bytes。 

---

## 12. Phase 8：加入 LegacyProtocolAdapter

### 目标

实现新老协议兼容，但不污染 Core/Broker/Business。

核心架构：

text AXTP Path   -> AxtpCore   -> AxtpBroker   -> Business  Legacy Path   -> LegacyProtocolAdapter   -> normalized RpcPayload   -> AxtpCore   -> AxtpBroker   -> Business 

最终原则：

text 双入口、单核心、单业务层、双出口 

---

### 12.1 Legacy 入站

text legacy bytes   -> LegacyFrameDecoder   -> LegacyCommand   -> LegacyMethodMapper   -> RpcPayload   -> AxtpCore 

---

### 12.2 Legacy 出站

text RpcPayload   -> LegacyMethodMapper   -> LegacyResponse   -> LegacyFrameEncoder   -> bytes 

---

### 12.3 ProtocolMux

text Transport   -> ProtocolMux   -> AxtpInboundProcessor or LegacyProtocolAdapter 

cpp class ProtocolMux : public IByteSink { public:     ProtocolMux(AxtpInboundProcessor& axtp, LegacyProtocolAdapter& legacy)         : axtp_(axtp), legacy_(legacy) {}      void onBytes(const uint8_t* data, size_t size) override;  private:     AxtpInboundProcessor& axtp_;     LegacyProtocolAdapter& legacy_;      bool locked_ = false;     ProtocolMode mode_ = ProtocolMode::AutoDetect;     ByteBuffer buffer_; }; 

---

### 12.4 SessionContext

cpp struct SessionContext {     uint32_t sessionId = 0;     ProtocolMode protocolMode = ProtocolMode::AxtpV1;     TransportProfile transportProfile;     RpcEncoding selectedEncoding = RpcEncoding::Binary; }; 

出站规则：

text session.protocolMode == AxtpV1   -> AxtpOutboundProcessor  session.protocolMode == Legacy   -> LegacyProtocolAdapter 

---

### Codex 任务

text 实现 LegacyProtocolAdapter 和 ProtocolMux。  要求： 1. LegacyProtocolAdapter 实现 IByteSink。 2. Legacy 入站输出统一 RpcPayload。 3. Legacy 出站接收 RpcPayload，编码成老协议 response。 4. ProtocolMux 只负责识别协议，不处理业务。 5. Broker 不得出现 legacy command id。 6. Core 通过 SessionContext 决定出站走 AXTP 还是 Legacy。 

### 验收标准

text 1. Legacy request 能映射到 AXTP methodId。 2. Broker handler 可以复用同一套业务。 3. Response 能按 legacy 格式返回。 4. AXTP path 和 Legacy path 业务层无差异。 

---

## 13. 推荐里程碑

### Milestone 1：纯协议解析闭环

完成：

text Phase 1 Phase 2 Phase 3 

验收：

text bytes -> payload -> bytes roundtrip 

---

### Milestone 2：AxtpCore 单机闭环

完成：

text Phase 4 

验收：

text core.onBytes(request)   -> handler   -> core.tryPopOutboundBytes() 

---

### Milestone 3：MockTransport 闭环

完成：

text Phase 5 

验收：

text MockTransport.injectIncoming(request)   -> Core   -> MockTransport.outgoing(response) 

---

### Milestone 4：真实 TCP/WebSocket 通路

完成：

text Phase 6 

验收：

text TCP/WebSocket client 可以调用 device.getInfo 

---

### Milestone 5：Broker 业务层接入

完成：

text Phase 7 

验收：

text Core 不再直接持有业务 handler Broker 负责 method routing / middleware / queue 

---

### Milestone 6：Legacy 兼容

完成：

text Phase 8 

验收：

text 老协议客户端和 AXTP 客户端调用同一个业务 handler 

---

## 14. 线程模型规则

### 14.1 基本原则

text 1. AxtpCore 不持有线程。 2. Transport 可以持有 I/O 线程。 3. Broker / Executor 可以持有业务线程。 4. 同一个 Core 的 onBytes 必须串行调用。 5. Business handler 不直接调用 transport.sendBytes。 6. 业务结果必须通过 Core / IBrokerSink / post queue 返回。 

---

### 14.2 推荐模型：ManualPoll

适合嵌入式、Mock、早期测试。

cpp while (running) {     transport.poll();     broker.poll();     core.flushOutbound(); } 

---

### 14.3 推荐模型：Transport I/O Thread + Broker Worker

适合 TCP / WebSocket / Linux 设备。

text Transport IO Thread:   recv bytes   -> core.onBytes()   -> broker.submit()  Broker Worker Thread:   middleware   -> business handler   -> core.postRpcResponse()  Transport IO Thread:   core.flushOutbound()   -> transport.sendBytes() 

---

## 15. Codex 维护硬规则

Codex 修改代码时必须遵守：

text 1. Transport 只负责 bytes in/out，不解析 Frame/Payload。 2. AxtpInboundProcessor 只负责 bytes -> Payload。 3. AxtpOutboundProcessor 只负责 Payload -> bytes。 4. AxtpCore 负责协议状态，不执行业务 handler。 5. AxtpBroker 负责业务 handler、中间件、队列、流控。 6. Business 不得依赖 Frame/Message/Payload raw bytes。 7. Legacy 逻辑只能出现在 legacy/ 和 mux/ 目录。 8. Core/Broker/Business 中不得出现 legacy command id。 9. Core 不持有线程。 10. Transport 可以持有 I/O 线程，但必须串行调用 IByteSink::onBytes。 11. Broker 可以持有业务线程，但业务结果必须通过 Core post/IBrokerSink 返回。 12. PayloadDecoder / PayloadEncoder 只处理 envelope，不处理业务 schema。 13. Json/Binary 是 RpcPayload 的 body encoding，不是新的 PayloadType。 14. WebSocketJsonRpc 是 WireMode，不是 Frame 格式变体。 15. 当前版本字段可以写死，但只能写在 Decoder/Encoder/Reassembler/Fragmenter 内部。 

---

## 16. 第一版不做的事情

第一版不要做：

text 1. 通用 IFrameCodec factory。 2. 通用 IPayloadCodec factory。 3. 动态协议插件系统。 4. 全自动 legacy inference。 5. 复杂 schema runtime reflection。 6. 多连接 Runtime 管理器。 7. 复杂 worker pool。 

第一版允许做：

text 1. 具体 V1 FrameDecoder / FrameEncoder。 2. 具体 V1 PayloadDecoder / PayloadEncoder。 3. 具体 V1 MessageReassembler / MessageFragmenter。 4. MockTransport。 5. ManualPoll Broker。 6. LegacyProtocolAdapter。 7. ProtocolMux。 

---

## 17. 最终实现顺序

text 1. model + byte io 2. inbound processor 3. outbound processor 4. axtp core 5. mock transport 6. real transport 7. axtp broker 8. legacy adapter + protocol mux 

最终一句话：

text 先让 AxtpCore 完整吃透当前 AXTP 协议：Inbound 解析、Outbound 编码、Core 分发； 再加 Transport 让它能通信； 再加 Broker 把业务从 Core 中剥离； 最后加 LegacyProtocolAdapter 做新老协议兼容。 