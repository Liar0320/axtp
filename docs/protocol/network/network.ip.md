# AXTP network.ip 协议草案

版本：v0.3

归属域：`network`

Capability ID：`network.ip`

适用范围：接口上的最小 IPv4/IPv6 地址配置，包括 DHCP、静态地址、网关、DNS 和地址变化事件。

---

## 协议审核标记

| 标记 | 对象 | 结论 | 后续动作 |
|---|---|---|---|
| `[REVIEW-DRAFT]` | `network.ip` capability | 本文将 v0.2 的完整三层网络模型收敛为 DHCP/static 的最小可采纳协议。 | 产品/架构/研发确认后进入 `adopt-protocol-draft`。 |
| `[REVIEW-OK]` | domain.feature 粒度 | IP/DHCP/DNS/默认网关属于 `network` 域下同一地址配置能力块。 | 采纳前按 08 再次复核 method/event 命名。 |
| `[REVIEW-DRAFT]` | 事件分层 | `network.ipConfigChanged` 只表达地址配置或有效地址变化；Wi-Fi/AP/interface 状态由各自 feature 事件表达。 | 采纳前与 interface/Wi-Fi/AP 草案一起确认。 |
| `[REVIEW-ASK]` | AP 子网边界 | AP 本端地址可由 `network.ip` 表达；AP DHCP Server 地址池是否归 `network.ap` 仍需确认。 | 采纳前确认 AP 子网写入入口。 |
| `[REVIEW-ASK]` | IPv6 支持范围 | 当前草案保留 IPv6 family，但 MVP 是否支持 IPv6 待确认。 | 采纳前确认 IPv6 是 MVP 还是 optional。 |
| `[REVIEW-ASK]` | legacy 映射 | AXDP / VM33 / Signage 的 IP 命令已有候选归属，但 payload、netmask、状态码仍需字段级确认。 | 落 registry 前补齐 legacyRefs 或明确 adapter-only。 |

## 1. 文档定位

本文是 `docs/protocol` 评审输入，不是最终协议事实源。采纳后，稳定事实必须反向确认到 `docs/specs/08-13`，涉及 profile/MVP 时同步确认 `docs/specs/14`，再写入 `registry/domains/network/domain.yaml`，并由 `generate-axtp-protocol` 生成 `protocol/axtp.protocol.yaml` 和 `docs/generated/*`。

当前 generated 协议没有 adopted `network.ip` 方法、事件或 schema；本文所有 methodId、eventId、errorCode、fieldId 均为 `TBD after adoption`。

## 2. 业务需求

| 项 | 内容 |
|---|---|
| 需求来源 | AP/Wi-Fi 草案中的接口网络配置前置条件，以及 archive 中 IP/DNS 原始方案。 |
| 目标用户 | 上位机网络配置服务、设备固件、部署工具、产测/诊断工具。 |
| 目标行为 | 调用方通过 `interfaceId` 查询或设置接口 DHCP/static 地址、默认网关和 DNS。 |
| 当前实现程度 | Drafted only：`docs/protocol/network/network.ip.md` 存在草案，但 YAML/generated 尚未采纳。 |

## 3. Domain 边界

| 项 | 决策 |
|---|---|
| Domain | `network` |
| Feature | `network.ip` |
| Capability | `network.ip` |
| 负责 | 接口 IPv4/IPv6 地址模式、当前地址、静态地址、DHCP、默认网关、DNS、地址变化事件。 |
| 不负责 | 接口枚举/MAC/链路状态，归 `network.interface`；Wi-Fi profile/认证/连接，归 `network.wifi`；AP SSID/安全/启停/客户端，归 `network.ap`。 |
| 设计原则 | `network.ip` 只绑定 `interfaceId` 和地址族，不重复描述接口类型、Wi-Fi 连接状态或 AP 运行状态。 |

## 4. 简化决策

| 决策点 | 结论 | 理由 |
|---|---|---|
| 新增/修改/复用 | Modify existing draft | v0.2 字段过宽，现保留 DHCP/static 主路径。 |
| MVP 方法 | `getIpConfig`、`setIpConfig` | 满足部署、配对后查询地址和基础网络配置。 |
| Deferred 能力 | 静态路由表、DHCP lease 详情、独立 DNS 方法、DHCPv6/SLAAC 细节 | 这些不是 AP/Wi-Fi 前置协议的最小需求。 |
| 事件范围 | 地址配置/有效地址变化 | 避免和 `interfaceStateChanged`、`wifiStateChanged`、`apStateChanged` 重复。 |
| 字段策略 | 单 family 一次读写 | 简化请求模型；多地址族由客户端分别调用或 future batch 处理。 |

## 5. 候选 Capability

| Capability | 状态 | 说明 |
|---|---|---|
| `network.ip` | draft | 设备支持查询和配置指定接口的 DHCP/static 地址、默认网关和 DNS。 |

## 6. 候选 Methods

| Method | Params Schema | Result Schema | 说明 | Review |
|---|---|---|---|---|
| `network.getIpConfig` | `NetworkGetIpConfigRequest` | `NetworkIpConfig` | 查询单个接口、单个地址族的 IP 配置和当前有效地址。 | `[REVIEW-DRAFT]` |
| `network.setIpConfig` | `NetworkSetIpConfigRequest` | `NetworkSetIpConfigResponse` | 设置单个接口、单个地址族的 DHCP/static IP 配置。 | `[REVIEW-DRAFT]` |

方法错误候选：`SUCCESS`、`NOT_SUPPORTED`、`INVALID_ARGUMENT`、`OUT_OF_RANGE`、`INVALID_STATE`、`BUSY`、`PERMISSION_DENIED`、`TIMEOUT`、`NOT_FOUND`、`UNAVAILABLE`、`INTERNAL_ERROR`，以及本文“候选 Errors”中的 network 业务错误。

## 7. 候选 Events

| Event | Schema | 触发时机 | Review |
|---|---|---|---|
| `network.ipConfigChanged` | `NetworkIpConfigChangedEvent` | IP 模式、地址、网关、DNS 或有效地址发生变化。 | `[REVIEW-DRAFT]` |

事件去重规则：

1. Wi-Fi 连接成功或失败只发 `network.wifiStateChanged`；分配到 IP 后再发 `network.ipConfigChanged`。
2. AP start/stop 只发 `network.apStateChanged`；AP 接口本端地址变化才发 `network.ipConfigChanged`。
3. 接口 up/down 只发 `network.interfaceStateChanged`；若因此地址失效，可追加 `network.ipConfigChanged` 表示地址清空。

## 8. 配置语义

| 场景 | 规则 | Review |
|---|---|---|
| `mode=dhcp` | 不要求 `address`、`prefixLength`、`gateway`；DNS 可省略或使用静态覆盖。 | `[REVIEW-DRAFT]` |
| `mode=static` | 必须提供 `address` 和 `prefixLength`；`gateway`、`dnsServers` 可选。 | `[REVIEW-DRAFT]` |
| `mode=disabled` | 禁用该地址族，并清除对应有效地址。 | `[REVIEW-DRAFT]` |
| IPv6 | 使用同一 schema，但 `slaac`、DHCPv6 和多个 IPv6 地址先作为 deferred。 | `[REVIEW-ASK]` |
| 生效策略 | `apply=immediate` 可能断开当前 AXTP 会话；响应必须返回 `requiresReconnect`。 | `[REVIEW-DRAFT]` |
| AP 本端地址 | 查询走 `network.getIpConfig(interfaceId=ap0)`；AP DHCP Server 地址池暂留 `network.ap` 待确认。 | `[REVIEW-ASK]` |

## 9. 候选 Schemas

### `NetworkGetIpConfigRequest`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `interfaceId` | string | yes | 目标接口标识，来自 `network.interface`。 | `[REVIEW-DRAFT]` |
| `family` | `NetworkIpFamily` | no | `ipv4` 或 `ipv6`；省略表示默认 `ipv4`。 | `[REVIEW-DRAFT]` |

### `NetworkSetIpConfigRequest`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `interfaceId` | string | yes | 目标接口。 | `[REVIEW-DRAFT]` |
| `family` | `NetworkIpFamily` | no | `ipv4` 或 `ipv6`；省略表示默认 `ipv4`。 | `[REVIEW-DRAFT]` |
| `mode` | `NetworkIpMode` | yes | `dhcp`、`static`、`disabled`。 | `[REVIEW-DRAFT]` |
| `address` | string | conditional | static 模式必填。 | `[REVIEW-DRAFT]` |
| `prefixLength` | uint8 | conditional | static 模式必填；IPv4 0-32，IPv6 0-128。 | `[REVIEW-DRAFT]` |
| `gateway` | string | no | 默认网关。旧 gateway 字段映射到这里。 | `[REVIEW-DRAFT]` |
| `dnsServers` | string[] | no | DNS 服务器；省略表示保持现有策略。 | `[REVIEW-DRAFT]` |
| `apply` | `NetworkConfigApplyPolicy` | no | `immediate`、`on_reconnect`、`on_reboot`；默认 `immediate`。 | `[REVIEW-DRAFT]` |

### `NetworkIpConfig`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `interfaceId` | string | yes | 接口标识。 | `[REVIEW-DRAFT]` |
| `family` | `NetworkIpFamily` | yes | 地址族。 | `[REVIEW-DRAFT]` |
| `mode` | `NetworkIpMode` | yes | 地址模式。 | `[REVIEW-DRAFT]` |
| `address` | string | no | 当前有效地址。 | `[REVIEW-DRAFT]` |
| `prefixLength` | uint8 | no | 当前有效地址前缀长度。 | `[REVIEW-DRAFT]` |
| `gateway` | string | no | 默认网关。 | `[REVIEW-DRAFT]` |
| `dnsServers` | string[] | no | 当前 DNS 服务器。 | `[REVIEW-DRAFT]` |
| `source` | enum | no | `static`、`dhcp`、`system_policy`、`runtime`。 | `[REVIEW-DRAFT]` |
| `effective` | bool | yes | 返回内容是否为当前已生效配置。 | `[REVIEW-DRAFT]` |

### `NetworkSetIpConfigResponse`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `config` | `NetworkIpConfig` | yes | 写入后的配置摘要。 | `[REVIEW-DRAFT]` |
| `applied` | bool | yes | 配置是否已经生效。 | `[REVIEW-DRAFT]` |
| `effectiveAfter` | `NetworkConfigApplyPolicy` | yes | 实际生效时机。 | `[REVIEW-DRAFT]` |
| `requiresReconnect` | bool | no | 是否可能导致当前 AXTP 会话断开或需要客户端重连。 | `[REVIEW-DRAFT]` |
| `requiresReboot` | bool | no | 是否需要设备重启后生效。 | `[REVIEW-DRAFT]` |

### `NetworkIpConfigChangedEvent`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `interfaceId` | string | yes | 发生变化的接口。 | `[REVIEW-DRAFT]` |
| `family` | `NetworkIpFamily` | yes | 发生变化的地址族。 | `[REVIEW-DRAFT]` |
| `config` | `NetworkIpConfig` | yes | 变化后的 IP 配置。 | `[REVIEW-DRAFT]` |
| `previousConfig` | `NetworkIpConfig` | no | 变化前配置。 | `[REVIEW-DRAFT]` |
| `reason` | enum | no | `user_request`、`dhcp_updated`、`lease_expired`、`link_lost`、`system_policy`、`apply_failed`。 | `[REVIEW-DRAFT]` |

### Deferred Schemas / Fields

| Schema / Field | 延后原因 | Review |
|---|---|---|
| `NetworkRouteConfig[]` | 多路由和 metric 不是基础配置 MVP，旧 gateway 先映射为单字段。 | `[REVIEW-DRAFT]` |
| `NetworkDhcpLease` | 诊断价值高，但会显著增加 schema；先不作为 MVP。 | `[REVIEW-DRAFT]` |
| `network.getDnsConfig` / `network.setDnsConfig` | 独立 DNS 方法可后续补充，MVP 随 IP 配置读写即可。 | `[REVIEW-DRAFT]` |
| `slaac` / DHCPv6 | IPv6 详细行为待设备实现确认。 | `[REVIEW-ASK]` |

### Shared / Enum Types

| Type | 候选值 | 说明 | Review |
|---|---|---|---|
| `NetworkIpFamily` | `ipv4`, `ipv6` | 地址族。 | `[REVIEW-DRAFT]` |
| `NetworkIpMode` | `dhcp`, `static`, `disabled` | MVP 地址模式。 | `[REVIEW-DRAFT]` |
| `NetworkConfigApplyPolicy` | `immediate`, `on_reconnect`, `on_reboot` | 配置生效策略；与 `network.interface` 共享。 | `[REVIEW-DRAFT]` |

## 10. JSON 示例

示例用于评审 `network.ip` request/response/event 语义，不是 generated 事实源。JSON 示例只写 RPC `d` 数据块，不包裹外层 `sid` / `op` / `d` wire envelope；Request 使用 `id`、`method`、`params`，Response 使用 `id`、`status`、`result`，Event 使用 `event`、`intent`、`data`。`status.code` 必须是数字 ErrorCode。IP 等设备相关字段均使用占位符。

失败示例中的草案业务错误尚未分配数字码，因此 JSON 中先使用已采纳通用错误码，并在 `status.details.candidateError` 中标注候选错误名。

### 10.1 查询接口 IPv4 配置

```json
{
  "id": 401,
  "method": "network.getIpConfig",
  "params": {
    "interfaceId": "wlan0",
    "family": "ipv4"
  }
}
```

```json
{
  "id": 401,
  "status": {
    "ok": true,
    "code": 0
  },
  "result": {
    "interfaceId": "wlan0",
    "family": "ipv4",
    "mode": "dhcp",
    "address": "<DEVICE_IP>",
    "prefixLength": 24,
    "gateway": "<GATEWAY_IP>",
    "dnsServers": [
      "<DNS_IP>"
    ],
    "source": "dhcp",
    "effective": true
  }
}
```

### 10.2 切换接口为 DHCP

```json
{
  "id": 402,
  "method": "network.setIpConfig",
  "params": {
    "interfaceId": "wlan0",
    "family": "ipv4",
    "mode": "dhcp",
    "apply": "immediate"
  }
}
```

```json
{
  "id": 402,
  "status": {
    "ok": true,
    "code": 0
  },
  "result": {
    "config": {
      "interfaceId": "wlan0",
      "family": "ipv4",
      "mode": "dhcp",
      "address": "<NEW_DEVICE_IP>",
      "prefixLength": 24,
      "gateway": "<GATEWAY_IP>",
      "dnsServers": [
        "<DNS_IP>"
      ],
      "source": "dhcp",
      "effective": true
    },
    "applied": true,
    "effectiveAfter": "immediate",
    "requiresReconnect": true,
    "requiresReboot": false
  }
}
```

### 10.3 设置静态 IPv4 地址

```json
{
  "id": 403,
  "method": "network.setIpConfig",
  "params": {
    "interfaceId": "eth0",
    "family": "ipv4",
    "mode": "static",
    "address": "<STATIC_IP>",
    "prefixLength": 24,
    "gateway": "<STATIC_GATEWAY_IP>",
    "dnsServers": [
      "<DNS_IP_1>",
      "<DNS_IP_2>"
    ],
    "apply": "on_reconnect"
  }
}
```

```json
{
  "id": 403,
  "status": {
    "ok": true,
    "code": 0
  },
  "result": {
    "config": {
      "interfaceId": "eth0",
      "family": "ipv4",
      "mode": "static",
      "address": "<STATIC_IP>",
      "prefixLength": 24,
      "gateway": "<STATIC_GATEWAY_IP>",
      "dnsServers": [
        "<DNS_IP_1>",
        "<DNS_IP_2>"
      ],
      "source": "static",
      "effective": false
    },
    "applied": false,
    "effectiveAfter": "on_reconnect",
    "requiresReconnect": true,
    "requiresReboot": false
  }
}
```

### 10.4 IP 配置变化事件

```json
{
  "event": "network.ipConfigChanged",
  "intent": 2,
  "data": {
    "interfaceId": "wlan0",
    "family": "ipv4",
    "config": {
      "interfaceId": "wlan0",
      "family": "ipv4",
      "mode": "dhcp",
      "address": "<NEW_DEVICE_IP>",
      "prefixLength": 24,
      "gateway": "<GATEWAY_IP>",
      "dnsServers": [
        "<DNS_IP>"
      ],
      "source": "dhcp",
      "effective": true
    },
    "reason": "dhcp_updated"
  }
}
```

### 10.5 静态地址缺少前缀失败示例

```json
{
  "id": 404,
  "method": "network.setIpConfig",
  "params": {
    "interfaceId": "eth0",
    "family": "ipv4",
    "mode": "static",
    "address": "<STATIC_IP>",
    "apply": "immediate"
  }
}
```

```json
{
  "id": 404,
  "status": {
    "ok": false,
    "code": 10,
    "msg": "Static IP address requires prefixLength.",
    "details": {
      "candidateError": "NETWORK_IP_CONFIG_INVALID",
      "field": "prefixLength"
    }
  }
}
```

## 11. 候选 Errors

| Error | 类别 | 说明 | Review |
|---|---|---|---|
| `NETWORK_IP_CONFIG_INVALID` | network/business | IP 配置组合无效，例如 static 缺少地址或 prefixLength。 | `[REVIEW-DRAFT]` |
| `NETWORK_IP_INTERFACE_NOT_FOUND` | network/business | 指定 `interfaceId` 不存在或不支持 IP 配置。 | `[REVIEW-DRAFT]` |
| `NETWORK_IP_FAMILY_UNSUPPORTED` | network/business | 接口或设备不支持请求的 IPv4/IPv6 地址族。 | `[REVIEW-DRAFT]` |
| `NETWORK_IP_ADDRESS_CONFLICT` | network/business | 静态地址或 DHCP 地址发生冲突。 | `[REVIEW-DRAFT]` |
| `NETWORK_DHCP_FAILED` | network/business | DHCP 获取或续租失败。 | `[REVIEW-DRAFT]` |

采纳时若通用错误码和事件 `reason` 足够表达上述场景，可不新增全部业务错误；否则错误码应在 network domain 范围内分配，编号为 `TBD after adoption`。

## 12. Legacy 待映射

| 来源 | 旧协议条目 | 候选映射 | 状态 | 说明 |
|---|---|---|---|---|
| AXDP HID | `CommonGetIPConfig` (`0xC0103 / 0x0103 -> 0x0183`) | `network.getIpConfig` | `[REVIEW-ASK]` | 需确认旧 payload 是否聚合 DHCP、IP、netmask、gateway。 |
| AXDP HID | `CommonSetDHCPState` / `CommonGetDHCPState` | `network.setIpConfig` / `network.getIpConfig` | `[REVIEW-ASK]` | DHCP state 映射到 `mode=dhcp/static/disabled` 的规则待确认。 |
| AXDP HID | `CommonSetIPAddress` / `CommonGetIPAddress` | `network.setIpConfig` / `network.getIpConfig` | `[REVIEW-ASK]` | 映射到 `address`。 |
| AXDP HID | `CommonSetNetMask` / `CommonGetNetMask` | `network.setIpConfig` / `network.getIpConfig` | `[REVIEW-ASK]` | 旧 netmask 需转换为 `prefixLength`。 |
| AXDP HID | `CommonSetGateway` / `CommonGetGateway` | `network.setIpConfig` / `network.getIpConfig` | `[REVIEW-ASK]` | 映射到 `gateway`。 |
| Signage SDK | `GetNetworkInfo` | `network.getIpConfig` | `[REVIEW-ASK]` | 需确认是否还包含接口、Wi-Fi 或服务端点字段。 |
| VM33 HTTP JSON | `NetWork.SetNetwork` / `NetWork.SetIP` | `network.setIpConfig` | `[REVIEW-ASK]` | 需确认字段路径、静态/DHCP 切换和重启要求。 |
| VM33 HTTP JSON | `NetWork.GetNetwork` / `NetWork.GetNetworkStatus` | `network.getIpConfig` | `[REVIEW-ASK]` | 需确认状态字段。 |

## 13. Registry 草案输入

采纳本文后，`registry/domains/network/domain.yaml` 至少应包含：

```yaml
capabilities:
  - id: network.ip
    name: network.ip capability
    status: draft
    schema: NetworkIpConfig
    methods:
      - network.getIpConfig
      - network.setIpConfig
    events:
      - network.ipConfigChanged

methods:
  - name: network.getIpConfig
    id: TBD after adoption
    bitOffset: TBD after adoption
    requestSchema: NetworkGetIpConfigRequest
    responseSchema: NetworkIpConfig
    capabilities: [network.ip]
```

其他 method/event/schema/error 的 ID、bitOffset 和 fieldId 均在采纳阶段分配。

## 14. 采纳检查清单

- [ ] 08 已确认 `network.ip` 粒度和 method/event 命名。
- [ ] 09 已确认 network domain 写入 `registry/domains/network/domain.yaml`。
- [ ] 10 已确认 methodId、bitOffset、request/response schema。
- [ ] 11 已确认 eventId、eventMasks bitOffset、event schema。
- [ ] 12 已确认是否新增 network domain 错误码。
- [ ] 13 已确认 schema fieldId、capabilityId、supportedMethods。
- [ ] 事件去重规则已与 `network.interface`、`network.wifi`、`network.ap` 同步确认。
- [ ] `mode=dhcp/static/disabled` 的校验规则已确认。
- [ ] AP 接口本端 IP 与 `network.ap` 中 AP DHCP Server 地址池边界已确认。
- [ ] 修改当前控制链路 IP 时的重连策略已确认。

## 15. 待确认问题

1. `[REVIEW-ASK]` AP 本端地址是否由 `network.setIpConfig` 写入，还是也允许 `network.setApConfig` 携带快捷字段？
2. `[REVIEW-ASK]` IPv6 是否进入 MVP，还是作为 optional family 保留？
3. `[REVIEW-ASK]` DNS 是否需要独立 `network.setDnsConfig` / `network.getDnsConfig` 方法，还是随 IP 配置即可？
4. `[REVIEW-ASK]` 静态 IP 写入后是否立即断开当前 AXTP 会话，还是设备支持延迟到重连或重启生效？
5. `[REVIEW-ASK]` 旧协议 `DHCPState=false` 应映射为 `static`、`disabled`，还是保持当前静态配置不变？
