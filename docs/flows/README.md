# AXTP 协议交互流程

`docs/flows/` 存放场景级协议交互方案，是 Stage 10 `plan-protocol-flow` 的默认输出目录。

这类文档把产品 story、UI 原型、旧协议线索和 AXTP 协议工作连接起来，回答：

- 用户或系统要完成什么目标。
- 哪些 actor 参与，例如用户、App、云端、设备、固件服务、SDK 或工具。
- 每一步需要哪些 method、event、capability、profile 或 stream。
- 哪些协议事实已经 adopted/generated，可以直接复用。
- 哪些能力缺失，需要转入 Stage 20 `draft-business-protocol`。
- 哪些已采纳协议需要语义变更，需要转入 Stage 40 `amend-adopted-protocol`。
- 哪些只是 UI-only 或业务编排行为，不应该进入协议草案。

`docs/flows/**` 不是最终协议事实源。稳定实现合同仍然来自：

```text
registry/**/*.yaml + registry/domains/**/*.yaml
  -> protocol/axtp.protocol.yaml
  -> docs/generated/**
```

## 什么时候用 Stage 10

当输入不是单个明确协议方法，而是一个端到端需求时，先使用 `docs/dev/skills/10-plan-protocol-flow/SKILL.md`：

| 输入 | Stage 10 做什么 | 后续 |
|---|---|---|
| UI 原型，例如音频算法强度滑条和恢复默认按钮 | 识别屏幕控件、读写流程、默认值、错误路径和已有协议覆盖 | 写 `docs/flows/<scenario>.md`，缺口转 20/40 |
| 用户 story，例如“用户在 App 中切换输出布局” | 拆 actor、步骤、请求、响应、事件和状态同步 | 判断复用已有协议还是新增草案 |
| 旧协议迁移场景 | 把旧命令映射到 story 步骤，区分兼容保留和 AXTP 新增能力 | 缺口转 `docs/protocol/**` 草案 |
| 跨端业务流程 | 标出 App、后台、设备、SDK、测试各自消费的协议事实 | 给研发和测试形成共同流程图 |

## 工作流

```text
docs/business/<requirement>.md 或业务场景 / UI 原型 / 用户 story
  -> Stage 10 plan-protocol-flow
  -> docs/flows/<scenario>.md
  -> Stage 20 draft-business-protocol 或 Stage 40 amend-adopted-protocol
  -> Stage 30 adopt-protocol-draft
  -> Stage 50 generate-axtp-protocol
```

## Active Flow Plans

- [Audio Algorithm Level Control](audio-algorithm-level-control.md)：App UI 中的音频算法强度滑条和恢复默认流程，复用 `audio.algorithm`。
- [Cast Receiver UxPlay](cast-reciever-uxplay.md)：Launcher 集成 AirPlay/UxPlay 接收端的外部 AXTP 控制口、runtime/backend 状态、投屏会话、PIN、窗口和音频控制流程。
- [Cast RX/TX Pairing](cast-rxtx-paring.md)：NA20 接收端 AP 信息写入 NT10 发射端 Wi-Fi STA 配置的自动配对流程，依赖 `network.ap` / `network.wifi` 草案细化。
- [Device Firmware Update](device-firmware-update.md)：PC 上位机通过 `firmware.update` 为直连设备执行单 `.bin` / 多 `.bin` 固件升级的流程，依赖 `firmware.update` / `firmware.info` 草案采纳。
- [Device Information And System Runtime State](device-system-info.md)：连接设备后读取主设备信息、按需发现子设备/拓扑，并通过 system 管理 CPU、温度、电源等运行时状态和关机/重启控制。
- [NearHub Launcher Digital Signage Device Management](signage-device-management.md)：将两份 NearHub Launcher 设备管理 legacy 文档整理为数字标牌设备上线、配置、升级、绑定、内容同步和日志导出的标准 AXTP 交互流程。
- [NA20/NT10 Device Streaming Audio And Video](device-streaming-audio-video.md)：NA20 接收 NT10 H.264/AAC 投屏流后，经 USB HID/AXTP STREAM 转发给上位机播放的音频和视频交互流程。
