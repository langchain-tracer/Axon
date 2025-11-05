# Agent Trace CLI

A command-line tool for monitoring LangChain agents in real-time with the AXON dashboard.

## Installation

### Global Installation (Recommended)

```bash
npm install -g @axon-ai/cli
```

### Local Installation

```bash
npm install @axon-ai/cli
npx axon-ai --help
```

## Quick Start

1. **Initialize Axon in your project:**
   ```bash
   axon-ai init --project my-ai-project
   ```

2. **Start the dashboard:**
   ```bash
   axon-ai start
   ```

3. **Add tracing to your LangChain agents:**
   ```javascript
   import { createTracer } from '@axon-ai/langchain-tracer';
   
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

### `axon-ai init`

Initialize AXON in your current project.

```bash
axon-ai init [options]
```

**Options:**
- `--project <name>` - Project name (default: "default")
- `--auto-start` - Automatically start dashboard after initialization

**Example:**
```bash
axon-ai init --project my-ai-app --auto-start
```

### `axon-ai start`

Start the AXON dashboard and enable tracing.

```bash
axon-ai start [options]
```

**Options:**
- `-p, --port <port>` - Backend server port (default: 3000)
- `-d, --dashboard-port <port>` - Dashboard port (default: 5173)
- `--no-open` - Don't automatically open dashboard in browser
- `--project <name>` - Project name for organizing traces

**Example:**
```bash
axon-ai start --port 3001 --dashboard-port 5174
```

### `agent-trace status`

Check the status of AXON services.

```bash
axon-ai status
```

Shows:
- Project information
- Backend server status
- Dashboard status
- Quick action suggestions

### `axon-ai stop`

Stop all AXON services.

```bash
axon-ai stop
```

### `axon-ai version`

Show version information.

```bash
axon-ai version
```

## Integration with LangChain

### Basic Integration

```javascript
import { createTracer } from '@axon-ai/langchain-tracer';
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

After running `axon-ai init`, a `.axon-ai/config.json` file is created:

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
axon-ai start --port 3001 --dashboard-port 5174
```

### Services Not Starting

1. Check if ports are available:
   ```bash
   axon-ai status
   ```

2. Stop all services and restart:
   ```bash
   axon-ai stop
   axon-ai start
   ```

3. Check logs in the terminal where you started the services

### Dashboard Not Opening

If the dashboard doesn't open automatically:

1. Check the status: `axon-ai status`
2. Manually open: `http://localhost:5173` (or your configured port)
3. Make sure the backend is running on the correct port

## Development

### Building from Source

```bash
git clone https://github.com/yourusername/langchain-tracer/Axon.git
cd axon-ai
npm install
npm run build:cli
```

### Running in Development

```bash
cd packages/cli
npm run dev
```

## License

MIT License - see [LICENSE](LICENSE) for details.

