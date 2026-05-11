"""Generate a synthetic SaaS-churn dataset designed to stress test the RCA platform.

The output exercises most of the pipeline's edge cases at once:

- Scale: configurable (default 100,000 rows x ~40 columns, ~50-80 MB CSV).
- Mixed dtypes: numeric (incl. heavy-tailed lognormal), boolean, categorical, datetime.
- High-cardinality categoricals that exceed the preprocessor's MAX_CAT_LEVELS (25):
  - `city` (~300 levels), `billing_country` (~80 levels).
- High-null columns: `nps_last` (~40%), `csat_last` (~25%), `referral_source` (~50%).
- Class imbalance: target `churned` ~7% positive.
- ID-like / leakage-bait columns: `customer_id`, `email_hash`
  (both contain substrings in profile.LEAKAGE_NAME_SUBSTR).
- Constant column: `legacy_flag`. Near-constant: `internal_score`.
- Duplicate rows: ~5% (triggers duplicate_row_ratio warning).
- Pure-noise features and a noisy categorical (no predictive signal).
- Three pre-built target columns to switch between:
  - `churned`               -> binary classification (imbalanced).
  - `plan_tier`             -> multiclass classification (5 classes).
  - `revenue_at_risk_usd`   -> regression (heavy-tailed).
- `monthly_revenue_usd`     -> use as `value_column` for monetization KPIs.
- `signup_date`             -> use as `datetime_column` for walk-forward CV.

Ground-truth churn drivers (so you can sanity-check SHAP rankings):

  1. failed_payments_90d   (+, strong)
  2. last_login_days_ago   (+, strong)
  3. monthly_logins        (-, strong)
  4. nps_last              (-, moderate; only on non-null rows)
  5. support_tickets_30d * p1_incidents_30d (+, interaction)
  6. plan_tier == "basic" AND tenure_days < 60     (+, interaction)
  7. discount_pct          (-, mild)

Usage:

    python scripts/generate_stress_test_dataset.py
    python scripts/generate_stress_test_dataset.py --rows 250000 --out data/samples/big.csv
    python scripts/generate_stress_test_dataset.py --rows 5000 --seed 7 --format parquet

The script has no project dependencies beyond numpy + pandas.
"""

from __future__ import annotations

import argparse
import hashlib
from pathlib import Path

import numpy as np
import pandas as pd


def _sigmoid(x: np.ndarray) -> np.ndarray:
    return 1.0 / (1.0 + np.exp(-np.clip(x, -50, 50)))


def _make_country_pool(rng: np.random.Generator) -> tuple[np.ndarray, np.ndarray]:
    countries = np.array(
        [f"C{idx:03d}" for idx in range(80)],
        dtype=object,
    )
    weights = rng.dirichlet(np.ones(len(countries)) * 0.4)
    return countries, weights


def _make_city_pool(rng: np.random.Generator) -> tuple[np.ndarray, np.ndarray]:
    cities = np.array(
        [f"city_{idx:04d}" for idx in range(300)],
        dtype=object,
    )
    weights = rng.dirichlet(np.ones(len(cities)) * 0.25)
    return cities, weights


def _email_hash(rng: np.random.Generator, n: int) -> np.ndarray:
    raw = rng.integers(0, 2**31 - 1, size=n, dtype=np.int64).astype(str)
    return np.array(
        [hashlib.sha1(s.encode("utf-8")).hexdigest()[:16] for s in raw],
        dtype=object,
    )


def build_dataframe(n_rows: int, seed: int) -> pd.DataFrame:
    rng = np.random.default_rng(seed)

    customer_id = np.array([f"CUST{idx:08d}" for idx in range(n_rows)], dtype=object)

    start = pd.Timestamp("2023-01-01")
    end = pd.Timestamp("2026-04-30")
    day_span = (end - start).days
    signup_offsets = rng.integers(0, day_span, size=n_rows)
    signup_date = start + pd.to_timedelta(signup_offsets, unit="D")
    snapshot_date = pd.Timestamp("2026-05-01")
    tenure_days = (snapshot_date - signup_date).days.to_numpy()

    plan_tier = rng.choice(
        ["basic", "standard", "pro", "business", "enterprise"],
        size=n_rows,
        p=[0.35, 0.30, 0.18, 0.12, 0.05],
    )
    segment = rng.choice(["SMB", "MidMarket", "Enterprise", "Self-serve"], size=n_rows, p=[0.5, 0.25, 0.1, 0.15])
    industry = rng.choice(
        [
            "saas", "fintech", "ecommerce", "media", "education", "healthcare",
            "logistics", "manufacturing", "gaming", "travel", "real_estate",
            "non_profit", "government", "agriculture", "energy", "telecom",
            "retail", "consulting", "construction", "other",
        ],
        size=n_rows,
    )
    company_size = rng.choice(
        ["1-10", "11-50", "51-200", "201-1000", "1001-5000", "5001+"],
        size=n_rows,
        p=[0.40, 0.25, 0.15, 0.10, 0.06, 0.04],
    )
    region = rng.choice(["NA", "EMEA", "APAC", "LATAM", "ANZ"], size=n_rows, p=[0.45, 0.25, 0.18, 0.07, 0.05])
    payment_method = rng.choice(
        ["card", "wire", "paypal", "ach"], size=n_rows, p=[0.65, 0.15, 0.10, 0.10]
    )
    referral_source = rng.choice(
        ["organic", "paid_search", "partner", "event", "outbound", "social"],
        size=n_rows,
    )
    account_type = rng.choice(["trial", "paid", "free"], size=n_rows, p=[0.10, 0.78, 0.12])

    countries, country_w = _make_country_pool(rng)
    billing_country = rng.choice(countries, size=n_rows, p=country_w)

    cities, city_w = _make_city_pool(rng)
    city = rng.choice(cities, size=n_rows, p=city_w)

    base_arpu = {
        "basic": 49.0, "standard": 149.0, "pro": 399.0,
        "business": 999.0, "enterprise": 4500.0,
    }
    arpu = np.array([base_arpu[p] for p in plan_tier])
    monthly_revenue_usd = np.round(arpu * rng.lognormal(mean=0.0, sigma=0.35, size=n_rows), 2)

    monthly_active_users = np.maximum(
        1,
        rng.negative_binomial(4, 0.05, size=n_rows)
        + (np.isin(plan_tier, ["business", "enterprise"]) * rng.integers(20, 200, size=n_rows)),
    )

    monthly_logins = np.maximum(
        0,
        (monthly_active_users * rng.uniform(0.6, 3.5, size=n_rows)).astype(int)
        - rng.poisson(2.0, size=n_rows),
    )

    features_used = np.clip(
        (rng.normal(7.5, 3.5, size=n_rows)
         + np.isin(plan_tier, ["pro", "business", "enterprise"]) * 3.0).astype(int),
        0, 15,
    )

    support_tickets_30d = rng.poisson(1.5, size=n_rows)
    p1_incidents_30d = rng.binomial(1, 0.06, size=n_rows) * rng.poisson(1.2, size=n_rows)

    avg_session_minutes = np.round(np.maximum(0.5, rng.lognormal(2.4, 0.55, size=n_rows)), 2)
    api_calls_30d = np.round(rng.lognormal(7.0, 1.6, size=n_rows)).astype(int)
    failed_payments_90d = rng.poisson(0.4, size=n_rows)

    discount_pct = np.where(
        rng.random(n_rows) < 0.4,
        np.round(rng.uniform(0, 50, size=n_rows), 1),
        0.0,
    )

    nps_last = rng.integers(0, 11, size=n_rows).astype(float)
    csat_last = np.round(rng.uniform(1.0, 5.0, size=n_rows), 2)

    last_login_days_ago = np.maximum(0, rng.exponential(8.0, size=n_rows)).astype(int)
    contract_months = rng.choice([1, 12, 24, 36], size=n_rows, p=[0.45, 0.35, 0.15, 0.05])
    auto_renew = rng.binomial(1, 0.72, size=n_rows).astype(bool)
    has_sso = rng.binomial(
        1,
        np.where(np.isin(plan_tier, ["business", "enterprise"]), 0.85, 0.15),
    ).astype(bool)

    legacy_flag = np.full(n_rows, "active", dtype=object)
    internal_score = np.round(rng.normal(0.5, 1e-4, size=n_rows), 6)

    noise_cols = {f"noise_feature_{i}": rng.standard_normal(n_rows) for i in range(1, 6)}
    noisy_category = rng.choice([f"bucket_{i:02d}" for i in range(12)], size=n_rows)

    email_hash = _email_hash(rng, n_rows)

    plan_basic_short_tenure = ((plan_tier == "basic") & (tenure_days < 60)).astype(float)
    ticket_incident_interaction = support_tickets_30d * p1_incidents_30d

    z = (
        -3.2
        + 0.55 * failed_payments_90d
        + 0.045 * last_login_days_ago
        - 0.012 * monthly_logins
        + 0.20 * ticket_incident_interaction
        + 1.10 * plan_basic_short_tenure
        - 0.018 * discount_pct
        - 0.08 * np.nan_to_num(nps_last, nan=5.0)
        - 0.40 * has_sso.astype(float)
        + 0.20 * (account_type == "trial").astype(float)
        + rng.normal(0.0, 0.6, size=n_rows)
    )
    churn_prob = _sigmoid(z)
    churned = (rng.random(n_rows) < churn_prob).astype(int)

    revenue_at_risk_usd = np.round(
        monthly_revenue_usd * 12.0 * churn_prob * rng.uniform(0.6, 1.1, size=n_rows),
        2,
    )

    df = pd.DataFrame(
        {
            "customer_id": customer_id,
            "email_hash": email_hash,
            "signup_date": signup_date.strftime("%Y-%m-%d"),
            "tenure_days": tenure_days,
            "plan_tier": plan_tier,
            "segment": segment,
            "industry": industry,
            "company_size": company_size,
            "region": region,
            "billing_country": billing_country,
            "city": city,
            "account_type": account_type,
            "payment_method": payment_method,
            "referral_source": referral_source,
            "monthly_revenue_usd": monthly_revenue_usd,
            "monthly_active_users": monthly_active_users,
            "monthly_logins": monthly_logins,
            "features_used": features_used,
            "support_tickets_30d": support_tickets_30d,
            "p1_incidents_30d": p1_incidents_30d,
            "avg_session_minutes": avg_session_minutes,
            "api_calls_30d": api_calls_30d,
            "failed_payments_90d": failed_payments_90d,
            "discount_pct": discount_pct,
            "nps_last": nps_last,
            "csat_last": csat_last,
            "last_login_days_ago": last_login_days_ago,
            "contract_months": contract_months,
            "auto_renew": auto_renew,
            "has_sso": has_sso,
            "legacy_flag": legacy_flag,
            "internal_score": internal_score,
            "noisy_category": noisy_category,
            **noise_cols,
            "churned": churned,
            "revenue_at_risk_usd": revenue_at_risk_usd,
        }
    )

    def _inject_nulls(col: str, ratio: float) -> None:
        mask = rng.random(n_rows) < ratio
        df.loc[mask, col] = np.nan

    _inject_nulls("nps_last", 0.40)
    _inject_nulls("csat_last", 0.25)
    _inject_nulls("referral_source", 0.50)
    _inject_nulls("avg_session_minutes", 0.10)
    _inject_nulls("company_size", 0.05)

    n_dups = max(1, int(0.05 * n_rows))
    dup_src = rng.integers(0, n_rows, size=n_dups)
    dup_rows = df.iloc[dup_src].copy()
    df = pd.concat([df, dup_rows], ignore_index=True)
    df = df.sample(frac=1.0, random_state=seed).reset_index(drop=True)

    return df


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--rows", type=int, default=100_000, help="Approximate row count before dup injection (default 100000).")
    parser.add_argument("--seed", type=int, default=42, help="Random seed (default 42).")
    parser.add_argument(
        "--out",
        type=Path,
        default=Path("data/samples/stress_test_churn.csv"),
        help="Output path (default data/samples/stress_test_churn.csv).",
    )
    parser.add_argument("--format", choices=["csv", "parquet"], default="csv", help="Output format.")
    args = parser.parse_args()

    df = build_dataframe(args.rows, args.seed)

    args.out.parent.mkdir(parents=True, exist_ok=True)
    if args.format == "csv" or args.out.suffix.lower() == ".csv":
        df.to_csv(args.out, index=False)
    else:
        df.to_parquet(args.out, index=False)

    size_mb = args.out.stat().st_size / (1024 * 1024)
    pos_rate = float(df["churned"].mean())
    print(f"Wrote {args.out}  rows={len(df):,}  cols={df.shape[1]}  size={size_mb:.1f} MB")
    print(f"  churned positive rate: {pos_rate:.2%}")
    print(f"  unique cities:         {df['city'].nunique()}")
    print(f"  unique countries:      {df['billing_country'].nunique()}")
    print(f"  null ratio nps_last:   {df['nps_last'].isna().mean():.2%}")
    print(f"  duplicate row ratio:   {df.duplicated().mean():.2%}")
    print("")
    print("Suggested run in the UI:")
    print("  target          = churned")
    print("  value_column    = monthly_revenue_usd")
    print("  datetime_column = signup_date")
    print("Alternative targets: plan_tier (multiclass), revenue_at_risk_usd (regression).")


if __name__ == "__main__":
    main()
