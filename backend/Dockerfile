FROM python:3.12-slim-bookworm

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Run as a non-root user — standard container hardening
RUN useradd --system --create-home --uid 1001 --shell /sbin/nologin appuser \
    && mkdir -p /data/uploads /data/artifacts /data/audit \
    && chown -R appuser /data

COPY alembic.ini .
COPY alembic ./alembic
COPY app ./app

USER appuser

ENV PYTHONUNBUFFERED=1

EXPOSE 8000

CMD ["sh", "-c", "until alembic upgrade head; do echo 'DB not ready, retrying in 3s...'; sleep 3; done && exec uvicorn app.main:app --host 0.0.0.0 --port 8000"]
