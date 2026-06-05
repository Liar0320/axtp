# AXTP network.ap 协议草案

版本：v0.3

归属域：`network`

Capability ID：`network.ap`

适用范围：设备自身开启 AP/SoftAP/Hotspot，包括 AP 能力、配置、凭据导出策略、启停和角色状态。

---

## 协议审核标记

| 标记 | 对象 | 结论 | 后续动作 |
|---|---|---|---|
| `[REVIEW-DRAFT]` | `network.ap` capability | 本文将 v0.2 的 AP 完整模型收敛为配对和基础热点控制所需的角色层协议。 | 产品/架构/研发确认后进入 `adopt-protocol-draft`。 |
| `[REVIEW-OK]` | domain.feature 粒度 | AP/SoftAP/Hotspot 是 `network` 域下合适的能力块；不把 `Config`、`State`、`Credential` 提升为 feature。 | 采纳前按 08 再次复核 method/event 命名。 |
| `[REVIEW-DRAFT]` | 事件分层 | `network.apStateChanged` 只表达 AP 服务角色状态；接口链路变化归 `network.interface`，本端 IP 变化归 `network.ip`。 | 采纳前与 interface/ip/wifi 草案一起确认。 |
| `[REVIEW-ASK]` | AP 凭据导出策略 | 当前尚未确认 NA20 是否允许读取明文密码，或必须使用一次性 token / opaque credential。 | 采纳前确认 `NetworkCredential` 语义和安全边界。 |
| `[REVIEW-ASK]` | AP 客户端列表 | 客户端列表对配对验收有价值，但不是 AP 启停和配置 MVP 的必要条件。 | 若作为验收条件，采纳 optional `network.getApClients`。 |
| `[REVIEW-ASK]` | legacy 映射 | VM33 `APInfo`、`Wifi.OpenApService` 等旧协议 payload 仍需字段级确认。 | 落 registry 前补齐 legacyRefs 或明确 adapter-only。 |

## 1. 文档定位

本文是 `docs/protocol` 评审输入，不是最终协议事实源。采纳后，稳定事实必须反向确认到 `docs/specs/08-13`，涉及 profile/MVP 时同步确认 `docs/specs/14`，再写入 `registry/domains/network/domain.yaml`，并由 `generate-axtp-protocol` 生成 `protocol/axtp.protocol.yaml` 和 `docs/generated/*`。

当前 generated 协议没有 adopted `network.ap` 方法、事件或 schema；本文所有 methodId、eventId、errorCode、fieldId 均为 `TBD after adoption`。

## 2. 业务需求

| 项 | 内容 |
|---|---|
| 需求来源 | `docs/flows/cast-rxtx-paring.md`，NA20/NT10 自动配对流程。 |
| 目标用户 | 上位机配对服务、NA20 接收端固件、测试工具。 |
| 目标行为 | 上位机从 NA20 读取 AP 信息，必要时启动 AP，并把 AP 凭据交给 NT10 的 `network.wifi`。 |
| 当前实现程度 | Drafted only：`docs/protocol/network/network.ap.md` 存在草案，但 YAML/generated 尚未采纳。 |

## 3. Domain 边界

| 项 | 决策 |
|---|---|
| Domain | `network` |
| Feature | `network.ap` |
| Capability | `network.ap` |
| 负责 | AP 能力、SSID/安全/凭据配置、AP 启停、AP 运行状态、可选客户端列表。 |
| 不负责 | 接口枚举/MAC/链路，归 `network.interface`；AP 本端 IP，归 `network.ip`；NT10 作为 STA 连接 AP，归 `network.wifi`；投屏业务编排不在本文。 |
| 跨设备配对 | 默认由上位机编排 `network.ap` + `network.wifi` + 可选 `network.ip`；暂不新增 `cast.pairing` 一键方法。 |

## 4. 简化决策

| 决策点 | 结论 | 理由 |
|---|---|---|
| 新增/修改/复用 | Modify existing draft | v0.2 字段过宽，现保留 AP 角色控制主路径。 |
| MVP 方法 | capabilities/config/start/stop/state | 支持配对读取凭据和启动热点。 |
| Optional 方法 | `network.getApClients` | 只在产品要求客户端列表作为配对验收时采纳。 |
| Deferred 字段 | AP 本端 IP、DHCP Server 地址池、NAT、client isolation、country/channelWidth | 这些是部署增强，不是配对最小控制面。 |
| 事件范围 | AP 配置和 AP 角色状态 | 避免和 interface/ip 事件重复。 |

## 5. 候选 Capability

| Capability | 状态 | 说明 |
|---|---|---|
| `network.ap` | draft | 设备支持作为 AP/SoftAP/Hotspot 端点，提供配置、凭据导出、启停和状态查询。 |

## 6. 候选 Methods

| Method | Params Schema | Result Schema | MVP | 说明 | Review |
|---|---|---|---:|---|---|
| `network.getApCapabilities` | `NetworkGetApCapabilitiesRequest` | `NetworkApCapabilities` | yes | 查询 AP 支持的安全类型、频段、凭据导出能力和启停能力。 | `[REVIEW-DRAFT]` |
| `network.getApConfig` | `NetworkGetApConfigRequest` | `NetworkApConfig` | yes | 读取当前 AP 配置；配对场景需要 SSID、安全类型和凭据材料。 | `[REVIEW-DRAFT]` |
| `network.setApConfig` | `NetworkSetApConfigRequest` | `NetworkSetApConfigResponse` | yes | 设置 AP 基础配置，例如 SSID、安全、频段、信道。 | `[REVIEW-DRAFT]` |
| `network.startAp` | `NetworkStartApRequest` | `NetworkApActionResponse` | yes | 启动 AP。 | `[REVIEW-DRAFT]` |
| `network.stopAp` | `NetworkStopApRequest` | `NetworkApActionResponse` | yes | 停止 AP。 | `[REVIEW-DRAFT]` |
| `network.getApState` | `NetworkGetApStateRequest` | `NetworkApState` | yes | 查询 AP 当前角色状态。 | `[REVIEW-DRAFT]` |
| `network.getApClients` | `NetworkGetApClientsRequest` | `NetworkApClients` | no | 可选查询 AP 客户端列表，用于配对验收或诊断。 | `[REVIEW-ASK]` |

方法错误候选：`SUCCESS`、`NOT_SUPPORTED`、`INVALID_ARGUMENT`、`OUT_OF_RANGE`、`INVALID_STATE`、`BUSY`、`PERMISSION_DENIED`、`TIMEOUT`、`UNAVAILABLE`、`INTERNAL_ERROR`，以及本文“候选 Errors”中的 network 业务错误。

## 7. 候选 Events

| Event | Schema | MVP | 触发时机 | Review |
|---|---|---:|---|---|
| `network.apConfigChanged` | `NetworkApConfigChangedEvent` | yes | AP 配置被本会话、其他会话或设备策略改变。 | `[REVIEW-DRAFT]` |
| `network.apStateChanged` | `NetworkApStateChangedEvent` | yes | AP 服务从 `stopped`、`starting`、`running`、`stopping`、`error` 等状态发生变化。 | `[REVIEW-DRAFT]` |
| `network.apClientChanged` | `NetworkApClientChangedEvent` | no | 客户端加入或离开 AP；仅在采纳客户端列表时启用。 | `[REVIEW-ASK]` |

事件去重规则：

1. AP 接口 up/down 不由 `network.apStateChanged` 表达，归 `network.interfaceStateChanged`。
2. AP 本端 IP 变化不由 `network.apStateChanged` 表达，归 `network.ipConfigChanged`。
3. AP 启停、配置变化和客户端变化只由 AP feature 事件表达。

## 8. 候选 Schemas

### `NetworkGetApCapabilitiesRequest` / `NetworkGetApConfigRequest` / `NetworkGetApStateRequest`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `interfaceId` | string | no | AP 接口；省略表示默认 AP 接口。 | `[REVIEW-DRAFT]` |

### `NetworkApCapabilities`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `capability` | string | yes | 固定为 `network.ap`。 | `[REVIEW-DRAFT]` |
| `securityTypes` | `NetworkWifiSecurityType[]` | yes | 支持的 AP 安全类型。 | `[REVIEW-DRAFT]` |
| `bands` | `NetworkWifiBand[]` | no | 支持的频段。 | `[REVIEW-DRAFT]` |
| `credentialExportModes` | `NetworkCredentialType[]` | yes | 可导出的凭据形态：`passphrase`、`pairing_token`、`opaque_ref`。 | `[REVIEW-ASK]` |
| `canStartStop` | bool | yes | 是否支持通过 AXTP 启停 AP。 | `[REVIEW-DRAFT]` |
| `clientListSupported` | bool | no | 是否支持客户端列表。 | `[REVIEW-ASK]` |
| `maxClients` | uint16 | no | AP 最大客户端数量。 | `[REVIEW-DRAFT]` |

### `NetworkApConfig`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `interfaceId` | string | no | AP 接口标识。 | `[REVIEW-DRAFT]` |
| `ssid` | string | yes | AP SSID。 | `[REVIEW-DRAFT]` |
| `security` | `NetworkWifiSecurityType` | yes | AP 安全类型。 | `[REVIEW-DRAFT]` |
| `credential` | `NetworkCredential` | no | 配对可用凭据；是否可读取由 `credentialExportModes` 决定。 | `[REVIEW-ASK]` |
| `hidden` | bool | no | 是否隐藏 SSID。 | `[REVIEW-DRAFT]` |
| `band` | `NetworkWifiBand` | no | AP 频段。 | `[REVIEW-DRAFT]` |
| `channel` | uint16 | no | AP 信道。 | `[REVIEW-DRAFT]` |
| `maxClients` | uint16 | no | 客户端上限。 | `[REVIEW-DRAFT]` |

### `NetworkCredential`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `type` | enum | yes | `passphrase`、`pairing_token`、`opaque_ref`。 | `[REVIEW-ASK]` |
| `value` | string | yes | 敏感凭据内容或引用值；不得进入普通日志。 | `[REVIEW-ASK]` |
| `expiresAtMs` | uint64 | no | 一次性 token 的过期时间；非 token 可省略。 | `[REVIEW-ASK]` |

### `NetworkSetApConfigRequest`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `config` | `NetworkApConfig` | yes | 要写入的 AP 配置。 | `[REVIEW-DRAFT]` |
| `apply` | enum | no | `immediate`、`on_restart`；默认 `immediate`。 | `[REVIEW-DRAFT]` |

### `NetworkSetApConfigResponse`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `config` | `NetworkApConfig` | yes | 设备接受的配置摘要。 | `[REVIEW-DRAFT]` |
| `applied` | bool | yes | 是否已经生效。 | `[REVIEW-DRAFT]` |
| `requiresApRestart` | bool | no | 是否需要重启 AP 才能生效。 | `[REVIEW-DRAFT]` |

### `NetworkStartApRequest` / `NetworkStopApRequest`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `interfaceId` | string | no | 目标 AP 接口。 | `[REVIEW-DRAFT]` |

### `NetworkApActionResponse`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `accepted` | bool | yes | 动作是否被接受；状态可能异步变化。 | `[REVIEW-DRAFT]` |
| `state` | `NetworkApState` | yes | 操作后的 AP 状态摘要。 | `[REVIEW-DRAFT]` |

### `NetworkApState`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `interfaceId` | string | no | AP 接口标识。 | `[REVIEW-DRAFT]` |
| `state` | enum | yes | `stopped`、`starting`、`running`、`stopping`、`error`。 | `[REVIEW-DRAFT]` |
| `ssid` | string | no | 当前运行的 SSID。 | `[REVIEW-DRAFT]` |
| `bssid` | string | no | 当前 BSSID/MAC。 | `[REVIEW-DRAFT]` |
| `clientCount` | uint16 | no | 当前客户端数量。 | `[REVIEW-DRAFT]` |
| `lastError` | enum | no | 最近一次失败原因，例如 `unsupported_security`、`start_failed`、`policy_denied`。 | `[REVIEW-DRAFT]` |

### Optional Client Schemas

| Schema / Field | 说明 | Review |
|---|---|---|
| `NetworkGetApClientsRequest.interfaceId` | 目标 AP 接口。 | `[REVIEW-ASK]` |
| `NetworkApClients.clients` | `NetworkApClientInfo[]`。 | `[REVIEW-ASK]` |
| `NetworkApClientInfo` | `macAddress`、`ipAddress`、`hostname`、`connectedMs`；`ipAddress` 表示客户端租约地址，不表示 AP 本端 IP。 | `[REVIEW-ASK]` |

### Event Schemas

| Schema | 关键字段 | 说明 | Review |
|---|---|---|---|
| `NetworkApConfigChangedEvent` | `interfaceId`, `config`, `reason` | AP 配置变化通知。 | `[REVIEW-DRAFT]` |
| `NetworkApStateChangedEvent` | `interfaceId`, `state`, `previousState`, `reason` | AP 角色状态变化通知。 | `[REVIEW-DRAFT]` |
| `NetworkApClientChangedEvent` | `interfaceId`, `change`, `client` | 可选客户端变化通知。 | `[REVIEW-ASK]` |

### Deferred Fields

| Field / Method | 延后原因 | Review |
|---|---|---|
| `ipAddress` | AP 本端 IP 归 `network.ip`，不在 AP config/state 重复。 | `[REVIEW-DRAFT]` |
| `dhcpPool` / DHCP Server 地址池 | 属于 AP 服务增强，但不是配对最小字段；是否归 AP 仍需确认。 | `[REVIEW-ASK]` |
| `uplinkSharing` / NAT / client isolation | 部署策略复杂，暂不进入 MVP。 | `[REVIEW-DRAFT]` |
| `resetApConfig` | 可后续补充，不影响配对主路径。 | `[REVIEW-DRAFT]` |

### Shared Network Types

| Type | 候选值 | 说明 | Review |
|---|---|---|---|
| `NetworkWifiSecurityType` | `open`, `wpa2_psk`, `wpa3_sae`, `wpa2_wpa3_mixed` | 与 `network.wifi` 共享。 | `[REVIEW-DRAFT]` |
| `NetworkWifiBand` | `2g4`, `5g`, `6g`, `auto` | 与 `network.wifi` 共享。 | `[REVIEW-DRAFT]` |

## 9. JSON 示例

示例用于评审 `network.ap` request/response/event 语义，不是 generated 事实源。JSON 示例只写 RPC `d` 数据块，不包裹外层 `sid` / `op` / `d` wire envelope；Request 使用 `id`、`method`、`params`，Response 使用 `id`、`status`、`result`，Event 使用 `event`、`intent`、`data`。`status.code` 必须是数字 ErrorCode。`credential.value`、MAC、序列号等敏感或设备相关字段均使用占位符。

失败示例中的草案业务错误尚未分配数字码，因此 JSON 中先使用已采纳通用错误码，并在 `status.details.candidateError` 中标注候选错误名。

### 9.1 查询 AP 能力

```json
{
  "id": 101,
  "method": "network.getApCapabilities",
  "params": {
    "interfaceId": "ap0"
  }
}
```

```json
{
  "id": 101,
  "status": {
    "ok": true,
    "code": 0
  },
  "result": {
    "capability": "network.ap",
    "securityTypes": [
      "wpa2_psk",
      "wpa3_sae"
    ],
    "bands": [
      "5g"
    ],
    "credentialExportModes": [
      "pairing_token",
      "opaque_ref"
    ],
    "canStartStop": true,
    "clientListSupported": true,
    "maxClients": 8
  }
}
```

### 9.2 读取 AP 配置用于配对

```json
{
  "id": 102,
  "method": "network.getApConfig",
  "params": {
    "interfaceId": "ap0"
  }
}
```

```json
{
  "id": 102,
  "status": {
    "ok": true,
    "code": 0
  },
  "result": {
    "interfaceId": "ap0",
    "ssid": "NA20-<receiver-id>",
    "security": "wpa2_psk",
    "credential": {
      "type": "pairing_token",
      "value": "<PAIRING_TOKEN_OR_SECRET>",
      "expiresAtMs": 0
    },
    "hidden": false,
    "band": "5g",
    "channel": 149,
    "maxClients": 8
  }
}
```

### 9.3 启动 AP

```json
{
  "id": 103,
  "method": "network.startAp",
  "params": {
    "interfaceId": "ap0"
  }
}
```

```json
{
  "id": 103,
  "status": {
    "ok": true,
    "code": 0
  },
  "result": {
    "accepted": true,
    "state": {
      "interfaceId": "ap0",
      "state": "starting",
      "ssid": "NA20-<receiver-id>",
      "bssid": "<NA20_AP_BSSID>"
    }
  }
}
```

### 9.4 AP 角色状态变化事件

```json
{
  "event": "network.apStateChanged",
  "intent": 2,
  "data": {
    "interfaceId": "ap0",
    "previousState": {
      "interfaceId": "ap0",
      "state": "starting"
    },
    "state": {
      "interfaceId": "ap0",
      "state": "running",
      "ssid": "NA20-<receiver-id>",
      "bssid": "<NA20_AP_BSSID>",
      "clientCount": 0
    },
    "reason": "user_request"
  }
}
```

### 9.5 凭据不可导出失败示例

```json
{
  "id": 104,
  "method": "network.getApConfig",
  "params": {
    "interfaceId": "ap0"
  }
}
```

```json
{
  "id": 104,
  "status": {
    "ok": false,
    "code": 9,
    "msg": "AP credential is not exportable by current policy.",
    "details": {
      "candidateError": "NETWORK_CREDENTIAL_NOT_EXPORTABLE",
      "supportedCredentialExportModes": [
        "opaque_ref"
      ]
    }
  }
}
```

## 10. 候选 Errors

| Error | 类别 | 说明 | Review |
|---|---|---|---|
| `NETWORK_CREDENTIAL_NOT_EXPORTABLE` | network/business | AP 凭据策略不允许导出，无法用于自动配对。 | `[REVIEW-ASK]` |
| `NETWORK_SECURITY_UNSUPPORTED` | network/business | 请求的 AP 安全类型不被设备支持。 | `[REVIEW-DRAFT]` |
| `NETWORK_AP_START_FAILED` | network/business | AP 启动失败，详细原因可放入 response details。 | `[REVIEW-DRAFT]` |
| `NETWORK_AP_CLIENT_LIST_UNAVAILABLE` | network/business | 当前设备或状态无法提供客户端列表。 | `[REVIEW-ASK]` |

采纳时若通用错误码足够表达上述场景，可不新增业务错误；否则错误码应在 network domain 范围内分配，编号为 `TBD after adoption`。

## 11. Legacy 待映射

| 来源 | 旧协议条目 | 候选映射 | 状态 | 说明 |
|---|---|---|---|---|
| VM33 HTTP JSON | `Config.Get:APInfo` | `network.getApConfig` | `[REVIEW-ASK]` | 需确认 payload 是否包含 SSID、安全类型、密码、频段、信道。 |
| VM33 HTTP JSON | `Config.Set:APInfo` | `network.setApConfig` | `[REVIEW-ASK]` | 需确认字段路径、持久化策略和是否会重启 AP。 |
| VM33 HTTP JSON | `Wifi.OpenApService` / `Wifi.openApService` | `network.startAp` | `[REVIEW-ASK]` | 需确认是否只启动服务，还是同时写配置。 |

## 12. Registry 草案输入

采纳本文后，`registry/domains/network/domain.yaml` 至少应包含：

```yaml
capabilities:
  - id: network.ap
    name: network.ap capability
    status: draft
    schema: NetworkApCapabilities
    methods:
      - network.getApCapabilities
      - network.getApConfig
      - network.setApConfig
      - network.startAp
      - network.stopAp
      - network.getApState
    events:
      - network.apConfigChanged
      - network.apStateChanged

methods:
  - name: network.getApCapabilities
    id: TBD after adoption
    bitOffset: TBD after adoption
    requestSchema: NetworkGetApCapabilitiesRequest
    responseSchema: NetworkApCapabilities
    capabilities: [network.ap]
```

`network.getApClients` / `network.apClientChanged` 若采纳，应作为 optional method/event 追加。

## 13. 采纳检查清单

- [ ] 08 已确认 `network.ap` 粒度和 method/event 命名。
- [ ] 09 已确认 network domain 写入 `registry/domains/network/domain.yaml`。
- [ ] 10 已确认 methodId、bitOffset、request/response schema。
- [ ] 11 已确认 eventId、eventMasks bitOffset、event schema。
- [ ] 12 已确认是否新增 network domain 错误码。
- [ ] 13 已确认 schema fieldId、capabilityId、supportedMethods。
- [ ] 事件去重规则已与 `network.interface`、`network.ip`、`network.wifi` 同步确认。
- [ ] 凭据字段已完成安全评审，不会被普通日志、遥测或崩溃报告记录。
- [ ] AP 本端 IP 和 DHCP Server 地址池归属已确认。
- [ ] legacyRefs 已确认或明确延后到 adapter-only。

## 14. 待确认问题

1. `[REVIEW-ASK]` NA20 AP 密码是否允许通过 AXTP 明文读取？
2. `[REVIEW-ASK]` 若不允许明文读取，配对凭据使用一次性 token、opaque reference，还是绑定目标设备身份的加密 credential？
3. `[REVIEW-ASK]` `network.getApClients` 是否是配对成功的强制验收条件？
4. `[REVIEW-ASK]` AP DHCP Server 地址池是否纳入 `network.ap` optional schema，还是另起更明确的 DHCP Server 能力？
5. `[REVIEW-ASK]` AP 配置改变后是否立即生效，还是需要 AP restart / device restart？
