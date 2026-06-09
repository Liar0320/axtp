# AXTP system.reset 协议草案

版本：v0.3

归属域：`system`

Capability ID：`system.reset`

适用范围：系统恢复默认、软重置到出厂设置、重置状态读取和重置状态变化通知；不包含用于异常恢复的运行时状态重置。

---

## 协议审核标记（人工复核）

| 标记 | 条目 | 审核结论 | 后续动作 |
|---|---|---|---|
| `[REVIEW-OK]` | domain.feature | `system.reset` 表达设备级恢复默认/恢复出厂/软重置，属于 system 层，不属于 `device.info`。 | 可作为 `registry/domains/system/domain.yaml` 草案输入。 |
| `[REVIEW-OK]` | runtime state reset 边界 | “重置设备状态”若用于 MCU、runtime service 或控制器异常恢复，归 `system.state` 的 `system.resetState`。 | 本文只承载 restore-default / factory settings soft reset 方向。 |
| `[REVIEW-DRAFT]` | factory settings soft reset | “重置设备为出厂设置状态”建模为 `system.resetDevice`，mode 使用 `factory_settings`；默认保留硬件身份。 | 采纳前确认会清除哪些配置和数据。 |
| `[REVIEW-ASK]` | identity preservation | factory settings reset 后是否必须保留 `deviceId`、SN、vendorId、productId、license、绑定关系和网络配置需确认。 | 采纳前补字段默认值和权限策略。 |
| `[REVIEW-ASK]` | legacy 映射 | legacy 映射需从 `docs/legacy-migration/classification/` 中按 `target_capability` 筛选后人工确认。 | 落 registry 前补充确定的旧协议命令、字段路径和覆盖状态。 |

---

## 1. 文档定位

本文是 `docs/flows/device-system-info.md` 的 Stage 20 协议草案输入，不是最终协议事实源。采纳后，稳定事实必须写入 `registry/domains/system/domain.yaml` 或相关 registry YAML，再由 Generator 生成 `protocol/axtp.protocol.yaml` 和 `docs/generated/*`。

当前 generated 协议没有 adopted `system.reset` 方法；本文中的方法名和字段均为草案候选，数值 ID 使用 `TBD after adoption`。

## 2. 业务需求

| 项 | 内容 |
|---|---|
| 需求来源 | `docs/business/device-system-info.md` 新增“重置设备为出厂设置状态，属于软重置的一种”。 |
| 目标用户 | App / PC host / cloud console / device management service。 |
| 目标行为 | 管理者可在确认权限和危险操作提示后，将设备软重置为出厂设置状态；App 可查询重置能力、重置进度和最终状态。 |
| 当前实现程度 | Drafted only；原草案是泛配置型模板，本版改为设备 reset 动作和状态协议。 |

## 3. Domain 边界

| 项 | 决策 |
|---|---|
| Domain | `system` |
| Feature | `system.reset` |
| Capability | `system.reset` |
| 负责 | reset capabilities、factory settings soft reset、restore default settings、reset state、reset progress event。 |
| 不属于本文 | MCU/runtime/controller 异常恢复属于 `system.resetState`；立即重启/关机属于 `system.lifecycle`；power off 属于 `system.power`；首次初始化向导属于 `system.initialization`；设备身份读取属于 `device.info`。 |

## 4. 协议决策

| 决策点 | 结论 | 理由 |
|---|---|---|
| 新增/修改/复用 | Modify existing draft | 复用 `system.reset` capability，但替换泛配置型模板。 |
| 能力查询 | `system.getResetCapabilities` | App 需要知道设备支持哪些 reset mode、是否会断连、是否需要重启。 |
| 状态查询 | `system.getResetState` | reset 可能异步执行，重连后需要校准进度和结果。 |
| 动作 | `system.resetDevice` | 恢复出厂/软重置是危险动作，不应使用 `setResetConfig` 表达。 |
| Event | `system.resetStateChanged` | 上报 accepted、resetting、rebooting、completed、failed 等状态。 |

## 5. 候选 Capability

| Capability | 状态 | 说明 |
|---|---|---|
| `system.reset` | draft | 设备级恢复默认/恢复出厂/软重置和状态变化通知。 |

## 6. 候选 Methods

| Method | Params Schema | Result Schema | 说明 | Review |
|---|---|---|---|---|
| `system.getResetCapabilities` | `GetResetCapabilitiesParams` | `ResetCapabilities` | 查询支持的 reset mode、scope、保留项和危险操作要求。 | `[REVIEW-DRAFT]` |
| `system.getResetState` | `GetResetStateParams` | `ResetState` | 查询当前或最近一次 reset 状态。 | `[REVIEW-DRAFT]` |
| `system.resetDevice` | `ResetDeviceParams` | `ResetDeviceResult` | 请求设备软重置到指定模式，含 factory settings。 | `[REVIEW-DRAFT]` |

## 7. 候选 Events

| Event | Schema | 触发时机 | Review |
|---|---|---|---|
| `system.resetStateChanged` | `ResetStateChangedEvent` | reset accepted、resetting、rebooting、completed、failed 或状态恢复。 | `[REVIEW-DRAFT]` |

## 8. 候选 Schemas

### `GetResetCapabilitiesParams`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `includeScopes` | boolean | no | 是否返回支持的 reset scope；默认 `true`。 | `[REVIEW-DRAFT]` |

### `ResetCapabilities`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `supportedModes` | string[] | yes | 支持的 reset mode，例如 `factory_settings` / `default_settings` / `custom`。 | `[REVIEW-ASK]` |
| `supportedScopes` | string[] | no | 支持的 reset scope，例如 `settings` / `user_data` / `apps` / `network` / `all`。 | `[REVIEW-ASK]` |
| `supportsSoftReset` | boolean | yes | 是否支持软件发起 reset。 | `[REVIEW-OK]` |
| `requiresConfirmation` | boolean | yes | 是否需要危险操作确认 token。 | `[REVIEW-DRAFT]` |
| `disconnectExpected` | boolean | no | reset 过程是否预期断连。 | `[REVIEW-DRAFT]` |
| `rebootExpected` | boolean | no | reset 后是否预期重启。 | `[REVIEW-DRAFT]` |
| `preservableFields` | string[] | no | 可选择保留的字段，例如 `identity` / `license` / `network` / `binding`。 | `[REVIEW-ASK]` |

### `GetResetStateParams`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `includeLastResult` | boolean | no | 是否返回最近一次 reset 结果；默认 `true`。 | `[REVIEW-DRAFT]` |

### `ResetState`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `state` | string enum | yes | `idle` / `accepted` / `resetting` / `rebooting` / `completed` / `failed` / `unknown`。 | `[REVIEW-ASK]` |
| `actionId` | string | no | 当前或最近一次 reset 动作 ID。 | `[REVIEW-DRAFT]` |
| `mode` | string enum | no | `factory_settings` / `default_settings` / `custom`。 | `[REVIEW-ASK]` |
| `scopes` | string[] | no | 当前或最近一次 reset 覆盖范围。 | `[REVIEW-DRAFT]` |
| `progressPercent` | uint8 | no | 0 到 100 的进度；设备无法提供时省略。 | `[REVIEW-DRAFT]` |
| `disconnectExpected` | boolean | no | 是否预期断连。 | `[REVIEW-DRAFT]` |
| `rebootExpected` | boolean | no | 是否预期重启。 | `[REVIEW-DRAFT]` |
| `startedAt` | string timestamp | no | reset 开始时间。 | `[REVIEW-DRAFT]` |
| `updatedAt` | string timestamp | no | 状态更新时间。 | `[REVIEW-DRAFT]` |
| `lastError` | object | no | 最近一次失败错误摘要。 | `[REVIEW-DRAFT]` |

### `ResetDeviceParams`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `mode` | string enum | yes | reset 模式；新增需求使用 `factory_settings`。 | `[REVIEW-DRAFT]` |
| `scopes` | string[] | no | reset 范围；省略表示 mode 默认范围。 | `[REVIEW-ASK]` |
| `preserve` | string[] | no | 请求保留的内容，例如 `identity` / `license` / `network` / `binding`。 | `[REVIEW-ASK]` |
| `reason` | string | no | 调用方给出的原因。 | `[REVIEW-DRAFT]` |
| `rebootAfterReset` | boolean | no | reset 后是否重启；默认由设备能力决定。 | `[REVIEW-DRAFT]` |
| `confirmationToken` | string | no | 危险操作确认 token。 | `[REVIEW-ASK]` |

### `ResetDeviceResult`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `accepted` | boolean | yes | 是否接受 reset 请求。 | `[REVIEW-OK]` |
| `actionId` | string | no | reset 动作 ID。 | `[REVIEW-DRAFT]` |
| `state` | `ResetState` | yes | 接受后的 reset 状态。 | `[REVIEW-DRAFT]` |
| `disconnectExpected` | boolean | yes | 连接是否预期断开。 | `[REVIEW-DRAFT]` |
| `estimatedDelaySeconds` | uint32 | no | 预估完成或重启延迟。 | `[REVIEW-DRAFT]` |

### `ResetStateChangedEvent`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `state` | `ResetState` | yes | 变化后的 reset 状态。 | `[REVIEW-DRAFT]` |
| `actionId` | string | no | 关联 reset 动作 ID。 | `[REVIEW-DRAFT]` |
| `reason` | string enum | no | `user_request` / `factory_settings` / `default_settings` / `system` / `error`。 | `[REVIEW-ASK]` |

## 9. JSON 示例

示例只写 RPC `d` 数据块，不包裹外层 `sid` / `op` / `d` wire envelope。

### `system.getResetCapabilities` request

```json
{
  "id": 70,
  "method": "system.getResetCapabilities",
  "params": {
    "includeScopes": true
  }
}
```

### `system.getResetCapabilities` response

```json
{
  "id": 70,
  "status": {
    "ok": true,
    "code": 0
  },
  "result": {
    "supportedModes": ["factory_settings", "default_settings"],
    "supportedScopes": ["settings", "user_data", "network", "all"],
    "supportsSoftReset": true,
    "requiresConfirmation": true,
    "disconnectExpected": true,
    "rebootExpected": true,
    "preservableFields": ["identity", "license", "network", "binding"]
  }
}
```

### `system.resetDevice` request

```json
{
  "id": 71,
  "method": "system.resetDevice",
  "params": {
    "mode": "factory_settings",
    "scopes": ["settings", "user_data"],
    "preserve": ["identity"],
    "reason": "device_reassignment",
    "rebootAfterReset": true,
    "confirmationToken": "TOKEN-REDACTED"
  }
}
```

### `system.resetDevice` response

```json
{
  "id": 71,
  "status": {
    "ok": true,
    "code": 0
  },
  "result": {
    "accepted": true,
    "actionId": "act-REDACTED",
    "state": {
      "state": "accepted",
      "actionId": "act-REDACTED",
      "mode": "factory_settings",
      "scopes": ["settings", "user_data"],
      "disconnectExpected": true,
      "rebootExpected": true,
      "updatedAt": "2026-06-09T10:30:00Z"
    },
    "disconnectExpected": true,
    "estimatedDelaySeconds": 30
  }
}
```

### `system.resetStateChanged` event

```json
{
  "event": "system.resetStateChanged",
  "intent": 1,
  "data": {
    "actionId": "act-REDACTED",
    "reason": "factory_settings",
    "state": {
      "state": "resetting",
      "actionId": "act-REDACTED",
      "mode": "factory_settings",
      "progressPercent": 40,
      "disconnectExpected": true,
      "rebootExpected": true,
      "updatedAt": "2026-06-09T10:30:10Z"
    }
  }
}
```

### failure response

```json
{
  "id": 71,
  "status": {
    "ok": false,
    "code": 7,
    "msg": "Permission denied.",
    "details": {
      "candidateError": "SYSTEM_RESET_PERMISSION_DENIED"
    }
  }
}
```

## 10. 候选 Errors

| Error | 类别 | 说明 | Review |
|---|---|---|---|
| `SYSTEM_RESET_NOT_SUPPORTED` | system | 当前设备不支持请求的 reset mode 或 scope；JSON 示例可使用 `NOT_SUPPORTED`。 | `[REVIEW-DRAFT]` |
| `SYSTEM_RESET_PERMISSION_DENIED` | system | 无权执行设备 reset；JSON 示例可使用 `PERMISSION_DENIED`。 | `[REVIEW-DRAFT]` |
| `SYSTEM_RESET_CONFIRMATION_REQUIRED` | system | 缺少危险操作确认 token。 | `[REVIEW-ASK]` |
| `SYSTEM_RESET_BUSY` | system | 已有 reset/lifecycle/power 动作进行中；JSON 示例可使用 `BUSY`。 | `[REVIEW-DRAFT]` |
| `SYSTEM_RESET_INVALID_SCOPE` | system | 请求的 mode、scope 或 preserve 字段非法；JSON 示例可使用 `INVALID_ARGUMENT`。 | `[REVIEW-DRAFT]` |

## 11. Legacy 待映射

| 来源 | 旧协议条目 | 候选映射 | 状态 | 说明 |
|---|---|---|---|---|
| AXDP / Rooms / VM33 / Signage | `ResetConfig` / restore factory-like 命令 | `system.resetDevice(mode=factory_settings/default_settings)` | `[REVIEW-ASK]` | 需确认旧命令是恢复默认配置、恢复出厂，还是只清某一类配置。 |
| NearHub Launcher / MCU | 状态恢复类 reset | `system.resetState` | `[REVIEW-OK]` | 运行时异常恢复不进入本文。 |

## 12. Registry 草案输入

```yaml
capabilities:
  - id: system.reset
    name: system.reset capability
    status: draft
    methods:
      - system.getResetCapabilities
      - system.getResetState
      - system.resetDevice
    events:
      - system.resetStateChanged

methods:
  - name: system.getResetCapabilities
    id: TBD after adoption
    bitOffset: TBD after adoption
    domain: system
    requestSchema: GetResetCapabilitiesParams
    responseSchema: ResetCapabilities
    capabilities:
      - system.reset
  - name: system.getResetState
    id: TBD after adoption
    bitOffset: TBD after adoption
    domain: system
    requestSchema: GetResetStateParams
    responseSchema: ResetState
    capabilities:
      - system.reset
  - name: system.resetDevice
    id: TBD after adoption
    bitOffset: TBD after adoption
    domain: system
    requestSchema: ResetDeviceParams
    responseSchema: ResetDeviceResult
    capabilities:
      - system.reset

events:
  - name: system.resetStateChanged
    id: TBD after adoption
    bitOffset: TBD after adoption
    domain: system
    eventSchema: ResetStateChangedEvent
    capabilities:
      - system.reset
```

## 13. 采纳检查清单

- [ ] 08 已确认 `system.reset` 与 `system.state.resetState` 的边界。
- [ ] 10 已确认 `system.getResetCapabilities` / `system.getResetState` / `system.resetDevice` 的 methodId、bitOffset 和 schema。
- [ ] 11 已确认 `system.resetStateChanged` 的 eventId、eventMasks bitOffset 和断连前事件策略。
- [ ] 12 已确认权限、busy、confirmation required 的错误码策略。
- [ ] 13 已确认 reset mode/scope/preserve enum 和 fieldId。
- [ ] legacy ResetConfig / restore factory-like 命令已确定映射 scope 后再写入 YAML。

## 14. 待确认问题

1. `factory_settings` 是否清除网络配置、license、绑定关系、用户数据和应用数据？
2. reset 后是否必须重启，还是由设备能力决定？
3. `deviceId`、SN、vendorId、productId 是否永远保留？
4. `preserve` 字段是否允许调用方选择，还是只能由设备固定策略决定？
5. factory settings reset 是否可能清除 AXTP 连接凭据，导致 App 需要重新配网/重新绑定？
