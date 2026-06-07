# 1-core/03《AXTP Frame and Payload Spec》

> Status: AXTP v1 Core Freeze Candidate
> Spec Version: 1.0.0-rc1
> Scope: Standard Frame wire format / PayloadType / fragmentation / CRC

版本：v1.0.0-rc1
状态：AXTP v1 Core Freeze Candidate
适用范围：AXTP v1 Core 的 Standard Framed 模式
前置文档：`docs/specs/1-core/02-Protocol-Framework.md`
后续文档：`docs/specs/1-core/04-Transport-Profiles.md`、`docs/specs/1-core/05-Control-Session.md`、`docs/specs/1-core/06-RPC-Session.md`、`docs/specs/1-core/07-Stream-Data-Plane.md`、`docs/specs/1-core/08-Low-Bandwidth-Degradation.md`

---

## 1. 文档目的

本文档定义 AXTP v1 Core 的正式二进制帧格式：

- Standard Frame Header 固定 12B
- PayloadType 固定为 CONTROL / RPC / STREAM
- CRC16 覆盖 Header + Payload
- MessageId 与 Fragment 语义
- 与 WebSocket Unframed JSON 的边界

Compact / HID-64 / BLE / UART 等低带宽降级路径不属于 AXTP v1 Core 必选实现，统一移入 `docs/specs/1-core/08-Low-Bandwidth-Degradation.md`。

---

## 2. 协议模式

AXTP v1 定义两条正式接入路径：

| 模式 | Frame Header | CONTROL | RPC | STREAM | 典型传输 |
|---|---|---:|---:|---:|---|
| Standard Framed | 12B Standard Header | 是 | JSON / BINARY | 是 | AXTP-USB-HID、AXTP-TCP |
| WebSocket Unframed JSON | 无 | 否 | JSON | 否 | AXTP-WS-JSON、AXTP-WS-CLOUD-REVERSE |

同一连接不得混用两种模式。WebSocket Unframed JSON 使用 05《RPC Session Spec》的 `sid` / `op` / `d` JSON Envelope，不承载 Frame Header、CONTROL Payload、STREAM Payload、CRC 或 ACK/NACK。

### 2.1 两条路径的线上外形

Standard Framed 路径在线上始终是：

```text
Standard Frame Header(12B) + Payload(N) + CRC16(2B)
```

Frame Header 只告诉接收方 Payload 属于 CONTROL / RPC / STREAM 哪一类。Payload 内部结构由对应 parser 继续解析。

WebSocket Unframed JSON 路径在线上始终是：

```text
WebSocket message payload = JSON { "sid": "...", "op": N, "d": { ... } }
```

该路径没有 Frame Header、CONTROL Payload、STREAM Payload、CRC16、Binary RPC 15B Header，也不参与 CONTROL ACK/NACK / RESUME。

---

## 3. PayloadType

Standard Framed 模式中，Frame Header 的 `PayloadType` 固定为三类：

| ID | 名称 | 作用 |
|---:|---|---|
| `0x01` | `CONTROL` | 协议运行时信令：OPEN、ACCEPT、HEARTBEAT、ACK、NACK、CLOSE |
| `0x02` | `RPC` | 结构化业务控制面：Hello、Identify、Request、Response、Event |
| `0x03` | `STREAM` | 连续数据面：视频帧、音频帧、固件更新数据块、文件块 |

PayloadType 只选择一级 parser，不表达具体业务类型：

```text
正确：PayloadType = RPC,    methodId = 已采纳业务方法
正确：PayloadType = STREAM, streamId = 已采纳建流方法返回的 streamId
错误：PayloadType = VIDEO / FIRMWARE_UPDATE / FILE
```

---

## 4. Standard Frame Header

AXTP v1 Core 只要求实现 Standard Frame：

```text
+-----------------------------+------------+-----------+
| Standard Frame Header (12B) | Payload(N) | CRC16(2B) |
+-----------------------------+------------+-----------+
```

```text
Offset  0: Magic[0](1)  Magic[1](1)  Version(1)  PayloadType(1)
Offset  4: PayloadLength(2)  SourceId(1)  DestinationId(1)
Offset  8: MessageId(2)  FrameIndex(1)  FrameCount(1)
Offset 12: Payload starts
Footer:    CRC16(2)，位于 Payload 末尾
```

| 字段 | 偏移 | 长度 | 类型 | 说明 |
|---|---:|---:|---|---|
| `Magic[0]` | 0 | 1B | uint8 | 固定 `0x41`（ASCII `A`） |
| `Magic[1]` | 1 | 1B | uint8 | 固定 `0x58`（ASCII `X`） |
| `Version` | 2 | 1B | uint8 | 当前为 `0x01` |
| `PayloadType` | 3 | 1B | enum | CONTROL=0x01 / RPC=0x02 / STREAM=0x03 |
| `PayloadLength` | 4 | 2B | uint16 | Payload 字节数，不含 Header 和 CRC |
| `SourceId` | 6 | 1B | uint8 | 源逻辑节点 |
| `DestinationId` | 7 | 1B | uint8 | 目标逻辑节点 |
| `MessageId` | 8 | 2B | uint16 | 逻辑 Message ID |
| `FrameIndex` | 10 | 1B | uint8 | 当前分片序号，从 0 开始 |
| `FrameCount` | 11 | 1B | uint8 | 分片总数，未分片时为 1 |
| `CRC16` | Footer | 2B | uint16 | CRC16-CCITT-FALSE，覆盖 Header(12B) + Payload |

所有多字节整数在线格式中均使用 Little-Endian。

---

## 5. Header 字段规则

### 5.1 Magic

`Magic = 0x41 0x58` 用于 TCP 等字节流传输中的帧同步。接收端在 WAIT_MAGIC 状态下扫描 `0x41 0x58` 后再解析 Version、PayloadLength 和 CRC。

### 5.2 Version

`Version` 表示 Standard Header 解析规则。新增 MethodId、EventId、ErrorCode、Stream Profile、TLV 字段不需要升级 Version；只有 Header 字段顺序、长度、语义或 PayloadType 编码发生不兼容变化时才升级。

### 5.3 SourceId / DestinationId

`SourceId` 和 `DestinationId` 表示 AXTP 逻辑端点，不等同于 IP、MAC、USB 地址。点对点设备场景可以固定分配；网关、多设备路由场景可使用它们进行逻辑转发。

### 5.4 MessageId / Fragment

MessageId 标识一次完整逻辑 Message：

- 未分片 Message 也必须有 MessageId
- 同一 Message 的所有 Fragment 必须共享同一 MessageId
- `FrameIndex` 从 0 递增到 `FrameCount - 1`
- Request / Response 匹配依赖 RPC `requestId`，不依赖 Frame `MessageId`

---

## 6. Payload Header 边界

Standard Frame Header 只负责承载 Payload，不解释 Payload 内部业务结构：

```text
CONTROL frame:
  Standard Frame Header(payloadType=CONTROL)
  + Control Payload = opcode(1) + controlId(2) + statusCode(2) + TLV body(N)
  + CRC16

RPC Binary frame:
  Standard Frame Header(payloadType=RPC)
  + RPC Binary Payload = rpcEncoding(1) + rpcOp(1) + sid(4) + requestId(4)
                       + methodOrEventId(2) + statusCode(2) + bodyEncoding(1)
                       + body(N)
  + CRC16

RPC JSON frame:
  Standard Frame Header(payloadType=RPC)
  + RPC JSON Payload = UTF-8 JSON { "sid": "...", "op": N, "d": { ... } }
  + CRC16

STREAM frame:
  Standard Frame Header(payloadType=STREAM)
  + STREAM Payload = streamId(4) + seqId(4) + cursor(8) + data(N)
  + CRC16
```

对应关系：

| PayloadType | Payload 内部结构 | 规范归属 |
|---|---|---|
| CONTROL | 5B 固定头 + TLV body | 04《Control Session Spec》 |
| RPC / BINARY | 15B Binary RPC Header + body | 05《RPC Session Spec》 |
| RPC / JSON | JSON `sid` / `op` / `d` envelope | 05《RPC Session Spec》 |
| STREAM | 16B STREAM Header + data | 06《Stream Spec》 |

WebSocket Unframed JSON 不包在 Standard Frame 中：

```text
WebSocket message payload = JSON { "sid": "...", "op": N, "d": { ... } }
```

STREAM Header 固定 16B：`streamId:uint32`、`seqId:uint32`、`cursor:uint64`。新增业务流类型只扩展 Stream Profile Registry，不改变 STREAM Header。

---

## 7. CRC 与错误处理

Standard Frame 使用 CRC16-CCITT-FALSE：

| 项目 | 值 |
|---|---|
| Poly | `0x1021` |
| Init | `0xFFFF` |
| 覆盖范围 | Header(12B) + Payload |
| Footer 长度 | 2B |

接收方必须先校验 Header 长度、PayloadLength、PayloadType、Fragment，再校验 CRC。CRC 失败时应通过 CONTROL NACK 返回 `FRAME_CRC_ERROR`；无法安全返回时可以直接关闭连接。

---

## 8. 兼容与降级

AXTP v1 Core 不协商 Header Profile。Standard Framed transport 固定使用 `STANDARD_FRAME`；WebSocket Unframed JSON 固定不使用 Frame Header。

低带宽链路如果需要 Compact / HID-64 / BLE / UART：

- 不得新增 PayloadType
- 不得改变 CONTROL / RPC / STREAM Payload Header
- 不得改变 STREAM 16B Header
- 只能改变外层帧头、分片、MTU 与确认策略

完整降级说明见 `docs/specs/1-core/08-Low-Bandwidth-Degradation.md`。
