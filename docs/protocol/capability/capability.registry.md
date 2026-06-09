# AXTP capability.registry 协议草案

版本：v0.3

归属域：`capability`

Capability ID：`capability.registry`

适用范围：运行时能力注册表查询、domain.feature 建模发现、supported methods/events 查询、权限/可用性摘要，以及能力变化通知。

---

## 协议审核标记（人工复核）

| 标记 | 条目 | 审核结论 | 后续动作 |
|---|---|---|---|
| `[REVIEW-OK]` | domain.feature | `capability.registry` 是 capability 域内的发现/协商能力，不承载业务 capability 自身语义。 | 可作为 `registry/domains/capability/domain.yaml` 草案输入。 |
| `[REVIEW-OK]` | 与 `device.getInfo` 的关系 | `device.getInfo.capability` 只给建模摘要；完整 methods/events/permissions/dynamic availability 由本文方法查询。 | 采纳前两个草案需保持字段语义一致。 |
| `[REVIEW-DRAFT]` | 查询粒度 | 提供全局查询和按 domain 查询两个入口。 | 采纳前确认是否需要 feature 级查询。 |
| `[REVIEW-ASK]` | 权限模型 | permissions/availability 的字段、枚举和来源仍需确认。 | 采纳前与 auth/profile 设计对齐。 |
| `[REVIEW-ASK]` | legacy 映射 | legacy 协议通常没有完整能力发现，需要确认是否只做 adapter static profile。 | 采纳前补 legacyRefs 或明确无直接映射。 |

---

## 1. 文档定位

本文是 `docs/flows/device-system-info.md` 的 Stage 20 协议草案输入，不是最终协议事实源。采纳后，稳定事实必须写入 `registry/domains/capability/domain.yaml` 或相关 registry YAML，再由 Generator 生成 `protocol/axtp.protocol.yaml` 和 `docs/generated/*`。

当前 generated 协议没有 adopted `capability.registry` 方法；本文中的方法名和字段均为草案候选，数值 ID 使用 `TBD after adoption`。

## 2. 业务需求

| 项 | 内容 |
|---|---|
| 需求来源 | `docs/flows/device-system-info.md` 的运行时能力发现步骤。 |
| 目标用户 | App / PC host / cloud console / SDK runtime。 |
| 目标行为 | 在 generated registry 之外，查询当前设备实际启用的 domain.feature、methods、events、权限和动态可用性。 |
| 当前实现程度 | Drafted only；原草案为配置型模板，需要重写为查询型 capability registry。 |

## 3. Domain 边界

| 项 | 决策 |
|---|---|
| Domain | `capability` |
| Feature | `capability.registry` |
| Capability | `capability.registry` |
| 负责 | 设备当前支持的 domains、features、methods、events、profile、权限/可用性摘要。 |
| 不属于本文 | 各业务 capability 的字段能力范围由各 domain feature 自己定义；generated registry 仍是已采纳协议事实源；安全认证归 auth。 |

## 4. 协议决策

| 决策点 | 结论 | 理由 |
|---|---|---|
| 新增/修改/复用 | Modify existing draft | 复用 `capability.registry` capability，但替换配置型模板。 |
| 全量查询 | `capability.getRegistry` | 读取当前 endpoint 的运行时能力注册表。 |
| 分域查询 | `capability.getDomainRegistry` | 降低响应体大小，便于按 UI 页面按需加载。 |
| Event | `capability.registryChanged` | 能力动态启停、子模块变化、权限变化或固件/软件更新后通知。 |

## 5. 候选 Capability

| Capability | 状态 | 说明 |
|---|---|---|
| `capability.registry` | draft | 运行时能力注册表查询和变化通知。 |

## 6. 候选 Methods

| Method | Params Schema | Result Schema | 说明 | Review |
|---|---|---|---|---|
| `capability.getRegistry` | `GetCapabilityRegistryParams` | `CapabilityRegistry` | 查询当前 endpoint 的全局能力注册表。 | `[REVIEW-DRAFT]` |
| `capability.getDomainRegistry` | `GetDomainRegistryParams` | `CapabilityRegistry` | 查询指定 domain 的能力注册表片段。 | `[REVIEW-DRAFT]` |

## 7. 候选 Events

| Event | Schema | 触发时机 | Review |
|---|---|---|---|
| `capability.registryChanged` | `CapabilityRegistryChangedEvent` | domain.feature、method/event 可用性、权限或 profile 变化。 | `[REVIEW-DRAFT]` |

## 8. 候选 Schemas

### `GetCapabilityRegistryParams`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `domains` | string[] | no | 过滤 domain；省略表示查询全部。 | `[REVIEW-DRAFT]` |
| `includeMethods` | boolean | no | 是否返回 method 列表；默认 `true`。 | `[REVIEW-DRAFT]` |
| `includeEvents` | boolean | no | 是否返回 event 列表；默认 `true`。 | `[REVIEW-DRAFT]` |
| `includePermissions` | boolean | no | 是否返回权限摘要；默认 `false`。 | `[REVIEW-ASK]` |
| `includeUnavailable` | boolean | no | 是否返回已建模但当前不可用的能力；默认 `false`。 | `[REVIEW-DRAFT]` |

### `GetDomainRegistryParams`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `domain` | string | yes | 要查询的 domain。 | `[REVIEW-DRAFT]` |
| `includeMethods` | boolean | no | 是否返回 method 列表。 | `[REVIEW-DRAFT]` |
| `includeEvents` | boolean | no | 是否返回 event 列表。 | `[REVIEW-DRAFT]` |
| `includePermissions` | boolean | no | 是否返回权限摘要。 | `[REVIEW-ASK]` |
| `includeUnavailable` | boolean | no | 是否返回当前不可用项。 | `[REVIEW-DRAFT]` |

### `CapabilityRegistry`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `profile` | string | no | 当前能力 profile。 | `[REVIEW-DRAFT]` |
| `generatedRegistryVersion` | string | no | 设备编译时生成 registry 版本。 | `[REVIEW-DRAFT]` |
| `runtimeRegistryVersion` | string | no | 运行时能力快照版本。 | `[REVIEW-DRAFT]` |
| `domains` | `CapabilityDomain[]` | yes | domain 能力列表。 | `[REVIEW-DRAFT]` |
| `generatedAt` | string timestamp | no | 快照生成时间。 | `[REVIEW-DRAFT]` |

### `CapabilityDomain`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `domain` | string | yes | domain 名称。 | `[REVIEW-DRAFT]` |
| `available` | boolean | yes | domain 当前是否可用。 | `[REVIEW-DRAFT]` |
| `features` | `CapabilityFeature[]` | yes | domain 下 feature 列表。 | `[REVIEW-DRAFT]` |

### `CapabilityFeature`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `id` | string | yes | `domain.feature` capability ID。 | `[REVIEW-DRAFT]` |
| `available` | boolean | yes | capability 当前是否可用。 | `[REVIEW-DRAFT]` |
| `status` | string enum | no | `draft` / `experimental` / `stable` / `deprecated` 等。 | `[REVIEW-ASK]` |
| `methods` | `CapabilityMethod[]` | no | 支持的 method。 | `[REVIEW-DRAFT]` |
| `events` | `CapabilityEvent[]` | no | 支持的 event。 | `[REVIEW-DRAFT]` |
| `permissions` | string[] | no | 调用需要的权限摘要。 | `[REVIEW-ASK]` |
| `reasonUnavailable` | string | no | 当前不可用原因。 | `[REVIEW-DRAFT]` |

### `CapabilityMethod`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `name` | string | yes | method name。 | `[REVIEW-DRAFT]` |
| `available` | boolean | yes | 当前是否可调用。 | `[REVIEW-DRAFT]` |
| `permission` | string | no | 所需权限摘要。 | `[REVIEW-ASK]` |

### `CapabilityEvent`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `name` | string | yes | event name。 | `[REVIEW-DRAFT]` |
| `available` | boolean | yes | 当前是否可能上报。 | `[REVIEW-DRAFT]` |
| `subscribed` | boolean | no | 当前 session 是否订阅。 | `[REVIEW-DRAFT]` |

### `CapabilityRegistryChangedEvent`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `changedFeatures` | string[] | yes | 发生变化的 `domain.feature` 列表。 | `[REVIEW-DRAFT]` |
| `changedMethods` | string[] | no | 发生变化的 method 列表。 | `[REVIEW-DRAFT]` |
| `changedEvents` | string[] | no | 发生变化的 event 列表。 | `[REVIEW-DRAFT]` |
| `reason` | string enum | no | `module_attached` / `module_detached` / `permission_changed` / `software_update` / `runtime_update`。 | `[REVIEW-ASK]` |
| `registry` | `CapabilityRegistry` | no | 变化后的完整或部分能力快照。 | `[REVIEW-DRAFT]` |

## 9. JSON 示例

示例只写 RPC `d` 数据块，不包裹外层 `sid` / `op` / `d` wire envelope。

### `capability.getRegistry` request

```json
{
  "id": 60,
  "method": "capability.getRegistry",
  "params": {
    "domains": ["device", "system"],
    "includeMethods": true,
    "includeEvents": true,
    "includePermissions": false
  }
}
```

### `capability.getRegistry` response

```json
{
  "id": 60,
  "status": {
    "ok": true,
    "code": 0
  },
  "result": {
    "profile": "windows-managed-device",
    "generatedRegistryVersion": "1.0.0",
    "runtimeRegistryVersion": "2026-06-09T10:30:00Z",
    "domains": [
      {
        "domain": "device",
        "available": true,
        "features": [
          {
            "id": "device.info",
            "available": true,
            "status": "draft",
            "methods": [
              {
                "name": "device.getInfo",
                "available": true
              }
            ],
            "events": [
              {
                "name": "device.infoChanged",
                "available": true,
                "subscribed": true
              }
            ]
          }
        ]
      },
      {
        "domain": "system",
        "available": true,
        "features": [
          {
            "id": "system.state",
            "available": true,
            "status": "draft",
            "methods": [
              {
                "name": "system.getState",
                "available": true
              },
              {
                "name": "system.resetState",
                "available": true
              }
            ],
            "events": [
              {
                "name": "system.stateChanged",
                "available": true,
                "subscribed": true
              }
            ]
          },
          {
            "id": "system.lifecycle",
            "available": true,
            "status": "draft",
            "methods": [
              {
                "name": "system.getLifecycleState",
                "available": true
              },
              {
                "name": "system.reboot",
                "available": true
              },
              {
                "name": "system.shutdown",
                "available": true
              },
              {
                "name": "system.getLifecycleSchedules",
                "available": true
              },
              {
                "name": "system.setRebootSchedule",
                "available": true
              },
              {
                "name": "system.setShutdownSchedule",
                "available": true
              },
              {
                "name": "system.cancelLifecycleSchedule",
                "available": true
              }
            ],
            "events": [
              {
                "name": "system.lifecycleStateChanged",
                "available": true,
                "subscribed": true
              }
            ]
          },
          {
            "id": "system.reset",
            "available": true,
            "status": "draft",
            "methods": [
              {
                "name": "system.getResetCapabilities",
                "available": true
              },
              {
                "name": "system.getResetState",
                "available": true
              },
              {
                "name": "system.resetDevice",
                "available": true,
                "permission": "system.reset"
              }
            ],
            "events": [
              {
                "name": "system.resetStateChanged",
                "available": true,
                "subscribed": true
              }
            ]
          },
          {
            "id": "system.power",
            "available": true,
            "status": "draft",
            "methods": [
              {
                "name": "system.getPowerState",
                "available": true
              },
              {
                "name": "system.powerOff",
                "available": true
              }
            ],
            "events": [
              {
                "name": "system.powerStateChanged",
                "available": true,
                "subscribed": true
              }
            ]
          }
        ]
      }
    ],
    "generatedAt": "2026-06-09T10:30:00Z"
  }
}
```

### `capability.registryChanged` event

```json
{
  "event": "capability.registryChanged",
  "intent": 1,
  "data": {
    "changedFeatures": ["device.childDevice"],
    "changedMethods": ["device.getChildren"],
    "reason": "module_attached",
    "registry": {
      "domains": [
        {
          "domain": "device",
          "available": true,
          "features": [
            {
              "id": "device.childDevice",
              "available": true,
              "methods": [
                {
                  "name": "device.getChildren",
                  "available": true
                }
              ]
            }
          ]
        }
      ]
    }
  }
}
```

### failure response

```json
{
  "id": 60,
  "status": {
    "ok": false,
    "code": 10,
    "msg": "Invalid argument.",
    "details": {
      "candidateError": "CAPABILITY_REGISTRY_INVALID_FILTER"
    }
  }
}
```

## 10. 候选 Errors

| Error | 类别 | 说明 | Review |
|---|---|---|---|
| `CAPABILITY_REGISTRY_INVALID_FILTER` | capability | 查询过滤条件非法；JSON 示例使用通用 `INVALID_ARGUMENT`。 | `[REVIEW-DRAFT]` |
| `CAPABILITY_REGISTRY_UNAVAILABLE` | capability | 运行时能力注册表暂不可用；JSON 示例可使用 `UNAVAILABLE`。 | `[REVIEW-DRAFT]` |

## 11. Legacy 待映射

| 来源 | 旧协议条目 | 候选映射 | 状态 | 说明 |
|---|---|---|---|---|
| AXDP / Rooms / VM33 / Signage | 无统一能力发现接口 | static product profile 或 adapter capability snapshot | `[REVIEW-ASK]` | legacy 多数通过产品型号和版本推断能力。 |

## 12. Registry 草案输入

```yaml
capabilities:
  - id: capability.registry
    name: capability.registry capability
    status: draft
    methods:
      - capability.getRegistry
      - capability.getDomainRegistry
    events:
      - capability.registryChanged

methods:
  - name: capability.getRegistry
    id: TBD after adoption
    bitOffset: TBD after adoption
    domain: capability
    requestSchema: GetCapabilityRegistryParams
    responseSchema: CapabilityRegistry
    capabilities:
      - capability.registry
  - name: capability.getDomainRegistry
    id: TBD after adoption
    bitOffset: TBD after adoption
    domain: capability
    requestSchema: GetDomainRegistryParams
    responseSchema: CapabilityRegistry
    capabilities:
      - capability.registry

events:
  - name: capability.registryChanged
    id: TBD after adoption
    bitOffset: TBD after adoption
    domain: capability
    eventSchema: CapabilityRegistryChangedEvent
    capabilities:
      - capability.registry
```

## 13. 采纳检查清单

- [ ] 08 已确认 `capability.registry` 粒度和 method/event 命名。
- [ ] 10 已确认 capability methods 的 methodId、bitOffset 和 schema。
- [ ] 11 已确认 `capability.registryChanged` 的 eventId 和 eventMasks bitOffset。
- [ ] 12 已确认 capability registry 业务错误复用或新增策略。
- [ ] 13 已确认 supported methods/events/permissions 的 schema fieldId。
- [ ] 与 `device.getInfo.capability` 的轻量摘要语义保持一致。

## 14. 待确认问题

1. 是否需要 `capability.getFeatureRegistry` 作为 feature 级查询，还是 domain 级足够？
2. `status` 是否应暴露 draft/experimental/stable，还是只暴露 available？
3. permissions 字段如何与 auth/access control 对齐？
4. `subscribed` 是否应该属于 event registry，还是 session/eventMasks 运行时状态？
5. legacy 产品能力是否通过静态 profile 填充，还是不提供 capability registry？
