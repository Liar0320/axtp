# Device Firmware Update

## 背景

当前设备固件更新文件通常是一个完整 `.bin` 文件，但也存在需要多个 `.bin` 文件才能完成升级的场景。

## 用户目标

设备通过上位机可以展示当前版本号信息，也可以通过上位机执行固件更新。

## 范围

1. 设备通用固件更新方案，即 `firmware.update` 能力。

## 非目标



## 场景

- 设备被接到 PC 上，通过上位机完成固件更新。

## 约束

- 产品、设备、固件、网络、兼容性、时延、安全、隐私或部署约束。

## 旧协议线索

- 关联旧协议文件、命令、日志、SDK 行为或历史文档。

## 开放问题

- [REVIEW-ASK] 需要产品、架构、固件、App、后台或旧协议行为确认的问题。

## 下一步

- 创建或更新 `docs/flows/device-firmware-update.md`
- 创建或更新 `docs/protocol/firmware/firmware.update.md`
