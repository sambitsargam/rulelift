import React from "react";
import { gbp, pct } from "../api.js";

export function Card({ title, subtitle, children, tone = "default", className = "" }) {
  const tones = {
    default: "border-slate-800 bg-slate-900/60",
    good: "border-emerald-700/60 bg-emerald-950/30",
    bad: "border-rose-700/60 bg-rose-950/30",
    warn: "border-amber-700/60 bg-amber-950/20",
  };
  return (
    <div className={`rounded-xl border p-5 ${tones[tone]} ${className}`}>
      {title && (
        <div className="mb-3">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
        </div>
      )}
      {children}
    </div>
  );
}

export function Headline({ value, label, tone = "default", sub }) {
  const tones = {
    default: "text-slate-100",
    good: "text-emerald-400",
    bad: "text-rose-400",
    accent: "text-sky-400",
  };
  return (
    <div>
      <div className={`text-5xl font-bold tabular-nums tracking-tight ${tones[tone]}`}>{value}</div>
      <div className="mt-1 text-sm font-medium text-slate-400">{label}</div>
      {sub && <div className="mt-0.5 text-xs text-slate-500">{sub}</div>}
    </div>
  );
}

export function BandsTable({ bands, compareTo }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-slate-800 text-left text-xs uppercase tracking-wider text-slate-500">
          <th className="py-2 pr-3">Band</th>
          <th className="py-2 pr-3">From</th>
          <th className="py-2 pr-3">To</th>
          <th className="py-2">Rate</th>
        </tr>
      </thead>
      <tbody>
        {bands.map((band, i) => {
          const other = compareTo?.[i];
          const changed =
            other &&
            (other.lower !== band.lower || other.upper !== band.upper || other.rate !== band.rate);
          return (
            <tr
              key={i}
              className={`border-b border-slate-800/60 tabular-nums ${changed ? "bg-sky-950/40 text-sky-300" : ""}`}
            >
              <td className="py-2 pr-3 text-slate-500">{i + 1}</td>
              <td className="py-2 pr-3">{gbp(band.lower)}</td>
              <td className="py-2 pr-3">{band.upper === null ? "no limit" : gbp(band.upper)}</td>
              <td className="py-2 font-semibold">{pct(band.rate, band.rate * 100 % 1 ? 1 : 0)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export function ApproveBar({ stage, busy, onApprove, onSkip, onReject, approveLabel = "Approve & run" }) {
  const actionable = ["ready", "error", "rejected"].includes(stage.status);
  if (!actionable && stage.status !== "done") return null;
  return (
    <div className="mt-5 flex items-center gap-3 border-t border-slate-800 pt-4">
      {actionable ? (
        <>
          <button
            onClick={onApprove}
            disabled={busy}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-40"
          >
            {busy ? "Running…" : approveLabel}
          </button>
          {stage.id === 2 && (
            <button
              onClick={onSkip}
              disabled={busy}
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-40"
            >
              Skip (use cached spec)
            </button>
          )}
          <button
            onClick={onReject}
            disabled={busy}
            className="rounded-lg border border-rose-800 px-4 py-2 text-sm text-rose-400 hover:bg-rose-950/40 disabled:opacity-40"
          >
            Reject
          </button>
          <span className="text-xs text-slate-500">
            Nothing runs or is written without your explicit approval.
          </span>
        </>
      ) : (
        <span className="text-xs font-medium text-emerald-500">✓ Approved & completed</span>
      )}
    </div>
  );
}

export function ErrorNote({ error }) {
  if (!error) return null;
  return (
    <div className="mt-4 rounded-lg border border-rose-800 bg-rose-950/40 p-3 text-sm text-rose-300">
      <span className="font-semibold">Error: </span>
      <span className="mono whitespace-pre-wrap text-xs">{String(error)}</span>
    </div>
  );
}

export function CodeBlock({ children, className = "", maxH = "max-h-96" }) {
  return (
    <pre className={`mono ${maxH} overflow-auto rounded-lg bg-slate-950 p-4 text-xs leading-relaxed text-slate-300 ${className}`}>
      {children}
    </pre>
  );
}

export function DiffView({ diff }) {
  return (
    <pre className="mono max-h-[28rem] overflow-auto rounded-lg bg-slate-950 p-4 text-xs leading-relaxed">
      {diff.split("\n").map((line, i) => {
        let cls = "text-slate-400";
        if (line.startsWith("+") && !line.startsWith("+++")) cls = "text-emerald-400 bg-emerald-950/40";
        else if (line.startsWith("-") && !line.startsWith("---")) cls = "text-rose-400 bg-rose-950/40";
        else if (line.startsWith("@@")) cls = "text-sky-400";
        else if (line.startsWith("+++") || line.startsWith("---")) cls = "text-slate-200 font-semibold";
        return (
          <div key={i} className={cls}>
            {line || " "}
          </div>
        );
      })}
    </pre>
  );
}

export function RecordTable({ rows, columns }) {
  return (
    <div className="max-h-72 overflow-auto rounded-lg border border-slate-800">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-slate-900">
          <tr className="text-left uppercase tracking-wider text-slate-500">
            {columns.map((c) => (
              <th key={c.key} className="px-3 py-2">{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {rows.map((row, i) => (
            <tr key={i} className="border-t border-slate-800/60">
              {columns.map((c) => (
                <td key={c.key} className={`px-3 py-1.5 ${c.className || ""}`}>
                  {c.render ? c.render(row) : row[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
