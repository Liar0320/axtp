# AXTP firmware.update 协议草案

版本：v0.3

归属域：`firmware`

Capability ID：`firmware.update`

数据面：`stream`，默认 Stream Profile 为 `firmware.update`。`file.transfer` 可作为文件暂存模式的后续扩展。

适用范围：设备固件升级、Bootloader 升级、资源包升级、模型升级、多文件固件更新、分批次固件更新、PC 本地包升级和远程 URL 升级到 AXTP 的语义映射。P0 以设备策略驱动的顺序传输、md5 校验和设备自动重启为基线；断点续传、乱序补传、多文件并行、A/B 确认、回滚、sha256 和签名作为后续扩展保留。

---

## 协议审核标记（人工复核）

| 标记 | 条目 | 审核结论 | 本文处理 |
|---|---|---|---|
| `[REVIEW-OK]` | `firmware.update` capability | 固件更新控制面归 `firmware.update`，大文件数据面复用 `stream`，符合 domain-feature 规则；空中升级/USB/URL 只是升级来源或传输模式。 | 保留为本文唯一 capability，明确 `firmware` 只负责升级业务流程。 |
| `[REVIEW-OK]` | `firmware.beginUpdate` / `firmware.commitUpdateBatch` / `firmware.verifyUpdatePackage` / `firmware.installUpdate` | 会话创建、批次提交、校验、安装拆分合理。 | 补齐方法语义、请求/响应字段、状态机和错误策略，可作为 domain YAML 草案输入。 |
| `[REVIEW-FIX]` | file 域依赖 | 旧文档把 `file.beginUpload` / `file.completeUpload` 当成已定稿方法，但当前 `file.transfer` 仍未正式重写。 | P0 改为 `firmware.beginUpdate` 直接创建 `firmware.update` STREAM；`file.*` 只作为 P1 暂存文件模式，占位方法名不得直接进入稳定 registry。 |
| `[REVIEW-ASK]` | AXDP Alpha/Beta/Ex upgrade | `AlphaUpgradeInfo/Data`、`BetaStart/Stop/UpgradeInfo/Data/Ex` 可映射到固件更新流程，但旧包格式、分片 ACK、校验字段仍需设备侧确认。 | 补充 legacy 字段候选映射；标为 adapter-only 或待确认，不直接写入稳定 `legacyRefs`。 |
| `[REVIEW-FIX]` | AXDP `CommonSetNoTargetStrategyState` / `CommonGetNoTargetStrategyState` | 名称和源码行为不像固件更新。 | 从固件更新稳定映射中排除；后续优先迁到 `misc.*`、`video.framing`、`audio.algorithm` 或 vendor/diagnostic。 |
| `[REVIEW-ASK]` | Rooms / VM33 / Signage 远程升级 | 旧协议有 URL 触发升级和进度查询。 | 通过 `firmware.beginUpdate.source.type=url` 覆盖，不新增 `firmware.upgradeByUrl` 作为首选方法。 |
| `[REVIEW-OK]` | P0 校验和安全基线 | 生产包不强制签名，本流程 P0 只使用 `md5` 做完整性校验。 | `FirmwareUpdateManifest`、`getUpdateCapabilities`、`verifyUpdatePackage` 和 JSON 示例均按 md5 更新；`sha256` / `signature` 保留为扩展能力。 |
| `[REVIEW-OK]` | 多文件安装顺序 | 多文件包可包含 bootloader、application、resource、model 或 vendor；安装顺序由设备策略决定，不由 manifest 文件顺序或 `installOrder` 决定。 | 新增设备策略相关字段候选，移除 P0 `installOrder` 语义；设备策略如何版本化仍需确认。 |
| `[REVIEW-OK]` | 重启策略 | 安装后需要重启时由设备自动重启，Host 只等待断连和重连。 | P0 不依赖 `system.reboot`；`installUpdate` 返回 `autoReboot=true` / `requiresReboot=true`。 |
| `[REVIEW-OK]` | 传输复杂度 | P0 不要求断点续传、乱序补传或多文件并行传输。 | `getUpdateTransferState`、`missingRanges`、`resumeToken`、parallel streams 均标记为 P1/reserved。 |

---

## 1. 文档定位

`firmware.update` 定义固件更新的业务控制面。这里的 update 是能力名，覆盖 PC 本地包、URL 下载、传统空中升级、单文件、多文件和 A/B 回滚等升级形态。它回答：

1. 设备是否支持固件更新，以及支持哪些升级模式。
2. 本次升级的 manifest、目标版本、目标文件、设备策略和 md5 校验是什么。
3. 如何创建固件更新会话并绑定 STREAM 数据面。
4. 如何提交已传输的数据批次。
5. 如何校验、安装和处理设备自动重启。
6. 如何查询状态、进度，并为后续断点续传预留字段。
7. 如何把旧 Alpha/Beta/Rooms/VM33/Signage 升级语义迁移到 AXTP。

本方案是业务协议方案和人工评审输入。采纳后，稳定事实必须写入 `registry/domains/firmware/domain.yaml` 或对应 registry YAML，并由 Generator 生成 `protocol/axtp.protocol.yaml` 和 `docs/generated/*`。本文不直接分配新的 numeric methodId、eventId 或 fieldId；数值以 registry/generated 为准。

Stage 20 决策：Modify existing draft。当前实现程度为 Drafted only；`registry/**`、`protocol/axtp.protocol.yaml` 和 `docs/generated/**` 尚未采纳 `firmware.update` 业务方法、事件和 schema。

当前 generated contract 不包含固件更新业务方法；旧 MVP 名称 `firmware.begin` / `firmware.end` / `firmware.verify` / `firmware.apply` 只作为迁移输入和命名对照。本文采用 Naming/Methods/Profiles specs 规范中评审后的明确命名：

| 本文推荐方法 | 旧 MVP / legacy 对照名 | 兼容说明 |
|---|---|---|
| `firmware.beginUpdate` | `firmware.begin` | 创建固件更新会话并返回 `streamId` / `transferId`。 |
| `firmware.commitUpdateBatch` | `firmware.end` | 旧单镜像流程中可表示数据发送完成；新协议扩展为多文件/分批提交。 |
| `firmware.verifyUpdatePackage` | `firmware.verify` | 校验完整镜像或多文件包。 |
| `firmware.installUpdate` | `firmware.apply` | 应用已校验的固件更新包。 |
| `firmware.updateProgressReported` | `firmware.updateProgress` | 新事件命名更明确。 |
| `firmware.updateStateChanged` / `firmware.updateResultReported` | `firmware.updateCompleted` / `firmware.updateFailed` | 当前完成/失败事件可由新状态/结果事件兼容表达。 |

落 registry 时必须以已通过草案为准；不得因为旧 MVP 名称存在过，就在未评审 schema 的情况下重新生成固件更新方法。

---

## 2. 域边界

`firmware.update` 负责：

```text
固件和固件更新能力查询
update manifest 接收和校验
固件更新会话创建
STREAM 上下文绑定
多文件升级包管理
分批次提交
传输状态和断点续传查询
文件 md5、整包 md5 校验
安装、slot 切换、设备自动重启需求表达
A/B 启动后确认（P1 预留）
回滚（P1 预留）
取消和清理
状态、进度、结果事件
```

不属于 `firmware.update` 的内容：

| 内容 | 归属建议 | 说明 |
|---|---|---|
| STREAM 帧、`streamId`、`seqId`、`cursor`、ACK、窗口、resume | `stream` / transport runtime | `firmware.update` 只创建和绑定业务流。 |
| 通用文件上传下载能力 | `file.transfer` | file 域未定稿前，本文仅引用暂存文件模式的占位方法名。 |
| 通用设备重启 | `system.lifecycle` / 设备内部策略 | 本流程 P0 由设备自动重启；Host 不调用 `system.reboot`。 |
| 网络连接、代理、DNS、证书安装 | `network` / `auth` | URL 升级只声明来源，不管理网络基础设施。 |
| 产测擦写、工厂校准、license 写入 | `diagnostic.*` / `vendor.*` / `auth.license` | 不混入通用固件更新。 |
| 升级策略配置，例如自动检查、静默窗口 | `firmware.updatePolicy` | 与一次固件更新会话不同。 |
| 无目标策略、跟踪策略、算法行为配置 | 待确认 | `CommonSet/GetNoTargetStrategyState` 不进入 `firmware.update`。 |

核心原则：

```text
firmware 负责“升级什么、如何校验、什么时候安装和是否自动重启”。
stream 负责“字节如何可靠传输”。
file 只在暂存文件模式中负责“文件如何上传或下载”。
system 不参与本流程 P0 的主动重启；若未来需要 Host 控制重启，应另走 system lifecycle 草案。
```

---

## 3. 术语

| 名称 | 类型 | 说明 |
|---|---|---|
| `updateSessionId` | string | 一次固件更新业务会话 ID，业务层查询、取消、确认、回滚都使用它。 |
| `transferId` | uint32 | 兼容旧单镜像流程和 Binary/TLV 的传输 ID，可与 `streamId` 绑定。 |
| `streamId` | uint32 | STREAM 数据通道 ID，由 `firmware.beginUpdate` 返回。 |
| `packageId` | string | 固件更新包 ID，可由服务端或客户端生成。 |
| `manifest` | object | 固件更新包描述，包含版本、文件、hash、目标和设备策略信息。 |
| `fileId` | string | manifest 内的文件 ID，例如 `app`、`bootloader`、`resources`。 |
| `uploadedFileId` | string | 通过 file 域暂存上传后生成的文件 ID。仅用于 file 暂存模式。 |
| `batchId` | string | 一次批次提交 ID，在同一 `updateSessionId` 内唯一。 |
| `cursor` | uint64 | 某个文件或 stream 当前连续接收的字节偏移。 |
| `missingRanges` | array | P1 预留缺失范围，用于断点续传或乱序补传。 |
| `devicePolicyId` / `devicePolicyVersion` | string | `[REVIEW-ASK]` 设备策略标识和版本，用于 Host 按设备策略解析或排序多文件包。 |
| `target` | enum | 写入目标，例如 `application`、`bootloader`、`resource`。 |
| `state` | enum | 固件更新会话状态。 |
| `phase` | enum | 固件更新当前阶段，比 `state` 更细。 |
| `resumeToken` | bytes/string | P1 可选断点续传 token，由设备生成并校验。 |

---

## 4. 核心接口

| 类型 | 名称 | 分级 | 说明 |
|---|---|---|---|
| capability | `firmware.update` | P0 | 固件更新能力块。 |
| method | `firmware.getUpdateCapabilities` | P0 | 查询固件更新详细能力、设备策略、hash 算法、自动重启和扩展能力。 |
| method | `firmware.beginUpdate` | P0 | 创建固件更新会话，校验 manifest，绑定 `firmware.update` STREAM 或 URL 下载任务。 |
| method | `firmware.commitUpdateBatch` | P0 | 提交已传输的文件、范围或暂存文件。 |
| method | `firmware.verifyUpdatePackage` | P0 | 校验文件 md5 和整包 md5。 |
| method | `firmware.installUpdate` | P0 | 安装已校验的固件更新包。 |
| method | `firmware.getUpdateState` | P1 | 查询固件更新业务状态。 |
| method | `firmware.getUpdateTransferState` | P1 | 预留查询每个文件的接收进度和缺失范围，用于断点续传扩展。 |
| method | `firmware.cancelUpdate` | P1 | 取消未进入不可中断阶段的固件更新。 |
| method | `firmware.confirmUpdate` | P1 | A/B 或可回滚系统在新版本启动后确认成功。 |
| method | `firmware.rollbackUpdate` | P1 | 回滚到上一个可用版本。 |
| method | `firmware.getInfo` | P1 | 查询固件详细版本信息；采纳前继续使用旧业务协议或设备现有接口。 |
| event | `firmware.updateProgressReported` | P0 | 周期性进度上报。 |
| event | `firmware.updateStateChanged` | P0 | 状态变化通知。 |
| event | `firmware.updateResultReported` | P1 | 成功、失败、回滚等最终结果通知。 |

P2 兼容方法 `firmware.uploadUpdateChunk` 仅用于极低端设备或 legacy adapter，默认不得作为新实现首选。

---

## 5. 数据面模式

### 5.1 P0：firmware.update STREAM

P0 推荐流程：

```text
firmware.beginUpdate
STREAM packets, profile=firmware.update
firmware.commitUpdateBatch
firmware.verifyUpdatePackage
firmware.installUpdate
device auto reboot, if required
firmware.getInfo after reconnect
```

`firmware.beginUpdate` 返回 `streamId` 后，固件数据通过 STREAM payload 传输。STREAM 包只携带通用数据面字段：

```json
{
  "streamId": 33,
  "seqId": 0,
  "cursor": 0,
  "payload": "base64:AAAA..."
}
```

业务字段不得塞进 STREAM header，例如 `imageType`、`totalSize`、`md5`、`fileId`、`chunkCrc32`。这些信息必须来自 `manifest`、Stream Context 或可选 profile trailer。

STREAM 与固件更新文件的绑定方式由 `beginUpdate` 响应声明：

| `streamLayout` | 说明 | 适用场景 |
|---|---|---|
| `file` | 每个 `fileId` 绑定一个独立 `streamId`，STREAM payload 只属于该文件。 | 多文件固件更新的推荐模式。 |
| `package` | 单个 `streamId` 传输一个完整 package blob，manifest 中每个文件必须声明 `packageOffset` 和 `size`，设备按范围切分。 | 已有打包格式或 URL 下载模式。 |
| `single_image` | 单个 `streamId` 只对应一个固件镜像。 | 旧 `firmware.begin/end/verify/apply` 兼容。 |

多文件固件更新不得依赖 STREAM 包里的 `fileId`。如果使用 `streamLayout=file`，`fileId` 与 `streamId` 的绑定来自 `beginUpdate.result.streams[]`；如果使用 `streamLayout=package`，文件归属来自 manifest 中的 `packageOffset`。

### 5.2 P1：file 暂存模式

当设备需要先把升级文件暂存在文件系统中，再由 firmware 域绑定安装时，可以使用 file 暂存模式：

```text
firmware.beginUpdate(transferMode=file)
file.beginUpload, draft placeholder
STREAM packets, profile=file.transfer
file.completeUpload, draft placeholder
firmware.commitUpdateBatch(uploadedFileId)
firmware.verifyUpdatePackage
firmware.installUpdate
```

由于 `file.transfer` 文档当前仍是 review blocker，本文中的 `file.beginUpload` / `file.completeUpload` 只表示未来 file 域应提供的能力，不是当前稳定 wire 合同。正式落地前必须先完成 `docs/protocol/file/file.transfer.md` 重写并同步 registry。

### 5.3 P1：URL 远程升级

Rooms、VM33、Signage 的旧 `RemoteUpgrade` / `CloudUpgrade` 可映射为：

```json
{
  "id": 2001,
  "method": "firmware.beginUpdate",
  "params": {
    "packageId": "pkg_remote_001",
    "targetVersion": "2.3.0",
    "transferMode": "url",
    "source": {
      "type": "url",
      "url": "https://example.com/firmware.bin",
      "hash": {
        "algorithm": "md5",
        "value": "d41d8cd98f00b204e9800998ecf8427e"
      }
    },
    "manifest": {
      "schemaVersion": 1,
      "files": [
        {
          "fileId": "app",
          "target": "application",
          "name": "firmware.bin",
          "size": 8388608,
          "hash": {
            "algorithm": "md5",
            "value": "d41d8cd98f00b204e9800998ecf8427e"
          },
          "required": true
        }
      ]
    }
  }
}
```

URL 模式下设备负责下载，但 firmware 域不负责配置网络。设备必须仍按 manifest 做 md5 校验；不得只因为 URL 可信就跳过校验。`sha256` 和签名可以作为 P1/P2 扩展能力，但不是本流程 P0 要求。

---

## 6. Manifest

`manifest` 是固件更新包的核心描述。第一版 schema 基线：

```json
{
  "schemaVersion": 1,
  "packageId": "pkg_2026_0602_001",
  "targetVersion": "2.3.0",
  "minCurrentVersion": "2.0.0",
  "maxCurrentVersion": "2.2.x",
  "allowDowngrade": false,
  "productIds": ["nearhub-room"],
  "hardwareRevisions": ["revA", "revB"],
  "devicePolicyId": "fw-policy-nearhub-room",
  "devicePolicyVersion": "2026.06",
  "installOrderSource": "device_policy",
  "files": [
    {
      "fileId": "bootloader",
      "target": "bootloader",
      "imageType": "bootloader",
      "name": "bootloader.bin",
      "size": 262144,
      "required": true,
      "hash": {
        "algorithm": "md5",
        "value": "d41d8cd98f00b204e9800998ecf8427e"
      }
    },
    {
      "fileId": "app",
      "target": "application",
      "imageType": "main",
      "name": "app.bin",
      "size": 8388608,
      "required": true,
      "hash": {
        "algorithm": "md5",
        "value": "d41d8cd98f00b204e9800998ecf8427e"
      }
    },
    {
      "fileId": "resources",
      "target": "resource",
      "name": "resources.bin",
      "size": 5242880,
      "required": false,
      "hash": {
        "algorithm": "md5",
        "value": "d41d8cd98f00b204e9800998ecf8427e"
      }
    }
  ],
  "packageHash": {
    "algorithm": "md5",
    "value": "d41d8cd98f00b204e9800998ecf8427e"
  },
  "installPlan": {
    "partitionScheme": "ab",
    "targetSlot": "device_policy",
    "rebootPolicy": "auto",
    "confirmRequired": false,
    "rollbackAllowed": false
  }
}
```

字段规则：

| 字段 | 必填 | 说明 |
|---|---|---|
| `schemaVersion` | 是 | Manifest schema 版本。 |
| `packageId` | 推荐 | 与 `beginUpdate.params.packageId` 必须一致；缺省时由外层提供。 |
| `targetVersion` | 是 | 升级目标版本。 |
| `minCurrentVersion` / `maxCurrentVersion` | 可选 | 当前版本约束。 |
| `allowDowngrade` | 可选 | 默认 `false`。设备有 anti-rollback fuse 时必须拒绝非法降级。 |
| `productIds` / `hardwareRevisions` | 推荐 | 兼容性约束。 |
| `devicePolicyId` / `devicePolicyVersion` | 推荐 | `[REVIEW-ASK]` Host 与设备确认多文件解析和安装策略版本，避免策略不一致。 |
| `installOrderSource` | 推荐 | P0 固定为 `device_policy`；manifest 文件顺序和 `installOrder` 不作为安装顺序事实。 |
| `files[]` | 是 | 至少一个文件。 |
| `packageHash` | 推荐 | 整包 hash，适用于打包格式或组合文件。 |
| `signature` | 可选扩展 | 本流程 P0 不要求签名；若后续 capability 声明 `requiresSignature=true`，再作为 P1/P2 安全能力采纳。 |
| `installPlan` | 推荐 | slot、自动重启、确认和回滚策略；P0 使用设备策略和自动重启。 |

`files[]` 规则：

1. `fileId` 在同一 `updateSessionId` 内必须唯一。
2. 每个 required 文件必须声明 `size` 和 `hash`。
3. `target` 枚举为 `bootloader`、`application`、`resource`、`model`、`filesystem`、`config`、`recovery`、`vendor`。
4. `hash.algorithm` P0 必须支持 `md5`；`sha256` 可作为后续扩展能力。
5. 多文件安装顺序由设备策略决定；manifest 不应把 `installOrder` 作为 P0 安装顺序事实。
6. `streamLayout=package` 时，每个文件必须声明 `packageOffset`，且 `packageOffset + size` 不得越过 package 大小。
7. 若后续启用 `signature`，签名必须覆盖 manifest 中影响安装和校验的字段。
8. manifest 校验失败时，`beginUpdate` 必须返回错误，不得创建可安装会话。

---

## 7. 能力查询

### 7.1 firmware.getInfo

用途：查询固件详细版本和分区信息。

```json
{
  "id": 2101,
  "method": "firmware.getInfo",
  "params": {}
}
```

```json
{
  "id": 2101,
  "status": {
    "ok": true,
    "code": 0
  },
  "result": {
    "currentVersion": "2.2.1",
    "buildId": "20260602.001",
    "buildTime": "2026-06-02T10:00:00Z",
    "hardwareRevision": "revA",
    "productId": "nearhub-room",
    "bootloaderVersion": "1.1.0",
    "partitionScheme": "ab",
    "activeSlot": "a",
    "inactiveSlot": "b",
    "lastUpdateState": "confirmed",
    "lastUpdateVersion": "2.2.1"
  }
}
```

`firmware.getInfo` 采纳前，客户端应继续使用旧业务协议或设备现有接口获取基础固件版本。

### 7.2 firmware.getUpdateCapabilities

用途：查询固件更新的细粒度能力。

```json
{
  "id": 2102,
  "method": "firmware.getUpdateCapabilities",
  "params": {}
}
```

```json
{
  "id": 2102,
  "status": {
    "ok": true,
    "code": 0
  },
  "result": {
    "supported": true,
    "transferModes": ["stream", "url"],
    "streamProfiles": ["firmware.update"],
    "defaultStreamProfile": "firmware.update",
    "streamLayouts": ["single_image", "file", "package"],
    "defaultStreamLayout": "file",
    "ackModes": ["stop_and_wait", "sliding_window"],
    "supportsManifest": true,
    "requiresManifest": true,
    "supportsMultiFile": true,
    "supportsBatchCommit": true,
    "supportsResume": false,
    "supportsMissingRanges": false,
    "supportsParallelTransfer": false,
    "supportsUrlSource": true,
    "supportsRollback": false,
    "supportsConfirm": false,
    "requiresSignature": false,
    "requiresReboot": true,
    "autoReboot": true,
    "installOrderSource": "device_policy",
    "devicePolicyId": "fw-policy-nearhub-room",
    "devicePolicyVersion": "2026.06",
    "partitionSchemes": ["single", "ab"],
    "targets": ["bootloader", "application", "resource", "model", "vendor"],
    "maxFileCount": 16,
    "maxPackageSize": 268435456,
    "maxFileSize": 134217728,
    "preferredChunkSize": 65536,
    "maxChunkSize": 262144,
    "maxWindowSize": 8,
    "hashAlgorithms": ["md5"],
    "signatureAlgorithms": []
  }
}
```

规则：

1. `streamProfiles` 中 P0 必须包含 `firmware.update`。
2. `file.transfer` 只有在 file 域定稿并被设备实现时才出现在能力中。
3. 本流程 P0 使用 `md5` 做完整性校验；`sha256` 和签名作为扩展能力，不在 P0 里要求。
4. `streamLayouts` 声明 `streamId` 与 `fileId` 或 package offset 的绑定方式。
5. `installOrderSource=device_policy` 表示设备决定多文件安装顺序；Host 只能按设备策略解析或拆分下发。
6. `supportsResume=false` / `supportsMissingRanges=false` / `supportsParallelTransfer=false` 表示 P0 不要求断点续传、乱序补传或多文件并行；后续可通过 capability 打开。
7. 若未来 `requiresSignature=true`，manifest 缺少签名必须返回 `FW_VERIFY_FAILED` 或 `RPC_PARAM_MISSING`。

---

## 8. 固件更新会话创建

### 8.1 firmware.beginUpdate

用途：创建固件更新会话、校验 manifest、协商数据面。

```json
{
  "id": 2201,
  "method": "firmware.beginUpdate",
  "params": {
    "packageId": "pkg_2026_0602_001",
    "targetVersion": "2.3.0",
    "transferMode": "stream",
    "streamProfile": "firmware.update",
    "streamLayout": "file",
    "idempotencyKey": "host-req-001",
    "manifest": {
      "schemaVersion": 1,
      "targetVersion": "2.3.0",
      "devicePolicyId": "fw-policy-nearhub-room",
      "devicePolicyVersion": "2026.06",
      "installOrderSource": "device_policy",
      "files": [
        {
          "fileId": "app",
          "target": "application",
          "name": "app.bin",
          "size": 8388608,
          "required": true,
          "hash": {
            "algorithm": "md5",
            "value": "d41d8cd98f00b204e9800998ecf8427e"
          }
        }
      ]
    },
    "policy": {
      "installMode": "normal",
      "rebootPolicy": "auto",
      "allowDowngrade": false
    }
  }
}
```

成功响应：

```json
{
  "id": 2201,
  "status": {
    "ok": true,
    "code": 0
  },
  "result": {
    "updateSessionId": "upd_001",
    "transferId": 33,
    "packageId": "pkg_2026_0602_001",
    "state": "receiving",
    "phase": "receiving_files",
    "transferMode": "stream",
    "streamLayout": "file",
    "streamId": 33,
    "streamProfile": "firmware.update",
    "ackMode": "sliding_window",
    "cursorUnit": "byteOffset",
    "acceptedOffset": 0,
    "chunkSize": 65536,
    "windowSize": 4,
    "resumeSupported": false,
    "streams": [
      {
        "fileId": "app",
        "streamId": 33,
        "acceptedOffset": 0,
        "cursor": 0
      }
    ],
    "acceptedFiles": [
      {
        "fileId": "app",
        "streamId": 33,
        "target": "application",
        "size": 8388608,
        "cursor": 0,
        "complete": false
      }
    ]
  }
}
```

URL 模式响应可以不返回 `streamId`：

```json
{
  "id": 2202,
  "status": {
    "ok": true,
    "code": 0
  },
  "result": {
    "updateSessionId": "upd_remote_001",
    "packageId": "pkg_remote_001",
    "state": "downloading",
    "phase": "downloading_package",
    "transferMode": "url",
    "requiresClientUpload": false
  }
}
```

规则：

1. `beginUpdate` 只创建固件更新会话，不在 RPC request/response 中传输固件大块数据。
2. 设备必须校验 manifest 的结构、版本、硬件兼容性、大小上限、目标分区、设备策略版本和 md5 策略。
3. 同一设备同一时间默认只允许一个 active 固件更新；已有会话时返回 `FW_TRANSFER_ALREADY_STARTED` 或 `BUSY`。
4. `idempotencyKey` 相同且参数一致时，设备应返回同一个会话；参数不同必须返回 `ALREADY_EXISTS` 或 `INVALID_ARGUMENT`。
5. P0 不要求断点续传；若后续支持，`resumeToken` 只由创建它的设备解释，客户端不得伪造 token 内部结构。
6. `streamLayout=file` 时，设备必须在 `streams[]` 中返回每个 `fileId` 对应的 `streamId`。
7. `beginUpdate` 成功后，stream 模式进入 `receiving`，URL 模式进入 `downloading`。

---

## 9. 批次提交

### 9.1 firmware.commitUpdateBatch

用途：将已传输的数据范围或暂存文件绑定到固件更新会话。它表示“数据已提交给固件更新会话”，不表示校验通过，也不表示安装。

提交 STREAM 范围：

```json
{
  "id": 2301,
  "method": "firmware.commitUpdateBatch",
  "params": {
    "updateSessionId": "upd_001",
    "batchId": "batch_001",
    "files": [
      {
        "fileId": "app",
        "ranges": [
          {
            "offset": 0,
            "size": 1048576
          }
        ],
        "complete": false
      }
    ]
  }
}
```

提交暂存文件：

```json
{
  "id": 2302,
  "method": "firmware.commitUpdateBatch",
  "params": {
    "updateSessionId": "upd_001",
    "batchId": "batch_app_complete",
    "files": [
      {
        "fileId": "app",
        "uploadedFileId": "file_upload_app_001",
        "complete": true
      }
    ]
  }
}
```

响应：

```json
{
  "id": 2301,
  "status": {
    "ok": true,
    "code": 0
  },
  "result": {
    "updateSessionId": "upd_001",
    "batchId": "batch_001",
    "state": "batch_committed",
    "files": [
      {
        "fileId": "app",
        "receivedBytes": 1048576,
        "cursor": 1048576,
        "complete": false
      }
    ],
    "totalBytes": 8388608,
    "receivedBytes": 1048576,
    "progress": 12
  }
}
```

规则：

1. `batchId` 在同一 `updateSessionId` 内必须唯一。
2. 同一 `batchId` 重试且 payload 完全一致时必须幂等返回。
3. 同一 `batchId` 重试但 payload 不一致时必须返回 `ALREADY_EXISTS` 或 `INVALID_ARGUMENT`。
4. `files[].fileId` 必须存在于 manifest。
5. `ranges[]` 不得越过 manifest 声明的 `size`。
6. P0 按顺序写入，只接受从当前 `cursor` 开始的范围；乱序范围返回 `STREAM_OFFSET_INVALID` 或 `OUT_OF_RANGE`。
7. required 文件全部 `complete=true` 后才允许进入 `verifyUpdatePackage`。
8. 多文件固件更新必须按 `fileId` 独立维护 `cursor`、`receivedBytes` 和 `complete`；`missingRanges` 仅为 P1 续传扩展字段。

---

## 10. 传输状态和断点续传

### 10.1 firmware.getUpdateTransferState

用途：P1 预留查询接收状态，用于 UI 进度、重连恢复和缺失范围补传。P0 可以不实现该方法；传输中断时 Host 重试当前 chunk/file 或重新开始。

```json
{
  "id": 2401,
  "method": "firmware.getUpdateTransferState",
  "params": {
    "updateSessionId": "upd_001"
  }
}
```

```json
{
  "id": 2401,
  "status": {
    "ok": true,
    "code": 0
  },
  "result": {
    "updateSessionId": "upd_001",
    "state": "receiving",
    "streamLayout": "file",
    "streamId": 33,
    "streamProfile": "firmware.update",
    "resumeSupported": false,
    "files": [
      {
        "fileId": "app",
        "streamId": 33,
        "target": "application",
        "size": 8388608,
        "receivedBytes": 3145728,
        "cursor": 3145728,
        "complete": false
      }
    ],
    "totalBytes": 8388608,
    "receivedBytes": 3145728,
    "progress": 37
  }
}
```

断点续传规则（P1 预留）：

1. P0 不要求重连后续传、乱序补传或多文件并行。
2. 客户端重连后若设备 capability 声明 `supportsResume=true`，再调用 `getUpdateTransferState`。
3. 顺序写设备可从每个 `fileId.cursor` 继续发送；支持乱序补传的设备才返回 `missingRanges`。
4. `resumeToken` 必须和 `updateSessionId`、manifest hash、设备身份绑定。
5. 若设备重启后丢失固件更新临时状态，必须返回 `NOT_FOUND` 或 `FW_TRANSFER_NOT_STARTED`，客户端重新开始。
6. 不允许只用一个全局 cursor 表示多文件固件更新进度。

---

## 11. 校验和安装

### 11.1 firmware.verifyUpdatePackage

用途：校验文件大小、文件 md5 和整包 md5。

```json
{
  "id": 2501,
  "method": "firmware.verifyUpdatePackage",
  "params": {
    "updateSessionId": "upd_001",
    "scope": "all"
  }
}
```

```json
{
  "id": 2501,
  "status": {
    "ok": true,
    "code": 0
  },
  "result": {
    "updateSessionId": "upd_001",
    "state": "verified",
    "phase": "verifying_files",
    "files": [
      {
        "fileId": "app",
        "sizeVerified": true,
        "hashAlgorithm": "md5",
        "hashVerified": true
      }
    ],
    "packageHashVerified": true,
    "signatureVerified": null
  }
}
```

规则：

1. 每个 required 文件必须完成 size 和 hash 校验。
2. `packageHash` 存在时必须校验。
3. P0 不要求 `signature`；若后续 capability 要求签名，则必须校验。
4. 校验成功后进入 `verified`。
5. 校验失败不得安装，返回 `FW_SIZE_MISMATCH`、`FW_HASH_MISMATCH`、`FW_VERIFY_FAILED` 或 `FW_IMAGE_INVALID`。
6. 校验失败事件必须携带 `fileId`、`phase` 和错误码，方便 UI 和日志定位。

### 11.2 firmware.installUpdate

用途：安装已校验固件更新。

```json
{
  "id": 2502,
  "method": "firmware.installUpdate",
  "params": {
    "updateSessionId": "upd_001",
    "installMode": "normal",
    "rebootPolicy": "auto"
  }
}
```

```json
{
  "id": 2502,
  "status": {
    "ok": true,
    "code": 0
  },
  "result": {
    "updateSessionId": "upd_001",
    "state": "installing",
    "accepted": true,
    "installMode": "normal",
    "targetSlot": "b",
    "requiresReboot": true,
    "autoReboot": true,
    "confirmRequired": false
  }
}
```

`installMode` 枚举：

| 值 | 说明 |
|---|---|
| `normal` | 常规安装。 |
| `staged` | 只写入并准备，稍后再切换或自动重启。 |
| `recovery` | 进入 recovery 路径安装。 |
| `bootloader` | Bootloader 特殊安装路径；设备可限制权限。 |
| `apply_on_reboot` | 下次重启时应用。 |

规则：

1. `installUpdate` 只能在 `verified` 后调用。
2. 安装过程中通常不允许 `cancelUpdate`；设备支持安全中止时必须在 capability 中声明。
3. 需要重启时返回 `requiresReboot=true` 和 `autoReboot=true`，设备自动重启，Host 等待断连和重连。
4. A/B 系统可返回 `targetSlot` 和 `confirmRequired`；本流程 P0 不要求 Host 调用 `confirmUpdate`。
5. 写分区失败返回 `FW_APPLY_FAILED`，并在事件中给出失败 `phase`。
6. 安装完成但尚未重启时可进入 `reboot_required`。

---

## 12. 确认、回滚和取消

### 12.1 firmware.confirmUpdate

用途：A/B 或支持自动回滚的设备在新版本启动后确认升级成功。

```json
{
  "id": 2601,
  "method": "firmware.confirmUpdate",
  "params": {
    "updateSessionId": "upd_001"
  }
}
```

```json
{
  "id": 2601,
  "status": {
    "ok": true,
    "code": 0
  },
  "result": {
    "updateSessionId": "upd_001",
    "state": "confirmed",
    "currentVersion": "2.3.0",
    "activeSlot": "b",
    "rollbackAvailable": true
  }
}
```

规则：

1. `supportsConfirm=false` 时不提供该方法或返回 `NOT_SUPPORTED`。
2. confirm 成功后设备不得再因 watchdog 自动回滚该版本。
3. 如果 `updateSessionId` 在重启后不可用，设备可接受 `packageId` 或返回最近 pending confirmation 的状态，但 schema 必须在 registry 中明确。

### 12.2 firmware.rollbackUpdate

用途：回滚到上一个可用版本。

```json
{
  "id": 2602,
  "method": "firmware.rollbackUpdate",
  "params": {
    "updateSessionId": "upd_001",
    "reason": "user_request",
    "rebootPolicy": "auto"
  }
}
```

```json
{
  "id": 2602,
  "status": {
    "ok": true,
    "code": 0
  },
  "result": {
    "updateSessionId": "upd_001",
    "state": "rollback_scheduled",
    "targetVersion": "2.2.1",
    "requiresReboot": true,
    "autoReboot": true
  }
}
```

规则：

1. 仅 `supportsRollback=true` 时支持。
2. 没有可回滚版本时返回 `FW_ROLLBACK_FAILED` 或 `NOT_FOUND`。
3. 回滚可能需要重启；若设备声明 `autoReboot=true`，重启仍由设备自动执行。

### 12.3 firmware.cancelUpdate

用途：取消尚未进入不可中断阶段的固件更新会话。

```json
{
  "id": 2603,
  "method": "firmware.cancelUpdate",
  "params": {
    "updateSessionId": "upd_001",
    "reason": "user_request"
  }
}
```

```json
{
  "id": 2603,
  "status": {
    "ok": true,
    "code": 0
  },
  "result": {
    "updateSessionId": "upd_001",
    "state": "cancelled",
    "cleanupStarted": true
  }
}
```

规则：

1. `receiving`、`downloading`、`batch_committed`、`verifying`、`verified` 通常可以取消。
2. `installing`、`switching_slot`、`writing_bootloader` 通常不得取消，返回 `INVALID_STATE`。
3. cancel 后设备必须清理临时文件、关闭相关 stream 或下载任务。
4. `cancelUpdate` 不等于 `rollbackUpdate`；已安装的新版本需要回滚时必须走 rollback。
5. 底层异常释放可以使用 `stream.abort`，但 `stream.abort` 不替代 `cancelUpdate`。

---

## 13. 状态查询和状态机

### 13.1 firmware.getUpdateState

用途：查询固件更新会话整体状态。

```json
{
  "id": 2701,
  "method": "firmware.getUpdateState",
  "params": {
    "updateSessionId": "upd_001"
  }
}
```

```json
{
  "id": 2701,
  "status": {
    "ok": true,
    "code": 0
  },
  "result": {
    "updateSessionId": "upd_001",
    "packageId": "pkg_2026_0602_001",
    "state": "installing",
    "phase": "writing_application",
    "currentVersion": "2.2.1",
    "targetVersion": "2.3.0",
    "progress": 72,
    "requiresReboot": true,
    "startedAtMs": 1710000000000,
    "updatedAtMs": 1710000100000,
    "lastError": null
  }
}
```

### 13.2 状态枚举

| 状态 | 说明 |
|---|---|
| `idle` | 无固件更新任务。 |
| `preparing` | 正在准备升级或校验 manifest。 |
| `receiving` | 正在通过 STREAM 或 file 暂存模式接收固件更新数据。 |
| `downloading` | URL 模式下设备正在下载固件更新数据。 |
| `batch_committed` | 至少一个批次已提交。 |
| `verifying` | 正在校验文件 md5、整包 md5 或扩展签名。 |
| `verified` | 校验完成，可以安装。 |
| `installing` | 正在安装。 |
| `installed` | 安装完成，可能仍需重启。 |
| `reboot_required` | 需要重启后继续或生效。 |
| `confirming` | P1 正在确认新版本。 |
| `confirmed` | P1 新版本已确认。 |
| `rollback_scheduled` | P1 已计划回滚。 |
| `rolling_back` | P1 正在回滚。 |
| `cancelled` | 已取消。 |
| `failed` | 失败。 |

`unsupported` 不作为运行态状态；不支持能力时应返回 `NOT_SUPPORTED` 或 capability 中 `supported=false`。

### 13.3 phase 枚举

```text
receiving_manifest
receiving_files
downloading_package
committing_batch
verifying_files
verifying_package_hash
verifying_signature
writing_bootloader
writing_application
writing_resources
writing_model
switching_slot
waiting_reboot
confirming
rolling_back
cleanup
```

### 13.4 状态迁移

| From | To | 触发 |
|---|---|---|
| `idle` | `preparing` | `beginUpdate` 开始处理。 |
| `preparing` | `receiving` | stream/file 模式 manifest 通过。 |
| `preparing` | `downloading` | URL 模式 manifest 通过。 |
| `receiving` | `batch_committed` | `commitUpdateBatch` 成功。 |
| `downloading` | `batch_committed` | 设备下载完成并绑定文件。 |
| `batch_committed` | `verifying` | `verifyUpdatePackage` 开始。 |
| `verifying` | `verified` | 校验成功。 |
| `verified` | `installing` | `installUpdate` 开始。 |
| `installing` | `installed` | 写入完成。 |
| `installed` | `reboot_required` | 需要设备自动重启生效。 |
| `reboot_required` | `confirmed` | P0 重启后读取新版本成功，设备自确认或无需确认。 |
| `reboot_required` | `confirming` | P1 重启后调用 `confirmUpdate`。 |
| `confirming` | `confirmed` | P1 确认成功。 |
| `verified` / `installed` / `confirmed` | `rollback_scheduled` | P1 `rollbackUpdate` 被接受。 |
| `rollback_scheduled` | `rolling_back` | P1 回滚执行开始。 |
| 任意可取消状态 | `cancelled` | `cancelUpdate` 成功。 |
| 任意状态 | `failed` | 发生不可恢复错误。 |

---

## 14. 事件

### 14.1 firmware.updateProgressReported

周期性上报固件更新进度。周期性进度使用 `Reported`，不要使用 `Changed`。

```json
{
  "event": "firmware.updateProgressReported",
  "intent": 1,
  "data": {
    "updateSessionId": "upd_001",
    "transferId": 33,
    "state": "receiving",
    "phase": "receiving_files",
    "progress": 31,
    "totalBytes": 13631488,
    "receivedBytes": 4194304,
    "files": [
      {
        "fileId": "app",
        "receivedBytes": 3145728,
        "size": 8388608,
        "progress": 37
      }
    ],
    "timestampMs": 1710000010000
  }
}
```

规则：

1. `progress` 范围为 `0..100`。
2. 多文件固件更新应包含 `files[]` 进度。
3. receiving/downloading 阶段可按字节计算。
4. installing 阶段由设备按内部阶段计算。
5. 事件频率应受设备能力和 transport 限制，避免挤占固件更新数据面。

### 14.2 firmware.updateStateChanged

状态变化时上报。

```json
{
  "event": "firmware.updateStateChanged",
  "intent": 1,
  "data": {
    "updateSessionId": "upd_001",
    "transferId": 33,
    "oldState": "verified",
    "state": "installing",
    "phase": "writing_application",
    "progress": 72,
    "requiresReboot": false,
    "timestampMs": 1710000100000
  }
}
```

失败示例：

```json
{
  "event": "firmware.updateStateChanged",
  "intent": 1,
  "data": {
    "updateSessionId": "upd_001",
    "transferId": 33,
    "oldState": "verifying",
    "state": "failed",
    "phase": "verifying_files",
    "errorCode": 1034,
    "candidateError": "FW_HASH_MISMATCH",
    "message": "app.bin md5 mismatch",
    "fileId": "app",
    "timestampMs": 1710000100000
  }
}
```

### 14.3 firmware.updateResultReported

可选最终结果事件。MVP 可以只使用 `updateStateChanged` 表达完成和失败。

```json
{
  "event": "firmware.updateResultReported",
  "intent": 1,
  "data": {
    "updateSessionId": "upd_001",
    "transferId": 33,
    "result": "success",
    "newVersion": "2.3.0",
    "rebootRequired": true,
    "confirmed": false,
    "timestampMs": 1710000200000
  }
}
```

`result` 枚举：`success`、`failed`、`cancelled`、`rolled_back`。

---

## 15. 错误处理

错误码以 `registry/error/error_code.yaml` 为准。固件更新方法应优先使用已有 common、rpc、stream、firmware 错误码。

| 场景 | 推荐错误码 |
|---|---|
| 设备不支持固件更新、URL、rollback、confirm | `NOT_SUPPORTED` |
| 参数缺失或 manifest 格式错误 | `RPC_PARAM_MISSING` / `RPC_PARAM_INVALID` / `INVALID_ARGUMENT` |
| range 越界、cursor 非法 | `OUT_OF_RANGE` / `STREAM_OFFSET_INVALID` |
| 当前状态不允许操作 | `INVALID_STATE` |
| 已有固件更新会话 | `FW_TRANSFER_ALREADY_STARTED` / `BUSY` |
| 未找到固件更新会话 | `NOT_FOUND` / `FW_TRANSFER_NOT_STARTED` |
| required 文件未完整接收 | `STREAM_CHUNK_MISSING` / `FW_SIZE_MISMATCH` |
| 目标 imageType 不支持 | `FW_IMAGE_TYPE_UNSUPPORTED` |
| 版本不兼容、过旧或被 anti-rollback 拒绝 | `FW_VERSION_UNSUPPORTED` / `FW_VERSION_TOO_OLD` |
| 存储空间不足 | `FW_STORAGE_NOT_ENOUGH` / `RESOURCE_EXHAUSTED` |
| 分片 CRC 错误 | `FW_CHUNK_CRC_ERROR` / `STREAM_CRC_ERROR` |
| 文件大小不匹配 | `FW_SIZE_MISMATCH` |
| hash 不匹配 | `FW_HASH_MISMATCH` |
| 综合校验失败或扩展签名失败 | `FW_VERIFY_FAILED` |
| 安装失败 | `FW_APPLY_FAILED` |
| 回滚失败 | `FW_ROLLBACK_FAILED` |
| 设备温度、电量、供电等条件不满足 | `FW_DEVICE_NOT_READY` |
| 需要重启后继续 | `FW_REBOOT_REQUIRED` |

错误响应示例：

```json
{
  "id": 2501,
  "status": {
    "ok": false,
    "code": 1034,
    "message": "app.bin md5 mismatch",
    "details": {
      "candidateError": "FW_HASH_MISMATCH",
      "updateSessionId": "upd_001",
      "fileId": "app",
      "phase": "verifying_files",
      "hashAlgorithm": "md5",
      "expected": "d41d8cd98f00b204e9800998ecf8427e",
      "actual": "00000000000000000000000000000000"
    }
  }
}
```

文件未传完示例：

```json
{
  "id": 2301,
  "status": {
    "ok": false,
    "code": 1290,
    "message": "Update files are incomplete",
    "details": {
      "candidateError": "STREAM_CHUNK_MISSING",
      "updateSessionId": "upd_001",
      "files": [
        {
          "fileId": "app",
          "size": 8388608,
          "receivedBytes": 3145728,
          "cursor": 3145728,
          "complete": false
        }
      ]
    }
  }
}
```

---

## 16. 安全和可靠性规则

1. 本产品 P0 生产固件更新使用 `md5` 做对象完整性校验，不强制签名。
2. `sha256`、manifest 签名或整包签名是 P1/P2 扩展能力；如果 capability 要求签名，签名验证必须早于安装。
3. URL 模式 P0 必须要求 md5 hash；仅凭 HTTPS URL 不足以证明固件可信。
4. 设备必须检查目标版本、硬件版本、产品 ID、anti-rollback 计数器和分区兼容性。
5. Bootloader、recovery、vendor 分区升级应要求更高权限，可返回 `PERMISSION_DENIED`。
6. 固件更新临时文件应写入专用 staging 区，校验通过前不得覆盖当前可启动镜像。
7. A/B 设备安装后健康检查、确认和自动回滚是 P1 扩展；P0 可以由设备自确认或不暴露 confirm。
8. 断电恢复后设备必须能回到 `idle`、`receiving`、`reboot_required`、`confirmed` 或 `failed` 中的可解释状态。
9. 事件中的 `message` 不应泄露完整下载 URL token 或敏感路径；若启用签名扩展，也不得泄露签名私钥。
10. 传输层加密、用户认证和升级授权由 AXTP session/auth 或外部安全层提供，固件更新方法必须仍检查调用权限。

---

## 17. 多文件和多目标规则

多文件固件更新：

1. `manifest.files[]` 是唯一文件集合。
2. 每个 `fileId` 独立维护 size、hash、cursor、complete；`missingRanges` 仅为 P1 续传扩展。
3. `commitUpdateBatch` 可以提交一个或多个文件，也可以提交同一文件的多个范围。
4. `verifyUpdatePackage` 必须在所有 required 文件 complete 后才能成功。
5. 安装顺序由设备策略决定；manifest 文件顺序和 `installOrder` 不作为 P0 安装顺序事实。
6. Host 必须按设备策略解析多文件包，或按设备策略把多个包拆分/排序后下发；设备策略版本如何暴露仍为 `[REVIEW-ASK]`。

多目标固件更新是 P1 扩展，适用于一个主设备代理升级子设备或集群设备。推荐字段：

```json
{
  "targetDevices": [
    {
      "targetDeviceId": "local",
      "role": "main"
    },
    {
      "targetDeviceId": "sub-1",
      "role": "subdevice"
    }
  ]
}
```

规则：

1. `targetDevices` 缺省表示本地设备。
2. 多目标状态应在 `getUpdateState` 和事件中按 targetDeviceId 展开。
3. 旧 VM33 `SerialNumber` 和 `Destination` bitmask 可由 adapter 映射到 `targetDevices`，不得把旧 bitmask 直接暴露为新协议核心字段。

---

## 18. P2 兼容：firmware.uploadUpdateChunk

该方法仅用于不具备 STREAM 能力的 legacy 设备或非常受限的 bridge，不建议新设备实现。

```json
{
  "id": 2801,
  "method": "firmware.uploadUpdateChunk",
  "params": {
    "updateSessionId": "upd_001",
    "fileId": "app",
    "batchId": "batch_001",
    "chunkIndex": 0,
    "offset": 0,
    "data": "base64:AAAA...",
    "crc32": "0x12345678"
  }
}
```

```json
{
  "id": 2801,
  "status": {
    "ok": true,
    "code": 0
  },
  "result": {
    "updateSessionId": "upd_001",
    "fileId": "app",
    "batchId": "batch_001",
    "received": true,
    "nextOffset": 65536
  }
}
```

限制：

1. `data` 大小不得超过 RPC body 和 transport MTU 能承受的上限。
2. 该方法不得替代后续 `firmware.update` STREAM 数据面；Phase 1 已要求 audio/video STREAM 数据包，但不要求实现固件更新 STREAM profile。
3. 如果 registry 采纳该方法，必须单独声明 max chunk size、编码和错误码。

---

## 19. 完整流程

### 19.1 STREAM 固件更新

```text
1. Client -> firmware.getInfo；采纳前继续使用旧业务协议查询版本
2. Client -> firmware.getUpdateCapabilities
3. Client -> firmware.beginUpdate(manifest, transferMode=stream)
4. Device -> updateSessionId, streamId, transferId, chunkSize, autoReboot
5. Client -> STREAM firmware.update chunks
6. Client -> firmware.commitUpdateBatch(ranges or complete files)
7. Client -> firmware.getUpdateTransferState, optional P1 resume/polling extension
8. Client -> firmware.verifyUpdatePackage
9. Client -> firmware.installUpdate
10. Device -> firmware.updateStateChanged(reboot_required), if needed
11. Device -> auto reboot, if required
12. Client reconnect
13. Client -> firmware.getInfo；采纳前继续使用旧业务协议查询版本
14. Client -> firmware.confirmUpdate, optional P1 if supported
```

### 19.2 URL 固件更新

```text
1. Client -> firmware.getUpdateCapabilities
2. Client -> firmware.beginUpdate(source.type=url, manifest)
3. Device -> updateSessionId, state=downloading
4. Device -> firmware.updateProgressReported(downloading_package)
5. Client -> firmware.getUpdateState, optional polling
6. Client -> firmware.verifyUpdatePackage, unless device policy auto-verifies after download
7. Client -> firmware.installUpdate
8. Device auto reboots if needed; confirm is P1 optional
```

### 19.3 file 暂存固件更新

```text
1. Client -> firmware.beginUpdate(transferMode=file)
2. Client -> file.beginUpload, draft placeholder
3. Client -> STREAM file.transfer chunks
4. Client -> file.completeUpload, draft placeholder
5. Client -> firmware.commitUpdateBatch(uploadedFileId)
6. Client -> firmware.verifyUpdatePackage
7. Client -> firmware.installUpdate
```

该模式必须等待 file 域定稿后再进入稳定 registry。

---

## 20. Legacy 映射审查

以下表格用于人工审查旧协议与 `firmware.update` 的关联。标记为待确认的条目不得直接写入稳定 `legacyRefs`。

| Source | 旧命令/方法 | 旧 ID | 新协议候选 | 审查结论 |
|---|---|---|---|---|
| AXDP HID | `AlphaUpgradeInfo` | `0xA0001 / 0x0001 -> 0x0081` | `firmware.beginUpdate` | 可作为 adapter-only 映射。旧 `BlockInfo` 中 `flash_block` -> `target/imageType`，`slice_size` -> `chunkSizeHint`，`slices_total * slice_size` 或 `block_size` -> `size`，`md5` -> `hash(md5)`；字段细节需设备确认。 |
| AXDP HID | `AlphaUpgradeData` | `0xA0002 / 0x0002 -> 0x0082` | STREAM `firmware.update` + `commitUpdateBatch` | 可映射。旧 `slice_index` -> `seqId` 或 range offset，payload -> STREAM payload；成功/失败状态映射到 ACK 或固件更新事件，需确认。 |
| AXDP HID | `BetaStartUpgrade` | `0xB0003 / 0x0003 -> 0x0083` | `firmware.beginUpdate` preflight | 可映射为创建前 ready 检查或 beginUpdate 的准备阶段。 |
| AXDP HID | `BetaStopUpgrade` | `0xB0004 / 0x0004 -> 0x0084` | 待确认 | 旧名可能表示结束发送，也可能表示停止/取消。若表示正常结束，映射 `commitUpdateBatch` 或旧 `firmware.end`；若表示中止，映射 `cancelUpdate`。 |
| AXDP HID | `BetaUpgradeInfo` | `0xB0005 / 0x0005 -> 0x0085` | `firmware.beginUpdate` | 可作为 adapter-only 映射，字段同 `AlphaUpgradeInfo`。 |
| AXDP HID | `BetaUpgradeData` | `0xB0006 / 0x0006 -> 0x0086` | STREAM `firmware.update` + `commitUpdateBatch` | 可映射。旧 requested slice index 可映射到缺失 range 或 ACK/NACK。 |
| AXDP HID | `BetaUpgradeInfoEx` | `0xB0011 / 0x0011 -> 0x0091` | `firmware.beginUpdate` | 可映射。Ex 批量发送策略应映射为 window/sliding 或 batch commit，需确认。 |
| AXDP HID | `BetaUpgradeDataEx` | `0xB0012 / 0x0012 -> 0x0092` | STREAM `firmware.update` + `commitUpdateBatch` | 可映射。旧 `0xFFFFFFFF` 成功和 `0xFFFFEEEE` 失败应转换为标准错误和结果事件。 |
| AXDP HID | `CommonSetNoTargetStrategyState` | `0xC0119 / 0x0119 -> 0x0199` | 不进入 firmware.update | 源码 case 空、payload 不明确，名称不像升级。候选 `misc.set.noTargetStrategyState` 或其他业务域。 |
| AXDP HID | `CommonGetNoTargetStrategyState` | `0xC011A / 0x011A -> 0x019A` | 不进入 firmware.update | 同上。 |
| Rooms WS JSON | `RemoteUpgrade` | - | `firmware.beginUpdate(source.type=url)` | 可映射 URL 远程升级。 |
| Rooms WS JSON | `UpgradeProgress` | - | `firmware.getUpdateState` | 可映射进度查询。 |
| Signage SDK | `RemoteUpgrade` | `数字标牌设备管理通用管理命令:RemoteUpgrade` | `firmware.beginUpdate(source.type=url)` | 可映射 URL 远程升级。 |
| Signage SDK | `UpgradeProgress` | - | `firmware.getUpdateState` | 可映射进度查询。 |
| VM33 HTTP JSON | `Upgrade.Setup` | - | `firmware.beginUpdate` | 可映射 multipart 升级准备，`Total` -> file size，`Md5` -> legacy hash。 |
| VM33 HTTP JSON | `Upgrade.Upgrade` | - | STREAM `firmware.update` 或 file 暂存模式 | 可映射分片上传，`Pos` / `Size` -> range。 |
| VM33 HTTP JSON | `Upgrade.Progress` | - | `firmware.getUpdateState` / `getUpdateTransferState` | 可映射本地升级进度。 |
| VM33 HTTP JSON | `Upgrade.Version` | - | `firmware.getInfo` | 可映射版本查询；`device.info` 如需承载基础版本需另行评审。 |
| VM33 HTTP JSON | `Upgrade.CloudUpgrade` | - | `firmware.beginUpdate(source.type=url)` | 可映射 URL 远程升级，`SerialNumber` / `Destination` 映射到 P1 `targetDevices`。 |
| VM33 HTTP JSON | `Upgrade.CloudProgress` | - | `firmware.getUpdateState` | 可映射 URL 升级进度。 |

---

## 21. Registry 草案输入

采纳本文后，domain YAML 至少应包含以下事实：

```yaml
capabilities:
  - id: firmware.update
    name: Firmware Update
    status: mvp
    methods:
      - firmware.beginUpdate
      - firmware.commitUpdateBatch
      - firmware.verifyUpdatePackage
      - firmware.installUpdate
      - firmware.getUpdateCapabilities
      - firmware.getUpdateState
      - firmware.cancelUpdate
      # P1 reserved:
      - firmware.getUpdateTransferState
      - firmware.confirmUpdate
      - firmware.rollbackUpdate
    events:
      - firmware.updateProgressReported
      - firmware.updateStateChanged
      - firmware.updateResultReported
    streamProfiles:
      - firmware.update
```

方法分级建议：

| 方法 | 分级 | 当前处理建议 |
|---|---|---|
| `firmware.beginUpdate` | P0 | 需按草案 schema 采纳；旧 `firmware.begin` 只作为 legacy alias 评审输入。 |
| `firmware.commitUpdateBatch` | P0 | 旧 `firmware.end` 只能作为单镜像完成语义的迁移证据。 |
| `firmware.verifyUpdatePackage` | P0 | 旧 `firmware.verify` 只作为迁移证据。 |
| `firmware.installUpdate` | P0 | 旧 `firmware.apply` 只作为迁移证据。 |
| `firmware.getUpdateCapabilities` | P0 | 能力字段进入 `FirmwareUpdateCapability` schema；声明 md5、自动重启、设备策略和扩展能力。 |
| `firmware.getUpdateState` | P1 | 状态查询。 |
| `firmware.getUpdateTransferState` | P1 | 断点续传 / missingRanges 预留。 |
| `firmware.cancelUpdate` | P1 | 正常取消。 |
| `firmware.confirmUpdate` | P1 | A/B 确认。 |
| `firmware.rollbackUpdate` | P1 | 回滚。 |
| `firmware.uploadUpdateChunk` | P2 | 仅兼容。 |

采纳检查：

1. 先决定旧 `firmware.begin/end/verify/apply` 是否需要 adapter-only alias；稳定方法名和 schema 以本草案评审结论为准。
2. 优先更新 `registry/domains/firmware/domain.yaml`；只有被治理为 Core/shared 时，才按需创建或更新 `registry/method/`、`registry/event/`、shared schema 或 stream profile 源文件。
3. 确认 `file.transfer` 是否已定稿；未定稿时不要把 file 暂存方法写成 P0。
4. 只把已确认的 legacy 字段写入 `legacyRefs`；`CommonSet/GetNoTargetStrategyState` 不得继续作为 firmware.update legacyRef。
5. 运行 Generator，确保 `protocol/axtp.protocol.yaml`、`docs/generated/*` 和 runtime generated 文件一致。

---

## 22. JSON 示例

本节示例用于评审 `firmware.update` request/response/event 语义，不是 generated 事实源。JSON 示例只写 RPC `d` 数据块，不包裹外层 `sid` / `op` / `d` wire envelope；Request 使用 `id`、`method`、`params`，Response 使用 `id`、`status`、`result`，Event 使用 `event`、`intent`、`data`。`status.code` 必须是数字 ErrorCode；成功使用 `0`，`FW_HASH_MISMATCH` 使用已采纳数值 `1034` (`0x040A`)。

### 22.1 查询固件更新能力

```json
{
  "id": 1001,
  "method": "firmware.getUpdateCapabilities",
  "params": {}
}
```

```json
{
  "id": 1001,
  "status": {
    "ok": true,
    "code": 0
  },
  "result": {
    "supported": true,
    "transferModes": ["stream"],
    "streamProfiles": ["firmware.update"],
    "defaultStreamProfile": "firmware.update",
    "streamLayouts": ["file", "package", "single_image"],
    "defaultStreamLayout": "file",
    "supportsManifest": true,
    "requiresManifest": true,
    "supportsMultiFile": true,
    "supportsBatchCommit": true,
    "supportsResume": false,
    "supportsMissingRanges": false,
    "supportsParallelTransfer": false,
    "requiresSignature": false,
    "hashAlgorithms": ["md5"],
    "installOrderSource": "device_policy",
    "devicePolicyId": "fw-policy-nearhub-room",
    "devicePolicyVersion": "2026.06",
    "autoReboot": true,
    "targets": ["bootloader", "application", "resource", "model", "vendor"],
    "preferredChunkSize": 65536,
    "maxChunkSize": 262144
  }
}
```

### 22.2 创建固件更新会话

```json
{
  "id": 1002,
  "method": "firmware.beginUpdate",
  "params": {
    "packageId": "pkg_2026_0605_001",
    "targetVersion": "2.3.0",
    "transferMode": "stream",
    "streamProfile": "firmware.update",
    "streamLayout": "file",
    "idempotencyKey": "host-request-placeholder",
    "manifest": {
      "schemaVersion": 1,
      "packageId": "pkg_2026_0605_001",
      "targetVersion": "2.3.0",
      "devicePolicyId": "fw-policy-nearhub-room",
      "devicePolicyVersion": "2026.06",
      "installOrderSource": "device_policy",
      "files": [
        {
          "fileId": "app",
          "target": "application",
          "name": "app.bin",
          "size": 8388608,
          "required": true,
          "hash": {
            "algorithm": "md5",
            "value": "d41d8cd98f00b204e9800998ecf8427e"
          }
        },
        {
          "fileId": "resource",
          "target": "resource",
          "name": "resource.bin",
          "size": 5242880,
          "required": false,
          "hash": {
            "algorithm": "md5",
            "value": "d41d8cd98f00b204e9800998ecf8427e"
          }
        }
      ]
    },
    "policy": {
      "installMode": "normal",
      "rebootPolicy": "auto",
      "allowDowngrade": false
    }
  }
}
```

```json
{
  "id": 1002,
  "status": {
    "ok": true,
    "code": 0
  },
  "result": {
    "updateSessionId": "upd_001",
    "transferId": 33,
    "packageId": "pkg_2026_0605_001",
    "state": "receiving",
    "phase": "receiving_files",
    "transferMode": "stream",
    "streamLayout": "file",
    "streamProfile": "firmware.update",
    "chunkSize": 65536,
    "windowSize": 4,
    "resumeSupported": false,
    "autoReboot": true,
    "streams": [
      {
        "fileId": "app",
        "streamId": 33,
        "cursor": 0
      },
      {
        "fileId": "resource",
        "streamId": 34,
        "cursor": 0
      }
    ]
  }
}
```

### 22.3 提交、校验和安装

```json
{
  "id": 1003,
  "method": "firmware.commitUpdateBatch",
  "params": {
    "updateSessionId": "upd_001",
    "batchId": "batch_app_complete",
    "files": [
      {
        "fileId": "app",
        "ranges": [
          {
            "offset": 0,
            "size": 8388608
          }
        ],
        "complete": true
      }
    ]
  }
}
```

```json
{
  "id": 1003,
  "status": {
    "ok": true,
    "code": 0
  },
  "result": {
    "updateSessionId": "upd_001",
    "batchId": "batch_app_complete",
    "state": "batch_committed",
    "files": [
      {
        "fileId": "app",
        "receivedBytes": 8388608,
        "cursor": 8388608,
        "complete": true
      }
    ],
    "progress": 62
  }
}
```

```json
{
  "id": 1004,
  "method": "firmware.verifyUpdatePackage",
  "params": {
    "updateSessionId": "upd_001",
    "scope": "all"
  }
}
```

```json
{
  "id": 1004,
  "status": {
    "ok": true,
    "code": 0
  },
  "result": {
    "updateSessionId": "upd_001",
    "state": "verified",
    "phase": "verifying_files",
    "files": [
      {
        "fileId": "app",
        "sizeVerified": true,
        "hashAlgorithm": "md5",
        "hashVerified": true
      }
    ],
    "packageHashVerified": true
  }
}
```

```json
{
  "id": 1005,
  "method": "firmware.installUpdate",
  "params": {
    "updateSessionId": "upd_001",
    "installMode": "normal",
    "rebootPolicy": "auto"
  }
}
```

```json
{
  "id": 1005,
  "status": {
    "ok": true,
    "code": 0
  },
  "result": {
    "updateSessionId": "upd_001",
    "state": "installing",
    "accepted": true,
    "installMode": "normal",
    "requiresReboot": true,
    "autoReboot": true,
    "confirmRequired": false
  }
}
```

### 22.4 进度和状态事件

```json
{
  "event": "firmware.updateProgressReported",
  "intent": 1,
  "data": {
    "updateSessionId": "upd_001",
    "transferId": 33,
    "state": "receiving",
    "phase": "receiving_files",
    "progress": 62,
    "totalBytes": 13631488,
    "receivedBytes": 8388608,
    "files": [
      {
        "fileId": "app",
        "receivedBytes": 8388608,
        "size": 8388608,
        "progress": 100
      }
    ],
    "timestampMs": 1710000010000
  }
}
```

```json
{
  "event": "firmware.updateStateChanged",
  "intent": 1,
  "data": {
    "updateSessionId": "upd_001",
    "transferId": 33,
    "oldState": "installing",
    "state": "reboot_required",
    "phase": "waiting_reboot",
    "requiresReboot": true,
    "autoReboot": true,
    "timestampMs": 1710000100000
  }
}
```

### 22.5 md5 校验失败

```json
{
  "id": 1004,
  "status": {
    "ok": false,
    "code": 1034,
    "message": "app.bin md5 mismatch",
    "details": {
      "candidateError": "FW_HASH_MISMATCH",
      "updateSessionId": "upd_001",
      "fileId": "app",
      "phase": "verifying_files",
      "hashAlgorithm": "md5",
      "expected": "d41d8cd98f00b204e9800998ecf8427e",
      "actual": "00000000000000000000000000000000"
    }
  }
}
```

## 23. Binary-RPC / TLV 映射建议

JSON-RPC 使用 lowerCamelCase 字段名。Binary/TLV 可以分配数字 ID，但数字 ID 不暴露到 JSON 协议。

建议 target 枚举：

| 值 | target |
|---:|---|
| `0x01` | `bootloader` |
| `0x02` | `application` |
| `0x03` | `resource` |
| `0x04` | `model` |
| `0x05` | `filesystem` |
| `0x06` | `config` |
| `0x07` | `recovery` |
| `0xFF` | `vendor` |

建议状态枚举：

| 值 | state |
|---:|---|
| `0x00` | `idle` |
| `0x01` | `preparing` |
| `0x02` | `receiving` |
| `0x03` | `downloading` |
| `0x04` | `batch_committed` |
| `0x05` | `verifying` |
| `0x06` | `verified` |
| `0x07` | `installing` |
| `0x08` | `installed` |
| `0x09` | `reboot_required` |
| `0x0A` | `confirming` |
| `0x0B` | `confirmed` |
| `0x0C` | `rollback_scheduled` |
| `0x0D` | `rolling_back` |
| `0x0E` | `cancelled` |
| `0x0F` | `failed` |

TLV 规则：

1. fieldId 必须由 schema 固化，不由业务代码临时定义。
2. `updateSessionId` 可以是 string；资源受限设备可额外返回 uint32 `transferId`。
3. `hash.value` 在 TLV 中可用 bytes 表达，JSON 中使用 lowercase hex string。
4. STREAM 数据包不携带 manifest 字段。
5. legacy adapter 可以把旧 CmdValue、slice index、md5、status 映射到新方法和字段，但不得把旧 CmdValue 作为新协议 fieldId。

---

## 24. 待评审问题

| 标记 | 问题 | 影响 |
|---|---|---|
| `[REVIEW-ASK]` | `devicePolicyId` / `devicePolicyVersion` 由设备能力返回、Host 包规则内置，还是两者共同校验？ | 影响多文件包解析、拆分和 Host 下发顺序策略。 |
| `[REVIEW-ASK]` | manifest 是固件包内强制携带，还是允许 Host 按产品包规则生成？ | 影响 `beginUpdate.manifest` 必填字段、包工具和测试向量。 |
| `[REVIEW-ASK]` | 当前版本查询最终归 `firmware.getInfo`，还是复用/拆分到 `device.info`？ | 影响升级页面进入前的版本读取合同。 |
| `[REVIEW-ASK]` | A/B confirm、rollback 和自动回滚是否纳入本产品 P1，还是仅保留通用草案能力？ | 影响 `confirmUpdate` / `rollbackUpdate` 是否进入首批采纳。 |
| `[REVIEW-ASK]` | URL 远程升级、file 暂存、断点续传和缺失范围补传是否需要独立里程碑采纳？ | 影响 P1/P2 方法、capability 字段和兼容测试范围。 |
| `[REVIEW-ASK]` | AXDP Alpha/Beta/Rooms/VM33/Signage 旧协议字段哪些可以进入稳定 `legacyRefs`？ | 影响 adapter 映射和迁移文档准确性。 |

---

## 25. 核心结论

```text
firmware.update 是固件更新控制面：
  manifest、devicePolicy、updateSessionId、batchId、md5 校验、安装、自动重启、状态。

firmware.update STREAM 是后续 profile 数据面：
  streamId、seqId、cursor、payload、ack；resume 是 P1 预留。

file.transfer 只是 P1 暂存文件模式：
  file 域定稿前，不把 file.* 方法当成稳定合同。

多文件固件更新必须以 fileId 为单位管理：
  size、hash、cursor、complete；missingRanges 是 P1 预留。

分批次固件更新必须有 batchId：
  commitUpdateBatch 只表示数据提交，不表示校验或安装。

安装前必须校验：
  verifyUpdatePackage 用 md5 校验成功后才能 installUpdate。

正常取消走 firmware.cancelUpdate：
  stream.abort 只做底层异常释放。

URL 远程升级不需要新方法：
  使用 beginUpdate.source.type=url，并保留 md5 校验；signature 是扩展能力。
```
