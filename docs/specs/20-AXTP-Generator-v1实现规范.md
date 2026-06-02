# 20《AXTP Generator v1 实现规范》

版本：v1.1
状态：当前实现规范 + 后续规划
适用范围：AXTP Source YAML、Protocol IR、生成协议文档、机器可读 JSON、Registry 产物、后续 runtime/codegen 集成

关联文档：

- 00《AXTP Overview》
- 04《AXTP Control Session Spec》
- 05《AXTP RPC Session Spec》
- 06《AXTP Stream Spec》
- 07《AXTP Compatibility and Versioning》
- 08《AXTP Protocol Definition Mapping Spec》
- 09《AXTP Methods Registry Spec》
- 10《AXTP Events Registry Spec》
- 11《AXTP Errors Registry Spec》
- 12《AXTP Types and Capability Spec》
- 13《AXTP Profiles Registry Spec》
- 14《AXTP Type System》
- 15《AXTP TLV Schema Encoding》
- 16《AXTP Schema Field Numbering》

---

## 1. 文档目的

本文定义 AXTP Generator v1 的当前实现规则和后续演进方向。

Generator v1 的核心定位已经从早期的“Registry 表格生成器”升级为“Protocol Definition 文档编译器”。它以 `registry/**/*.yaml` 和 `registry/domains/**/*.yaml` 为机器事实源，生成 `protocol/axtp.protocol.yaml` 作为聚合后的 Protocol IR，再由 Protocol IR 生成面向用户阅读的协议文档和面向工具消费的 JSON。

当前主流程：

```text
registry/**/*.yaml + registry/domains/**/*.yaml
        ↓ validate-sources
Source Model
        ↓ build-protocol
protocol/axtp.protocol.yaml          # generated Protocol IR
        ↓ emit-protocol
docs/generated/protocol.md           # user-facing protocol reference
docs/generated/protocol.json         # normalized machine model
```

Registry/C++/test-vector 生成器仍保留，但必须使用同一份 Source Model：

```text
registry/**/*.yaml + registry/domains/**/*.yaml
        ↓ generate-registry
docs/generated/*_registry.generated.md
tooling/mcp/*.generated.json
runtimes/cpp-core/include/axtp/generated/*
tooling/test-vectors/*
```

---

## 2. 核心原则

### 2.1 Source YAML 是事实源

以下目录是协议业务事实源：

```text
registry/**/*.yaml
registry/domains/**/*.yaml
```

以下文件和目录是生成产物，不得手写：

```text
protocol/axtp.protocol.yaml
docs/generated/*
runtimes/*/generated/*
tooling/* generated artifacts
generators/src/__snapshots__/*
```

`protocol/axtp.protocol.yaml` 只是聚合 IR，不是人工编辑入口。新增业务默认写入 `registry/domains/<domain>/domain.yaml`；只有核心常量、公共 schema、MVP/Core 已采纳条目和 legacy 映射才写入对应 `registry/` 源文件。

同一个 method/event/type/error/capability/profile 不得同时在 core registry 与 domain YAML 中重复定义。Generator 必须把两类 source 逻辑合并为一个 Source Model，并在重复 name、ID 或 bit_offset 时失败。

### 2.2 三段式编译

Generator v1 必须维持三段式边界：

| 阶段 | 输入 | 输出 | 责任 |
| ---- | ---- | ---- | ---- |
| 业务录入段 | 规范、规划材料、用户业务需求 | `registry/**/*.yaml` / `registry/domains/**/*.yaml` | 固化 ID、schema、error、event、capability、profile |
| Protocol IR 段 | Source YAML | `protocol/axtp.protocol.yaml` | 聚合、标准化、关键事实校验 |
| 成果物段 | Protocol IR | `docs/generated/protocol.md` / `protocol.json` 等 | 面向用户和工具输出稳定产物 |

### 2.3 Generator 不实现运行时

Generator 只生成描述性产物、文档和轻量 codegen 输入。它不实现：

```text
transport connection
session runtime
ACK/NACK scheduling
business handler
device driver calls
OTA state machine
media encoder/decoder
```

这些属于 SDK runtime、demo runtime 或设备业务实现。

### 2.4 Wire 事实必须由 00-spec 兜底校验

`protocol/axtp.protocol.yaml` 的结构化内容来自 Source YAML，但关键 wire 事实必须与 `docs/specs/00-16` 保持一致。当前必须校验：

```text
STREAM header = 16B
STREAM fields = streamId:uint32, seqId:uint32, cursor:uint64
CONTROL OPEN/ACCEPT required
CONTROL READY optional, not required
capability.supportedMethods.methodMasks derivedFrom = methods[].bitOffset
```

---

## 3. 当前目录结构

```text
axtp/
├── registry/
│   ├── core/
│   │   ├── protocol_meta.yaml
│   │   ├── payload_type.yaml
│   │   ├── control_opcode.yaml
│   │   ├── rpc_encoding.yaml
│   │   ├── rpc_body_encoding.yaml
│   │   ├── rpc_op.yaml
│   │   └── stream_profile.yaml
│   ├── method/method_registry.yaml
│   ├── event/event_registry.yaml
│   ├── error/error_code.yaml
│   ├── capability/
│   │   ├── capability_registry.yaml
│   │   └── mvp_profile.yaml
│   ├── schema/*.yaml
│   ├── legacy/legacy_mapping.yaml
│   ├── domains/
│   │   └── <domain>/domain.yaml
│   └── vendor/                 # reserved, not enabled in v1 P0
├── protocol/
│   └── axtp.protocol.yaml
├── docs/
│   ├── specs/
│   ├── source/
│   └── generated/
├── generators/
│   ├── generator.yaml
│   ├── package.json
│   └── src/
├── runtimes/
└── tooling/
```

目录职责审查：

| 路径 | 当前作用 | 是否可手写 |
| ---- | ---- | ---- |
| `registry/core/` | 协议元信息、核心枚举、传输/帧/profile 事实源 | 是 |
| `registry/method|event|error|capability|schema|legacy/` | 已采纳核心/MVP/共享事实源 | 是 |
| `registry/domains/<domain>/domain.yaml` | 新增业务域事实源，包含 method/event/type/error/capability/profile | 是 |
| `registry/vendor/` | P1 vendor extension 预留目录，当前不参与生成 | 否 |
| `protocol/axtp.protocol.yaml` | Generator 生成的聚合 Protocol IR | 否 |
| `docs/generated/` | Generator 生成的文档产物 | 否 |
| `tooling/mcp/` | Generator 生成的 MCP JSON 产物 | 否 |
| `runtimes/*/generated/` | Generator 生成的 runtime/codegen 产物 | 否 |
| `tooling/test-vectors/` | Generator 生成的测试向量 | 否 |

顶层 `domains/` 与 `registry/domain/` 已废弃；若顶层 `domains/**/*.yaml` 存在，`validate-sources` 必须失败并提示迁移到 `registry/domains/`。

---

## 4. Source YAML 模型

### 4.1 Core Registry

`registry/core/protocol_meta.yaml` 承载非业务协议元信息：

```text
protocol
overview
architecture
guide
frameProfiles
transports
payloadTypes
control
stream
compatibility
```

`registry/core/*.yaml` 还承载核心枚举和常量：

```text
payload_type.yaml
control_opcode.yaml
rpc_encoding.yaml
rpc_body_encoding.yaml
rpc_op.yaml
stream_profile.yaml
```

### 4.2 Adopted Registry

已采纳的 MVP/Core 条目继续放在 `registry/`：

```text
registry/method/method_registry.yaml
registry/event/event_registry.yaml
registry/error/error_code.yaml
registry/capability/capability_registry.yaml
registry/schema/*.yaml
registry/legacy/legacy_mapping.yaml
```

这些文件适合放稳定基础能力，例如：

```text
device.getInfo
capability.supportedMethods
display.getBrightness
display.setBrightness
firmware.begin/end/verify/apply
CONTROL / RPC / STREAM shared schemas
```

这些文件表示“核心公共事实”，不是所有新增业务的默认落点。只有当一个 domain 业务被治理为 Core/MVP 稳定能力时，才从 `registry/domains/<domain>/domain.yaml` 晋升到这里。晋升必须保持原有 methodId/eventId/errorCode/fieldId/bit_offset 不变，并从 domain YAML 删除对应条目，避免双事实源。

### 4.3 Domain YAML

新增业务优先写入：

```text
registry/domains/<domain>/domain.yaml
```

Domain YAML 表示“业务域事实”。它同样会进入最终 `protocol/axtp.protocol.yaml`、`docs/generated/protocol.md`、MCP JSON、C++ headers 和 test vectors；区别只在治理层级，不在协议有效性。放在 domain YAML 中的 draft 或可选 profile 能力仍然是正式机器事实源，只是不自动成为 v1 Core/MVP 必选项。

例如 `stream.open` 当前属于 `stream` domain 的 HID media profile 业务事实，应放在 `registry/domains/stream/domain.yaml`。如果未来它被定义为所有 AXTP v1 Core 实现必须支持的建流方法，再按晋升流程迁入 `registry/method/`、`registry/schema/`、`registry/capability/` 等核心文件。

Generator v1 必须接受已治理的业务域词表，包括 `input`、`output`、`room` 和 `signage`。`output` 与 `input` 成对表达信号边界，`room` 使用单数形式，`signage` 专用于数字标牌业务。未在词表中的新 domain 必须先补充 Domain Registry 和 ID 分配，再进入 domain YAML。

推荐结构：

```yaml
domain: stream
description: STREAM control-plane methods and events.

methods:
  - id: 0x0501
    name: stream.open
    domain: stream
    status: draft
    bit_offset: 0
    since: 1.0.0
    description: Open an AXTP STREAM media channel.
    rpc_op: request_response
    request_schema: StreamOpenRequest
    response_schema: StreamOpenResponse
    recommended_encoding: [json, binary_tlv]
    capabilities: [stream.hidMedia]
    events: [stream.opened, stream.error]
    errors: [SUCCESS, RPC_PARAM_INVALID, BUSY]

events:
  - id: 0x0501
    name: stream.opened
    domain: stream
    status: draft
    bit_offset: 0
    since: 1.0.0
    description: Emitted after a stream is opened.
    event_schema: StreamOpenedEvent
    severity: info
    trigger: [stream.open]
    capabilities: [stream.hidMedia]

types:
  StreamOpenRequest:
    kind: object
    fields:
      - id: 0x01
        name: profile
        type: string
        required: true
        max_length: 32
        description: Stream Profile name.

errors:
  - id: 0x0801
    name: MEDIA_SOURCE_NOT_FOUND
    domain: media
    status: draft
    description: Requested media source does not exist.
    retryable: false

capabilities:
  - id: 0x050A
    name: stream.hidMedia
    domain: stream
    status: draft
    type: object
    schema: StreamHidMediaCapability
    description: Device supports HID-backed media streams.

profiles:
  - name: AXTP-HID-MEDIA
    since: 1.0.0
    status: draft
    extends: AXTP-MVP-HID
    requiredMethods: [stream.open]
    requiredEvents: [stream.opened]
    requiredErrors: [SUCCESS, RPC_PARAM_INVALID]
    requiredTypes: [StreamOpenRequest, StreamOpenResponse]
    transportProfiles: [AXTP-USB-HID]
    frameProfile: STANDARD_FRAME
```

### 4.4 Field 规则

字段必须稳定：

| 字段 | 规则 |
| ---- | ---- |
| `id` | 1 byte fieldId，范围 `0x01-0xFF` |
| `name` | schema 内唯一 |
| `type` | 必须是内建类型或已定义 type |
| `required` | 必填字段为 `true`，可选字段为 `false` |
| `min/max/max_length` | 进入生成文档的 Value Restrictions |
| `description` | 进入生成文档的字段说明 |

---

## 5. Protocol IR

`protocol/axtp.protocol.yaml` 是 build 阶段生成的聚合 IR。它的职责是把 registry/domain 多源 YAML 统一为单一 Protocol Definition：

```text
protocol
overview
architecture
frameProfiles
transports
payloadTypes
control
stream
compatibility
types
methods
events
errors
profiles
```

IR 规则：

- `methods[].id` 转为 `methods[].methodId`。
- `events[].id` 转为 `events[].eventId`。
- `bit_offset` 转为 `bitOffset`。
- 空 request/response schema 必须标准化为 `Empty`。
- `status=mvp` 在 Protocol IR 中可映射为 `stable`。
- 默认 `AXTP-MVP` 和 `AXTP-MVP-HID` profiles 必须保留；domain profiles 追加，不得覆盖默认 profiles。
- 禁止 `bitmapId`、`requests`、`requiredRequests` 等旧 capability model 字段进入 IR。

---

## 6. 生成文档规则

`docs/generated/protocol.md` 面向 SDK 使用者和业务接入者，不承担低层 frame/transport/payload 规范全文复制职责。低层细节留在 `docs/specs/00-16`。

### 6.1 文档结构

当前 Markdown 输出结构固定为：

```text
# AXTP Protocol
## Main Table of Contents
## Implemented Domains
## Overview
## Design Goals / Non-Goals
## Connection Lifecycle
## Capability Discovery
## Protocol Framework
## Supported Connection Profiles
# Methods
## <domain> Methods
### Methods in this domain
---
### <domain.method>
#### Request Fields
#### Response Fields
# Events
## <domain> Events
### Events in this domain
---
### <domain.event>
#### Payload Fields
# Additional Types
# Errors Reference
# Profiles Reference
```

顶部 `Main Table of Contents` 只列到 domain 入口，不展开所有 method/event 条目。每个 domain 内部必须先输出本 domain 的局部目录，例如 `Methods in this domain` 或 `Events in this domain`。

`Implemented Domains` 必须展示当前已有 method 定义的全部 domain，并列出 method/event 数量。

不再输出独立低层章节：

```text
Frame Profiles
Payload Types
Control Rules
Stream Transfer Model
Types Reference
```

这些数据仍保留在 `protocol.json` 中供机器消费。

### 6.2 Methods 渲染

每个 method 使用以下结构：

```markdown
---

### firmware.begin

Begin a firmware OTA transfer and allocate the STREAM context.

- Method ID: `0x0402`
- Domain: `firmware`
- Bit Offset: `0`
- Status: `stable`
- Added in v1.0.0
- Encodings: `json`, `binary_tlv`
- Required Capabilities: `firmware.ota`
- Possible Events: `firmware.updateProgress`
- Possible Errors: `SUCCESS`, `RPC_PARAM_INVALID`, `BUSY`

#### Request Fields

Type: `FirmwareBeginRequest`

| Name | Type | Field ID | Description | Value Restrictions | ?Default Behavior |
| ---- | :---: | :---: | ---- | :---: | ---- |
```

文档标题层级必须保证字号从大到小依次为：domain、method、fields：

```text
# Methods
## domain Methods
---
### concrete.method
#### Request/Response Fields
```

每个 method/event block 必须以横线分隔。横线既是前一 block 的结束，也是后一 block 的开始，读者应能一眼看出某个方法的标题、metadata、request fields 和 response fields 属于同一个整体。

### 6.3 字段表样式

字段表采用 obs-websocket 风格的 Markdown table：

| 列 | 说明 |
| ---- | ---- |
| `Name` | 字段名；可选字段以 `?` 前缀显示 |
| `Type` | 规范化类型名，例如 `UInt16`、`String`、`Boolean` |
| `Field ID` | TLV fieldId，十六进制 |
| `Description` | 字段说明 |
| `Value Restrictions` | `min/max/maxLength/derivedFrom/deprecated` |
| `?Default Behavior` | 必填为 `N/A`，可选为 `Omit if not used.` |

字段表必须输出为 Markdown table，并使用居中 alignment 标记增强可读性：

```markdown
| Name | Type | Field ID | Description | Value Restrictions | ?Default Behavior |
| ---- | :---: | :---: | ---- | :---: | ---- |
```

Generator 不使用 HTML 和 inline style。表格边框由 Markdown 渲染器主题负责；生成器只保证语义结构和标题层级稳定。

### 6.4 Additional Types

凡未被 method request/response 或 event payload 直接引用，但存在于 Protocol IR 中的 type，放入 `Additional Types`。这避免丢失 capability、control body 等辅助 schema。

### 6.5 protocol.json

`docs/generated/protocol.json` 必须保持完整 normalized model，包括：

```text
frameProfiles
transports
payloadTypes
control
stream
compatibility
types
methods
events
errors
profiles
```

Markdown 为阅读优化，JSON 为 codegen、测试工具和后续 MCP/SDK 使用。

---

## 7. 校验规则

### 7.1 Source Model 校验

`validate-sources` 必须执行：

```text
methodId/name 全局唯一
eventId/name 全局唯一
errorCode/name 全局唯一
capabilityId/name 全局唯一
schema name 唯一
schema 内 fieldId/name 唯一
method bit_offset 在同 domain 内唯一且从 0 连续
event bit_offset 在同 domain 内唯一且从 0 连续
method request_schema/response_schema 必须存在
event event_schema 必须存在
capability schema 必须存在
schema field.schema 引用必须存在
reserved capability/event/error 不得被 method 引用
MVP profile 引用的 method/event/error/capability 必须存在
legacy mapping 目标 method/error 必须存在
```

### 7.2 Protocol IR 校验

`validate-protocol` 必须执行：

```text
method name/methodId 唯一
event name/eventId 唯一
error name/code 唯一
type name 唯一
transport/profile name 唯一
method/event domain 必须匹配 name 前缀
eventId 必须按 domain 分段分配
eventId high byte 必须与同 domain methodId high byte 对齐
method/event bitOffset 在同 domain 内唯一且从 0 连续
method description 必须存在
method request/response type 必须存在
event payload type 必须存在
method 引用的 event/error 必须存在
profile 引用的 method/event/error/type/transport 必须存在
error category 必须符合 code range
Empty request/response 必须使用 Empty
STREAM header 必须为 streamId:uint32 / seqId:uint32 / cursor:uint64
CONTROL OPEN/ACCEPT 必须 required，READY 必须 optional
CapabilitySupportedMethodsResponse.methodMasks derivedFrom 必须为 methods[].bitOffset
```

### 7.3 Docs Consistency 校验

Generator 必须读取关键 00-spec 文档并校验核心 wire 事实：

```text
docs/specs/06-AXTP-Stream-Spec.md:
  16B Stream Header
  streamId:uint32
  seqId:uint32
  cursor:uint64

docs/specs/04-AXTP-Control-Session-Spec.md:
  OPEN/ACCEPT required
  READY optional

docs/specs/12-AXTP-Types-and-Capability-Spec.md:
  method bitmap derived from methods[].bitOffset
```

---

## 8. CLI 规范

当前 CLI：

```bash
cd generators
npm run build
npm test
node dist/cli.js validate --spec ..
node dist/cli.js validate-sources --spec ..
node dist/cli.js build-protocol --spec .. --out ../protocol/axtp.protocol.yaml
node dist/cli.js validate-protocol --spec ..
node dist/cli.js emit-protocol --spec .. --out ../docs/generated
node dist/cli.js generate --spec ..
node dist/cli.js generate-registry --spec ..
```

命令职责：

| 命令 | 责任 |
| ---- | ---- |
| `validate` | 校验 `registry/` + `registry/domains/` Source Model |
| `generate-registry` | 从 Source Model 输出 registry Markdown/JSON/C++/test vectors |
| `validate-sources` | 校验 Source Model，并验证可构造合法 Protocol IR |
| `build-protocol` | 从 Source YAML 写出 `protocol/axtp.protocol.yaml` |
| `validate-protocol` | 校验现有 Protocol IR 和 00-spec 关键事实一致性 |
| `emit-protocol` | 从 Protocol IR 输出 `docs/generated/protocol.md/json` |
| `generate` | 三段式组合命令：validate sources -> build Protocol IR -> validate Protocol IR -> emit all generated artifacts |
| `generate-protocol` | 旧兼容命令，直接从 Protocol IR 输出协议文档 |
| `doc` | 兼容命令，从 Source Model 生成 registry Markdown |
| `test-vector` | 兼容命令，从 Source Model 生成 test vectors |
| `diff` | P1 placeholder，当前未实现 |

---

## 9. 新增业务流程

新增业务必须先执行证据链分析，再写 YAML。

推荐流程：

```text
1. 读取 docs/specs/08-13 和 docs/source/09-13
2. 确认 domain、ID range、method/event/error/capability 候选
   - 迁移类业务先参考 `docs/migration/AXTP_Legacy_Migration_Matrix.xlsx` 的 `93_Feature分类参考` 和对应聚合视图，确认 `domain.feature` 边界
3. 检查 registry/**/*.yaml 和 registry/domains/**/*.yaml 是否已有等价条目
4. 默认写入 registry/domains/<domain>/domain.yaml；只有 Core/MVP 晋升或共享基础事实才写入 registry/
5. 填写 method/event/type/error/capability/profile 表单
6. 运行 validate-sources
7. 运行 build-protocol
8. 运行 emit-protocol
9. 检查 generated protocol 文档是否易读
10. 更新或新增测试
```

约束：

- 不得直接编辑 `protocol/axtp.protocol.yaml`。
- 不得直接编辑 `docs/generated/protocol.md/json`。
- 不得在 core registry 与 domain YAML 中重复定义同一协议事实。
- 不得复用 stable/deprecated wire value 表示新语义。
- 新增 method/event 必须显式填写 `bit_offset`。
- Stream/OTA 校验字段优先使用 `verifyType` / `verifyValue`。
- Stream Profile 不进入 STREAM header；由 RPC 建流绑定到 `streamId`。

---

## 10. Generator 内部模块

当前 TypeScript 模块：

```text
generators/src/
├── cli.ts
├── loader.ts                    # fixed registry file loader used by sourceLoader
├── sourceLoader.ts              # canonical registry + registry/domains loader
├── sourceModel.ts
├── protocolBuilder.ts           # Source Model -> Protocol IR
├── protocolLoader.ts            # Protocol IR loader
├── protocolModel.ts
├── protocolValidator.ts
├── protocolDocsValidator.ts
├── validator.ts                 # old registry/source validation
├── errors.ts
├── util.ts
└── emitters/
    ├── protocolMarkdown.ts
    ├── protocolJson.ts
    ├── markdown.ts
    ├── json.ts
    ├── cpp.ts
    ├── testVectors.ts
    └── index.ts
```

边界：

| 模块 | 边界 |
| ---- | ---- |
| `loader.ts` | 读取 `registry/` 固定核心文件，作为 sourceLoader 的基础层 |
| `sourceLoader.ts` | 读取 `registry/` 并合并 `registry/domains/**/*.yaml`；拒绝顶层 `domains/**/*.yaml` |
| `protocolBuilder.ts` | 生成 Protocol IR raw object 和 YAML |
| `protocolLoader.ts` | 加载现有 Protocol IR |
| `protocolValidator.ts` | 校验 Protocol IR 自洽性 |
| `protocolDocsValidator.ts` | 校验 IR 与 00-spec 关键事实一致 |
| `protocolMarkdown.ts` | 生成用户参考文档 |
| `protocolJson.ts` | 生成完整 normalized JSON |

---

## 11. 测试要求

当前必须维持：

```bash
cd generators
npm run build
npm test
node dist/cli.js validate --spec ..
node dist/cli.js validate-sources --spec ..
node dist/cli.js build-protocol --spec .. --out ../protocol/axtp.protocol.yaml
node dist/cli.js validate-protocol --spec ..
node dist/cli.js emit-protocol --spec .. --out ../docs/generated
git diff --check
```

测试覆盖：

```text
current registry/schema validation
Protocol IR validation
Source Model -> Protocol IR build
docs consistency validation
protocol.generated.json snapshot
protocol.generated.md snapshot
duplicate method/event ID rejection
non-contiguous bit_offset rejection
missing type/error/event/profile references rejection
forbidden legacy Protocol Definition fields rejection
STREAM header fact rejection
CONTROL OPEN/ACCEPT/READY fact rejection
```

---

## 12. 当前 P0 完成状态

已完成：

```text
registry/core/method/event/error/capability/schema/legacy loader
registry/domains/<domain>/domain.yaml loader
Source Model validation
Protocol IR builder
Protocol IR validator
00-spec key facts validator
generated protocol.json
obs-websocket-style generated protocol.md
snapshot tests
registry generator Source Model compatibility path
generate command as three-stage pipeline
```

仍属于兼容保留而非主入口：

```text
generate-registry
doc
test-vector
generate-protocol
```

---

## 13. P1 规划

P1 目标是把当前文档编译器扩展为完整协议资产编译器。

### 13.1 Source Model 完整化

计划：

```text
为 registry/domain YAML 引入 JSON Schema 或 Zod schema
错误信息精确到 source file + YAML path
支持 split domain files，例如 methods.yaml / types.yaml
支持 domain-level includes
支持 generated source manifest
```

### 13.2 ID 分配和保留策略

计划：

```text
自动检查 docs/source planning table 与 YAML 的 ID 偏移
提供 suggest-id 命令
提供 reserve-id 命令
禁止隐式 bit_offset 重排
生成 ID allocation report
```

### 13.3 兼容性 diff

实现 `diff`：

```text
stable methodId/eventId/errorCode/capabilityId 不得换语义
stable fieldId 不得换名称或类型
required 字段不得无 major version 变更而删除
deprecated ID 不得复用
draft -> mvp -> stable 可升级
新增 optional 字段为兼容变更
```

### 13.4 Runtime codegen

优先输出：

```text
C++ enum and descriptors
C++ schema field constants
C++ TLV encode/decode helpers
TypeScript protocol model
TypeScript request/event type definitions
test-vector manifest
```

Runtime 仍只生成 skeleton，不生成业务 handler。

### 13.5 文档体验

计划：

```text
为 generated/protocol.md 增加 per-domain summary table
为 method/event 增加 Examples
为 stream methods 增加 stream binding note
为 errors 增加按 category 分组视图
生成 docs/generated/index.md
支持 docs site frontmatter
```

---

## 14. P2 规划

P2 目标是跨语言 SDK 和工具生态。

计划：

```text
Rust / Python / Kotlin / Swift 类型生成
MCP tool schema generation
OpenAPI-like bridge for debug HTTP adapters
binary TLV golden vectors
wire compatibility corpus
domain package publishing
graphical registry viewer
protocol migration report
legacy adapter table generation
```

不纳入 v1 Core 的内容：

```text
完整 capability model UI
业务 handler 自动实现
transport runtime
media payload codec
OTA flash driver
device-specific policy engine
```

---

## 15. CI 要求

CI 必须至少执行：

```bash
cd generators
npm run build
npm test
node dist/cli.js validate --spec ..
node dist/cli.js validate-sources --spec ..
node dist/cli.js generate --spec ..
git diff --check
```

CI 应阻止：

```text
Source YAML 校验失败
Protocol IR 校验失败
00-spec key facts drift
generated protocol artifacts 未同步
snapshot 未更新
重复 ID
bit_offset 不连续
schema 引用缺失
profile 引用缺失
reserved 条目被新实现引用
```

---

## 16. 总结

AXTP Generator v1 的当前职责是把协议从 Markdown 人工维护推进到可校验、可聚合、可生成的工程体系：

```text
Source YAML 可审查
Protocol IR 可复现
generated protocol.md 可读
generated protocol.json 可消费
wire facts 由 00-spec 兜底
新增业务通过 domain YAML 扩展
```

后续演进应围绕一个原则展开：先保证协议事实不漂移，再扩展 codegen 和 SDK 体验。
