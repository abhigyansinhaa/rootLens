"""`InsightEngine` parity with the legacy `build_insights` contract."""

from __future__ import annotations

import json

import pandas as pd

from app.decisioning.insight_engine import InsightEngine
from app.decisioning.insights import build_insights, insights_to_json


def _shap_rows():
    return [
        {"feature": "tenure", "mean_abs_shap": 0.5, "mean_signed_shap": -0.4, "direction": "decreases"},
        {"feature": "monthly_charges", "mean_abs_shap": 0.3, "mean_signed_shap": 0.2, "direction": "increases"},
        {"feature": "contract_one_year", "mean_abs_shap": 0.2, "mean_signed_shap": -0.15, "direction": "decreases"},
    ]


def _meta(df: pd.DataFrame) -> list[dict]:
    return [
        {
            "name": c,
            "dtype": str(df[c].dtype),
            "null_ratio": float(df[c].isna().mean()),
            "n_unique": int(df[c].nunique()),
        }
        for c in df.columns
    ]


def test_insight_engine_matches_legacy_builder():
    df = pd.DataFrame(
        {
            "tenure": [1, 2, 3, 4, 5, 6, 7, 8],
            "monthly_charges": [50, 60, 70, 80, 90, 100, 110, 120],
            "churn": [0, 0, 1, 0, 1, 0, 1, 1],
        }
    )
    meta = _meta(df)
    shap_rows = _shap_rows()

    engine = InsightEngine(top_n=2)
    engine_out = engine.build(
        df=df,
        target="churn",
        task_type="classification",
        shap_rows=shap_rows,
        column_meta=meta,
        confidence="high",
    )
    legacy_out = build_insights(
        df=df,
        target="churn",
        task_type="classification",
        shap_rows=shap_rows,
        column_meta=meta,
        top_n=2,
        confidence="high",
    )

    assert engine_out == legacy_out
    assert engine.to_json(engine_out) == insights_to_json(legacy_out)
    parsed = json.loads(engine.to_json(engine_out))
    assert len(parsed) == 2
    assert {i["feature"] for i in parsed} == {"tenure", "monthly_charges"}
