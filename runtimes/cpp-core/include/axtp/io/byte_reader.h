#pragma once

#include <cstddef>
#include <cstdint>

#include "axtp/model/bytes.h"
#include "axtp/model/result.h"

namespace axtp {

class ByteReader {
public:
    explicit ByteReader(const Bytes& bytes)
        : data_(bytes.data()), size_(bytes.size()) {}

    ByteReader(const Byte* data, std::size_t size)
        : data_(data), size_(size) {}

    Result<std::uint8_t> readU8() {
        if (!hasRemaining(1)) {
            return Result<std::uint8_t>::failure(kByteIoOutOfRange, "not enough bytes for u8");
        }
        return Result<std::uint8_t>::success(data_[offset_++]);
    }

    Result<std::uint16_t> readU16() {
        if (!hasRemaining(2)) {
            return Result<std::uint16_t>::failure(kByteIoOutOfRange, "not enough bytes for u16");
        }
        std::uint16_t value = static_cast<std::uint16_t>(data_[offset_]) |
                              static_cast<std::uint16_t>(data_[offset_ + 1] << 8);
        offset_ += 2;
        return Result<std::uint16_t>::success(value);
    }

    Result<std::uint32_t> readU32() {
        if (!hasRemaining(4)) {
            return Result<std::uint32_t>::failure(kByteIoOutOfRange, "not enough bytes for u32");
        }
        std::uint32_t value = static_cast<std::uint32_t>(data_[offset_]) |
                              (static_cast<std::uint32_t>(data_[offset_ + 1]) << 8) |
                              (static_cast<std::uint32_t>(data_[offset_ + 2]) << 16) |
                              (static_cast<std::uint32_t>(data_[offset_ + 3]) << 24);
        offset_ += 4;
        return Result<std::uint32_t>::success(value);
    }

    Result<std::uint64_t> readU64() {
        if (!hasRemaining(8)) {
            return Result<std::uint64_t>::failure(kByteIoOutOfRange, "not enough bytes for u64");
        }
        std::uint64_t value = 0;
        for (int shift = 0; shift < 64; shift += 8) {
            value |= static_cast<std::uint64_t>(data_[offset_++]) << shift;
        }
        return Result<std::uint64_t>::success(value);
    }

    bool hasRemaining(std::size_t count) const {
        return count <= remaining();
    }

    std::size_t offset() const {
        return offset_;
    }

    std::size_t remaining() const {
        return size_ - offset_;
    }

    bool empty() const {
        return remaining() == 0;
    }

private:
    const Byte* data_ = nullptr;
    std::size_t size_ = 0;
    std::size_t offset_ = 0;
};

} // namespace axtp
