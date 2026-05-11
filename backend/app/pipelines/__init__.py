"""Pipelines layer: profile, train, encode, explain.

`PIPELINE_VERSION` is bumped whenever any of these modules change in a way
that would alter the artifacts of a previously-trained run. It is stored on
``Analysis.pipeline_version`` so historical results stay attributable. Bump
SemVer-style ``major.minor`` only.
"""

from __future__ import annotations

PIPELINE_VERSION = "1.0"
