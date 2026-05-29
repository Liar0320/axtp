# Error Code Registry

| errorCode | name | domain | status | retryable |
|---:|---|---|---|---|
| `0x0000` | `SUCCESS` | common | mvp | false |
| `0x0001` | `UNKNOWN_ERROR` | common | mvp | false |
| `0x0005` | `BUSY` | common | mvp | true |
| `0x0102` | `FRAME_VERSION_UNSUPPORTED` | frame | mvp | false |
| `0x0106` | `FRAME_CRC_ERROR` | frame | mvp | true |
| `0x0108` | `FRAME_FRAGMENT_MISSING` | frame | mvp | true |
| `0x0201` | `CONTROL_OPCODE_INVALID` | control | mvp | false |
| `0x0202` | `CONTROL_PAYLOAD_INVALID` | control | mvp | false |
| `0x0204` | `CONTROL_OPEN_REQUIRED` | control | mvp | false |
| `0x0205` | `CONTROL_OPEN_REJECTED` | control | mvp | false |
| `0x0206` | `RESERVED_CONTROL_PROFILE_UNSUPPORTED` | control | reserved | false |
| `0x0207` | `CONTROL_NEGOTIATION_FAILED` | control | mvp | false |
| `0x0208` | `CONTROL_SESSION_INVALID` | control | mvp | false |
| `0x020A` | `CONTROL_RESUME_FAILED` | control | mvp | false |
| `0x020C` | `CONTROL_WINDOW_EXCEEDED` | control | mvp | true |
| `0x0301` | `RPC_ENCODING_UNSUPPORTED` | rpc | mvp | false |
| `0x0306` | `RPC_METHOD_NOT_FOUND` | rpc | mvp | false |
| `0x030B` | `RPC_PARAM_INVALID` | rpc | mvp | false |
| `0x0401` | `STREAM_NOT_FOUND` | stream | mvp | false |
| `0x0402` | `STREAM_TIMEOUT` | stream | mvp | true |
| `0x0403` | `STREAM_CRC_ERROR` | stream | mvp | true |
| `0x060B` | `FW_VERIFY_FAILED` | firmware | mvp | false |
