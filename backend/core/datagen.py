"""Dataset acquisition: HM Land Registry Price Paid Data, with fallback.

Tries to download a monthly Price Paid Data extract (public CSV). If the
network / domain is unavailable (or the download is disabled), generates
a realistic synthetic dataset of UK property transaction prices:
log-normal, median ~£290k, long tail into the millions — plus a
deliberate sprinkling of messy rows (blank prices, non-numeric junk,
zero/negative values, absurd outliers) because the pipeline is required
to survive dirty data, not assume clean data.

Either way the result is cached to data/transactions.csv so the demo is
repeatable and works fully offline.
"""

from __future__ import annotations

import csv
import os
import random

# Monthly PPD extract (public, no auth). Columns are positional; price is
# column 1, date column 2, postcode 3, property type 4, county 13.
PPD_URL = (
    "http://prod.publicdata.landregistry.gov.uk.s3-website-eu-west-1"
    ".amazonaws.com/pp-monthly-update-new-version.csv"
)
DOWNLOAD_TIMEOUT_S = 20
TARGET_ROWS = 22000  # ~800 messy rows leaves >20k valid
SEED = 20260703

COUNTIES = [
    "GREATER LONDON", "GREATER MANCHESTER", "WEST MIDLANDS", "KENT",
    "ESSEX", "HAMPSHIRE", "SURREY", "WEST YORKSHIRE", "MERSEYSIDE",
    "LANCASHIRE", "DEVON", "BRISTOL", "NORFOLK", "TYNE AND WEAR",
]
PROPERTY_TYPES = ["D", "S", "T", "F"]  # detached, semi, terraced, flat

HEADER = ["transaction_id", "price", "date", "postcode", "property_type", "county"]


def _synth_postcode(rng: random.Random) -> str:
    area = rng.choice(["SW", "SE", "N", "E", "M", "B", "LS", "BS", "GU", "ME", "PL", "NR", "NE", "L"])
    return f"{area}{rng.randint(1, 28)} {rng.randint(1, 9)}{rng.choice('ABDEFGHJLNPQRSTUWXYZ')}{rng.choice('ABDEFGHJLNPQRSTUWXYZ')}"


def generate_synthetic(path: str, n_rows: int = TARGET_ROWS, seed: int = SEED) -> dict:
    """Write a synthetic-but-realistic messy PPD-style CSV. Deterministic."""
    rng = random.Random(seed)
    mu, sigma = 12.578, 0.55  # median ~= exp(mu) ~= £290k, long right tail

    junk_values = ["N/A", "unknown", "POA", "see notes", "--", "TBC", "1,2 50k"]
    rows = []
    for i in range(n_rows):
        price_val = rng.lognormvariate(mu, sigma)
        price: object = int(round(price_val, -2))  # prices land on £100s
        roll = rng.random()
        if roll < 0.010:
            price = ""                                    # blank
        elif roll < 0.018:
            price = rng.choice(junk_values)               # non-numeric junk
        elif roll < 0.024:
            price = rng.choice([0, -1, -rng.randint(1000, 90000)])  # zero/negative
        elif roll < 0.028:
            price = rng.randint(60_000_000, 1_200_000_000)  # absurd outlier
        elif roll < 0.036:
            price = f"£{int(price_val):,}"                # formatted but recoverable

        date = f"{rng.choice([2024, 2025])}-{rng.randint(1, 12):02d}-{rng.randint(1, 28):02d}"
        rows.append([
            f"TX{i:06d}", price, date, _synth_postcode(rng),
            rng.choice(PROPERTY_TYPES), rng.choice(COUNTIES),
        ])

    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(HEADER)
        writer.writerows(rows)
    return {"source": "synthetic", "rows": len(rows), "path": path, "seed": seed}


def try_download_ppd(path: str, max_rows: int = TARGET_ROWS) -> dict | None:
    """Attempt the Land Registry download. Returns None on any failure."""
    try:
        import requests  # local import: module must work without requests installed

        with requests.get(PPD_URL, stream=True, timeout=DOWNLOAD_TIMEOUT_S) as resp:
            resp.raise_for_status()
            os.makedirs(os.path.dirname(path), exist_ok=True)
            rows_written = 0
            with open(path, "w", newline="") as f:
                writer = csv.writer(f)
                writer.writerow(HEADER)
                reader = csv.reader(line.decode("utf-8", "replace") for line in resp.iter_lines())
                for i, row in enumerate(reader):
                    if len(row) < 14:
                        continue
                    writer.writerow([f"TX{i:06d}", row[1], row[2][:10], row[3], row[4], row[13]])
                    rows_written += 1
                    if rows_written >= max_rows:
                        break
            if rows_written < 1000:
                raise ValueError(f"download too small ({rows_written} rows)")
            return {"source": "land_registry_ppd", "rows": rows_written, "path": path}
    except Exception:
        return None


def ensure_dataset(path: str, allow_download: bool = True) -> dict:
    """Idempotent: reuse cached CSV, else download, else synthesise."""
    if os.path.exists(path) and os.path.getsize(path) > 0:
        with open(path) as f:
            rows = sum(1 for _ in f) - 1
        return {"source": "cached", "rows": rows, "path": path}
    if allow_download and os.environ.get("RULELIFT_NO_DOWNLOAD") != "1":
        result = try_download_ppd(path)
        if result is not None:
            return result
    return generate_synthetic(path)
