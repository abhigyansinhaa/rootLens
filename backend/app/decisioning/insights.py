"""Root-cause style insights from SHAP-ranked features with grouping and confidence."""

from __future__ import annotations

import json
from typing import Any, Literal

import numpy as np
import pandas as pd

from app.pipelines.common import TaskType

ConfidenceLevel = Literal["high", "medium", "low"]
SeverityLevel = Literal["informational", "warning", "critical"]


def _base_column_name(feature: str) -> str:
    # One-hot column: prefix_rest — map to prefix (first segment)
    if "_" in feature:
        return feature.split("_", 1)[0]
    return feature


def _longest_prefix_column(fname: str, raw_cols: list[str]) -> tuple[str | None, str | None]:
    """Map sklearn-style dummy ``Contract_Month-to-month`` → base ``Contract``, level ``Month-to-month``."""
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
    if raw_cols:
        base, _lvl = _longest_prefix_column(fname, raw_cols)
        if base is not None:
            return base
    return _base_column_name(fname)


def _subject_clause_for_driver(fname: str, stem: str, df: pd.DataFrame, raw_cols: list[str] | None) -> str:
    """Human-readable subject for narratives (avoids \"higher OnlineSecurity\" on ``OnlineSecurity_No`` dummies)."""
    cols = raw_cols or []
    base, level = _longest_prefix_column(fname, cols) if cols else (None, None)
    if (
        base is not None
        and level is not None
        and base in df.columns
        and not pd.api.types.is_numeric_dtype(df[base])
    ):
        return f"customers where '{base}' is '{level}'"
    if stem in df.columns and pd.api.types.is_numeric_dtype(df[stem]):
        return f"customers with higher '{stem}'"
    return f"customers with higher activation on encoded feature '{fname}'"


def aggregate_shap_by_column(
    shap_rows: list[dict[str, Any]],
    top_k: int = 10,
    raw_columns: list[str] | None = None,
) -> list[dict[str, Any]]:
    """Sum mean_abs_shap for dummy columns sharing the same stem (e.g. cat prefix)."""
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


def _investigation_questions(stem: str, target: str) -> list[str]:
    s = stem.lower()
    t = target.lower()
    qs: list[str] = [
        f"Has '{stem}' changed in distribution versus prior periods?",
        f"Are segments with extreme '{stem}' getting different treatment or pricing?",
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


def _severity_for_row(strength: float, null_ratio: float, confidence: ConfidenceLevel) -> SeverityLevel:
    if confidence == "low" or null_ratio > 0.35 or strength < 0.02:
        return "warning"
    if strength > 0.15 and confidence == "high":
        return "critical"
    if strength > 0.08:
        return "warning"
    return "informational"


def _narrative_frame(
    stem: str,
    target: str,
    direction: str,
    strength: float,
    confidence: ConfidenceLevel,
    corr_txt: str | None,
    null_note: str | None,
    stability_note: str | None,
    frame_idx: int,
    subject_clause: str,
) -> str:
    conf_adj = {"high": "High-confidence", "medium": "Moderate", "low": "Tentative"}[confidence]
    dir_phrase = "pushes predictions toward higher risk" if direction == "increases" else "is associated with lower risk in the model"
    behavioral = (
        f"{conf_adj} pattern: {subject_clause} {dir_phrase} for '{target}'. "
        f"This reads as a behavioral segmentation signal — validate with retention cohort reviews."
    )
    operational = (
        f"Operational lens: '{stem}' is among the strongest levers in this model for '{target}'. "
        f"Consider whether teams can influence this field through policy, packaging, or service design "
        f"({direction} encoded values correlate with risk)."
    )
    economic = (
        f"Economic framing: '{stem}' ranks in the top drivers by mean |impact| ≈ {strength:.4f}. "
        f"If this association holds out-of-sample, interventions that move '{stem}' could re-rank margin "
        f"at risk — {corr_txt or 'pair with unit economics before funding at scale'}."
    )
    frames = [behavioral, operational, economic]
    base = frames[frame_idx % 3]
    if corr_txt:
        base += f" {corr_txt}"
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
    """Correlation / SHAP-based insight strings with confidence + severity + follow-ups."""
    meta_by_name = {m["name"]: m for m in column_meta}
    ranked = sorted(shap_rows, key=lambda r: -r["mean_abs_shap"])[:top_n]
    insights: list[dict[str, Any]] = []

    rc = raw_columns if raw_columns is not None else [str(m["name"]) for m in column_meta if m.get("name")]
    for idx, r in enumerate(ranked):
        fname = r["feature"]
        stem = _group_key_for_feature(fname, rc)
        direction = r["direction"]
        strength = r["mean_abs_shap"]
        subject_clause = _subject_clause_for_driver(fname, stem, df, rc)

        corr_txt: str | None = None
        if stem in df.columns and pd.api.types.is_numeric_dtype(df[stem]):
            try:
                sub = df[[stem, target]].dropna()
                if len(sub) > 5:
                    corr = sub[stem].corr(pd.to_numeric(sub[target], errors="coerce"))
                    if corr is not None and not np.isnan(corr):
                        corr_txt = f"Raw correlation with '{target}' is {corr:+.3f} (descriptive only)."
            except Exception:
                pass

        null_note = None
        null_ratio = float(meta_by_name.get(stem, {}).get("null_ratio") or 0)
        if stem in meta_by_name and null_ratio > 0.3:
            null_note = (
                f"Note: '{stem}' has ~{null_ratio * 100:.0f}% missing values; treat this signal carefully "
                "until data quality improves."
            )

        stability_note = explanation_stability if idx == 0 and explanation_stability else None

        text = _narrative_frame(
            stem,
            target,
            direction,
            strength,
            confidence,
            corr_txt,
            null_note,
            stability_note,
            idx,
            subject_clause,
        )

        severity = _severity_for_row(strength, null_ratio, confidence)

        insights.append(
            {
                "feature": fname,
                "grouped_feature": stem,
                "kind": "driver",
                "task_type": task_type,
                "summary": text,
                "mean_abs_shap": strength,
                "confidence": confidence,
                "severity": severity,
                "investigation_questions": _investigation_questions(stem, target),
            }
        )

    return insights


def insights_to_json(insights: list[dict[str, Any]]) -> str:
    return json.dumps(insights)
