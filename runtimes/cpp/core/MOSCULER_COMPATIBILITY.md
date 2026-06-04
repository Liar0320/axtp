# WebSocketJsonRpc Spec Alignment Notes

`WebSocketJsonRpc` is an AXTP v1 wire mode/profile, not legacy compatibility. Mosculer is only historical context for the OBS-style envelope shape; the runtime format is defined by AXTP specs.

## Spec Sources

- `docs/specs/03-AXTP-Transport-Profiles.md` defines `AXTP-WS-JSON` and `AXTP-WS-CLOUD-REVERSE` as WebSocket Unframed JSON profiles.
- `docs/specs/05-AXTP-RPC-Session-Spec.md` defines the `sid/op/d` envelope, Hello, Identify, Identified, Request, RequestResponse, Event, and Batch semantics.
- No standalone WebSocket JSON-RPC profile file exists yet. If one is added, it should become the most specific reference for this runtime.

## Runtime Behavior

- `JsonRpcDecoder` receives one complete WebSocket text message and outputs normalized `RpcPayload` values.
- `JsonRpcEncoder` receives normalized `RpcPayload` values and emits one complete UTF-8 JSON message.
- Method, event, and error names are resolved through generated AXTP registries.
- `params`, `result`, and `data` are currently carried as UTF-8 JSON bytes in `RpcPayload.body`.
- Schema-aware JSON to TLV conversion is intentionally deferred.

## Boundaries

- WebSocketJsonRpc does not use Standard Frame headers, Binary RPC 11B headers, CONTROL, STREAM, CRC16, or message fragmentation.
- WebSocketJsonRpc is not an AXDP/legacy adapter and does not carry legacy command ids, legacy status codes, old checksums, or old headers.
- Legacy adapters may be implemented as separate optional packages that depend on cpp/core normalized payload interfaces.
