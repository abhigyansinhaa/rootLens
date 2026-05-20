"""Root-cause style insights from SHAP-ranked features with grouping and confidence."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Literal

import numpy as np
import pandas as pd

from app.decisioning.driver_labels import format_driver_label, humanize_target_label
from app.pipelines.common import TaskType

ConfidenceLevel = Literal["high", "medium", "low"]
SeverityLevel = Literal["informational", "warning", "critical"]


def _longest_prefix_column(fname: str, raw_cols: list[str]) -> tuple[str | None, str | None]:
    """Map sklearn dummy ``Contract_Month-to-month`` → base ``Contract``, level ``Month-to-month``."""
    best: str | None = None
    best_len = -1
    for col in raw_cols:
        cs = str(col)
        if fname == cs:
            return cs, None
        pref = f"{cs}_"
        if fname.startswith(pref) and len(cs) > best_len:
            best = cs
            best_len = len(cs)
    if best is None:
        return None, None
    rest = fname[len(best) + 1 :]
    return best, rest or None


def _group_key_for_feature(fname: str, raw_cols: list[str] | None) -> str:
    """Group key for aggregation — never truncate snake_case numeric columns."""
    if raw_cols:
        if fname in raw_cols:
            return fname
        base, _lvl = _longest_prefix_column(fname, raw_cols)
        if base is not None:
            return base
    return fname


def _is_categorical_driver(
    fname: str,
    df: pd.DataFrame,
    raw_cols: list[str] | None,
) -> bool:
    cols = raw_cols or []
    base, level = _longest_prefix_column(fname, cols) if cols else (None, None)
    return (
        base is not None
        and level is not None
        and base in df.columns
        and not pd.api.types.is_numeric_dtype(df[base])
    )


def _risk_statement(
    display_label: str,
    direction: str,
    target: str,
    *,
    is_numeric: bool,
) -> str:
    """Fluent risk line preserving direction (behavioral / economic / operational)."""
    target_h = humanize_target_label(target)
    risk = f"predicted {target_h} risk"
    if is_numeric:
        if direction == "increases":
            return f"Higher {display_label} is associated with higher {risk}."
        return f"Higher {display_label} is associated with lower {risk}."
    if direction == "increases":
        return f"{display_label} show higher {risk}."
    return f"{display_label} show lower {risk}."


def _economic_context(display_label: str) -> str:
    bl = display_label.lower()
    if any(k in bl for k in ("charge", "bill", "monthly", "payment")):
        return (
            "Because billing variables directly affect exposure, pricing interventions should be "
            "validated against margin retention."
        )
    if "contract" in bl:
        return (
            "Contract mix shifts retention economics—validate margin and save rates before "
            "changing term policies."
        )
    if "internet" in bl or "fiber" in bl or "dsl" in bl:
        return "Product-tier mix can shift support load and save economics—pilot before broad retiering."
    if "security" in bl or "support" in bl or "tech" in bl:
        return "Addon and support coverage may reduce save cost—validate attach economics before scaling offers."
    return (
        "Because this driver ranks among the top model signals, validate intervention economics "
        "experimentally before scaling changes."
    )


def _raw_correlation(stem: str, target: str, df: pd.DataFrame) -> float | None:
    if stem not in df.columns or not pd.api.types.is_numeric_dtype(df[stem]):
        return None
    try:
        sub = df[[stem, target]].dropna()
        if len(sub) <= 5:
            return None
        corr = sub[stem].corr(pd.to_numeric(sub[target], errors="coerce"))
        if corr is None or np.isnan(corr):
            return None
        return float(corr)
    except Exception:
        return None


def _correlation_attribution_note(
    corr: float | None,
    direction: str,
) -> tuple[str | None, bool | None]:
    """Return (note text, agreement flag). ``agreement`` is None when corr undefined."""
    if corr is None:
        return None, None
    shap_sign = 1 if direction == "increases" else -1
    if abs(corr) < 1e-9:
        return f"Raw correlation with target is {corr:+.3f} (descriptive only).", None
    corr_sign = 1 if corr > 0 else -1
    base = f"Raw correlation with target is {corr:+.3f}."
    if corr_sign == shap_sign:
        return (
            base + " Directional agreement observed between raw correlation and model attribution.",
            True,
        )
    return (
        base
        + " Model contribution direction differs from simple correlation, suggesting "
        "interaction effects or nonlinear behavior.",
        False,
    )


def _strength_percentile(strength: float, all_strengths: list[float]) -> float:
    if not all_strengths:
        return 1.0
    arr = np.asarray(all_strengths, dtype=float)
    if arr.size <= 1:
        return 0.0
    return float(np.mean(arr >= strength))


def _confidence_for_insight_row(
    *,
    strength: float,
    strength_pct: float,
    null_ratio: float,
    unstable: bool,
    shap_corr_agree: bool | None,
    rank_idx: int,
    n_displayed: int,
) -> ConfidenceLevel:
    """Row-level confidence — avoid collapsing every top-N driver to HIGH."""
    score = 0
    if rank_idx == 0:
        score += 2
    elif rank_idx <= max(0, int(n_displayed * 0.25) - 1):
        score += 1
    if strength_pct <= 0.10:
        score += 1
    elif strength_pct <= 0.25:
        score += 0
    if strength >= 0.08:
        score += 1
    elif strength >= 0.04:
        score += 0
    if null_ratio <= 0.10:
        score += 1
    elif null_ratio > 0.35:
        score -= 2
    elif null_ratio > 0.20:
        score -= 1
    if unstable:
        score -= 2
    if shap_corr_agree is True:
        score += 1
    elif shap_corr_agree is False:
        score -= 2

    if score >= 5:
        return "high"
    if score >= 3:
        return "medium"
    return "low"


def _severity_for_row(
    *,
    rank_idx: int,
    n_displayed: int,
    strength_pct: float,
    null_ratio: float,
    confidence: ConfidenceLevel,
) -> SeverityLevel:
    """Top decile of displayed cohort → critical; next 20% → warning; else informational."""
    if null_ratio > 0.35 or confidence == "low":
        return "informational"
    top_cut = max(1, int(np.ceil(n_displayed * 0.10)))
    warn_cut = max(top_cut, int(np.ceil(n_displayed * 0.30)))
    if rank_idx < top_cut and strength_pct <= 0.10:
        return "critical"
    if rank_idx < warn_cut:
        return "warning"
    return "informational"


def aggregate_shap_by_column(
    shap_rows: list[dict[str, Any]],
    top_k: int = 10,
    raw_columns: list[str] | None = None,
) -> list[dict[str, Any]]:
    """Sum mean_abs_shap / mean_signed_shap for dummy columns sharing the same stem."""
    from collections import defaultdict

    agg_abs: dict[str, float] = defaultdict(float)
    agg_signed: dict[str, float] = defaultdict(float)
    for r in shap_rows:
        name = r["feature"]
        stem = _group_key_for_feature(name, raw_columns)
        agg_abs[stem] += r["mean_abs_shap"]
        agg_signed[stem] += r["mean_signed_shap"]

    combined = [
        {
            "feature": k,
            "mean_abs_shap": v,
            "mean_signed_shap": agg_signed[k],
            "direction": "increases" if agg_signed[k] >= 0 else "decreases",
        }
        for k, v in sorted(agg_abs.items(), key=lambda x: -x[1])
    ]
    return combined[:top_k]


def _investigation_questions(stem: str, target: str, raw_cols: list[str] | None) -> list[str]:
    label = format_driver_label(stem, raw_cols)
    s = stem.lower()
    t = humanize_target_label(target).lower()
    qs: list[str] = [
        f"Has {label} changed in distribution versus prior periods?",
        f"Are segments with extreme {label} getting different treatment or pricing?",
    ]
    if "contract" in s or "month" in s:
        qs.append("Did recent contract or term policy changes coincide with timing of {}".format(t))
    if "charge" in s or "price" in s or "monthly" in s or "bill" in s:
        qs.append("Were there billing or price adjustments that land hardest on high-risk cohorts?")
    if "tenure" in s or "seniority" in s:
        qs.append("Is onboarding or early-life support weaker for newer accounts?")
    if "support" in s or "ticket" in s:
        qs.append("Are support SLAs or contact channel mix correlated with save rates?")
    return qs[:4]


def _narrative_frame(
    *,
    display_label: str,
    target: str,
    direction: str,
    strength: float,
    confidence: ConfidenceLevel,
    is_categorical: bool,
    corr_note: str | None,
    null_note: str | None,
    stability_note: str | None,
    frame_idx: int,
) -> str:
    conf_adj = {
        "high": "High-confidence",
        "medium": "Moderate signal",
        "low": "Tentative association",
    }[confidence]
    target_h = humanize_target_label(target)
    risk_line = _risk_statement(
        display_label,
        direction,
        target,
        is_numeric=not is_categorical,
    )
    op_dir = "increases" if direction == "increases" else "reduces"

    behavioral = (
        f"{conf_adj}: {risk_line} "
        f"This reads as a behavioral model signal — validate experimentally with retention cohort reviews."
    )
    operational = (
        f"Operational lens: {display_label} is among the strongest model signals for {target_h} "
        f"(mean |SHAP| ≈ {strength:.4f}). In this model, this feature is associated with {op_dir} predicted "
        f"{target_h} risk — validate with domain owners before operational changes."
    )
    economic = (
        f"Economic framing: {risk_line.rstrip('.')} (mean |SHAP| ≈ {strength:.4f}). "
        f"{_economic_context(display_label)}"
    )
    frames = [behavioral, operational, economic]
    base = frames[frame_idx % 3]
    if corr_note:
        base += f" {corr_note}"
    if null_note:
        base += f" {null_note}"
    if stability_note:
        base += f" {stability_note}"
    return base


def build_insights(
    df: pd.DataFrame,
    target: str,
    task_type: TaskType,
    shap_rows: list[dict[str, Any]],
    column_meta: list[dict[str, Any]],
    top_n: int = 8,
    confidence: ConfidenceLevel = "medium",
    explanation_stability: str | None = None,
    raw_columns: list[str] | None = None,
) -> list[dict[str, Any]]:
    """SHAP-ranked insight strings with per-driver confidence, severity, and correlation checks."""
    del confidence  # per-driver confidence derived below
    meta_by_name = {m["name"]: m for m in column_meta}
    ranked = sorted(shap_rows, key=lambda r: -r["mean_abs_shap"])[:top_n]
    all_strengths = [float(r["mean_abs_shap"]) for r in shap_rows]
    insights: list[dict[str, Any]] = []

    rc = raw_columns if raw_columns is not None else [str(m["name"]) for m in column_meta if m.get("name")]
    n_displayed = len(ranked)
    for idx, r in enumerate(ranked):
        fname = r["feature"]
        stem = _group_key_for_feature(fname, rc)
        direction = r["direction"]
        strength = float(r["mean_abs_shap"])
        display_label = format_driver_label(fname, rc)
        is_cat = _is_categorical_driver(fname, df, rc)

        corr = _raw_correlation(stem, target, df)
        corr_note, shap_corr_agree = _correlation_attribution_note(corr, direction)

        null_ratio = float(meta_by_name.get(stem, {}).get("null_ratio") or 0)
        null_note = None
        if stem in meta_by_name and null_ratio > 0.3:
            stem_label = format_driver_label(stem, rc)
            null_note = (
                f"Note: {stem_label} has ~{null_ratio * 100:.0f}% missing values; treat this signal carefully "
                "until data quality improves."
            )

        unstable = bool(explanation_stability)
        strength_pct = _strength_percentile(strength, all_strengths)
        row_confidence = _confidence_for_insight_row(
            strength=strength,
            strength_pct=strength_pct,
            null_ratio=null_ratio,
            unstable=unstable,
            shap_corr_agree=shap_corr_agree,
            rank_idx=idx,
            n_displayed=n_displayed,
        )
        stability_note = explanation_stability if idx == 0 and explanation_stability else None

        text = _narrative_frame(
            display_label=display_label,
            target=target,
            direction=direction,
            strength=strength,
            confidence=row_confidence,
            is_categorical=is_cat,
            corr_note=corr_note,
            null_note=null_note,
            stability_note=stability_note,
            frame_idx=idx,
        )

        severity = _severity_for_row(
            rank_idx=idx,
            n_displayed=n_displayed,
            strength_pct=strength_pct,
            null_ratio=null_ratio,
            confidence=row_confidence,
        )

        insights.append(
            {
                "feature": fname,
                "display_label": display_label,
                "grouped_feature": stem,
                "kind": "driver",
                "task_type": task_type,
                "summary": text,
                "mean_abs_shap": strength,
                "mean_signed_shap": float(r.get("mean_signed_shap", 0.0)),
                "direction": direction,
                "confidence": row_confidence,
                "severity": severity,
                "investigation_questions": _investigation_questions(stem, target, rc),
                "correlation_agreement": shap_corr_agree,
            }
        )

    # #region agent log
    try:
        _log_path = Path(__file__).resolve().parents[3] / "debug-d20984.log"
        _payload = {
            "sessionId": "d20984",
            "hypothesisId": "H-calibration",
            "location": "insights.py:build_insights",
            "message": "insight_calibration_distribution",
            "data": {
                "n": len(insights),
                "confidence": {c: sum(1 for i in insights if i["confidence"] == c) for c in ("high", "medium", "low")},
                "severity": {s: sum(1 for i in insights if i["severity"] == s) for s in ("critical", "warning", "informational")},
                "sample_economic": next(
                    (i["summary"] for i in insights if "Economic framing" in i["summary"]),
                    insights[0]["summary"][:120] if insights else "",
                ),
            },
            "timestamp": int(__import__("time").time() * 1000),
            "runId": "audit",
        }
        with _log_path.open("a", encoding="utf-8") as _f:
            _f.write(json.dumps(_payload) + "\n")
    except Exception:
        pass
    # #endregion

    return insights


def format_forensic_insight_table(
    df: pd.DataFrame,
    target: str,
    insights: list[dict[str, Any]],
) -> str:
    """Human-readable forensic table for tests and operator diagnostics."""
    lines = [
        "feature | corr_sign | corr_value | mean_signed_shap | confidence | severity | narrative",
        "--------|-----------|------------|------------------|------------|----------|----------",
    ]
    for ins in insights:
        feat = str(ins.get("feature", ""))
        stem = str(ins.get("grouped_feature", feat))
        corr = _raw_correlation(stem, target, df)
        if corr is None:
            corr_sign = "na"
            corr_val = "na"
        elif corr > 0:
            corr_sign, corr_val = "+", f"{corr:+.4f}"
        elif corr < 0:
            corr_sign, corr_val = "-", f"{corr:+.4f}"
        else:
            corr_sign, corr_val = "0", "0.0000"
        signed = ins.get("mean_signed_shap", "na")
        summary = str(ins.get("summary", ""))[:80].replace("\n", " ")
        lines.append(
            f"{feat} | {corr_sign} | {corr_val} | {signed!s} | {ins.get('confidence')} | "
            f"{ins.get('severity')} | {summary}..."
        )
    return "\n".join(lines)


def insights_to_json(insights: list[dict[str, Any]]) -> str:
    return json.dumps(insights)
