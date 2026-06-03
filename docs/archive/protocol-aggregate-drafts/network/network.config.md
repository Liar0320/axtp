# Network 网络配置协议

> Status: draft
> Scope: network domain business protocol, registry candidate
> Updated: 2026-06-03

本文档定义 AXTP `network` 域的网络接口、IP/DNS、Wi-Fi STA、AP/SoftAP、蓝牙基础信息、网络能力查询和网络状态事件。本文档是 `registry/domains/network/domain.yaml` 的采纳候选；采纳后必须同步 Method Registry、Event Registry、Capability Registry、Schema Registry 和生成产物。

---

## 协议审核状态（人工复核）

| 标记 | 对象 | 审核结论 | 本文处理 |
|---|---|---|---|
| `[REVIEW-OK]` | `network.interface` / `network.ip` / `network.wifi` / `network.ap` / `network.bluetooth` / `network.serviceEndpoint` | feature ID 已按 08 taxonomy 收敛为稳定能力块，Wi-Fi STA 与 AP/SoftAP 边界清楚。 | 保留为 capability 候选，并补充方法、事件和字段归属表。 |
| `[REVIEW-OK]` | `network.setIpConfig` / `network.getIpConfig` / `network.setWifiConfig` / `network.connectWifi` / `network.setApConfig` / `network.getBluetoothInfo` | 方法保留 Config/State/Scan 等接口语义，但不把它们提升为 capability ID。 | 保留方法名，并补充 AP 配置、状态、客户端和安全规则。 |
| `[REVIEW-FIX]` | 文档语气 | 原正文是 intake 提示语，不适合作为最终协议正文。 | 已改写为规范正文。 |
| `[REVIEW-ASK]` | AXDP IP/MAC 命令 | `CommonGetIPConfig`、`CommonSet/GetDHCPState`、`CommonSet/GetIPAddress`、`CommonSet/GetNetMask`、`CommonSet/GetGateway`、`CommonSet/GetMacAddress`、`CommonGetMacAddress` 可映射到 `network.ip` / `network.interface`。 | IP/DHCP/netmask/gateway 已给出映射；MAC 写入因制造权限和重启规则未确认，暂列为 optional。 |
| `[REVIEW-ASK]` | AXDP `CommonSetViscaUdpPort` / `CommonGetViscaUdpPort` | 暂归 `network.serviceEndpoint`，但 VISCA 也可能归 `input.visca`。 | 仅当语义是端口/入口广告时归 `network.serviceEndpoint`；若包含 VISCA 协议行为，归 `input.visca`。 |
| `[REVIEW-ASK]` | AXDP 蓝牙命令 | `CommonGetBluetoothMacAddr`、`CommonSetBlueToothRestore`、`CommonSet/GetBlueToothName` 可归 `network.bluetooth`。 | 本文只将基础查询纳入 MVP；名称设置和恢复列为 optional，等待是否拆独立 bluetooth 域的决策。 |
| `[REVIEW-ASK]` | AXDP `CommonSetTailWiFiSSID` / `CommonGetTailWiFiSSID` | 暂归 `network.wifi`，但 Tail Wi-Fi 的角色和 AP/STA 关系不足。 | 保留为 `network.wifi` 迁移候选；落 registry 前需确认是外部 STA、尾部模块 STA，还是 AP 别名。 |

当前 `registry/domains/network/domain.yaml` 仍存在旧草案 `network.getApInfo` / `network.apInfoChanged` / `network.softAp`。本文将其视为旧 draft alias：正式采纳时应迁移到 `network.ap`、`network.getApConfig`、`network.getApState` 和 `network.apStateChanged`，或明确保留一个兼容版本。

---

## 1. 目标与范围

`network` 域负责设备基础网络连接与接口配置：

| 能力块 | 范围 |
|---|---|
| `network.interface` | 以太网、Wi-Fi、AP、USB network、cellular、bluetooth 等接口的基础信息和链路状态。 |
| `network.ip` | IPv4/IPv6 地址、DHCP、静态 IP、网关、DNS、AP 网段地址。 |
| `network.wifi` | 设备作为 STA 连接外部 Wi-Fi，包括扫描、保存配置、连接、断开、遗忘和状态查询。 |
| `network.ap` | 设备自身开启 AP/SoftAP/Hotspot，包括 SSID、安全、频段、信道、DHCP 地址池、启停、状态和客户端列表。 |
| `network.bluetooth` | 蓝牙基础信息，例如 MAC、名称、开关状态。 |
| `network.serviceEndpoint` | 网络入口或发现信息。只描述服务入口，不承载业务服务语义。 |

以下内容不归 `network`：

| 域 | 不归 network 的内容 |
|---|---|
| `video` | RTSP、NDI、SRT、RTMP、视频编码、视频输出流配置。 |
| `audio` | Dante、网络音频、音频路由、音频算法。 |
| `input` | VISCA UDP/TCP、HID、KVM、外部控制输入协议。 |
| `device` | USB 描述符、设备身份、基础设备信息。 |
| `system` | reboot、power、battery、time sync、功耗策略。 |
| `diagnostic` | Wi-Fi/Bluetooth 产测、网络端口测试、BQB 测试。 |

---

## 2. STA 与 AP 的强边界

Wi-Fi STA 和 AP/SoftAP 是不同角色，方法、状态和 capability 不得混用。

| 角色 | AXTP capability | 典型接口 | 语义 | 方法示例 |
|---|---|---|---|---|
| Wi-Fi STA | `network.wifi` | `wlan0` | 设备作为客户端连接外部路由器或热点。 | `network.setWifiConfig`、`network.connectWifi`、`network.getWifiState` |
| AP / SoftAP / Hotspot | `network.ap` | `ap0` | 设备自身开启热点，供手机、电脑、上位机或其他设备连接。 | `network.setApConfig`、`network.startAp`、`network.getApClients` |

强制规则：

1. `network.setWifiConfig` 只配置设备要连接的外部 Wi-Fi。
2. `network.setApConfig` 只配置设备自身开启的热点。
3. 查询和事件不得把 STA 的 `ssid/password/security` 与 AP 的 `ssid/password/security` 合并成同一个对象。
4. `enabled` 表示持久化目标配置；`state` 表示真实运行状态。
5. 不使用 `status` 表示 Wi-Fi/AP 当前状态；`status` 保留给 RPC 执行结果。

---

## 3. Capability 与发现

全局可调用方法发现通过 capability 域完成：

```text
capability.supportedMethods
```

AXTP v1 Core 强制入口是 `capability.supportedMethods`。完整 `capability.getAll` / `capability.getRegistry` 属于后续完整能力模型；实现存在时可以返回 capability 级别的 `network.interface`、`network.ip`、`network.wifi`、`network.ap`、`network.bluetooth`。

`network.getCapabilities` 返回 network 域的详细能力范围，例如接口名、频段、信道、IP family、是否支持 STA/AP 并发和 AP DHCP Server。

### 3.1 capability 候选

| capability ID | 方法 | 事件 |
|---|---|---|
| `network.interface` | `network.getInterfaces`、`network.getInterfaceInfo` | `network.interfaceStateChanged` |
| `network.ip` | `network.setIpConfig`、`network.getIpConfig`、可选 `network.setDnsConfig`、`network.getDnsConfig` | `network.ipConfigChanged`、可选 `network.dnsConfigChanged` |
| `network.wifi` | `network.scanWifi`、`network.setWifiConfig`、`network.getWifiConfig`、`network.connectWifi`、`network.disconnectWifi`、`network.forgetWifi`、`network.getWifiState`、可选 `network.setWifiScanConfig`、`network.getWifiScanConfig` | `network.wifiConfigChanged`、`network.wifiStateChanged`、`network.wifiScanResultReported`、可选 `network.wifiScanConfigChanged` |
| `network.ap` | `network.setApConfig`、`network.getApConfig`、`network.getApState`、`network.startAp`、`network.stopAp`、`network.getApClients` | `network.apConfigChanged`、`network.apStateChanged`、`network.apClientChanged` |
| `network.bluetooth` | `network.getBluetoothInfo`、可选 `network.setBluetoothConfig`、`network.resetBluetoothConfig` | `network.bluetoothStateChanged` |
| `network.serviceEndpoint` | 可选 `network.getServiceEndpoints`、`network.getServiceEndpointState` | 可选 `network.serviceEndpointChanged` |

### 3.2 旧 capability alias

| 旧 capability ID | 新 capability ID | 迁移规则 |
|---|---|---|
| `network.interfaces` | `network.interface` | feature 使用单数能力块。 |
| `network.ipConfig` | `network.ip` | `Config` 是方法/schema 语义。 |
| `network.wifiConfig` | `network.wifi` | Wi-Fi 能力包含配置、扫描、连接和状态。 |
| `network.wifiConnection` | `network.wifi` | connection 是动作和状态，不是独立 feature。 |
| `network.wifiScan` | `network.wifi` | scan 是动作方法。 |
| `network.apConfig` / `network.softAp` | `network.ap` | AP 能力包含配置、启停、状态和客户端信息。 |
| `network.bluetoothInfo` | `network.bluetooth` | info 是查询结果语义。 |

---

## 4. 通用字段模型

### 4.1 接口与地址

| 字段 | 类型 | 说明 |
|---|---|---|
| `interface` | string | 网络接口名，例如 `eth0`、`wlan0`、`ap0`、`usb0`、`bluetooth`。 |
| `type` | enum | `ethernet` / `wifi` / `ap` / `bluetooth` / `usb_network` / `cellular` / `unknown`。 |
| `macAddress` | string | 冒号分隔的 6 字节 MAC，建议大写，例如 `00:11:22:33:44:55`。 |
| `family` | enum | `ipv4` / `ipv6`。 |
| `address` | string | IPv4 或 IPv6 字符串。 |
| `prefixLength` | uint8 | IPv4 为 0-32，IPv6 为 0-128。 |
| `gateway` | string | 默认网关地址。 |
| `dns` | string[] | DNS 服务器地址列表。 |

### 4.2 状态枚举

| 枚举 | 取值 |
|---|---|
| `administrativeState` | `up` / `down` / `enabled` / `disabled` / `unavailable` / `unsupported` |
| `linkState` | `connected` / `disconnected` / `connecting` / `running` / `error` / `unknown` |
| `ipMode` | `dhcp` / `static` / `link_local` / `disabled` |
| `wifiState` | `disabled` / `disconnected` / `scanning` / `connecting` / `connected` / `auth_failed` / `dhcp_failed` / `failed` / `unsupported` |
| `apState` | `disabled` / `starting` / `running` / `stopping` / `stopped` / `failed` / `unsupported` |
| `security` | `open` / `wep` / `wpa_psk` / `wpa2_psk` / `wpa3_sae` / `wpa2_wpa3_mixed` / `enterprise` |
| `band` | `2.4g` / `5g` / `6g` / `auto` |
| `scanMode` | `auto` / `fast` / `full_channel` / `specific` |
| `apply` | `immediate` / `on_reconnect` / `on_reboot` |
| `changeReason` | `user_request` / `remote_request` / `system_policy` / `link_lost` / `auth_failed` / `dhcp_failed` / `ap_started` / `ap_stopped` / `ap_start_failed` / `client_connected` / `client_disconnected` |

### 4.3 配置写入语义

配置型方法默认写入持久化配置，并按 `apply` 指定生效时机：

| 字段 | 说明 |
|---|---|
| `apply` | 可选，默认 `immediate`。网络配置立即生效可能导致当前 AXTP 会话断开。 |
| `updateMask` | 可选，字段路径数组。出现时只更新列出的字段；未出现时按方法定义更新整个配置对象。 |
| `requiresReconnect` | 响应字段，表示 AXTP 当前连接可能断开或需要客户端重连。 |
| `requiresReboot` | 响应字段，表示配置需要设备重启后生效。 |
| `effectiveAfter` | 响应字段，取值同 `apply`，表示实际生效策略。 |

密码字段的特殊规则：

1. `password` 只能出现在 `setWifiConfig`、`connectWifi`、`setApConfig` 请求中。
2. `password` 省略时表示保留已保存密码；如无已保存密码且 security 需要密码，设备返回 `INVALID_ARGUMENT`。
3. `get*` 方法、状态方法和事件只返回 `passwordConfigured`。
4. 响应、事件、日志、错误详情不得明文回显 `password`。

---

## 5. 方法清单

### 5.1 MVP 方法

```text
network.getInterfaces
network.getInterfaceInfo
network.setIpConfig
network.getIpConfig
network.scanWifi
network.setWifiConfig
network.getWifiConfig
network.connectWifi
network.disconnectWifi
network.forgetWifi
network.getWifiState
network.setApConfig
network.getApConfig
network.getApState
network.startAp
network.stopAp
network.getApClients
network.getBluetoothInfo
```

### 5.2 可选增强方法

```text
network.getCapabilities
network.setDnsConfig
network.getDnsConfig
network.setWifiScanConfig
network.getWifiScanConfig
network.setBluetoothConfig
network.resetBluetoothConfig
network.getServiceEndpoints
network.getServiceEndpointState
```

`network.setInterfaceConfig` 只适用于制造、产测或明确授权的设备 MAC 写入场景，默认不进入普通运行时网络配置 MVP。

---

## 6. network.getCapabilities

用于查询 network 域详细能力范围。

请求：

```json
{
  "method": "network.getCapabilities",
  "params": {}
}
```

返回：

```json
{
  "result": {
    "interfaces": {
      "supported": true,
      "types": ["ethernet", "wifi", "ap", "bluetooth"]
    },
    "ipConfig": {
      "supported": true,
      "families": ["ipv4"],
      "modes": ["dhcp", "static"],
      "supportsDnsConfig": true
    },
    "wifi": {
      "supported": true,
      "interfaces": ["wlan0"],
      "security": ["open", "wpa2_psk", "wpa3_sae", "wpa2_wpa3_mixed"],
      "scanModes": ["auto", "fast", "full_channel", "specific"],
      "bands": ["2.4g", "5g"],
      "supportsHiddenSsid": true,
      "supportsAutoConnect": true
    },
    "ap": {
      "supported": true,
      "interfaces": ["ap0"],
      "security": ["open", "wpa2_psk", "wpa3_sae"],
      "bands": ["2.4g", "5g"],
      "channels": [1, 6, 11, 36, 40, 44, 48],
      "maxClients": {
        "min": 1,
        "max": 16,
        "defaultValue": 8
      },
      "supportsHiddenSsid": true,
      "supportsDhcpServer": true,
      "supportsClientIsolation": true,
      "supportsStaApConcurrent": false
    },
    "radioGroups": [
      {
        "id": "wifi0",
        "interfaces": ["wlan0", "ap0"],
        "supportsConcurrentRoles": false
      }
    ],
    "bluetooth": {
      "supported": true,
      "supportsMacAddress": true,
      "supportsNameConfig": false
    }
  }
}
```

---

## 7. 网络接口信息

### 7.1 network.getInterfaces

查询设备所有网络接口。

请求：

```json
{
  "method": "network.getInterfaces",
  "params": {}
}
```

返回：

```json
{
  "result": {
    "interfaces": [
      {
        "interface": "eth0",
        "type": "ethernet",
        "macAddress": "00:11:22:33:44:55",
        "state": "up",
        "linkState": "connected",
        "actualSpeedMbps": 1000
      },
      {
        "interface": "wlan0",
        "type": "wifi",
        "macAddress": "66:77:88:99:AA:BB",
        "state": "up",
        "linkState": "connected",
        "ssid": "Office-WiFi",
        "rssi": -55
      },
      {
        "interface": "ap0",
        "type": "ap",
        "macAddress": "66:77:88:99:AA:BC",
        "state": "enabled",
        "linkState": "running",
        "ssid": "AX-Device-AP",
        "clientCount": 2
      },
      {
        "interface": "bluetooth",
        "type": "bluetooth",
        "macAddress": "AA:BB:CC:DD:EE:FF",
        "state": "enabled"
      }
    ]
  }
}
```

### 7.2 network.getInterfaceInfo

查询单个接口详情。

请求：

```json
{
  "method": "network.getInterfaceInfo",
  "params": {
    "interface": "eth0"
  }
}
```

返回：

```json
{
  "result": {
    "interface": "eth0",
    "type": "ethernet",
    "macAddress": "00:11:22:33:44:55",
    "state": "up",
    "linkState": "connected",
    "actualSpeedMbps": 1000,
    "mtu": 1500,
    "addresses": [
      {
        "family": "ipv4",
        "address": "192.168.1.100",
        "prefixLength": 24
      }
    ]
  }
}
```

---

## 8. IP 与 DNS 配置

### 8.1 network.setIpConfig

设置接口 IP 配置。`mode=dhcp` 时不得同时提供静态 `address/prefixLength/gateway`；`mode=static` 时必须提供 `address` 与 `prefixLength`。

DHCP 请求：

```json
{
  "method": "network.setIpConfig",
  "params": {
    "interface": "eth0",
    "family": "ipv4",
    "mode": "dhcp",
    "apply": "immediate"
  }
}
```

静态 IP 请求：

```json
{
  "method": "network.setIpConfig",
  "params": {
    "interface": "eth0",
    "family": "ipv4",
    "mode": "static",
    "address": "192.168.1.100",
    "prefixLength": 24,
    "gateway": "192.168.1.1",
    "dns": ["8.8.8.8", "1.1.1.1"],
    "apply": "immediate"
  }
}
```

返回：

```json
{
  "result": {
    "interface": "eth0",
    "family": "ipv4",
    "mode": "static",
    "address": "192.168.1.100",
    "prefixLength": 24,
    "gateway": "192.168.1.1",
    "dns": ["8.8.8.8", "1.1.1.1"],
    "applied": true,
    "effectiveAfter": "immediate",
    "requiresReconnect": true,
    "requiresReboot": false
  }
}
```

### 8.2 network.getIpConfig

查询接口 IP 配置与当前地址。

请求：

```json
{
  "method": "network.getIpConfig",
  "params": {
    "interface": "eth0",
    "family": "ipv4"
  }
}
```

返回：

```json
{
  "result": {
    "interface": "eth0",
    "family": "ipv4",
    "mode": "dhcp",
    "address": "192.168.1.120",
    "prefixLength": 24,
    "gateway": "192.168.1.1",
    "dns": ["192.168.1.1"],
    "leaseExpiresInSec": 43200
  }
}
```

### 8.3 DNS 独立方法

DNS 可以随 `network.setIpConfig` 写入，也可以由可选独立方法维护。

```text
network.setDnsConfig
network.getDnsConfig
network.dnsConfigChanged
```

独立 DNS 方法只修改 DNS，不修改 IP mode、address、prefixLength 和 gateway。

AP 接口也可以有自己的 IP 配置，但通常由 `network.setApConfig.ip` 和 `network.setApConfig.dhcpServer` 统一管理。

---

## 9. Wi-Fi STA 配置

Wi-Fi STA 表示设备连接外部热点。所有 Wi-Fi STA 方法必须归属 `network.wifi`。

### 9.1 network.scanWifi

触发扫描。扫描可能异步完成，结果通过 `network.wifiScanResultReported` 上报。

请求：

```json
{
  "method": "network.scanWifi",
  "params": {
    "interface": "wlan0",
    "scanMode": "full_channel",
    "channels": [1, 6, 11],
    "timeoutMs": 10000
  }
}
```

返回：

```json
{
  "result": {
    "accepted": true,
    "interface": "wlan0",
    "scanId": "scan-0001",
    "state": "scanning"
  }
}
```

### 9.2 network.setWifiConfig

保存设备要连接的外部 Wi-Fi 配置。该方法不启动设备自身 AP。

请求：

```json
{
  "method": "network.setWifiConfig",
  "params": {
    "interface": "wlan0",
    "ssid": "Office-WiFi",
    "password": "12345678",
    "security": "wpa2_psk",
    "hidden": false,
    "autoConnect": true,
    "scanMode": "full_channel",
    "priority": 10,
    "apply": "on_reconnect"
  }
}
```

返回：

```json
{
  "result": {
    "interface": "wlan0",
    "ssid": "Office-WiFi",
    "security": "wpa2_psk",
    "saved": true,
    "state": "configured",
    "passwordConfigured": true,
    "effectiveAfter": "on_reconnect",
    "requiresReconnect": false
  }
}
```

### 9.3 network.getWifiConfig

查询已保存 Wi-Fi 配置。返回中不得包含明文密码。

请求：

```json
{
  "method": "network.getWifiConfig",
  "params": {
    "interface": "wlan0"
  }
}
```

返回：

```json
{
  "result": {
    "interface": "wlan0",
    "profiles": [
      {
        "profileId": "office",
        "ssid": "Office-WiFi",
        "security": "wpa2_psk",
        "hidden": false,
        "autoConnect": true,
        "scanMode": "full_channel",
        "priority": 10,
        "passwordConfigured": true
      }
    ]
  }
}
```

### 9.4 network.connectWifi

连接外部 Wi-Fi。请求可以引用已保存 `profileId`，也可以提供一次性或保存的新配置。

请求：

```json
{
  "method": "network.connectWifi",
  "params": {
    "interface": "wlan0",
    "ssid": "Office-WiFi",
    "password": "12345678",
    "security": "wpa2_psk",
    "save": true,
    "scanMode": "full_channel"
  }
}
```

返回：

```json
{
  "result": {
    "accepted": true,
    "interface": "wlan0",
    "ssid": "Office-WiFi",
    "state": "connecting",
    "requiresReconnect": false
  }
}
```

### 9.5 network.disconnectWifi

断开 Wi-Fi STA 当前连接。

```json
{
  "method": "network.disconnectWifi",
  "params": {
    "interface": "wlan0"
  }
}
```

```json
{
  "result": {
    "interface": "wlan0",
    "state": "disconnected"
  }
}
```

### 9.6 network.forgetWifi

删除已保存 Wi-Fi 配置。

```json
{
  "method": "network.forgetWifi",
  "params": {
    "interface": "wlan0",
    "profileId": "office"
  }
}
```

```json
{
  "result": {
    "interface": "wlan0",
    "profileId": "office",
    "removed": true
  }
}
```

### 9.7 network.getWifiState

查询 Wi-Fi STA 当前状态。

```json
{
  "method": "network.getWifiState",
  "params": {
    "interface": "wlan0"
  }
}
```

```json
{
  "result": {
    "interface": "wlan0",
    "state": "connected",
    "ssid": "Office-WiFi",
    "bssid": "11:22:33:44:55:66",
    "rssi": -55,
    "frequencyMHz": 2412,
    "channel": 1,
    "band": "2.4g",
    "security": "wpa2_psk",
    "ipAddress": "192.168.1.120"
  }
}
```

### 9.8 Wi-Fi 扫描策略

可选方法：

```text
network.setWifiScanConfig
network.getWifiScanConfig
network.wifiScanConfigChanged
```

扫描策略字段：

| 字段 | 说明 |
|---|---|
| `scanMode` | `auto` / `fast` / `full_channel` / `specific`。 |
| `channels` | `specific` 扫描时的信道列表。 |
| `periodSec` | 后台扫描周期。 |
| `reportUnchanged` | 扫描结果未变化时是否仍上报。 |

---

## 10. AP / SoftAP / Hotspot 配置

AP 表示设备自身开启热点，供其他设备连接。所有 AP 方法必须归属 `network.ap`。

### 10.1 network.setApConfig

配置设备自身热点。`enabled` 是持久化目标配置；实际运行状态通过 `network.getApState` 查询。

请求：

```json
{
  "method": "network.setApConfig",
  "params": {
    "interface": "ap0",
    "enabled": true,
    "ssid": "AX-Device-AP",
    "password": "12345678",
    "security": "wpa2_psk",
    "hidden": false,
    "band": "2.4g",
    "channel": 6,
    "channelWidthMHz": 20,
    "countryCode": "US",
    "maxClients": 8,
    "clientIsolation": true,
    "uplinkSharing": "nat",
    "ip": {
      "address": "192.168.4.1",
      "prefixLength": 24
    },
    "dhcpServer": {
      "enabled": true,
      "startAddress": "192.168.4.100",
      "endAddress": "192.168.4.150",
      "leaseTimeSec": 86400,
      "gateway": "192.168.4.1",
      "dns": ["192.168.4.1"]
    },
    "apply": "immediate"
  }
}
```

返回：

```json
{
  "result": {
    "interface": "ap0",
    "enabled": true,
    "ssid": "AX-Device-AP",
    "security": "wpa2_psk",
    "hidden": false,
    "band": "2.4g",
    "channel": 6,
    "channelWidthMHz": 20,
    "maxClients": 8,
    "clientIsolation": true,
    "uplinkSharing": "nat",
    "state": "running",
    "ip": {
      "address": "192.168.4.1",
      "prefixLength": 24
    },
    "dhcpServer": {
      "enabled": true,
      "startAddress": "192.168.4.100",
      "endAddress": "192.168.4.150",
      "leaseTimeSec": 86400,
      "gateway": "192.168.4.1",
      "dns": ["192.168.4.1"]
    },
    "passwordConfigured": true,
    "effectiveAfter": "immediate",
    "requiresReconnect": true
  }
}
```

字段约束：

| 字段 | 约束 |
|---|---|
| `ssid` | 1-32 字节。设备应拒绝空 SSID，除非只查询状态。 |
| `password` | `wpa2_psk` / `wpa3_sae` 通常为 8-63 字符；响应和事件不得回显。 |
| `security=open` | 设备可以因安全策略返回 `NETWORK_POLICY_REJECTED`。 |
| `channel` | 必须在 `network.getCapabilities.ap.channels` 内。 |
| `band` | 必须在设备支持频段内。 |
| `dhcpServer` | 地址池必须位于 `ip.address/prefixLength` 网段内，且不得包含 AP 自身地址。 |
| `uplinkSharing` | `disabled` / `nat` / `bridge`。不支持时返回 `NOT_SUPPORTED`。 |

### 10.2 network.getApConfig

查询 AP 持久化配置。返回中不得包含明文密码。

```json
{
  "method": "network.getApConfig",
  "params": {
    "interface": "ap0"
  }
}
```

```json
{
  "result": {
    "interface": "ap0",
    "enabled": true,
    "ssid": "AX-Device-AP",
    "security": "wpa2_psk",
    "hidden": false,
    "band": "2.4g",
    "channel": 6,
    "channelWidthMHz": 20,
    "maxClients": 8,
    "clientIsolation": true,
    "uplinkSharing": "nat",
    "ip": {
      "address": "192.168.4.1",
      "prefixLength": 24
    },
    "dhcpServer": {
      "enabled": true,
      "startAddress": "192.168.4.100",
      "endAddress": "192.168.4.150",
      "leaseTimeSec": 86400,
      "gateway": "192.168.4.1",
      "dns": ["192.168.4.1"]
    },
    "passwordConfigured": true
  }
}
```

### 10.3 network.startAp

按已保存 AP 配置启动设备热点。`persist=true` 时同步更新 `enabled=true`。

```json
{
  "method": "network.startAp",
  "params": {
    "interface": "ap0",
    "persist": true
  }
}
```

```json
{
  "result": {
    "interface": "ap0",
    "state": "starting",
    "enabled": true
  }
}
```

### 10.4 network.stopAp

停止设备热点。`persist=true` 时同步更新 `enabled=false`。

```json
{
  "method": "network.stopAp",
  "params": {
    "interface": "ap0",
    "persist": true
  }
}
```

```json
{
  "result": {
    "interface": "ap0",
    "state": "stopped",
    "enabled": false
  }
}
```

### 10.5 network.getApState

查询 AP 当前运行状态。该方法返回 runtime state，不替代 `network.getApConfig`。

```json
{
  "method": "network.getApState",
  "params": {
    "interface": "ap0"
  }
}
```

```json
{
  "result": {
    "interface": "ap0",
    "state": "running",
    "ssid": "AX-Device-AP",
    "band": "2.4g",
    "channel": 6,
    "clientCount": 2,
    "ipAddress": "192.168.4.1",
    "failureReason": null
  }
}
```

### 10.6 network.getApClients

查询当前连接到设备热点的客户端。客户端 MAC、主机名属于敏感网络信息，调用方必须具备网络管理权限。

请求：

```json
{
  "method": "network.getApClients",
  "params": {
    "interface": "ap0"
  }
}
```

返回：

```json
{
  "result": {
    "interface": "ap0",
    "clients": [
      {
        "macAddress": "22:33:44:55:66:77",
        "ipAddress": "192.168.4.101",
        "hostname": "client-phone",
        "rssi": -48,
        "connectedDurationSec": 360
      },
      {
        "macAddress": "33:44:55:66:77:88",
        "ipAddress": "192.168.4.102",
        "hostname": "laptop",
        "rssi": -61,
        "connectedDurationSec": 120
      }
    ]
  }
}
```

---

## 11. STA/AP 共存规则

设备必须通过 `network.getCapabilities.ap.supportsStaApConcurrent` 或 `radioGroups.supportsConcurrentRoles` 声明 STA/AP 是否可以并发。

规则：

1. 支持并发时，`wlan0` 与 `ap0` 可以同时运行，但仍可能受信道、频段、带宽、国家码限制。
2. 不支持并发时，启动 AP 可能断开 STA，连接 STA 可能关闭 AP。
3. 会导致当前 AXTP 连接断开的操作必须在响应中设置 `requiresReconnect=true`。
4. 设备不得静默关闭另一角色；必须返回冲突错误，或在响应和后续事件中明确说明影响。

冲突错误示例：

```json
{
  "error": {
    "code": "NETWORK_CONFLICT",
    "message": "STA and AP cannot run concurrently on this device",
    "data": {
      "currentMode": "wifi_sta",
      "requestedMode": "ap",
      "interfaces": ["wlan0", "ap0"]
    }
  }
}
```

---

## 12. 蓝牙基础信息

### 12.1 network.getBluetoothInfo

查询蓝牙基础信息。本文只将基础查询纳入 MVP。

```json
{
  "method": "network.getBluetoothInfo",
  "params": {}
}
```

```json
{
  "result": {
    "interface": "bluetooth",
    "macAddress": "AA:BB:CC:DD:EE:FF",
    "state": "enabled",
    "name": "AX Device"
  }
}
```

可选增强：

```text
network.setBluetoothConfig
network.resetBluetoothConfig
network.bluetoothStateChanged
```

如果产品决定将蓝牙从 network 域拆出独立 `bluetooth` 域，`network.getBluetoothInfo` 应作为兼容查询保留一个 minor 版本，并在新 registry 中声明 alias/deprecated。

---

## 13. 事件

事件通过 RPC EVENT 承载。事件负载不得包含 Wi-Fi 或 AP 明文密码。

### 13.1 事件清单

| 事件 | capability | 触发场景 |
|---|---|---|
| `network.interfaceStateChanged` | `network.interface` | 接口 up/down、链路连接/断开、速率变化。 |
| `network.ipConfigChanged` | `network.ip` | IP mode、地址、网关、DNS、租约变化。 |
| `network.dnsConfigChanged` | `network.ip` | 独立 DNS 配置变化。 |
| `network.wifiConfigChanged` | `network.wifi` | Wi-Fi profile 保存、修改、删除。 |
| `network.wifiStateChanged` | `network.wifi` | Wi-Fi STA 扫描、连接、断开、认证失败、DHCP 失败。 |
| `network.wifiScanConfigChanged` | `network.wifi` | 扫描策略变化。 |
| `network.wifiScanResultReported` | `network.wifi` | 扫描结果上报。 |
| `network.apConfigChanged` | `network.ap` | AP 持久化配置变化。 |
| `network.apStateChanged` | `network.ap` | AP 启动、停止、失败、运行状态变化。 |
| `network.apClientChanged` | `network.ap` | AP 客户端连接或断开。 |
| `network.bluetoothStateChanged` | `network.bluetooth` | 蓝牙开关、名称、MAC 或基础状态变化。 |

### 13.2 Wi-Fi 扫描结果事件

```json
{
  "event": "network.wifiScanResultReported",
  "params": {
    "interface": "wlan0",
    "scanId": "scan-0001",
    "results": [
      {
        "ssid": "Office-WiFi",
        "bssid": "11:22:33:44:55:66",
        "rssi": -55,
        "frequencyMHz": 2412,
        "channel": 1,
        "band": "2.4g",
        "security": "wpa2_psk"
      }
    ],
    "timestampMs": 1710000000000
  }
}
```

### 13.3 Wi-Fi 状态事件

```json
{
  "event": "network.wifiStateChanged",
  "params": {
    "interface": "wlan0",
    "state": "connected",
    "ssid": "Office-WiFi",
    "bssid": "11:22:33:44:55:66",
    "rssi": -55,
    "ipAddress": "192.168.1.120",
    "reason": "user_request",
    "timestampMs": 1710000000000
  }
}
```

### 13.4 AP 配置事件

```json
{
  "event": "network.apConfigChanged",
  "params": {
    "interface": "ap0",
    "enabled": true,
    "ssid": "AX-Device-AP",
    "security": "wpa2_psk",
    "hidden": false,
    "band": "2.4g",
    "channel": 6,
    "maxClients": 8,
    "passwordConfigured": true,
    "reason": "user_request",
    "timestampMs": 1710000000000
  }
}
```

### 13.5 AP 状态事件

```json
{
  "event": "network.apStateChanged",
  "params": {
    "interface": "ap0",
    "state": "running",
    "ssid": "AX-Device-AP",
    "clientCount": 0,
    "ipAddress": "192.168.4.1",
    "reason": "ap_started",
    "timestampMs": 1710000000000
  }
}
```

失败事件：

```json
{
  "event": "network.apStateChanged",
  "params": {
    "interface": "ap0",
    "state": "failed",
    "errorCode": "NETWORK_CHANNEL_UNAVAILABLE",
    "message": "AP channel is unavailable",
    "reason": "ap_start_failed",
    "timestampMs": 1710000000000
  }
}
```

### 13.6 AP 客户端变化事件

客户端连接：

```json
{
  "event": "network.apClientChanged",
  "params": {
    "interface": "ap0",
    "action": "connected",
    "client": {
      "macAddress": "22:33:44:55:66:77",
      "ipAddress": "192.168.4.101",
      "hostname": "client-phone",
      "rssi": -48
    },
    "clientCount": 1,
    "timestampMs": 1710000000000
  }
}
```

客户端断开：

```json
{
  "event": "network.apClientChanged",
  "params": {
    "interface": "ap0",
    "action": "disconnected",
    "client": {
      "macAddress": "22:33:44:55:66:77",
      "ipAddress": "192.168.4.101"
    },
    "clientCount": 0,
    "timestampMs": 1710000000000
  }
}
```

---

## 14. 安全规则

网络配置涉及连接凭据、设备可达性和客户端隐私，必须遵守以下规则：

1. `password` 只允许在配置/连接请求中出现。
2. `getWifiConfig`、`getApConfig`、`getWifiState`、`getApState` 和所有网络事件不得回显明文密码。
3. 查询时只返回 `passwordConfigured: true/false`。
4. 日志、错误详情、审计记录不得写入明文 Wi-Fi/AP 密码。
5. 设备应加密保存网络凭据；无法加密保存时必须在产品安全说明中声明。
6. 修改 IP、Wi-Fi STA、AP 配置可能导致当前 AXTP 连接断开，响应必须返回 `requiresReconnect`。
7. `security=open` 的 AP 可以被设备策略拒绝。
8. `getApClients` 暴露客户端 MAC、IP 和 hostname，必须受网络管理权限控制。
9. 修改 MAC 地址、蓝牙名称恢复、蓝牙重置属于制造或管理员权限，默认不得开放给普通客户端。
10. 输入字段必须校验长度、字符集、IP 地址格式、网段关系、信道、频段和国家码合法性。

---

## 15. 错误处理

### 15.1 复用通用错误

| ErrorCode | 场景 |
|---|---|
| `INVALID_ARGUMENT` | IP 格式错误、SSID 为空、security 非法、password 缺失、DHCP 地址池格式错误。 |
| `OUT_OF_RANGE` | prefixLength、channel、maxClients、leaseTimeSec 超出设备能力范围。 |
| `NOT_SUPPORTED` | 设备不支持 Wi-Fi、AP、蓝牙、IPv6、静态 IP、指定 security 或指定 uplinkSharing。 |
| `NOT_FOUND` | 指定 interface 或 Wi-Fi profile 不存在。 |
| `INVALID_STATE` | 当前状态不允许操作，例如 AP 正在 stopping 时再次 start。 |
| `BUSY` | 网络模块正在扫描、连接、切换配置或应用系统策略。 |
| `TIMEOUT` | 扫描、连接或 DHCP 等待超时。 |
| `PERMISSION_DENIED` | 当前调用方无权修改网络配置或读取 AP 客户端列表。 |
| `UNAVAILABLE` | 网络模块暂时不可用。 |

### 15.2 network 域候选错误

| ErrorCode | 场景 | retryable |
|---|---|---|
| `NETWORK_AUTH_FAILED` | Wi-Fi STA 认证失败。 | false |
| `NETWORK_DHCP_FAILED` | DHCP 获取地址失败，或 AP DHCP Server 启动失败。 | true |
| `NETWORK_LINK_DOWN` | 以太网未插入、Wi-Fi 模块 down。 | true |
| `NETWORK_CHANNEL_UNAVAILABLE` | AP 指定信道不可用或被法规限制。 | false |
| `NETWORK_CONFLICT` | STA/AP 互斥、IP 地址池冲突、接口角色冲突。 | false |
| `NETWORK_POLICY_REJECTED` | 策略拒绝 open AP、禁止指定频段、禁止修改 MAC。 | false |

错误示例：AP 信道不可用

```json
{
  "error": {
    "code": "NETWORK_CHANNEL_UNAVAILABLE",
    "message": "AP channel is unavailable",
    "data": {
      "field": "channel",
      "value": 149,
      "supportedChannels": [1, 6, 11, 36, 40, 44, 48]
    }
  }
}
```

错误示例：AP 地址池冲突

```json
{
  "error": {
    "code": "NETWORK_CONFLICT",
    "message": "AP DHCP pool conflicts with AP interface address",
    "data": {
      "interface": "ap0",
      "address": "192.168.4.1",
      "startAddress": "192.168.4.1",
      "endAddress": "192.168.4.150"
    }
  }
}
```

---

## 16. JSON-RPC 与 Binary-RPC 映射

JSON-RPC 传输使用 `method` 字符串和 JSON params/result：

```json
{
  "id": 101,
  "method": "network.setApConfig",
  "params": {
    "interface": "ap0",
    "enabled": true,
    "ssid": "AX-Device-AP",
    "password": "12345678",
    "security": "wpa2_psk"
  }
}
```

Binary-RPC/TLV 传输使用 MethodId/EventId 与对应 schema fieldId。本文不直接登记数值 ID；采纳到 `registry/domains/network/domain.yaml` 后，由 network 域 `0x0E00-0x0EFF` 范围分配。

同一方法在 JSON-RPC 与 Binary-RPC 下必须共享相同语义：

1. 方法名、schema 字段、错误码一致。
2. `status.code` 使用 AXTP ErrorCode Registry。
3. 事件通过 RPC EVENT 承载，不通过 STREAM。
4. 大量扫描结果可以分页或分批事件上报，但不得改用非注册 payload。

---

## 17. Registry 落地候选

### 17.1 Method Registry 候选

| 方法 | status | capability | 说明 |
|---|---|---|---|
| `network.getInterfaces` | draft | `network.interface` | 查询所有网络接口。 |
| `network.getInterfaceInfo` | draft | `network.interface` | 查询单个接口。 |
| `network.setIpConfig` | draft | `network.ip` | 设置 DHCP/static IP/DNS。 |
| `network.getIpConfig` | draft | `network.ip` | 查询 IP 配置。 |
| `network.setDnsConfig` | optional | `network.ip` | 独立设置 DNS。 |
| `network.getDnsConfig` | optional | `network.ip` | 独立查询 DNS。 |
| `network.scanWifi` | draft | `network.wifi` | 扫描外部 Wi-Fi。 |
| `network.setWifiConfig` | draft | `network.wifi` | 保存 STA 配置。 |
| `network.getWifiConfig` | draft | `network.wifi` | 查询 STA 配置，不含密码。 |
| `network.connectWifi` | draft | `network.wifi` | 连接外部 Wi-Fi。 |
| `network.disconnectWifi` | draft | `network.wifi` | 断开 STA。 |
| `network.forgetWifi` | draft | `network.wifi` | 删除 Wi-Fi profile。 |
| `network.getWifiState` | draft | `network.wifi` | 查询 STA 状态。 |
| `network.setWifiScanConfig` | optional | `network.wifi` | 设置扫描策略。 |
| `network.getWifiScanConfig` | optional | `network.wifi` | 查询扫描策略。 |
| `network.setApConfig` | draft | `network.ap` | 设置设备自身 AP。 |
| `network.getApConfig` | draft | `network.ap` | 查询 AP 配置，不含密码。 |
| `network.getApState` | draft | `network.ap` | 查询 AP 运行状态。 |
| `network.startAp` | draft | `network.ap` | 启动 AP。 |
| `network.stopAp` | draft | `network.ap` | 停止 AP。 |
| `network.getApClients` | draft | `network.ap` | 查询 AP 客户端。 |
| `network.getBluetoothInfo` | draft | `network.bluetooth` | 查询蓝牙基础信息。 |
| `network.getCapabilities` | optional | `network.interface` / `network.ip` / `network.wifi` / `network.ap` / `network.bluetooth` | network 域详细能力。 |

### 17.2 Event Registry 候选

```text
network.interfaceStateChanged
network.ipConfigChanged
network.dnsConfigChanged
network.wifiConfigChanged
network.wifiStateChanged
network.wifiScanConfigChanged
network.wifiScanResultReported
network.apConfigChanged
network.apStateChanged
network.apClientChanged
network.bluetoothStateChanged
```

### 17.3 Schema 候选

```text
NetworkCapabilities
NetworkInterfaceInfo
NetworkIpConfig
NetworkDnsConfig
NetworkWifiConfig
NetworkWifiProfile
NetworkWifiState
NetworkWifiScanConfig
NetworkWifiScanResult
NetworkApConfig
NetworkApState
NetworkApClient
NetworkBluetoothInfo
NetworkApplyResult
```

### 17.4 旧 draft 迁移

| 当前 draft | 目标 |
|---|---|
| `network.softAp` | `network.ap` |
| `network.getApInfo` | 拆分为 `network.getApConfig` 和 `network.getApState`；兼容查询可作为 deprecated alias。 |
| `network.apInfoChanged` | 拆分为 `network.apConfigChanged` 和 `network.apStateChanged`。 |

---

## 18. 旧协议迁移建议

| Legacy 字段或命令 | AXTP 目标 | 说明 |
|---|---|---|
| `CommonGetIPConfig` | `network.getIpConfig` | 可映射到 IP/DHCP/netmask/gateway 汇总查询。 |
| `CommonSet/GetDHCPState` | `network.setIpConfig` / `network.getIpConfig` | `dhcp_state` 映射为 `mode=dhcp/static`。 |
| `CommonSet/GetIPAddress` | `network.setIpConfig` / `network.getIpConfig` | IPv4 uint32 必须规范化为字符串。 |
| `CommonSet/GetNetMask` | `network.setIpConfig` / `network.getIpConfig` | `netmask` 映射为 `prefixLength`；兼容层可保留 netmask 转换。 |
| `CommonSet/GetGateway` | `network.setIpConfig` / `network.getIpConfig` | 映射为 `gateway`。 |
| `CommonSet/GetMacAddress` | `network.getInterfaceInfo`，可选 `network.setInterfaceConfig` | 写入权限、制造模式和重启规则未确认前，不进入 MVP。 |
| VM33 `Config.Set/Get:Wifi` | `network.setWifiConfig` / `network.getWifiConfig` | `key` 映射为 `password`，查询不得回显。 |
| VM33 `Wifi.ScanWifi` | `network.scanWifi` | 扫描结果通过 `network.wifiScanResultReported`。 |
| VM33 `Wifi.ConnectWifi` / Rooms `WifiConnect` | `network.connectWifi` | 可选择 `save=true` 写入 profile。 |
| AXDP `CommonSet/GetTailWiFiSSID` | 待确认后映射到 `network.wifi` 或 `network.ap` | 必须确认 Tail Wi-Fi 角色。 |
| VM33 `Config.Set/Get:APInfo` | `network.setApConfig` / `network.getApConfig` | APInfo 配置和状态拆分。 |
| VM33 `Wifi.OpenApService` | `network.startAp` | 若旧方法同时修改持久化 enabled，则使用 `persist=true`。 |
| `CommonGetBluetoothMacAddr` | `network.getBluetoothInfo` | 映射到 `macAddress`。 |
| `CommonSet/GetBlueToothName` | 可选 `network.setBluetoothConfig` / `network.getBluetoothInfo` | 等待 bluetooth 域边界决策。 |
| `CommonSetBlueToothRestore` | 可选 `network.resetBluetoothConfig` | 等待权限和域边界决策。 |
| `CommonSet/GetViscaUdpPort` | `network.serviceEndpoint` 或 `input.visca` | 仅端口/入口广告归 network；VISCA 行为归 input。 |

---

## 19. 完整性检查

采纳本文后应满足：

1. Wi-Fi STA 与 AP/SoftAP 使用不同 capability、方法和状态模型。
2. AP 配置包含 `ssid`、`password`、`security`、`band`、`channel`、`maxClients`、`ip`、`dhcpServer`。
3. `getWifiConfig`、`getApConfig`、状态查询和事件不回显明文密码。
4. AP 运行状态通过 `network.getApState` 和 `network.apStateChanged` 表达，不使用 `enabled` 代替。
5. AP 客户端通过 `network.getApClients` 和 `network.apClientChanged` 表达。
6. STA/AP 并发能力通过 `supportsStaApConcurrent` 或 `radioGroups` 声明。
7. `network.softAp`、`network.getApInfo`、`network.apInfoChanged` 有明确迁移路径。
8. Registry 采纳时同步 `registry/domains/network/domain.yaml`、生成文档、C++ generated headers 和测试向量。

禁止事项：

1. 不得把设备连接外部 Wi-Fi 和设备自身 AP 配置混成同一个 `setWifiConfig`。
2. 不得在响应、事件、日志或错误详情中返回明文 password。
3. 不得把 RTSP、NDI、Dante、VISCA 业务行为放入 network。
4. 不得假设所有设备都支持 STA/AP 并发。
5. 不得只用 `enabled` 表示 AP 当前状态。
6. 不得用 `status` 表示 Wi-Fi/AP runtime state。
