#pragma once

#include "axtp/generated/method_traits.h"
#include "axtp_sdk/axtp_client.hpp"

namespace axtp::sdk {

class GeneratedCapabilityClient {
public:
    explicit GeneratedCapabilityClient(AxtpClient& client)
        : client_(client) {}

    CapabilitySupportedMethodsResponse supportedMethods(CallOptions options = {}) {
        CapabilitySupportedMethodsRequest request;
        return client_.call<MethodId::CapabilitySupportedMethods>(request, options);
    }

private:
    AxtpClient& client_;
};

} // namespace axtp::sdk
