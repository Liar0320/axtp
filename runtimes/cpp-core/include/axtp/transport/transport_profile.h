#pragma once

#include <cstddef>

#include "axtp/model/payload.h"
#include "axtp/model/protocol_types.h"

namespace axtp {

enum class TransportKind {
    Tcp,
    WebSocket,
    Hid,
    Ble,
    Uart,
    Mock,
    Custom,
};

enum class AxtpWireMode {
    FramedBinary,
    WebSocketJsonRpc,
};

struct TransportProfile {
    TransportKind kind = TransportKind::Custom;
    ProtocolMode protocolMode = ProtocolMode::AxtpV1;
    AxtpWireMode wireMode = AxtpWireMode::FramedBinary;
    RpcEncoding defaultRpcEncoding = RpcEncoding::Binary;
    bool messageOriented = false;
    bool supportsTextMessage = false;
    bool supportsBinaryMessage = true;
    bool supportsControl = true;
    bool supportsStream = true;
    std::size_t preferredFrameSize = 4096;
};

} // namespace axtp
