# Error Code Registry

| errorCode | name | domain | status | retryable |
|---:|---|---|---|---|
| `0x0000` | `SUCCESS` | common | mvp | false |
| `0x0201` | `AUTH_REQUIRED` | session | mvp | false |
| `0x0301` | `RPC_UNKNOWN_METHOD` | rpc | mvp | false |
| `0x0302` | `RPC_INVALID_PARAMS` | rpc | mvp | false |
| `0x0401` | `STREAM_NOT_FOUND` | stream | mvp | false |
| `0x0403` | `STREAM_CRC_ERROR` | stream | mvp | true |
| `0x0501` | `DEVICE_BUSY` | device | mvp | true |
| `0x0502` | `CRC_ERROR` | frame | mvp | true |
