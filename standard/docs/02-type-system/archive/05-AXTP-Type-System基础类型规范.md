# 05《AXTP Type System 基础类型规范》

版本：v1.0  
状态：MVP 实现规范  
适用范围：AXTP Control / RPC / Stream / TLV Schema / Registry / Generator / C++ Demo

---

## 1. 文档目的

本文档定义 AXTP（Auditoryworks Transport Protocol）协议体系中的基础类型系统。

本规范不是某一个 Payload 的编码规则，而是所有 AXTP 子协议共享的类型基础，包括：

```text
CONTROL Payload
RPC Payload
STREAM Metadata
TLV Schema
Method Registry
Event Registry
ErrorCode Registry
Capability Registry
Generator v1
C++ Demo v1
```

本文档的目标是保证：

```text
同一个字段类型
在文档、Registry、Generator、C++ SDK、测试向量中
具有一致的语义、长度、字节序和默认行为
```

---

## 2. 设计原则

### 2.1 类型系统服务于落地实现

AXTP Type System 的目标不是设计一套复杂 IDL，而是服务于：

```text
MCU 可实现
C/C++ 可直接编码
BLE / HID / UART 低带宽可承载
JSON / Binary RPC 可互相映射
Generator 可消费
老协议可迁移
```

因此，v1 类型系统应优先保持：

```text
少类型
固定宽度
明确字节序
易生成
易解析
未知字段可跳过
```

---

### 2.2 线上协议类型与宿主语言类型分离

AXTP 文档中定义的是“线上类型”（wire type），不是 C/C++、Java、TypeScript 的语言类型。

例如：

```text
uint16 表示线上固定 2 字节无符号整数
C++ 中可以映射为 uint16_t
TypeScript 中可以映射为 number
JSON 中可以映射为 number
```

Generator 负责将线上类型映射到目标语言类型。

---

### 2.3 所有二进制整数必须固定字节序

AXTP 二进制编码中的所有多字节整数必须使用统一字节序。

MVP 推荐：

```text
Little Endian
```

原因：

```text
1. MCU / ARM / x86 环境更常见
2. 与多数嵌入式旧协议兼容成本更低
3. C/C++ Demo 实现更直接
4. HID / BLE 小包场景无需网络序转换负担
```

如果未来需要网络字节序，可通过 Profile 或 Version 进行明确切换，但同一条连接内不得混用字节序。

---

### 2.4 Unknown 字段必须可跳过

Type System 必须支持协议演进。

因此：

```text
解析器遇到未知字段时，只要该字段长度可确定，必须跳过，不得直接失败。
```

除非：

```text
1. 字段长度非法
2. 字段超出 payload 边界
3. 字段被标记为 required 但无法解析
4. 字段类型与 schema 冲突且影响安全
```

---

## 3. 字节序规范

### 3.1 默认字节序

AXTP v1 的二进制协议默认使用：

```text
Little Endian
```

适用范围：

```text
Frame Header 中的多字节字段
Control Payload 中的多字节字段
RPC Binary Payload 中的多字节字段
Stream Payload 中的多字节字段
TLV value 中的整数类型
Registry 生成的 fixed struct 字段
```

---

### 3.2 单字节类型不受字节序影响

以下类型不受字节序影响：

```text
uint8
int8
bool
enum8
bitmap8
byte
```

---

### 3.3 多字节示例

`uint16 value = 0x1234` 在线上编码为：

```text
34 12
```

`uint32 value = 0x12345678` 在线上编码为：

```text
78 56 34 12
```

`uint64 value = 0x0102030405060708` 在线上编码为：

```text
08 07 06 05 04 03 02 01
```

---

## 4. 基础标量类型

### 4.1 无符号整数

| 类型 | 长度 | 取值范围 | 说明 |
|---|---:|---:|---|
| `uint8` | 1B | 0 - 255 | 单字节无符号整数 |
| `uint16` | 2B | 0 - 65535 | 双字节无符号整数 |
| `uint32` | 4B | 0 - 4294967295 | 四字节无符号整数 |
| `uint64` | 8B | 0 - 2^64-1 | 八字节无符号整数 |

使用建议：

```text
uint8   用于小枚举、小计数、flags、profile id
uint16  用于长度、methodId、eventId、errorCode
uint32  用于 requestId、messageId、streamId、transferId、seqId
uint64  用于 offset、timestamp、objectSize
```

---

### 4.2 有符号整数

| 类型 | 长度 | 取值范围 | 说明 |
|---|---:|---:|---|
| `int8` | 1B | -128 - 127 | 单字节有符号整数 |
| `int16` | 2B | -32768 - 32767 | 双字节有符号整数 |
| `int32` | 4B | -2147483648 - 2147483647 | 四字节有符号整数 |
| `int64` | 8B | -2^63 - 2^63-1 | 八字节有符号整数 |

有符号整数使用二进制补码表示。

使用建议：

```text
温度偏移、音频增益、坐标差值、校准值可以使用 int 类型。
大多数协议字段应优先使用 uint 类型。
```

---

### 4.3 布尔类型

| 类型 | 长度 | false | true |
|---|---:|---:|---:|
| `bool` | 1B | `0x00` | `0x01` |

规范要求：

```text
发送方 MUST 使用 0x00 表示 false，0x01 表示 true。
接收方 SHOULD 将非 0 值视为 true，但 SHOULD 在严格模式下报告非规范 bool。
```

---

### 4.4 字节类型

| 类型 | 长度 | 说明 |
|---|---:|---|
| `byte` | 1B | 单个原始字节 |
| `bytes` | N | 原始字节数组 |

`bytes` 必须由外层长度字段确定边界，例如：

```text
TLV.length
RPC.bodyLen
Stream.dataLen
Frame.payloadLength
```

---

### 4.5 浮点类型

AXTP MVP 不推荐在线上协议中使用浮点类型。

如确实需要，建议优先使用定点整数：

```text
温度 36.5°C -> int16 temperatureX10 = 365
电压 5.000V -> uint16 voltageMv = 5000
百分比 12.34% -> uint16 percentX100 = 1234
```

保留类型：

| 类型 | 长度 | 编码 | 状态 |
|---|---:|---|---|
| `float32` | 4B | IEEE 754 | v1 不推荐 |
| `float64` | 8B | IEEE 754 | v1 不推荐 |

Generator v1 MAY 识别 `float32/float64`，但 C++ Demo v1 可以暂不实现。

---

## 5. 字符串类型

### 5.1 string

`string` 表示 UTF-8 编码字符串。

线上编码为：

```text
UTF-8 bytes
```

字符串长度由外层长度字段决定，不在 string 内部再次携带长度。

例如在 TLV 中：

```text
fieldId = 0x01
length  = 0x05
value   = 48 65 6C 6C 6F
```

表示：

```text
"Hello"
```

---

### 5.2 字符串终止符

AXTP string 不使用 `\0` 作为终止符。

规范要求：

```text
发送方 MUST NOT 在 string 末尾自动追加 NUL。
接收方 MUST 按 length 解析 string。
```

如业务字符串本身包含 `0x00`，应视为非法 UTF-8 或二进制数据，改用 `bytes`。

---

### 5.3 字符串最大长度

MVP 建议：

| 场景 | 推荐最大长度 |
|---|---:|
| methodName | 64B |
| eventName | 64B |
| deviceName | 64B |
| versionString | 32B |
| errorMessage | 128B |
| vendorString | 128B |

低带宽传输中，尽量避免频繁发送字符串字段。

---

## 6. 枚举类型

### 6.1 enum

`enum` 表示有限集合值。

MVP 默认使用：

```text
enum8 = uint8
```

当枚举项超过 255 个时，可使用：

```text
enum16 = uint16
```

---

### 6.2 enum 定义示例

```yaml
name: ImageType
wireType: enum8
values:
  MCU_FIRMWARE: 0x01
  FPGA_BITSTREAM: 0x02
  RESOURCE_PACK: 0x03
  CONFIG_BUNDLE: 0x04
```

---

### 6.3 enum 兼容规则

接收方遇到未知 enum 值时：

```text
1. 如果字段为 optional，应保留原值或忽略该字段
2. 如果字段为 required，应返回 UNSUPPORTED_VALUE 或 INVALID_PARAMETER
3. 如果字段属于 capability，应表示本端不支持该能力
```

Generator 应为 enum 生成 `UNKNOWN` 或 `UNRECOGNIZED` 分支。

---

## 7. 位图类型

### 7.1 bitmap

`bitmap` 表示多个能力或选项的集合。

支持类型：

| 类型 | 长度 | 说明 |
|---|---:|---|
| `bitmap8` | 1B | 最多 8 个 bit |
| `bitmap16` | 2B | 最多 16 个 bit |
| `bitmap32` | 4B | 最多 32 个 bit |
| `bitmap64` | 8B | 最多 64 个 bit |
| `bitmapBytes` | N | 可变长度位图 |

---

### 7.2 bit 编号规则

bit 从低位开始编号：

```text
bit0 = 0x01
bit1 = 0x02
bit2 = 0x04
bit3 = 0x08
...
```

例如：

```text
bitmap8 = 0x05
```

表示：

```text
bit0 = 1
bit2 = 1
```

---

### 7.3 capability 位图示例

```yaml
name: SupportedPayloadTypes
wireType: bitmap8
bits:
  0: CONTROL
  1: RPC
  2: STREAM
```

当设备支持三种 PayloadType 时：

```text
0x07
```

---

## 8. 数组类型

### 8.1 array

`array<T>` 表示同类型元素集合。

AXTP 支持两种数组编码方式：

```text
TLV repeated field
Length-prefixed packed array
```

MVP 推荐：

```text
TLV repeated field
```

因为它更容易扩展、跳过和兼容。

---

### 8.2 repeated TLV 数组

示例：支持的 methodId 列表。

```text
20 02 01 01   // supportedMethod = 0x0101
20 02 01 02   // supportedMethod = 0x0102
20 02 06 02   // supportedMethod = 0x0206
```

同一个 fieldId 多次出现，表示数组。

Schema 中应声明：

```yaml
fields:
  - id: 0x20
    name: supportedMethods
    type: array<uint16>
    encoding: repeated_tlv
```

---

### 8.3 packed array

对于大量固定宽度元素，可使用 packed array。

结构：

```text
TLV.value = item[0] + item[1] + ... + item[n]
```

示例：

```text
20 06 01 01 01 02 06 02
```

含义：

```text
fieldId = 0x20
length  = 6
value   = uint16[3]
        = 0x0101, 0x0102, 0x0206
```

Schema 中应声明：

```yaml
fields:
  - id: 0x20
    name: supportedMethods
    type: array<uint16>
    encoding: packed
```

---

## 9. 对象类型

### 9.1 object

`object` 表示由多个字段组成的结构。

在 AXTP MVP 中，对象主要通过 TLV 表达：

```text
object = TLV fields
```

每个 object 必须有 schema 定义。

---

### 9.2 object schema 示例

```yaml
name: DeviceInfo
type: object
fields:
  - id: 0x01
    name: model
    type: string
    required: true

  - id: 0x02
    name: serialNumber
    type: string
    required: true

  - id: 0x03
    name: firmwareVersion
    type: string
    required: false
```

---

### 9.3 嵌套对象

嵌套对象可以通过以下方式编码：

```text
外层 TLV.value = 内层 TLV 列表
```

示例：

```yaml
fields:
  - id: 0x10
    name: videoCapability
    type: object
    schema: VideoCapability
```

MVP 建议减少深层嵌套，最多 2 层。

---

## 10. 可选字段与必选字段

### 10.1 required

`required: true` 表示字段必须出现。

解析规则：

```text
缺少 required 字段时，解析器 MUST 返回 INVALID_PARAMETER 或 MISSING_FIELD。
```

---

### 10.2 optional

`required: false` 表示字段可以缺省。

缺省字段处理顺序：

```text
1. 如果 schema 定义 default，使用 default
2. 如果 schema 未定义 default，使用语言默认空值
3. 如果语义不允许空值，返回 MISSING_FIELD
```

---

### 10.3 default

示例：

```yaml
fields:
  - id: 0x01
    name: timeoutMs
    type: uint16
    required: false
    default: 1000
```

线上编码中，如果发送方省略该字段，接收方应视为：

```text
timeoutMs = 1000
```

---

## 11. 保留字段、废弃字段与扩展字段

### 11.1 reserved

`reserved` 表示字段编号被保留，不得使用。

示例：

```yaml
reserved:
  - 0x05
  - 0x06
```

解析器遇到 reserved 字段时：

```text
SHOULD 忽略
MAY 在调试模式下记录 warning
```

---

### 11.2 deprecated

`deprecated: true` 表示字段仍可解析，但不建议新实现继续发送。

示例：

```yaml
fields:
  - id: 0x04
    name: oldMode
    type: uint8
    deprecated: true
    replacedBy: newMode
```

Generator 应生成 deprecated 标记。

---

### 11.3 vendor extension

建议每个 object schema 保留 vendor 扩展字段：

```text
0x70 - 0x7E: vendor specific fields
0x7F: vendorData / escape field
```

vendor 字段不得改变标准字段语义。

---

## 12. 类型命名规范

### 12.1 类型名

类型名使用 PascalCase：

```text
DeviceInfo
FirmwareInfo
StreamParams
BrightnessRange
```

---

### 12.2 字段名

字段名使用 lowerCamelCase：

```text
requestId
streamId
firmwareVersion
maxFrameSize
```

---

### 12.3 enum 值

enum 值使用 UPPER_SNAKE_CASE：

```text
CONTROL
RPC
STREAM
OTA
MEDIA
FILE
```

---

## 13. 通用语义类型

以下是 AXTP 中高频出现的语义类型。它们本质上仍由基础类型承载，但建议在 schema 中使用语义别名。

| 语义类型 | 线上类型 | 说明 |
|---|---|---|
| `payloadType` | `enum8` | CONTROL / RPC / STREAM |
| `opcode` | `enum8` | Control opcode |
| `rpcOp` | `enum8` | RPC operation |
| `rpcEncoding` | `enum8` | JSON / BINARY / CBOR / MSGPACK |
| `methodId` | `uint16` | 方法编号 |
| `eventId` | `uint16` | 事件编号 |
| `errorCode` | `uint16` | 错误码 |
| `capabilityId` | `uint16` | 能力编号 |
| `requestId` | `uint32` | RPC 请求编号；Text Profile 编码为 8 位十六进制字符串 |
| `messageId` | `uint16` / `uint32` | Frame 层消息编号 |
| `streamId` | `uint32` | 流编号 |
| `transferId` | `uint32` | 文件 / OTA 传输编号 |
| `seqId` | `uint32` | Stream 分块序号 |
| `offset` | `uint64` | 文件 / OTA 偏移 |
| `timestampMs` | `uint64` | 毫秒时间戳 |
| `durationMs` | `uint32` | 持续时间 |
| `sizeBytes` | `uint64` | 对象大小 |
| `crc16` | `uint16` | Frame 校验 |
| `crc32` | `uint32` | Chunk / Object 校验 |
| `sha256` | `bytes[32]` | 对象哈希 |

---

## 14. 定长 bytes 类型

部分字段必须固定长度。

示例：

| 类型 | 长度 | 说明 |
|---|---:|---|
| `bytes[4]` | 4B | magic / short token |
| `bytes[8]` | 8B | nonce / short session token |
| `bytes[16]` | 16B | uuid / traceId |
| `bytes[32]` | 32B | sha256 |

Schema 示例：

```yaml
fields:
  - id: 0x21
    name: imageSha256
    type: bytes
    fixedLength: 32
    required: true
```

解析器必须校验 fixedLength。

---

## 15. range 与约束

Type System 支持在 schema 中声明取值范围。

示例：

```yaml
fields:
  - id: 0x01
    name: brightness
    type: uint8
    min: 0
    max: 100
```

约束类型：

| 约束 | 适用类型 | 说明 |
|---|---|---|
| `min` | int / uint | 最小值 |
| `max` | int / uint | 最大值 |
| `minLength` | string / bytes / array | 最小长度 |
| `maxLength` | string / bytes / array | 最大长度 |
| `fixedLength` | bytes / array | 固定长度 |
| `enum` | enum | 引用枚举表 |
| `pattern` | string | 调试 / JSON 层约束，MVP 可选 |

MVP C++ Demo 应至少实现：

```text
min
max
maxLength
fixedLength
```

---

## 16. TLV 与 Type System 的关系

Type System 规定字段值如何表达。

TLV Schema 规定字段如何排列。

关系如下：

```text
TLV.type   -> fieldId
TLV.length -> value 长度
TLV.value  -> 按 Type System 解析
```

示例：

```yaml
fields:
  - id: 0x01
    name: brightness
    type: uint8
```

编码：

```text
01 01 50
```

含义：

```text
fieldId = 0x01
length  = 0x01
value   = uint8(80)
```

---

## 17. JSON 与二进制类型映射

| AXTP 类型 | JSON 表达 | C++ 类型建议 |
|---|---|---|
| `uint8` | number | `uint8_t` |
| `uint16` | number | `uint16_t` |
| `uint32` | number | `uint32_t` |
| `uint64` | string 或 number | `uint64_t` |
| `int8` | number | `int8_t` |
| `int16` | number | `int16_t` |
| `int32` | number | `int32_t` |
| `int64` | string 或 number | `int64_t` |
| `bool` | boolean | `bool` |
| `string` | string | `std::string` |
| `bytes` | base64 string 或 hex string | `std::vector<uint8_t>` |
| `enum` | string 或 number | `enum class` |
| `bitmap` | number 或 string array | integer / bitset |
| `array<T>` | array | `std::vector<T>` |
| `object` | object | struct |

注意：

```text
JSON 中 uint64 / int64 可能超过 JavaScript 安全整数范围。
因此调试 JSON 中建议以 string 表达 64 位整数。
```

---

## 18. Generator v1 类型映射

### 18.1 C++ 类型映射

| AXTP 类型 | C++ v1 类型 |
|---|---|
| `uint8` | `uint8_t` |
| `uint16` | `uint16_t` |
| `uint32` | `uint32_t` |
| `uint64` | `uint64_t` |
| `int8` | `int8_t` |
| `int16` | `int16_t` |
| `int32` | `int32_t` |
| `int64` | `int64_t` |
| `bool` | `bool` |
| `string` | `std::string` |
| `bytes` | `std::vector<uint8_t>` |
| `array<T>` | `std::vector<T>` |
| `object` | generated struct |
| `enum` | `enum class` |
| `bitmap` | integer wrapper 或 raw uint |

---

### 18.2 optional 映射

C++17 及以上：

```cpp
std::optional<T>
```

C++11 / MCU 裁剪版：

```cpp
bool hasField;
T field;
```

MVP Generator 应支持两种模式：

```yaml
cpp:
  optionalMode: std_optional
```

或：

```yaml
cpp:
  optionalMode: has_flag
```

---

## 19. Schema 描述格式建议

Type System 的 schema 建议使用 YAML 作为单一事实源。

示例：

```yaml
schemas:
  - name: BrightnessSetParams
    type: object
    description: Parameters for brightness.set
    fields:
      - id: 0x01
        name: value
        type: uint8
        required: true
        min: 0
        max: 100

      - id: 0x02
        name: transitionMs
        type: uint16
        required: false
        default: 0
```

Generator 基于该 schema 生成：

```text
Markdown 字段表
C++ struct
TLV encode/decode
JSON encode/decode
测试向量
```

---

## 20. MVP 必须支持的类型

Generator v1 和 C++ Demo v1 必须支持：

```text
uint8
uint16
uint32
uint64
int8
int16
int32
bool
string
bytes
enum8
enum16
bitmap8
bitmap16
bitmap32
array<uint16>
object
optional field
default value
min / max
maxLength
fixedLength
```

MVP 可暂缓支持：

```text
int64
float32
float64
bitmap64
bitmapBytes
深层嵌套 object
复杂 union
map
oneof
pattern
```

---

## 21. 非目标

AXTP Type System v1 不追求成为完整 IDL。

以下能力暂不纳入 v1：

```text
接口继承
泛型类型系统
复杂 union
动态反射调用
运行时 schema 下载
完整 Protobuf 替代
完整 JSON Schema 替代
```

如果未来需要，可在 Generator v2 或 Schema v2 中扩展。

---

## 22. 与老协议适配的类型策略

老协议通常存在：

```text
CmdValue
固定二进制 payload
长度隐式字段
无 requestId
无统一 errorCode
```

适配原则：

```text
CmdValue -> methodId
旧 status -> errorCode
旧 payload 固定字段 -> AXTP object schema
旧 byte flag -> enum / bitmap
旧不定长数据 -> bytes / string
旧升级块 -> STREAM OTA data
```

例如旧协议：

```text
CmdValue = 0xC0021
Payload:
  mode: uint8
  width: uint16
  height: uint16
```

可映射为：

```yaml
methods:
  - id: 0xC0021
    name: video.setMode
    legacy:
      cmdValue: 0xC0021
    paramsSchema: VideoSetModeParams

schemas:
  - name: VideoSetModeParams
    fields:
      - id: 0x01
        name: mode
        type: enum8
      - id: 0x02
        name: width
        type: uint16
      - id: 0x03
        name: height
        type: uint16
```

---

## 23. 错误处理

类型解析错误应映射为统一错误码。

| 错误 | 建议 errorCode |
|---|---|
| 字段缺失 | `MISSING_FIELD` |
| 长度不足 | `TRUNCATED_PAYLOAD` |
| 长度超出边界 | `INVALID_LENGTH` |
| 类型不匹配 | `INVALID_TYPE` |
| enum 未知且不可接受 | `UNSUPPORTED_VALUE` |
| 超出 min/max | `VALUE_OUT_OF_RANGE` |
| 字符串非 UTF-8 | `INVALID_ENCODING` |
| fixedLength 不匹配 | `INVALID_LENGTH` |
| required object 解析失败 | `INVALID_PARAMETER` |

具体数值由《ErrorCode 注册表》定义。

---

## 24. 安全与健壮性要求

解析器必须满足：

```text
1. 所有 length 在读取前必须检查边界
2. 所有 array 元素数量必须受 maxLength 或 payloadLength 限制
3. string 必须校验 UTF-8 合法性，或在宽松模式下作为 bytes 处理
4. bytes 不得直接解释为字符串
5. unknown field 必须可跳过
6. nested object 深度必须有限制
7. generator 输出的解码器不得无限循环
```

MVP 推荐限制：

| 项目 | 建议值 |
|---|---:|
| 单个 TLV 最大长度 | 1024B，或受 negotiated maxPayloadSize 限制 |
| object 嵌套深度 | 2 |
| array 最大元素数 | 128 |
| string 默认最大长度 | 128B |
| errorMessage 最大长度 | 128B |

---

## 25. 测试向量要求

每个基础类型应至少提供一个测试向量。

### 25.1 uint16

```text
value: 0x1234
encoded: 34 12
```

### 25.2 uint32

```text
value: 0x12345678
encoded: 78 56 34 12
```

### 25.3 bool

```text
false: 00
true:  01
```

### 25.4 string

```text
value: "AXTP"
encoded: 55 54 46 50
```

### 25.5 bytes[4]

```text
value: 01 02 03 04
encoded: 01 02 03 04
```

### 25.6 bitmap8

```text
CONTROL + RPC + STREAM
encoded: 07
```

---

## 26. 版本演进规则

Type System 演进时应遵循：

```text
新增 optional 字段：兼容
新增 enum 值：通常兼容，但旧端可能不支持
新增 bitmap bit：兼容
新增 required 字段：不兼容
改变字段类型：不兼容
改变字段长度：不兼容
改变字节序：不兼容
复用 deprecated 字段编号：禁止
```

如果出现不兼容变化，应升级：

```text
schemaVersion
或
protocolVersion
```

具体由 Registry 总则定义。

---

## 27. 与后续文档的关系

本文档是以下文档的基础：

```text
06-AXTP-TLV-Schema编码规范.md
07-AXTP-Schema字段编号规范.md
08-AXTP-Registry总则.md
09-AXTP-MethodId注册表.md
10-AXTP-EventId注册表.md
11-AXTP-ErrorCode注册表.md
12-AXTP-Capability注册表.md
13-AXTP-MVP最小实现注册表.md
AXTP-Generator-v1实现规范.md
AXTP-Cpp-Demo实现规范.md
```

TLV Schema 不再重复定义基础类型，只引用本文档。

Registry 不再重复定义 field 类型，只引用本文档。

Generator 必须以本文档作为类型映射依据。

---

## 28. 总结

AXTP Type System v1 的核心原则是：

```text
固定宽度整数
统一 Little Endian
UTF-8 字符串
bytes 显式长度
enum / bitmap 轻量表达
object 由 TLV schema 描述
optional/default 支持兼容演进
Generator 以 YAML schema 为单一事实源
```

最终目标是让：

```text
协议文档
注册表
TLV 编码
DS-RPC Text Profile 映射
Binary-RPC 映射
Stream Profile 建流上下文
C++ Demo
Generator
测试向量
```

共享同一套类型语义，避免“文档一种类型、代码一种类型、老协议又一种类型”的落地风险。
