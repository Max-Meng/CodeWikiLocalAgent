# =============================================================================
# CodeWiki Local Agent - Multi-stage Dockerfile
# Supports two modes:
#   1. Static mode (default): Next.js only, serves pre-generated wiki JSON
#   2. Full mode (with backend): Next.js + FastAPI + nginx, enables Ask/CodeMap
# =============================================================================

# --- Stage 1: Node dependencies ---
FROM node:20-alpine AS node_deps
WORKDIR /app
COPY package.json package-lock.json* yarn.lock* ./
RUN if [ -f yarn.lock ]; then yarn install --frozen-lockfile; \
    elif [ -f package-lock.json ]; then npm ci; \
    else npm install; fi

# --- Stage 2: Build Next.js ---
FROM node:20-alpine AS node_builder
WORKDIR /app
COPY --from=node_deps /app/node_modules ./node_modules
COPY package.json next.config.ts tsconfig.json tailwind.config.js postcss.config.mjs ./
COPY src/ ./src/
COPY public/ ./public/
ENV NODE_OPTIONS="--max-old-space-size=4096"
ENV NEXT_TELEMETRY_DISABLED=1
RUN NODE_ENV=production npm run build

# --- Stage 3: Python dependencies (for full mode) ---
FROM python:3.11-slim AS py_deps
WORKDIR /app
COPY pyproject.toml ./
RUN python -m pip install --no-cache-dir pip setuptools wheel && \
    pip install --no-cache-dir $(python -c "
import tomllib, sys
with open('pyproject.toml', 'rb') as f:
    data = tomllib.load(f)
deps = data.get('project', {}).get('dependencies', [])
print(' '.join(deps))
")

# =============================================================================
# --- Stage 4a: Static-only production image (lightweight) ---
# =============================================================================
FROM node:20-alpine AS static
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=node_builder /app/.next/standalone ./
COPY --from=node_builder /app/.next/static ./.next/static
COPY --from=node_builder /app/public ./public

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/ || exit 1

CMD ["node", "server.js"]

# =============================================================================
# --- Stage 4b: Full production image (Next.js + FastAPI + nginx) ---
# =============================================================================
FROM python:3.11-slim AS full
WORKDIR /app

# Install Node.js, nginx
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl gnupg ca-certificates nginx \
    && mkdir -p /etc/apt/keyrings \
    && curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg \
    && echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main" | tee /etc/apt/sources.list.d/nodesource.list \
    && apt-get update && apt-get install -y nodejs \
    && apt-get clean && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /tmp/nginx_client_body /tmp/nginx_proxy /tmp/nginx_fastcgi /tmp/nginx_uwsgi /tmp/nginx_scgi \
    && mkdir -p /var/log/nginx

# Copy Python deps
COPY --from=py_deps /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=py_deps /usr/local/bin /usr/local/bin

# Copy backend
COPY backend/ ./backend/

# Copy Node app
COPY --from=node_builder /app/public ./public
COPY --from=node_builder /app/.next/standalone ./
COPY --from=node_builder /app/.next/static ./.next/static

# Copy nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 3000

# Create startup script
RUN echo '#!/bin/bash\n\
if [ -f backend/.env ]; then set -a; source backend/.env 2>/dev/null || true; set +a; fi\n\
echo "Starting FastAPI backend on port 8001..."\n\
python -m backend.main --port 8001 &\n\
BACKEND_PID=$!\n\
echo "Starting Next.js frontend on port 3001..."\n\
PORT=3001 HOSTNAME=127.0.0.1 node server.js &\n\
NEXTJS_PID=$!\n\
sleep 3\n\
echo "Starting nginx reverse proxy on port 3000..."\n\
nginx -g "daemon off;" &\n\
NGINX_PID=$!\n\
wait -n $BACKEND_PID $NEXTJS_PID $NGINX_PID\n\
exit $?' > /app/start.sh && chmod +x /app/start.sh

ENV NODE_ENV=production
ENV PORT=8001
ENV SERVER_BASE_URL=http://localhost:8001

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:3000/ || exit 1

CMD ["/app/start.sh"]
