"""Deterministic spec -> executable Python compiler.

Takes a validated rule spec and returns a pure function
``fn(price) -> tax`` implementing the progressive band calculation.
No LLM involvement, no I/O, no randomness. Rounding matches HMRC
guidance (round down to the whole pound), which is also what the
legacy engine does.
"""

from __future__ import annotations

from typing import Callable

from .schema import assert_valid_spec


def compile_spec(spec) -> Callable[[float], int]:
    assert_valid_spec(spec)
    # Freeze bands into tuples so the closure can't be mutated later.
    bands = tuple(
        (float(b["lower"]), None if b["upper"] is None else float(b["upper"]), float(b["rate"]))
        for b in spec["bands"]
    )

    def apply_rule(price) -> int:
        if price is None or price <= 0:
            return 0
        total = 0.0
        for lower, upper, rate in bands:
            if price <= lower:
                break
            top = price if upper is None else min(price, upper)
            total += (top - lower) * rate
        return int(total)

    apply_rule.__name__ = "apply_rule"
    apply_rule.spec = spec  # type: ignore[attr-defined]
    return apply_rule


def band_breakdown(spec, price) -> list[dict]:
    """Per-band slice amounts for one price — used for record drill-downs."""
    assert_valid_spec(spec)
    rows = []
    if price is None or price <= 0:
        return rows
    for band in spec["bands"]:
        lower = band["lower"]
        upper = band["upper"] if band["upper"] is not None else price
        portion = max(0, min(price, upper) - lower) if price > lower else 0
        rows.append(
            {
                "lower": lower,
                "upper": band["upper"],
                "rate": band["rate"],
                "portion": portion,
                "tax": portion * band["rate"],
            }
        )
    return rows
