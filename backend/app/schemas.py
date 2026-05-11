"""Back-compat shim: canonical schemas live at `app.domain.schemas`."""

from app.domain.schemas import (  # noqa: F401
    AnalysisCreate,
    AnalysisListItem,
    AnalysisOut,
    ColumnSchema,
    ColumnSchemaJson,
    DatasetCreateResponse,
    DatasetOut,
    DatasetProfileOut,
    DatasetProfileRequest,
    FeatureRegistryEntryOut,
    FeatureRegistryEntryPatch,
    FeatureRegistryListOut,
    Token,
    UserCreate,
    UserLogin,
    UserOut,
)

__all__ = [
    "AnalysisCreate",
    "AnalysisListItem",
    "AnalysisOut",
    "ColumnSchema",
    "ColumnSchemaJson",
    "DatasetCreateResponse",
    "DatasetOut",
    "DatasetProfileOut",
    "DatasetProfileRequest",
    "FeatureRegistryEntryOut",
    "FeatureRegistryEntryPatch",
    "FeatureRegistryListOut",
    "Token",
    "UserCreate",
    "UserLogin",
    "UserOut",
]
