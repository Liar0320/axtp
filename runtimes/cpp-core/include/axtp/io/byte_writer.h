#pragma once

#include <cstddef>
#include <cstdint>
#include <utility>

#include "axtp/model/bytes.h"

namespace axtp {

class ByteWriter {
public:
    void writeU8(std::uint8_t value) {
        bytes_.push_back(value);
    }

    void writeU16(std::uint16_t value) {
        bytes_.push_back(static_cast<Byte>(value & 0xFF));
        bytes_.push_back(static_cast<Byte>((value >> 8) & 0xFF));
    }

    void writeU32(std::uint32_t value) {
        bytes_.push_back(static_cast<Byte>(value & 0xFF));
        bytes_.push_back(static_cast<Byte>((value >> 8) & 0xFF));
        bytes_.push_back(static_cast<Byte>((value >> 16) & 0xFF));
        bytes_.push_back(static_cast<Byte>((value >> 24) & 0xFF));
    }

    void writeU64(std::uint64_t value) {
        for (int shift = 0; shift < 64; shift += 8) {
            bytes_.push_back(static_cast<Byte>((value >> shift) & 0xFF));
        }
    }

    void writeBytes(const Byte* data, std::size_t size) {
        if (size == 0) {
            return;
        }
        bytes_.insert(bytes_.end(), data, data + size);
    }

    void writeBytes(const Bytes& bytes) {
        writeBytes(bytes.data(), bytes.size());
    }

    const Bytes& bytes() const {
        return bytes_;
    }

    Bytes takeBytes() {
        Bytes out = std::move(bytes_);
        bytes_.clear();
        return out;
    }

    void clear() {
        bytes_.clear();
    }

private:
    Bytes bytes_;
};

} // namespace axtp
