# Axon Backend

[![npm version](https://img.shields.io/npm/v/@axon-ai/backend.svg)](https://www.npmjs.com/package/@axon-ai/backend)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

The `@axon-ai/backend` package serves as the core data processing and storage component for the Axon developer tool. It receives real-time tracing data from your LangChain applications (via `@axon-ai/langchain-tracer`), stores it in a local SQLite database, and serves this data to the `@axon-ai/dashboard` for visualization.

This backend is designed to run locally alongside your development environment, providing a private and efficient way to monitor and debug your AI agents and chains without sending sensitive data to external services.

## ✨ Features

-   **Real-time Data Ingestion**: Receives trace events from LangChain applications instantly.
-   **Local SQLite Storage**: Persists tracing data locally for historical analysis and quick retrieval.
-   **WebSocket API**: Communicates with the Axon Dashboard via WebSockets for live updates.
-   **REST API**: Provides endpoints for the dashboard to fetch historical trace data.
-   **Seamless CLI Integration**: Automatically managed by the `@axon-ai/cli` for an effortless developer experience.

## 🚀 Getting Started (via Axon CLI)

The Axon Backend is an integral part of the Axon developer tool and is typically managed by the `@axon-ai/cli`. You usually won't need to interact with this package directly.

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
This command sets up the necessary configuration files and automatically initializes the database for the backend.

### 3. Start the Axon Services (Backend & Dashboard)

From your project directory, start both the Axon backend and dashboard:

```bash
axon-ai start
```

This command will launch the backend server (usually on `http://localhost:3000`) and the dashboard, connecting them automatically.

## 🛠️ Direct Usage (for Development/Debugging)

If you need to run the backend independently for development or debugging purposes:

1.  **Clone the Axon repository:**
    ```bash
    git clone https://github.com/your-axon-repo/Axon.git
    cd Axon/backend
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Initialize the database schema:**
    ```bash
    npm run db:init
    ```

4.  **Start the backend in development mode (with auto-reloading):**
    ```bash
    npm run dev
    ```

5.  **Start the backend in production mode:**
    ```bash
    npm run build
    npm start
    ```

## ⚙️ Configuration

The backend's port and host can be configured via the `.axon-ai/config.json` file in your project root (created by `axon-ai init`) or by passing options to the `axon-ai start` command.

Example `config.json` snippet:
```json
{
  "backend": {
    "port": 3000,
    "host": "localhost"
  }
}
```

## 🗄️ Database

The backend uses SQLite for local data persistence.

-   **Schema Initialization**: The `npm run db:init` script creates the necessary tables. This is automatically handled by `axon-ai init`.
-   **Data Storage**: All trace events, including LLM calls, tool usage, and chain executions, are stored in this local database.

## 🐛 Troubleshooting

If you encounter issues with the backend:

-   **Check CLI Status**: Use `axon-ai status` to see if the backend server is running.
-   **Port Conflicts**: If the backend fails to start, another process might be using port `3000`. You can specify a different port using `axon-ai start -p <new-port>`.
-   **Logs**: Check the console output where the backend is running for any error messages.

## 🤝 Contributing

Contributions are welcome! If you're interested in improving the Axon Backend, please see the main Axon repository for contribution guidelines.

## 📄 License

This project is licensed under the MIT License.
