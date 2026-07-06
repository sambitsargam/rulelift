import React from "react";

export function Mark({ className = "h-8 w-8" }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <rect x="1" y="1" width="62" height="62" rx="6" fill="#fdfbf4" stroke="#211c12" strokeWidth="2.5" />
      <rect x="13" y="42" width="9" height="11" fill="#211c12" />
      <rect x="27" y="34" width="9" height="19" fill="#211c12" />
      <rect x="41" y="25" width="9" height="28" fill="#211c12" />
      <path d="M14 30 L46 14" stroke="#9c2f1f" strokeWidth="4.5" strokeLinecap="round" />
      <path d="M38 12 L47 13.5 L42.5 21" fill="none" stroke="#9c2f1f" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Wordmark({ className = "" }) {
  return (
    <span className={`serif text-xl font-semibold tracking-tight ${className}`}>
      RuleLift
    </span>
  );
}

const READ_STAGES = [
  { n: "01", name: "Ingest", text: "Load the legacy engine and 20,000+ real transactions; triage every messy row." },
  { n: "02", name: "Extract", text: "The model proposes a strict-JSON rule spec — schema-validated, retried, never trusted." },
  { n: "03", name: "Compile", text: "The spec becomes a pure Python function. No model at runtime." },
  { n: "04", name: "Prove", text: "Replay every record: legacy vs extracted vs the official statutory rule." },
];
const WRITE_STAGES = [
  { n: "05", name: "Edit", text: "Change the rule in one plain-English sentence, previewed before approval." },
  { n: "06", name: "Impact", text: "The CFO number: the exact £ effect on real historical data." },
  { n: "07", name: "Change & Verify", text: "Unified diff on a guarded copy, proven by tests generated from the data." },
];

const PRINCIPLES = [
  {
    n: "I",
    title: "The model proposes. Python disposes.",
    text: "Extraction and code-gen are the only model calls. Every verdict — fidelity, drift, impact, green tests — comes from deterministic replay over real records.",
  },
  {
    n: "II",
    title: "An approval gate at every step.",
    text: "Nothing runs, and nothing is written, without an explicit approve. Writes are code-restricted to a sandbox; the original file is hash-verified untouched, live on screen.",
  },
  {
    n: "III",
    title: "Numbers computed, never asserted.",
    text: "Every headline figure is recomputed from the dataset in front of you. When the extraction misses an edge case, it is flagged — surfacing uncertainty is the feature.",
  },
];

const STATS = [
  ["100.00%", "extraction fidelity", "21,990 of 21,990 real transactions reproduced"],
  ["£35.2M", "legacy drift caught", "the code disagreed with the law on 17,659 records"],
  ["£23.7M", "impact of one sentence", "“raise the nil-rate threshold to £300,000”"],
  ["71", "tests generated, green", "golden cases derived from the historical data"],
];

const LEDGER_ROWS = [
  ["TX004521", "£360,000", "5,500", "8,000", "+2,500"],
  ["TX011208", "£287,500", "1,875", "4,375", "+2,500"],
  ["TX000094", "£199,950", "0", "1,499", "+1,499"],
  ["TX017730", "£1,240,000", "65,250", "67,750", "+2,500"],
  ["TX006411", "£152,000", "0", "540", "+540"],
];

export default function Landing({ onLaunch }) {
  return (
    <div className="min-h-screen overflow-y-auto">
      {/* nav */}
      <nav className="border-b border-rule">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <Mark className="h-8 w-8" />
            <Wordmark />
          </div>
          <div className="flex items-center gap-6">
            <a href="#method" className="kicker text-faint hover:text-ink">Method</a>
            <a href="#principles" className="kicker text-faint hover:text-ink">Principles</a>
            <button
              onClick={onLaunch}
              className="bg-ink px-5 py-2.5 text-[13px] font-semibold tracking-wide text-paper hover:bg-black"
              style={{ borderRadius: 3 }}
            >
              Launch the demo
            </button>
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-6xl px-6">
        {/* hero */}
        <header className="grid gap-12 py-16 md:grid-cols-12 md:py-20">
          <div className="md:col-span-7">
            <div className="kicker text-blood">Legacy rule extraction · proof · safe change</div>
            <h1 className="serif mt-5 text-[52px] font-semibold leading-[1.04] tracking-tight">
              The rule that runs your business is buried in code{" "}
              <em className="font-medium">nobody dares touch.</em>
            </h1>
            <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-faint">
              RuleLift digs the rule out of a legacy engine, <strong className="font-semibold text-ink">proves</strong>{" "}
              it understood the system by replaying thousands of real transactions, and turns a
              plain-English change into a reviewed, test-backed diff — while the original code
              stays untouched.
            </p>
            <div className="mt-9 flex items-center gap-5">
              <button
                onClick={onLaunch}
                className="bg-ink px-7 py-3.5 text-[14px] font-semibold tracking-wide text-paper hover:bg-black"
                style={{ borderRadius: 3 }}
              >
                Launch the demo →
              </button>
              <a href="#method" className="text-[14px] font-medium text-ink underline decoration-ruledark underline-offset-4 hover:decoration-ink">
                Read the method
              </a>
            </div>
            <div className="mono mt-6 text-[11.5px] text-faint">
              Runs locally · works offline in mock mode · demo rule: UK Stamp Duty Land Tax
            </div>
          </div>

          {/* replay ledger specimen */}
          <div className="md:col-span-5">
            <div className="panel relative p-0">
              <div className="flex items-baseline justify-between border-b border-rule px-5 py-3">
                <span className="kicker text-ink">Replay ledger</span>
                <span className="mono text-[11px] text-faint">21,990 records</span>
              </div>
              <div className="px-5 py-4">
                <table className="mono w-full text-[11.5px] leading-6">
                  <thead>
                    <tr className="text-left text-[10px] uppercase tracking-[0.12em] text-faint">
                      <th className="font-medium">Record</th>
                      <th className="font-medium">Price</th>
                      <th className="text-right font-medium">Legacy</th>
                      <th className="text-right font-medium">Statute</th>
                      <th className="text-right font-medium">Δ</th>
                    </tr>
                  </thead>
                  <tbody className="tnum text-ink/80">
                    {LEDGER_ROWS.map((row) => (
                      <tr key={row[0]} className="border-t border-rule/60">
                        <td className="text-faint">{row[0]}</td>
                        <td>{row[1]}</td>
                        <td className="text-right">{row[2]}</td>
                        <td className="text-right">{row[3]}</td>
                        <td className="text-right font-medium text-blood">{row[4]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="mt-4 flex items-baseline justify-between border-t-2 border-ink pt-3">
                  <span className="kicker text-ink">Undercharged vs statute</span>
                  <span className="serif tnum text-2xl font-semibold text-blood">£35,186,823</span>
                </div>
              </div>
              <div className="absolute -right-3 -top-3 rotate-3 border-2 border-blood bg-paper px-2.5 py-1">
                <span className="kicker text-blood">Caught at stage 04</span>
              </div>
            </div>
            <p className="mono mt-3 text-[11px] leading-relaxed text-faint">
              A stale nil-rate band, live in production. Found by deterministic replay against the
              statutory oracle — not by the model's opinion.
            </p>
          </div>
        </header>

        {/* stat strip */}
        <section className="border-y border-ruledark">
          <div className="grid divide-rule md:grid-cols-4 md:divide-x">
            {STATS.map(([big, label, sub]) => (
              <div key={label} className="px-6 py-7 first:pl-0 last:pr-0">
                <div className="serif tnum text-[34px] font-semibold leading-none">{big}</div>
                <div className="kicker mt-3 text-ink">{label}</div>
                <div className="mt-1.5 text-[12.5px] leading-relaxed text-faint">{sub}</div>
              </div>
            ))}
          </div>
        </section>
        <div className="mono mt-3 text-[11px] text-faint">
          Figures from the bundled demo over real HM Land Registry price data — recomputed live on every run.
        </div>

        {/* principles */}
        <section id="principles" className="pt-20">
          <div className="kicker text-faint">Working principles</div>
          <div className="mt-6 grid gap-10 md:grid-cols-3">
            {PRINCIPLES.map((p) => (
              <div key={p.n} className="border-t-2 border-ink pt-5">
                <div className="serif text-sm italic text-faint">{p.n}.</div>
                <h3 className="serif mt-2 text-[21px] font-semibold leading-snug">{p.title}</h3>
                <p className="mt-3 text-[13.5px] leading-relaxed text-faint">{p.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* method */}
        <section id="method" className="pt-20">
          <div className="flex items-end justify-between">
            <div>
              <div className="kicker text-faint">The method</div>
              <h2 className="serif mt-2 text-[32px] font-semibold tracking-tight">
                Seven stages. You approve every one.
              </h2>
            </div>
            <div className="mono hidden text-[11px] text-faint md:block">
              stages 01–04 read-only · stages 05–07 write to a guarded copy
            </div>
          </div>

          <div className="mt-8 grid gap-x-14 gap-y-0 md:grid-cols-2">
            <div>
              <div className="kicker border-b-2 border-moss pb-2 text-moss">Read-only analysis</div>
              {READ_STAGES.map((s) => (
                <StageRow key={s.n} {...s} />
              ))}
            </div>
            <div>
              <div className="kicker border-b-2 border-brass pb-2 text-brass">Gated write phase</div>
              {WRITE_STAGES.map((s) => (
                <StageRow key={s.n} {...s} />
              ))}
              <div className="mono mt-6 border-l-2 border-ruledark pl-4 text-[11.5px] leading-relaxed text-faint">
                Writes are confined to a sandboxed working copy by a code-level guard.
                The original legacy file is SHA-256 verified untouched, on screen, at all times.
              </div>
            </div>
          </div>
        </section>

        {/* closing */}
        <section className="my-24 border-y border-ruledark py-14 text-center">
          <h2 className="serif mx-auto max-w-2xl text-[30px] font-semibold leading-snug tracking-tight">
            Weeks of consultant archaeology.
            <br />
            <em className="font-medium">Minutes of proven change.</em>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-[14px] leading-relaxed text-faint">
            Watch it read an undocumented tax engine, catch a £35M discrepancy against the statute
            book, and ship a green-tested fix — without ever acting on its own.
          </p>
          <button
            onClick={onLaunch}
            className="mt-8 bg-ink px-8 py-3.5 text-[14px] font-semibold tracking-wide text-paper hover:bg-black"
            style={{ borderRadius: 3 }}
          >
            Launch the demo →
          </button>
        </section>

        <footer className="mono flex items-center justify-between border-t border-rule py-6 text-[11px] text-faint">
          <span>RuleLift — legacy rule extraction, proof &amp; safe change</span>
          <span>FastAPI · React · demo substrate: UK SDLT residential rates</span>
        </footer>
      </div>
    </div>
  );
}

function StageRow({ n, name, text }) {
  return (
    <div className="flex gap-5 border-b border-rule py-4">
      <div className="mono pt-0.5 text-[12px] font-medium text-faint">{n}</div>
      <div>
        <div className="text-[15px] font-semibold">{name}</div>
        <div className="mt-0.5 text-[13px] leading-relaxed text-faint">{text}</div>
      </div>
    </div>
  );
}
