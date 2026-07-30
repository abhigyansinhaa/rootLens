# Thresholds & Magic Constants Catalog

This document tracks all heuristic thresholds, configuration bounds, and magic constants used in the RootLens backend.
All values listed here correspond to variables defined centrally in `app/thresholds.py`.

## 1. Dataset Profiling (`profile.py`)

*   **`MIN_ROWS_FOR_ANALYSIS = 10`**: Absolute minimum dataset size to allow any analysis to start.
*   **`MIN_ROWS_RECOMMENDED = 50`**: Soft floor for dataset size; below this, UI warnings suggest more data.
*   **`MAX_CLASSIFICATION_CARDINALITY = 50`**: The max number of unique target levels we support for multiclass classification. (Currently only binary is supported).
*   **`ID_LIKE_UNIQUE_RATIO = 0.5`**: If >50% of the values in a column are unique, it's flagged as potentially ID-like.
*   **`HIGH_NULL_RATIO = 0.5`**: If a column is >50% nulls, it's flagged as having high missingness.
*   **`HIGH_CARD_CAT_UNIQUE = 100`**: Threshold where a categorical column is considered "high cardinality" and warrants different encoding.
*   **`LEAKAGE_NAME_SUBSTR = ("id", "uuid", "email", "phone", "ssn", "hash")`**: Column name substrings that auto-flag for PII/Leakage risk.
*   **`LEAKAGE_CORR_ABS_THRESHOLD = 0.98`**: Absolute correlation threshold above which a feature is flagged as a leakage risk (target disguised as feature).
*   **`LEAKAGE_MI_SCORE_THRESHOLD = 0.95`**: Normalized Mutual Information (MI) threshold for leakage detection.
*   **`LEAKAGE_MI_SAMPLE_ROWS = 5000`**: Max rows sampled when computing Mutual Information for leakage to cap CPU usage.

## 2. Pipeline & Encoders (`pipeline.py`, `encoders.py`)

*   **`MAX_CAT_LEVELS = 25`**: Number of levels allowed before we enforce High Cardinality fallbacks (e.g., Target Encoding or Frequency Encoding).
*   **`HIGH_CARD_MIN = 26` / `HIGH_CARD_MAX = 300`**: Bounds used by encoders to bucket features dynamically.
*   **`ENCODER_VERSION = "v2"`**: Cache/persistence tag. Changing this invalidates cached pipeline models.
*   **`RANDOM_STATE = 42`**: Global fixed random seed for reproducibility in CV and splits.

## 3. Explainability (`explain.py`)

*   **`MAX_SHAP_SAMPLES = 1000`**: Hard cap on samples used for the actual SHAP background explainer fit.
*   **`SHAP_PLOT_SAMPLE_CAP = 1000`**: Number of dots shown on the UI beeswarm plot.
*   **`SHAP_COMPUTE_SAMPLE_CAP = 5000`**: Maximum number of rows to evaluate SHAP values on (to prevent timeout on huge datasets).
*   **`SHAP_COMPUTE_MIN_SAMPLE = 500`**: Minimum number of rows required to compute stable SHAP values.

## 4. Decisioning & Governance (`counterfactual.py`, `governance.py`)

*   **Counterfactual Confidences**:
    *   **`HIGH_CV_RATIO_MAX = 0.85`**: Max coefficient of variation for a SHAP impact to be considered `high` confidence.
    *   **`MEDIUM_CV_RATIO_MAX = 1.6`**: Max CV to be considered `medium` confidence.
    *   **`HIGH_SUPPORT_MIN = 0.05`**: Feature must move the needle for at least 5% of the population for `high` confidence.
    *   **`MEDIUM_SUPPORT_MIN = 0.01`**: Feature must move the needle for at least 1% for `medium` confidence.
*   **Governance Signals**:
    *   **`LEAKAGE_WARN_TRIGGER = 1`**: 1+ leakage flags triggers a top-level Analysis Warning.
    *   **`DEGRADED_WARN_TRIGGER = 1`**: 1+ fallback triggers a Warning state.
    *   **`GOVERNANCE_COVERAGE_FLOOR = 0.5`**: 50% feature registry completion needed for "good governance" status.
    *   **`RELIABILITY_LOW_CRITICAL = True`**: A `low` reliability score automatically triggers a `critical` governance status.
