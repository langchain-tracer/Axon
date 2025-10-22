# OpenAI Function Calling Tracer

A comprehensive tracing solution for OpenAI Function Calling agents, providing detailed monitoring, cost analysis, and performance insights.

## 🚀 Features

- **Function Call Tracking**: Monitor all function calls with detailed parameters and results
- **Tool Selection Analysis**: Track which tools are selected and why
- **Cost Calculation**: Automatic cost calculation based on token usage and model pricing
- **Performance Metrics**: Latency tracking and performance analysis
- **Error Monitoring**: Comprehensive error tracking and debugging
- **Real-time Dashboard**: Live visualization of agent execution
- **Conversation Flow**: Track multi-turn conversations and context

## 📦 Installation

```bash
npm install @agent-trace/openai-tracer openai
```

## 🎯 Quick Start

### Basic Usage

```javascript
import OpenAI from 'openai';
import { createOpenAITracer, TracedOpenAI } from '@agent-trace/openai-tracer';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Create tracer
const tracer = createOpenAITracer({
  projectName: 'my-agent',
  metadata: {
    version: '1.0.0',
    environment: 'production',
  },
});

// Create traced OpenAI client
const tracedOpenAI = new TracedOpenAI(openai, tracer);

// Use the traced client
const response = await tracedOpenAI.createChatCompletion({
  model: 'gpt-4',
  messages: [
    { role: 'user', content: 'What\'s the weather in NYC?' }
  ],
  tools: [/* your tools */],
});
```

### Advanced Configuration

```javascript
const tracer = createOpenAITracer({
  projectName: 'weather-agent',
  endpoint: 'http://localhost:3000', // Custom trace server
  metadata: {
    agentType: 'weather',
    version: '2.1.0',
    environment: 'staging',
    team: 'ai-platform',
  },
  autoConnect: true, // Auto-connect to trace server
});
```

## 🔧 API Reference

### OpenAITracer

#### Constructor Options

```typescript
interface OpenAITraceConfig {
  projectName?: string;        // Project identifier
  endpoint?: string;          // Trace server endpoint
  metadata?: Record<string, any>; // Custom metadata
  autoConnect?: boolean;      // Auto-connect to server
}
```

#### Methods

##### `traceFunctionCallStart(functionName, arguments, model, messages, tools?)`
Track the start of a function call.

##### `traceFunctionCallEnd(eventId, result, cost, latency, tokens?)`
Track the completion of a function call.

##### `traceToolSelection(availableTools, selectedTool, reasoning?, confidence?)`
Track tool selection decisions.

##### `traceConversationTurn(userMessage, assistantResponse, model, tokens?, cost?)`
Track conversation turns.

##### `traceError(error, context, functionName?, arguments?)`
Track errors and exceptions.

### TracedOpenAI

A wrapper around the OpenAI client that automatically traces all interactions.

#### Methods

##### `createChatCompletion(params)`
Enhanced chat completion with automatic tracing.

## 📊 Dashboard Integration

The tracer automatically sends data to the Agent Trace dashboard for visualization:

- **Function Call Flow**: Visual representation of function calls
- **Cost Analysis**: Detailed cost breakdown by function and model
- **Performance Metrics**: Latency and throughput analysis
- **Tool Usage**: Which tools are used most frequently
- **Error Tracking**: Error rates and debugging information

## 🎨 Example Agents

### Weather Agent

```javascript
import { createOpenAITracer, TracedOpenAI } from '@agent-trace/openai-tracer';

const tracer = createOpenAITracer({ projectName: 'weather-agent' });
const tracedOpenAI = new TracedOpenAI(openai, tracer);

const tools = [
  {
    type: 'function',
    function: {
      name: 'getCurrentWeather',
      description: 'Get current weather',
      parameters: {
        type: 'object',
        properties: {
          location: { type: 'string' }
        }
      }
    }
  }
];

const response = await tracedOpenAI.createChatCompletion({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Weather in NYC?' }],
  tools,
});
```

### Stock Analysis Agent

```javascript
const tracer = createOpenAITracer({ projectName: 'stock-agent' });
const tracedOpenAI = new TracedOpenAI(openai, tracer);

const tools = [
  {
    type: 'function',
    function: {
      name: 'getStockPrice',
      description: 'Get stock price',
      parameters: {
        type: 'object',
        properties: {
          symbol: { type: 'string' }
        }
      }
    }
  }
];

const response = await tracedOpenAI.createChatCompletion({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'AAPL stock price?' }],
  tools,
});
```

## 🔍 Event Types

The tracer tracks several types of events:

### Function Call Events
- `function_call_start`: When a function call begins
- `function_call_end`: When a function call completes

### Tool Selection Events
- `tool_selection`: When the model selects a tool

### Conversation Events
- `conversation_turn`: Each user-assistant interaction

### Error Events
- `error`: When errors occur during execution

## 💰 Cost Calculation

Automatic cost calculation based on:

- **Model Pricing**: Current OpenAI pricing for different models
- **Token Usage**: Prompt and completion tokens
- **Function Calls**: Additional costs for function calling

Supported models:
- GPT-4: $0.03/1K prompt, $0.06/1K completion
- GPT-4 Turbo: $0.01/1K prompt, $0.03/1K completion
- GPT-3.5 Turbo: $0.001/1K prompt, $0.002/1K completion

## 🚨 Error Handling

The tracer provides comprehensive error tracking:

```javascript
try {
  const response = await tracedOpenAI.createChatCompletion(params);
} catch (error) {
  // Error is automatically traced
  console.error('API call failed:', error);
}
```

## 🔧 Development

### Building

```bash
npm run build
```

### Development Mode

```bash
npm run dev
```

### Testing

```bash
npm test
```

## 📈 Performance

The tracer is designed for minimal overhead:

- **Async Operations**: Non-blocking event queuing
- **Batch Processing**: Efficient event batching
- **Memory Management**: Automatic cleanup of old events
- **Network Optimization**: Compressed data transmission

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details.

## 🆘 Support

- **Documentation**: [Agent Trace Docs](https://docs.agent-trace.com)
- **Issues**: [GitHub Issues](https://github.com/agent-trace/openai-tracer/issues)
- **Discord**: [Agent Trace Community](https://discord.gg/agent-trace)

## 🔄 Changelog

### v1.0.0
- Initial release
- OpenAI Function Calling support
- Cost calculation
- Performance metrics
- Dashboard integration
