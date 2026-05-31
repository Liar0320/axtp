# Mosculer Compatibility Notes

This runtime uses mosculer as a reference for OBS-style WebSocket JSON envelopes, not as a source to port wholesale.

## Adopted

- WebSocket text messages use an envelope shaped as `sid`, `op`, and `d`.
- Requests use `d.id`, `d.method`, and optional `d.params`.
- Responses use `d.id`, `d.status`, and optional `d.result`.
- Events use `d.event` and optional `d.data`.
- The op values align with the AXTP RPC session spec and the mosculer/OBS-style numbering for Hello, Identify, Identified, Event, Request, Response, Batch, and BatchResponse.

## AXTP Runtime Behavior

- `WebSocketJsonRpcAdapter` owns the Text JSON session and sends server-side Hello after a WebSocket connection is accepted.
- `Identify` assigns or resumes a string `sid` and returns `Identified`.
- `Request` maps method names through the generated method registry, then submits a normalized `RpcPayload` with `SourceProtocol::JsonRpc`.
- `RpcPayload.body` stores `params` as UTF-8 JSON bytes with `RpcBodyEncoding::RawBytes`; schema-aware JSON/TLV conversion is deferred.
- Broker responses from JSON RPC are routed back to `WebSocketJsonRpcAdapter`, which emits `status/result` JSON instead of AXTP binary frames.
- Numeric mosculer-style `sid` values and decimal string request ids are accepted on input. Responses preserve string ids when the request id was a string.

## Not Ported

- mosculer UTFP binary framing is not part of AXTP v1 compatibility. AXTP already has Standard Frame, Binary RPC, and STREAM.
- MsgPack WebSocket messages are not implemented in this runtime step.
- Multi-client WebSocket session routing is not implemented; the current transport remains single-connection.
- Authentication challenge/HMAC fields are reserved but not enforced.
- `eventMasks` is accepted during Identify/Reidentify but not used for fine-grained event filtering yet.
- Full RequestBatch execution is deferred. The adapter returns `RPC_BATCH_UNSUPPORTED`.

## Remaining Gaps

- Schema-aware JSON `params/result` to TLV conversion.
- Multiple WebSocket connections and per-session outbound routing.
- Client-mode Text JSON pending request correlation.
- Event subscription filtering by generated event mask metadata.
- Optional MsgPack codec sharing the same `sid/op/d` semantics.
