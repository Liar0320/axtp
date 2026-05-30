# 08《AXTP Protocol Definition Mapping Spec》

> Status: AXTP v1 Protocol Definition Meta Spec
> Spec Version: 1.0.0-rc1
> Scope: Protocol Definition mapping rules, generated protocol layout, compiler contract

版本：v1.0.0-rc1
状态：Protocol Definition 元规范
适用范围：Registry/Domain YAML 到 `protocol/axtp.protocol.yaml` 的映射、JSON-RPC 到 Binary-RPC 的映射、生成 `docs/generated/protocol.md` 的规则

---

## 1. 文档定位

本文档定义 AXTP Protocol Definition 的元模型和三段式生成链路。08-13 文档只规定规则和约束，不再手写具体业务 request、event、error、type 或 profile 清单。

具体协议内容必须进入机器事实源：

```text
registry/**/*.yaml
registry/domains/**/*.yaml
```

聚合后的 Protocol IR 由 Generator 输出到：

```text
protocol/axtp.protocol.yaml
```

生成产物放入：

```text
docs/generated/
runtimes/*/generated/
tooling/*/
```

旧 08-13 文档中的内容按以下规则分流：

| 内容类型 | 归属 |
|---|---|
| 二进制线格式、Header、Payload 固定头 | 02 / 04 / 05 / 06 |
| Transport/Profile 固定绑定 | 03 |
| OPEN / ACCEPT / READY | 04 |
| Hello / Identify / RPC / EVENT | 05 |
| STREAM Header / resume | 06 |
| 旧协议兼容映射 | 07 与 `docs/source/` legacy 材料 |
| 完整 Capability Model | `docs/source/AXTP-Capability-Model-v2.md` |
| method/event/error/type/profile entry 元模型 | 09-13 |
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

08-13 元规范不得重新定义 wire header 字段，也不得手写完整业务表。

---

## 2.1 三段式输入输出关系

```text
docs/specs/08-13 + docs/source/09-13 + 业务需求
        ↓
registry/**/*.yaml + registry/domains/**/*.yaml
        ↓
protocol/axtp.protocol.yaml
        ↓
docs/generated/protocol.md + protocol.json + SDK/bitmap/test-vector
```

- `registry/` 保存核心常量、公共 schema、MVP 已采纳条目和 legacy 映射。
- `registry/domains/` 保存新增业务域的扩展 YAML，是新增业务的默认入口。
- 新增业务事实不得同时写入 core registry 与 domain YAML；domain 业务晋升为 MVP/Core 时，必须迁移而不是复制。
- `registry/core/protocol_meta.yaml` 保存 overview、frameProfiles、transports、payloadTypes、control、stream、compatibility 等非业务 IR 输入。
- `protocol/axtp.protocol.yaml` 不得手写修改；任何变更必须回到 `registry/` 或 `registry/domains/`。

---

## 3. JSON-RPC 到 Binary-RPC 映射

| JSON-RPC 概念 | Binary-RPC 字段 | 规则 |
|---|---|---|
| method name | methodId | 从 `methods[].methodId` 生成，稳定后不得复用 |
| request id | requestId | 映射为 uint32，Little-Endian |
| params | body | 按 request type 生成 TLV / CBOR / FixedStruct |
| result | body | 按 response type 生成 TLV / CBOR / FixedStruct |
| event name | eventId | 从 `events[].eventId` 生成 |
| error code | statusCode / errorCode | 从 `errors[].code` 生成 |

Binary-RPC Header 固定 11B。JSON / CBOR / MessagePack 模式不使用 Binary 11B Header。

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
| `RAW_BYTES` | Legacy 过渡字段 |

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

1. 08-13 是 Normative Core 元规范，长期稳定。
2. 新增业务 method/event/error/profile 不应修改 08-13，只修改 `registry/` 或 `registry/domains/` YAML。
3. `protocol/axtp.protocol.yaml` 与 generated 目录下文件不得手写修改。
4. CI 必须验证 ID 唯一性、引用完整性、schema 完整性、bitmap 一致性和 stable ID 不复用。
