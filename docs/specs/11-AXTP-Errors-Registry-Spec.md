# 11《AXTP Errors Registry Spec》

> Status: AXTP v1 Protocol Definition Meta Spec
> Spec Version: 1.0.0-rc1
> Scope: `errors:` entries, errorCode allocation, JSON-RPC and Binary status mapping

版本：v1.0.0-rc1
状态：Protocol Definition 元规范
适用范围：`registry/error/` 与 `registry/domains/<domain>/domain.yaml` 中 error 源条目的字段、分段、映射和生成规则

---

## 1. 文档定位

本文档只定义 error registry 的元模型，不手写完整错误码清单。具体 error 内容必须写入 `registry/error/` 或 `registry/domains/<domain>/domain.yaml`；`protocol/axtp.protocol.yaml` 中的 `errors:` 由 Generator 聚合生成。

新增业务专属 error 默认写入 `registry/domains/<domain>/domain.yaml`。只有跨 domain 复用、Core/MVP 已采纳或基础协议层错误，才写入 `registry/error/error_code.yaml`。晋升时必须迁移并删除 domain 中的原条目，不得两边重复定义。

---

## 2. errors 条目结构

```yaml
errors:
  - name: INVALID_PARAMS
    code: 0x030B
    category: rpc
    severity: error
    message: Invalid parameters.
    retryable: false
    since: 1.0.0
    status: stable
```

---

## 3. 字段定义

| 字段 | 必填 | 说明 |
|---|---:|---|
| `name` | 是 | 全大写枚举名 |
| `code` | 是 | uint16 errorCode / statusCode |
| `category` | 是 | `common / frame / control / rpc / stream / business / firmware / vendor / legacy` |
| `severity` | 是 | `info / warning / error / fatal` |
| `message` | 是 | 默认英文错误描述 |
| `retryable` | 是 | 是否建议客户端重试 |
| `since` | 是 | 首次引入版本 |
| `status` | 是 | `draft / stable / deprecated / reserved` |

---

## 4. 错误码分段

| 范围 | Category | 用途 |
|---:|---|---|
| `0x0000-0x00FF` | common | 通用结果 |
| `0x0100-0x01FF` | frame | Frame 解析、CRC、分片 |
| `0x0200-0x02FF` | control | OPEN / ACCEPT / ACK / NACK / RESUME |
| `0x0300-0x03FF` | rpc | RPC 编码、method、参数 |
| `0x0400-0x04FF` | stream | STREAM session、seq、resume、CRC |
| `0x0500-0x6FFF` | business | 业务域错误 |
| `0x7000-0x7EFF` | vendor | 厂商扩展 |
| `0x7F00-0x7FFF` | legacy | Legacy Adapter |

---

## 5. 映射规则

| 场景 | 映射 |
|---|---|
| Control | `Control.statusCode = errors[].code` |
| Binary RPC | `BinaryRpcHeader.statusCode = errors[].code` |
| JSON-RPC | `status.code = errors[].code`，`status.message = errors[].message` |
| STREAM NACK | `Control.statusCode` 或 `reasonCode` 引用对应 stream error |

Control NACK 应优先使用 frame/control/stream 类错误；业务失败应通过 RPC Response 或 RPC Event 表达，不得用 Frame Header 字段表达。

Legacy Adapter 必须把旧状态码映射到 `errors[].code`，映射表作为 legacy source 维护，不得在运行时代码中散落硬编码。

---

## 6. 稳定性规则

1. `code` 在所有 errors 中必须唯一。
2. `name` 在所有 errors 中必须唯一。
3. stable errorCode 不得复用。
4. reserved code 不得用于新错误。
5. deprecated error 仍应生成 enum，便于旧客户端兼容。
6. 新增错误不应修改 08-13，只修改 `registry/` 或 `registry/domains/` YAML。
