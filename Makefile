.PHONY: help build start stop restart logs clean status dev prod test

# Default target
help:
	@echo "╔════════════════════════════════════════════════════════════════╗"
	@echo "║              AXON - Agent Trace Visualizer                     ║"
	@echo "║                    Docker Commands                             ║"
	@echo "╚════════════════════════════════════════════════════════════════╝"
	@echo ""
	@echo "🚀 Getting Started:"
	@echo "  make start       - Start Axon in production mode"
	@echo "  make dev         - Start Axon in development mode (hot reload)"
	@echo "  make stop        - Stop all services"
	@echo ""
	@echo "🔧 Development:"
	@echo "  make logs        - View logs (Ctrl+C to exit)"
	@echo "  make restart     - Restart all services"
	@echo "  make build       - Rebuild all images"
	@echo "  make status      - Show running containers"
	@echo ""
	@echo "🧪 Testing:"
	@echo "  make test        - Run test suite against Docker stack"
	@echo "  make shell-be    - Open shell in backend container"
	@echo "  make shell-fe    - Open shell in dashboard container"
	@echo ""
	@echo "🧹 Cleanup:"
	@echo "  make clean       - Stop and remove all containers/volumes"
	@echo "  make clean-all   - Complete cleanup (images, cache, everything)"
	@echo ""
	@echo "📊 Access Points:"
	@echo "  Dashboard:  http://localhost:8080 (prod) or http://localhost:5173 (dev)"
	@echo "  Backend:    http://localhost:3000"
	@echo "  Health:     http://localhost:3000/health"
	@echo ""

# Production mode - optimized builds
start: prod
prod:
	@echo "🚀 Starting Axon in PRODUCTION mode..."
	@docker-compose up -d
	@echo ""
	@echo "✅ Axon is running!"
	@echo "   Dashboard: http://localhost:8080"
	@echo "   Backend:   http://localhost:3000"
	@echo ""
	@echo "💡 Tips:"
	@echo "   - Run 'make logs' to view logs"
	@echo "   - Run 'make stop' to stop services"
	@echo ""

# Development mode - hot reload
dev:
	@echo "🔧 Starting Axon in DEVELOPMENT mode (hot reload)..."
	@docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d
	@echo ""
	@echo "✅ Axon is running in DEV mode!"
	@echo "   Dashboard: http://localhost:5173 (Vite dev server)"
	@echo "   Backend:   http://localhost:3000"
	@echo ""
	@echo "💡 Source code changes will auto-reload!"
	@echo ""

# Build images
build:
	@echo "🔨 Building Docker images..."
	@docker-compose build --no-cache
	@echo "✅ Build complete!"

# Stop services
stop:
	@echo "🛑 Stopping Axon services..."
	@docker-compose -f docker-compose.yml -f docker-compose.dev.yml down
	@echo "✅ Services stopped!"

# Restart services
restart:
	@echo "🔄 Restarting Axon services..."
	@docker-compose restart
	@echo "✅ Services restarted!"

# View logs
logs:
	@echo "📋 Showing logs (Ctrl+C to exit)..."
	@docker-compose logs -f

# View backend logs only
logs-be:
	@docker-compose logs -f backend

# View dashboard logs only
logs-fe:
	@docker-compose logs -f dashboard

# Show status
status:
	@echo "📊 Container Status:"
	@docker-compose ps
	@echo ""
	@echo "💾 Volume Status:"
	@docker volume ls | grep axon

# Clean - remove containers and volumes
clean:
	@echo "🧹 Cleaning up Axon..."
	@docker-compose -f docker-compose.yml -f docker-compose.dev.yml down -v
	@echo "✅ Cleanup complete!"

# Complete cleanup
clean-all: clean
	@echo "🧹 Performing COMPLETE cleanup..."
	@docker system prune -af --volumes
	@echo "✅ Complete cleanup done!"

# Shell access to backend
shell-be:
	@docker-compose exec backend sh

# Shell access to dashboard (dev mode only)
shell-fe:
	@docker-compose exec dashboard sh

# Run tests
test:
	@echo "🧪 Running tests against Docker stack..."
	@echo "Starting services..."
	@docker-compose up -d
	@echo "Waiting for services to be healthy..."
	@sleep 10
	@echo "Running backend tests..."
	@curl -f http://localhost:3000/health || (echo "❌ Backend health check failed" && exit 1)
	@echo "✅ Backend is healthy!"
	@echo "Running dashboard tests..."
	@curl -f http://localhost:8080/health || (echo "❌ Dashboard health check failed" && exit 1)
	@echo "✅ Dashboard is healthy!"
	@echo "Checking API..."
	@curl -f http://localhost:8080/api/traces > /dev/null || (echo "❌ API check failed" && exit 1)
	@echo "✅ API is working!"
	@echo ""
	@echo "✅ All tests passed!"

# Quick health check
health:
	@echo "🏥 Checking service health..."
	@echo ""
	@echo -n "Backend:   "
	@curl -sf http://localhost:3000/health && echo "✅ Healthy" || echo "❌ Unhealthy"
	@echo -n "Dashboard: "
	@curl -sf http://localhost:8080/health && echo "✅ Healthy" || echo "❌ Unhealthy"
	@echo ""

# Database backup
backup:
	@echo "💾 Backing up database..."
	@mkdir -p backups
	@docker cp axon-backend:/data/traces.db backups/traces-$(shell date +%Y%m%d-%H%M%S).db
	@echo "✅ Backup complete! Check ./backups/"

# Database restore (usage: make restore FILE=backups/traces-20231106.db)
restore:
	@echo "📥 Restoring database from $(FILE)..."
	@docker cp $(FILE) axon-backend:/data/traces.db
	@docker-compose restart backend
	@echo "✅ Database restored!"

# Monitor resources
monitor:
	@watch -n 2 "docker stats --no-stream axon-backend axon-dashboard"

