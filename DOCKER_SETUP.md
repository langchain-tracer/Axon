# 🐳 Docker Setup for AXON - Agent Trace Visualizer

## 📋 Table of Contents

- [Quick Start](#-quick-start)
- [Prerequisites](#-prerequisites)
- [Installation](#-installation)
- [Usage](#-usage)
- [Development Mode](#-development-mode)
- [Architecture](#-architecture)
- [Available Commands](#-available-commands)
- [Troubleshooting](#-troubleshooting)
- [Advanced Usage](#-advanced-usage)

---

## 🚀 Quick Start

Get AXON running in **2 minutes**:

```bash
# 1. Clone or navigate to the project
cd agent-trace-visualizer

# 2. Start everything with one command
make start

# 3. Open your browser
# Dashboard: http://localhost:8080
# Backend API: http://localhost:3000
```

That's it! 🎉

---

## 📦 Prerequisites

### Required:
- **Docker Desktop** (v20.10+)
  - [Mac](https://docs.docker.com/desktop/install/mac-install/)
  - [Windows](https://docs.docker.com/desktop/install/windows-install/)
  - [Linux](https://docs.docker.com/desktop/install/linux-install/)
- **Docker Compose** (v2.0+) - Usually included with Docker Desktop

### Verify Installation:

```bash
docker --version          # Should show v20.10 or higher
docker-compose --version  # Should show v2.0 or higher
```

---

## 🛠 Installation

### Method 1: Using Make (Recommended)

```bash
# Start in production mode (optimized)
make start
```

### Method 2: Using Docker Compose Directly

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f
```

---

## 🎯 Usage

### Access Points

Once running, access AXON at:

| Service | URL | Description |
|---------|-----|-------------|
| **Dashboard** | http://localhost:8080 | Main UI for visualizing traces |
| **Backend API** | http://localhost:3000 | REST API endpoint |
| **Health Check** | http://localhost:3000/health | Service health status |

### Running Test Agents

Once AXON is running, you can run test agents from your host machine:

```bash
# In a separate terminal, run LangChain test
cd test-langchain-project
npm install
npm run test

# Or run comprehensive tests
npm run test:comprehensive
```

The test agents will automatically send traces to the Docker backend.

---

## 🔧 Development Mode

For active development with **hot reload**:

```bash
# Start in development mode
make dev

# Dashboard will be at http://localhost:5173 (Vite dev server)
# Backend will be at http://localhost:3000
```

**Development Features:**
- ✅ Hot reload for code changes
- ✅ Source maps for debugging
- ✅ Detailed logging
- ✅ No need to rebuild on changes

### Making Changes

1. **Backend Changes:** Edit `backend/src/**` → Auto-reloads
2. **Dashboard Changes:** Edit `dashboard/src/**` → Hot Module Replacement (HMR)

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Docker Network                        │
│                  (axon-network: 172.20.0.0/16)          │
│                                                          │
│  ┌──────────────┐         ┌──────────────┐             │
│  │  Dashboard   │         │   Backend    │             │
│  │              │         │              │             │
│  │  Nginx:80    │◄────────┤  Node:3000   │             │
│  │  (Production)│  Proxy  │              │             │
│  │     or       │         │  + SQLite    │             │
│  │  Vite:5173   │         │  + Socket.IO │             │
│  │    (Dev)     │         │              │             │
│  └──────────────┘         └──────────────┘             │
│        │                         │                      │
│        │                         │                      │
│  Port 8080/5173            Port 3000                    │
└────────┼───────────────────────┼─────────────────────────┘
         │                        │
         ▼                        ▼
    Your Browser            Test Agents (Host)
```

### Services

#### 1. Backend Container (`axon-backend`)
- **Image:** Node.js 20 Alpine
- **Port:** 3000
- **Volumes:**
  - `axon-data:/data` - SQLite database persistence
  - `axon-logs:/app/logs` - Application logs
- **Health Check:** HTTP GET `/health` every 30s

#### 2. Dashboard Container (`axon-dashboard`)
- **Image:** Nginx Alpine (production) or Node.js 20 (dev)
- **Port:** 80 (mapped to 8080) or 5173 (dev)
- **Features:**
  - Serves React app
  - Proxies `/api` and `/socket.io` to backend
  - Gzip compression
  - SPA routing support

---

## 📝 Available Commands

### Quick Commands (Using Makefile)

```bash
make help        # Show all available commands
make start       # Start in production mode
make dev         # Start in development mode
make stop        # Stop all services
make restart     # Restart all services
make logs        # View all logs
make logs-be     # View backend logs only
make logs-fe     # View dashboard logs only
make status      # Show container status
make build       # Rebuild all images
make clean       # Stop and remove containers/volumes
make clean-all   # Complete cleanup (images, cache, etc.)
make test        # Run health checks
make health      # Quick health check
make backup      # Backup database
make shell-be    # Open shell in backend container
make shell-fe    # Open shell in dashboard container
```

### Docker Compose Commands

```bash
# Production mode
docker-compose up -d                    # Start detached
docker-compose up                       # Start with logs
docker-compose down                     # Stop and remove
docker-compose ps                       # List containers
docker-compose logs -f                  # Follow logs
docker-compose logs backend             # Backend logs only
docker-compose restart backend          # Restart backend

# Development mode
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d
docker-compose -f docker-compose.yml -f docker-compose.dev.yml down

# Building
docker-compose build                    # Build all
docker-compose build --no-cache         # Rebuild from scratch
docker-compose up --build               # Build and start

# Cleanup
docker-compose down -v                  # Remove volumes too
docker system prune -af --volumes       # Deep clean
```

---

## 🐛 Troubleshooting

### Issue: Port Already in Use

**Error:**
```
Error: bind: address already in use
```

**Solution:**
```bash
# Check what's using the port
lsof -ti:3000    # Backend port
lsof -ti:8080    # Dashboard port

# Kill the process
kill $(lsof -ti:3000)

# Or change ports in docker-compose.yml
ports:
  - "3001:3000"  # Use 3001 instead
```

---

### Issue: Services Won't Start

**Check logs:**
```bash
make logs
# or
docker-compose logs
```

**Common causes:**
1. **Docker not running:** Start Docker Desktop
2. **Insufficient resources:** Increase Docker memory (Docker Desktop → Settings → Resources)
3. **Previous containers:** Run `make clean` and retry

---

### Issue: Database Reset Needed

```bash
# Stop services
make stop

# Remove database volume
docker volume rm axon_axon-data

# Restart
make start
```

---

### Issue: Code Changes Not Reflected

**In Development Mode:**
```bash
# Restart dev server
make dev
```

**In Production Mode:**
```bash
# Rebuild and restart
make build
make start
```

---

### Issue: "Unhealthy" Container Status

```bash
# Check health
make health

# View detailed logs
docker inspect axon-backend
docker inspect axon-dashboard

# Restart unhealthy service
docker-compose restart backend
```

---

### Issue: Permission Denied (Mac/Linux)

```bash
# Run with sudo (not recommended)
sudo make start

# Or fix Docker permissions
sudo usermod -aG docker $USER
newgrp docker
```

---

### Issue: Windows Line Endings

If you see `\r` errors on Windows:

```bash
# Convert line endings
git config --global core.autocrlf input
git rm --cached -r .
git reset --hard
```

---

## 🔬 Advanced Usage

### Custom Environment Variables

```bash
# Copy example
cp env.example .env

# Edit .env
nano .env

# Restart with new config
make restart
```

### Database Backup & Restore

```bash
# Backup
make backup
# Creates: backups/traces-YYYYMMDD-HHMMSS.db

# Restore
make restore FILE=backups/traces-20231106-143022.db
```

### Inspect Running Container

```bash
# Open shell in backend
make shell-be

# Inside container
ls /data              # Check database
cat /app/logs/*.log   # View logs
node -v               # Check Node version
exit
```

### Monitor Resources

```bash
# Watch resource usage
docker stats axon-backend axon-dashboard

# Or use make command
make monitor
```

### Custom Network Configuration

Edit `docker-compose.yml`:

```yaml
networks:
  axon-network:
    driver: bridge
    ipam:
      config:
        - subnet: 172.25.0.0/16  # Custom subnet
```

### Volume Management

```bash
# List volumes
docker volume ls | grep axon

# Inspect volume
docker volume inspect axon_axon-data

# Backup volume data
docker run --rm -v axon_axon-data:/data -v $(pwd)/backups:/backup \
  alpine tar czf /backup/data-backup.tar.gz /data

# Restore volume data
docker run --rm -v axon_axon-data:/data -v $(pwd)/backups:/backup \
  alpine sh -c "cd /data && tar xzf /backup/data-backup.tar.gz --strip 1"
```

### Multi-Environment Setup

```yaml
# docker-compose.prod.yml
services:
  backend:
    environment:
      - NODE_ENV=production
      - LOG_LEVEL=error

# docker-compose.staging.yml
services:
  backend:
    environment:
      - NODE_ENV=staging
      - LOG_LEVEL=debug
```

```bash
# Use specific environment
docker-compose -f docker-compose.yml -f docker-compose.staging.yml up
```

---

## 🔐 Security Best Practices

### 1. Don't Commit Secrets

```bash
# Add to .gitignore
echo ".env" >> .gitignore
echo "*.db" >> .gitignore
```

### 2. Use Docker Secrets (Production)

```yaml
# docker-compose.yml
services:
  backend:
    secrets:
      - db_password

secrets:
  db_password:
    file: ./secrets/db_password.txt
```

### 3. Run as Non-Root User

Add to Dockerfile:

```dockerfile
RUN addgroup -g 1001 axon && \
    adduser -D -u 1001 -G axon axon
USER axon
```

### 4. Scan Images for Vulnerabilities

```bash
docker scan axon-backend
docker scan axon-dashboard
```

---

## 📊 Performance Tuning

### Optimize Build Time

```dockerfile
# In Dockerfile - use layer caching
COPY package*.json ./
RUN npm install
COPY . .  # Only copy source after dependencies
```

### Reduce Image Size

```bash
# Check image sizes
docker images | grep axon

# Use alpine base images (already done)
# Remove dev dependencies in production
RUN npm prune --production
```

### Scale Services

```bash
# Run multiple backend instances
docker-compose up -d --scale backend=3
```

---

## 🎓 Learning Resources

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Best Practices Guide](https://docs.docker.com/develop/dev-best-practices/)

---

## 🆘 Getting Help

### Logs

Always start with logs when troubleshooting:

```bash
# All logs
make logs

# Backend only
make logs-be

# Last 100 lines
docker-compose logs --tail=100
```

### Container Status

```bash
# Check if containers are running
make status

# Detailed inspection
docker inspect axon-backend
docker inspect axon-dashboard
```

### Health Checks

```bash
# Quick health check
make health

# Manual check
curl http://localhost:3000/health
curl http://localhost:8080/health
```

---

## ✅ Benefits Over Manual Setup

| Aspect | Manual Setup | Docker Setup |
|--------|--------------|--------------|
| **Setup Time** | 1-2 hours | 2 minutes |
| **Dependencies** | Manual install | Auto-included |
| **Port Conflicts** | Common (EPERM) | Isolated |
| **Cross-Platform** | Platform-specific issues | Works everywhere |
| **Cleanup** | Messy | `make clean` |
| **Reproducibility** | "Works on my machine" | Guaranteed |

---

## 🎉 Success Checklist

After running `make start`, verify:

- [ ] Backend is healthy: http://localhost:3000/health
- [ ] Dashboard loads: http://localhost:8080
- [ ] API works: http://localhost:8080/api/traces
- [ ] No errors in logs: `make logs`
- [ ] Containers running: `make status`

---

## 📝 Notes

- **Data Persistence:** Database is stored in `axon-data` volume and persists across restarts
- **Logs:** Available in `axon-logs` volume and via `make logs`
- **Hot Reload:** Only works in dev mode (`make dev`)
- **Production Ready:** Production mode uses optimized Nginx + built React app

---

**Happy Tracing! 🚀**

For issues or questions, check the [main README](./README.md) or open an issue on GitHub.

