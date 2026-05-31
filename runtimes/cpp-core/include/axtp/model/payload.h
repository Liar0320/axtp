#pragma once

#include <cstdint>
#include <string>

#include "axtp/model/bytes.h"
#include "axtp/model/protocol_types.h"

namespace axtp {

struct PayloadMeta {
    SourceProtocol sourceProtocol = SourceProtocol::AxtpV1;
    std::uint32_t sessionId = 0;
    std::uint32_t requestId = 0;
    std::string jsonSid;
    std::string jsonRequestId;
    std::string jsonMethodOrEventName;
    bool jsonRequestIdIsString = false;
    std::uint32_t legacySequence = 0;
    std::uint32_t legacyCommandValue = 0;
    std::uint16_t legacyAxdpVersion = 0;
    std::uint16_t legacyAxdpDst = 0;
    std::uint16_t legacyAxdpSrc = 0;
    std::uint16_t legacyAxdpWireCommand = 0;
    std::uint8_t legacyAxdpReportId = 0;
    bool legacyAxdpReportFramed = false;
};

struct ControlPayload {
    ControlOpcode opcode = ControlOpcode::Open;
    std::uint16_t controlId = 0;
    ErrorCode statusCode = ErrorCode::Success;
    PayloadMeta meta;
    Bytes body;
};

struct RpcPayload {
    RpcEncoding encoding = RpcEncoding::Binary;
    RpcOp op = RpcOp::Request;
    std::uint32_t requestId = 0;
    std::uint16_t methodOrEventId = 0;
    ErrorCode statusCode = ErrorCode::Success;
    RpcBodyEncoding bodyEncoding = RpcBodyEncoding::Tlv8;
    PayloadMeta meta;
    Bytes body;
};

struct StreamPayload {
    std::uint32_t streamId = 0;
    std::uint32_t seqId = 0;
    std::uint64_t cursor = 0;
    PayloadMeta meta;
    Bytes data;
};

} // namespace axtp
