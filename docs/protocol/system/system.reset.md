# AXTP system.reset 协议草案

版本：v0.6

归属域：`system`

Capability ID：`system.reset`

适用范围：系统恢复默认配置、恢复出厂设置、reset 能力查询、reset 状态查询和 reset 状态变化通知；不包含用于异常恢复的运行时状态恢复。

---

## 协议审核标记（人工复核）

| 标记 | 条目 | 审核结论 | 后续动作 |
|---|---|---|---|
| `[REVIEW-OK]` | domain.feature | `system.reset` 表达设备级恢复默认/恢复出厂/软重置能力，属于 system 层，不属于 `device.info`。 | 可作为 `registry/domains/system/domain.yaml` 草案输入。 |
| `[REVIEW-OK]` | runtime recovery 边界 | “重置设备状态”若用于 MCU、runtime service 或控制器异常恢复，归 `system.state` 的 `system.recoverRuntimeState`。 | 本文只承载 restore default / restore factory settings 方向。 |
| `[REVIEW-OK]` | method naming | 设备级恢复默认/恢复出厂使用 `restoreDefaultSettings` / `restoreFactorySettings`，避免和运行时状态恢复混淆。 | 采纳前确认 schema 和权限策略。 |
| `[REVIEW-OK]` | default vs factory baseline | `restoreDefaultSettings` 恢复到当前已安装版本的默认配置；`restoreFactorySettings` 恢复到设备出厂基线，可包含 Launcher 等软件组件回退到出厂初始版本。 | 采纳前确认每个产品的 factory baseline 和可回退组件。 |
| `[REVIEW-DRAFT]` | factory settings restore | “重置设备为出厂设置状态”建模为 `system.restoreFactorySettings`；默认保留硬件身份。 | 采纳前确认会清除哪些配置和数据。 |
| `[REVIEW-ASK]` | identity preservation | factory settings reset 后是否必须保留 `deviceId`、SN、vendorId、productId、license、绑定关系和网络配置需确认。 | 采纳前补字段默认值和权限策略。 |
| `[REVIEW-ASK]` | legacy 映射 | legacy 映射需从 `docs/legacy-migration/classification/` 中按 `target_capability` 筛选后人工确认。 | 落 registry 前补充确定的旧协议命令、字段路径和覆盖状态。 |

---

## 1. 文档定位

本文是 `docs/flows/device-system-info.md` 的 Stage 20 协议草案输入，不是最终协议事实源。采纳后，稳定事实必须写入 `registry/domains/system/domain.yaml` 或相关 registry YAML，再由 Generator 生成 `protocol/axtp.protocol.yaml` 和 `docs/generated/*`。

当前 generated 协议没有 adopted `system.reset` 方法；本文中的方法名和字段均为草案候选，数值 ID 使用 `TBD after adoption`。

## 2. 业务需求

| 项 | 内容 |
|---|---|
| 需求来源 | `docs/business/device-system-info.md` 新增“重置设备为出厂设置状态，属于软重置的一种”；命名评审要求区分 recover runtime state、restore default settings 和 restore factory settings；本轮补充 default/factory baseline 差异。 |
| 目标用户 | App / PC host / cloud console / device management service。 |
| 目标行为 | 管理者可查询 reset 能力和状态，并在确认权限和危险操作提示后，将设备恢复默认配置或恢复出厂设置。 |
| 当前实现程度 | Drafted only；本版将设备级重置命名拆成 `restoreDefaultSettings` / `restoreFactorySettings`。 |

## 3. Domain 边界

| 项 | 决策 |
|---|---|
| Domain | `system` |
| Feature | `system.reset` |
| Capability | `system.reset` |
| 负责 | reset capabilities、reset status、restore default settings、restore factory settings、reset status event。 |
| 不属于本文 | MCU/runtime/controller 异常恢复属于 `system.recoverRuntimeState`；立即重启/关机和计划任务属于 `system.lifecycle`；首次初始化向导属于 `system.initialization`；设备身份读取属于 `device.info`。 |

## 4. 协议决策

| 决策点 | 结论 | 理由 |
|---|---|---|
| 新增/修改/复用 | Modify existing draft | 复用 `system.reset` capability，但收敛具体方法命名。 |
| 能力查询 | `system.getResetCapabilities` | App 需要知道设备支持哪些 restore action、是否会断连、是否需要重启。 |
| 状态查询 | `system.getResetStatus` | restore 可能异步执行，重连后需要校准进度和结果。 |
| 默认配置恢复 | `system.restoreDefaultSettings` | 表达“恢复默认配置”，范围小于 factory settings。 |
| 出厂设置恢复 | `system.restoreFactorySettings` | 表达“恢复出厂设置/软重置”，危险级别更高。 |
| Event | `system.resetStatusChanged` | 上报 accepted、restoring、rebooting、completed、failed 等状态。 |

### 4.1 Default Settings 与 Factory Settings 的关系

| 项 | `system.restoreDefaultSettings` | `system.restoreFactorySettings` |
|---|---|---|
| 基线 | 当前已安装软件/固件版本的默认配置。 | 设备出厂基线或产品镜像定义的初始状态。 |
| 配置 | 清除或重置用户修改过的配置，回到当前版本内置默认值。 | 清除用户配置、用户数据和产品定义的出厂后变更，回到出厂默认值。 |
| 软件版本 | 不改变 Launcher、runtime、业务应用或固件版本。 | 可将 Launcher、runtime、业务应用或其他软件组件恢复到出厂初始版本；是否包含固件由产品能力声明。 |
| Launcher 示例 | 当前 Launcher 是 `1.2.3` 时，恢复后仍是 `1.2.3`，只是配置回到 `1.2.3` 的默认配置。 | 当前 Launcher 是 `1.2.3`、出厂 Launcher 是 `1.0.0` 时，恢复后可回到 `1.0.0` 及其出厂配置。 |
| 危险级别 | 中等；通常不应导致软件降级。 | 高；可能导致软件版本回退、数据清除、重新绑定或重新配网。 |

## 5. 候选 Capability

| Capability | 状态 | 说明 |
|---|---|---|
| `system.reset` | draft | 设备级恢复默认配置、恢复出厂设置和状态变化通知。 |

## 6. 候选 Methods

| Method | Params Schema | Result Schema | 说明 | Review |
|---|---|---|---|---|
| `system.getResetCapabilities` | `GetResetCapabilitiesParams` | `ResetCapabilities` | 查询支持的 restore action、scope、保留项和危险操作要求。 | `[REVIEW-DRAFT]` |
| `system.getResetStatus` | `GetResetStatusParams` | `ResetStatus` | 查询当前或最近一次 reset/restore 状态。 | `[REVIEW-DRAFT]` |
| `system.restoreDefaultSettings` | `RestoreDefaultSettingsParams` | `RestoreSettingsResult` | 恢复默认配置。 | `[REVIEW-DRAFT]` |
| `system.restoreFactorySettings` | `RestoreFactorySettingsParams` | `RestoreSettingsResult` | 恢复出厂设置，属于设备级软重置。 | `[REVIEW-DRAFT]` |

## 7. 候选 Events

| Event | Schema | 触发时机 | Review |
|---|---|---|---|
| `system.resetStatusChanged` | `ResetStatusChangedEvent` | restore accepted、restoring、rebooting、completed、failed 或状态恢复。 | `[REVIEW-DRAFT]` |

## 8. 候选 Schemas

### `GetResetCapabilitiesParams`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `includeScopes` | boolean | no | 是否返回支持的 restore scope；默认 `true`。 | `[REVIEW-DRAFT]` |

### `ResetCapabilities`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `supportedActions` | string[] | yes | 支持的动作，例如 `restore_default_settings` / `restore_factory_settings`。 | `[REVIEW-DRAFT]` |
| `supportedScopes` | string[] | no | 支持的 restore scope，例如 `settings` / `user_data` / `software` / `network` / `all`。 | `[REVIEW-ASK]` |
| `supportsSoftReset` | boolean | yes | 是否支持软件发起恢复出厂设置。 | `[REVIEW-OK]` |
| `requiresConfirmation` | boolean | yes | 是否需要危险操作确认 token。 | `[REVIEW-DRAFT]` |
| `disconnectExpected` | boolean | no | restore 过程是否预期断连。 | `[REVIEW-DRAFT]` |
| `rebootExpected` | boolean | no | restore 后是否预期重启。 | `[REVIEW-DRAFT]` |
| `preservableFields` | string[] | no | 可选择保留的字段，例如 `identity` / `license` / `network` / `binding`。 | `[REVIEW-ASK]` |
| `defaultSettingsBaseline` | string enum | no | 默认配置恢复基线；建议为 `current_version_defaults`。 | `[REVIEW-OK]` |
| `factorySettingsBaseline` | string enum | no | 出厂设置恢复基线；建议为 `factory_baseline`。 | `[REVIEW-OK]` |
| `factoryRestoresSoftwareVersions` | boolean | no | 恢复出厂是否可能回退软件组件版本。 | `[REVIEW-DRAFT]` |
| `factoryRestorableComponents` | string[] | no | 可被 factory restore 回退到出厂版本的软件组件 ID，例如 `launcher`。 | `[REVIEW-DRAFT]` |

### `GetResetStatusParams`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `includeLastResult` | boolean | no | 是否返回最近一次 reset/restore 结果；默认 `true`。 | `[REVIEW-DRAFT]` |

### `ResetStatus`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `status` | string enum | yes | `idle` / `accepted` / `restoring` / `rebooting` / `completed` / `failed` / `unknown`。 | `[REVIEW-ASK]` |
| `actionId` | string | no | 当前或最近一次 restore 动作 ID。 | `[REVIEW-DRAFT]` |
| `action` | string enum | no | `restore_default_settings` / `restore_factory_settings`。 | `[REVIEW-DRAFT]` |
| `scopes` | string[] | no | 当前或最近一次 restore 覆盖范围。 | `[REVIEW-DRAFT]` |
| `baseline` | string enum | no | `current_version_defaults` / `factory_baseline`。 | `[REVIEW-OK]` |
| `softwareVersionChangeExpected` | boolean | no | 是否预期发生软件组件版本变化；default settings 应为 `false`。 | `[REVIEW-DRAFT]` |
| `softwareVersionChanges` | `SoftwareVersionChange[]` | no | 已知或完成后的软件版本变化摘要。 | `[REVIEW-DRAFT]` |
| `progressPercent` | uint8 | no | 0 到 100 的进度；设备无法提供时省略。 | `[REVIEW-DRAFT]` |
| `disconnectExpected` | boolean | no | 是否预期断连。 | `[REVIEW-DRAFT]` |
| `rebootExpected` | boolean | no | 是否预期重启。 | `[REVIEW-DRAFT]` |
| `startedAt` | string timestamp | no | restore 开始时间。 | `[REVIEW-DRAFT]` |
| `updatedAt` | string timestamp | no | 状态更新时间。 | `[REVIEW-DRAFT]` |
| `lastError` | object | no | 最近一次失败错误摘要。 | `[REVIEW-DRAFT]` |

### `RestoreDefaultSettingsParams`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `scopes` | string[] | no | 要恢复默认的配置范围；省略表示设备默认范围。不得用于软件版本回退；请求 `software` scope 应返回 `INVALID_ARGUMENT`。 | `[REVIEW-OK]` |
| `preserve` | string[] | no | 请求保留的内容，例如 `identity` / `license` / `network` / `binding`。 | `[REVIEW-ASK]` |
| `reason` | string | no | 调用方给出的原因。 | `[REVIEW-DRAFT]` |
| `rebootAfterRestore` | boolean | no | restore 后是否重启；默认由设备能力决定。 | `[REVIEW-DRAFT]` |
| `confirmationToken` | string | no | 危险操作确认 token。 | `[REVIEW-ASK]` |

### `RestoreFactorySettingsParams`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `scopes` | string[] | no | 恢复出厂设置范围；省略表示 factory settings 默认范围；可包含 `software` 表示按出厂基线恢复软件组件版本。 | `[REVIEW-ASK]` |
| `preserve` | string[] | no | 请求保留的内容，例如 `identity` / `license` / `network` / `binding`。 | `[REVIEW-ASK]` |
| `reason` | string | no | 调用方给出的原因。 | `[REVIEW-DRAFT]` |
| `rebootAfterRestore` | boolean | no | restore 后是否重启；默认由设备能力决定。 | `[REVIEW-DRAFT]` |
| `confirmationToken` | string | no | 危险操作确认 token。 | `[REVIEW-ASK]` |

### `RestoreSettingsResult`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `accepted` | boolean | yes | 是否接受 restore 请求。 | `[REVIEW-OK]` |
| `actionId` | string | no | restore 动作 ID。 | `[REVIEW-DRAFT]` |
| `status` | `ResetStatus` | yes | 接受后的 reset/restore 状态。 | `[REVIEW-DRAFT]` |
| `disconnectExpected` | boolean | yes | 连接是否预期断开。 | `[REVIEW-DRAFT]` |
| `estimatedDelaySeconds` | uint32 | no | 预估完成或重启延迟。 | `[REVIEW-DRAFT]` |

### `SoftwareVersionChange`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `componentId` | string | yes | 软件组件 ID，例如 `launcher`。 | `[REVIEW-DRAFT]` |
| `name` | string | no | 软件组件显示名，例如 `NearHub Launcher`。 | `[REVIEW-DRAFT]` |
| `fromVersion` | string | no | restore 前版本。 | `[REVIEW-DRAFT]` |
| `toVersion` | string | no | restore 后或预计恢复到的出厂版本。 | `[REVIEW-DRAFT]` |
| `policy` | string enum | no | `unchanged` / `restore_factory_version` / `device_decided`。 | `[REVIEW-ASK]` |

### `ResetStatusChangedEvent`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `status` | `ResetStatus` | yes | 变化后的 reset/restore 状态。 | `[REVIEW-DRAFT]` |
| `actionId` | string | no | 关联 restore 动作 ID。 | `[REVIEW-DRAFT]` |
| `reason` | string enum | no | `user_request` / `restore_default_settings` / `restore_factory_settings` / `system` / `error`。 | `[REVIEW-ASK]` |

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
    "supportedActions": ["restore_default_settings", "restore_factory_settings"],
    "supportedScopes": ["settings", "user_data", "software", "network", "all"],
    "supportsSoftReset": true,
    "requiresConfirmation": true,
    "disconnectExpected": true,
    "rebootExpected": true,
    "preservableFields": ["identity", "license", "network", "binding"],
    "defaultSettingsBaseline": "current_version_defaults",
    "factorySettingsBaseline": "factory_baseline",
    "factoryRestoresSoftwareVersions": true,
    "factoryRestorableComponents": ["launcher"]
  }
}
```

### `system.restoreDefaultSettings` request

```json
{
  "id": 71,
  "method": "system.restoreDefaultSettings",
  "params": {
    "scopes": ["settings"],
    "preserve": ["identity", "network"],
    "reason": "restore_defaults",
    "rebootAfterRestore": false,
    "confirmationToken": "TOKEN-REDACTED"
  }
}
```

### `system.restoreDefaultSettings` response

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
    "status": {
      "status": "accepted",
      "actionId": "act-REDACTED",
      "action": "restore_default_settings",
      "scopes": ["settings"],
      "baseline": "current_version_defaults",
      "softwareVersionChangeExpected": false,
      "disconnectExpected": false,
      "rebootExpected": false,
      "updatedAt": "2026-06-09T10:30:00Z"
    },
    "disconnectExpected": false,
    "estimatedDelaySeconds": 5
  }
}
```

### `system.restoreFactorySettings` request

```json
{
  "id": 72,
  "method": "system.restoreFactorySettings",
  "params": {
    "scopes": ["settings", "user_data", "software"],
    "preserve": ["identity"],
    "reason": "device_reassignment",
    "rebootAfterRestore": true,
    "confirmationToken": "TOKEN-REDACTED"
  }
}
```

### `system.restoreFactorySettings` response

```json
{
  "id": 72,
  "status": {
    "ok": true,
    "code": 0
  },
  "result": {
    "accepted": true,
    "actionId": "act-REDACTED",
    "status": {
      "status": "accepted",
      "actionId": "act-REDACTED",
      "action": "restore_factory_settings",
      "scopes": ["settings", "user_data", "software"],
      "baseline": "factory_baseline",
      "softwareVersionChangeExpected": true,
      "softwareVersionChanges": [
        {
          "componentId": "launcher",
          "name": "NearHub Launcher",
          "fromVersion": "1.2.3",
          "toVersion": "1.0.0",
          "policy": "restore_factory_version"
        }
      ],
      "disconnectExpected": true,
      "rebootExpected": true,
      "updatedAt": "2026-06-09T10:30:00Z"
    },
    "disconnectExpected": true,
    "estimatedDelaySeconds": 30
  }
}
```

### `system.resetStatusChanged` event

```json
{
  "event": "system.resetStatusChanged",
  "intent": 1,
  "data": {
    "actionId": "act-REDACTED",
    "reason": "restore_factory_settings",
    "status": {
      "status": "restoring",
      "actionId": "act-REDACTED",
      "action": "restore_factory_settings",
      "baseline": "factory_baseline",
      "softwareVersionChangeExpected": true,
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
  "id": 72,
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
| `SYSTEM_RESET_NOT_SUPPORTED` | system | 当前设备不支持请求的 restore action 或 scope；JSON 示例可使用 `NOT_SUPPORTED`。 | `[REVIEW-DRAFT]` |
| `SYSTEM_RESET_PERMISSION_DENIED` | system | 无权执行 restore action；JSON 示例可使用 `PERMISSION_DENIED`。 | `[REVIEW-DRAFT]` |
| `SYSTEM_RESET_CONFIRMATION_REQUIRED` | system | 缺少危险操作确认 token。 | `[REVIEW-ASK]` |
| `SYSTEM_RESET_BUSY` | system | 已有 reset/lifecycle/power 动作进行中；JSON 示例可使用 `BUSY`。 | `[REVIEW-DRAFT]` |
| `SYSTEM_RESET_INVALID_SCOPE` | system | 请求的 action、scope 或 preserve 字段非法；例如 default settings 请求 `software` 版本回退；JSON 示例可使用 `INVALID_ARGUMENT`。 | `[REVIEW-DRAFT]` |

## 11. Legacy 待映射

| 来源 | 旧协议条目 | 候选映射 | 状态 | 说明 |
|---|---|---|---|---|
| AXDP / Rooms / VM33 / Signage | `ResetConfig` / restore default-like 命令 | `system.restoreDefaultSettings` 或 `system.restoreFactorySettings` | `[REVIEW-ASK]` | 需确认旧命令是恢复当前版本默认配置，还是恢复出厂基线并可能回退 Launcher 等软件版本。 |
| NearHub Launcher / MCU | 状态恢复类 reset | `system.recoverRuntimeState` | `[REVIEW-OK]` | 运行时异常恢复不进入本文。 |

## 12. Registry 草案输入

```yaml
capabilities:
  - id: system.reset
    name: system.reset capability
    status: draft
    methods:
      - system.getResetCapabilities
      - system.getResetStatus
      - system.restoreDefaultSettings
      - system.restoreFactorySettings
    events:
      - system.resetStatusChanged

methods:
  - name: system.getResetCapabilities
    id: TBD after adoption
    bitOffset: TBD after adoption
    domain: system
    requestSchema: GetResetCapabilitiesParams
    responseSchema: ResetCapabilities
    capabilities:
      - system.reset
  - name: system.getResetStatus
    id: TBD after adoption
    bitOffset: TBD after adoption
    domain: system
    requestSchema: GetResetStatusParams
    responseSchema: ResetStatus
    capabilities:
      - system.reset
  - name: system.restoreDefaultSettings
    id: TBD after adoption
    bitOffset: TBD after adoption
    domain: system
    requestSchema: RestoreDefaultSettingsParams
    responseSchema: RestoreSettingsResult
    capabilities:
      - system.reset
  - name: system.restoreFactorySettings
    id: TBD after adoption
    bitOffset: TBD after adoption
    domain: system
    requestSchema: RestoreFactorySettingsParams
    responseSchema: RestoreSettingsResult
    capabilities:
      - system.reset

events:
  - name: system.resetStatusChanged
    id: TBD after adoption
    bitOffset: TBD after adoption
    domain: system
    eventSchema: ResetStatusChangedEvent
    capabilities:
      - system.reset
```

## 13. 采纳检查清单

- [ ] 08 已确认 `system.reset` 与 `system.recoverRuntimeState` 的边界。
- [ ] 10 已确认 `system.getResetCapabilities` / `system.getResetStatus` / `system.restoreDefaultSettings` / `system.restoreFactorySettings` 的 methodId、bitOffset 和 schema。
- [ ] 11 已确认 `system.resetStatusChanged` 的 eventId、eventMasks bitOffset 和断连前事件策略。
- [ ] 12 已确认权限、busy、confirmation required 的错误码策略。
- [ ] 13 已确认 restore action/scope/preserve enum 和 fieldId。
- [ ] default settings 已确认只回到当前版本默认配置，不改变 Launcher/runtime/业务应用/固件版本。
- [ ] factory settings 已确认 factory baseline 来源、是否回退 Launcher 等软件版本、以及回退目标版本如何暴露。
- [ ] legacy ResetConfig / restore factory-like 命令已确定映射 scope 后再写入 YAML。

## 14. 待确认问题

1. `restoreFactorySettings` 是否清除网络配置、license、绑定关系、用户数据和应用数据？
2. `restoreDefaultSettings` 和 `restoreFactorySettings` 的 scope 默认值分别是什么？
3. Launcher、runtime、业务应用和固件中，哪些组件属于 factory restore 的软件版本回退范围？
4. factory baseline 来自 ROM/预置安装包、恢复分区、云端包，还是设备本地保存的初始版本清单？
5. restore 后是否必须重启，还是由设备能力决定？
6. `deviceId`、SN、vendorId、productId 是否永远保留？
7. `preserve` 字段是否允许调用方选择，还是只能由设备固定策略决定？
8. factory settings restore 是否可能清除 AXTP 连接凭据，导致 App 需要重新配网/重新绑定？
