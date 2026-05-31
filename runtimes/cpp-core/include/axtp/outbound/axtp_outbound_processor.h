#pragma once

#include <cstddef>
#include <utility>

#include "axtp/io/byte_writer_sink.h"
#include "axtp/outbound/frame_encoder.h"
#include "axtp/outbound/message_fragmenter.h"
#include "axtp/outbound/payload_encoder.h"

namespace axtp {

class AxtpOutboundProcessor {
public:
    explicit AxtpOutboundProcessor(IByteWriter& writer, std::size_t maxFrameSize = 4096)
        : writer_(writer), messageFragmenter_(maxFrameSize) {}

    void sendControl(ControlPayload payload) {
        sendMessage(payloadEncoder_.encodeControl(payload));
    }

    void sendRpcRequest(RpcPayload payload) {
        sendMessage(payloadEncoder_.encodeRpc(payload));
    }

    void sendRpcResponse(RpcPayload payload) {
        sendMessage(payloadEncoder_.encodeRpc(payload));
    }

    void sendRpcError(RpcPayload payload) {
        sendMessage(payloadEncoder_.encodeRpc(payload));
    }

    void sendEvent(RpcPayload payload) {
        sendMessage(payloadEncoder_.encodeRpc(payload));
    }

    void sendStream(StreamPayload payload) {
        sendMessage(payloadEncoder_.encodeStream(payload));
    }

private:
    void sendMessage(Message message) {
        auto frames = messageFragmenter_.fragment(std::move(message));
        for (const auto& frame : frames) {
            auto bytes = frameEncoder_.encode(frame);
            writer_.writeBytes(bytes.data(), bytes.size());
        }
    }

    IByteWriter& writer_;
    PayloadEncoder payloadEncoder_;
    MessageFragmenter messageFragmenter_;
    FrameEncoder frameEncoder_;
};

} // namespace axtp
