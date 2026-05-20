"""Telco churn: explanation direction must match canonical risk patterns."""
from __future__ import annotations

from pathlib import Path

import pandas as pd
import pytest

from app.pipelines.explain import compute_explanations
from app.pipelines.pipeline import train_model

TELCO_CSV = Path(__file__).resolve().parents[2] / "data" / "samples" / "customer_churn.csv"


def test_telco_dummy_directions_match_domain_on_sample_churn():
    """Runtime-checked on bundled customer_churn.csv (target churned, 0/1)."""
    if not TELCO_CSV.is_file():
        pytest.skip("sample churn CSV missing")

    df = pd.read_csv(TELCO_CSV)
    res = train_model(df, "churned", max_rows=3000)
    assert res.model_kind in ("xgboost", "random_forest")

    import tempfile
    from pathlib import Path as P

    art = P(tempfile.mkdtemp())
    rows, _ = compute_explanations(
        res.model,
        res.X_test,
        res.feature_names,
        art,
        res.model_kind,
        res.task_type,
        label_encoder=res.label_encoder,
    )
    by_name = {r["feature"]: r for r in rows}

    # month-to-month and no online security should increase churn risk
    mtm = by_name.get("contract_type_month-to-month")
    os_no = by_name.get("online_security_no")
    tenure = by_name.get("tenure_months")
    assert mtm is not None, by_name.keys()
    assert os_no is not None
    assert tenure is not None

    mc = by_name.get("monthly_charges")
    assert mc is not None

    assert mtm["direction"] == "increases", mtm
    assert os_no["direction"] == "increases", os_no
    assert tenure["direction"] == "decreases", tenure
    # Sample generator logit uses +0.012*(charges-70); model P(churn|high)>P(low)
    assert mc["direction"] == "increases", mc
