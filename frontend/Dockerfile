# ==============================================================================
# Multi-Stage Production Dockerfile for React (Vite + Tailwind) Frontend
# Stage 1: Build static assets using Node.js 20-alpine
# Stage 2: Serve compiled assets using lightweight Nginx 1.25-alpine
# ==============================================================================

# --- Stage 1: Builder ---
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies (utilizes Docker layer caching)
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install

# Copy application source files
COPY frontend/ ./

# Build production distribution bundle
RUN npm run build

# --- Stage 2: Production Nginx Runner ---
FROM nginx:1.25-alpine AS runner

# Remove default Nginx welcome page and default configuration
RUN rm -rf /usr/share/nginx/html/* /etc/nginx/conf.d/default.conf

# Copy reverse proxy & SPA configuration
COPY nginx/nginx.conf /etc/nginx/nginx.conf

# Copy compiled production artifacts from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose HTTP port
EXPOSE 80

# Healthcheck to verify Nginx is actively responding
HEALTHCHECK --interval=20s --timeout=5s --retries=3 \
    CMD wget -q --spider http://localhost/ || exit 1

# Start Nginx in foreground
CMD ["nginx", "-g", "daemon off;"]
