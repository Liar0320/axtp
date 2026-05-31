#pragma once

#include <cstdint>

#include "axtp/model/bytes.h"
#include "axtp/model/protocol_types.h"

namespace axtp {

struct Message {
    std::uint16_t messageId = 0;
    PayloadType payloadType = PayloadType::Rpc;
    Bytes body;
};

} // namespace axtp
