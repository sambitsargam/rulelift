"""LLM access — the ONLY module that talks to an external model API.

Stages 2 (extract) and 7 (code-gen) call ``chat_json``; every other part
of the pipeline is deterministic Python and must not import this module.

Reads OPENAI_API_KEY from the environment. When the key is missing (or
RULELIFT_MOCK_LLM=1), the app runs in "mock" mode: stage 2 falls back to
the cached spec in data/cached_spec.json and stage 7 falls back to the
deterministic code generator, so the full demo works with zero network.
"""

from __future__ import annotations

import json
import os

MODEL = os.environ.get("RULELIFT_MODEL", "gpt-4.1")  # single place to change the model
REQUEST_TIMEOUT_S = 90


class LLMUnavailable(RuntimeError):
    pass


def llm_mode() -> str:
    if os.environ.get("RULELIFT_MOCK_LLM") == "1":
        return "mock"
    return "live" if os.environ.get("OPENAI_API_KEY") else "mock"


def chat_json(system: str, user: str) -> dict:
    """One strict-JSON chat completion. Raises LLMUnavailable in mock mode
    or on transport errors — callers own the fallback."""
    if llm_mode() == "mock":
        raise LLMUnavailable("no OPENAI_API_KEY set (mock mode)")
    try:
        from openai import OpenAI

        client = OpenAI(timeout=REQUEST_TIMEOUT_S)
        response = client.chat.completions.create(
            model=MODEL,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
        )
        return json.loads(response.choices[0].message.content)
    except json.JSONDecodeError:
        raise  # caller feeds the parse error back on retry
    except Exception as exc:  # transport/auth/timeouts
        raise LLMUnavailable(f"LLM call failed: {exc}") from exc
