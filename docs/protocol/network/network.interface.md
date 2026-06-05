# AXTP network.interface 协议草案

版本：v0.3

归属域：`network`

Capability ID：`network.interface`

适用范围：设备网络接口发现、接口标识、接口类型、MAC 摘要、管理状态和基础链路状态。

---

## 协议审核标记

| 标记 | 对象 | 结论 | 后续动作 |
|---|---|---|---|
| `[REVIEW-DRAFT]` | `network.interface` capability | 本文将 v0.2 的完整接口模型收敛为 AP/Wi-Fi/IP 的前置发现层。 | 产品/架构/研发确认后进入 `adopt-protocol-draft`。 |
| `[REVIEW-OK]` | domain.feature 粒度 | 网络接口是 `network` 域下合适的基础能力块；不把 `MAC`、`State`、`Link` 拆成独立 feature。 | 采纳前按 08 再次复核 method/event 命名。 |
| `[REVIEW-DRAFT]` | 事件分层 | `network.interfaceStateChanged` 只表达接口存在性、管理状态和基础链路变化；Wi-Fi/AP/IP 的业务状态由各自 feature 事件表达。 | 采纳前与 Wi-Fi/AP/IP 草案一起确认。 |
| `[REVIEW-ASK]` | MAC 写入 | MAC 写入属于制造、产测或管理员场景，默认不进入运行时 MVP。 | 如需采纳，单独确认权限、重启和 legacy 行为。 |
| `[REVIEW-ASK]` | legacy 映射 | AXDP / Rooms 的 MAC 相关命令已有候选归属，但 payload 和状态码仍需字段级确认。 | 落 registry 前补齐 legacyRefs 或明确 adapter-only。 |

## 1. 文档定位

本文是 `docs/protocol` 评审输入，不是最终协议事实源。采纳后，稳定事实必须反向确认到 `docs/specs/08-13`，涉及 profile/MVP 时同步确认 `docs/specs/14`，再写入 `registry/domains/network/domain.yaml`，并由 `generate-axtp-protocol` 生成 `protocol/axtp.protocol.yaml` 和 `docs/generated/*`。

当前 generated 协议没有 adopted `network.interface` 方法、事件或 schema；本文所有 methodId、eventId、errorCode、fieldId 均为 `TBD after adoption`。

## 2. 业务需求

| 项 | 内容 |
|---|---|
| 需求来源 | `network.ap`、`network.wifi`、`network.ip` 对 `interfaceId` 的前置依赖。 |
| 目标用户 | 上位机网络配置服务、设备固件、产测/诊断工具、自动化测试。 |
| 目标行为 | 调用方先发现设备支持哪些接口，再把 `interfaceId` 传给 AP/Wi-Fi/IP 协议。 |
| 当前实现程度 | Drafted only：`docs/protocol/network/network.interface.md` 存在草案，但 YAML/generated 尚未采纳。 |

## 3. Domain 边界

| 项 | 决策 |
|---|---|
| Domain | `network` |
| Feature | `network.interface` |
| Capability | `network.interface` |
| 负责 | 接口枚举、接口详情、接口类型、角色、MAC 摘要、管理状态、基础链路状态。 |
| 不负责 | IP/DHCP/DNS/路由，归 `network.ip`；Wi-Fi STA profile/扫描/连接，归 `network.wifi`；AP/SoftAP 配置、启停和客户端列表，归 `network.ap`。 |
| 设计原则 | `network.interface` 是引用层，不承载上层角色状态；其他 network feature 只引用 `interfaceId`，不重复定义接口发现。 |

## 4. 简化决策

| 决策点 | 结论 | 理由 |
|---|---|---|
| 新增/修改/复用 | Modify existing draft | v0.2 字段过宽，现收敛为最小可采纳接口发现协议。 |
| MVP 方法 | `getInterfaces`、`getInterfaceInfo` | 满足 AP/Wi-Fi/IP 前置发现。 |
| Deferred 方法 | `setInterfaceConfig` | 主要服务制造/产测/管理员，不作为普通运行时 MVP。 |
| 事件范围 | 仅基础接口状态 | 避免和 `wifiStateChanged`、`apStateChanged`、`ipConfigChanged` 重复。 |
| 字段策略 | 必填少、可选少 | 运行计数器、永久 MAC、射频组、可配置字段等暂不进入 MVP schema。 |

## 5. 候选 Capability

| Capability | 状态 | 说明 |
|---|---|---|
| `network.interface` | draft | 设备支持枚举网络接口，并报告接口标识、类型、角色、MAC 摘要、管理状态和基础链路状态。 |

## 6. 候选 Methods

| Method | Params Schema | Result Schema | MVP | 说明 | Review |
|---|---|---|---:|---|---|
| `network.getInterfaces` | `NetworkGetInterfacesRequest` | `NetworkInterfaces` | yes | 列出设备网络接口，供 AP/Wi-Fi/IP 配置选择 `interfaceId`。 | `[REVIEW-DRAFT]` |
| `network.getInterfaceInfo` | `NetworkGetInterfaceInfoRequest` | `NetworkInterfaceInfo` | yes | 查询单个接口基础详情。 | `[REVIEW-DRAFT]` |
| `network.setInterfaceConfig` | `NetworkSetInterfaceConfigRequest` | `NetworkSetInterfaceConfigResponse` | no | 可选受限接口配置，例如禁用接口、设置 MTU 或 MAC。 | `[REVIEW-ASK]` |

方法错误候选：`SUCCESS`、`NOT_SUPPORTED`、`INVALID_ARGUMENT`、`INVALID_STATE`、`PERMISSION_DENIED`、`NOT_FOUND`、`UNAVAILABLE`、`INTERNAL_ERROR`。

## 7. 候选 Events

| Event | Schema | MVP | 触发时机 | Review |
|---|---|---:|---|---|
| `network.interfaceStateChanged` | `NetworkInterfaceStateChangedEvent` | yes | 接口新增/移除、启用/禁用、基础链路 up/down 变化。 | `[REVIEW-DRAFT]` |

事件去重规则：

1. Wi-Fi 认证、扫描、连接过程只发 `network.wifiStateChanged`，不要求同步发 `network.interfaceStateChanged`。
2. AP start/stop/running 只发 `network.apStateChanged`，不要求同步发 `network.interfaceStateChanged`。
3. DHCP/static 地址变化只发 `network.ipConfigChanged`，不要求同步发 `network.interfaceStateChanged`。
4. 只有接口存在性、管理状态或底层链路状态本身发生变化时，才发 `network.interfaceStateChanged`。

## 8. 候选 Schemas

### `NetworkGetInterfacesRequest`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `typeFilter` | `NetworkInterfaceType[]` | no | 只返回指定类型，例如 `ethernet`、`wifi`。 | `[REVIEW-DRAFT]` |
| `roleFilter` | `NetworkInterfaceRole[]` | no | 只返回指定角色，例如 `sta`、`ap`、`uplink`。 | `[REVIEW-DRAFT]` |

### `NetworkInterfaces`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `interfaces` | `NetworkInterfaceSummary[]` | yes | 接口摘要列表。 | `[REVIEW-DRAFT]` |
| `defaults` | `NetworkDefaultInterfaceIds` | no | 默认接口绑定。 | `[REVIEW-DRAFT]` |

### `NetworkDefaultInterfaceIds`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `uplink` | string | no | 默认上联网口。 | `[REVIEW-DRAFT]` |
| `wifiSta` | string | no | 默认 Wi-Fi STA 接口。 | `[REVIEW-DRAFT]` |
| `ap` | string | no | 默认 AP/SoftAP 接口。 | `[REVIEW-DRAFT]` |

### `NetworkGetInterfaceInfoRequest`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `interfaceId` | string | yes | 目标接口标识，例如 `eth0`、`wlan0`、`ap0`。 | `[REVIEW-DRAFT]` |

### `NetworkInterfaceSummary`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `interfaceId` | string | yes | 稳定接口标识，其他 network feature 通过该字段引用接口。 | `[REVIEW-DRAFT]` |
| `type` | `NetworkInterfaceType` | yes | 接口类型。 | `[REVIEW-DRAFT]` |
| `roles` | `NetworkInterfaceRole[]` | no | 接口角色，例如 `sta`、`ap`、`uplink`。 | `[REVIEW-DRAFT]` |
| `state` | `NetworkInterfaceState` | yes | 基础接口状态。 | `[REVIEW-DRAFT]` |
| `macAddress` | string | no | 当前 MAC；可按隐私策略省略或脱敏。 | `[REVIEW-DRAFT]` |

### `NetworkInterfaceInfo`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `interfaceId` | string | yes | 接口标识。 | `[REVIEW-DRAFT]` |
| `type` | `NetworkInterfaceType` | yes | 接口类型。 | `[REVIEW-DRAFT]` |
| `roles` | `NetworkInterfaceRole[]` | no | 接口角色。 | `[REVIEW-DRAFT]` |
| `state` | `NetworkInterfaceState` | yes | 基础接口状态。 | `[REVIEW-DRAFT]` |
| `macAddress` | string | no | 当前 MAC；可按隐私策略省略或脱敏。 | `[REVIEW-DRAFT]` |
| `mtu` | uint16 | no | 当前 MTU。 | `[REVIEW-DRAFT]` |
| `displayName` | string | no | 面向 UI 的显示名。 | `[REVIEW-DRAFT]` |

### `NetworkInterfaceState`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `admin` | enum | yes | `enabled`、`disabled`、`unavailable`、`unsupported`。 | `[REVIEW-DRAFT]` |
| `link` | enum | yes | `up`、`down`、`unknown`。只表示基础链路，不表达 Wi-Fi/AP/IP 业务状态。 | `[REVIEW-DRAFT]` |

### `NetworkInterfaceStateChangedEvent`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `interfaceId` | string | yes | 发生变化的接口。 | `[REVIEW-DRAFT]` |
| `state` | `NetworkInterfaceState` | yes | 变化后的基础接口状态。 | `[REVIEW-DRAFT]` |
| `previousState` | `NetworkInterfaceState` | no | 变化前状态。 | `[REVIEW-DRAFT]` |
| `reason` | enum | no | `user_request`、`system_policy`、`link_lost`、`link_restored`、`interface_added`、`interface_removed`、`error`。 | `[REVIEW-DRAFT]` |

### Deferred Schemas

| Schema / Field | 延后原因 | Review |
|---|---|---|
| `NetworkSetInterfaceConfigRequest` / `NetworkSetInterfaceConfigResponse` | 需要权限模型和防断连策略；MVP 不依赖。 | `[REVIEW-ASK]` |
| `permanentMacAddress` | 涉及隐私、制造信息和权限。 | `[REVIEW-ASK]` |
| `runtimeCounters` | 更像诊断/统计，不是 AP/Wi-Fi/IP 前置条件。 | `[REVIEW-DRAFT]` |
| `radioGroupId` | STA/AP 并发能力应优先由 AP/Wi-Fi capability 暴露。 | `[REVIEW-DRAFT]` |

### Shared / Enum Types

| Type | 候选值 | 说明 | Review |
|---|---|---|---|
| `NetworkInterfaceType` | `ethernet`, `wifi`, `usb_network`, `cellular`, `bridge`, `virtual`, `unknown` | 接口类型。 | `[REVIEW-DRAFT]` |
| `NetworkInterfaceRole` | `uplink`, `sta`, `ap`, `control`, `management` | 接口角色。 | `[REVIEW-DRAFT]` |

## 9. JSON 示例

示例用于评审 `network.interface` request/response/event 语义，不是 generated 事实源。JSON 示例只写 RPC `d` 数据块，不包裹外层 `sid` / `op` / `d` wire envelope；Request 使用 `id`、`method`、`params`，Response 使用 `id`、`status`、`result`，Event 使用 `event`、`intent`、`data`。`status.code` 必须是数字 ErrorCode。MAC 等设备相关字段均使用占位符。

### 9.1 查询接口列表

```json
{
  "id": 301,
  "method": "network.getInterfaces",
  "params": {}
}
```

```json
{
  "id": 301,
  "status": {
    "ok": true,
    "code": 0
  },
  "result": {
    "interfaces": [
      {
        "interfaceId": "eth0",
        "type": "ethernet",
        "roles": [
          "uplink",
          "control"
        ],
        "state": {
          "admin": "enabled",
          "link": "up"
        },
        "macAddress": "<ETH0_MAC>"
      },
      {
        "interfaceId": "wlan0",
        "type": "wifi",
        "roles": [
          "sta"
        ],
        "state": {
          "admin": "enabled",
          "link": "up"
        },
        "macAddress": "<WLAN0_MAC>"
      },
      {
        "interfaceId": "ap0",
        "type": "wifi",
        "roles": [
          "ap"
        ],
        "state": {
          "admin": "enabled",
          "link": "up"
        },
        "macAddress": "<AP0_MAC>"
      }
    ],
    "defaults": {
      "uplink": "eth0",
      "wifiSta": "wlan0",
      "ap": "ap0"
    }
  }
}
```

### 9.2 查询接口详情

```json
{
  "id": 302,
  "method": "network.getInterfaceInfo",
  "params": {
    "interfaceId": "wlan0"
  }
}
```

```json
{
  "id": 302,
  "status": {
    "ok": true,
    "code": 0
  },
  "result": {
    "interfaceId": "wlan0",
    "type": "wifi",
    "roles": [
      "sta"
    ],
    "state": {
      "admin": "enabled",
      "link": "up"
    },
    "macAddress": "<WLAN0_MAC>",
    "mtu": 1500,
    "displayName": "Wi-Fi STA"
  }
}
```

### 9.3 接口基础链路变化事件

```json
{
  "event": "network.interfaceStateChanged",
  "intent": 2,
  "data": {
    "interfaceId": "eth0",
    "previousState": {
      "admin": "enabled",
      "link": "up"
    },
    "state": {
      "admin": "enabled",
      "link": "down"
    },
    "reason": "link_lost"
  }
}
```

### 9.4 接口不存在失败示例

```json
{
  "id": 303,
  "method": "network.getInterfaceInfo",
  "params": {
    "interfaceId": "<MISSING_INTERFACE_ID>"
  }
}
```

```json
{
  "id": 303,
  "status": {
    "ok": false,
    "code": 12,
    "msg": "Network interface was not found.",
    "details": {
      "candidateError": "NETWORK_INTERFACE_NOT_FOUND",
      "interfaceId": "<MISSING_INTERFACE_ID>"
    }
  }
}
```

## 10. 候选 Errors

| Error | 类别 | 说明 | Review |
|---|---|---|---|
| `NETWORK_INTERFACE_NOT_FOUND` | network/business | 指定 `interfaceId` 不存在或当前不可见。 | `[REVIEW-DRAFT]` |
| `NETWORK_INTERFACE_CONFIG_DENIED` | network/business | 当前权限不允许修改接口配置，尤其是 MAC 写入。 | `[REVIEW-ASK]` |
| `NETWORK_INTERFACE_CONFIG_UNSUPPORTED` | network/business | 设备或接口不支持请求的配置字段。 | `[REVIEW-DRAFT]` |

采纳时若通用错误码足够表达上述场景，可不新增业务错误；否则错误码应在 network domain 范围内分配，编号为 `TBD after adoption`。

## 11. Legacy 待映射

| 来源 | 旧协议条目 | 候选映射 | 状态 | 说明 |
|---|---|---|---|---|
| AXDP HID | `CommonSetMacAddress` (`0xC010C / 0x010C -> 0x018C`) | deferred `network.setInterfaceConfig` | `[REVIEW-ASK]` | MAC 写入不进入默认 MVP；需确认权限和重启。 |
| AXDP HID | `CommonGetMacAddress` (`0xC010D / 0x010D -> 0x018D`) | `network.getInterfaceInfo` | `[REVIEW-ASK]` | 需确认返回的是当前 MAC、出厂 MAC 还是默认网口 MAC。 |
| Rooms WS JSON | `SetMacAddr` | deferred `network.setInterfaceConfig` | `[REVIEW-ASK]` | 需确认权限、持久化和状态码。 |
| Rooms WS JSON | `GetMacAddr` | `network.getInterfaceInfo` | `[REVIEW-ASK]` | 需确认是否可映射到默认 `interfaceId`。 |

## 12. Registry 草案输入

采纳本文后，`registry/domains/network/domain.yaml` 至少应包含：

```yaml
capabilities:
  - id: network.interface
    name: network.interface capability
    status: draft
    schema: NetworkInterfaces
    methods:
      - network.getInterfaces
      - network.getInterfaceInfo
    events:
      - network.interfaceStateChanged

methods:
  - name: network.getInterfaces
    id: TBD after adoption
    bitOffset: TBD after adoption
    requestSchema: NetworkGetInterfacesRequest
    responseSchema: NetworkInterfaces
    capabilities: [network.interface]
```

`network.setInterfaceConfig` 若采纳，应作为 optional method 追加，不能默认进入 MVP。

## 13. 采纳检查清单

- [ ] 08 已确认 `network.interface` 粒度和 method/event 命名。
- [ ] 09 已确认 network domain 写入 `registry/domains/network/domain.yaml`。
- [ ] 10 已确认 methodId、bitOffset、request/response schema。
- [ ] 11 已确认 eventId、eventMasks bitOffset、event schema。
- [ ] 12 已确认是否新增 network domain 错误码。
- [ ] 13 已确认 schema fieldId、capabilityId、supportedMethods。
- [ ] 事件去重规则已与 `network.wifi`、`network.ap`、`network.ip` 同步确认。
- [ ] `interfaceId` 稳定性、默认接口和别名映射已确认。
- [ ] legacyRefs 已确认或明确延后到 adapter-only。

## 14. 待确认问题

1. `[REVIEW-ASK]` `interfaceId` 是否必须跨重启稳定，还是允许设备重启后重新枚举？
2. `[REVIEW-ASK]` `interfaceId` 是否直接暴露 OS 名称，还是需要设备定义的逻辑别名？
3. `[REVIEW-ASK]` MAC 地址是否可在普通查询中返回，是否需要按权限脱敏？
4. `[REVIEW-ASK]` 是否需要采纳 optional `network.setInterfaceConfig`；若需要，权限和防断连策略是什么？
