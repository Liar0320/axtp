# AXTP system.power 协议草案

版本：v0.2

归属域：`system`

Capability ID：`system.power`

适用范围：当前设备的供电/电池/电源状态读取、低频电源状态变化通知、软件发起的 `powerOff` 下电动作，以及可选的硬件/固件级自动上电/下电计划。

---

## 协议审核标记（人工复核）

| 标记 | 条目 | 审核结论 | 后续动作 |
|---|---|---|---|
| `[REVIEW-OK]` | domain.feature | `system.power` 表达电源状态和 power off 控制范围，属于 system 运行/电源层，不属于 `device`。 | 可作为 `registry/domains/system/domain.yaml` 草案输入。 |
| `[REVIEW-OK]` | `powerOff` 语义 | “断开设备电源”定义为软件发起的 power off，不是 suspend，也不是外部 PDU/继电器硬断电。 | `system.powerOff` 进入候选方法。 |
| `[REVIEW-DRAFT]` | `device.power` 迁移 | 原 `device.power` 草案不再保留在 `docs/protocol/device/`；电源语义以本文为准。 | 采纳时不要重新创建独立 `device.power` capability。 |
| `[REVIEW-DRAFT]` | scheduled shutdown 边界 | 计划关机作为 planned graceful shutdown 归 `system.setShutdownSchedule` / `system.getLifecycleSchedules`；本文只保留硬件/固件级 power on/off schedule。 | 采纳前确认 legacy AutoShutdown 是 shutdown 还是 power schedule。 |
| `[REVIEW-ASK]` | power schedule | 自动上电/下电是否纳入 P0 需要确认。 | 本文先作为可选方法候选。 |
| `[REVIEW-ASK]` | legacy 映射 | AXDP / VM33 的 battery/power/auto power 字段需重新映射到 `system.power` 或 `system.lifecycle`。 | 采纳前补 legacyRefs。 |

---

## 1. 文档定位

本文是 `docs/flows/device-system-info.md` 的 Stage 20 协议草案输入，不是最终协议事实源。采纳后，稳定事实必须写入 `registry/domains/system/domain.yaml` 或相关 registry YAML，再由 Generator 生成 `protocol/axtp.protocol.yaml` 和 `docs/generated/*`。

当前 generated 协议没有 adopted `system.power` 方法；本文中的方法名和字段均为草案候选，数值 ID 使用 `TBD after adoption`。

## 2. 业务需求

| 项 | 内容 |
|---|---|
| 需求来源 | `docs/flows/device-system-info.md`、用户确认 power 放到 system 下、legacy power/battery 线索。 |
| 目标用户 | App / PC host / cloud console / device management service。 |
| 目标行为 | 查看设备供电、电池、电源模式和 power off 支持情况；执行软件发起的 power off；在设备具备硬件/固件能力时查询或设置自动上电/下电计划，并监听 power 状态变化。 |
| 当前实现程度 | Drafted only；此前冲突的 `device.power` 草案已迁移并删除。 |

## 3. Domain 边界

| 项 | 决策 |
|---|---|
| Domain | `system` |
| Feature | `system.power` |
| Capability | `system.power` |
| 负责 | power source、battery、charging、power mode、power state、power-off support、software `powerOff`、硬件/固件级 power on/off schedule。 |
| 不属于本文 | 主设备身份属于 `device.info`；CPU/内存和状态重置属于 `system.state`；立即重启、计划重启、graceful shutdown 和计划关机属于 `system.lifecycle`；外部 PDU/继电器硬断电不属于 AXTP 本设备软件协议。 |

## 4. 协议决策

| 决策点 | 结论 | 理由 |
|---|---|---|
| 新增/修改/复用 | Create new draft | 需要从 `device.power` 迁移到 system 域。 |
| 状态查询 | `system.getPowerState` | 状态型 feature 模板。 |
| 动作 | `system.powerOff` | 软件发起下电是动作型方法，不用 `setPowerConfig` 表达。 |
| Schedule | `system.getPowerSchedule` / `system.setPowerSchedule` optional | legacy 有 auto power 线索，但 P0 是否采纳待确认；计划关机使用 `system.setShutdownSchedule` / `system.getLifecycleSchedules`。 |

## 5. 候选 Capability

| Capability | 状态 | 说明 |
|---|---|---|
| `system.power` | draft | 电源状态、供电/电池摘要、软件 power off 和可选 power schedule。 |

## 6. 候选 Methods

| Method | Params Schema | Result Schema | 说明 | Review |
|---|---|---|---|---|
| `system.getPowerState` | `GetPowerStateParams` | `SystemPowerState` | 查询电源状态快照。 | `[REVIEW-OK]` |
| `system.powerOff` | `PowerOffParams` | `PowerOffResult` | 通过软件流程请求设备下电。 | `[REVIEW-OK]` |
| `system.getPowerSchedule` | `GetPowerScheduleParams` | `PowerSchedule` | 查询硬件/固件级自动上电/下电计划。 | `[REVIEW-ASK]` |
| `system.setPowerSchedule` | `SetPowerScheduleParams` | `SetPowerScheduleResult` | 设置硬件/固件级自动上电/下电计划。 | `[REVIEW-ASK]` |

## 7. 候选 Events

| Event | Schema | 触发时机 | Review |
|---|---|---|---|
| `system.powerStateChanged` | `PowerStateChangedEvent` | power source、电池、电源模式、power off transition 或 powered_off 状态变化。 | `[REVIEW-DRAFT]` |

## 8. 候选 Schemas

### `GetPowerStateParams`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `includeBatteryDetails` | boolean | no | 是否返回更细电池信息；默认 `false`。 | `[REVIEW-DRAFT]` |

### `GetPowerScheduleParams`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `includeDisabled` | boolean | no | 是否返回已禁用计划项；默认 `true`。 | `[REVIEW-DRAFT]` |

### `SetPowerScheduleParams`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `schedule` | `PowerSchedule` | yes | 要写入的电源计划。 | `[REVIEW-ASK]` |
| `expectedVersion` | string | no | 可选乐观锁版本。 | `[REVIEW-DRAFT]` |

### `SetPowerScheduleResult`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `schedule` | `PowerSchedule` | no | 写入后的计划。 | `[REVIEW-DRAFT]` |
| `changedFields` | string[] | no | 变化字段路径。 | `[REVIEW-DRAFT]` |
| `version` | string | no | 新配置版本。 | `[REVIEW-DRAFT]` |

### `SystemPowerState`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `source` | string enum | yes | `ac` / `battery` / `poe` / `usb` / `unknown`。 | `[REVIEW-ASK]` |
| `batteryPercent` | uint8 nullable | no | 电池电量百分比；无电池时为 `null` 或省略。 | `[REVIEW-DRAFT]` |
| `charging` | boolean | no | 是否正在充电。 | `[REVIEW-DRAFT]` |
| `powerMode` | string enum | no | `normal` / `saving` / `performance` / `unknown`。 | `[REVIEW-ASK]` |
| `powerOffSupported` | boolean | yes | 是否支持软件 power off。 | `[REVIEW-OK]` |
| `state` | string enum | yes | `running` / `powering_off` / `powered_off` / `unknown`。 | `[REVIEW-ASK]` |
| `scheduleEnabled` | boolean | no | 是否启用电源计划。 | `[REVIEW-DRAFT]` |
| `sampledAt` | string timestamp | no | 采样时间。 | `[REVIEW-DRAFT]` |

### `PowerOffParams`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `reason` | string | no | 调用方给出的原因。 | `[REVIEW-DRAFT]` |
| `delaySeconds` | uint32 | no | 延迟执行秒数；默认 `0`。 | `[REVIEW-DRAFT]` |
| `force` | boolean | no | 是否请求强制流程；具体平台是否支持由能力决定。 | `[REVIEW-ASK]` |
| `confirmationToken` | string | no | 危险操作确认 token。 | `[REVIEW-ASK]` |

### `PowerOffResult`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `accepted` | boolean | yes | 是否接受 power off 请求。 | `[REVIEW-OK]` |
| `state` | string enum | no | 接受后的 power state，例如 `powering_off`。 | `[REVIEW-DRAFT]` |
| `disconnectExpected` | boolean | yes | 连接是否预期断开。 | `[REVIEW-OK]` |
| `estimatedDelaySeconds` | uint32 | no | 预估下电延迟。 | `[REVIEW-DRAFT]` |

### `PowerSchedule`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `enabled` | boolean | yes | 是否启用电源计划。 | `[REVIEW-ASK]` |
| `entries` | `PowerScheduleEntry[]` | no | 计划项。 | `[REVIEW-ASK]` |
| `timezone` | string | no | 计划使用的时区。 | `[REVIEW-ASK]` |

### `PowerScheduleEntry`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `id` | string | no | 计划项 ID。 | `[REVIEW-DRAFT]` |
| `action` | string enum | yes | `power_off` / `power_on`；计划重启使用 `system.setRebootSchedule`，计划关机使用 `system.setShutdownSchedule`。 | `[REVIEW-ASK]` |
| `time` | string | yes | 本地时间或 cron-like 表达；格式待确认。 | `[REVIEW-ASK]` |
| `daysOfWeek` | string[] | no | 星期重复规则。 | `[REVIEW-DRAFT]` |

### `PowerStateChangedEvent`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `changedFields` | string[] | yes | 变化字段路径。 | `[REVIEW-DRAFT]` |
| `state` | `SystemPowerState` | no | 变化后的完整或部分电源状态。 | `[REVIEW-DRAFT]` |
| `reason` | string enum | no | `source_change` / `battery_change` / `power_off_requested` / `schedule` / `system`。 | `[REVIEW-ASK]` |

## 9. JSON 示例

示例只写 RPC `d` 数据块，不包裹外层 `sid` / `op` / `d` wire envelope。

### `system.getPowerState` request

```json
{
  "id": 40,
  "method": "system.getPowerState",
  "params": {
    "includeBatteryDetails": false
  }
}
```

### `system.getPowerState` response

```json
{
  "id": 40,
  "status": {
    "ok": true,
    "code": 0
  },
  "result": {
    "source": "ac",
    "batteryPercent": null,
    "charging": false,
    "powerMode": "normal",
    "powerOffSupported": true,
    "state": "running",
    "scheduleEnabled": false,
    "sampledAt": "2026-06-09T10:30:00Z"
  }
}
```

### `system.powerOff` request

```json
{
  "id": 41,
  "method": "system.powerOff",
  "params": {
    "reason": "user_request",
    "delaySeconds": 0,
    "confirmationToken": "TOKEN-REDACTED"
  }
}
```

### `system.powerOff` response

```json
{
  "id": 41,
  "status": {
    "ok": true,
    "code": 0
  },
  "result": {
    "accepted": true,
    "state": "powering_off",
    "disconnectExpected": true,
    "estimatedDelaySeconds": 10
  }
}
```

### `system.powerStateChanged` event

```json
{
  "event": "system.powerStateChanged",
  "intent": 1,
  "data": {
    "changedFields": ["state"],
    "reason": "power_off_requested",
    "state": {
      "state": "powering_off",
      "powerOffSupported": true
    }
  }
}
```

### failure response

```json
{
  "id": 41,
  "status": {
    "ok": false,
    "code": 3,
    "msg": "Not supported.",
    "details": {
      "candidateError": "SYSTEM_POWER_OFF_NOT_SUPPORTED"
    }
  }
}
```

## 10. 候选 Errors

| Error | 类别 | 说明 | Review |
|---|---|---|---|
| `SYSTEM_POWER_OFF_NOT_SUPPORTED` | system | 当前设备不支持软件 power off；JSON 示例使用通用 `NOT_SUPPORTED`。 | `[REVIEW-DRAFT]` |
| `SYSTEM_POWER_PERMISSION_DENIED` | system | 无权执行 power off 或设置电源计划；JSON 示例使用通用 `PERMISSION_DENIED`。 | `[REVIEW-DRAFT]` |
| `SYSTEM_POWER_BUSY` | system | 系统忙或已有生命周期动作进行中；JSON 示例使用通用 `BUSY`。 | `[REVIEW-DRAFT]` |
| `SYSTEM_POWER_INVALID_STATE` | system | 当前状态不允许 power off；JSON 示例使用通用 `INVALID_STATE`。 | `[REVIEW-DRAFT]` |

## 11. Legacy 待映射

| 来源 | 旧协议条目 | 候选映射 | 状态 | 说明 |
|---|---|---|---|---|
| AXDP | `CommonGetBatteryCap` | `system.getPowerState` | `[REVIEW-ASK]` | 原分类为 `device.power`，需迁移到 `system.power`。 |
| VM33 | `System.GetPower` | `system.getPowerState` | `[REVIEW-ASK]` | 旧 System namespace 与新 `system.power` 语义一致。 |
| VM33 / AXDP | `AutoPower` | `system.getPowerSchedule` / `system.setPowerSchedule` | `[REVIEW-ASK]` | 倾向表示硬件/固件级自动上电/下电计划。 |
| VM33 / AXDP | `AutoShutDown` | `system.setShutdownSchedule` / `system.getLifecycleSchedules` 或 `system.getPowerSchedule` / `system.setPowerSchedule` | `[REVIEW-ASK]` | 需确认是 planned graceful shutdown，还是硬件/固件级 power schedule。 |

## 12. Registry 草案输入

```yaml
capabilities:
  - id: system.power
    name: system.power capability
    status: draft
    methods:
      - system.getPowerState
      - system.powerOff
      - system.getPowerSchedule
      - system.setPowerSchedule
    events:
      - system.powerStateChanged

methods:
  - name: system.getPowerState
    id: TBD after adoption
    bitOffset: TBD after adoption
    domain: system
    requestSchema: GetPowerStateParams
    responseSchema: SystemPowerState
    capabilities:
      - system.power
  - name: system.powerOff
    id: TBD after adoption
    bitOffset: TBD after adoption
    domain: system
    requestSchema: PowerOffParams
    responseSchema: PowerOffResult
    capabilities:
      - system.power
  - name: system.getPowerSchedule
    id: TBD after adoption
    bitOffset: TBD after adoption
    domain: system
    requestSchema: GetPowerScheduleParams
    responseSchema: PowerSchedule
    capabilities:
      - system.power
  - name: system.setPowerSchedule
    id: TBD after adoption
    bitOffset: TBD after adoption
    domain: system
    requestSchema: SetPowerScheduleParams
    responseSchema: SetPowerScheduleResult
    capabilities:
      - system.power

events:
  - name: system.powerStateChanged
    id: TBD after adoption
    bitOffset: TBD after adoption
    domain: system
    eventSchema: PowerStateChangedEvent
    capabilities:
      - system.power
```

## 13. 采纳检查清单

- [ ] 08 已确认 `system.power` 是独立 capability，不采用 `device.power`。
- [ ] 10 已确认 `system.getPowerState` / `system.powerOff` 的 methodId、bitOffset 和 schema。
- [ ] 10 已确认硬件/固件级 power schedule 是否进入 P0，且与 `system.setShutdownSchedule` 不冲突。
- [ ] 11 已确认 `system.powerStateChanged` 的 eventId、eventMasks bitOffset 和断连前事件策略。
- [ ] 12 已确认错误码复用或新增策略。
- [ ] 13 已确认 enum、nullable battery 字段和 power state 表达。
- [ ] 采纳时确认不再生成独立 `device.power` capability。

## 14. 待确认问题

1. `source` 和 `powerMode` 的首批 enum 是什么？
2. 无电池设备的 `batteryPercent` 使用 `null` 还是省略？
3. `system.powerOff` 是否必须携带 confirmation token？
4. `force` 是否进入 P0，哪些平台支持？
5. AutoShutdown 是 `system.setShutdownSchedule` 的 planned graceful shutdown，还是 `system.power` 的硬件/固件级 power schedule？
6. `PowerScheduleEntry.action=power_off` 与 `system.powerOff` 的即时动作是否共享同一底层状态机？
