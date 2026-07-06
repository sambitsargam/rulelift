import React from "react";
import { Mark, Wordmark } from "./Landing.jsx";

const STATUS_META = {
  locked: { label: "locked", cls: "text-faint/60" },
  ready: { label: "awaiting approval", cls: "text-brass" },
  running: { label: "running…", cls: "text-brass animate-pulse" },
  done: { label: "done ✓", cls: "text-moss" },
  skipped: { label: "skipped", cls: "text-faint" },
  rejected: { label: "rejected ✕", cls: "text-blood" },
  error: { label: "error !", cls: "text-blood" },
};

export default function PlanRail({ stages, active, onSelect, integrity, llm }) {
  const readStages = stages.filter((s) => s.phase === "read");
  const writeStages = stages.filter((s) => s.phase === "write");

  const Section = ({ title, tone, border, items }) => (
    <div className="mb-6">
      <div className={`kicker mb-1 border-b-2 pb-2 ${tone} ${border}`}>{title}</div>
      {items.map((stage) => {
        const meta = STATUS_META[stage.status] || STATUS_META.locked;
        const isActive = active === stage.id;
        return (
          <button
            key={stage.id}
            onClick={() => onSelect(stage.id)}
            className={`flex w-full items-baseline gap-3 border-b border-rule px-1 py-3 text-left transition-colors ${
              isActive ? "bg-sheet" : "hover:bg-sheet/60"
            }`}
            style={isActive ? { boxShadow: "inset 2px 0 0 #211c12" } : undefined}
          >
            <span className="mono w-6 shrink-0 text-[11px] font-medium text-faint">
              {String(stage.id).padStart(2, "0")}
            </span>
            <span className="min-w-0 flex-1">
              <span className={`block text-[14px] ${isActive ? "font-semibold" : "font-medium"}`}>
                {stage.name}
              </span>
              <span className={`mono block text-[10.5px] ${meta.cls}`}>{meta.label}</span>
            </span>
          </button>
        );
      })}
    </div>
  );

  return (
    <aside className="flex w-72 shrink-0 flex-col overflow-y-auto border-r border-rule bg-paper px-5 py-5">
      <a href="#/" className="flex items-center gap-2.5" title="Back to the landing page">
        <Mark className="h-7 w-7" />
        <Wordmark />
      </a>
      <p className="mt-2 mb-7 text-[12px] leading-relaxed text-faint">
        Extract → prove → change a buried business rule, with an approval gate at every step.
      </p>

      <Section title="Read-only analysis" tone="text-moss" border="border-moss" items={readStages} />
      <Section title="Gated write phase" tone="text-brass" border="border-brass" items={writeStages} />

      <div className="mt-auto space-y-2.5 pt-4">
        <div
          className={`border-l-2 py-1 pl-3 text-[11.5px] leading-snug ${
            integrity?.untouched ? "border-moss text-moss" : "border-blood text-blood"
          }`}
        >
          {integrity?.untouched ? "Original legacy file untouched ✓" : "LEGACY FILE MODIFIED ⚠"}
          <div className="mono mt-0.5 truncate text-[10px] text-faint">
            sha256 {integrity?.sha256?.slice(0, 16)}…
          </div>
        </div>
        <div className="border-l-2 border-ruledark py-1 pl-3 text-[11.5px] leading-snug text-faint">
          LLM:{" "}
          <span className={llm?.mode === "live" ? "font-semibold text-ink" : "font-semibold text-brass"}>
            {llm?.mode === "live" ? `live (${llm.model})` : "mock — cached spec"}
          </span>
          <div className="mt-0.5 text-[10.5px]">
            Used only for extract &amp; code-gen. All proofs are deterministic.
          </div>
        </div>
      </div>
    </aside>
  );
}
