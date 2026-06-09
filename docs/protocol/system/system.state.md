# AXTP system.state 协议草案

版本：v0.1

归属域：`system`

Capability ID：`system.state`

适用范围：当前设备 OS / runtime 的通用运行状态读取和低频状态变化通知，包括在线状态、uptime、CPU、内存、负载和进程/runtime 摘要。

---

## 协议审核标记（人工复核）

| 标记 | 条目 | 审核结论 | 后续动作 |
|---|---|---|---|
| `[REVIEW-OK]` | domain.feature | `system.state` 回答“这台机器现在怎么运行”，属于 system 运行时状态层。 | 可作为 `registry/domains/system/domain.yaml` 草案输入。 |
| `[REVIEW-OK]` | 与 device 的边界 | 原 `device.state` 中 CPU/内存/在线等运行时状态迁移到 `system.state`。 | 采纳时不要重新创建独立 `device.state` 草案或 capability。 |
| `[REVIEW-OK]` | 与 power/health 的边界 | 电源/电池/下电控制归 `system.power`；健康/温度/告警归 `system.health`。 | 三个 capability 分别采纳。 |
| `[REVIEW-ASK]` | P0 字段 | CPU、内存、uptime、online、load、process/runtime summary 的 P0 范围需确认。 | 采纳前确定字段基线和采样/节流策略。 |
| `[REVIEW-ASK]` | legacy 映射 | `device.state` legacy 分类中泛设备状态需要重新拆到 `system.state` 或 `system.health`。 | 采纳前补 legacyRefs。 |

---

## 1. 文档定位

本文是 `docs/flows/device-system-info.md` 的 Stage 20 协议草案输入，不是最终协议事实源。采纳后，稳定事实必须写入 `registry/domains/system/domain.yaml` 或相关 registry YAML，再由 Generator 生成 `protocol/axtp.protocol.yaml` 和 `docs/generated/*`。

当前 generated 协议没有 adopted `system.state` 方法；本文中的方法名和字段均为草案候选，数值 ID 使用 `TBD after adoption`。

## 2. 业务需求

| 项 | 内容 |
|---|---|
| 需求来源 | `docs/flows/device-system-info.md`、设备系统状态面板需求、legacy `device.state` 迁移方向。 |
| 目标用户 | App / PC host / cloud console / monitoring service。 |
| 目标行为 | 读取设备当前通用运行状态，并在低频状态变化时同步 UI。 |
| 当前实现程度 | Not drafted；此前冲突的 `device.state` 草案已迁移并删除。 |

## 3. Domain 边界

| 项 | 决策 |
|---|---|
| Domain | `system` |
| Feature | `system.state` |
| Capability | `system.state` |
| 负责 | `online`、`uptimeSeconds`、CPU、内存、load、runtime/process 摘要。 |
| 不属于本文 | 设备身份属于 `device.info`；电源/电池/power off 属于 `system.power`；温度/健康/告警属于 `system.health`；高频 telemetry 或传感器流不走本 event。 |

## 4. 候选 Capability

| Capability | 状态 | 说明 |
|---|---|---|
| `system.state` | draft | 通用运行时状态读取和低频变化通知。 |

## 5. 候选 Methods

| Method | Params Schema | Result Schema | 说明 | Review |
|---|---|---|---|---|
| `system.getState` | `GetSystemStateParams` | `SystemState` | 查询通用运行状态快照。 | `[REVIEW-OK]` |

## 6. 候选 Events

| Event | Schema | 触发时机 | Review |
|---|---|---|---|
| `system.stateChanged` | `SystemStateChangedEvent` | online、uptime reset、CPU/内存摘要跨阈值或 runtime 状态变化。 | `[REVIEW-DRAFT]` |

## 7. 候选 Schemas

### `GetSystemStateParams`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `sections` | string[] | no | 可选返回段，例如 `cpu` / `memory` / `runtime`；默认返回 P0 段。 | `[REVIEW-DRAFT]` |

### `SystemState`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `online` | boolean | yes | 系统是否处于可服务状态。 | `[REVIEW-OK]` |
| `uptimeSeconds` | uint64 | no | 自上次启动以来的运行秒数。 | `[REVIEW-DRAFT]` |
| `bootId` | string | no | 启动周期 ID，用于识别重启。 | `[REVIEW-DRAFT]` |
| `cpu` | `SystemCpuState` | no | CPU 使用摘要。 | `[REVIEW-DRAFT]` |
| `memory` | `SystemMemoryState` | no | 内存使用摘要。 | `[REVIEW-DRAFT]` |
| `load` | `SystemLoadState` | no | 系统负载摘要。 | `[REVIEW-ASK]` |
| `runtime` | `SystemRuntimeSummary` | no | AXTP host/runtime 运行摘要。 | `[REVIEW-DRAFT]` |
| `sampledAt` | string timestamp | no | 采样时间。 | `[REVIEW-DRAFT]` |

### `SystemCpuState`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `usagePercent` | float | no | 总 CPU 使用率。 | `[REVIEW-DRAFT]` |
| `cores` | uint16 | no | CPU 核心数。 | `[REVIEW-DRAFT]` |

### `SystemMemoryState`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `usedBytes` | uint64 | no | 已使用内存。 | `[REVIEW-DRAFT]` |
| `totalBytes` | uint64 | no | 总内存。 | `[REVIEW-DRAFT]` |
| `availableBytes` | uint64 | no | 可用内存。 | `[REVIEW-DRAFT]` |

### `SystemLoadState`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `load1m` | float | no | 1 分钟 load average；不适用平台可省略。 | `[REVIEW-ASK]` |
| `load5m` | float | no | 5 分钟 load average。 | `[REVIEW-ASK]` |
| `load15m` | float | no | 15 分钟 load average。 | `[REVIEW-ASK]` |

### `SystemRuntimeSummary`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `state` | string enum | no | `running` / `starting` / `degraded` / `stopping` / `unknown`。 | `[REVIEW-ASK]` |
| `processId` | uint32 | no | host 进程 ID；仅本地诊断使用。 | `[REVIEW-DRAFT]` |
| `restartCount` | uint32 | no | runtime 重启次数。 | `[REVIEW-DRAFT]` |

### `SystemStateChangedEvent`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `changedFields` | string[] | yes | 变化字段路径。 | `[REVIEW-DRAFT]` |
| `state` | `SystemState` | no | 变化后的状态快照或部分快照。 | `[REVIEW-DRAFT]` |
| `reason` | string enum | no | `poll_threshold` / `boot` / `runtime_restart` / `service_change`。 | `[REVIEW-ASK]` |

## 8. JSON 示例

示例只写 RPC `d` 数据块，不包裹外层 `sid` / `op` / `d` wire envelope。

### `system.getState` request

```json
{
  "id": 20,
  "method": "system.getState",
  "params": {
    "sections": ["cpu", "memory", "runtime"]
  }
}
```

### `system.getState` response

```json
{
  "id": 20,
  "status": {
    "ok": true,
    "code": 0
  },
  "result": {
    "online": true,
    "uptimeSeconds": 3600,
    "bootId": "boot-REDACTED",
    "cpu": {
      "usagePercent": 42.5,
      "cores": 8
    },
    "memory": {
      "usedBytes": 2147483648,
      "totalBytes": 8589934592,
      "availableBytes": 6442450944
    },
    "runtime": {
      "state": "running",
      "restartCount": 0
    },
    "sampledAt": "2026-06-09T10:30:00Z"
  }
}
```

### `system.stateChanged` event

```json
{
  "event": "system.stateChanged",
  "intent": 1,
  "data": {
    "changedFields": ["cpu.usagePercent"],
    "reason": "poll_threshold",
    "state": {
      "cpu": {
        "usagePercent": 82.4
      },
      "sampledAt": "2026-06-09T10:31:00Z"
    }
  }
}
```

### failure response

```json
{
  "id": 20,
  "status": {
    "ok": false,
    "code": 15,
    "msg": "Unavailable.",
    "details": {
      "candidateError": "SYSTEM_STATE_UNAVAILABLE"
    }
  }
}
```

## 9. 候选 Errors

| Error | 类别 | 说明 | Review |
|---|---|---|---|
| `SYSTEM_STATE_UNAVAILABLE` | system | 系统状态服务暂不可用；JSON 示例使用通用 `UNAVAILABLE`。 | `[REVIEW-DRAFT]` |
| `SYSTEM_STATE_SECTION_NOT_SUPPORTED` | system | 请求了设备不支持的 section；JSON 示例可使用 `NOT_SUPPORTED`。 | `[REVIEW-DRAFT]` |

## 10. Legacy 待映射

| 来源 | 旧协议条目 | 候选映射 | 状态 | 说明 |
|---|---|---|---|---|
| AXDP / Rooms / VM33 | `CommonGetTipsStatus`、`CheckLineStatus`、`DeviceStatus.Get` 等 | `system.getState` 或 `system.getHealth` | `[REVIEW-ASK]` | 原分类为 `device.state`，需按字段拆到 state/health。 |
| Signage | `OnTelemetryReport` 中 CPU/内存类字段 | `system.stateChanged` | `[REVIEW-ASK]` | 遥测字段集合未确认；高频字段可能不进入 event。 |

## 11. Registry 草案输入

```yaml
capabilities:
  - id: system.state
    name: system.state capability
    status: draft
    methods:
      - system.getState
    events:
      - system.stateChanged

methods:
  - name: system.getState
    id: TBD after adoption
    bitOffset: TBD after adoption
    domain: system
    requestSchema: GetSystemStateParams
    responseSchema: SystemState
    capabilities:
      - system.state

events:
  - name: system.stateChanged
    id: TBD after adoption
    bitOffset: TBD after adoption
    domain: system
    eventSchema: SystemStateChangedEvent
    capabilities:
      - system.state
```

## 12. 采纳检查清单

- [ ] 08 已确认 `system.state` 可作为本 flow 的 capability 块。
- [ ] 10 已确认 `system.getState` 的 schema 和 section 策略。
- [ ] 11 已确认 `system.stateChanged` 的节流、阈值和 eventMasks bitOffset。
- [ ] 12 已确认错误码复用或新增策略。
- [ ] 13 已确认 fieldId 和跨平台可选字段表达。
- [ ] legacy `device.state` 线索已拆分到 `system.state` / `system.health`。

## 13. 待确认问题

1. CPU、内存、online、uptime、load、runtime summary 中哪些是 P0？
2. `stateChanged` 是否只在阈值跨越时发送，还是任意采样变化都发送？
3. Windows、Android、Linux、RTOS 对 `load` 和 `processId` 的支持差异如何表达？
4. `bootId` 是否需要稳定到重启周期，还是只用 `uptimeSeconds` 足够？
