"""Stage 1 — ingest: legacy-code stats + dataset load with data-quality triage.

Every row is classified, never dropped silently and never allowed to
crash the pipeline. Categories:

  valid                 numeric price in a plausible range
  recovered_formatting  price had £/commas/whitespace but parsed cleanly (kept)
  missing_price         blank/empty price cell (excluded)
  non_numeric           junk like "N/A", "POA" (excluded)
  non_positive          zero or negative price (excluded)
  implausible_outlier   > £50m — outside residential plausibility (excluded)
"""

from __future__ import annotations

import ast
import os

import pandas as pd

OUTLIER_CEILING = 50_000_000

EXCLUDED_REASONS = {
    "missing_price": "blank price cell",
    "non_numeric": "price is not a number (junk text)",
    "non_positive": "zero or negative price",
    "implausible_outlier": f"price above £{OUTLIER_CEILING:,} — implausible for residential",
}


def code_stats(path: str) -> dict:
    with open(path) as f:
        source = f.read()
    tree = ast.parse(source)
    functions = [n.name for n in ast.walk(tree) if isinstance(n, ast.FunctionDef)]
    lines = source.splitlines()
    comment_lines = sum(1 for line in lines if line.strip().startswith("#"))
    return {
        "path": os.path.relpath(path),
        "line_count": len(lines),
        "function_count": len(functions),
        "functions": functions,
        "comment_lines": comment_lines,
        "has_docstrings": any(
            ast.get_docstring(n)
            for n in ast.walk(tree)
            if isinstance(n, (ast.FunctionDef, ast.Module))
        ),
        "size_bytes": len(source.encode()),
    }


def classify_price(raw) -> tuple[str, float | None]:
    """Classify one raw price cell -> (category, parsed_price_or_None)."""
    if raw is None or (isinstance(raw, float) and pd.isna(raw)):
        return "missing_price", None
    text = str(raw).strip()
    if text == "":
        return "missing_price", None

    cleaned = text.replace("£", "").replace(",", "").replace(" ", "")
    try:
        value = float(cleaned)
    except ValueError:
        return "non_numeric", None

    if value <= 0:
        return "non_positive", None
    if value > OUTLIER_CEILING:
        return "implausible_outlier", None

    was_formatted = cleaned != text
    return ("recovered_formatting" if was_formatted else "valid"), value


def load_dataset(path: str) -> dict:
    """Load the CSV, triage every row. Returns quality summary + valid prices."""
    df = pd.read_csv(path, dtype=str, keep_default_na=False)

    categories: list[str] = []
    prices: list[float | None] = []
    for raw in df["price"]:
        category, value = classify_price(raw)
        categories.append(category)
        prices.append(value)

    df["quality"] = categories
    df["parsed_price"] = prices

    counts = df["quality"].value_counts().to_dict()
    usable = df[df["parsed_price"].notna()].copy()

    examples = {}
    for category in counts:
        if category in ("valid", "recovered_formatting"):
            continue
        sample = df[df["quality"] == category].head(3)
        examples[category] = [
            {"transaction_id": r["transaction_id"], "raw_price": str(r["price"])}
            for _, r in sample.iterrows()
        ]

    return {
        "total_rows": len(df),
        "valid_rows": len(usable),
        "excluded_rows": len(df) - len(usable),
        "quality_counts": counts,
        "excluded_reasons": EXCLUDED_REASONS,
        "excluded_examples": examples,
        "records": usable[["transaction_id", "parsed_price"]].rename(
            columns={"parsed_price": "price"}
        ),
    }
