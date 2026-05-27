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
