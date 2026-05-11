"""Back-compat shim: canonical implementation lives at `app.decisioning.messages`."""

from app.decisioning.messages import *  # noqa: F401,F403
from app.decisioning.messages import (  # noqa: F401
    GOODWILL_EXPLANATION_FALLBACK,
    GOODWILL_FAILURE_SHORT,
    GOODWILL_FAILURE_SUPPORT,
    GOODWILL_PARTIAL,
    GOODWILL_PLOT_SKIPPED,
    GOODWILL_TRAINING_FALLBACK,
    combined_user_message,
    failure_message_for_user,
)

__all__ = [
    "GOODWILL_EXPLANATION_FALLBACK",
    "GOODWILL_FAILURE_SHORT",
    "GOODWILL_FAILURE_SUPPORT",
    "GOODWILL_PARTIAL",
    "GOODWILL_PLOT_SKIPPED",
    "GOODWILL_TRAINING_FALLBACK",
    "combined_user_message",
    "failure_message_for_user",
]
