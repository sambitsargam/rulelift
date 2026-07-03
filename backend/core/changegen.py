"""Stage 7b — generate the code change, apply it to a COPY, run pytest.

Two code-generation paths produce the modified engine source:

  deterministic (always available, used in mock mode and as fallback):
    - if the edited spec still has the legacy 4-band shape, rewrite the
      values inside the buried ``_T`` config dict — a minimal,
      reviewable diff;
    - otherwise replace the calc section with a clean band-table
      implementation that preserves the public entrypoints.

  llm (stage-7 LLM call, see backend/llm/codegen.py): proposes the file;
    this module still owns validation.

Either way: the new source is written ONLY inside workdir/ via the
write-guard, a unified diff against the original is produced with
difflib, generated golden tests are written next to it, and pytest runs
in a subprocess. Green/red is decided by pytest's exit code — never by
the LLM.
"""

from __future__ import annotations

import difflib
import os
import re
import subprocess
import sys

from . import guard

PYTEST_TIMEOUT_S = 120


def read_legacy_source() -> str:
    with open(guard.LEGACY_FILE) as f:
        return f.read()


def _rewrite_config_dict(source: str, spec: dict) -> str | None:
    """Minimal-diff path: patch _T values in place. Returns None if the
    edited spec no longer fits the legacy 4-band structure."""
    bands = spec["bands"]
    if len(bands) != 4 or bands[-1]["upper"] is not None:
        return None
    rates = [b["rate"] * 100 for b in bands]
    if any(abs(r - round(r)) > 1e-9 for r in rates):
        return None  # _T stores integer percents; fractional rates need the rewrite path
    thresholds = [int(b["upper"]) for b in bands[:3]]
    replacements = {
        "n": thresholds[0], "m": thresholds[1], "h": thresholds[2],
        "rn": int(round(rates[0])), "rm": int(round(rates[1])),
        "rh": int(round(rates[2])), "rt": int(round(rates[3])),
    }
    new_source = source
    for key, value in replacements.items():
        pattern = rf'("{key}":\s*)(\d+)(,\s*#)'
        if not re.search(pattern, new_source):
            return None
        new_source = re.sub(pattern, rf"\g<1>{value}\g<3>", new_source, count=1)
    return new_source


def _rewrite_calc_section(source: str, spec: dict) -> str:
    """Structural path: swap the threshold table + calc_v2 for a clean
    band-table implementation, preserving public entrypoints."""
    band_lines = []
    for band in spec["bands"]:
        upper = "None" if band["upper"] is None else str(int(band["upper"]))
        band_lines.append(f"    ({int(band['lower'])}, {upper}, {band['rate']!r}),")
    bands_block = "\n".join(band_lines)

    new_calc = f'''# band table generated from the approved rule spec: (lower, upper, rate)
_BANDS = [
{bands_block}
]


def calc_v2(price, flag3=0):
    _log("calc_v2", price, flag3)
    if _chk(price) == 0:
        return 0
    t = 0.0
    for lo, hi, rate in _BANDS:
        if price <= lo:
            break
        top = price if hi is None else min(price, hi)
        t += (top - lo) * rate
    # HMRC round down to whole pound (SDLT6 guidance)
    return int(t)
'''
    # Replace from the _T table comment through the end of calc_v2.
    pattern = re.compile(
        r"# -+\n# threshold table.*?\n_T = \{.*?\n\}\n", re.DOTALL
    )
    source = pattern.sub("", source, count=1)
    calc_pattern = re.compile(r"def calc_v2\(price, flag3=0\):.*?\n    return int\(t\)\n", re.DOTALL)
    return calc_pattern.sub(lambda _match: new_calc, source, count=1)


def deterministic_codegen(spec: dict) -> tuple[str, str]:
    """Returns (new_source, strategy)."""
    source = read_legacy_source()
    patched = _rewrite_config_dict(source, spec)
    if patched is not None:
        return patched, "config-dict patch (minimal diff)"
    return _rewrite_calc_section(source, spec), "calc-section rewrite (band structure changed)"


def unified_diff(original: str, modified: str) -> str:
    return "".join(
        difflib.unified_diff(
            original.splitlines(keepends=True),
            modified.splitlines(keepends=True),
            fromfile="legacy/sdlt_engine.py (original — untouched)",
            tofile="workdir/engine/sdlt_engine.py (working copy)",
        )
    )


def write_working_copy(new_source: str, test_source: str) -> dict:
    engine_path = os.path.join(guard.ALLOWED_WRITE_ROOT, "engine", "sdlt_engine.py")
    test_path = os.path.join(guard.ALLOWED_WRITE_ROOT, "engine", "tests", "test_engine_generated.py")
    guard.safe_write(engine_path, new_source)
    guard.safe_write(test_path, test_source)
    return {"engine": engine_path, "tests": test_path}


def run_pytest() -> dict:
    """Run the generated suite against the working copy in a subprocess."""
    test_dir = os.path.join(guard.ALLOWED_WRITE_ROOT, "engine", "tests")
    try:
        proc = subprocess.run(
            [sys.executable, "-m", "pytest", test_dir, "-q", "--no-header", "-p", "no:cacheprovider"],
            capture_output=True,
            text=True,
            timeout=PYTEST_TIMEOUT_S,
            cwd=guard.ALLOWED_WRITE_ROOT,
        )
        output = proc.stdout + ("\n" + proc.stderr if proc.stderr.strip() else "")
        return {"passed": proc.returncode == 0, "exit_code": proc.returncode, "output": output[-8000:]}
    except subprocess.TimeoutExpired:
        return {"passed": False, "exit_code": -1, "output": f"pytest timed out after {PYTEST_TIMEOUT_S}s"}
