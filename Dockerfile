# ==============================================================================
# Multi-Stage Production Dockerfile for Company Brain OS
# Stage 1: Build React + Vite Single Page Application
# Stage 2: Production Python 3.11 Runtime with FastAPI & Static Frontend Hosting
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Frontend Builder
# ------------------------------------------------------------------------------
FROM node:20-alpine AS frontend-builder
WORKDIR /frontend

# Install dependencies
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --legacy-peer-deps

# Copy frontend source and build static artifacts
COPY frontend/ ./
RUN npm run build

# ------------------------------------------------------------------------------
# Stage 2: Production Python Backend Runtime
# ------------------------------------------------------------------------------
FROM python:3.11-slim AS runner

# System environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app/backend \
    PORT=8000 \
    HOST=0.0.0.0 \
    ENVIRONMENT=production

# Install system dependencies (for psycopg2 postgres driver, build tools, curl)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev \
    gcc \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python requirements
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy Backend application code
COPY backend/ /app/backend/

# Copy Seed Data (if any fixtures needed)
COPY data/ /app/data/

# Copy built frontend static bundle from Stage 1 into /app/frontend/dist
COPY --from=frontend-builder /frontend/dist /app/frontend/dist

# Security: Create non-privileged user and transfer ownership
RUN useradd -m -u 1000 appuser && \
    chown -R appuser:appuser /app

USER appuser

# Expose default application port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=20s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:${PORT:-8000}/api/v1/health || exit 1

# Start FastAPI application with dynamic PORT support
CMD ["sh", "-c", "python -m uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
