# 00《AXTP Overview》

版本：v2.0 Draft
状态：Normative
适用范围：AXTP 协议体系架构入口

---

## 1. AXTP 是什么

AXTP（Auditoryworks Transport Protocol）是一套传输无关的设备通信协议，为控制、二进制 RPC 和高吞吐流式传输提供统一骨架。

AXTP 的目标是让以下传输方式共享同一套协议语义：

```text
TCP
WebSocket
USB HID
BLE
UART
USB Bulk
```

---

## 2. 解决的问题

AXTP 主要解决以下工程问题：

1. **多传输协议不统一**：同一业务命令在 HID、BLE、TCP、WebSocket 上有多套表达。AXTP 要求所有传输共享同一套业务语义，差异只体现在 Frame Profile、MTU 和编码方式上。

2. **Header 被业务污染**：将 VIDEO / AUDIO / OTA / FILE 等业务类型放入 Frame Header 会导致协议难以稳定。AXTP 规定 PayloadType 只选择一级 Payload Parser，业务语义下沉到 Registry 层。

3. **控制面与数据面混杂**：配置、查询、状态上报属于控制面；视频帧、OTA chunk、文件块属于数据面。AXTP 明确拆分为 RPC（控制面）和 STREAM（数据面）。

4. **文本 RPC 与二进制 RPC 割裂**：DS-RPC Text Profile 和 Binary-RPC 是同一套 RPC 语义的不同编码形式，共享同一套 method / event / error registry。

---

## 3. 支持的传输

| 传输 | Frame Profile | 典型场景 |
|---|---|---|
| TCP | STANDARD_FRAME | 网关、Linux 设备 |
| WebSocket Binary | STANDARD_FRAME | Browser、App |
| USB HID 64B | COMPACT_FRAME | MCU 设备（HID High Speed 可定义独立 Standard Profile） |
| BLE | COMPACT_FRAME | 低功耗设备 |
| UART | COMPACT_FRAME + framing | 嵌入式串口（需 COBS/SLIP/length-prefix 帧边界） |
| USB Bulk | STANDARD_FRAME | 高速 USB 设备 |

WebSocket Text 和 HTTP JSON 只作为 Debug 或 Legacy Adapter，不作为生产必选路径，不承载正式 STREAM。

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
| TCP / WebSocket / HID / BLE / UART / USB Bulk    |
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

v1 不做动态 Header 协商。Transport Profile 决定 Frame Profile，Frame Profile 固定绑定 L1 和 L2。

```text
STANDARD_FRAME = STANDARD_L1 + STANDARD_L2
COMPACT_FRAME  = COMPACT_L1  + COMPACT_L2
```

v1 不支持混搭（STANDARD_L1 + COMPACT_L2 或 COMPACT_L1 + STANDARD_L2）。

Magic 字节决定 Frame Profile：

```text
STANDARD_FRAME：Magic = AX（0x41 0x58）
COMPACT_FRAME：无 Magic，依赖传输帧边界
```

v1 Payload Header 统一规格：

```text
Control Payload：5B 固定头，所有传输场景共用
RPC Binary Payload：11B 固定头，所有传输场景共用
STREAM Payload：16B 固定头，所有传输场景共用
```

---

## 7. Protocol Definition 驱动原则

AXTP 使用单一 Protocol Definition 文件（`protocol/axtp.protocol.yaml`）描述全部 methods、events、types、errors、profiles、frameProfiles 和 transports。

`axtpc`（AXTP Protocol Compiler）从该定义生成：

```text
Markdown 协议文档
JSON Schema
C/C++/TypeScript 枚举
Method Bitmap
一致性测试
```

治理规则：

- 新增 method / event / error / profile 只修改 `protocol.yaml`，不修改 08-13 规范文档
- stable 的 methodId / eventId / errorCode 不得复用
- stable 条目不得删除，只能标记 deprecated
- `generated/` 目录下的文件不得手写修改

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

具体 method / event / error / type 定义见 `protocol/axtp.protocol.yaml` 及 08-13 规范文档。

---

## 9. 非目标

v1 明确不实现以下内容：

1. **完整 Capability Model**：v1 只实现 `capability.supportedMethods`（返回当前会话支持的 methodId bitmap）。`capability.getAll` / `capability.query` 留到 v2。

2. **WebSocket Text / HTTP JSON 作为生产 STREAM 路径**：这两种传输只作为 Debug 或 Legacy Adapter，不承载正式 STREAM，不参与 CONTROL ACK/NACK / RESUME。

3. **动态 Header 协商**：Frame Profile 由 Transport Profile 固定决定，v1 不支持运行时协商。

4. **8B Stream Header**：v1 统一使用 16B Stream Header，不保留 8B 变体。

5. **完整多语言 SDK**：v1 只生成 C/C++ 枚举和骨架，完整 SDK 留到后续阶段。
