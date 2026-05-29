# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Repo Is

This is the **AXTP (Auditoryworks Transport Protocol)** specification repository — a Registry-Driven Protocol Platform. It contains the protocol specification, YAML registries, a TypeScript generator toolchain, and generated artifacts.

## Repository Structure

```text
axtp/
├── docs/
│   ├── specs/               # 00-22 手动编写的协议规范 Markdown
│   └── generated/           # ⚠️ Generator 生成的 Registry API 参考手册（禁止手改）
│
├── registry/                # 单一事实源 — 纯 YAML（扁平结构）
│   ├── method_registry.yaml
│   ├── event_registry.yaml
│   ├── error_code.yaml
│   ├── capability_registry.yaml
│   ├── *_schema.yaml        # TLV 类型定义
│   └── ...
│
├── protocol/                # 统一协议定义文件
│   └── axtp.protocol.yaml   # 顶层 Protocol Definition（单一事实源）
│
├── domains/                 # 业务域配置（预留，纯 YAML）
│   ├── device/
│   ├── firmware/
│   ├── media/
│   ├── session/
│   └── discovery/
│
├── generators/              # 编译器工具链（TypeScript/Node.js）
│   ├── src/                 # 核心逻辑（cli, loader, validator, emitters）
│   ├── templates/           # 代码生成模板（预留）
│   ├── package.json
│   └── tsconfig.json
│
├── runtimes/                # 各端运行时实现（代码隔离区）
│   ├── cpp-core/
│   │   ├── src/             # 手写 C++ 核心协议栈（预留）
│   │   └── include/axtp/generated/  # ⚠️ 生成的 C++ 头文件（禁止手改）
│   └── web-sdk/
│       ├── src/             # 手写 TS/JS SDK（预留）
│       └── generated/       # ⚠️ 生成的 TypeScript 类型（禁止手改）
│
├── tooling/                 # 平台化工具链
│   ├── mcp/                 # ⚠️ 生成的 AI Agent JSON Schema 工具描述
│   ├── wireshark/           # ⚠️ 生成的 Wireshark Lua 解析插件（预留）
│   └── test-vectors/        # ⚠️ 生成的 JSON/hex 测试向量
│
└── adapters/                # 兼容层：旧协议文档与映射
    └── legacy-protocols/    # 旧协议参考文档（xlsx, pdf, md）
```

## Protocol Architecture

AXTP defines a 5-layer stack:

```text
Business Layer      → device / display / firmware / media domains
Registry Layer      → Method / Event / Error / Capability IDs
Payload Layer       → CONTROL (0x01) / RPC (0x02) / STREAM (0x03)
AXTP Frame Layer    → Header / Length / MessageId / Fragment / CRC
Transport Layer     → BLE / HID / UART / TCP / WebSocket / USB Bulk
```

**Critical design constraint**: `PayloadType` only selects a parser — it never encodes business types like VIDEO, OTA, FILE. Business semantics belong in the Registry layer.

## Two Header Profiles

- **Standard Profile** (12B Header + 2B CRC16 Footer = 14B total): TCP, WebSocket Binary, USB Bulk, gateways.
- **Compact Profile** (4B Header + 1B CRC8 Footer = 5B total): BLE, USB HID, UART, MCU.

## Three Payload Types

| PayloadType | Value | Role |
| --- | --- | --- |
| CONTROL | 0x01 | Protocol runtime signals: OPEN, ACK, NACK, HEARTBEAT, RESUME, CLOSE |
| RPC | 0x02 | Business control plane: request, response, event, batch |
| STREAM | 0x03 | Business data plane: video/audio frames, OTA chunks, file chunks, logs |

## Key Conventions

- **Byte order**: Little-Endian for all multi-byte integers in AXTP v1 wire format
- **CRC**: Standard uses CRC16-CCITT-FALSE; Compact uses CRC8-MAXIM. Both cover Header + Payload.
- **Registry is the single source of truth** — `registry/*.yaml` and `protocol/axtp.protocol.yaml` are the machine-readable source; Generator produces code and docs from YAML.
- **No-Touch Rule**: All `generated/` directories are produced by `generators/`. Never hand-edit them.
- **MessageId** (Frame layer) ≠ **requestId** (RPC layer) ≠ **streamId** (Stream layer)

## Generator Usage

```bash
cd generators
pnpm install
pnpm build
pnpm validate:protocol   # validate protocol/axtp.protocol.yaml
pnpm generate:protocol   # generate docs/generated/
pnpm validate            # validate registry/*.yaml
pnpm generate            # generate runtimes/, tooling/
```

## When Adding to This Repo

- New spec documents → `docs/specs/` (follow `NN-AXTP-<Title>.md` numbering)
- New registry entries → edit `registry/*.yaml` then run `pnpm generate`
- New protocol definition content → edit `protocol/axtp.protocol.yaml` then run `pnpm generate:protocol`
- Never edit files under any `generated/` directory directly
