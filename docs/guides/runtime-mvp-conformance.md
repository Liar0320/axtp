# Runtime MVP 与 Conformance 接入指南

这份文档给 runtime、SDK、mock server 和测试同学一个第一周可执行清单：先实现 AXTP Phase 1 最小闭环，再接入 `docs/conformance/**` 做验收。

如果你只是想最快跑通业务 RPC，先看 [quickstart.md](quickstart.md)。如果你要实现 CONTROL、RPC session、sid、requestId、心跳和关闭，请同时看 [core-protocol-flow.md](core-protocol-flow.md)。

## 1. Phase 1 MVP 范围

Phase 1 的目标不是一次做完所有高级能力，而是先把 runtime 的共同地基打牢。

| 能力 | WebSocket JSON runtime | Standard Framed runtime |
|---|---:|---:|
| 读取 `protocol/axtp.protocol.yaml` 或 `docs/generated/protocol.json` | 是 | 是 |
| RPC Hello / Identify / Identified | 是 | 是 |
| RPC Request / RequestResponse / Event | 是 | 是 |
| `sid` 固定 8 位 hex string / binary `uint32` | 是 | 是 |
| `requestId` 匹配未完成请求 | 是 | 是 |
| 标准错误响应形状 | 是 | 是 |
| Standard Frame Header / CRC16 | 否 | 是 |
| CONTROL OPEN / ACCEPT | 否 | 是 |
| CONTROL HEARTBEAT / HEARTBEAT_ACK | 否 | 是 |
| CONTROL CLOSE / CLOSE_ACK | 否 | 是 |
| STREAM | 否 | 后续 profile |

Phase 1 暂不实现：

```text
ACK/NACK 重传
RESUME / SESSION_RESET
PING/PONG RTT 测量
STREAM 固件 / 文件 / 媒体数据面
链路加密
自定义 binary JSON
```

默认鉴权策略是 `AXTP-AUTH-NONE`。只有产品或客户明确要求密码门禁时，才启用 OBS-style challenge-response。

## 2. Runtime 需要消费什么

不要在 runtime 仓库重新定义协议事实。最小输入包如下：

| 输入 | 路径 | 用途 |
|---|---|---|
| Spec lock | `AXTP_SPEC.lock.yaml` | 记录 runtime 绑定的 spec tag / commit |
| Protocol IR | `protocol/axtp.protocol.yaml` | generator、runtime、mock server 的机器合同 |
| Generated JSON | `docs/generated/protocol.json` | SDK、测试和自动化工具读取 |
| Generated Markdown | `docs/generated/protocol.md` | 联调和人工检查 |
| Conformance | `docs/conformance/**` | 行为一致性验收 |

开发期可以让 runtime 指向本地 spec checkout：

```bash
export AXTP_SPEC_PATH=/Users/qing/Desktop/sources/gitee/axtp
```

发布期必须指向明确的 spec tag、commit 或 release artifact，不能依赖浮动 `main`。

## 3. WebSocket JSON MVP Checklist

适合 App、Web、Node、Python、mock server、云端控制面。

| 检查项 | 通过标准 |
|---|---|
| 连接建立 | WebSocket open 后，Logical Server 先发送 Hello。 |
| Hello | `sid=""`，`op=0`，携带 `axtpVersion` 和 `rpcVersion`。默认不携带认证字段。 |
| Identify | Logical Client 发送 `sid=""`、`op=2`、`rpcVersion`，可选 `eventMasks`。 |
| Identified | Logical Server 返回 `op=3` 和 8 位 hex `sid`。 |
| Request | `op=7`，`d.id` 在同一 session 内未完成前不得复用。 |
| Response | `op=8`，`d.id` 必须匹配请求；成功带 `status.ok=true`。 |
| Error | 失败带 `status.ok=false`、稳定错误码，不携带成功 `result`。 |
| Event | `op=6`，事件名必须来自 generated protocol。 |
| Generated | 只调用 `docs/generated/protocol.json` 中已存在 method/event。 |
| Conformance | 至少通过 `core` 和 `websocket-jsonrpc` level。 |

## 4. Standard Framed MVP Checklist

适合 TCP、USB HID、需要二进制 Frame Header 或未来 STREAM 的设备链路。

| 检查项 | 通过标准 |
|---|---|
| Header parser | 校验 `AX` magic、version、payloadType、payloadLength、fragment 字段。 |
| CRC16 | CRC 覆盖 Header + Payload，不覆盖 CRC 自身；多字节整数 little-endian。 |
| Payload dispatch | `payloadType=CONTROL` 进 ControlParser，`RPC` 进 RpcParser，`STREAM` 可暂不实现。 |
| CONTROL OPEN | 只允许 Physical Client 在 `LINK_CONNECTED` 发送。 |
| CONTROL ACCEPT | `controlId` 匹配 OPEN；成功后进入 `FRAMING_READY`。 |
| `ackMode` | Phase 1 默认 `NONE`，不实现 ACK/NACK 重传。 |
| `sessionId` | ACCEPT 可选；可保存到连接上下文，但不得用于业务路由。 |
| HEARTBEAT | 双向可发；对端必须用相同 `controlId` 返回 HEARTBEAT_ACK。 |
| Heartbeat timeout | 连续 3 次未收到 HEARTBEAT_ACK 后关闭 transport 并清理上下文。 |
| CLOSE | 任意一端可发；对端返回相同 `controlId` 的 CLOSE_ACK 后关闭 transport。 |
| RPC session | CONTROL 成功后，继续执行 Hello / Identify / Identified。 |
| Conformance | 至少通过 `core` 和 `framed-binary` level。 |

## 5. Conformance Quickstart

主库先验证 conformance 源文件：

```bash
pnpm --dir generators install --frozen-lockfile
pnpm --dir generators build
scripts/validate-conformance.sh
```

runtime 仓库接入时，先让测试脚本找到 spec：

```bash
export AXTP_SPEC_PATH=/path/to/axtp-spec-or-release-artifact
```

runtime 脚本应兼容两个路径：

```text
$AXTP_SPEC_PATH/docs/conformance
$AXTP_SPEC_PATH/conformance
```

第一个路径用于 spec 源码 checkout，第二个路径用于 release artifact 兼容。

选择要声明的 level：

| runtime 类型 | 最小 level | 之后可加 |
|---|---|---|
| WebSocket JSON | `core`、`websocket-jsonrpc` | `capability`、`event` |
| Standard Framed | `core`、`framed-binary` | `capability`、`event`、`stream` |
| mock server | `core`、`websocket-jsonrpc` | `capability`、`event` |
| 固件 / MCU | `core`、`framed-binary` | `stream` 或低带宽 profile |

当前 `framed-binary` 最小握手用例应覆盖：

```text
handshake.open_accept
handshake.heartbeat
handshake.close
rpc.request_id_match
```

如果某个 case 属于 runtime 尚未声明的 profile，不要在实现里偷偷跳过；应调整 runtime 声明的 level，或者等对应能力实现后再声明支持。若 case 与 Phase 1 裁决冲突，应先修正主库 conformance case 和 manifest，再要求 runtime 通过。

## 6. 失败时先看哪里

| 失败现象 | 优先检查 |
|---|---|
| Hello 后不能进入 session | Logical Server / Logical Client 方向是否反了。 |
| requestId 对不上 | Response 是否复用了请求的 `d.id`，并且未完成请求没有复用 id。 |
| sid 被拒绝 | JSON sid 是否固定 8 位 hex string；新建 session 是否使用 `sid=""`。 |
| Framed CRC 失败 | CRC 是否覆盖 Header + Payload；payloadLength 是否只算 Payload。 |
| OPEN 后不能发 RPC | ACCEPT 是否成功，状态是否进入 `FRAMING_READY`。 |
| 心跳误判断线 | 是否用相同 `controlId` 返回 HEARTBEAT_ACK；超时计数是否在收到 HEARTBEAT_ACK 后清零。 |
| CLOSE 后还有业务请求 | 收到 CLOSE 后是否停止接受新 Request，并进入关闭流程。 |
| method not found | runtime 是否只加载当前 spec 的 generated protocol，而不是旧常量。 |

## 7. 完成定义

Phase 1 runtime 可以认为达到 MVP，当它满足：

```text
1. 绑定明确 AXTP spec lock。
2. 能读取 generated protocol。
3. 能完成 Hello / Identify / Identified。
4. 能完成至少一次 generated method 的 Request / Response。
5. 能返回标准错误形状。
6. 能处理事件或明确声明暂不支持 event level。
7. Standard Framed runtime 能完成 OPEN / ACCEPT、HEARTBEAT、CLOSE。
8. 通过已声明 conformance level。
```

做到这里，runtime 就可以进入业务协议接入和 SDK 包装；STREAM、恢复、重传、加密等能力后续按 profile 增量实现。
