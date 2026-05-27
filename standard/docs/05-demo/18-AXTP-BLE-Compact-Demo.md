# 18《AXTP BLE Compact Demo》

版本：v1.1
状态：Superseded / Non-normative

本文档旧版本曾包含未同步的 BLE Compact Header、ACK 与 STREAM 示例。AXTP v1 正式 BLE Compact 实现不得以旧版本本文作为编码依据。

正式端到端示例以：

```text
22-AXTP-MVP-Normative-Demo.md
```

为准。

## 1. 当前 BLE Compact 实现要求

BLE GATT 使用 Compact Frame Profile：

```text
4B Compact Header
CRC8 Footer
无 Magic
PayloadLength = uint8
MessageId = uint8
FrameInfo = FrameIndex/FrameCount nibbles
```

**Control Payload（与 Standard Frame Profile 下相同）：**

```text
统一 5B 固定头：opcode(1B) + controlId(2B) + statusCode(2B) + TLV body
```

STREAM Payload 必须使用 `04-AXTP-Stream流式传输协议规范.md` 的 Compact 8B L2 Header（在 RPC 建流阶段协商）。单帧 STREAM data 理论上限为：

```text
255 - 8 = 247B（Compact STREAM Header）
```

实际可用数据还受 ATT MTU、连接参数与窗口策略限制。

## 2. 禁止作为实现依据的旧内容

新实现不得使用旧版本中的：

```text
旧 Compact Header
旧 ACK 触发规则
旧 Stream Payload
旧 Stream metadata
本地定义的 Stream Profile / Capability / MethodId
```

## 3. 替代文档

| 目标 | 使用文档 |
| --- | --- |
| BLE Compact MVP 流程 | `22-AXTP-MVP-Normative-Demo.md` |
| Compact Frame Header | `01-AXTP-整体协议规范.md` |
| Control Payload（统一 5B 头） | `02-AXTP-Control信令协议规范.md` |
| STREAM | `04-AXTP-Stream流式传输协议规范.md` |
| Legacy 迁移 | `14-AXTP-老协议适配与迁移规范.md` |
