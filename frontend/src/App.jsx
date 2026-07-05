import React, { useCallback, useEffect, useState } from "react";
import { api } from "./api.js";
import Landing from "./components/Landing.jsx";
import PlanRail from "./components/PlanRail.jsx";
import { ApproveBar, ErrorNote } from "./components/ui.jsx";
import { Stage1, Stage2, Stage3, Stage4, Stage5, Stage6, Stage7 } from "./components/stages.jsx";

const STAGE_VIEWS = { 1: Stage1, 2: Stage2, 3: Stage3, 4: Stage4, 5: Stage5, 6: Stage6, 7: Stage7 };

const HEADERS = {
  1: ["Ingest", "Load the legacy engine and the historical dataset."],
  2: ["Extract", "The LLM proposes a rule spec; the schema decides if it's acceptable."],
  3: ["Compile", "Deterministically turn the spec into an executable function."],
  4: ["Prove", "Replay every record: legacy vs extracted vs the official statutory rule."],
  5: ["Edit", "Change the rule in plain English — previewed before anything is applied."],
  6: ["Impact", "The CFO number: what the change does to real historical transactions."],
  7: ["Change & Verify", "Unified diff, applied to a guarded copy, verified by generated tests."],
};

export default function App() {
  const [state, setState] = useState(null);
  const [active, setActive] = useState(1);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [fatal, setFatal] = useState(null);
  const [route, setRoute] = useState(window.location.hash === "#/app" ? "app" : "landing");

  useEffect(() => {
    const onHash = () => setRoute(window.location.hash === "#/app" ? "app" : "landing");
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const refresh = useCallback(async () => {
    try {
      setState(await api.state());
      setFatal(null);
    } catch (e) {
      setFatal(e.message);
    }
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 4000);
    return () => clearInterval(timer);
  }, [refresh]);

  const act = async (fn, followStage) => {
    setBusy(true);
    setActionError(null);
    try {
      await fn();
      await refresh();
      if (followStage) setActive(followStage);
    } catch (e) {
      setActionError(e.message);
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  if (route === "landing")
    return <Landing onLaunch={() => (window.location.hash = "#/app")} />;

  if (fatal)
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="rounded-xl border border-rose-800 bg-rose-950/40 p-8 text-center">
          <div className="text-lg font-semibold text-rose-300">Backend unreachable</div>
          <div className="mono mt-2 text-xs text-rose-400">{fatal}</div>
          <div className="mt-3 text-sm text-slate-400">Start it with <span className="mono">make demo</span></div>
        </div>
      </div>
    );

  if (!state) return <div className="p-10 text-slate-500">Loading…</div>;

  const stage = state.stages.find((s) => s.id === active);
  const View = STAGE_VIEWS[active];
  const [title, subtitle] = HEADERS[active];
  const isNextActionable = ["ready", "error", "rejected"].includes(stage.status);

  const approve = (payload = {}) =>
    act(() => api.approve(stage.id, payload), stage.id < 7 ? stage.id + 1 : undefined);

  return (
    <div className="flex h-screen overflow-hidden">
      <PlanRail
        stages={state.stages}
        active={active}
        onSelect={setActive}
        integrity={state.legacy_integrity}
        llm={state.llm}
      />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl p-8">
          <div className="mb-6 flex items-start justify-between">
            <div>
              <div className="text-xs font-bold uppercase tracking-widest text-slate-500">
                Stage {stage.id} of 7 · {stage.phase === "read" ? "read-only analysis" : "gated write phase"}
              </div>
              <h2 className="mt-1 text-2xl font-bold tracking-tight text-white">{title}</h2>
              <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
            </div>
            <button
              onClick={() => act(async () => { await api.reset(); setActive(1); })}
              className="rounded-lg border border-slate-800 px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-800/60"
            >
              Reset demo
            </button>
          </div>

          {stage.status === "locked" ? (
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-10 text-center text-sm text-slate-500">
              This stage is locked until the previous stages are approved.
            </div>
          ) : (
            <>
              <View
                stage={stage}
                busy={busy}
                onApproveWithPayload={(payload) => approve(payload)}
              />
              <ErrorNote error={actionError || stage.error} />
              {active !== 5 && (
                <ApproveBar
                  stage={stage}
                  busy={busy}
                  onApprove={() => approve({})}
                  onSkip={() => act(() => api.skip(stage.id), stage.id + 1)}
                  onReject={() => act(() => api.reject(stage.id))}
                  approveLabel={
                    stage.status === "error" ? "Retry" : `Approve & run ${HEADERS[stage.id][0].toLowerCase()}`
                  }
                />
              )}
              {active === 5 && isNextActionable && null /* stage 5 approves via its preview flow */}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
