# AXTP system.lifecycle 协议草案

版本：v0.8

归属域：`system`

Capability ID：`system.lifecycle`

适用范围：系统立即重启、计划重启、graceful shutdown、计划关机、生命周期状态读取和生命周期状态变化通知。

---

## 协议审核标记（人工复核）

| 标记 | 条目 | 审核结论 | 后续动作 |
|---|---|---|---|
| `[REVIEW-OK]` | domain.feature | `system.lifecycle` 表达系统生命周期动作和状态，属于 system 层。 | 可作为 `registry/domains/system/domain.yaml` 草案输入。 |
| `[REVIEW-OK]` | reboot/shutdown | `system.reboot` 和 `system.shutdown` 是立即动作型方法，不使用配置型方法表达这些动作。 | 进入候选方法。 |
| `[REVIEW-OK]` | typed schedule get/set/cancel | 计划重启和计划关机按类型拆分读取、写入和取消；不保留总括计划接口。 | 使用 `getRebootSchedule` / `setRebootSchedule` / `cancelRebootSchedule` 与 `getShutdownSchedule` / `setShutdownSchedule` / `cancelShutdownSchedule`。 |
| `[REVIEW-OK]` | shutdown / power-off 边界 | 原 power-off 候选与 `system.shutdown` 重复；软件关机/下电统一由 `system.shutdown` 表达。 | 不再保留独立 system power 草案。 |
| `[REVIEW-OK]` | reboot schedule 边界 | 计划重启是 lifecycle schedule，归 `system.getRebootSchedule` / `system.setRebootSchedule` / `system.cancelRebootSchedule`。 | 采纳前确认一次性/周期性计划策略。 |
| `[REVIEW-OK]` | shutdown schedule 边界 | 计划关机是 planned graceful shutdown schedule，归 `system.getShutdownSchedule` / `system.setShutdownSchedule` / `system.cancelShutdownSchedule`。 | 不再引入硬件/固件级 power schedule。 |
| `[REVIEW-DRAFT]` | transition event | `system.lifecycleStateChanged` 表达 rebooting、shutting_down、ready 等状态。 | 采纳前确认断连前事件可靠性和重连校准策略。 |
| `[REVIEW-ASK]` | legacy 映射 | AXDP / VM33 / Signage 的 reboot/shutdown/keepalive 字段需字段级映射。 | 采纳前补 legacyRefs。 |

---

## 1. 文档定位

本文是 `docs/flows/device-system-info.md` 的 Stage 20 协议草案输入，不是最终协议事实源。采纳后，稳定事实必须写入 `registry/domains/system/domain.yaml` 或相关 registry YAML，再由 Generator 生成 `protocol/axtp.protocol.yaml` 和 `docs/generated/*`。

当前 generated 协议没有 adopted `system.lifecycle` 方法；本文中的方法名和字段均为草案候选，数值 ID 使用 `TBD after adoption`。

## 2. 业务需求

| 项 | 内容 |
|---|---|
| 需求来源 | `docs/flows/device-system-info.md`、计划重启/计划关机新增场景、legacy reboot/shutdown/keepalive 线索。 |
| 目标用户 | App / PC host / cloud console / device management service。 |
| 目标行为 | 用户触发立即重启、graceful shutdown、计划重启或计划关机后，设备返回接受状态；App 可分别读取当前重启计划和关机计划，并通过生命周期事件或断连/重连更新 UI。 |
| 当前实现程度 | Drafted only；原草案已从泛配置型模板调整为动作和状态协议。 |

## 3. Domain 边界

| 项 | 决策 |
|---|---|
| Domain | `system` |
| Feature | `system.lifecycle` |
| Capability | `system.lifecycle` |
| 负责 | lifecycle state、immediate reboot、shutdown、typed reboot/shutdown schedules、scheduled reboot、scheduled shutdown、lifecycle transition event。 |
| 不属于本文 | CPU/内存、运行时状态变化和运行时状态恢复属于 `system.state`；健康/告警/fault 判定由业务端基于 `system.stateChanged` 自行实现；restore-default/factory reset 属于 `system.reset` 或 `system.initialization`；外部 PDU/继电器硬断电不属于本设备 AXTP 软件协议。 |

## 4. 协议决策

| 决策点 | 结论 | 理由 |
|---|---|---|
| 新增/修改/复用 | Modify existing draft | 复用 `system.lifecycle` capability，但替换配置型模板。 |
| 状态查询 | `system.getLifecycleState` | App 可在重连后校准当前生命周期状态。 |
| 立即动作 | `system.reboot` / `system.shutdown` | 符合动作型 feature 模板。 |
| 计划任务 | `system.getRebootSchedule` / `system.setRebootSchedule` / `system.cancelRebootSchedule`；`system.getShutdownSchedule` / `system.setShutdownSchedule` / `system.cancelShutdownSchedule` | 计划重启和计划关机是持久化 schedule，需要按类型可读、可写、可取消；不再拆分硬件电源计划，也不保留总括 schedule 接口。 |
| Event | `system.lifecycleStateChanged` | 请求 accepted 后的状态变化不替代 RPC response。 |

## 5. 候选 Capability

| Capability | 状态 | 说明 |
|---|---|---|
| `system.lifecycle` | draft | 系统生命周期状态、立即重启、graceful shutdown、按类型读取/设置/取消计划重启和计划关机。 |

## 6. 候选 Methods

| Method | Params Schema | Result Schema | 说明 | Review |
|---|---|---|---|---|
| `system.getLifecycleState` | `GetLifecycleStateParams` | `LifecycleState` | 查询当前生命周期状态。 | `[REVIEW-DRAFT]` |
| `system.reboot` | `RebootParams` | `LifecycleActionResult` | 请求设备重启。 | `[REVIEW-OK]` |
| `system.shutdown` | `ShutdownParams` | `LifecycleActionResult` | 请求 graceful shutdown；覆盖原 power off 软件下电诉求。 | `[REVIEW-OK]` |
| `system.getRebootSchedule` | `GetRebootScheduleParams` | `LifecycleScheduleList` | 查询当前计划重启任务。 | `[REVIEW-OK]` |
| `system.setRebootSchedule` | `SetRebootScheduleParams` | `SetLifecycleScheduleResult` | 创建或更新一次性/周期性计划重启。 | `[REVIEW-OK]` |
| `system.cancelRebootSchedule` | `CancelRebootScheduleParams` | `CancelScheduleResult` | 取消计划重启任务。 | `[REVIEW-DRAFT]` |
| `system.getShutdownSchedule` | `GetShutdownScheduleParams` | `LifecycleScheduleList` | 查询当前计划关机任务。 | `[REVIEW-OK]` |
| `system.setShutdownSchedule` | `SetShutdownScheduleParams` | `SetLifecycleScheduleResult` | 创建或更新一次性/周期性计划关机。 | `[REVIEW-DRAFT]` |
| `system.cancelShutdownSchedule` | `CancelShutdownScheduleParams` | `CancelScheduleResult` | 取消计划关机任务。 | `[REVIEW-DRAFT]` |

## 7. 候选 Events

| Event | Schema | 触发时机 | Review |
|---|---|---|---|
| `system.lifecycleStateChanged` | `LifecycleStateChangedEvent` | ready、reboot_scheduled、shutdown_scheduled、rebooting、shutting_down、restarting、error 等生命周期状态变化。 | `[REVIEW-DRAFT]` |

## 8. 候选 Schemas

### `GetLifecycleStateParams`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `includeLastAction` | boolean | no | 是否返回最近一次 lifecycle action 摘要；默认 `true`。 | `[REVIEW-DRAFT]` |

### `LifecycleState`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `state` | string enum | yes | `ready` / `reboot_scheduled` / `shutdown_scheduled` / `rebooting` / `shutting_down` / `restarting` / `starting` / `error` / `unknown`。 | `[REVIEW-ASK]` |
| `lastAction` | string enum | no | `reboot` / `schedule_reboot` / `schedule_shutdown` / `shutdown` / `none`。 | `[REVIEW-DRAFT]` |
| `lastActionId` | string | no | 最近一次动作 ID。 | `[REVIEW-DRAFT]` |
| `rebootSchedules` | `LifecycleSchedule[]` | no | 当前计划重启摘要列表；可由 `system.getRebootSchedule` 获取完整信息。 | `[REVIEW-DRAFT]` |
| `shutdownSchedules` | `LifecycleSchedule[]` | no | 当前计划关机摘要列表；可由 `system.getShutdownSchedule` 获取完整信息。 | `[REVIEW-DRAFT]` |
| `disconnectExpected` | boolean | no | 当前 transition 是否预期断连。 | `[REVIEW-DRAFT]` |
| `updatedAt` | string timestamp | no | 状态更新时间。 | `[REVIEW-DRAFT]` |

### `RebootParams`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `reason` | string | no | 调用方给出的原因。 | `[REVIEW-DRAFT]` |
| `delaySeconds` | uint32 | no | 延迟执行秒数；默认 `0`。 | `[REVIEW-DRAFT]` |
| `force` | boolean | no | 请求强制重启；平台可拒绝。 | `[REVIEW-ASK]` |
| `confirmationToken` | string | no | 危险操作确认 token。 | `[REVIEW-ASK]` |

### `GetRebootScheduleParams`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `includeDisabled` | boolean | no | 是否返回已禁用计划；默认 `true`。 | `[REVIEW-DRAFT]` |

### `GetShutdownScheduleParams`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `includeDisabled` | boolean | no | 是否返回已禁用计划；默认 `true`。 | `[REVIEW-DRAFT]` |

### `LifecycleScheduleList`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `type` | string enum | yes | `reboot` / `shutdown`。 | `[REVIEW-OK]` |
| `schedules` | `LifecycleSchedule[]` | yes | 当前配置的该类型计划任务。 | `[REVIEW-OK]` |
| `timezone` | string | no | 默认计划时区。 | `[REVIEW-DRAFT]` |
| `version` | string | no | 该类型计划集合版本，用于 set/cancel 的乐观锁。 | `[REVIEW-DRAFT]` |

### `SetRebootScheduleParams`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `scheduleId` | string | no | 要更新的计划 ID；省略表示创建或替换默认重启计划。 | `[REVIEW-ASK]` |
| `enabled` | boolean | no | 是否启用计划；默认 `true`。 | `[REVIEW-DRAFT]` |
| `mode` | string enum | yes | `once` / `daily` / `weekly` / `custom`。 | `[REVIEW-ASK]` |
| `runAt` | string timestamp | no | 一次性重启时间；`mode=once` 时使用。 | `[REVIEW-DRAFT]` |
| `timeOfDay` | string | no | 周期性重启的本地时间，例如 `03:30:00`。 | `[REVIEW-DRAFT]` |
| `daysOfWeek` | string[] | no | 周期性重启星期规则，例如 `mon` / `wed` / `sun`。 | `[REVIEW-ASK]` |
| `timezone` | string | no | 计划使用的时区，例如 `Asia/Shanghai`。 | `[REVIEW-DRAFT]` |
| `reason` | string | no | 调用方给出的原因。 | `[REVIEW-DRAFT]` |
| `replaceExisting` | boolean | no | 是否替换已有默认重启计划；默认策略待确认。 | `[REVIEW-ASK]` |
| `confirmationToken` | string | no | 危险操作确认 token。 | `[REVIEW-ASK]` |
| `expectedVersion` | string | no | 可选乐观锁版本。 | `[REVIEW-DRAFT]` |

### `SetLifecycleScheduleResult`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `scheduled` | boolean | yes | 是否已保存计划。 | `[REVIEW-OK]` |
| `schedule` | `LifecycleSchedule` | yes | 保存后的计划。 | `[REVIEW-DRAFT]` |
| `changedFields` | string[] | no | 变化字段路径。 | `[REVIEW-DRAFT]` |
| `version` | string | no | 计划集合新版本。 | `[REVIEW-DRAFT]` |

### `SetShutdownScheduleParams`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `scheduleId` | string | no | 要更新的计划 ID；省略表示创建或替换默认关机计划。 | `[REVIEW-ASK]` |
| `enabled` | boolean | no | 是否启用计划；默认 `true`。 | `[REVIEW-DRAFT]` |
| `mode` | string enum | yes | `once` / `daily` / `weekly` / `custom`。 | `[REVIEW-ASK]` |
| `runAt` | string timestamp | no | 一次性关机时间；`mode=once` 时使用。 | `[REVIEW-DRAFT]` |
| `timeOfDay` | string | no | 周期性关机的本地时间，例如 `23:30:00`。 | `[REVIEW-DRAFT]` |
| `daysOfWeek` | string[] | no | 周期性关机星期规则，例如 `mon` / `fri` / `sun`。 | `[REVIEW-ASK]` |
| `timezone` | string | no | 计划使用的时区，例如 `Asia/Shanghai`。 | `[REVIEW-DRAFT]` |
| `reason` | string | no | 调用方给出的原因。 | `[REVIEW-DRAFT]` |
| `replaceExisting` | boolean | no | 是否替换已有默认关机计划；默认策略待确认。 | `[REVIEW-ASK]` |
| `confirmationToken` | string | no | 危险操作确认 token。 | `[REVIEW-ASK]` |
| `expectedVersion` | string | no | 可选乐观锁版本。 | `[REVIEW-DRAFT]` |

### `CancelRebootScheduleParams`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `scheduleId` | string | no | 要取消的重启计划 ID；省略表示默认重启计划。 | `[REVIEW-DRAFT]` |
| `reason` | string | no | 调用方给出的原因。 | `[REVIEW-DRAFT]` |
| `confirmationToken` | string | no | 危险操作确认 token。 | `[REVIEW-ASK]` |
| `expectedVersion` | string | no | 可选乐观锁版本。 | `[REVIEW-DRAFT]` |

### `CancelShutdownScheduleParams`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `scheduleId` | string | no | 要取消的关机计划 ID；省略表示默认关机计划。 | `[REVIEW-DRAFT]` |
| `reason` | string | no | 调用方给出的原因。 | `[REVIEW-DRAFT]` |
| `confirmationToken` | string | no | 危险操作确认 token。 | `[REVIEW-ASK]` |
| `expectedVersion` | string | no | 可选乐观锁版本。 | `[REVIEW-DRAFT]` |

### `CancelScheduleResult`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `cancelled` | boolean | yes | 是否已取消计划。 | `[REVIEW-OK]` |
| `scheduleId` | string | yes | 被取消的计划 ID。 | `[REVIEW-DRAFT]` |
| `type` | string enum | no | 被取消的计划类型：`reboot` / `shutdown`。 | `[REVIEW-DRAFT]` |
| `changedFields` | string[] | no | 变化字段路径。 | `[REVIEW-DRAFT]` |
| `version` | string | no | 计划集合新版本。 | `[REVIEW-DRAFT]` |

### `LifecycleSchedule`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `scheduleId` | string | yes | 计划 ID。 | `[REVIEW-DRAFT]` |
| `type` | string enum | yes | `reboot` / `shutdown`。 | `[REVIEW-OK]` |
| `enabled` | boolean | yes | 是否启用。 | `[REVIEW-DRAFT]` |
| `mode` | string enum | yes | `once` / `daily` / `weekly` / `custom`。 | `[REVIEW-ASK]` |
| `runAt` | string timestamp | no | 一次性计划时间。 | `[REVIEW-DRAFT]` |
| `timeOfDay` | string | no | 周期性计划的本地时间。 | `[REVIEW-DRAFT]` |
| `daysOfWeek` | string[] | no | 周期性星期规则。 | `[REVIEW-ASK]` |
| `timezone` | string | no | 计划时区。 | `[REVIEW-DRAFT]` |
| `nextRunAt` | string timestamp | no | 下一次预计执行时间。 | `[REVIEW-DRAFT]` |
| `reason` | string | no | 设置原因。 | `[REVIEW-DRAFT]` |
| `version` | string | no | 计划版本。 | `[REVIEW-DRAFT]` |

### `ShutdownParams`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `reason` | string | no | 调用方给出的原因。 | `[REVIEW-DRAFT]` |
| `delaySeconds` | uint32 | no | 延迟执行秒数；默认 `0`。 | `[REVIEW-DRAFT]` |
| `force` | boolean | no | 请求强制 shutdown；平台可拒绝。 | `[REVIEW-ASK]` |
| `confirmationToken` | string | no | 危险操作确认 token。 | `[REVIEW-ASK]` |

### `LifecycleActionResult`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `accepted` | boolean | yes | 是否接受动作。 | `[REVIEW-OK]` |
| `actionId` | string | no | 动作 ID。 | `[REVIEW-DRAFT]` |
| `state` | string enum | yes | 接受后的状态，例如 `rebooting`。 | `[REVIEW-DRAFT]` |
| `disconnectExpected` | boolean | yes | 是否预期连接断开。 | `[REVIEW-OK]` |
| `estimatedDelaySeconds` | uint32 | no | 预估执行延迟。 | `[REVIEW-DRAFT]` |

### `LifecycleStateChangedEvent`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `state` | `LifecycleState` | yes | 变化后的生命周期状态。 | `[REVIEW-DRAFT]` |
| `actionId` | string | no | 关联动作 ID。 | `[REVIEW-DRAFT]` |
| `reason` | string enum | no | `user_request` / `scheduled_reboot` / `scheduled_shutdown` / `policy` / `system` / `error`。 | `[REVIEW-ASK]` |

## 9. JSON 示例

示例只写 RPC `d` 数据块，不包裹外层 `sid` / `op` / `d` wire envelope。

### `system.reboot` request

```json
{
  "id": 50,
  "method": "system.reboot",
  "params": {
    "reason": "user_request",
    "delaySeconds": 0,
    "confirmationToken": "TOKEN-REDACTED"
  }
}
```

### `system.reboot` response

```json
{
  "id": 50,
  "status": {
    "ok": true,
    "code": 0
  },
  "result": {
    "accepted": true,
    "actionId": "act-REDACTED",
    "state": "rebooting",
    "disconnectExpected": true,
    "estimatedDelaySeconds": 5
  }
}
```

### `system.getRebootSchedule` request

```json
{
  "id": 52,
  "method": "system.getRebootSchedule",
  "params": {
    "includeDisabled": true
  }
}
```

### `system.getRebootSchedule` response

```json
{
  "id": 52,
  "status": {
    "ok": true,
    "code": 0
  },
  "result": {
    "type": "reboot",
    "schedules": [
      {
        "scheduleId": "reboot-default",
        "type": "reboot",
        "enabled": true,
        "mode": "weekly",
        "timeOfDay": "03:30:00",
        "daysOfWeek": ["sun"],
        "timezone": "Asia/Shanghai",
        "nextRunAt": "2026-06-14T03:30:00+08:00",
        "reason": "maintenance_window",
        "version": "2026-06-09T10:30:00Z"
      }
    ],
    "timezone": "Asia/Shanghai",
    "version": "2026-06-09T10:30:00Z"
  }
}
```

### `system.getShutdownSchedule` request

```json
{
  "id": 56,
  "method": "system.getShutdownSchedule",
  "params": {
    "includeDisabled": true
  }
}
```

### `system.getShutdownSchedule` response

```json
{
  "id": 56,
  "status": {
    "ok": true,
    "code": 0
  },
  "result": {
    "type": "shutdown",
    "schedules": [
      {
        "scheduleId": "shutdown-default",
        "type": "shutdown",
        "enabled": true,
        "mode": "daily",
        "timeOfDay": "23:30:00",
        "timezone": "Asia/Shanghai",
        "nextRunAt": "2026-06-09T23:30:00+08:00",
        "reason": "store_closed",
        "version": "2026-06-09T10:30:00Z"
      }
    ],
    "timezone": "Asia/Shanghai",
    "version": "2026-06-09T10:30:00Z"
  }
}
```

### `system.setRebootSchedule` request

```json
{
  "id": 53,
  "method": "system.setRebootSchedule",
  "params": {
    "mode": "weekly",
    "timeOfDay": "03:30:00",
    "daysOfWeek": ["sun"],
    "timezone": "Asia/Shanghai",
    "reason": "maintenance_window",
    "replaceExisting": true,
    "expectedVersion": "2026-06-09T10:30:00Z",
    "confirmationToken": "TOKEN-REDACTED"
  }
}
```

### `system.setRebootSchedule` response

```json
{
  "id": 53,
  "status": {
    "ok": true,
    "code": 0
  },
  "result": {
    "scheduled": true,
    "schedule": {
      "scheduleId": "reboot-default",
      "type": "reboot",
      "enabled": true,
      "mode": "weekly",
      "timeOfDay": "03:30:00",
      "daysOfWeek": ["sun"],
      "timezone": "Asia/Shanghai",
      "nextRunAt": "2026-06-14T03:30:00+08:00",
      "reason": "maintenance_window",
      "version": "2026-06-09T10:30:00Z"
    },
    "changedFields": ["rebootSchedules"],
    "version": "2026-06-09T10:30:01Z"
  }
}
```

### `system.lifecycleStateChanged` scheduled reboot event

```json
{
  "event": "system.lifecycleStateChanged",
  "intent": 1,
  "data": {
    "reason": "scheduled_reboot",
    "state": {
      "state": "reboot_scheduled",
      "lastAction": "schedule_reboot",
      "rebootSchedules": [
        {
          "scheduleId": "reboot-default",
          "type": "reboot",
          "enabled": true,
          "mode": "weekly",
          "nextRunAt": "2026-06-14T03:30:00+08:00"
        }
      ],
      "disconnectExpected": false,
      "updatedAt": "2026-06-09T10:30:00Z"
    }
  }
}
```

### `system.cancelRebootSchedule` request

```json
{
  "id": 57,
  "method": "system.cancelRebootSchedule",
  "params": {
    "scheduleId": "reboot-default",
    "reason": "schedule_removed",
    "expectedVersion": "2026-06-09T10:30:01Z",
    "confirmationToken": "TOKEN-REDACTED"
  }
}
```

### `system.cancelRebootSchedule` response

```json
{
  "id": 57,
  "status": {
    "ok": true,
    "code": 0
  },
  "result": {
    "cancelled": true,
    "scheduleId": "reboot-default",
    "type": "reboot",
    "changedFields": ["rebootSchedules"],
    "version": "2026-06-09T10:30:02Z"
  }
}
```

### `system.setShutdownSchedule` request

```json
{
  "id": 54,
  "method": "system.setShutdownSchedule",
  "params": {
    "mode": "daily",
    "timeOfDay": "23:30:00",
    "timezone": "Asia/Shanghai",
    "reason": "store_closed",
    "replaceExisting": true,
    "expectedVersion": "2026-06-09T10:30:01Z",
    "confirmationToken": "TOKEN-REDACTED"
  }
}
```

### `system.setShutdownSchedule` response

```json
{
  "id": 54,
  "status": {
    "ok": true,
    "code": 0
  },
  "result": {
    "scheduled": true,
    "schedule": {
      "scheduleId": "shutdown-default",
      "type": "shutdown",
      "enabled": true,
      "mode": "daily",
      "timeOfDay": "23:30:00",
      "timezone": "Asia/Shanghai",
      "nextRunAt": "2026-06-09T23:30:00+08:00",
      "reason": "store_closed",
      "version": "2026-06-09T10:30:00Z"
    },
    "changedFields": ["shutdownSchedules"],
    "version": "2026-06-09T10:30:02Z"
  }
}
```

### `system.lifecycleStateChanged` scheduled shutdown event

```json
{
  "event": "system.lifecycleStateChanged",
  "intent": 1,
  "data": {
    "reason": "scheduled_shutdown",
    "state": {
      "state": "shutdown_scheduled",
      "lastAction": "schedule_shutdown",
      "shutdownSchedules": [
        {
          "scheduleId": "shutdown-default",
          "type": "shutdown",
          "enabled": true,
          "mode": "daily",
          "nextRunAt": "2026-06-09T23:30:00+08:00"
        }
      ],
      "disconnectExpected": false,
      "updatedAt": "2026-06-09T10:30:00Z"
    }
  }
}
```

### `system.cancelShutdownSchedule` request

```json
{
  "id": 55,
  "method": "system.cancelShutdownSchedule",
  "params": {
    "scheduleId": "shutdown-default",
    "reason": "schedule_removed",
    "expectedVersion": "2026-06-09T10:30:02Z",
    "confirmationToken": "TOKEN-REDACTED"
  }
}
```

### `system.cancelShutdownSchedule` response

```json
{
  "id": 55,
  "status": {
    "ok": true,
    "code": 0
  },
  "result": {
    "cancelled": true,
    "scheduleId": "shutdown-default",
    "type": "shutdown",
    "changedFields": ["shutdownSchedules"],
    "version": "2026-06-09T10:30:03Z"
  }
}
```

### `system.shutdown` request

```json
{
  "id": 51,
  "method": "system.shutdown",
  "params": {
    "reason": "maintenance",
    "delaySeconds": 30,
    "confirmationToken": "TOKEN-REDACTED"
  }
}
```

### `system.lifecycleStateChanged` event

```json
{
  "event": "system.lifecycleStateChanged",
  "intent": 1,
  "data": {
    "actionId": "act-REDACTED",
    "reason": "user_request",
    "state": {
      "state": "rebooting",
      "lastAction": "reboot",
      "lastActionId": "act-REDACTED",
      "disconnectExpected": true,
      "updatedAt": "2026-06-09T10:30:00Z"
    }
  }
}
```

### failure response

```json
{
  "id": 50,
  "status": {
    "ok": false,
    "code": 5,
    "msg": "Busy.",
    "details": {
      "candidateError": "SYSTEM_LIFECYCLE_BUSY"
    }
  }
}
```

## 10. 候选 Errors

| Error | 类别 | 说明 | Review |
|---|---|---|---|
| `SYSTEM_LIFECYCLE_PERMISSION_DENIED` | system | 无权执行立即重启、计划重启、计划关机或关机；JSON 示例使用通用 `PERMISSION_DENIED`。 | `[REVIEW-DRAFT]` |
| `SYSTEM_LIFECYCLE_BUSY` | system | 已有 lifecycle 动作进行中；JSON 示例使用通用 `BUSY`。 | `[REVIEW-DRAFT]` |
| `SYSTEM_LIFECYCLE_INVALID_STATE` | system | 当前状态不允许 reboot/shutdown 或 schedule get/set/cancel；JSON 示例使用通用 `INVALID_STATE`。 | `[REVIEW-DRAFT]` |
| `SYSTEM_LIFECYCLE_INVALID_SCHEDULE` | system | 计划重启/计划关机时间、时区或重复规则非法；JSON 示例可使用 `INVALID_ARGUMENT` / `OUT_OF_RANGE`。 | `[REVIEW-DRAFT]` |
| `SYSTEM_LIFECYCLE_SCHEDULE_NOT_FOUND` | system | 查询或取消的计划不存在；JSON 示例可使用通用 `NOT_FOUND`。 | `[REVIEW-DRAFT]` |
| `SYSTEM_LIFECYCLE_CONFIRMATION_REQUIRED` | system | 缺少危险操作确认；采纳时确认是否使用通用 `PERMISSION_DENIED` 或新增业务错误。 | `[REVIEW-ASK]` |

## 11. Legacy 待映射

| 来源 | 旧协议条目 | 候选映射 | 状态 | 说明 |
|---|---|---|---|---|
| AXDP | `CommonSetReboot` | `system.reboot` | `[REVIEW-ASK]` | 参数和结果状态需确认。 |
| VM33 | `DevicePwr.Reboot` | `system.reboot` | `[REVIEW-ASK]` | 旧命名含 `DevicePwr`，新语义仍归 lifecycle。 |
| VM33 | `DevicePwr.ShutDown` | `system.shutdown` | `[REVIEW-OK]` | 软件关机/下电统一映射到 shutdown。 |
| Rooms / Signage / VM33 | `KeepAlive` / `SetLive` / `UnConnect` | core heartbeat / local session policy / optional lifecycle state event | `[REVIEW-ASK]` | 可能是连接保活，不进入泛配置方法。 |
| AXDP / VM33 | `RebootInterval` | `system.getRebootSchedule` / `system.setRebootSchedule` / `system.cancelRebootSchedule` | `[REVIEW-ASK]` | 需要确认旧字段是周期性重启、重启间隔，还是设备本地策略。 |
| AXDP / VM33 | `AutoShutDown` | `system.getShutdownSchedule` / `system.setShutdownSchedule` / `system.cancelShutdownSchedule` | `[REVIEW-DRAFT]` | 本轮按 planned graceful shutdown schedule 处理；硬件/固件电源计划不进入 system feature。 |
| AXDP / VM33 | `AutoPower` | out of scope / adapter-private | `[REVIEW-ASK]` | 自动上电/外部电源控制不进入本轮 `system.lifecycle` 或独立 system power feature。 |

## 12. Registry 草案输入

```yaml
capabilities:
  - id: system.lifecycle
    name: system.lifecycle capability
    status: draft
    methods:
      - system.getLifecycleState
      - system.reboot
      - system.shutdown
      - system.getRebootSchedule
      - system.setRebootSchedule
      - system.cancelRebootSchedule
      - system.getShutdownSchedule
      - system.setShutdownSchedule
      - system.cancelShutdownSchedule
    events:
      - system.lifecycleStateChanged

methods:
  - name: system.getLifecycleState
    id: TBD after adoption
    bitOffset: TBD after adoption
    domain: system
    requestSchema: GetLifecycleStateParams
    responseSchema: LifecycleState
    capabilities:
      - system.lifecycle
  - name: system.reboot
    id: TBD after adoption
    bitOffset: TBD after adoption
    domain: system
    requestSchema: RebootParams
    responseSchema: LifecycleActionResult
    capabilities:
      - system.lifecycle
  - name: system.getRebootSchedule
    id: TBD after adoption
    bitOffset: TBD after adoption
    domain: system
    requestSchema: GetRebootScheduleParams
    responseSchema: LifecycleScheduleList
    capabilities:
      - system.lifecycle
  - name: system.setRebootSchedule
    id: TBD after adoption
    bitOffset: TBD after adoption
    domain: system
    requestSchema: SetRebootScheduleParams
    responseSchema: SetLifecycleScheduleResult
    capabilities:
      - system.lifecycle
  - name: system.cancelRebootSchedule
    id: TBD after adoption
    bitOffset: TBD after adoption
    domain: system
    requestSchema: CancelRebootScheduleParams
    responseSchema: CancelScheduleResult
    capabilities:
      - system.lifecycle
  - name: system.getShutdownSchedule
    id: TBD after adoption
    bitOffset: TBD after adoption
    domain: system
    requestSchema: GetShutdownScheduleParams
    responseSchema: LifecycleScheduleList
    capabilities:
      - system.lifecycle
  - name: system.setShutdownSchedule
    id: TBD after adoption
    bitOffset: TBD after adoption
    domain: system
    requestSchema: SetShutdownScheduleParams
    responseSchema: SetLifecycleScheduleResult
    capabilities:
      - system.lifecycle
  - name: system.cancelShutdownSchedule
    id: TBD after adoption
    bitOffset: TBD after adoption
    domain: system
    requestSchema: CancelShutdownScheduleParams
    responseSchema: CancelScheduleResult
    capabilities:
      - system.lifecycle
  - name: system.shutdown
    id: TBD after adoption
    bitOffset: TBD after adoption
    domain: system
    requestSchema: ShutdownParams
    responseSchema: LifecycleActionResult
    capabilities:
      - system.lifecycle

events:
  - name: system.lifecycleStateChanged
    id: TBD after adoption
    bitOffset: TBD after adoption
    domain: system
    eventSchema: LifecycleStateChangedEvent
    capabilities:
      - system.lifecycle
```

## 13. 采纳检查清单

- [ ] 08 已确认 `system.lifecycle` 覆盖软件 shutdown/power-off 诉求，且不再保留独立 system power 草案。
- [ ] 10 已确认 getLifecycleState/reboot/shutdown、reboot schedule get/set/cancel、shutdown schedule get/set/cancel 是否进入 P0。
- [ ] 11 已确认 lifecycle event 的 eventId、eventMasks bitOffset 和断连前发送策略。
- [ ] 12 已确认权限、busy、confirmation required 的错误码策略。
- [ ] 13 已确认 enum、actionId、dangerous action confirmation schema。
- [ ] legacy RebootInterval 已确定是否进入 `system.getRebootSchedule` / `system.setRebootSchedule` / `system.cancelRebootSchedule`，AutoShutdown 已确定是否进入 `system.getShutdownSchedule` / `system.setShutdownSchedule` / `system.cancelShutdownSchedule`，KeepAlive/AutoPower 已确定是否进入 core/session telemetry、adapter-private，或未来其他 capability。

## 14. 待确认问题

1. `confirmationToken` 的生成、有效期和权限模型归哪个 domain？
2. reboot schedule 和 shutdown schedule 是否允许各自多个计划并存，还是每种类型只维护一个默认计划？
3. typed cancel 是否需要保留 `scheduleId`，还是每种类型固定取消默认计划即可？
4. `force` 是否进入 P0，还是只保留 graceful reboot/shutdown？
5. 断连前 event 是否必须发送，还是只作为 best effort？
6. KeepAlive 是否应留在 AXTP session/transport 层，而不是业务 lifecycle 方法？
7. AutoPower/硬件自动上电是否完全作为 adapter-private，还是未来另建非 system 的外部电源控制 capability？
