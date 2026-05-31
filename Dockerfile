# NADC Helpdesk - Production Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies for Prisma and build tools
RUN apk add --no-cache openssl python3 make g++

# Copy all package files first
COPY package*.json ./
COPY server/package*.json ./server/
COPY client/package*.json ./client/

# Install ALL dependencies (need devDeps for building)
WORKDIR /app/server
RUN npm ci

WORKDIR /app/client
RUN npm ci

# Copy source code
WORKDIR /app
COPY server/ ./server/
COPY client/ ./client/

# Build client
WORKDIR /app/client
RUN npm run build

# Generate Prisma client
WORKDIR /app/server
RUN npx prisma generate

# --- Production image ---
FROM node:20-alpine

WORKDIR /app/server

# Install runtime dependencies only
RUN apk add --no-cache openssl

# Copy server with node_modules
COPY --from=builder /app/server ./

# Copy built client
COPY --from=builder /app/client/dist ./public

# Create uploads directory
RUN mkdir -p uploads

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/health || exit 1

# Start server
CMD ["node", "index.js"]
