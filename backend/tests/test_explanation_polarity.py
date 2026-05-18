"""Regression tests for SHAP polarity alignment with the positive (risk) class."""

from __future__ import annotations

import numpy as np
import pytest
from sklearn.preprocessing import LabelEncoder

from app.pipelines.common import positive_class_index_for_model
from app.pipelines.explain import _tree_explainer_shap


def test_positive_class_index_prefers_yes_churn():
    le = LabelEncoder()
    le.fit(["No", "Yes"])
    assert positive_class_index_for_model("classification", le) == 1


def test_positive_class_index_handles_lex_order_when_no_keyword():
    le = LabelEncoder()
    le.fit(["benign", "malignant"])
    assert positive_class_index_for_model("classification", le) == 1


def test_tree_shap_binary_list_selects_positive_class_row(monkeypatch: pytest.MonkeyPatch):
    """Binary TreeExplainer list outputs must use one class slice, not mean across both."""

    class FakeExplainer:
        def shap_values(self, X):  # noqa: ARG002
            # SHAP for "leave churn alone": fake opposing contributions per feature.
            n = X.shape[0]
            cls0 = np.full((n, 3), -2.0, dtype=float)
            cls1 = np.full((n, 3), 4.0, dtype=float)
            return [cls0, cls1]

    monkeypatch.setattr("app.pipelines.explain.shap.TreeExplainer", lambda model: FakeExplainer())

    le = LabelEncoder()
    le.fit(["No", "Yes"])
    Xs = np.zeros((10, 3))
    ma, ms = _tree_explainer_shap(None, Xs, "classification", le)
    np.testing.assert_allclose(ma, np.full(3, 4.0))
    np.testing.assert_allclose(ms, np.full(3, 4.0))
