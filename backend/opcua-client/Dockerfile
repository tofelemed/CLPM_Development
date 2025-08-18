FROM node:20-alpine

WORKDIR /app

# Install build dependencies and curl for health checks
RUN apk add --no-cache curl

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install all dependencies (including dev dependencies for build)
RUN npm ci

# Copy source code
COPY src ./src

# Build the application
RUN npm run build

# Remove dev dependencies and clean cache
RUN npm prune --production && npm cache clean --force

# Create non-root user and required directories
RUN addgroup -g 1001 -S opcua && \
    adduser -S opcua -u 1001 && \
    mkdir -p /app/certificates /app/config /app/logs && \
    chown -R opcua:opcua /app

USER opcua

# Health check aligned to API port 4840
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:4840/health || exit 1

EXPOSE 4840 3001

CMD ["node", "dist/index.js"]