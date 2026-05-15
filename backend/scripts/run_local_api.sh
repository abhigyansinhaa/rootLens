#!/usr/bin/env bash
# Run from repo root: ``docker compose up`` (see README). This script is for
# **local Uvicorn** against MySQL you started yourself: it runs migrations then
# the API (single worker).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
python -m alembic upgrade head
exec python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
