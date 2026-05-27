# AXTP 协议设计 FAQ

---

## Q1：Compact 传输场景下，L2 Header 是否也可以用 Compact 版本？

**结论：规范里已经定义了，直接用就行。**

三个 Payload 类型均已定义 Compact L2 Header：

| Payload | Standard L2 Header | Compact L2 Header | 状态 |
| --- | --- | --- | --- |
| CONTROL | 9B 固定头 | 2B 固定头（opcode + controlId） | 已定义 |
| RPC Binary | 11B 固定头，无 sid | 同 Binary 模式，sid 不在 Payload | 已定义 |
| STREAM | 16B 固定头 | 8B 固定头 | 已定义 |

规范里 Control §2.3 和 Stream §2 都已按传输类型做了 Profile 映射。Compact 传输（BLE/HID/UART）自动选 Compact L2 Header，只需在 CONTROL OPEN/ACCEPT 的 `headerProfile` 字段协商一致即可。

---

## Q2：JSON 模式为什么每帧都要带 sid，Binary 模式不需要？

这是两种模式的根本差异，不是设计冗余。

**Binary/Framed 模式**：有 CONTROL 层。OPEN/ACCEPT 建立 session，session 状态由 Frame 层维护，sid 是 CONTROL 层的概念，不需要出现在每个 RPC Payload 里。

**JSON/Unframed 模式**：没有 CONTROL 层。WebSocket Text 连接建立后直接进 FRAMING_READY，没有任何 Frame 层的 session 管理机制。这时 sid 承担两个职责：

- **网关路由**：一条 WebSocket 连接可能承载多个逻辑 session（如网关代理多台设备），sid 是区分路由目标的唯一手段
- **断线恢复**：重连时客户端在 Identify 的 `resumeSid` 字段携带旧 sid，服务端恢复 session 状态

规范里说的"TextCodec 边界消费，不透传给业务逻辑"是指 sid 在 codec 层处理完就不往上传，业务层不感知它——但它必须在每帧存在，因为 codec 层需要它做路由判断。

> **一句话**：JSON 模式的 sid = Binary 模式的 CONTROL session，两者解决同一个问题，只是层次不同。

---

## Q3：前期是否可以不实现 CONTROL，后期再补？

**可以，但要分传输路径区别对待。**

| 传输路径 | CONTROL 是否可跳过 | 说明 |
| --- | --- | --- |
| WebSocket Text / JSON | 完全可以跳过 | 规范明确定义为 Debug/Legacy Adapter 路径，WebSocket 升级后直接进 FRAMING_READY |
| WebSocket Binary / TCP / HID / BLE（Framed） | 不能完全跳过，但可以最小化 | 状态机要求 LINK_CONNECTED → FRAMING_READY 必须经过 CONTROL OPEN/ACCEPT |

**分阶段策略：**

| 阶段 | 实现内容 |
| --- | --- |
| Phase 0（当前） | 只实现 WebSocket JSON，完全不碰 CONTROL |
| Phase 1（Framed 接入） | 最小 CONTROL 子集：`OPEN / ACCEPT / HEARTBEAT / HEARTBEAT_ACK / CLOSE / CLOSE_ACK`（6 个 opcode） |
| Phase 2（可靠性） | 补 `ACK / NACK / RESUME / SESSION_RESET` |
| Phase 3（流控） | 补 `WINDOW_UPDATE / PING / PONG / GOAWAY` |

Phase 1 的 OPEN/ACCEPT TLV body 可以先只实现必填字段（`protocolVersion`、`headerProfile`、`maxFrameSize`），其余字段用默认值。

---

## Q4：Server 先发 Hello vs Client 先发 Hello，哪种更合适？

**结论：保持 Server→Client Hello（当前规范），这是正确的设计。**

### 两种方式对比

| | Server 先发 Hello（当前规范） | Client 先发 Hello（部分老设备） |
| --- | --- | --- |
| 认证参数 | Server 在 Hello 里携带 challenge，Client 按需响应 | Client 发 Hello 时不知道 Server 需要什么认证 |
| 版本协商 | Client 收到 Hello 后可做版本兼容判断再决定是否继续 | Client 需要预先知道 Server 版本 |
| 实现复杂度 | Server 主动推送，逻辑清晰 | 需要额外的 challenge 交换步骤 |
| 行业惯例 | OBS-WebSocket、多数 WebSocket 协议 | 少数老协议 |

### 兼容老设备的策略

老设备已实现 Client→Server Hello，这是兼容性问题，不是设计问题。

#### 方案一：URL 路径分路（推荐）

用不同的 WebSocket 路径区分协议版本，完全消除竞争条件：

```
ws://device/axtp    → 新协议（Server 先发 Hello）
ws://device/legacy  → 老协议（Client 先发 Hello，Server 回 HelloAck）
```

老设备连 `/legacy`，新客户端连 `/axtp`，两条路径互不干扰，不需要任何检测逻辑。

#### 方案二：首包检测（URL 不可分路时的备选）

当老设备 URL 硬编码无法修改时，Server 改为等待首包再决定路径：

```
连接建立
    │
    ├─ 等待首包（超时 3s）
    │
    ├─ 收到 Identify (op=2)  → 新协议路径，Server 再发 Hello，继续正常流程
    │
    ├─ 收到 Client Hello     → 老协议路径，Server 回 HelloAck，继续老协议流程
    │
    └─ 超时无包              → 关闭连接
```

> **为什么不用定时器检测？**
>
> 新 Server 连接后立即发 Hello，老 Client 连接后也立即发 Hello，双方同时发出后各自等待对方响应（Server 等 Identify，老 Client 等 HelloAck），形成死锁。老 Client 收到意外的 Server Hello 后行为不确定，可能卡住。定时器无法解决这个根本冲突，首包检测才能避免双方同时发包的竞争。

---

## Q5：四种传输方案的实现优先级

### 方案特征

| 方案 | 传输 | Frame | Payload | CONTROL | 复杂度 |
| --- | --- | --- | --- | --- | --- |
| WebSocket + JSON | WebSocket Text | Unframed | JSON | 不需要 | ★☆☆☆ |
| TCP + Framed + JSON | Raw TCP | Standard | JSON | 需要（Standard） | ★★☆☆ |
| HID + Framed + JSON | USB HID | Standard（可降级 Compact） | JSON | 需要（Standard/Compact） | ★★★☆ |
| BLE + Compact + Binary | BLE GATT | Compact | Binary | 需要（Compact） | ★★★★ |

### 优先级安排

**P0：WebSocket + JSON**

- 零 CONTROL 依赖，直接复用已有设备实现
- Web 管理控制台、调试工具、浏览器客户端全覆盖
- 验证 RPC 语义（Hello/Identify/Request/Response/Event）的最快路径

**P1：TCP + Framed + Standard Profile + JSON**

- Standard Profile，CONTROL 最小子集（OPEN/ACCEPT/HEARTBEAT/CLOSE）
- ackMode=NO_ACK，TCP 保可靠性
- 跑通 Framed 完整状态机，为 HID/BLE 打基础

**P2：HID + Framed + Standard Profile + JSON，含 Compact 降级协商**

HID 默认走 Standard Profile，当 HID Report Size 较小时通过 CONTROL OPEN/ACCEPT 协商降级：

```
Client → Server: CONTROL OPEN
  maxFrameSize = <HID report size，如 64>
  supportedProfiles = [STANDARD, COMPACT]

Server → Client: CONTROL ACCEPT
  selectedProfile = COMPACT   ← maxFrameSize ≤ 64 时（Standard 14B 开销占比过高）
  selectedProfile = STANDARD  ← maxFrameSize > 64 时（如 512B HID High Speed）
```

Client 在发 OPEN 前查 HID descriptor 拿到实际 report size，填入 `maxFrameSize`，其余逻辑不变。P2 实现 Compact Profile 编解码，P3 的 BLE 直接复用。

**P3：BLE + Compact + Binary**

- 复用 P2 的 Compact Profile 编解码
- 增加 Binary RPC（TLV 编解码，无 sid）
- BLE MTU 约束（通常 20–244B），分片逻辑需充分测试

### 增量路径

```
P0 WebSocket JSON
    └─ 验证 RPC 语义
P1 TCP Framed Standard
    └─ 跑通 CONTROL 状态机
P2 HID Framed Standard + Compact 降级
    └─ 实现 Compact Profile 编解码
P3 BLE Compact Binary
    └─ 实现 Binary RPC，复用 Compact Profile
```

每一步都在前一步基础上增量，不需要推倒重来。

---

## Q6：OTA 校验字段用 MD5 还是 SHA256？协议如何处理多种算法？

MD5 是哈希算法的一种。哈希算法是一类函数的统称，输入任意长度数据，输出固定长度摘要。MD5、SHA1、SHA256、CRC32 都属于这一类，区别在于安全强度和碰撞概率：

| 算法 | 输出长度 | 碰撞风险 | 说明 |
| --- | --- | --- | --- |
| CRC32 | 32 bit（4B） | 非密码学，易碰撞 | 只防传输损坏，不防篡改 |
| MD5 | 128 bit（16B） | 已知可构造碰撞 | 功能上可用于完整性校验，安全性弱 |
| SHA256 | 256 bit（32B） | 目前无已知碰撞 | 推荐用于安全敏感场景 |

**当前决策：MVP 阶段沿用 MD5，协议字段设计为算法无关。**

规范使用通用字段 `verifyType`（算法名）+ `verifyValue`（校验值 hex 字符串），而不是绑定到具体算法的字段名（如 `imageSha256`）。这样 MD5、CRC32、SHA256 都能用同一套字段表达，不需要改协议。

**多算法协商流程：**

1. 设备在 `capability.getAll` 响应中声明 `firmware.supportedVerifyTypes`，例如 `["md5","crc32","sha256"]`
2. 客户端在 `firmware.begin` 时选择设备支持的一种，填入 `verifyType` 和对应的 `verifyValue`
3. 设备在 `firmware.verify` 时按 `verifyType` 执行对应算法校验

MVP 阶段设备只需声明支持 `md5`，后续升级到 SHA256 只需在 capability 中新增，客户端和协议字段不需要改动。

---

## Q7：PING/PONG 和 HEARTBEAT 有什么区别？

两者都是 CONTROL 层的保活机制，但目的不同：

| | HEARTBEAT / HEARTBEAT_ACK | PING / PONG |
| --- | --- | --- |
| 目的 | 保活：证明连接还在，对端还活着 | 测量：量化链路延迟（RTT） |
| 触发方式 | 周期性发送，间隔由 OPEN 协商 | 按需发送，不要求周期性 |
| body | 可选，可携带 timestamp | 可选，携带 timestamp 或 nonce |
| 响应要求 | 对端必须回 HEARTBEAT_ACK | 对端必须回 PONG，原样返回 nonce |
| 超时处理 | 连续 3 次无响应 → 断开连接 | 超时 → 记录丢包，不强制断开 |
| MVP 要求 | 必须实现 | P1，可延后 |

HEARTBEAT 是连接保活的基础机制，所有 Framed 连接都需要。BLE 场景尤其重要，因为 BLE 连接可能在没有数据传输时被系统静默断开。PING/PONG 用于需要精确 RTT 数据的场景，比如自适应 OTA chunk size（根据链路延迟动态调整）、网关质量监控、诊断工具。

MVP 阶段只实现 HEARTBEAT/HEARTBEAT_ACK 即可，PING/PONG 在 P1 阶段补充。

---

## Q8：新增一项业务，具体如何操作文档库？

以新增"音量控制"业务（`audio.setVolume`）为例，完整操作步骤：

### 第一步：确认 domain 归属

查 `08-AXTP-Registry总则-v2.md` §9 Domain Registry，确认业务属于哪个 domain。音量控制属于 `audio.*`，MethodId 范围 `0x0800-0x08FF`，EventId 范围 `0x8800-0x88FF`。

如果业务不属于任何已有 domain，先在 §9 中新增 domain 条目，再分配 ID 范围。

### 第二步：在 MethodId 注册表中分配 ID

打开 `09-AXTP-MethodId注册表-v2.md`，在 `audio.*` 段找到下一个可用 ID，新增条目：

```yaml
- id: 0x0801
  name: audio.setVolume
  status: draft
  domain: audio
  description: Set audio output volume.
  schema:
    params: AudioSetVolumeParams
    result: AudioSetVolumeResult
  errors:
    - RPC_PARAM_INVALID
    - OUT_OF_RANGE
  events:
    - audio.volumeChanged
  mvp: false
```

### 第三步：在 EventId 注册表中分配事件 ID（如有）

打开 `10-AXTP-EventId注册表-v2.md`，在 `audio.*` 段新增：

```yaml
- id: 0x8801
  name: audio.volumeChanged
  status: draft
  domain: audio
  description: Fired when audio volume changes.
  schema:
    data: AudioVolumeChangedData
  mvp: false
```

### 第四步：在 Capability 注册表中声明能力（如需）

打开 `12-AXTP-Capability注册表-v2.md`，新增 `audio.volume` 能力条目，让客户端可以通过 `capability.getAll` 发现设备是否支持音量控制。

### 第五步：定义 TLV Schema（如需）

在 `06-AXTP-TLV-Schema编码规范-v2.md` 中定义 `AudioSetVolumeParams` 和 `AudioSetVolumeResult` 的字段编号和类型。

### 第六步：更新 ErrorCode 注册表（如需新错误码）

如果现有错误码不够用，在 `11-AXTP-ErrorCode注册表-v2.md` 的 `audio` 分类下新增。

### 第七步：更新连接场景文档（如有特殊流程）

如果新业务有特殊的调用流程（比如需要先建流），在 `05-AXTP-连接场景与调用流程规范-v2.md` 中补充示例。

核心原则：

- Registry 是单一事实源，所有 ID 必须先在 Registry 中注册，再在代码中使用
- 不得在代码或文档中私自使用未注册的 methodId/eventId
- `status: draft` → 实现稳定后改为 `stable`，`stable` 后不得改变语义
- 新增 method/event/capability 不需要升级 Protocol Version，只升级 Registry Version

能否将新增业务逻辑这一项写成一个skill，放到文档中，每次我只需要说一句我需要增加一个调整音量的业务逻辑，claude就能根据我的业务需求逐项和我确认，就能生成正规的协议文档了。