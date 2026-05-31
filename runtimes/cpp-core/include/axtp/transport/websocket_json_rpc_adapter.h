#pragma once

#include <cstdint>
#include <string>
#include <utility>
#include <vector>

#include <boost/json.hpp>

#include "axtp/core/axtp_core.h"
#include "axtp/inbound/axtp_inbound_processor.h"
#include "axtp/io/byte_sink.h"
#include "axtp/transport/transport.h"

namespace axtp {

class WebSocketJsonRpcAdapter : public IByteSink {
public:
    WebSocketJsonRpcAdapter(AxtpCore& core, ITransport& writer)
        : core_(core), writer_(writer) {}

    void onBytes(const Byte* data, std::size_t size) override {
        const std::string text(reinterpret_cast<const char*>(data), size);
        auto parsed = boost::json::parse(text);
        const auto& object = parsed.as_object();
        const auto& d = object.at("d").as_object();

        RpcPayload request;
        request.encoding = RpcEncoding::Json;
        request.op = static_cast<RpcOp>(static_cast<std::uint8_t>(object.at("op").as_int64()));
        request.requestId = static_cast<std::uint32_t>(d.at("requestId").as_int64());
        request.methodOrEventId = static_cast<std::uint16_t>(d.at("methodId").as_int64());
        request.bodyEncoding = RpcBodyEncoding::RawBytes;
        if (auto* body = d.if_contains("body")) {
            request.body = jsonArrayToBytes(body->as_array());
        }

        core_.onRpc(std::move(request));
        CapturingPayloadSink sink;
        AxtpInboundProcessor inbound(sink);
        while (auto bytes = core_.tryPopOutboundBytes()) {
            inbound.onBytes(bytes->data(), bytes->size());
        }
        for (const auto& rpc : sink.rpcs) {
            const auto response = serializeResponse(rpc);
            writer_.sendBytes(reinterpret_cast<const Byte*>(response.data()), response.size());
        }
    }

private:
    struct CapturingPayloadSink : IPayloadSink {
        std::vector<RpcPayload> rpcs;

        void onControl(ControlPayload) override {}
        void onRpc(RpcPayload payload) override {
            rpcs.push_back(std::move(payload));
        }
        void onStream(StreamPayload) override {}
    };

    static Bytes jsonArrayToBytes(const boost::json::array& array) {
        Bytes bytes;
        bytes.reserve(array.size());
        for (const auto& value : array) {
            bytes.push_back(static_cast<Byte>(value.as_int64()));
        }
        return bytes;
    }

    static boost::json::array bytesToJsonArray(const Bytes& bytes) {
        boost::json::array array;
        for (auto byte : bytes) {
            array.push_back(byte);
        }
        return array;
    }

    static std::string serializeResponse(const RpcPayload& payload) {
        boost::json::object d;
        d["requestId"] = payload.requestId;
        d["methodId"] = payload.methodOrEventId;
        d["statusCode"] = static_cast<std::uint16_t>(payload.statusCode);
        d["body"] = bytesToJsonArray(payload.body);

        boost::json::object object;
        object["sid"] = "";
        object["op"] = static_cast<std::uint8_t>(payload.op);
        object["d"] = std::move(d);
        return boost::json::serialize(object);
    }

    AxtpCore& core_;
    ITransport& writer_;
};

} // namespace axtp
