# AXTP device.info 协议草案

版本：v0.2

归属域：`device`

Capability ID：`device.info`

适用范围：当前 AXTP endpoint 代表的主设备身份、产品、硬件、OS、软件、AXTP runtime 和轻量 capability 建模摘要；同时承接原 `device.identity` 中可写显示名/资产标识的语义。

---

## 协议审核标记（人工复核）

| 标记 | 条目 | 审核结论 | 后续动作 |
|---|---|---|---|
| `[REVIEW-OK]` | domain.feature | `device.info` 回答“这是谁”，属于 device 物理设备层；不把运行时状态、电源或健康混入本 capability。 | 可作为 `registry/domains/device/domain.yaml` 草案输入。 |
| `[REVIEW-OK]` | `device.identity` 合并 | 独立 `device.identity` 不再作为本 flow 的采纳目标；只读 ID/SN/vendor/product identity 和可写显示名/资产标识统一进入 `device.info`。 | 采纳时不要重新创建独立 `device.identity` 草案或 capability。 |
| `[REVIEW-DRAFT]` | `capability` 字段 | `device.getInfo` 保留轻量建模摘要，用于看设备大体按哪些 domain.feature 建模。 | 完整 methods/events/permissions/dynamic availability 仍走 `capability.registry`。 |
| `[REVIEW-ASK]` | productType / os.type 枚举 | 首批 enum 值需要产品、设备和 runtime 确认。 | 采纳前补 enum baseline 和 unknown/other 策略。 |
| `[REVIEW-ASK]` | legacy 映射 | AXDP / Rooms / Signage / VM33 的设备信息字段需确认到新 schema 的字段级映射。 | 采纳前补 legacyRefs 或明确 adapter-only。 |

---

## 1. 文档定位

本文是 `docs/flows/device-system-info.md` 的 Stage 20 协议草案输入，不是最终协议事实源。采纳后，稳定 method、event、schema、error 和 capability 事实必须写入 `registry/domains/device/domain.yaml` 或相关 registry YAML，再由 Generator 生成 `protocol/axtp.protocol.yaml` 和 `docs/generated/*`。

当前 generated 协议没有 adopted `device.info` 方法；本文中的方法名和字段均为草案候选，数值 ID 使用 `TBD after adoption`。

## 2. 业务需求

| 项 | 内容 |
|---|---|
| 需求来源 | `docs/flows/device-system-info.md`、设备信息管理需求、legacy device info / SetDeviceName 线索。 |
| 目标用户 | App / PC host / cloud console / device management service。 |
| 目标行为 | 连接后快速读取当前主设备是谁、是什么产品、运行什么 OS/软件/AXTP runtime，并允许在受控权限下修改显示名或资产标识。 |
| 当前实现程度 | Drafted only；`device.identity` 已合并到本文，不再保留独立草案。 |

## 3. Domain 边界

| 项 | 决策 |
|---|---|
| Domain | `device` |
| Feature | `device.info` |
| Capability | `device.info` |
| 负责 | 主设备 identity、product、hardware、os、software、runtime、capability modeling summary。 |
| 可写范围 | `displayName`、`assetName`、`assetTag` 等人工资产/显示字段，需权限控制。 |
| 不属于本文 | children/topology 属于 `device.childDevice`；CPU/内存属于 `system.state`；电源/电池/power off 属于 `system.power`；健康/温度属于 `system.health`；完整 capability 查询属于 `capability.registry`。 |

## 4. 协议决策

| 决策点 | 结论 | 理由 |
|---|---|---|
| 新增/修改/复用 | Modify existing draft | 复用 `device.info` capability，但替换配置型模板。 |
| 命名 | `device.getInfo` / `device.setInfoConfig` / `device.infoChanged` | `getInfo` 是信息型主查询；显示名和资产标识作为 config 子集写入。 |
| children 默认值 | 不返回 children | 子设备数量、状态和权限变化更频繁，独立到 `device.childDevice`。 |
| capability 摘要 | 保留轻量摘要 | 让调用方看到设备大体建模方式，但不替代完整能力查询。 |

## 5. 候选 Capability

| Capability | 状态 | 说明 |
|---|---|---|
| `device.info` | draft | 当前 endpoint 主设备信息和可写展示/资产标识。 |

## 6. 候选 Methods

| Method | Params Schema | Result Schema | 说明 | Review |
|---|---|---|---|---|
| `device.getInfo` | `GetDeviceInfoParams` | `DeviceInfo` | 读取当前 endpoint 主设备信息。默认返回 capability 建模摘要，不返回 children。 | `[REVIEW-OK]` |
| `device.setInfoConfig` | `SetDeviceInfoConfigParams` | `SetDeviceInfoConfigResult` | 修改可写显示名或资产标识；不得修改 `deviceId`、`serialNumber`、`vendorId`、`productId`。 | `[REVIEW-DRAFT]` |

## 7. 候选 Events

| Event | Schema | 触发时机 | Review |
|---|---|---|---|
| `device.infoChanged` | `DeviceInfoChangedEvent` | displayName、asset 字段、软件版本、runtime 版本或 capability modeling summary 变化。 | `[REVIEW-DRAFT]` |

## 8. 候选 Schemas

### `GetDeviceInfoParams`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `includeCapabilitySummary` | boolean | no | 是否返回轻量 capability 建模摘要；默认 `true`。 | `[REVIEW-DRAFT]` |

### `DeviceInfo`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `identity` | `DeviceIdentity` | yes | 设备稳定身份字段。 | `[REVIEW-OK]` |
| `product` | `DeviceProduct` | yes | 品牌、产品类型、型号和显示名。 | `[REVIEW-OK]` |
| `hardware` | `DeviceHardware` | no | 硬件修订、架构和内存摘要。 | `[REVIEW-DRAFT]` |
| `os` | `DeviceOs` | no | 操作系统类型、名称、版本和架构。 | `[REVIEW-DRAFT]` |
| `software` | `DeviceSoftware` | no | 设备上承载业务和 AXTP 的软件组件。 | `[REVIEW-DRAFT]` |
| `runtime` | `DeviceAxtpRuntime` | no | 当前 AXTP runtime 与 host app。 | `[REVIEW-DRAFT]` |
| `capability` | `DeviceCapabilitySummary` | no | 轻量建模摘要，不含完整方法/事件/权限表。 | `[REVIEW-DRAFT]` |

### `DeviceIdentity`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `deviceId` | string | yes | AXTP/业务系统使用的稳定设备 ID。 | `[REVIEW-ASK]` |
| `serialNumber` | string | no | 厂商序列号。 | `[REVIEW-DRAFT]` |
| `vendorId` | string | no | 厂商 ID，例如 `nearhub`。 | `[REVIEW-DRAFT]` |
| `productId` | string | no | 产品 ID，例如 `nh-win-box-a1`。 | `[REVIEW-DRAFT]` |
| `assetName` | string | no | 用户或组织维护的资产名称。 | `[REVIEW-DRAFT]` |
| `assetTag` | string | no | 用户或组织维护的资产标签。 | `[REVIEW-DRAFT]` |

### `DeviceProduct`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `brand` | string | no | 品牌。 | `[REVIEW-DRAFT]` |
| `productType` | string enum | yes | 产品类型，例如 `windowsDevice` / `androidDevice` / `embeddedDevice`。 | `[REVIEW-ASK]` |
| `model` | string | yes | 硬件或整机型号，不填软件名。 | `[REVIEW-OK]` |
| `displayName` | string | no | 用户可见设备名称，可通过 `device.setInfoConfig` 修改。 | `[REVIEW-DRAFT]` |

### `DeviceHardware`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `revision` | string | no | 硬件版本或修订号。 | `[REVIEW-DRAFT]` |
| `cpuArch` | string enum | no | CPU 架构，例如 `x86_64` / `arm64`。 | `[REVIEW-ASK]` |
| `memoryBytes` | uint64 | no | 物理内存容量。 | `[REVIEW-DRAFT]` |

### `DeviceOs`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `type` | string enum | yes | OS 类型，例如 `windows` / `android` / `linux` / `rtos`。 | `[REVIEW-ASK]` |
| `name` | string | no | OS 名称。 | `[REVIEW-DRAFT]` |
| `version` | string | no | OS 版本。 | `[REVIEW-DRAFT]` |
| `arch` | string enum | no | OS 架构。 | `[REVIEW-ASK]` |

### `DeviceSoftware`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `components` | `SoftwareComponent[]` | no | Launcher、Signage、Cast Receiver 等软件组件。 | `[REVIEW-DRAFT]` |

### `SoftwareComponent`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `id` | string | yes | 软件组件稳定 ID。 | `[REVIEW-DRAFT]` |
| `name` | string | no | 软件显示名。 | `[REVIEW-DRAFT]` |
| `version` | string | no | 软件版本。 | `[REVIEW-DRAFT]` |
| `role` | string enum | no | 角色，例如 `axtpHost` / `signagePlayer` / `castReceiver`。 | `[REVIEW-ASK]` |

### `DeviceAxtpRuntime`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `axtpRuntime` | string | no | AXTP runtime 名称。 | `[REVIEW-DRAFT]` |
| `axtpRuntimeVersion` | string | no | AXTP runtime 版本。 | `[REVIEW-DRAFT]` |
| `hostAppId` | string | no | 承载 AXTP 的 host app ID。 | `[REVIEW-DRAFT]` |

### `DeviceCapabilitySummary`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `profile` | string | no | 产品/设备建模 profile，例如 `windows-managed-device`。 | `[REVIEW-DRAFT]` |
| `domains` | string[] | no | 设备暴露的主要 domain 摘要。 | `[REVIEW-DRAFT]` |
| `features` | string[] | no | 设备暴露的主要 `domain.feature` 摘要。 | `[REVIEW-DRAFT]` |

### `SetDeviceInfoConfigParams`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `displayName` | string | no | 新显示名；空字符串是否允许需确认。 | `[REVIEW-ASK]` |
| `assetName` | string | no | 新资产名称。 | `[REVIEW-DRAFT]` |
| `assetTag` | string | no | 新资产标签。 | `[REVIEW-DRAFT]` |
| `expectedVersion` | string | no | 可选乐观锁版本，避免覆盖并发修改。 | `[REVIEW-DRAFT]` |

### `SetDeviceInfoConfigResult`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `info` | `DeviceInfo` | no | 修改后的设备信息快照。 | `[REVIEW-DRAFT]` |
| `changedFields` | string[] | no | 发生变化的字段路径。 | `[REVIEW-DRAFT]` |
| `version` | string | no | 配置版本或更新时间戳。 | `[REVIEW-DRAFT]` |

### `DeviceInfoChangedEvent`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `changedFields` | string[] | yes | 字段路径，例如 `product.displayName`。 | `[REVIEW-DRAFT]` |
| `info` | `DeviceInfo` | no | 变化后的完整或部分快照。 | `[REVIEW-DRAFT]` |
| `reason` | string enum | no | `user_update` / `software_update` / `runtime_update` / `capability_update`。 | `[REVIEW-ASK]` |

## 9. JSON 示例

示例只写 RPC `d` 数据块，不包裹外层 `sid` / `op` / `d` wire envelope。

### `device.getInfo` request

```json
{
  "id": 1,
  "method": "device.getInfo",
  "params": {
    "includeCapabilitySummary": true
  }
}
```

### `device.getInfo` response

```json
{
  "id": 1,
  "status": {
    "ok": true,
    "code": 0
  },
  "result": {
    "identity": {
      "deviceId": "dev_001",
      "serialNumber": "SN-REDACTED",
      "vendorId": "nearhub",
      "productId": "nh-win-box-a1"
    },
    "product": {
      "brand": "NearHub",
      "productType": "windowsDevice",
      "model": "NH-WIN-BOX-A1",
      "displayName": "NearHub Display Controller"
    },
    "hardware": {
      "revision": "A1",
      "cpuArch": "x86_64",
      "memoryBytes": 8589934592
    },
    "os": {
      "type": "windows",
      "name": "Windows 11 IoT Enterprise",
      "version": "10.0.22631",
      "arch": "x86_64"
    },
    "software": {
      "components": [
        {
          "id": "launcher",
          "name": "NearHub Launcher",
          "version": "1.2.3",
          "role": "axtpHost"
        }
      ]
    },
    "runtime": {
      "axtpRuntime": "axtp-ts-runtime",
      "axtpRuntimeVersion": "0.1.0",
      "hostAppId": "launcher"
    },
    "capability": {
      "profile": "windows-managed-device",
      "domains": ["device", "system"],
      "features": [
        "device.info",
        "device.childDevice",
        "system.state",
        "system.power",
        "system.health",
        "system.lifecycle"
      ]
    }
  }
}
```

### `device.setInfoConfig` request

```json
{
  "id": 2,
  "method": "device.setInfoConfig",
  "params": {
    "displayName": "Lobby Display Controller",
    "assetTag": "ASSET-REDACTED"
  }
}
```

### `device.setInfoConfig` response

```json
{
  "id": 2,
  "status": {
    "ok": true,
    "code": 0
  },
  "result": {
    "changedFields": ["product.displayName", "identity.assetTag"],
    "version": "2026-06-09T10:30:00Z"
  }
}
```

### `device.infoChanged` event

```json
{
  "event": "device.infoChanged",
  "intent": 1,
  "data": {
    "changedFields": ["product.displayName"],
    "reason": "user_update",
    "info": {
      "identity": {
        "deviceId": "dev_001"
      },
      "product": {
        "displayName": "Lobby Display Controller"
      }
    }
  }
}
```

### failure response

```json
{
  "id": 2,
  "status": {
    "ok": false,
    "code": 9,
    "msg": "Permission denied.",
    "details": {
      "candidateError": "DEVICE_INFO_PERMISSION_DENIED"
    }
  }
}
```

## 10. 候选 Errors

| Error | 类别 | 说明 | Review |
|---|---|---|---|
| `DEVICE_INFO_READ_FAILED` | device | 读取本机信息失败；JSON 示例可暂用 `INTERNAL_ERROR`。 | `[REVIEW-DRAFT]` |
| `DEVICE_INFO_PERMISSION_DENIED` | device | 无权修改显示名或资产字段；JSON 示例使用通用 `PERMISSION_DENIED`。 | `[REVIEW-DRAFT]` |
| `DEVICE_INFO_VERSION_CONFLICT` | device | `expectedVersion` 与当前版本不匹配；采纳时确认是否使用通用 `INVALID_STATE` 或新增业务错误。 | `[REVIEW-ASK]` |

## 11. Legacy 待映射

| 来源 | 旧协议条目 | 候选映射 | 状态 | 说明 |
|---|---|---|---|---|
| AXDP | `CommonGetEncryptedInfo` 等设备信息命令 | `device.getInfo` | `[REVIEW-ASK]` | 字段级映射和是否包含敏感加密信息需确认。 |
| Rooms | `GetDeviceInfo` / `GetDevInfo` / `GetSn` | `device.getInfo` | `[REVIEW-ASK]` | SN 和设备详情进入 `identity` / `product`。 |
| Rooms / Signage | `SetDeviceName` | `device.setInfoConfig` | `[REVIEW-ASK]` | 仅映射 displayName，不允许写入只读 identity。 |
| VM33 | `System.GetDevInfo` | `device.getInfo` | `[REVIEW-ASK]` | 旧 System namespace 不决定新 domain；按语义归 `device.info`。 |

## 12. Registry 草案输入

采纳本文后，domain YAML 至少应包含：

```yaml
capabilities:
  - id: device.info
    name: device.info capability
    status: draft
    methods:
      - device.getInfo
      - device.setInfoConfig
    events:
      - device.infoChanged

methods:
  - name: device.getInfo
    id: TBD after adoption
    bitOffset: TBD after adoption
    domain: device
    requestSchema: GetDeviceInfoParams
    responseSchema: DeviceInfo
    capabilities:
      - device.info
  - name: device.setInfoConfig
    id: TBD after adoption
    bitOffset: TBD after adoption
    domain: device
    requestSchema: SetDeviceInfoConfigParams
    responseSchema: SetDeviceInfoConfigResult
    capabilities:
      - device.info

events:
  - name: device.infoChanged
    id: TBD after adoption
    bitOffset: TBD after adoption
    domain: device
    eventSchema: DeviceInfoChangedEvent
    capabilities:
      - device.info
```

## 13. 采纳检查清单

- [ ] 08 已确认 `device.info` 合并 `device.identity` 的边界。
- [ ] 08 已确认 `product.model` 不承载软件名。
- [ ] 09/10 已确认 `device.getInfo` / `device.setInfoConfig` 的 methodId、bitOffset 和 schema。
- [ ] 11 已确认 `device.infoChanged` 的 eventId、eventMasks bitOffset 和触发策略。
- [ ] 12 已确认错误码复用或新增策略。
- [ ] 13 已确认 schema fieldId、capabilityId、profile summary 表达。
- [ ] 采纳时确认不再生成独立 `device.identity` capability，避免双写。

## 14. 待确认问题

1. `productType`、`os.type`、`cpuArch`、`software.components[].role` 的首批 enum 值是什么？
2. `displayName` 是否允许空字符串，长度限制和字符集是什么？
3. `assetName` / `assetTag` 是否需要进入 P0，还是只作为 P1 资产管理扩展？
4. `capability.profile` 是否来自 profiles registry，还是先作为产品 profile 字符串？
5. legacy 设备信息中是否包含敏感字段；如包含，是否应拆到 auth/vendor/diagnostic 域？
