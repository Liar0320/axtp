# 15《AXTP WebSocket JSON-RPC Legacy Demo》

版本：v1.2
状态：Superseded / Legacy / Non-normative

本文档原用于 WebSocket Text + JSON-RPC 调试。AXTP v1 正式实现不得以本文作为 wire format、RPC Parser、Capability 或 Stream 示例依据。

正式端到端示例以：

```text
22-AXTP-MVP-Normative-Demo.md
```

为准。

## 1. 保留目的

本文仅保留为历史迁移入口，用于说明旧 JSON-RPC 调试工具如何迁移到 AXTP：

```text
旧 WebSocket Text 调试输入
  -> DS-RPC Text Profile
  -> 或 Adapter 映射为 Framed AXTP RPC
```

Framed AXTP RPC 不承载旧 JSON-RPC envelope。迁移规则见：

```text
14-AXTP-老协议适配与迁移规范.md
03-AXTP-RPC协议与二进制映射规范.md
```

## 2. 禁止作为实现依据的内容

新实现不得从旧版本本文档复制：

```text
JSON-RPC envelope
WebSocket Text endpoint
旧 capability 字段
旧 Stream Profile 字段
旧错误映射示例
```

## 3. 当前替代路径

| 目标 | 使用文档 |
|---|---|
| 正式 MVP 流程 | `22-AXTP-MVP-Normative-Demo.md` |
| Framed RPC | `03-AXTP-RPC协议与二进制映射规范.md` |
| Legacy JSON-RPC 迁移 | `14-AXTP-老协议适配与迁移规范.md` |
| Registry 编号 | `09/10/11/12/13` 注册表 |
