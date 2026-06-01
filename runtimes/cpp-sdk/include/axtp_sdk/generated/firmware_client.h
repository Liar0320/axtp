#pragma once

#include "axtp/generated/method_traits.h"
#include "axtp_sdk/axtp_client.hpp"

namespace axtp::sdk {

class FirmwareClient {
public:
    explicit FirmwareClient(AxtpClient& client)
        : client_(client) {}

    FirmwareBeginResponse begin(const FirmwareBeginRequest& request, CallOptions options = {}) {
        return client_.call<MethodId::FirmwareBegin>(request, options);
    }

    FirmwareEndResponse end(const FirmwareEndRequest& request, CallOptions options = {}) {
        return client_.call<MethodId::FirmwareEnd>(request, options);
    }

    FirmwareVerifyResponse verify(const FirmwareVerifyRequest& request, CallOptions options = {}) {
        return client_.call<MethodId::FirmwareVerify>(request, options);
    }

    FirmwareApplyResponse apply(const FirmwareApplyRequest& request, CallOptions options = {}) {
        return client_.call<MethodId::FirmwareApply>(request, options);
    }

private:
    AxtpClient& client_;
};

} // namespace axtp::sdk
