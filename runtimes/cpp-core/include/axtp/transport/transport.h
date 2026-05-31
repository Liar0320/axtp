#pragma once

#include <cstddef>

#include "axtp/io/byte_sink.h"
#include "axtp/model/bytes.h"
#include "axtp/transport/transport_profile.h"

namespace axtp {

class ITransport {
public:
    virtual ~ITransport() = default;
    virtual void bind(IByteSink& sink) = 0;
    virtual void open() = 0;
    virtual void close() = 0;
    virtual void sendBytes(const Byte* data, std::size_t size) = 0;
    virtual TransportProfile profile() const = 0;
};

} // namespace axtp
