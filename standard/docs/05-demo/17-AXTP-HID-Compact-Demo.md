# 17《AXTP HID Demo》

版本：v1.2
状态：Superseded / Non-normative

本文档旧版本曾包含未同步的 HID Compact Header、ACK 与 STREAM 示例。AXTP v1 正式 HID 实现不得以旧版本本文作为编码依据。

正式端到端示例以：

```text
22-AXTP-MVP-Normative-Demo.md
```

为准。

## 1. 当前 HID 实现要求

HID 默认使用 Standard Frame Profile，Report Size ≤ 64B 时通过 CONTROL OPEN 协商降级为 Compact：

**Standard Profile（默认）：**

```text
12B Standard Header（含 Magic AX）
CRC16 Footer
PayloadLength = uint16
MessageId = uint16
FrameIndex/FrameCount = uint8
```

**Compact Profile（协商降级，Report Size ≤ 64B）：**

```text
4B Compact Header
CRC8 Footer
无 Magic
PayloadLength = uint8
MessageId = uint8
FrameInfo = FrameIndex/FrameCount nibbles
```

**Control Payload（两种 Frame Profile 下相同）：**

```text
统一 5B 固定头：opcode(1B) + controlId(2B) + statusCode(2B) + TLV body
```

HID 64B Report 若包含 1B Report ID，Compact 可用 Frame Payload 为：

```text
64 - 1 - 4 - 1 = 58B
```

STREAM Payload 必须使用 `04-AXTP-Stream流式传输协议规范.md` 的 Standard(16B) 或 Compact(8B) L2 Header，在 RPC 建流阶段协商。

## 2. 禁止作为实现依据的旧内容

新实现不得使用旧版本中的：

```text
旧 Compact Header（HID 强制 Compact 的旧描述）
旧 ACK 触发规则
旧 Stream Payload
旧 Stream metadata
旧扩展 Header 示例
本地定义的 Legacy CmdValue 映射
```

## 3. 替代文档

| 目标 | 使用文档 |
| --- | --- |
| HID MVP 流程 | `22-AXTP-MVP-Normative-Demo.md` |
| Frame Header（Standard/Compact） | `01-AXTP-整体协议规范.md` |
| Control Payload（统一 5B 头） | `02-AXTP-Control信令协议规范.md` |
| STREAM | `04-AXTP-Stream流式传输协议规范.md` |
| Legacy 迁移 | `14-AXTP-老协议适配与迁移规范.md` |
