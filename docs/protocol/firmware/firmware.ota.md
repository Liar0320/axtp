# AXTP Firmware OTA 协议方案

版本：v0.2

归属域：`firmware`

Capability ID：`firmware.ota`

数据面：`stream`，默认 Stream Profile 为 `firmware.ota`。`file.transfer` 可作为文件暂存模式的后续扩展。

适用范围：设备固件升级、Bootloader 升级、资源包升级、模型升级、多文件 OTA、分批次 OTA、断点续传 OTA、A/B 分区确认与回滚、远程 URL 升级到 AXTP 的语义映射。

---

## 协议审核标记（人工复核）

| 标记 | 条目 | 审核结论 | 本文处理 |
|---|---|---|---|
| `[REVIEW-OK]` | `firmware.ota` capability | OTA 控制面归 `firmware.ota`，大文件数据面复用 `stream`，符合 domain-feature 规则。 | 保留为本文唯一 capability，明确 `firmware` 只负责升级业务流程。 |
| `[REVIEW-OK]` | `firmware.beginOta` / `firmware.commitOtaBatch` / `firmware.verifyOtaFiles` / `firmware.installOta` | 会话创建、批次提交、校验、安装拆分合理。 | 补齐方法语义、请求/响应字段、状态机和错误策略，可作为 domain YAML 草案输入。 |
| `[REVIEW-FIX]` | file 域依赖 | 旧文档把 `file.beginUpload` / `file.completeUpload` 当成已定稿方法，但当前 `file.transfer` 仍未正式重写。 | P0 改为 `firmware.beginOta` 直接创建 `firmware.ota` STREAM；`file.*` 只作为 P1 暂存文件模式，占位方法名不得直接进入稳定 registry。 |
| `[REVIEW-ASK]` | AXDP Alpha/Beta/Ex OTA | `AlphaUpgradeInfo/Data`、`BetaStart/Stop/UpgradeInfo/Data/Ex` 可映射到 OTA 流程，但旧包格式、分片 ACK、校验字段仍需设备侧确认。 | 补充 legacy 字段候选映射；标为 adapter-only 或待确认，不直接写入稳定 `legacyRefs`。 |
| `[REVIEW-FIX]` | AXDP `CommonSetNoTargetStrategyState` / `CommonGetNoTargetStrategyState` | 名称和源码行为不像 OTA。 | 从 OTA 稳定映射中排除；后续优先迁到 `misc.*`、`video.framing`、`audio.algorithm` 或 vendor/diagnostic。 |
| `[REVIEW-ASK]` | Rooms / VM33 / Signage 远程升级 | 旧协议有 URL 触发升级和进度查询。 | 通过 `firmware.beginOta.source.type=url` 覆盖，不新增 `firmware.upgradeByUrl` 作为首选方法。 |

---

## 1. 文档定位

`firmware.ota` 定义 OTA 的业务控制面。它回答：

1. 设备是否支持 OTA，以及支持哪些升级模式。
2. 本次升级的 manifest、目标版本、目标文件和安全校验是什么。
3. 如何创建 OTA 会话并绑定 STREAM 数据面。
4. 如何提交已传输的数据批次。
5. 如何校验、安装、重启后确认和回滚。
6. 如何查询状态、进度和断点续传信息。
7. 如何把旧 Alpha/Beta/Rooms/VM33/Signage 升级语义迁移到 AXTP。

本方案是业务协议方案和人工评审输入。采纳后，稳定事实必须写入 `registry/domains/firmware/domain.yaml` 或对应 registry YAML，并由 Generator 生成 `protocol/axtp.protocol.yaml` 和 `docs/generated/*`。本文不直接分配新的 numeric methodId、eventId 或 fieldId；数值以 registry/generated 为准。

当前 generated contract 不包含 OTA 业务方法；旧 MVP 名称 `firmware.begin` / `firmware.end` / `firmware.verify` / `firmware.apply` 只作为迁移输入和命名对照。本文采用 08/10/14 规范中评审后的明确命名：

| 本文推荐方法 | 旧 MVP / legacy 对照名 | 兼容说明 |
|---|---|---|
| `firmware.beginOta` | `firmware.begin` | 创建 OTA 会话并返回 `streamId` / `transferId`。 |
| `firmware.commitOtaBatch` | `firmware.end` | 旧单镜像流程中可表示数据发送完成；新协议扩展为多文件/分批提交。 |
| `firmware.verifyOtaFiles` | `firmware.verify` | 校验完整镜像或多文件包。 |
| `firmware.installOta` | `firmware.apply` | 应用已校验 OTA。 |
| `firmware.otaProgressReported` | `firmware.updateProgress` | 新事件命名更明确。 |
| `firmware.otaStateChanged` / `firmware.otaResultReported` | `firmware.updateCompleted` / `firmware.updateFailed` | 当前完成/失败事件可由新状态/结果事件兼容表达。 |

落 registry 时必须以已通过草案为准；不得因为旧 MVP 名称存在过，就在未评审 schema 的情况下重新生成 OTA 方法。

---

## 2. 域边界

`firmware.ota` 负责：

```text
固件和 OTA 能力查询
OTA manifest 接收和校验
OTA 会话创建
STREAM 上下文绑定
多文件升级包管理
分批次提交
传输状态和断点续传查询
文件 hash、整包 hash、签名校验
安装、slot 切换、重启需求表达
A/B 启动后确认
回滚
取消和清理
状态、进度、结果事件
```

不属于 `firmware.ota` 的内容：

| 内容 | 归属建议 | 说明 |
|---|---|---|
| STREAM 帧、`streamId`、`seqId`、`cursor`、ACK、窗口、resume | `stream` / transport runtime | OTA 只创建和绑定业务流。 |
| 通用文件上传下载能力 | `file.transfer` | file 域未定稿前，本文仅引用暂存文件模式的占位方法名。 |
| 通用设备重启 | `system.reboot` | OTA 可返回 `requiresReboot=true`，真正重启由 system 域执行或设备策略自动执行。 |
| 网络连接、代理、DNS、证书安装 | `network` / `auth` | URL 升级只声明来源，不管理网络基础设施。 |
| 产测擦写、工厂校准、license 写入 | `diagnostic.*` / `vendor.*` / `auth.license` | 不混入通用 OTA。 |
| 升级策略配置，例如自动检查、静默窗口 | `firmware.updatePolicy` | 与一次 OTA 会话不同。 |
| 无目标策略、跟踪策略、算法行为配置 | 待确认 | `CommonSet/GetNoTargetStrategyState` 不进入 `firmware.ota`。 |

核心原则：

```text
firmware 负责“升级什么、是否可信、什么时候安装”。
stream 负责“字节如何可靠传输”。
file 只在暂存文件模式中负责“文件如何上传或下载”。
system 负责“设备如何重启”。
```

---

## 3. 术语

| 名称 | 类型 | 说明 |
|---|---|---|
| `otaSessionId` | string | 一次 OTA 业务会话 ID，业务层查询、取消、确认、回滚都使用它。 |
| `transferId` | uint32 | 兼容旧单镜像流程和 Binary/TLV 的传输 ID，可与 `streamId` 绑定。 |
| `streamId` | uint32 | STREAM 数据通道 ID，由 `firmware.beginOta` 返回。 |
| `packageId` | string | OTA 包 ID，可由服务端或客户端生成。 |
| `manifest` | object | OTA 包描述，包含版本、文件、hash、签名、目标和安装策略。 |
| `fileId` | string | manifest 内的文件 ID，例如 `app`、`bootloader`、`resources`。 |
| `uploadedFileId` | string | 通过 file 域暂存上传后生成的文件 ID。仅用于 file 暂存模式。 |
| `batchId` | string | 一次批次提交 ID，在同一 `otaSessionId` 内唯一。 |
| `cursor` | uint64 | 某个文件或 stream 当前连续接收的字节偏移。 |
| `missingRanges` | array | 缺失范围，用于断点续传或乱序补传。 |
| `target` | enum | 写入目标，例如 `application`、`bootloader`、`resource`。 |
| `state` | enum | OTA 会话状态。 |
| `phase` | enum | OTA 当前阶段，比 `state` 更细。 |
| `resumeToken` | bytes/string | 可选断点续传 token，由设备生成并校验。 |

---

## 4. 核心接口

| 类型 | 名称 | 分级 | 说明 |
|---|---|---|---|
| capability | `firmware.ota` | P0 | OTA 能力块。 |
| method | `firmware.beginOta` | P0 | 创建 OTA 会话，校验 manifest，绑定 `firmware.ota` STREAM 或 URL 下载任务。 |
| method | `firmware.commitOtaBatch` | P0 | 提交已传输的文件、范围或暂存文件。 |
| method | `firmware.verifyOtaFiles` | P0 | 校验文件 hash、整包 hash 和签名。 |
| method | `firmware.installOta` | P0 | 安装已校验 OTA。 |
| method | `firmware.getOtaCapabilities` | P1 | 查询 OTA 详细能力。 |
| method | `firmware.getOtaState` | P1 | 查询 OTA 业务状态。 |
| method | `firmware.getOtaTransferState` | P1 | 查询每个文件的接收进度和缺失范围。 |
| method | `firmware.cancelOta` | P1 | 取消未进入不可中断阶段的 OTA。 |
| method | `firmware.confirmOta` | P1 | A/B 或可回滚系统在新版本启动后确认成功。 |
| method | `firmware.rollbackOta` | P1 | 回滚到上一个可用版本。 |
| method | `firmware.getInfo` | P1 | 查询固件详细版本信息；采纳前继续使用旧业务协议或设备现有接口。 |
| event | `firmware.otaProgressReported` | P0 | 周期性进度上报。 |
| event | `firmware.otaStateChanged` | P0 | 状态变化通知。 |
| event | `firmware.otaResultReported` | P1 | 成功、失败、回滚等最终结果通知。 |

P2 兼容方法 `firmware.uploadOtaChunk` 仅用于极低端设备或 legacy adapter，默认不得作为新实现首选。

---

## 5. 数据面模式

### 5.1 P0：firmware.ota STREAM

P0 推荐流程：

```text
firmware.beginOta
STREAM packets, profile=firmware.ota
firmware.commitOtaBatch
firmware.verifyOtaFiles
firmware.installOta
system.reboot, if required
firmware.confirmOta, if supported
```

`firmware.beginOta` 返回 `streamId` 后，固件数据通过 STREAM payload 传输。STREAM 包只携带通用数据面字段：

```json
{
  "streamId": 33,
  "seqId": 0,
  "cursor": 0,
  "payload": "base64:AAAA..."
}
```

业务字段不得塞进 STREAM header，例如 `imageType`、`totalSize`、`sha256`、`fileId`、`chunkCrc32`。这些信息必须来自 `manifest`、Stream Context 或可选 profile trailer。

STREAM 与 OTA 文件的绑定方式由 `beginOta` 响应声明：

| `streamLayout` | 说明 | 适用场景 |
|---|---|---|
| `file` | 每个 `fileId` 绑定一个独立 `streamId`，STREAM payload 只属于该文件。 | 多文件 OTA 推荐模式。 |
| `package` | 单个 `streamId` 传输一个完整 package blob，manifest 中每个文件必须声明 `packageOffset` 和 `size`，设备按范围切分。 | 已有打包格式或 URL 下载模式。 |
| `single_image` | 单个 `streamId` 只对应一个固件镜像。 | 旧 `firmware.begin/end/verify/apply` 兼容。 |

多文件 OTA 不得依赖 STREAM 包里的 `fileId`。如果使用 `streamLayout=file`，`fileId` 与 `streamId` 的绑定来自 `beginOta.result.streams[]`；如果使用 `streamLayout=package`，文件归属来自 manifest 中的 `packageOffset`。

### 5.2 P1：file 暂存模式

当设备需要先把升级文件暂存在文件系统中，再由 firmware 域绑定安装时，可以使用 file 暂存模式：

```text
firmware.beginOta(transferMode=file)
file.beginUpload, draft placeholder
STREAM packets, profile=file.transfer
file.completeUpload, draft placeholder
firmware.commitOtaBatch(uploadedFileId)
firmware.verifyOtaFiles
firmware.installOta
```

由于 `file.transfer` 文档当前仍是 review blocker，本文中的 `file.beginUpload` / `file.completeUpload` 只表示未来 file 域应提供的能力，不是当前稳定 wire 合同。正式落地前必须先完成 `docs/protocol/file/file.transfer.md` 重写并同步 registry。

### 5.3 P1：URL 远程升级

Rooms、VM33、Signage 的旧 `RemoteUpgrade` / `CloudUpgrade` 可映射为：

```json
{
  "method": "firmware.beginOta",
  "params": {
    "packageId": "pkg_remote_001",
    "targetVersion": "2.3.0",
    "transferMode": "url",
    "source": {
      "type": "url",
      "url": "https://example.com/firmware.bin",
      "hash": {
        "algorithm": "sha256",
        "value": "..."
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
            "algorithm": "sha256",
            "value": "..."
          },
          "required": true
        }
      ]
    }
  }
}
```

URL 模式下设备负责下载，但 firmware 域不负责配置网络。设备必须仍按 manifest 做 hash 和签名校验；不得只因为 URL 可信就跳过校验。

---

## 6. Manifest

`manifest` 是 OTA 包的核心描述。第一版 schema 基线：

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
  "files": [
    {
      "fileId": "bootloader",
      "target": "bootloader",
      "imageType": "bootloader",
      "name": "bootloader.bin",
      "size": 262144,
      "required": true,
      "installOrder": 10,
      "hash": {
        "algorithm": "sha256",
        "value": "..."
      }
    },
    {
      "fileId": "app",
      "target": "application",
      "imageType": "main",
      "name": "app.bin",
      "size": 8388608,
      "required": true,
      "installOrder": 20,
      "hash": {
        "algorithm": "sha256",
        "value": "..."
      }
    },
    {
      "fileId": "resources",
      "target": "resource",
      "name": "resources.bin",
      "size": 5242880,
      "required": false,
      "installOrder": 30,
      "hash": {
        "algorithm": "sha256",
        "value": "..."
      }
    }
  ],
  "packageHash": {
    "algorithm": "sha256",
    "value": "..."
  },
  "signature": {
    "algorithm": "ecdsa_p256",
    "keyId": "prod-fw-2026",
    "value": "base64:..."
  },
  "installPlan": {
    "partitionScheme": "ab",
    "targetSlot": "inactive",
    "rebootPolicy": "manual",
    "confirmRequired": true,
    "rollbackAllowed": true
  }
}
```

字段规则：

| 字段 | 必填 | 说明 |
|---|---|---|
| `schemaVersion` | 是 | Manifest schema 版本。 |
| `packageId` | 推荐 | 与 `beginOta.params.packageId` 必须一致；缺省时由外层提供。 |
| `targetVersion` | 是 | 升级目标版本。 |
| `minCurrentVersion` / `maxCurrentVersion` | 可选 | 当前版本约束。 |
| `allowDowngrade` | 可选 | 默认 `false`。设备有 anti-rollback fuse 时必须拒绝非法降级。 |
| `productIds` / `hardwareRevisions` | 推荐 | 兼容性约束。 |
| `files[]` | 是 | 至少一个文件。 |
| `packageHash` | 推荐 | 整包 hash，适用于打包格式或组合文件。 |
| `signature` | 生产必填 | manifest 或整包签名。开发设备可以通过 capability 声明不要求签名。 |
| `installPlan` | 推荐 | slot、重启、确认和回滚策略。 |

`files[]` 规则：

1. `fileId` 在同一 `otaSessionId` 内必须唯一。
2. 每个 required 文件必须声明 `size` 和 `hash`。
3. `target` 枚举为 `bootloader`、`application`、`resource`、`model`、`filesystem`、`config`、`recovery`、`vendor`。
4. `hash.algorithm` 生产环境必须支持 `sha256`；`md5` 只用于 legacy 适配或非安全完整性检查。
5. `installOrder` 由设备按从小到大执行；缺省时由设备按 target 安全策略决定。
6. `streamLayout=package` 时，每个文件必须声明 `packageOffset`，且 `packageOffset + size` 不得越过 package 大小。
7. `signature` 必须覆盖 manifest 中影响安装和校验的字段。
8. manifest 校验失败时，`beginOta` 必须返回错误，不得创建可安装会话。

---

## 7. 能力查询

### 7.1 firmware.getInfo

用途：查询固件详细版本和分区信息。

```json
{
  "method": "firmware.getInfo",
  "params": {}
}
```

```json
{
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

### 7.2 firmware.getOtaCapabilities

用途：查询 OTA 细粒度能力。

```json
{
  "method": "firmware.getOtaCapabilities",
  "params": {}
}
```

```json
{
  "result": {
    "supported": true,
    "transferModes": ["stream", "url"],
    "streamProfiles": ["firmware.ota"],
    "defaultStreamProfile": "firmware.ota",
    "streamLayouts": ["single_image", "file", "package"],
    "defaultStreamLayout": "file",
    "ackModes": ["stop_and_wait", "sliding_window"],
    "supportsManifest": true,
    "requiresManifest": true,
    "supportsMultiFile": true,
    "supportsBatchCommit": true,
    "supportsResume": true,
    "supportsMissingRanges": true,
    "supportsUrlSource": true,
    "supportsRollback": true,
    "supportsConfirm": true,
    "requiresSignature": true,
    "requiresReboot": true,
    "partitionSchemes": ["single", "ab"],
    "targets": ["bootloader", "application", "resource", "model"],
    "maxFileCount": 16,
    "maxPackageSize": 268435456,
    "maxFileSize": 134217728,
    "preferredChunkSize": 65536,
    "maxChunkSize": 262144,
    "maxWindowSize": 8,
    "hashAlgorithms": ["sha256", "crc32", "md5"],
    "signatureAlgorithms": ["ecdsa_p256", "rsa2048"]
  }
}
```

规则：

1. `streamProfiles` 中 P0 必须包含 `firmware.ota`。
2. `file.transfer` 只有在 file 域定稿并被设备实现时才出现在能力中。
3. `md5` 只表示 legacy 兼容能力；生产 OTA 不应只依赖 `md5`。
4. `streamLayouts` 声明 `streamId` 与 `fileId` 或 package offset 的绑定方式。
5. `requiresSignature=true` 时，manifest 缺少签名必须返回 `FW_VERIFY_FAILED` 或 `RPC_PARAM_MISSING`。

---

## 8. OTA 会话创建

### 8.1 firmware.beginOta

用途：创建 OTA 会话、校验 manifest、协商数据面。

```json
{
  "method": "firmware.beginOta",
  "params": {
    "packageId": "pkg_2026_0602_001",
    "targetVersion": "2.3.0",
    "transferMode": "stream",
    "streamProfile": "firmware.ota",
    "streamLayout": "file",
    "idempotencyKey": "host-req-001",
    "resumeToken": null,
    "manifest": {
      "schemaVersion": 1,
      "targetVersion": "2.3.0",
      "files": [
        {
          "fileId": "app",
          "target": "application",
          "name": "app.bin",
          "size": 8388608,
          "required": true,
          "hash": {
            "algorithm": "sha256",
            "value": "..."
          }
        }
      ],
      "signature": {
        "algorithm": "ecdsa_p256",
        "keyId": "prod-fw-2026",
        "value": "base64:..."
      }
    },
    "policy": {
      "installMode": "normal",
      "rebootPolicy": "manual",
      "allowDowngrade": false
    }
  }
}
```

成功响应：

```json
{
  "result": {
    "otaSessionId": "ota_001",
    "transferId": 33,
    "packageId": "pkg_2026_0602_001",
    "state": "receiving",
    "phase": "receiving_files",
    "transferMode": "stream",
    "streamLayout": "file",
    "streamId": 33,
    "streamProfile": "firmware.ota",
    "ackMode": "sliding_window",
    "cursorUnit": "byteOffset",
    "acceptedOffset": 0,
    "chunkSize": 65536,
    "windowSize": 4,
    "resumeToken": "base64:...",
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
  "result": {
    "otaSessionId": "ota_remote_001",
    "packageId": "pkg_remote_001",
    "state": "downloading",
    "phase": "downloading_package",
    "transferMode": "url",
    "requiresClientUpload": false
  }
}
```

规则：

1. `beginOta` 只创建 OTA 会话，不在 RPC request/response 中传输固件大块数据。
2. 设备必须校验 manifest 的结构、版本、硬件兼容性、大小上限、目标分区和签名策略。
3. 同一设备同一时间默认只允许一个 active OTA；已有会话时返回 `FW_TRANSFER_ALREADY_STARTED` 或 `BUSY`。
4. `idempotencyKey` 相同且参数一致时，设备应返回同一个会话；参数不同必须返回 `ALREADY_EXISTS` 或 `INVALID_ARGUMENT`。
5. 断点续传时，`resumeToken` 只由创建它的设备解释，客户端不得伪造 token 内部结构。
6. `streamLayout=file` 时，设备必须在 `streams[]` 中返回每个 `fileId` 对应的 `streamId`。
7. `beginOta` 成功后，stream 模式进入 `receiving`，URL 模式进入 `downloading`。

---

## 9. 批次提交

### 9.1 firmware.commitOtaBatch

用途：将已传输的数据范围或暂存文件绑定到 OTA 会话。它表示“数据已提交给 OTA 会话”，不表示校验通过，也不表示安装。

提交 STREAM 范围：

```json
{
  "method": "firmware.commitOtaBatch",
  "params": {
    "otaSessionId": "ota_001",
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
  "method": "firmware.commitOtaBatch",
  "params": {
    "otaSessionId": "ota_001",
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
  "result": {
    "otaSessionId": "ota_001",
    "batchId": "batch_001",
    "state": "batch_committed",
    "files": [
      {
        "fileId": "app",
        "receivedBytes": 1048576,
        "cursor": 1048576,
        "complete": false,
        "missingRanges": [
          {
            "offset": 1048576,
            "size": 7340032
          }
        ]
      }
    ],
    "totalBytes": 8388608,
    "receivedBytes": 1048576,
    "progress": 12
  }
}
```

规则：

1. `batchId` 在同一 `otaSessionId` 内必须唯一。
2. 同一 `batchId` 重试且 payload 完全一致时必须幂等返回。
3. 同一 `batchId` 重试但 payload 不一致时必须返回 `ALREADY_EXISTS` 或 `INVALID_ARGUMENT`。
4. `files[].fileId` 必须存在于 manifest。
5. `ranges[]` 不得越过 manifest 声明的 `size`。
6. 设备只支持顺序写入时，可以只接受从当前 `cursor` 开始的范围；乱序范围返回 `STREAM_OFFSET_INVALID` 或 `OUT_OF_RANGE`。
7. required 文件全部 `complete=true` 后才允许进入 `verifyOtaFiles`。
8. 多文件 OTA 必须按 `fileId` 独立维护 `cursor`、`receivedBytes` 和 `missingRanges`。

---

## 10. 传输状态和断点续传

### 10.1 firmware.getOtaTransferState

用途：查询接收状态，用于 UI 进度、重连恢复和缺失范围补传。

```json
{
  "method": "firmware.getOtaTransferState",
  "params": {
    "otaSessionId": "ota_001"
  }
}
```

```json
{
  "result": {
    "otaSessionId": "ota_001",
    "state": "receiving",
    "streamLayout": "file",
    "streamId": 33,
    "streamProfile": "firmware.ota",
    "resumeToken": "base64:...",
    "files": [
      {
        "fileId": "app",
        "streamId": 33,
        "target": "application",
        "size": 8388608,
        "receivedBytes": 3145728,
        "cursor": 3145728,
        "complete": false,
        "missingRanges": [
          {
            "offset": 3145728,
            "size": 5242880
          }
        ]
      }
    ],
    "totalBytes": 8388608,
    "receivedBytes": 3145728,
    "progress": 37
  }
}
```

断点续传规则：

1. 客户端重连后先调用 `getOtaTransferState`。
2. 顺序写设备从每个 `fileId.cursor` 继续发送。
3. 支持乱序补传的设备返回 `missingRanges`，客户端按 range 补传。
4. `resumeToken` 必须和 `otaSessionId`、manifest hash、设备身份绑定。
5. 若设备重启后丢失 OTA 临时状态，必须返回 `NOT_FOUND` 或 `FW_TRANSFER_NOT_STARTED`，客户端重新开始。
6. 不允许只用一个全局 cursor 表示多文件 OTA 进度。

---

## 11. 校验和安装

### 11.1 firmware.verifyOtaFiles

用途：校验文件完整性、整包 hash 和签名。

```json
{
  "method": "firmware.verifyOtaFiles",
  "params": {
    "otaSessionId": "ota_001",
    "scope": "all"
  }
}
```

```json
{
  "result": {
    "otaSessionId": "ota_001",
    "state": "verified",
    "phase": "verifying_signature",
    "files": [
      {
        "fileId": "app",
        "sizeVerified": true,
        "hashVerified": true
      }
    ],
    "packageHashVerified": true,
    "signatureVerified": true
  }
}
```

规则：

1. 每个 required 文件必须完成 size 和 hash 校验。
2. `packageHash` 存在时必须校验。
3. `signature` 存在或 capability 要求签名时必须校验。
4. 校验成功后进入 `verified`。
5. 校验失败不得安装，返回 `FW_SIZE_MISMATCH`、`FW_HASH_MISMATCH`、`FW_VERIFY_FAILED` 或 `FW_IMAGE_INVALID`。
6. 校验失败事件必须携带 `fileId`、`phase` 和错误码，方便 UI 和日志定位。

### 11.2 firmware.installOta

用途：安装已校验 OTA。

```json
{
  "method": "firmware.installOta",
  "params": {
    "otaSessionId": "ota_001",
    "installMode": "normal",
    "rebootPolicy": "manual"
  }
}
```

```json
{
  "result": {
    "otaSessionId": "ota_001",
    "state": "installing",
    "accepted": true,
    "installMode": "normal",
    "targetSlot": "b",
    "requiresReboot": true,
    "confirmRequired": true
  }
}
```

`installMode` 枚举：

| 值 | 说明 |
|---|---|
| `normal` | 常规安装。 |
| `staged` | 只写入并准备，稍后再切换或重启。 |
| `recovery` | 进入 recovery 路径安装。 |
| `bootloader` | Bootloader 特殊安装路径；设备可限制权限。 |
| `apply_on_reboot` | 下次重启时应用。 |

规则：

1. `installOta` 只能在 `verified` 后调用。
2. 安装过程中通常不允许 `cancelOta`；设备支持安全中止时必须在 capability 中声明。
3. 需要重启时返回 `requiresReboot=true`，客户端调用 `system.reboot` 或等待设备自动重启。
4. A/B 系统应返回 `targetSlot` 和 `confirmRequired`。
5. 写分区失败返回 `FW_APPLY_FAILED`，并在事件中给出失败 `phase`。
6. 安装完成但尚未重启时可进入 `reboot_required`。

---

## 12. 确认、回滚和取消

### 12.1 firmware.confirmOta

用途：A/B 或支持自动回滚的设备在新版本启动后确认升级成功。

```json
{
  "method": "firmware.confirmOta",
  "params": {
    "otaSessionId": "ota_001"
  }
}
```

```json
{
  "result": {
    "otaSessionId": "ota_001",
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
3. 如果 `otaSessionId` 在重启后不可用，设备可接受 `packageId` 或返回最近 pending confirmation 的状态，但 schema 必须在 registry 中明确。

### 12.2 firmware.rollbackOta

用途：回滚到上一个可用版本。

```json
{
  "method": "firmware.rollbackOta",
  "params": {
    "otaSessionId": "ota_001",
    "reason": "user_request",
    "rebootPolicy": "manual"
  }
}
```

```json
{
  "result": {
    "otaSessionId": "ota_001",
    "state": "rollback_scheduled",
    "targetVersion": "2.2.1",
    "requiresReboot": true
  }
}
```

规则：

1. 仅 `supportsRollback=true` 时支持。
2. 没有可回滚版本时返回 `FW_ROLLBACK_FAILED` 或 `NOT_FOUND`。
3. 回滚可能需要重启，重启动作仍归 `system.reboot`。

### 12.3 firmware.cancelOta

用途：取消尚未进入不可中断阶段的 OTA 会话。

```json
{
  "method": "firmware.cancelOta",
  "params": {
    "otaSessionId": "ota_001",
    "reason": "user_request"
  }
}
```

```json
{
  "result": {
    "otaSessionId": "ota_001",
    "state": "cancelled",
    "cleanupStarted": true
  }
}
```

规则：

1. `receiving`、`downloading`、`batch_committed`、`verifying`、`verified` 通常可以取消。
2. `installing`、`switching_slot`、`writing_bootloader` 通常不得取消，返回 `INVALID_STATE`。
3. cancel 后设备必须清理临时文件、关闭相关 stream 或下载任务。
4. `cancelOta` 不等于 `rollbackOta`；已安装的新版本需要回滚时必须走 rollback。
5. 底层异常释放可以使用 `stream.abort`，但 `stream.abort` 不替代 `cancelOta`。

---

## 13. 状态查询和状态机

### 13.1 firmware.getOtaState

用途：查询 OTA 会话整体状态。

```json
{
  "method": "firmware.getOtaState",
  "params": {
    "otaSessionId": "ota_001"
  }
}
```

```json
{
  "result": {
    "otaSessionId": "ota_001",
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
| `idle` | 无 OTA 任务。 |
| `preparing` | 正在准备升级或校验 manifest。 |
| `receiving` | 正在通过 STREAM 或 file 暂存模式接收 OTA 数据。 |
| `downloading` | URL 模式下设备正在下载 OTA 数据。 |
| `batch_committed` | 至少一个批次已提交。 |
| `verifying` | 正在校验文件、整包 hash 或签名。 |
| `verified` | 校验完成，可以安装。 |
| `installing` | 正在安装。 |
| `installed` | 安装完成，可能仍需重启。 |
| `reboot_required` | 需要重启后继续或生效。 |
| `confirming` | 正在确认新版本。 |
| `confirmed` | 新版本已确认。 |
| `rollback_scheduled` | 已计划回滚。 |
| `rolling_back` | 正在回滚。 |
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
| `idle` | `preparing` | `beginOta` 开始处理。 |
| `preparing` | `receiving` | stream/file 模式 manifest 通过。 |
| `preparing` | `downloading` | URL 模式 manifest 通过。 |
| `receiving` | `batch_committed` | `commitOtaBatch` 成功。 |
| `downloading` | `batch_committed` | 设备下载完成并绑定文件。 |
| `batch_committed` | `verifying` | `verifyOtaFiles` 开始。 |
| `verifying` | `verified` | 校验成功。 |
| `verified` | `installing` | `installOta` 开始。 |
| `installing` | `installed` | 写入完成。 |
| `installed` | `reboot_required` | 需要重启生效。 |
| `reboot_required` | `confirming` | 重启后调用 `confirmOta`。 |
| `confirming` | `confirmed` | 确认成功。 |
| `verified` / `installed` / `confirmed` | `rollback_scheduled` | `rollbackOta` 被接受。 |
| `rollback_scheduled` | `rolling_back` | 回滚执行开始。 |
| 任意可取消状态 | `cancelled` | `cancelOta` 成功。 |
| 任意状态 | `failed` | 发生不可恢复错误。 |

---

## 14. 事件

### 14.1 firmware.otaProgressReported

周期性上报 OTA 进度。周期性进度使用 `Reported`，不要使用 `Changed`。

```json
{
  "event": "firmware.otaProgressReported",
  "params": {
    "otaSessionId": "ota_001",
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
2. 多文件 OTA 应包含 `files[]` 进度。
3. receiving/downloading 阶段可按字节计算。
4. installing 阶段由设备按内部阶段计算。
5. 事件频率应受设备能力和 transport 限制，避免挤占 OTA 数据面。

### 14.2 firmware.otaStateChanged

状态变化时上报。

```json
{
  "event": "firmware.otaStateChanged",
  "params": {
    "otaSessionId": "ota_001",
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
  "event": "firmware.otaStateChanged",
  "params": {
    "otaSessionId": "ota_001",
    "transferId": 33,
    "oldState": "verifying",
    "state": "failed",
    "phase": "verifying_files",
    "errorCode": "FW_HASH_MISMATCH",
    "message": "app.bin hash mismatch",
    "fileId": "app",
    "timestampMs": 1710000100000
  }
}
```

### 14.3 firmware.otaResultReported

可选最终结果事件。MVP 可以只使用 `otaStateChanged` 表达完成和失败。

```json
{
  "event": "firmware.otaResultReported",
  "params": {
    "otaSessionId": "ota_001",
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

错误码以 `registry/error/error_code.yaml` 为准。OTA 方法应优先使用已有 common、rpc、stream、firmware 错误码。

| 场景 | 推荐错误码 |
|---|---|
| 设备不支持 OTA、URL、rollback、confirm | `NOT_SUPPORTED` |
| 参数缺失或 manifest 格式错误 | `RPC_PARAM_MISSING` / `RPC_PARAM_INVALID` / `INVALID_ARGUMENT` |
| range 越界、cursor 非法 | `OUT_OF_RANGE` / `STREAM_OFFSET_INVALID` |
| 当前状态不允许操作 | `INVALID_STATE` |
| 已有 OTA 会话 | `FW_TRANSFER_ALREADY_STARTED` / `BUSY` |
| 未找到 OTA 会话 | `NOT_FOUND` / `FW_TRANSFER_NOT_STARTED` |
| required 文件未完整接收 | `STREAM_CHUNK_MISSING` / `FW_SIZE_MISMATCH` |
| 目标 imageType 不支持 | `FW_IMAGE_TYPE_UNSUPPORTED` |
| 版本不兼容、过旧或被 anti-rollback 拒绝 | `FW_VERSION_UNSUPPORTED` / `FW_VERSION_TOO_OLD` |
| 存储空间不足 | `FW_STORAGE_NOT_ENOUGH` / `RESOURCE_EXHAUSTED` |
| 分片 CRC 错误 | `FW_CHUNK_CRC_ERROR` / `STREAM_CRC_ERROR` |
| 文件大小不匹配 | `FW_SIZE_MISMATCH` |
| hash 不匹配 | `FW_HASH_MISMATCH` |
| 签名或综合校验失败 | `FW_VERIFY_FAILED` |
| 安装失败 | `FW_APPLY_FAILED` |
| 回滚失败 | `FW_ROLLBACK_FAILED` |
| 设备温度、电量、供电等条件不满足 | `FW_DEVICE_NOT_READY` |
| 需要重启后继续 | `FW_REBOOT_REQUIRED` |

错误响应示例：

```json
{
  "error": {
    "code": "FW_HASH_MISMATCH",
    "message": "app.bin hash mismatch",
    "data": {
      "otaSessionId": "ota_001",
      "fileId": "app",
      "phase": "verifying_files",
      "expected": "...",
      "actual": "..."
    }
  }
}
```

文件未传完示例：

```json
{
  "error": {
    "code": "STREAM_CHUNK_MISSING",
    "message": "OTA files are incomplete",
    "data": {
      "otaSessionId": "ota_001",
      "files": [
        {
          "fileId": "app",
          "missingRanges": [
            {
              "offset": 3145728,
              "size": 5242880
            }
          ]
        }
      ]
    }
  }
}
```

---

## 16. 安全和可靠性规则

1. 生产 OTA 必须至少使用 `sha256` 做对象完整性校验。
2. 生产 OTA 应要求 manifest 或整包签名，签名验证必须早于安装。
3. URL 模式必须要求 hash 或签名；仅凭 HTTPS URL 不足以证明固件可信。
4. 设备必须检查目标版本、硬件版本、产品 ID、anti-rollback 计数器和分区兼容性。
5. Bootloader、recovery、vendor 分区升级应要求更高权限，可返回 `PERMISSION_DENIED`。
6. OTA 临时文件应写入专用 staging 区，校验通过前不得覆盖当前可启动镜像。
7. A/B 设备安装后应支持启动健康检查；未确认前可自动回滚。
8. 断电恢复后设备必须能回到 `idle`、`receiving`、`reboot_required`、`confirmed` 或 `failed` 中的可解释状态。
9. 事件中的 `message` 不应泄露签名私钥、完整下载 URL token 或敏感路径。
10. 传输层加密、用户认证和升级授权由 AXTP session/auth 或外部安全层提供，OTA 方法必须仍检查调用权限。

---

## 17. 多文件和多目标规则

多文件 OTA：

1. `manifest.files[]` 是唯一文件集合。
2. 每个 `fileId` 独立维护 size、hash、cursor、missingRanges、complete。
3. `commitOtaBatch` 可以提交一个或多个文件，也可以提交同一文件的多个范围。
4. `verifyOtaFiles` 必须在所有 required 文件 complete 后才能成功。
5. `installOrder` 决定安装顺序；设备可以因安全策略拒绝不安全顺序。

多目标 OTA 是 P1 扩展，适用于一个主设备代理升级子设备或集群设备。推荐字段：

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
2. 多目标状态应在 `getOtaState` 和事件中按 targetDeviceId 展开。
3. 旧 VM33 `SerialNumber` 和 `Destination` bitmask 可由 adapter 映射到 `targetDevices`，不得把旧 bitmask 直接暴露为新协议核心字段。

---

## 18. P2 兼容：firmware.uploadOtaChunk

该方法仅用于不具备 STREAM 能力的 legacy 设备或非常受限的 bridge，不建议新设备实现。

```json
{
  "method": "firmware.uploadOtaChunk",
  "params": {
    "otaSessionId": "ota_001",
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
  "result": {
    "otaSessionId": "ota_001",
    "fileId": "app",
    "batchId": "batch_001",
    "received": true,
    "nextOffset": 65536
  }
}
```

限制：

1. `data` 大小不得超过 RPC body 和 transport MTU 能承受的上限。
2. 该方法不得替代 `firmware.ota` STREAM 作为 P0 数据面。
3. 如果 registry 采纳该方法，必须单独声明 max chunk size、编码和错误码。

---

## 19. 完整流程

### 19.1 STREAM OTA

```text
1. Client -> firmware.getInfo；采纳前继续使用旧业务协议查询版本
2. Client -> firmware.getOtaCapabilities
3. Client -> firmware.beginOta(manifest, transferMode=stream)
4. Device -> otaSessionId, streamId, transferId, chunkSize, resumeToken
5. Client -> STREAM firmware.ota chunks
6. Client -> firmware.commitOtaBatch(ranges or complete files)
7. Client -> firmware.getOtaTransferState, optional
8. Client -> firmware.verifyOtaFiles
9. Client -> firmware.installOta
10. Device -> firmware.otaStateChanged(reboot_required), if needed
11. Client -> system.reboot 或等待自动重启
12. Client reconnect
13. Client -> firmware.getInfo；采纳前继续使用旧业务协议查询版本
14. Client -> firmware.confirmOta, if supported
```

### 19.2 URL OTA

```text
1. Client -> firmware.getOtaCapabilities
2. Client -> firmware.beginOta(source.type=url, manifest)
3. Device -> otaSessionId, state=downloading
4. Device -> firmware.otaProgressReported(downloading_package)
5. Client -> firmware.getOtaState, optional polling
6. Client -> firmware.verifyOtaFiles, unless device policy auto-verifies after download
7. Client -> firmware.installOta
8. Reboot and confirm as needed
```

### 19.3 file 暂存 OTA

```text
1. Client -> firmware.beginOta(transferMode=file)
2. Client -> file.beginUpload, draft placeholder
3. Client -> STREAM file.transfer chunks
4. Client -> file.completeUpload, draft placeholder
5. Client -> firmware.commitOtaBatch(uploadedFileId)
6. Client -> firmware.verifyOtaFiles
7. Client -> firmware.installOta
```

该模式必须等待 file 域定稿后再进入稳定 registry。

---

## 20. Legacy 映射审查

以下表格用于人工审查旧协议与 `firmware.ota` 的关联。标记为待确认的条目不得直接写入稳定 `legacyRefs`。

| Source | 旧命令/方法 | 旧 ID | 新协议候选 | 审查结论 |
|---|---|---|---|---|
| AXDP HID | `AlphaUpgradeInfo` | `0xA0001 / 0x0001 -> 0x0081` | `firmware.beginOta` | 可作为 adapter-only 映射。旧 `BlockInfo` 中 `flash_block` -> `target/imageType`，`slice_size` -> `chunkSizeHint`，`slices_total * slice_size` 或 `block_size` -> `size`，`md5` -> `hash(md5)`；字段细节需设备确认。 |
| AXDP HID | `AlphaUpgradeData` | `0xA0002 / 0x0002 -> 0x0082` | STREAM `firmware.ota` + `commitOtaBatch` | 可映射。旧 `slice_index` -> `seqId` 或 range offset，payload -> STREAM payload；成功/失败状态映射到 ACK 或 OTA 事件，需确认。 |
| AXDP HID | `BetaStartUpgrade` | `0xB0003 / 0x0003 -> 0x0083` | `firmware.beginOta` preflight | 可映射为创建前 ready 检查或 beginOta 的准备阶段。 |
| AXDP HID | `BetaStopUpgrade` | `0xB0004 / 0x0004 -> 0x0084` | 待确认 | 旧名可能表示结束发送，也可能表示停止/取消。若表示正常结束，映射 `commitOtaBatch` 或旧 `firmware.end`；若表示中止，映射 `cancelOta`。 |
| AXDP HID | `BetaUpgradeInfo` | `0xB0005 / 0x0005 -> 0x0085` | `firmware.beginOta` | 可作为 adapter-only 映射，字段同 `AlphaUpgradeInfo`。 |
| AXDP HID | `BetaUpgradeData` | `0xB0006 / 0x0006 -> 0x0086` | STREAM `firmware.ota` + `commitOtaBatch` | 可映射。旧 requested slice index 可映射到缺失 range 或 ACK/NACK。 |
| AXDP HID | `BetaUpgradeInfoEx` | `0xB0011 / 0x0011 -> 0x0091` | `firmware.beginOta` | 可映射。Ex 批量发送策略应映射为 window/sliding 或 batch commit，需确认。 |
| AXDP HID | `BetaUpgradeDataEx` | `0xB0012 / 0x0012 -> 0x0092` | STREAM `firmware.ota` + `commitOtaBatch` | 可映射。旧 `0xFFFFFFFF` 成功和 `0xFFFFEEEE` 失败应转换为标准错误和结果事件。 |
| AXDP HID | `CommonSetNoTargetStrategyState` | `0xC0119 / 0x0119 -> 0x0199` | 不进入 OTA | 源码 case 空、payload 不明确，名称不像升级。候选 `misc.set.noTargetStrategyState` 或其他业务域。 |
| AXDP HID | `CommonGetNoTargetStrategyState` | `0xC011A / 0x011A -> 0x019A` | 不进入 OTA | 同上。 |
| Rooms WS JSON | `RemoteUpgrade` | - | `firmware.beginOta(source.type=url)` | 可映射 URL 远程升级。 |
| Rooms WS JSON | `UpgradeProgress` | - | `firmware.getOtaState` | 可映射进度查询。 |
| Signage SDK | `RemoteUpgrade` | `数字标牌设备管理通用管理命令:RemoteUpgrade` | `firmware.beginOta(source.type=url)` | 可映射 URL 远程升级。 |
| Signage SDK | `UpgradeProgress` | - | `firmware.getOtaState` | 可映射进度查询。 |
| VM33 HTTP JSON | `Upgrade.Setup` | - | `firmware.beginOta` | 可映射 multipart 升级准备，`Total` -> file size，`Md5` -> legacy hash。 |
| VM33 HTTP JSON | `Upgrade.Upgrade` | - | STREAM `firmware.ota` 或 file 暂存模式 | 可映射分片上传，`Pos` / `Size` -> range。 |
| VM33 HTTP JSON | `Upgrade.Progress` | - | `firmware.getOtaState` / `getOtaTransferState` | 可映射本地升级进度。 |
| VM33 HTTP JSON | `Upgrade.Version` | - | `firmware.getInfo` | 可映射版本查询；`device.info` 如需承载基础版本需另行评审。 |
| VM33 HTTP JSON | `Upgrade.CloudUpgrade` | - | `firmware.beginOta(source.type=url)` | 可映射 URL 远程升级，`SerialNumber` / `Destination` 映射到 P1 `targetDevices`。 |
| VM33 HTTP JSON | `Upgrade.CloudProgress` | - | `firmware.getOtaState` | 可映射 URL 升级进度。 |

---

## 21. Registry 草案输入

采纳本文后，domain YAML 至少应包含以下事实：

```yaml
capabilities:
  - id: firmware.ota
    name: Firmware OTA
    status: mvp
    methods:
      - firmware.beginOta
      - firmware.commitOtaBatch
      - firmware.verifyOtaFiles
      - firmware.installOta
      - firmware.getOtaCapabilities
      - firmware.getOtaState
      - firmware.getOtaTransferState
      - firmware.cancelOta
      - firmware.confirmOta
      - firmware.rollbackOta
    events:
      - firmware.otaProgressReported
      - firmware.otaStateChanged
      - firmware.otaResultReported
    streamProfiles:
      - firmware.ota
```

方法分级建议：

| 方法 | 分级 | 当前处理建议 |
|---|---|---|
| `firmware.beginOta` | P0 | 需按草案 schema 采纳；旧 `firmware.begin` 只作为 legacy alias 评审输入。 |
| `firmware.commitOtaBatch` | P0 | 旧 `firmware.end` 只能作为单镜像完成语义的迁移证据。 |
| `firmware.verifyOtaFiles` | P0 | 旧 `firmware.verify` 只作为迁移证据。 |
| `firmware.installOta` | P0 | 旧 `firmware.apply` 只作为迁移证据。 |
| `firmware.getOtaCapabilities` | P1 | 能力字段进入 `FirmwareOtaCapability` schema。 |
| `firmware.getOtaState` | P1 | 状态查询。 |
| `firmware.getOtaTransferState` | P1 | 断点续传。 |
| `firmware.cancelOta` | P1 | 正常取消。 |
| `firmware.confirmOta` | P1 | A/B 确认。 |
| `firmware.rollbackOta` | P1 | 回滚。 |
| `firmware.uploadOtaChunk` | P2 | 仅兼容。 |

采纳检查：

1. 先决定旧 `firmware.begin/end/verify/apply` 是否需要 adapter-only alias；稳定方法名和 schema 以本草案评审结论为准。
2. 优先更新 `registry/domains/firmware/domain.yaml`；只有被治理为 Core/shared 时，才按需创建或更新 `registry/method/`、`registry/event/`、shared schema 或 stream profile 源文件。
3. 确认 `file.transfer` 是否已定稿；未定稿时不要把 file 暂存方法写成 P0。
4. 只把已确认的 legacy 字段写入 `legacyRefs`；`CommonSet/GetNoTargetStrategyState` 不得继续作为 OTA legacyRef。
5. 运行 Generator，确保 `protocol/axtp.protocol.yaml`、`docs/generated/*` 和 runtime generated 文件一致。

---

## 22. Binary-RPC / TLV 映射建议

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
2. `otaSessionId` 可以是 string；资源受限设备可额外返回 uint32 `transferId`。
3. `hash.value` 在 TLV 中可用 bytes 表达，JSON 中使用 lowercase hex string。
4. STREAM 数据包不携带 manifest 字段。
5. legacy adapter 可以把旧 CmdValue、slice index、md5、status 映射到新方法和字段，但不得把旧 CmdValue 作为新协议 fieldId。

---

## 23. 核心结论

```text
firmware.ota 是 OTA 控制面：
  manifest、otaSessionId、batchId、校验、安装、回滚、状态。

firmware.ota STREAM 是 P0 数据面：
  streamId、seqId、cursor、payload、ack、resume。

file.transfer 只是 P1 暂存文件模式：
  file 域定稿前，不把 file.* 方法当成稳定合同。

多文件 OTA 必须以 fileId 为单位管理：
  size、hash、cursor、missingRanges、complete。

分批次 OTA 必须有 batchId：
  commitOtaBatch 只表示数据提交，不表示校验或安装。

安装前必须校验：
  verifyOtaFiles 成功后才能 installOta。

正常取消走 firmware.cancelOta：
  stream.abort 只做底层异常释放。

URL 远程升级不需要新方法：
  使用 beginOta.source.type=url，并保留 hash/signature 校验。
```
