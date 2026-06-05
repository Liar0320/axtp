# AXTP network.wifi 协议草案

版本：v0.3

归属域：`network`

Capability ID：`network.wifi`

适用范围：设备作为 Wi-Fi STA 连接外部 AP，包括 STA 能力、扫描、保存 profile、连接、断开和角色状态。

---

## 协议审核标记

| 标记 | 对象 | 结论 | 后续动作 |
|---|---|---|---|
| `[REVIEW-DRAFT]` | `network.wifi` capability | 本文将 v0.2 的 Wi-Fi 完整模型收敛为配对和基础 STA 控制所需的角色层协议。 | 产品/架构/研发确认后进入 `adopt-protocol-draft`。 |
| `[REVIEW-OK]` | domain.feature 粒度 | Wi-Fi STA 是 `network` 域下合适的能力块；profile、config、state、scan 不单独提升为 feature。 | 采纳前按 08 再次复核 method/event 命名。 |
| `[REVIEW-DRAFT]` | 事件分层 | `network.wifiStateChanged` 只表达 Wi-Fi STA 扫描、认证、关联和断开；接口链路归 `network.interface`，IP/DHCP 归 `network.ip`。 | 采纳前与 interface/ip/ap 草案一起确认。 |
| `[REVIEW-ASK]` | 配对写入语义 | 当前尚未确认 NT10 写入 profile 后是否默认持久化、是否立即连接、是否自动重连。 | 采纳前确认 `persist`、`autoConnect` 和 `connectAfterSave` 策略。 |
| `[REVIEW-ASK]` | 凭据形态 | 当前尚未确认 NT10 接收 NA20 AP 凭据时使用明文 passphrase、pairing token 还是 opaque reference。 | 采纳前确认 `NetworkCredential` 语义。 |
| `[REVIEW-ASK]` | legacy 映射 | AXDP `CommonSetTailWiFiSSID`、VM33 `Wifi.ConnectWifi` 等旧协议 payload 仍需字段级确认。 | 落 registry 前补齐 legacyRefs 或明确 adapter-only。 |

## 1. 文档定位

本文是 `docs/protocol` 评审输入，不是最终协议事实源。采纳后，稳定事实必须反向确认到 `docs/specs/08-13`，涉及 profile/MVP 时同步确认 `docs/specs/14`，再写入 `registry/domains/network/domain.yaml`，并由 `generate-axtp-protocol` 生成 `protocol/axtp.protocol.yaml` 和 `docs/generated/*`。

当前 generated 协议没有 adopted `network.wifi` 方法、事件或 schema；本文所有 methodId、eventId、errorCode、fieldId 均为 `TBD after adoption`。

## 2. 业务需求

| 项 | 内容 |
|---|---|
| 需求来源 | `docs/flows/cast-rxtx-paring.md`，NA20/NT10 自动配对流程。 |
| 目标用户 | 上位机配对服务、NT10 发射端固件、测试工具。 |
| 目标行为 | 上位机把 NA20 AP 信息写入 NT10 Wi-Fi STA profile；如产品要求，触发 NT10 连接并上报 Wi-Fi 认证/关联结果。 |
| 当前实现程度 | Drafted only：`docs/protocol/network/network.wifi.md` 存在草案，但 YAML/generated 尚未采纳。 |

## 3. Domain 边界

| 项 | 决策 |
|---|---|
| Domain | `network` |
| Feature | `network.wifi` |
| Capability | `network.wifi` |
| 负责 | Wi-Fi STA 能力、扫描、profile 保存、连接、断开、认证/关联状态。 |
| 不负责 | 接口枚举/MAC/链路，归 `network.interface`；DHCP/static IP 和 DNS，归 `network.ip`；设备自身作为 AP，归 `network.ap`。 |
| 跨设备配对 | 默认由上位机读取 `network.ap` 后调用 `network.wifi` 写入/连接；连接成功后的 IP 地址由 `network.ip` 查询或事件确认。 |

## 4. 简化决策

| 决策点 | 结论 | 理由 |
|---|---|---|
| 新增/修改/复用 | Modify existing draft | v0.2 字段过宽，现保留 Wi-Fi STA 角色控制主路径。 |
| MVP 方法 | capabilities/config/scan/connect/disconnect/state | 支持配对写入 profile 和验证 Wi-Fi 连接。 |
| Deferred 方法 | `resetWifiConfig`、`forgetWifi`、扫描策略配置 | 可后续补充，不影响配对主路径。 |
| Deferred 字段 | IP 地址、DHCP failure、复杂优先级、多 profile 全量策略 | 分别归 `network.ip` 或后续 Wi-Fi profile 管理增强。 |
| 事件范围 | Wi-Fi profile、扫描结果、认证/关联状态 | 避免和 interface/ip 事件重复。 |

## 5. 候选 Capability

| Capability | 状态 | 说明 |
|---|---|---|
| `network.wifi` | draft | 设备支持作为 Wi-Fi STA 扫描、保存 profile、连接外部 AP、断开和报告 Wi-Fi 角色状态。 |

## 6. 候选 Methods

| Method | Params Schema | Result Schema | MVP | 说明 | Review |
|---|---|---|---:|---|---|
| `network.getWifiCapabilities` | `NetworkGetWifiCapabilitiesRequest` | `NetworkWifiCapabilities` | yes | 查询 STA 支持的安全类型、频段、扫描、profile 和凭据导入能力。 | `[REVIEW-DRAFT]` |
| `network.getWifiConfig` | `NetworkGetWifiConfigRequest` | `NetworkWifiConfig` | yes | 查询已保存 Wi-Fi profile 摘要；不得返回明文敏感凭据。 | `[REVIEW-DRAFT]` |
| `network.setWifiConfig` | `NetworkSetWifiConfigRequest` | `NetworkSetWifiConfigResponse` | yes | 写入或更新 Wi-Fi profile；配对场景用于把 NA20 AP profile 写入 NT10。 | `[REVIEW-DRAFT]` |
| `network.scanWifi` | `NetworkScanWifiRequest` | `NetworkScanWifiResponse` | yes | 扫描外部 AP；配对场景可选。 | `[REVIEW-DRAFT]` |
| `network.connectWifi` | `NetworkConnectWifiRequest` | `NetworkWifiActionResponse` | yes | 连接指定 profile 或 inline profile。 | `[REVIEW-DRAFT]` |
| `network.disconnectWifi` | `NetworkDisconnectWifiRequest` | `NetworkWifiActionResponse` | yes | 断开当前 Wi-Fi 连接。 | `[REVIEW-DRAFT]` |
| `network.getWifiState` | `NetworkGetWifiStateRequest` | `NetworkWifiState` | yes | 查询当前 Wi-Fi STA 角色状态。 | `[REVIEW-DRAFT]` |
| `network.resetWifiConfig` | `NetworkResetWifiConfigRequest` | `NetworkSetWifiConfigResponse` | no | 恢复 Wi-Fi 默认配置。 | `[REVIEW-DRAFT]` |
| `network.forgetWifi` | `NetworkForgetWifiRequest` | `NetworkSetWifiConfigResponse` | no | 删除指定 profile。 | `[REVIEW-DRAFT]` |

方法错误候选：`SUCCESS`、`NOT_SUPPORTED`、`INVALID_ARGUMENT`、`OUT_OF_RANGE`、`INVALID_STATE`、`BUSY`、`PERMISSION_DENIED`、`TIMEOUT`、`NOT_FOUND`、`UNAVAILABLE`、`INTERNAL_ERROR`，以及本文“候选 Errors”中的 network 业务错误。

## 7. 候选 Events

| Event | Schema | MVP | 触发时机 | Review |
|---|---|---:|---|---|
| `network.wifiConfigChanged` | `NetworkWifiConfigChangedEvent` | yes | Wi-Fi profile 被新增、更新、删除、恢复默认或设备策略改变。 | `[REVIEW-DRAFT]` |
| `network.wifiStateChanged` | `NetworkWifiStateChangedEvent` | yes | STA 扫描、认证、关联、断开或 Wi-Fi 角色错误。 | `[REVIEW-DRAFT]` |
| `network.wifiScanResultReported` | `NetworkWifiScanResultReportedEvent` | yes | 异步扫描发现 AP 或扫描完成。 | `[REVIEW-DRAFT]` |

事件去重规则：

1. Wi-Fi 认证/关联成功只发 `network.wifiStateChanged`；拿到 IP 后由 `network.ipConfigChanged` 表达。
2. DHCP 失败归 `network.ip` 的失败/事件，不作为 Wi-Fi failure reason。
3. 底层接口 up/down 归 `network.interfaceStateChanged`；Wi-Fi 仅在角色状态因此变为 disconnected/error 时上报 Wi-Fi 事件。

## 8. 候选 Schemas

### `NetworkGetWifiCapabilitiesRequest` / `NetworkGetWifiConfigRequest` / `NetworkGetWifiStateRequest`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `interfaceId` | string | no | Wi-Fi STA 接口；省略表示默认 STA 接口。 | `[REVIEW-DRAFT]` |

### `NetworkWifiCapabilities`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `capability` | string | yes | 固定为 `network.wifi`。 | `[REVIEW-DRAFT]` |
| `securityTypes` | `NetworkWifiSecurityType[]` | yes | 支持的安全类型。 | `[REVIEW-DRAFT]` |
| `bands` | `NetworkWifiBand[]` | no | 支持的频段。 | `[REVIEW-DRAFT]` |
| `credentialImportModes` | `NetworkCredentialType[]` | yes | 可写入的凭据形态，例如 `passphrase`、`pairing_token`、`opaque_ref`。 | `[REVIEW-ASK]` |
| `savedProfilesSupported` | bool | yes | 是否支持保存 profile。 | `[REVIEW-DRAFT]` |
| `scanSupported` | bool | yes | 是否支持扫描。 | `[REVIEW-DRAFT]` |
| `autoConnectSupported` | bool | no | 是否支持 profile 自动连接。 | `[REVIEW-DRAFT]` |

### `NetworkWifiProfile`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `profileId` | string | no | 已保存 profile 标识；新建时可省略，由设备分配。 | `[REVIEW-DRAFT]` |
| `ssid` | string | yes | 目标 AP SSID；配对场景来自 NA20 AP config。 | `[REVIEW-DRAFT]` |
| `security` | `NetworkWifiSecurityType` | yes | 目标 AP 安全类型。 | `[REVIEW-DRAFT]` |
| `credential` | `NetworkCredential` | no | 敏感凭据；响应和事件中不得明文回显。 | `[REVIEW-ASK]` |
| `bssid` | string | no | 目标 BSSID/MAC；用于锁定 NA20 AP。 | `[REVIEW-DRAFT]` |
| `hidden` | bool | no | 是否连接隐藏 SSID。 | `[REVIEW-DRAFT]` |
| `persist` | bool | no | 是否持久化保存。 | `[REVIEW-ASK]` |
| `autoConnect` | bool | no | 设备后续是否自动连接该 profile。 | `[REVIEW-ASK]` |
| `source` | enum | no | `user`、`pairing`、`provisioning`、`legacy`。 | `[REVIEW-DRAFT]` |

### `NetworkWifiConfig`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `interfaceId` | string | no | STA 接口标识。 | `[REVIEW-DRAFT]` |
| `profiles` | `NetworkWifiProfile[]` | no | 已保存 profile 摘要；敏感 credential 必须省略或脱敏。 | `[REVIEW-DRAFT]` |
| `defaultProfileId` | string | no | 默认/优先 profile。 | `[REVIEW-DRAFT]` |

### `NetworkSetWifiConfigRequest`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `interfaceId` | string | no | STA 接口标识。 | `[REVIEW-DRAFT]` |
| `profile` | `NetworkWifiProfile` | yes | 要创建或更新的 Wi-Fi profile。 | `[REVIEW-DRAFT]` |
| `replaceExisting` | bool | no | 同 SSID/BSSID 或同 profileId 已存在时是否覆盖。 | `[REVIEW-DRAFT]` |
| `makeDefault` | bool | no | 是否设为默认 profile。 | `[REVIEW-DRAFT]` |
| `connectAfterSave` | bool | no | 保存后是否立即发起连接。 | `[REVIEW-ASK]` |

### `NetworkSetWifiConfigResponse`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `profileId` | string | yes | 设备接受或分配的 profileId。 | `[REVIEW-DRAFT]` |
| `config` | `NetworkWifiConfig` | no | 更新后的配置摘要。 | `[REVIEW-DRAFT]` |
| `connectStarted` | bool | no | 若 `connectAfterSave=true`，表示是否已开始连接。 | `[REVIEW-ASK]` |

### `NetworkScanWifiRequest` / `NetworkScanWifiResponse`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `interfaceId` | string | no | STA 接口标识。 | `[REVIEW-DRAFT]` |
| `ssidFilter` | string | no | 只扫描指定 SSID。 | `[REVIEW-DRAFT]` |
| `timeoutMs` | uint32 | no | 扫描超时。 | `[REVIEW-DRAFT]` |
| `scanId` | string | no | 异步扫描标识。 | `[REVIEW-DRAFT]` |
| `results` | `NetworkWifiScanResult[]` | no | 同步返回的扫描结果。 | `[REVIEW-DRAFT]` |

### `NetworkConnectWifiRequest`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `interfaceId` | string | no | STA 接口标识。 | `[REVIEW-DRAFT]` |
| `profileId` | string | no | 连接已保存 profile。 | `[REVIEW-DRAFT]` |
| `profile` | `NetworkWifiProfile` | no | 使用 inline profile 连接；是否保存由 `profile.persist` 决定。 | `[REVIEW-DRAFT]` |
| `timeoutMs` | uint32 | no | 连接超时。 | `[REVIEW-DRAFT]` |

`profileId` 与 `profile` 二选一；两者都缺失应返回 `INVALID_ARGUMENT`。

### `NetworkDisconnectWifiRequest`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `interfaceId` | string | no | STA 接口标识。 | `[REVIEW-DRAFT]` |

### `NetworkWifiActionResponse`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `accepted` | bool | yes | 动作是否被接受；连接状态可能异步变化。 | `[REVIEW-DRAFT]` |
| `state` | `NetworkWifiState` | yes | 操作后的当前 Wi-Fi 状态。 | `[REVIEW-DRAFT]` |

### `NetworkWifiState`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `interfaceId` | string | no | STA 接口标识。 | `[REVIEW-DRAFT]` |
| `state` | enum | yes | `disabled`、`disconnected`、`scanning`、`connecting`、`connected`、`disconnecting`、`error`。 | `[REVIEW-DRAFT]` |
| `profileId` | string | no | 当前或最近使用的 profile。 | `[REVIEW-DRAFT]` |
| `ssid` | string | no | 当前目标 SSID。 | `[REVIEW-DRAFT]` |
| `bssid` | string | no | 当前连接 BSSID。 | `[REVIEW-DRAFT]` |
| `rssiDbm` | int16 | no | 信号强度。 | `[REVIEW-DRAFT]` |
| `failureReason` | `NetworkWifiFailureReason` | no | 最近一次 Wi-Fi 角色失败原因。 | `[REVIEW-DRAFT]` |

### `NetworkWifiFailureReason`

| 候选值 | 说明 | Review |
|---|---|---|
| `auth_failed` | 密码或认证失败。 | `[REVIEW-DRAFT]` |
| `ap_not_found` | 未发现目标 AP。 | `[REVIEW-DRAFT]` |
| `timeout` | 连接超时。 | `[REVIEW-DRAFT]` |
| `unsupported_security` | 安全类型不支持。 | `[REVIEW-DRAFT]` |
| `credential_invalid` | 凭据格式或 token 无效。 | `[REVIEW-ASK]` |
| `policy_denied` | 设备策略拒绝连接。 | `[REVIEW-DRAFT]` |
| `link_lost` | 已连接后 Wi-Fi 链路丢失。 | `[REVIEW-DRAFT]` |

### `NetworkWifiScanResult`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `ssid` | string | yes | AP SSID。 | `[REVIEW-DRAFT]` |
| `bssid` | string | no | AP BSSID/MAC。 | `[REVIEW-DRAFT]` |
| `security` | `NetworkWifiSecurityType` | yes | 安全类型。 | `[REVIEW-DRAFT]` |
| `band` | `NetworkWifiBand` | no | 频段。 | `[REVIEW-DRAFT]` |
| `channel` | uint16 | no | 信道。 | `[REVIEW-DRAFT]` |
| `rssiDbm` | int16 | no | 信号强度。 | `[REVIEW-DRAFT]` |

### Event Schemas

| Schema | 关键字段 | 说明 | Review |
|---|---|---|---|
| `NetworkWifiConfigChangedEvent` | `interfaceId`, `config`, `reason` | profile 新增、修改、删除或默认 profile 改变。 | `[REVIEW-DRAFT]` |
| `NetworkWifiStateChangedEvent` | `interfaceId`, `state`, `previousState`, `reason` | Wi-Fi 角色状态变化。 | `[REVIEW-DRAFT]` |
| `NetworkWifiScanResultReportedEvent` | `interfaceId`, `scanId`, `result`, `complete` | 异步扫描结果或扫描完成。 | `[REVIEW-DRAFT]` |

### Deferred Fields / Methods

| Field / Method | 延后原因 | Review |
|---|---|---|
| `ipAddress` | 当前 IP 归 `network.ip`，不在 Wi-Fi state 重复。 | `[REVIEW-DRAFT]` |
| `dhcp_failed` | DHCP 属于 IP 地址配置失败，归 `network.ip`。 | `[REVIEW-DRAFT]` |
| `priority` / 复杂多 profile 策略 | 可后续补充，不影响配对主路径。 | `[REVIEW-DRAFT]` |
| `resetWifiConfig` / `forgetWifi` | 可作为 optional method 采纳。 | `[REVIEW-DRAFT]` |

### Shared Network Types

| Type | 候选值 | 说明 | Review |
|---|---|---|---|
| `NetworkWifiSecurityType` | `open`, `wpa2_psk`, `wpa3_sae`, `wpa2_wpa3_mixed` | 与 `network.ap` 共享。 | `[REVIEW-DRAFT]` |
| `NetworkWifiBand` | `2g4`, `5g`, `6g`, `auto` | 与 `network.ap` 共享。 | `[REVIEW-DRAFT]` |
| `NetworkCredential` | `type`, `value`, `expiresAtMs` | 与 `network.ap` 共享；敏感字段。 | `[REVIEW-ASK]` |

## 9. JSON 示例

示例用于评审 `network.wifi` request/response/event 语义，不是 generated 事实源。JSON 示例只写 RPC `d` 数据块，不包裹外层 `sid` / `op` / `d` wire envelope；Request 使用 `id`、`method`、`params`，Response 使用 `id`、`status`、`result`，Event 使用 `event`、`intent`、`data`。`status.code` 必须是数字 ErrorCode。`credential.value`、MAC、序列号等敏感或设备相关字段均使用占位符。

失败示例中的草案业务错误尚未分配数字码，因此 JSON 中先使用已采纳通用错误码，并在 `status.details.candidateError` 中标注候选错误名。

### 9.1 查询 Wi-Fi STA 能力

```json
{
  "id": 201,
  "method": "network.getWifiCapabilities",
  "params": {
    "interfaceId": "wlan0"
  }
}
```

```json
{
  "id": 201,
  "status": {
    "ok": true,
    "code": 0
  },
  "result": {
    "capability": "network.wifi",
    "securityTypes": [
      "wpa2_psk",
      "wpa3_sae"
    ],
    "bands": [
      "5g"
    ],
    "credentialImportModes": [
      "pairing_token",
      "opaque_ref"
    ],
    "savedProfilesSupported": true,
    "scanSupported": true,
    "autoConnectSupported": true
  }
}
```

### 9.2 写入 AP profile

```json
{
  "id": 202,
  "method": "network.setWifiConfig",
  "params": {
    "interfaceId": "wlan0",
    "profile": {
      "ssid": "NA20-<receiver-id>",
      "security": "wpa2_psk",
      "credential": {
        "type": "pairing_token",
        "value": "<PAIRING_TOKEN_OR_SECRET>",
        "expiresAtMs": 0
      },
      "bssid": "<NA20_AP_BSSID>",
      "hidden": false,
      "persist": true,
      "autoConnect": true,
      "source": "pairing"
    },
    "replaceExisting": true,
    "makeDefault": true,
    "connectAfterSave": false
  }
}
```

```json
{
  "id": 202,
  "status": {
    "ok": true,
    "code": 0
  },
  "result": {
    "profileId": "<WIFI_PROFILE_ID>",
    "connectStarted": false,
    "config": {
      "interfaceId": "wlan0",
      "defaultProfileId": "<WIFI_PROFILE_ID>",
      "profiles": [
        {
          "profileId": "<WIFI_PROFILE_ID>",
          "ssid": "NA20-<receiver-id>",
          "security": "wpa2_psk",
          "bssid": "<NA20_AP_BSSID>",
          "hidden": false,
          "persist": true,
          "autoConnect": true,
          "source": "pairing"
        }
      ]
    }
  }
}
```

### 9.3 触发连接

```json
{
  "id": 203,
  "method": "network.connectWifi",
  "params": {
    "interfaceId": "wlan0",
    "profileId": "<WIFI_PROFILE_ID>",
    "timeoutMs": 15000
  }
}
```

```json
{
  "id": 203,
  "status": {
    "ok": true,
    "code": 0
  },
  "result": {
    "accepted": true,
    "state": {
      "interfaceId": "wlan0",
      "state": "connecting",
      "profileId": "<WIFI_PROFILE_ID>",
      "ssid": "NA20-<receiver-id>",
      "bssid": "<NA20_AP_BSSID>"
    }
  }
}
```

### 9.4 Wi-Fi 连接成功事件

```json
{
  "event": "network.wifiStateChanged",
  "intent": 2,
  "data": {
    "interfaceId": "wlan0",
    "previousState": {
      "interfaceId": "wlan0",
      "state": "connecting",
      "profileId": "<WIFI_PROFILE_ID>"
    },
    "state": {
      "interfaceId": "wlan0",
      "state": "connected",
      "profileId": "<WIFI_PROFILE_ID>",
      "ssid": "NA20-<receiver-id>",
      "bssid": "<NA20_AP_BSSID>",
      "rssiDbm": -48
    },
    "reason": "connect_completed"
  }
}
```

连接成功后，如业务需要确认 IP 地址，调用方应继续调用 `network.getIpConfig(interfaceId=wlan0)` 或订阅 `network.ipConfigChanged`。

### 9.5 profile 不存在失败示例

```json
{
  "id": 204,
  "method": "network.connectWifi",
  "params": {
    "interfaceId": "wlan0",
    "profileId": "<MISSING_PROFILE_ID>",
    "timeoutMs": 15000
  }
}
```

```json
{
  "id": 204,
  "status": {
    "ok": false,
    "code": 12,
    "msg": "Wi-Fi profile was not found.",
    "details": {
      "candidateError": "NETWORK_PROFILE_NOT_FOUND",
      "profileId": "<MISSING_PROFILE_ID>"
    }
  }
}
```

## 10. 候选 Errors

| Error | 类别 | 说明 | Review |
|---|---|---|---|
| `NETWORK_SECURITY_UNSUPPORTED` | network/business | 目标 AP 安全类型不被 STA 支持。 | `[REVIEW-DRAFT]` |
| `NETWORK_PROFILE_NOT_FOUND` | network/business | 指定 profileId 不存在。 | `[REVIEW-DRAFT]` |
| `NETWORK_AUTH_FAILED` | network/business | Wi-Fi 认证失败。 | `[REVIEW-DRAFT]` |
| `NETWORK_AP_NOT_FOUND` | network/business | 未发现目标 AP。 | `[REVIEW-DRAFT]` |
| `NETWORK_CREDENTIAL_INVALID` | network/business | 凭据格式、token 或 opaque reference 无效。 | `[REVIEW-ASK]` |

采纳时若通用错误码和 `failureReason` 足够表达上述场景，可不新增全部业务错误；否则错误码应在 network domain 范围内分配，编号为 `TBD after adoption`。

## 11. Legacy 待映射

| 来源 | 旧协议条目 | 候选映射 | 状态 | 说明 |
|---|---|---|---|---|
| AXDP HID | `CommonSetTailWiFiSSID` | `network.setWifiConfig` | `[REVIEW-ASK]` | 需确认旧命令是否只写 SSID，还是包含密码/安全类型。 |
| AXDP HID | `CommonGetTailWiFiSSID` | `network.getWifiConfig` | `[REVIEW-ASK]` | 需确认 response 是否返回完整 profile。 |
| Rooms WS JSON | `WifiConnect` | `network.connectWifi` | `[REVIEW-ASK]` | 需确认是否 inline profile、已保存 profile，及失败状态码。 |
| Rooms WS JSON | `GetWifiSignalStrength` | `network.getWifiState` | `[REVIEW-ASK]` | 可映射 RSSI，但不等同完整状态。 |
| VM33 HTTP JSON | `Config.Set:Wifi` / `Config.MultiSet:Wifi` | `network.setWifiConfig` | `[REVIEW-ASK]` | 需确认多 profile、持久化和字段路径。 |
| VM33 HTTP JSON | `Config.Get:Wifi` / `Config.MultiGet:Wifi` | `network.getWifiConfig` | `[REVIEW-ASK]` | 需确认敏感字段是否返回。 |
| VM33 HTTP JSON | `Wifi.ScanWifi` | `network.scanWifi` | `[REVIEW-ASK]` | 需确认同步/异步扫描结果。 |
| VM33 HTTP JSON | `Wifi.ConnectWifi` / `Wifi.ConnectWif` | `network.connectWifi` | `[REVIEW-ASK]` | 需确认连接参数和失败原因。 |
| VM33 HTTP JSON | `Config.Subscribe:Wifi` | `network.wifiConfigChanged` | `[REVIEW-ASK]` | 需确认事件 payload。 |

## 12. Registry 草案输入

采纳本文后，`registry/domains/network/domain.yaml` 至少应包含：

```yaml
capabilities:
  - id: network.wifi
    name: network.wifi capability
    status: draft
    schema: NetworkWifiCapabilities
    methods:
      - network.getWifiCapabilities
      - network.getWifiConfig
      - network.setWifiConfig
      - network.scanWifi
      - network.connectWifi
      - network.disconnectWifi
      - network.getWifiState
    events:
      - network.wifiConfigChanged
      - network.wifiStateChanged
      - network.wifiScanResultReported

methods:
  - name: network.setWifiConfig
    id: TBD after adoption
    bitOffset: TBD after adoption
    requestSchema: NetworkSetWifiConfigRequest
    responseSchema: NetworkSetWifiConfigResponse
    capabilities: [network.wifi]
```

`network.resetWifiConfig` / `network.forgetWifi` 若采纳，应作为 optional method 追加。

## 13. 采纳检查清单

- [ ] 08 已确认 `network.wifi` 粒度和 method/event 命名。
- [ ] 09 已确认 network domain 写入 `registry/domains/network/domain.yaml`。
- [ ] 10 已确认 methodId、bitOffset、request/response schema。
- [ ] 11 已确认 eventId、eventMasks bitOffset、event schema。
- [ ] 12 已确认是否新增 network domain 错误码。
- [ ] 13 已确认 schema fieldId、capabilityId、supportedMethods。
- [ ] 事件去重规则已与 `network.interface`、`network.ip`、`network.ap` 同步确认。
- [ ] 凭据字段已完成安全评审，不会被普通日志、遥测或崩溃报告记录。
- [ ] IP/DHCP 成功或失败已明确转交 `network.ip`。
- [ ] legacyRefs 已确认或明确延后到 adapter-only。

## 14. 待确认问题

1. `[REVIEW-ASK]` NT10 写入 pairing profile 后默认是否 `persist=true`？
2. `[REVIEW-ASK]` `connectAfterSave` 是否需要进入 MVP，还是由 Host 显式调用 `network.connectWifi`？
3. `[REVIEW-ASK]` 凭据使用明文 passphrase、pairing token，还是 opaque reference？
4. `[REVIEW-ASK]` Wi-Fi `connected` 是否只表示认证/关联成功；IP ready 是否统一由 `network.ip` 确认？
5. `[REVIEW-ASK]` 是否需要在 MVP 采纳 `forgetWifi`，还是由配置覆盖替代？
