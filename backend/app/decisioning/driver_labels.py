"""Human-readable labels for encoded model features (presentation layer only)."""

from __future__ import annotations

import re


def _normalize_key(value: str) -> str:
    """Snake-case key for matching: camelCase, spaces, hyphens → lowercase tokens."""
    s = re.sub(r"([a-z0-9])([A-Z])", r"\1_\2", str(value))
    s = re.sub(r"[\s\-\.]+", "_", s)
    return s.lower().strip("_")


def _compact_key(value: str) -> str:
    return _normalize_key(value).replace("_", "")


def _title_text(value: str) -> str:
    """``monthly_charges`` / ``monthlycharges`` / ``MonthlyCharges`` → ``Monthly Charges``."""

    def _cap_segment(segment: str) -> str:
        if "-" in segment:
            parts = [p for p in segment.split("-") if p]
            if len(parts) >= 2:
                head = parts[0][:1].upper() + parts[0][1:].lower()
                tail = "-".join(p.lower() for p in parts[1:])
                return f"{head}-{tail}"
        return segment[:1].upper() + segment[1:].lower() if segment else segment

    parts = [p for p in _normalize_key(value).split("_") if p]
    return " ".join(_cap_segment(p) for p in parts) if parts else value


def _longest_prefix_column(fname: str, raw_cols: list[str]) -> tuple[str | None, str | None]:
    """Map dummy ``Contract_Month-to-month`` or ``monthlycharges`` → base + level."""
    for col in raw_cols:
        cs = str(col)
        if fname == cs:
            return cs, None
        pref = f"{cs}_"
        if fname.startswith(pref):
            return cs, fname[len(cs) + 1 :] or None

    fn_c = _compact_key(fname)
    best_col: str | None = None
    best_len = -1
    for col in raw_cols:
        cn = _compact_key(col)
        if not cn:
            continue
        if fn_c == cn:
            return str(col), None
        if fn_c.startswith(cn) and len(cn) > best_len:
            best_col = str(col)
            best_len = len(cn)

    if best_col is None:
        return None, None

    bc = _compact_key(best_col)
    if fn_c == bc:
        return best_col, None

    suffix_c = fn_c[len(bc) :]
    if suffix_c:
        level_from_compact = suffix_c
        if "_" in _normalize_key(fname):
            tail_parts = _normalize_key(fname).split("_")[len(_normalize_key(best_col).split("_")) :]
            if tail_parts:
                level_from_compact = "_".join(tail_parts)
        return best_col, level_from_compact

    col_norm = _normalize_key(best_col)
    fn_norm = _normalize_key(fname)
    col_parts = [p for p in col_norm.split("_") if p]
    fn_parts = [p for p in fn_norm.split("_") if p]
    if len(fn_parts) > len(col_parts) and fn_parts[: len(col_parts)] == col_parts:
        level = "_".join(fn_parts[len(col_parts) :])
        return best_col, level or None

    if fname.lower().startswith(best_col.lower()):
        tail = fname[len(best_col) :].lstrip("_")
        return best_col, tail or None

    return best_col, None


def _level_display(level: str) -> str:
    """Preserve hyphenated levels (``Month-to-month``); multi-word → ``Fiber optic``."""

    def _cap_segment(segment: str) -> str:
        if "-" in segment:
            parts = [p for p in segment.split("-") if p]
            if len(parts) >= 2:
                head = parts[0][:1].upper() + parts[0][1:].lower()
                tail = "-".join(p.lower() for p in parts[1:])
                return f"{head}-{tail}"
        return segment[:1].upper() + segment[1:].lower() if segment else segment

    if "-" in level and " " not in level.strip():
        parts = [p for p in level.split("-") if p]
        if not parts:
            return level
        head = parts[0][:1].upper() + parts[0][1:].lower()
        if len(parts) == 1:
            return head
        return head + "-" + "-".join(p.lower() for p in parts[1:])
    parts = [p for p in re.split(r"[\s_]+", level.replace(".", " ")) if p]
    if len(parts) > 1:
        titled = " ".join(_cap_segment(p) for p in parts)
        split = titled.split()
        return split[0] + " " + " ".join(p.lower() for p in split[1:])
    return _cap_segment(parts[0]) if parts else level


def _humanize_level(base: str, level: str) -> str:
    """Turn OHE level + base column into a fluent segment label."""
    base_t = _title_text(base)
    level_t = _level_display(level)
    bl = base.lower()
    ll = level.lower()

    if ll in {"no", "yes"}:
        if ll == "no":
            if "security" in bl:
                return "Customers Without Online Security"
            if "support" in bl or "tech" in bl:
                return "Customers Without Tech Support"
            if "paperless" in bl:
                return "Customers without paperless billing"
            return f"Customers Without {base_t}"
        if "security" in bl:
            return "Customers With Online Security"
        if "support" in bl or "tech" in bl:
            return "Customers With Tech Support"
        return f"Customers With {base_t}"

    if "contract" in bl:
        return f"{level_t} contracts"
    if "internet" in bl and "service" in bl:
        return f"{level_t} internet customers"
    if "payment" in bl and "method" in bl:
        return f"{_title_text(level.replace('_', ' '))} Payment Users"
    if "service" in bl:
        return f"{level_t} {base_t} customers"
    return f"{level_t} ({base_t})"


def format_driver_label(
    feature: str,
    raw_columns: list[str] | None = None,
) -> str:
    """Presentation label for a model feature id. Raw ``feature`` stays unchanged elsewhere."""
    fname = str(feature)
    cols = [str(c) for c in (raw_columns or []) if c]
    if cols:
        if fname in cols:
            return _title_text(fname)
        base, level = _longest_prefix_column(fname, cols)
        if base is not None and level is not None:
            return _humanize_level(base, level)
        if base is not None:
            return _title_text(base)

    norm_parts = [p for p in _normalize_key(fname).split("_") if p]
    if len(norm_parts) >= 2:
        base_guess = norm_parts[0]
        level_guess = "_".join(norm_parts[1:])
        return _humanize_level(base_guess, level_guess)
    return _title_text(fname)


def humanize_target_label(target: str) -> str:
    raw = str(target).strip().lower().replace("churned", "churn")
    if raw in ("churn", "churned"):
        return "churn"
    titled = _title_text(raw)
    return titled[0].lower() + titled[1:] if len(titled) > 1 else titled.lower()
