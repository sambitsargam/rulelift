"""Rule-spec schema and validation.

A spec is the machine-readable form of an extracted business rule:

{
  "rule_name": str,
  "summary": str,                       # plain-English explanation
  "conditions": [str],                  # scope/applicability notes
  "assumptions": [str],                 # things the extractor had to assume
  "bands": [ {"lower": num, "upper": num|null, "rate": num}, ... ]
}

Validation is deliberately strict and produces human-readable errors —
the same messages are fed back to the LLM on a retry, so they must say
exactly what is wrong.
"""

from __future__ import annotations


class SpecValidationError(ValueError):
    def __init__(self, errors: list[str]):
        self.errors = errors
        super().__init__("; ".join(errors))


def validate_spec(spec) -> list[str]:
    """Return a list of validation errors (empty list == valid)."""
    errors: list[str] = []
    if not isinstance(spec, dict):
        return [f"spec must be a JSON object, got {type(spec).__name__}"]

    for key in ("rule_name", "summary"):
        if not isinstance(spec.get(key), str) or not spec.get(key, "").strip():
            errors.append(f'"{key}" must be a non-empty string')

    for key in ("conditions", "assumptions"):
        val = spec.get(key)
        if not isinstance(val, list) or any(not isinstance(x, str) for x in val):
            errors.append(f'"{key}" must be an array of strings (use [] if none)')

    bands = spec.get("bands")
    if not isinstance(bands, list) or len(bands) == 0:
        errors.append('"bands" must be a non-empty array of band objects')
        return errors

    for i, band in enumerate(bands):
        if not isinstance(band, dict):
            errors.append(f"bands[{i}] must be an object")
            continue
        lower, upper, rate = band.get("lower"), band.get("upper"), band.get("rate")
        if not isinstance(lower, (int, float)) or isinstance(lower, bool):
            errors.append(f"bands[{i}].lower must be a number")
        if upper is not None and (not isinstance(upper, (int, float)) or isinstance(upper, bool)):
            errors.append(f"bands[{i}].upper must be a number or null (null only for the final band)")
        if not isinstance(rate, (int, float)) or isinstance(rate, bool):
            errors.append(f"bands[{i}].rate must be a number")
        elif not (0 <= rate < 1):
            errors.append(
                f"bands[{i}].rate must be a fraction in [0, 1), e.g. 0.05 for 5% — got {rate}"
            )

    if errors:
        return errors

    # structural checks: ordered, contiguous, covering [0, inf)
    if bands[0]["lower"] != 0:
        errors.append(f"bands[0].lower must be 0 (bands must start at zero), got {bands[0]['lower']}")
    for i, band in enumerate(bands):
        if band["upper"] is None and i != len(bands) - 1:
            errors.append(f"bands[{i}].upper is null but it is not the final band")
        elif band["upper"] is not None and band["upper"] <= band["lower"]:
            errors.append(f"bands[{i}]: upper ({band['upper']}) must exceed lower ({band['lower']})")
        if i > 0:
            prev_upper = bands[i - 1]["upper"]
            if prev_upper is not None and band["lower"] != prev_upper:
                errors.append(
                    f"bands must be contiguous: bands[{i}].lower ({band['lower']}) "
                    f"!= bands[{i-1}].upper ({prev_upper})"
                )
    if bands[-1]["upper"] is not None:
        errors.append("the final band's upper must be null (rule must cover all prices)")

    return errors


def assert_valid_spec(spec) -> None:
    errors = validate_spec(spec)
    if errors:
        raise SpecValidationError(errors)
