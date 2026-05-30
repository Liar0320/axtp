# 00《AXTP Overview》

版本：v2.0 Draft
状态：Normative
适用范围：AXTP 协议体系架构入口

---

## 1. AXTP 是什么

AXTP（Auditoryworks Transport Protocol）是一套传输无关的设备通信协议，为控制、二进制 RPC 和高吞吐流式传输提供统一骨架。

AXTP 的目标是让以下传输方式共享同一套协议语义：

```text
AXTP-USB-HID
TCP
WebSocket Unframed JSON
```

---

## 2. 解决的问题

AXTP 主要解决以下工程问题：

1. **多传输协议不统一**：同一业务命令在 HID、TCP、WebSocket 上有多套表达。AXTP 要求当前正式路径共享同一套业务语义，差异只体现在是否使用 Standard Frame 以及 RPC 编码方式上。

2. **Header 被业务污染**：将 VIDEO / AUDIO / OTA / FILE 等业务类型放入 Frame Header 会导致协议难以稳定。AXTP 规定 PayloadType 只选择一级 Payload Parser，业务语义下沉到 Registry 层。

3. **控制面与数据面混杂**：配置、查询、状态上报属于控制面；视频帧、OTA chunk、文件块属于数据面。AXTP 明确拆分为 RPC（控制面）和 STREAM（数据面）。

4. **文本 RPC 与二进制 RPC 割裂**：DS-RPC Text Profile 和 Binary-RPC 是同一套 RPC 语义的不同编码形式，共享同一套 method / event / error registry。

---

## 3. 支持的传输

| Transport Profile | 模式 | Frame Profile | 典型场景 |
|---|---|---|---|
| AXTP-USB-HID | Standard Framed | STANDARD_FRAME | USB HID 高速/大 report 设备 |
| AXTP-TCP | Standard Framed | STANDARD_FRAME | PC / App 与设备直连 |
| AXTP-WS-JSON | WebSocket Unframed JSON | none | 正式 RPC-only WebSocket 集成 |
| AXTP-WS-CLOUD-REVERSE | WebSocket Unframed JSON | none | 设备主动连接云端，设备仍为 Logical Server |

Compact / HID-64 / BLE / UART 是低带宽降级路径，见 17《AXTP Low-Bandwidth Degradation》。

---

## 4. 核心分层

```text
+--------------------------------------------------+
| Business Layer                                   |
| device / brightness / video / firmware / ...     |
+--------------------------------------------------+
| Registry Layer                                   |
| Method / Event / Error / Capability              |
+--------------------------------------------------+
| Payload Layer                                    |
| CONTROL (0x01) / RPC (0x02) / STREAM (0x03)      |
+--------------------------------------------------+
| AXTP Frame Layer                                 |
| Frame Profile / Header / Length / MessageId      |
+--------------------------------------------------+
| Transport Layer                                  |
| USB HID / TCP / WebSocket JSON                   |
+--------------------------------------------------+
```

| 层级 | 职责 |
|---|---|
| Transport | 字节传输，不理解业务方法 |
| Frame | 边界、长度、分片、校验，不理解业务类型 |
| Payload | 选择 CONTROL / RPC / STREAM 解析器，不承载业务注册表 |
| Registry | 定义 method / event / error / capability，不处理传输细节 |
| Business | 定义设备业务语义，不直接修改 Frame Header |

---

## 5. 三类 Payload

| PayloadType | 值 | 职责 |
|---|---|---|
| CONTROL | 0x01 | 协议运行时信令：OPEN、ACCEPT、READY、HEARTBEAT、ACK、NACK、RESUME、CLOSE |
| RPC | 0x02 | 业务控制面：request、response、event、batch |
| STREAM | 0x03 | 业务数据面：OTA chunk、文件块、视频帧、音频帧、日志流 |

PayloadType 只选择解析器，不编码业务类型。VIDEO / OTA / FILE 等业务语义属于 Registry 层。

---

## 6. Frame Profile 固定绑定原则

v1 不做动态 Header 协商。Standard Framed transport 固定使用 Standard Frame；WebSocket Unframed JSON 固定不使用 Frame Header。

```text
STANDARD_FRAME = STANDARD_L1 + STANDARD_L2
```

Standard Frame 使用 Magic 字节：

```text
STANDARD_FRAME：Magic = AX（0x41 0x58）
```

v1 Payload Header 统一规格：

```text
Control Payload：5B 固定头，仅 Standard Framed 使用
RPC Binary Payload：11B 固定头，仅 rpcEncoding=BINARY 时使用
RPC JSON Envelope：sid/op/d，用于 WebSocket Unframed JSON 和 framed JSON
STREAM Payload：16B 固定头，仅 Standard Framed 使用
```

---

## 7. 三段式 Protocol Definition 驱动原则

AXTP 使用三段式协议编译流程。`registry/**/*.yaml` 与 `registry/domains/**/*.yaml` 是机器可读事实源；`protocol/axtp.protocol.yaml` 是由 Generator 聚合生成的 Protocol IR；`docs/generated/` 与各 runtime/tooling 的 `generated/` 目录是最终成果物。

`axtpc`（AXTP Protocol Compiler）按以下单向数据流生成：

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

- 新增业务 method / event / error / profile 默认只修改 `registry/domains/<domain>/domain.yaml`，不修改 08-13 规范文档
- 只有 Core/MVP 晋升、公共 schema、核心常量或 legacy 映射才修改对应 `registry/` 核心文件；不得两边重复定义同一协议事实
- `protocol/axtp.protocol.yaml` 为生成产物，不得手写修改
- stable 的 methodId / eventId / errorCode 不得复用
- stable 条目不得删除，只能标记 deprecated
- 所有 `generated/` 目录下的文件不得手写修改

---

## 8. v1 最小落地范围

v1 连接生命周期：

```text
Client → Server: CONTROL OPEN
Server → Client: CONTROL ACCEPT
[可选] Client → Server: CONTROL READY
Server → Client: RPC Hello
Client → Server: RPC Identify
Server → Client: RPC Identified
Client → Server: RPC capability.supportedMethods
```

v1 MVP 端到端验证链路：

```text
CONTROL OPEN / ACCEPT
  → RPC capability.supportedMethods
  → RPC device.getInfo
  → RPC brightness.set / Event brightness.changed
  → RPC firmware.begin
  → STREAM OTA chunk + CONTROL ACK/NACK
  → RPC firmware.verify
  → RPC Event firmware.updateCompleted
  → CONTROL CLOSE
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
