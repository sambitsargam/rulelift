"""Stage 4 — PROVE: deterministic replay of three implementations.

For every valid historical record we compute:
  (a) legacy    — the actual legacy code, imported and called as-is
  (b) extracted — the function compiled from the LLM-extracted spec
  (c) official  — the hard-coded statutory oracle

and derive two headline results:

  fidelity = agreement(a, b): did the extraction faithfully reproduce
             the legacy system's behaviour?
  drift    = disagreement(a, c): where does the legacy system diverge
             from the official statutory rule, and how much money is
             involved?

Nothing here calls an LLM. Mismatches are surfaced, never hidden.
"""

from __future__ import annotations

import importlib.util
import sys
from typing import Callable

from .compiler import band_breakdown
from .oracle import OFFICIAL_SPEC, official_tax

MAX_SAMPLE = 50


def load_legacy_engine(path: str) -> Callable[[float], int]:
    """Import the legacy module from its file path (read-only) and return
    its public entrypoint."""
    module_spec = importlib.util.spec_from_file_location("legacy_sdlt_engine", path)
    module = importlib.util.module_from_spec(module_spec)
    sys.modules["legacy_sdlt_engine"] = module
    module_spec.loader.exec_module(module)
    return module.compute_duty


def replay(records, legacy_fn, extracted_fn, extracted_spec) -> dict:
    """records: iterable of (transaction_id, price). Returns fidelity + drift."""
    total = 0
    fidelity_matches = 0
    fidelity_mismatch_samples: list[dict] = []
    drift_count = 0
    drift_total_delta = 0.0  # sum(official - legacy); positive => legacy undercharges
    drift_samples: list[dict] = []

    for transaction_id, price in records:
        total += 1
        a = legacy_fn(price)
        b = extracted_fn(price)
        c = official_tax(price)

        if a == b:
            fidelity_matches += 1
        elif len(fidelity_mismatch_samples) < MAX_SAMPLE:
            fidelity_mismatch_samples.append(
                {
                    "transaction_id": transaction_id,
                    "price": price,
                    "legacy_tax": a,
                    "extracted_tax": b,
                    "delta": b - a,
                    "extracted_breakdown": band_breakdown(extracted_spec, price),
                }
            )

        if a != c:
            drift_count += 1
            drift_total_delta += c - a
            if len(drift_samples) < MAX_SAMPLE:
                drift_samples.append(
                    {
                        "transaction_id": transaction_id,
                        "price": price,
                        "legacy_tax": a,
                        "official_tax": c,
                        "delta": c - a,
                        "official_breakdown": band_breakdown(OFFICIAL_SPEC, price),
                    }
                )

    return {
        "total_records": total,
        "fidelity": {
            "matches": fidelity_matches,
            "mismatches": total - fidelity_matches,
            "rate": (fidelity_matches / total) if total else 0.0,
            "mismatch_samples": fidelity_mismatch_samples,
        },
        "drift": {
            "records_affected": drift_count,
            "total_delta_gbp": round(drift_total_delta, 2),
            "direction": "legacy undercharges vs official rule"
            if drift_total_delta > 0
            else "legacy overcharges vs official rule"
            if drift_total_delta < 0
            else "no net difference",
            "samples": drift_samples,
        },
    }
