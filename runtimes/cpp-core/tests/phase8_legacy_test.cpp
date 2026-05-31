#include <cassert>
#include <cstdint>
#include <fstream>
#include <sstream>
#include <string>
#include <utility>

#include "axtp/broker/axtp_broker.h"
#include "axtp/core/axtp_core.h"
#include "axtp/inbound/axtp_inbound_processor.h"
#include "axtp/io/byte_reader.h"
#include "axtp/io/byte_writer.h"
#include "axtp/io/byte_writer_sink.h"
#include "axtp/legacy/legacy_protocol_adapter.h"
#include "axtp/mux/protocol_mux.h"

namespace {

struct CapturingByteWriter : axtp::IByteWriter {
    axtp::Bytes bytes;

    void writeBytes(const axtp::Byte* data, std::size_t size) override {
        bytes.insert(bytes.end(), data, data + size);
    }
};

struct NullPayloadSink : axtp::IPayloadSink {
    void onControl(axtp::ControlPayload) override {}
    void onRpc(axtp::RpcPayload) override {}
    void onStream(axtp::StreamPayload) override {}
};

std::string readFile(const char* path) {
    std::ifstream file(path);
    std::ostringstream out;
    out << file.rdbuf();
    return out.str();
}

} // namespace

int main() {
    axtp::AxtpCore core;
    axtp::AxtpBroker broker(core.brokerSinkPort());
    core.attachBroker(broker);

    CapturingByteWriter legacyWriter;
    axtp::LegacyProtocolAdapter legacy(core, legacyWriter);
    core.attachLegacyOutbound(legacy);

    NullPayloadSink nullSink;
    axtp::AxtpInboundProcessor axtpInbound(nullSink);
    axtp::ProtocolMux mux(axtpInbound, legacy);

    bool handlerCalled = false;
    broker.registerMethod(0x0101, [&](const axtp::RpcPayload& request) {
        handlerCalled = true;
        assert(request.meta.sourceProtocol == axtp::SourceProtocol::Legacy);
        assert(request.meta.legacySequence == 77);
        assert(request.methodOrEventId == 0x0101);
        assert((request.body == axtp::Bytes{0x01, 0x02}));
        return axtp::Bytes{0x55};
    });

    axtp::ByteWriter request;
    request.writeU32(0x000B0002);
    request.writeU32(77);
    request.writeBytes(axtp::Bytes{0x01, 0x02});
    auto bytes = request.takeBytes();
    mux.onBytes(bytes.data(), bytes.size());
    assert(handlerCalled == false);
    broker.poll();
    assert(handlerCalled);

    assert(!legacyWriter.bytes.empty());
    axtp::ByteReader reader(legacyWriter.bytes);
    auto cmd = reader.readU32();
    auto sequence = reader.readU32();
    auto status = reader.readU16();
    auto body = reader.readBytes(reader.remaining());
    assert(cmd.ok() && cmd.value == 0x000B0002);
    assert(sequence.ok() && sequence.value == 77);
    assert(status.ok() && status.value == 0);
    assert(body.ok());
    assert((body.value == axtp::Bytes{0x55}));

    const auto coreText = readFile("runtimes/cpp-core/include/axtp/core/axtp_core.h");
    const auto brokerText = readFile("runtimes/cpp-core/include/axtp/broker/axtp_broker.h");
    assert(coreText.find("0x000B0002") == std::string::npos);
    assert(brokerText.find("0x000B0002") == std::string::npos);

    return 0;
}
