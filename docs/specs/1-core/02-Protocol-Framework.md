# 1-core/02《AXTP Protocol Framework》

> Status: AXTP v1 Core Freeze Candidate
> Spec Version: 1.0.0-rc1
> Change Policy: Clarification-only before v1.0.0
> Scope: Core architecture / layering / production path

版本：v1.0.0-rc1
状态：AXTP v1 Core Freeze Candidate
适用范围：AXTP v1 Core 分层、职责边界、生产路径与文档索引
后续文档：`docs/specs/1-core/03-Frame-and-Payload.md`、`docs/specs/1-core/04-Transport-Profiles.md`、`docs/specs/1-core/05-Control-Session.md`、`docs/specs/1-core/06-RPC-Session.md`、`docs/specs/1-core/07-Stream-Data-Plane.md`、`docs/specs/4-tooling/03-Versioning.md`、`docs/specs/1-core/08-Low-Bandwidth-Degradation.md`

---

## 1. 文档目的

本文档定义 AXTP v1 Core 的协议框架。它只描述分层、职责边界和核心生产路径；具体 wire format、状态机、RPC、STREAM、兼容规则由后续 02-07 文档定义。

---

## 2. 核心分层

```text
+--------------------------------------------------+
| Business Layer                                   |
| device / display / firmware / media / vendor ... |
+--------------------------------------------------+
| Registry Layer                                   |
| Method / Event / Error / Capability / Schema     |
+--------------------------------------------------+
| Payload Layer                                    |
| CONTROL / RPC / STREAM                           |
+--------------------------------------------------+
| AXTP Frame Layer                                 |
| Frame Profile / PayloadType / Fragment / CRC     |
+--------------------------------------------------+
| Transport Layer                                  |
| USB HID / TCP / WebSocket JSON                   |
+--------------------------------------------------+
```

| 层级 | 职责 | 不应该做的事 |
|---|---|---|
| Transport | 连接、字节传输、传输 MTU | 不理解 AXTP 业务语义 |
| Frame | 线格式、PayloadType、分片、CRC | 不理解 methodId / streamId 业务含义 |
| Payload | 分发 CONTROL / RPC / STREAM | 不定义业务注册表 |
| Registry | 定义 methodId / eventId / errorCode / schema | 不改变 Frame wire format |
| Business | 实现设备业务 | 不直接操作 Frame 字段 |

---

## 3. v1 Core 生产路径

AXTP v1 Core 的正式路径分为两类：

```text
Standard Framed
  -> AXTP-USB-HID / AXTP-TCP
  -> STANDARD_FRAME
  -> PayloadType = CONTROL / RPC / STREAM
  -> rpcEncoding = JSON / CBOR / MSGPACK / JSON_BINARY

WebSocket Unframed JSON
  -> AXTP-WS-JSON / AXTP-WS-CLOUD-REVERSE
  -> no Frame Header
  -> RPC JSON sid/op/d envelope only
```

WebSocket Unframed JSON 是正式 RPC-only 通道，但不承载正式 STREAM，不参与 CONTROL ACK/NACK / RESUME。

---

## 4. Frame Profile 冻结原则

Transport Profile 决定是否使用 Frame Header。同一个 AXTP Session 内 Frame 形态不切换。OPEN / ACCEPT 只协商运行参数，不协商 Header Profile。

默认映射：

| Transport Profile | Frame Profile |
|---|---|
| AXTP-USB-HID | STANDARD_FRAME |
| AXTP-TCP | STANDARD_FRAME |
| AXTP-WS-JSON | none |
| AXTP-WS-CLOUD-REVERSE | none |

Compact / HID-64 / BLE / UART 迁移到 `docs/specs/1-core/08-Low-Bandwidth-Degradation.md`，不作为当前 v1 Core 主线。

---

## 5. Payload 分类

AXTP v1 Core 只定义三类顶层 PayloadType：

| PayloadType | 职责 |
|---|---|
| CONTROL | OPEN / ACCEPT、心跳、关闭；ACK/NACK、恢复等为后续协议运行时扩展 |
| RPC | Hello / Identify / Request / Response / Event 等结构化业务控制面 |
| STREAM | P0 音视频媒体流，以及后续固件更新、文件、日志、传感器等长生命周期数据面 |

具体 wire format 见 `docs/specs/1-core/03-Frame-and-Payload.md`。

---

## 6. 默认会话流程

```text
Client -> Server: CONTROL OPEN
Server -> Client: CONTROL ACCEPT
Server -> Client: RPC Hello
Client -> Server: RPC Identify
Server -> Client: RPC Identified
Client -> Server: RPC adopted business methods from generated registry
```

`READY` 保留为可选三步确认名称，但 v1 Core 默认不要求实现；默认握手只要求 OPEN / ACCEPT。Phase 1 还必须实现 HEARTBEAT / HEARTBEAT_ACK 与 CLOSE / CLOSE_ACK，ACK / NACK 只作为后续可靠传输预留。

---

## 7. v1 Capability 策略

v1 Core 保留 `capability` 域，但不内置默认业务能力发现 method。业务能力发现必须由已采纳草案显式定义；在此之前，客户端以当前产品生成的 registry 作为可调用方法清单，设备可用标准 RPC 错误表示未支持或不可用。

完整 `capability.getAll` / `capability.query` / capability schema 属于 v2/P1 扩展。

---

## 8. 文档索引

| 文档 | 内容 |
|---|---|
| `docs/specs/1-core/03-Frame-and-Payload.md` | Standard Header、PayloadType、CRC、分片 |
| `docs/specs/1-core/04-Transport-Profiles.md` | USB HID / TCP / WebSocket JSON / Cloud Reverse 连接形态 |
| `docs/specs/1-core/05-Control-Session.md` | OPEN / ACCEPT / HEARTBEAT / CLOSE；READY / ACK / NACK 预留 |
| `docs/specs/1-core/06-RPC-Session.md` | Hello / Identify / Identified / Binary RPC / methodId / eventId |
| `docs/specs/1-core/07-Stream-Data-Plane.md` | 16B STREAM Header、streamId / seq / cursor、resume / retransmit / flow control |
| `docs/specs/4-tooling/03-Versioning.md` | v1 freeze rules、reserved 规则、ID 不复用、Legacy migration |
| `docs/specs/1-core/08-Low-Bandwidth-Degradation.md` | Compact / HID-64 / BLE / UART 降级路径 |
