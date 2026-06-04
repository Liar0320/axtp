# AXTP How To Use

本文用具体例子说明当前仓库怎么查协议、怎么生成产物、怎么用 CLI/SDK/runtime、怎么把业务需求变成可评审草案，再采纳为正式协议。

## 1. 先理解权威模型

这个文件是实操手册：查当前协议、跑 Generator、用 CLI/SDK/runtime、把业务需求推进到可采纳协议。开始操作前先记住四类材料：

```text
docs/protocol/<domain>/<domain.feature>.md
  业务草案和评审输入，不是最终实现合同

registry/**/*.yaml + registry/domains/**/*.yaml
  人工维护的机器事实源，是 Generator 输入

protocol/axtp.protocol.yaml
  Generator 输出的 Protocol IR，不手写

docs/generated/* + tooling/* + runtime generated headers
  Generator 输出的人读/工具/runtime 产物，不手写
```

### 1.1 YAML 从哪里来

`registry/**/*.yaml` 和 `registry/domains/**/*.yaml` 不是从 Markdown 自动生成的，也不是 Generator 的输出。它们是人工评审后写入的机器事实源，通常由协议维护者、架构师或协议采纳流程把已经确认的规范事实整理成 YAML：

| YAML 位置 | 事实来源 | 产生方式 | 和 specs / docs/protocol 的关系 |
|---|---|---|---|
| `registry/core/*.yaml` | AXTP Core 架构裁决、wire format、payload type、RPC op、transport profile、stream profile 等核心规则 | 根据 `docs/specs/00-06`、`18`、`19` 中已冻结或已确认的规则人工维护 | `docs/specs` 是规则说明和治理依据；Core YAML 是这些规则的机器可读表达 |
| `registry/method`、`registry/event`、`registry/error`、`registry/capability`、`registry/schema` | 已采纳的 MVP/Core method、event、error、capability、公共 schema | 从已确认的规范表、MVP 决策、稳定公共能力中人工写入 | 对应规则由 `docs/specs/08-14` 约束；不是从 generated 文档反推 |
| `registry/domains/<domain>/domain.yaml` | 已评审通过的新业务域能力，例如 network、stream 等 domain 下的 method/event/schema/capability | 先在 `docs/protocol/<domain>/<domain.feature>.md` 写草案，评审通过后采纳到 domain YAML | `docs/protocol` 是草案和评审输入；domain YAML 才是采纳后的正式机器事实 |
| `registry/legacy/legacy_mapping.yaml` | 已确认的旧协议命令、状态码、payload 到 AXTP method/event/stream 的映射 | 根据 `docs/legacy-protocols/**`、`docs/migration/**` 和人工确认结果写入 | 旧协议材料只是证据来源；没有证据的 TBD 映射不能写入 YAML |

因此按下面规则操作：

- 修改普通业务能力时，通常先改 `docs/protocol/**` 草案，评审后再改 `registry/domains/<domain>/domain.yaml`。
- 修改命名、ID、schema、profile、兼容性等治理规则时，需要同步确认 `docs/specs/08-14`，再落 YAML。
- 修改 Standard Frame、CONTROL/RPC/STREAM payload header、transport profile 等 Core 规则时，必须先确认 `docs/specs/00-06/18/19` 的规范变化，再改 `registry/core/**` 或 Generator 校验逻辑。
- Generator 只读取 YAML、校验 YAML、聚合 Protocol IR、输出 generated 产物；它不负责把 `docs/protocol` 草案自动变成 YAML。

### 1.2 协议生命周期

| 层级 | Skill | 输入 | 输出 | 边界 |
|---|---|---|---|---|
| 总控路由 | `docs/dev/skills/axtp-protocol-workflow/SKILL.md` | 用户提出的“新增/修改/迁移/采纳/实现业务协议”任务 | 判断应该进入草案、采纳、修订、生成还是 runtime 实现 | 默认不直接写 YAML，先路由 |
| 流程阶段 | `docs/dev/skills/plan-protocol-flow/SKILL.md` | 业务场景、用户 story、UI 原型、端到端交互 | `docs/flows/<scenario>.md` 场景流程方案 | 只梳理协议步骤、已有覆盖和缺口，不写 YAML |
| 草案阶段 | `docs/dev/skills/draft-business-protocol/SKILL.md` | 大白话需求、旧协议线索、产品/架构想法 | `docs/protocol/<domain>/<domain.feature>.md` 草案 | 不写 registry，不生成正式协议 |
| 采纳阶段 | `docs/dev/skills/adopt-protocol-draft/SKILL.md` | 已评审草案 MD | specs 08-13 对齐；涉及 profile/MVP 时同步 14；草案 formalized；写入 YAML | 不采纳未确认 `[REVIEW-*]`，不手写 generated |
| 修订阶段 | `docs/dev/skills/amend-adopted-protocol/SKILL.md` | 已采纳或已生成协议的语义修正、字段删除、废弃、重命名或扩展 | amendment 记录、proposal/specs/YAML 修正、generated 重新生成 | 先判断 draft/experimental vs stable/MVP，不直接手写 generated |
| 生成阶段 | `docs/dev/skills/generate-axtp-protocol/SKILL.md` | 已采纳 YAML 事实源 | Protocol IR、generated docs、tooling JSON、test vectors、runtime generated headers | 只从 YAML 生成，不从 Markdown 推断新事实 |

每个阶段的责任分工如下：

| 阶段 | 主责角色 | 参与角色 | 主责做什么 | 参与角色确认什么 | 完成标准 |
|---|---|---|---|---|---|
| 需求输入 | 业务负责人 / 产品 / 架构 | 固件、上位机、后台、测试 | 描述业务目标、触发条件、设备行为、旧协议线索和优先级 | 确认需求是否真实存在、是否有旧协议兼容要求 | 有明确业务描述或旧协议证据 |
| 总控路由 | 协议维护者 / 架构 | 提需求的人 | 使用 `axtp-protocol-workflow` 判断走草案、采纳、生成还是 runtime 实现 | 确认当前阶段判断是否符合预期 | 明确下一步 skill 和允许修改范围 |
| 流程阶段 | 协议维护者 / 架构 | 产品、固件、上位机、后台、测试 | 使用 `plan-protocol-flow` 从业务 story 或 UI 原型生成 `docs/flows/**`，逐步列出协议调用、事件、已有覆盖和缺口 | 确认交互流程是否完整，哪些步骤是协议、哪些是 UI/业务逻辑 | 场景流程方案和下一步草案/修订清单 |
| 草案阶段 | 协议维护者 / 架构 | 业务、固件、上位机、后台、测试 | 使用 `draft-business-protocol` 搜索复用项，起草或更新 `docs/protocol/**`，写候选 method/schema/event/error/capability | 业务确认语义，固件确认可实现性，上位机/后台确认调用方式，测试确认可测性 | 草案带 `[REVIEW-*]`，open questions 明确 |
| 草案评审 | 架构 / 业务负责人 | 固件、上位机、后台、SDK/工具、测试 | 组织评审，逐项处理 `[REVIEW-*]` | 各端确认字段、错误码、事件、stream、legacy 映射和兼容边界 | 可采纳内容均为 `[REVIEW-OK]` 或等价确认 |
| 采纳阶段 | 协议维护者 / 架构 | 业务、固件、上位机、测试 | 使用 `adopt-protocol-draft` 对齐 specs 08-13/14，固定草案状态，写入 YAML，分配 ID / `bit_offset` / fieldId | 确认没有未解决 review blocker 被写入 YAML | `validate:sources` 通过，YAML 只含已确认事实 |
| 修订阶段 | 协议维护者 / 架构 | 业务、固件、上位机、后台、测试 | 使用 `amend-adopted-protocol` 修正已采纳事实，记录 amendment，判断删除/废弃/版本化策略 | 确认 draft/experimental 可直接修正，stable/MVP 不静默破坏 wire 合同 | amendment 记录、YAML/source validation、generated diff |
| 生成阶段 | 协议维护者 / SDK/工具 | 测试、研发 | 使用 `generate-axtp-protocol` 从 YAML 生成 Protocol IR、generated docs、tooling、test vectors、runtime generated headers | 确认 generated diff 符合本次协议变化 | `validate:protocol`、Generator tests、`git diff --check` 通过 |
| PR 发布 | 协议维护者 / 研发负责人 | 业务、固件、上位机、后台、测试 | 提交草案、specs、YAML、generated diff，说明兼容影响和测试结果 | 评审 generated 文档是否能支撑实现和验收 | PR 合并 main，generated 协议成为研发/测试依据 |
| 研发实现 | 固件 / 上位机 / 后台 / SDK | 测试、协议维护者 | 按 `docs/generated/protocol.md/json`、generated headers 和 test vectors 实现功能 | 测试确认正向、错误、event、stream、legacy 兼容用例 | 端到端联调和测试通过 |

`adopt-protocol-draft` 做的是“受控转译”：读取草案、specs 和现有 YAML，检查 `[REVIEW-*]` 状态，反向确认 08-13/14，计算 ID / `bit_offset` / fieldId，固定草案状态，并写入 YAML。它不是简单的 Markdown parser，因为协议采纳必须处理冲突、编号、兼容性和未确认事实。

实际开发时：

- 产品/架构/研发讨论端到端场景或 UI 原型时，先用 `plan-protocol-flow` 写 `docs/flows/**`，把 story 步骤、已有协议覆盖和缺口列清楚。
- 明确需要新增或修改协议后，再写 `docs/protocol/**` 草案。
- 草案评审通过后，使用 `adopt-protocol-draft` 把已确认事实写入 `registry/**` 或 `registry/domains/**`。
- 已采纳协议需要删除字段、收窄范围、重命名、废弃或扩展时，使用 `amend-adopted-protocol`，不要回到普通草案流程或手改 generated。
- 使用 `generate-axtp-protocol` 运行 Generator，刷新 generated 文档、JSON、C++ 头文件和测试向量。
- 研发和测试按 generated 产物实现，不按未采纳草案实现。

## 2. 查当前协议

### 2.1 看完整协议参考

```bash
open docs/generated/protocol.md
```

或者直接看 Markdown：

```bash
sed -n '1,220p' docs/generated/protocol.md
```

### 2.2 查 method

```bash
sed -n '1,120p' docs/generated/method_registry.generated.md
```

当前已有 method：

| methodId | name | status | 用途 |
|---:|---|---|---|
| `0x0101` | `device.getInfo` | mvp | 查询设备信息 |
| `0x0201` | `capability.supportedMethods` | mvp | 查询当前会话支持的 method bitmap |
| `0x0402` | `firmware.begin` | mvp | 开始固件升级 |
| `0x0403` | `firmware.end` | mvp | 结束固件数据传输 |
| `0x0404` | `firmware.verify` | mvp | 校验固件 |
| `0x0405` | `firmware.apply` | mvp | 应用固件 |
| `0x0501` | `stream.open` | draft | 打开 HID media stream |
| `0x0601` | `display.getBrightness` | mvp | 查询亮度 |
| `0x0602` | `display.setBrightness` | mvp | 设置亮度 |
| `0x0E07` | `network.getApInfo` | draft | 查询 AP 信息 |

### 2.3 查 event

```bash
sed -n '1,120p' docs/generated/event_registry.generated.md
```

当前已有 event：

| eventId | name | status | 用途 |
|---:|---|---|---|
| `0x0402` | `firmware.updateProgress` | mvp | OTA 进度 |
| `0x0403` | `firmware.updateCompleted` | mvp | OTA 完成 |
| `0x0404` | `firmware.updateFailed` | mvp | OTA 失败 |
| `0x0501` | `stream.opened` | draft | stream 已打开 |
| `0x0503` | `stream.error` | draft | stream 异常 |
| `0x0607` | `display.brightnessChanged` | mvp | 亮度变化 |
| `0x0E01` | `network.apInfoChanged` | draft | AP 信息变化 |

### 2.4 查机器可读协议

```bash
node -e "const p=require('./docs/generated/protocol.json'); console.log(p.methods.map(m => [m.methodId, m.name]));"
```

`docs/generated/protocol.json` 适合 SDK、工具、测试和自动化脚本消费。

## 3. 运行 Generator

### 3.1 安装依赖

```bash
pnpm --dir generators install
```

仓库提交了 `generators/pnpm-lock.yaml`，建议使用 pnpm。

### 3.2 构建 Generator

```bash
pnpm --dir generators build
```

### 3.3 校验 Source YAML

```bash
pnpm --dir generators validate:sources
```

这个命令会检查：

- ID 唯一性。
- method/event/schema 引用。
- domain/bit offset 规则。
- Source YAML 和关键 wire 事实的一致性。

### 3.4 生成所有产物

```bash
pnpm --dir generators generate
```

会刷新：

```text
protocol/axtp.protocol.yaml
docs/generated/protocol.md
docs/generated/protocol.json
docs/generated/*_registry.generated.md
tooling/mcp/*.generated.json
tooling/test-vectors/*
runtimes/cpp-core/include/axtp/generated/*
```

### 3.5 校验 Protocol IR

```bash
pnpm --dir generators validate:protocol
```

### 3.6 文档-only 改动的建议检查

如果只改 README、How To Use、Kickoff 这类文档：

```bash
pnpm --dir generators build
pnpm --dir generators test
pnpm --dir generators validate:sources
pnpm --dir generators validate:protocol
git diff --check
```

## 4. 使用 axtpctl

`axtpctl` 是调试、产测和集成检查工具，位置在：

```text
runtimes/cpp-tools/axtpctl
```

P0 支持：

- `--help`
- `call <method|--method-id>`
- `capability methods`
- `list-methods`
- `ping`
- `inspect frame --hex <HEX>`

### 4.1 构建 axtpctl

当前仓库没有顶层 CMakeLists，按工具目录单独构建：

```bash
cmake -S runtimes/cpp-tools/axtpctl -B build/axtpctl
cmake --build build/axtpctl
```

运行帮助：

```bash
./build/axtpctl/axtpctl --help
```

### 4.2 Mock 调用 device.getInfo

```bash
./build/axtpctl/axtpctl --transport mock call device.getInfo --json '{}'
```

短命令：

```bash
./build/axtpctl/axtpctl -c device.getInfo -o json
```

用途：不用真实设备，先验证 method registry、SDK dynamic call 和 CLI 参数。

### 4.3 Mock 调用 display.setBrightness

```bash
./build/axtpctl/axtpctl \
  --transport mock \
  call display.setBrightness \
  --json '{"value":80}'
```

短命令：

```bash
./build/axtpctl/axtpctl -c display.setBrightness --json '{"value":80}' -o json
```

### 4.4 查看 method 列表

```bash
./build/axtpctl/axtpctl list-methods
```

或者：

```bash
./build/axtpctl/axtpctl capability methods
```

### 4.5 检查 frame hex

```bash
./build/axtpctl/axtpctl inspect frame --hex 415801020000000000000001a950
```

这个命令用于解析 Standard Frame header、payload length、payload type 和 CRC 信息。普通业务调用不应该绕过 SDK；只有 inspect 这类诊断命令可以直接碰 frame parser。

### 4.6 调真实设备的方向

HID 示例形态：

```bash
./build/axtpctl/axtpctl \
  --transport hid \
  --vid 0x1234 \
  --pid 0x5678 \
  -c device.getInfo \
  -o json
```

TCP 示例形态：

```bash
./build/axtpctl/axtpctl \
  --transport tcp \
  --host 127.0.0.1 \
  --port 9000 \
  -c device.getInfo \
  -o json
```

实际可用性取决于对应 concrete transport 和设备端实现是否已接入。

## 5. C++ SDK dynamic RPC

SDK 位置：

```text
runtimes/cpp-sdk
```

SDK 的 P0 策略是 dynamic RPC first。业务调用优先用 method name/id + JSON/TLV/Raw body，不强制依赖 typed generated wrappers。

### 5.1 JSON 调用

```cpp
#include "axtp_sdk/axtp_client.hpp"

int main() {
    axtp::sdk::AxtpClient client;

    auto info = client.callJson("device.getInfo", "{}");
    auto result = client.callJson("display.setBrightness", R"({"value":80})");

    (void)info;
    (void)result;
    return 0;
}
```

执行路径：

```text
AxtpClient::callJson("device.getInfo", "{}")
  -> MethodRegistry::findMethodId()
  -> RpcPayload
  -> AxtpEndpoint::sendRpcRequest()
  -> AxtpCore outbound encode
  -> ITransport::sendBytes()
  -> poll loop
  -> SDK result
```

如果注册了 local mock handler，`callRaw()` 可以不经过真实 transport；否则需要 attach transport 并进入 poll loop。

### 5.2 Raw/TLV 调用

```cpp
axtp::Bytes tlvBody = {/* encoded TLV bytes */};
auto response = client.callTlv("display.setBrightness", tlvBody);

axtp::Bytes raw = {0xca, 0xfe};
auto rawResponse = client.callRawBytes(0x90010001, raw);
```

Raw API 适合调试、vendor private method 和 legacy bridge。正式业务应优先有 registry method/schema。

### 5.3 Typed facade

当前 SDK 有手写或 generated-style facade：

```cpp
#include "axtp_sdk/axtp_device.hpp"

axtp::sdk::AxtpClient client;
axtp::sdk::AxtpDevice device(client);

auto info = device.device.getInfo();
device.display.setBrightness(80);
```

Typed API 是 dynamic/raw RPC 的便利包装，不应该绕过 MethodRegistry 和 runtime 分层。

## 6. C++ runtime 接入

推荐 runtime 结构：

```text
ITransport <-> AxtpEndpoint -> AxtpCore -> BasicBroker<>
```

### 6.1 普通应用生命周期

```cpp
#include "axtp/axtp.hpp"

int main() {
    axtp::BasicBroker<> broker;
    axtp::AxtpEndpoint endpoint(broker);

    // app owns concrete transport
    // endpoint.attachTransport(transport);
    // transport.open();

    while (true) {
        // 1. poll concrete transport if it is ManualPoll
        // 2. drain core events, broker tasks, broker results, outbound bytes
        endpoint.poll();
    }
}
```

### 6.2 分层职责

| 层 | 应该做 | 不应该做 |
|---|---|---|
| `ITransport` | 读写 bytes/message | 解析 AXTP frame、method 或旧协议 |
| `AxtpCore` | decode/encode、协议状态、CoreEvent | 持有 transport、调用业务 handler |
| `AxtpEndpoint` | 连接 core、broker、transport | 写业务逻辑 |
| `BasicBroker<>` | 注册和分发业务 handler | 回调 core、处理 socket/thread |
| SDK/CLI | 提供易用 API 和命令 | 把平台依赖下沉到 cpp-core |

### 6.3 FramedBinary inbound 路径

```text
ITransport bytes
  -> AxtpEndpoint
  -> AxtpCore::byteSink()
  -> FrameDecoder
  -> MessageReassembler
  -> PayloadDecoder
  -> CoreEvent::RpcRequest
  -> BasicBroker<> handler
  -> BrokerResult
  -> AxtpCore outbound encode
  -> ITransport::sendBytes()
```

### 6.4 WebSocketJsonRpc 路径

```text
WebSocket text message
  -> ITransport::bind sink
  -> AxtpEndpoint::onTransportBytes()
  -> AxtpCore::byteSink()
  -> JsonRpcDecoder
  -> RpcPayload
  -> CoreEvent
  -> BasicBroker<>
  -> JsonRpcEncoder
  -> UTF-8 JSON response bytes
  -> ITransport::sendBytes()
```

WebSocketJsonRpc 不走 AX Standard Frame、CRC 或 message fragmentation。

## 7. OTA / STREAM 怎么用

OTA 不应该把固件块塞进普通 RPC body。推荐流程：

```text
RPC firmware.begin
  -> 设备返回升级上下文、建议 chunkSize、可能的 stream 参数

STREAM chunks
  -> streamId:uint32
  -> seqId:uint32
  -> cursor:uint64 = byteOffset
  -> data(N)

RPC firmware.end
RPC firmware.verify
RPC firmware.apply

RPC Event firmware.updateProgress
RPC Event firmware.updateCompleted / firmware.updateFailed
```

Wire 形态：

```text
Control plane:
  PayloadType = RPC
  methodId = firmware.begin / firmware.end / firmware.verify / firmware.apply

Data plane:
  PayloadType = STREAM
  streamId = begin/open 阶段绑定的 streamId
  seqId = chunk 序号
  cursor = byteOffset
  data = 固件数据块
```

要点：

- `STREAM` Header 不写 `firmwareType`、`imageType`、`otaType`。
- 固件类型、版本、校验、大小等业务字段属于 RPC request/response schema。
- 进度和结果用 event，不靠轮询或私有 notify。

## 8. NA20 / NT10 HID media 示例

需求：NA20 搭配大屏，基于 HID 做 audio/video 传输，上位机对 NA20 和 NT10 适配新协议。

建议拆分：

| 能力 | AXTP 形态 | 传输 |
|---|---|---|
| 设备信息查询 | `device.getInfo` | RPC over `AXTP-USB-HID` |
| AP 信息查询 | `network.getApInfo` | RPC over `AXTP-USB-HID` |
| AP 设置 | `network.ap` 草案，评审后采纳 | RPC over `AXTP-USB-HID` |
| Wi-Fi 设置写入 | `network.wifi` 草案，评审后采纳 | RPC over `AXTP-USB-HID` |
| OTA | `firmware.begin/end/verify/apply` + STREAM | Standard Framed HID |
| audio/video | `stream.open` + `stream.hidMedia` profile + STREAM | Standard Framed HID |

HID audio/video 的关键点：

```text
RPC stream.open
  request: profile = media.video 或 media.audio, transportProfile = AXTP-USB-HID
  response: streamId, negotiated chunk/frame size, runtime 参数

STREAM
  streamId:uint32
  seqId:uint32
  cursor:uint64
  data(N)

RPC/Event
  stream.opened / stream.error
```

不要新增 `PayloadType=VIDEO` 或 `PayloadType=AUDIO`。视频和音频是 stream profile 和建流上下文，不是顶层 payload。

## 9. VM33 Pro 新版本协议适配

策略：老协议继续保留，新协议逐步适配。

优先筛选：

| 业务 | 建议 |
|---|---|
| 时间同步策略 | 查 `docs/protocol/system/system.time.md`，确认是否复用或补草案 |
| 篮球进球事件通知 | 新建或更新合适 domain.feature 草案，明确 event name、payload、触发条件 |
| 设备升级 | 优先复用 `firmware.ota` 和 firmware MVP 方法 |
| 设备信息查询 | 优先复用 `device.getInfo` |

VM33 迁移流程：

```text
读取旧 VM33 协议材料
  -> 分类到 domain.feature
  -> 判断复用/修改/新增 docs/protocol 草案
  -> 标记旧协议字段和待确认项
  -> 评审
  -> 只把确认过的内容采纳进 registry/domains
```

注意：

- 旧协议继续保留，先通过 adapter 或双栈策略兼容。
- 没有旧 command/status/payload 证据的映射不能写进 `registry/legacy/legacy_mapping.yaml`。
- VM33 的配置型接口不要继续堆成万能 `Config.Get/Set`，应拆到明确的 domain.feature。

## 10. UXPlay 控制方案

需求：

- 设置投屏密码。
- 控制窗口大小。
- 控制窗口显示状态。

建议先做草案，不直接写 registry：

| 能力 | 候选归属 | 评审重点 |
|---|---|---|
| 设置投屏密码 | `auth` / `signage` / `system` 需确认 | 权限、生命周期、是否可读取、错误码 |
| 控制窗口大小 | `output.layout` 或 `video.layout` | 坐标系、屏幕编号、比例、边界、持久化 |
| 控制显示状态 | `display.output` / `output.layout` | show/hide、窗口状态 event、冲突处理 |

草案模板应包含：

```text
domain boundary
target scenario
candidate capability
candidate methods
candidate events
candidate schemas
candidate errors
legacy mapping or open questions
adoption checklist
```

## 11. NearHub Launcher 与后台交互通用化

目标：把 Launcher 与后台交互逻辑从项目私有命令整理为通用协议能力。

建议步骤：

1. 读取 `docs/legacy-protocols/NearHub-Launcher设备管理命令.md` 和相关数字标牌文档。
2. 按 domain.feature 分类命令。
3. 已有能力复用当前草案或 registry，例如 device、network、firmware、signage、system。
4. 新能力写入 `docs/protocol/<domain>/<domain.feature>.md`。
5. 评审后采纳到 YAML。
6. 生成协议文档和工具 JSON。

不要把 Launcher 作为新 domain，除非协议治理确认它是独立能力域。多数情况下 Launcher 是应用/产品形态，具体能力应落到 device、system、signage、network、firmware 等 domain。

## 12. Rooms 当前策略

Rooms 暂时不改当前协议方案。

现阶段只做：

- 保留旧协议运行。
- 记录 Rooms 协议与 AXTP 的差异。
- 后续业务窗口明确后再决定是否迁移。

不要为了统一而强行改动 Rooms 当前上线协议。

## 13. 从业务需求到 PR 的完整例子

例子：新增“设置投屏密码”。

### Step 1: 建业务分支

```bash
git checkout -b business/uxplay-password
```

### Step 2: 搜索已有草案

```bash
rg -n "password|passcode|投屏|uxplay|auth|permission" docs/protocol registry docs/specs
```

### Step 3: 决定复用、修改或新增

- 如果 `auth.token` 或 `auth.permission` 已覆盖，复用或补充草案。
- 如果 `signage` 更贴近投屏场景，在 `signage` 下补草案。
- 如果 domain 边界不清楚，先在草案中标 `[REVIEW-ASK]`。

### Step 4: 写草案

路径示例：

```text
docs/protocol/auth/auth.screenCastPassword.md
```

草案中只写候选内容：

```text
candidate method: auth.setScreenCastPassword
candidate request schema: AuthSetScreenCastPasswordRequest
candidate response schema: CommonEmptyResponse
candidate errors: PERMISSION_DENIED, RPC_PARAM_INVALID, NOT_SUPPORTED
candidate event: auth.screenCastPasswordChanged
```

新 ID 写 `TBD after adoption`，不要在草案阶段随便分配正式 ID。

### Step 5: 评审

邀请：

- UXPlay/上位机负责人。
- 设备端/固件负责人。
- 测试负责人。
- 架构/协议维护者。

评审确认：

- 密码是否可读。
- 是否需要权限。
- 是否需要 event。
- 密码长度和字符集。
- 错误码。
- 是否有旧协议映射。

### Step 6: 采纳

评审通过后：

```text
Use docs/dev/skills/adopt-protocol-draft/SKILL.md
docs/specs/08-13 reverse confirmation, plus 14 when profiles/MVP change
docs/protocol/auth/auth.screenCastPassword.md formal adoption note
registry/domains/<domain>/domain.yaml
```

采纳 skill 会先确认草案没有 unresolved `[REVIEW-ASK]`、`[REVIEW-FIX]` 或 `[REVIEW-BLOCKER]`，再根据 specs 和现有 YAML 分配正式 ID、`bit_offset` 和 schema fieldId。

### Step 7: 生成

采纳完成后：

```text
Use docs/dev/skills/generate-axtp-protocol/SKILL.md
pnpm --dir generators generate
pnpm --dir generators validate:protocol
```

### Step 8: 验证和 PR

```bash
pnpm --dir generators build
pnpm --dir generators test
pnpm --dir generators validate:sources
pnpm --dir generators validate:protocol
git diff --check
```

PR 描述要说明：

- 新增哪个 domain.feature。
- 新增哪些 method/event/schema/error/capability。
- 哪些是 generated 产物。
- 哪些旧协议映射已确认，哪些仍是 open question。

## 14. 修改时的安全规则

### 14.1 不要手写 generated

如果你想改：

```text
docs/generated/protocol.md
```

正确做法是回到：

```text
docs/protocol/**
docs/specs/**
registry/**/*.yaml
registry/domains/**/*.yaml
generators/src/**
```

然后重新生成。

### 14.2 不要把业务塞进 Header

错误方向：

```text
PayloadType = VIDEO
PayloadType = OTA
Header.field = firmwareType
Header.field = windowMode
```

正确方向：

```text
PayloadType = RPC
methodId = video.xxx / firmware.xxx / output.xxx

PayloadType = STREAM
streamId = RPC 建流返回的 streamId
```

### 14.3 不要让旧协议污染 core

Legacy adapter 可以在 core 外把旧协议转换成 AXTP：

```text
Legacy Protocol
  -> Legacy Adapter
  -> AXTP RPC / Event / STREAM
  -> AXTP Core / Business
```

但不要在 `AxtpCore` 里写 AXDP、VM33、Rooms、Launcher 的私有分支。

### 14.4 不要跳过评审直接写 registry

新业务先草案，后采纳。只有核心常量、已确认 MVP/Core 事实、公共 schema 或明确迁移映射才直接进入对应 registry 文件。

## 15. 提交前检查清单

文档-only：

```bash
pnpm --dir generators build
pnpm --dir generators test
pnpm --dir generators validate:sources
pnpm --dir generators validate:protocol
git diff --check
```

协议事实变更：

```bash
pnpm --dir generators build
pnpm --dir generators test
pnpm --dir generators validate:sources
pnpm --dir generators generate
pnpm --dir generators validate:protocol
git diff --check
```

C++ 变更：

```bash
scripts/check-format-cpp.sh
cmake -S runtimes/cpp-core -B build/cpp-core
cmake --build build/cpp-core
ctest --test-dir build/cpp-core --output-on-failure
```

按实际改动范围补充 SDK、axtpctl 或 transport 测试。
