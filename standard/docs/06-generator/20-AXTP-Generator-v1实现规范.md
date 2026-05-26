# 20《AXTP Generator v1 实现规范》

版本：v1.0  
状态：MVP 实现规范  
适用范围：AXTP Registry / Schema / C++ Demo / Markdown 文档生成  
关联文档：

- 00《AXTP 协议总览与落地路线》
- 05《AXTP Type-System 基础类型规范》
- 06《AXTP TLV-Schema 编码规范》
- 07《AXTP Schema 字段编号规范》
- 08《AXTP Registry 总则》
- 09《AXTP MethodId 注册表》
- 10《AXTP EventId 注册表》
- 11《AXTP ErrorCode 注册表》
- 12《AXTP Capability 注册表》
- 13《AXTP MVP 最小实现注册表》
- 14《AXTP 老协议适配与迁移规范》
- 21《AXTP Cpp Demo 实现规范》

---

## 1. 文档目的

本文档定义 AXTP Generator v1 的实现范围、输入格式、校验规则、输出产物和工程集成方式。

Generator v1 的目标不是实现完整 SDK，也不是替代协议栈运行时，而是把 AXTP 的注册表和 schema 从“人工维护的 Markdown 表格”升级为“可校验、可生成、可测试的单一事实源”。

Generator v1 应服务于以下目标：

```text
registry/*.yaml + schema/*.yaml
        ↓
AXTP Generator v1
        ↓
Markdown 注册表文档
C++ enum / descriptor / struct skeleton
JSON schema / machine-readable registry
测试向量
C++ Demo 可编译输入
```

---

## 2. 核心原则

### 2.1 Registry / Schema 是单一事实源

所有 methodId、eventId、errorCode、capabilityId、Stream Profile、fieldId、legacyCmdValue 的定义，必须以 YAML/JSON registry 为准。

Markdown 文档、C++ 枚举、测试向量和 Demo 常量均为生成结果，不应作为人工维护的主数据源。

---

### 2.2 Generator 不参与运行时业务逻辑

Generator v1 只生成以下内容：

```text
ID 常量
枚举定义
Schema 描述符
TLV 编解码辅助代码
Method / Event / Error / Capability 描述表
Markdown 文档
测试向量
```

Generator v1 不负责：

```text
传输连接
异步调度
重传策略
会话管理
OTA 状态机
业务 handler 实现
设备驱动调用
```

这些内容属于 C++ Demo 或正式 SDK Runtime。

---

### 2.3 先支持 MVP，再扩展完整能力

Generator v1 必须优先覆盖 13《AXTP MVP 最小实现注册表》中的 P0 集合。

P0 包括：

```text
CONTROL OPEN / ACCEPT / ACK / NACK / HEARTBEAT / CLOSE
RPC device.getInfo
RPC capability.getAll
RPC brightness.get
RPC brightness.set
RPC firmware.begin
RPC firmware.end
RPC firmware.verify
RPC firmware.apply
STREAM OTA chunk
EVENT brightness.changed
EVENT firmware.updateProgress
EVENT firmware.updateCompleted
EVENT firmware.updateFailed
```

P1/P2 能力可以预留 schema，但不要求 Generator v1 完整生成可运行代码。

---

### 2.4 老协议映射必须可生成

旧协议中的 CmdValue、旧 status、旧 payload 字段必须通过 `legacy` 映射字段表达。

Generator v1 必须能够输出：

```text
legacy_cmd_mapping_generated.h
legacy_cmd_mapping.json
legacy_cmd_mapping.md
```

用于老协议适配层查表。

---

## 3. Generator v1 输入目录结构

推荐输入结构如下：

```text
standard/
├── registry/
│   ├── payload_type.yaml
│   ├── control_opcode.yaml
│   ├── rpc_encoding.yaml
│   ├── rpc_op.yaml
│   ├── stream_profile.yaml
│   ├── method_registry.yaml
│   ├── event_registry.yaml
│   ├── error_code.yaml
│   ├── capability_registry.yaml
│   ├── legacy_mapping.yaml
│   └── mvp_profile.yaml
│
├── schema/
│   ├── common_fields.yaml
│   ├── control_schema.yaml
│   ├── device_schema.yaml
│   ├── capability_schema.yaml
│   ├── brightness_schema.yaml
│   ├── firmware_schema.yaml
│   ├── stream_schema.yaml
│   └── event_schema.yaml
│
├── generator.yaml
└── version.yaml
```

---

## 4. Generator 配置文件

### 4.1 generator.yaml

`generator.yaml` 用于描述生成目标、输出目录、语言选项和校验级别。

示例：

```yaml
generator:
  name: axtp-generator
  version: 1.0.0

input:
  registry_dir: registry
  schema_dir: schema

output:
  markdown_dir: generated/docs
  cpp_dir: generated/cpp
  json_dir: generated/json
  test_vector_dir: generated/test_vectors

cpp:
  namespace: axtp
  standard: c++17
  enum_class: true
  generate_structs: true
  generate_descriptors: true
  generate_tlv_helpers: true

validation:
  level: strict
  fail_on_duplicate_id: true
  fail_on_unknown_schema: true
  fail_on_missing_mvp_item: true
  allow_experimental: false
```

---

### 4.2 version.yaml

`version.yaml` 用于记录 registry 和 schema 的版本。

```yaml
spec:
  name: AXTP
  version: 1.0.0
  registry_version: 1.0.0
  schema_version: 1.0.0
  wire_version: 1
  status: mvp
```

其中：

| 字段 | 说明 |
|---|---|
| `version` | 文档整体版本 |
| `registry_version` | 注册表版本 |
| `schema_version` | schema 版本 |
| `wire_version` | 线上协议版本 |
| `status` | draft / mvp / stable |

---

## 5. Registry 输入规范

### 5.1 通用 Registry 条目结构

所有 registry 条目建议使用统一结构：

```yaml
- id: 0x0101
  name: device.getInfo
  domain: device
  title: Get device information
  description: Get basic device information.
  status: mvp
  since: 1.0.0
  deprecated: false
  request_schema: DeviceGetInfoRequest
  response_schema: DeviceGetInfoResponse
  errors:
    - 0x0000
    - 0x0301
  capabilities:
    - device.info
  legacy:
    cmd_value: null
    protocol: null
```

通用字段说明：

| 字段 | 必须 | 说明 |
|---|---|---|
| `id` | 是 | 注册 ID，methodId/eventId/errorCode/capabilityId |
| `name` | 是 | 稳定名称 |
| `domain` | 是 | 所属域 |
| `title` | 否 | 简短标题 |
| `description` | 是 | 描述 |
| `status` | 是 | draft / mvp / stable / deprecated / reserved |
| `since` | 是 | 引入版本 |
| `deprecated` | 是 | 是否废弃 |
| `legacy` | 否 | 老协议映射 |

`status = reserved` 的条目只生成 Markdown/JSON 描述，不生成默认 C++ enum 值、handler stub、SDK 调用入口或测试用例。Generator 必须在校验阶段阻止新实现引用 reserved 条目。

---

### 5.2 Method Registry 输入

文件：`registry/method_registry.yaml`

```yaml
methods:
  - id: 0x0101
    name: device.getInfo
    domain: device
    status: mvp
    rpc_op: request_response
    request_schema: DeviceGetInfoRequest
    response_schema: DeviceGetInfoResponse
    recommended_encoding:
      - json
      - binary_tlv
    capabilities:
      - device.info
    events: []
    errors:
      - SUCCESS
      - RPC_UNKNOWN_METHOD
      - RPC_INVALID_PARAMS
    legacy:
      cmd_value: 0xB0002
      name: BetaDeviceInfo
      payload_format: fixed_struct

  - id: 0x0602
    name: brightness.set
    domain: brightness
    status: mvp
    rpc_op: request_response
    request_schema: BrightnessSetRequest
    response_schema: CommonEmptyResponse
    recommended_encoding:
      - json
      - binary_tlv
    capabilities:
      - brightness.set
    events:
      - brightness.changed
    errors:
      - SUCCESS
      - RPC_INVALID_PARAMS
      - DEVICE_BUSY
```

---

### 5.3 Event Registry 输入

文件：`registry/event_registry.yaml`

```yaml
events:
  - id: 0x8601
    name: brightness.changed
    domain: brightness
    status: mvp
    event_schema: BrightnessChangedEvent
    severity: info
    trigger:
      - brightness.set
      - device_local_change
    capabilities:
      - brightness.event
```

---

### 5.4 ErrorCode Registry 输入

文件：`registry/error_code.yaml`

```yaml
errors:
  - id: 0x0000
    name: SUCCESS
    domain: common
    status: mvp
    description: Operation completed successfully.
    retryable: false

  - id: 0x0301
    name: RPC_UNKNOWN_METHOD
    domain: rpc
    status: mvp
    description: MethodId or method name is not supported.
    retryable: false

  - id: 0x0403
    name: STREAM_CRC_ERROR
    domain: stream
    status: mvp
    description: Stream chunk CRC check failed.
    retryable: true
```

---

### 5.5 Capability Registry 输入

文件：`registry/capability_registry.yaml`

```yaml
capabilities:
  - id: 0x0001
    name: protocol.payload.control
    domain: protocol
    status: mvp
    type: bool
    description: Device supports CONTROL payload.

  - id: 0x0602
    name: brightness.set
    domain: brightness
    status: mvp
    type: bool
    description: Device supports setting brightness.

  - id: 0x0B01
    name: firmware.ota
    domain: firmware
    status: mvp
    type: object
    schema: FirmwareOtaCapability
```

---

### 5.6 Legacy Mapping 输入

Legacy Mapping 是兼容 profile 的输入源，不属于默认 AXTP v1 runtime 的必选输入。除非 `generator.yaml` 显式启用 `compatibility.legacy = true`，Generator 不得生成 Legacy parser、Legacy Adapter runtime 或 Legacy SDK API。

文件：`registry/legacy_mapping.yaml`

```yaml
legacy_mappings:
  - legacy_protocol: axdp_hid
    legacy_cmd_value: 0xB0002
    legacy_name: BetaDeviceInfo
    axtp_method_id: 0x0101
    axtp_method_name: device.getInfo
    direction: request_response
    request_adapter: BetaDeviceInfoRequestAdapter
    response_adapter: BetaDeviceInfoResponseAdapter
    status_mapping:
      0x00: SUCCESS
      0x01: RPC_INVALID_PARAMS
      0x02: DEVICE_BUSY

  - legacy_protocol: axdp_hid
    legacy_cmd_value: 0xA0001
    legacy_name: AlphaUpgradeInfo
    axtp_method_id: 0x0B01
    axtp_method_name: firmware.getInfo
    direction: request_response
```

注意：

旧 `legacy_cmd_value` 可以是 32-bit 或更大，不要求塞进 AXTP `methodId:uint16`。Generator 必须保留它的原始宽度和十六进制文本。

---

## 6. Schema 输入规范

### 6.1 Schema 文件结构

Schema 文件用于描述 RPC body、Event data、Control TLV body、Stream Profile 建流上下文。

```yaml
schemas:
  DeviceGetInfoRequest:
    type: object
    fields: []

  DeviceGetInfoResponse:
    type: object
    fields:
      - id: 0x01
        name: vendor
        type: string
        required: false
        max_length: 32
      - id: 0x02
        name: product
        type: string
        required: false
        max_length: 32
      - id: 0x03
        name: firmwareVersion
        type: string
        required: false
        max_length: 32
      - id: 0x04
        name: serialNumber
        type: string
        required: false
        max_length: 64
```

---

### 6.2 字段描述结构

```yaml
- id: 0x01
  name: value
  type: uint8
  required: true
  min: 0
  max: 100
  default: null
  deprecated: false
  description: Brightness value in percentage.
```

字段说明：

| 字段 | 必须 | 说明 |
|---|---|---|
| `id` | 是 | TLV fieldId |
| `name` | 是 | 字段名 |
| `type` | 是 | AXTP Type System 类型 |
| `required` | 是 | 是否必填 |
| `min` / `max` | 否 | 数值范围 |
| `max_length` | 否 | string / bytes 最大长度 |
| `enum` | 否 | enum 类型引用 |
| `default` | 否 | 默认值 |
| `deprecated` | 是 | 是否废弃 |

---

### 6.3 MVP 必须支持的类型

Generator v1 必须支持：

```text
uint8
uint16
uint32
uint64
int8
int16
int32
int64
bool
enum
bitmap
string
bytes
object
array
```

Generator v1 可以暂缓支持：

```text
float32
float64
map
oneof
union
recursive object
```

---

## 7. 校验规则

Generator v1 必须在生成前执行严格校验。

### 7.1 ID 唯一性校验

必须校验：

```text
methodId 在 method_registry 中唯一
eventId 在 event_registry 中唯一
errorCode 在 error_code 中唯一
capabilityId 在 capability_registry 中唯一
同一 schema 内 fieldId 唯一
同一 schema 内 fieldName 唯一
```

冲突时必须失败。

---

### 7.2 ID 范围校验

必须校验：

```text
methodId 是否落在对应 domain 范围内
eventId 是否落在对应 domain 范围内
errorCode 是否落在对应错误层级范围内
capabilityId 是否落在对应 capability 分类范围内
fieldId 是否落在允许范围内
vendor id 是否落在 vendor range
```

---

### 7.3 Schema 引用校验

必须校验：

```text
method.request_schema 存在
method.response_schema 存在
event.event_schema 存在
capability.schema 存在
schema field enum 引用存在
schema field object 引用存在
```

---

### 7.4 MVP 完整性校验

当 `validation.fail_on_missing_mvp_item = true` 时，必须校验 13《AXTP MVP 最小实现注册表》中所有 P0 项均存在。

MVP 缺失示例：

```text
missing method: device.getInfo
missing method: capability.getAll
missing method: brightness.set
missing method: firmware.begin
missing event: brightness.changed
missing error: SUCCESS
missing capability: protocol.payload.rpc
```

---

### 7.5 Legacy Mapping 校验

必须校验：

```text
legacy_cmd_value 不重复，除非显式 allow_alias = true
legacy_cmd_value 对应的 axtp_method_id 存在
legacy status_mapping 目标 errorCode 存在
legacy adapter 名称符合命名规则
```

---

### 7.6 兼容性校验

当 registry 从旧版本升级到新版本时，Generator 应支持兼容性检查。

禁止行为：

```text
修改 stable methodId 的语义
修改 stable eventId 的语义
复用 deprecated ID
删除 stable 字段但不标记 deprecated
改变字段类型但不升级 schema major version
```

允许行为：

```text
新增 optional 字段
新增 draft/mvp 方法
新增 errorCode
新增 capability
新增 event
将 draft 提升为 mvp/stable
```

---

## 8. 输出目录结构

Generator v1 推荐输出：

```text
generated/
├── cpp/
│   ├── axtp_ids_generated.h
│   ├── axtp_schema_generated.h
│   ├── axtp_method_registry_generated.h
│   ├── axtp_event_registry_generated.h
│   ├── axtp_error_code_generated.h
│   ├── axtp_capability_generated.h
│   ├── axtp_legacy_mapping_generated.h
│   └── axtp_tlv_codec_generated.h
│
├── docs/
│   ├── method_registry.generated.md
│   ├── event_registry.generated.md
│   ├── error_code.generated.md
│   ├── capability_registry.generated.md
│   └── legacy_mapping.generated.md
│
├── json/
│   ├── method_registry.generated.json
│   ├── event_registry.generated.json
│   ├── error_code.generated.json
│   ├── capability_registry.generated.json
│   ├── schema.generated.json
│   └── legacy_mapping.generated.json
│
└── test_vectors/
    ├── control_open.hex
    ├── rpc_device_get_info.hex
    ├── rpc_brightness_set.hex
    ├── event_brightness_changed.hex
    ├── stream_ota_chunk.hex
    └── manifest.json
```

---

## 9. C++ 输出规范

### 9.1 axtp_ids_generated.h

示例：

```cpp
#pragma once
#include <cstdint>

namespace axtp {

// PayloadType
constexpr uint8_t PAYLOAD_TYPE_CONTROL = 0x01;
constexpr uint8_t PAYLOAD_TYPE_RPC     = 0x02;
constexpr uint8_t PAYLOAD_TYPE_STREAM  = 0x03;

// MethodId
enum class MethodId : uint16_t {
    DeviceGetInfo      = 0x0101,
    CapabilityGetAll   = 0x0301,
    BrightnessGet      = 0x0601,
    BrightnessSet      = 0x0602,
    FirmwareBegin      = 0x0B02,
    FirmwareEnd        = 0x0B03,
    FirmwareVerify     = 0x0B04,
    FirmwareApply      = 0x0B05,
};

// EventId
enum class EventId : uint16_t {
    BrightnessChanged       = 0x8601,
    FirmwareUpdateProgress  = 0x8B02,
    FirmwareUpdateCompleted = 0x8B03,
    FirmwareUpdateFailed    = 0x8B04,
};

// ErrorCode
enum class ErrorCode : uint16_t {
    Success          = 0x0000,
    InvalidFrame     = 0x0101,
    CrcError         = 0x0102,
    UnknownMethod    = 0x0301,
    InvalidParams    = 0x0302,
    StreamCrcError   = 0x0403,
    DeviceBusy       = 0x0501,
};

} // namespace axtp
```

---

### 9.2 axtp_schema_generated.h

Generator v1 应生成轻量 descriptor，而不是复杂反射系统。

```cpp
#pragma once
#include <cstdint>
#include <cstddef>

namespace axtp {

enum class FieldType : uint8_t {
    Uint8,
    Uint16,
    Uint32,
    Uint64,
    Bool,
    String,
    Bytes,
    Object,
};

struct FieldDescriptor {
    uint8_t field_id;
    const char* name;
    FieldType type;
    bool required;
    uint32_t min_value;
    uint32_t max_value;
};

struct SchemaDescriptor {
    const char* name;
    const FieldDescriptor* fields;
    size_t field_count;
};

extern const SchemaDescriptor kBrightnessSetRequestSchema;
extern const SchemaDescriptor kDeviceGetInfoResponseSchema;

} // namespace axtp
```

---

### 9.3 axtp_method_registry_generated.h

```cpp
#pragma once
#include <cstdint>

namespace axtp {

struct MethodDescriptor {
    uint16_t id;
    const char* name;
    const char* domain;
    const char* request_schema;
    const char* response_schema;
};

const MethodDescriptor* FindMethodById(uint16_t id);
const MethodDescriptor* FindMethodByName(const char* name);

} // namespace axtp
```

---

### 9.4 axtp_legacy_mapping_generated.h

```cpp
#pragma once
#include <cstdint>

namespace axtp {

struct LegacyCmdMapping {
    const char* legacy_protocol;
    uint32_t legacy_cmd_value;
    uint16_t axtp_method_id;
    const char* axtp_method_name;
};

const LegacyCmdMapping* FindLegacyMappingByCmd(uint32_t cmd_value);

} // namespace axtp
```

---

## 10. TLV 编解码辅助生成

Generator v1 可生成两类 TLV 辅助代码。

### 10.1 Field 常量

```cpp
namespace axtp::fields::brightness_set {
constexpr uint8_t VALUE = 0x01;
constexpr uint8_t TRANSITION_MS = 0x02;
}
```

### 10.2 Struct Skeleton

```cpp
struct BrightnessSetRequest {
    uint8_t value = 0;
    uint16_t transition_ms = 0;
    bool has_transition_ms = false;
};
```

### 10.3 Encode / Decode 函数声明

Generator v1 可以只生成声明和简单实现。

```cpp
bool EncodeBrightnessSetRequest(
    const BrightnessSetRequest& input,
    TlvWriter& writer,
    ErrorCode* error);

bool DecodeBrightnessSetRequest(
    TlvReader& reader,
    BrightnessSetRequest* output,
    ErrorCode* error);
```

---

## 11. Markdown 输出规范

Generator v1 生成的 Markdown 表格必须包含：

```text
ID
Name
Domain
Status
Schema
Capability
Error
Legacy Mapping
Description
```

Method 表示例：

| methodId | name | domain | status | request | response | legacy |
|---:|---|---|---|---|---|---|
| `0x0101` | `device.getInfo` | device | mvp | DeviceGetInfoRequest | DeviceGetInfoResponse | `0xB0002` |
| `0x0602` | `brightness.set` | brightness | mvp | BrightnessSetRequest | CommonEmptyResponse | - |

---

## 12. JSON 输出规范

Generator v1 应输出机器可读 JSON，供测试工具、Web Demo、脚本使用。

示例：

```json
{
  "methods": [
    {
      "id": 257,
      "idHex": "0x0101",
      "name": "device.getInfo",
      "domain": "device",
      "status": "mvp",
      "requestSchema": "DeviceGetInfoRequest",
      "responseSchema": "DeviceGetInfoResponse"
    }
  ]
}
```

---

## 13. 测试向量生成规范

Generator v1 应至少生成以下测试向量 manifest。

```json
{
  "vectors": [
    {
      "name": "rpc_brightness_set_request",
      "payloadType": "RPC",
      "methodId": "0x0602",
      "encoding": "binary_tlv",
      "hexFile": "rpc_brightness_set.hex",
      "expectDecode": {
        "value": 80
      }
    }
  ]
}
```

测试向量分为三类：

```text
valid vectors      必须成功解析
invalid vectors    必须失败并返回指定 errorCode
compat vectors     老协议输入必须映射到 AXTP 语义
```

invalid vectors 至少必须覆盖：

```text
Standard CRC16 mismatch
Compact CRC8 mismatch
Compact MessageId overflow (> 0xFF)
Compact PayloadLength overflow (> 0xFF)
STREAM data exceeds Compact limit (> 239B)
```

---

## 14. CLI 设计

Generator v1 推荐提供命令行工具：

```bash
pnpm --dir standard/generator axtp-gen validate --spec ./standard
pnpm --dir standard/generator axtp-gen generate --spec ./standard --out ./standard/out/generated
pnpm --dir standard/generator axtp-gen diff --old ./spec-v1 --new ./spec-v2
pnpm --dir standard/generator axtp-gen doc --spec ./standard --out ./standard/out/generated/docs
pnpm --dir standard/generator axtp-gen test-vector --spec ./standard --out ./standard/out/generated/test_vectors
```

### 14.1 validate

执行所有 registry/schema 校验。

输出示例：

```text
[OK] method_registry.yaml: 18 methods checked
[OK] event_registry.yaml: 9 events checked
[OK] schema: 24 schemas checked
[ERROR] duplicate methodId 0x0602: brightness.set / display.setBrightness
```

### 14.2 generate

生成 C++、JSON、Markdown 和测试向量。

### 14.3 diff

比较两个版本的 registry/schema，识别 breaking change。

### 14.4 doc

只生成 Markdown。

### 14.5 test-vector

只生成测试向量。

---

## 15. Generator v1 内部模块建议

```text
standard/generator/
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── src/
    ├── cli.ts
    ├── loader.ts
    ├── models.ts
    ├── validator.ts
    ├── errors.ts
    ├── util.ts
    └── emitters/
        ├── cpp.ts
        ├── markdown.ts
        ├── json.ts
        ├── testVectors.ts
        └── index.ts
```

Generator v1 使用 TypeScript + Node.js 实现，原因：

```text
团队调试和维护成本低
YAML/JSON 处理成熟
便于与 Web Demo、文档工具和 CI 集成
类型系统足以约束 registry/schema 中间模型
不进入设备端运行时
```

---

## 16. 错误报告格式

Generator 错误必须可定位到文件、条目和字段。

```text
ERROR AXTP-GEN-1002
file: registry/method_registry.yaml
entry: brightness.set
field: id
message: duplicate methodId 0x0602, already used by display.setBrightness
```

错误码建议：

| Generator Error | 说明 |
|---|---|
| `AXTP-GEN-1001` | YAML parse failed |
| `AXTP-GEN-1002` | duplicate ID |
| `AXTP-GEN-1003` | ID out of range |
| `AXTP-GEN-1004` | missing schema |
| `AXTP-GEN-1005` | invalid type |
| `AXTP-GEN-1006` | missing MVP item |
| `AXTP-GEN-1007` | incompatible change |
| `AXTP-GEN-1008` | invalid legacy mapping |

---

## 17. CI 集成要求

在 AXTP 仓库中，CI 至少执行：

```bash
pnpm --dir standard/generator axtp-gen validate --spec ./standard
pnpm --dir standard/generator axtp-gen generate --spec ./standard --out ./standard/out/generated
cmake -S cpp-demo -B build
cmake --build build
ctest --test-dir build
```

CI 必须阻止：

```text
重复 ID
缺失 MVP 项
schema 引用不存在
stable ID 破坏兼容
生成文件未提交或未同步
C++ Demo 无法编译
测试向量无法解析
```

---

## 18. 与 C++ Demo 的边界

Generator 负责：

```text
ID 常量
Schema descriptor
Method/Event/Error/Capability 描述表
Legacy mapping 表
TLV encode/decode skeleton
测试向量
```

C++ Demo 负责：

```text
Frame 编解码
Control Parser
RPC Parser
Stream Parser
Session Runtime
ACK/NACK
Transport Mock
业务 Handler
OTA 测试流程
```

Generator 不应生成复杂运行时，以避免早期架构过度膨胀。

---

## 19. MVP 输出清单

Generator v1 MVP 必须输出：

```text
axtp_ids_generated.h
axtp_schema_generated.h
axtp_method_registry_generated.h
axtp_event_registry_generated.h
axtp_error_code_generated.h
axtp_capability_generated.h
axtp_legacy_mapping_generated.h
method_registry.generated.md
event_registry.generated.md
error_code.generated.md
capability_registry.generated.md
legacy_mapping.generated.md
schema.generated.json
manifest.json
至少 5 个 test vector
```

至少 5 个测试向量：

```text
CONTROL OPEN
RPC device.getInfo request
RPC brightness.set request
EVENT brightness.changed
STREAM OTA chunk
Compact CRC8 error
Compact MessageId overflow
```

---

## 20. P0 / P1 / P2 实现阶段

### 20.1 P0：必须实现

```text
YAML 加载
Registry 校验
Schema 校验
MVP 完整性校验
C++ enum 生成
C++ descriptor 生成
Markdown 表格生成
JSON registry 生成
基础测试向量生成
Legacy mapping 表生成
```

### 20.2 P1：建议实现

```text
TLV encode/decode 代码生成
C++ struct skeleton 生成
schema diff
兼容性检查
更多 invalid test vectors
Web Demo JSON registry 输出
```

### 20.3 P2：后续实现

```text
完整 SDK Stub 生成
TypeScript / Rust / Python 输出
IDL 导入导出
多版本 registry merge
图形化 registry viewer
```

---

## 21. 验收标准

Generator v1 视为完成，必须满足：

```text
1. 能读取 registry/*.yaml 和 schema/*.yaml
2. 能发现重复 methodId / eventId / errorCode / capabilityId
3. 能发现缺失 schema 引用
4. 能校验 MVP 必须项
5. 能生成 C++ enum 和 descriptor
6. 能生成 Markdown 注册表
7. 能生成 JSON registry
8. 能生成 legacy mapping 表
9. 能生成基础测试向量
10. 生成产物能被 21《AXTP Cpp Demo 实现规范》引用并完成编译
```

---

## 22. 总结

AXTP Generator v1 是协议工程化落地的关键环节。

它的核心职责不是“自动生成所有代码”，而是确保：

```text
协议注册表可校验
业务 ID 不冲突
schema 可追踪
老协议映射可维护
Markdown 文档不漂移
C++ Demo 可以稳定编译
测试向量可以持续回归
```

最终目标是把 AXTP 从一组 Markdown 设计文档，推进为可验证、可生成、可迁移、可运行的协议工程体系。
