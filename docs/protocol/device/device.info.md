# AXTP device.info 协议草案

版本：v0.5

归属域：`device`

Capability ID：`device.info`

适用范围：只读读取当前 AXTP endpoint 代表的主设备身份、产品、硬件、OS、软件、AXTP runtime 和轻量 capability 建模摘要。

---

## 协议审核标记（人工复核）

| 标记 | 条目 | 审核结论 | 后续动作 |
|---|---|---|---|
| `[REVIEW-OK]` | domain.feature | `device.info` 回答“这是谁”，属于 device 物理设备层；不把运行时状态、生命周期控制或健康判定混入本 capability。 | 可作为 `registry/domains/device/domain.yaml` 草案输入。 |
| `[REVIEW-OK]` | `device.identity` 合并 | 独立 `device.identity` 不再作为本 flow 的采纳目标；只读 ID/SN/vendor/product identity 与产品展示字段统一由 `device.info` 读取。 | 采纳时不要重新创建独立 `device.identity` 草案或 capability。 |
| `[REVIEW-OK]` | read-only scope | 本轮 `device.info` 只保留 `device.getInfo` 只读接口；不定义设备信息配置写入或信息变化事件。 | 有明确设备名/资产设置需求后另起草具体设置协议。 |
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
| 需求来源 | `docs/flows/device-system-info.md`、设备信息管理需求、legacy device info 线索。 |
| 目标用户 | App / PC host / cloud console / device management service。 |
| 目标行为 | 连接后快速读取当前主设备是谁、是什么产品、运行什么 OS/软件/AXTP runtime。 |
| 当前实现程度 | Drafted only；`device.identity` 已合并到本文，不再保留独立草案。 |

## 3. Domain 边界

| 项 | 决策 |
|---|---|
| Domain | `device` |
| Feature | `device.info` |
| Capability | `device.info` |
| 负责 | 主设备 identity、product、hardware、os、software、runtime、capability modeling summary。 |
| 写入范围 | 本轮无写入接口；`device.info` 是只读信息查询能力。 |
| 不属于本文 | children/topology 属于 `device.childDevice`；CPU/内存/运行态属于 `system.state`；关机/重启/计划任务属于 `system.lifecycle`；健康判定由业务端基于 `system.stateChanged` 自行实现；完整 capability 查询属于 `capability.registry`。 |

## 4. 协议决策

| 决策点 | 结论 | 理由 |
|---|---|---|
| 新增/修改/复用 | Modify existing draft | 复用 `device.info` capability，但替换配置型模板。 |
| 命名 | `device.getInfo` | `getInfo` 是信息型主查询；暂不引入配置写入方法或信息变化事件。 |
| children 默认值 | 不返回 children | 子设备数量、状态和权限变化更频繁，独立到 `device.childDevice`。 |
| capability 摘要 | 保留轻量摘要 | 让调用方看到设备大体建模方式，但不替代完整能力查询。 |
| 设备名/资产设置 | Deferred | 有具体设置需求、权限模型和变化通知需求后另起草协议，不预占 `device.info` 写接口。 |

## 5. 候选 Capability

| Capability | 状态 | 说明 |
|---|---|---|
| `device.info` | draft | 当前 endpoint 主设备只读信息。 |

## 6. 候选 Methods

| Method | Params Schema | Result Schema | 说明 | Review |
|---|---|---|---|---|
| `device.getInfo` | `GetDeviceInfoParams` | `DeviceInfo` | 读取当前 endpoint 主设备信息。默认返回 capability 建模摘要，不返回 children。 | `[REVIEW-OK]` |

## 7. 候选 Events

本轮不定义 `device.info` 事件。信息变化通知暂不需要；如果未来出现设备名、资产标识、软件版本或 capability 变化通知需求，应基于具体业务场景另行起草事件。

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

### `DeviceProduct`

| Field | Type | Required | 说明 | Review |
|---|---|---:|---|---|
| `brand` | string | no | 品牌。 | `[REVIEW-DRAFT]` |
| `productType` | string enum | yes | 产品类型，例如 `windowsDevice` / `androidDevice` / `embeddedDevice`。 | `[REVIEW-ASK]` |
| `model` | string | yes | 硬件或整机型号，不填软件名。 | `[REVIEW-OK]` |
| `displayName` | string | no | 用户可见设备名称；本轮仅只读返回，不提供写入接口。 | `[REVIEW-DRAFT]` |

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
        "system.lifecycle"
      ]
    }
  }
}
```

### failure response

```json
{
  "id": 1,
  "status": {
    "ok": false,
    "code": 13,
    "msg": "Read device info failed.",
    "details": {
      "candidateError": "DEVICE_INFO_READ_FAILED"
    }
  }
}
```

## 10. 候选 Errors

| Error | 类别 | 说明 | Review |
|---|---|---|---|
| `DEVICE_INFO_READ_FAILED` | device | 读取本机信息失败；JSON 示例可暂用 `INTERNAL_ERROR`。 | `[REVIEW-DRAFT]` |

## 11. Legacy 待映射

| 来源 | 旧协议条目 | 候选映射 | 状态 | 说明 |
|---|---|---|---|---|
| AXDP | `CommonGetEncryptedInfo` 等设备信息命令 | `device.getInfo` | `[REVIEW-ASK]` | 字段级映射和是否包含敏感加密信息需确认。 |
| Rooms | `GetDeviceInfo` / `GetDevInfo` / `GetSn` | `device.getInfo` | `[REVIEW-ASK]` | SN 和设备详情进入 `identity` / `product`。 |
| Rooms / Signage | `SetDeviceName` | out of current draft / future setting protocol | `[REVIEW-OK]` | 本轮不映射到 `device.info`；有明确设置需求后另起草设备名或资产设置协议。 |
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

methods:
  - name: device.getInfo
    id: TBD after adoption
    bitOffset: TBD after adoption
    domain: device
    requestSchema: GetDeviceInfoParams
    responseSchema: DeviceInfo
    capabilities:
      - device.info
```

## 13. 采纳检查清单

- [ ] 08 已确认 `device.info` 合并 `device.identity` 的边界。
- [ ] 08 已确认 `product.model` 不承载软件名。
- [ ] 09/10 已确认 `device.getInfo` 的 methodId、bitOffset 和 schema。
- [ ] 12 已确认错误码复用或新增策略。
- [ ] 13 已确认 schema fieldId、capabilityId、profile summary 表达。
- [ ] 采纳时确认不再生成独立 `device.identity` capability，避免双写。

## 14. 待确认问题

1. `productType`、`os.type`、`cpuArch`、`software.components[].role` 的首批 enum 值是什么？
2. `capability.profile` 是否来自 profiles registry，还是先作为产品 profile 字符串？
3. legacy 设备信息中是否包含敏感字段；如包含，是否应拆到 auth/vendor/diagnostic 域？
4. legacy `SetDeviceName` 是否只保留在旧 adapter，还是未来另起草设备名设置协议？
