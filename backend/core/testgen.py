"""Stage 7a — generate a pytest suite directly from historical data.

Golden pairs: input price -> expected tax, where expected values are
computed by the deterministically-compiled *edited* spec (the approved
new rule). Cases are drawn from (1) every band boundary ±1 — the places
band logic goes wrong — and (2) a deterministic sample of real
transaction prices. The generated file is plain pytest with the numbers
baked in, so a human reviewer can read every case.
"""

from __future__ import annotations

import random
from typing import Callable

SAMPLED_CASES = 60
SEED = 42


def boundary_prices(spec: dict) -> list[int]:
    prices: set[int] = {1, 50_000}
    for band in spec["bands"]:
        for edge in (band["lower"], band["upper"]):
            if edge is None or edge <= 0:
                continue
            edge = int(edge)
            prices.update({edge - 1, edge, edge + 1})
    return sorted(prices)


def golden_cases(spec: dict, edited_fn: Callable, record_prices: list[float]) -> list[tuple[int, int]]:
    rng = random.Random(SEED)
    prices = boundary_prices(spec)
    pool = sorted({int(p) for p in record_prices})
    if pool:
        prices += rng.sample(pool, min(SAMPLED_CASES, len(pool)))
    seen: set[int] = set()
    cases: list[tuple[int, int]] = []
    for price in prices:
        if price in seen:
            continue
        seen.add(price)
        cases.append((price, edited_fn(price)))
    return cases


def render_test_file(cases: list[tuple[int, int]], change_description: str) -> str:
    lines = [
        '"""Generated golden tests for the modified SDLT engine.',
        "",
        f"Change under test: {change_description}",
        "Expected values computed deterministically from the approved rule spec;",
        "sample prices drawn from the historical transaction dataset plus every",
        'band boundary +/-1. Regenerate via the app — do not hand-edit."""',
        "",
        "import os",
        "import sys",
        "",
        "import pytest",
        "",
        "sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))",
        "",
        "from sdlt_engine import compute_duty",
        "",
        "",
        "GOLDEN = [",
    ]
    for price, expected in cases:
        lines.append(f"    ({price}, {expected}),")
    lines += [
        "]",
        "",
        "",
        '@pytest.mark.parametrize("price,expected", GOLDEN)',
        "def test_compute_duty_golden(price, expected):",
        "    assert compute_duty(price) == expected",
        "",
        "",
        "def test_invalid_inputs_return_zero():",
        "    assert compute_duty(0) == 0",
        "    assert compute_duty(-100) == 0",
        "    assert compute_duty(None) == 0",
        "",
    ]
    return "\n".join(lines)
