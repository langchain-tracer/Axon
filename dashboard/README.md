# Axon Dashboard

[![npm version](https://img.shields.io/npm/v/@axon-ai/dashboard.svg)](https://www.npmjs.com/package/@axon-ai/dashboard)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

The `@axon-ai/dashboard` package provides the interactive web-based user interface for the Axon developer tool. It allows you to visualize, monitor, and debug the execution traces of your AI agents, chains, and models in real-time.

This dashboard is typically launched and managed via the `@axon-ai/cli` tool, providing a seamless experience for developers to gain insights into their LangChain applications.

## ✨ Features

- **Real-time Trace Visualization**: See your AI agent's execution flow as it happens.
- **Detailed Node Information**: Inspect inputs, outputs, tokens, costs, and metadata for each LLM, chain, and tool call.
- **Interactive Graph View**: Navigate complex agent workflows with an intuitive, zoomable, and pannable graph.
- **Project Organization**: View traces organized by project, making it easy to manage multiple AI applications.
- **Local Development Focus**: Designed for quick setup and debugging during local development.

## 🚀 Getting Started (via Axon CLI)

The Axon Dashboard is part of the Axon developer tool and is best used in conjunction with the `@axon-ai/cli` and `@axon-ai/langchain-tracer` packages.

### 1. Install the Axon CLI

If you haven't already, install the Axon CLI globally:

```bash
npm install -g @axon-ai/cli
```

### 2. Initialize Your Project

Navigate to your LangChain project directory and initialize Axon:

```bash
axon-ai init --project my-langchain-app
```
This command sets up the necessary configuration files for Axon in your project.

### 3. Start the Axon Services (Backend & Dashboard)

From your project directory, start the Axon backend and dashboard:

```bash
axon-ai start
```

This command will automatically open the Axon Dashboard in your web browser, usually at `http://localhost:5173`. It also starts the necessary backend service (provided by `@axon-ai/backend`) that receives trace data.

### 4. Integrate the Tracer

Ensure you have integrated `@axon-ai/langchain-tracer` into your LangChain application to send data to the Axon backend. Refer to the `@axon-ai/langchain-tracer` README for detailed instructions.

### 5. Run Your Application

Execute your LangChain application, and watch the traces appear live in the Axon Dashboard!

## 📊 Understanding the Dashboard

Once traces start flowing, you'll see a visual representation of your agent's execution.

-   **Chain Nodes (Blue/Purple)**: Represent the start and end of a complete agent or chain run.
-   **LLM Nodes (Blue)**: Show interactions with Large Language Models, including prompts, responses, token usage, and estimated costs.
-   **Tool Nodes (Green)**: Display calls to external tools, their inputs, and their outputs.

Click on any node in the graph to view detailed information in the sidebar, helping you understand each step of your AI's decision-making process.

## 🛠️ Configuration

You can configure the dashboard's port and other settings via the `axon-ai start` command or by editing the `.axon-ai/config.json` file in your project root.

Example:
```bash
axon-ai start --dashboard-port 8000
```

## 🐛 Troubleshooting

If you encounter issues, please refer to the troubleshooting section in the main `@axon-ai/cli` README for common problems like port conflicts or services not starting.

## 🤝 Contributing

Contributions are welcome! If you're interested in improving the Axon Dashboard, please see the main Axon repository for contribution guidelines.

## 📄 License

This project is licensed under the MIT License.
