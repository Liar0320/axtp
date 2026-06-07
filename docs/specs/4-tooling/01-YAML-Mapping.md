# 4-tooling/01《AXTP Protocol Definition Mapping Spec》

> Status: AXTP v1 Protocol Definition Meta Spec
> Spec Version: 1.0.0-rc1
> Scope: Protocol Definition mapping rules, generated protocol layout, compiler contract

版本：v1.0.0-rc1
状态：Protocol Definition 元规范
适用范围：Registry/Domain YAML 到 `protocol/axtp.protocol.yaml` 的映射、JSON-RPC 到 Binary-RPC 的映射、生成 `docs/generated/protocol.md` 的规则

---

## 0. 速读：Protocol Definition 怎么改

Registry/Profile specs 描述的是 registry 元模型和当前编号规划，真正的实现事实源在 YAML。`docs/protocol/<domain>/<domain.feature>.md` 是协议方案输入和草案评审区；草案确认后，必须反向确认 Registry/Capability Types specs 的命名、ID、method/event/error/schema/capability 规则，再固化到 YAML。`protocol/axtp.protocol.yaml`、`docs/generated/*` 是生成产物，不得手写。

```text
docs/protocol/<domain>/<domain.feature>.md
        -> protocol draft review / confirmation
        -> reverse-confirm Registry and Capability Types specs
        -> registry/**/*.yaml
registry/**/*.yaml
registry/domains/**/*.yaml
        -> protocol/axtp.protocol.yaml
        -> docs/generated/protocol.md / protocol.json / runtime generated files
```

改协议事实时按这个顺序判断：

| 你要做什么 | 修改位置 | 说明 |
|---|---|---|
| 新增或更新业务协议方案 | `docs/protocol/<domain>/<domain.feature>.md` | 作为草案输入，需人工确认后才能固化 |
| 新增普通业务 method/event/type/error/profile | `registry/domains/<domain>/domain.yaml` | 默认路径，避免污染 core registry |
| 晋升为 Core/MVP 或跨 domain 共享 | 对应 `registry/` 核心 YAML | 迁移后删除 domain 里的重复条目 |
| 新增或调整旧协议映射 | `registry/legacy/legacy_mapping.yaml` | 长期迁移事实进入机器源 |
| 调整 wire format | `1-core/03` / `1-core/05` / `1-core/06` / `1-core/07` | 不在 registry 文档里重定义 header |
| 修改生成产物 | 运行 Generator | 不手写 `protocol/` 或 `docs/generated/` |

禁止事项：从 `docs/protocol` 直接生成最终协议、跳过 Registry/Capability Types specs 反向确认、新增业务 PayloadType、把 video/audio/ota/file 放进 Frame Header、同一事实在 core 和 domain YAML 双写、复用 stable ID。

Codex 交互应拆成两个 skill 阶段：

| 阶段 | Skill 职责 | 允许修改 | 输出 |
|---|---|---|---|
| 协议草案阶段 | 根据产品/架构师的大白话或文档，遍历 `docs/protocol/<domain>/<domain.feature>.md`，判断是否已有协议可复用、需要优化旧草案，或需要新增 domain.feature 草案 | `docs/protocol/**` 草案与待确认问题 | 可评审的协议草案，带候选 method/event/schema/error/capability/profile 和 `[REVIEW-*]` 标记 |
| 协议采纳阶段 | 在内部评审确认后，将草案反向确认到 Registry/Capability Types specs，补齐正式规范表和 registry YAML，再运行 Generator | `docs/specs/2-registry/**` 与 `docs/specs/3-codec/02-Capability-Types.md`、`registry/**`、`registry/domains/**` | `protocol/axtp.protocol.yaml`、`docs/generated/*`、runtime/tooling 生成物 |

草案阶段必须输出三类结论：已有协议可直接复用、现有草案需要优化、新建 domain.feature 草案。采纳阶段必须只处理已确认事实；带 `[REVIEW-ASK]` 或 `[REVIEW-BLOCKER]` 的内容不得进入 YAML。

研发只消费采纳阶段后的生成物进行开发；新 feature 上架不得依赖未采纳的 `docs/protocol` 草案。

---

## 1. 文档定位

本文档定义 AXTP Protocol Definition 的元模型和三段式生成链路。`2-registry/01-Naming-and-Taxonomy.md` 定义 domain-feature 命名治理；Registry/Profile specs 文档在该治理下同时定义 Protocol Definition 元模型与当前正式 registry 规划表。`docs/protocol/<domain>/<domain.feature>.md` 提供业务协议方案输入；方案更新并确认后，必须反向确认 Registry/Capability Types specs 是否需要同步修订，稳定实现事实再进入 registry YAML。

具体协议内容必须进入机器事实源：

```text
registry/**/*.yaml
registry/domains/**/*.yaml
```

协议方案输入来自：

```text
docs/protocol/<domain>/<domain.feature>.md
docs/legacy-migration/classification/**
```

这些文件可以用于生成或整理协议草案，但采纳前不得视为当前协议合同。

聚合后的 Protocol IR 由 Generator 输出到：

```text
protocol/axtp.protocol.yaml
```

生成产物放入：

```text
docs/generated/
runtime 子仓库 generated 产物
tooling/*/
```

Protocol Definition 与 Core Specs 的职责边界如下：

| 内容类型 | 归属 |
|---|---|
| 二进制线格式、Header、Payload 固定头 | `1-core/03` / `1-core/05` / `1-core/06` / `1-core/07` |
| Transport/Profile 固定绑定 | `1-core/04` |
| OPEN / ACCEPT / READY | `1-core/05` |
| Hello / Identify / RPC / EVENT | `1-core/06` |
| STREAM Header / resume | `1-core/07` |
| 旧协议兼容映射 | `4-tooling/03` 与 `registry/legacy/legacy_mapping.yaml` |
| 业务协议方案草案 | `docs/protocol/<domain>/<domain.feature>.md` |
| 完整 Capability Model | 不作为当前 v1 主库输入；如需重启，先进入 `docs/protocol/` RFC |
| method/event/error/type/profile entry 元模型 | Registry/Profile specs |
| 具体业务 method/event/type/error/profile | `registry/` 与 `registry/domains/` YAML |

---

## 2. Protocol Definition 顶层结构

`protocol/axtp.protocol.yaml` 是生成产物，必须包含以下顶层块：

```yaml
protocol: {}
overview: {}
architecture: {}
guide: {}
frameProfiles: []
transports: []
payloadTypes: []
control: {}
stream: {}
compatibility: {}
types: {}
methods: []
events: []
errors: []
profiles: []
```

`protocol.specVersion` 与 `protocol.registryVersion` 必须分离。Core wire format 修改使用 `specVersion`；method/event/type/error/profile 增量使用 `registryVersion`。

Registry/Profile specs 不得重新定义 wire header 字段；具体 registry 表格必须与 registry YAML/generated 保持一致。

---

## 2.1 三段式输入输出关系

```text
方案输入段：
  docs/protocol/<domain>/<domain.feature>.md
  docs/legacy-migration/classification/**
  Registry and Capability Types specs 反向确认规则
        ↓
协议草案更新与人工确认
        ↓
事实源段：
registry/**/*.yaml + registry/domains/**/*.yaml
        ↓
Protocol IR 段：
protocol/axtp.protocol.yaml
        ↓
成果物段：
docs/generated/protocol.md + protocol.json + SDK/bitmap/test-vector
```

- `docs/protocol/<domain>/<domain.feature>.md` 是协议方案输入；所有符合该路径的 feature 草案都要纳入方案审查清单。
- 协议草案确认后必须反向确认 Registry/Capability Types specs：08 检查 domain.feature 命名，09 检查 ID/Domain/生成链路，Methods/Events/Errors Registry and Capability Types specs 检查 method/event/error/schema/capability 是否需要进入规划表或规则。
- Codex 的“添加业务协议”skill 只负责方案搜索、归类和草案补全；“协议采纳”skill 才能在评审通过后写 specs/YAML 并触发生成。
- 反向确认不是把草案全文复制到 specs；只把会改变正式规范、编号规划、元模型约束或 registry 规则的内容同步到 Registry/Capability Types specs。
- `registry/` 保存核心常量、公共 schema、MVP 已采纳条目和 legacy 映射。
- `registry/domains/` 保存新增业务域的扩展 YAML，是新增业务的默认入口。
- 新增业务事实不得同时写入 core registry 与 domain YAML；domain 业务晋升为 MVP/Core 时，必须迁移而不是复制。
- `registry/core/protocol_meta.yaml` 保存 overview、frameProfiles、transports、payloadTypes、control、stream、compatibility 等非业务 IR 输入。
- `protocol/axtp.protocol.yaml` 不得手写修改；任何最终协议事实必须回到 `registry/` 或 `registry/domains/`。

当前治理中的业务域词表包括 `device / capability / system / network / audio / camera / video / input / output / display / stream / firmware / storage / file / log / diagnostic / auth / privacy / sensor / room / signage / vendor`。其中 `output` 与 `input` 成对表达出入设备或场景的信号边界，`room` 使用单数形式表达会议室/协作空间业务，`signage` 表达数字标牌播放列表、计划、媒体和播放状态。

---

## 3. JSON-RPC 到 Binary-RPC 映射

| JSON-RPC 概念 | Binary-RPC 字段 | 规则 |
|---|---|---|
| method name | methodId | 从 `methods[].methodId` 生成，稳定后不得复用 |
| sid | sid | 映射为 uint32，Little-Endian；JSON 表示为 8 位 hex string |
| request id | requestId | 映射为 uint32，Little-Endian |
| params | body | 按 request type 生成 TLV / CBOR / FixedStruct |
| result | body | 按 response type 生成 TLV / CBOR / FixedStruct |
| event name | eventId | 从 `events[].eventId` 生成 |
| error code | statusCode / errorCode | 从 `errors[].code` 生成 |

Binary-RPC Header 固定 15B。JSON / CBOR / MessagePack 模式不使用 Binary 15B Header。

---

## 4. Body Encoding 映射

`methods[].request.type` 与 `methods[].response.type` 必须引用 `types` 中存在的类型。

生成器必须支持：

| bodyEncoding | 用途 |
|---|---|
| `NONE` | Empty request / response |
| `TLV8` | v1 MVP 默认二进制结构 |
| `TLV16` | 扩展长度 TLV |
| `CBOR` | 可选紧凑对象编码 |
| `FIXED_STRUCT` | Legacy 兼容结构 |
| `TLV8` / `TLV16` | JSON_BINARY body 字段编码 |

---

## 5. protocol.md 生成规则

`docs/generated/protocol.md` 不得只是注册表清单，必须包含 Overview 与 Reference 两部分。

Overview 部分来自：

```text
protocol / overview / architecture / guide / frameProfiles / transports /
payloadTypes / control / stream / compatibility
```

Reference 部分来自：

```text
methods / events / types / errors / profiles
```

推荐章节顺序：

```text
Overview
Design Goals
Non-Goals
Architecture
Transport Profiles
Frame Profiles
Payload Types
Connection Lifecycle
Capability Discovery in v1
Stream Transfer Model
JSON-RPC and Binary-RPC Mapping
Compatibility Rules
Reference: Methods / Events / Types / Errors / Profiles
Method Bitmap Layout
```

---

## 6. axtpc 输入输出契约

对外工具名称为：

```text
axtpc
AXTP Protocol Compiler
```

推荐命令：

```bash
axtpc validate-sources --spec .
axtpc generate --spec .
axtpc emit schema
axtpc emit cpp
axtpc emit ts
axtpc emit bitmap
axtpc emit conformance
```

---

## 7. 稳定性规则

1. 08 是命名治理规范；Registry/Profile specs 是 Normative Registry 规范，包含元模型和正式规划表。
2. 新增业务 method/event/error/profile 默认先进入 `registry/` 或 `registry/domains/` YAML；如涉及正式编号规划或 MVP 契约变化，必须同步修订 Registry/Profile specs。
3. `protocol/axtp.protocol.yaml` 与 generated 目录下文件不得手写修改。
4. CI 必须验证 ID 唯一性、引用完整性、schema 完整性、bitmap 一致性和 stable ID 不复用。



## Registry 表格与 YAML 的关系

Registry/Profile specs 文档同时承担 registry 元模型规范和当前正式 registry 规划表职责。Markdown 表格用于规范审查、编号规划和实现契约；稳定实现事实必须同步进入 `registry/**/*.yaml` 或 `registry/domains/**/*.yaml`，生成物以 `docs/generated/*` 和 `protocol/axtp.protocol.yaml` 为准。

如果 Markdown 表格与 YAML/generated 发生冲突，以 YAML/generated 作为实现事实源，并应回修本规范表格；不得维护第二套 active 事实源。


## 正式 Registry 总则与 ID 规划表

版本：v1.1
状态：MVP Registry 治理规范（精简版）
适用范围：AXTP Registry 系统统一治理规则、ID 分配、命名规范、生命周期、Legacy Mapping、Vendor Extension

---

### 1. Registry 定位

Registry 是 AXTP 协议落地的**单一事实源**，统一管理：

```text
PayloadType / Control Opcode / RPC Encoding / RPC Operation / Stream Profile
MethodId / EventId / ErrorCode / CapabilityId / SchemaId / FieldId
Vendor Extension / Legacy Mapping
```

最终目标：

```text
registry/**/*.yaml + registry/domains/**/*.yaml
    ↓ Generator v1
protocol/axtp.protocol.yaml
    ↓ Generator v1
docs/generated/* / runtime generated artifacts / tooling generated artifacts
```

---

### 2. 设计原则

#### 2.1 单一事实源

所有可枚举、可分配、可生成的协议对象必须在 Registry 中注册。不得在代码、文档、测试脚本中私自新增未注册 ID。

#### 2.2 Header 与业务解耦

Frame Header 只识别 `PayloadType = CONTROL / RPC / STREAM`。业务对象（video/audio/ota/file/display 等）必须注册在 Method/Event/Stream/Capability/Schema Registry 中，不得出现在 Frame Header。

#### 2.3 ID 稳定优先

进入 `stable` 状态的 ID 不得改变语义。语义变化时新增 ID，不修改旧 ID。

#### 2.4 向前兼容

允许新增：methodId / eventId / errorCode / capabilityId / optional 字段 / vendor extension / Stream Profile。

禁止：修改 stable methodId 含义、修改 stable fieldId 类型、修改 stable enum value 含义、删除旧字段后复用编号、把 optional 字段改成 required、改变默认字节序。

---

### 3. Registry 文件组织

```text
registry/
├── core/
│   ├── payload_type.yaml
│   ├── control_opcode.yaml
│   ├── protocol_meta.yaml
│   ├── rpc_encoding.yaml
│   ├── rpc_body_encoding.yaml
│   └── rpc_op.yaml
├── error/
│   └── error_code.yaml
├── capability/
│   ├── capability_registry.yaml
│   └── mvp_profile.yaml
├── domains/
│   └── <domain>/
│       └── domain.yaml
├── schema/
│   ├── common_fields.yaml
│   ├── control_schema.yaml
│   ├── event_schema.yaml
│   └── session_schema.yaml
└── vendor/
    └── .gitkeep
```

`registry/` 是唯一机器事实源根目录。其中 `registry/error|capability|schema/` 保存当前核心/公共/已采纳事实，`registry/domains/<domain>/domain.yaml` 保存新增业务域事实。`registry/method/`、`registry/event/`、`registry/legacy/` 和额外 shared schema 文件按采纳事实需要创建；空集合不保留占位文件。Generator v1 读取 Source YAML 后生成 `protocol/axtp.protocol.yaml`，不得手写 Protocol IR 或 generated 目录成果物。

新增业务默认只写 `registry/domains/<domain>/domain.yaml`，不同时复制到 `registry/method/`、`registry/event/`、`registry/schema/` 等核心文件。只有当该业务被治理为 MVP/Core 公共能力时，才执行晋升：保持原有 ID、fieldId、bitOffset 和语义不变，将条目迁入核心 registry，并从 domain YAML 删除对应条目，避免双事实源。

---

### 4. Registry 对象通用字段

```yaml
id: 0x0901
name: audio.getAlgorithmConfig
kind: method
status: stable
domain: audio
domainId: 0x09        # 域级掩码中的 DomainId（event/capability 可用；method 由 domain name 分组）
bitOffset: 0          # 域内 method/event 掩码位偏移，必须在同 domain 内连续
version:
  since: 1.0.0
  deprecated: null
  removed: null
description: Return the current effective configuration for supported audio algorithm objects.
owner: audio
mvp: false
legacy:
  cmdValue: null
  source: null
```

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `id` | 是 | 数值 ID，必须唯一 |
| `name` | 是 | 可读名称，例如 `audio.getAlgorithmConfig` |
| `kind` | 是 | `method/event/error/capability/enum/schema` |
| `status` | 是 | 生命周期状态 |
| `domain` | 视情况 | 所属业务域 |
| `domainId` | event/capability 必填 | 域级掩码中的 DomainId（1B），与 MethodId/EventId 高字节对齐；method 可由 `domain` 推导 |
| `bitOffset` | method/event 必填 | 该条目在 Domain 内的掩码位偏移（0-255），由 Registry 自增分配；capability 可按 v2 capability model 使用 |
| `version.since` | 是 | 首次引入版本 |
| `version.deprecated` | 否 | 废弃版本 |
| `description` | 是 | 简短描述 |
| `owner` | 是 | `core/vendor/legacy/experimental` |
| `mvp` | 是 | 是否属于 MVP 必须实现 |
| `legacy` | 否 | 老协议映射信息 |

---

### 5. 生命周期状态

| status | 含义 | 可生成代码 | 可用于生产 |
| --- |---|---:|---:|
| `draft` | 已登记但未采纳 | 可选 | 否 |
| `experimental` | 实验性 | 可选 | 否 |
| `mvp` | MVP 必须实现 | 是 | 可用于试产 |
| `stable` | 稳定 | 是 | 是 |
| `deprecated` | 已废弃但保留兼容 | 是 | 不建议新增使用 |
| `reserved` | 保留编号 | 否 | 否 |
| `removed` | 已移除 | 否 | 否 |

推荐流转：`draft → experimental → mvp → stable → deprecated`

`deprecated` 规则：ID 不得复用；Generator 仍应生成兼容 enum；文档中应标记替代项；新业务不得继续引用。

---

### 6. 命名规范

AXTP 业务能力命名采用 `domain / domain.feature / domain.method` 三层模型。完整 feature 分类与方法/事件模板见 `docs/specs/2-registry/01-Naming-and-Taxonomy.md`。

#### 6.1 Domain 命名

小写单词：`device / capability / system / network / audio / camera / video / input / output / display / stream / firmware / storage / file / log / diagnostic / auth / privacy / sensor / room / signage / vendor`

说明：`session` 是协议会话上下文，不作为业务 Domain 分配 MethodId；`event` 是 RPC 机制概念，不作为业务 Domain；`config` 仅用于老协议兼容映射，不作为 AXTP 原生业务域。

#### 6.2 Feature / Capability 命名

格式：`domain.feature`

Feature 是稳定能力块，不是字段名。不要把 `Config / State / Mode / Policy / Codec` 直接作为 feature 后缀。

推荐：`network.wifi / video.framing / audio.algorithm / firmware.update / log.export / stream.flowControl`

不推荐：`network.wifiConfig / video.framingMode / firmware.updateState / stream.fileTransfer`

#### 6.3 Method 命名

格式：`domain.verbFeatureNoun`

推荐动词：`get / set / list / open / close / start / stop / begin / end / verify / apply / abort / resume / subscribe / unsubscribe`

配置型示例：`network.getWifiConfig / network.setWifiConfig / video.setFramingConfig`

状态型示例：`network.getWifiState / firmware.getUpdateState`

动作型示例：`network.scanWifi / camera.triggerAutoFocus / firmware.installUpdate`

流型示例：`video.openStream / log.openStream / firmware.beginUpdate`

`stream.*` 不定义常规业务建流方法；业务流由业务域创建，`stream` 域只保留公共流控与数据面能力。

#### 6.4 Event 命名

格式：`domain.featureConfigChanged / domain.featureStateChanged / domain.featureProgressReported / domain.featureResultReported`

示例：`network.wifiConfigChanged / network.wifiStateChanged / firmware.updateProgressReported / log.exportProgressReported`

#### 6.5 ErrorCode 命名

全大写蛇形：`SUCCESS / INVALID_ARGUMENT / FRAME_CRC_ERROR / FW_VERIFY_FAILED`

#### 6.6 Capability 命名

格式：`domain.feature`

示例：`protocol.payload.control / rpc.encoding / firmware.update / display.brightness`

字段级限制进入 feature capability schema 或 `getFeatureCapabilities` 响应，例如亮度范围属于 `display.brightness`；deprecated aliases `display.brightnessMin / display.brightnessMax / display.brightnessStep` 不再作为主能力。

---

### 7. ID 编码规则

| 对象 | 宽度 | 使用位置 |
| --- |---:| --- |
| `payloadType` | `uint8` | Frame Header |
| `controlOpcode` | `uint8` | Control Payload |
| `rpcEncoding` | `uint8` | RPC Payload |
| `rpcOp` | `uint8` | RPC Payload |
| `streamProfile` | `uint16` | Registry / Capability / RPC 建流，不出现在 STREAM Payload |
| `methodId` | `uint16` | RPC Request/Response |
| `eventId` | `uint16` | RPC Event |
| `errorCode` | `uint16` | Control/RPC/Stream 错误 |
| `capabilityId` | `uint16` | Capability Registry |
| `fieldId` | `uint8` | TLV Schema |

所有多字节数值线上字节序遵循 Little-Endian。

---

### 8. Core Registry ID 范围

#### 8.1 PayloadType

| ID | 名称 | 说明 |
|---:| --- |---|
| `0x00` | `RESERVED` | 保留 |
| `0x01` | `CONTROL` | 协议信令 |
| `0x02` | `RPC` | 结构化业务命令、响应、事件 |
| `0x03` | `STREAM` | 连续数据、大块数据 |
| `0x04-0x7E` | `RESERVED` | AXTP Core 保留 |
| `0x7F` | `VENDOR` | 不建议使用 |
| `0x80-0xFF` | `RESERVED` | 未来扩展 |

MVP 只实现：`CONTROL / RPC / STREAM`

#### 8.2 Control Opcode

| 范围 | 用途 |
|---:| --- |
| `0x00` | 保留 |
| `0x01-0x1F` | Core Control Opcode |
| `0x20-0x3F` | Control 扩展 |
| `0x40-0x6F` | 实验性 |
| `0x70-0x7E` | 厂商扩展 |
| `0x7F` | Vendor Escape |
| `0x80-0xFF` | 保留 |

MVP Control Opcode：`OPEN(0x01) / ACCEPT(0x02) / HEARTBEAT(0x04) / HEARTBEAT_ACK(0x05) / ACK(0x06) / NACK(0x07) / CLOSE(0x0A) / CLOSE_ACK(0x0B)`

预留 Opcode：`READY(0x03)` — 可选三步协商预留，当前版本非必要实现，收到时必须忽略

#### 8.3 RPC Encoding

| ID | 名称 | 说明 |
|---:| --- |---|
| `0x00` | `NONE` | 无 body |
| `0x01` | `JSON` | DS-RPC Text Profile body |
| `0x02` | `CBOR` | CBOR sid/op/d envelope |
| `0x03` | `MSGPACK` | MessagePack sid/op/d envelope |
| `0x04` | `JSON_BINARY` | AXTP fixed binary sid/op/d envelope |
| `0x06-0x7E` | `RESERVED` | 保留 |
| `0x7F` | `VENDOR` | 厂商私有 |

Phase 1 必须实现：`JSON`；Standard Framed 优先实现 `JSON_BINARY`。二进制 Body 的 TLV8 / TLV16 由 `bodyEncoding` 表达，不占用 `rpcEncoding` 枚举。

#### 8.4 RPC Operation

| ID | 名称 | 说明 |
|---:| --- |---|
| `0x00` | `HELLO` | 服务端问候 / 认证挑战 |
| `0x01` | `HELLO_ACK` | 保留 |
| `0x02` | `IDENTIFY` | 客户端身份确认 |
| `0x03` | `IDENTIFIED` | 服务端确认会话就绪 |
| `0x04` | `REIDENTIFY` | 会话参数更新 |
| `0x05` | `SUBSCRIBE` | 保留 |
| `0x06` | `EVENT` | 事件通知 |
| `0x07` | `REQUEST` | 请求 |
| `0x08` | `REQUEST_RESPONSE` | 请求响应 |
| `0x09` | `REQUEST_BATCH` | 批量请求 |
| `0x0A` | `REQUEST_BATCH_RESPONSE` | 批量响应 |
| `0x0E` | `BYE` | 关闭请求 |
| `0x0F` | `BYE_ACK` | 关闭确认 |

MVP 必须实现：`HELLO / IDENTIFY / IDENTIFIED / EVENT / REQUEST / REQUEST_RESPONSE`。Batch 可延后。

#### 8.5 Stream Profile

Stream Profile 是具体可建流协议档案，不是 STREAM 数据包字段。STREAM 数据包只携带 `streamId / seqId / cursor / data`，Profile 由 RPC 建流方法协商并绑定到 `streamId`。

| profileId | 名称 | 说明 |
|---:| --- |---|
| `0x0000` | `reserved` | 保留 |
| `0x0001` | `firmware.update` | 固件升级数据块上传 |
| `0x0002` | `file.transfer` | 文件传输 |
| `0x0401` | `log.stream` | 实时日志 |
| `0x1001` | `video.stream` | 视频帧流 |
| `0x1002` | `audio.recording` | 音频录制流 |
| `0x3001` | `input.hid` | HID/KVM 原始输入 |
| `0x4001` | `sensor.sample` | 传感器采样 |
| `0x8001` | `legacy.tunnel` | 旧协议连续字节流隧道 |
| `0xF001-0xFFFF` | `vendor.*` | 厂商私有 |

MVP 必须实现：`firmware.update`。`file.transfer / log.stream` 可选或后续扩展。

---

### 9. Domain Registry 规则

Domain Registry 是 MethodId、EventId、业务 ErrorCode、CapabilityId 与域级掩码 DomainId 的统一分配依据。除 `0x00` 公共/协议内部空间和 `0x70-0x7F` vendor 空间外，所有按业务域分配的 `uint16` ID 都必须使用下表的高字节和顺序。

| DomainId | ID 范围 | Domain | 说明 | MVP |
| ---: |---:| --- |---|---:|
| `0x00` | `0x0000-0x00FF` | reserved/common | 公共值、协议内部错误与保留空间；不作为业务域 | 是 |
| `0x01` | `0x0100-0x01FF` | `device` | 设备基础信息与生命周期 | 是 |
| `0x02` | `0x0200-0x02FF` | `capability` | 能力查询与协商 | 是 |
| `0x03` | `0x0300-0x03FF` | `system` | 系统控制：重启、时间同步、重置、功耗 | 是 |
| `0x04` | `0x0400-0x04FF` | `firmware` | 固件升级控制面 | 是 |
| `0x05` | `0x0500-0x05FF` | `stream` | 公共流控、断点续传、可靠传输、低带宽链路优化与数据面承载；不按业务类型建流 | 是 |
| `0x06` | `0x0600-0x06FF` | `display` | 显示控制：亮度、分辨率、旋转、布局、输入源 | 是 |
| `0x07` | `0x0700-0x07FF` | `camera` | 摄像头：变焦、帧率、图像参数 | 否 |
| `0x08` | `0x0800-0x08FF` | `video` | 视频编码与输出控制，比如追踪、镜像、旋转等 | 否 |
| `0x09` | `0x0900-0x09FF` | `audio` | 音频控制 | 否 |
| `0x0A` | `0x0A00-0x0AFF` | `input` | 输入源管理、KVM、HID | 否 |
| `0x0B` | `0x0B00-0x0BFF` | `output` | 输出源、输出接口、输出路由、输出布局；与 `input` 成对 | 否 |
| `0x0C` | `0x0C00-0x0CFF` | `room` | 会议室/协作空间身份、日程、场景、参与设备 | 否 |
| `0x0D` | `0x0D00-0x0DFF` | `signage` | 数字标牌播放列表、计划、媒体、外观、播放状态 | 否 |
| `0x0E` | `0x0E00-0x0EFF` | `network` | 网络配置 | 否 |
| `0x0F` | `0x0F00-0x0FFF` | `storage` | 存储管理 | 否 |
| `0x10` | `0x1000-0x10FF` | `file` | 文件传输控制面 | 否 |
| `0x11` | `0x1100-0x11FF` | `log` | 日志控制 | 否 |
| `0x12` | `0x1200-0x12FF` | `diagnostic` | 诊断 / 产测 | 否 |
| `0x13` | `0x1300-0x13FF` | `sensor` | 传感器 | 否 |
| `0x14` | `0x1400-0x14FF` | `auth` | 认证与访问控制 | 否 |
| `0x15` | `0x1500-0x15FF` | `privacy` | 隐私遮挡与隐私状态 | 否 |
| `0x70-0x7F` | `0x7000-0x7FFF` | `vendor` | 厂商私有扩展 | 否 |
| `0x80-0xFF` | `0x8000-0xFFFF` | reserved | 保留 | 否 |

说明：`brightness` 不作为独立域，亮度控制方法、事件和能力归入 `display.brightness`。`boot / factory / screen / usb / bluetooth / misc` 等旧 HID 域只可映射到 `diagnostic.*` 或 `vendor.*`。`meeting / rooms` 归入 `room.*`，`curtain / mirror / output source / output layout` 归入 `output.*`，`osd / ndi / overlay` 归入 `video.*`，数字标牌播放业务归入 `signage.*`。

---

### 10. MethodId 分配规则

MethodId 使用 `uint16`，按第 9 章 Domain Registry 的 `DomainId` 高字节分段：

| 范围 | Domain |
|---:| --- |
| `0x0000-0x00FF` | reserved |
| `0x0100-0x01FF` | `device.*` |
| `0x0200-0x02FF` | `capability.*` |
| `0x0300-0x03FF` | `system.*` |
| `0x0400-0x04FF` | `firmware.*` |
| `0x0500-0x05FF` | `stream.*` |
| `0x0600-0x06FF` | `display.*` |
| `0x0700-0x07FF` | `camera.*` |
| `0x0800-0x08FF` | `video.*` |
| `0x0900-0x09FF` | `audio.*` |
| `0x0A00-0x0AFF` | `input.*` |
| `0x0B00-0x0BFF` | `output.*` |
| `0x0C00-0x0CFF` | `room.*` |
| `0x0D00-0x0DFF` | `signage.*` |
| `0x0E00-0x0EFF` | `network.*` |
| `0x0F00-0x0FFF` | `storage.*` |
| `0x1000-0x10FF` | `file.*` |
| `0x1100-0x11FF` | `log.*` |
| `0x1200-0x12FF` | `diagnostic.*` |
| `0x1300-0x13FF` | `sensor.*` |
| `0x1400-0x14FF` | `auth.*` |
| `0x1500-0x15FF` | `privacy.*` |
| `0x7000-0x7FFF` | `vendor.*` |
| `0x8000-0xFFFF` | reserved |

Method 条目格式：

```yaml
methods:
  - id: 0x0902
    name: audio.setAlgorithmConfig
    kind: method
    status: stable
    domain: audio
    description: Partially update audio algorithm configuration.
    schema:
      params: AudioSetAlgorithmConfigRequest
      result: AudioSetAlgorithmConfigResponse
    errors:
      - INVALID_ARGUMENT
      - BUSY
    events:
      - audio.algorithmConfigChanged
    legacy:
      cmdValue: null
      source: null
    mvp: false
```

Method 规则：
- `methodId` 不得重复；`methodName` 不得重复
- `methodId` 所在范围必须匹配 `domain`
- `params` 和 `result` 必须引用已注册 schema
- `errors` 必须引用已注册 errorCode
- 如果 method 会触发事件，应在 `events` 中声明
- 如果 method 来自老协议，应填写 `legacy`

---

### 11. EventId 分配规则

EventId 使用 `uint16`，按与 MethodId 相同的第 9 章 Domain Registry 分段分配。Method 与 Event 属于不同 RPC op 命名空间；线上通过 `rpcOp = REQUEST / RESPONSE / EVENT` 区分，因此同一 domain 的 MethodId 与 EventId 必须共享同一个高字节 DomainId。

| 范围 | Domain |
|---:| --- |
| `0x0000-0x00FF` | reserved |
| `0x0100-0x01FF` | `device.*` |
| `0x0200-0x02FF` | `capability.*` |
| `0x0300-0x03FF` | `system.*` |
| `0x0400-0x04FF` | `firmware.*` |
| `0x0500-0x05FF` | `stream.*` |
| `0x0600-0x06FF` | `display.*` |
| `0x0700-0x07FF` | `camera.*` |
| `0x0800-0x08FF` | `video.*` |
| `0x0900-0x09FF` | `audio.*` |
| `0x0A00-0x0AFF` | `input.*` |
| `0x0B00-0x0BFF` | `output.*` |
| `0x0C00-0x0CFF` | `room.*` |
| `0x0D00-0x0DFF` | `signage.*` |
| `0x0E00-0x0EFF` | `network.*` |
| `0x0F00-0x0FFF` | `storage.*` |
| `0x1000-0x10FF` | `file.*` |
| `0x1100-0x11FF` | `log.*` |
| `0x1200-0x12FF` | `diagnostic.*` |
| `0x1300-0x13FF` | `sensor.*` |
| `0x1400-0x14FF` | `auth.*` |
| `0x1500-0x15FF` | `privacy.*` |
| `0x7000-0x7FFF` | `vendor.*` |
| `0x8000-0xFFFF` | reserved |

Event 规则：
- Event 必须通过 `PayloadType = RPC` 且 `rpcOp = EVENT` 承载
- Event 不应直接使用 `PayloadType = STREAM`
- 高频二进制数据应走 STREAM，事件只上报状态变化或统计摘要
- Event data 必须引用 schema
- 每个 Event 必须在其 Domain 内分配唯一 `bitOffset`（0-255），由 Registry 自增分配，用于 `eventMasks` 域级订阅掩码
- `domainId` 等于 EventId 高字节，并与同 domain 的 MethodId 高字节一致（如 `display.*` MethodId/EventId 均为 `0x06xx`，domainId = `0x06`）

---

### 12. ErrorCode 分配规则

ErrorCode 使用 `uint16`。业务 ErrorCode 必须按第 9 章 Domain Registry 的 `DomainId` 高字节分段；`0x0000-0x00FF` 仅用于 `common / frame / control / rpc` 等协议内部错误，不作为业务域。

| 范围 | 分类 |
|---:| --- |
| `0x0000-0x00FF` | Common / Frame / Control / RPC（协议内部错误） |
| `0x0100-0x01FF` | `device.*` |
| `0x0200-0x02FF` | `capability.*` |
| `0x0300-0x03FF` | `system.*` |
| `0x0400-0x04FF` | `firmware.*` |
| `0x0500-0x05FF` | `stream.*` |
| `0x0600-0x06FF` | `display.*` |
| `0x0700-0x07FF` | `camera.*` |
| `0x0800-0x08FF` | `video.*` |
| `0x0900-0x09FF` | `audio.*` |
| `0x0A00-0x0AFF` | `input.*` |
| `0x0B00-0x0BFF` | `output.*` |
| `0x0C00-0x0CFF` | `room.*` |
| `0x0D00-0x0DFF` | `signage.*` |
| `0x0E00-0x0EFF` | `network.*` |
| `0x0F00-0x0FFF` | `storage.*` |
| `0x1000-0x10FF` | `file.*` |
| `0x1100-0x11FF` | `log.*` |
| `0x1200-0x12FF` | `diagnostic.*` |
| `0x1300-0x13FF` | `sensor.*` |
| `0x1400-0x14FF` | `auth.*` |
| `0x1500-0x15FF` | `privacy.*` |
| `0x7000-0x7FFF` | `vendor.*` / legacy adapter |
| `0x8000-0xFFFF` | Reserved |

ErrorCode 规则：
- 成功码统一使用 `SUCCESS = 0x0000`
- `retryable` 必须明确
- Control、RPC、Stream 都应使用同一 ErrorCode Registry

---

### 13. CapabilityId 分配规则

CapabilityId 使用 `uint16`，同样按第 9 章 Domain Registry 的 `DomainId` 高字节分段。少量影响 Parser 工作方式的协议级 capability 可保留在 `0x0000-0x00FF`，业务 capability 必须进入对应 domain。

| 范围 | 分类 |
|---:| --- |
| `0x0000-0x00FF` | protocol/common capability |
| `0x0100-0x01FF` | `device.*` |
| `0x0200-0x02FF` | `capability.*` |
| `0x0300-0x03FF` | `system.*` |
| `0x0400-0x04FF` | `firmware.*` |
| `0x0500-0x05FF` | `stream.*` |
| `0x0600-0x06FF` | `display.*` |
| `0x0700-0x07FF` | `camera.*` |
| `0x0800-0x08FF` | `video.*` |
| `0x0900-0x09FF` | `audio.*` |
| `0x0A00-0x0AFF` | `input.*` |
| `0x0B00-0x0BFF` | `output.*` |
| `0x0C00-0x0CFF` | `room.*` |
| `0x0D00-0x0DFF` | `signage.*` |
| `0x0E00-0x0EFF` | `network.*` |
| `0x0F00-0x0FFF` | `storage.*` |
| `0x1000-0x10FF` | `file.*` |
| `0x1100-0x11FF` | `log.*` |
| `0x1200-0x12FF` | `diagnostic.*` |
| `0x1300-0x13FF` | `sensor.*` |
| `0x1400-0x14FF` | `auth.*` |
| `0x1500-0x15FF` | `privacy.*` |
| `0x7000-0x7FFF` | `vendor.*` |
| `0x8000-0xFFFF` | reserved |

Capability 规则：
- 协议运行参数可在 `CONTROL OPEN / ACCEPT` 中协商
- v1 Core 不内置默认业务能力发现；业务能力查询必须由已采纳 method 显式定义
- Capability 不等于 Method；Method 是否可调用由 Capability 与 Method Registry 共同判断
- 每个 Capability 必须在其 Domain 内分配唯一 `bitOffset`（0-255），由 Registry 自增分配，用于 `capabilityMasks` 域级掩码响应
- `domainId` 与 MethodId 高字节对齐（如 `display.*` MethodId 为 `0x06xx`，domainId = `0x06`）

---

### 14. Schema Registry 规则

Schema 用于描述 RPC params、result、event data、Stream Profile 建流上下文、control body。

Schema 规则：
- Schema 名称必须唯一
- 同一 Schema 内 `fieldId` 不得重复
- `fieldId` 不得复用已废弃字段编号
- 所有字段类型必须来自 Type System
- TLV 编码规则遵循 `docs/specs/3-codec/03-TLV-Encoding.md`
- 字段编号规则遵循 `docs/specs/3-codec/04-Schema-Numbering.md`

---

### 15. Stream Subtype Registry 规则

STREAM 内部子类型注册表包括：`mediaType / codecId / fileType / firmwareImageType / logType / controlDataType / sensorType`

Stream Profile 规则：
- Stream Profile 表示具体可建流协议档案（`firmware.update / file.transfer / log.stream / video.stream / audio.recording`）
- 具体业务类型由 RPC 建流参数/响应和 Registry Profile 定义表达，并绑定到 `streamId`
- STREAM packet 不携带 `streamProfile` 或 metadata 字段
- 不得新增 PayloadType 来表达 video/audio/ota/file

---

### 16. Legacy Mapping 规则

老协议适配必须记录在 Registry 中。

```yaml
legacyMappings:
  - source: AXDP_HID
    legacyCmdValue: 0xC0021
    axtpMethodId: 0x0706
    axtpMethodName: video.setMode
    direction: request_response
    payload:
      legacyEncoding: fixed_struct
      axtpRpcEncoding: JSON_BINARY
      axtpBodyEncoding: TLV8
      schema: VideoSetModeParams
    statusMapping:
      legacySuccess: 0x00
      axtpSuccess: SUCCESS
```

Legacy Mapping 规则：
- 老协议 `CmdValue` 可映射为 AXTP `methodId`，但不强制数值相同
- 如果数值相同有利于迁移，可保留原 CmdValue 低 16 位作为 methodId
- 老协议固定 payload 必须映射到 AXTP Schema
- 老协议状态码必须映射到 AXTP ErrorCode

MVP 优先适配：设备信息 / 能力查询 / 显示亮度设置查询 / 视频/音频 stream 类 RPC 控制面 / 基础错误码

---

### 17. Vendor Extension 规则

- 厂商扩展不得污染 Core ID 空间
- 厂商扩展必须声明 vendorId
- 厂商扩展不得改变 Core method/event/error/capability 的语义
- 厂商扩展应使用 vendor range

---

### 18. Versioning 规则

Registry 版本采用语义化版本 `MAJOR.MINOR.PATCH`：

| 变化 | 版本变化 |
| --- |---|
| 新增 optional 字段 | MINOR |
| 新增 method/event/capability | MINOR |
| 新增 errorCode | MINOR |
| 修正文档描述，不改语义 | PATCH |
| 修改 stable 字段类型 | MAJOR，原则上禁止 |
| 修改 stable ID 语义 | MAJOR，原则上禁止 |

Protocol Version（Frame/Header/Wire Format）与 Registry Version（Method/Event/Error/Capability/Schema）相互独立。新增 methodId 不需要升级 Protocol Version。

---

### 19. Generator v1 校验规则

必须校验：

```text
ID 唯一性 / name 唯一性 / ID 范围合法性 / domain 与 ID 范围匹配
status 合法性 / schema 引用存在 / errorCode 引用存在
event 引用存在 / capability 引用存在 / legacy mapping 指向合法 method
fieldId 不重复 / fieldId 不复用 deprecated 字段
required 字段必须无 default 或具有明确 default 策略
```

---

### 20. MVP Registry 范围

#### 20.1 MVP Core

```text
PayloadType:    CONTROL / RPC / STREAM
Control Opcode: OPEN / ACCEPT / HEARTBEAT / HEARTBEAT_ACK / CLOSE / CLOSE_ACK
RPC Op:         HELLO / IDENTIFY / IDENTIFIED / EVENT / REQUEST / REQUEST_RESPONSE
RPC Encoding:   JSON / CBOR / MSGPACK / JSON_BINARY
Stream Profile: none by default; business stream profiles require adopted drafts
```

#### 20.2 Current Generated Method

```text
audio.getAlgorithmCapabilities
audio.getAlgorithmConfig / audio.setAlgorithmConfig / audio.resetAlgorithmConfig
```

#### 20.3 Current Generated Event

```text
audio.algorithmConfigChanged
```

#### 20.4 MVP ErrorCode

```text
SUCCESS / UNKNOWN_ERROR / BUSY
FRAME_VERSION_UNSUPPORTED / FRAME_CRC_ERROR / FRAME_FRAGMENT_MISSING
CONTROL_OPCODE_INVALID / CONTROL_PAYLOAD_INVALID / CONTROL_OPEN_REQUIRED / CONTROL_OPEN_REJECTED
CONTROL_NEGOTIATION_FAILED / CONTROL_SESSION_INVALID / CONTROL_RESUME_FAILED / CONTROL_WINDOW_EXCEEDED
RPC_ENCODING_UNSUPPORTED / RPC_METHOD_NOT_FOUND / RPC_PARAM_INVALID
STREAM_NOT_FOUND / STREAM_TIMEOUT / STREAM_CRC_ERROR / FW_VERIFY_FAILED
```

#### 20.5 Current Generated Capability

```text
protocol.payload.control / protocol.payload.rpc / protocol.payload.stream
audio.algorithm
```

说明：本节使用 domain-feature 治理后的主名称。旧名只允许出现在 legacy、deprecated 或 migration 说明中。

---

### 21. Registry Review 规则

新增或修改 Registry 条目时，必须检查：

```text
1. 是否已有等价方法/事件/能力
2. 是否属于正确 domain
3. ID 是否在正确范围
4. 命名是否符合 `domain.feature` 规范
5. 是否需要 schema
6. 是否需要 errorCode
7. 是否影响老协议兼容
8. 是否进入 MVP
```

---

### 22. 禁止事项

```text
在代码里硬编码未注册 methodId
复用 deprecated ID
把业务类型新增为 PayloadType
把事件直接放进 STREAM
把 ACK/NACK 做成业务 method
修改 stable 字段类型
把 optional 字段改成 required
在不同文档中手工维护不同 ID 表
老协议适配只写文字不进 legacy mapping
为 method/event 新增条目时不分配 bitOffset
```

---

### 23. 域级二进制掩码体系（Domain-Scoped Mask）

AXTP 使用统一的域级二进制掩码体系，同时应用于：

- **能力查询**：如后续采纳 capability 查询 method，可使用 method bitmap 或 `capabilityMasks`
- **事件订阅**：`IDENTIFY / REIDENTIFY` 请求中的 `eventMasks`

#### 23.1 设计原则

- 按域划分，本地偏移，按需携带，二进制扁平流传输
- 每个 method/event 在其 Domain 内分配唯一 `bitOffset`（0-255），由 Registry 自增管理
- 不同 Domain 的 bitOffset 独立计数，互不干扰
- 设备端判定为 O(1) 位运算，无动态内存分配

#### 23.2 线上格式

```text
Domain Mask Packets Chain = Domain Block × N

Domain Block = [DomainId: 1B] + [MaskLen: 1B] + [Bitmask: N B (Little-Endian)]
```

| 字段 | 长度 | 说明 |
| --- | --- | --- |
| `DomainId` | 1B | 域标识，与 MethodId/EventId 高字节对齐 |
| `MaskLen` | 1B | Bitmask 字节数（1-32），高水位截断 |
| `Bitmask` | N B | 该域的掩码，Little-Endian，Bit N 对应 bitOffset=N |

**高水位截断规则**：`MaskLen` 必须截断至最高有效字节。如果某域只用到 bitOffset=3，`MaskLen=1`，不得发送多余字节。

#### 23.3 DomainId 映射表

| DomainId | MethodId/EventId 范围 | 域名 |
| --- | --- | --- |
| `0x01` | `0x0100-0x01FF` | `device.*` |
| `0x02` | `0x0200-0x02FF` | `capability.*` |
| `0x03` | `0x0300-0x03FF` | `system.*` |
| `0x04` | `0x0400-0x04FF` | `firmware.*` |
| `0x05` | `0x0500-0x05FF` | `stream.*` |
| `0x06` | `0x0600-0x06FF` | `display.*` |
| `0x07` | `0x0700-0x07FF` | `camera.*` |
| `0x08` | `0x0800-0x08FF` | `video.*` |
| `0x09` | `0x0900-0x09FF` | `audio.*` |
| `0x0A` | `0x0A00-0x0AFF` | `input.*` |
| `0x0B` | `0x0B00-0x0BFF` | `output.*` |
| `0x0C` | `0x0C00-0x0CFF` | `room.*` |
| `0x0D` | `0x0D00-0x0DFF` | `signage.*` |
| `0x0E` | `0x0E00-0x0EFF` | `network.*` |
| `0x0F` | `0x0F00-0x0FFF` | `storage.*` |
| `0x10` | `0x1000-0x10FF` | `file.*` |
| `0x11` | `0x1100-0x11FF` | `log.*` |
| `0x12` | `0x1200-0x12FF` | `diagnostic.*` |
| `0x13` | `0x1300-0x13FF` | `sensor.*` |
| `0x14` | `0x1400-0x14FF` | `auth.*` |
| `0x15` | `0x1500-0x15FF` | `privacy.*` |
| `0x70-0x7F` | vendor | `vendor.*` |

#### 23.4 JSON 编码

在 JSON/WebSocket 模式下，Domain Mask Packets Chain 序列化为 Hex 字符串：

```json
{
  "eventMasks": "8501018B0103",
  "capabilityMasks": "010107050101"
}
```

#### 23.5 C++ 解析（通用）

```cpp
bool isBitEnabled(const uint8_t* bitmask, uint8_t maskLen, uint8_t bitOffset) {
    uint8_t byteIndex = bitOffset / 8;
    uint8_t bitIndex  = bitOffset % 8;
    if (byteIndex >= maskLen) return false;
    return (bitmask[byteIndex] & (1 << bitIndex)) != 0;
}
```

同一函数适用于 `eventMasks` 和 `capabilityMasks` 的解析，无需区分。

#### 23.6 Registry 要求

新增 method/event 条目时必须：

1. 在 YAML 中填写 `domainId` 和 `bitOffset`
2. `bitOffset` 在同一 Domain 内自增，不得重复
3. 废弃的 `bitOffset` 不得复用（标记 `deprecated: true` 后保留占位）
4. Generator 必须校验同一 Domain 内无 `bitOffset` 冲突
