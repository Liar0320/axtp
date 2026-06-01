#pragma once

#include <cstdint>

#include "axtp/generated/method_traits.h"
#include "axtp_sdk/axtp_client.hpp"

namespace axtp::sdk {

class DisplayClient {
public:
    explicit DisplayClient(AxtpClient& client)
        : client_(client) {}

    DisplayGetBrightnessResponse getBrightness(CallOptions options = {}) {
        DisplayGetBrightnessRequest request;
        return client_.call<MethodId::DisplayGetBrightness>(request, options);
    }

    CommonEmptyResponse setBrightness(std::uint8_t value, CallOptions options = {}) {
        DisplaySetBrightnessRequest request;
        request.value = value;
        return setBrightness(request, options);
    }

    CommonEmptyResponse setBrightness(const DisplaySetBrightnessRequest& request,
                                      CallOptions options = {}) {
        return client_.call<MethodId::DisplaySetBrightness>(request, options);
    }

private:
    AxtpClient& client_;
};

} // namespace axtp::sdk
