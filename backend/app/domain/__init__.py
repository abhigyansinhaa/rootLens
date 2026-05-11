"""Domain layer: ORM models + Pydantic schemas + feature registry table.

Imports from this package should be in-process only — there is no network hop
between layers, per the constrained plan.
"""