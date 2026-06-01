#pragma once

#include "axtp/generated/method_traits.h"
#include "axtp_sdk/axtp_client.hpp"

namespace axtp::sdk {

class DeviceClient {
public:
    explicit DeviceClient(AxtpClient& client)
        : client_(client) {}

    DeviceGetInfoResponse getInfo(CallOptions options = {}) {
        DeviceGetInfoRequest request;
        return client_.call<MethodId::DeviceGetInfo>(request, options);
    }

private:
    AxtpClient& client_;
};

} // namespace axtp::sdk
