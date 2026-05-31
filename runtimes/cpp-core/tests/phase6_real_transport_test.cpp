#include <atomic>
#include <array>
#include <cassert>
#include <chrono>
#include <string>
#include <thread>
#include <utility>

#include <boost/asio.hpp>
#include <boost/beast/core.hpp>
#include <boost/beast/websocket.hpp>
#include <boost/json.hpp>

#include "axtp/broker/axtp_broker.h"
#include "axtp/core/axtp_core.h"
#include "axtp/inbound/axtp_inbound_processor.h"
#include "axtp/io/byte_writer_sink.h"
#include "axtp/outbound/axtp_outbound_processor.h"
#include "axtp/transport/tcp_transport.h"
#include "axtp/transport/websocket_json_rpc_adapter.h"
#include "axtp/transport/websocket_transport.h"

namespace {

struct CapturingByteWriter : axtp::IByteWriter {
    axtp::Bytes bytes;

    void writeBytes(const axtp::Byte* data, std::size_t size) override {
        bytes.insert(bytes.end(), data, data + size);
    }
};

struct CapturingPayloadSink : axtp::IPayloadSink {
    std::vector<axtp::RpcPayload> rpcs;

    void onControl(axtp::ControlPayload) override {}
    void onRpc(axtp::RpcPayload payload) override {
        rpcs.push_back(std::move(payload));
    }
    void onStream(axtp::StreamPayload) override {}
};

axtp::Bytes encodeRpcRequest(std::uint32_t requestId) {
    axtp::RpcPayload request;
    request.encoding = axtp::RpcEncoding::Binary;
    request.op = axtp::RpcOp::Request;
    request.requestId = requestId;
    request.methodOrEventId = 0x0101;
    request.bodyEncoding = axtp::RpcBodyEncoding::Tlv8;
    CapturingByteWriter writer;
    axtp::AxtpOutboundProcessor outbound(writer);
    outbound.sendRpcRequest(request);
    return writer.bytes;
}

} // namespace

int main() {
    {
        axtp::AxtpCore core;
        axtp::AxtpBroker broker(core.brokerSinkPort());
        core.attachBroker(broker);
        broker.registerMethod(0x0101, [](const axtp::RpcPayload&) {
            return axtp::Bytes{0xA1};
        });

        axtp::TcpTransport server(0);
        core.attachTransport(server);
        server.open();
        assert(server.profile().kind == axtp::TransportKind::Tcp);
        const auto port = server.localPort();
        assert(port != 0);

        boost::asio::io_context io;
        boost::asio::ip::tcp::socket client(io);
        client.connect({boost::asio::ip::make_address("127.0.0.1"), port});
        client.non_blocking(true);
        const auto first = encodeRpcRequest(601);
        const auto second = encodeRpcRequest(602);
        boost::asio::write(client, boost::asio::buffer(first));
        boost::asio::write(client, boost::asio::buffer(second));

        axtp::Bytes responseBytes;
        for (int i = 0; i < 100 && responseBytes.empty(); ++i) {
            server.poll();
            broker.poll();
            core.flushOutbound();
            std::array<axtp::Byte, 4096> buffer{};
            boost::system::error_code ec;
            const auto n = client.read_some(boost::asio::buffer(buffer), ec);
            if (!ec && n > 0) {
                responseBytes.insert(responseBytes.end(), buffer.begin(), buffer.begin() + n);
                break;
            }
            if (ec != boost::asio::error::would_block && ec != boost::asio::error::try_again) {
                assert(false);
            }
            std::this_thread::sleep_for(std::chrono::milliseconds(5));
        }
        assert(!responseBytes.empty());
        CapturingPayloadSink sink;
        axtp::AxtpInboundProcessor inbound(sink);
        inbound.onBytes(responseBytes.data(), responseBytes.size());
        assert(!sink.rpcs.empty());
        assert(sink.rpcs[0].op == axtp::RpcOp::RequestResponse);
        assert(sink.rpcs[0].requestId == 601);
        assert((sink.rpcs[0].body == axtp::Bytes{0xA1}));
        server.close();
    }

    {
        axtp::AxtpCore core;
        axtp::AxtpBroker broker(core.brokerSinkPort());
        core.attachBroker(broker);
        broker.registerMethod(0x0101, [](const axtp::RpcPayload&) {
            return axtp::Bytes{0xB1, 0xB2};
        });

        axtp::WebSocketTransport server(0);
        axtp::WebSocketJsonRpcAdapter adapter(core, server, &broker);
        server.bind(adapter);
        server.open();
        assert(server.profile().kind == axtp::TransportKind::WebSocket);
        assert(server.profile().wireMode == axtp::AxtpWireMode::WebSocketJsonRpc);
        assert(server.profile().supportsControl == false);
        assert(server.profile().supportsStream == false);
        const auto port = server.localPort();
        assert(port != 0);

        std::atomic<bool> clientDone{false};
        std::string responseText;
        std::thread clientThread([&] {
            boost::asio::io_context io;
            boost::beast::websocket::stream<boost::asio::ip::tcp::socket> ws(io);
            boost::asio::ip::tcp::resolver resolver(io);
            auto endpoints = resolver.resolve("127.0.0.1", std::to_string(port));
            boost::asio::connect(ws.next_layer(), endpoints);
            ws.handshake("127.0.0.1", "/");
            ws.write(boost::asio::buffer(std::string(
                R"({"sid":"","op":7,"d":{"requestId":701,"methodId":257,"body":[1]}})")));
            boost::beast::flat_buffer buffer;
            ws.read(buffer);
            responseText = boost::beast::buffers_to_string(buffer.data());
            clientDone = true;
        });

        for (int i = 0; i < 100 && !clientDone; ++i) {
            server.poll();
            std::this_thread::sleep_for(std::chrono::milliseconds(5));
        }
        clientThread.join();
        assert(clientDone);
        auto parsed = boost::json::parse(responseText).as_object();
        assert(parsed.at("op").as_int64() == static_cast<int>(axtp::RpcOp::RequestResponse));
        const auto& d = parsed.at("d").as_object();
        assert(d.at("requestId").as_int64() == 701);
        assert(d.at("methodId").as_int64() == 257);
        assert(d.at("statusCode").as_int64() == 0);
        const auto& body = d.at("body").as_array();
        assert(body.size() == 2);
        assert(body[0].as_int64() == 0xB1);
        assert(body[1].as_int64() == 0xB2);
        server.close();
    }

    return 0;
}
