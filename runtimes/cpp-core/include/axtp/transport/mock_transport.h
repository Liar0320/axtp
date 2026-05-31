#pragma once

#include <optional>
#include <queue>
#include <utility>

#include "axtp/transport/transport.h"

namespace axtp {

class MockTransport : public ITransport {
public:
    void bind(IByteSink& sink) override {
        sink_ = &sink;
    }

    void open() override {
        open_ = true;
    }

    void close() override {
        open_ = false;
    }

    void injectIncoming(const Bytes& bytes) {
        if (sink_ != nullptr) {
            sink_->onBytes(bytes.data(), bytes.size());
        }
    }

    void sendBytes(const Byte* data, std::size_t size) override {
        outgoing_.push(Bytes(data, data + size));
    }

    TransportProfile profile() const override {
        return profile_;
    }

    std::optional<Bytes> tryPopOutgoing() {
        if (outgoing_.empty()) {
            return std::nullopt;
        }
        auto bytes = std::move(outgoing_.front());
        outgoing_.pop();
        return bytes;
    }

    bool isOpen() const {
        return open_;
    }

private:
    IByteSink* sink_ = nullptr;
    std::queue<Bytes> outgoing_;
    bool open_ = false;
    TransportProfile profile_{
        TransportKind::Mock,
        ProtocolMode::AxtpV1,
        AxtpWireMode::FramedBinary,
        RpcEncoding::Binary,
        false,
        false,
        true,
        true,
        true,
        4096,
    };
};

} // namespace axtp
