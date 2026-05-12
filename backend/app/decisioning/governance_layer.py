"""Central collection of quality / trust signals for the analysis report (additive)."""

from __future__ import annotations

from typing import Any


def build_quality_signals(
    *,
    profile_warnings: list[str] | None,
    training_warnings: list[str] | None,
    data_warnings: list[str] | None,
    fallbacks: list[str] | None,
    degraded_components: list[str] | None,
) -> list[dict[str, Any]]:
    """Structured chips for UI; each item is JSON-serializable."""
    out: list[dict[str, Any]] = []
    for w in profile_warnings or []:
        out.append({"scope": "profile", "severity": "warning", "message": str(w)})
    for w in training_warnings or []:
        out.append({"scope": "training", "severity": "warning", "message": str(w)})
    for w in data_warnings or []:
        sev = "critical" if any(k in str(w).lower() for k in ("leakage", "identifier")) else "warning"
        out.append({"scope": "data", "severity": sev, "message": str(w)})
    for w in fallbacks or []:
        out.append({"scope": "fallback", "severity": "info", "message": str(w)})
    for d in degraded_components or []:
        out.append({"scope": "component", "severity": "warning", "message": f"Degraded: {d}"})
    return out
