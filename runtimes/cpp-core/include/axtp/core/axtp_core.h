#pragma once

#include <cstddef>
#include <functional>
#include <optional>
#include <queue>
#include <utility>

#include "axtp/broker/axtp_broker.h"
#include "axtp/broker/broker_sink.h"
#include "axtp/core/control_session.h"
#include "axtp/core/pending_call_table.h"
#include "axtp/core/session_context.h"
#include "axtp/core/stream_session.h"
#include "axtp/inbound/axtp_inbound_processor.h"
#include "axtp/io/byte_sink.h"
#include "axtp/io/byte_writer_sink.h"
#include "axtp/outbound/axtp_outbound_processor.h"
#include "axtp/transport/transport.h"

namespace axtp {

class AxtpCore {
public:
    AxtpCore()
        : byteSinkPort_(*this),
          payloadSinkPort_(*this),
          byteWriterPort_(*this),
          brokerSinkPort_(*this),
          inbound_(payloadSinkPort_),
          outbound_(byteWriterPort_) {}

    void expectRpcResponse(std::uint32_t requestId) {
        pendingCalls_.expect(requestId);
    }

    std::optional<RpcPayload> tryTakeRpcResponse(std::uint32_t requestId) {
        return pendingCalls_.tryTakeResolved(requestId);
    }

    std::optional<Bytes> tryPopOutboundBytes() {
        if (outboundQueue_.empty()) {
            return std::nullopt;
        }
        auto bytes = std::move(outboundQueue_.front());
        outboundQueue_.pop();
        return bytes;
    }

    void attachTransport(ITransport& transport) {
        transport_ = &transport;
        transport_->bind(byteSinkPort_);
    }

    void attachBroker(AxtpBroker& broker) {
        broker_ = &broker;
    }

    void attachLegacyOutbound(IProtocolOutbound& outbound) {
        legacyOutbound_ = &outbound;
    }

    void attachJsonRpcOutbound(IProtocolOutbound& outbound) {
        jsonRpcOutbound_ = &outbound;
    }

    void attachLegacyInbound(IByteSink& inbound) {
        legacyInbound_ = &inbound;
    }

    void attachLegacy(IByteSink& inbound, IProtocolOutbound& outbound) {
        attachLegacyInbound(inbound);
        attachLegacyOutbound(outbound);
    }

    void flushOutbound() {
        while (auto bytes = tryPopOutboundBytes()) {
            if (transport_ != nullptr) {
                transport_->sendBytes(bytes->data(), bytes->size());
            }
        }
    }

    bool controlSessionOpen() const {
        return controlSession_.isOpen();
    }

    IByteSink& byteSinkPort() {
        return byteSinkPort_;
    }

    IPayloadSink& payloadSinkPort() {
        return payloadSinkPort_;
    }

    IByteWriter& byteWriterPort() {
        return byteWriterPort_;
    }

    IBrokerSink& brokerSinkPort() {
        return brokerSinkPort_;
    }

private:
    class ByteSinkPort : public IByteSink {
    public:
        explicit ByteSinkPort(AxtpCore& core)
            : core_(core) {}

        void onBytes(const Byte* data, std::size_t size) override {
            core_.handleBytes(data, size);
        }

    private:
        AxtpCore& core_;
    };

    class PayloadSinkPort : public IPayloadSink {
    public:
        explicit PayloadSinkPort(AxtpCore& core)
            : core_(core) {}

        void onControl(ControlPayload payload) override {
            core_.handleControl(std::move(payload));
        }

        void onRpc(RpcPayload payload) override {
            core_.handleRpc(std::move(payload));
        }

        void onStream(StreamPayload payload) override {
            core_.handleStream(std::move(payload));
        }

    private:
        AxtpCore& core_;
    };

    class ByteWriterPort : public IByteWriter {
    public:
        explicit ByteWriterPort(AxtpCore& core)
            : core_(core) {}

        void writeBytes(const Byte* data, std::size_t size) override {
            core_.enqueueOutboundBytes(data, size);
        }

    private:
        AxtpCore& core_;
    };

    class BrokerSinkPort : public IBrokerSink {
    public:
        explicit BrokerSinkPort(AxtpCore& core)
            : core_(core) {}

        void onBrokerRpcResponse(RpcPayload payload) override {
            core_.handleBrokerRpcResponse(std::move(payload));
        }

        void onBrokerRpcError(RpcPayload payload) override {
            core_.handleBrokerRpcError(std::move(payload));
        }

        void onBrokerEvent(RpcPayload payload) override {
            core_.handleBrokerEvent(std::move(payload));
        }

        void onBrokerStream(StreamPayload payload) override {
            core_.handleBrokerStream(std::move(payload));
        }

    private:
        AxtpCore& core_;
    };

    void handleBytes(const Byte* data, std::size_t size) {
        if (legacyInbound_ != nullptr && !looksLikeAxtpV1(data, size)) {
            legacyInbound_->onBytes(data, size);
            return;
        }
        inbound_.onBytes(data, size);
    }

    bool looksLikeAxtpV1(const Byte* data, std::size_t size) const {
        if (data == nullptr || size == 0) {
            return true;
        }
        if (data[0] != kAxtpStandardMagic0) {
            return false;
        }
        return size == 1 || data[1] == kAxtpStandardMagic1;
    }

    void enqueueOutboundBytes(const Byte* data, std::size_t size) {
        outboundQueue_.push(Bytes(data, data + size));
    }

    void handleControl(ControlPayload payload) {
        auto response = controlSession_.handle(std::move(payload));
        if (response.has_value()) {
            outbound_.sendControl(std::move(*response));
        }
    }

    void handleRpc(RpcPayload payload) {
        if (payload.op == RpcOp::Request) {
            if (broker_ != nullptr) {
                BrokerTask task;
                task.type = BrokerTaskType::RpcRequest;
                task.context.sessionId = payload.meta.sessionId;
                task.context.requestId = payload.requestId;
                task.context.methodOrEventId = payload.methodOrEventId;
                task.context.encoding = payload.encoding;
                task.context.sourceProtocol = payload.meta.sourceProtocol;
                task.rpc = std::move(payload);
                broker_->submit(std::move(task));
            }
            return;
        }

        if (payload.op == RpcOp::Event) {
            if (broker_ != nullptr) {
                BrokerTask task;
                task.type = BrokerTaskType::RpcEvent;
                task.context.sessionId = payload.meta.sessionId;
                task.context.methodOrEventId = payload.methodOrEventId;
                task.context.encoding = payload.encoding;
                task.context.sourceProtocol = payload.meta.sourceProtocol;
                task.rpc = std::move(payload);
                broker_->submit(std::move(task));
            }
            return;
        }

        if (payload.op == RpcOp::RequestResponse) {
            pendingCalls_.resolve(payload.requestId, std::move(payload));
        }
    }

    void handleStream(StreamPayload payload) {
        streamSession_.handle(std::move(payload));
    }

    void handleBrokerRpcResponse(RpcPayload payload) {
        if (payload.meta.sourceProtocol == SourceProtocol::JsonRpc && jsonRpcOutbound_ != nullptr) {
            jsonRpcOutbound_->sendRpc(std::move(payload));
            return;
        }
        if (payload.meta.sourceProtocol == SourceProtocol::Legacy && legacyOutbound_ != nullptr) {
            legacyOutbound_->sendRpc(std::move(payload));
            return;
        }
        outbound_.sendRpcResponse(std::move(payload));
    }

    void handleBrokerRpcError(RpcPayload payload) {
        if (payload.meta.sourceProtocol == SourceProtocol::JsonRpc && jsonRpcOutbound_ != nullptr) {
            jsonRpcOutbound_->sendRpc(std::move(payload));
            return;
        }
        if (payload.meta.sourceProtocol == SourceProtocol::Legacy && legacyOutbound_ != nullptr) {
            legacyOutbound_->sendRpc(std::move(payload));
            return;
        }
        outbound_.sendRpcError(std::move(payload));
    }

    void handleBrokerEvent(RpcPayload payload) {
        if (payload.meta.sourceProtocol == SourceProtocol::JsonRpc && jsonRpcOutbound_ != nullptr) {
            jsonRpcOutbound_->sendRpc(std::move(payload));
            return;
        }
        outbound_.sendEvent(std::move(payload));
    }

    void handleBrokerStream(StreamPayload payload) {
        outbound_.sendStream(std::move(payload));
    }

    ByteSinkPort byteSinkPort_;
    PayloadSinkPort payloadSinkPort_;
    ByteWriterPort byteWriterPort_;
    BrokerSinkPort brokerSinkPort_;
    AxtpInboundProcessor inbound_;
    AxtpOutboundProcessor outbound_;
    ControlSession controlSession_;
    StreamSession streamSession_;
    PendingCallTable pendingCalls_;
    std::queue<Bytes> outboundQueue_;
    ITransport* transport_ = nullptr;
    AxtpBroker* broker_ = nullptr;
    IByteSink* legacyInbound_ = nullptr;
    IProtocolOutbound* legacyOutbound_ = nullptr;
    IProtocolOutbound* jsonRpcOutbound_ = nullptr;
};

} // namespace axtp
