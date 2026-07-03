"""RuleLift API — approval-gated stage machine around the deterministic core.

Human-in-the-loop contract, enforced here and in core/guard.py:
  * every stage runs ONLY on an explicit approve call;
  * stages 1–4 are strictly read-only; stages 5–7 write only inside
    workdir/ via the write-guard;
  * the original legacy file is fingerprinted at startup and its
    integrity is reported on every state response;
  * the pipeline never touches git.
"""

from __future__ import annotations

import os
import threading
import traceback

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from backend.core import changegen, guard
from backend.core.compiler import compile_spec
from backend.core.datagen import ensure_dataset
from backend.core.editor import EditParseError, apply_band_edits, apply_instruction
from backend.core.impact import impact_diff
from backend.core.ingest import code_stats, load_dataset
from backend.core.oracle import OFFICIAL_BANDS
from backend.core.replay import load_legacy_engine, replay
from backend.core.schema import validate_spec
from backend.core.testgen import golden_cases, render_test_file
from backend.llm import codegen as llm_codegen
from backend.llm.client import MODEL, LLMUnavailable, llm_mode
from backend.llm.extract import extract_rule, load_cached_spec

DATASET_PATH = os.path.join(guard.REPO_ROOT, "data", "transactions.csv")
FRONTEND_DIST = os.path.join(guard.REPO_ROOT, "frontend", "dist")

STAGES = [
    {"id": 1, "name": "Ingest", "phase": "read", "blurb": "Load the legacy code and the historical dataset; triage data quality."},
    {"id": 2, "name": "Extract", "phase": "read", "blurb": "LLM proposes a machine-readable rule spec from the legacy source."},
    {"id": 3, "name": "Compile", "phase": "read", "blurb": "Deterministically compile the spec into an executable function."},
    {"id": 4, "name": "Prove", "phase": "read", "blurb": "Replay legacy vs extracted vs official law over every valid record."},
    {"id": 5, "name": "Edit", "phase": "write", "blurb": "Change the rule in plain English or by editing the bands."},
    {"id": 6, "name": "Impact", "phase": "write", "blurb": "Quantify the change against the real historical data."},
    {"id": 7, "name": "Change & Verify", "phase": "write", "blurb": "Generate the code diff and run generated tests on a copy."},
]


class Pipeline:
    def __init__(self):
        self.lock = threading.Lock()
        self.integrity = guard.LegacyIntegrity()
        self.reset()

    def reset(self):
        self.status = {s["id"]: "ready" if s["id"] == 1 else "locked" for s in STAGES}
        self.results: dict[int, dict] = {}
        self.errors: dict[int, str] = {}
        # runtime artefacts (not serialised)
        self.records: list[tuple[str, float]] = []
        self.legacy_fn = None
        self.spec: dict | None = None
        self.extracted_fn = None
        self.edited_spec: dict | None = None
        self.edited_fn = None
        self.edit_description: str | None = None

    # ------------------------------------------------------------- state
    def state(self) -> dict:
        return {
            "stages": [
                {
                    **s,
                    "status": self.status[s["id"]],
                    "result": self.results.get(s["id"]),
                    "error": self.errors.get(s["id"]),
                }
                for s in STAGES
            ],
            "llm": {"mode": llm_mode(), "model": MODEL},
            "legacy_integrity": self.integrity.check(),
            "guard": {
                "allowed_write_root": os.path.relpath(guard.ALLOWED_WRITE_ROOT, guard.REPO_ROOT),
                "note": "all pipeline writes go through the write-guard; git is never invoked",
            },
        }

    def _require(self, stage_id: int, status: str = "done"):
        if self.status.get(stage_id) != status:
            raise HTTPException(409, f"stage {stage_id} must be {status} first (currently: {self.status.get(stage_id)})")

    def _unlock(self, stage_id: int):
        if stage_id <= len(STAGES) and self.status[stage_id] == "locked":
            self.status[stage_id] = "ready"

    # ------------------------------------------------------------- stages
    def run_stage(self, stage_id: int, payload: dict) -> dict:
        if self.status.get(stage_id) not in ("ready", "error", "rejected"):
            raise HTTPException(
                409,
                f"stage {stage_id} is not awaiting approval (status: {self.status.get(stage_id)})",
            )
        self.status[stage_id] = "running"
        try:
            runner = getattr(self, f"_stage_{stage_id}")
            result = runner(payload)
            self.results[stage_id] = result
            self.errors.pop(stage_id, None)
            self.status[stage_id] = "done"
            self._unlock(stage_id + 1)
            return result
        except HTTPException:
            self.status[stage_id] = "error"
            raise
        except (EditParseError,) as exc:
            self.status[stage_id] = "error"
            self.errors[stage_id] = str(exc)
            raise HTTPException(422, str(exc))
        except Exception as exc:
            self.status[stage_id] = "error"
            self.errors[stage_id] = f"{exc}\n{traceback.format_exc(limit=3)}"
            raise HTTPException(500, str(exc))

    def _stage_1(self, payload: dict) -> dict:
        source = ensure_dataset(DATASET_PATH)
        quality = load_dataset(DATASET_PATH)
        self.records = list(quality["records"].itertuples(index=False, name=None))
        self.legacy_fn = load_legacy_engine(guard.LEGACY_FILE)
        stats = code_stats(guard.LEGACY_FILE)
        return {
            "code": stats,
            "dataset_source": {k: v for k, v in source.items() if k != "records"},
            "quality": {k: v for k, v in quality.items() if k != "records"},
        }

    def _stage_2(self, payload: dict) -> dict:
        self._require(1)
        with open(guard.LEGACY_FILE) as f:
            legacy_source = f.read()
        extraction = extract_rule(legacy_source)
        self.spec = extraction["spec"]
        return {
            "spec": extraction["spec"],
            "attempts": extraction["attempts"],
            "mode": extraction["mode"],
            "used_cache": extraction["used_cache"],
            "legacy_source": legacy_source,
        }

    def _stage_3(self, payload: dict) -> dict:
        self._require(1)
        if self.spec is None:  # stage 2 skipped -> cached spec fallback
            self.spec = load_cached_spec()
        errors = validate_spec(self.spec)
        if errors:
            raise HTTPException(422, f"spec failed validation: {errors}")
        self.extracted_fn = compile_spec(self.spec)
        probes = [125_000, 250_000, 300_000, 500_000, 1_000_000, 2_000_000]
        return {
            "compiled": True,
            "engine": "deterministic band compiler (no LLM at runtime)",
            "probe_values": [{"price": p, "tax": self.extracted_fn(p)} for p in probes],
        }

    def _stage_4(self, payload: dict) -> dict:
        self._require(3)
        proof = replay(self.records, self.legacy_fn, self.extracted_fn, self.spec)
        return proof

    def _stage_5(self, payload: dict) -> dict:
        self._require(3)
        instruction = (payload.get("instruction") or "").strip()
        bands = payload.get("bands")
        if instruction:
            edited, description = apply_instruction(self.spec, instruction)
        elif bands:
            edited, description = apply_band_edits(self.spec, bands)
            errors = validate_spec(edited)
            if errors:
                raise HTTPException(422, f"edited bands are invalid: {errors}")
        else:
            raise HTTPException(422, "provide an instruction or a bands array")
        self.edited_spec = edited
        self.edited_fn = compile_spec(edited)
        self.edit_description = description
        # editing invalidates any previous downstream results
        for downstream in (6, 7):
            self.results.pop(downstream, None)
            if self.status[downstream] == "done":
                self.status[downstream] = "ready"
        return {
            "description": description,
            "instruction": instruction or None,
            "before_bands": self.spec["bands"],
            "after_bands": edited["bands"],
        }

    def _stage_6(self, payload: dict) -> dict:
        self._require(5)
        return impact_diff(self.records, self.extracted_fn, self.edited_fn)

    def _stage_7(self, payload: dict) -> dict:
        self._require(5)
        strategy = payload.get("strategy", "auto")  # auto | llm | deterministic
        original = changegen.read_legacy_source()
        cases = golden_cases(self.edited_spec, self.edited_fn, [p for _, p in self.records])
        test_source = render_test_file(cases, self.edit_description or "rule edit")

        attempts = []

        def run_candidate(new_source: str, label: str, rationale: str) -> dict:
            diff = changegen.unified_diff(original, new_source)
            changegen.write_working_copy(new_source, test_source)
            test_result = changegen.run_pytest()
            attempt = {
                "generator": label,
                "rationale": rationale,
                "diff": diff,
                "tests": test_result,
                "golden_case_count": len(cases),
            }
            attempts.append(attempt)
            return attempt

        use_llm = strategy == "llm" or (strategy == "auto" and llm_mode() == "live")
        final = None
        if use_llm:
            try:
                proposal = llm_codegen.llm_generate_engine(original, self.edited_spec)
                final = run_candidate(proposal["file_content"], "llm", proposal["rationale"])
                if not final["tests"]["passed"]:  # one automated retry with failures fed back
                    proposal = llm_codegen.llm_generate_engine(
                        original, self.edited_spec, feedback=final["tests"]["output"]
                    )
                    final = run_candidate(proposal["file_content"], "llm (retry)", proposal["rationale"])
            except LLMUnavailable as exc:
                attempts.append({"generator": "llm", "rationale": f"unavailable: {exc}", "skipped": True})
                final = None

        if final is None or (strategy == "auto" and not final["tests"]["passed"]):
            new_source, det_strategy = changegen.deterministic_codegen(self.edited_spec)
            final = run_candidate(
                new_source,
                "deterministic",
                f"Mechanical rewrite from the approved spec: {det_strategy}. "
                f"Satisfies the approved requirement: {self.edit_description}.",
            )

        if not final["tests"]["passed"]:
            self.errors[7] = "generated tests failed — review the output and retry or reject"

        return {
            "requirement": self.edit_description,
            "final": final,
            "attempts": [
                {k: v for k, v in a.items() if k != "diff"} | {"passed": a.get("tests", {}).get("passed")}
                for a in attempts
            ],
            "integrity_after": self.integrity.check(),
        }


PIPELINE = Pipeline()

app = FastAPI(title="RuleLift", version="1.0")
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"]
)


class StagePayload(BaseModel):
    instruction: str | None = None
    bands: list[dict] | None = None
    strategy: str | None = None


@app.get("/api/state")
def get_state():
    with PIPELINE.lock:
        return PIPELINE.state()


@app.post("/api/stage/{stage_id}/approve")
def approve_stage(stage_id: int, payload: StagePayload | None = None):
    if not 1 <= stage_id <= len(STAGES):
        raise HTTPException(404, "no such stage")
    body = (payload.model_dump(exclude_none=True) if payload else {})
    with PIPELINE.lock:
        result = PIPELINE.run_stage(stage_id, body)
        return {"result": result, "state": PIPELINE.state()}


@app.post("/api/stage/{stage_id}/skip")
def skip_stage(stage_id: int):
    with PIPELINE.lock:
        if PIPELINE.status.get(stage_id) not in ("ready", "error", "rejected"):
            raise HTTPException(409, "stage is not awaiting a decision")
        if stage_id in (1, 3, 4, 5, 6, 7):
            raise HTTPException(422, "only the LLM extraction (stage 2) can be skipped — it falls back to the cached spec")
        PIPELINE.status[stage_id] = "skipped"
        PIPELINE._unlock(stage_id + 1)
        return PIPELINE.state()


@app.post("/api/stage/{stage_id}/reject")
def reject_stage(stage_id: int):
    with PIPELINE.lock:
        if PIPELINE.status.get(stage_id) not in ("ready", "error", "done"):
            raise HTTPException(409, "stage cannot be rejected in its current status")
        PIPELINE.status[stage_id] = "rejected"
        # rejecting halts everything downstream
        for s in STAGES:
            if s["id"] > stage_id and PIPELINE.status[s["id"]] in ("ready",):
                PIPELINE.status[s["id"]] = "locked"
        return PIPELINE.state()


@app.post("/api/edit/preview")
def preview_edit(payload: StagePayload):
    """Dry-run of a stage-5 edit: parse + validate, commit nothing."""
    with PIPELINE.lock:
        if PIPELINE.spec is None:
            raise HTTPException(409, "run stages 1–3 first")
        try:
            if payload.instruction and payload.instruction.strip():
                edited, description = apply_instruction(PIPELINE.spec, payload.instruction)
            elif payload.bands:
                edited, description = apply_band_edits(PIPELINE.spec, payload.bands)
                errors = validate_spec(edited)
                if errors:
                    raise HTTPException(422, f"edited bands are invalid: {errors}")
            else:
                raise HTTPException(422, "provide an instruction or a bands array")
        except EditParseError as exc:
            raise HTTPException(422, str(exc))
        return {
            "description": description,
            "before_bands": PIPELINE.spec["bands"],
            "after_bands": edited["bands"],
        }


@app.get("/api/reference/official-bands")
def official_bands():
    return {"bands": OFFICIAL_BANDS}


@app.post("/api/reset")
def reset():
    with PIPELINE.lock:
        PIPELINE.reset()
        return PIPELINE.state()


if os.path.isdir(FRONTEND_DIST):
    app.mount("/", StaticFiles(directory=FRONTEND_DIST, html=True), name="frontend")
