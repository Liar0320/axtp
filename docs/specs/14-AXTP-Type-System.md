# 14《AXTP Type System 基础类型规范》

版本：v1.0  
状态：MVP 实现规范  
适用范围：AXTP Control / RPC / Stream / TLV Schema / Registry

---

## 1. 文档目的

本文档定义 AXTP 协议体系中所有子协议共享的基础类型系统，包括：

- 线上类型（wire type）定义与字节序
- 标量、字符串、枚举、位图、数组、对象类型
- 可选/必选/默认字段规则
- 类型约束与错误处理
- JSON 与二进制映射

---

## 2. 设计原则

AXTP Type System v1 优先保持：少类型、固定宽度、明确字节序、易生成、易解析、未知字段可跳过。

线上类型（wire type）与宿主语言类型分离。Generator 负责将线上类型映射到目标语言类型。

---

## 3. 字节序规范

AXTP v1 所有多字节整数统一使用 **Little-Endian**。

```text
uint16 0x1234 → 34 12
uint32 0x12345678 → 78 56 34 12
uint64 0x0102030405060708 → 08 07 06 05 04 03 02 01
```

单字节类型（uint8、int8、bool、enum8、bitmap8、byte）不受字节序影响。

同一条连接内不得混用字节序。

---

## 4. 基础标量类型

### 4.1 无符号整数

 | 类型 | 长度 | 取值范围 | 典型用途 |
 |---|---:|---:|---|
 | `uint8` | 1B | 0–255 | 小枚举、flags、profile id |
 | `uint16` | 2B | 0–65535 | 长度、methodId、eventId、errorCode |
 | `uint32` | 4B | 0–4294967295 | requestId、streamId、seqId |
 | `uint64` | 8B | 0–2^64-1 | offset、timestamp、objectSize |

### 4.2 有符号整数

 | 类型 | 长度 | 取值范围 |
 |---|---:|---:|
 | `int8` | 1B | -128–127 |
 | `int16` | 2B | -32768–32767 |
 | `int32` | 4B | -2147483648–2147483647 |
 | `int64` | 8B | -2^63–2^63-1 |

有符号整数使用二进制补码。大多数协议字段应优先使用 uint 类型。

### 4.3 布尔类型

 | 类型 | 长度 | false | true |
 |---|---:|---:|---:|
 | `bool` | 1B | `0x00` | `0x01` |

发送方 MUST 使用 0x00/0x01。接收方 SHOULD 将非 0 值视为 true。

### 4.4 字节类型

 | 类型 | 长度 | 说明 |
 |---|---:|---|
 | `byte` | 1B | 单个原始字节 |
 | `bytes` | N | 原始字节数组，长度由外层字段决定 |

### 4.5 浮点类型

MVP 不推荐在线上协议中使用浮点类型，建议优先使用定点整数：

```text
温度 36.5°C → int16 temperatureX10 = 365
电压 5.000V → uint16 voltageMv = 5000
```

`float32`（4B, IEEE 754）和 `float64`（8B, IEEE 754）保留，v1 不推荐使用。

---

## 5. 字符串类型

`string` 表示 UTF-8 编码字符串，长度由外层长度字段决定，不使用 `\0` 终止符。

```text
TLV 示例: fieldId=0x01, length=0x05, value=48 65 6C 6C 6F → "Hello"
```

MVP 推荐最大长度：methodName/eventName/deviceName 64B，versionString 32B，errorMessage/vendorString 128B。

---

## 6. 枚举类型

`enum` 表示有限集合值。MVP 默认使用 `enum8`（uint8），超过 255 项时使用 `enum16`（uint16）。

```yaml
name: ImageType
wireType: enum8
values:
  MCU_FIRMWARE: 0x01
  FPGA_BITSTREAM: 0x02
  RESOURCE_PACK: 0x03
  CONFIG_BUNDLE: 0x04
```

接收方遇到未知 enum 值：optional 字段保留原值或忽略；required 字段返回 `UNSUPPORTED_VALUE`。

---

## 7. 位图类型

 | 类型 | 长度 | 说明 |
 |---|---:|---|
 | `bitmap8` | 1B | 最多 8 个 bit |
 | `bitmap16` | 2B | 最多 16 个 bit |
 | `bitmap32` | 4B | 最多 32 个 bit |
 | `bitmap64` | 8B | 最多 64 个 bit |
 | `bitmapBytes` | N | 可变长度位图 |

bit 从低位开始编号：bit0=0x01，bit1=0x02，bit2=0x04，...

```yaml
name: SupportedPayloadTypes
wireType: bitmap8
bits:
  0: CONTROL
  1: RPC
  2: STREAM
```

---

## 8. 数组类型

`array<T>` 支持两种编码方式：

**repeated TLV**（MVP 推荐）：同一 fieldId 多次出现表示数组。

```text
20 02 01 01   // supportedMethod = 0x0101
20 02 01 02   // supportedMethod = 0x0102
```

**packed array**：大量固定宽度元素时，TLV.value = item[0] + item[1] + ...

```text
20 06 01 01 01 02 06 02  // uint16[3] = {0x0101, 0x0102, 0x0206}
```

Schema 中通过 `encoding: repeated_tlv` 或 `encoding: packed` 声明。

---

## 9. 对象类型

`object` 由多个字段组成，通过 TLV 表达，每个 object 必须有 schema 定义。MVP 建议最多 2 层嵌套。

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
```

---

## 10. 可选字段、必选字段与默认值

- `required: true`：字段必须出现，缺失时返回 `MISSING_FIELD`
- `required: false`：字段可缺省，缺省时按 schema 中 `default` 填入，无 default 则使用语言空值
- `default`：线上省略该字段时，接收方视为 default 值；重新序列化时可省略

---

## 11. 保留字段、废弃字段与扩展字段

- `reserved`：字段编号被保留，不得使用；解析器 SHOULD 忽略
- `deprecated: true`：字段仍可解析，但不建议新实现发送；Generator 应生成 deprecated 标记
- vendor 扩展字段：`0x70-0x7E` vendor specific，`0x7F` vendorData/escape

---

## 12. 类型命名规范

- 类型名：PascalCase（`DeviceInfo`、`FirmwareInfo`）
- 字段名：lowerCamelCase（`requestId`、`streamId`、`firmwareVersion`）
- enum 值：UPPER_SNAKE_CASE（`CONTROL`、`RPC`、`STREAM`）

---

## 13. 通用语义类型

以下高频语义类型由基础类型承载，schema 中建议使用语义别名：

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
 | `requestId` | `uint32` | RPC 请求编号 |
 | `messageId` | `uint16` / `uint8` | Frame 层消息编号：Standard=uint16，Compact=uint8 |
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

 | 类型 | 长度 | 说明 |
 |---|---:|---|
 | `bytes[4]` | 4B | magic / short token |
 | `bytes[8]` | 8B | nonce / short session token |
 | `bytes[16]` | 16B | uuid / traceId |
 | `bytes[32]` | 32B | sha256 |

Schema 中通过 `fixedLength` 声明，解析器必须校验。

---

## 15. range 与约束

 | 约束 | 适用类型 | 说明 |
 |---|---|---|
 | `min` / `max` | int / uint | 数值范围 |
 | `minLength` / `maxLength` | string / bytes / array | 长度范围 |
 | `fixedLength` | bytes / array | 固定长度 |
 | `enum` | enum | 引用枚举表 |
 | `pattern` | string | 调试 / JSON 层约束，MVP 可选 |

---

## 16. TLV 与 Type System 的关系

```text
TLV.type   → fieldId
TLV.length → value 长度
TLV.value  → 按 Type System 解析
```

示例：`fieldId=0x01, type=uint8, value=80` 编码为 `01 01 50`。

---

## 17. JSON 与二进制类型映射

 | AXTP 类型 | JSON 表达 | C++ 类型建议 |
 |---|---|---|
 | `uint8` | number | `uint8_t` |
 | `uint16` | number | `uint16_t` |
 | `uint32` | number | `uint32_t` |
 | `uint64` | string 或 number | `uint64_t` |
 | `int8`–`int32` | number | `int8_t`–`int32_t` |
 | `int64` | string 或 number | `int64_t` |
 | `bool` | boolean | `bool` |
 | `string` | string | `std::string` |
 | `bytes` | base64 或 hex string | `std::vector<uint8_t>` |
 | `enum` | string 或 number | `enum class` |
 | `bitmap` | number 或 string array | integer / bitset |
 | `array<T>` | array | `std::vector<T>` |
 | `object` | object | struct |

注意：JSON 中 uint64/int64 可能超过 JavaScript 安全整数范围，调试 JSON 建议以 string 表达 64 位整数。

---

## 18. MVP 必须支持的类型

```text
uint8 / uint16 / uint32 / uint64
int8 / int16 / int32
bool / string / bytes
enum8 / enum16
bitmap8 / bitmap16 / bitmap32
array<uint16> / object
optional field / default value
min / max / maxLength / fixedLength
```

MVP 可暂缓：int64、float32/float64、bitmap64、bitmapBytes、深层嵌套 object、union、map、oneof。

---

## 19. 非目标

AXTP Type System v1 不追求成为完整 IDL，以下能力暂不纳入 v1：接口继承、泛型类型系统、复杂 union、动态反射调用、运行时 schema 下载。

---

## 20. 与老协议适配的类型策略

```text
CmdValue → methodId
旧 status → errorCode
旧 payload 固定字段 → AXTP object schema
旧 byte flag → enum / bitmap
旧不定长数据 → bytes / string
旧升级块 → STREAM OTA data
```

---

## 21. 错误处理

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
 | required object 解析失败 | `RPC_PARAM_INVALID` |

---

## 22. 安全与健壮性要求

解析器必须满足：

- 所有 length 在读取前必须检查边界
- 所有 array 元素数量必须受 maxLength 或 payloadLength 限制
- string 必须校验 UTF-8 合法性，或在宽松模式下作为 bytes 处理
- unknown field 必须可跳过
- nested object 深度必须有限制

MVP 推荐限制：单个 TLV 最大 1024B，object 嵌套深度 2，array 最大 128 元素，string 默认最大 128B。

---

## 23. 版本演进规则

 | 变更类型 | 兼容性 |
 |---|---|
 | 新增 optional 字段 | 兼容 |
 | 新增 enum 值 | 通常兼容 |
 | 新增 bitmap bit | 兼容 |
 | 新增 required 字段 | 不兼容 |
 | 改变字段类型 | 不兼容 |
 | 改变字段长度 | 不兼容 |
 | 改变字节序 | 不兼容 |
 | 复用 deprecated 字段编号 | 禁止 |

不兼容变化应升级 schemaVersion 或 protocolVersion。
