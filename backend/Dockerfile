# Base stage - shared setup
FROM node:20-alpine AS base

WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy root package files for npm workspaces
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/
RUN npm ci --workspace=backend && npm cache clean --force

# Copy source code and assets
COPY backend/tsconfig.json ./
COPY backend/src ./src
COPY backend/pkg ./pkg
COPY backend/dim ./dim
COPY backend/networks ./networks
COPY backend/data ./data

# Change ownership to nodejs user
RUN chown -R nodejs:nodejs /app

# Dev stage - hot reloading with tsx watch
FROM base AS dev

# Ensure tmp directory exists and is writable for tsx
RUN mkdir -p /tmp/tsx-1001 && chown -R nodejs:nodejs /tmp/tsx-1001

USER nodejs

EXPOSE 3001

ENV NODE_ENV=development
ENV PORT=3001

# Use tsx watch for hot reloading
CMD ["npx", "tsx", "watch", "src/index.ts"]

# Production stage
FROM base AS runner

USER nodejs

EXPOSE 3001

ENV NODE_ENV=production
ENV PORT=3001

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

CMD ["npx", "tsx", "src/index.ts"]
