#!/usr/bin/env python3
"""E2E stress test against a running RCA stack (see project plan).

Requires: pip install requests
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

try:
    import requests
except ImportError:
    print("Install requests: pip install requests", file=sys.stderr)
    sys.exit(1)

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
API_BASE = "http://127.0.0.1:8000/api"
REPO_ROOT = Path(__file__).resolve().parent.parent
CSV_PATH = REPO_ROOT / "data" / "samples" / "stress_test_churn.csv"

# stress@local often fails EmailStr validation; example.com is valid and stable for e2e
TEST_EMAIL = "stress-e2e@example.com"
TEST_PASSWORD = "Stress!Pass1234"

POLL_SECONDS = 5
MAX_WAIT_SECONDS = 1800
HEALTH_URL = "http://127.0.0.1:8000/api/health"

# Ground-truth feature stems from generate_stress_test_dataset.py (one-hot names may prefix these)
CHURN_GROUND_TRUTH = {
    "failed_payments_90d",
    "last_login_days_ago",
    "monthly_logins",
    "nps_last",
    "support_tickets_30d",
    "p1_incidents_30d",
    "plan_tier",
    "has_sso",
    "discount_pct",
}

NOISE_FEATURES = {
    "noisy_category",
    "noise_feature_1",
    "noise_feature_2",
    "noise_feature_3",
    "noise_feature_4",
    "noise_feature_5",
}

PLAN_TIER_EXPECTED = {"monthly_revenue_usd", "has_sso", "monthly_active_users", "api_calls_30d"}

REGRESSION_DOMINANT = {"monthly_revenue_usd"}


def log(msg: str) -> None:
    print(msg, flush=True)


def wait_for_health(timeout_s: float = 300.0) -> None:
    t0 = time.monotonic()
    while time.monotonic() - t0 < timeout_s:
        try:
            r = requests.get(HEALTH_URL, timeout=5)
            if r.status_code == 200:
                log("API health OK")
                return
        except requests.RequestException:
            pass
        time.sleep(2)
    raise SystemExit(f"API not healthy within {timeout_s}s at {HEALTH_URL}")


def auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def register_or_login(session: requests.Session) -> str:
    r = session.post(
        f"{API_BASE}/auth/register",
        json={"email": TEST_EMAIL, "password": TEST_PASSWORD},
        timeout=60,
    )
    if r.status_code not in (200, 201, 400):
        r.raise_for_status()
    if r.status_code == 400:
        detail = r.json().get("detail", "")
        if "already registered" not in str(detail).lower() and "email" not in str(detail).lower():
            log(f"Register unexpected: {r.status_code} {r.text[:500]}")

    r2 = session.post(
        f"{API_BASE}/auth/login",
        json={"email": TEST_EMAIL, "password": TEST_PASSWORD},
        timeout=60,
    )
    r2.raise_for_status()
    data = r2.json()
    token = data.get("access_token")
    if not token:
        raise SystemExit(f"No access_token in login response: {data}")
    log(f"Logged in as {TEST_EMAIL}")
    return token


def upload_dataset(session: requests.Session, token: str) -> dict:
    if not CSV_PATH.is_file():
        raise SystemExit(f"CSV not found: {CSV_PATH}")
    with CSV_PATH.open("rb") as f:
        files = {"file": (CSV_PATH.name, f, "text/csv")}
        data = {"name": "stress_test_churn_e2e"}
        r = session.post(
            f"{API_BASE}/datasets",
            headers=auth_headers(token),
            files=files,
            data=data,
            timeout=300,
        )
    r.raise_for_status()
    out = r.json()
    log(f"Uploaded dataset id={out['id']} rows={out['rows']} cols={out['cols']}")
    return out


def profile_dataset(session: requests.Session, token: str, dataset_id: int) -> dict:
    r = session.post(
        f"{API_BASE}/datasets/{dataset_id}/profile",
        headers={**auth_headers(token), "Content-Type": "application/json"},
        json={"target": "churned"},
        timeout=120,
    )
    r.raise_for_status()
    return r.json()


def create_analysis(
    session: requests.Session,
    token: str,
    dataset_id: int,
    target: str,
    *,
    value_column: str | None = None,
    datetime_column: str | None = None,
) -> dict:
    body: dict = {"target": target}
    if value_column:
        body["value_column"] = value_column
    if datetime_column:
        body["datetime_column"] = datetime_column
    r = session.post(
        f"{API_BASE}/datasets/{dataset_id}/analyses",
        headers={**auth_headers(token), "Content-Type": "application/json"},
        json=body,
        timeout=60,
    )
    r.raise_for_status()
    return r.json()


def _request_with_retries(
    session: requests.Session,
    method: str,
    url: str,
    *,
    headers: dict[str, str] | None = None,
    max_attempts: int = 8,
    timeout: int = 120,
) -> requests.Response:
    """UVicorn / reverse proxies may drop idle keep-alive during long ML jobs."""
    last_err: Exception | None = None
    for attempt in range(1, max_attempts + 1):
        try:
            r = session.request(method, url, headers=headers, timeout=timeout)
            return r
        except (requests.exceptions.ConnectionError, requests.exceptions.Timeout) as e:
            last_err = e
            delay = min(2**attempt, 60)
            log(f"  request retry {attempt}/{max_attempts} after {e!s} (sleep {delay}s)")
            time.sleep(delay)
    raise RuntimeError(f"Request failed after {max_attempts} attempts: {last_err}") from last_err


def poll_analysis(session: requests.Session, token: str, analysis_id: int) -> dict:
    deadline = time.monotonic() + MAX_WAIT_SECONDS
    last = None
    while time.monotonic() < deadline:
        r = _request_with_retries(
            session,
            "GET",
            f"{API_BASE}/analyses/{analysis_id}",
            headers=auth_headers(token),
        )
        r.raise_for_status()
        row = r.json()
        status = row.get("status")
        if status != last:
            log(f"  analysis #{analysis_id} status -> {status}")
            last = status
        if status in ("completed", "failed"):
            return row
        time.sleep(POLL_SECONDS)
    raise TimeoutError(f"Analysis {analysis_id} not finished in {MAX_WAIT_SECONDS}s")


def download_shap_png(session: requests.Session, token: str, analysis_id: int) -> Path:
    r = _request_with_retries(
        session,
        "GET",
        f"{API_BASE}/analyses/{analysis_id}/artifacts/shap_summary.png",
        headers=auth_headers(token),
    )
    r.raise_for_status()
    dest_dir = REPO_ROOT / "data" / "artifacts" / str(analysis_id)
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest = dest_dir / "shap_summary_via_api.png"
    dest.write_bytes(r.content)
    log(f"  saved {dest} ({len(r.content)} bytes)")
    return dest


def normalize_feature_tag(name: str) -> str:
    return str(name).lower().strip()


def matches_any_stem(feat: str, stems: set[str]) -> bool:
    low = normalize_feature_tag(feat)
    for s in stems:
        if s == low or low.startswith(s + "_") or f"_{s}_" in low or low.endswith("_" + s):
            return True
    return False


def is_noise_feature(feat: str) -> bool:
    low = normalize_feature_tag(feat)
    for n in NOISE_FEATURES:
        if n in low or low.startswith(n):
            return True
    return False


def top_shap_features(row: dict, k: int = 8) -> list[str]:
    fi = row.get("feature_importance") or []
    out: list[str] = []
    for item in fi[:k]:
        f = item.get("feature")
        if f:
            out.append(str(f))
    return out


def verify_churn(top8: list[str]) -> tuple[str, str]:
    hits = sum(1 for f in top8 if matches_any_stem(f, CHURN_GROUND_TRUTH))
    noise_in_top = [f for f in top8 if is_noise_feature(f)]
    parts = [f"ground_truth_hits_in_top8={hits}/8"]
    if noise_in_top:
        parts.append(f"noise_in_top8={noise_in_top}")
    detail = "; ".join(parts)
    if hits >= 4 and not noise_in_top:
        return "PASS", detail
    return "WARN", detail


def verify_plan_tier(top8: list[str]) -> tuple[str, str]:
    hits = sum(1 for f in top8 if matches_any_stem(f, PLAN_TIER_EXPECTED))
    detail = f"expected_driver_hits_in_top8={hits}/8"
    if hits >= 2:
        return "PASS", detail
    return "WARN", detail


def verify_regression(top8: list[str]) -> tuple[str, str]:
    hits = sum(1 for f in top8 if matches_any_stem(f, REGRESSION_DOMINANT))
    detail = f"monthly_revenue_hits_in_top8={hits}/8"
    if hits >= 1:
        return "PASS", detail
    return "WARN", detail


def print_report(label: str, row: dict) -> None:
    print("\n" + "=" * 72)
    print(f"  {label}")
    print("=" * 72)
    if row.get("error"):
        log(f"  ERROR: {row['error']}")
    log(f"  task_type: {row.get('task_type')}")
    md = row.get("model_metadata") or {}
    rep = row.get("report") or {}
    mod = rep.get("model") or {}
    vs = mod.get("validation_strategy") or md.get("validation_strategy")
    log(f"  model_kind: {md.get('model_kind')}")
    log(f"  validation_strategy: {vs}")
    log(f"  holdout: {md.get('holdout_strategy')} temporal={md.get('temporal_order_applied')}")
    m = row.get("metrics") or {}
    log(f"  metrics: {json.dumps(m, indent=2)[:1200]}")

    prof = rep.get("profile") or {}
    be = prof.get("blocking_errors") or []
    warn = prof.get("warnings") or rep.get("data_warnings") or []
    if be:
        log(f"  profile blocking_errors: {be}")
    if warn:
        log(f"  profile/data warnings (sample): {warn[:5]}{'...' if len(warn) > 5 else ''}")

    kpis = rep.get("kpis") or {}
    conc = kpis.get("concentration") or {}
    di = kpis.get("driver_impact") or {}
    log(f"  kpi concentration headline: {conc.get('headline')}")
    log(f"  kpi driver_impact top2: {di.get('top2')}")

    top8 = top_shap_features(row, 8)
    log("  top-8 SHAP (feature):")
    for i, f in enumerate(top8, 1):
        tag = "[NOISE]" if is_noise_feature(f) else (
            "[GROUND TRUTH]" if matches_any_stem(f, CHURN_GROUND_TRUTH) and label.startswith("churned")
            else "[?]"
        )
        if label.startswith("plan_tier") and matches_any_stem(f, PLAN_TIER_EXPECTED):
            tag = "[EXPECTED]"
        if label.startswith("revenue_at_risk") and matches_any_stem(f, REGRESSION_DOMINANT):
            tag = "[EXPECTED]"
        log(f"    {i}. {f} {tag}")

    if label.startswith("churned"):
        verdict, det = verify_churn(top8)
    elif label.startswith("plan_tier"):
        verdict, det = verify_plan_tier(top8)
    else:
        verdict, det = verify_regression(top8)
    log(f"  verdict: {verdict} ({det})")


def main() -> None:
    parser = argparse.ArgumentParser(description="RCA e2e stress test against Docker stack")
    parser.add_argument(
        "--reuse-dataset",
        type=int,
        default=None,
        metavar="ID",
        help="Skip CSV upload; use an existing dataset id (same stress_test_churn schema).",
    )
    args = parser.parse_args()

    wait_for_health()
    session = requests.Session()
    session.headers.update({"Connection": "close"})

    token = register_or_login(session)
    if args.reuse_dataset is not None:
        ds_id = args.reuse_dataset
        log(f"Reusing dataset id={ds_id} (skip upload)")
    else:
        ds = upload_dataset(session, token)
        ds_id = int(ds["id"])

    prof = profile_dataset(session, token, ds_id)
    log("\n--- Profile (target=churned) ---")
    log(f"  ok: {prof.get('ok')}")
    log(f"  blocking_errors: {prof.get('blocking_errors')}")
    log(f"  warnings ({len(prof.get('warnings') or [])}):")
    for w in prof.get("warnings") or []:
        log(f"    - {w}")
    dh = prof.get("dataset_health") or {}
    log(f"  dataset_health: rows={dh.get('n_rows')} dup_ratio={dh.get('duplicate_row_ratio')} "
        f"constants={dh.get('n_constant_columns')} high_null_cols={dh.get('high_null_columns_count')}")

    runs = [
        (
            "churned (binary + value + datetime)",
            lambda: create_analysis(
                session, token, ds_id, "churned",
                value_column="monthly_revenue_usd",
                datetime_column="signup_date",
            ),
        ),
        (
            "plan_tier (multiclass)",
            lambda: create_analysis(session, token, ds_id, "plan_tier"),
        ),
        (
            "revenue_at_risk_usd (regression + value + datetime)",
            lambda: create_analysis(
                session, token, ds_id, "revenue_at_risk_usd",
                value_column="monthly_revenue_usd",
                datetime_column="signup_date",
            ),
        ),
    ]

    for label, factory in runs:
        created = factory()
        aid = int(created["id"])
        log(f"\nStarted analysis #{aid} — {label}")
        try:
            final = poll_analysis(session, token, aid)
        except TimeoutError as e:
            log(str(e))
            continue
        if final.get("status") == "completed":
            try:
                download_shap_png(session, token, aid)
            except requests.HTTPError as e:
                if e.response is not None and e.response.status_code == 404:
                    log("  shap_summary.png not available (404); continuing")
                else:
                    log(f"  artifact download failed: {e}")
            print_report(label.split(" ")[0] if "(" in label else label, final)
        else:
            print_report(f"FAILED {label}", final)

    log("\n" + "=" * 72)
    log("Stack left running.")
    log("  UI:       http://localhost:8080")
    log("  API:      http://localhost:8000/api/health")
    log(f"  Test user: {TEST_EMAIL} / {TEST_PASSWORD}")
    log("=" * 72)


if __name__ == "__main__":
    main()
