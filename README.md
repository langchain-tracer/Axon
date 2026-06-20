# Axon — local, OpenTelemetry-native LLM observability

Axon is a single CLI that runs a local backend **and** dashboard on one URL and
ingests **standard OpenTelemetry (OTLP) traces** from any framework or SDK. Point
any OTEL/OpenLLMetry exporter at it and watch your LLM/agent runs render in
real time — no Axon-specific SDK required.

## ✨ Features

- **OTEL-native ingestion** — exposes a standard `POST /v1/traces` (OTLP/HTTP, JSON + protobuf).
- **Works with everything** — LangChain, OpenAI, Anthropic, LlamaIndex, … via off-the-shelf
  instrumentation ([OpenLLMetry](https://github.com/traceloop/openllmetry) / OpenInference).
- **One install, one URL** — the CLI bundles the backend + dashboard; `axon start` serves
  the UI, REST API, OTLP ingest, and live updates all on `http://localhost:4000`.
- **Readable trace views** — **Transcript** (the run as a chat dialogue), **Tree**
  (hierarchy + duration bars), **Waterfall**, and a **Raw** OTEL span inspector.
- **Cost tracking** — per-model token pricing with a cost-by-model breakdown; an explicit
  cost attribute on a span always wins.
- **Live** — Server-Sent Events push new/updated traces to the dashboard instantly.

## 🚀 Install

```bash
npm install -g @axon-ai/cli
```

## ⚡ Quick start

```bash
axon start
#   ✔ Axon running at http://localhost:4000
```

Then point any OpenTelemetry exporter at Axon and run your app. With
**OpenLLMetry** (Node):

```ts
import * as traceloop from "@traceloop/node-server-sdk";

traceloop.initialize({ baseUrl: "http://localhost:4000" }); // Axon's URL
// now use LangChain / OpenAI / Anthropic / LlamaIndex as usual — traces appear in Axon
```

Or with a raw OpenTelemetry SDK, just set the standard endpoint:

```bash
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4000
```

Open **http://localhost:4000** (use `http://127.0.0.1:4000` on Windows if `localhost`
won't connect) to explore your traces.

> Tip: to confirm ingestion without an app, POST a sample span:
> ```bash
> curl -X POST http://localhost:4000/v1/traces -H "Content-Type: application/json" \
>   -d '{"resourceSpans":[{"resource":{"attributes":[{"key":"service.name","value":{"stringValue":"demo"}}]},"scopeSpans":[{"spans":[{"traceId":"00000000000000000000000000000001","spanId":"0000000000000001","name":"chat","kind":3,"startTimeUnixNano":"1700000000000000000","endTimeUnixNano":"1700000001000000000","attributes":[{"key":"gen_ai.request.model","value":{"stringValue":"gpt-4o"}}],"status":{"code":1}}]}]}]}'
> ```

## 📚 Commands

- `axon start [options]` — start Axon (backend + dashboard on one URL).
  - `-p, --port <port>` — port to serve on (default: `4000`).
  - `--no-open` — don't open the browser automatically.
  - `--project <name>` — project name for organizing traces.
- `axon status` — check whether Axon is running.
- `axon stop` — stop Axon.
- `axon version` — print the CLI version.

(`axon`, `axon-ai`, and `agent-trace` are all aliases for the same CLI.)

## 🧠 How it works

```
your app  ──OTLP/HTTP──▶  Axon backend (:4000)  ──▶  SQLite
(OpenLLMetry/OpenInference/    /v1/traces                │
 native OTEL exporter)                                   ▼
                                              dashboard + REST + SSE  ──▶  browser
```

Each OTLP span is classified (`llm`/`tool`/`chain`/`retriever`/`agent`) from
`gen_ai.*` / OpenInference / OpenLLMetry semantic conventions, the **verbatim span**
is stored once, and the dashboard derives everything it shows from it. Traces are
stored per project under `./.axon-ai/traces.db` where you run `axon start`.

## ⚠️ Migrating from the old tracer packages

`@axon-ai/langchain-tracer` and `@axon-ai/openai-tracer` are **deprecated**. Axon no
longer needs an Axon-specific SDK — use standard OTEL instrumentation
(OpenLLMetry/OpenInference) pointed at `http://localhost:4000` instead.

## 🤝 Development

Monorepo (npm workspaces: `backend`, `dashboard`, `packages/*`).

```bash
git clone https://github.com/langchain-tracer/Axon.git
cd Axon
npm install
npm run build          # build backend + dashboard + cli
npm run dev            # backend on :4000 + dashboard dev server on :5173 (proxied)
npm run test --workspaces   # run tests
```

To produce the publishable CLI (bundles backend + dashboard into the package):

```bash
npm run bundle --workspace=@axon-ai/cli
```

## 📄 License

MIT — see the LICENSE file.
