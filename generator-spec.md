是的，现在你看到的问题本质上是：

registry 和 schema 目录下的文件，目前更像是“人工整理后的实现产物”，而不是由 08-13 标准文档强约束生成出来的规范产物。

这在早期探索阶段可以接受，但如果要进入工程落地，必须反过来：
08-13 文档不能只描述 registry/schema，而应该定义 registry/schema 的生成规则、校验规则和发布流程。

⸻

1. 当前问题在哪里

现在的状态大概是：

08-13 标准文档
    ↓ 人工理解 / Codex 手写
registry/*.yaml / *.json
schema/*.json
    ↓ 再被 SDK / Demo / 文档引用

这个流程的问题是：

标准文档和 registry 可能不一致
registry 和 schema 可能不一致
schema 和 SDK enum 可能不一致
methodId 和 methodName 可能不一致
eventId 和事件结构可能不一致
错误码、bodyEncoding、TLV fieldId 可能被重复定义

之前资料里其实已经明确提过一个方向：MethodId 注册表不应该只靠人工维护，而应该用 YAML/JSON 作为唯一数据源，再生成 Markdown、SDK 枚举和测试用例，这样才能避免 methodId、方法名、参数表长期不一致。 ￼

所以你现在的感觉是对的：
如果 registry/schema 是“手写实现”，那 08-13 文档就没有真正控制实现。

⸻

2. 正确关系应该反过来

推荐把系统改成这个方向：

08-13 标准文档
    ↓ 定义规则、字段、ID 分段、约束、生成流程
registry/*.yaml
    ↓ 作为唯一机器可读数据源 SSOT
schema/*.json
    ↓ 由 registry 自动生成或由 registry 引用并校验
generated/
    ├── markdown docs
    ├── C/C++ enum
    ├── TypeScript enum
    ├── JSON-RPC method map
    ├── BinaryRPC method map
    ├── bitmap table
    ├── validator
    └── conformance tests

也就是说：

08-13 文档控制“规则”；registry 控制“数据”；schema 控制“结构”；generated 控制“实现产物”。

不要让 08-13 直接当机器数据源，因为 Markdown 不适合做主数据源。
更好的方式是：

Markdown 标准文档 = 人读规范
YAML/JSON registry = 机器可读规范源
Generator = 从 registry 生成所有实现产物

⸻

3. 08-13 每份文档应该控制什么

我建议重新定义 08-13 的职责。

08《JSON-RPC / Binary-RPC Demo 说明书》

它不应该直接写死所有方法细节，而应该规定：

JSON-RPC methodName 如何映射到 Binary methodId
requestId 如何映射
params/result 如何映射到 TLV/CBOR/FIXED_STRUCT
错误如何映射到 statusCode/errorCode

因为 BinaryRPC 里 methodId/eventId 已经明确由 Method Registry / Event Registry 管理，RPC Binary Header 又包含 rpcOp、requestId、methodOrEventId、statusCode、bodyEncoding 等字段，所以 08 应该负责“映射规则”，而不是手写业务表。 ￼

⸻

09《MethodId 注册表》

它应该控制：

methodId 分段规则
methodName 命名规范
methodId 唯一性
domain 命名
bodyEncoding 选择
paramsSchema 引用规则
resultSchema 引用规则
supportedMethods bitmap 生成规则

但真正的 method 数据应该放在：

registry/methods/*.yaml

例如：

id: 0x0101
name: device.getInfo
domain: device
since: 1.0.0
status: stable
transport:
  json: true
  binary: true
bodyEncoding:
  binary: TLV
paramsSchema: schema/device/getInfo.params.schema.json
resultSchema: schema/device/getInfo.result.schema.json
errors:
  - 0x0401
  - 0x0501

然后生成：

docs/09-MethodId注册表.md
generated/cpp/axtp_method_id.h
generated/ts/method-id.ts
generated/bitmap/method_bitmap.bin

这和之前提到的“用 YAML/JSON 作为唯一数据源，再自动生成 Markdown、SDK 枚举、参数校验和测试用例”的方向一致。 ￼

⸻

10《EventType 事件注册表》

它应该控制：

eventId 分段规则
eventName 命名规范
事件 payload schema
事件是否可订阅
事件是否可靠投递
事件是否进入 bitmap

机器源：

registry/events/*.yaml

生成：

docs/10-EventType事件注册表.md
generated/cpp/axtp_event_id.h
generated/ts/event-id.ts
schema/events/*.json

⸻

11《ErrorCode 注册表》

它应该控制：

errorCode 分段
通用错误码
transport error
parse error
session error
rpc error
stream error
business error
错误码稳定性规则

之前资料里已经出现了 statusCode/errorCode 的分段思路，例如 Success、Transport Error、Parse Error、Invalid Parameter、Device Busy、Resource Not Found、Session Error、Stream Error、Internal Error 等范围。 ￼
这部分应该从文档表格升级成：

registry/errors.yaml

再生成：

docs/11-ErrorCode注册表.md
generated/cpp/axtp_error_code.h
generated/ts/error-code.ts

⸻

12《Capability 注册表》

你前面已经决定 v1 不实现完整 capability，只保留：

capability.supportedMethods

那 12 就不应该继续手写复杂能力树，而应该明确：

v1 不要求完整 Capability Model
v1 只要求 Method Bitmap
capability.supportedMethods 从 Method Registry 自动生成
完整 capability schema 保留到 v2

也就是说，v1 的 capability 目录不应该是手写能力模型，而应该是从 method registry 派生出来：

registry/methods/*.yaml
    ↓
generated/capability/supported_methods.bitmap
    ↓
capability.supportedMethods 返回

⸻

13《MVP 最小实现注册表》

13 最适合做“实现 Profile 清单”。

它应该定义：

AXTP-MVP-Core 必须实现哪些 methodId
AXTP-MVP-HID 必须实现哪些 methodId
AXTP-MVP-BLE 必须实现哪些 methodId
AXTP-MVP-WS 必须实现哪些 methodId
哪些 event 必须实现
哪些 errorCode 必须实现
哪些 schema 必须存在
哪些 conformance test 必须通过

机器源可以是：

profile: AXTP-MVP-HID
requires:
  methods:
    - capability.supportedMethods
    - session.hello
    - device.getInfo
  events:
    - device.statusChanged
  errors:
    - SUCCESS
    - INVALID_PARAMS
    - METHOD_NOT_FOUND
  transports:
    - HID
  frameProfile:
    - COMPACT_FRAME

然后生成：

docs/13-MVP最小实现注册表.md
generated/conformance/mvp_hid_tests.json

⸻

4. 推荐目录结构

建议改成这种结构：

spec/
  08-json-binary-rpc-mapping.md
  09-method-registry-rules.md
  10-event-registry-rules.md
  11-error-code-registry-rules.md
  12-capability-registry-rules.md
  13-mvp-profile-registry-rules.md
registry/
  methods/
    capability.yaml
    session.yaml
    device.yaml
    display.yaml
    stream.yaml
  events/
    device.yaml
    stream.yaml
  errors.yaml
  body-encodings.yaml
  payload-types.yaml
  profiles/
    mvp-core.yaml
    mvp-hid.yaml
    mvp-ble.yaml
    mvp-ws.yaml
schema/
  methods/
    device.getInfo.params.schema.json
    device.getInfo.result.schema.json
  events/
    device.statusChanged.schema.json
  common/
    error.schema.json
    tlv.schema.json
tools/
  axtp-gen/
    validate_registry.py
    generate_docs.py
    generate_cpp.py
    generate_ts.py
    generate_bitmap.py
    generate_tests.py
generated/
  docs/
  cpp/
  ts/
  bitmap/
  tests/

核心原则：

registry/ 是唯一数据源
schema/ 是结构约束
spec/ 是规则说明
generated/ 不能手写

⸻

5. 需要新增一个 Generator 文档

你现在缺的其实不是 08-13 本身，而是一个新的文档：

14《AXTP Generator v1 实现规范》

或者如果你已有 20 Generator 文档，就应该把它提前成为强约束。

它需要规定：

输入是什么
输出是什么
校验规则是什么
ID 冲突怎么处理
schema 缺失怎么处理
bitmap 怎么生成
Markdown 怎么生成
C/C++ enum 怎么生成
TypeScript enum 怎么生成
测试用例怎么生成
CI 如何检查

建议生成器流程：

1. load registry/*.yaml
2. validate id uniqueness
3. validate name uniqueness
4. validate id range by domain
5. validate schema refs exist
6. validate bodyEncoding legal
7. validate errors exist in error registry
8. generate method table
9. generate event table
10. generate error table
11. generate supportedMethods bitmap
12. generate SDK enums
13. generate conformance tests

⸻

6. 最重要的治理规则

建议你直接把这几条写进 08-13 总则：

1. registry/ 下的 YAML/JSON 文件是 AXTP 业务注册表的唯一机器可读数据源。
2. docs/08-13 中的表格不得作为实现源手写维护，必须由 registry/ 自动生成或与 registry/ 校验一致。
3. schema/ 下的 JSON Schema 必须由 registry 引用；未被 registry 引用的 schema 不得进入正式发布包。
4. generated/ 下的 SDK enum、bitmap、Markdown 表格、测试用例均为生成产物，不得手写修改。
5. CI 必须执行 registry validate，任何 methodId/eventId/errorCode 冲突、schema 缺失、命名不一致、ID 越界都必须阻断合并。
6. capability.supportedMethods 的 bitmap 必须由 Method Registry 自动生成，不得人工维护。

⸻

7. 最终建议

你现在应该把 08-13 从“文档集合”升级成：

08：RPC 映射规则
09：Method Registry 规则
10：Event Registry 规则
11：ErrorCode Registry 规则
12：Capability 派生规则
13：MVP Profile 规则

然后真正被实现读取的是：

registry/*.yaml
schema/*.json

最终所有工程文件都由 generator 生成：

Markdown 文档
C/C++ enum
TypeScript enum
Method Bitmap
Event 表
ErrorCode 表
JSON Schema 校验器
Conformance Tests

一句话定稿：

08-13 不应该直接手写实现 registry/schema；08-13 应该定义 registry/schema 的规范和生成规则。registry/schema 是机器可读 SSOT，SDK、文档、bitmap、测试都必须由 generator 派生。