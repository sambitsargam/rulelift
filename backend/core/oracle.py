"""Official statutory SDLT rates — the ground-truth reference.

Residential, standard rates (single main residence, England & NI),
effective from 1 April 2025, per HMRC guidance:

    0%   on the portion up to £125,000
    2%   on the portion £125,001 – £250,000
    5%   on the portion £250,001 – £925,000
    10%  on the portion £925,001 – £1,500,000
    12%  on the portion above £1,500,000

This module is deliberately NEVER imported by legacy/sdlt_engine.py.
It exists so the replay engine can measure how far the legacy code has
drifted from the law. Tax is rounded down to the whole pound.
"""

OFFICIAL_BANDS = [
    {"lower": 0,       "upper": 125000,  "rate": 0.00},
    {"lower": 125000,  "upper": 250000,  "rate": 0.02},
    {"lower": 250000,  "upper": 925000,  "rate": 0.05},
    {"lower": 925000,  "upper": 1500000, "rate": 0.10},
    {"lower": 1500000, "upper": None,    "rate": 0.12},
]

OFFICIAL_SPEC = {
    "rule_name": "SDLT residential standard rates (official)",
    "summary": (
        "Stamp Duty Land Tax for a residential purchase at standard rates: "
        "0% up to £125,000, 2% on the portion to £250,000, 5% on the portion "
        "to £925,000, 10% on the portion to £1.5m, 12% above. Progressive "
        "slice calculation, rounded down to the whole pound."
    ),
    "conditions": [
        "Residential property, standard rates (no additional-dwelling surcharge)",
        "Single purchase, freehold consideration in GBP",
        "Tax rounded down to the nearest whole pound",
    ],
    "assumptions": [],
    "bands": OFFICIAL_BANDS,
}


def official_tax(price) -> int:
    """Statutory SDLT for a given price. Pure, deterministic."""
    if price is None or price <= 0:
        return 0
    total = 0.0
    for band in OFFICIAL_BANDS:
        lower = band["lower"]
        upper = band["upper"] if band["upper"] is not None else price
        if price > lower:
            total += (min(price, upper) - lower) * band["rate"]
    return int(total)
