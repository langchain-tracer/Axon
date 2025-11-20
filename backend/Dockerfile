FROM node:20-alpine

# Install build dependencies for native modules (better-sqlite3)
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Expose port
EXPOSE 3000

# Environment variables with defaults
ENV PORT=3000
ENV HOST=0.0.0.0
ENV DATABASE_PATH=/data/traces.db
ENV NODE_ENV=production

# Create data directory for SQLite
RUN mkdir -p /data /app/logs

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})" || exit 1

# Start server
CMD ["node", "dist/server.js"]

