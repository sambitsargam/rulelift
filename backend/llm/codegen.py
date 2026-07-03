"""Stage 7 — LLM code generation (optional path).

Asks the model to rewrite the legacy engine to implement the approved
edited spec. The model only PROPOSES source code: the generated golden
tests (deterministic) decide green/red, and one automated retry feeds
the failures back. In mock mode — or if the LLM output can't even be
parsed — the deterministic generator in core/changegen.py is used
instead, so stage 7 always works.
"""

from __future__ import annotations

import json

from .client import LLMUnavailable, chat_json, llm_mode

SYSTEM_PROMPT = """You are modifying a legacy Python tax module. You will receive the
current source and a JSON spec of the NEW rule (progressive bands: (lower, upper, rate),
final upper null, tax rounded down to the whole pound with int()).

Rewrite the module so the live path (compute_duty / calc / calc_v2) implements the new
spec exactly. Keep the file's public entrypoints and overall character; change as little
as possible. Do not add new dependencies.

Return ONLY a JSON object: {"file_content": "<the complete new module source>",
"rationale": "<one paragraph: what you changed and why>"}"""


def llm_generate_engine(legacy_source: str, edited_spec: dict, feedback: str | None = None) -> dict:
    """Returns {"file_content": str, "rationale": str}. Raises LLMUnavailable
    in mock mode; caller falls back to deterministic codegen."""
    if llm_mode() == "mock":
        raise LLMUnavailable("mock mode")

    user = (
        "Current module:\n\n```python\n" + legacy_source + "\n```\n\n"
        "New rule spec:\n\n```json\n" + json.dumps(edited_spec, indent=2) + "\n```"
    )
    if feedback:
        user += (
            "\n\nYour previous version FAILED these generated tests — fix the code "
            "(the tests are correct):\n\n" + feedback
        )
    result = chat_json(SYSTEM_PROMPT, user)
    if not isinstance(result.get("file_content"), str) or "def compute_duty" not in result["file_content"]:
        raise LLMUnavailable("LLM returned unusable file_content")
    result.setdefault("rationale", "no rationale provided")
    return result
