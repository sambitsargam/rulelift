import React from "react";
import { Mark } from "./Landing.jsx";

const STATUS_META = {
  locked: { icon: "○", cls: "text-slate-600", label: "locked" },
  ready: { icon: "◉", cls: "text-sky-400", label: "awaiting approval" },
  running: { icon: "◌", cls: "text-amber-400 animate-pulse", label: "running" },
  done: { icon: "●", cls: "text-emerald-400", label: "done" },
  skipped: { icon: "◇", cls: "text-slate-500", label: "skipped" },
  rejected: { icon: "✕", cls: "text-rose-400", label: "rejected" },
  error: { icon: "!", cls: "text-rose-400", label: "error" },
};

export default function PlanRail({ stages, active, onSelect, integrity, llm }) {
  const readStages = stages.filter((s) => s.phase === "read");
  const writeStages = stages.filter((s) => s.phase === "write");

  const Section = ({ title, tone, items }) => (
    <div className="mb-4">
      <div className={`mb-2 px-3 text-[11px] font-bold uppercase tracking-widest ${tone}`}>
        {title}
      </div>
      {items.map((stage) => {
        const meta = STATUS_META[stage.status] || STATUS_META.locked;
        const isActive = active === stage.id;
        return (
          <button
            key={stage.id}
            onClick={() => onSelect(stage.id)}
            className={`mb-1 flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition ${
              isActive ? "bg-slate-800/80 ring-1 ring-slate-700" : "hover:bg-slate-800/40"
            }`}
          >
            <span className={`mt-0.5 w-4 text-center text-sm ${meta.cls}`}>{meta.icon}</span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-slate-200">
                {stage.id}. {stage.name}
              </span>
              <span className={`block text-[11px] ${meta.cls}`}>{meta.label}</span>
            </span>
          </button>
        );
      })}
    </div>
  );

  return (
    <aside className="flex w-72 shrink-0 flex-col border-r border-slate-800 bg-slate-900/40 p-4">
      <div className="mb-6 px-3">
        <a href="#/" className="flex items-center gap-2.5" title="Back to the landing page">
          <Mark className="h-7 w-7" />
          <h1 className="text-xl font-bold tracking-tight text-white">
            Rule<span className="text-sky-400">Lift</span>
          </h1>
        </a>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">
          Extract → prove → change a buried business rule, with an approval gate at every step.
        </p>
      </div>

      <Section title="Read-only analysis" tone="text-sky-500" items={readStages} />
      <Section title="Gated write phase" tone="text-amber-500" items={writeStages} />

      <div className="mt-auto space-y-2 px-3 pt-4 text-[11px] leading-relaxed">
        <div
          className={`rounded-lg border p-2.5 ${
            integrity?.untouched
              ? "border-emerald-800/60 bg-emerald-950/30 text-emerald-400"
              : "border-rose-700 bg-rose-950/40 text-rose-300"
          }`}
        >
          {integrity?.untouched ? "✓ Original legacy file untouched" : "⚠ LEGACY FILE MODIFIED"}
          <div className="mono mt-1 truncate text-[10px] opacity-60">
            sha256 {integrity?.sha256?.slice(0, 16)}…
          </div>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-2.5 text-slate-400">
          LLM: <span className={llm?.mode === "live" ? "text-emerald-400" : "text-amber-400"}>
            {llm?.mode === "live" ? `live (${llm.model})` : "mock — cached spec"}
          </span>
          <div className="mt-0.5 text-[10px] text-slate-600">
            Used only for extract & code-gen. All proofs are deterministic.
          </div>
        </div>
      </div>
    </aside>
  );
}
