# Axon LangChain Tracer

[![npm version](https://img.shields.io/npm/v/@axon-ai/langchain-tracer.svg)](https://www.npmjs.com/package/@axon-ai/langchain-tracer)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

`@axon-ai/langchain-tracer` is a callback handler for LangChain.js that enables real-time monitoring and visualization of your AI agents, chains, and models with the Axon developer tool.

It seamlessly captures execution traces, inputs, outputs, and intermediate steps, sending them to the Axon dashboard for easy debugging and analysis.

## ✨ Features

- **Easy Integration**: Add tracing to any LangChain component with a single callback.
- **Automatic Configuration**: Automatically detects project settings from your Axon configuration.
- **Real-time**: Streams trace data to the Axon dashboard as it happens.
- **Comprehensive**: Captures events from LLMs, chains, and tools.

##  Prerequisites

Before using this tracer, you must have the Axon CLI installed and initialized in your project.

1.  **Install the Axon CLI:**
    ```bash
    npm install -g @axon-ai/cli
    ```

2.  **Initialize Axon in your project:**
    ```bash
    axon-ai init --project my-langchain-app
    ```

3.  **Start the Axon services:**
    ```bash
    axon-ai start
    ```

## 🚀 Installation

Install the tracer package in your LangChain project:

```bash
npm install @axon-ai/langchain-tracer
```

## ⚡ Quick Start

The easiest way to get started is with `createAutoTracer`. It automatically reads your project configuration from the `.axon-ai/config.json` file created during `axon-ai init`.

```javascript
import { ChatOpenAI } from '@langchain/openai';
import { createAutoTracer } from '@axon-ai/langchain-tracer';

// 1. Create a tracer instance
const tracer = createAutoTracer();

// 2. Add the tracer to your model's callbacks
const model = new ChatOpenAI({
  modelName: 'gpt-3.5-turbo',
  callbacks: [tracer] // <-- Add this line
});

// 3. Run your model
await model.invoke("Hello, Axon!");

// Now, check the Axon dashboard to see your trace!
```

## 📚 API and Usage

### `createAutoTracer()`

Creates a tracer that automatically connects to the Axon backend based on the `.axon-ai/config.json` file in your project. This is the recommended method for most use cases.

### `createTracer(options)`

If you need to configure the tracer manually (e.g., when running in an environment where the config file is not accessible), you can use `createTracer`.

```javascript
import { createTracer } from '@axon-ai/langchain-tracer';

const tracer = createTracer({
  projectName: 'my-langchain-app', // Must match the project name in Axon
  endpoint: 'http://localhost:3000' // Optional: Axon backend endpoint
});
```

## Integration Examples

The tracer can be added to the `callbacks` array of any LangChain component that supports it.

### AgentExecutor

To trace an entire agent execution, including tool calls:

```javascript
import { AgentExecutor } from 'langchain/agents';

const agentExecutor = new AgentExecutor({
  agent,
  tools,
  callbacks: [tracer] // Add tracer to the executor
});

await agentExecutor.invoke({
  input: "What is 15 * 23? Then search for information about the result."
});
```

### LLMChain

To trace a specific chain:

```javascript
import { LLMChain } from 'langchain/chains';

const chain = new LLMChain({
  llm: model,
  prompt,
  callbacks: [tracer] // Add tracer to the chain
});

await chain.invoke({ question: "What is the capital of France?" });
```

## 📄 License

This project is licensed under the MIT License.
