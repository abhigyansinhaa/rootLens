"""KPI computation package.

The orchestrator lives in :mod:`app.decisioning.kpi_engine` (``KpiEngine`` +
back-compat ``compute_kpis``). Per-KPI math lives in dedicated submodules:
* :mod:`concentration` — Lorenz / Pareto / Gini.
* :mod:`reliability` — model reliability tier + hint.
* :mod:`driver_impact` — SHAP-zeroing and linear-share approximations.
* :mod:`segment_value` — risk-segment bucketing.
* :mod:`monetization` — revenue-at-risk roll-ups.

``KpiEngine`` and ``compute_kpis`` are re-exported lazily through
``__getattr__`` so the per-KPI submodules can be imported by the engine
without triggering a circular package initialization.
"""

from __future__ import annotations

from typing import Any

__all__ = ["KpiEngine", "compute_kpis"]


def __getattr__(name: str) -> Any:
    if name in ("KpiEngine", "compute_kpis"):
        from app.decisioning import kpi_engine as _kpi_engine

        return getattr(_kpi_engine, name)
    raise AttributeError(f"module 'app.decisioning.kpis' has no attribute {name!r}")
