#pragma once

#include <cstdint>

#include "axtp/generated/axtp_ids_generated.h"
#include "axtp/generated/axtp_tlv_codec_generated.h"

namespace axtp {

template <MethodId Id>
struct MethodTraits;

template <>
struct MethodTraits<MethodId::DeviceGetInfo> {
    using Request = DeviceGetInfoRequest;
    using Response = DeviceGetInfoResponse;
    static constexpr std::uint16_t id = static_cast<std::uint16_t>(MethodId::DeviceGetInfo);
    static constexpr const char* name = "device.getInfo";
};

template <>
struct MethodTraits<MethodId::CapabilitySupportedMethods> {
    using Request = CapabilitySupportedMethodsRequest;
    using Response = CapabilitySupportedMethodsResponse;
    static constexpr std::uint16_t id = static_cast<std::uint16_t>(MethodId::CapabilitySupportedMethods);
    static constexpr const char* name = "capability.supportedMethods";
};

template <>
struct MethodTraits<MethodId::DisplayGetBrightness> {
    using Request = DisplayGetBrightnessRequest;
    using Response = DisplayGetBrightnessResponse;
    static constexpr std::uint16_t id = static_cast<std::uint16_t>(MethodId::DisplayGetBrightness);
    static constexpr const char* name = "display.getBrightness";
};

template <>
struct MethodTraits<MethodId::DisplaySetBrightness> {
    using Request = DisplaySetBrightnessRequest;
    using Response = CommonEmptyResponse;
    static constexpr std::uint16_t id = static_cast<std::uint16_t>(MethodId::DisplaySetBrightness);
    static constexpr const char* name = "display.setBrightness";
};

template <>
struct MethodTraits<MethodId::StreamOpen> {
    using Request = StreamOpenRequest;
    using Response = StreamOpenResponse;
    static constexpr std::uint16_t id = static_cast<std::uint16_t>(MethodId::StreamOpen);
    static constexpr const char* name = "stream.open";
};

template <>
struct MethodTraits<MethodId::FirmwareBegin> {
    using Request = FirmwareBeginRequest;
    using Response = FirmwareBeginResponse;
    static constexpr std::uint16_t id = static_cast<std::uint16_t>(MethodId::FirmwareBegin);
    static constexpr const char* name = "firmware.begin";
};

template <>
struct MethodTraits<MethodId::FirmwareEnd> {
    using Request = FirmwareEndRequest;
    using Response = FirmwareEndResponse;
    static constexpr std::uint16_t id = static_cast<std::uint16_t>(MethodId::FirmwareEnd);
    static constexpr const char* name = "firmware.end";
};

template <>
struct MethodTraits<MethodId::FirmwareVerify> {
    using Request = FirmwareVerifyRequest;
    using Response = FirmwareVerifyResponse;
    static constexpr std::uint16_t id = static_cast<std::uint16_t>(MethodId::FirmwareVerify);
    static constexpr const char* name = "firmware.verify";
};

template <>
struct MethodTraits<MethodId::FirmwareApply> {
    using Request = FirmwareApplyRequest;
    using Response = FirmwareApplyResponse;
    static constexpr std::uint16_t id = static_cast<std::uint16_t>(MethodId::FirmwareApply);
    static constexpr const char* name = "firmware.apply";
};

template <>
struct MethodTraits<MethodId::NetworkGetApInfo> {
    using Request = NetworkGetApInfoRequest;
    using Response = NetworkGetApInfoResponse;
    static constexpr std::uint16_t id = static_cast<std::uint16_t>(MethodId::NetworkGetApInfo);
    static constexpr const char* name = "network.getApInfo";
};

template <EventId Id>
struct EventTraits;

template <>
struct EventTraits<EventId::DisplayBrightnessChanged> {
    using Event = DisplayBrightnessChangedEvent;
    static constexpr std::uint16_t id = static_cast<std::uint16_t>(EventId::DisplayBrightnessChanged);
    static constexpr const char* name = "display.brightnessChanged";
};

template <>
struct EventTraits<EventId::StreamOpened> {
    using Event = StreamOpenedEvent;
    static constexpr std::uint16_t id = static_cast<std::uint16_t>(EventId::StreamOpened);
    static constexpr const char* name = "stream.opened";
};

template <>
struct EventTraits<EventId::StreamError> {
    using Event = StreamErrorEvent;
    static constexpr std::uint16_t id = static_cast<std::uint16_t>(EventId::StreamError);
    static constexpr const char* name = "stream.error";
};

template <>
struct EventTraits<EventId::FirmwareUpdateProgress> {
    using Event = FirmwareUpdateProgressEvent;
    static constexpr std::uint16_t id = static_cast<std::uint16_t>(EventId::FirmwareUpdateProgress);
    static constexpr const char* name = "firmware.updateProgress";
};

template <>
struct EventTraits<EventId::FirmwareUpdateCompleted> {
    using Event = FirmwareUpdateCompletedEvent;
    static constexpr std::uint16_t id = static_cast<std::uint16_t>(EventId::FirmwareUpdateCompleted);
    static constexpr const char* name = "firmware.updateCompleted";
};

template <>
struct EventTraits<EventId::FirmwareUpdateFailed> {
    using Event = FirmwareUpdateFailedEvent;
    static constexpr std::uint16_t id = static_cast<std::uint16_t>(EventId::FirmwareUpdateFailed);
    static constexpr const char* name = "firmware.updateFailed";
};

template <>
struct EventTraits<EventId::NetworkApInfoChanged> {
    using Event = NetworkApInfoChangedEvent;
    static constexpr std::uint16_t id = static_cast<std::uint16_t>(EventId::NetworkApInfoChanged);
    static constexpr const char* name = "network.apInfoChanged";
};

} // namespace axtp
