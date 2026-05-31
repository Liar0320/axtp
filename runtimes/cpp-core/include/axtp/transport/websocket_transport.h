#pragma once

#include <cstdint>
#include <memory>

#include <boost/asio.hpp>
#include <boost/beast/core.hpp>
#include <boost/beast/websocket.hpp>

#include "axtp/transport/transport.h"

namespace axtp {

class WebSocketTransport : public ITransport {
public:
    explicit WebSocketTransport(std::uint16_t port, const char* address = "127.0.0.1")
        : endpoint_(boost::asio::ip::make_address(address), port),
          acceptor_(io_) {}

    void bind(IByteSink& sink) override {
        sink_ = &sink;
    }

    void open() override {
        boost::system::error_code ec;
        acceptor_.open(endpoint_.protocol(), ec);
        acceptor_.set_option(boost::asio::ip::tcp::acceptor::reuse_address(true), ec);
        acceptor_.bind(endpoint_, ec);
        acceptor_.listen(boost::asio::socket_base::max_listen_connections, ec);
        acceptor_.non_blocking(true, ec);
        open_ = !ec;
    }

    void close() override {
        boost::system::error_code ec;
        if (websocket_) {
            websocket_->close(boost::beast::websocket::close_code::normal, ec);
            websocket_.reset();
        }
        acceptor_.close(ec);
        open_ = false;
    }

    void poll() {
        if (!open_) {
            return;
        }
        acceptOne();
        readOne();
    }

    void sendBytes(const Byte* data, std::size_t size) override {
        if (!websocket_) {
            return;
        }
        boost::system::error_code ec;
        websocket_->text(true);
        websocket_->write(boost::asio::buffer(data, size), ec);
    }

    TransportProfile profile() const override {
        TransportProfile profile;
        profile.kind = TransportKind::WebSocket;
        profile.protocolMode = ProtocolMode::AxtpV1;
        profile.wireMode = AxtpWireMode::WebSocketJsonRpc;
        profile.defaultRpcEncoding = RpcEncoding::Json;
        profile.messageOriented = true;
        profile.supportsTextMessage = true;
        profile.supportsBinaryMessage = false;
        profile.supportsControl = false;
        profile.supportsStream = false;
        return profile;
    }

    std::uint16_t localPort() const {
        boost::system::error_code ec;
        return acceptor_.is_open() ? acceptor_.local_endpoint(ec).port() : 0;
    }

    bool hasConnection() const {
        return websocket_ != nullptr;
    }

private:
    using WebSocket = boost::beast::websocket::stream<boost::asio::ip::tcp::socket>;

    void acceptOne() {
        if (websocket_ != nullptr) {
            return;
        }
        boost::asio::ip::tcp::socket socket(io_);
        boost::system::error_code ec;
        acceptor_.accept(socket, ec);
        if (ec) {
            return;
        }
        websocket_ = std::make_unique<WebSocket>(std::move(socket));
        websocket_->accept(ec);
        if (ec) {
            websocket_.reset();
            return;
        }
    }

    void readOne() {
        if (!websocket_ || !sink_) {
            return;
        }
        boost::system::error_code availableEc;
        if (websocket_->next_layer().available(availableEc) == 0 || availableEc) {
            return;
        }
        boost::beast::flat_buffer buffer;
        boost::system::error_code ec;
        websocket_->read(buffer, ec);
        if (ec) {
            return;
        }
        auto bytes = boost::beast::buffers_to_string(buffer.data());
        sink_->onBytes(reinterpret_cast<const Byte*>(bytes.data()), bytes.size());
    }

    boost::asio::io_context io_;
    boost::asio::ip::tcp::endpoint endpoint_;
    boost::asio::ip::tcp::acceptor acceptor_;
    std::unique_ptr<WebSocket> websocket_;
    IByteSink* sink_ = nullptr;
    bool open_ = false;
};

} // namespace axtp
