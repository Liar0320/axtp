# 06《AXTP TLV Schema 编码规范》

版本：v1.0  
状态：MVP Draft  
适用范围：AXTP Control Body、RPC Binary Body、Stream Profile 建流上下文、Registry Schema、Generator v1、C++ Demo v1

---

## 1. 文档目的

本文档定义 AXTP 协议中的 TLV Schema 编码规范。

TLV 是 AXTP 在低带宽、MCU、HID、BLE、UART 等环境下推荐使用的结构化字段编码方式，主要用于：

```text
CONTROL body
RPC Binary body
STREAM metadata
Capability 描述
Error detail
老协议 Payload 兼容映射
Generator 输入/输出约束
C++ 编解码器实现
```

本文档只定义 TLV 的编码规则、字段组织方式、错误处理规则和 schema 描述方式，不定义具体业务字段。具体业务字段由后续注册表文档定义：

```text
MethodId 注册表
EventId 注册表
ErrorCode 注册表
Capability 注册表
Stream Type 注册表
```

---

## 2. TLV 在 AXTP 中的位置

AXTP 的顶层协议结构为：

```text
AXTP Frame Header
  └── PayloadType
      ├── CONTROL
      │   └── Control Payload
      │       └── Optional TLV Body
      │
      ├── RPC
      │   └── RPC Payload
      │       └── Optional TLV Body
      │
      └── STREAM
          └── Stream Payload
              └── Optional TLV Metadata
```

TLV 不是新的 PayloadType。

TLV 只是 Payload 内部的一种字段编码方式。

因此：

```text
payloadType = CONTROL
bodyEncoding = TLV

payloadType = RPC
rpcEncoding = BINARY
bodyEncoding = TLV
```

这些都是合法组合。

---

## 3. 设计原则

### 3.1 小而稳定

TLV 编码必须足够简单，便于在 MCU、裸机、RTOS、USB HID、BLE GATT 等环境中实现。

MVP 不引入复杂反射、不引入动态类型标签、不引入完整自描述对象模型。

---

### 3.2 Schema 外置

TLV 数据本身不携带字段名和复杂类型信息。

字段含义由 schema 或 registry 决定：

```text
fieldId = 0x01
在 brightness.set 中表示 value:uint8

fieldId = 0x01
在 firmware.begin 中可以表示 imageType:uint8
```

是否允许复用 fieldId 由具体 schema 范围决定。

---

### 3.3 可跳过未知字段

TLV 必须支持向前兼容。

接收端遇到未知字段时，只要字段长度合法，就必须能够跳过。

```text
unknown fieldId
  ↓
read length
  ↓
skip value
```

不得因为未知字段直接导致整个包解析失败，除非该字段违反长度边界或 schema 明确要求 strict mode。

---

### 3.4 固定字节序

所有多字节整数统一采用 AXTP Type System 中定义的字节序。

MVP 建议统一使用：

```text
Little Endian
```

也就是：

```text
uint16 0x1234 编码为 34 12
uint32 0x12345678 编码为 78 56 34 12
```

---

### 3.5 不在 TLV 内重复 Frame 信息

TLV 不应重复表达已经由 Frame Header 或 Payload Header 表达的信息。

例如：

```text
payloadLength
messageId
frameIndex
frameCount
payloadType
```

这些属于 AXTP Frame Header。

只有当某些字段是业务语义的一部分时，才进入 TLV，例如：

```text
requestId
methodId
eventId
streamId
transferId
offset
chunkCrc32
```

---

## 4. TLV 基本编码格式

### 4.1 Basic TLV

MVP 默认使用 1B Type + 1B Length。

```text
+---------+---------+-----------------+
| Type    | Length  | Value           |
| uint8   | uint8   | bytes[Length]   |
+---------+---------+-----------------+
```

字段说明：

| 字段 | 长度 | 说明 |
|---|---:|---|
| `Type` | 1B | 字段编号，也称 fieldId |
| `Length` | 1B | Value 的字节长度 |
| `Value` | N | 字段值 |

示例：

```text
01 01 50
```

含义：

```text
fieldId = 0x01
length  = 0x01
value   = 0x50
```

如果 schema 中定义：

```yaml
fieldId: 0x01
name: value
type: uint8
```

则表示：

```text
value = 80
```

---

### 4.2 Extended Length TLV

当 `Length < 0xFF` 时，Length 表示 Value 的实际长度。

当 `Length = 0xFF` 时，后续 2B 表示扩展长度 `extendedLength:uint16`。

```text
+---------+---------+------------------------+----------------------+
| Type    | 0xFF    | ExtendedLength:uint16  | Value                |
+---------+---------+------------------------+----------------------+
```

扩展长度也使用 AXTP 固定字节序。

示例：

```text
20 FF 2C 01 <300 bytes>
```

含义：

```text
fieldId        = 0x20
length marker  = 0xFF
extendedLength = 0x012C = 300
value length   = 300 bytes
```

MVP 实现要求：

```text
必须支持 Basic TLV
建议支持 Extended Length TLV
```

对于 BLE/HID Compact Profile，如果希望极简实现，可以在 MVP 阶段限制单个 TLV value 不超过 254B。

**单个 TLV Value 的最大长度上限：**

| 编码形式 | 最大 Value 长度 |
| --- | --- |
| Basic TLV（1B Length） | 254 字节（0xFE，0xFF 为扩展标志） |
| Extended Length TLV（3B Length） | 65535 字节（uint16 最大值） |

如果业务需要传递超过 65535 字节的数据，不得通过单个 TLV 字段承载，必须通过 `PayloadType = STREAM` 传输。典型场景：固件镜像、文件内容、视频帧——这些均属于 STREAM 数据面，不应出现在 TLV Body 中。

---

### 4.3 Empty Value

允许 `Length = 0`。

```text
10 00
```

适用于：

```text
presence flag
空字符串
空 bytes
空数组
```

但对于 bool 类型，MVP 不建议使用空 Value 表示 true。bool 应明确编码为：

```text
false = 00
true  = 01
```

---

## 5. TLV 字段编号规则

### 5.1 fieldId 长度

MVP 使用：

```text
fieldId:uint8
```

范围：

```text
0x00 - 0xFF
```

---

### 5.2 保留范围

建议统一保留以下 fieldId 范围：

| 范围 | 用途 |
|---:|---|
| `0x00` | 禁止使用，用作非法字段检测 |
| `0x01-0x1F` | 通用字段或高频字段 |
| `0x20-0x5F` | 当前 schema / 当前 method / 当前 event 私有字段 |
| `0x60-0x6F` | 扩展字段 |
| `0x70-0x7E` | 实验字段 |
| `0x7F` | vendorData 或 escape |
| `0x80-0xEF` | 业务域扩展字段 |
| `0xF0-0xFE` | 厂商私有字段 |
| `0xFF` | 保留，禁止作为普通字段使用 |

---

### 5.3 fieldId 重用规则

同一个 schema 内：

```text
fieldId 不得重复
```

不同 schema 之间：

```text
fieldId 可以复用
```

例如：

```text
brightness.set:
  0x01 = value

audio.setVolume:
  0x01 = volume

firmware.begin:
  0x01 = imageType
```

这是允许的，因为 TLV 字段含义由 method/event/schema 上下文决定。

---

### 5.4 废弃字段规则

字段废弃后不得立即复用。

schema 中应标记：

```yaml
deprecated: true
reserved: true
```

废弃字段应继续保留 fieldId，避免老设备误解析。

---

## 6. AXTP 基础类型编码

TLV Value 的类型由 schema 指定。

### 6.1 整数类型

| 类型 | 长度 | 编码 |
|---|---:|---|
| `uint8` | 1B | 原始字节 |
| `uint16` | 2B | Little Endian |
| `uint32` | 4B | Little Endian |
| `uint64` | 8B | Little Endian |
| `int8` | 1B | 二进制补码 |
| `int16` | 2B | Little Endian 二进制补码 |
| `int32` | 4B | Little Endian 二进制补码 |
| `int64` | 8B | Little Endian 二进制补码 |

示例：

```text
field temperature:int16 = -10

01 02 F6 FF
```

---

### 6.2 bool

bool 固定编码为 1B：

```text
false = 00
true  = 01
```

示例：

```text
field autoMode:bool = true

02 01 01
```

接收端遇到非 `00/01` 的 bool 值时，必须报：

```text
ERR_INVALID_BOOL
```

---

### 6.3 enum

enum 默认使用 `uint8` 编码。

如果 enum 值超过 255，应在 schema 中显式声明：

```yaml
encoding: uint16
```

示例：

```yaml
fieldId: 0x03
name: codec
type: enum
enum: CodecId
encoding: uint8
```

编码：

```text
03 01 02
```

含义：

```text
codec = 0x02
```

接收端遇到未知 enum 值时的处理：

| 场景 | 处理方式 |
|---|---|
| 非 strict mode | 保留原始值，继续解析 |
| strict mode | 报 `ERR_UNKNOWN_ENUM_VALUE` |
| capability negotiation | 应视为不支持 |

---

### 6.4 bitmap

bitmap 用于表达多个能力位。

MVP 支持：

```text
bitmap8
bitmap16
bitmap32
```

示例：

```yaml
fieldId: 0x04
name: supportedPayloadTypes
type: bitmap
encoding: uint8
bits:
  0: CONTROL
  1: RPC
  2: STREAM
```

编码：

```text
04 01 07
```

含义：

```text
bit0 = CONTROL
bit1 = RPC
bit2 = STREAM
```

---

### 6.5 string

string 使用 UTF-8 编码，不包含 NUL 终止符。

TLV Length 即 UTF-8 字节长度。

示例：

```text
deviceName = "cam"

05 03 63 61 6D
```

空字符串：

```text
05 00
```

字符串必须满足：

```text
UTF-8 valid
不含隐式终止符
长度由 TLV length 决定
```

接收端如遇非法 UTF-8，在 strict mode 下应报：

```text
ERR_INVALID_UTF8
```

在非 strict mode 下可保留为 bytes。

---

### 6.6 bytes

bytes 为原始字节序列。

示例：

```text
token = 12 34 56 78

06 04 12 34 56 78
```

bytes 不做字符集解释。

---

### 6.7 fixed_bytes

固定长度字节数组由 schema 指定长度。

示例：

```yaml
fieldId: 0x07
name: sha256
type: fixed_bytes
length: 32
```

如果 TLV Length 不等于 schema length，必须报：

```text
ERR_INVALID_LENGTH
```

---

## 7. 数组编码

TLV 支持两种数组编码方式。

MVP 推荐优先使用：

```text
repeated TLV
```

---

### 7.1 Repeated TLV 数组

同一个 fieldId 可以重复出现，表示数组元素。

示例：

```yaml
fieldId: 0x10
name: supportedMethods
type: array
items:
  type: uint16
encoding: repeated
```

编码：

```text
10 02 01 01
10 02 02 01
10 02 03 01
```

含义：

```text
supportedMethods = [0x0101, 0x0102, 0x0103]
```

优点：

```text
实现简单
可边读边处理
适合 MCU
```

缺点：

```text
有少量 Type/Length 重复开销
```

---

### 7.2 Packed Array

Packed Array 将多个元素放在一个 TLV Value 中。

示例：

```yaml
fieldId: 0x10
name: supportedMethods
type: array
items:
  type: uint16
encoding: packed
```

编码：

```text
10 06 01 01 02 01 03 01
```

含义：

```text
3 个 uint16：
0x0101
0x0102
0x0103
```

Packed Array 要求所有元素为固定长度类型。

可用于：

```text
methodId 列表
eventId 列表
capabilityId 列表
errorCode 列表
```

---

### 7.3 Array of Object

对象数组建议使用 nested TLV。

例如：

```yaml
fieldId: 0x20
name: streams
type: array
items:
  type: object
encoding: repeated_nested
```

编码：

```text
20 0A
  01 04 01 00 00 00
  02 02 01 01

20 0A
  01 04 02 00 00 00
  02 02 01 02
```

含义：

```text
streams = [
  { streamId: 1, profileId: 0x0101 },
  { streamId: 2, profileId: 0x0201 }
]
```

---

## 8. 对象编码

### 8.1 Nested TLV Object

对象字段使用嵌套 TLV 编码。

外层 TLV 的 Value 是一段完整的 TLV 序列。

```text
Outer TLV
+---------+---------+------------------------+
| Type    | Length  | Nested TLV Sequence    |
+---------+---------+------------------------+
```

示例：

```yaml
fieldId: 0x30
name: videoParams
type: object
fields:
  - fieldId: 0x01
    name: width
    type: uint16
  - fieldId: 0x02
    name: height
    type: uint16
  - fieldId: 0x03
    name: fps
    type: uint8
```

编码：

```text
30 0B
  01 02 80 07
  02 02 38 04
  03 01 1E
```

含义：

```text
videoParams = {
  width: 1920,
  height: 1080,
  fps: 30
}
```

---

### 8.2 嵌套深度限制

为避免递归解析风险，MVP 建议：

```text
最大嵌套深度 = 4
```

C++ 实现必须提供最大嵌套深度保护。

超过时返回：

```text
ERR_TLV_NESTING_TOO_DEEP
```

---

### 8.3 对象字段顺序

默认字段顺序不敏感。

以下两段 TLV 等价：

```text
01 01 50
02 01 01
```

```text
02 01 01
01 01 50
```

但 Generator 输出测试向量时，应按 fieldId 升序生成，便于比对。

---

## 9. Optional / Required / Default

### 9.1 Required 字段

schema 可将字段标记为 required。

```yaml
required: true
```

解码时，如果 required 字段缺失，必须报：

```text
ERR_REQUIRED_FIELD_MISSING
```

---

### 9.2 Optional 字段

optional 字段缺失时，不报错。

```yaml
required: false
```

C++ 结构体中建议生成：

```cpp
std::optional<T>
```

或 MCU 模式下生成：

```cpp
bool has_xxx;
T xxx;
```

---

### 9.3 Default 值

schema 可指定 default。

```yaml
default: 0
```

当字段缺失时，解码结果使用 default 值。

规则：

```text
required 字段不应依赖 default
optional 字段可以有 default
default 不会在线上传输
```

---

### 9.4 Null

MVP TLV 不定义 null 类型。

如需表达“清空某字段”，应使用业务语义字段，例如：

```yaml
clear: bool
```

或使用空 bytes / 空 string。

---

## 10. 重复字段处理

同一个 fieldId 重复出现时，处理规则由 schema 决定。

| schema 类型 | 重复字段处理 |
|---|---|
| scalar | **默认 strict mode：报 `ERR_DUPLICATE_FIELD`** |
| array repeated | 追加为数组元素（必须在 schema 中显式标记 `repeated=true`） |
| object repeated_nested | 追加为对象数组（必须在 schema 中显式标记 `repeated=true`） |
| reserved | 报错 |

**默认策略（strict mode）：**

```text
协议控制面（CONTROL Payload）：strict，重复字段报 MALFORMED_CONTROL_PAYLOAD
RPC params / result / event data：strict，重复字段报 ERR_DUPLICATE_FIELD
Legacy schema（显式声明 duplicatePolicy: last_wins）：后者覆盖前者
```

只有在 schema 中显式声明以下之一，才允许重复：

```text
repeated: true          → 追加为数组
duplicatePolicy: last_wins  → 仅限 legacy schema，后者覆盖前者
```

普通业务 schema 不得依赖"后者覆盖"行为。

---

## 11. Unknown Field 处理

### 11.1 默认规则

接收端遇到未知 fieldId：

```text
必须跳过
不得失败
```

前提是：

```text
Length 合法
不会越界
```

---

### 11.2 保留未知字段

高层 SDK 可以选择保留未知字段：

```cpp
std::vector<UnknownTlv> unknownFields;
```

MCU MVP 可以不保留，只跳过。

---

### 11.3 Critical Field

MVP 不引入 critical field 标记。

未来如需要，可通过 fieldId 范围或 schema 属性增加：

```yaml
critical: true
```

但 v1 不建议实现。

---

## 12. Schema 描述格式

Generator v1 建议使用 YAML 描述 TLV schema。

### 12.1 Method Params Schema 示例

```yaml
schemas:
  brightness.set.params:
    encoding: tlv
    fields:
      - fieldId: 0x01
        name: value
        type: uint8
        required: true
        min: 0
        max: 100

      - fieldId: 0x02
        name: autoMode
        type: bool
        required: false
        default: false
```

对应 TLV：

```text
01 01 50
02 01 00
```

---

### 12.2 Method Result Schema 示例

```yaml
schemas:
  brightness.set.result:
    encoding: tlv
    fields:
      - fieldId: 0x01
        name: value
        type: uint8
        required: true

      - fieldId: 0x02
        name: applied
        type: bool
        required: true
```

---

### 12.3 Event Data Schema 示例

```yaml
schemas:
  brightness.changed.event:
    encoding: tlv
    fields:
      - fieldId: 0x01
        name: oldValue
        type: uint8
        required: false

      - fieldId: 0x02
        name: newValue
        type: uint8
        required: true

      - fieldId: 0x03
        name: reason
        type: enum
        enum: BrightnessChangeReason
        encoding: uint8
        required: false
```

---

### 12.4 Stream Profile Context Schema 示例

```yaml
schemas:
  stream.firmware.ota.context:
    encoding: tlv
    fields:
      - fieldId: 0x01
        name: imageType
        type: enum
        enum: FirmwareImageType
        encoding: uint8
        required: true

      - fieldId: 0x02
        name: offset
        type: uint64
        required: true

      - fieldId: 0x03
        name: chunkCrc32
        type: uint32
        required: false
```

---

## 13. Schema 字段属性

Generator v1 必须识别以下字段属性：

| 属性 | 必选 | 说明 |
|---|---|---|
| `fieldId` | 是 | TLV Type |
| `name` | 是 | 字段名 |
| `type` | 是 | AXTP Type System 类型 |
| `required` | 是 | 是否必填 |
| `encoding` | 否 | enum、array、object 的具体编码方式 |
| `min` | 否 | 数值最小值 |
| `max` | 否 | 数值最大值 |
| `length` | 否 | fixed_bytes 长度 |
| `maxLength` | 否 | string/bytes 最大长度 |
| `items` | 否 | array 元素定义 |
| `fields` | 否 | object 子字段 |
| `enum` | 否 | enum 引用 |
| `default` | 否 | 默认值 |
| `deprecated` | 否 | 是否废弃 |
| `reserved` | 否 | 是否保留 |
| `description` | 否 | 字段说明 |

---

## 14. 类型校验规则

解码后必须按 schema 做基础校验。

### 14.1 Length 校验

| 类型 | Length 要求 |
|---|---|
| `uint8/int8/bool` | 必须为 1 |
| `uint16/int16` | 必须为 2 |
| `uint32/int32` | 必须为 4 |
| `uint64/int64` | 必须为 8 |
| `enum uint8` | 必须为 1 |
| `enum uint16` | 必须为 2 |
| `bitmap8` | 必须为 1 |
| `bitmap16` | 必须为 2 |
| `bitmap32` | 必须为 4 |
| `string` | 0 到 maxLength |
| `bytes` | 0 到 maxLength |
| `fixed_bytes` | 必须等于 length |
| `object` | 必须是一段合法 TLV sequence |
| `array packed` | 必须是 item size 的整数倍 |

---

### 14.2 Range 校验

如果 schema 定义：

```yaml
min: 0
max: 100
```

则值超出范围时报：

```text
ERR_VALUE_OUT_OF_RANGE
```

---

### 14.3 Required 校验

所有 TLV 字段解析完成后，再做 required 校验。

这样可以允许字段乱序。

---

## 15. TLV 解析错误码建议

TLV 解析器应至少能区分以下错误：

| 错误码 | 名称 | 说明 |
|---|---|---|
| `0x0301` | `ERR_TLV_TRUNCATED` | TLV 数据被截断 |
| `0x0302` | `ERR_TLV_INVALID_LENGTH` | 长度非法 |
| `0x0303` | `ERR_TLV_UNKNOWN_SCHEMA` | 找不到 schema |
| `0x0304` | `ERR_TLV_REQUIRED_FIELD_MISSING` | 必填字段缺失 |
| `0x0305` | `ERR_TLV_DUPLICATE_FIELD` | 重复字段非法 |
| `0x0306` | `ERR_TLV_TYPE_MISMATCH` | 类型不匹配 |
| `0x0307` | `ERR_TLV_VALUE_OUT_OF_RANGE` | 值越界 |
| `0x0308` | `ERR_TLV_INVALID_UTF8` | 非法 UTF-8 |
| `0x0309` | `ERR_TLV_NESTING_TOO_DEEP` | 嵌套过深 |
| `0x030A` | `ERR_TLV_UNSUPPORTED_ENCODING` | 不支持的编码 |
| `0x030B` | `ERR_TLV_INVALID_BOOL` | bool 值非法 |

这些错误码最终应纳入 ErrorCode 注册表。

---

## 16. Canonical Encoding 规范

为了便于测试向量、签名、hash 和 generator 输出，AXTP 定义 Canonical TLV Encoding。

Canonical 编码要求：

```text
1. 字段按 fieldId 升序排列
2. scalar 字段不得重复
3. array repeated 按原数组顺序排列
4. 未知字段不参与重新编码，除非 SDK 显式保留
5. 使用最短 Length 表达
6. Value 不携带多余 padding
```

示例：

非 Canonical：

```text
02 01 00
01 01 50
```

Canonical：

```text
01 01 50
02 01 00
```

MVP 要求：

```text
Decoder 不强制要求输入是 canonical
Generator 生成测试向量时必须使用 canonical
```

---

## 17. TLV 与 JSON 的映射

TLV 与 DS-RPC Text Profile params/result/event data 应保持语义等价。

示例 JSON：

```json
{
  "value": 80,
  "autoMode": false
}
```

Schema：

```yaml
fields:
  - fieldId: 0x01
    name: value
    type: uint8
    required: true
  - fieldId: 0x02
    name: autoMode
    type: bool
    required: false
    default: false
```

TLV：

```text
01 01 50
02 01 00
```

映射规则：

| JSON | TLV |
|---|---|
| object key | schema.name |
| number | schema type |
| boolean | bool |
| string | UTF-8 string |
| array | repeated 或 packed |
| object | nested TLV |
| null | v1 不支持 |

---

## 18. 与 RPC Binary 的关系

RPC Binary Payload 中的 body 可以采用 TLV。

示例：

```text
AXTP Frame Header
  payloadType = RPC

RPC Binary Payload
  rpcEncoding = BINARY
  rpcOp = REQUEST
  requestId = 0x0001
  methodId = brightness.set
  statusCode = 0x0000
  bodyEncoding = TLV
  bodyLen = 6

TLV Body
  01 01 50
  02 01 00
```

RPC Parser 只负责解析：

```text
rpcEncoding
rpcOp
requestId
methodId/eventId
statusCode
bodyEncoding
bodyLen
```

TLV Parser 负责解析：

```text
body TLV
```

业务层根据：

```text
methodId + schema
```

解释字段含义。

---

## 19. 与 Control Payload 的关系

Control Payload 中的 body 推荐使用 TLV。

示例：

```text
payloadType = CONTROL
opcode = HELLO
bodyEncoding = TLV

Body:
  02 01 01      // protocolVersion = 1
  03 01 02      // headerProfile = Compact
  06 02 F7 00   // mtu = 247
```

Control Parser 先解析：

```text
opcode
controlId
statusCode
bodyEncoding
bodyLen
```

再根据 opcode 选择对应 Control TLV schema。

---

## 20. 与 Stream Context 的关系

STREAM packet 不携带 metadata，也不携带 `streamProfile / metadataEncoding / metadataLen`。业务上下文应在 RPC 建流请求/响应中使用 TLV，并绑定到返回的 `streamId`。

示例：

```text
RPC firmware.begin payload:
profile = firmware.ota

TLV Body:
  01 01 01
  02 08 00 00 10 00 00 00 00 00
  03 04 78 56 34 12

RPC firmware.begin response:
streamId = 1

STREAM packet:
streamId / seqId / cursor / data
```

含义：

```text
imageType = MCU_FIRMWARE
offset = 0x00100000
chunkCrc32 = 0x12345678
```

Stream data 本身不进入 TLV。

也就是说：

```text
metadata = TLV
data = raw bytes
```

---

## 21. 老协议适配规则

很多老协议 Payload 已经是固定字段二进制结构。

适配到 AXTP TLV 时，建议按以下策略：

### 21.1 老 CmdValue 映射为 methodId

```text
old CmdValue -> AXTP methodId
```

### 21.2 老 Payload 字段映射为 TLV fieldId

例如旧协议：

```text
CmdValue = 0xC0021
Payload:
  mode:uint8
  width:uint16
  height:uint16
```

适配 schema：

```yaml
schemas:
  video.setMode.params:
    oldCmdValue: 0xC0021
    encoding: tlv
    fields:
      - fieldId: 0x01
        name: mode
        type: uint8
        required: true
      - fieldId: 0x02
        name: width
        type: uint16
        required: true
      - fieldId: 0x03
        name: height
        type: uint16
        required: true
```

### 21.3 老 Payload 可先作为 fixed_bytes 透传

对于短期无法拆解的旧命令，可以先定义：

```yaml
fields:
  - fieldId: 0x7F
    name: legacyPayload
    type: bytes
    required: true
```

但这只能作为过渡方案，不应成为长期设计。

---

## 22. Generator v1 要求

Generator v1 读取 schema YAML 后，至少生成：

```text
C++ fieldId 常量
C++ params/result/event struct
TLV encode 函数
TLV decode 函数
Markdown 字段表
测试向量模板
```

### 22.1 C++ 生成示例

Schema：

```yaml
schemas:
  brightness.set.params:
    encoding: tlv
    fields:
      - fieldId: 0x01
        name: value
        type: uint8
        required: true
      - fieldId: 0x02
        name: autoMode
        type: bool
        required: false
        default: false
```

C++ 结构体建议：

```cpp
struct BrightnessSetParams {
    uint8_t value;
    bool autoMode = false;
    bool hasAutoMode = false;
};
```

字段常量：

```cpp
namespace field_id::brightness_set_params {
constexpr uint8_t VALUE = 0x01;
constexpr uint8_t AUTO_MODE = 0x02;
}
```

---

### 22.2 MCU 模式

MCU 模式不强制使用 `std::optional`、`std::vector`、异常。

建议：

```text
固定 buffer
错误码返回
has_xxx 标记
最大字段数量限制
最大嵌套深度限制
最大 TLV 长度限制
```

---

## 23. C++ TLV Parser 推荐流程

推荐解析流程：

```text
parseTlvSequence(buffer, length, schema):
  while offset < length:
    read fieldId
    read length
    if length == 0xFF:
      read extendedLength
    check boundary
    lookup field schema
    if unknown:
      skip or preserve
      continue
    decode value by type
    validate length
    validate range
    store field
  validate required fields
  return decoded object
```

必须防御：

```text
越界读取
无限递归
长度溢出
重复字段攻击
超大字段
非法 UTF-8
非法 bool
array packed 长度不对齐
```

---

## 24. MVP 必须支持的 TLV 能力

MVP 阶段必须支持：

```text
Basic TLV
uint8
uint16
uint32
bool
enum uint8
bitmap8
string
bytes
required
optional
default
unknown field skip
canonical encode
```

MVP 建议支持：

```text
Extended Length TLV
uint64
fixed_bytes
packed array
repeated array
nested object
```

MVP 可以暂缓：

```text
深层嵌套对象
复杂 object array
critical field
schema reflection
动态类型
压缩 TLV
加密字段级 TLV
```

---

## 25. 测试向量建议

后续应在 TestVector 文档中至少提供以下 TLV 用例：

```text
01. uint8 字段
02. uint16 Little Endian 字段
03. bool true / false
04. string UTF-8 字段
05. bytes 字段
06. required 字段缺失
07. unknown field skip
08. repeated array
09. packed array
10. nested object
11. extended length
12. invalid length
13. invalid bool
14. duplicate scalar field
15. canonical ordering
```

---

## 26. 示例：brightness.set 完整编码

### 26.1 JSON 表达

```json
{
  "method": "brightness.set",
  "params": {
    "value": 80,
    "autoMode": false
  }
}
```

### 26.2 Schema

```yaml
schemas:
  brightness.set.params:
    encoding: tlv
    fields:
      - fieldId: 0x01
        name: value
        type: uint8
        required: true
        min: 0
        max: 100

      - fieldId: 0x02
        name: autoMode
        type: bool
        required: false
        default: false
```

### 26.3 TLV Body

```text
01 01 50
02 01 00
```

### 26.4 解析结果

```text
value = 80
autoMode = false
```

---

## 27. 示例：capability.getAll result

### 27.1 Schema

```yaml
schemas:
  capability.getAll.result:
    encoding: tlv
    fields:
      - fieldId: 0x01
        name: supportedPayloadTypes
        type: bitmap
        encoding: bitmap8
        required: true

      - fieldId: 0x02
        name: supportedRpcEncodings
        type: bitmap
        encoding: bitmap16
        required: true

      - fieldId: 0x03
        name: supportedMethods
        type: array
        encoding: packed
        items:
          type: uint16
        required: true
```

### 27.2 TLV Body

```text
01 01 07
02 02 07 00
03 06 01 01 02 01 01 06
```

含义：

```text
supportedPayloadTypes = CONTROL | RPC | STREAM
supportedRpcEncodings = JSON | BINARY | TLV
supportedMethods = [0x0101, 0x0102, 0x0601]
```

---

## 28. 示例：firmware.begin params

### 28.1 Schema

```yaml
schemas:
  firmware.begin.params:
    encoding: tlv
    fields:
      - fieldId: 0x01
        name: imageType
        type: enum
        enum: FirmwareImageType
        encoding: uint8
        required: true

      - fieldId: 0x02
        name: imageSize
        type: uint32
        required: true

      - fieldId: 0x03
        name: imageSha256
        type: fixed_bytes
        length: 32
        required: true

      - fieldId: 0x04
        name: chunkSize
        type: uint16
        required: false
        default: 512
```

### 28.2 TLV Body 示例

```text
01 01 01
02 04 00 00 10 00
03 20 <32 bytes sha256>
04 02 00 02
```

含义：

```text
imageType = MCU_FIRMWARE
imageSize = 1048576
imageSha256 = 32 bytes
chunkSize = 512
```

---

## 29. 兼容性与版本演进

TLV schema 的演进规则：

### 29.1 兼容变更

以下变更通常兼容：

```text
新增 optional 字段
新增 enum 值
新增 bitmap bit
新增 unknown 可跳过字段
增加 maxLength 上限
```

### 29.2 不兼容变更

以下变更不兼容：

```text
修改已有 fieldId 的类型
修改已有 fieldId 的语义
删除 required 字段
将 optional 字段改为 required
修改 enum 已有值含义
修改数组编码方式
修改字节序
```

### 29.3 字段废弃

字段废弃时：

```yaml
deprecated: true
reserved: true
```

不得复用 fieldId。

---

## 30. 安全与健壮性要求

TLV Parser 必须防御异常输入。

最低要求：

```text
1. 所有长度读取前必须检查剩余字节
2. extendedLength 必须检查溢出
3. offset + length 不得溢出
4. 嵌套深度必须有限制
5. string 必须有最大长度
6. bytes 必须有最大长度
7. array 元素数量必须有限制
8. unknown field 可跳过但不能越界
9. decoder 不应动态分配不受控内存
10. parser 不应抛出未捕获异常
```

---

## 31. 本规范的 MVP 结论

AXTP TLV Schema v1 的最小落地方案是：

```text
Basic TLV:
  Type:uint8
  Length:uint8
  Value:bytes

Extended Length:
  Length = 0xFF + uint16 extendedLength

Endian:
  Little Endian

MVP Types:
  uint8 / uint16 / uint32
  bool
  enum uint8
  bitmap8 / bitmap16
  string
  bytes

Compatibility:
  unknown field skip
  optional/default
  required validation
  canonical encode for generator
```

这套 TLV 规范可以直接支撑：

```text
CONTROL HELLO / ACK / NACK
RPC Binary params/result/event
STREAM metadata
Capability registry
老协议 CmdValue 迁移
Generator v1
C++ Demo v1
```

---

## 32. 后续文档依赖

本文档后续将被以下文档引用：

```text
07-AXTP-Schema字段编号规范.md
08-AXTP-Registry总则.md
09-AXTP-MethodId注册表.md
10-AXTP-EventId注册表.md
11-AXTP-ErrorCode注册表.md
12-AXTP-Capability注册表.md
13-AXTP-MVP最小实现注册表.md
AXTP-Generator-v1实现规范.md
AXTP-Cpp-Demo实现规范.md
AXTP-TestVector协议测试向量.md
```
