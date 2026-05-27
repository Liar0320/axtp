---
name: axtp-add-domain
description: 引导新增 AXTP 业务逻辑，逐步确认协议要素，生成 YAML Registry 条目和文档更新
version: 1.0.0
source: axtp-repo
---

# AXTP 新增业务逻辑

用户描述业务需求后，按步骤逐项确认所有协议要素，最终生成可提交的 YAML 条目和文档更新。

## 触发条件

用户说以下任意一种：
- "我需要增加 X 业务"
- "新增 Y 功能"
- "添加 Z 控制"
- "增加一个 ... 的业务逻辑"

## 引导流程

**每步等待用户回答后再进行下一步，不要一次性列出所有问题。**

---

### Step 1：业务描述

用一句话确认：这个业务做什么？谁发起调用（Client），谁响应（Device）？

示例提问：
> 请描述一下这个业务的核心功能，比如"客户端设置设备音量，设备执行并返回当前音量"。

---

### Step 2：Domain 归属

对照以下 Domain 表，确认属于哪个 domain：

| Domain | 说明 |
| --- | --- |
| `device` | 设备基础信息与生命周期 |
| `capability` | 能力查询与协商 |
| `system` | 系统控制：重启、时间同步、重置、功耗 |
| `firmware` | 固件升级控制面 |
| `stream` | 流控制面 |
| `display` | 显示控制：亮度、分辨率、旋转、布局、输入源 |
| `camera` | 摄像头：变焦、追踪、镜像、帧率 |
| `video` | 视频编码与输出控制 |
| `audio` | 音频控制 |
| `input` | 输入源管理、KVM、HID |
| `network` | 网络配置 |
| `storage` | 存储管理 |
| `file` | 文件传输控制面 |
| `log` | 日志控制 |
| `diagnostic` | 诊断 / 产测 |
| `sensor` | 传感器 |
| `auth` | 认证与访问控制 |
| `vendor` | 厂商私有扩展 |

如果不属于任何已有 domain，需要新增 domain 并分配 ID 范围。

---

### Step 3：Method 命名

按 `domain.verbObject` 格式命名，camelCase。

推荐动词：`get / set / list / open / close / start / stop / begin / end / verify / apply / abort / resume`

示例：`audio.setVolume`、`display.setBrightness`、`firmware.begin`

---

### Step 4：请求参数

列出所有入参字段：
- 字段名（camelCase）
- 类型（uint8/uint16/uint32/uint64/string/bool/bytes）
- 是否必填
- 说明

---

### Step 5：响应结果

列出所有返回字段（同上格式）。如果只返回成功/失败，可以填"无业务字段，只返回 statusCode"。

---

### Step 6：异步事件（可选）

是否有异步状态变化需要上报？如有，命名为 `domain.objectChanged` 或 `domain.actionCompleted`。

示例：`audio.volumeChanged`、`firmware.updateCompleted`

---

### Step 7：错误码

可能返回哪些错误？从以下常用错误码中选，或说明需要新增：

| 错误码 | 说明 |
| --- | --- |
| `RPC_PARAM_INVALID` | 参数无效 |
| `OUT_OF_RANGE` | 参数越界 |
| `BUSY` | 设备忙 |
| `NOT_SUPPORTED` | 当前设备不支持 |
| `INVALID_STATE` | 当前状态不允许执行 |
| `PERMISSION_DENIED` | 权限不足 |

---

### Step 8：Capability 声明

设备能力名称，用于 `capability.getAll` 发现。格式：`domain.featureName`。

示例：`audio.volume`、`display.brightness`

---

### Step 9：MVP 范围

是否进入 MVP（影响 Generator 是否立即生成 C++ 代码）？

- `mvp: true` — 进入 MVP，Generator 立即生成
- `mvp: false` — 暂缓，预留 schema 但不生成代码

---

### Step 10：老协议映射（可选）

是否有对应的旧 CmdValue 需要映射？如有，提供旧协议的命令值（如 `0xC0021`）和旧字段名。

---

## 生成产物

确认完所有步骤后，生成以下内容：

### `standard/registry/method_registry.yaml` 新增条目

```yaml
- id: 0x{XXXX}          # 从对应 domain 范围取下一个可用 ID
  name: {domain}.{method}
  domain: {domain}
  status: draft
  rpc_op: request_response
  request_schema: {PascalCase}Request
  response_schema: {PascalCase}Response
  recommended_encoding: [json, binary_tlv]
  capabilities: [{domain}.{feature}]
  events: [{domain}.{objectChanged}]
  errors: [SUCCESS, {error1}, {error2}]
  legacy:
    cmd_value: null
    name: null
    payload_format: null
```

### `standard/registry/event_registry.yaml` 新增条目（如有事件）

```yaml
- id: 0x{XXXX}          # 从对应 domain 事件范围取下一个可用 ID
  name: {domain}.{eventName}
  domain: {domain}
  status: draft
  event_schema: {PascalCase}Event
  severity: info
  trigger: [{domain}.{method}]
  capabilities: [{domain}.{feature}]
```

### `standard/registry/capability_registry.yaml` 新增条目

```yaml
- id: 0x{XXXX}
  name: {domain}.{feature}
  domain: {domain}
  status: draft
  type: bool
  description: {描述}
```

### `standard/docs/03-registry/09-AXTP-MethodId注册表-v2.md` 对应段落更新

在对应 domain 段落追加新方法的 Markdown 表格行。

---

## MethodId / EventId 范围速查

| Domain | MethodId 范围 | EventId 范围 |
| --- | --- | --- |
| `device` | `0x0100-0x01FF` | `0x8100-0x81FF` |
| `capability` | `0x0300-0x03FF` | `0x8300-0x83FF` |
| `system` | `0x0400-0x04FF` | `0x8400-0x84FF` |
| `display` | `0x0500-0x05FF` | `0x8500-0x85FF` |
| `camera` | `0x0600-0x06FF` | `0x8600-0x86FF` |
| `video` | `0x0700-0x07FF` | `0x8700-0x87FF` |
| `audio` | `0x0800-0x08FF` | `0x8800-0x88FF` |
| `stream` | `0x0900-0x09FF` | `0x8900-0x89FF` |
| `file` | `0x0A00-0x0AFF` | `0x8A00-0x8AFF` |
| `firmware` | `0x0B00-0x0BFF` | `0x8B00-0x8BFF` |
| `log` | `0x0C00-0x0CFF` | `0x8C00-0x8CFF` |
| `diagnostic` | `0x0D00-0x0DFF` | `0x8D00-0x8DFF` |
| `network` | `0x0E00-0x0EFF` | `0x8E00-0x8EFF` |
| `storage` | `0x0F00-0x0FFF` | `0x8F00-0x8FFF` |
| `input` | `0x1000-0x10FF` | `0x9000-0x90FF` |
| `sensor` | `0x1100-0x11FF` | `0x9100-0x91FF` |
| `auth` | `0x1200-0x12FF` | `0x9200-0x92FF` |
| `vendor` | `0x7000-0x7FFF` | `0xF000-0xFFFF` |

---

## 生成后的下一步

1. 检查 ID 是否与现有 registry 冲突（`grep -n "0x{XXXX}" standard/registry/*.yaml`）
2. 在 `standard/schema/` 下新增对应的 schema YAML（参考 `display_schema.yaml` 格式）
3. 运行 Generator 验证：`cd standard/generator && pnpm validate`
4. 生成代码：`pnpm generate`
5. 提交：`git add standard/registry/ standard/schema/ standard/docs/ && git commit -m "feat: add {domain}.{method} method"`
