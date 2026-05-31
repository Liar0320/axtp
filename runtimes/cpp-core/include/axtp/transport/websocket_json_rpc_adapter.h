#pragma once

#include <cstdint>
#include <limits>
#include <optional>
#include <stdexcept>
#include <string>
#include <utility>

#include <boost/json.hpp>

#include "axtp/broker/axtp_broker.h"
#include "axtp/core/axtp_core.h"
#include "axtp/core/session_context.h"
#include "axtp/generated/registry_lookup.h"
#include "axtp/io/byte_sink.h"
#include "axtp/transport/transport.h"
#include "axtp/transport/websocket_transport.h"

namespace axtp {

class WebSocketJsonRpcAdapter : public IByteSink, public IProtocolOutbound {
public:
    WebSocketJsonRpcAdapter(AxtpCore& core, ITransport& writer, AxtpBroker* broker = nullptr)
        : core_(core), writer_(writer), broker_(broker) {
        core_.attachJsonRpcOutbound(*this);
    }

    void poll(WebSocketTransport& transport) {
        const bool hadConnection = transport.hasConnection();
        transport.poll();
        if (!hadConnection && transport.hasConnection()) {
            helloSent_ = false;
            identified_ = false;
            sid_ = makeSessionId();
        }
        if (transport.hasConnection()) {
            sendHelloOnce();
        }
    }

    void onBytes(const Byte* data, std::size_t size) override {
        try {
            const std::string text(reinterpret_cast<const char*>(data), size);
            const auto parsed = boost::json::parse(text);
            const auto& object = parsed.as_object();
            const auto op = parseOp(object);
            const auto& d = object.contains("d") ? object.at("d").as_object() : emptyObject();

            switch (op) {
            case RpcOp::Identify:
                handleIdentify(object, d);
                break;
            case RpcOp::Reidentify:
                handleReidentify(object, d);
                break;
            case RpcOp::Request:
                handleRequest(object, d);
                break;
            case RpcOp::RequestBatch:
                handleBatch(object, d);
                break;
            default:
                break;
            }
        } catch (const std::exception&) {
            sendError("", ParsedRequestId{}, ErrorCode::RpcPayloadInvalid);
        }
    }

    void sendRpc(RpcPayload payload) override {
        if (payload.op == RpcOp::Event) {
            sendText(serializeEvent(payload));
            return;
        }
        if (payload.op == RpcOp::RequestBatchResponse) {
            sendText(serializeBatchResponse(payload));
            return;
        }
        sendText(serializeResponse(payload));
    }

    void sendEvent(RpcPayload payload) {
        payload.encoding = RpcEncoding::Json;
        payload.op = RpcOp::Event;
        payload.meta.sourceProtocol = SourceProtocol::JsonRpc;
        sendRpc(std::move(payload));
    }

private:
    struct ParsedRequestId {
        std::uint32_t value = 0;
        std::string text;
        bool valid = false;
        bool wasString = false;
    };

    static const boost::json::object& emptyObject() {
        static const boost::json::object empty;
        return empty;
    }

    static RpcOp parseOp(const boost::json::object& object) {
        const auto raw = object.at("op").as_int64();
        if (raw < 0 || raw > std::numeric_limits<std::uint8_t>::max()) {
            throw std::invalid_argument("invalid op");
        }
        return static_cast<RpcOp>(static_cast<std::uint8_t>(raw));
    }

    static std::string parseSid(const boost::json::object& object) {
        if (!object.contains("sid") || object.at("sid").is_null()) {
            return "";
        }
        const auto& sid = object.at("sid");
        if (sid.is_string()) {
            return std::string(sid.as_string());
        }
        if (sid.is_int64()) {
            return std::to_string(sid.as_int64());
        }
        if (sid.is_uint64()) {
            return std::to_string(sid.as_uint64());
        }
        return "";
    }

    static ParsedRequestId parseRequestId(const boost::json::object& d) {
        ParsedRequestId parsed;
        if (!d.contains("id")) {
            return parsed;
        }
        const auto& id = d.at("id");
        std::uint64_t raw = 0;
        if (id.is_uint64()) {
            raw = id.as_uint64();
        } else if (id.is_int64()) {
            const auto signedId = id.as_int64();
            if (signedId < 0) {
                return parsed;
            }
            raw = static_cast<std::uint64_t>(signedId);
        } else if (id.is_string()) {
            parsed.wasString = true;
            parsed.text = std::string(id.as_string());
            try {
                raw = static_cast<std::uint64_t>(std::stoull(parsed.text));
            } catch (const std::exception&) {
                return parsed;
            }
        } else {
            return parsed;
        }

        if (raw == 0 || raw > std::numeric_limits<std::uint32_t>::max()) {
            return parsed;
        }
        parsed.value = static_cast<std::uint32_t>(raw);
        parsed.valid = true;
        if (parsed.text.empty()) {
            parsed.text = std::to_string(parsed.value);
        }
        return parsed;
    }

    static Bytes jsonToBytes(const boost::json::value& value) {
        const auto text = boost::json::serialize(value);
        return Bytes(text.begin(), text.end());
    }

    static std::optional<boost::json::value> bytesToJson(const Bytes& bytes) {
        if (bytes.empty()) {
            return std::nullopt;
        }
        try {
            const std::string text(bytes.begin(), bytes.end());
            return boost::json::parse(text);
        } catch (const std::exception&) {
            return std::nullopt;
        }
    }

    static const char* errorName(ErrorCode code) {
        const auto* descriptor = RegistryLookup::errorByCode(code);
        return descriptor != nullptr ? descriptor->name : "UNKNOWN_ERROR";
    }

    static boost::json::object statusObject(ErrorCode code) {
        boost::json::object status;
        status["ok"] = code == ErrorCode::Success;
        status["code"] = static_cast<std::uint16_t>(code);
        if (code != ErrorCode::Success) {
            status["msg"] = errorName(code);
        }
        return status;
    }

    static void setResponseId(boost::json::object& d, const PayloadMeta& meta, std::uint32_t fallback) {
        if (!meta.jsonRequestId.empty()) {
            if (meta.jsonRequestIdIsString) {
                d["id"] = meta.jsonRequestId;
            } else {
                d["id"] = fallback;
            }
            return;
        }
        d["id"] = fallback;
    }

    void sendHelloOnce() {
        if (helloSent_) {
            return;
        }
        boost::json::object d;
        d["axtpVersion"] = "1.0.0";
        d["rpcVersion"] = 1;

        boost::json::object object;
        object["sid"] = "";
        object["op"] = static_cast<std::uint8_t>(RpcOp::Hello);
        object["d"] = std::move(d);
        sendText(boost::json::serialize(object));
        helloSent_ = true;
    }

    void handleIdentify(const boost::json::object&, const boost::json::object& d) {
        if (const auto* resumeSid = d.if_contains("resumeSid");
            resumeSid != nullptr && resumeSid->is_string() && !resumeSid->as_string().empty()) {
            sid_ = std::string(resumeSid->as_string());
        }
        if (const auto* eventMasks = d.if_contains("eventMasks");
            eventMasks != nullptr && eventMasks->is_string()) {
            eventMasks_ = std::string(eventMasks->as_string());
        }
        identified_ = true;
        sendIdentified();
    }

    void handleReidentify(const boost::json::object&, const boost::json::object& d) {
        if (const auto* eventMasks = d.if_contains("eventMasks");
            eventMasks != nullptr && eventMasks->is_string()) {
            eventMasks_ = std::string(eventMasks->as_string());
        }
        identified_ = true;
        sendIdentified();
    }

    void sendIdentified() {
        boost::json::object d;
        d["negotiatedRpcVersion"] = 1;

        boost::json::object object;
        object["sid"] = sid_;
        object["op"] = static_cast<std::uint8_t>(RpcOp::Identified);
        object["d"] = std::move(d);
        sendText(boost::json::serialize(object));
    }

    void handleRequest(const boost::json::object& object, const boost::json::object& d) {
        const auto sid = parseSid(object);
        auto requestId = parseRequestId(d);
        if (!requestId.valid) {
            sendError(sid, requestId, ErrorCode::RpcRequestIdInvalid);
            return;
        }
        if (!identified_) {
            sendError(sid, requestId, ErrorCode::ControlOpenRequired);
            return;
        }
        if (!d.contains("method") || !d.at("method").is_string()) {
            sendError(sid, requestId, ErrorCode::RpcPayloadInvalid);
            return;
        }

        const std::string method(d.at("method").as_string());
        const auto methodId = RegistryLookup::methodIdByName(method);
        if (!methodId.has_value()) {
            sendError(sid, requestId, ErrorCode::RpcMethodNotFound);
            return;
        }

        RpcPayload request;
        request.encoding = RpcEncoding::Json;
        request.op = RpcOp::Request;
        request.requestId = requestId.value;
        request.methodOrEventId = *methodId;
        request.bodyEncoding = RpcBodyEncoding::RawBytes;
        request.meta.sourceProtocol = SourceProtocol::JsonRpc;
        request.meta.sessionId = 1;
        request.meta.requestId = requestId.value;
        request.meta.jsonSid = sid.empty() ? sid_ : sid;
        request.meta.jsonRequestId = requestId.text;
        request.meta.jsonRequestIdIsString = requestId.wasString;
        request.meta.jsonMethodOrEventName = method;
        if (const auto* params = d.if_contains("params")) {
            request.body = jsonToBytes(*params);
        }

        core_.payloadSinkPort().onRpc(std::move(request));
        if (broker_ != nullptr) {
            broker_->poll();
        }
    }

    void handleBatch(const boost::json::object& object, const boost::json::object& d) {
        sendError(parseSid(object), parseRequestId(d), ErrorCode::RpcBatchUnsupported, RpcOp::RequestBatchResponse);
    }

    void sendError(const std::string& sid,
                   const ParsedRequestId& requestId,
                   ErrorCode code,
                   RpcOp responseOp = RpcOp::RequestResponse) {
        RpcPayload response;
        response.encoding = RpcEncoding::Json;
        response.op = responseOp;
        response.requestId = requestId.value;
        response.statusCode = code;
        response.bodyEncoding = RpcBodyEncoding::RawBytes;
        response.meta.sourceProtocol = SourceProtocol::JsonRpc;
        response.meta.jsonSid = sid.empty() ? sid_ : sid;
        response.meta.jsonRequestId = requestId.text;
        response.meta.jsonRequestIdIsString = requestId.wasString;
        sendRpc(std::move(response));
    }

    std::string serializeResponse(const RpcPayload& payload) const {
        boost::json::object d;
        setResponseId(d, payload.meta, payload.requestId);

        auto statusCode = payload.statusCode;
        auto result = bytesToJson(payload.body);
        if (statusCode == ErrorCode::Success && !payload.body.empty() && !result.has_value()) {
            statusCode = ErrorCode::RpcBodyDecodeFailed;
        }
        d["status"] = statusObject(statusCode);
        if (statusCode == ErrorCode::Success && result.has_value()) {
            d["result"] = std::move(*result);
        }

        boost::json::object object;
        object["sid"] = responseSid(payload.meta);
        object["op"] = static_cast<std::uint8_t>(RpcOp::RequestResponse);
        object["d"] = std::move(d);
        return boost::json::serialize(object);
    }

    std::string serializeBatchResponse(const RpcPayload& payload) const {
        boost::json::object d;
        setResponseId(d, payload.meta, payload.requestId);
        d["status"] = statusObject(payload.statusCode);

        boost::json::object object;
        object["sid"] = responseSid(payload.meta);
        object["op"] = static_cast<std::uint8_t>(RpcOp::RequestBatchResponse);
        object["d"] = std::move(d);
        return boost::json::serialize(object);
    }

    std::string serializeEvent(const RpcPayload& payload) const {
        boost::json::object d;
        std::string eventName = payload.meta.jsonMethodOrEventName;
        if (eventName.empty()) {
            const auto* event = RegistryLookup::eventById(payload.methodOrEventId);
            eventName = event != nullptr ? event->name : "";
        }
        d["event"] = eventName;
        if (auto data = bytesToJson(payload.body)) {
            d["data"] = std::move(*data);
        }

        boost::json::object object;
        object["sid"] = responseSid(payload.meta);
        object["op"] = static_cast<std::uint8_t>(RpcOp::Event);
        object["d"] = std::move(d);
        return boost::json::serialize(object);
    }

    std::string responseSid(const PayloadMeta& meta) const {
        if (!meta.jsonSid.empty()) {
            return meta.jsonSid;
        }
        return sid_;
    }

    void sendText(const std::string& text) {
        writer_.sendBytes(reinterpret_cast<const Byte*>(text.data()), text.size());
    }

    std::string makeSessionId() {
        return std::to_string(nextSessionId_++);
    }

    AxtpCore& core_;
    ITransport& writer_;
    AxtpBroker* broker_ = nullptr;
    bool helloSent_ = false;
    bool identified_ = false;
    std::uint32_t nextSessionId_ = 1;
    std::string sid_ = makeSessionId();
    std::string eventMasks_;
};

} // namespace axtp
