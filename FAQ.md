# AXTP 协议设计 FAQ

---
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

v1 Core 客户端先通过 `capability.supportedMethods` 判断 `audio.setVolume` 是否可调用；完整 Capability Model 属于 v2/P1。若该业务进入某个 profile，在 `profiles:` 的 `requiredMethods` / `requiredEvents` 中追加。

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

## Q9：Protocol Definition 写好之后，如何生成代码并集成到项目中？

文档库里已经有一个可运行的 Generator（`standard/generator/`），整个流程分三步。

### 第一步：更新 Protocol Definition

按 Q8 的步骤，在 `protocol/axtp.protocol.yaml` 中新增 `methods:`、`events:`、`types:`、`errors:` 或 `profiles:` 条目。例如新增 `audio.setVolume`，就在 `methods:` 中追加 method，在 `events:` 中追加 `audio.volumeChanged`，并在 `types:` 中声明请求、响应和事件 payload。

### 第二步：运行 Generator

```bash
cd standard/generator
pnpm build          # 编译 TypeScript
pnpm validate       # 校验 Protocol Definition 合法性（ID 不重复、范围正确、引用存在）
pnpm generate       # 生成 protocol.md、schema、SDK enum、bitmap 和 conformance 产物
```

Generator 会输出：

| 产物 | 路径 | 用途 |
| --- | --- | --- |
| 协议发布文档 | `generated/protocol.md` | 面向实现者的完整协议文档 |
| Schema | `generated/schema/` | JSON Schema / TLV schema 描述 |
| C++ 枚举/常量 | `generated/cpp/` | 直接 `#include` 到 C++ 项目 |
| TypeScript 类型/枚举 | `generated/ts/` | Web / Node 工具链消费 |
| Method bitmap | `generated/bitmap/` | `capability.supportedMethods` 布局 |
| Conformance | `generated/conformance/` | 编解码与引用完整性测试 |

### 第三步：集成到 C++ 项目

生成的头文件（如 `axtp_method_ids.h`、`axtp_event_ids.h`、`axtp_error_codes.h`）直接放入 C++ Demo 或 SDK 的 `generated/` 目录，在 `CMakeLists.txt` 中加入 include 路径即可。业务代码通过枚举常量引用 ID，不硬编码数字：

```cpp
#include "generated/axtp_method_ids.h"

// 正确
auto methodId = axtp::MethodId::display_setBrightness;

// 错误 — 不得硬编码
uint16_t methodId = 0x0502;
```

每次 `protocol/axtp.protocol.yaml` 更新后重新运行 `pnpm generate`，生成文件随 Registry Version 一起提交到 git，保持代码和文档同步。

---

## Q10：能否把"新增业务逻辑"做成一个 Claude Skill，让 Claude 自动引导完成？

可以，而且这是推荐的工作方式。以下是一个可以直接放入 `.claude/skills/` 的 Skill 定义，保存后在对话中说"我需要增加一个调整音量的业务逻辑"，Claude 就会按步骤引导你完成。

**Skill 文件：`.claude/skills/axtp-add-domain.md`**

````markdown
# axtp-add-domain

新增 AXTP 业务逻辑的引导流程。用户描述业务需求后，逐步确认所有协议要素，
最终生成 Protocol Definition 条目和生成产物更新。

## 触发条件

用户说"我需要增加 X 业务"、"新增 Y 功能"、"添加 Z 控制"等。

## 引导步骤

按顺序逐项与用户确认，每步等待用户回答后再进行下一步：

1. **业务描述**：用一句话描述这个业务做什么，谁调用，谁响应
2. **Domain 归属**：对照 `09-AXTP-Methods-Registry-Spec.md` 的命名规则和 `protocol/axtp.protocol.yaml` 中已有 domain，确认属于哪个 domain（device/display/audio/firmware/...）
3. **Method 名称**：按 `domain.verbObject` 格式命名，如 `audio.setVolume`
4. **请求参数**：列出所有入参字段名、类型、是否必填
5. **响应结果**：列出所有返回字段名、类型
6. **触发事件**：是否有异步事件上报？如有，命名为 `domain.objectChanged`
7. **错误码**：可能返回哪些错误（从 `errors:` 选，或按 `11-AXTP-Errors-Registry-Spec.md` 新增）
8. **Capability**：设备能力名称；v1 Core 通过 `capability.supportedMethods` 做轻量 method bitmap 发现，完整 Capability Model 属于 v2/P1
9. **MVP 范围**：是否进入 MVP（影响 Generator 是否立即生成代码）
10. **老协议映射**：是否有对应的旧 CmdValue 需要映射

确认完成后，生成：
- `protocol/axtp.protocol.yaml` 新增 method/type/event/error/profile 条目
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
