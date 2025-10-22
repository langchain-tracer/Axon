# Agent Trace CLI

A command-line tool for monitoring LangChain agents in real-time with the Agent Trace dashboard.

## Installation

### Global Installation (Recommended)

```bash
npm install -g @agent-trace/cli
```

### Local Installation

```bash
npm install @agent-trace/cli
npx agent-trace --help
```

## Quick Start

1. **Initialize Agent Trace in your project:**
   ```bash
   agent-trace init --project my-ai-project
   ```

2. **Start the dashboard:**
   ```bash
   agent-trace start
   ```

3. **Add tracing to your LangChain agents:**
   ```javascript
   import { createTracer } from '@agent-trace/langchain-tracer';
   
   const tracer = createTracer({
     projectName: 'my-ai-project'
   });
   
   const model = new ChatOpenAI({
     modelName: 'gpt-3.5-turbo',
     callbacks: [tracer] // Add the tracer
   });
   ```

4. **Run your agents and watch them in real-time!**

## Commands

### `agent-trace init`

Initialize Agent Trace in your current project.

```bash
agent-trace init [options]
```

**Options:**
- `--project <name>` - Project name (default: "default")
- `--auto-start` - Automatically start dashboard after initialization

**Example:**
```bash
agent-trace init --project my-ai-app --auto-start
```

### `agent-trace start`

Start the Agent Trace dashboard and enable tracing.

```bash
agent-trace start [options]
```

**Options:**
- `-p, --port <port>` - Backend server port (default: 3000)
- `-d, --dashboard-port <port>` - Dashboard port (default: 5173)
- `--no-open` - Don't automatically open dashboard in browser
- `--project <name>` - Project name for organizing traces

**Example:**
```bash
agent-trace start --port 3001 --dashboard-port 5174
```

### `agent-trace status`

Check the status of Agent Trace services.

```bash
agent-trace status
```

Shows:
- Project information
- Backend server status
- Dashboard status
- Quick action suggestions

### `agent-trace stop`

Stop all Agent Trace services.

```bash
agent-trace stop
```

### `agent-trace version`

Show version information.

```bash
agent-trace version
```

## Integration with LangChain

### Basic Integration

```javascript
import { createTracer } from '@agent-trace/langchain-tracer';
import { ChatOpenAI } from '@langchain/openai';

// Create tracer
const tracer = createTracer({
  projectName: 'my-project',
  endpoint: 'http://localhost:3000'
});

// Add to your model
const model = new ChatOpenAI({
  modelName: 'gpt-3.5-turbo',
  callbacks: [tracer]
});
```

### Agent Integration

```javascript
import { AgentExecutor, createOpenAIFunctionsAgent } from 'langchain/agents';

const agent = await createOpenAIFunctionsAgent({
  llm: model,
  tools: [searchTool, calculatorTool],
  prompt: agentPrompt
});

const agentExecutor = new AgentExecutor({
  agent,
  tools: [searchTool, calculatorTool],
  callbacks: [tracer] // Add tracer to executor too
});
```

### Chain Integration

```javascript
import { LLMChain } from 'langchain/chains';

const chain = new LLMChain({
  llm: model,
  prompt: myPrompt,
  callbacks: [tracer]
});
```

## Configuration

After running `agent-trace init`, a `.agent-trace/config.json` file is created:

```json
{
  "project": "my-project",
  "version": "1.0.0",
  "initialized": "2024-01-15T10:30:00.000Z",
  "backend": {
    "port": 3000,
    "host": "localhost"
  },
  "dashboard": {
    "port": 5173,
    "host": "localhost"
  }
}
```

## Troubleshooting

### Port Already in Use

If you get a "port already in use" error:

```bash
# Check what's using the port
lsof -i :3000

# Kill the process
kill -9 <PID>

# Or use different ports
agent-trace start --port 3001 --dashboard-port 5174
```

### Services Not Starting

1. Check if ports are available:
   ```bash
   agent-trace status
   ```

2. Stop all services and restart:
   ```bash
   agent-trace stop
   agent-trace start
   ```

3. Check logs in the terminal where you started the services

### Dashboard Not Opening

If the dashboard doesn't open automatically:

1. Check the status: `agent-trace status`
2. Manually open: `http://localhost:5173` (or your configured port)
3. Make sure the backend is running on the correct port

## Development

### Building from Source

```bash
git clone https://github.com/yourusername/agent-trace-visualizer
cd agent-trace-visualizer
npm install
npm run build:cli
```

### Running in Development

```bash
cd packages/cli
npm run dev
```

## Support

- 📖 [Documentation](https://github.com/yourusername/agent-trace-visualizer)
- 🐛 [Report Issues](https://github.com/yourusername/agent-trace-visualizer/issues)
- 💬 [Discussions](https://github.com/yourusername/agent-trace-visualizer/discussions)

## License

MIT License - see [LICENSE](LICENSE) for details.

