"""Back-compat shim package: ML modules now live in `app.pipelines` and `app.decisioning`.

`PIPELINE_VERSION` is exported here for legacy importers; the canonical home is
`app.pipelines.PIPELINE_VERSION`.
"""

from app.pipelines import PIPELINE_VERSION  # noqa: F401

__all__ = ["PIPELINE_VERSION"]
