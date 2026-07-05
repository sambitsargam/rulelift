# RuleLift

**Legacy business-rule extraction, proof, and safe-change copilot.**

RuleLift takes a piece of legacy code with a business rule buried inside it, extracts that
rule into a plain-English + machine-executable spec, **proves** the spec matches the legacy
code's real behaviour by replaying it over ~22,000 real UK property transactions, lets a
non-engineer change the rule in plain English, quantifies the £ impact of that change on the
real historical data, and generates a reviewed, test-backed code change — with a human
approval gate at every step.

**The core property: correctness is deterministic and shown live.** The LLM only *proposes*
(rule extraction, code generation). All validation, replay, impact math, and testing is pure
deterministic Python. The model is never the judge of its own work.

---

## Quick start

```bash
make demo          # builds everything, serves http://localhost:8877
```

The app opens on a landing page — hit **Launch the demo** to enter the seven-stage pipeline.

Requirements: Python 3.11+, Node 18+, `make`. No database, no auth, no manual data setup —
the app downloads HM Land Registry Price Paid Data on first run (falling back to a realistic
synthetic dataset if offline).

**LLM mode:** put `OPENAI_API_KEY=sk-...` in a `.env` file (or export it) for live extraction
and code-gen. With no key the app runs in **mock mode** — extraction uses a cached spec and
code-gen uses the deterministic generator, so the full demo works with zero network.
The model is a single constant (`RULELIFT_MODEL`, default `gpt-4.1`).

Other useful targets:

```bash
make test          # unit tests for the deterministic core (38 tests, no LLM, no network)
make headless      # the whole math pipeline in the terminal: fidelity, drift, impact, diff, pytest
make dev           # backend + Vite dev server with hot reload
```

---

## The demo, in 90 seconds

1. **Ingest** — "Here's a legacy tax engine: 150 lines of undocumented, mainframe-ported
   Python (`legacy/sdlt_engine.py`). A consultant would read this for weeks." Approve; the
   app also loads ~22,000 real UK property transactions and triages every messy row.
2. **Extract** — "The tool read the code. Here's the rule in plain English" — side by side
   with the raw legacy source, plus the model's honest assumptions.
3. **Prove** — the hero moment. "Watch it replay against 22,000 real transactions —
   **100% fidelity**. It understood the system. And look at the red panel: the legacy code
   disagrees with the official statutory rates on **17,659 transactions — £35.2M
   undercharged**." The nil-rate threshold in the code was never updated after the rates
   changed. Nobody told the app that; deterministic replay found it.
4. **Edit** — type one sentence: *"raise the nil-rate threshold to £300,000"*. Preview the
   parsed change before approving.
5. **Impact** — "That change affects **10,438 real transactions, £23.7M** — here's the
   distribution and who wins."
6. **Change & Verify** — a unified diff against the engine, applied to a guarded copy,
   verified by **71 pytest golden cases generated from the historical data**. Tests go
   green. "Weeks of consultant work in minutes — and nothing changed without my approval."

(Exact figures depend on the dataset snapshot; every number is computed live, never asserted.)

---

## How it works

```
┌──────────────── READ-ONLY ANALYSIS ────────────────┐  ┌────────── GATED WRITE PHASE ──────────┐
│ 1 INGEST   legacy code + dataset, quality triage   │  │ 5 EDIT    plain English → new spec     │
│ 2 EXTRACT  LLM → strict-JSON spec (schema+retries) │  │ 6 IMPACT  replay old vs new over data  │
│ 3 COMPILE  spec → apply_extracted(price), no LLM   │  │ 7 CHANGE  diff → copy → generated      │
│ 4 PROVE    replay: legacy vs extracted vs official │  │           pytest suite → green/red     │
└────────────────────────────────────────────────────┘  └────────────────────────────────────────┘
```

Stage 4 replays **three** implementations over every valid record:

| comparison | meaning |
|---|---|
| legacy vs extracted | **extraction fidelity** — did we understand the code? |
| legacy vs official statutory oracle | **legacy drift** — where does the system disagree with the law, and for how much? |

The official rates live in `backend/core/oracle.py`, which the legacy module never imports —
so the drift finding is a genuine cross-check, not circular.

### Human-in-the-loop, enforced in code

- Every stage runs only on an explicit **Approve** (Skip is allowed only for the LLM
  extraction, which falls back to the cached spec; Reject halts everything downstream).
- All pipeline writes go through a **write-guard** (`backend/core/guard.py`) that refuses
  any path outside `workdir/`. The original legacy file is SHA-256 fingerprinted at startup
  and its integrity is displayed in the UI at all times. The pipeline never invokes git.
- Every generated change ships as a unified diff with a rationale and the requirement it
  satisfies, plus a live pytest run — red results are shown, with one automated retry that
  feeds the failures back to the generator.

### Robustness

- Messy data never crashes anything: rows are classified (blank, junk text, zero/negative,
  implausible outlier), counted, excluded from the math, and shown with reasons.
- LLM JSON is schema-validated with a max-3 retry loop feeding exact errors back.
- All external calls (dataset download, LLM) have timeouts and graceful fallbacks; the whole
  demo works offline in mock mode.

---

## Repository layout

```
legacy/sdlt_engine.py     the "black box" — crusty UK Stamp Duty engine (read-only, never modified)
backend/core/             deterministic core: oracle, schema, compiler, replay, impact,
                          editor (plain-English parser), guard, testgen, changegen, ingest, datagen
backend/llm/              the ONLY code that calls the OpenAI API (stages 2 & 7)
backend/app.py            FastAPI stage machine with approval gates
backend/tests/            38 unit tests for the deterministic core
frontend/                 React + Vite + Tailwind single-page app (Recharts for the impact chart)
data/cached_spec.json     fallback spec so the demo runs without an API key
scripts/headless_demo.py  the whole pipeline, no server, no UI
workdir/                  the only directory the pipeline may write to (gitignored)
```

## Why UK Stamp Duty?

SDLT residential rates are a real, public, band-based rule that changes at every Budget —
everyone understands "the government moved the threshold." The bundled legacy engine
deliberately carries a **stale nil-rate band** (the kind of thing that happens when a
temporary relief ends and nobody updates the batch job), which is exactly the class of bug
RuleLift's replay proof is designed to surface.
