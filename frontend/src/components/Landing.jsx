import React from "react";

export function Mark({ className = "h-8 w-8" }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <rect width="64" height="64" rx="14" fill="#0f172a" stroke="#1e293b" />
      <rect x="10" y="44" width="13" height="10" rx="2.5" fill="#38bdf8" />
      <rect x="26" y="36" width="13" height="18" rx="2.5" fill="#38bdf8" />
      <rect x="42" y="28" width="13" height="26" rx="2.5" fill="#38bdf8" />
      <path
        d="M13 32 L49 16 M40 15 L49 16 L44 23"
        fill="none"
        stroke="#4ade80"
        strokeWidth="5.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const STAGES = [
  { n: 1, name: "Ingest", text: "Load the legacy engine and 20k+ real transactions; triage every messy row." },
  { n: 2, name: "Extract", text: "The LLM proposes a strict-JSON rule spec — schema-validated, retried, never trusted." },
  { n: 3, name: "Compile", text: "The spec becomes a pure Python function. No LLM at runtime." },
  { n: 4, name: "Prove", text: "Replay every record: legacy vs extracted vs the official statutory rule." },
  { n: 5, name: "Edit", text: "Change the rule in one plain-English sentence, previewed before approval." },
  { n: 6, name: "Impact", text: "The CFO number: exact £ effect on real historical data." },
  { n: 7, name: "Change & Verify", text: "Unified diff on a guarded copy, proven by tests generated from the data." },
];

const PRINCIPLES = [
  {
    title: "The LLM proposes. Python disposes.",
    text: "Extraction and code-gen are the only model calls. Every verdict — fidelity, drift, impact, green tests — comes from deterministic replay over real records.",
  },
  {
    title: "An approval gate at every step.",
    text: "Nothing runs, and nothing is written, without an explicit Approve. Writes are code-restricted to a sandbox directory; the original file is hash-verified untouched, live.",
  },
  {
    title: "Numbers computed, never asserted.",
    text: "Every headline figure is recomputed from the dataset in front of you. If the extraction misses an edge case, it's flagged on screen — surfacing uncertainty is the feature.",
  },
];

const DEMO_STATS = [
  ["100.00%", "extraction fidelity", "21,990 of 21,990 real transactions reproduced"],
  ["£35.2M", "legacy drift caught", "the code disagreed with the law on 17,659 records"],
  ["£23.7M", "impact of one sentence", "“raise the nil-rate threshold to £300,000”"],
  ["71", "tests generated & green", "golden cases derived from the historical data"],
];

export default function Landing({ onLaunch }) {
  return (
    <div className="min-h-screen overflow-y-auto">
      <div className="mx-auto max-w-6xl px-8">
        {/* nav */}
        <nav className="flex items-center justify-between py-6">
          <div className="flex items-center gap-3">
            <Mark />
            <span className="text-lg font-bold tracking-tight text-white">
              Rule<span className="text-sky-400">Lift</span>
            </span>
          </div>
          <button
            onClick={onLaunch}
            className="rounded-lg bg-sky-500/10 px-4 py-2 text-sm font-semibold text-sky-300 ring-1 ring-sky-500/40 hover:bg-sky-500/20"
          >
            Launch the demo
          </button>
        </nav>

        {/* hero */}
        <header className="py-16 text-center">
          <div className="text-xs font-bold uppercase tracking-widest text-sky-400">
            Extract · Prove · Change — with a human gate at every step
          </div>
          <h1 className="mx-auto mt-4 max-w-3xl text-5xl font-extrabold tracking-tight text-white">
            Your business rules are buried in code nobody dares touch.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-400">
            RuleLift digs the rule out of a legacy engine, <span className="text-slate-200">proves</span> it
            understood the system by replaying thousands of real transactions, and turns a plain-English
            change into a reviewed, test-backed diff — while the original code stays untouched.
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            <button
              onClick={onLaunch}
              className="rounded-xl bg-emerald-500 px-6 py-3 text-base font-bold text-emerald-950 shadow-lg shadow-emerald-500/20 hover:bg-emerald-400"
            >
              Launch the demo →
            </button>
            <a
              href="#how-it-works"
              className="rounded-xl border border-slate-700 px-6 py-3 text-base font-semibold text-slate-300 hover:bg-slate-800/60"
            >
              How it works
            </a>
          </div>
          <div className="mt-4 text-xs text-slate-500">
            Runs locally · works offline in mock mode · demo rule: UK Stamp Duty Land Tax
          </div>
        </header>

        {/* demo stats */}
        <section className="grid gap-4 md:grid-cols-4">
          {DEMO_STATS.map(([big, label, sub]) => (
            <div key={label} className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 text-center">
              <div className="text-3xl font-extrabold tracking-tight text-white">{big}</div>
              <div className="mt-1 text-sm font-semibold text-sky-300">{label}</div>
              <div className="mt-2 text-xs leading-relaxed text-slate-500">{sub}</div>
            </div>
          ))}
        </section>
        <div className="mt-3 text-center text-xs text-slate-600">
          Figures from the bundled demo run over real HM Land Registry price data — recomputed live every time.
        </div>

        {/* principles */}
        <section className="mt-20 grid gap-4 md:grid-cols-3">
          {PRINCIPLES.map((p) => (
            <div key={p.title} className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
              <div className="text-base font-bold text-white">{p.title}</div>
              <p className="mt-3 text-sm leading-relaxed text-slate-400">{p.text}</p>
            </div>
          ))}
        </section>

        {/* how it works */}
        <section id="how-it-works" className="mt-20 pb-4">
          <div className="text-center">
            <div className="text-xs font-bold uppercase tracking-widest text-slate-500">The pipeline</div>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-white">
              Seven stages. You approve every one.
            </h2>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-sky-900/60 bg-slate-900/40 p-6">
              <div className="text-xs font-bold uppercase tracking-widest text-sky-400">
                Read-only analysis
              </div>
              <div className="mt-4 space-y-4">
                {STAGES.slice(0, 4).map((s) => (
                  <StageRow key={s.n} {...s} accent="text-sky-300" />
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-amber-900/60 bg-slate-900/40 p-6">
              <div className="text-xs font-bold uppercase tracking-widest text-amber-400">
                Gated write phase
              </div>
              <div className="mt-4 space-y-4">
                {STAGES.slice(4).map((s) => (
                  <StageRow key={s.n} {...s} accent="text-amber-300" />
                ))}
              </div>
              <div className="mt-5 rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-xs text-slate-500">
                Writes are confined to a sandboxed working copy by a code-level guard. The original
                legacy file is SHA-256 verified untouched, on screen, at all times.
              </div>
            </div>
          </div>
        </section>

        {/* closing CTA */}
        <section className="my-20 rounded-2xl border border-slate-800 bg-gradient-to-b from-slate-900/70 to-slate-950 p-12 text-center">
          <h2 className="text-2xl font-bold tracking-tight text-white">
            Weeks of consultant archaeology. Minutes of proven change.
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-slate-400">
            Watch it read an undocumented tax engine, catch a £35M discrepancy against the statute
            book, and ship a green-tested fix — without ever acting on its own.
          </p>
          <button
            onClick={onLaunch}
            className="mt-8 rounded-xl bg-emerald-500 px-8 py-3 text-base font-bold text-emerald-950 shadow-lg shadow-emerald-500/20 hover:bg-emerald-400"
          >
            Launch the demo →
          </button>
        </section>

        <footer className="border-t border-slate-900 py-8 text-center text-xs text-slate-600">
          RuleLift · legacy business-rule extraction, proof &amp; safe change · FastAPI + React ·
          demo substrate: UK SDLT residential rates
        </footer>
      </div>
    </div>
  );
}

function StageRow({ n, name, text, accent }) {
  return (
    <div className="flex gap-4">
      <div className={`mono mt-0.5 text-sm font-bold ${accent}`}>{n}</div>
      <div>
        <div className="text-sm font-semibold text-white">{name}</div>
        <div className="mt-0.5 text-xs leading-relaxed text-slate-500">{text}</div>
      </div>
    </div>
  );
}
