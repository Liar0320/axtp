# AXTP Conformance

AXTP conformance 用例维护在 `docs/conformance/` 下，是协议事实源的一部分。runtime 和工具仓库不应重新定义这些用例，而应加载本目录，并根据自己声明的 runtime profile 执行匹配用例。

## 目录结构

| 路径 | 说明 |
|---|---|
| `manifest.yaml` | 声明 conformance levels 以及每个 level 的 required cases。 |
| `schemas/` | case 和 result 的 JSON Schema。 |
| `profiles/` | profile 级验收期望。 |
| `fixtures/` | 协议行为用例使用的设备画像。 |
| `cases/` | YAML 格式的用例描述。 |

## 校验

```bash
pnpm --dir generators install --frozen-lockfile
pnpm --dir generators build
scripts/validate-conformance.sh
```

Runtime 仓库应让 `AXTP_SPEC_PATH` 指向本仓库 checkout 或已发布的 AXTP spec artifact。源码 checkout 使用 `docs/conformance/`；release artifact 为兼容下游，也可能把同一内容暴露为 artifact 根目录下的 `conformance/`。

Phase 1 runtime 应优先覆盖：

- WebSocket JSON：Hello / Identify / Request / Response / Event。
- Standard Framed：OPEN / ACCEPT、HEARTBEAT / HEARTBEAT_ACK、CLOSE / CLOSE_ACK、基础 RPC、STREAM open/data/close。
- ACK / NACK 严格重传不作为 Phase 1 必选项，只有 runtime 声明支持对应可靠传输 profile 时才验收。

STREAM 用例用于验收 P0 audio/video 媒体数据面。当前 case 使用 `video.openStream` / `video.closeStream` 表示业务域建流和关流，不要求实现常规 `stream.open` / `stream.close`；正式产品发布前，具体 video/audio 方法仍必须从 `docs/protocol/` 草案采纳到 `registry/` 并出现在 generated protocol 中。
