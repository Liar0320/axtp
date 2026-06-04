#pragma once

#include "axtp/core/inbound/frame_decoder.hpp"
#include "axtp/core/inbound/json_rpc_decoder.hpp"
#include "axtp/core/inbound/message_reassembler.hpp"
#include "axtp/core/inbound/payload_decoder.hpp"
#include "axtp/io/byte_sink.hpp"
#include "axtp/transport/transport_profile.hpp"

namespace axtp {

class InboundProcessor : public IByteSink {
public:
    explicit InboundProcessor(IPayloadSink& sink)
        : _payloadDecoder(sink)
        , _messageReassembler(_payloadDecoder)
        , _frameDecoder(_messageReassembler)
        , _jsonRpcDecoder(sink) {}

    void onBytes(const Byte* data, std::size_t size) override {
        if (_wireMode == AxtpWireMode::WebSocketJsonRpc) {
            _jsonRpcDecoder.onBytes(data, size);
            return;
        }
        _frameDecoder.onBytes(data, size);
    }

    void setWireMode(AxtpWireMode wireMode) {
        _wireMode = wireMode;
    }

private:
    PayloadDecoder _payloadDecoder;
    MessageReassembler _messageReassembler;
    FrameDecoder _frameDecoder;
    JsonRpcDecoder _jsonRpcDecoder;
    AxtpWireMode _wireMode = AxtpWireMode::FramedBinary;
};

}  // namespace axtp
