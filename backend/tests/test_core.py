"""Unit tests for the deterministic core. No LLM, no network."""

import json
import os

import pytest

from backend.core import changegen, guard
from backend.core.compiler import band_breakdown, compile_spec
from backend.core.datagen import generate_synthetic
from backend.core.editor import EditParseError, apply_instruction
from backend.core.impact import impact_diff
from backend.core.ingest import classify_price, code_stats, load_dataset
from backend.core.oracle import OFFICIAL_SPEC, official_tax
from backend.core.replay import load_legacy_engine, replay
from backend.core.schema import validate_spec
from backend.core.testgen import golden_cases, render_test_file

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
LEGACY = os.path.join(REPO, "legacy", "sdlt_engine.py")
CACHED_SPEC = os.path.join(REPO, "data", "cached_spec.json")


def load_cached_spec():
    with open(CACHED_SPEC) as f:
        return json.load(f)


# ---------------------------------------------------------------- oracle
@pytest.mark.parametrize(
    "price,expected",
    [
        (100_000, 0),
        (125_000, 0),
        (200_000, 1_500),
        (250_000, 2_500),
        (300_000, 5_000),
        (500_000, 15_000),
        (925_000, 36_250),
        (1_000_000, 43_750),
        (1_500_000, 93_750),
        (2_000_000, 153_750),
        (0, 0),
        (-5, 0),
    ],
)
def test_official_tax_known_values(price, expected):
    assert official_tax(price) == expected


# ---------------------------------------------------------------- legacy engine
@pytest.mark.parametrize(
    "price,expected",
    [
        (100_000, 0),
        (200_000, 0),        # planted bug: official rule says 1,500 here
        (250_000, 0),
        (300_000, 2_500),    # official rule says 5,000
        (600_000, 17_500),
        (1_000_000, 41_250),
        (2_000_000, 151_250),
    ],
)
def test_legacy_engine_behaviour(price, expected):
    legacy_fn = load_legacy_engine(LEGACY)
    assert legacy_fn(price) == expected


def test_planted_drift_is_exactly_the_stale_nil_rate_band():
    """Below £125k legacy and official agree; above, legacy undercharges
    by up to £2,500 (exactly £2,500 for any price >= £250k)."""
    legacy_fn = load_legacy_engine(LEGACY)
    assert legacy_fn(120_000) == official_tax(120_000) == 0
    for price in (300_000, 750_000, 1_200_000, 3_000_000):
        assert official_tax(price) - legacy_fn(price) == 2_500


# ---------------------------------------------------------------- schema + compiler
def test_official_spec_and_cached_spec_are_schema_valid():
    assert validate_spec(OFFICIAL_SPEC) == []
    assert validate_spec(load_cached_spec()) == []


def test_schema_rejects_broken_specs():
    bad = {"rule_name": "x", "summary": "y", "conditions": [], "assumptions": [],
           "bands": [{"lower": 100, "upper": 200, "rate": 0.05}]}
    errors = validate_spec(bad)
    assert any("must be 0" in e for e in errors)
    assert any("final band" in e for e in errors)

    bad["bands"] = [{"lower": 0, "upper": 200, "rate": 5}]  # 5 not 0.05
    assert any("fraction" in e for e in validate_spec(bad))


def test_compiled_official_spec_matches_oracle_everywhere():
    fn = compile_spec(OFFICIAL_SPEC)
    for price in range(1, 3_000_000, 7_919):  # dense sweep incl. odd values
        assert fn(price) == official_tax(price), price
    for band in OFFICIAL_SPEC["bands"]:
        for edge in (band["lower"], band["upper"]):
            if edge:
                for probe in (edge - 1, edge, edge + 1):
                    assert fn(probe) == official_tax(probe), probe


def test_compiled_cached_spec_matches_legacy_everywhere():
    fn = compile_spec(load_cached_spec())
    legacy_fn = load_legacy_engine(LEGACY)
    for price in range(1, 3_000_000, 7_919):
        assert fn(price) == legacy_fn(price), price


def test_band_breakdown_sums_to_tax():
    spec = OFFICIAL_SPEC
    fn = compile_spec(spec)
    rows = band_breakdown(spec, 1_234_567)
    assert int(sum(r["tax"] for r in rows)) == fn(1_234_567)


# ---------------------------------------------------------------- data quality
def test_classify_price_categories():
    assert classify_price("250000") == ("valid", 250000.0)
    assert classify_price("£1,250,000")[0] == "recovered_formatting"
    assert classify_price("") == ("missing_price", None)
    assert classify_price("N/A") == ("non_numeric", None)
    assert classify_price("-40000") == ("non_positive", None)
    assert classify_price("0") == ("non_positive", None)
    assert classify_price("900000000") == ("implausible_outlier", None)


def test_synthetic_dataset_is_messy_but_yields_enough_valid_rows(tmp_path):
    csv_path = str(tmp_path / "tx.csv")
    generate_synthetic(csv_path)
    quality = load_dataset(csv_path)
    assert quality["valid_rows"] >= 20_000
    assert quality["excluded_rows"] > 0  # messiness is required, not tolerated
    for category in ("missing_price", "non_numeric", "non_positive", "implausible_outlier"):
        assert quality["quality_counts"].get(category, 0) > 0, category


def test_code_stats_reads_legacy_file():
    stats = code_stats(LEGACY)
    assert stats["line_count"] > 100
    assert "calc_v2" in stats["functions"]
    assert stats["has_docstrings"] is False or stats["comment_lines"] > 20


# ---------------------------------------------------------------- replay / prove
def test_replay_fidelity_and_drift(tmp_path):
    csv_path = str(tmp_path / "tx.csv")
    generate_synthetic(csv_path, n_rows=5000)
    quality = load_dataset(csv_path)
    records = list(quality["records"].itertuples(index=False, name=None))

    legacy_fn = load_legacy_engine(LEGACY)
    spec = load_cached_spec()
    extracted_fn = compile_spec(spec)
    result = replay(records, legacy_fn, extracted_fn, spec)

    assert result["total_records"] == len(records)
    # faithful extraction => 100% fidelity
    assert result["fidelity"]["rate"] == 1.0
    # planted bug => drift on every record over £125k, always undercharging
    assert result["drift"]["records_affected"] > 0
    assert result["drift"]["total_delta_gbp"] > 0
    expected_drift = sum(1 for _, p in records if official_tax(p) != legacy_fn(p))
    assert result["drift"]["records_affected"] == expected_drift


# ---------------------------------------------------------------- editor
def test_plain_english_nil_rate_edit():
    spec = load_cached_spec()
    edited, description = apply_instruction(spec, "raise the nil-rate threshold to £300,000")
    assert edited["bands"][0]["upper"] == 300_000
    assert edited["bands"][1]["lower"] == 300_000
    assert "300,000" in description
    assert spec["bands"][0]["upper"] == 250_000  # original untouched


def test_plain_english_rate_edit():
    spec = load_cached_spec()
    edited, _ = apply_instruction(spec, "change the 5% rate to 6%")
    assert edited["bands"][1]["rate"] == pytest.approx(0.06)


def test_plain_english_threshold_by_value():
    spec = load_cached_spec()
    edited, _ = apply_instruction(spec, "move the £925,000 threshold to 1m")
    assert edited["bands"][1]["upper"] == 1_000_000
    assert edited["bands"][2]["lower"] == 1_000_000


def test_unparseable_instruction_raises_clearly():
    with pytest.raises(EditParseError, match="couldn't parse"):
        apply_instruction(load_cached_spec(), "make taxes more vibey")


# ---------------------------------------------------------------- impact
def test_impact_of_raising_nil_rate_threshold():
    spec = load_cached_spec()
    current = compile_spec(spec)
    edited, _ = apply_instruction(spec, "raise the nil-rate threshold to £300,000")
    proposed = compile_spec(edited)

    records = [(f"T{i}", p) for i, p in enumerate([100_000, 260_000, 280_000, 500_000, 2_000_000])]
    result = impact_diff(records, current, proposed)
    assert result["records_affected"] == 4          # all except the £100k record
    assert result["winners_pay_less"] == 4
    assert result["losers_pay_more"] == 0
    # every record over £300k saves exactly 5% * £50k = £2,500
    assert result["total_delta_gbp"] == -(500 + 1500 + 2500 + 2500)
    assert result["records_unchanged"] == 1


# ---------------------------------------------------------------- guard
def test_guard_blocks_writes_outside_workdir(tmp_path):
    with pytest.raises(guard.GuardViolation):
        guard.safe_write(os.path.join(REPO, "legacy", "evil.py"), "nope")
    with pytest.raises(guard.GuardViolation):
        guard.safe_write("/tmp/outside.txt", "nope")
    with pytest.raises(guard.GuardViolation):
        guard.safe_write(os.path.join(guard.ALLOWED_WRITE_ROOT, "..", "escape.py"), "nope")
    # inside the allowlist is fine
    path = guard.safe_write(os.path.join(guard.ALLOWED_WRITE_ROOT, "probe.txt"), "ok")
    assert path.startswith(os.path.realpath(guard.ALLOWED_WRITE_ROOT))
    os.remove(path)


def test_legacy_integrity_fingerprint():
    integrity = guard.LegacyIntegrity()
    check = integrity.check()
    assert check["untouched"] is True


# ---------------------------------------------------------------- testgen + changegen
def test_generated_suite_passes_against_deterministic_codegen(tmp_path):
    spec = load_cached_spec()
    edited, description = apply_instruction(spec, "raise the nil-rate threshold to £300,000")
    edited_fn = compile_spec(edited)

    new_source, strategy = changegen.deterministic_codegen(edited)
    assert "300000" in new_source
    assert "config-dict patch" in strategy

    diff = changegen.unified_diff(changegen.read_legacy_source(), new_source)
    assert '-    "n": 250000,' in diff
    assert '+    "n": 300000,' in diff

    cases = golden_cases(edited, edited_fn, [265_000.0, 410_000.0, 999_999.0])
    test_source = render_test_file(cases, description)
    changegen.write_working_copy(new_source, test_source)
    result = changegen.run_pytest()
    assert result["passed"], result["output"]


def test_structural_codegen_when_band_count_changes():
    """Restoring the official 5-band structure forces the rewrite path."""
    from backend.core.oracle import OFFICIAL_SPEC

    new_source, strategy = changegen.deterministic_codegen(OFFICIAL_SPEC)
    assert "rewrite" in strategy
    assert "_BANDS" in new_source

    edited_fn = compile_spec(OFFICIAL_SPEC)
    cases = golden_cases(OFFICIAL_SPEC, edited_fn, [200_000.0, 300_000.0])
    changegen.write_working_copy(new_source, render_test_file(cases, "restore official bands"))
    result = changegen.run_pytest()
    assert result["passed"], result["output"]
