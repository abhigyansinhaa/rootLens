import numpy as np
from app.pipelines.shap_cache import (
    get_cached_shap_values,
    save_cached_shap_values,
    prune_shap_cache,
)


class DummyModel:
    def __init__(self, value: int):
        self.value = value


def test_shap_cache_hit_and_miss(tmp_path, monkeypatch):
    monkeypatch.setattr("app.pipelines.shap_cache._get_cache_dir", lambda: tmp_path)

    model = DummyModel(42)
    ds_hash = "ds123"
    schema_hash = "sch456"

    # Miss
    sv, base = get_cached_shap_values(ds_hash, schema_hash, model, "test_context")
    assert sv is None
    assert base is None

    # Save
    dummy_sv = np.array([[0.1, 0.2], [0.3, 0.4]])
    save_cached_shap_values(ds_hash, schema_hash, model, "test_context", dummy_sv, 0.5)

    # Hit
    cached_sv, cached_base = get_cached_shap_values(ds_hash, schema_hash, model, "test_context")
    assert cached_sv is not None
    assert np.array_equal(cached_sv, dummy_sv)
    assert cached_base == 0.5


def test_shap_cache_pruning_by_files(tmp_path, monkeypatch):
    monkeypatch.setattr("app.pipelines.shap_cache._get_cache_dir", lambda: tmp_path)

    dummy_sv = np.ones((5, 5))
    for i in range(10):
        model = DummyModel(i)
        save_cached_shap_values("ds", "sch", model, "test", dummy_sv, 0.0)

    assert len(list(tmp_path.glob("*.pkl"))) == 10

    # Prune down to max_files = 3
    removed = prune_shap_cache(max_files=3)
    assert removed == 7
    assert len(list(tmp_path.glob("*.pkl"))) == 3
