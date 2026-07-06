import React from "react";
import { gbp, pct } from "../api.js";

export function Card({ title, subtitle, children, tone = "default", className = "" }) {
  const tones = {
    default: "",
    good: "border-l-2 border-l-moss",
    bad: "border-l-2 border-l-blood",
    warn: "border-l-2 border-l-brass",
  };
  return (
    <div className={`panel ${tones[tone]} ${className}`}>
      {title && (
        <div className="border-b border-rule px-5 py-3">
          <h3 className="kicker text-ink">{title}</h3>
          {subtitle && <p className="mt-0.5 text-[11.5px] text-faint">{subtitle}</p>}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
}

export function Headline({ value, label, tone = "default", sub }) {
  const tones = {
    default: "text-ink",
    good: "text-moss",
    bad: "text-blood",
    accent: "text-ink",
  };
  return (
    <div>
      <div className={`serif tnum text-[44px] font-semibold leading-none tracking-tight ${tones[tone]}`}>
        {value}
      </div>
      <div className="mt-2.5 text-[13.5px] font-medium text-ink">{label}</div>
      {sub && <div className="mt-1 text-[12px] leading-relaxed text-faint">{sub}</div>}
    </div>
  );
}

export function BandsTable({ bands, compareTo }) {
  return (
    <table className="w-full text-[13px]">
      <thead>
        <tr className="kicker border-b border-ruledark text-left text-faint">
          <th className="py-2 pr-3 font-medium">Band</th>
          <th className="py-2 pr-3 font-medium">From</th>
          <th className="py-2 pr-3 font-medium">To</th>
          <th className="py-2 font-medium">Rate</th>
        </tr>
      </thead>
      <tbody className="tnum">
        {bands.map((band, i) => {
          const other = compareTo?.[i];
          const changed =
            other &&
            (other.lower !== band.lower || other.upper !== band.upper || other.rate !== band.rate);
          return (
            <tr
              key={i}
              className={`border-b border-rule ${changed ? "bg-brasssoft font-medium" : ""}`}
            >
              <td className="mono py-2 pr-3 text-[11px] text-faint">{String(i + 1).padStart(2, "0")}</td>
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

export function Button({ children, onClick, disabled, variant = "primary", className = "" }) {
  const variants = {
    primary: "bg-ink text-paper hover:bg-black",
    approve: "bg-moss text-paper hover:bg-[#174a2e]",
    outline: "border border-ruledark text-ink hover:bg-sheet",
    danger: "border border-blood/50 text-blood hover:bg-bloodsoft",
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-4 py-2 text-[13px] font-semibold tracking-wide transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${variants[variant]} ${className}`}
      style={{ borderRadius: 3 }}
    >
      {children}
    </button>
  );
}

export function ApproveBar({ stage, busy, onApprove, onSkip, onReject, approveLabel = "Approve & run" }) {
  const actionable = ["ready", "error", "rejected"].includes(stage.status);
  if (!actionable && stage.status !== "done") return null;
  return (
    <div className="mt-6 flex items-center gap-3 border-t border-ruledark pt-5">
      {actionable ? (
        <>
          <Button variant="approve" onClick={onApprove} disabled={busy}>
            {busy ? "Running…" : approveLabel}
          </Button>
          {stage.id === 2 && (
            <Button variant="outline" onClick={onSkip} disabled={busy}>
              Skip (use cached spec)
            </Button>
          )}
          <Button variant="danger" onClick={onReject} disabled={busy}>
            Reject
          </Button>
          <span className="mono text-[11px] text-faint">
            Nothing runs or is written without your explicit approval.
          </span>
        </>
      ) : (
        <span className="mono text-[11.5px] font-medium text-moss">✓ approved &amp; completed</span>
      )}
    </div>
  );
}

export function ErrorNote({ error }) {
  if (!error) return null;
  return (
    <div className="mt-4 border-l-2 border-blood bg-bloodsoft px-4 py-3 text-[13px] text-ink">
      <span className="font-semibold text-blood">Error — </span>
      <span className="mono whitespace-pre-wrap text-[11.5px]">{String(error)}</span>
    </div>
  );
}

export function CodeBlock({ children, className = "", maxH = "max-h-96" }) {
  return (
    <pre
      className={`mono ${maxH} overflow-auto border border-rule bg-well p-4 text-[11.5px] leading-relaxed text-ink/85 ${className}`}
      style={{ borderRadius: 3 }}
    >
      {children}
    </pre>
  );
}

export function DiffView({ diff }) {
  return (
    <pre
      className="mono max-h-[28rem] overflow-auto border border-rule bg-sheet p-4 text-[11.5px] leading-relaxed"
      style={{ borderRadius: 3 }}
    >
      {diff.split("\n").map((line, i) => {
        let cls = "text-faint";
        if (line.startsWith("+") && !line.startsWith("+++")) cls = "bg-mosssoft text-moss";
        else if (line.startsWith("-") && !line.startsWith("---")) cls = "bg-bloodsoft text-blood";
        else if (line.startsWith("@@")) cls = "text-brass";
        else if (line.startsWith("+++") || line.startsWith("---")) cls = "font-semibold text-ink";
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
    <div className="max-h-72 overflow-auto border border-rule" style={{ borderRadius: 3 }}>
      <table className="w-full text-[12px]">
        <thead className="sticky top-0 bg-well">
          <tr className="kicker text-left text-faint">
            {columns.map((c) => (
              <th key={c.key} className="px-3 py-2 font-medium">{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody className="tnum bg-sheet">
          {rows.map((row, i) => (
            <tr key={i} className="border-t border-rule">
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
