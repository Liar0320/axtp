#pragma once

#include <utility>

#include "axtp/model/payload.hpp"
#include "axtp/model/protocol_types.hpp"
#include "axtp/transport/transport_profile.hpp"

namespace axtp {

struct SessionContext {
    std::uint32_t sessionId = 0;
    TransportProfile transportProfile;
    RpcEncoding selectedEncoding = RpcEncoding::Tlv;
};

class IProtocolOutbound {
public:
    virtual ~IProtocolOutbound() = default;
    virtual void sendRpc(RpcPayload payload) = 0;
};

}  // namespace axtp
