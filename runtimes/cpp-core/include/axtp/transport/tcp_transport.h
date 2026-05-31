#pragma once

#include <array>
#include <cstdint>
#include <memory>

#include <boost/asio.hpp>

#include "axtp/transport/transport.h"

namespace axtp {

class TcpTransport : public ITransport {
public:
    explicit TcpTransport(std::uint16_t port, const char* address = "127.0.0.1")
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
        if (socket_) {
            socket_->close(ec);
            socket_.reset();
        }
        acceptor_.close(ec);
        open_ = false;
    }

    void poll() {
        if (!open_) {
            return;
        }
        acceptOne();
        readAvailable();
    }

    void sendBytes(const Byte* data, std::size_t size) override {
        if (!socket_ || !socket_->is_open()) {
            return;
        }
        boost::system::error_code ec;
        boost::asio::write(*socket_, boost::asio::buffer(data, size), ec);
    }

    TransportProfile profile() const override {
        TransportProfile profile;
        profile.kind = TransportKind::Tcp;
        profile.protocolMode = ProtocolMode::AxtpV1;
        profile.wireMode = AxtpWireMode::FramedBinary;
        profile.defaultRpcEncoding = RpcEncoding::Binary;
        profile.messageOriented = false;
        profile.supportsTextMessage = false;
        profile.supportsBinaryMessage = true;
        profile.supportsControl = true;
        profile.supportsStream = true;
        return profile;
    }

    std::uint16_t localPort() const {
        boost::system::error_code ec;
        return acceptor_.is_open() ? acceptor_.local_endpoint(ec).port() : 0;
    }

private:
    void acceptOne() {
        if (socket_ && socket_->is_open()) {
            return;
        }
        auto socket = std::make_unique<boost::asio::ip::tcp::socket>(io_);
        boost::system::error_code ec;
        acceptor_.accept(*socket, ec);
        if (ec) {
            return;
        }
        socket->non_blocking(true, ec);
        socket_ = std::move(socket);
    }

    void readAvailable() {
        if (!socket_ || !sink_) {
            return;
        }
        std::array<Byte, 4096> buffer{};
        while (true) {
            boost::system::error_code ec;
            const auto n = socket_->read_some(boost::asio::buffer(buffer), ec);
            if (ec == boost::asio::error::would_block || ec == boost::asio::error::try_again) {
                return;
            }
            if (ec || n == 0) {
                close();
                return;
            }
            sink_->onBytes(buffer.data(), n);
        }
    }

    boost::asio::io_context io_;
    boost::asio::ip::tcp::endpoint endpoint_;
    boost::asio::ip::tcp::acceptor acceptor_;
    std::unique_ptr<boost::asio::ip::tcp::socket> socket_;
    IByteSink* sink_ = nullptr;
    bool open_ = false;
};

} // namespace axtp
