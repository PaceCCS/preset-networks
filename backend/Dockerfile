# Single stage - tsx runs TypeScript directly
FROM node:20-alpine

WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy package files and install all dependencies (tsx is needed at runtime)
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

# Switch to non-root user
USER nodejs

# Expose the default port
EXPOSE 3001

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

# Start the application with tsx
CMD ["npx", "tsx", "src/index.ts"]
