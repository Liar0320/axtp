# 1-core/08《AXTP Low-Bandwidth Degradation》

> Status: AXTP v1 Supplemental Specification
> Spec Version: 0.2.0
> Scope: Compact / HID-64 / BLE / UART degradation guidance

版本：0.2.0
状态：Supplemental Specification
适用范围：低带宽或小 MTU 链路的后续降级设计

---

## 0. 速读：降级只换外层，不换协议语义

18 描述的是低带宽或小 MTU 场景的后续降级路径，不是 v1 Core 必选路径。降级 profile 可以改变外层 frame header、MTU、分片和确认策略，但不能改变 CONTROL / RPC / STREAM 的 Payload 语义。

```text
允许变化： outer frame header / MTU / fragmentation / retry policy
不得变化： PayloadType / CONTROL 5B / RPC Binary 15B / STREAM 16B / methodId / eventId / errorCode
```

选择降级路径前先判断：

| 场景 | 推荐 |
|---|---|
| USB HID 高速或 TCP | 继续使用 Standard Framed |
| WebSocket JSON 集成 | 继续使用 WebSocket Unframed JSON，RPC-only |
| BLE/UART/HID-64 小 MTU | 使用独立 low-bandwidth profile，不在同一 session 中切换 |
| 需要视频/固件更新/文件连续数据 | 优先使用 Standard Framed；降级必须证明 MTU 和窗口策略可行 |

---

## 1. 定位

AXTP v1 Core 当前只要求两条正式路径：

- Standard Framed：`AXTP-USB-HID`、`AXTP-TCP`
- WebSocket Unframed JSON：`AXTP-WS-JSON`、`AXTP-WS-CLOUD-REVERSE`

Compact / HID-64 / BLE / UART 不作为 v1 Core 必选实现。它们是低带宽、低内存或历史兼容场景的降级路径，应在后续版本或设备专项 profile 中启用。

---

## 2. 降级原则

低带宽降级只能改变外层承载策略，不改变协议语义：

| 不得改变 | 原因 |
|---|---|
| PayloadType 三分类 | CONTROL / RPC / STREAM 是一级 parser 边界 |
| MethodId / EventId / ErrorCode | Registry 必须跨传输稳定 |
| CONTROL Payload Header | OPEN / ACCEPT / ACK / NACK 语义必须一致 |
| Binary RPC Header | Request / Response / Event 二进制语义必须一致 |
| STREAM Header | `streamId:uint32` / `seqId:uint32` / `cursor:uint64` 固定 16B |
| Method/capability bitmap 格式 | 若后续已采纳能力发现方法返回 bitmap，必须继续从 `methods[].bitOffset` 或 `capabilities[].bitOffset` 派生 |

允许改变：

- 外层 frame header
- 单帧 MTU
- 分片策略
- ACK/NACK 粒度
- retry / timeout 参数
- 是否启用 stop-and-wait 或 sliding-window

---

## 3. Compact Frame 降级格式

Compact Frame 的目标是极小 MTU 或 MCU 内存受限场景。推荐仅在下列条件满足时启用：

- 链路天然有 packet 边界，或传输适配层提供 COBS / SLIP / length-prefix framing
- 单连接点对点，不需要 SourceId / DestinationId 路由
- 设备不能承受 Standard Header + CRC16 的开销
- profile 明确声明自己是 low-bandwidth degradation，不冒充 v1 Core transport

Compact Frame 使用 4B Header + 1B CRC8 的降级格式。它只属于降级 profile 的 wire format，不进入 AXTP v1 Core。

```text
Offset 0: VT(1)
Offset 1: PayloadLength(1)
Offset 2: MessageId(1)
Offset 3: FrameInfo(1)
Offset 4: Payload starts
Footer:   CRC8(1)
```

| 字段 | 长度 | 说明 |
|---|---:|---|
| `VT` | 1B | 高 4 bit 为 Compact Header Version，低 4 bit 为 PayloadType |
| `PayloadLength` | 1B | Payload 字节数，不含 Compact Header 和 CRC8，最大 255 |
| `MessageId` | 1B | 逻辑 Message ID，wire 范围 0-255 |
| `FrameInfo` | 1B | 高 4 bit 为 frameIndex，低 4 bit 为 frameCount |
| `CRC8` | 1B | 覆盖 Compact Header(4B) + Payload |

推荐编码：

```text
VT.version = 1
VT.payloadType = CONTROL(1) / RPC(2) / STREAM(3)
FrameInfo.frameIndex = 0..14
FrameInfo.frameCount = 1..15
```

Compact Header 不携带：

- Magic
- SourceId
- DestinationId
- uint16 MessageId
- uint8 FrameIndex + uint8 FrameCount 的完整宽度

因此 Compact 只能用于点对点、低并发、短消息或强约束 profile。实现层内部仍可使用统一的 `messageId:uint16` 抽象，但编码到 Compact wire 前必须校验 `messageId <= 0xFF`、`payloadLength <= 0xFF`、`frameIndex <= 14`、`frameCount <= 15`。超出时必须返回编码失败或回退到 Standard Framed transport，不得截断。

Compact Frame 只替换外层 L1 Frame Header，不改变 L2 Payload：

| PayloadType | Compact 下的 Payload |
|---|---|
| CONTROL | 仍然是 04 定义的 5B Control Payload Header + TLV body |
| RPC | 仍然是 05 定义的 JSON envelope 或 15B Binary RPC Header + body |
| STREAM | 仍然是 06 定义的 16B STREAM Header + data |

HID-64 示例：

```text
ReportId: 1B，可选
Compact Header: 4B
CRC8 Footer: 1B
可用 Frame Payload: 58B（64B report 且含 1B ReportId 时）
可用 STREAM data: 42B（58B - 16B STREAM Header）
```

CRC8 的具体多项式、初值和 test vector 必须在启用 Compact profile 前进入 registry YAML 与 generator snapshot；启用前不得把 Compact 标记为 stable。

---

## 4. 协商阶段与版本升级

AXTP v1 Core 的原则保持不变：OPEN / ACCEPT 不协商 Header Profile。同一个 AXTP Session 内也不得切换 Frame Profile。

### 4.1 在哪里选择 Compact

Compact 必须通过独立 Transport Profile 或连接入口选择，而不是在已建立的 Standard Session 中临时切换：

| 场景 | 推荐选择点 |
|---|---|
| USB HID | 独立 interface、report descriptor、endpoint 或设备描述符声明 |
| BLE GATT | 独立 service UUID / characteristic set / profile UUID |
| UART | 独立端口配置、启动字节流适配层或 out-of-band 配置 |
| TCP | 独立端口、ALPN、URL path 或连接前 discovery |
| WebSocket | 不推荐 Compact；低带宽时继续使用 Unframed JSON 或 Standard Framed binary 子协议 |

一旦选择了低带宽 Transport Profile，后续流程仍然是：

```text
Transport Profile selected
    ↓
Parse selected L1 Frame Profile: COMPACT_FRAME
    ↓
CONTROL OPEN
    ↓
CONTROL ACCEPT
    ↓
RPC Hello / Identify / Identified
    ↓
APP_READY
```

OPEN / ACCEPT 在该阶段只协商运行时参数，例如：

- `protocolVersion`
- `maxFrameSize`
- `maxPayloadSize`
- `mtu`
- `supportedPayloadTypes`
- `supportedRpcEncodings`
- `ackMode`
- `windowSize`
- `resumeToken`

它们不得把一个 Standard connection 改成 Compact connection，也不得把 Compact connection 改成 Standard connection。

### 4.2 如何兼容老版本

低带宽升级必须遵守“先发现、再连接、失败可回退”的策略：

| Peer 能力 | 行为 |
|---|---|
| 双方都支持 Compact Transport Profile | 可以使用 Compact 入口建连，再按 OPEN / ACCEPT 协商运行参数 |
| Client 支持 Compact，Server 不支持 | Client 必须回退到 Standard Framed 或 WebSocket Unframed JSON |
| Server 支持 Compact，Client 不支持 | Server 必须继续提供 v1 Core 的 Standard Framed 或 WebSocket Unframed JSON 入口 |
| Compact Header Version 不支持 | 接收端返回 `FRAME_VERSION_UNSUPPORTED`（可安全返回时）或关闭连接；发起端回退 |
| PayloadType / rpcEncoding 无交集 | 使用 `CONTROL_NEGOTIATION_FAILED`，发起端可调整参数重试 |

旧 v1 Core 实现只需要识别 Standard Framed 与 WebSocket Unframed JSON；它们不会因为不知道 Compact 而破坏兼容性，因为 Compact 使用独立入口，不会混入同一个 wire stream。

### 4.3 版本号边界

Compact 有两个版本边界：

| 版本对象 | 含义 | 何时升级 |
|---|---|---|
| Compact Header Version | Compact L1 Header 的解析规则 | Compact Header 字段布局、CRC 规则、PayloadLength 语义变化 |
| `protocolVersion` | AXTP Control/RPC/STREAM 语义版本 | Control/RPC/STREAM 固定头发生不兼容变化 |

新增 method/event/error/type/capability、增加 Control TLV、增加 Stream Profile 或调整 registry 内容，不需要升级 Compact Header Version。

### 4.4 迁移路径

建议分三步推进：

| 阶段 | 内容 | 兼容要求 |
|---|---|---|
| P0 / v1 Core | 只实现 Standard Framed + WebSocket Unframed JSON | 当前规范与生成文档主线 |
| P1 / Experimental | 增加 `COMPACT_FRAME_EXPERIMENTAL` 与一个低带宽 Transport Profile | 必须提供 Standard 回退；默认关闭 |
| P2 / Stable Profile | 注册稳定 Compact Transport/Profile、CRC8 test vector、conformance cases | 仍不得改变 CONTROL/RPC/STREAM Payload Header |

在 P1/P2 中，Generator 应生成：

- compact frame constants
- compact encode/decode test vectors
- Compact MessageId / PayloadLength overflow test
- Compact CRC8 error test
- low-bandwidth profile conformance manifest

---

## 5. HID-64 / BLE / UART 建议

| 链路 | 建议定位 | 注意事项 |
|---|---|---|
| HID-64 | 低带宽 HID 降级 | chunk 必须扣除 STREAM 16B Header 后再计算 |
| BLE GATT | 低功耗降级 | 必须先协商 MTU，默认 ATT MTU 过小不适合 STREAM |
| UART | 字节流降级 | 必须额外提供帧边界，不能裸跑无 Magic Compact |

如果业务需要音视频或固件更新等 STREAM 能力，应优先使用 `AXTP-USB-HID` 或 `AXTP-TCP` 的 Standard Framed 路径。

---

## 6. 与当前 Registry 的关系

低带宽 profile 不应新增一套业务 API。它必须复用当前 registry/domain 中已经定义的：

- methods
- events
- errors
- schemas
- stream profiles
- capabilities

新增 low-bandwidth transport/profile 时，应只新增 transport/profile 元数据和必要的 capability，不应复制业务 method/event。

建议新增的机器事实源位置：

| 内容 | 建议位置 |
|---|---|
| Compact Frame Profile 元数据 | `registry/core/protocol_meta.yaml` |
| 低带宽 Transport Profile | `registry/core/protocol_meta.yaml` |
| 低带宽 Profile / Capability | `registry/capability/` 或 `registry/domains/<domain>/domain.yaml` |
| Compact CRC8 / overflow test vector | `tooling/test-vectors/` 由 Generator 生成 |

这些事实源进入 registry 前，`docs/generated/protocol.md` 不应把 Compact 展示为当前可用主线能力。
