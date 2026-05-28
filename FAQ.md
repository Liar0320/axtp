# AXTP 协议设计 FAQ

---

## Q1：Compact 传输场景下，L2 Header 是否也可以用 Compact 版本？

**结论：AXTP v1 不再定义 Compact L2 Header。**

L2 Payload Header 在 Standard / Compact Frame 下保持统一：

| Payload | v1 L2 Header | 状态 |
| --- | --- | --- |
| CONTROL | 5B 固定头（opcode + controlId + statusCode） | 固定 |
| RPC Binary | 11B 固定头，无 sid | 固定 |
| STREAM | 16B 固定头 | 固定 |

Frame Profile 由 Transport Profile 固定选择，不在 CONTROL OPEN/ACCEPT 中协商 `headerProfile`。v1 不支持 8B Stream Header，也不支持 Standard/Compact L2 混搭。

---

## Q2：JSON 模式为什么每帧都要带 sid，Binary 模式不需要？

这是两种模式的根本差异，不是设计冗余。

**Binary/Framed 模式**：有 CONTROL 层。OPEN/ACCEPT 建立 session，session 状态由 Frame 层维护，sid 是 CONTROL 层的概念，不需要出现在每个 RPC Payload 里。

**JSON/Unframed 模式**：没有 CONTROL 层。WebSocket Text 连接建立后直接进 FRAMING_READY，没有任何 Frame 层的 session 管理机制。这时 sid 承担两个职责：

- **网关路由**：一条 WebSocket 连接可能承载多个逻辑 session（如网关代理多台设备），sid 是区分路由目标的唯一手段
- **断线恢复**：重连时客户端在 Identify 的 `resumeSid` 字段携带旧 sid，服务端恢复 session 状态

规范里说的"TextCodec 边界消费，不透传给业务逻辑"是指 sid 在 codec 层处理完就不往上传，业务层不感知它——但它必须在每帧存在，因为 codec 层需要它做路由判断。

> **一句话**：JSON 模式的 sid = Binary 模式的 CONTROL session，两者解决同一个问题，只是层次不同。

---

## Q3：前期是否可以不实现 CONTROL，后期再补？

**可以，但要分传输路径区别对待。**

| 传输路径 | CONTROL 是否可跳过 | 说明 |
| --- | --- | --- |
| WebSocket Text / JSON | 完全可以跳过 | 规范明确定义为 Debug/Legacy Adapter 路径，WebSocket 升级后直接进 FRAMING_READY |
| WebSocket Binary / TCP / HID / BLE（Framed） | 不能完全跳过，但可以最小化 | 状态机要求 LINK_CONNECTED → FRAMING_READY 必须经过 CONTROL OPEN/ACCEPT |

**分阶段策略：**

| 阶段 | 实现内容 |
| --- | --- |
| Phase 0（当前） | 只实现 WebSocket JSON，完全不碰 CONTROL |
| Phase 1（Framed 接入） | MVP CONTROL 子集：`OPEN / ACCEPT / HEARTBEAT / HEARTBEAT_ACK / ACK / NACK / CLOSE / CLOSE_ACK`（8 个 opcode） |
| Phase 2（恢复能力） | 补 `RESUME / RESUME_ACK / SESSION_RESET` |
| Phase 3（流控） | 补 `WINDOW_UPDATE / PING / PONG / GOAWAY` |

Phase 1 的 OPEN/ACCEPT TLV body 可以先只实现必填字段（`protocolVersion`、`maxFrameSize`、`mtu`、`supportedPayloadTypes`、`supportedRpcEncodings`），其余运行参数用默认值。Frame Profile 由 Transport Profile 固定选择。

---

## Q4：Server 先发 Hello vs Client 先发 Hello，哪种更合适？

**结论：保持 Server→Client Hello（当前规范），这是正确的设计。**

### 两种方式对比

| | Server 先发 Hello（当前规范） | Client 先发 Hello（部分老设备） |
| --- | --- | --- |
| 认证参数 | Server 在 Hello 里携带 challenge，Client 按需响应 | Client 发 Hello 时不知道 Server 需要什么认证 |
| 版本协商 | Client 收到 Hello 后可做版本兼容判断再决定是否继续 | Client 需要预先知道 Server 版本 |
| 实现复杂度 | Server 主动推送，逻辑清晰 | 需要额外的 challenge 交换步骤 |
| 行业惯例 | OBS-WebSocket、多数 WebSocket 协议 | 少数老协议 |

### 兼容老设备的策略

老设备已实现 Client→Server Hello，这是兼容性问题，不是设计问题。

#### 方案一：URL 路径分路（推荐）

用不同的 WebSocket 路径区分协议版本，完全消除竞争条件：

```
ws://device/axtp    → 新协议（Server 先发 Hello）
ws://device/legacy  → 老协议（Client 先发 Hello，Server 回 HelloAck）
```

老设备连 `/legacy`，新客户端连 `/axtp`，两条路径互不干扰，不需要任何检测逻辑。

#### 方案二：首包检测（URL 不可分路时的备选）

当老设备 URL 硬编码无法修改时，Server 改为等待首包再决定路径：

```
连接建立
    │
    ├─ 等待首包（超时 3s）
    │
    ├─ 收到 Identify (op=2)  → 新协议路径，Server 再发 Hello，继续正常流程
    │
    ├─ 收到 Client Hello     → 老协议路径，Server 回 HelloAck，继续老协议流程
    │
    └─ 超时无包              → 关闭连接
```

> **为什么不用定时器检测？**
>
> 新 Server 连接后立即发 Hello，老 Client 连接后也立即发 Hello，双方同时发出后各自等待对方响应（Server 等 Identify，老 Client 等 HelloAck），形成死锁。老 Client 收到意外的 Server Hello 后行为不确定，可能卡住。定时器无法解决这个根本冲突，首包检测才能避免双方同时发包的竞争。

---

## Q5：四种传输方案的实现优先级

### 方案特征

| 方案 | 传输 | Frame | Payload | CONTROL | 复杂度 |
| --- | --- | --- | --- | --- | --- |
| WebSocket + JSON | WebSocket Text | Unframed | JSON | 不需要 | ★☆☆☆ |
| TCP + Framed + JSON | Raw TCP | Standard | JSON | 需要（Standard） | ★★☆☆ |
| HID + Framed + JSON | USB HID | Standard（可降级 Compact） | JSON | 需要（Standard/Compact） | ★★★☆ |
| BLE + Compact + Binary | BLE GATT | Compact | Binary | 需要（Compact） | ★★★★ |

### 优先级安排

**P0：WebSocket + JSON**

- 零 CONTROL 依赖，直接复用已有设备实现
- Web 管理控制台、调试工具、浏览器客户端全覆盖
- 验证 RPC 语义（Hello/Identify/Request/Response/Event）的最快路径

**P1：TCP + Framed + Standard Profile + JSON**

- Standard Profile，CONTROL 最小子集（OPEN/ACCEPT/HEARTBEAT/CLOSE）
- ackMode=NONE，TCP 保可靠性
- 跑通 Framed 完整状态机，为 HID/BLE 打基础

**P2：HID + Framed + Compact Profile + JSON**

AXTP-HID-64 固定使用 Compact Frame。若设备需要 HID High Speed + Standard Frame，应定义独立 Transport Profile，不在同一 session 中通过 OPEN/ACCEPT 切换：

```
AXTP-HID-64     -> COMPACT_FRAME
AXTP-HID-HS     -> STANDARD_FRAME（独立 profile，可选）
```

Client 在发 OPEN 前查 HID descriptor 拿到实际 report size，填入 `maxFrameSize`。P2 实现 Compact Frame 编解码，P3 的 BLE 直接复用。

**P3：BLE + Compact + Binary**

- 复用 P2 的 Compact Profile 编解码
- 增加 Binary RPC（TLV 编解码，无 sid）
- BLE MTU 约束（通常 20–244B），分片逻辑需充分测试

### 增量路径

```
P0 WebSocket JSON
    └─ 验证 RPC 语义
P1 TCP Framed Standard
    └─ 跑通 CONTROL 状态机
P2 HID Framed Standard + Compact 降级
    └─ 实现 Compact Profile 编解码
P3 BLE Compact Binary
    └─ 实现 Binary RPC，复用 Compact Profile
```

每一步都在前一步基础上增量，不需要推倒重来。

---

## Q6：OTA 校验字段用 MD5 还是 SHA256？协议如何处理多种算法？

MD5 是哈希算法的一种。哈希算法是一类函数的统称，输入任意长度数据，输出固定长度摘要。MD5、SHA1、SHA256、CRC32 都属于这一类，区别在于安全强度和碰撞概率：

| 算法 | 输出长度 | 碰撞风险 | 说明 |
| --- | --- | --- | --- |
| CRC32 | 32 bit（4B） | 非密码学，易碰撞 | 只防传输损坏，不防篡改 |
| MD5 | 128 bit（16B） | 已知可构造碰撞 | 功能上可用于完整性校验，安全性弱 |
| SHA256 | 256 bit（32B） | 目前无已知碰撞 | 推荐用于安全敏感场景 |

**当前决策：MVP 阶段沿用 MD5，协议字段设计为算法无关。**

规范使用通用字段 `verifyType`（算法名）+ `verifyValue`（校验值 hex 字符串），而不是绑定到具体算法的字段名（如 `imageSha256`）。这样 MD5、CRC32、SHA256 都能用同一套字段表达，不需要改协议。

**多算法协商流程：**

1. v1 Core 可先由 `firmware.begin` 合同固定支持 `md5`；v2/P1 设备可在 `capability.getAll` 或固件能力查询中声明 `firmware.supportedVerifyTypes`，例如 `["md5","crc32","sha256"]`
2. 客户端在 `firmware.begin` 时选择设备支持的一种，填入 `verifyType` 和对应的 `verifyValue`
3. 设备在 `firmware.verify` 时按 `verifyType` 执行对应算法校验

MVP 阶段设备只需声明支持 `md5`，后续升级到 SHA256 只需在 capability 中新增，客户端和协议字段不需要改动。

---

## Q7：PING/PONG 和 HEARTBEAT 有什么区别？

两者都是 CONTROL 层的保活机制，但目的不同：

| | HEARTBEAT / HEARTBEAT_ACK | PING / PONG |
| --- | --- | --- |
| 目的 | 保活：证明连接还在，对端还活着 | 测量：量化链路延迟（RTT） |
| 触发方式 | 周期性发送，间隔由 OPEN 协商 | 按需发送，不要求周期性 |
| body | 可选，可携带 timestamp | 可选，携带 timestamp 或 nonce |
| 响应要求 | 对端必须回 HEARTBEAT_ACK | 对端必须回 PONG，原样返回 nonce |
| 超时处理 | 连续 3 次无响应 → 断开连接 | 超时 → 记录丢包，不强制断开 |
| MVP 要求 | 必须实现 | P1，可延后 |

HEARTBEAT 是连接保活的基础机制，所有 Framed 连接都需要。BLE 场景尤其重要，因为 BLE 连接可能在没有数据传输时被系统静默断开。PING/PONG 用于需要精确 RTT 数据的场景，比如自适应 OTA chunk size（根据链路延迟动态调整）、网关质量监控、诊断工具。

MVP 阶段只实现 HEARTBEAT/HEARTBEAT_ACK 即可，PING/PONG 在 P1 阶段补充。

---

## Q8：新增一项业务，具体如何操作文档库？

以新增"音量控制"业务（`audio.setVolume`）为例，完整操作步骤：

### 第一步：确认 Protocol Definition 元规范

查 `standard/docs/03-registry/08-AXTP-Protocol-Definition-Mapping-Spec.md` 到 `13-AXTP-Profiles-Registry-Spec.md`，确认 request、event、error、type、profile 的字段模型和约束。

具体业务内容不再手写进 08-13 文档；这些文档只定义规则。

### 第二步：在 `protocol/axtp.protocol.yaml` 中分配 request

```yaml
- name: audio.setVolume
  methodId: 0x0801
  domain: audio
  since: 1.0.0
  status: draft
  request:
    type: AudioSetVolumeRequest
  response:
    type: AudioSetVolumeResponse
  errors:
    - RPC_PARAM_INVALID
  events:
    - audio.volumeChanged
```

### 第三步：在 `protocol/axtp.protocol.yaml` 中声明 event（如有）

```yaml
- name: audio.volumeChanged
  eventId: 0x8801
  domain: audio
  since: 1.0.0
  status: draft
  payload:
    type: AudioVolumeChangedEvent
```

### 第四步：在 `types:` 中定义 TLV/JSON Schema

在 `protocol/axtp.protocol.yaml` 的 `types:` 中定义 `AudioSetVolumeRequest`、`AudioSetVolumeResponse` 和 `AudioVolumeChangedEvent` 的字段编号、类型、必填性和范围。

### 第五步：声明 Capability 与 Profile 影响（如需）

v1 Core 客户端先通过 `capability.supportedMethods` 判断 `audio.setVolume` 是否可调用；完整 Capability Model 属于 v2/P1。若该业务进入某个 profile，在 `profiles:` 的 `requiredRequests` / `requiredEvents` 中追加。

### 第六步：声明 error（如需新错误码）

如果现有错误码不够用，在 `protocol/axtp.protocol.yaml` 的 `errors:` 中新增，并遵守 `11-AXTP-Errors-Registry-Spec.md` 的分段和稳定性规则。

### 第七步：重新生成发布产物

运行 Protocol Compiler，重新生成 `generated/protocol.md`、schema、SDK enum、bitmap 和 conformance tests。

核心原则：

- `protocol/axtp.protocol.yaml` 是机器事实源，所有 ID 必须先在这里注册，再在代码中使用
- 不得在代码或文档中私自使用未注册的 methodId/eventId
- `status: draft` → 实现稳定后改为 `stable`，`stable` 后不得改变语义
- 新增 request/event/error/profile 不需要升级 Protocol Version，只升级 Registry Version

---

## Q9：Registry 写好之后，如何生成代码并集成到项目中？

文档库里已经有一个可运行的 Generator（`standard/generator/`），整个流程分三步。

### 第一步：更新 YAML Registry

按 Q8 的步骤，在 `standard/registry/` 下对应的 YAML 文件中新增条目。例如新增 `audio.setVolume`，就在 `method_registry.yaml` 里追加一条，在 `event_registry.yaml` 里追加 `audio.volumeChanged`，在 `capability_registry.yaml` 里追加 `audio.volume`。

### 第二步：运行 Generator

```bash
cd standard/generator
pnpm build          # 编译 TypeScript
pnpm validate       # 校验 registry 合法性（ID 不重复、范围正确、引用存在）
pnpm generate       # 生成产物到 standard/out/generated/
```

Generator 会输出：

| 产物 | 路径 | 用途 |
| --- | --- | --- |
| C++ 枚举/常量 | `out/generated/cpp/` | 直接 `#include` 到 C++ 项目 |
| Markdown 注册表文档 | `out/generated/docs/` | 替换 `docs/03-registry/` 中的人工维护表格 |
| JSON 机器可读注册表 | `out/generated/json/` | 供其他工具链消费 |
| 测试向量 | `out/generated/test_vectors/` | 编解码单元测试的输入数据 |

### 第三步：集成到 C++ 项目

生成的头文件（如 `axtp_method_ids.h`、`axtp_event_ids.h`、`axtp_error_codes.h`）直接放入 C++ Demo 或 SDK 的 `generated/` 目录，在 `CMakeLists.txt` 中加入 include 路径即可。业务代码通过枚举常量引用 ID，不硬编码数字：

```cpp
#include "generated/axtp_method_ids.h"

// 正确
auto methodId = axtp::MethodId::display_setBrightness;

// 错误 — 不得硬编码
uint16_t methodId = 0x0502;
```

每次 Registry 更新后重新运行 `pnpm generate`，生成文件随 Registry 版本一起提交到 git，保持代码和文档同步。

---

## Q10：能否把"新增业务逻辑"做成一个 Claude Skill，让 Claude 自动引导完成？

可以，而且这是推荐的工作方式。以下是一个可以直接放入 `.claude/skills/` 的 Skill 定义，保存后在对话中说"我需要增加一个调整音量的业务逻辑"，Claude 就会按步骤引导你完成。

**Skill 文件：`.claude/skills/axtp-add-domain.md`**

````markdown
# axtp-add-domain

新增 AXTP 业务逻辑的引导流程。用户描述业务需求后，逐步确认所有协议要素，
最终生成 YAML Registry 条目和文档更新。

## 触发条件

用户说"我需要增加 X 业务"、"新增 Y 功能"、"添加 Z 控制"等。

## 引导步骤

按顺序逐项与用户确认，每步等待用户回答后再进行下一步：

1. **业务描述**：用一句话描述这个业务做什么，谁调用，谁响应
2. **Domain 归属**：对照 `08-Registry总则 §9` 确认属于哪个 domain（device/display/audio/firmware/...）
3. **Method 名称**：按 `domain.verbObject` 格式命名，如 `audio.setVolume`
4. **请求参数**：列出所有入参字段名、类型、是否必填
5. **响应结果**：列出所有返回字段名、类型
6. **触发事件**：是否有异步事件上报？如有，命名为 `domain.objectChanged`
7. **错误码**：可能返回哪些错误（从 ErrorCode Registry 选，或新增）
8. **Capability**：设备能力名称；v1 Core 通过 `capability.supportedMethods` 做轻量 method bitmap 发现，完整 Capability Model 属于 v2/P1
9. **MVP 范围**：是否进入 MVP（影响 Generator 是否立即生成代码）
10. **老协议映射**：是否有对应的旧 CmdValue 需要映射

确认完成后，生成：
- `protocol/axtp.protocol.yaml` 新增 request/type/event/error/profile 条目
- `generated/protocol.md` 重新生成
- schema / SDK enum / bitmap / conformance 产物重新生成
````

把这个文件放到 `.claude/skills/axtp-add-domain.md` 后，在任何对话中说"我需要增加一个调整音量的业务逻辑"，Claude 就会加载这个 Skill，逐步引导你确认所有协议要素，最后直接输出可以提交的 YAML 条目。

不需要每次都记住 Q8 的七个步骤，也不会漏掉 Capability 或 ErrorCode 这类容易忘记的环节。



2.1 协议嗅探与老协议分流 (关于 14-老协议适配与迁移规范)

现状： 文档 14 中提出了在 L1 Frame 之前或内部做 Adapter 的思路。

盲区： 当现有的 App（比如旧版手机 App）通过 BLE 连上已经升级为 AXTP 的新固件时，设备端底层缓冲区的第一个字节进来，设备怎么瞬间判断这是“老协议”还是“新 AXTP 协议”？

PM 建议： 必须在 C++ Demo (文档 21) 中明确“协议嗅探（Protocol Sniffing）”的策略。例如：判断 Header 的前两个字节是否为 AXTP 的 Magic Number (0x41 0x58)。如果是，走 AXTP Parser；如果不是，无条件抛给 Legacy Adapter 解析。（建议在文档 14 或 21 中增加这一句极其明确的“判定伪代码”）

2.2 StreamId 的生命周期闭环 (关于 04-Stream规范)

现状： RPC firmware.begin 协商出 streamId 并开启流。

盲区： 如果流传输中途，App 崩溃了，或者用户强制退出了，设备端的 streamId (及其绑定的内存/Flash句柄) 怎么回收？

PM 建议： 在文档 04 或 05 中明确：

任何 streamId 都必须具备超时机制（Timeout）。如果在 fragmentTimeoutMs 内没有收到该 streamId 的包，设备应主动丢弃流上下文。

如果底层链路（CONTROL CLOSE 或 TCP 断开）触发，应自动销毁该 Session 下所有的 streamId 资源，防止内存泄漏。

2.3 事件订阅的 MVP 裁剪 (关于 10-EventId注册表)

现状： 规范中提到了通过 IDENTIFY / REIDENTIFY 进行 eventSubscriptions 细粒度订阅。

盲区： 对于 MVP 阶段的嵌入式设备来说，维护一个动态的“事件订阅过滤白名单”可能会增加不必要的状态机复杂度。

PM 建议： 强烈建议在 MVP 阶段（特别是在 C++ Demo 中），采取“全量广播（傻瓜模式）”。只要 App 连接成功 (Identified)，设备产生的如 statusChanged 等核心事件就无条件 push。细粒度的按需订阅放到 v2.0 (P1) 再去实现。

2.4 TLV Schema 的平滑退化 (关于 06-TLV-Schema编码规范)

现状： 支持 uint、bool、enum、string、bytes 等基础类型，暂缓 object 嵌套。

审查： 这个裁剪极其精准！对于当前业务，绝大多数结构都是扁平的（Flat）。

PM 建议： 遇到极其复杂的老协议深层嵌套 JSON 怎么办？直接利用 bodyEncoding = RAW_BYTES，把老协议的 JSON/私有二进制当作一个透明的 bytes 塞进 TLV 的某个字段里透传。这样既不用升级 TLV 解析器，又能兼容老业务。


1. 为什么是accept之后，server直接发hello
   1. 这个是传输必带的
2. 为什么是capability要单独设置方法来获取，而不是直接在hello中使用
   1. 为了保持设备的安全性
3. 如果是agent/cloud server这样的对接方式，实际上agent才是server逻辑，因为是被控制端，而cloud仅负责连接属性，这种要怎么处理？
   1. 架构设计上区分了逻辑c和s，物理c和s的差异
   

todo：
1. 保留 capability 命名空间；
首版不实现 capability.getAll；
首版只实现 capability.supportedMethods；
method/event 继续由 registry 管理；
method bitmap 作为首版唯一强制能力发现机制；
完整 capability 作为未来增强层。




1. 要实现的几个端的场景（精简00号文档，并将落地方案补充到文档中）
   1. nearsync-设备，hid方案，frameheader + json
   2. nearsync-cloud，websocket方案，unframed rpcjson
   3. uxplay的受控端--作为试点
   4. na20的audio-video上传，通过hid，走stream流，需要设计完整的协议流程

2. 取消stream payload下的8B长度头类型
3. 很重要，但是后面的协议文档没有关注的点：0x20-0x5F	当前 schema 私有字段
4. generator中，生成registry的标准仿佛不是按照文档08-13来的，需要确认；理论上应该是参照08-13的文档标准内容，去检验registry的内容
5. generator生成器生成的东西里面，需要有整个协议设计的一些overview在前面介绍，然后是各种domain下的method/event/errorcode的这些东西，但是现在好像是没有overview写着的，参考obs-websocket
6. 关于逻辑和物理server得定义：OPEN 由 Physical Client 发起，用于打开底层 AXTP 逻辑通道。
Hello 由 Logical Server 发起，用于打开 RPC 业务会话。
