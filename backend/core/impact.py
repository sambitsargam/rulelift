"""Stage 6 — IMPACT: what does the rule change do to real historical data?

Runs apply_extracted (current rule) vs apply_edited (proposed rule) over
every valid record and aggregates the differences. This is the "CFO
number": computed, never asserted. Pure deterministic Python.
"""

from __future__ import annotations

MAX_SAMPLE = 50

# Histogram buckets for per-record tax delta (proposed - current), in £.
BUCKETS = [
    (float("-inf"), -5000, "saves > £5k"),
    (-5000, -2500, "saves £2.5k–£5k"),
    (-2500, -1000, "saves £1k–£2.5k"),
    (-1000, 0, "saves < £1k"),
    (0, 1000, "pays < £1k more"),
    (1000, 2500, "pays £1k–£2.5k more"),
    (2500, 5000, "pays £2.5k–£5k more"),
    (5000, float("inf"), "pays > £5k more"),
]


def impact_diff(records, current_fn, proposed_fn) -> dict:
    total = 0
    affected = 0
    total_delta = 0.0
    winners = 0  # pay less under the proposed rule
    losers = 0   # pay more
    histogram = {label: 0 for _, _, label in BUCKETS}
    samples: list[dict] = []
    current_total = 0.0
    proposed_total = 0.0

    for transaction_id, price in records:
        total += 1
        before = current_fn(price)
        after = proposed_fn(price)
        current_total += before
        proposed_total += after
        delta = after - before
        if delta == 0:
            continue
        affected += 1
        total_delta += delta
        if delta < 0:
            winners += 1
        else:
            losers += 1
        for low, high, label in BUCKETS:
            if low < delta <= high:
                histogram[label] += 1
                break
        if len(samples) < MAX_SAMPLE:
            samples.append(
                {
                    "transaction_id": transaction_id,
                    "price": price,
                    "current_tax": before,
                    "proposed_tax": after,
                    "delta": delta,
                }
            )

    return {
        "total_records": total,
        "records_affected": affected,
        "records_unchanged": total - affected,
        "total_delta_gbp": round(total_delta, 2),
        "avg_delta_per_affected_gbp": round(total_delta / affected, 2) if affected else 0.0,
        "winners_pay_less": winners,
        "losers_pay_more": losers,
        "current_total_tax_gbp": round(current_total, 2),
        "proposed_total_tax_gbp": round(proposed_total, 2),
        "histogram": [
            {"bucket": label, "count": histogram[label]} for _, _, label in BUCKETS
        ],
        "samples": samples,
    }
