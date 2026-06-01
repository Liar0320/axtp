#pragma once

#include "axtp_sdk/axtp_client.hpp"
#include "axtp_sdk/capability_client.hpp"
#include "axtp_sdk/generated/device_client.h"
#include "axtp_sdk/generated/display_client.h"
#include "axtp_sdk/generated/firmware_client.h"

namespace axtp::sdk {

class AxtpDevice {
public:
    explicit AxtpDevice(AxtpClient& client)
        : device(client)
        , display(client)
        , capability(client)
        , firmware(client) {}

    DeviceClient device;
    DisplayClient display;
    CapabilityClient capability;
    FirmwareClient firmware;
};

}  // namespace axtp::sdk
