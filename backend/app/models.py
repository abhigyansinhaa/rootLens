"""Back-compat shim: canonical implementation lives at `app.domain.models`."""

from app.domain.models import Analysis, Dataset, FeatureRegistryEntry, User  # noqa: F401

__all__ = ["Analysis", "Dataset", "FeatureRegistryEntry", "User"]
