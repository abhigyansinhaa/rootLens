"""Back-compat shim: canonical implementation lives at `app.pipelines.profile`."""

from app.pipelines.profile import *  # noqa: F401,F403
from app.pipelines.profile import ProfileResult, profile_dataset_for_target  # noqa: F401

__all__ = ["ProfileResult", "profile_dataset_for_target"]
