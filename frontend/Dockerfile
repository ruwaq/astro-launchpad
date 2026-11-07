# syntax=docker/dockerfile:1

# Stage 1: Build Frontend Assets
FROM node:22-alpine AS builder

WORKDIR /app

# Copy dependency manifests
COPY package.json package-lock.json ./

# Install dependencies deterministically
RUN npm ci

# Copy application source code
COPY . .

# Run production build and stamp service worker
RUN npm run build

# Stage 2: Minimal Hardened Nginx Runtime
FROM nginx:1.27-alpine AS runner

# Remove default nginx welcome page
RUN rm -rf /usr/share/nginx/html/*

# Copy built static assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy optimized SPA nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Run as unprivileged nginx user for enhanced security
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
