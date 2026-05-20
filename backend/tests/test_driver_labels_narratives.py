"""Driver label humanization, narrative grammar, economic direction, calibration."""

from __future__ import annotations

import re
from pathlib import Path

import pandas as pd
import pytest

from app.decisioning.driver_labels import format_driver_label
from app.decisioning.insights import build_insights
from app.decisioning.recommend import build_recommendations

TELCO_CSV = Path(__file__).resolve().parents[2] / "data" / "samples" / "customer_churn.csv"


def test_humanized_ohe_labels():
    raw = [
        "contract_type",
        "online_security",
        "internet_service",
        "payment_method",
        "monthly_charges",
        "tenure_months",
    ]
    assert format_driver_label("contract_type_month-to-month", raw) == "Month-to-month contracts"
    assert format_driver_label("online_security_no", raw) == "Customers Without Online Security"
    assert format_driver_label("internet_service_fiber optic", raw) == "Fiber optic internet customers"
    assert format_driver_label("payment_method_electronic check", raw) == "Electronic Check Payment Users"
    assert format_driver_label("monthly_charges", raw) == "Monthly Charges"
    assert format_driver_label("monthlycharges", raw) == "Monthly Charges"
    assert format_driver_label("MonthlyCharges", raw) == "Monthly Charges"
    assert format_driver_label("onlinesecurity_no", raw) == "Customers Without Online Security"


def test_categorical_narrative_grammar():
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
    out = build_insights(
        df, "Churn", "classification", shap_rows, meta, top_n=1, raw_columns=list(df.columns)
    )
    summary = out[0]["summary"]
    assert "customers where" not in summary.lower()
    assert "Month-to-month contracts" in summary or "month-to-month contracts" in summary.lower()
    assert "show higher predicted" in summary.lower() or "higher predicted churn" in summary.lower()
    assert out[0]["display_label"] == "Month-to-month contracts"


def test_economic_frame_preserves_direction():
    df = pd.DataFrame({"monthly_charges": [50, 80, 120], "churned": [0, 1, 1]})
    meta = [{"name": "monthly_charges", "dtype": "float64", "null_ratio": 0.0}]
    rows = [
        {
            "feature": "monthly_charges",
            "mean_abs_shap": 0.4,
            "mean_signed_shap": 0.3,
            "direction": "increases",
        },
    ]
    rows3 = [
        {"feature": "contract_type_one year", "mean_abs_shap": 0.9, "mean_signed_shap": 0.1, "direction": "increases"},
        {"feature": "tenure_months", "mean_abs_shap": 0.8, "mean_signed_shap": -0.1, "direction": "decreases"},
        {
            "feature": "monthly_charges",
            "mean_abs_shap": 0.7,
            "mean_signed_shap": 0.3,
            "direction": "increases",
        },
    ]
    meta2 = meta + [
        {"name": "tenure_months", "dtype": "int64", "null_ratio": 0.0},
        {"name": "contract_type", "dtype": "object", "null_ratio": 0.0},
    ]
    out = build_insights(
        df.assign(tenure_months=[1, 2, 3], contract_type=["a", "b", "c"]),
        "churned",
        "classification",
        rows3,
        meta2,
        top_n=3,
        raw_columns=["monthly_charges", "tenure_months", "contract_type"],
    )
    mc_ins = next(i for i in out if i["feature"] == "monthly_charges")
    summary = mc_ins["summary"]
    assert "Economic framing" in summary
    assert "higher predicted churn" in summary.lower()
    assert "mean |SHAP|" in summary
    assert "ranks in the top drivers by mean |impact|" not in summary


def test_recommendations_never_expose_raw_encoded_names():
    raw = ["contract_type", "online_security", "monthly_charges"]
    shap_rows = [
        {
            "feature": "contract_type_month-to-month",
            "mean_abs_shap": 0.5,
            "mean_signed_shap": 0.3,
            "direction": "increases",
        },
        {
            "feature": "online_security_no",
            "mean_abs_shap": 0.3,
            "mean_signed_shap": 0.2,
            "direction": "increases",
        },
    ]
    meta = [{"name": c, "dtype": "object", "null_ratio": 0.0} for c in raw]
    recs = build_recommendations(
        "classification",
        "churned",
        shap_rows,
        meta,
        {"accuracy": 0.8},
        raw_columns=raw,
    )
    joined = " ".join(recs)
    assert "contract_type_month-to-month" not in joined
    assert "online_security_no" not in joined
    assert "Month-to-month contracts" in joined


@pytest.mark.skipif(not TELCO_CSV.is_file(), reason="sample CSV missing")
def test_confidence_severity_not_all_critical_high():
    import tempfile

    from app.pipelines.explain import compute_explanations
    from app.pipelines.pipeline import train_model

    df = pd.read_csv(TELCO_CSV)
    res = train_model(df, "churned", max_rows=2500)
    rows, _ = compute_explanations(
        res.model,
        res.X_test,
        res.feature_names,
        Path(tempfile.mkdtemp()),
        res.model_kind,
        res.task_type,
        label_encoder=res.label_encoder,
    )
    meta = [{"name": c, "dtype": str(df[c].dtype), "null_ratio": 0.0} for c in df.columns]
    out = build_insights(df, "churned", "classification", rows, meta, top_n=8, raw_columns=list(df.columns))
    conf = {i["confidence"] for i in out}
    sev = {i["severity"] for i in out}
    assert len(conf) >= 2, f"confidence collapsed: {conf}"
    assert "informational" in sev or "warning" in sev, f"severity collapsed: {sev}"
    assert not all(i["severity"] == "critical" and i["confidence"] == "high" for i in out)


def test_correlation_disagreement_required_phrase():
    df = pd.read_csv(TELCO_CSV) if TELCO_CSV.is_file() else pd.DataFrame(
        {"monthly_charges": [1, 2, 3, 4], "churned": [0, 0, 1, 1]}
    )
    rows = [
        {
            "feature": "monthly_charges",
            "mean_abs_shap": 0.9,
            "mean_signed_shap": -0.2,
            "direction": "decreases",
        },
    ]
    meta = [{"name": c, "dtype": "float64", "null_ratio": 0.0} for c in df.columns if c != "churned"]
    out = build_insights(
        df, "churned", "classification", rows, meta, top_n=1, raw_columns=["monthly_charges"]
    )
    assert out[0].get("correlation_agreement") is False
    assert "differs from simple correlation" in out[0]["summary"].lower()


def test_low_confidence_wording():
    df = pd.DataFrame({"tenure_months": [1, 2, 3, 4], "churned": [0, 0, 1, 1]})
    rows = [
        {
            "feature": "tenure_months",
            "mean_abs_shap": 0.01,
            "mean_signed_shap": 0.005,
            "direction": "increases",
        },
    ]
    meta = [{"name": "tenure_months", "dtype": "int64", "null_ratio": 0.5}]
    out = build_insights(
        df, "churned", "classification", rows, meta, top_n=1, raw_columns=["tenure_months"]
    )
    assert out[0]["confidence"] == "low"
    assert "Tentative association" in out[0]["summary"]


def test_recommendation_direction_framing():
    raw = ["contract_type", "tenure_months"]
    shap_rows = [
        {
            "feature": "contract_type_month-to-month",
            "mean_abs_shap": 0.5,
            "mean_signed_shap": 0.3,
            "direction": "increases",
        },
        {
            "feature": "tenure_months",
            "mean_abs_shap": 0.4,
            "mean_signed_shap": -0.2,
            "direction": "decreases",
        },
    ]
    meta = [{"name": c, "dtype": "object", "null_ratio": 0.0} for c in raw]
    recs = build_recommendations(
        "classification", "churned", shap_rows, meta, {"accuracy": 0.8}, raw_columns=raw
    )
    joined = " ".join(recs)
    assert "Mitigation focus" in joined
    assert "Retention stabilizer" in joined
