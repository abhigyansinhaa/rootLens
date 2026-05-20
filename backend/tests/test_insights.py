"""Tests for SHAP aggregation."""

from __future__ import annotations

from app.ml.insights import aggregate_shap_by_column


def test_aggregate_one_hot_stems():
    rows = [
        {"feature": "city_NYC", "mean_abs_shap": 0.5, "mean_signed_shap": 0.2, "direction": "increases"},
        {"feature": "city_LA", "mean_abs_shap": 0.3, "mean_signed_shap": -0.1, "direction": "decreases"},
        {"feature": "age", "mean_abs_shap": 0.1, "mean_signed_shap": 0.05, "direction": "increases"},
    ]
    agg = aggregate_shap_by_column(rows, top_k=5, raw_columns=["city", "age"])
    names = {r["feature"] for r in agg}
    assert "city" in names
    assert len(agg) >= 1


def test_aggregate_prefers_longest_raw_column_prefix():
    """Telco-style ``Contract_Month-to-month`` must group under ``Contract``, not ``Contract_Month``."""
    raw = ["Contract", "MonthlyCharges", "tenure"]
    rows = [
        {
            "feature": "Contract_Month-to-month",
            "mean_abs_shap": 0.4,
            "mean_signed_shap": 0.3,
            "direction": "increases",
        },
        {
            "feature": "Contract_Two year",
            "mean_abs_shap": 0.1,
            "mean_signed_shap": -0.05,
            "direction": "decreases",
        },
    ]
    agg = aggregate_shap_by_column(rows, top_k=5, raw_columns=raw)
    by_name = {r["feature"]: r for r in agg}
    assert "Contract" in by_name


def test_insights_one_hot_narrative_uses_level_not_higher_scores():
    import pandas as pd

    from app.decisioning.insights import build_insights

    df = pd.DataFrame(
        {
            "Contract": ["Month-to-month", "Two year"] * 6,
            "tenure": range(12),
            "Churn": ["No", "Yes"] * 6,
        }
    )
    meta = [{"name": c, "dtype": str(df[c].dtype), "null_ratio": 0.0} for c in df.columns]
    shap_rows = [
        {
            "feature": "Contract_Month-to-month",
            "mean_abs_shap": 0.9,
            "mean_signed_shap": 0.5,
            "direction": "increases",
        },
    ]
    raw_cols = list(df.columns)
    out = build_insights(
        df,
        "Churn",
        "classification",
        shap_rows,
        meta,
        top_n=1,
        raw_columns=raw_cols,
    )
    assert out
    summary = out[0]["summary"]
    assert "customers where" not in summary.lower()
    assert "month-to-month" in summary.lower()
    assert "encoded values correlate" not in summary.lower()
    assert out[0].get("display_label") == "Month-to-month contracts"

