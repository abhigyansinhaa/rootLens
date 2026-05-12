"""Trust / disclaimer strings stored on the report for exports and audits."""

from __future__ import annotations

COUNTERFACTUAL_CAUSAL_DISCLAIMER = (
    "Scenario estimates are based on modeled associations from this dataset. "
    "They are not guaranteed causal outcomes and should be validated with experiments "
    "or domain review before large budgets are committed."
)

CORRELATION_NOT_CAUSATION_SHORT = (
    "Correlation is not causation: strong drivers show statistical association with the target, "
    "not proof that changing them will move outcomes as shown."
)

ROI_ASSUMPTIONS_CLIENT_ONLY = (
    "ROI and cost assumptions on this page are for discussion only unless saved to a governed "
    "configuration; they are not persisted with this analysis run."
)
