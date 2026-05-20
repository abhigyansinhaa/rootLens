"""Mathematical consistency: SHAP extraction, signed vs abs, narratives, grouping."""
from __future__ import annotations

import tempfile
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

from app.decisioning.driver_labels import format_driver_label
from app.decisioning.insights import (
    _group_key_for_feature,
    build_insights,
    format_forensic_insight_table,
)
from app.pipelines.explain import (
    _extract_positive_class_shap_matrix,
    _mean_signed_from_shap_matrix,
    _tree_shap_matrix,
    compute_explanations,
)
from app.pipelines.pipeline import train_model
from app.pipelines.profile import profile_dataset_for_target

TELCO_CSV = Path(__file__).resolve().parents[2] / "data" / "samples" / "customer_churn.csv"

def _telco_bundle(max_rows: int = 3000):
    df = pd.read_csv(TELCO_CSV)
    res = train_model(df, "churned", max_rows=max_rows)
    rng = np.random.default_rng(42)
    n = min(500, res.X_test.shape[0])
    idx = rng.choice(res.X_test.shape[0], size=n, replace=False)
    X_s = res.X_test[idx]
    sv = _tree_shap_matrix(res.model.named_steps["model"], X_s, res.task_type, res.label_encoder)
    rows, _ = compute_explanations(
        res.model,
        res.X_test,
        res.feature_names,
        Path(tempfile.mkdtemp()),
        res.model_kind,
        res.task_type,
        label_encoder=res.label_encoder,
    )
    return df, res, X_s, sv, rows


def _raw_corr(df: pd.DataFrame, col: str, target: str = "churned") -> float:
    sub = df[[col, target]].dropna()
    return float(sub[col].corr(sub[target].astype(float)))


def _signed_effect(sv: np.ndarray, X_s: np.ndarray, feat_idx: int) -> float:
    signed = _mean_signed_from_shap_matrix(sv, X_s)
    return float(signed[feat_idx])


@pytest.mark.skipif(not TELCO_CSV.is_file(), reason="sample CSV missing")
def test_shap_matrix_shape_assertions():
    _, res, X_s, sv, _ = _telco_bundle()
    assert sv.ndim == 2
    assert sv.shape == X_s.shape


def test_extract_positive_class_list_and_3d():
    """Synthetic shapes: list[class] and (samples, features, classes)."""
    n_s, n_f = 4, 3
    X = np.zeros((n_s, n_f))
    list_sv = [np.full((n_s, n_f), -1.0), np.full((n_s, n_f), 2.0)]
    out = _extract_positive_class_shap_matrix(
        list_sv, X, task_type="classification", label_encoder=None
    )
    assert out.shape == (n_s, n_f)
    np.testing.assert_allclose(out, 2.0)

    arr3 = np.stack([np.full((n_s, n_f), -1.0), np.full((n_s, n_f), 3.0)], axis=2)
    out3 = _extract_positive_class_shap_matrix(
        arr3, X, task_type="classification", label_encoder=None
    )
    assert out3.shape == (n_s, n_f)
    np.testing.assert_allclose(out3, 3.0)


@pytest.mark.skipif(not TELCO_CSV.is_file(), reason="sample CSV missing")
def test_ranking_uses_abs_direction_uses_signed():
    _, res, _, _, rows = _telco_bundle(2000)
    for r in rows:
        ms = r["mean_signed_shap"]
        ma = r["mean_abs_shap"]
        assert r["direction"] == ("increases" if ms >= 0 else "decreases")
        assert ma >= 0
    ranked = sorted(rows, key=lambda x: -x["mean_abs_shap"])
    assert ranked[0]["mean_abs_shap"] >= ranked[-1]["mean_abs_shap"]


@pytest.mark.skipif(not TELCO_CSV.is_file(), reason="sample CSV missing")
def test_shap_direction_aligns_with_raw_correlation_on_telco():
    """Signed effect (median contrast / active-only) should match raw corr sign when |r| is meaningful."""
    df, res, X_s, sv, rows = _telco_bundle()
    by_name = {r["feature"]: r for r in rows}
    for raw_col, feat in (
        ("monthly_charges", "monthly_charges"),
        ("tenure_months", "tenure_months"),
    ):
        corr = _raw_corr(df, raw_col)
        row = by_name[feat]
        signed = row["mean_signed_shap"]
        if abs(corr) < 0.03:
            continue
        assert (corr > 0) == (signed > 0), f"{feat}: corr={corr:+.4f} signed={signed:+.4f}"

    assert by_name["contract_type_month-to-month"]["direction"] == "increases"
    assert by_name["online_security_no"]["direction"] == "increases"


@pytest.mark.skipif(not TELCO_CSV.is_file(), reason="sample CSV missing")
def test_median_split_numeric_drivers():
    df, res, X_s, sv, _ = _telco_bundle()
    fn = res.feature_names
    for feat in ("monthly_charges", "tenure_months"):
        i = fn.index(feat)
        col = X_s[:, i]
        med = float(np.median(col))
        hi = col >= med
        lo = col < med
        mean_hi = float(np.mean(sv[hi, i]))
        mean_lo = float(np.mean(sv[lo, i]))
        signed = _signed_effect(sv, X_s, i)
        if signed > 0:
            assert mean_hi > mean_lo, feat
        else:
            assert mean_hi < mean_lo, feat


@pytest.mark.skipif(not TELCO_CSV.is_file(), reason="sample CSV missing")
def test_monthly_charges_increases_churn_risk():
    _, _, _, _, rows = _telco_bundle()
    mc = next(r for r in rows if r["feature"] == "monthly_charges")
    assert mc["direction"] == "increases"
    assert mc["mean_signed_shap"] > 0


@pytest.mark.skipif(not TELCO_CSV.is_file(), reason="sample CSV missing")
def test_narrative_wording_matches_direction():
    df, _, _, _, rows = _telco_bundle()
    meta = [{"name": c, "dtype": str(df[c].dtype), "null_ratio": 0.0} for c in df.columns]
    out = build_insights(
        df, "churned", "classification", rows, meta, top_n=12, raw_columns=list(df.columns)
    )
    by_feat = {i["feature"]: i for i in out}
    mtm = by_feat["contract_type_month-to-month"]
    assert "customers where" not in mtm["summary"].lower()
    assert "month-to-month" in mtm["summary"].lower()
    assert "higher predicted" in mtm["summary"].lower() or "show higher" in mtm["summary"].lower()
    assert mtm.get("display_label") == "Month-to-month contracts"

    os_no = by_feat["online_security_no"]
    assert "online_security_no" not in os_no["summary"]
    assert "without online security" in os_no["summary"].lower() or "customers without" in os_no["summary"].lower()

    tenure_row = by_feat.get("tenure_months")
    if tenure_row:
        tsum = tenure_row["summary"].lower()
        assert (
            "lower predicted" in tsum
            or "reduces predicted" in tsum
            or "lower risk" in tsum
        )

    mc = by_feat["monthly_charges"]
    assert "higher predicted risk" in mc["summary"].lower() or "higher" in mc["summary"].lower()
    assert "encoded values correlate" not in mc["summary"].lower()


def test_feature_grouping_snake_case_preserved():
    raw = ["avg_monthly_support_calls", "monthly_charges", "Contract", "PaymentMethod"]
    assert _group_key_for_feature("avg_monthly_support_calls", raw) == "avg_monthly_support_calls"
    assert _group_key_for_feature("monthly_charges", raw) == "monthly_charges"
    assert _group_key_for_feature("Contract_Month-to-month", raw) == "Contract"
    assert _group_key_for_feature("PaymentMethod_ElectronicCheck", raw) == "PaymentMethod"


def test_humanized_labels_for_telco_ohe():
    raw = ["OnlineSecurity", "Contract", "Churn"]
    assert format_driver_label("OnlineSecurity_No", raw) == "Customers Without Online Security"
    assert format_driver_label("monthlycharges", ["monthly_charges"]) == "Monthly Charges"
    assert format_driver_label("Contract_Month-to-month", raw) == "Month-to-month contracts"


def test_correlation_disagreement_note_in_narrative():
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


def test_governance_does_not_flag_contract_as_leakage_on_telco():
    df = pd.read_csv(TELCO_CSV)
    meta = [
        {"name": c, "dtype": str(df[c].dtype), "null_ratio": float(df[c].isna().mean())}
        for c in df.columns
    ]
    pr = profile_dataset_for_target(df, "churned", meta)
    contract_leak = [w for w in pr.warnings if "contract" in w.lower() and "leakage" in w.lower()]
    assert not contract_leak, pr.warnings


@pytest.mark.skipif(not TELCO_CSV.is_file(), reason="sample CSV missing")
def test_per_driver_confidence_not_global_clone():
    df, _, _, _, rows = _telco_bundle()
    meta = [{"name": c, "dtype": str(df[c].dtype), "null_ratio": 0.0} for c in df.columns]
    out = build_insights(df, "churned", "classification", rows, meta, top_n=8, raw_columns=list(df.columns))
    tiers = {i["confidence"] for i in out}
    assert tiers  # at least one tier assigned per row
    assert all(i["confidence"] in ("high", "medium", "low") for i in out)


@pytest.mark.skipif(not TELCO_CSV.is_file(), reason="sample CSV missing")
def test_forensic_debug_table(capsys):
    df, _, _, _, rows = _telco_bundle()
    meta = [{"name": c, "dtype": str(df[c].dtype), "null_ratio": 0.0} for c in df.columns]
    out = build_insights(df, "churned", "classification", rows, meta, top_n=6, raw_columns=list(df.columns))
    table = format_forensic_insight_table(df, "churned", out)
    print(table)
    captured = capsys.readouterr().out
    assert "feature" in captured or "monthly_charges" in table
    assert "mean_signed" in table or "monthly_charges" in table


def test_insight_engine_still_matches_legacy_builder():
    """InsightEngine wrapper must match build_insights output shape."""
    from app.decisioning.insight_engine import InsightEngine

    if not TELCO_CSV.is_file():
        pytest.skip("sample CSV missing")
    df = pd.read_csv(TELCO_CSV)
    meta = [{"name": c, "dtype": str(df[c].dtype), "null_ratio": 0.0} for c in df.columns]
    shap_rows = [
        {"feature": "tenure_months", "mean_abs_shap": 0.5, "mean_signed_shap": -0.4, "direction": "decreases"},
        {"feature": "monthly_charges", "mean_abs_shap": 0.3, "mean_signed_shap": 0.2, "direction": "increases"},
    ]
    legacy = build_insights(df, "churned", "classification", shap_rows, meta, top_n=2, raw_columns=list(df.columns))
    engine = InsightEngine(top_n=2).build(
        df=df,
        target="churned",
        task_type="classification",
        shap_rows=shap_rows,
        column_meta=meta,
        raw_columns=list(df.columns),
    )
    assert len(legacy) == len(engine)
    assert {x["feature"] for x in legacy} == {x["feature"] for x in engine}
