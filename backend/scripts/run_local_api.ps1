# Run from repo root: ``docker compose up`` (see README). This script is for
# **local Uvicorn** against MySQL you started yourself (e.g. Compose ``mysql``
# only, or a local install): it runs migrations then the API (single worker).
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root
python -m alembic upgrade head
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
