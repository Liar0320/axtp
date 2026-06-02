请阅读当前 AXTP / 协议仓库，重点关注以下内容：

1. 协议域划分文档；
2. network 域已有协议文档；
3. capability 能力查询与协商文档；
4. RPC 方法注册表；
5. 事件注册表；
6. ErrorCode / Result / State 命名规范；
7. JSON-RPC / Binary-RPC 映射示例。

目标：重新生成或更新一篇完整的 **Network 网络配置协议文档**，并重点补充 AP 配置能力。

需要明确区分：

```text
Wi-Fi / STA:
  设备作为客户端连接外部路由器或热点。
  例如设置设备要连接的 SSID、密码、安全类型、扫描策略。

AP / SoftAP / Hotspot:
  设备自身开启热点，供手机、电脑、上位机或其他设备连接。
  例如设置设备热点的 SSID、密码、信道、频段、最大连接数、DHCP 地址池。
```

不要把 AP 配置和 Wi-Fi 连接配置混在一起。

---

# 一、文档目标

请新增或更新 network 协议文档，建议文件名为：

```text
docs/protocol/network/NetworkConfig.md
```

如果仓库已有 network 协议目录，请放入现有目录；如果已有统一 registry 文档，也需要同步补充方法、事件和 capability。

文档需要覆盖：

```text
1. 网络接口信息查询；
2. IP 配置；
3. DNS 配置；
4. Wi-Fi STA 配置，即设备连接外部 Wi-Fi；
5. Wi-Fi 扫描；
6. AP / SoftAP / Hotspot 配置，即设备自身热点；
7. AP 状态查询与连接客户端列表；
8. 蓝牙 MAC / 蓝牙基础信息；
9. 网络能力查询；
10. 网络配置事件；
11. network 域与 video/audio/input/device/system 的边界；
12. 安全规则，尤其是 Wi-Fi/AP 密码不得在查询或事件中明文回显。
```

---

# 二、域边界

Network 域负责基础网络连接与接口配置：

```text
network:
  IP、DNS、网关、以太网、Wi-Fi STA、AP/SoftAP、蓝牙 MAC、网络接口状态。
```

不要把跑在网络上的业务服务放到 network：

```text
video:
  RTSP、NDI、SRT、RTMP 等视频输出服务配置。

audio:
  Dante、网络音频能力、音频路由。

input:
  VISCA UDP/TCP、HID、KVM、外部控制输入。

device:
  USB config、设备身份、基础设备信息。

system:
  reboot、power、battery、time sync、功耗策略。
```

必须在文档中写清楚：

```text
Wi-Fi 配置：
  指设备连接外部热点。

AP 配置：
  指设备本身开启热点。
```

---

# 三、核心接口清单

## 3.1 网络接口信息

```text
network.getInterfaces
network.getInterfaceInfo
network.interfaceStateChanged
```

## 3.2 IP 配置

```text
network.setIpConfig
network.getIpConfig
network.ipConfigChanged
```

## 3.3 DNS 配置

可以并入 `network.setIpConfig`，也可以提供独立接口：

```text
network.setDnsConfig
network.getDnsConfig
network.dnsConfigChanged
```

## 3.4 Wi-Fi STA 配置

设备连接外部热点：

```text
network.scanWifi
network.setWifiConfig
network.getWifiConfig
network.connectWifi
network.disconnectWifi
network.forgetWifi
network.getWifiState
network.wifiConfigChanged
network.wifiStateChanged
network.wifiScanResultReported
```

## 3.5 Wi-Fi 扫描策略

```text
network.setWifiScanConfig
network.getWifiScanConfig
network.wifiScanConfigChanged
```

## 3.6 AP / SoftAP / Hotspot 配置

设备自身开启热点：

```text
network.setApConfig
network.getApConfig
network.getApState
network.startAp
network.stopAp
network.getApClients
network.apConfigChanged
network.apStateChanged
network.apClientChanged
```

## 3.7 蓝牙信息

```text
network.getBluetoothInfo
network.bluetoothStateChanged
```

## 3.8 Network 能力查询

```text
network.getCapabilities
```

全局能力发现仍通过：

```text
capability.getAll
```

---

# 四、网络接口信息

## 4.1 network.getInterfaces

用于查询设备所有网络接口。

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

字段说明：

```text
interface:
  网络接口名，例如 eth0 / wlan0 / ap0 / usb0 / bluetooth。

type:
  ethernet / wifi / ap / bluetooth / usb_network / cellular / unknown。

macAddress:
  接口 MAC 地址。

state:
  up / down / enabled / disabled / unavailable / unsupported。

linkState:
  connected / disconnected / connecting / running / error / unknown。

actualSpeedMbps:
  当前协商链路速率，单位 Mbps。

clientCount:
  AP 模式下当前连接的客户端数量。
```

---

# 五、IP 配置

## 5.1 network.setIpConfig

用于设置某个网络接口的 IP 配置。

DHCP：

```json
{
  "method": "network.setIpConfig",
  "params": {
    "interface": "eth0",
    "family": "ipv4",
    "mode": "dhcp"
  }
}
```

静态 IP：

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
    "dns": ["8.8.8.8", "1.1.1.1"]
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
    "state": "applied",
    "requiresReconnect": true
  }
}
```

AP 接口也可以有自己的 IP 配置，但一般由 `network.setApConfig` 内的 DHCP 配置决定。例如：

```text
ap0:
  address = 192.168.4.1
  dhcpServer = enabled
```

---

# 六、Wi-Fi STA 配置

Wi-Fi STA 表示设备连接外部热点。

## 6.1 network.scanWifi

请求：

```json
{
  "method": "network.scanWifi",
  "params": {
    "interface": "wlan0",
    "scanMode": "full_channel"
  }
}
```

返回：

```json
{
  "result": {
    "accepted": true,
    "state": "scanning"
  }
}
```

扫描结果事件：

```json
{
  "event": "network.wifiScanResultReported",
  "params": {
    "interface": "wlan0",
    "results": [
      {
        "ssid": "Office-WiFi",
        "bssid": "11:22:33:44:55:66",
        "rssi": -55,
        "frequencyMHz": 2412,
        "channel": 1,
        "security": "wpa2_psk"
      }
    ],
    "timestampMs": 1710000000000
  }
}
```

## 6.2 network.setWifiConfig

用于写入设备要连接的外部 Wi-Fi 信息。

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
    "scanMode": "full_channel"
  }
}
```

返回：

```json
{
  "result": {
    "interface": "wlan0",
    "ssid": "Office-WiFi",
    "saved": true,
    "state": "configured"
  }
}
```

## 6.3 network.getWifiConfig

查询 Wi-Fi 配置时不得返回明文密码。

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
    "ssid": "Office-WiFi",
    "security": "wpa2_psk",
    "hidden": false,
    "autoConnect": true,
    "scanMode": "full_channel",
    "passwordConfigured": true
  }
}
```

## 6.4 network.connectWifi

写入并立即连接：

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
    "state": "connecting"
  }
}
```

## 6.5 network.getWifiState

```json
{
  "method": "network.getWifiState",
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
    "state": "connected",
    "ssid": "Office-WiFi",
    "bssid": "11:22:33:44:55:66",
    "rssi": -55,
    "frequencyMHz": 2412,
    "channel": 1,
    "security": "wpa2_psk",
    "ipAddress": "192.168.1.120"
  }
}
```

Wi-Fi 状态枚举：

```text
disabled
disconnected
scanning
connecting
connected
auth_failed
dhcp_failed
failed
unsupported
```

---

# 七、AP / SoftAP / Hotspot 配置

AP 表示设备自身开启热点，供其他设备连接。

必须与 Wi-Fi STA 区分：

```text
network.setWifiConfig:
  配置设备要连接哪个外部 Wi-Fi。

network.setApConfig:
  配置设备自身开启的热点。
```

## 7.1 network.setApConfig

用于配置设备自身热点。

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
    "maxClients": 8,
    "ip": {
      "address": "192.168.4.1",
      "prefixLength": 24
    },
    "dhcpServer": {
      "enabled": true,
      "startAddress": "192.168.4.100",
      "endAddress": "192.168.4.150",
      "leaseTimeSec": 86400
    }
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
    "maxClients": 8,
    "state": "running",
    "ip": {
      "address": "192.168.4.1",
      "prefixLength": 24
    },
    "dhcpServer": {
      "enabled": true,
      "startAddress": "192.168.4.100",
      "endAddress": "192.168.4.150",
      "leaseTimeSec": 86400
    },
    "passwordConfigured": true
  }
}
```

注意：

```text
setApConfig 请求中可以出现 password。
getApConfig / apConfigChanged / apStateChanged 不得回显明文 password。
```

## 7.2 network.getApConfig

```json
{
  "method": "network.getApConfig",
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
    "enabled": true,
    "ssid": "AX-Device-AP",
    "security": "wpa2_psk",
    "hidden": false,
    "band": "2.4g",
    "channel": 6,
    "maxClients": 8,
    "ip": {
      "address": "192.168.4.1",
      "prefixLength": 24
    },
    "dhcpServer": {
      "enabled": true,
      "startAddress": "192.168.4.100",
      "endAddress": "192.168.4.150",
      "leaseTimeSec": 86400
    },
    "passwordConfigured": true
  }
}
```

## 7.3 network.startAp

如果设备支持“配置”和“启动”分离，提供 start/stop。

```json
{
  "method": "network.startAp",
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
    "state": "starting"
  }
}
```

## 7.4 network.stopAp

```json
{
  "method": "network.stopAp",
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
    "state": "stopped"
  }
}
```

## 7.5 network.getApState

```json
{
  "method": "network.getApState",
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
    "state": "running",
    "ssid": "AX-Device-AP",
    "band": "2.4g",
    "channel": 6,
    "clientCount": 2,
    "ipAddress": "192.168.4.1"
  }
}
```

AP 状态枚举：

```text
disabled
starting
running
stopping
stopped
failed
unsupported
```

## 7.6 network.getApClients

查询当前连接到设备热点的客户端。

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

## 7.7 AP 配置字段说明

```text
interface:
  AP 接口名，例如 ap0。

enabled:
  是否启用 AP 配置。

ssid:
  设备热点名称。

password:
  设备热点密码。请求可出现，响应/事件不得明文回显。

security:
  open / wpa2_psk / wpa3_sae / wpa2_wpa3_mixed。

hidden:
  是否隐藏 SSID。

band:
  2.4g / 5g / 6g / auto。

channel:
  AP 工作信道。

maxClients:
  最大客户端连接数。

ip:
  AP 网关地址配置，通常是设备自身在 AP 网段下的地址。

dhcpServer:
  AP 模式下的 DHCP 服务器配置。

passwordConfigured:
  是否已配置密码。
```

## 7.8 AP 配置事件

```text
network.apConfigChanged
```

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
    "reason": "user_request"
  }
}
```

## 7.9 AP 状态事件

```text
network.apStateChanged
```

```json
{
  "event": "network.apStateChanged",
  "params": {
    "interface": "ap0",
    "state": "running",
    "ssid": "AX-Device-AP",
    "clientCount": 0,
    "ipAddress": "192.168.4.1",
    "reason": "ap_started"
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
    "errorCode": "channel_unavailable",
    "message": "AP channel is unavailable",
    "reason": "ap_start_failed"
  }
}
```

## 7.10 AP 客户端变化事件

```text
network.apClientChanged
```

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

# 八、Wi-Fi STA 与 AP 共存规则

文档必须说明：

```text
1. Wi-Fi STA 和 AP 是两个不同角色。
2. STA 使用 wlan0，AP 可以使用 ap0；具体接口名由设备能力声明。
3. 有些芯片支持 STA + AP 并发，有些不支持。
4. 如果不支持并发，启动 AP 可能会断开 STA，连接 STA 也可能会关闭 AP。
5. 设备必须通过 network.getCapabilities 声明 supportsStaApConcurrent。
```

冲突示例：

```json
{
  "error": {
    "code": "Conflict",
    "message": "STA and AP cannot run concurrently on this device",
    "data": {
      "currentMode": "wifi_sta",
      "requestedMode": "ap"
    }
  }
}
```

---

# 九、Wi-Fi / AP 能力查询

## 9.1 network.getCapabilities

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
      "modes": ["dhcp", "static"]
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
      "supportsStaApConcurrent": false
    },
    "bluetooth": {
      "supported": true,
      "supportsMacAddress": true
    }
  }
}
```

---

# 十、蓝牙信息

## 10.1 network.getBluetoothInfo

```json
{
  "method": "network.getBluetoothInfo",
  "params": {}
}
```

返回：

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

---

# 十一、事件清单

需要新增或更新以下事件：

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

---

# 十二、推荐方法清单

## MVP 建议

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

## 可选增强

```text
network.setDnsConfig
network.getDnsConfig

network.setWifiScanConfig
network.getWifiScanConfig

network.getCapabilities
```

---

# 十三、安全规则

网络配置涉及敏感信息，必须遵守：

```text
1. Wi-Fi password 可以在 setWifiConfig / connectWifi 请求中出现。
2. AP password 可以在 setApConfig 请求中出现。
3. getWifiConfig / getApConfig / getWifiState / getApState / 相关 Changed 事件不得回显明文 password。
4. 查询时只返回 passwordConfigured: true/false。
5. 日志中必须避免记录 Wi-Fi/AP 明文 password。
6. 修改 IP / Wi-Fi / AP 配置可能导致当前 AXTP 连接断开，因此需要返回 requiresReconnect。
7. 设置 AP 的 open 安全模式时，设备可以根据安全策略返回 PermissionDenied 或 PolicyRejected。
8. 密码长度、security 类型、channel、band、IP 地址池必须在设备端校验。
```

---

# 十四、错误处理

建议错误码：

```text
InvalidParams:
  IP 地址格式错误、prefixLength 越界、SSID 为空、密码长度非法、security 非法、channel 非法。

UnsupportedCapability:
  设备不支持 Wi-Fi / AP / 蓝牙 / IPv6 / 静态 IP。

UnsupportedInterface:
  指定 interface 不存在或不支持该能力。

AuthFailed:
  Wi-Fi STA 密码错误或认证失败。

DhcpFailed:
  DHCP 获取地址失败。

NetworkUnavailable:
  网口未连接、Wi-Fi 模块不可用。

ChannelUnavailable:
  AP 指定信道不可用。

Conflict:
  STA/AP 模式互斥、正在扫描时切换配置、IP 地址池冲突。

ServerBusy:
  网络模块繁忙。

PermissionDenied:
  当前用户无权限修改网络配置。

PolicyRejected:
  设备策略拒绝该配置，例如禁止开启 open AP。
```

错误示例：AP 信道不可用

```json
{
  "error": {
    "code": "ChannelUnavailable",
    "message": "AP channel is unavailable",
    "data": {
      "field": "channel",
      "value": 149
    }
  }
}
```

错误示例：STA/AP 互斥

```json
{
  "error": {
    "code": "Conflict",
    "message": "STA and AP cannot run concurrently",
    "data": {
      "currentMode": "wifi_sta",
      "requestedMode": "ap"
    }
  }
}
```

---

# 十五、与 capability 域关系

请在 capability 注册表中新增或更新 network 能力：

```text
network.interface
network.ip
network.wifi
network.ap
network.bluetooth
```

说明：

```text
Capability ID 使用 domain.feature 能力块。
Config / State / Scan / Connection 是方法、事件或 schema 字段语义，
不作为独立 capability ID。
```

推荐归属：

| capability ID | 对应方法 | 对应事件 |
|---|---|---|
| `network.interface` | `network.getInterfaces`、`network.getInterfaceInfo` | `network.interfaceStateChanged` |
| `network.ip` | `network.setIpConfig`、`network.getIpConfig`、可选 `network.setDnsConfig`、`network.getDnsConfig` | `network.ipConfigChanged`、可选 `network.dnsConfigChanged` |
| `network.wifi` | `network.scanWifi`、`network.setWifiConfig`、`network.getWifiConfig`、`network.connectWifi`、`network.disconnectWifi`、`network.forgetWifi`、`network.getWifiState`、可选 `network.setWifiScanConfig`、`network.getWifiScanConfig` | `network.wifiConfigChanged`、`network.wifiStateChanged`、`network.wifiScanResultReported`、可选 `network.wifiScanConfigChanged` |
| `network.ap` | `network.setApConfig`、`network.getApConfig`、`network.getApState`、`network.startAp`、`network.stopAp`、`network.getApClients` | `network.apConfigChanged`、`network.apStateChanged`、`network.apClientChanged` |
| `network.bluetooth` | `network.getBluetoothInfo` | `network.bluetoothStateChanged` |

旧 capability ID 迁移：

| 旧 capability ID | 新 capability ID | 迁移原因 | 兼容策略 |
|---|---|---|---|
| `network.interfaces` | `network.interface` | feature 使用单数能力块。 | draft 可直接迁移；如已发布可作为 alias 保留一个 minor 版本。 |
| `network.ipConfig` | `network.ip` | `Config` 是方法/schema 语义。 | 方法名 `network.setIpConfig` / `network.getIpConfig` 保持不变。 |
| `network.wifiConfig` | `network.wifi` | Wi-Fi 能力包含配置、扫描、连接和状态。 | 旧 capability 仅作为兼容 alias。 |
| `network.wifiConnection` | `network.wifi` | connection 是状态或动作结果，不是独立 feature。 | 方法名 `connectWifi` / `disconnectWifi` 保持不变。 |
| `network.wifiScan` | `network.wifi` | scan 是动作方法。 | 事件 `wifiScanResultReported` 保持不变。 |
| `network.apConfig` | `network.ap` | AP 能力包含配置、启停、状态和客户端信息。 | 方法/事件名保持不变。 |
| `network.bluetoothInfo` | `network.bluetooth` | info 是字段/查询结果语义。 | `network.getBluetoothInfo` 保持不变。 |

最终方法清单：

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

最终事件清单：

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

---

# 十六、旧协议迁移建议

如果老协议中存在字段：

```text
ip
netmask
gateway
dns
wifiSsid
wifiPassword
wifiSecurity
wifiFullChannelScan
apSsid
apPassword
apSecurity
apChannel
apBand
apMaxClients
bluetoothMac
```

建议映射为：

```text
ip / netmask / gateway / dns
  -> network.setIpConfig / network.getIpConfig

netmask
  -> prefixLength，必要时保留 netmask 作为兼容字段

wifiSsid / wifiPassword / wifiSecurity
  -> network.setWifiConfig

wifiFullChannelScan
  -> network.setWifiConfig.scanMode = full_channel
  或 network.setWifiScanConfig.scanMode = full_channel

apSsid / apPassword / apSecurity / apChannel / apBand / apMaxClients
  -> network.setApConfig

bluetoothMac
  -> network.getBluetoothInfo.macAddress
```

---

# 十七、验收标准

完成后应满足：

```text
1. 新增或更新 Network 网络配置协议文档。
2. 文档明确 Wi-Fi 和 AP 的区别：
   Wi-Fi = 设备连接外部热点；
   AP = 设备自身开启热点。
3. 文档包含网络接口信息、IP 配置、Wi-Fi 配置、AP 配置、蓝牙信息。
4. 文档包含 AP 方法：
   network.setApConfig
   network.getApConfig
   network.getApState
   network.startAp
   network.stopAp
   network.getApClients
5. 文档包含 AP 事件：
   network.apConfigChanged
   network.apStateChanged
   network.apClientChanged
6. AP 配置示例包含 ssid/password/security/band/channel/maxClients/ip/dhcpServer。
7. getApConfig 不回显明文 password，只返回 passwordConfigured。
8. 文档说明 STA/AP 是否可以共存由 supportsStaApConcurrent 声明。
9. capability 注册表补充 network.interface / network.ip / network.wifi / network.ap / network.bluetooth。
10. 方法注册表和事件注册表同步补充新增方法/事件。
11. 文档说明 network 与 video/audio/input/device/system 的边界。
12. 文档包含错误处理和安全规则。
```

---

# 十八、不要做的事情

不要做：

```text
1. 不要把设备连接外部 Wi-Fi 和设备自身 AP 配置混成同一个 setWifiConfig。
2. 不要在 getWifiConfig/getApConfig/事件中返回明文 password。
3. 不要把 RTSP/NDI/Dante/VISCA 放进 network。
4. 不要假设所有设备都支持 STA + AP 并发。
5. 不要只用 enabled 表示 AP 当前状态；enabled 是目标配置，state 是实际运行状态。
6. 不要用 status 表示当前 AP/Wi-Fi 状态；status 只用于操作结果。
7. 不要把 AP 客户端连接/断开事件命名为 Changed 之外的模糊事件；统一使用 network.apClientChanged。
```

请按以上要求实现。修改完成后，请列出：

```text
1. 新增/修改的文件；
2. 新增的方法；
3. 新增的事件；
4. 新增的 capability ID；
5. 是否同步更新了方法注册表、事件注册表和 capability 注册表；
6. Wi-Fi STA 与 AP 配置的最终结构示例。
```
