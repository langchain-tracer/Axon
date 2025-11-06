# Changelog

All notable changes to the AXON Agent Trace Visualizer project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.2] - 2025-11-06

### 🐛 Fixed

#### Backend
- **Port Binding:** Changed default host from `0.0.0.0` to `127.0.0.1` to prevent EPERM errors on macOS
- **Environment Variables:** Added `HOST` environment variable support for flexible configuration
- Server now respects both `PORT` and `HOST` environment variables

#### Dashboard
- **React Compatibility:** Updated React and React-DOM to version 18.3.1 for better ESM support
- **Import Syntax:** Fixed `react-dom/client` import to use named export `createRoot` instead of default export
- **Dagre Import:** Changed to namespace import (`import * as dagre`) for ESM compatibility
- **Vite Configuration:**
  - Added `optimizeDeps` with explicit dependency list
  - Set `host` to `127.0.0.1` for consistency
  - Updated proxy targets to use `127.0.0.1`
  - Added `esbuildOptions` with `target: 'esnext'`
  - Set build target to `esnext`

#### CLI
- **Command Aliases:** Added `axon` and `axon-ai` as aliases to `agent-trace` command
- Improved command discoverability

### 📝 Documentation
- Added comprehensive `DOCKER_SETUP.md` with full Docker documentation
- Added `DOCKER_QUICKSTART.md` for 2-minute setup guide
- Added `DOCKER_IMPLEMENTATION_SUMMARY.md` with implementation details
- Added `PUBLISHING_GUIDE.md` with step-by-step publishing instructions
- Updated main `README.md` with Docker setup information
- Created `DASHBOARD_FIXES_APPLIED.md` documenting all fixes

### 🐳 Added
- Complete Docker setup with production and development configurations
- `Dockerfile` for backend (production and dev)
- `Dockerfile` for dashboard (multi-stage build with Nginx)
- `docker-compose.yml` for production deployment
- `docker-compose.dev.yml` for development with hot reload
- `Makefile` with 20+ convenience commands
- `nginx.conf` for dashboard reverse proxy
- `.dockerignore` files for optimized builds
- `env.example` with environment variable templates

### 🎯 Impact
- **Setup Time:** Reduced from 1-2 hours to 2 minutes with Docker
- **Cross-Platform:** Works consistently on Mac, Linux, and Windows
- **No Manual Fixes:** All ESM and port issues resolved out of the box
- **Developer Experience:** Significantly improved with one-command setup

---

## [1.0.1] - 2025-11-05

### 🐛 Known Issues
- Port binding to `0.0.0.0` causes EPERM errors on macOS
- React 18.2.0 has ESM compatibility issues with Vite 5
- Dashboard requires manual dependency installation
- Missing Vite proxy configuration
- CLI commands not discoverable

### 📝 Notes
- Initial npm release
- Users reported 15+ manual fixes required for installation
- See `AXON_FEEDBACK_AND_IMPROVEMENTS.md` for detailed issue list

---

## [1.0.0] - 2025-11-04

### 🎉 Initial Release

#### ✨ Features
- Real-time trace visualization for AI agents
- Support for LangChain and OpenAI agents
- Interactive node graph with React Flow
- Cost tracking and analytics
- Anomaly detection
- WebSocket-based live updates
- SQLite database for trace storage
- REST API for trace queries

#### 📦 Packages
- `agent-trace-backend` - Backend server with SQLite
- `dashboard` - React dashboard for visualization
- `@agent-trace/cli` - Command-line interface
- `@agent-trace/langchain-tracer` - LangChain callback handler
- `@agent-trace/openai-tracer` - OpenAI function calling tracer

#### 🎯 Use Cases
- Debug LangChain agent workflows
- Monitor OpenAI function calling
- Track LLM costs and token usage
- Visualize agent decision-making
- Identify performance bottlenecks

---

## [Unreleased]

### 🚀 Planned Features
- Kubernetes deployment manifests
- Prometheus metrics export
- Grafana dashboards
- Multi-user authentication
- Trace comparison tool
- Export to various formats (JSON, CSV, PDF)
- Integration with LangSmith
- Support for more agent frameworks

### 🔧 Planned Improvements
- Automated integration tests
- CI/CD pipeline with GitHub Actions
- Pre-built Docker images on Docker Hub
- Performance optimizations for large traces
- Better error messages
- Improved documentation with video tutorials

---

## Version Comparison

| Version | Setup Time | Manual Fixes | Cross-Platform | Docker Support |
|---------|------------|--------------|----------------|----------------|
| 1.0.0   | N/A        | N/A          | ❌             | ❌             |
| 1.0.1   | 1-2 hours  | 15+          | ⚠️             | ❌             |
| 1.0.2   | 2 minutes  | 0            | ✅             | ✅             |

---

## Migration Guide

### From 1.0.1 to 1.0.2

#### For npm Users

```bash
# Update packages
npm update agent-trace-backend@1.0.2
npm update dashboard@1.0.2
npm update @agent-trace/cli@1.0.2
npm update @agent-trace/langchain-tracer@1.0.2
npm update @agent-trace/openai-tracer@1.0.2

# No code changes required!
# All fixes are backward compatible
```

#### For Docker Users (New!)

```bash
# Clone or pull latest
git pull origin main

# Start with Docker
make start

# Or manually
docker-compose up -d
```

#### Breaking Changes

**None!** This is a patch release with only bug fixes.

---

## Contributors

- **AXON Team** - Initial development
- **Community** - Bug reports and feedback

---

## Links

- [GitHub Repository](https://github.com/yourusername/axon)
- [npm Packages](https://www.npmjs.com/search?q=%40agent-trace)
- [Documentation](https://github.com/yourusername/axon/tree/main/docs)
- [Issue Tracker](https://github.com/yourusername/axon/issues)

---

**Thank you for using AXON!** 🚀

