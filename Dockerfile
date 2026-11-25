# Stage 1: Build static React + Tailwind frontend natively on the builder arch
FROM --platform=$BUILDPLATFORM node:20-alpine AS frontend-builder
WORKDIR /build/frontend

COPY frontend/package*.json ./
RUN npm install --no-audit --no-fund

COPY frontend/ ./
RUN npm run build

# Stage 2: Lightweight Python FastAPI + SQLite runtime (multi-arch: amd64 / arm64)
FROM python:3.12-slim
WORKDIR /app

LABEL org.opencontainers.image.source="https://github.com/marijnio/deebot-buddy" \
    org.opencontainers.image.title="Deebot Buddy" \
    org.opencontainers.image.description="Self-hosted maintenance tracker for ECOVACS DEEBOT T90 PRO OMNI"

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DEEBOT_DB_PATH=/app/data/deebot.db \
    STATIC_DIR=/app/frontend/dist \
    MASCOTS_DIR=/app/mascots

COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

COPY backend/ ./backend/
COPY mascots/ ./mascots/
COPY --from=frontend-builder /build/frontend/dist ./frontend/dist

RUN mkdir -p /app/data

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8080/api/health', timeout=3)" || exit 1

CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8080"]
