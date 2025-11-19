# Axon: Real-time LangChain Agent Monitoring

Axon is a powerful command-line interface (CLI) tool designed to provide real-time monitoring and visualization for your LangChain agents. With Axon, you can effortlessly track the execution flow, inputs, outputs, and intermediate steps of your AI agents directly within a user-friendly dashboard, making debugging and optimization a breeze.

## ✨ Features

- **Real-time Tracing**: Monitor LangChain agent executions as they happen.
- **Intuitive Dashboard**: Visualize agent traces, chain calls, and tool usage in a dedicated web interface.
- **Easy Integration**: Seamlessly integrate with existing LangChain models, agents, and chains with minimal code changes.
- **Project Organization**: Manage and view traces for multiple AI projects.
- **Local Development Focus**: Designed for developers to quickly set up and debug their LangChain applications locally.

## 🚀 Installation

You can install the Axon CLI globally or locally within your project.

### Global Installation (Recommended)

For easy access from anywhere on your system:

```bash
npm install -g @axon-ai/cli
```

### Local Installation

If you prefer to manage Axon as a project dependency:

```bash
npm install @axon-ai/cli
# Then use npx to run commands
npx axon-ai --help
```

## ⚡ Quick Start

Get your LangChain project traced with Axon in just a few steps:

1.  **Initialize Axon in your project directory:**
    This creates a `.axon-ai/config.json` file to manage your project settings.
    ```bash
    axon-ai init --project my-ai-project
    ```

2.  **Start the Axon dashboard and backend services:**
    This will launch the monitoring dashboard in your browser.
    ```bash
    axon-ai start
    ```

3.  **Integrate the tracer into your LangChain application:**
    Add the `createTracer` callback to your LangChain models, agents, or chains.

    ```javascript
    import { createTracer } from '@axon-ai/langchain-tracer';
    import { ChatOpenAI } from '@langchain/openai';
    
    // Create the Axon tracer instance
    const tracer = createTracer({
      projectName: 'my-ai-project' // Must match the project name used in `axon-ai init`
    });
    
    // Add the tracer to your model's callbacks
    const model = new ChatOpenAI({
      modelName: 'gpt-3.5-turbo',
      callbacks: [tracer] // <--- Add this line
    });
    
    // Example: Use the model
    const response = await model.invoke("Hello, how are you?");
    console.log(response);
    ```

4.  **Run your LangChain application** and watch the traces appear in the Axon dashboard in real-time!

## 📚 Commands

The Axon CLI provides several commands to manage your monitoring environment:

-   `axon-ai init [options]`: Initializes Axon in your project, creating a configuration file.
    -   `--project <name>`: Specify a project name (default: "default").
    -   `--auto-start`: Automatically start the dashboard after initialization.
-   `axon-ai start [options]`: Starts the Axon backend server and dashboard.
    -   `-p, --port <port>`: Backend server port (default: 3000).
    -   `-d, --dashboard-port <port>`: Dashboard port (default: 5173).
    -   `--no-open`: Prevent automatic opening of the dashboard in the browser.
    -   `--project <name>`: Specify the project to trace.
-   `axon-ai status`: Checks the status of Axon services (project info, server, dashboard).
-   `axon-ai stop`: Stops all running Axon services.
-   `axon-ai version`: Displays the installed Axon CLI version.

## 🔗 LangChain Integration Examples

### Basic Model Integration

```javascript
import { createTracer } from '@axon-ai/langchain-tracer';
import { ChatOpenAI } from '@langchain/openai';

const tracer = createTracer({ projectName: 'my-project' });
const model = new ChatOpenAI({
  modelName: 'gpt-3.5-turbo',
  callbacks: [tracer]
});
```

### Agent Integration

```javascript
import { AgentExecutor, createOpenAIFunctionsAgent } from 'langchain/agents';
// ... other imports for tools and prompt

const agent = await createOpenAIFunctionsAgent({ /* ... */ });
const agentExecutor = new AgentExecutor({
  agent,
  tools: [searchTool, calculatorTool],
  callbacks: [tracer] // Add tracer to the executor
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

## 🛠️ Troubleshooting

Refer to the Troubleshooting section in the CLI documentation for common issues like "Port Already in Use" or services not starting.

## 🤝 Contributing

We welcome contributions! If you're interested in developing Axon:

```bash
git clone https://github.com/yourusername/langchain-tracer/Axon.git
cd axon-ai
npm install
npm run build:cli
```

For running in development:

```bash
cd packages/cli
npm run dev
```

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.
