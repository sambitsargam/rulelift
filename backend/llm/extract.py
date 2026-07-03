"""Stage 2 — LLM rule extraction with schema-validated retries.

The model PROPOSES a spec; deterministic validation (schema.py) decides
whether it's acceptable. Invalid output is retried up to MAX_ATTEMPTS
times with the exact validation errors fed back. If the LLM is
unavailable (no key / network down), the cached spec ships with the
repo so the demo still runs end to end.
"""

from __future__ import annotations

import json
import os

from backend.core.schema import validate_spec
from .client import LLMUnavailable, chat_json, llm_mode

MAX_ATTEMPTS = 3
CACHED_SPEC_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "data",
    "cached_spec.json",
)

SYSTEM_PROMPT = """You are a legacy-code analyst. You will be given a Python module that
implements a tax calculation. Extract the business rule ACTUALLY IMPLEMENTED by the live
code path (entrypoint: compute_duty). Ignore dead code, disabled self-checks and comments
about what the code "should" do — report what it DOES.

Return ONLY a JSON object with exactly these fields:
{
  "rule_name": "<short name>",
  "summary": "<plain-English explanation a non-engineer can read, 2-4 sentences>",
  "conditions": ["<scope/applicability notes observed in the code>"],
  "assumptions": ["<anything you had to assume or found ambiguous — be honest>"],
  "bands": [{"lower": <number>, "upper": <number or null>, "rate": <fraction, e.g. 0.05>}]
}

Band rules: bands ordered ascending, first lower = 0, contiguous (each lower equals the
previous upper), final band upper = null, rates as fractions in [0,1). Do not "correct"
values to what you believe current law is — extract what the code implements."""


def extract_rule(legacy_source: str) -> dict:
    """Returns {spec, attempts: [...], mode, used_cache}."""
    attempts: list[dict] = []
    if llm_mode() == "mock":
        spec = load_cached_spec()
        return {
            "spec": spec,
            "attempts": [{"attempt": 0, "outcome": "mock mode — using cached spec (no OPENAI_API_KEY)"}],
            "mode": "mock",
            "used_cache": True,
        }

    user_prompt = f"Extract the rule from this module:\n\n```python\n{legacy_source}\n```"
    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            candidate = chat_json(SYSTEM_PROMPT, user_prompt)
        except json.JSONDecodeError as exc:
            attempts.append({"attempt": attempt, "outcome": f"invalid JSON: {exc}"})
            user_prompt += f"\n\nYour previous reply was not valid JSON ({exc}). Return only the JSON object."
            continue
        except LLMUnavailable as exc:
            attempts.append({"attempt": attempt, "outcome": f"LLM unavailable: {exc}"})
            spec = load_cached_spec()
            return {"spec": spec, "attempts": attempts, "mode": "fallback_cache", "used_cache": True}

        errors = validate_spec(candidate)
        if not errors:
            attempts.append({"attempt": attempt, "outcome": "valid spec"})
            return {"spec": candidate, "attempts": attempts, "mode": "live", "used_cache": False}

        attempts.append({"attempt": attempt, "outcome": f"schema errors: {errors}"})
        user_prompt += (
            "\n\nYour previous JSON failed validation with these errors:\n- "
            + "\n- ".join(errors)
            + "\nFix them and return the corrected JSON object only."
        )

    raise RuntimeError(
        f"extraction failed after {MAX_ATTEMPTS} attempts: {attempts[-1]['outcome']}"
    )


def load_cached_spec() -> dict:
    with open(CACHED_SPEC_PATH) as f:
        spec = json.load(f)
    errors = validate_spec(spec)
    if errors:
        raise RuntimeError(f"cached spec is invalid: {errors}")
    return spec
