# AXTP device.childDevice 协议草案

版本：v0.2

归属域：`device`

Capability ID：`device.childDevice`

适用范围：当前 AXTP endpoint 代理、管理或挂载的子设备/级联设备发现、详情读取、可选拓扑读取和子设备状态变化通知。

---

## 协议审核标记（人工复核）

| 标记 | 条目 | 审核结论 | 后续动作 |
|---|---|---|---|
| `[REVIEW-OK]` | domain.feature | `device.childDevice` 回答“谁在我下面”，属于 device 物理设备拓扑层。 | 可作为 `registry/domains/device/domain.yaml` 草案输入。 |
| `[REVIEW-OK]` | `device.getInfo` 边界 | 子设备不默认塞进 `device.getInfo`。 | `device.getInfo` 只返回主 endpoint 信息。 |
| `[REVIEW-DRAFT]` | 拓扑读取 | `device.getTopology` 作为 P1/P2 候选；P0 可以只采纳 `getChildren` / `getChildInfo`。 | 产品确认是否需要 full tree。 |
| `[REVIEW-ASK]` | 子设备 ID 稳定性 | `deviceId` / `localId` / `serialNumber` / `path` 的稳定性规则未完全确认。 | 采纳前补 ID 生成和断连重连规则。 |
| `[REVIEW-ASK]` | legacy 映射 | Rooms AMX100、VM33 等子设备命令需要字段级映射。 | 采纳前补 legacyRefs 或明确 adapter-only。 |

---

## 1. 文档定位

本文是 `docs/flows/device-system-info.md` 的 Stage 20 协议草案输入，不是最终协议事实源。采纳后，稳定事实必须写入 `registry/domains/device/domain.yaml` 或相关 registry YAML，再由 Generator 生成 `protocol/axtp.protocol.yaml` 和 `docs/generated/*`。

当前 generated 协议没有 adopted `device.childDevice` 方法；本文中的方法名和字段均为草案候选，数值 ID 使用 `TBD after adoption`。

## 2. 业务需求

| 项 | 内容 |
|---|---|
| 需求来源 | `docs/flows/device-system-info.md`、主从/级联设备参考方案、legacy AMX100 子设备命令。 |
| 目标用户 | App / PC host / cloud console / device management service。 |
| 目标行为 | 连接主设备后按需读取一级子设备摘要、指定子设备详情，必要时读取完整拓扑，并监听子设备上线、离线、连接关系或健康摘要变化。 |
| 当前实现程度 | Drafted only；原草案存在但需要从配置型模板改为拓扑/详情查询协议。 |

## 3. Domain 边界

| 项 | 决策 |
|---|---|
| Domain | `device` |
| Feature | `device.childDevice` |
| Capability | `device.childDevice` |
| 负责 | 直接 children、单个 child detail、可选 topology、子设备 attach/detach/online/summary 状态事件。 |
| 不属于本文 | 当前 endpoint 主设备信息属于 `device.info`；子设备自身业务能力仍由其 capability summary 或独立 endpoint 协议表达；高频 telemetry 不走本 event。 |

## 4. 协议决策

| 决策点 | 结论 | 理由 |
|---|---|---|
| 新增/修改/复用 | Modify existing draft | 复用 `device.childDevice` capability，但替换配置型模板。 |
| P0 查询 | `device.getChildren` / `device.getChildInfo` | 列表轻量、详情按需拉取。 |
| P1/P2 查询 | `device.getTopology` | 完整树成本更高，不作为 `getInfo` 替代品。 |
| Event | `device.childDeviceStateChanged` | 低频连接、在线、关系、摘要状态变化通过 RPC Event。 |

## 5. 候选 Capability

| Capability | 状态 | 说明 |
|---|---|---|
| `device.childDevice` | draft | 子设备发现、详情读取、拓扑读取和状态变化。 |

## 6. 候选 Methods

| Method | Params Schema | Result Schema | 说明 | Review |
|---|---|---|---|---|
| `device.getChildren` | `GetChildrenParams` | `GetChildrenResult` | 查询当前 endpoint 或指定 parent 的直接子设备摘要。 | `[REVIEW-OK]` |
| `device.getChildInfo` | `GetChildInfoParams` | `ChildDeviceInfo` | 查询指定子设备详情。 | `[REVIEW-OK]` |
| `device.getTopology` | `GetTopologyParams` | `DeviceTopology` | 查询完整或限定深度拓扑树。 | `[REVIEW-DRAFT]` |

## 7. 候选 Events

| Event | Schema | 触发时机 | Review |
|---|---|---|---|
| `device.childDeviceStateChanged` | `ChildDeviceStateChangedEvent` | 子设备 attached、detached、online、offline、relation、path、health summary 或 capability summary 变化。 | `[REVIEW-DRAFT]` |

## 8. 候选 Schemas

### `GetChildrenParams`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `parentDeviceId` | string | no | 父设备 ID；默认当前 endpoint 主设备。 | `[REVIEW-DRAFT]` |
| `includeInfo` | string enum | no | `summary` / `none`；默认 `summary`。 | `[REVIEW-DRAFT]` |
| `includeCapabilities` | boolean | no | 是否返回轻量 capability summary；默认 `false`。 | `[REVIEW-DRAFT]` |
| `cursor` | string | no | 分页游标。 | `[REVIEW-DRAFT]` |
| `limit` | uint16 | no | 返回数量上限。 | `[REVIEW-DRAFT]` |

### `GetChildrenResult`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `parentDeviceId` | string | no | 父设备 ID。 | `[REVIEW-DRAFT]` |
| `children` | `ChildDeviceSummary[]` | yes | 直接子设备摘要。 | `[REVIEW-OK]` |
| `nextCursor` | string | no | 下一页游标。 | `[REVIEW-DRAFT]` |

### `GetChildInfoParams`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `childDeviceId` | string | yes | 子设备 ID。 | `[REVIEW-OK]` |
| `includeCapabilitySummary` | boolean | no | 是否返回 capability 摘要；默认 `true`。 | `[REVIEW-DRAFT]` |

### `GetTopologyParams`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `rootDeviceId` | string | no | 根设备 ID；默认当前 endpoint 主设备。 | `[REVIEW-DRAFT]` |
| `maxDepth` | uint8 | no | 最大深度；默认由设备决定。 | `[REVIEW-ASK]` |
| `includeOffline` | boolean | no | 是否包含离线但仍可识别的子设备。 | `[REVIEW-DRAFT]` |
| `includeCapabilitySummary` | boolean | no | 是否返回 capability 摘要。 | `[REVIEW-DRAFT]` |

### `ChildDeviceSummary`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `deviceId` | string | yes | 子设备稳定 ID。 | `[REVIEW-ASK]` |
| `parentDeviceId` | string | no | 父设备 ID。 | `[REVIEW-DRAFT]` |
| `relation` | string enum | yes | `attached` / `managed` / `proxied` / `virtual`。 | `[REVIEW-ASK]` |
| `path` | string | no | 拓扑路径，例如 `dev_root/dev_child`。 | `[REVIEW-DRAFT]` |
| `online` | boolean | yes | 子设备是否在线。 | `[REVIEW-OK]` |
| `product` | `ChildDeviceProduct` | no | 产品摘要。 | `[REVIEW-DRAFT]` |
| `connection` | `ChildDeviceConnection` | no | 连接摘要。 | `[REVIEW-DRAFT]` |
| `health` | string enum | no | `ok` / `degraded` / `fault` / `unknown`。 | `[REVIEW-DRAFT]` |
| `capability` | `ChildDeviceCapabilitySummary` | no | 轻量建模摘要。 | `[REVIEW-DRAFT]` |

### `ChildDeviceProduct`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `productType` | string enum | no | 子设备产品类型，例如 `cameraDevice` / `microphoneDevice` / `displayDevice`。 | `[REVIEW-ASK]` |
| `model` | string | no | 子设备型号。 | `[REVIEW-DRAFT]` |
| `displayName` | string | no | 子设备显示名。 | `[REVIEW-DRAFT]` |

### `ChildDeviceConnection`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `type` | string enum | no | `usb` / `ip` / `bluetooth` / `internal` / `virtual`。 | `[REVIEW-ASK]` |
| `port` | string | no | 端口或连接路径。 | `[REVIEW-DRAFT]` |
| `address` | string | no | 网络或总线地址；敏感时可省略。 | `[REVIEW-DRAFT]` |

### `ChildDeviceCapabilitySummary`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `profile` | string | no | 子设备 profile 摘要。 | `[REVIEW-DRAFT]` |
| `features` | string[] | no | 子设备暴露的主要 `domain.feature`。 | `[REVIEW-DRAFT]` |

### `ChildDeviceInfo`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `summary` | `ChildDeviceSummary` | yes | 子设备摘要。 | `[REVIEW-OK]` |
| `serialNumber` | string | no | 子设备 SN。 | `[REVIEW-DRAFT]` |
| `hardware` | object | no | 子设备硬件摘要。 | `[REVIEW-DRAFT]` |
| `software` | object | no | 子设备软件摘要。 | `[REVIEW-DRAFT]` |
| `state` | object | no | 子设备低频状态摘要；高频状态应由对应 domain 读取。 | `[REVIEW-ASK]` |

### `DeviceTopology`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `root` | `ChildDeviceNode` | yes | 根节点。 | `[REVIEW-DRAFT]` |
| `generatedAt` | string timestamp | no | 拓扑快照生成时间。 | `[REVIEW-DRAFT]` |

### `ChildDeviceNode`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `summary` | `ChildDeviceSummary` | yes | 当前节点摘要。 | `[REVIEW-DRAFT]` |
| `children` | `ChildDeviceNode[]` | no | 子节点。 | `[REVIEW-DRAFT]` |

### `ChildDeviceStateChangedEvent`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `changeType` | string enum | yes | `attached` / `detached` / `online` / `offline` / `updated`。 | `[REVIEW-ASK]` |
| `deviceId` | string | yes | 发生变化的子设备 ID。 | `[REVIEW-OK]` |
| `parentDeviceId` | string | no | 父设备 ID。 | `[REVIEW-DRAFT]` |
| `summary` | `ChildDeviceSummary` | no | 变化后的摘要。 | `[REVIEW-DRAFT]` |
| `changedFields` | string[] | no | 变化字段路径。 | `[REVIEW-DRAFT]` |

## 9. JSON 示例

示例只写 RPC `d` 数据块，不包裹外层 `sid` / `op` / `d` wire envelope。

### `device.getChildren` request

```json
{
  "id": 10,
  "method": "device.getChildren",
  "params": {
    "includeInfo": "summary",
    "includeCapabilities": false,
    "limit": 50
  }
}
```

### `device.getChildren` response

```json
{
  "id": 10,
  "status": {
    "ok": true,
    "code": 0
  },
  "result": {
    "parentDeviceId": "dev_001",
    "children": [
      {
        "deviceId": "dev_camera_001",
        "parentDeviceId": "dev_001",
        "relation": "attached",
        "path": "dev_001/dev_camera_001",
        "online": true,
        "product": {
          "productType": "cameraDevice",
          "model": "CAM-A1",
          "displayName": "Front Camera"
        },
        "connection": {
          "type": "usb",
          "port": "usb-1"
        }
      }
    ]
  }
}
```

### `device.getChildInfo` request

```json
{
  "id": 11,
  "method": "device.getChildInfo",
  "params": {
    "childDeviceId": "dev_camera_001",
    "includeCapabilitySummary": true
  }
}
```

### `device.getChildInfo` response

```json
{
  "id": 11,
  "status": {
    "ok": true,
    "code": 0
  },
  "result": {
    "summary": {
      "deviceId": "dev_camera_001",
      "parentDeviceId": "dev_001",
      "relation": "attached",
      "path": "dev_001/dev_camera_001",
      "online": true,
      "health": "ok",
      "product": {
        "productType": "cameraDevice",
        "model": "CAM-A1",
        "displayName": "Front Camera"
      },
      "capability": {
        "features": ["camera.ptz", "video.stream"]
      }
    },
    "serialNumber": "SN-REDACTED"
  }
}
```

### `device.childDeviceStateChanged` event

```json
{
  "event": "device.childDeviceStateChanged",
  "intent": 1,
  "data": {
    "changeType": "offline",
    "deviceId": "dev_camera_001",
    "parentDeviceId": "dev_001",
    "changedFields": ["online"],
    "summary": {
      "deviceId": "dev_camera_001",
      "online": false
    }
  }
}
```

### failure response

```json
{
  "id": 11,
  "status": {
    "ok": false,
    "code": 12,
    "msg": "Not found.",
    "details": {
      "candidateError": "CHILD_DEVICE_NOT_FOUND"
    }
  }
}
```

## 10. 候选 Errors

| Error | 类别 | 说明 | Review |
|---|---|---|---|
| `CHILD_DEVICE_NOT_FOUND` | device | 指定子设备不存在或已断开；JSON 示例使用通用 `NOT_FOUND`。 | `[REVIEW-DRAFT]` |
| `CHILD_DEVICE_PERMISSION_DENIED` | device | 无权查看子设备详情或拓扑；JSON 示例使用通用 `PERMISSION_DENIED`。 | `[REVIEW-DRAFT]` |
| `CHILD_DEVICE_TOPOLOGY_TOO_DEEP` | device | `maxDepth` 超过设备支持范围；JSON 示例可使用 `OUT_OF_RANGE`。 | `[REVIEW-DRAFT]` |

## 11. Legacy 待映射

| 来源 | 旧协议条目 | 候选映射 | 状态 | 说明 |
|---|---|---|---|---|
| Rooms | `AMX100Connect` / `AMX100DisConnect` | `device.childDeviceStateChanged` 或后续管理方法 | `[REVIEW-ASK]` | 需要确认是命令控制连接，还是 SDK 管理动作。 |
| Rooms | `GetAMX100DeviceInfo` / `GetAMX100Param` / `GetAMX100Ip` | `device.getChildInfo` | `[REVIEW-ASK]` | 字段应进入 summary、connection、state 还是子设备专属 domain 需确认。 |
| Rooms | `AMX100ConnectStatusEvent` | `device.childDeviceStateChanged` | `[REVIEW-ASK]` | 状态枚举和在线/连接含义需映射。 |

## 12. Registry 草案输入

```yaml
capabilities:
  - id: device.childDevice
    name: device.childDevice capability
    status: draft
    methods:
      - device.getChildren
      - device.getChildInfo
      - device.getTopology
    events:
      - device.childDeviceStateChanged

methods:
  - name: device.getChildren
    id: TBD after adoption
    bitOffset: TBD after adoption
    domain: device
    requestSchema: GetChildrenParams
    responseSchema: GetChildrenResult
    capabilities:
      - device.childDevice
  - name: device.getChildInfo
    id: TBD after adoption
    bitOffset: TBD after adoption
    domain: device
    requestSchema: GetChildInfoParams
    responseSchema: ChildDeviceInfo
    capabilities:
      - device.childDevice
  - name: device.getTopology
    id: TBD after adoption
    bitOffset: TBD after adoption
    domain: device
    requestSchema: GetTopologyParams
    responseSchema: DeviceTopology
    capabilities:
      - device.childDevice

events:
  - name: device.childDeviceStateChanged
    id: TBD after adoption
    bitOffset: TBD after adoption
    domain: device
    eventSchema: ChildDeviceStateChangedEvent
    capabilities:
      - device.childDevice
```

## 13. 采纳检查清单

- [ ] 08 已确认 `device.childDevice` 粒度，不拆成字段级 feature。
- [ ] 10 已确认 children/detail/topology 三个方法是否都进入 P0。
- [ ] 11 已确认事件名、事件 payload 和 eventMasks bitOffset。
- [ ] 12 已确认错误码复用或新增策略。
- [ ] 13 已确认 schema fieldId 和数组/分页表达。
- [ ] legacy AMX100 映射已字段级确认。

## 14. 待确认问题

1. P0 是否只支持一级 children，`device.getTopology` 是否延后到 P1/P2？
2. 子设备 ID 的稳定性规则是什么？断开重连后 `deviceId` 是否保持不变？
3. `relation` 首批 enum 是哪些？
4. 子设备详情中的 `state` 是否只允许低频摘要，还是应完全拆到对应子设备 endpoint/domain？
5. 子设备分页、排序和权限策略如何定义？
