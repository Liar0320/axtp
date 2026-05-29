# AXTP Legacy Compatibility Reference

> Status: Legacy Source
> Scope: Old protocol mapping material extracted from legacy registry documents

## 1. Purpose

This file collects legacy compatibility material that should not live in v1 Core specs or 08-13 meta specs.

Normative migration rules live in:

```text
standard/docs/00-spec/07-AXTP-Compatibility-and-Versioning.md
```

Original legacy registry documents are retained at:

```text
protocol-source/legacy-docs/02-registry/
```

## 2. Mapping Categories

| Legacy object | AXTP destination |
|---|---|
| CmdValue | `methods[].legacy.cmdValue` |
| Legacy method name | `methods[].legacy.name` |
| Legacy payload format | `methods[].legacy.payloadFormat` or `bodyEncoding=RAW_BYTES` |
| Legacy status | `errors[].code` through a legacy error mapping |
| Legacy event | `events[]` plus adapter metadata |
| Legacy capability / feature bit | v1 `capability.supportedMethods` or future Capability Model |
| Legacy stream bytes | RPC stream setup plus `PayloadType=STREAM` |

## 3. Current Preserved Mappings

| AXTP method | Legacy command | Legacy name | Payload format |
|---|---:|---|---|
| `device.getInfo` | `0x000B0002` | `BetaDeviceInfo` | fixed_struct |
| `display.setBrightness` | `0x000B0042` | `BetaBrightnessSet` | fixed_struct |

## 4. Legacy Error Mapping Rule

Legacy status values must map to AXTP `errors[].code`:

```yaml
legacyErrorMappings:
  - source: AXDP_HID
    legacyStatus: 0x00
    axtpErrorName: SUCCESS
  - source: AXDP_HID
    legacyStatus: 0x01
    axtpErrorName: RPC_PARAM_INVALID
  - source: AXDP_HID
    legacyStatus: 0x02
    axtpErrorName: BUSY
```

Unmapped legacy status values should use a future legacy adapter error, not a frame/control error.

## 5. Promotion Rule

Legacy material is only promoted to `protocol/axtp.protocol.yaml` after it has:

1. A stable AXTP method/event/error/type/profile mapping.
2. A clear owner domain.
3. A schema or explicit `RAW_BYTES` compatibility body.
4. Conformance tests or adapter test vectors.

