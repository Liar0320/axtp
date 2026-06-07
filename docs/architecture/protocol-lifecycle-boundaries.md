# AXTP 协议生命周期与边界

本文解释 AXTP Phase 1 的核心边界，帮助 runtime、SDK、测试和协议维护者用同一套语言理解仓库。

## 1. 两个 session 不要混用

| 概念 | 所在层 | 由谁产生 | Phase 1 用途 |
|---|---|---|---|
| Link Context `sessionId` | CONTROL | Physical Server 可在 ACCEPT 中返回 | 可保存到连接上下文，用于日志、追踪和未来 RESUME；不参与业务路由。 |
| RPC `sid` | RPC | Logical Server 在 Identified 中返回 | 业务 session ID；所有 Request / Response / Event 都必须携带。 |

`sessionId` 解决“这条 framed link 是哪条链路”的问题。`sid` 解决“这次业务会话是谁”的问题。设备直连时二者看起来可能一一对应，但网关、多客户端、云反连、断线恢复和调试追踪场景会让二者自然分离。

## 2. Phase 1 控制面只做三件事

CONTROL 在 Phase 1 只负责：

| 能力 | 消息 | 目的 |
|---|---|---|
| 建连协商 | `OPEN / ACCEPT` | 建立 Standard Framed link context，协商 MTU、Frame 大小、RPC encoding 和心跳间隔。 |
| 保活 | `HEARTBEAT / HEARTBEAT_ACK` | 发现半开连接、静默断链和 transport 空闲超时。 |
| 优雅关闭 | `CLOSE / CLOSE_ACK` | 让对端停止新业务、清理上下文并关闭 transport。 |

`ACK / NACK` 保留给后续可靠传输、低带宽链路、固件传输或 STREAM profile。普通 RPC 的业务结果由 `requestId` 和 `RequestResponse.status` 表达，不需要每个 Frame 再做严格确认。

## 3. RPC encoding 与 bodyEncoding 的边界

`PayloadType=RPC` 的第一个字节永远是 `rpcEncoding`：

| rpcEncoding | 值 | 含义 |
|---|---:|---|
| JSON | `0x01` | UTF-8 JSON 编码的 `{ sid, op, d }` envelope。 |
| CBOR | `0x02` | 后续 CBOR 编码的 `{ sid, op, d }` envelope。 |
| MSGPACK | `0x03` | 后续 MessagePack 编码的 `{ sid, op, d }` envelope。 |
| JSON_BINARY | `0x04` | 固定 15B 二进制 envelope，再由 `bodyEncoding` 解释 body。 |

`bodyEncoding` 只在 `JSON_BINARY` 下有意义。Phase 1 只保留 `NONE / TLV8 / TLV16`，其中 `TLV8` 是最小二进制 body 实现。

## 4. STREAM 是 Phase 1 的 audio/video 数据面

Phase 1 先实现控制面、业务 RPC 闭环，以及 Standard Framed 的 STREAM 数据面。P0 重点是 audio/video 媒体流：通过 `video.stream` / `audio.stream` 等 RPC 方法打开或关闭流，通过 `PayloadType=STREAM` 承载实际媒体数据。

固件、文件、日志等也会复用同一套 STREAM Header 和 Stream Context，但这些业务 profile 可以后续增量采纳。ACK/NACK 严格重传不是 Phase 1 前置条件；P0 STREAM 可先依赖有序 `seqId/cursor`、CRC 和业务播放器/解码器容错。

## 5. Domain-feature-method 的使用方式

业务协议不要从 transport 代码开始设计。正确路径是：

```text
业务需求
  -> docs/flows/<scenario>.md
  -> docs/protocol/<domain>/<domain.feature>.md
  -> registry/domains/<domain>/domain.yaml
  -> protocol/axtp.protocol.yaml
  -> docs/generated/*
  -> runtime / conformance
```

`domain.feature` 决定业务归属，`method/event/schema/error/capability` 决定机器可读事实。runtime 只消费 generated 产物和 conformance，不自行发明协议事实。

## 6. 谁是最终合同

| 内容 | 角色 |
|---|---|
| `docs/business/**`、`docs/flows/**`、`docs/protocol/**` | 输入、流程、草案和评审材料。 |
| `docs/specs/**` | 人工维护的协议规则和治理约束。 |
| `registry/**/*.yaml`、`registry/domains/**/*.yaml` | 手写机器事实源。 |
| `protocol/axtp.protocol.yaml`、`docs/generated/**` | 由 Generator 输出的实现合同。 |
| `docs/conformance/**` | runtime 行为验收输入。 |

如果 generated 与草案冲突，研发应相信 generated；如果 generated 与 specs 冲突，维护者应修正 specs 或 YAML 后重新生成。
