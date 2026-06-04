# axtpctl Command Design

## Summary

`runtimes/cpp/tools/axtpctl` is the AXTP command-line tool for debugging, production test, and integration checks. It depends on `runtimes/cpp/sdk` and should not directly manipulate low-level frame decoders except for explicit inspection commands.

Runtime calls should flow through the SDK, which in turn uses `AxtpEndpoint` as the glue between `ITransport`, `AxtpCore`, and `BasicBroker<>`.

P0 implements a small usable dynamic RPC tool:

- `--help`
- `call <method|--method-id>` with JSON/TLV/Raw body
- `capability methods`
- `list-methods`
- `ping`
- `inspect frame --hex <HEX>`

P1 keeps the planned larger surface: event watch/emit, stream read/write, mock-server, and full test-vector runner.

## Global Syntax

```bash
axtpctl \
  --transport tcp|ws|hid|ble|uart|mock \
  --endpoint <endpoint> \
  --wire framed-binary|websocket-json-rpc \
  --encoding json|tlv|raw \
  --registry-file FILE \
  --timeout 5000 \
  --verbose \
  <command>
```

`mock` is the default transport for P0 smoke tests. For real devices, the CLI must route through SDK transport connectors or optional transport factories when those are available. Concrete HID/TCP/WebSocket dependencies are tool/runtime dependencies, not cpp/core dependencies.

## P0 Commands

### call

```bash
axtpctl --transport mock call audio.getAlgorithmConfig --json '{}'
axtpctl --transport mock call audio.setAlgorithmConfig --json '{"noiseSuppression":{"enabled":true,"level":3}}'
axtpctl --transport mock call --method-id 0x90010001 --raw-hex cafe
axtpctl --transport mock --registry-file ./methods.json call vendor.echo --json '{"value":80}'
```

Behavior:

- Resolves method name through runtime `MethodRegistry`.
- Supports `--json`, `--tlv-hex`, `--tlv-file`, `--raw-hex`, and `--raw-file`.
- Uses SDK dynamic APIs and does not require generated typed C++ wrappers.
- Prints JSON response bodies by default; TLV/Raw may be printed as hex or written to file.

### capability methods

```bash
axtpctl capability methods
```

Prints the generated method registry as JSON.

### ping

```bash
axtpctl --transport mock ping
```

P0 mock ping returns a local success JSON document. Real transport ping will be wired to CONTROL/RPC once the SDK owns client-side transport connection management.

### inspect frame

```bash
axtpctl inspect frame --hex "415801020000000000000001..."
```

Parses a hex AXTP standard frame and prints header fields, payload length, payload type, and CRC information. This command may use core model constants directly because it is an explicit debugging tool.

## P1 Commands

The following commands are retained in the design but not required for P0:

```bash
axtpctl event watch <event|--all>
axtpctl event emit <event> --data JSON
axtpctl capability get
axtpctl capability events
axtpctl stream open <stream>
axtpctl stream read <stream> --output FILE
axtpctl stream write <stream> --input FILE
axtpctl test-vector run PATH
axtpctl mock-server --listen HOST:PORT
```

These should continue to use SDK-level APIs rather than reaching into cpp/core internals.

## Internal Execution Flow

Normal command execution is:

```text
argv
  -> parse global options
  -> load generated MethodRegistry
  -> optionally merge --registry-file
  -> choose mock or optional concrete transport
  -> construct AxtpClient
  -> execute SDK dynamic API
  -> render json/hex/file output
```

Only `inspect` commands may directly touch frame/payload decoders. User-facing device operations should go through SDK calls so CLI behavior matches application behavior.

## Command Dispatch Rules

- Global options are parsed before command-specific options.
- `--command` and `-c` are shortcuts for `call <method>`.
- `--params` is accepted only as a compatibility alias for `--json`.
- `--json-file`, `--tlv-file`, and `--raw-file` must be mutually exclusive with their inline equivalents.
- `--registry-file` augments runtime method lookup and should not require typed generated wrappers.
- Output defaults to JSON when the payload is JSON and hex for TLV/Raw unless `--output` overrides it.

## Transport Policy

`axtpctl` may link optional transport targets because it is a tool target. It must not move concrete transport dependencies down into cpp/core. The command implementation should keep transport factory logic at the CLI/SDK boundary:

```text
mock      -> testing/mock transport or local handler
hid       -> optional axtp_transport_hidapi
tcp/ws    -> optional Boost transport targets
ble/uart  -> reserved endpoint values until concrete transports exist
```

## Documentation Links

- Runtime architecture: `runtimes/cpp/core/ARCHITECTURE.md`
- Runtime patterns: `docs/dev/AXTP_CPP_RUNTIME_PATTERNS.md`
- Execution flow: `docs/dev/AXTP_CPP_EXECUTION_FLOW.md`
- C++ style: `docs/dev/AXTP_CPP_STYLE.md`
