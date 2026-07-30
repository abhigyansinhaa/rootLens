"""Centralized registry of heuristic thresholds and magic constants.

This file serves as the single source of truth for all thresholds used
throughout the ML pipeline and decisioning engine.
See THRESHOLDS.md for detailed documentation on tuning these values.
"""

# =============================================================================
# 1. Dataset Profiling & Validation (app/pipelines/profile.py)
# =============================================================================

# Row counts
MIN_ROWS_FOR_ANALYSIS = 10
MIN_ROWS_RECOMMENDED = 50

# Cardinality and Uniqueness
MAX_CLASSIFICATION_CARDINALITY = 50
ID_LIKE_UNIQUE_RATIO = 0.5
HIGH_NULL_RATIO = 0.5
HIGH_CARD_CAT_UNIQUE = 100

# Leakage Detection
LEAKAGE_NAME_SUBSTR = ("id", "uuid", "email", "phone", "ssn", "hash")
LEAKAGE_CORR_ABS_THRESHOLD = 0.98
LEAKAGE_MI_SCORE_THRESHOLD = 0.95
LEAKAGE_MI_SAMPLE_ROWS = 5000

# =============================================================================
# 2. Pipeline Execution (app/pipelines/pipeline.py & encoders.py)
# =============================================================================

# Categorical handling
MAX_CAT_LEVELS = 25
HIGH_CARD_MIN = 26
HIGH_CARD_MAX = 300

# Model persistence and consistency
ENCODER_VERSION = "v2"
RANDOM_STATE = 42

# =============================================================================
# 3. Model Explainability (app/pipelines/explain.py)
# =============================================================================

# SHAP Sampling caps
MAX_SHAP_SAMPLES = 1000
SHAP_PLOT_SAMPLE_CAP = 1000
SHAP_COMPUTE_SAMPLE_CAP = 5000
SHAP_COMPUTE_MIN_SAMPLE = 500

# =============================================================================
# 4. Decisioning Engine: Counterfactuals & Governance
# =============================================================================

# counterfactual.py (Confidence bounds)
HIGH_CV_RATIO_MAX = 0.85
MEDIUM_CV_RATIO_MAX = 1.6
HIGH_SUPPORT_MIN = 0.05
MEDIUM_SUPPORT_MIN = 0.01

# governance.py (Warnings & Health)
LEAKAGE_WARN_TRIGGER = 1
DEGRADED_WARN_TRIGGER = 1
GOVERNANCE_COVERAGE_FLOOR = 0.5
RELIABILITY_LOW_CRITICAL = True
