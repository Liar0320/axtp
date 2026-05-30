# 01《AXTP Protocol Framework》

> Status: AXTP v1 Core Freeze Candidate
> Spec Version: 1.0.0-rc1
> Change Policy: Clarification-only before v1.0.0
> Scope: Core architecture / layering / production path

版本：v1.0.0-rc1
状态：AXTP v1 Core Freeze Candidate
适用范围：AXTP v1 Core 分层、职责边界、生产路径与文档索引
后续文档：02《AXTP Frame and Payload Spec》、03《AXTP Transport Profiles》、04《AXTP Control Session Spec》、05《AXTP RPC Session Spec》、06《AXTP Stream Spec》、07《AXTP Compatibility and Versioning》、17《AXTP Low-Bandwidth Degradation》

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
  -> rpcEncoding = BINARY / JSON

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

Compact / HID-64 / BLE / UART 迁移到 17《AXTP Low-Bandwidth Degradation》，不作为当前 v1 Core 主线。

---

## 5. Payload 分类

AXTP v1 Core 只定义三类顶层 PayloadType：

| PayloadType | 职责 |
|---|---|
| CONTROL | OPEN / ACCEPT、心跳、ACK/NACK、关闭、恢复等协议运行时信令 |
| RPC | Hello / Identify / Request / Response / Event 等结构化业务控制面 |
| STREAM | OTA、文件、日志、音视频、传感器等长生命周期数据面 |

具体 wire format 见 02《AXTP Frame and Payload Spec》。

---

## 6. 默认会话流程

```text
Client -> Server: CONTROL OPEN
Server -> Client: CONTROL ACCEPT
Server -> Client: RPC Hello
Client -> Server: RPC Identify
Server -> Client: RPC Identified
Client -> Server: RPC capability.supportedMethods
```

`READY` 保留为可选三步确认名称，但 v1 Core 默认不要求实现；默认握手只要求 OPEN / ACCEPT。

---

## 7. v1 Capability 策略

v1 Core 保留 `capability` 域，但不实现完整 Capability Model。v1 Core 只强制 `capability.supportedMethods`，用于返回当前设备、当前固件、当前会话、当前鉴权状态下支持的 methodId 集合。

完整 `capability.getAll` / `capability.query` / capability schema 属于 v2/P1 扩展。

---

## 8. 文档索引

| 文档 | 内容 |
|---|---|
| 02《AXTP Frame and Payload Spec》 | Standard Header、PayloadType、CRC、分片 |
| 03《AXTP Transport Profiles》 | USB HID / TCP / WebSocket JSON / Cloud Reverse 连接形态 |
| 04《AXTP Control Session Spec》 | OPEN / ACCEPT / READY / ACK / NACK / HEARTBEAT / CLOSE |
| 05《AXTP RPC Session Spec》 | Hello / Identify / Identified / Binary RPC / methodId / eventId |
| 06《AXTP Stream Spec》 | 16B STREAM Header、streamId / seq / cursor、resume / retransmit / flow control |
| 07《AXTP Compatibility and Versioning》 | v1 freeze rules、reserved 规则、ID 不复用、Legacy migration |
| 17《AXTP Low-Bandwidth Degradation》 | Compact / HID-64 / BLE / UART 降级路径 |
