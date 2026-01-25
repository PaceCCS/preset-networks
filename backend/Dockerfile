# Base stage - shared setup
FROM node:20-alpine AS base

WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy package files and install dependencies
COPY package.json package-lock.json* ./
RUN npm ci && npm cache clean --force

# Copy source code and assets
COPY tsconfig.json ./
COPY src ./src
COPY pkg ./pkg
COPY dim ./dim
COPY networks ./networks

# Change ownership to nodejs user
RUN chown -R nodejs:nodejs /app

# Dev stage - hot reloading with tsx watch
FROM base AS dev

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
