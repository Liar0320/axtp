# 00《AXTP Overview》

版本：v2.0
状态：Normative
适用范围：AXTP 协议体系架构入口

---

## 1. 一页看懂 AXTP

AXTP（Auditoryworks Transport Protocol）是一套设备通信协议。它把同一套业务语义放到两条正式连接路径上：

| 路径 | 典型传输 | 线上结构 | 用途 |
|---|---|---|---|
| Standard Framed | `AXTP-USB-HID`、`AXTP-TCP` | `Standard Frame Header(12B) + Payload(N) + CRC16(2B)` | CONTROL、RPC、STREAM |
| WebSocket Unframed JSON | `AXTP-WS-JSON`、`AXTP-WS-CLOUD-REVERSE` | `WebSocket message payload = JSON { sid, op, d }` | RPC-only |

Standard Framed 有 Frame Header，先做 CONTROL OPEN / ACCEPT，再进入 RPC Hello / Identify / Identified，之后可以跑 RPC 和 STREAM。

WebSocket Unframed JSON 没有 Frame Header，也没有 CONTROL、STREAM、CRC16、Binary RPC 11B Header。WebSocket 建好后直接发送 JSON RPC Envelope。

Compact / HID-64 / BLE / UART 是低带宽降级路径，见 18《AXTP Low-Bandwidth Degradation》。

---

## 2. 核心分层

```text
Business Layer    device / brightness / video / firmware / ...
Registry Layer    method / event / error / capability / schema
Payload Layer     CONTROL(0x01) / RPC(0x02) / STREAM(0x03)
Frame Layer       Standard Frame Header / length / fragment / CRC
Transport Layer   USB HID / TCP / WebSocket
```

| 层级 | 职责 | 不做的事 |
|---|---|---|
| Transport | 连接和字节传输 | 不理解业务方法 |
| Frame | 边界、长度、分片、校验 | 不编码 VIDEO / OTA / FILE 等业务类型 |
| Payload | 选择 CONTROL / RPC / STREAM 解析器 | 不定义 methodId / eventId |
| Registry | 定义 method / event / error / capability / schema | 不改变 Frame wire format |
| Business | 实现设备业务语义 | 不直接修改 Frame Header |

---

## 3. 三类 Payload

| PayloadType | 值 | 职责 |
|---|---:|---|
| CONTROL | `0x01` | 协议运行时信令：OPEN、ACCEPT、READY、HEARTBEAT、ACK、NACK、RESUME、CLOSE |
| RPC | `0x02` | 业务控制面：request、response、event、batch |
| STREAM | `0x03` | 业务数据面：OTA chunk、文件块、视频帧、音频帧、日志流 |

PayloadType 只选择一级 parser，不表达业务类型。`VIDEO` / `OTA` / `FILE` 等业务语义属于 Registry 层。

v1 Payload Header 规格：

```text
CONTROL Payload     5B fixed header + TLV body，仅 Standard Framed 使用
RPC Binary Payload  11B fixed header + body，仅 rpcEncoding=BINARY 时使用
RPC JSON Envelope   JSON { sid, op, d }，用于 WebSocket Unframed JSON 和 framed JSON
STREAM Payload      16B fixed header + data，仅 Standard Framed 使用
```

---

## 4. 支持的传输

| Transport Profile | 模式 | Frame Profile | RPC Encoding | CONTROL | STREAM | 典型场景 |
|---|---|---|---|---:|---:|---|
| `AXTP-USB-HID` | Standard Framed | `STANDARD_FRAME` | BINARY / JSON | 是 | 是 | USB HID 高速/大 report 设备 |
| `AXTP-TCP` | Standard Framed | `STANDARD_FRAME` | BINARY / JSON | 是 | 是 | PC / App 与设备直连 |
| `AXTP-WS-JSON` | WebSocket Unframed JSON | none | JSON | 否 | 否 | 浏览器、云端、轻量 RPC 集成 |
| `AXTP-WS-CLOUD-REVERSE` | WebSocket Unframed JSON | none | JSON | 否 | 否 | 设备主动连接云端，设备仍为 Logical Server |

v1 不做运行时 Header 协商。Frame 形态由 Transport Profile 固定决定：Standard Framed 固定使用 Standard Frame；WebSocket Unframed JSON 固定不使用 Frame Header。

Standard Frame 使用 Magic 字节 `AX`（`0x41 0x58`）。完整 Header 布局见 02《AXTP Frame and Payload Spec》。

---

## 5. 连接过程概览

Standard Framed：

```text
Transport connected
Physical Client -> Physical Server: CONTROL OPEN
Physical Server -> Physical Client: CONTROL ACCEPT
Logical Server  -> Logical Client:  RPC Hello
Logical Client  -> Logical Server:  RPC Identify
Logical Server  -> Logical Client:  RPC Identified
Logical Client  -> Logical Server:  RPC capability.supportedMethods
```

WebSocket Unframed JSON：

```text
WebSocket connected
Logical Server -> Logical Client: Hello (op=0)
Logical Client -> Logical Server: Identify (op=2)
Logical Server -> Logical Client: Identified (op=3)
Logical Client -> Logical Server: Request capability.supportedMethods (op=7)
```

`READY` 保留为可选三步确认名称，但 v1 Core 默认不要求实现；默认握手只要求 OPEN / ACCEPT。

---

## 6. 解决的问题

AXTP 主要解决四类工程问题：

1. **多传输协议不统一**：HID、TCP、WebSocket 共享 method / event / error registry。
2. **Header 被业务污染**：Frame Header 只放 PayloadType，不放 VIDEO / AUDIO / OTA / FILE。
3. **控制面与数据面混杂**：配置、查询、状态上报走 RPC；视频帧、OTA chunk、文件块走 STREAM。
4. **文本 RPC 与二进制 RPC 割裂**：JSON RPC 和 Binary RPC 是同一套 RPC 语义的不同编码。

---

## 7. Protocol Definition 驱动原则

AXTP 使用三段式协议编译流程。`registry/**/*.yaml` 与 `registry/domains/**/*.yaml` 是机器可读事实源；`protocol/axtp.protocol.yaml` 是由 Generator 聚合生成的 Protocol IR；`docs/generated/` 与各 runtime/tooling 的 `generated/` 目录是最终成果物。

```text
registry/
        ↓
protocol/axtp.protocol.yaml
        ↓
docs/generated/protocol.md
protocol.json
C/C++/TypeScript 枚举
Method/Event Bitmap
一致性测试与工具描述
```

治理规则：

- 新增业务 method / event / error / profile 默认只修改 `registry/domains/<domain>/domain.yaml`；命名归属遵循 08，通常不修改 09-14 registry 规范表
- 只有 Core/MVP 晋升、公共 schema、核心常量或 legacy 映射才修改对应 `registry/` 核心文件；不得两边重复定义同一协议事实
- `protocol/axtp.protocol.yaml` 为生成产物，不得手写修改
- stable 的 methodId / eventId / errorCode 不得复用
- stable 条目不得删除，只能标记 deprecated
- 所有 `generated/` 目录下的文件不得手写修改

---

## 8. v1 最小落地范围

v1 MVP 端到端验证链路：

```text
CONTROL OPEN / ACCEPT
  -> RPC capability.supportedMethods
  -> RPC device.getInfo
  -> RPC brightness.set / Event brightness.changed
  -> RPC firmware.begin
  -> STREAM OTA chunk + CONTROL ACK/NACK
  -> RPC firmware.verify
  -> RPC Event firmware.updateCompleted
  -> CONTROL CLOSE
```

具体 method / event / error / type 定义以 `registry/` 与 `registry/domains/` YAML 为准；`protocol/axtp.protocol.yaml` 与生成文档由 Generator 输出。

---

## 9. 非目标

v1 明确不实现以下内容：

1. **完整 Capability Model**：v1 只实现 `capability.supportedMethods`（返回当前会话支持的 methodId bitmap）。`capability.getAll` / `capability.query` 留到 v2。
2. **WebSocket Unframed JSON 作为生产 STREAM 路径**：WebSocket Unframed JSON 是正式 RPC-only 通道，但不承载 STREAM，不参与 CONTROL ACK/NACK / RESUME。
3. **动态 Header 协商**：Frame 形态由 Transport Profile 固定决定，v1 不支持运行时协商。
4. **8B Stream Header**：v1 统一使用 16B Stream Header，不保留 8B 变体。
5. **完整多语言 SDK**：v1 只生成 C/C++ 枚举和骨架，完整 SDK 留到后续阶段。
