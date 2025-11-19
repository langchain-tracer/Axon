# 🚀 AXON Docker - Quick Start Guide

## ⚡ 2-Minute Setup

### Prerequisites
- Docker Desktop installed and running

### Start AXON

```bash
cd agent-trace-visualizer
make start
```

### Access

- **Dashboard:** http://localhost:8080
- **Backend:** http://localhost:3000

---

## 🎯 Common Commands

```bash
make start      # Start AXON
make stop       # Stop AXON
make logs       # View logs
make restart    # Restart services
make clean      # Clean up everything
```

---

## 🔧 Development Mode

For hot reload while coding:

```bash
make dev
```

Dashboard will be at http://localhost:5173 (Vite dev server)

---

## 🧪 Running Tests

```bash
# Start AXON
make start

# In another terminal, run test agents
cd test-langchain-project
npm install
npm run test:comprehensive
```

View the traces at http://localhost:8080

---

## 🐛 Troubleshooting

### Port in use?
```bash
make clean
make start
```

### Need to reset database?
```bash
make stop
docker volume rm axon_axon-data
make start
```

### Check if services are healthy
```bash
make health
```

---

## 📖 Full Documentation

See [DOCKER_SETUP.md](./DOCKER_SETUP.md) for complete documentation.

---

## ✅ Quick Checklist

After `make start`:

1. ✅ Go to http://localhost:8080
2. ✅ Dashboard loads
3. ✅ Run a test agent
4. ✅ See traces appear in real-time

**That's it! You're ready to trace your agents! 🎉**

