# 21-AXTP-Cpp-Demo实现规范

版本：v1.0  
状态：MVP Implementation Draft  
适用范围：AXTP v1 / C++17 / Embedded-friendly Demo  
关联文档：

- `00-AXTP-协议总览与落地路线.md`
- `01-AXTP-整体协议规范.md`
- `02-AXTP-Control信令协议规范.md`
- `03-AXTP-RPC协议与二进制映射规范.md`
- `04-AXTP-Stream流式传输协议规范.md`
- `05-AXTP-Type-System基础类型规范.md`
- `06-AXTP-TLV-Schema编码规范.md`
- `07-AXTP-Schema字段编号规范.md`
- `08-AXTP-Registry总则.md`
- `09-AXTP-MethodId注册表.md`
- `10-AXTP-EventId注册表.md`
- `11-AXTP-ErrorCode注册表.md`
- `12-AXTP-Capability注册表.md`
- `13-AXTP-MVP最小实现注册表.md`
- `14-AXTP-老协议适配与迁移规范.md`
- `15-AXTP-WebSocket-JSON-RPC-Demo.md`
- `16-AXTP-WebSocket-Binary-Demo.md`
- `17-AXTP-HID-Compact-Demo.md`
- `18-AXTP-BLE-Compact-Demo.md`
- `19-AXTP-OTA-Stream-Demo.md`
- `20-AXTP-Generator-v1实现规范.md`

---

## 1. 文档目的

本文档定义 AXTP C++ Demo v1 的实现规范。

本 Demo 的目标不是直接实现完整 SDK，而是提供一套可以编译、可以跑通、可以验证协议闭环的最小实现。

它需要验证：

```text
CONTROL 建连
RPC 请求 / 响应 / 事件
TLV 编解码
STREAM OTA chunk
ACK / NACK
老协议 CmdValue 兼容映射
Generator v1 产物接入
```

本 Demo 应成为后续正式 SDK、设备端固件、PC 工具、Android Native 层、测试工具的共同参考实现。

---

## 2. C++ Demo 定位

AXTP C++ Demo v1 不是：

```text
完整产品 SDK
完整异步网络框架
完整跨平台 HID / BLE / WebSocket 库
完整 OTA 工具
完整代码生成系统
```

AXTP C++ Demo v1 是：

```text
协议核心编解码器
最小 Registry 消费示例
最小 Transport 抽象
最小 Client / Device 模拟器
最小 OTA Stream 流程
最小测试向量验证器
```

Demo 的核心价值是：

```text
证明文档定义的协议可以被稳定实现
证明 registry/generator 产物可以被 C++ 消费
证明 CONTROL/RPC/STREAM 三类 PayloadType 可以形成闭环
证明旧协议可以通过 adapter 迁移到 AXTP
```

---

## 3. 实现语言与约束

### 3.1 C++ 标准

MVP 推荐使用：

```text
C++17
```

原因：

- 支持 `std::optional`
- 支持 `std::variant`
- 支持结构化绑定
- 编译器普遍支持
- 对嵌入式仍相对友好

如果目标 MCU 编译器不支持 C++17，可在后续 SDK 化阶段提供 C++11 子集实现。

### 3.2 第三方依赖原则

MVP 核心库应尽量无第三方依赖。

允许依赖：

```text
标准库
CMake
测试框架可选：Catch2 / GoogleTest
```

不建议核心库依赖：

```text
Boost
大型 JSON 库
大型网络库
复杂反射库
```

WebSocket / HID / BLE Demo 可以单独放到 `examples/transport_*`，不进入 core library。

---

## 4. Demo 总体架构

```text
+--------------------------------------------------+
| examples                                         |
|   client_demo                                    |
|   device_simulator                               |
|   ota_demo                                       |
|   legacy_adapter_demo                            |
+--------------------------------------------------+
| axtp_runtime                                     |
|   session                                        |
|   dispatcher                                     |
|   request table                                  |
|   stream manager                                 |
+--------------------------------------------------+
| axtp_codec                                       |
|   frame codec                                    |
|   control codec                                  |
|   rpc codec                                      |
|   stream codec                                   |
|   tlv codec                                      |
|   crc codec                                      |
+--------------------------------------------------+
| axtp_registry_generated                          |
|   method ids                                     |
|   event ids                                      |
|   error codes                                    |
|   capability ids                                 |
|   schema descriptors                             |
+--------------------------------------------------+
| transport abstraction                            |
|   memory loopback                                |
|   websocket mock                                 |
|   hid mock                                       |
|   ble mock                                       |
+--------------------------------------------------+
```

---

## 5. 推荐工程目录

```text
axtp-cpp-demo/
├── CMakeLists.txt
├── README.md
│
├── include/
│   └── axtp/
│       ├── axtp_types.h
│       ├── axtp_result.h
│       ├── axtp_endian.h
│       ├── axtp_crc16.h
│       ├── axtp_frame.h
│       ├── axtp_frame_codec.h
│       ├── axtp_tlv.h
│       ├── axtp_control.h
│       ├── axtp_rpc.h
│       ├── axtp_stream.h
│       ├── axtp_session.h
│       ├── axtp_dispatcher.h
│       ├── axtp_transport.h
│       ├── axtp_legacy_adapter.h
│       └── generated/
│           ├── axtp_method_ids.h
│           ├── axtp_event_ids.h
│           ├── axtp_error_codes.h
│           ├── axtp_capability_ids.h
│           └── axtp_schema_ids.h
│
├── src/
│   ├── axtp_crc16.cpp
│   ├── axtp_frame_codec.cpp
│   ├── axtp_tlv.cpp
│   ├── axtp_control.cpp
│   ├── axtp_rpc.cpp
│   ├── axtp_stream.cpp
│   ├── axtp_session.cpp
│   ├── axtp_dispatcher.cpp
│   └── axtp_legacy_adapter.cpp
│
├── generated/
│   ├── axtp_method_ids.h
│   ├── axtp_event_ids.h
│   ├── axtp_error_codes.h
│   ├── axtp_capability_ids.h
│   └── axtp_schema_ids.h
│
├── examples/
│   ├── memory_loopback_demo.cpp
│   ├── websocket_binary_demo.cpp
│   ├── hid_compact_demo.cpp
│   ├── ble_compact_demo.cpp
│   ├── ota_stream_demo.cpp
│   └── legacy_adapter_demo.cpp
│
├── tests/
│   ├── test_frame_codec.cpp
│   ├── test_tlv_codec.cpp
│   ├── test_control_codec.cpp
│   ├── test_rpc_codec.cpp
│   ├── test_stream_codec.cpp
│   ├── test_crc16.cpp
│   └── test_vectors.cpp
│
└── test_vectors/
    ├── control_hello.hex
    ├── control_hello_ack.hex
    ├── rpc_device_get_info.hex
    ├── rpc_display_brightness_set.hex
    ├── event_display_brightness_changed.hex
    ├── stream_ota_chunk.hex
    └── control_ack.hex
```

---

## 6. 核心数据类型

### 6.1 基础类型

文件：`axtp_types.h`

```cpp
#pragma once

#include <cstdint>
#include <vector>
#include <string>
#include <optional>

namespace axtp {

using Byte = std::uint8_t;
using Bytes = std::vector<Byte>;

using MessageId = std::uint16_t;  // API 归一化类型；Compact wire 写入时必须校验 <= 0xFF

using RequestId = std::uint32_t;

using MethodId = std::uint16_t;
using EventId = std::uint16_t;
using ErrorCode = std::uint16_t;
using CapabilityId = std::uint16_t;

using StreamId = std::uint32_t;
using TransferId = std::uint32_t;
using SeqId = std::uint32_t;

} // namespace axtp
```

### 6.2 Result 类型

文件：`axtp_result.h`

```cpp
#pragma once

#include "axtp_types.h"
#include "generated/axtp_error_codes.h"

namespace axtp {

template <typename T>
struct Result {
    bool ok = false;
    ErrorCode error = ErrorCode::OK;
    T value{};

    static Result<T> success(const T& v) {
        return Result<T>{true, ErrorCode::OK, v};
    }

    static Result<T> failure(ErrorCode e) {
        return Result<T>{false, e, T{}};
    }
};

struct Status {
    bool ok = true;
    ErrorCode code = ErrorCode::OK;
};

} // namespace axtp
```

说明：

- MVP 可以先用简单 `Result<T>`。
- 正式 SDK 可替换为 `expected<T, Error>` 风格。

---

## 7. Endian 编解码

文件：`axtp_endian.h`

AXTP 线上格式在前序文档中约定为 Little Endian。

所有多字节整数必须通过统一函数读写，禁止直接 `reinterpret_cast`。

```cpp
#pragma once

#include <cstdint>
#include <vector>

namespace axtp {

inline void write_u16_le(std::vector<uint8_t>& out, uint16_t v) {
    out.push_back(static_cast<uint8_t>(v & 0xFF));
    out.push_back(static_cast<uint8_t>((v >> 8) & 0xFF));
}

inline void write_u32_le(std::vector<uint8_t>& out, uint32_t v) {
    out.push_back(static_cast<uint8_t>(v & 0xFF));
    out.push_back(static_cast<uint8_t>((v >> 8) & 0xFF));
    out.push_back(static_cast<uint8_t>((v >> 16) & 0xFF));
    out.push_back(static_cast<uint8_t>((v >> 24) & 0xFF));
}

inline bool read_u16_le(const uint8_t* data, size_t len, size_t& off, uint16_t& out) {
    if (off + 2 > len) return false;
    out = static_cast<uint16_t>(data[off]) |
          static_cast<uint16_t>(data[off + 1] << 8);
    off += 2;
    return true;
}

inline bool read_u32_le(const uint8_t* data, size_t len, size_t& off, uint32_t& out) {
    if (off + 4 > len) return false;
    out = static_cast<uint32_t>(data[off]) |
          (static_cast<uint32_t>(data[off + 1]) << 8) |
          (static_cast<uint32_t>(data[off + 2]) << 16) |
          (static_cast<uint32_t>(data[off + 3]) << 24);
    off += 4;
    return true;
}

} // namespace axtp
```

---

## 8. Frame Codec

### 8.1 Frame 结构

文件：`axtp_frame.h`

```cpp
#pragma once

#include "axtp_types.h"

namespace axtp {

enum class PayloadType : uint8_t {
    CONTROL = 0x01,
    RPC     = 0x02,
    STREAM  = 0x03,
};

enum class HeaderProfile : uint8_t {
    STANDARD = 0x01,
    COMPACT  = 0x02,
};

struct Frame {
    HeaderProfile profile = HeaderProfile::STANDARD;
    uint8_t version = 1;
    PayloadType payloadType = PayloadType::RPC;

    uint8_t sourceId = 0;
    uint8_t destinationId = 0;

    MessageId messageId = 0;
    uint16_t frameIndex = 0;
    uint16_t frameCount = 1;

    Bytes payload;
};

} // namespace axtp
```

### 8.2 Standard Header 编码要求

Standard Header 用于：

```text
WebSocket Binary
TCP
USB Bulk
高带宽 / 多设备路由
```

MVP Standard Header 字段：

```text
Magic[0]:       uint8   // 0x41 'A'
Magic[1]:       uint8   // 0x58 'X'
// Standard Header v1 — 12B fixed
// Version field determines layout; v1 = always 12B
Version:        uint8   // 0x01
PayloadType:    uint8
PayloadLength:  uint16
SourceId:       uint8
DestinationId:  uint8
MessageId:      uint16
FrameIndex:     uint8
FrameCount:     uint8
Payload:        bytes
CRC16:          uint16
```

### 8.3 Compact Header 编码要求

Compact Header 用于：

```text
HID
BLE
UART
MCU
```

MVP Compact Header 字段：

```text
VT:             uint8    // high 4 bits version, low 4 bits payloadType
PayloadLength:  uint8
MessageId:      uint8
FrameInfo:      uint8    // high 4 bits frameIndex, low 4 bits frameCount
Payload:        bytes
CRC8:           uint8
```

### 8.4 FrameCodec 接口

文件：`axtp_frame_codec.h`

```cpp
#pragma once

#include "axtp_frame.h"
#include "axtp_result.h"

namespace axtp {

class FrameCodec {
public:
    static Result<Bytes> encodeStandard(const Frame& frame);
    static Result<Frame> decodeStandard(const uint8_t* data, size_t len);

    static Result<Bytes> encodeCompact(const Frame& frame);
    static Result<Frame> decodeCompact(const uint8_t* data, size_t len);
};

} // namespace axtp
```

### 8.5 Parser 错误处理

Frame Parser 必须校验：

```text
Magic 是否正确
Version 是否支持
PayloadType 是否为 CONTROL/RPC/STREAM
PayloadLength 是否与实际长度一致
FrameIndex / FrameCount 是否合法
Standard CRC16 / Compact CRC8 是否正确
Compact FrameInfo 是否溢出
```

错误码映射：

| 场景 | ErrorCode |
| --- |---|
| Magic 错误 | `FRAME_BAD_MAGIC` |
| Version 不支持 | `FRAME_UNSUPPORTED_VERSION` |
| PayloadType 不支持 | `FRAME_UNSUPPORTED_PAYLOAD_TYPE` |
| Length 错误 | `FRAME_LENGTH_MISMATCH` |
| CRC 错误 | `FRAME_CRC_ERROR` |
| 分片字段错误 | `FRAME_FRAGMENT_ERROR` |

---

## 9. TLV Codec

### 9.1 TLV Entry

文件：`axtp_tlv.h`

```cpp
#pragma once

#include "axtp_types.h"
#include "axtp_result.h"
#include <map>

namespace axtp {

struct TlvEntry {
    uint8_t fieldId = 0;
    Bytes value;
};

class TlvWriter {
public:
    void putU8(uint8_t fieldId, uint8_t v);
    void putU16(uint8_t fieldId, uint16_t v);
    void putU32(uint8_t fieldId, uint32_t v);
    void putBool(uint8_t fieldId, bool v);
    void putBytes(uint8_t fieldId, const Bytes& v);
    void putString(uint8_t fieldId, const std::string& v);

    const Bytes& bytes() const;

private:
    Bytes buffer_;
};

class TlvReader {
public:
    explicit TlvReader(Bytes input);

    bool has(uint8_t fieldId) const;
    std::optional<uint8_t> getU8(uint8_t fieldId) const;
    std::optional<uint16_t> getU16(uint8_t fieldId) const;
    std::optional<uint32_t> getU32(uint8_t fieldId) const;
    std::optional<bool> getBool(uint8_t fieldId) const;
    std::optional<Bytes> getBytes(uint8_t fieldId) const;
    std::optional<std::string> getString(uint8_t fieldId) const;

    static Result<TlvReader> parse(const uint8_t* data, size_t len);

private:
    std::map<uint8_t, Bytes> fields_;
};

} // namespace axtp
```

### 9.2 TLV MVP 支持范围

C++ Demo v1 必须支持：

```text
uint8
uint16
uint32
bool
string
bytes
enum as uint8/uint16
bitmap as uint32
unknown field skip
extended length
```

C++ Demo v1 可以暂缓：

```text
nested object
packed array
repeated field
schema runtime reflection
```

---

## 10. Control Codec

### 10.1 Control 结构

文件：`axtp_control.h`

```cpp
#pragma once

#include "axtp_types.h"
#include "axtp_result.h"
#include "axtp_tlv.h"
#include "generated/axtp_error_codes.h"

namespace axtp {

enum class ControlOpcode : uint8_t {
    OPEN          = 0x01,
    ACCEPT     = 0x02,
    HEARTBEAT     = 0x03,
    HEARTBEAT_ACK = 0x04,
    ACK           = 0x05,
    NACK          = 0x06,
    RESUME        = 0x07,
    RESUME_ACK    = 0x08,
    CLOSE         = 0x09,
    CLOSE_ACK     = 0x0A,
    SESSION_RESET = 0x0B,
    WINDOW_UPDATE = 0x0C,
};

enum class BodyEncoding : uint8_t {
    NONE = 0x00,
    TLV  = 0x01,
};

// Control Payload 统一 5B 固定头：opcode(1) + controlId(2) + statusCode(2) + body(N, TLV)
// 不区分 Standard/Compact，所有传输场景共用同一结构
struct ControlMessage {
    ControlOpcode opcode = ControlOpcode::OPEN;
    uint16_t controlId = 0;
    ErrorCode statusCode = ErrorCode::OK;
    Bytes body;  // TLV 编码，长度 = Frame.payloadLength - 5
};

class ControlCodec {
public:
    static Result<Bytes> encode(const ControlMessage& msg);
    static Result<ControlMessage> decode(const uint8_t* data, size_t len);
};

} // namespace axtp
```

### 10.2 OPEN 构造示例

```cpp
TlvWriter body;
body.putU8(0x02, 1);       // protocolVersion
body.putU8(0x03, 2);       // headerProfile = COMPACT
body.putU16(0x06, 247);    // mtu
body.putU8(0x07, 0x07);    // payload types bitmap
body.putU8(0x08, 0x03);    // rpc encodings bitmap
body.putU16(0x0A, 1000);   // heartbeat interval

ControlMessage hello;
hello.opcode = ControlOpcode::OPEN;
hello.controlId = 1;
hello.statusCode = ErrorCode::OK;
hello.body = body.bytes();
```

### 10.3 ACK 构造示例

```cpp
TlvWriter body;
body.putU8(0x20, 0x01);    // targetType = FRAME
body.putU32(0x11, 123);    // messageId
body.putU16(0x12, 0);      // frameIndex

ControlMessage ack;
ack.opcode = ControlOpcode::ACK;
ack.controlId = 2;
ack.statusCode = ErrorCode::OK;
ack.body = body.bytes();
```

---

## 11. RPC Codec

### 11.1 RPC 结构

文件：`axtp_rpc.h`

```cpp
#pragma once

#include "axtp_types.h"
#include "axtp_result.h"
#include "axtp_tlv.h"
#include "generated/axtp_method_ids.h"
#include "generated/axtp_event_ids.h"
#include "generated/axtp_error_codes.h"

namespace axtp {

enum class RpcOp : uint8_t {
    HELLO                  = 0x00,
    IDENTIFY               = 0x02,
    IDENTIFIED             = 0x03,
    REIDENTIFY             = 0x04,
    EVENT                  = 0x06,
    REQUEST                = 0x07,
    REQUEST_RESPONSE       = 0x08,
    REQUEST_BATCH          = 0x09,
    REQUEST_BATCH_RESPONSE = 0x0A,
};

enum class RpcEncoding : uint8_t {
    JSON    = 0x01,
    BINARY  = 0x02,
    CBOR    = 0x03,
    MSGPACK = 0x04,
};

enum class RpcBodyEncoding : uint8_t {
    NONE      = 0x00,
    TLV8      = 0x01,
    TLV16     = 0x02,
    RAW_BYTES = 0x03,
    CBOR_BODY = 0x04,
};

struct RpcMessage {
    RpcEncoding encoding = RpcEncoding::BINARY;
    RpcOp op = RpcOp::REQUEST;
    RequestId requestId = 0;
    uint16_t methodOrEventId = 0;
    ErrorCode statusCode = ErrorCode::OK;
    RpcBodyEncoding bodyEncoding = RpcBodyEncoding::TLV8;
    Bytes body;
};

class RpcCodec {
public:
    static Result<Bytes> encodeBinary(const RpcMessage& msg);
    static Result<RpcMessage> decodeBinary(const uint8_t* data, size_t len);
};

} // namespace axtp
```

### 11.2 `device.getInfo` 请求示例

```cpp
RpcMessage req;
req.op = RpcOp::REQUEST;
req.requestId = 0x00000001;
req.methodOrEventId = static_cast<uint16_t>(MethodId::DEVICE_GET_INFO);
req.statusCode = ErrorCode::OK;
req.bodyEncoding = RpcBodyEncoding::NONE;
```

### 11.3 `display.setBrightness` 请求示例

```cpp
TlvWriter body;
body.putU8(0x01, 80);      // brightness value

RpcMessage req;
req.op = RpcOp::REQUEST;
req.requestId = 0x00000002;
req.methodOrEventId = static_cast<uint16_t>(MethodId::DISPLAY_SET_BRIGHTNESS);
req.statusCode = ErrorCode::OK;
req.bodyEncoding = RpcBodyEncoding::TLV8;
req.body = body.bytes();
```

### 11.4 `display.brightnessChanged` 事件示例

```cpp
TlvWriter body;
body.putU8(0x01, 80);

RpcMessage evt;
evt.op = RpcOp::EVENT;
evt.requestId = 0x00000000;
evt.methodOrEventId = static_cast<uint16_t>(EventId::BRIGHTNESS_CHANGED);
evt.statusCode = ErrorCode::OK;
evt.bodyEncoding = RpcBodyEncoding::TLV8;
evt.body = body.bytes();
```

---

## 12. Stream Codec

### 12.1 Stream 结构

文件：`axtp_stream.h`

```cpp
#pragma once

#include "axtp_types.h"
#include "axtp_result.h"

namespace axtp {

enum class StreamProfile : uint16_t {
    FirmwareOta  = 0x0101,
    FileUpload   = 0x0201,
    FileDownload = 0x0202,
    LogRealtime  = 0x0401,
    MediaVideo   = 0x1001,
    MediaAudio   = 0x1002,
    ControlHidRaw = 0x3001,
    SensorSample = 0x4001,
    LegacyTunnel = 0x8001,
};

struct StreamPacket {
    StreamId streamId = 0;
    SeqId seqId = 0;
    uint64_t cursor = 0;
    Bytes data;
};

class StreamCodec {
public:
    static Result<Bytes> encode(const StreamPacket& pkt);
    static Result<StreamPacket> decode(const uint8_t* data, size_t len);
};

} // namespace axtp
```

### 12.2 OTA Chunk 示例

```cpp
StreamPacket chunk;
chunk.streamId = 1;
chunk.seqId = 0;
chunk.cursor = 0;
chunk.data = firmwareChunkBytes;
```

---

## 13. Session Runtime

### 13.1 Session 状态机

文件：`axtp_session.h`

```cpp
#pragma once

namespace axtp {

enum class SessionState {
    DISCONNECTED,
    TRANSPORT_CONNECTED,
    HELLO_SENT,
    READY,
    CLOSING,
    CLOSED,
    ERROR,
};

} // namespace axtp
```

状态流转：

```text
DISCONNECTED
  -> TRANSPORT_CONNECTED
  -> HELLO_SENT
  -> READY
  -> CLOSING
  -> CLOSED
```

异常流转：

```text
任意状态 -> ERROR
ERROR -> DISCONNECTED / RESUME
```

### 13.2 Session 最小职责

Session MVP 必须负责：

```text
生成 messageId
生成 requestId
生成 controlId
维护 pending request table
处理 OPEN / ACCEPT
处理 ACK / NACK
路由 Frame 到 Control/RPC/Stream Parser
处理 Hello / Identify / Identified 三步握手
解析 Identify 中的 eventMasks（域级事件订阅掩码）
```

**eventMasks 处理**：MVP 阶段 Session 可采用全量广播模式，忽略 `eventMasks` 直接推送所有核心事件。P1 阶段实现按掩码过滤时，Session 需维护每个 Domain 的掩码字节数组：

```cpp
struct EventMaskEntry {
    uint8_t domainId;
    uint8_t maskLen;
    uint8_t bitmask[32]; // 高水位截断，实际只用 maskLen 字节
};

// 判定某事件是否被订阅
bool isEventSubscribed(uint8_t domainId, uint8_t bitOffset) const;
```

Session MVP 不必须负责：

```text
线程池
复杂异步调度
自动重连
高级 QoS
多设备路由表
eventMasks 细粒度过滤（MVP 阶段全量广播即可）
```

---

## 14. Dispatcher

### 14.1 方法分发接口

文件：`axtp_dispatcher.h`

```cpp
#pragma once

#include "axtp_rpc.h"
#include <functional>
#include <unordered_map>

namespace axtp {

using RpcHandler = std::function<RpcMessage(const RpcMessage& request)>;

class RpcDispatcher {
public:
    void registerHandler(MethodId methodId, RpcHandler handler);
    RpcMessage dispatch(const RpcMessage& request);

private:
    std::unordered_map<uint16_t, RpcHandler> handlers_;
};

} // namespace axtp
```

### 14.2 MVP 注册方法

C++ Demo v1 必须注册：

```text
capability.getAll
device.getInfo
display.getBrightness
display.setBrightness
firmware.begin
firmware.end
firmware.verify
firmware.apply
```

可选注册：

```text
firmware.abort
firmware.resume
stream.open
stream.close
```

---

## 15. Transport 抽象

### 15.1 Transport 接口

文件：`axtp_transport.h`

```cpp
#pragma once

#include "axtp_types.h"
#include <functional>

namespace axtp {

using BytesHandler = std::function<void(const Bytes&)>;

class ITransport {
public:
    virtual ~ITransport() = default;

    virtual bool open() = 0;
    virtual void close() = 0;
    virtual bool send(const Bytes& data) = 0;
    virtual void setReceiveHandler(BytesHandler handler) = 0;
};

} // namespace axtp
```

### 15.2 MVP Transport 类型

MVP 必须实现：

```text
MemoryLoopbackTransport
```

P1 可实现：

```text
WebSocketBinaryTransport
HidMockTransport
BleMockTransport
```

正式产品 SDK 可后续接入：

```text
真实 WebSocket
真实 HID
真实 BLE
真实 UART
真实 USB Bulk
```

---

## 16. Memory Loopback Demo

### 16.1 目的

Memory Loopback Demo 用于在不依赖真实硬件和网络的情况下验证协议核心闭环。

它模拟：

```text
Client Session <-> Memory Transport <-> Device Session
```

### 16.2 必须跑通流程

```text
1. Client 发送 CONTROL OPEN
2. Device 返回 CONTROL ACCEPT
3. Client 发送 RPC capability.getAll
4. Device 返回 capability 列表
5. Client 发送 RPC device.getInfo
6. Device 返回设备信息
7. Client 发送 RPC display.setBrightness(value=80)
8. Device 返回 OK
9. Device 发送 EVENT display.brightnessChanged(value=80)
10. Client 发送 RPC firmware.begin
11. Device 返回 streamId / transferId
12. Client 发送 STREAM OTA chunk
13. Device 返回 CONTROL ACK
14. Client 发送 RPC firmware.verify
15. Device 返回 OK
16. Device 发送 EVENT firmware.updateCompleted
```

---

## 17. OTA Stream Demo

### 17.1 OTA Demo 输入

OTA Demo 可以使用伪造固件数据：

```text
firmware.bin = 4096 bytes random data
chunkSize = 128 bytes for compact mode
chunkSize = 1024 bytes for standard mode
```

### 17.2 OTA Demo 流程

```text
firmware.begin
  -> returns streamId, transferId, chunkSize

for each chunk:
  send STREAM OTA chunk
  wait CONTROL ACK

firmware.end
firmware.verify
firmware.apply
firmware.updateCompleted event
```

### 17.3 OTA Demo 必须验证

```text
seqId 连续
offset 正确
chunkCrc32 可选
ACK targetType = STREAM_CHUNK
NACK 后可重发
最终 hash 可选
```

MVP 可以先实现 Stop-and-Wait。

Sliding Window 放到 P1。

---

## 18. 老协议适配 Demo

本章属于可选兼容 profile。默认 C++ Demo 不生成、不编译 Legacy parser；只有当 Generator 配置显式启用 `compatibility.legacy = true` 时，才生成本章接口与映射表。

### 18.1 目标

Legacy Adapter Demo 用于证明旧 `CmdValue` 命令可以映射到 AXTP RPC。

### 18.2 映射原则

旧协议命令不直接替代 AXTP methodId。

推荐结构：

```text
AXTP methodId = 新注册表 ID
legacyCmdValue = 旧协议 CmdValue
legacyPayload = 旧协议 payload
```

### 18.3 Legacy Adapter 接口

文件：`axtp_legacy_adapter.h`

```cpp
#pragma once

#include "axtp_rpc.h"
#include <optional>

namespace axtp {

struct LegacyCommand {
    uint32_t cmdValue = 0;
    Bytes payload;
};

class LegacyAdapter {
public:
    std::optional<RpcMessage> toAxtpRpc(const LegacyCommand& legacy);
    std::optional<LegacyCommand> fromAxtpRpc(const RpcMessage& rpc);
};

} // namespace axtp
```

### 18.4 MVP 兼容命令

MVP 建议至少兼容：

```text
BetaDeviceInfo      -> device.getInfo
CommonGetBrightness -> display.getBrightness
CommonSetBrightness -> display.setBrightness
AlphaUpgradeInfo    -> firmware.getInfo / firmware.begin
AlphaUpgradeData    -> STREAM OTA chunk
```

具体旧命令名称以旧协议 registry 为准。

---

## 19. Generator 产物接入

### 19.1 C++ Demo 不手写 Registry

C++ Demo 应优先消费 Generator 生成的头文件。

生成文件包括：

```text
axtp_method_ids.h
axtp_event_ids.h
axtp_error_codes.h
axtp_capability_ids.h
axtp_schema_ids.h
```

### 19.2 MethodId 生成示例

```cpp
#pragma once

#include <cstdint>

namespace axtp {

enum class MethodId : uint16_t {
    CAPABILITY_GET_ALL = 0x0301,
    DEVICE_GET_INFO    = 0x0101,
    DISPLAY_GET_BRIGHTNESS = 0x0501,
    DISPLAY_SET_BRIGHTNESS = 0x0502,
    FIRMWARE_BEGIN         = 0x0B02,
    FIRMWARE_END           = 0x0B03,
    FIRMWARE_VERIFY        = 0x0B04,
    FIRMWARE_APPLY         = 0x0B05,
};

} // namespace axtp
```

### 19.3 EventId 生成示例

```cpp
#pragma once

#include <cstdint>

namespace axtp {

enum class EventId : uint16_t {
    DEVICE_STATUS_CHANGED       = 0x8103,
    CAPABILITY_CHANGED          = 0x8301,
    BRIGHTNESS_CHANGED          = 0x8507,
    STREAM_ERROR                = 0x8905,
    FIRMWARE_UPDATE_PROGRESS    = 0x8B02,
    FIRMWARE_UPDATE_COMPLETED   = 0x8B03,
    FIRMWARE_UPDATE_FAILED      = 0x8B04,
};

} // namespace axtp
```

---

## 20. CMake 要求

### 20.1 最小 CMakeLists.txt

```cmake
cmake_minimum_required(VERSION 3.16)
project(axtp_cpp_demo LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

add_library(axtp_core
    src/axtp_crc16.cpp
    src/axtp_frame_codec.cpp
    src/axtp_tlv.cpp
    src/axtp_control.cpp
    src/axtp_rpc.cpp
    src/axtp_stream.cpp
    src/axtp_session.cpp
    src/axtp_dispatcher.cpp
    src/axtp_legacy_adapter.cpp
)

target_include_directories(axtp_core PUBLIC include generated)

add_executable(memory_loopback_demo examples/memory_loopback_demo.cpp)
target_link_libraries(memory_loopback_demo PRIVATE axtp_core)

add_executable(ota_stream_demo examples/ota_stream_demo.cpp)
target_link_libraries(ota_stream_demo PRIVATE axtp_core)
```

### 20.2 构建命令

```bash
cmake -S . -B build
cmake --build build
./build/memory_loopback_demo
./build/ota_stream_demo
```

---

## 21. 测试要求

### 21.1 单元测试

必须覆盖：

```text
CRC16 / CRC8
Endian read/write
TLV encode/decode
Frame Standard encode/decode
Frame Compact encode/decode
Compact MessageId > 0xFF serialization failure
Compact PayloadLength > 0xFF serialization failure
Standard CRC16 error frame rejection
Compact CRC8 error frame rejection
Control encode/decode（统一 5B 固定头，Standard/Compact Frame 下结构相同）
RPC encode/decode
Stream encode/decode
Legacy mapping
```

### 21.2 测试向量

测试向量应存储在：

```text
test_vectors/*.hex
```

每个测试向量至少包含：

```text
name
description
hex bytes
expected decoded fields
expected re-encoded bytes
```

### 21.3 回归测试原则

任何协议字段变更后：

```text
旧测试向量必须仍可解析，除非文档明确标记 breaking change。
```

---

## 22. Error Handling 规范

### 22.1 Parser 不应崩溃

所有 parser 必须满足：

```text
输入为空不崩溃
输入截断不崩溃
长度字段异常不越界
未知字段可跳过
未知 enum 返回明确错误
CRC 错误返回明确错误
```

### 22.2 错误返回原则

禁止：

```cpp
throw std::runtime_error("parse failed");
```

推荐：

```cpp
return Result<Frame>::failure(ErrorCode::FRAME_CRC_ERROR);
```

MVP 核心库不使用异常。

原因：

```text
MCU / 嵌入式环境可能关闭异常
错误码更贴近协议本身
便于跨语言生成
```

---

## 23. 内存与性能约束

### 23.1 MVP 内存策略

MVP 可以使用：

```text
std::vector<uint8_t>
std::string
std::map / unordered_map
```

但核心 codec 应避免不必要拷贝。

### 23.2 后续嵌入式优化方向

P1/P2 可增加：

```text
span-like ByteView
fixed buffer writer
zero-copy stream payload
静态 dispatch table
关闭 RTTI
关闭异常
无堆内存模式
```

---

## 24. 日志输出规范

Demo 日志建议使用简单 stdout。

日志格式：

```text
[CLIENT] send CONTROL OPEN messageId=1
[DEVICE] recv CONTROL OPEN controlId=1
[DEVICE] send CONTROL ACCEPT sessionId=0x12345678
[CLIENT] send RPC device.getInfo requestId=0x00000001
[DEVICE] send RPC response status=OK
```

禁止在核心库中强绑定日志库。

核心库可提供可选 hook：

```cpp
using LogCallback = std::function<void(const char*)>;
```

---

## 25. Demo 验收标准

C++ Demo v1 通过验收必须满足：

```text
1. 能编译通过
2. memory_loopback_demo 能跑通完整链路
3. ota_stream_demo 能完成伪固件传输
4. Frame Standard 编解码测试通过
5. Frame Compact 编解码测试通过
6. TLV 编解码测试通过
7. Control OPEN / ACCEPT 测试通过
8. RPC device.getInfo / display.setBrightness 测试通过
9. Event display.brightnessChanged 测试通过
10. Stream OTA chunk + ACK 测试通过
11. Legacy CmdValue 映射测试通过
12. Generator 产物可被 include 并编译
```

---

## 26. MVP 实现优先级

### 26.1 P0 必须实现

```text
Endian 工具
CRC16 / CRC8
Frame Standard Codec
Frame Compact Codec
TLV Codec 基础类型
Control Codec
RPC Binary Codec
Stream Codec 基础结构
Method/Event/Error/Capability generated headers
MemoryLoopbackTransport
RpcDispatcher
memory_loopback_demo
ota_stream_demo
```

### 26.2 P1 建议实现

```text
WebSocket Binary demo
HID mock demo（Standard Profile，含 Compact 降级协商）
BLE Compact mock demo
Legacy Adapter demo
测试向量自动加载
Sliding Window OTA
```

### 26.3 P2 延后实现

```text
真实 HID 设备访问
真实 BLE GATT 访问
真实 WebSocket 网络库
完整 DS-RPC Text Profile parser
完整 CBOR 支持
完整 SDK API
多线程异步 runtime
```

---

## 27. 与正式 SDK 的边界

C++ Demo v1 可以直接演进为正式 SDK，但二者职责不同。

Demo 重点：

```text
验证协议正确
验证文档可实现
验证 generator 可消费
验证最小链路可跑通
```

正式 SDK 重点：

```text
跨平台 transport
稳定 API
线程安全
错误恢复
性能优化
日志与诊断
安全与加密
版本兼容
```

因此 Demo 代码应保持：

```text
简单
清晰
可读
少依赖
易于移植
```

而不是一开始就做成复杂框架。

---

## 28. 推荐开发顺序

建议按以下顺序实现：

```text
1. generated enum headers 手写临时版
2. endian + crc16
3. tlv writer / reader
4. frame standard encode/decode
5. frame compact encode/decode
6. control encode/decode
7. rpc binary encode/decode
8. stream encode/decode
9. memory loopback transport
10. session hello/hello_ack
11. rpc dispatcher
12. device.getInfo
13. display.setBrightness + event
14. firmware.begin
15. stream ota chunk + ack
16. firmware.verify/apply
17. legacy adapter demo
18. 替换为 generator 产物
```

该顺序能保证每一步都有可运行结果。

---

## 29. 示例运行输出

成功运行 `memory_loopback_demo` 时，建议输出：

```text
[CLIENT] transport connected
[CLIENT] send CONTROL OPEN
[DEVICE] recv CONTROL OPEN
[DEVICE] send CONTROL ACCEPT
[CLIENT] session ready

[CLIENT] send RPC capability.getAll
[DEVICE] recv RPC capability.getAll
[DEVICE] send RPC response OK

[CLIENT] send RPC device.getInfo
[DEVICE] send device info

[CLIENT] send RPC display.setBrightness value=80
[DEVICE] brightness updated value=80
[DEVICE] send RPC response OK
[DEVICE] emit EVENT display.brightnessChanged value=80

[CLIENT] send RPC firmware.begin
[DEVICE] firmware transfer accepted streamId=1
[CLIENT] send STREAM OTA chunk seq=0 offset=0 len=128
[DEVICE] recv STREAM OTA chunk seq=0
[DEVICE] send CONTROL ACK streamId=1 seq=0
[CLIENT] send RPC firmware.verify
[DEVICE] send RPC response OK
[DEVICE] emit EVENT firmware.updateCompleted

[DEMO] AXTP MVP flow completed successfully
```

---

## 30. 总结

`21-AXTP-Cpp-Demo实现规范` 定义了 AXTP 从文档进入工程实现的最小落地路径。

本 Demo 的核心不是“做一个大而全 SDK”，而是跑通：

```text
Frame
  -> CONTROL
  -> RPC
  -> TLV
  -> STREAM
  -> ACK/NACK
  -> Registry
  -> Generator Output
  -> Legacy Adapter
```

只要该 Demo 能稳定运行，就说明 AXTP 的协议框架、类型系统、注册表、Demo 文档和生成器设计已经形成闭环。

后续正式 SDK 应以该 Demo 为协议参考实现，再逐步扩展真实 transport、线程模型、安全机制和产品级 API。
