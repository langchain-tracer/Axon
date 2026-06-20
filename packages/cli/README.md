# @axon-ai/cli

The Axon CLI runs a local, **OpenTelemetry-native** LLM-observability stack —
backend **and** dashboard on a single URL. Point any OTEL/OpenLLMetry exporter at
it and watch your LLM/agent traces in real time. No Axon-specific SDK needed.

## Install

```bash
npm install -g @axon-ai/cli
```

## Quick start

```bash
axon start
#   ✔ Axon running at http://localhost:4000
```

Then send standard OpenTelemetry spans to `http://localhost:4000`. With
**OpenLLMetry** (Node):

```ts
import * as traceloop from "@traceloop/node-server-sdk";
traceloop.initialize({ baseUrl: "http://localhost:4000" });
// use LangChain / OpenAI / Anthropic / LlamaIndex normally — traces appear in Axon
```

Or with a raw OTEL SDK: `OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4000`.

Open **http://localhost:4000** (on Windows use `http://127.0.0.1:4000` if `localhost`
won't connect). Traces are stored per project under `./.axon-ai/traces.db`.

## Commands

### `axon start`
Start Axon (backend + dashboard on one URL).

- `-p, --port <port>` — port to serve on (default: `4000`)
- `--no-open` — don't open the browser automatically
- `--project <name>` — project name for organizing traces

### `axon status`
Report whether Axon is running and on which port.

### `axon stop`
Stop Axon.

### `axon version`
Print the CLI version.

> `axon`, `axon-ai`, and `agent-trace` are aliases for the same CLI.

## The dashboard

Each trace offers four views:

- **Transcript** (default) — the run as a chat dialogue (user → model → tool → result).
- **Tree** — the span hierarchy with inline duration bars.
- **Waterfall** — duration bars on a shared time axis.
- **Raw** — the verbatim OTEL span JSON, with a copy button.

Plus a per-trace **cost-by-model** breakdown.

## Troubleshooting

**Port already in use** — start on another port: `axon start --port 5000`, or stop
the process holding `4000`.

**`localhost` won't connect (Windows)** — open `http://127.0.0.1:4000` instead;
`localhost` may resolve to IPv6 while the server binds IPv4.

## Migrating from the old tracer packages

`@axon-ai/langchain-tracer` and `@axon-ai/openai-tracer` are **deprecated**. Use
standard OTEL instrumentation (OpenLLMetry / OpenInference) pointed at
`http://localhost:4000` instead.

## License

MIT — see [LICENSE](LICENSE).
