# RCA ML Platform (MVP)

Web app for uploading tabular datasets, choosing a target variable, and getting **root-cause-style insights**, **feature importance**, **SHAP explanations**, and **rule-based business recommendations**.

- **Backend:** FastAPI, SQLAlchemy (MySQL), JWT auth, XGBoost, SHAP  
- **Frontend:** React, Vite, TypeScript, Tailwind CSS, TanStack Query, Recharts  

**Architecture & scalability:** [docs/ARCHITECTURE_AND_SCALABILITY.md](docs/ARCHITECTURE_AND_SCALABILITY.md) — full stack, ML pipeline, and future scaling. **PDF:** [docs/ARCHITECTURE_AND_SCALABILITY.pdf](docs/ARCHITECTURE_AND_SCALABILITY.pdf). Regenerate with `python scripts/generate_architecture_pdf.py` (requires `pip install markdown xhtml2pdf`).

## Quick start (Docker)

Copy [`env.example`](env.example) to `.env` in the repo root and set **`SECRET_KEY`** (minimum 32 characters; generate with `python -c "import secrets; print(secrets.token_hex(32))"`).

Optional: set **`MYSQL_PASSWORD`** and **`MYSQL_ROOT_PASSWORD`** in `.env` for non-default database credentials. Compose substitutes them into the MySQL service and into **`DATABASE_URL`** for the backend and worker (defaults match [`env.example`](env.example)).

```bash
docker compose up --build
```

On first boot the backend runs **`alembic upgrade head`** then serves the API. Schema DDL is managed by Alembic (see [`backend/alembic`](backend/alembic)); MySQL only mounts [`backend/sql/mysql_init.sql`](backend/sql/mysql_init.sql) as a no-op bootstrap marker.

- **UI:** http://localhost:8080 (nginx serving the production build; proxies `/api` to the backend)  
- **API:** http://localhost:8000/api/health  
- Data (uploads, artifacts) persist under `./data`; MySQL data persists in Docker volume `mysql_data`.

Additional backend-only variables are documented in [`backend/.env.example`](backend/.env.example).

## Development

- **Backend tests:** `cd backend` then `python -m pytest tests -q` (or `-v` for verbose).
- **Frontend lint:** `cd frontend` then `npm run lint`.
- **New schema changes:** add an Alembic revision under [`backend/alembic/versions`](backend/alembic/versions) and run `alembic upgrade head` locally or rely on the backend container startup (see [`backend/Dockerfile`](backend/Dockerfile)).

## Local development (no Docker)

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate     # macOS/Linux
pip install -r requirements.txt
cp .env.example .env            # then edit SECRET_KEY and DATABASE_URL
alembic upgrade head
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Set **`SECRET_KEY`** and **`DATABASE_URL`** in `backend/.env` (see [backend/.env.example](backend/.env.example)).

Example database URL:

```bash
set DATABASE_URL=mysql+pymysql://rca_user:rca_pass@127.0.0.1:3306/rca_db
```

Then run MySQL separately (or with Docker compose). Uploads and artifacts are stored under `data/`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5000 — the dev server proxies `/api` to the backend.

### Docker Compose (`frontend` service)

The compose **`frontend`** service builds a static bundle plus nginx (production-style). For interactive frontend development use **`npm run dev`** locally instead.

## Usage

1. **Register** a new account (or log in).  
2. **Upload** a CSV or Parquet file.  
3. Open the dataset, **select the target column**, optionally pick a **numeric value column** (revenue / LTV / ARPU-style) for KPIs, optionally a **time column** for walk-forward CV, and run **Root-cause analysis**.  
4. Wait for status **completed** (the results page polls automatically).  
5. Open the **dataset page** for its **business KPIs**: risk concentration (Pareto), counterfactual driver rollups (estimate), segmented exposure, modeled reliability—and commercial overlays when a value column is set. Each dataset has its own KPI dashboard scoped to that dataset's analyses; the home **Dashboard** is a workspace overview that links into each dataset.  

## API overview

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Register `{ email, password }` |
| POST | `/api/auth/login` | Login → JWT |
| GET | `/api/auth/me` | Current user (Bearer token) |
| POST | `/api/datasets` | Multipart upload (`file`, optional `name`) |
| GET | `/api/datasets` | List datasets (`limit`, `offset` query params) |
| GET | `/api/datasets/{id}` | Dataset + schema |
| GET | `/api/datasets/{id}/preview` | Preview rows |
| POST | `/api/datasets/{id}/profile` | `{ "target" }` — suitability checks (no training) |
| DELETE | `/api/datasets/{id}` | Delete dataset + analyses |
| POST | `/api/datasets/{id}/analyses` | `{ target, test_size?, max_rows?, value_column?, datetime_column? }` |
| GET | `/api/datasets/{id}/analyses` | List analyses for one dataset (`limit`, `offset`; compact KPI summary) |
| GET | `/api/analyses` | List analyses across workspace (`limit`, `offset`; compact KPI summary) |
| GET | `/api/analyses/{id}` | Analysis status and results (`report.kpis`, `model_metadata`) |
| GET | `/api/analyses/{id}/artifacts/{filename}` | Authenticated artifact download (`shap_summary.png`, `predictions.parquet`) |

## Project layout

```
backend/app/          # FastAPI app, ML pipeline, jobs
frontend/src/         # React UI
data/                 # uploads + analysis artifacts (gitignored contents)
backend/sql/          # MySQL container bootstrap (DDL via Alembic)
```

## Notes

- **Scaling:** With `REDIS_URL` set (see Docker Compose), analyses run on an **RQ worker**; otherwise they use FastAPI `BackgroundTasks`.  
- **Models:** Sklearn `Pipeline` (imputation, scaling, one-hot) plus routed models: **XGBoost**, **Random Forest**, or **Elastic Net / Logistic Regression** depending on dataset size and task.  
- **Profiling:** `POST /api/datasets/{id}/profile` with `{ "target": "column_name" }` returns suitability checks before training.  
- **Report:** Completed analyses include a structured `report` (dataset health, model choice, CV hints, grouped drivers). Successful runs add **`report.kpis`**: concentration/Pareto headlines, segment value share with tractability hints, driver counterfactual rollups (SHAP-based scenario), reliability, and optional monetization metrics when `value_column` is set. Scenario numbers are **not** guaranteed business impact.  
- **Database migration:** New environments should rely on **Alembic** only (`alembic upgrade head` on startup in Docker or run manually). The initial revision [`backend/alembic/versions/001_initial_schema.py`](backend/alembic/versions/001_initial_schema.py) already includes `report_json` and `value_column`. Legacy one-off SQL files [backend/sql/migration_002_add_report_json.sql](backend/sql/migration_002_add_report_json.sql) and [backend/sql/migration_003_add_value_column.sql](backend/sql/migration_003_add_value_column.sql) apply only if you have an **old** database that predates Alembic or those columns.  
- **SHAP:** Tree models use `TreeExplainer`; linear baselines use coefficients and/or permutation importance. Plots are saved under `data/artifacts/{analysis_id}/`.  
- **Causal language:** Outputs are **associative** (model-based), not proven causal effects.  

## Tests

```bash
cd backend
python -m pytest tests -q
```

(See **Development** above for lint and migration workflow.)
