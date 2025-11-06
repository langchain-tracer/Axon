# AXON - Agent Trace Visualizer

**Real-time tracing and visualization for AI agents and LLM workflows**

[![Docker](https://img.shields.io/badge/Docker-Ready-blue)](./DOCKER_QUICKSTART.md)
[![Node](https://img.shields.io/badge/Node-20.19.5-green)](./.nvmrc)
[![License](https://img.shields.io/badge/License-MIT-yellow)](./LICENSE)

---

## 🚀 Quick Start (Docker - Recommended)

Get up and running in **2 minutes**:

```bash
# 1. Start AXON
make start

# 2. Open dashboard
# http://localhost:8080
```

**That's it!** No dependency installation, no configuration needed.

📖 [Docker Quick Start Guide](./DOCKER_QUICKSTART.md) | [Full Docker Documentation](./DOCKER_SETUP.md)

---

## ⚡ What is AXON?

AXON is a powerful visualization and debugging tool for AI agents built with:
- **LangChain** - Chain-of-thought reasoning, tool usage
- **OpenAI Agents** - Function calling, assistants API
- **Custom AI Workflows** - Any agent framework

### Key Features

✨ **Real-time Trace Visualization**
- See your agent's decision-making process as it happens
- Interactive node graph with detailed step information
- WebSocket-based live updates

🔍 **Deep Inspection**
- View LLM prompts, responses, and reasoning
- Inspect tool inputs and outputs
- Track token usage and costs in real-time

📊 **Analytics & Insights**
- Cost analysis across traces
- Performance metrics (latency, token usage)
- Anomaly detection for unusual behavior
- Dependency graphs

🎯 **Intelligent Features**
- Time-travel debugging (replay traces)
- Compare trace executions
- Filter and search across traces
- Export trace data

---

## 📦 Installation Options

### Option 1: Docker (Recommended)

**Pros:** No setup, works everywhere, production-ready
```bash
make start
```
[See Docker Setup Guide →](./DOCKER_SETUP.md)

### Option 2: Manual Installation

**Requirements:**
- Node.js 20.19.5 (use [nvm](https://github.com/nvm-sh/nvm))
- npm 9+

**Setup:**
```bash
# Install dependencies
npm install

# Backend
cd backend
npm install
npm run build
npm start

# Dashboard (in another terminal)
cd dashboard
npm install
npm run dev
```

[See Manual Setup Guide →](./MANUAL_SETUP.md)

---

## 🎯 Usage

### 1. Start AXON

```bash
# Docker
make start

# Manual
npm start  # (in both backend/ and dashboard/)
```

### 2. Instrument Your Agent

#### LangChain

```typescript
import { TracingCallbackHandler } from '@axon-ai/langchain-tracer';

const tracer = new TracingCallbackHandler({
  projectName: 'my-agent',
  endpoint: 'http://localhost:3000/api/traces'
});

const agent = createAgent({
  callbacks: [tracer]
});

await agent.invoke({ input: "Your query" });
```

#### OpenAI

```typescript
import { OpenAITracer } from '@axon-ai/openai-tracer';

const tracer = new OpenAITracer({
  projectName: 'my-assistant'
});

// Tracer automatically captures OpenAI calls
const completion = await openai.chat.completions.create({...});
```

### 3. View Traces

Open http://localhost:8080 and watch your agent's execution in real-time!

---

## 🏗️ Architecture

```
┌─────────────────┐
│   Your Agent    │ ──▶ Sends trace events
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  AXON Backend   │ ──▶ Stores in SQLite, broadcasts via Socket.IO
│  (Port 3000)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ AXON Dashboard  │ ──▶ Visualizes traces in real-time
│  (Port 8080)    │
└─────────────────┘
```

### Tech Stack

**Backend:**
- Node.js + TypeScript
- Express.js (REST API)
- Socket.IO (WebSocket)
- SQLite (storage)
- Better-sqlite3 (fast queries)

**Dashboard:**
- React 18 + TypeScript
- React Flow (graph visualization)
- Tailwind CSS (styling)
- Recharts (analytics)
- Vite (dev server & build)

**Infrastructure:**
- Docker + Docker Compose
- Nginx (production proxy)
- Make (automation)

---

## 📊 Features Overview

### Trace Visualization

```
┌──────────────────────────────────────────────────────┐
│  [LLM]  →  [Tool: Search]  →  [LLM]  →  [Response]  │
│   │           │                  │                    │
│   └─ Reasoning └─ Results     └─ Final Answer        │
└──────────────────────────────────────────────────────┘
```

- **Interactive Graph:** Zoom, pan, click nodes for details
- **Color Coding:** LLMs (blue), Tools (green), Decisions (purple)
- **Live Updates:** New nodes appear as they execute

### Cost Tracking

```
Total Cost: $0.0042
├─ GPT-4: $0.0035 (3,500 tokens)
├─ GPT-3.5: $0.0005 (2,000 tokens)
└─ Tools: $0.0002 (API calls)
```

### Anomaly Detection

- **High Latency:** Steps taking unusually long
- **High Cost:** Expensive LLM calls
- **Errors:** Failed tool calls or LLM errors
- **Loops:** Infinite or excessive loops

### Replay & Debug

```typescript
// Time-travel through execution
const replay = new ReplayEngine(traceId);
await replay.stepForward();  // Execute next step
await replay.stepBackward(); // Go back
await replay.reset();        // Start over
```

---

## 🧪 Example Projects

### 1. Comprehensive Test Suite

```bash
cd test-langchain-project
npm install
npm run test:comprehensive
```

Demonstrates:
- ✅ LLM reasoning chains
- ✅ Tool usage (calculator, search)
- ✅ Multi-step workflows
- ✅ Error handling

### 2. Flight Booking Agent

```bash
cd test-langchain-project
npm run realistic-agent
```

Features:
- ✅ 6 tools (search flights, book, check weather, etc.)
- ✅ Complex decision-making
- ✅ Real-world scenario
- ✅ Cost optimization

### 3. OpenAI Function Calling

```bash
cd test-openai-agents
npm run function-calling
```

Shows:
- ✅ OpenAI function calling
- ✅ Multi-turn conversations
- ✅ Tool selection logic

---

## 📸 Screenshots

### Dashboard Overview
![Dashboard](./docs/images/dashboard.png)

### Trace Visualization
![Trace Graph](./docs/images/trace-graph.png)

### Cost Analysis
![Cost View](./docs/images/cost-view.png)

### Anomaly Detection
![Anomalies](./docs/images/anomalies.png)

---

## 🛠️ Development

### Running in Development Mode

```bash
# Docker (with hot reload)
make dev

# Manual
cd backend && npm run dev      # Terminal 1
cd dashboard && npm run dev    # Terminal 2
```

### Building for Production

```bash
# Docker
make build

# Manual
cd backend && npm run build
cd dashboard && npm run build
```

### Running Tests

```bash
# Docker health checks
make test

# Full test suite
npm run test:comprehensive
```

---

## 📝 API Reference

### REST Endpoints

```
GET  /api/traces              # List all traces
GET  /api/traces/:id          # Get trace details
POST /api/traces              # Create new trace
GET  /api/health              # Health check
```

### WebSocket Events

```typescript
// Client → Server
socket.emit('watch_trace', traceId)

// Server → Client
socket.on('trace_data', (data) => {...})
socket.on('new_event', (event) => {...})
```

[Full API Documentation →](./docs/API.md)

---

## 🤝 Contributing

We welcome contributions! Please see:
- [Contributing Guide](./CONTRIBUTING.md)
- [Code of Conduct](./CODE_OF_CONDUCT.md)
- [Development Guide](./docs/DEVELOPMENT.md)

---

## 📚 Documentation

- [Docker Quick Start](./DOCKER_QUICKSTART.md) - Get started in 2 minutes
- [Docker Setup Guide](./DOCKER_SETUP.md) - Complete Docker documentation
- [Manual Setup](./MANUAL_SETUP.md) - Non-Docker installation
- [API Reference](./docs/API.md) - REST and WebSocket API
- [Architecture](./docs/ARCHITECTURE.md) - System design
- [Troubleshooting](./docs/TROUBLESHOOTING.md) - Common issues

---

## 🐛 Troubleshooting

### Dashboard won't load?

```bash
make logs           # Check logs
make health         # Check service health
make restart        # Restart services
```

### Database issues?

```bash
make backup         # Backup first
make clean          # Reset everything
make start          # Fresh start
```

### More help?

See [Troubleshooting Guide](./docs/TROUBLESHOOTING.md) or [open an issue](https://github.com/yourusername/axon/issues).

---

## 📄 License

MIT License - see [LICENSE](./LICENSE) file for details.

---

## 🙏 Acknowledgments

- [LangChain](https://langchain.com/) - AI framework
- [React Flow](https://reactflow.dev/) - Graph visualization
- [OpenAI](https://openai.com/) - LLM API

---

## 🌟 Star History

If you find AXON useful, please consider giving it a star! ⭐

---

## 📞 Contact

- **Issues:** [GitHub Issues](https://github.com/yourusername/axon/issues)
- **Discussions:** [GitHub Discussions](https://github.com/yourusername/axon/discussions)
- **Email:** your.email@example.com

---

**Built with ❤️ for the AI agent community**

[Get Started →](./DOCKER_QUICKSTART.md) | [Documentation →](./DOCKER_SETUP.md) | [Examples →](./test-langchain-project/)

