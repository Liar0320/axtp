#pragma once

#include <cstdint>
#include <exception>
#include <string>
#include <type_traits>

#include <boost/json.hpp>

#include "axtp/generated/method_traits.h"
#include "axtp/model/bytes.hpp"
#include "axtp/model/payload.hpp"

namespace axtp {

class SchemaCodec {
public:
    static RpcBodyEncoding bodyEncodingFor(RpcEncoding encoding) {
        if (encoding == RpcEncoding::Tlv || encoding == RpcEncoding::Binary) {
            return RpcBodyEncoding::Tlv8;
        }
        return RpcBodyEncoding::RawBytes;
    }

    template <MethodId Id>
    static Bytes encodeRequest(const typename MethodTraits<Id>::Request& request, RpcEncoding encoding) {
        if (encoding != RpcEncoding::Json) {
            return {};
        }
        const auto json = requestToJson<Id>(request);
        const auto text = boost::json::serialize(json);
        return Bytes(text.begin(), text.end());
    }

    template <MethodId Id>
    static typename MethodTraits<Id>::Response decodeResponse(const Bytes& bytes, RpcEncoding encoding) {
        typename MethodTraits<Id>::Response response{};
        if (encoding != RpcEncoding::Json || bytes.empty()) {
            return response;
        }
        try {
            const std::string text(bytes.begin(), bytes.end());
            const auto parsed = boost::json::parse(text);
            if (!parsed.is_object()) {
                return response;
            }
            fillResponse<Id>(parsed.as_object(), response);
        } catch (const std::exception&) {
        }
        return response;
    }

    template <EventId Id>
    static Bytes encodeEvent(const typename EventTraits<Id>::Event& event, RpcEncoding encoding) {
        if (encoding != RpcEncoding::Json) {
            return {};
        }
        const auto json = eventToJson<Id>(event);
        const auto text = boost::json::serialize(json);
        return Bytes(text.begin(), text.end());
    }

private:
    template <MethodId Id>
    static boost::json::object requestToJson(const typename MethodTraits<Id>::Request& request) {
        boost::json::object object;
        if constexpr (Id == MethodId::DisplaySetBrightness) {
            object["value"] = request.value;
            if (request.has_transitionMs) {
                object["transitionMs"] = request.transitionMs;
            }
        } else if constexpr (Id == MethodId::FirmwareEnd) {
            object["transferId"] = request.transferId;
            if (request.has_totalBytesSent) {
                object["totalBytesSent"] = request.totalBytesSent;
            }
            if (request.has_totalChunks) {
                object["totalChunks"] = request.totalChunks;
            }
        } else if constexpr (Id == MethodId::FirmwareVerify) {
            object["transferId"] = request.transferId;
        } else if constexpr (Id == MethodId::FirmwareApply) {
            object["transferId"] = request.transferId;
            object["applyMode"] = request.applyMode;
        } else {
            (void)request;
        }
        return object;
    }

    template <MethodId Id>
    static void fillResponse(const boost::json::object& object, typename MethodTraits<Id>::Response& response) {
        if constexpr (Id == MethodId::DeviceGetInfo) {
            static thread_local std::string vendor;
            static thread_local std::string product;
            static thread_local std::string firmwareVersion;
            static thread_local std::string serialNumber;
            assignOptionalString(object, "vendor", vendor, response.vendor, response.has_vendor);
            assignOptionalString(object, "product", product, response.product, response.has_product);
            assignOptionalString(object,
                                 "firmwareVersion",
                                 firmwareVersion,
                                 response.firmwareVersion,
                                 response.has_firmwareVersion);
            assignOptionalString(object,
                                 "serialNumber",
                                 serialNumber,
                                 response.serialNumber,
                                 response.has_serialNumber);
        } else if constexpr (Id == MethodId::DisplayGetBrightness) {
            if (const auto* value = object.if_contains("value")) {
                if (value->is_int64()) {
                    response.value = static_cast<std::uint8_t>(value->as_int64());
                } else if (value->is_uint64()) {
                    response.value = static_cast<std::uint8_t>(value->as_uint64());
                }
            }
        } else {
            (void)object;
            (void)response;
        }
    }

    static void assignOptionalString(const boost::json::object& object,
                                     const char* key,
                                     std::string& storage,
                                     const char*& target,
                                     bool& hasValue) {
        const auto* value = object.if_contains(key);
        if (value == nullptr || !value->is_string()) {
            hasValue = false;
            target = nullptr;
            return;
        }
        storage = std::string(value->as_string());
        target = storage.c_str();
        hasValue = true;
    }

    template <EventId Id>
    static boost::json::object eventToJson(const typename EventTraits<Id>::Event& event) {
        boost::json::object object;
        if constexpr (Id == EventId::DisplayBrightnessChanged) {
            object["value"] = event.value;
            if (event.has_previousValue) {
                object["previousValue"] = event.previousValue;
            }
        } else if constexpr (Id == EventId::FirmwareUpdateProgress) {
            object["transferId"] = event.transferId;
            object["percent"] = event.percent;
        } else {
            (void)event;
        }
        return object;
    }
};

} // namespace axtp
