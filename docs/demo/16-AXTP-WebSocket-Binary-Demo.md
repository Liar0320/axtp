# 16《AXTP WebSocket Binary Demo》

版本：v1.1
状态：Superseded / Non-normative

本文档旧版本曾包含未同步的 WebSocket Binary Header、ACK 与 STREAM 示例。AXTP v1 正式 WebSocket Binary 实现不得以旧版本本文作为编码依据。

正式端到端示例以：

```text
22-AXTP-MVP-Normative-Demo.md
```

为准。

## 1. 当前 WebSocket Binary 实现要求

WebSocket Binary 必须使用 Standard Profile：

```text
12B Standard Header
Magic = 0x41 0x58
CRC16 Footer
PayloadType = CONTROL / RPC / STREAM
```

STREAM Payload 必须使用 `06-AXTP-Stream-Spec.md` 的 16B L2 Header。

## 2. 禁止作为实现依据的旧内容

新实现不得使用旧版本中的：

```text
旧 Header 布局
旧 ACK 触发规则
旧 Stream Payload
旧 Stream metadata
本地定义的 MethodId / ErrorCode / Capability
```

## 3. 替代文档

| 目标 | 使用文档 |
|---|---|
| WebSocket Binary MVP 流程 | `22-AXTP-MVP-Normative-Demo.md` |
| Frame Header | `02-AXTP-Frame-and-Payload-Spec.md` |
| Control ACK/NACK | `04-AXTP-Control-Session-Spec.md` |
| RPC | `05-AXTP-RPC-Session-Spec.md` |
| STREAM | `06-AXTP-Stream-Spec.md` |
