# Alembic migrations

Schema changes are **linear** revisions under `versions/`. Apply with:

```bash
cd backend
alembic upgrade head
```

Docker Compose and the local helpers [`run_local_api.ps1`](../scripts/run_local_api.ps1) / [`run_local_api.sh`](../scripts/run_local_api.sh) run this before Uvicorn.

## Rules

- **Do not edit** a revision that may already be on a shared or production database. Add a **new** revision instead.
- For one-off recovery when the physical schema lags `alembic_version`, use an **idempotent** migration (inspect tables, add missing columns/indexes only) — see `005_ensure_core_columns.py`.
- **MySQL:** `004` widens `alembic_version.version_num` so long revision ids are safe on MySQL 8.
- **SQLite / CI:** migrations must remain runnable on SQLite; use `batch_alter_table` where SQLite forbids standalone constraint DDL (see `002` for `datasets` unique + index).
- **ORM:** keep [`app/domain/models.py`](../app/domain/models.py) aligned with the latest migration; tests run `alembic upgrade head` on SQLite (see `tests/conftest.py`).
