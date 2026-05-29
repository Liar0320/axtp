# 15《AXTP TLV Schema 编码规范》

版本：v1.0  
状态：MVP Draft  
适用范围：AXTP Control Body、RPC Binary Body、Stream Profile 建流上下文、Registry Schema  
前置文档：14《AXTP Type System 基础类型规范》

---

## 1. 文档目的

本文档定义 AXTP 协议中的 TLV Schema 编码规范，用于：

- CONTROL body
- RPC Binary body
- STREAM 建流上下文（RPC 阶段）
- Capability 描述、Error detail

TLV 不是新的 PayloadType，而是 Payload 内部的字段编码方式：

```text
payloadType = CONTROL, bodyEncoding = TLV
payloadType = RPC, rpcEncoding = BINARY, bodyEncoding = TLV8
```

具体业务字段由注册表文档定义，本文档只定义编码规则。

---

## 2. TLV 基本编码格式

### 2.1 Basic TLV

MVP 默认使用 1B Type + 1B Length：

```text
+---------+---------+-----------------+
 | Type    | Length  | Value           |
 | uint8   | uint8   | bytes[Length]   |
+---------+---------+-----------------+
```

示例：`01 01 50` → fieldId=0x01, length=1, value=0x50（uint8=80）

### 2.2 Extended Length TLV

当 `Length = 0xFF` 时，后续 2B 为扩展长度 `extendedLength:uint16`（Little-Endian）：

```text
+---------+---------+------------------------+----------------------+
 | Type    | 0xFF    | ExtendedLength:uint16  | Value                |
+---------+---------+------------------------+----------------------+
```

示例：`20 FF 2C 01 <300 bytes>` → fieldId=0x20, extendedLength=300

 | 编码形式 | 最大 Value 长度 |
 |---|---|
 | Basic TLV（1B Length） | 254B（0xFF 为扩展标志） |
 | Extended Length TLV | 65535B |

超过 65535B 的数据必须通过 `PayloadType = STREAM` 传输，不得通过单个 TLV 字段承载。

### 2.3 Empty Value

允许 `Length = 0`，适用于 presence flag、空字符串、空 bytes、空数组。bool 类型不建议使用空 Value，应明确编码为 `00`（false）或 `01`（true）。

---

## 3. TLV 字段编号规则

 | 范围 | 用途 |
 |---:|---|
 | `0x00` | 禁止使用 |
 | `0x01-0x1F` | 通用字段或高频字段 |
 | `0x20-0x5F` | 当前 schema 私有字段 |
 | `0x60-0x6F` | 扩展字段 |
 | `0x70-0x7E` | 实验字段 |
 | `0x7F` | vendorData 或 escape |
 | `0x80-0xEF` | 业务域扩展字段 |
 | `0xF0-0xFE` | 厂商私有字段 |
 | `0xFF` | 保留，禁止作为普通字段使用 |

同一 schema 内 fieldId 不得重复；不同 schema 之间可复用。废弃字段不得立即复用，应标记 `deprecated: true`。

---

## 4. 基础类型编码

所有多字节整数使用 Little-Endian（见 05《Type System》）。

 | 类型 | Length | 编码 |
 |---|---:|---|
 | `uint8/int8/bool` | 1B | 原始字节 |
 | `uint16/int16` | 2B | Little-Endian |
 | `uint32/int32` | 4B | Little-Endian |
 | `uint64/int64` | 8B | Little-Endian |
 | `enum uint8` | 1B | 原始字节 |
 | `enum uint16` | 2B | Little-Endian |
 | `bitmap8/16/32` | 1/2/4B | Little-Endian |
 | `string` | N | UTF-8，无 NUL 终止符 |
 | `bytes` | N | 原始字节 |
 | `fixed_bytes` | 固定 N | 必须等于 schema length |

bool 接收端遇到非 `00/01` 值时报 `ERR_INVALID_BOOL`。string 非法 UTF-8 在 strict mode 下报 `ERR_INVALID_UTF8`。

---

## 5. 数组编码

### 5.1 Repeated TLV（MVP 推荐）

同一 fieldId 重复出现表示数组元素：

```text
10 02 01 01   // supportedMethod = 0x0101
10 02 02 01   // supportedMethod = 0x0102
10 02 03 01   // supportedMethod = 0x0103
```

Schema 声明：`encoding: repeated`

### 5.2 Packed Array

多个固定宽度元素放在一个 TLV Value 中：

```text
10 06 01 01 02 01 03 01  // uint16[3] = {0x0101, 0x0102, 0x0103}
```

Schema 声明：`encoding: packed`。Packed Array 要求所有元素为固定长度类型。

### 5.3 Array of Object

对象数组使用 nested TLV，同一 fieldId 重复出现，每次 Value 为一段完整 TLV 序列。

---

## 6. 对象编码

外层 TLV 的 Value 是一段完整的 TLV 序列：

```text
30 0B
  01 02 80 07   // width = 1920
  02 02 38 04   // height = 1080
  03 01 1E      // fps = 30
```

MVP 建议最大嵌套深度 4，超过时报 `ERR_TLV_NESTING_TOO_DEEP`。

字段顺序默认不敏感，但 Generator 生成测试向量时应按 fieldId 升序排列（Canonical Encoding）。

---

## 7. Optional / Required / Default

- `required: true`：字段缺失时报 `ERR_REQUIRED_FIELD_MISSING`
- `required: false`：字段缺失时不报错，使用 `default` 值（若有）
- `default`：线上省略该字段时接收方视为 default 值；重新序列化时可省略
- MVP 不定义 null 类型，需要"清空字段"时使用业务语义字段

---

## 8. 重复字段处理

 | schema 类型 | 重复字段处理 |
 |---|---|
 | scalar（strict mode） | 报 `ERR_DUPLICATE_FIELD` |
 | `repeated: true` | 追加为数组元素 |
 | legacy schema（`duplicatePolicy: last_wins`） | 后者覆盖前者 |

CONTROL Payload 和 RPC params/result/event data 默认 strict mode。

---

## 9. Unknown Field 处理

接收端遇到未知 fieldId：必须跳过，不得失败（前提是 Length 合法且不越界）。高层 SDK 可选择保留未知字段，MCU MVP 可只跳过。

---

## 10. Schema 描述格式

Generator v1 使用 YAML 描述 TLV schema：

```yaml
schemas:
  display.setBrightness.params:
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

对应 TLV：`01 01 50  02 01 00`

---

## 11. Schema 字段属性

 | 属性 | 必选 | 说明 |
 |---|---|---|
 | `fieldId` | 是 | TLV Type |
 | `name` | 是 | 字段名 |
 | `type` | 是 | AXTP Type System 类型 |
 | `required` | 是 | 是否必填 |
 | `encoding` | 否 | enum/array/object 的具体编码方式 |
 | `min` / `max` | 否 | 数值范围 |
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

## 12. 类型校验规则

 | 类型 | Length 要求 |
 |---|---|
 | `uint8/int8/bool` | 必须为 1 |
 | `uint16/int16` | 必须为 2 |
 | `uint32/int32` | 必须为 4 |
 | `uint64/int64` | 必须为 8 |
 | `enum uint8/bitmap8` | 必须为 1 |
 | `enum uint16/bitmap16` | 必须为 2 |
 | `bitmap32` | 必须为 4 |
 | `string` | 0 到 maxLength |
 | `bytes` | 0 到 maxLength |
 | `fixed_bytes` | 必须等于 schema length |
 | `object` | 必须是合法 TLV sequence |
 | `array packed` | 必须是 item size 的整数倍 |

Range 校验：值超出 `min/max` 时报 `ERR_VALUE_OUT_OF_RANGE`。Required 校验在所有字段解析完成后进行（允许字段乱序）。

---

## 13. TLV 解析错误码

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

---

## 14. Canonical Encoding 规范

用于测试向量、签名、hash 和 Generator 输出：

1. 字段按 fieldId 升序排列
2. scalar 字段不得重复
3. array repeated 按原数组顺序排列
4. 使用最短 Length 表达，Value 不携带多余 padding

Decoder 不强制要求输入是 canonical；Generator 生成测试向量时必须使用 canonical。

---

## 15. TLV 与 JSON 的映射

 | JSON | TLV |
 |---|---|
 | object key | schema.name |
 | number | schema type |
 | boolean | bool |
 | string | UTF-8 string |
 | array | repeated 或 packed |
 | object | nested TLV |
 | null | v1 不支持 |

示例：`{"value": 80, "autoMode": false}` → `01 01 50  02 01 00`

---

## 16. 与 RPC Binary 的关系

RPC Parser 先读取 rpcEncoding。若 rpcEncoding=BINARY，则解析 11B Binary Header：rpcEncoding/rpcOp/requestId/methodOrEventId/statusCode/bodyEncoding，剩余 Payload 按 bodyEncoding 交给 TLV8/TLV16/CBOR/RAW_BYTES Parser；业务层根据 methodOrEventId + schema 解释字段含义。JSON/CBOR/MSGPACK 不使用 Binary Header，也不携带 bodyEncoding/bodyLen。

---

## 17. 与 Control Payload 的关系

Control Parser 先解析 5B 固定头 `opcode/controlId/statusCode`。Control body 固定为 TLV 编码，不在线上携带 `bodyEncoding` 或 `bodyLen`；body 长度由外层 Frame `payloadLength - 5` 得出，再根据 opcode 选择对应 Control TLV schema。

示例 OPEN body：`02 01 01` (protocolVersion=1) `04 02 F7 00` (maxFrameSize=247) `06 02 F7 00` (mtu=247)。v1 不在 OPEN/ACCEPT 中协商 headerProfile。

---

## 18. 与 Stream Context 的关系

STREAM packet 不携带 metadata。业务上下文在 RPC 建流请求/响应中使用 TLV，绑定到返回的 `streamId`。Stream data 本身为 raw bytes，不进入 TLV。

---

## 19. 老协议适配规则

- 老 CmdValue → AXTP methodId
- 老 Payload 固定字段 → TLV fieldId（按字段顺序分配 0x01 起）
- 短期无法拆解的旧命令可先用 `fieldId=0x7F, name=legacyPayload, type=bytes` 透传，但不应成为长期设计

---

## 20. 完整编码示例：firmware.begin params

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

TLV Body：

```text
01 01 01
02 04 00 00 10 00
03 20 <32 bytes sha256>
04 02 00 02
```

含义：imageType=MCU_FIRMWARE, imageSize=1048576, imageSha256=32B, chunkSize=512

---

## 21. MVP 必须支持的 TLV 能力

必须：Basic TLV、uint8/uint16/uint32、bool、enum uint8、bitmap8/bitmap16、string、bytes、required/optional/default、unknown field skip、canonical encode

建议：Extended Length TLV、uint64、fixed_bytes、packed array、repeated array、nested object

可暂缓：深层嵌套对象、critical field、schema reflection、动态类型、压缩/加密 TLV

---

## 22. 兼容性与版本演进

兼容变更：新增 optional 字段、新增 enum 值、新增 bitmap bit、增加 maxLength 上限

不兼容变更：修改已有 fieldId 的类型或语义、删除 required 字段、将 optional 改为 required、修改 enum 已有值含义、修改数组编码方式、修改字节序

字段废弃时标记 `deprecated: true`，不得复用 fieldId。

---

## 23. 安全与健壮性要求

TLV Parser 必须防御：

- 所有长度读取前检查剩余字节
- extendedLength 检查溢出
- offset + length 不得溢出
- 嵌套深度有限制
- string/bytes/array 有最大长度限制
- unknown field 可跳过但不能越界
- decoder 不应动态分配不受控内存
