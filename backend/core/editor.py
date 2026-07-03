"""Stage 5 — EDIT: deterministic plain-English rule editing.

Only stages 2 and 7 are allowed to call an LLM, so plain-English edits
are parsed here with a small deterministic grammar. Supported phrasings
(case-insensitive; amounts accept £, commas, "k" and "m"):

  "raise the nil-rate threshold to £300,000"
  "set the nil rate band to 300k"
  "lower the £925,000 threshold to £900,000"
  "move the 1.5m threshold to 2m"
  "change the 5% rate to 6%"
  "set the top rate to 15%"

Anything unparseable returns a clear error and the user can fall back to
editing the structured bands directly in the UI.
"""

from __future__ import annotations

import copy
import re


class EditParseError(ValueError):
    pass


_AMOUNT = r"£?\s*([\d][\d,\.]*)\s*(k|m|thousand|million)?"


def _parse_amount(number: str, suffix: str | None) -> float:
    value = float(number.replace(",", ""))
    if suffix in ("k", "thousand"):
        value *= 1_000
    elif suffix in ("m", "million"):
        value *= 1_000_000
    return value


def _set_threshold(spec: dict, band_index: int, new_value: float) -> dict:
    """Move the boundary between band_index and band_index+1."""
    bands = spec["bands"]
    if band_index >= len(bands) - 1:
        raise EditParseError("cannot move the upper bound of the final (open-ended) band")
    lower_floor = bands[band_index]["lower"]
    upper_ceiling = bands[band_index + 1]["upper"]
    if new_value <= lower_floor:
        raise EditParseError(
            f"new threshold £{new_value:,.0f} must be above the band's lower bound £{lower_floor:,.0f}"
        )
    if upper_ceiling is not None and new_value >= upper_ceiling:
        raise EditParseError(
            f"new threshold £{new_value:,.0f} must be below the next threshold £{upper_ceiling:,.0f}"
        )
    edited = copy.deepcopy(spec)
    edited["bands"][band_index]["upper"] = new_value
    edited["bands"][band_index + 1]["lower"] = new_value
    return edited


def apply_instruction(spec: dict, instruction: str) -> tuple[dict, str]:
    """Parse a plain-English instruction against a spec.

    Returns (edited_spec, human_description_of_change).
    Raises EditParseError when the instruction isn't understood.
    """
    text = instruction.strip().lower()
    if not text:
        raise EditParseError("empty instruction")
    bands = spec["bands"]

    # --- "nil-rate / zero-rate / tax-free threshold to X" -----------------
    match = re.search(
        rf"(nil|zero|tax)[\s\-]?(rate|free)?\s*(band|threshold|allowance)?[^\d£]*{_AMOUNT}",
        text,
    )
    if match and any(w in text for w in ("raise", "increase", "set", "change", "move", "lower", "reduce", "cut", "drop")):
        new_value = _parse_amount(match.group(4), match.group(5))
        zero_band = next((i for i, b in enumerate(bands) if b["rate"] == 0), None)
        if zero_band is None:
            raise EditParseError("this rule has no nil-rate (0%) band to move")
        old = bands[zero_band]["upper"]
        edited = _set_threshold(spec, zero_band, new_value)
        return edited, f"Nil-rate threshold moved from £{old:,.0f} to £{new_value:,.0f}"

    # --- "change the X% rate to Y%" ---------------------------------------
    match = re.search(r"([\d.]+)\s*%\s*(rate|band)?.{0,20}?\bto\b[^\d]*([\d.]+)\s*%", text)
    if match:
        old_rate = float(match.group(1)) / 100
        new_rate = float(match.group(3)) / 100
        if not (0 <= new_rate < 1):
            raise EditParseError(f"rate {match.group(3)}% is out of range")
        candidates = [i for i, b in enumerate(bands) if abs(b["rate"] - old_rate) < 1e-9]
        if not candidates:
            rates = ", ".join(f"{b['rate']*100:g}%" for b in bands)
            raise EditParseError(f"no band has a {match.group(1)}% rate (bands: {rates})")
        if len(candidates) > 1:
            raise EditParseError(f"{match.group(1)}% matches more than one band — edit the bands table instead")
        edited = copy.deepcopy(spec)
        edited["bands"][candidates[0]]["rate"] = new_rate
        return edited, f"Rate on band {candidates[0] + 1} changed from {old_rate*100:g}% to {new_rate*100:g}%"

    # --- "set the top rate to Y%" ------------------------------------------
    match = re.search(r"(top|highest|final)\s*(rate|band).{0,20}?\bto\b[^\d]*([\d.]+)\s*%", text)
    if match:
        new_rate = float(match.group(3)) / 100
        if not (0 <= new_rate < 1):
            raise EditParseError(f"rate {match.group(3)}% is out of range")
        edited = copy.deepcopy(spec)
        old_rate = edited["bands"][-1]["rate"]
        edited["bands"][-1]["rate"] = new_rate
        return edited, f"Top rate changed from {old_rate*100:g}% to {new_rate*100:g}%"

    # --- "move/raise/lower the £X threshold to £Y" ---------------------------
    match = re.search(rf"{_AMOUNT}\s*(threshold|boundary|band)\b.{{0,20}}?\bto\b[^\d£]*{_AMOUNT}", text)
    if match:
        old_value = _parse_amount(match.group(1), match.group(2))
        new_value = _parse_amount(match.group(4), match.group(5))
        candidates = [
            i for i, b in enumerate(bands)
            if b["upper"] is not None and abs(b["upper"] - old_value) < 1e-6
        ]
        if not candidates:
            thresholds = ", ".join(f"£{b['upper']:,.0f}" for b in bands if b["upper"] is not None)
            raise EditParseError(f"no threshold at £{old_value:,.0f} (thresholds: {thresholds})")
        edited = _set_threshold(spec, candidates[0], new_value)
        return edited, f"Threshold moved from £{old_value:,.0f} to £{new_value:,.0f}"

    raise EditParseError(
        "couldn't parse that instruction — try e.g. \"raise the nil-rate threshold to "
        "£300,000\" or \"change the 5% rate to 6%\", or edit the bands table directly"
    )


def apply_band_edits(spec: dict, new_bands: list[dict]) -> tuple[dict, str]:
    """Structured path: replace the bands wholesale (validated by caller)."""
    edited = copy.deepcopy(spec)
    edited["bands"] = copy.deepcopy(new_bands)
    return edited, "Bands table edited directly"
