# AXTP ota方案

# Firmware 固件升级协议方案



版本：v0\.1  

归属域：`firmware`  

数据面：`file` / `stream`  

适用范围：设备固件升级、资源包升级、模型升级、Bootloader 升级、多文件 OTA、分批次 OTA、断点续传 OTA。



---



## 1\. 设计目标



`firmware` 域负责设备固件升级的控制面，包括：



```Plain Text
固件版本查询
OTA 能力查询
OTA 会话创建
OTA manifest 描述
多文件升级包管理
分批次提交
传输状态查询
文件校验
签名校验
安装升级
重启确认
回滚
取消升级
状态事件
进度事件
```



OTA 数据本身不应直接塞进普通 RPC response/request 中。大文件传输应复用：



```Plain Text
file
stream
```



其中：



```Plain Text
firmware
  负责 OTA 业务流程。

file
  负责 OTA 文件上传、下载、文件信息管理。

stream
  负责统一流式数据面与流控：
  streamId / seqId / cursor / ack / window / resume / abort。
```



核心原则：



```Plain Text
firmware 负责“升级什么、怎么校验、什么时候安装”；
file/stream 负责“数据怎么传”。
```



---



## 2\. 术语定义



|名称|说明|
|---|---|
|`otaSessionId`|一次 OTA 升级会话 ID|
|`packageId`|OTA 包 ID|
|`manifest`|OTA 包描述信息，声明文件列表、版本、hash、签名、目标分区等|
|`fileId`|OTA 包内部文件 ID，例如 `app`、`bootloader`、`resources`|
|`uploadedFileId`|通过 `file` 域上传完成后生成的文件 ID|
|`batchId`|一批已上传文件或文件分片的提交批次 ID|
|`cursor`|某个文件当前连续接收的字节偏移|
|`missingRanges`|某个文件缺失的数据范围，用于断点续传|
|`target`|OTA 文件写入目标，例如 application / bootloader / resource|
|`state`|OTA 会话状态|
|`phase`|OTA 当前阶段，例如 receiving\_files / verifying\_signature / writing\_application|



---



## 3\. 域职责划分



|能力|归属域|说明|
|---|---|---|
|查询固件版本|`firmware.getInfo`|当前版本、分区、构建信息|
|查询 OTA 能力|`firmware.getOtaCapabilities`|是否支持多文件、断点续传、回滚|
|创建 OTA 会话|`firmware.beginOta`|提交 manifest，创建升级上下文|
|上传 OTA 文件|`file.beginUpload` / `stream`|文件数据传输|
|提交 OTA 批次|`firmware.commitOtaBatch`|将 uploadedFileId 或分片范围绑定到 OTA 会话|
|校验 OTA 文件|`firmware.verifyOtaFiles`|hash / signature 校验|
|安装 OTA|`firmware.installOta`|写分区、切换 slot、准备重启|
|确认 OTA|`firmware.confirmOta`|A/B 系统确认新版本可用|
|回滚 OTA|`firmware.rollbackOta`|回滚到旧版本|
|取消 OTA|`firmware.cancelOta`|取消未安装的 OTA|
|重启设备|`system.reboot`|OTA 需要重启时由 system 域执行|



---



## 4\. 非目标



`firmware` 域不负责以下事项：



```Plain Text
1. 不负责大文件二进制数据的普通 RPC 传输；
2. 不直接承载完整固件文件 payload；
3. 不替代 file/stream 的上传、分片、cursor、ack、resume 能力；
4. 不负责设备普通重启，重启归 system 域；
5. 不负责网络下载 URL 的实际网络连接管理，网络基础能力归 network 域；
6. 不负责产测私有写入流程，产测私有能力归 diagnostic 或 vendor。
```



---



## 5\. 方法清单



### 5\.1 固件信息与能力



```Plain Text
firmware.getInfo
firmware.getOtaCapabilities
```



### 5\.2 OTA 会话控制



```Plain Text
firmware.beginOta
firmware.getOtaState
firmware.cancelOta
```



### 5\.3 OTA 传输与批次



```Plain Text
firmware.getOtaTransferState
firmware.commitOtaBatch
firmware.verifyOtaFiles
```



### 5\.4 OTA 安装与结果确认



```Plain Text
firmware.installOta
firmware.confirmOta
firmware.rollbackOta
```



### 5\.5 可选：Firmware 自带分片上传



```Plain Text
firmware.uploadOtaChunk
```



> MVP 推荐优先复用 `file` \+ `stream` 传输 OTA 文件，不建议首选 `firmware.uploadOtaChunk`。
> 
> 



---



## 6\. 事件清单



```Plain Text
firmware.otaStateChanged
firmware.otaProgressReported
```



其中：



```Plain Text
otaStateChanged
  OTA 状态变化事件。

otaProgressReported
  OTA 进度周期上报事件。
```



周期性进度使用 `Reported`，不要使用 `Changed`。



---



# 7\. firmware\.getInfo



## 7\.1 用途



查询当前固件信息。



## 7\.2 请求



```JSON
{
  "method": "firmware.getInfo",
  "params": {}
}
```



## 7\.3 返回



```JSON
{
  "result": {
    "currentVersion": "2.2.1",
    "buildId": "20260602.001",
    "buildTime": "2026-06-02T10:00:00Z",
    "hardwareRevision": "revA",
    "bootloaderVersion": "1.1.0",
    "partitionScheme": "ab",
    "activeSlot": "a",
    "inactiveSlot": "b",
    "lastUpdateState": "confirmed"
  }
}
```



## 7\.4 字段说明



|字段|说明|
|---|---|
|`currentVersion`|当前运行固件版本|
|`buildId`|构建 ID|
|`buildTime`|构建时间|
|`hardwareRevision`|硬件版本|
|`bootloaderVersion`|Bootloader 版本|
|`partitionScheme`|分区方案，例如 `single` / `ab`|
|`activeSlot`|当前运行 slot|
|`inactiveSlot`|可写入升级的 slot|
|`lastUpdateState`|上一次升级状态|



---



# 8\. firmware\.getOtaCapabilities



## 8\.1 用途



查询 OTA 能力范围。



## 8\.2 请求



```JSON
{
  "method": "firmware.getOtaCapabilities",
  "params": {}
}
```



## 8\.3 返回



```JSON
{
  "result": {
    "supported": true,
    "modes": ["file", "stream"],
    "supportsManifest": true,
    "requiresManifest": true,
    "supportsMultiFile": true,
    "supportsChunkedTransfer": true,
    "supportsBatchCommit": true,
    "supportsResume": true,
    "supportsMissingRanges": true,
    "supportsRollback": true,
    "supportsConfirm": true,
    "requiresReboot": true,
    "maxFileCount": 16,
    "maxPackageSize": 268435456,
    "maxFileSize": 134217728,
    "preferredChunkSize": 65536,
    "maxChunkSize": 262144,
    "hashAlgorithms": ["sha256", "crc32"],
    "signatureAlgorithms": ["rsa2048", "ecdsa_p256"],
    "targets": [
      "bootloader",
      "application",
      "resource",
      "model",
      "filesystem",
      "config",
      "recovery",
      "vendor"
    ],
    "streamProfiles": ["reliable_file"],
    "defaultStreamProfile": "reliable_file"
  }
}
```



## 8\.4 字段说明



|字段|说明|
|---|---|
|`modes`|OTA 数据传输方式，推荐 `file` / `stream`|
|`supportsMultiFile`|是否支持一个 OTA 包包含多个文件|
|`supportsChunkedTransfer`|是否支持分片传输|
|`supportsBatchCommit`|是否支持分批提交|
|`supportsResume`|是否支持断点续传|
|`supportsMissingRanges`|是否支持按缺失范围补传|
|`supportsRollback`|是否支持回滚|
|`supportsConfirm`|是否支持安装后确认|
|`maxFileCount`|OTA 包最大文件数量|
|`preferredChunkSize`|推荐 chunk 大小|
|`targets`|支持的升级目标|
|`streamProfiles`|支持的 stream profile，OTA 推荐 `reliable_file`|



---



# 9\. Manifest 设计



## 9\.1 Manifest 用途



`manifest` 是 OTA 包的核心描述，用于声明：



```Plain Text
升级目标版本
升级包包含哪些文件
每个文件大小
每个文件 hash
每个文件写入目标
整包 hash
签名
兼容性约束
安装策略
```



## 9\.2 Manifest 示例



```JSON
{
  "version": "2.3.0",
  "minCompatibleVersion": "2.0.0",
  "hardwareRevisions": ["revA", "revB"],
  "files": [
    {
      "fileId": "bootloader",
      "name": "bootloader.bin",
      "target": "bootloader",
      "required": true,
      "size": 262144,
      "hash": {
        "algorithm": "sha256",
        "value": "..."
      }
    },
    {
      "fileId": "app",
      "name": "app.bin",
      "target": "application",
      "required": true,
      "size": 8388608,
      "hash": {
        "algorithm": "sha256",
        "value": "..."
      }
    },
    {
      "fileId": "resources",
      "name": "resources.bin",
      "target": "resource",
      "required": false,
      "size": 5242880,
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
    "algorithm": "rsa2048",
    "value": "base64:..."
  }
}
```



## 9\.3 文件 target 枚举



```Plain Text
bootloader
application
resource
model
filesystem
config
recovery
vendor
```



## 9\.4 Manifest 规则



```Plain Text
1. 多文件 OTA 必须通过 manifest 声明 files[]；
2. 每个 fileId 在同一个 otaSessionId 内必须唯一；
3. 每个文件必须声明 size 和 hash；
4. required=true 的文件必须全部接收并校验通过后才能 install；
5. packageHash 用于整包校验；
6. signature 用于防篡改校验；
7. manifest 校验失败时必须拒绝 beginOta 或进入 failed 状态。
```



---



# 10\. firmware\.beginOta



## 10\.1 用途



创建一次 OTA 升级会话。



## 10\.2 请求



```JSON
{
  "method": "firmware.beginOta",
  "params": {
    "packageId": "pkg_2026_0602_001",
    "currentVersion": "2.2.1",
    "targetVersion": "2.3.0",
    "transferMode": "file",
    "streamProfile": "reliable_file",
    "manifest": {
      "version": "2.3.0",
      "minCompatibleVersion": "2.0.0",
      "hardwareRevisions": ["revA", "revB"],
      "files": [
        {
          "fileId": "app",
          "name": "app.bin",
          "target": "application",
          "required": true,
          "size": 8388608,
          "hash": {
            "algorithm": "sha256",
            "value": "..."
          }
        },
        {
          "fileId": "resources",
          "name": "resources.bin",
          "target": "resource",
          "required": false,
          "size": 5242880,
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
        "algorithm": "rsa2048",
        "value": "base64:..."
      }
    }
  }
}
```



## 10\.3 返回



```JSON
{
  "result": {
    "otaSessionId": "ota_001",
    "packageId": "pkg_2026_0602_001",
    "state": "receiving",
    "transferMode": "file",
    "streamProfile": "reliable_file",
    "preferredChunkSize": 65536,
    "acceptedFiles": [
      {
        "fileId": "app",
        "target": "application",
        "size": 8388608,
        "cursor": 0,
        "complete": false
      },
      {
        "fileId": "resources",
        "target": "resource",
        "size": 5242880,
        "cursor": 0,
        "complete": false
      }
    ]
  }
}
```



## 10\.4 规则



```Plain Text
1. beginOta 只创建 OTA 会话，不传输文件数据；
2. beginOta 必须校验 manifest 基本合法性；
3. 如果已有 OTA 会话正在进行，返回 Conflict；
4. 如果目标版本不允许升级，返回 VersionRejected；
5. 如果硬件版本不兼容，返回 IncompatibleHardware；
6. 如果 manifest 签名非法，可以直接返回 SignatureInvalid；
7. beginOta 成功后进入 receiving 状态。
```



---



# 11\. OTA 数据传输模式



## 11\.1 推荐模式：file \+ stream



MVP 推荐使用：



```Plain Text
file.beginUpload
file.uploadChunk / stream data
file.completeUpload
firmware.commitOtaBatch
```



也就是说：



```Plain Text
file/stream 负责 OTA 文件数据传输；
firmware 负责 OTA 会话、批次、校验、安装。
```



## 11\.2 可选模式：firmware\.uploadOtaChunk



如果设备不希望引入 file 域，可以提供：



```Plain Text
firmware.uploadOtaChunk
```



但不推荐作为 MVP 首选。



---



# 12\. 使用 file 域上传 OTA 文件



## 12\.1 file\.beginUpload



```JSON
{
  "method": "file.beginUpload",
  "params": {
    "name": "app.bin",
    "size": 8388608,
    "hash": {
      "algorithm": "sha256",
      "value": "..."
    },
    "streamProfile": "reliable_file"
  }
}
```



返回：



```JSON
{
  "result": {
    "uploadId": "upload_app_001",
    "streamId": 301,
    "streamProfile": "reliable_file",
    "preferredChunkSize": 65536,
    "cursor": 0,
    "nextSeqId": 0
  }
}
```



## 12\.2 stream 数据面上传



```JSON
{
  "streamId": 301,
  "seqId": 0,
  "cursor": 0,
  "timestampMs": 1710000000000,
  "payloadType": "file_chunk",
  "fileId": "app",
  "chunkOffset": 0,
  "chunkSize": 65536,
  "crc32": "0x12345678",
  "payload": "base64:AAAA..."
}
```



## 12\.3 file\.completeUpload



```JSON
{
  "method": "file.completeUpload",
  "params": {
    "uploadId": "upload_app_001"
  }
}
```



返回：



```JSON
{
  "result": {
    "uploadedFileId": "file_upload_app_001",
    "name": "app.bin",
    "size": 8388608,
    "hashVerified": true
  }
}
```



---



# 13\. firmware\.commitOtaBatch



## 13\.1 用途



提交一批 OTA 数据。



支持两类批次：



```Plain Text
1. 提交已上传完成的文件；
2. 提交某些文件的分片范围。
```



## 13\.2 提交已上传文件



```JSON
{
  "method": "firmware.commitOtaBatch",
  "params": {
    "otaSessionId": "ota_001",
    "batchId": "batch_001",
    "files": [
      {
        "fileId": "app",
        "uploadedFileId": "file_upload_app_001"
      },
      {
        "fileId": "resources",
        "uploadedFileId": "file_upload_resources_001"
      }
    ]
  }
}
```



返回：



```JSON
{
  "result": {
    "otaSessionId": "ota_001",
    "batchId": "batch_001",
    "state": "batch_committed",
    "files": [
      {
        "fileId": "app",
        "received": true,
        "receivedBytes": 8388608,
        "cursor": 8388608,
        "complete": true,
        "hashVerified": true
      },
      {
        "fileId": "resources",
        "received": true,
        "receivedBytes": 5242880,
        "cursor": 5242880,
        "complete": true,
        "hashVerified": true
      }
    ]
  }
}
```



## 13\.3 提交分片范围



```JSON
{
  "method": "firmware.commitOtaBatch",
  "params": {
    "otaSessionId": "ota_001",
    "batchId": "batch_002",
    "files": [
      {
        "fileId": "app",
        "range": {
          "offset": 0,
          "size": 1048576
        }
      },
      {
        "fileId": "resources",
        "range": {
          "offset": 0,
          "size": 1048576
        }
      }
    ]
  }
}
```



返回：



```JSON
{
  "result": {
    "otaSessionId": "ota_001",
    "batchId": "batch_002",
    "state": "batch_committed",
    "files": [
      {
        "fileId": "app",
        "receivedBytes": 1048576,
        "cursor": 1048576,
        "complete": false
      },
      {
        "fileId": "resources",
        "receivedBytes": 1048576,
        "cursor": 1048576,
        "complete": false
      }
    ]
  }
}
```



## 13\.4 规则



```Plain Text
1. batchId 在 otaSessionId 内应唯一；
2. commitOtaBatch 只表示该批数据已提交，不表示安装；
3. commitOtaBatch 后设备可以进行文件级 hash 校验；
4. required 文件全部 complete=true 后才允许 verifyOtaFiles；
5. 多文件 OTA 必须每个 fileId 独立维护 cursor / missingRanges。
```



---



# 14\. firmware\.getOtaTransferState



## 14\.1 用途



查询 OTA 文件接收状态，用于进度展示和断点续传。



## 14\.2 请求



```JSON
{
  "method": "firmware.getOtaTransferState",
  "params": {
    "otaSessionId": "ota_001"
  }
}
```



## 14\.3 返回



```JSON
{
  "result": {
    "otaSessionId": "ota_001",
    "state": "receiving",
    "files": [
      {
        "fileId": "app",
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
      },
      {
        "fileId": "resources",
        "target": "resource",
        "size": 5242880,
        "receivedBytes": 1048576,
        "cursor": 1048576,
        "complete": false,
        "missingRanges": [
          {
            "offset": 1048576,
            "size": 4194304
          }
        ]
      }
    ],
    "totalBytes": 13631488,
    "receivedBytes": 4194304,
    "progress": 30
  }
}
```



## 14\.4 断点续传规则



```Plain Text
1. 每个 fileId 独立维护 cursor；
2. 每个 fileId 独立维护 missingRanges；
3. 如果设备只支持顺序写入，可以只返回 cursor；
4. 如果设备支持乱序写入，应返回 missingRanges；
5. Client 重连后调用 getOtaTransferState，然后只补传缺失范围；
6. 不允许只用一个全局 cursor 表示多文件 OTA 进度。
```



---



# 15\. firmware\.verifyOtaFiles



## 15\.1 用途



校验 OTA 文件完整性、整包 hash 和签名。



## 15\.2 请求



```JSON
{
  "method": "firmware.verifyOtaFiles",
  "params": {
    "otaSessionId": "ota_001"
  }
}
```



## 15\.3 返回



```JSON
{
  "result": {
    "otaSessionId": "ota_001",
    "state": "verified",
    "files": [
      {
        "fileId": "app",
        "hashVerified": true
      },
      {
        "fileId": "resources",
        "hashVerified": true
      }
    ],
    "packageHashVerified": true,
    "signatureVerified": true
  }
}
```



## 15\.4 规则



```Plain Text
1. 每个文件必须单独 hash 校验；
2. required 文件必须全部校验通过；
3. packageHash 推荐校验；
4. signature 必须在 installOta 前校验；
5. 校验成功后进入 verified 状态；
6. 校验失败进入 failed 状态或返回错误。
```



---



# 16\. firmware\.installOta



## 16\.1 用途



安装已经接收并校验通过的 OTA 包。



## 16\.2 请求



```JSON
{
  "method": "firmware.installOta",
  "params": {
    "otaSessionId": "ota_001",
    "installMode": "normal"
  }
}
```



## 16\.3 返回



```JSON
{
  "result": {
    "otaSessionId": "ota_001",
    "state": "installing",
    "accepted": true,
    "installMode": "normal",
    "requiresReboot": true
  }
}
```



A/B 分区示例：



```JSON
{
  "result": {
    "otaSessionId": "ota_001",
    "state": "installing",
    "targetSlot": "b",
    "requiresReboot": true
  }
}
```



## 16\.4 installMode 枚举



```Plain Text
normal
recovery
bootloader
staged
```



## 16\.5 规则



```Plain Text
1. installOta 只能在 verified 状态后调用；
2. 安装过程中通常不允许 cancel；
3. 如果需要重启，返回 requiresReboot=true；
4. 真正重启动作应通过 system.reboot 发起，或由设备策略自动重启；
5. A/B 系统应返回 targetSlot；
6. 安装失败必须提供 errorCode 和失败 phase。
```



---



# 17\. firmware\.confirmOta



## 17\.1 用途



用于 A/B 或支持回滚的系统，在新版本启动后确认升级成功。



## 17\.2 请求



```JSON
{
  "method": "firmware.confirmOta",
  "params": {
    "otaSessionId": "ota_001"
  }
}
```



## 17\.3 返回



```JSON
{
  "result": {
    "otaSessionId": "ota_001",
    "state": "confirmed",
    "currentVersion": "2.3.0",
    "activeSlot": "b"
  }
}
```



## 17\.4 规则



```Plain Text
1. 如果设备不支持 confirm，capability 中 supportsConfirm=false；
2. 对 A/B 系统，confirmOta 用于禁止自动回滚；
3. confirm 成功后状态进入 confirmed；
4. confirm 失败应返回 InvalidState 或 ConfirmFailed。
```



---



# 18\. firmware\.rollbackOta



## 18\.1 用途



回滚到上一个可用版本。



## 18\.2 请求



```JSON
{
  "method": "firmware.rollbackOta",
  "params": {
    "reason": "user_request"
  }
}
```



## 18\.3 返回



```JSON
{
  "result": {
    "state": "rollback_scheduled",
    "requiresReboot": true,
    "targetVersion": "2.2.1"
  }
}
```



## 18\.4 规则



```Plain Text
1. 仅 supportsRollback=true 时支持；
2. 回滚可能需要重启；
3. 如果没有可回滚版本，返回 RollbackUnavailable；
4. 回滚执行状态通过 otaStateChanged 上报。
```



---



# 19\. firmware\.cancelOta



## 19\.1 用途



取消 OTA 会话。



## 19\.2 请求



```JSON
{
  "method": "firmware.cancelOta",
  "params": {
    "otaSessionId": "ota_001",
    "reason": "user_request"
  }
}
```



## 19\.3 返回



```JSON
{
  "result": {
    "otaSessionId": "ota_001",
    "state": "cancelled"
  }
}
```



## 19\.4 规则



```Plain Text
1. receiving / verifying / verified 阶段可以取消；
2. installing 阶段通常不允许取消；
3. cancel 后设备应清理临时文件；
4. 如果数据流仍在传输，应终止相关 file/stream 任务；
5. cancel 不等于 rollback。
```



---



# 20\. firmware\.getOtaState



## 20\.1 用途



查询 OTA 会话整体状态。



## 20\.2 请求



```JSON
{
  "method": "firmware.getOtaState",
  "params": {
    "otaSessionId": "ota_001"
  }
}
```



## 20\.3 返回



```JSON
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
    "updatedAtMs": 1710000100000
  }
}
```



---



# 21\. OTA 状态枚举



```Plain Text
idle
preparing
receiving
batch_committed
verifying
verified
installing
installed
reboot_required
confirmed
rollback_scheduled
rolling_back
cancelled
failed
unsupported
```



## 21\.1 状态说明



|状态|说明|
|---|---|
|`idle`|无 OTA 任务|
|`preparing`|正在准备升级|
|`receiving`|正在接收 OTA 文件|
|`batch_committed`|某批次已提交|
|`verifying`|正在校验文件或签名|
|`verified`|校验完成|
|`installing`|正在安装|
|`installed`|安装完成|
|`reboot_required`|需要重启|
|`confirmed`|新版本已确认|
|`rollback_scheduled`|已计划回滚|
|`rolling_back`|正在回滚|
|`cancelled`|已取消|
|`failed`|失败|
|`unsupported`|不支持|



---



# 22\. OTA phase 枚举



```Plain Text
receiving_manifest
receiving_files
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



---



# 23\. firmware\.otaStateChanged



## 23\.1 用途



OTA 状态变化时上报。



## 23\.2 接收文件阶段



```JSON
{
  "event": "firmware.otaStateChanged",
  "params": {
    "otaSessionId": "ota_001",
    "state": "receiving",
    "phase": "receiving_files",
    "progress": 12,
    "timestampMs": 1710000000000
  }
}
```



## 23\.3 安装阶段



```JSON
{
  "event": "firmware.otaStateChanged",
  "params": {
    "otaSessionId": "ota_001",
    "state": "installing",
    "phase": "writing_application",
    "progress": 72,
    "timestampMs": 1710000000000
  }
}
```



## 23\.4 需要重启



```JSON
{
  "event": "firmware.otaStateChanged",
  "params": {
    "otaSessionId": "ota_001",
    "state": "reboot_required",
    "phase": "waiting_reboot",
    "progress": 100,
    "requiresReboot": true,
    "timestampMs": 1710000000000
  }
}
```



## 23\.5 失败事件



```JSON
{
  "event": "firmware.otaStateChanged",
  "params": {
    "otaSessionId": "ota_001",
    "state": "failed",
    "phase": "verifying_files",
    "errorCode": "hash_mismatch",
    "message": "app.bin hash mismatch",
    "fileId": "app",
    "timestampMs": 1710000000000
  }
}
```



---



# 24\. firmware\.otaProgressReported



## 24\.1 用途



周期性上报 OTA 进度。



## 24\.2 示例



```JSON
{
  "event": "firmware.otaProgressReported",
  "params": {
    "otaSessionId": "ota_001",
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
      },
      {
        "fileId": "resources",
        "receivedBytes": 1048576,
        "size": 5242880,
        "progress": 20
      }
    ],
    "timestampMs": 1710000010000
  }
}
```



## 24\.3 规则



```Plain Text
1. 周期性进度事件使用 Reported；
2. progress 范围为 0-100；
3. 多文件 OTA 应包含 files[] 进度；
4. receiving 阶段 progress 可以按 receivedBytes / totalBytes 计算；
5. installing 阶段 progress 由设备内部安装阶段决定。
```



---



# 25\. 多文件 OTA 规则



多文件 OTA 是本协议的核心能力。



```Plain Text
1. 一个 otaSessionId 可以包含多个 fileId；
2. 每个 fileId 独立维护 size、hash、cursor、missingRanges；
3. 每个 fileId 可以对应一个 uploadedFileId；
4. OTA 数据可以分多个 batchId 提交；
5. commitOtaBatch 不等于 verify；
6. verifyOtaFiles 不等于 install；
7. installOta 必须在 required 文件完整且校验通过后执行；
8. 不允许只用一个全局 cursor 表示多文件进度。
```



---



# 26\. 分批次 OTA 规则



```Plain Text
1. batchId 用于标识一次批次提交；
2. 一个 batch 可以包含一个或多个文件；
3. 一个 batch 可以包含完整文件，也可以包含文件 range；
4. batch 提交成功后，设备可以更新 transfer state；
5. batch 提交失败时应指出具体 fileId 和 range；
6. batchId 在 otaSessionId 内应唯一；
7. 分批提交有利于低带宽、低内存设备逐步处理 OTA 数据。
```



---



# 27\. 断点续传规则



```Plain Text
1. Client 断线重连后调用 firmware.getOtaTransferState；
2. 设备返回每个 fileId 的 cursor 和 missingRanges；
3. 如果设备只支持顺序写入，Client 从 cursor 继续上传；
4. 如果设备支持乱序补传，Client 按 missingRanges 补传；
5. reliable_file profile 可配合 stream.ack / stream.resume；
6. 断点续传必须以 fileId 为单位管理。
```



---



# 28\. 可选：firmware\.uploadOtaChunk



如果项目决定不依赖 file 域，可以提供该接口。



## 28\.1 请求



```JSON
{
  "method": "firmware.uploadOtaChunk",
  "params": {
    "otaSessionId": "ota_001",
    "fileId": "app",
    "batchId": "batch_001",
    "chunkIndex": 0,
    "chunkOffset": 0,
    "chunkSize": 65536,
    "crc32": "0x12345678",
    "data": "base64:AAAA..."
  }
}
```



## 28\.2 返回



```JSON
{
  "result": {
    "otaSessionId": "ota_001",
    "fileId": "app",
    "batchId": "batch_001",
    "chunkIndex": 0,
    "chunkOffset": 0,
    "received": true,
    "nextOffset": 65536
  }
}
```



## 28\.3 说明



```Plain Text
firmware.uploadOtaChunk 会让 firmware 域承担数据传输责任。
MVP 不推荐首选。
推荐优先使用 file/stream 传输 OTA 文件。
```



---



# 29\. 与 stream 域关系



OTA 推荐使用：



```Plain Text
streamProfile = reliable_file
```



`reliable_file` 特点：



```Plain Text
reliability = reliable
ordered = true
ackMode = window
lossRecovery = resume_from_cursor
backpressurePolicy = pause_producer
supportsResume = true
supportsMissingRanges = true
```



OTA 数据面可以复用 stream 字段：



```Plain Text
streamId
seqId
cursor
payloadType = file_chunk 或 firmware_chunk
payload
```



正常 OTA 取消应使用：



```Plain Text
firmware.cancelOta
```



异常释放底层 stream 时可以使用：



```Plain Text
stream.abort
```



但 `stream.abort` 不应替代 `firmware.cancelOta`。



---



# 30\. 与 system 域关系



OTA 安装后可能需要重启。



推荐方式：



```Plain Text
firmware.installOta 返回 requiresReboot=true；
Client 调用 system.reboot；
设备重启；
Client 重连后调用 firmware.getInfo / firmware.confirmOta。
```



不建议把通用重启放在 firmware 域内。



---



# 31\. 与 diagnostic / vendor 域关系



以下能力不属于通用 firmware OTA 协议：



```Plain Text
产测写 boot 参数
擦写 boot 区
写入工厂校准参数
写入算法 license
厂商私有 recovery 命令
```



建议放入：



```Plain Text
diagnostic
vendor
```



不要混入标准 OTA 协议。



---



# 32\. 错误处理



推荐错误码：



```Plain Text
InvalidParams
  参数非法，manifest 格式错误，fileId 不存在，range 越界。

UnsupportedCapability
  不支持 OTA、多文件 OTA、断点续传、回滚等。

VersionRejected
  目标版本非法、版本过旧、不允许降级。

IncompatibleHardware
  OTA 包不适配当前硬件版本。

HashMismatch
  文件 hash 校验失败。

SignatureInvalid
  签名校验失败。

StorageFull
  存储空间不足。

TransferIncomplete
  文件未完整接收。

Conflict
  已有 OTA 会话进行中，或当前状态不允许操作。

ServerBusy
  设备繁忙。

PermissionDenied
  当前用户无升级权限。

InstallFailed
  安装失败。

RollbackUnavailable
  无可回滚版本。

RollbackFailed
  回滚失败。

ConfirmFailed
  确认升级失败。
```



## 32\.1 错误示例：文件未传完



```JSON
{
  "error": {
    "code": "TransferIncomplete",
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



## 32\.2 错误示例：hash 不匹配



```JSON
{
  "error": {
    "code": "HashMismatch",
    "message": "app.bin hash mismatch",
    "data": {
      "otaSessionId": "ota_001",
      "fileId": "app",
      "expected": "...",
      "actual": "..."
    }
  }
}
```



---



# 33\. Capability 注册建议



建议新增 capability：



```Plain Text
firmware.ota
```



对应方法：



```Plain Text
firmware.getInfo
firmware.getOtaCapabilities
firmware.beginOta
firmware.getOtaState
firmware.getOtaTransferState
firmware.commitOtaBatch
firmware.verifyOtaFiles
firmware.installOta
firmware.confirmOta
firmware.rollbackOta
firmware.cancelOta
```



可选方法：



```Plain Text
firmware.uploadOtaChunk
```



对应事件：



```Plain Text
firmware.otaStateChanged
firmware.otaProgressReported
```



---



# 34\. Binary / TLV 映射建议



JSON\-RPC 中使用可读字段：



```Plain Text
otaSessionId
packageId
fileId
batchId
cursor
missingRanges
target
state
phase
```



Binary / TLV 中可以映射为数字 ID：



```Plain Text
otaSessionId: string
fileId: string or uint16 mapping
batchId: string or uint16 mapping
chunkOffset: uint64
chunkSize: uint32
cursor: uint64
hashAlgorithm: uint8
target: uint8
state: uint8
phase: uint8
```



推荐 target ID：



```Plain Text
0x01 bootloader
0x02 application
0x03 resource
0x04 model
0x05 filesystem
0x06 config
0x07 recovery
0xFF vendor
```



推荐 state ID：



```Plain Text
0x00 idle
0x01 preparing
0x02 receiving
0x03 batch_committed
0x04 verifying
0x05 verified
0x06 installing
0x07 installed
0x08 reboot_required
0x09 confirmed
0x0A rollback_scheduled
0x0B rolling_back
0x0C cancelled
0x0D failed
```



数字 ID 仅用于二进制映射，JSON 协议中继续使用字符串。



---



# 35\. 推荐 MVP



MVP 推荐实现：



```Plain Text
firmware.getInfo
firmware.getOtaCapabilities
firmware.beginOta
firmware.getOtaState
firmware.getOtaTransferState
firmware.commitOtaBatch
firmware.verifyOtaFiles
firmware.installOta
firmware.cancelOta

firmware.otaStateChanged
firmware.otaProgressReported
```



MVP 推荐传输方式：



```Plain Text
file + stream
```



MVP 推荐 stream profile：



```Plain Text
reliable_file
```



MVP 可暂不实现：



```Plain Text
firmware.uploadOtaChunk
firmware.confirmOta
firmware.rollbackOta
```



但如果设备使用 A/B 分区，建议支持：



```Plain Text
firmware.confirmOta
firmware.rollbackOta
```



---



# 36\. 完整推荐流程



```Plain Text
1. Client -> firmware.getInfo
2. Client -> firmware.getOtaCapabilities
3. Client -> firmware.beginOta(manifest)
4. Client -> file.beginUpload(app.bin, streamProfile=reliable_file)
5. Client -> stream data(file_chunk)
6. Client -> file.completeUpload
7. Client -> firmware.commitOtaBatch(app uploadedFileId)
8. Client -> file.beginUpload(resources.bin)
9. Client -> stream data(file_chunk)
10. Client -> file.completeUpload
11. Client -> firmware.commitOtaBatch(resources uploadedFileId)
12. Client -> firmware.getOtaTransferState
13. Client -> firmware.verifyOtaFiles
14. Client -> firmware.installOta
15. firmware.otaStateChanged(reboot_required)
16. Client -> system.reboot
17. Client reconnect
18. Client -> firmware.getInfo
19. Client -> firmware.confirmOta
```



---



# 37\. 最终接口清单



```Plain Text
firmware.getInfo
firmware.getOtaCapabilities
firmware.beginOta
firmware.getOtaState
firmware.getOtaTransferState
firmware.commitOtaBatch
firmware.verifyOtaFiles
firmware.installOta
firmware.confirmOta
firmware.rollbackOta
firmware.cancelOta

firmware.otaStateChanged
firmware.otaProgressReported
```



可选：



```Plain Text
firmware.uploadOtaChunk
```



---



# 38\. 核心结论



```Plain Text
firmware 域负责 OTA 控制面：
  manifest、otaSessionId、batchId、校验、安装、回滚、状态。

file/stream 负责 OTA 数据面：
  file upload、streamId、seqId、cursor、payload、ack、resume。

多文件 OTA 必须以 fileId 为单位管理进度：
  size、hash、cursor、missingRanges。

分批次 OTA 必须有 batchId：
  commitOtaBatch 只表示批次提交，不表示安装。

安装前必须校验：
  verifyOtaFiles 成功后才能 installOta。

正常取消走 firmware.cancelOta；
底层异常释放才使用 stream.abort。
```



