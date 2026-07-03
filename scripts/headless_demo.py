"""Headless proof of the deterministic core — no server, no UI, no LLM.

Runs the full math pipeline over the real dataset and prints the two
headline numbers (extraction fidelity, legacy drift) plus a what-if
impact diff and the stage-7 generated-test result.

    python -m scripts.headless_demo
"""

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.core import changegen
from backend.core.compiler import compile_spec
from backend.core.datagen import ensure_dataset
from backend.core.editor import apply_instruction
from backend.core.guard import LEGACY_FILE, REPO_ROOT, LegacyIntegrity
from backend.core.impact import impact_diff
from backend.core.ingest import code_stats, load_dataset
from backend.core.replay import load_legacy_engine, replay
from backend.core.testgen import golden_cases, render_test_file
from backend.llm.extract import load_cached_spec

DATASET = os.path.join(REPO_ROOT, "data", "transactions.csv")


def hr(title):
    print(f"\n{'=' * 68}\n{title}\n{'=' * 68}")


def main():
    hr("STAGE 1 — INGEST")
    stats = code_stats(LEGACY_FILE)
    print(f"legacy file: {stats['path']} — {stats['line_count']} lines, "
          f"{stats['function_count']} functions, docstrings: {stats['has_docstrings']}")
    source = ensure_dataset(DATASET)
    print(f"dataset: {source['source']} ({source['rows']} rows) -> {source['path']}")
    quality = load_dataset(DATASET)
    print(f"rows: {quality['total_rows']} total, {quality['valid_rows']} valid, "
          f"{quality['excluded_rows']} excluded")
    print("quality:", json.dumps(quality["quality_counts"], indent=2))

    hr("STAGE 2/3 — EXTRACT (cached spec) + COMPILE")
    spec = load_cached_spec()
    print("bands:", json.dumps(spec["bands"], indent=2))
    extracted_fn = compile_spec(spec)

    hr("STAGE 4 — PROVE (replay over every valid record)")
    records = list(quality["records"].itertuples(index=False, name=None))
    legacy_fn = load_legacy_engine(LEGACY_FILE)
    proof = replay(records, legacy_fn, extracted_fn, spec)
    fid = proof["fidelity"]
    drift = proof["drift"]
    print(f"FIDELITY : reproduced {fid['matches']}/{proof['total_records']} records "
          f"= {fid['rate'] * 100:.2f}%  (mismatches: {fid['mismatches']})")
    print(f"DRIFT    : legacy disagrees with the official statutory rule on "
          f"{drift['records_affected']} records")
    print(f"           total mis-charge: £{abs(drift['total_delta_gbp']):,.0f} "
          f"({drift['direction']})")
    if drift["samples"]:
        s = drift["samples"][0]
        print(f"           e.g. {s['transaction_id']} @ £{s['price']:,.0f}: "
              f"legacy £{s['legacy_tax']:,} vs official £{s['official_tax']:,}")

    hr("STAGE 5/6 — EDIT + IMPACT")
    instruction = "raise the nil-rate threshold to £300,000"
    edited, description = apply_instruction(spec, instruction)
    print(f'instruction: "{instruction}"  ->  {description}')
    impact = impact_diff(records, extracted_fn, compile_spec(edited))
    print(f"IMPACT   : {impact['records_affected']:,} records affected, "
          f"total Δ £{impact['total_delta_gbp']:,.0f} "
          f"(avg £{impact['avg_delta_per_affected_gbp']:,.0f}/affected record)")
    print(f"           winners (pay less): {impact['winners_pay_less']:,}   "
          f"losers (pay more): {impact['losers_pay_more']:,}")

    hr("STAGE 7 — CHANGE + VERIFY (diff -> copy -> pytest)")
    new_source, strategy = changegen.deterministic_codegen(edited)
    diff = changegen.unified_diff(changegen.read_legacy_source(), new_source)
    print(f"codegen strategy: {strategy}")
    print(diff)
    cases = golden_cases(edited, compile_spec(edited), [p for _, p in records[:500]])
    changegen.write_working_copy(new_source, render_test_file(cases, description))
    result = changegen.run_pytest()
    print(f"pytest: {'GREEN' if result['passed'] else 'RED'} (exit {result['exit_code']})")
    print(result["output"].strip().splitlines()[-1])

    hr("GUARD")
    print("legacy file integrity:", LegacyIntegrity().check())


if __name__ == "__main__":
    main()
