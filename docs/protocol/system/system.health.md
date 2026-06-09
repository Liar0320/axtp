# AXTP system.health 协议草案

版本：v0.1

归属域：`system`

Capability ID：`system.health`

适用范围：当前设备的健康状态、温度摘要、告警、故障和 degraded reason 读取与变化通知。

---

## 协议审核标记（人工复核）

| 标记 | 条目 | 审核结论 | 后续动作 |
|---|---|---|---|
| `[REVIEW-OK]` | domain.feature | `system.health` 表达健康/温度/告警控制范围，和 `system.state` / `system.power` 分开。 | 可作为 `registry/domains/system/domain.yaml` 草案输入。 |
| `[REVIEW-DRAFT]` | 温度归属 | 温度作为健康信号进入 `system.health` P0 候选，不进入 `device.info`。 | 采纳前确认传感器粒度。 |
| `[REVIEW-ASK]` | health / warning / fault 枚举 | 首批健康枚举、告警码和故障码需要设备与测试确认。 | 采纳前补 enum baseline。 |
| `[REVIEW-ASK]` | legacy 映射 | 旧 telemetry / tips / line status 里的健康字段需拆分映射。 | 采纳前补 legacyRefs。 |

---

## 1. 文档定位

本文是 `docs/flows/device-system-info.md` 的 Stage 20 协议草案输入，不是最终协议事实源。采纳后，稳定事实必须写入 `registry/domains/system/domain.yaml` 或相关 registry YAML，再由 Generator 生成 `protocol/axtp.protocol.yaml` 和 `docs/generated/*`。

## 2. 业务需求

| 项 | 内容 |
|---|---|
| 需求来源 | `docs/flows/device-system-info.md` 的 system split 方向。 |
| 目标用户 | App / PC host / cloud console / monitoring service。 |
| 目标行为 | 读取设备健康、温度、warning/fault 摘要，并在状态变差或恢复时通知 UI。 |
| 当前实现程度 | Not drafted。 |

## 3. Domain 边界

| 项 | 决策 |
|---|---|
| Domain | `system` |
| Feature | `system.health` |
| Capability | `system.health` |
| 负责 | `health`、temperature、warnings、faults、degradedReason。 |
| 不属于本文 | CPU/内存/uptime 属于 `system.state`；电源/电池属于 `system.power`；设备型号属于 `device.info`。 |

## 4. 候选 Capability

| Capability | 状态 | 说明 |
|---|---|---|
| `system.health` | draft | 健康、温度、告警和故障摘要。 |

## 5. 候选 Methods

| Method | Params Schema | Result Schema | 说明 | Review |
|---|---|---|---|---|
| `system.getHealth` | `GetSystemHealthParams` | `SystemHealth` | 查询健康状态快照。 | `[REVIEW-OK]` |

## 6. 候选 Events

| Event | Schema | 触发时机 | Review |
|---|---|---|---|
| `system.healthChanged` | `SystemHealthChangedEvent` | 健康等级、温度阈值、warning/fault 集合变化。 | `[REVIEW-DRAFT]` |

## 7. 候选 Schemas

### `GetSystemHealthParams`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `includeSensors` | boolean | no | 是否返回传感器级明细；默认 `false`。 | `[REVIEW-DRAFT]` |

### `SystemHealth`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `health` | string enum | yes | `ok` / `degraded` / `fault` / `unknown`。 | `[REVIEW-ASK]` |
| `temperature` | `TemperatureSummary` | no | 默认温度摘要。 | `[REVIEW-DRAFT]` |
| `warnings` | `HealthIssue[]` | no | 告警列表。 | `[REVIEW-DRAFT]` |
| `faults` | `HealthIssue[]` | no | 故障列表。 | `[REVIEW-DRAFT]` |
| `degradedReason` | string | no | degraded 的人类可读原因或枚举。 | `[REVIEW-ASK]` |
| `sampledAt` | string timestamp | no | 采样时间。 | `[REVIEW-DRAFT]` |

### `TemperatureSummary`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `celsius` | float | no | 默认/主温度值。 | `[REVIEW-DRAFT]` |
| `sensors` | `TemperatureSensor[]` | no | 传感器明细。 | `[REVIEW-DRAFT]` |

### `TemperatureSensor`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `id` | string | yes | 传感器 ID。 | `[REVIEW-DRAFT]` |
| `name` | string | no | 传感器显示名。 | `[REVIEW-DRAFT]` |
| `celsius` | float | yes | 当前温度。 | `[REVIEW-DRAFT]` |
| `state` | string enum | no | `normal` / `warning` / `critical` / `unknown`。 | `[REVIEW-ASK]` |

### `HealthIssue`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `code` | string | yes | 告警或故障码。 | `[REVIEW-ASK]` |
| `severity` | string enum | no | `info` / `warning` / `error` / `critical`。 | `[REVIEW-DRAFT]` |
| `message` | string | no | 人类可读说明。 | `[REVIEW-DRAFT]` |
| `source` | string | no | 来源，例如 `thermal` / `storage` / `runtime`。 | `[REVIEW-DRAFT]` |
| `since` | string timestamp | no | 首次出现时间。 | `[REVIEW-DRAFT]` |

### `SystemHealthChangedEvent`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `changedFields` | string[] | yes | 变化字段路径。 | `[REVIEW-DRAFT]` |
| `health` | `SystemHealth` | no | 变化后的完整或部分健康快照。 | `[REVIEW-DRAFT]` |
| `reason` | string enum | no | `temperature_threshold` / `warning_added` / `fault_added` / `recovered`。 | `[REVIEW-ASK]` |

## 8. JSON 示例

### `system.getHealth` request

```json
{
  "id": 30,
  "method": "system.getHealth",
  "params": {
    "includeSensors": false
  }
}
```

### `system.getHealth` response

```json
{
  "id": 30,
  "status": {
    "ok": true,
    "code": 0
  },
  "result": {
    "health": "ok",
    "temperature": {
      "celsius": 48.2
    },
    "warnings": [],
    "faults": [],
    "sampledAt": "2026-06-09T10:30:00Z"
  }
}
```

### `system.healthChanged` event

```json
{
  "event": "system.healthChanged",
  "intent": 1,
  "data": {
    "changedFields": ["health", "warnings"],
    "reason": "warning_added",
    "health": {
      "health": "degraded",
      "warnings": [
        {
          "code": "TEMP_HIGH",
          "severity": "warning",
          "message": "Temperature is above warning threshold.",
          "source": "thermal"
        }
      ]
    }
  }
}
```

### failure response

```json
{
  "id": 30,
  "status": {
    "ok": false,
    "code": 15,
    "msg": "Unavailable.",
    "details": {
      "candidateError": "SYSTEM_HEALTH_UNAVAILABLE"
    }
  }
}
```

## 9. 候选 Errors

| Error | 类别 | 说明 | Review |
|---|---|---|---|
| `SYSTEM_HEALTH_UNAVAILABLE` | system | 健康服务或传感器暂不可用；JSON 示例使用通用 `UNAVAILABLE`。 | `[REVIEW-DRAFT]` |
| `SYSTEM_HEALTH_SENSOR_NOT_SUPPORTED` | system | 请求了不支持的传感器明细；JSON 示例可使用 `NOT_SUPPORTED`。 | `[REVIEW-DRAFT]` |

## 10. Legacy 待映射

| 来源 | 旧协议条目 | 候选映射 | 状态 | 说明 |
|---|---|---|---|---|
| AXDP / Rooms / VM33 | Tips / line status / device status 中健康类字段 | `system.getHealth` / `system.healthChanged` | `[REVIEW-ASK]` | 需确认字段是否表达健康、在线还是产测状态。 |
| Signage | `OnTelemetryReport` 中温度类字段 | `system.healthChanged` | `[REVIEW-ASK]` | 高频 telemetry 可能只保留阈值变化事件。 |

## 11. Registry 草案输入

```yaml
capabilities:
  - id: system.health
    name: system.health capability
    status: draft
    methods:
      - system.getHealth
    events:
      - system.healthChanged

methods:
  - name: system.getHealth
    id: TBD after adoption
    bitOffset: TBD after adoption
    domain: system
    requestSchema: GetSystemHealthParams
    responseSchema: SystemHealth
    capabilities:
      - system.health

events:
  - name: system.healthChanged
    id: TBD after adoption
    bitOffset: TBD after adoption
    domain: system
    eventSchema: SystemHealthChangedEvent
    capabilities:
      - system.health
```

## 12. 采纳检查清单

- [ ] 08 已确认 `system.health` 与 `system.state` / `system.power` 的边界。
- [ ] 10 已确认 `system.getHealth` 的 P0 字段。
- [ ] 11 已确认 `system.healthChanged` 的阈值和节流策略。
- [ ] 12 已确认错误码复用或新增策略。
- [ ] 13 已确认 warning/fault enum 或字符串码策略。

## 13. 待确认问题

1. 温度是否进入 P0，是否需要多传感器明细？
2. `health` 枚举是否采用 `ok/degraded/fault/unknown`？
3. warnings/faults 的 code 是否由 AXTP 标准化，还是允许厂商扩展？
4. 旧 telemetry 是周期上报还是只在阈值变化时事件通知？
