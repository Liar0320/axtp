# AXTP Capability Model v2

> Status: Future / P1 Design Source
> Scope: Complete capability model postponed from AXTP v1 Core

## 1. Boundary

AXTP v1 Core only requires:

```text
capability.supportedMethods
```

The complete capability model described here is not required for v1 interoperability. It must not change stable v1 method/event/error/type wire format.

## 2. Future Methods

| Method | Purpose |
|---|---|
| `capability.getAll` | Return a complete capability summary. |
| `capability.getDomain` | Return capability data for one domain. |
| `capability.hasMethod` | Test whether a method is currently callable. |
| `capability.getLimits` | Return protocol and transport limits. |
| `capability.hasEvent` | Test whether an event can be emitted. |
| `capability.getStreams` | Return stream profile support. |
| `capability.getFirmware` | Return firmware update capability. |
| `capability.negotiate` | Negotiate optional business capability parameters. |

## 3. Domain Mask Form

Future binary capability summaries may reuse the v1 domain mask packet shape:

```text
Domain Block = [DomainId:1B] + [MaskLen:1B] + [Bitmask:N B Little-Endian]
```

For v2 capability masks, `DomainId` uses the capability domain namespace. This must not be confused with v1 `capability.supportedMethods`, whose DomainId is derived from methodId high byte.

## 4. JSON Shape Candidate

```json
{
  "protocol": {
    "payloadTypes": ["CONTROL", "RPC", "STREAM"],
    "frameProfile": "COMPACT_FRAME"
  },
  "transport": {
    "type": "HID",
    "mtu": 64,
    "maxFrameSize": 64,
    "ackMode": "MESSAGE_ACK"
  },
  "rpc": {
    "encodings": ["BINARY"],
    "bodyEncodings": ["TLV8"]
  },
  "stream": {
    "profiles": ["firmware.ota"],
    "resume": true,
    "chunkCrc32": true
  },
  "business": {
    "display": {
      "brightness": { "supported": true, "min": 0, "max": 100, "step": 1 }
    }
  }
}
```

## 5. Migration Rule

When a v2 capability becomes stable, add its machine-readable fact to `registry/**/*.yaml`, `registry/domains/**/*.yaml`, or a future protocol definition extension. Do not add full capability tables to 08-13 meta specs.
