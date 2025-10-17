# Agent Trace Client

> **LangChain callback handler for tracing AI agent execution**

Automatically trace your LangChain agents with zero code changes. Monitor LLM calls, tool usage, and chain execution in real-time with the Agent Trace dashboard.

## 📦 Installation

```bash
npm install agent-trace-client
# or
yarn add agent-trace-client
# or
pnpm add agent-trace-client
```

## 🚀 Quick Start

### 1. Start Agent Trace Backend

Make sure the Agent Trace backend is running:

```bash
# In your agent-trace repo
cd backend
npm run dev
```

Backend should be running at `http://localhost:3000`

### 2. Use with LangChain

```typescript
import { ChatOpenAI } from "@langchain/openai";
import { TracingCallbackHandler } from "agent-trace-client";

// Create tracer
const tracer = new TracingCallbackHandler({
  endpoint: "http://localhost:3000",
  projectName: "my-agent",
  debug: true
});

// Create LLM with tracer
const llm = new ChatOpenAI({
  modelName: "gpt-3.5-turbo",
  callbacks: [tracer]
});

// Use it - automatically traced!
const response = await llm.invoke("What is the capital of France?");
console.log(response);

// Check the dashboard to see your trace!
// Open: http://localhost:3001
```

That's it! Your agent is now being traced. 🎉

---

## 📖 Usage Examples

### Simple LLM Call

```typescript
import { ChatOpenAI } from "@langchain/openai";
import { createTracer } from "agent-trace-client";

const tracer = createTracer({
  endpoint: "http://localhost:3000",
  projectName: "simple-example"
});

const llm = new ChatOpenAI({ callbacks: [tracer] });

const result = await llm.invoke("Explain quantum computing");
```

### LLM Chain

```typescript
import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { LLMChain } from "langchain/chains";
import { TracingCallbackHandler } from "agent-trace-client";

const tracer = new TracingCallbackHandler({
  endpoint: "http://localhost:3000",
  projectName: "chain-example"
});

const prompt = PromptTemplate.fromTemplate(
  "You are a helpful assistant. Answer: {question}"
);

const llm = new ChatOpenAI({
  modelName: "gpt-4",
  temperature: 0
});

const chain = new LLMChain({
  llm,
  prompt,
  callbacks: [tracer]
});

const result = await chain.call({
  question: "What is machine learning?"
});

console.log(result.text);
```

### Agent with Tools

```typescript
import { ChatOpenAI } from "@langchain/openai";
import { Calculator } from "langchain/tools/calculator";
import { initializeAgentExecutorWithOptions } from "langchain/agents";
import { createTracer } from "agent-trace-client";

const tracer = createTracer({
  endpoint: "http://localhost:3000",
  projectName: "agent-with-tools"
});

const llm = new ChatOpenAI({ temperature: 0 });

const tools = [new Calculator()];

const executor = await initializeAgentExecutorWithOptions(tools, llm, {
  agentType: "openai-functions",
  verbose: true
});

const result = await executor.call(
  {
    input: "What is 25 * 4 + 10?"
  },
  [tracer] // Pass tracer here
);

console.log(result.output);
// Dashboard shows: LLM call → Calculator tool → LLM call → Response
```

### Sequential Chain

```typescript
import { SequentialChain, LLMChain } from "langchain/chains";
import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { TracingCallbackHandler } from "agent-trace-client";

const tracer = new TracingCallbackHandler({
  endpoint: "http://localhost:3000",
  projectName: "sequential-chain"
});

const llm = new ChatOpenAI({ callbacks: [tracer] });

// First chain: Generate a topic
const topicChain = new LLMChain({
  llm,
  prompt: PromptTemplate.fromTemplate("Generate a {subject} topic:"),
  outputKey: "topic"
});

// Second chain: Write about the topic
const writingChain = new LLMChain({
  llm,
  prompt: PromptTemplate.fromTemplate("Write about {topic}:"),
  outputKey: "essay"
});

// Combine chains
const overallChain = new SequentialChain({
  chains: [topicChain, writingChain],
  inputVariables: ["subject"],
  outputVariables: ["topic", "essay"],
  callbacks: [tracer]
});

const result = await overallChain.call({
  subject: "artificial intelligence"
});

console.log(result.essay);
```

### Custom Metadata & Tags

```typescript
import { createTracer } from "agent-trace-client";

const tracer = createTracer({
  endpoint: "http://localhost:3000",
  projectName: "production-agent",
  metadata: {
    environment: "production",
    version: "1.0.0",
    userId: "user-123"
  }
});

// Use tracer with your chains/agents
// Metadata will be visible in the dashboard
```

### Multiple Tracers (Multiple Projects)

```typescript
import { createTracer } from "agent-trace-client";

// Tracer for customer service
const csTracer = createTracer({
  endpoint: "http://localhost:3000",
  projectName: "customer-service"
});

// Tracer for data analysis
const dataTracer = createTracer({
  endpoint: "http://localhost:3000",
  projectName: "data-analysis"
});

// Use different tracers for different agents
const csAgent = new ChatOpenAI({ callbacks: [csTracer] });
const dataAgent = new ChatOpenAI({ callbacks: [dataTracer] });
```

---

## ⚙️ Configuration

### TraceConfig Options

```typescript
interface TraceConfig {
  endpoint: string; // Backend URL (default: "http://localhost:3000")
  projectName: string; // Project name for grouping (default: "default")
  apiKey?: string; // Optional API key for authentication
  debug?: boolean; // Enable debug logging (default: false)
  metadata?: Record<string, any>; // Custom metadata
}
```

### Example with All Options

```typescript
import { TracingCallbackHandler } from "agent-trace-client";

const tracer = new TracingCallbackHandler({
  endpoint: "https://trace.mycompany.com",
  projectName: "production-chatbot",
  apiKey: process.env.AGENT_TRACE_API_KEY,
  debug: process.env.NODE_ENV === "development",
  metadata: {
    environment: process.env.NODE_ENV,
    version: "2.1.0",
    region: "us-east-1",
    team: "ai-platform"
  }
});
```

---

## 🎯 What Gets Traced?

The tracer automatically captures:

### LLM Calls

- **Model name** (gpt-4, gpt-3.5-turbo, etc.)
- **Prompts** (input to LLM)
- **Responses** (output from LLM)
- **Token usage** (input, output, total)
- **Cost** (automatically calculated)
- **Latency** (time taken)

### Tool Calls

- **Tool name** (Calculator, Search, etc.)
- **Input** (parameters passed to tool)
- **Output** (tool response)
- **Latency** (time taken)

### Chain Execution

- **Chain name** (LLMChain, SequentialChain, etc.)
- **Inputs** (chain parameters)
- **Outputs** (chain results)
- **Latency** (total execution time)
- **Parent-child relationships** (nested chains)

### Errors

- **Error message**
- **Stack trace**
- **Which step failed**

---

## 📊 Viewing Traces

### 1. Open Dashboard

Navigate to: `http://localhost:3001`

### 2. Find Your Trace

- Traces are grouped by `projectName`
- Filter by status: complete, running, error
- Search by trace ID or description

### 3. Inspect Details

Click on a trace to see:

- **Graph view**: Visual DAG of execution
- **Timeline view**: Chronological events
- **Analytics view**: Cost & performance metrics
- **Node details**: Click nodes to see prompts, responses, costs

---

## 🔍 Advanced Usage

### Checking Connection Status

```typescript
const tracer = createTracer({
  endpoint: "http://localhost:3000",
  projectName: "my-agent"
});

// Check if connected
if (tracer.isConnected()) {
  console.log("✅ Connected to Agent Trace");
} else {
  console.log("❌ Not connected - traces will be lost!");
}

// Get trace ID
const traceId = tracer.getTraceId();
console.log(`Trace ID: ${traceId}`);
```

### Manual Cleanup

```typescript
const tracer = createTracer({ projectName: "my-agent" });

// Use tracer...
await llm.invoke("Hello");

// Clean up when done
await tracer.cleanup();
```

### Error Handling

```typescript
const tracer = createTracer({
  endpoint: "http://localhost:3000",
  projectName: "error-handling"
});

try {
  const llm = new ChatOpenAI({ callbacks: [tracer] });
  await llm.invoke("Test query");
} catch (error) {
  console.error("Agent failed:", error);
  // Error is automatically traced!
  // Check dashboard to see error details
}
```

### Using with Streaming

```typescript
import { ChatOpenAI } from "@langchain/openai";
import { createTracer } from "agent-trace-client";

const tracer = createTracer({ projectName: "streaming-example" });

const llm = new ChatOpenAI({
  streaming: true,
  callbacks: [tracer]
});

const stream = await llm.stream("Write a story about AI");

for await (const chunk of stream) {
  process.stdout.write(chunk.content);
}

// Full conversation is traced after streaming completes
```

---

## 🐛 Troubleshooting

### Tracer not sending events

**Problem:** Dashboard shows no traces

**Solutions:**

1. **Check backend is running:**

   ```bash
   curl http://localhost:3000/health
   # Should return: {"status":"ok"}
   ```

2. **Enable debug mode:**

   ```typescript
   const tracer = createTracer({
     endpoint: "http://localhost:3000",
     projectName: "debug-test",
     debug: true // ← Enable this
   });
   ```

   Check console for debug messages:

   ```
   [AgentTrace] Started trace: abc-123-def
   [AgentTrace] Sent event: llm_start
   ```

3. **Check endpoint URL:**

   ```typescript
   // ❌ Wrong - missing protocol
   endpoint: "localhost:3000";

   // ✅ Correct
   endpoint: "http://localhost:3000";
   ```

### Events not showing in dashboard

**Problem:** Backend receives events but dashboard is empty

**Solutions:**

1. **Check backend console** for errors
2. **Check browser console** for connection errors
3. **Verify Socket.IO script** is loaded in dashboard HTML

### High memory usage

**Problem:** Memory grows over time

**Solution:** Clean up tracer after use:

```typescript
// Create tracer per request
app.post("/api/chat", async (req, res) => {
  const tracer = createTracer({ projectName: "api" });

  try {
    const result = await agent.call({}, [tracer]);
    res.json(result);
  } finally {
    await tracer.cleanup(); // ← Important!
  }
});
```

### TypeScript errors

**Problem:** Import errors or type mismatches

**Solution:** Ensure you have the correct types:

```typescript
// ✅ Correct imports
import { TracingCallbackHandler } from "agent-trace-client";
import type { TraceConfig } from "agent-trace-client";

// For convenience function
import { createTracer } from "agent-trace-client";
```

---


### Environment Variables

```bash
# .env file
AGENT_TRACE_ENDPOINT=https://trace.mycompany.com
AGENT_TRACE_API_KEY=your-secret-key
AGENT_TRACE_PROJECT=production-app
```

```typescript
import { createTracer } from "agent-trace-client";

const tracer = createTracer({
  endpoint: process.env.AGENT_TRACE_ENDPOINT!,
  apiKey: process.env.AGENT_TRACE_API_KEY,
  projectName: process.env.AGENT_TRACE_PROJECT!,
  debug: false // Disable in production
});
```

### Conditional Tracing

```typescript
const tracer =
  process.env.ENABLE_TRACING === "true"
    ? createTracer({
        endpoint: process.env.AGENT_TRACE_ENDPOINT!,
        projectName: "production"
      })
    : undefined;

// Only trace if enabled
const llm = new ChatOpenAI({
  callbacks: tracer ? [tracer] : []
});
```

### Rate Limiting

For high-traffic applications:

```typescript
// Only trace 10% of requests
const shouldTrace = Math.random() < 0.1;

const tracer = shouldTrace
  ? createTracer({ projectName: "production" })
  : undefined;

const llm = new ChatOpenAI({
  callbacks: tracer ? [tracer] : []
});
```

---

## 📚 API Reference

### TracingCallbackHandler

Main class for tracing LangChain executions.

#### Constructor

```typescript
new TracingCallbackHandler(config?: Partial<TraceConfig>)
```

#### Methods

```typescript
// Get current trace ID
getTraceId(): string

// Check connection status
isConnected(): boolean

// Clean up resources
cleanup(): Promise<void>
```

### createTracer()

Convenience function to create a tracer.

```typescript
createTracer(config?: Partial<TraceConfig>): TracingCallbackHandler
```

### TraceConfig

Configuration interface:

```typescript
interface TraceConfig {
  endpoint: string;
  projectName: string;
  apiKey?: string;
  debug?: boolean;
  metadata?: Record<string, any>;
}
```

---

## 🤝 Integration with Other Tools

### With Express API

```typescript
import express from "express";
import { createTracer } from "agent-trace-client";

const app = express();

app.post("/api/chat", async (req, res) => {
  const tracer = createTracer({
    endpoint: "http://localhost:3000",
    projectName: "api-server",
    metadata: {
      userId: req.user?.id,
      endpoint: "/api/chat"
    }
  });

  try {
    const agent = createAgent({ callbacks: [tracer] });
    const result = await agent.call({ input: req.body.message });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    await tracer.cleanup();
  }
});
```

### With Next.js API Routes

```typescript
// pages/api/chat.ts
import { NextApiRequest, NextApiResponse } from "next";
import { createTracer } from "agent-trace-client";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const tracer = createTracer({
    endpoint: process.env.AGENT_TRACE_ENDPOINT!,
    projectName: "nextjs-app"
  });

  try {
    const result = await processWithAgent(req.body, tracer);
    res.status(200).json(result);
  } finally {
    await tracer.cleanup();
  }
}
```

---

## 📝 License

MIT License - see [LICENSE](LICENSE) file

---

## 🆘 Support

- **Documentation:** [Full docs](https://github.com/yourusername/agent-trace)
- **Issues:** [GitHub Issues](https://github.com/yourusername/agent-trace/issues)
- **Discord:** [Join community](https://discord.gg/agent-trace)
- **Email:** support@agent-trace.dev

---

## 🎉 What's Next?

1. ✅ **Run your first trace** - Use the quick start example
2. 📊 **Explore the dashboard** - See real-time visualizations
3. 🔍 **Optimize your agent** - Find bottlenecks and reduce costs
4. 🚀 **Deploy to production** - Use environment variables
5. 💬 **Join the community** - Share your experience!

---

**Made with ❤️ for the LangChain community**
