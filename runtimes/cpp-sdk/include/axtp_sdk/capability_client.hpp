#pragma once

#include <cstddef>
#include <vector>

#include "axtp/generated/axtp_method_registry_generated.h"

#include "axtp_sdk/axtp_client.hpp"
#include "axtp_sdk/generated/capability_client.h"

namespace axtp::sdk {

class CapabilityClient {
public:
    explicit CapabilityClient(AxtpClient& client)
        : generated(client) {}

    std::vector<MethodDescriptor> methods() const {
        return std::vector<MethodDescriptor>(kMethodRegistry,
                                             kMethodRegistry + kMethodRegistryCount);
    }

    GeneratedCapabilityClient generated;
};

}  // namespace axtp::sdk
