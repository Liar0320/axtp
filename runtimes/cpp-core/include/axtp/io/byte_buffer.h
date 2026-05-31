#pragma once

#include <cstddef>

#include "axtp/model/bytes.h"
#include "axtp/model/result.h"

namespace axtp {

class ByteBuffer {
public:
    void append(const Byte* data, std::size_t size) {
        if (size == 0) {
            return;
        }
        bytes_.insert(bytes_.end(), data, data + size);
    }

    void append(const Bytes& bytes) {
        append(bytes.data(), bytes.size());
    }

    Result<Bytes> peek(std::size_t size) const {
        return peek(0, size);
    }

    Result<Bytes> peek(std::size_t offset, std::size_t size) const {
        if (offset > bytes_.size() || size > bytes_.size() - offset) {
            return Result<Bytes>::failure(kByteIoOutOfRange, "not enough bytes to peek");
        }
        auto begin = bytes_.begin() + static_cast<std::ptrdiff_t>(offset);
        return Result<Bytes>::success(Bytes(begin, begin + static_cast<std::ptrdiff_t>(size)));
    }

    Result<Bytes> consume(std::size_t size) {
        if (size > bytes_.size()) {
            return Result<Bytes>::failure(kByteIoOutOfRange, "not enough bytes to consume");
        }
        Bytes out(bytes_.begin(), bytes_.begin() + static_cast<std::ptrdiff_t>(size));
        bytes_.erase(bytes_.begin(), bytes_.begin() + static_cast<std::ptrdiff_t>(size));
        return Result<Bytes>::success(std::move(out));
    }

    const Bytes& bytes() const {
        return bytes_;
    }

    std::size_t size() const {
        return bytes_.size();
    }

    bool empty() const {
        return bytes_.empty();
    }

    void clear() {
        bytes_.clear();
    }

private:
    Bytes bytes_;
};

} // namespace axtp
