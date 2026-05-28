# 08《AXTP Protocol Definition Mapping Spec》

> Status: AXTP v1 Protocol Definition Meta Spec
> Spec Version: 1.0.0-rc1
> Scope: Protocol Definition mapping rules, generated protocol layout, compiler contract

版本：v1.0.0-rc1
状态：Protocol Definition 元规范
适用范围：`protocol/axtp.protocol.yaml` 的顶层结构、JSON-RPC 到 Binary-RPC 的映射、生成 `generated/protocol.md` 的规则

---

## 1. 文档定位

本文档定义 AXTP Protocol Definition 的元模型。08-13 文档只规定规则和约束，不再手写具体业务 request、event、error、type 或 profile 清单。

具体协议内容必须进入：

```text
protocol/axtp.protocol.yaml
```

旧协议和全量业务参考材料放入：

```text
protocol-source/
```

生成产物放入：

```text
generated/
```

---

## 2. Protocol Definition 顶层结构

`axtp.protocol.yaml` 必须包含以下顶层块：

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

`generated/protocol.md` 不得只是注册表清单，必须包含 Overview 与 Reference 两部分。

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
axtpc validate protocol/axtp.protocol.yaml
axtpc build protocol/axtp.protocol.yaml
axtpc emit docs
axtpc emit schema
axtpc emit cpp
axtpc emit ts
axtpc emit bitmap
axtpc emit conformance
```

---

## 7. 稳定性规则

1. 08-13 是 Normative Core 元规范，长期稳定。
2. 新增业务 method/event/error/profile 不应修改 08-13，只修改 `protocol/axtp.protocol.yaml`。
3. generated 目录下文件不得手写修改。
4. CI 必须验证 ID 唯一性、引用完整性、schema 完整性、bitmap 一致性和 stable ID 不复用。
