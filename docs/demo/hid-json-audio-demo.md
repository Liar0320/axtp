# AXTP HID JSON Audio Demo

状态：Active demo

本 demo 演示 C++ runtime 的最小双端链路：

- 设备端：`axtp_hid_audio_device_demo`，使用 `AxtpServer + HidTransport` 注册音频算法 JSON handler。
- 上位机：`axtpctl`，使用 `--transport hid-sim` 通过本机 socket 连接设备端。
- Wire：HID 形态承载 AXTP FramedBinary，RPC body 使用 JSON encoding。

`hid-sim` 是本机可运行的 HID report bridge，不会把电脑枚举成真实 USB HID 设备。真实硬件接入时，保留 `HidTransport` 和业务 handler，替换为设备侧 HID driver/backend。

这是最小单连接 demo；请按顺序运行 `axtpctl` 命令，不要同时启动多个 host client。

## Build

```bash
cd /path/to/mostormlabs/axtp-cpp-runtime
cmake -S tools/axtpctl -B build/axtpctl
cmake --build build/axtpctl
```

## Run Device Server

```bash
./build/axtpctl/axtp_hid_audio_device_demo --path /tmp/axtp-hid-audio.sock
```

## Run Host Client

查询当前音频算法配置：

```bash
./build/axtpctl/axtpctl \
  -t hid-sim \
  --path /tmp/axtp-hid-audio.sock \
  -c audio.getAlgorithmConfig \
  --json '{}' \
  -o json
```

设置噪声抑制等级：

```bash
./build/axtpctl/axtpctl \
  -t hid-sim \
  --path /tmp/axtp-hid-audio.sock \
  -c audio.setAlgorithmConfig \
  --json '{"config":{"noiseSuppression":{"enabled":true,"level":3}}}' \
  -o json
```

兼容简写参数：

```bash
./build/axtpctl/axtpctl \
  -t hid-sim \
  --path /tmp/axtp-hid-audio.sock \
  -c audio.setAlgorithmConfig \
  --json '{"noiseSuppression":{"level":2}}' \
  -o json
```

## Tests

```bash
ctest --test-dir build/axtpctl --output-on-failure
```

重点测试：

- `hid_local_backend_test`：验证本机 HID backend 按固定 report size 双向传输。
- `hid_audio_demo_e2e_test`：验证 `AxtpServer + HidTransport + AxtpClient` 能完成 `audio.setAlgorithmConfig` 并持久化到内存配置。
