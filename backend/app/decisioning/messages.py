"""User-facing copy for degraded paths and failures (production-safe, no stack traces)."""

# Shown when we still deliver a completed analysis with reduced fidelity
GOODWILL_PARTIAL = (
    "We finished your analysis using a backup method so you still get useful direction. "
    "Rankings may be slightly less precise than our full pipeline; treat them as strong hints, not guarantees."
)

GOODWILL_TRAINING_FALLBACK = (
    "The primary model hit a snag, so we automatically switched to a simpler, more robust model. "
    "Your metrics and driver list are still trustworthy for prioritization."
)

GOODWILL_EXPLANATION_FALLBACK = (
    "Detailed SHAP plots were skipped or simplified, but feature importance still reflects how the model "
    "uses each field. You can re-run later if the service was under heavy load."
)

GOODWILL_PLOT_SKIPPED = (
    "We could not render the summary chart, but the numbers and rankings below are unchanged."
)

# Generic failure (no partial result) — short, calm, actionable
GOODWILL_FAILURE_SHORT = (
    "Something went wrong while analyzing your dataset. Our team can help if this keeps happening. "
    "Try again in a moment, confirm your target column is suitable, or use a smaller sample of rows."
)

GOODWILL_FAILURE_SUPPORT = (
    "If the problem continues, share your dataset format (CSV/Parquet) and target column name with support."
)


def combined_user_message(fallback_notes: list[str]) -> str | None:
    """Single paragraph for report.user_message when any fallback ran."""
    if not fallback_notes:
        return None
    unique = list(dict.fromkeys(n for n in fallback_notes if n.strip()))
    parts = [GOODWILL_PARTIAL]
    parts.extend(unique[:4])
    return " ".join(parts)


def failure_message_for_user(technical: str | None = None) -> str:
    """Safe message stored on failed analyses (no stack traces)."""
    base = f"{GOODWILL_FAILURE_SHORT} {GOODWILL_FAILURE_SUPPORT}"
    if technical and len(technical) < 200 and "\n" not in technical:
        return f"{base} ({technical})"
    return base
