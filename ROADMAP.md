# AXTP Roadmap

AXTP 的目标不是“继续写更多协议文档”，而是把协议库建设成一套业务能真正接入、迁移、验证、发布的工程体系。

主迭代路径：

```text
业务需求
  -> 场景流程
  -> 协议 RFC / 草案
  -> registry 事实源
  -> generated 协议参考
  -> runtime / SDK / 工具消费
  -> conformance / release 验收
```

主库聚焦协议语义、治理规则、registry 事实源、generated reference、release artifact 和 conformance cases。Runtime、SDK、CLI、mock server、adapter 和语言专属实现维护在独立 runtime / tool 仓库中。

## 为什么现在要做 AXTP

AXTP 不是为了“换一种协议格式”，而是为了解决多产品、多端、多传输长期叠加后的交付问题。

过去的现实问题包括：

- 不同产品线协议不统一，新产品经常重新设计一套通信方案。
- HID、TCP、WebSocket、HTTP、BLE、USB 等传输形态割裂，SDK 和工具链难以复用。
- 老二进制协议适合命令表，但不擅长事件、流控、能力声明和复杂会话。
- HTTP 方案适合普通接口，但不适合低延迟双向交互、设备事件和连续流数据。
- 设备控制、事件通知、音视频流、升级流程容易混在一起，导致协议边界不清。
- 外部客户需要统一 SDK 和稳定接入方式，团队必须能快速交付，而不是每次定制。
- 已有产品经验已经验证：当设备和软件之间有统一、清晰、低延迟的交互协议时，整体体验会更丝滑，调试和交付也更可控。

因此第一阶段不追求把所有协议域一次写全，而是先让 NA20 这条真实链路跑通：发现、连接、配对、拉流、流控事件、OTA 和一致性测试。只要真实链路成立，后续 AXDP、Rooms、VM33、数字标牌和 uxplay 的迁移就不再是纯文档推动。

## 路线总览

| 阶段 | 目标 | 核心交付 | 验收 |
|---|---|---|---|
| Phase 1 | 核心协议冻结 | Hello / Identify / OPEN / ACCEPT / HEARTBEAT / CLOSE / sid / requestId / event / error / RPC encoding | 协议状态机明确，JSON 与 Standard Framed 两条链路都能解释 |
| Phase 2 | Core Runtime MVP | Frame、Message、Session、Request、Event、Stream、Error、Capability、Transport 抽象 | client / server 可以完成最小通信闭环 |
| Phase 3 | NA20 首个落地 | pairing、OTA、stream、flow-control、server endpoint、`axtpctl` | 上位机能发现、配对、拉流、收事件、触发升级流程 |
| Phase 4 | 老协议迁移策略 | AXDP 重建，Rooms / Signage / uxplay 平移，VM33 HTTP + AXTP hybrid | 老业务可通过 AXTP 统一入口访问，且迁移路径清楚 |
| Phase 5 | 能力域评审节奏 | `device.*`、`system.*`、framing、camera、diagnostic、room/signage 等分批评审 | 每个 capability 都有 schema、示例、错误码、legacy 映射和测试 |
| Phase 6 | 发现与工具链 | `axtp.discovery`、`axtpctl`、mock server、probe、inspector、replay | 研发能找到设备、连上设备、调试协议、回放问题 |
| Phase 7 | Conformance 与发布质量 | core conformance、业务 conformance、runtime 互通矩阵、release artifact | 多端 runtime 行为一致，发布可验证 |
| v1.0 | 稳定协议基础设施 | 稳定 wire protocol、registry、runtime 接口、工具链、迁移体系 | 新设备接入、老协议迁移、新 capability 新增都有标准流程 |

## 0. 当前定位

AXTP 协议库承担四类职责。

| 职责 | 范围 | 主库边界 |
|---|---|---|
| 协议基础设施 | Hello / Identify / OPEN / ACCEPT / HEARTBEAT / CLOSE / sid / requestId / event / error / RPC encoding / low-bandwidth 边界等核心交互流程 | 规则写入 `docs/specs/`、事实写入 `registry/`、生成 `protocol/axtp.protocol.yaml` |
| 业务能力承载 | `device.*`、`system.*`、framing、focus/zoom/ptz、camera image/exposure/calibration/whiteBalance、diagnostic、room/signage、OTA、video/audio stream RPC 控制面 + STREAM 数据面、flow-control event | 草案进 `docs/protocol/`，采纳后进入 `registry/domains/` |
| 老协议迁移适配 | AXDP、Rooms、VM33、数字标牌、uxplay 等历史协议族的迁移、平移、adapter 策略 | 证据和计划放 `docs/legacy-migration/`，实现放 runtime / adapter 仓库 |
| 研发接入工具链 | server endpoint、client CLI、`axtpctl`、SDK/runtime、discovery、mock server、conformance、probe、inspector、replay | 主库提供 spec、generated、conformance；工具实现放外部仓库 |

## 1. Phase 1：协议核心闭环冻结

目标：先把 AXTP 最小可运行协议闭环定下来，避免业务侧一边接入一边修改底层交互。

建议节奏：Kickoff 前后 1 周内完成核心规则确认。

### 1.1 核心握手流程

| 模块 | 需要冻结的问题 | 当前主库落点 |
|---|---|---|
| Hello | 设备与客户端建立连接后的基础能力声明 | `docs/specs/1-core/06-RPC-Session.md` |
| Identify | 鉴权、设备身份、客户端身份、权限、事件订阅 | `docs/specs/1-core/06-RPC-Session.md` |
| OPEN / ACCEPT | Standard Framed session 打开、参数协商、失败返回 | `docs/specs/1-core/05-Control-Session.md` |
| sid | 谁生成、何时返回、断线恢复如何处理 | `docs/specs/1-core/06-RPC-Session.md` |
| close | session / stream / channel 关闭规则 | `docs/specs/1-core/05-Control-Session.md`、`docs/specs/1-core/07-Stream-Data-Plane.md` |
| error | 协议级错误码和业务级错误码边界 | `docs/specs/2-registry/04-Errors-Registry.md`、`registry/error/` |
| event | 事件推送模型、订阅/非订阅边界 | `docs/specs/2-registry/03-Events-Registry.md` |

核心链路：

```text
WebSocket JSON:
  connect -> Hello -> Identify -> Identified -> RPC / Event -> close

Standard Framed:
  transport connect -> CONTROL OPEN -> ACCEPT -> RPC / STREAM / Event -> CONTROL HEARTBEAT -> CONTROL CLOSE
```

### 1.2 ID 生命周期

| ID | 用途 | 必须明确 |
|---|---|---|
| `requestId` | 一次 RPC 请求与响应匹配 | 分配、超时、复用、乱序响应处理 |
| `sid` | JSON RPC session 路由与恢复 | 分配方、恢复方式、网关路由 |
| `streamId` | 某一路连续数据流 | open / data / close / resume |
| `seqId` | 流数据顺序编号 | 丢包、重传、乱序和验收规则 |
| `eventId` | 事件 registry 标识 | 事件名、事件 ID、订阅 mask 的一致性 |

### 1.3 最小 RPC 模型

AXTP core 至少冻结以下语义：

- Request
- Response
- Event
- Error
- Media stream open（`video.openStream` / `audio.startRecording(deliveryMode=stream)`）
- STREAM 16B data packet
- Media stream close（`video.closeStream` / `audio.stopRecording`）
- JSON RPC 与 Binary / TLV 映射关系

验收标准：`AXTP-WS-JSON` 能完成 Hello / Identify / Request / Response / Event；`AXTP-TCP` 或 `AXTP-USB-HID` 能在 CONTROL OPEN / ACCEPT 后承载 RPC 和 STREAM，并实现 HEARTBEAT / CLOSE。P0 STREAM 重点是 audio/video 媒体流，ACK/NACK 严格重传仍后续扩展。

## 2. Phase 2：AXTP Core Runtime MVP

目标：让所有 runtime 都能复用同一套最小协议核心，而不是每种语言各自理解协议。

建议节奏：Kickoff 后 1 到 2 周。

### 2.1 Core 必备能力

| 能力 | 说明 | 主库输入 |
|---|---|---|
| Frame 编解码 | 统一封包、拆包、分片、CRC | `docs/specs/1-core/03-Frame-and-Payload.md` |
| Message 编解码 | Request / Response / Event / Error | `docs/specs/1-core/06-RPC-Session.md` |
| Session 管理 | sid 生命周期、Identify / Identified | `docs/specs/1-core/06-RPC-Session.md` |
| Request 管理 | requestId 分配、超时、响应匹配 | `docs/specs/1-core/06-RPC-Session.md` |
| Event 分发 | 事件注册、订阅、派发 | `docs/specs/2-registry/03-Events-Registry.md` |
| Stream 管理 | stream open / data / close / resume | `docs/specs/1-core/07-Stream-Data-Plane.md` |
| Error 处理 | 协议错误、业务错误、传输错误 | `registry/error/` |
| Capability Registry | 能力声明、能力查询、版本声明 | `registry/capability/`、`registry/domains/` |
| Transport 抽象 | 不直接关心 WebSocket / HID / BLE / TCP | runtime 仓库实现 |

### 2.2 Runtime 统一分层

各语言 runtime 建议遵守同一分层：

```text
Transport
  -> Endpoint
  -> Core
  -> Broker / Dispatcher
  -> Business Handler
```

| 层 | 职责 |
|---|---|
| Transport | 只负责字节收发或 WebSocket message 收发 |
| Endpoint | 连接生命周期、握手、收发调度 |
| Core | 协议编解码、请求响应、事件、流、错误 |
| Broker / Dispatcher | 方法注册、事件订阅、业务路由 |
| Business Handler | 具体业务实现 |

这一分层应在 C、C++、TypeScript、Python、Flutter runtime 中保持一致。主库只定义 contract，runtime 仓库实现代码。

## 3. Phase 3：NA20 Dongle 首个落地闭环

目标：用 NA20 Dongle 做第一条真实业务链路，把 AXTP 从协议变成可运行系统。

建议节奏：Kickoff 后 1 到 3 周。

### 3.1 Server Endpoint

NA20 第一版 server endpoint 至少支持：

| 能力 | 优先级 |
|---|---|
| 设备启动并监听 | P0 |
| Hello / Identify | P0 |
| Capability 上报 | P0 |
| OPEN / ACCEPT | P0 |
| 基础 RPC 调用 | P0 |
| Event 推送 | P0 |
| Stream open | P0 |
| Stream data 上送 | P0 |
| Stream close | P0 |
| 错误返回 | P0 |

### 3.2 Client CLI / axtpctl

第一版 CLI 不需要漂亮，但必须能作为研发调试工具。

```bash
axtpctl discover
axtpctl connect <device>
axtpctl hello
axtpctl identify
axtpctl capabilities
axtpctl call device.system.getInfo
axtpctl stream open camera.preview
axtpctl stream pull camera.preview --output preview.raw
axtpctl events watch
```

### 3.3 NA20 首批业务闭环

| 能力 | 建议 domain.feature | 说明 |
|---|---|---|
| 配对流程 | `device.pairing` | 设备发现、配对、确认、取消 |
| 设备升级 | `firmware.update` / `firmware.updatePolicy` | OTA 准备、传输、校验、提交 |
| 流传输到上位机 | `video.stream` / `audio.recording` / `stream.flowControl` | 流建立、拉流、状态事件 |
| 流控事件 | `stream.flowControl` | pause / resume / congestion / dropped 等事件 |

主库产物应进入 `docs/protocol/`、`docs/flows/`、`registry/domains/` 和 `docs/conformance/`；NA20 代码实现进入对应 runtime / device 仓库。

## 4. Phase 4：老协议迁移策略

目标：不是一次性重写所有老协议，而是为每类老协议定义清楚迁移路径。

### 4.1 AXDP：废弃，按 AXTP 新域重建

AXDP 不建议做长期兼容层，而应沉淀迁移映射表，并逐步转为 AXTP 新 domain / feature。

优先顺序：

1. `device.*` / `system.*`
2. `video.framing`
3. `camera.focus` / `camera.zoom` / `camera.ptz`
4. `camera.image` / `camera.exposure` / `camera.calibration` / `camera.whiteBalance`
5. `diagnostic.*`
6. `axtpctl` / AXTP core follow-up
7. `room.*` / `signage.*`

迁移材料放在：

```text
docs/legacy-migration/evidence/
docs/legacy-migration/classification/
docs/legacy-migration/plans/
docs/legacy-migration/generated/
docs/legacy-migration/planning/
```

每条迁移记录应说明：

- 老协议命令
- 老参数
- 老返回
- 旧交互方式
- 新 AXTP capability
- 新 AXTP method
- 新 params / result
- 是否保留
- 是否废弃
- 迁移优先级
- 负责人
- 评审状态

### 4.2 Rooms：协议平移，通过适配层接入

Rooms 第一阶段不强行重构业务，而是通过 adapter 接入 AXTP。

```text
AXTP Client
  -> AXTP Endpoint
  -> Rooms Adapter
  -> Legacy Rooms Handler
```

| 项 | 策略 |
|---|---|
| 老 command | 保留 |
| 老参数 | 保留 |
| 老返回 | 保留 |
| AXTP method | 做一层映射 |
| 交互流程 | 用 AXTP request / response / event 包一层 |
| 是否重构业务 | 第一阶段暂不重构 |
| 是否进入 capability registry | 是，但标记 legacy-backed |

第一阶段可以先提供 legacy bridge：

```json
{
  "method": "room.legacy.call",
  "params": {
    "command": "old_rooms_command",
    "payload": {}
  }
}
```

后续逐步映射成标准能力：

```json
{
  "method": "room.device.getStatus",
  "params": {}
}
```

### 4.3 VM33：老 HTTP 保留，新能力逐步 AXTP 化

VM33 不适合一次性迁移。

| 阶段 | 策略 |
|---|---|
| 当前版本 | HTTP 老协议继续可用 |
| 新增功能 | 优先走 AXTP |
| 存量核心功能 | 暂不强迁 |
| 高频交互能力 | 优先 AXTP 化 |
| 事件类能力 | 优先 AXTP 化 |

VM33 第一批 AXTP 化候选：

- focus
- zoom
- ptz
- 篮球事件
- 设备状态事件
- 低延迟控制事件

这些能力最能体现 AXTP 的价值：双向、事件化、低延迟、统一能力声明。

### 4.4 数字标牌：平移归档

数字标牌方案先平移，再逐步整理成标准 capability。

候选域：

- `signage.display`
- `signage.playlist`
- `signage.media`
- `signage.schedule`
- `signage.device`

### 4.5 uxplay：平移归档

uxplay 不应过度协议化，先作为 feature 接入。

候选域：

- `uxplay.session`
- `uxplay.cast`
- `uxplay.device`
- `uxplay.event`

如果 uxplay 本身已有稳定交互，第一阶段通过 adapter 接入 AXTP。

## 5. Phase 5：能力域与协议评审节奏

目标：按业务可落地顺序推进，而不是按文档编号推进。

### 5.1 协议新增与评审顺序

| 顺序 | 协议域 | 说明 | 优先级 |
|---:|---|---|---|
| 1 | `device.*` / `system.*` | 设备基础信息、版本、状态、重启、初始化、时间同步 | P0 |
| 2 | `video.framing` | 画面模式、构图模式、跟踪模式 | P0 |
| 3 | `camera.focus` / `camera.zoom` / `camera.ptz` | 高频控制能力 | P0 |
| 4 | `camera.image` / `camera.exposure` / `camera.calibration` / `camera.whiteBalance` | 图像与相机调节 | P1 |
| 5 | `diagnostic.*` | 工厂测试、校准、诊断、产测 | P1 |
| 6 | `axtpctl` / AXTP core | 工具与核心库完善 | P0 持续 |
| 7 | `room.*` / `signage.*` | 老协议迁移与业务域归档 | P2 |

高覆盖候选可按产品排期并行推进：

- `network.wifi` / `network.ip` / `network.ap`
- `firmware.update` / `firmware.updatePolicy`
- `audio.volume` / `audio.input` / `audio.recording`
- `video.stream` / `video.ndi` / `video.rtsp`

### 5.2 每个能力域的标准交付物

每新增一个 domain / feature，都必须包含：

1. capability 定义
2. method 列表
3. params schema
4. result schema
5. event 列表
6. error code
7. 示例请求 / 响应
8. legacy 兼容映射
9. runtime handler 示例或实现说明
10. conformance test case

否则协议容易写完但没人能实现、没人能测、没人能交付 SDK。

## 6. Phase 6：发现协议与研发工具链

目标：让研发能找到设备、连上设备、调试协议、验证协议。

### 6.1 Discovery 统一模型

建议定义 `axtp.discovery`，统一抽象 mDNS、USB、BLE 广播、HID 枚举和 WebSocket endpoint。

```json
{
  "deviceId": "xxx",
  "name": "NA20 Dongle",
  "model": "NA20",
  "transport": "usb|mdns|ble|hid|websocket",
  "endpoint": "...",
  "capabilities": [],
  "version": "..."
}
```

CLI 对外统一：

```bash
axtpctl discover
axtpctl discover --transport mdns
axtpctl discover --transport usb
axtpctl discover --json
```

### 6.2 研发工具

| 工具 | 用途 | 优先级 |
|---|---|---|
| `axtpctl` | 标准命令行客户端 | P0 |
| `axtp-mock-server` | 模拟设备端 | P0 |
| `axtp-conformance` | 自动化协议一致性测试 | P0 |
| `axtp-probe` | 探测设备能力、协议版本、连接状态 | P1 |
| `axtp-inspector` | 抓包、解析、显示 AXTP 消息 | P1 |
| `axtp-replay` | 回放历史协议交互 | P2 |

## 7. Phase 7：Conformance 与发布质量

目标：让 AXTP 不只是“能跑”，而是“各端实现一致”。

### 7.1 Core conformance

第一批测试用例：

- Hello 成功
- Identify 成功
- Identify 失败
- OPEN 成功
- OPEN 失败
- ACCEPT 返回 sid / session 参数
- RPC call 成功
- RPC call 超时
- Unknown method
- Event 推送
- Stream open
- Stream data
- Stream close
- Error code 映射
- Capability 查询

### 7.2 NA20 业务 conformance

第一批业务验收候选：

- `pairing.start`
- `pairing.confirm`
- `pairing.cancel`
- `ota.prepare`
- `ota.transfer`
- `ota.commit`
- `video.openStream`
- `video.closeStream`
- `audio.startRecording`
- `audio.stopRecording`
- `flowControl.pause`
- `flowControl.resume`
- `flowControl.event`

### 7.3 Runtime 互通矩阵

| Runtime | Server | Client | Mock | Conformance |
|---|---|---|---|---|
| C | 必须 | 可选 | 可选 | 必须 |
| C++ | 必须 | 必须 | 可选 | 必须 |
| TypeScript | 可选 | 必须 | 必须 | 必须 |
| Python | 可选 | 必须 | 必须 | 必须 |
| Flutter | 可选 | 必须 | 可选 | 必须 |

## 8. 推荐版本路线

### v0.1：协议核心可跑

目标：AXTP 最小闭环。

交付：

- Hello / Identify / OPEN / ACCEPT
- Request / Response / Event / Error
- sid / requestId 规则
- 基础 capability
- C++ core MVP
- TypeScript / Python client demo
- `axtpctl` 初版
- mock server 初版

验收标准：

- client 能连 server
- 能完成 Hello / Identify
- 能调用一个 method
- 能收到一个 event
- 能查询 capabilities

### v0.2：NA20 首个业务闭环

目标：NA20 Dongle 实际落地。

交付：

- NA20 server endpoint
- pairing 协议
- OTA 协议
- stream 协议
- flow-control event
- `axtpctl stream pull`
- 基础 conformance

验收标准：

- 上位机能发现 NA20
- 能配对
- 能拉流
- 能收到流控事件
- 能触发升级流程

### v0.3：设备控制能力完善

目标：覆盖核心业务控制能力。

交付：

- `device.*` / `system.*`
- framing mode
- focus / zoom / ptz
- camera image / exposure / whiteBalance / calibration

验收标准：

- 核心设备控制从老协议迁移到 AXTP
- CLI 和 SDK 都能调用
- 有事件、有错误码、有测试用例

### v0.4：老协议迁移适配

目标：Rooms / Signage / uxplay / VM33 都有明确接入方式。

交付：

- Rooms Adapter
- Signage Adapter
- uxplay Adapter
- VM33 HTTP + AXTP hybrid 方案
- AXDP migration docs
- legacy mapping sheets / docs

验收标准：

- 老协议功能可以通过 AXTP 统一入口访问
- 不强制一次性重写业务
- 每个老协议都有迁移映射表

### v0.5：工具链与多端 runtime

目标：让研发可以规模化接入。

交付：

- `axtpctl` 完善
- `axtp-probe`
- `axtp-mock-server`
- `axtp-conformance`
- C / C++ / TypeScript / Python / Flutter runtime 基础一致
- 自动生成 schema / docs / test cases

验收标准：

- 任意 runtime 都可以跑 core conformance
- 业务侧可以用 CLI 调试协议
- 协议文档、SDK、测试用例同步生成

### v1.0：稳定协议库

目标：协议、runtime、工具、迁移体系正式稳定。

交付：

- 稳定 core API
- 稳定 wire protocol
- 稳定 capability registry
- 稳定 error code
- 稳定 runtime 接口
- 完整 conformance suite
- 完整 migration docs
- release / tag 自动化

验收标准：

- 新设备接入 AXTP 有标准流程
- 老协议迁移有标准流程
- 新增 capability 有标准流程
- 多端 runtime 行为一致
- 业务侧不需要理解底层传输差异

## 9. 建议任务拆分

| 团队 | 负责事项 |
|---|---|
| 协议组 / 架构侧 | core handshake、sid/requestId/streamId 生命周期、capability registry、error code、domain-feature-method 规范、legacy migration mapping、协议评审 |
| C++ / 嵌入式侧 | `axtp-core`、server endpoint、NA20 endpoint、stream sender、OTA receiver、pairing handler、transport adapter |
| 上位机 / 客户端侧 | `axtpctl`、client SDK、stream pull、event watch、device discovery、debug inspector |
| 测试 / 工具侧 | mock server、conformance tests、replay tool、probe tool、CI 测试矩阵 |
| 业务侧 | device/system method 实现、framing mode、focus/zoom/ptz、camera 参数、产测协议、Rooms/Signage/VM33/uxplay 迁移确认 |

## 10. 当前规则

- 不从未采纳草案实现 runtime。
- 不手写 generated artifacts。
- 不绕过 `docs/protocol/`，直接把新业务语义写入 `registry/`。
- 不在主库保留语言专属 runtime 设计。
- legacy evidence 必须在 `docs/legacy-migration/` 下可追溯。
- runtime 仓库必须绑定明确的 AXTP Spec tag 或 commit。
- adapter 可以作为过渡方案，但最终应逐步沉淀为标准 capability / method / event。
