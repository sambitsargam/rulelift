import React, { useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { gbp, num, pct, api } from "../api.js";
import {
  Card, Headline, BandsTable, CodeBlock, DiffView, RecordTable, ErrorNote,
} from "./ui.jsx";

/* ------------------------------------------------ Stage 1: Ingest */
export function Stage1({ stage }) {
  const r = stage.result;
  if (!r)
    return (
      <Intro
        title="Load the black box and the evidence"
        lines={[
          "Reads the legacy engine (read-only) and reports what's in it.",
          "Loads the historical transaction dataset and triages every row — bad rows are classified and excluded, never silently dropped and never fatal.",
        ]}
      />
    );
  const q = r.quality;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <Card title="Legacy code">
          <Headline value={num(r.code.line_count)} label="lines, no documentation" sub={`${r.code.function_count} functions · docstrings: ${r.code.has_docstrings ? "some" : "none"}`} />
          <div className="mono mt-3 text-xs text-slate-500">{r.code.functions.join(" · ")}</div>
        </Card>
        <Card title="Dataset">
          <Headline value={num(q.total_rows)} label="historical transactions" sub={`source: ${r.dataset_source.source === "cached" ? "cached download" : r.dataset_source.source}`} tone="accent" />
        </Card>
        <Card title="Usable for replay" tone="good">
          <Headline value={num(q.valid_rows)} label="valid records" tone="good" sub={`${num(q.excluded_rows)} excluded — see triage`} />
        </Card>
      </div>
      <Card title="Data-quality triage" subtitle="every excluded row has a reason; nothing crashes on junk">
        <div className="grid grid-cols-2 gap-4">
          <table className="text-sm">
            <tbody>
              {Object.entries(q.quality_counts).map(([category, count]) => (
                <tr key={category} className="border-b border-slate-800/60">
                  <td className="py-1.5 pr-6 text-slate-400">{category.replaceAll("_", " ")}</td>
                  <td className="py-1.5 text-right font-semibold tabular-nums">{num(count)}</td>
                  <td className="py-1.5 pl-4 text-xs text-slate-500">{q.excluded_reasons[category] || "included in replay"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div>
            {Object.entries(q.excluded_examples || {}).length > 0 && (
              <>
                <div className="mb-1 text-xs uppercase tracking-wider text-slate-500">Examples of excluded rows</div>
                {Object.entries(q.excluded_examples).map(([category, rows]) => (
                  <div key={category} className="mono text-xs text-slate-500">
                    {category}: {rows.map((x) => `${x.transaction_id}="${x.raw_price}"`).join(", ")}
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}

/* ------------------------------------------------ Stage 2: Extract */
export function Stage2({ stage }) {
  const r = stage.result;
  const [showRaw, setShowRaw] = useState(false);
  if (!r)
    return (
      <Intro
        title="Ask the model what the code does"
        lines={[
          "The legacy source goes to the LLM, which must return a strict-JSON rule spec: bands, conditions, plain-English summary, and honest assumptions.",
          "The reply is validated against a schema; invalid JSON is retried (max 3) with the exact errors fed back. The model proposes — it never judges.",
        ]}
      />
    );
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Card title="The legacy code (what a human sees)">
          <CodeBlock maxH="max-h-[30rem]">{r.legacy_source}</CodeBlock>
        </Card>
        <div className="space-y-4">
          <Card title="Extracted rule — plain English" tone="good">
            <p className="text-sm leading-relaxed text-slate-200">{r.spec.summary}</p>
          </Card>
          <Card title="Extracted bands">
            <BandsTable bands={r.spec.bands} />
          </Card>
          <Card title="Conditions & assumptions" subtitle="uncertainty is surfaced, not hidden">
            <ul className="list-disc space-y-1 pl-5 text-xs text-slate-400">
              {[...r.spec.conditions, ...r.spec.assumptions].map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
      <div className="flex items-center gap-4 text-xs text-slate-500">
        <span>
          extraction mode: <b className="text-slate-300">{r.mode}</b>
          {r.used_cache && " (cached spec — set OPENAI_API_KEY for live extraction)"}
        </span>
        <span>attempts: {r.attempts.map((a) => a.outcome).join(" → ")}</span>
        <button className="text-sky-400 hover:underline" onClick={() => setShowRaw(!showRaw)}>
          {showRaw ? "hide" : "show"} raw JSON spec
        </button>
      </div>
      {showRaw && <CodeBlock>{JSON.stringify(r.spec, null, 2)}</CodeBlock>}
    </div>
  );
}

/* ------------------------------------------------ Stage 3: Compile */
export function Stage3({ stage }) {
  const r = stage.result;
  if (!r)
    return (
      <Intro
        title="Freeze the spec into executable code"
        lines={[
          "The JSON spec is compiled — deterministically, by plain Python — into apply_extracted(price). No LLM at runtime, ever.",
          "From here on, the extracted rule is just a function that can be replayed millions of times.",
        ]}
      />
    );
  return (
    <Card title="Compiled: apply_extracted(price)" tone="good" subtitle={r.engine}>
      <table className="text-sm tabular-nums">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wider text-slate-500">
            <th className="py-2 pr-8">Probe price</th>
            <th className="py-2">Computed tax</th>
          </tr>
        </thead>
        <tbody>
          {r.probe_values.map((probe) => (
            <tr key={probe.price} className="border-t border-slate-800/60">
              <td className="py-1.5 pr-8">{gbp(probe.price)}</td>
              <td className="py-1.5 font-semibold text-emerald-400">{gbp(probe.tax)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

/* ------------------------------------------------ Stage 4: PROVE (hero) */
export function Stage4({ stage }) {
  const r = stage.result;
  const [tab, setTab] = useState("drift");
  if (!r)
    return (
      <Intro
        title="The proof — replay everything, three ways"
        lines={[
          "Every valid record is run through (a) the actual legacy code, (b) the extracted rule, and (c) the official statutory rates.",
          "(a) vs (b) proves the extraction understood the system. (a) vs (c) reveals where the legacy system has drifted from the law.",
          "Pure deterministic replay — the model has no say in these numbers.",
        ]}
      />
    );
  const fid = r.fidelity;
  const drift = r.drift;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Card tone="good">
          <Headline
            value={pct(fid.rate)}
            tone="good"
            label={`reproduced ${num(fid.matches)} of ${num(r.total_records)} real transactions`}
            sub={fid.mismatches === 0 ? "the extracted rule is behaviourally identical to the legacy code" : `${num(fid.mismatches)} mismatches — flagged below, not hidden`}
          />
        </Card>
        <Card tone="bad">
          <Headline
            value={gbp(Math.abs(drift.total_delta_gbp))}
            tone="bad"
            label={`legacy drift: wrong on ${num(drift.records_affected)} transactions`}
            sub={drift.direction}
          />
        </Card>
      </div>

      {drift.records_affected > 0 && (
        <div className="rounded-xl border border-rose-700/60 bg-rose-950/30 p-4 text-sm text-rose-200">
          <b>⚠ The legacy system disagrees with the official statutory rule.</b>{" "}
          Replay against the hard-coded official rates shows the legacy engine {drift.direction.replace("legacy ", "")} on{" "}
          {num(drift.records_affected)} of {num(r.total_records)} records — {gbp(Math.abs(drift.total_delta_gbp))} in total.
          The nil-rate threshold in the code was never updated after the rates changed.
        </div>
      )}

      <Card>
        <div className="mb-3 flex gap-2 text-xs">
          <TabButton active={tab === "drift"} onClick={() => setTab("drift")}>
            Drift records (legacy vs official)
          </TabButton>
          <TabButton active={tab === "fidelity"} onClick={() => setTab("fidelity")}>
            Extraction mismatches ({num(fid.mismatches)})
          </TabButton>
        </div>
        {tab === "drift" ? (
          <RecordTable
            rows={drift.samples}
            columns={[
              { key: "transaction_id", label: "Record", className: "mono text-slate-500" },
              { key: "price", label: "Price", render: (x) => gbp(x.price) },
              { key: "legacy_tax", label: "Legacy charged", render: (x) => gbp(x.legacy_tax) },
              { key: "official_tax", label: "Law requires", render: (x) => gbp(x.official_tax) },
              { key: "delta", label: "Δ", className: "text-rose-400 font-semibold", render: (x) => gbp(x.delta) },
            ]}
          />
        ) : fid.mismatch_samples.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">
            No mismatches — the extracted spec reproduces the legacy behaviour on every record.
          </p>
        ) : (
          <RecordTable
            rows={fid.mismatch_samples}
            columns={[
              { key: "transaction_id", label: "Record", className: "mono text-slate-500" },
              { key: "price", label: "Price", render: (x) => gbp(x.price) },
              { key: "legacy_tax", label: "Legacy", render: (x) => gbp(x.legacy_tax) },
              { key: "extracted_tax", label: "Extracted", render: (x) => gbp(x.extracted_tax) },
              { key: "delta", label: "Δ", className: "text-amber-400", render: (x) => gbp(x.delta) },
            ]}
          />
        )}
        <p className="mt-2 text-[11px] text-slate-600">showing first {Math.min(50, tab === "drift" ? drift.samples.length : fid.mismatch_samples.length)} — counts above cover all records</p>
      </Card>
    </div>
  );
}

/* ------------------------------------------------ Stage 5: Edit */
export function Stage5({ stage, onApproveWithPayload, busy }) {
  const [instruction, setInstruction] = useState("raise the nil-rate threshold to £300,000");
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState(null);

  const doPreview = async () => {
    setError(null);
    try {
      setPreview(await api.previewEdit({ instruction }));
    } catch (e) {
      setPreview(null);
      setError(e.message);
    }
  };

  const r = stage.result;
  return (
    <div className="space-y-4">
      {!r && (
        <Intro
          title="Change the rule in plain English"
          lines={[
            "Type the change the way you'd say it in a meeting. A deterministic parser (not the LLM) turns it into a new band table.",
            "Preview shows exactly what will change before you approve anything.",
          ]}
        />
      )}
      {["ready", "error", "rejected"].includes(stage.status) && (
        <Card title="Your instruction">
          <div className="flex gap-2">
            <input
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && doPreview()}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-slate-100 outline-none focus:border-sky-500"
              placeholder='e.g. "raise the nil-rate threshold to £300,000" or "change the 5% rate to 6%"'
            />
            <button
              onClick={doPreview}
              className="shrink-0 rounded-lg border border-sky-700 px-4 py-2 text-sm font-medium text-sky-300 hover:bg-sky-950/40"
            >
              Preview
            </button>
          </div>
          <ErrorNote error={error} />
          {preview && (
            <div className="mt-4">
              <div className="mb-2 rounded-lg border border-sky-800/60 bg-sky-950/30 p-3 text-sm text-sky-200">
                Parsed as: <b>{preview.description}</b>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="mb-1 text-xs uppercase tracking-wider text-slate-500">Current rule</div>
                  <BandsTable bands={preview.before_bands} />
                </div>
                <div>
                  <div className="mb-1 text-xs uppercase tracking-wider text-slate-500">Proposed rule</div>
                  <BandsTable bands={preview.after_bands} compareTo={preview.before_bands} />
                </div>
              </div>
              <button
                onClick={() => onApproveWithPayload({ instruction })}
                disabled={busy}
                className="mt-4 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-40"
              >
                {busy ? "Applying…" : "Approve this change"}
              </button>
            </div>
          )}
        </Card>
      )}
      {r && (
        <Card title="Approved change" tone="good">
          <p className="mb-3 text-sm text-slate-200">
            {r.description}
            {r.instruction && <span className="text-slate-500"> — from “{r.instruction}”</span>}
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="mb-1 text-xs uppercase tracking-wider text-slate-500">Before</div>
              <BandsTable bands={r.before_bands} />
            </div>
            <div>
              <div className="mb-1 text-xs uppercase tracking-wider text-slate-500">After</div>
              <BandsTable bands={r.after_bands} compareTo={r.before_bands} />
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

/* ------------------------------------------------ Stage 6: Impact (hero) */
export function Stage6({ stage }) {
  const r = stage.result;
  if (!r)
    return (
      <Intro
        title="What does the change actually do?"
        lines={[
          "The current rule and the proposed rule are both replayed over every valid historical record.",
          "Affected records, total £ delta, winners vs losers — computed from the data, never asserted.",
        ]}
      />
    );
  const saving = r.total_delta_gbp < 0;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <Card tone={saving ? "good" : "warn"}>
          <Headline
            value={gbp(Math.abs(r.total_delta_gbp))}
            tone={saving ? "good" : "bad"}
            label={saving ? "less tax collected in total" : "more tax collected in total"}
            sub={`vs ${gbp(r.current_total_tax_gbp)} under the current rule`}
          />
        </Card>
        <Card>
          <Headline
            value={num(r.records_affected)}
            tone="accent"
            label="real transactions affected"
            sub={`${num(r.records_unchanged)} unchanged · avg ${gbp(Math.abs(r.avg_delta_per_affected_gbp))} per affected record`}
          />
        </Card>
        <Card>
          <Headline
            value={`${num(r.winners_pay_less)} / ${num(r.losers_pay_more)}`}
            label="pay less / pay more"
            sub="winners vs losers under the proposed rule"
          />
        </Card>
      </div>
      <Card title="Distribution of per-record change" subtitle="tax delta per affected transaction (proposed − current)">
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={r.histogram} margin={{ top: 10, right: 10, bottom: 5, left: 10 }}>
              <XAxis dataKey="bucket" tick={{ fill: "#94a3b8", fontSize: 11 }} interval={0} angle={-14} textAnchor="end" height={50} />
              <YAxis tick={{ fill: "#64748b", fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: "#e2e8f0" }}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {r.histogram.map((bucket, i) => (
                  <Cell key={i} fill={bucket.bucket.startsWith("saves") ? "#34d399" : "#fb7185"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <Card title="Sample affected records">
        <RecordTable
          rows={r.samples}
          columns={[
            { key: "transaction_id", label: "Record", className: "mono text-slate-500" },
            { key: "price", label: "Price", render: (x) => gbp(x.price) },
            { key: "current_tax", label: "Current tax", render: (x) => gbp(x.current_tax) },
            { key: "proposed_tax", label: "Proposed tax", render: (x) => gbp(x.proposed_tax) },
            {
              key: "delta", label: "Δ",
              render: (x) => <span className={x.delta < 0 ? "text-emerald-400" : "text-rose-400"}>{gbp(x.delta)}</span>,
            },
          ]}
        />
      </Card>
    </div>
  );
}

/* ------------------------------------------------ Stage 7: Change & verify */
export function Stage7({ stage }) {
  const r = stage.result;
  if (!r)
    return (
      <Intro
        title="Generate the change — and prove it"
        lines={[
          "Produces a unified diff against the legacy engine, applies it to a copy inside the write-guarded workdir (the original is never touched), and generates a pytest suite of golden cases straight from the historical data.",
          "Green/red comes from pytest's exit code. If tests fail, the failures are fed back for one automated retry, then control returns to you.",
        ]}
      />
    );
  const passed = r.final.tests.passed;
  return (
    <div className="space-y-4">
      <div className={`flex items-center gap-4 rounded-xl border p-4 ${passed ? "border-emerald-700/60 bg-emerald-950/30" : "border-rose-700/60 bg-rose-950/40"}`}>
        <div className={`text-3xl font-bold ${passed ? "text-emerald-400" : "text-rose-400"}`}>
          {passed ? "✓ TESTS GREEN" : "✕ TESTS RED"}
        </div>
        <div className="text-sm text-slate-300">
          {r.final.golden_case_count} golden cases generated from historical data · generator: {r.final.generator}
          {r.integrity_after.untouched && (
            <span className="ml-2 text-emerald-500">· original legacy file untouched ✓</span>
          )}
        </div>
      </div>
      <Card title="Requirement this change satisfies">
        <p className="text-sm text-slate-200">{r.requirement}</p>
        <p className="mt-2 text-xs text-slate-500">{r.final.rationale}</p>
      </Card>
      <div className="grid grid-cols-2 gap-4">
        <Card title="Unified diff" subtitle="original → write-guarded working copy">
          <DiffView diff={r.final.diff} />
        </Card>
        <Card title="pytest output" subtitle="run in a subprocess against the working copy">
          <CodeBlock maxH="max-h-[28rem]" className={passed ? "" : "border border-rose-800"}>{r.final.tests.output}</CodeBlock>
        </Card>
      </div>
      {r.attempts.length > 1 && (
        <Card title="Attempt history">
          <ul className="space-y-1 text-xs text-slate-400">
            {r.attempts.map((attempt, i) => (
              <li key={i}>
                {i + 1}. {attempt.generator} — {attempt.skipped ? attempt.rationale : attempt.passed ? "passed" : "failed"}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

/* ------------------------------------------------ shared bits */
function Intro({ title, lines }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6">
      <h2 className="text-lg font-semibold text-slate-100">{title}</h2>
      <ul className="mt-3 space-y-2 text-sm leading-relaxed text-slate-400">
        {lines.map((line, i) => (
          <li key={i}>{line}</li>
        ))}
      </ul>
    </div>
  );
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md px-3 py-1.5 font-medium ${
        active ? "bg-slate-700 text-white" : "text-slate-400 hover:bg-slate-800"
      }`}
    >
      {children}
    </button>
  );
}
