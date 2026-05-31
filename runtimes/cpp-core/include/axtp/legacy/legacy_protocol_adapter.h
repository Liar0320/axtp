#pragma once

#include <utility>

#include "axtp/core/axtp_core.h"
#include "axtp/core/session_context.h"
#include "axtp/io/byte_sink.h"
#include "axtp/io/byte_writer_sink.h"
#include "axtp/legacy/legacy_frame_decoder.h"
#include "axtp/legacy/legacy_frame_encoder.h"
#include "axtp/legacy/legacy_method_mapper.h"

namespace axtp {

class LegacyProtocolAdapter : public IByteSink, public IProtocolOutbound {
public:
    LegacyProtocolAdapter(AxtpCore& core, IByteWriter& writer)
        : core_(core), writer_(writer) {}

    void onBytes(const Byte* data, std::size_t size) override {
        auto command = decoder_.decode(data, size);
        if (!command.has_value()) {
            return;
        }
        auto methodId = LegacyMethodMapper::toMethodId(command->cmdValue);
        if (!methodId.has_value()) {
            return;
        }

        RpcPayload payload;
        payload.encoding = RpcEncoding::Binary;
        payload.op = RpcOp::Request;
        payload.requestId = command->sequence;
        payload.methodOrEventId = *methodId;
        payload.statusCode = ErrorCode::Success;
        payload.bodyEncoding = RpcBodyEncoding::RawBytes;
        payload.meta.sourceProtocol = SourceProtocol::Legacy;
        payload.meta.requestId = payload.requestId;
        payload.meta.legacySequence = command->sequence;
        payload.meta.legacyCommandValue = command->cmdValue;
        payload.body = std::move(command->payload);
        core_.payloadSinkPort().onRpc(std::move(payload));
    }

    void sendRpc(RpcPayload payload) override {
        if (payload.meta.legacyCommandValue == 0) {
            auto cmd = LegacyMethodMapper::toLegacyCommand(payload.methodOrEventId);
            if (cmd.has_value()) {
                payload.meta.legacyCommandValue = *cmd;
            }
        }
        auto bytes = encoder_.encodeResponse(payload);
        writer_.writeBytes(bytes.data(), bytes.size());
    }

private:
    AxtpCore& core_;
    IByteWriter& writer_;
    LegacyFrameDecoder decoder_;
    LegacyFrameEncoder encoder_;
};

} // namespace axtp
