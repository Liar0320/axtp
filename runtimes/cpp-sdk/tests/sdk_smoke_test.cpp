#include <cassert>
#include <memory>
#include <string>

#include "axtp/testing/mock_transport.hpp"

#include "axtp_sdk/axtp_sdk_all.hpp"

int main() {
    axtp::sdk::AxtpClient client;
    client.attachTransport(std::make_unique<axtp::MockTransport>());
    assert(client.isConnected());

    client.registerMethod(
        static_cast<std::uint16_t>(axtp::MethodId::DeviceGetInfo), [](const axtp::RpcPayload&) {
            const std::string body = R"({"vendor":"AuditoryWorks","product":"AXTP"})";
            return axtp::Bytes(body.begin(), body.end());
        });
    client.registerMethod(static_cast<std::uint16_t>(axtp::MethodId::DisplaySetBrightness),
                          [](const axtp::RpcPayload& request) {
                              if (request.encoding == axtp::RpcEncoding::Json) {
                                  const std::string body(request.body.begin(), request.body.end());
                                  assert(body.find("\"value\":80") != std::string::npos);
                              } else {
                                  assert((request.body == axtp::Bytes{0x01, 0x01, 0x50}));
                              }
                              return axtp::Bytes{};
                          });
    client.registerMethod(static_cast<std::uint16_t>(axtp::MethodId::DisplayGetBrightness),
                          [](const axtp::RpcPayload&) {
                              const std::string body = R"({"value":80})";
                              return axtp::Bytes(body.begin(), body.end());
                          });
    client.registerMethod(0x90010001, [](const axtp::RpcPayload& request) { return request.body; });
    client.registry().addMethod(0x90010001, "vendor.echo");

    axtp::RpcPayload raw;
    raw.encoding = axtp::RpcEncoding::Json;
    raw.op = axtp::RpcOp::Request;
    raw.methodOrEventId = static_cast<std::uint16_t>(axtp::MethodId::DeviceGetInfo);
    raw.bodyEncoding = axtp::RpcBodyEncoding::RawBytes;
    raw.body = {'{', '}'};
    auto response = client.callRaw(raw);
    assert(response.statusCode == axtp::ErrorCode::Success);
    assert(response.op == axtp::RpcOp::RequestResponse);

    const auto dynamicJsonByName = client.callJson("device.getInfo", "{}");
    assert(dynamicJsonByName.find("AuditoryWorks") != std::string::npos);

    const auto dynamicJsonById = client.callJson(0x90010001, R"({"hello":true})");
    assert(dynamicJsonById == R"({"hello":true})");

    auto tlv = client.callTlv("display.setBrightness", axtp::Bytes{0x01, 0x01, 0x50});
    assert((tlv == axtp::Bytes{}));

    auto rawBytes = client.callRawBytes(0x90010001, axtp::Bytes{0xCA, 0xFE});
    assert((rawBytes == axtp::Bytes{0xCA, 0xFE}));

    axtp::sdk::AxtpDevice device(client);
    auto info = device.device.getInfo();
    assert(info.has_vendor);
    assert(std::string(info.vendor) == "AuditoryWorks");

    auto empty = device.display.setBrightness(80);
    (void)empty;
    auto brightness =
        client.callTyped<axtp::MethodId::DisplayGetBrightness>(axtp::DisplayGetBrightnessRequest{});
    assert(brightness.value == 80);

    const auto methods = device.capability.methods();
    assert(!methods.empty());
    assert(axtp::RegistryLookup::methodIdByName("device.getInfo").has_value());

    client.close();
    assert(!client.isConnected());
}
