"""Governance summary builder for the analysis report.

The analysis JSON adds a ``report.governance`` block on top of the
existing per-section warnings/fallbacks so the frontend can render a single
"compliance signal" without scraping every other field. It is additive — the
existing JSON fields (``data_warnings``, ``fallbacks``, ``degraded_components``,
``reliability``, ``driver_impact``) stay exactly as they were.

The block reports three things:
* Aggregated counts of warnings and degraded components, plus a per-class
  breakdown (data quality, leakage, training fallback, plot failure).
* Confidence/reliability snapshot pulled from the freshly-computed KPIs.
* Governance coverage: how many dataset columns have at least one annotation
  in the ``feature_registry`` table.

The output also includes the thresholds used to decide the headline status so
operators can reason about why a run landed on ``ok`` / ``warning`` /
``critical`` without re-reading the docs.
"""

from __future__ import annotations

import logging
from typing import Any, Literal

from sqlalchemy.orm import Session

from app.domain.models import FeatureRegistryEntry

logger = logging.getLogger(__name__)

GovernanceStatus = Literal["ok", "warning", "critical"]

LEAKAGE_WARN_TRIGGER = 1
DEGRADED_WARN_TRIGGER = 1
GOVERNANCE_COVERAGE_FLOOR = 0.5
RELIABILITY_LOW_CRITICAL = True


def _classify_warning(text: str) -> str:
    """Map a free-text warning to a short bucket label."""
    t = (text or "").lower()
    if "potential leakage" in t:
        return "leakage"
    if "looks identifier-like" in t or "id-like" in t:
        return "leakage"
    if "extremely-high-cardinality" in t or "dropped" in t and "high-cardinality" in t:
        return "data_quality"
    if "missing" in t or "null" in t:
        return "data_quality"
    return "data_quality"


def _governance_coverage(
    db: Session | None,
    user_id: int | None,
    dataset_id: int | None,
    dataset_columns: list[str],
) -> dict[str, Any]:
    """Compute (governed_count, total_columns, coverage)."""
    total = len([c for c in dataset_columns if c])
    if db is None or user_id is None or dataset_id is None or total == 0:
        return {"governed_columns": 0, "total_columns": total, "coverage": 0.0}
    try:
        rows = (
            db.query(FeatureRegistryEntry)
            .filter(
                FeatureRegistryEntry.user_id == user_id,
                FeatureRegistryEntry.dataset_id == dataset_id,
            )
            .all()
        )
    except Exception as e:
        logger.info("Governance coverage query failed: %s", e)
        return {"governed_columns": 0, "total_columns": total, "coverage": 0.0}

    column_set = {c for c in dataset_columns if c}
    governed = 0
    for r in rows:
        if r.feature_name not in column_set:
            continue
        if any(
            (v is not None and str(v).strip() != "")
            for v in (r.owner, r.business_definition, r.allowed_use, r.notes)
        ):
            governed += 1
    return {
        "governed_columns": int(governed),
        "total_columns": int(total),
        "coverage": float(governed) / float(total) if total else 0.0,
    }


def build_governance_block(
    *,
    data_warnings: list[str],
    fallbacks: list[str],
    degraded_components: list[str],
    kpis: dict[str, Any] | None,
    pipeline_version: str | None,
    encoder_version: str | None,
    dataset_hash: str | None,
    schema_hash: str | None,
    dataset_columns: list[str],
    db: Session | None = None,
    user_id: int | None = None,
    dataset_id: int | None = None,
) -> dict[str, Any]:
    """Return the governance dict to attach as ``report["governance"]``."""
    warnings = list(data_warnings or [])
    buckets: dict[str, list[str]] = {"data_quality": [], "leakage": []}
    for w in warnings:
        buckets.setdefault(_classify_warning(w), []).append(w)

    reliability = (kpis or {}).get("reliability") or {}
    reliability_tier = str(reliability.get("tier") or "unknown")
    driver_impact = (kpis or {}).get("driver_impact") or {}
    top1 = driver_impact.get("top1") or {}
    top1_conf = str(top1.get("confidence_tier") or "unknown")

    coverage = _governance_coverage(db, user_id, dataset_id, dataset_columns)

    leakage_count = len(buckets.get("leakage", []))
    degraded_count = len(degraded_components or [])

    status: GovernanceStatus = "ok"
    reasons: list[str] = []
    if reliability_tier == "low" and RELIABILITY_LOW_CRITICAL:
        status = "critical"
        reasons.append("Model reliability tier is low.")
    if leakage_count >= LEAKAGE_WARN_TRIGGER:
        if status != "critical":
            status = "warning"
        reasons.append(f"{leakage_count} potential leakage signal(s) detected.")
    if degraded_count >= DEGRADED_WARN_TRIGGER:
        if status != "critical":
            status = "warning"
        reasons.append(f"{degraded_count} pipeline component(s) ran in degraded mode.")
    if coverage["total_columns"] > 0 and coverage["coverage"] < GOVERNANCE_COVERAGE_FLOOR:
        if status == "ok":
            status = "warning"
        reasons.append(
            f"Only {coverage['governed_columns']} of {coverage['total_columns']} columns "
            "have governance annotations."
        )

    return {
        "status": status,
        "reasons": reasons,
        "warnings": {
            "total": len(warnings),
            "by_category": {k: len(v) for k, v in buckets.items() if v},
            "data_quality": buckets.get("data_quality", []),
            "leakage": buckets.get("leakage", []),
        },
        "fallbacks": list(fallbacks or []),
        "degraded_components": sorted(set(degraded_components or [])),
        "reliability": {
            "tier": reliability_tier,
            "headline_metric": reliability.get("headline_metric"),
            "headline_value": reliability.get("headline_value"),
        },
        "top_driver_confidence_tier": top1_conf,
        "feature_governance": coverage,
        "versions": {
            "pipeline_version": pipeline_version,
            "encoder_version": encoder_version,
            "dataset_hash": dataset_hash,
            "schema_hash": schema_hash,
        },
        "thresholds": {
            "leakage_warn_trigger": LEAKAGE_WARN_TRIGGER,
            "degraded_warn_trigger": DEGRADED_WARN_TRIGGER,
            "governance_coverage_floor": GOVERNANCE_COVERAGE_FLOOR,
            "reliability_low_is_critical": RELIABILITY_LOW_CRITICAL,
        },
    }
