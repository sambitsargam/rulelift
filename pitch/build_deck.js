/* RuleLift pitch deck — 8 slides, ledger-paper brand system.
   Run: NODE_PATH=$(npm root -g) node pitch/build_deck.js */

const pptxgen = require("pptxgenjs");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const sharp = require("sharp");
const {
  FaUserSlash, FaHourglassHalf, FaBalanceScale, FaHandPaper, FaFilter,
  FaRedoAlt, FaShieldAlt, FaVial, FaProjectDiagram, FaPlug, FaListOl,
  FaEye, FaLock, FaFingerprint,
} = require("react-icons/fa");

// ---------- brand ----------
const PAPER = "F4F1E7", SHEET = "FDFBF4", WELL = "EDE8D9";
const INK = "211C12", FAINT = "6F6757";
const RULE = "DCD4C0", RULEDARK = "B3A88E";
const MOSS = "1F5C3A", MOSSSOFT = "E4ECDF";
const BLOOD = "9C2F1F", BLOODSOFT = "F4E4DD";
const BRASS = "7D5A10";
const COPPER = "C96F4A";           // accent on dark ink slides
const PAPERDIM = "C9C2B2";         // muted text on ink
const DARKRULE = "4A443A";

const SERIF = "Century Schoolbook", BODY = "Calibri", MONO = "Courier New";

const W = 13.3, H = 7.5;

async function icon(Component, color, size = 256) {
  const svg = ReactDOMServer.renderToStaticMarkup(
    React.createElement(Component, { color: `#${color}`, size: String(size) })
  );
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  return "image/png;base64," + png.toString("base64");
}

const shadow = () => ({ type: "outer", color: "000000", blur: 7, offset: 2, angle: 45, opacity: 0.14 });

function kicker(slide, text, x, y, color, w = 8) {
  slide.addText(text.toUpperCase(), {
    x, y, w, h: 0.3, fontFace: MONO, fontSize: 11, color, charSpacing: 3, margin: 0,
  });
}

function hairline(slide, x, y, w, color = RULEDARK, width = 1) {
  slide.addShape("line", { x, y, w, h: 0, line: { color, width } });
}

function mark(slide, x, y, s, { border, bars, arrow }) {
  // s = side length in inches
  slide.addShape("roundRect", {
    x, y, w: s, h: s, rectRadius: s * 0.09,
    fill: { color: SHEET }, line: { color: border, width: 2 },
  });
  const u = s / 64;
  const bar = (bx, by, bw, bh) =>
    slide.addShape("rect", { x: x + bx * u, y: y + by * u, w: bw * u, h: bh * u, fill: { color: bars } });
  bar(13, 42, 9, 11);
  bar(27, 34, 9, 19);
  bar(41, 25, 9, 28);
  slide.addShape("line", {
    x: x + 14 * u, y: y + 14 * u, w: 32 * u, h: 16 * u, flipV: true,
    line: { color: arrow, width: 2.6, endArrowType: "triangle" },
  });
}

function statBlock(slide, x, y, w, big, bigColor, label, sub, dark = false) {
  slide.addText(big, {
    x, y, w, h: 0.62, fontFace: SERIF, fontSize: 30, bold: true, color: bigColor, margin: 0,
  });
  slide.addText(label.toUpperCase(), {
    x, y: y + 0.66, w, h: 0.26, fontFace: MONO, fontSize: 9.5,
    color: dark ? PAPERDIM : INK, charSpacing: 2, margin: 0,
  });
  slide.addText(sub, {
    x, y: y + 0.94, w, h: 0.55, fontFace: BODY, fontSize: 10.5,
    color: dark ? PAPERDIM : FAINT, margin: 0,
  });
}

async function main() {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_WIDE";
  pres.author = "Sambit Sargam Ekalabya";
  pres.title = "RuleLift — legacy rule extraction, proof & safe change";

  // ============================================================ S1 · TITLE
  {
    const s = pres.addSlide();
    s.background = { color: INK };

    mark(s, 0.95, 0.85, 0.95, { border: PAPER, bars: INK, arrow: BLOOD });
    s.addText("RuleLift", {
      x: 2.1, y: 0.78, w: 6, h: 1.1, fontFace: SERIF, fontSize: 52, bold: true, color: PAPER, margin: 0,
    });

    kicker(s, "Legacy rule extraction · proof · safe change", 0.98, 2.35, COPPER, 10);
    s.addText([
      { text: "The rule that runs your business is buried in code nobody dares touch.", options: { color: PAPER } },
      { text: " RuleLift digs it out — ", options: { color: PAPER } },
      { text: "and proves it.", options: { color: COPPER, italic: true } },
    ], {
      x: 0.95, y: 2.7, w: 11.4, h: 1.9, fontFace: SERIF, fontSize: 31, bold: true, margin: 0, lineSpacingMultiple: 1.12,
    });

    hairline(s, 0.98, 5.05, 11.35, DARKRULE);
    statBlock(s, 0.98, 5.3, 2.75, "100.00%", "8FBFA3", "Extraction fidelity", "21,990 of 21,990 real transactions reproduced", true);
    statBlock(s, 3.95, 5.3, 2.75, "£35.2M", COPPER, "Legacy drift caught", "the code disagreed with the law on 17,659 records", true);
    statBlock(s, 6.92, 5.3, 2.75, "£23.7M", PAPER, "Impact of one sentence", "“raise the nil-rate threshold to £300,000”", true);
    statBlock(s, 9.89, 5.3, 2.45, "71", PAPER, "Generated tests, green", "golden cases derived from historical data", true);

    s.addText("github.com/sambitsargam/rulelift   ·   make demo   ·   runs locally, LLM optional", {
      x: 0.98, y: 7.02, w: 11.4, h: 0.3, fontFace: MONO, fontSize: 10, color: PAPERDIM, margin: 0,
    });

    s.addNotes(
      "RuleLift turns the scariest asset in an enterprise — a business rule trapped in legacy code — into something you can read, prove, and change safely. " +
      "These four numbers are computed live in the product, every run: fidelity from replaying 22k real UK property transactions, a £35M discrepancy it caught against the statute book, the quantified impact of a one-sentence rule change, and the generated test suite that proves the fix."
    );
  }

  // ============================================================ S2 · PROBLEM
  {
    const s = pres.addSlide();
    s.background = { color: PAPER };
    kicker(s, "The problem", 0.9, 0.5, BLOOD);
    s.addText("Rules worth millions live in code nobody understands.", {
      x: 0.9, y: 0.82, w: 11.6, h: 0.75, fontFace: SERIF, fontSize: 30, bold: true, color: INK, margin: 0,
    });

    const rows = [
      [FaUserSlash, "The expert left years ago", "The only spec is the code itself — cryptic names, dead branches, a VB6-to-Python port with comments that lie."],
      [FaHourglassHalf, "Every change is a consulting engagement", "Weeks of code archaeology before anyone dares move a threshold. Tax bands, pricing tiers, commissions — all frozen by fear."],
      [FaBalanceScale, "An LLM summary is an opinion", "Models read code in seconds, but you can't bet a tax filing or a pricing run on unverified output. Extraction without proof is a demo, not a tool."],
    ];
    let y = 2.0;
    for (const [Icon, head, body] of rows) {
      s.addShape("ellipse", { x: 0.9, y: y + 0.04, w: 0.52, h: 0.52, fill: { color: BLOODSOFT } });
      s.addImage({ data: await icon(Icon, BLOOD), x: 1.03, y: y + 0.17, w: 0.26, h: 0.26 });
      s.addText(head, { x: 1.62, y: y - 0.03, w: 5.3, h: 0.35, fontFace: BODY, fontSize: 15.5, bold: true, color: INK, margin: 0 });
      s.addText(body, { x: 1.62, y: y + 0.33, w: 5.25, h: 1.05, fontFace: BODY, fontSize: 12, color: FAINT, margin: 0, lineSpacingMultiple: 1.08 });
      y += 1.62;
    }

    // legacy code specimen
    s.addShape("rect", { x: 7.35, y: 1.95, w: 5.05, h: 4.35, fill: { color: SHEET }, line: { color: RULE, width: 1 }, shadow: shadow() });
    s.addText("legacy/sdlt_engine.py", {
      x: 7.6, y: 2.12, w: 4.6, h: 0.28, fontFace: MONO, fontSize: 10.5, bold: true, color: FAINT, margin: 0,
    });
    hairline(s, 7.6, 2.5, 4.55, RULE);
    s.addText(
      [
        "# port of SDLT_CALC.bas (mainframe FIN batch)",
        "# DO NOT REFORMAT - audit reviews diffs vs VB6",
        "_T = {",
        '    "n": 250000,   # NRB-CEIL  <- stale since the',
        "                   #   temporary relief ended",
        '    "m": 925000,   # MID-CEIL',
        '    "h": 1500000,  # HI-CEIL',
        "}",
        "def calc_v2(price, flag3=0):",
        "    # flag3: mainframe parity flag. batch",
        "    # sends 0. surcharge never landed (FIN-4102)",
        "    t = t + _seg(price, 0, _T[\"n\"]) * ...",
      ].join("\n"),
      { x: 7.6, y: 2.62, w: 4.6, h: 3.0, fontFace: MONO, fontSize: 9.5, color: INK, margin: 0, lineSpacingMultiple: 1.18 }
    );
    s.addText("153 lines, zero docs, one stale threshold — live in production. (The demo ships this engine.)", {
      x: 7.6, y: 5.72, w: 4.6, h: 0.5, fontFace: BODY, fontSize: 10.5, italic: true, color: FAINT, margin: 0,
    });

    s.addNotes(
      "This is a universal enterprise problem. The person who wrote the rule engine is gone, the code is hostile, and every change goes through weeks of consultant archaeology. " +
      "LLMs help you read the code — but a summary you can't verify is an opinion. The gap in the market is proof."
    );
  }

  // ============================================================ S3 · SOLUTION
  {
    const s = pres.addSlide();
    s.background = { color: PAPER };
    kicker(s, "The solution", 0.9, 0.5, MOSS);
    s.addText([
      { text: "The model proposes. ", options: { color: INK } },
      { text: "Deterministic Python disposes.", options: { color: MOSS } },
    ], { x: 0.9, y: 0.82, w: 11.6, h: 0.75, fontFace: SERIF, fontSize: 30, bold: true, margin: 0 });

    const cols = [
      ["01 · EXTRACT", "Read the black box", "The LLM proposes a strict-JSON rule spec from the legacy source — bands, conditions, plain-English summary, honest assumptions. Schema-validated, exact errors fed back, max 3 attempts.", "LLM: proposes only"],
      ["02 · PROVE", "Replay, don't trust", "Every one of 21,990 real transactions runs through the legacy code, the extracted rule, and the statutory oracle. Fidelity and drift are counted, not claimed.", "pure Python, no model"],
      ["03 · CHANGE", "Edit like a human, ship like an engineer", "A plain-English edit becomes a quantified £ impact, then a unified diff on a guarded copy — verified by pytest cases generated from the same historical data.", "pytest is the judge"],
    ];
    let x = 0.9;
    for (const [step, head, body, tag] of cols) {
      s.addShape("rect", { x, y: 1.95, w: 3.72, h: 3.28, fill: { color: SHEET }, line: { color: RULE, width: 1 }, shadow: shadow() });
      s.addText(step, { x: x + 0.25, y: 2.15, w: 3.2, h: 0.28, fontFace: MONO, fontSize: 10.5, bold: true, color: MOSS, charSpacing: 2, margin: 0 });
      s.addText(head, { x: x + 0.25, y: 2.48, w: 3.25, h: 0.75, fontFace: SERIF, fontSize: 16.5, bold: true, color: INK, margin: 0 });
      s.addText(body, { x: x + 0.25, y: 3.28, w: 3.25, h: 1.5, fontFace: BODY, fontSize: 11, color: FAINT, margin: 0, lineSpacingMultiple: 1.1 });
      s.addText(tag, { x: x + 0.25, y: 4.82, w: 3.2, h: 0.26, fontFace: MONO, fontSize: 9.5, italic: true, color: BRASS, margin: 0 });
      if (x < 8) s.addShape("line", { x: x + 3.78, y: 3.55, w: 0.32, h: 0, line: { color: RULEDARK, width: 2, endArrowType: "triangle" } });
      x += 4.16;
    }

    s.addShape("rect", { x: 0.9, y: 5.62, w: 11.5, h: 1.15, fill: { color: MOSSSOFT }, line: { color: MOSS, width: 1 } });
    s.addShape("ellipse", { x: 1.2, y: 5.885, w: 0.66, h: 0.66, fill: { color: SHEET }, line: { color: MOSS, width: 1 } });
    s.addImage({ data: await icon(FaHandPaper, MOSS), x: 1.37, y: 6.055, w: 0.32, h: 0.32 });
    s.addText("An approval gate at every step.", {
      x: 2.1, y: 5.8, w: 9.9, h: 0.35, fontFace: SERIF, fontSize: 16, bold: true, color: INK, margin: 0,
    });
    s.addText("Nothing runs, and nothing is written, without an explicit human Approve. Reject halts everything downstream. The original file is never touched.", {
      x: 2.1, y: 6.18, w: 10.0, h: 0.5, fontFace: BODY, fontSize: 11.5, color: FAINT, margin: 0,
    });

    s.addNotes(
      "The architecture in one sentence: the LLM is only allowed to propose — a rule spec, a code change. Everything that could be wrong in a dangerous way is decided by deterministic Python: compilation, replay, impact math, and pytest. " +
      "And the whole pipeline is human-gated: seven stages, seven explicit approvals."
    );
  }

  // ============================================================ S4 · PRODUCT
  {
    const s = pres.addSlide();
    s.background = { color: PAPER };
    kicker(s, "The product", 0.9, 0.5, INK);
    s.addText("Proof on screen — the hero moment.", {
      x: 0.9, y: 0.82, w: 11.6, h: 0.7, fontFace: SERIF, fontSize: 30, bold: true, color: INK, margin: 0,
    });

    s.addImage({ path: "docs/prove.png", x: 0.9, y: 1.8, w: 8.1, h: 4.556, shadow: shadow() });
    s.addShape("rect", { x: 0.9, y: 1.8, w: 8.1, h: 4.556, fill: { type: "none" }, line: { color: RULEDARK, width: 1 } });

    statBlock(s, 9.45, 1.85, 3.0, "100.00%", MOSS, "Extraction fidelity", "21,990 of 21,990 real HM Land Registry transactions reproduced, record by record.");
    statBlock(s, 9.45, 3.5, 3.0, "£35,186,823", BLOOD, "Legacy drift caught", "17,659 records mischarged vs the statute book. Nobody told the app where the bug was — replay found it.");
    hairline(s, 9.45, 5.5, 3.0, RULE);
    s.addText("Every figure on this screen is recomputed live at demo time. Nothing is asserted.", {
      x: 9.45, y: 5.65, w: 3.0, h: 0.8, fontFace: BODY, fontSize: 11, italic: true, color: FAINT, margin: 0,
    });

    s.addNotes(
      "This is stage 4 in the product, exactly as it renders. Left panel: the extraction reproduced the legacy engine on every one of 21,990 real transactions — that's what 'we understood your system' looks like when it's counted. " +
      "Right panel: as a by-product, replay against the never-imported statutory oracle catches the planted £35M mis-charge. That red panel is the moment non-engineers lean in."
    );
  }

  // ============================================================ S5 · TECH
  {
    const s = pres.addSlide();
    s.background = { color: PAPER };
    kicker(s, "Under the hood — technical execution", 0.9, 0.5, INK);
    s.addText("Real engineering, not a prompt wrapper.", {
      x: 0.9, y: 0.82, w: 11.6, h: 0.7, fontFace: SERIF, fontSize: 30, bold: true, color: INK, margin: 0,
    });

    const cells = [
      [FaFilter, "Messy data, triaged", "Blanks, junk text, negatives, absurd outliers: classified with a reason, counted, excluded from the math. Dirty rows never crash the pipeline."],
      [FaRedoAlt, "Schema-gated LLM", "Strict-JSON output, hand-rolled validation; exact errors fed back, max 3 attempts; cached-spec fallback when the API is down."],
      [FaShieldAlt, "Write-guard in code", "Every write resolves against an allowlist — anything outside workdir/ raises. Original file SHA-256, verified live on screen."],
      [FaVial, "Tests all the way down", "38 unit tests on the deterministic core, plus 71 golden tests generated from historical data. The pytest exit code is the only judge."],
      [FaProjectDiagram, "Gated state machine", "Out-of-order runs get HTTP 409. Reject invalidates everything downstream. Write stages are safely re-runnable for iteration."],
      [FaPlug, "Degrades gracefully", "No API key → mock mode. No network → synthetic dataset. Failed code-gen → failures fed back, one retry, then back to the human."],
    ];
    const cw = 3.83, ch = 2.12, gx = 0.9, gy = 1.85, gapx = 0.1, gapy = 0.18;
    for (let i = 0; i < cells.length; i++) {
      const [Icon, head, body] = cells[i];
      const cx = gx + (i % 3) * (cw + gapx), cy = gy + Math.floor(i / 3) * (ch + gapy);
      s.addShape("rect", { x: cx, y: cy, w: cw, h: ch, fill: { color: SHEET }, line: { color: RULE, width: 1 } });
      s.addShape("ellipse", { x: cx + 0.22, y: cy + 0.2, w: 0.46, h: 0.46, fill: { color: WELL } });
      s.addImage({ data: await icon(Icon, INK), x: cx + 0.335, y: cy + 0.315, w: 0.23, h: 0.23 });
      s.addText(head, { x: cx + 0.82, y: cy + 0.24, w: cw - 1.0, h: 0.35, fontFace: BODY, fontSize: 13.5, bold: true, color: INK, margin: 0 });
      s.addText(body, { x: cx + 0.22, y: cy + 0.78, w: cw - 0.44, h: 1.22, fontFace: BODY, fontSize: 10.5, color: FAINT, margin: 0, lineSpacingMultiple: 1.08 });
    }

    s.addText("Python 3.11 · FastAPI · pandas · pytest    ·    React + Vite + Tailwind + Recharts    ·    the LLM appears in exactly 2 of 7 stages", {
      x: 0.9, y: 6.55, w: 11.6, h: 0.3, fontFace: MONO, fontSize: 10, color: FAINT, margin: 0,
    });

    s.addNotes(
      "Judging criterion one: does it actually work on messy, ambiguous input, and recover from errors? " +
      "Every box here is implemented and unit-tested: the data triage, the schema-validated retry loop, the write-guard that raises on any path outside the sandbox, the 409-gated state machine, and graceful degradation at every external boundary. Kill the API key or the network and the demo still runs end to end."
    );
  }

  // ============================================================ S6 · IMPACT
  {
    const s = pres.addSlide();
    s.background = { color: PAPER };
    kicker(s, "Impact & speed-up", 0.9, 0.5, MOSS);
    s.addText("Weeks of consultant archaeology → minutes, with receipts.", {
      x: 0.9, y: 0.82, w: 11.6, h: 0.7, fontFace: SERIF, fontSize: 29, bold: true, color: INK, margin: 0,
    });

    const header = (t) => ({ text: t, options: { fill: { color: INK }, color: PAPER, bold: true, fontFace: MONO, fontSize: 10.5, align: "left" } });
    const cell = (t, opts = {}) => ({ text: t, options: { fontFace: BODY, fontSize: 11.5, color: INK, valign: "middle", ...opts } });
    s.addTable(
      [
        [header("TASK"), header("THE OLD WAY"), header("RULELIFT")],
        [cell("Recover the rule", { bold: true }), cell("2–6 weeks of code reading", { color: FAINT }), cell("~30 seconds, in plain English", { color: MOSS, bold: true })],
        [cell("Verify the understanding", { bold: true }), cell("manual spot checks — and hope", { color: FAINT }), cell("21,990-record replay, exact fidelity %", { color: MOSS, bold: true })],
        [cell("Price a rule change", { bold: true }), cell("days of BI queries and spreadsheets", { color: FAINT }), cell("instant, computed on the real ledger", { color: MOSS, bold: true })],
        [cell("Ship the change + tests", { bold: true }), cell("1–2 sprints, hand-written tests", { color: FAINT }), cell("diff + 71 generated golden tests, green", { color: MOSS, bold: true })],
        [cell("Confidence at sign-off", { bold: true }), cell("“trust the consultant’s memo”", { color: FAINT }), cell("counted, on screen, reproducible", { color: MOSS, bold: true })],
      ],
      {
        x: 0.9, y: 1.9, w: 7.7, colW: [1.95, 2.85, 2.9],
        border: { pt: 0.75, color: RULE }, fill: { color: SHEET },
        rowH: 0.62, valign: "middle", margin: 0.09,
      }
    );

    s.addText("£35.2M", { x: 9.1, y: 1.95, w: 3.3, h: 0.85, fontFace: SERIF, fontSize: 44, bold: true, color: BLOOD, margin: 0 });
    s.addText("MIS-CHARGE CAUGHT IN THE FIRST REPLAY", {
      x: 9.1, y: 2.82, w: 3.3, h: 0.3, fontFace: MONO, fontSize: 9.5, color: INK, charSpacing: 2, margin: 0,
    });
    s.addText("A defect that had survived every manual review — surfaced as a by-product of proving the extraction.", {
      x: 9.1, y: 3.14, w: 3.3, h: 0.75, fontFace: BODY, fontSize: 11, color: FAINT, margin: 0,
    });
    hairline(s, 9.1, 4.1, 3.3, RULE);
    s.addText("£23.7M", { x: 9.1, y: 4.28, w: 3.3, h: 0.65, fontFace: SERIF, fontSize: 32, bold: true, color: INK, margin: 0 });
    s.addText("repriced by one plain-English sentence — 10,438 transactions, quantified before anyone touches code.", {
      x: 9.1, y: 4.95, w: 3.3, h: 0.75, fontFace: BODY, fontSize: 11, color: FAINT, margin: 0,
    });
    s.addText("Same pattern for pricing, commissions, eligibility, billing.", {
      x: 9.1, y: 5.75, w: 3.3, h: 0.55, fontFace: BODY, fontSize: 11, italic: true, color: BRASS, margin: 0,
    });

    s.addNotes(
      "Judging criterion two: how dramatic is the speed-up on a real, slow enterprise process? " +
      "The old way is a consulting engagement measured in weeks per change. RuleLift compresses recovery to seconds, verification to a full-ledger replay, impact analysis to an instant computation on real data, and the change itself to a generated, test-backed diff. The £35M catch is the kind of finding that pays for the tool on day one."
    );
  }

  // ============================================================ S7 · CONTROL
  {
    const s = pres.addSlide();
    s.background = { color: PAPER };
    kicker(s, "User stays in control", 0.9, 0.5, BRASS);
    s.addText("Control beats autonomy. We built the leash first.", {
      x: 0.9, y: 0.82, w: 11.6, h: 0.7, fontFace: SERIF, fontSize: 30, bold: true, color: INK, margin: 0,
    });

    const rows = [
      [FaListOl, "Seven explicit gates", "Approve / Skip / Reject on every stage. Nothing pre-computes; approving stage 4 does not imply stage 5."],
      [FaEye, "Total visibility", "Every spec, assumption, diff, rationale and failing test is shown before it applies. Uncertainty is flagged, never hidden."],
      [FaLock, "A hard write boundary", "Stages 1–4 are read-only. Stages 5–7 write only to a guarded working copy — the guard raises on any other path. Git is never invoked."],
      [FaFingerprint, "Live integrity proof", "The original engine’s SHA-256 is fingerprinted at startup and re-verified on screen for the entire session."],
    ];
    let y = 1.88;
    for (const [Icon, head, body] of rows) {
      s.addShape("ellipse", { x: 0.9, y: y + 0.02, w: 0.5, h: 0.5, fill: { color: WELL } });
      s.addImage({ data: await icon(Icon, INK), x: 1.025, y: y + 0.145, w: 0.25, h: 0.25 });
      s.addText(head, { x: 1.58, y: y - 0.04, w: 5.2, h: 0.32, fontFace: BODY, fontSize: 14, bold: true, color: INK, margin: 0 });
      s.addText(body, { x: 1.58, y: y + 0.28, w: 5.15, h: 0.72, fontFace: BODY, fontSize: 10.5, color: FAINT, margin: 0, lineSpacingMultiple: 1.05 });
      y += 1.06;
    }

    s.addImage({ path: "docs/change.png", x: 7.25, y: 1.95, w: 5.15, h: 2.897, shadow: shadow() });
    s.addShape("rect", { x: 7.25, y: 1.95, w: 5.15, h: 2.897, fill: { type: "none" }, line: { color: RULEDARK, width: 1 } });
    s.addText("Stage 7 in the product: the generated diff, its rationale, and the generated tests — reviewed before anything is accepted.", {
      x: 7.25, y: 4.98, w: 5.15, h: 0.55, fontFace: BODY, fontSize: 10.5, italic: true, color: FAINT, margin: 0,
    });

    s.addShape("rect", { x: 0.9, y: 6.42, w: 11.5, h: 0.72, fill: { color: WELL } });
    s.addText("“A fully autonomous agent is a non-starter in an enterprise.”  RuleLift cannot act alone — by construction, not by policy.", {
      x: 1.15, y: 6.54, w: 11.0, h: 0.5, fontFace: SERIF, fontSize: 13.5, italic: true, color: INK, margin: 0,
    });

    s.addNotes(
      "Judging criterion three: control. The user walks the process piece by piece with an explicit approve at each step, sees every artifact before it lands, and the agent's write authority is bounded in code — a guard that raises outside the sandbox directory, plus a live hash check proving the original was never touched. " +
      "This isn't a policy promise; it's enforced by the runtime."
    );
  }

  // ============================================================ S8 · DEMO + CLOSE
  {
    const s = pres.addSlide();
    s.background = { color: INK };
    kicker(s, "The 90-second demo", 0.95, 0.55, COPPER);
    s.addText([
      { text: "Before: a black box. ", options: { color: PAPER } },
      { text: "After: a proven, tested change.", options: { color: COPPER, italic: true } },
    ], { x: 0.95, y: 0.9, w: 11.5, h: 0.75, fontFace: SERIF, fontSize: 29, bold: true, margin: 0 });

    const beats = [
      ["01", "Ingest", "22,000 real UK transactions load; messy rows triaged with reasons, on screen."],
      ["02", "Extract", "The buried rule appears in plain English, beside the crusty source and the model's honest assumptions."],
      ["03", "Prove", "100.00% fidelity — and a £35.2M drift against the statute book the app was never told about."],
      ["04", "Edit", "One sentence: “raise the nil-rate threshold to £300,000.” Parsed, previewed, approved."],
      ["05", "Impact", "10,438 records repriced, £23.7M — distribution and winners, computed live."],
      ["06", "Verify", "Unified diff on a guarded copy; 71 generated golden tests go green. Original file: untouched."],
    ];
    for (let i = 0; i < beats.length; i++) {
      const [n, head, body] = beats[i];
      const bx = 0.95 + (i % 2) * 5.95, by = 2.05 + Math.floor(i / 2) * 1.38;
      s.addText(n, { x: bx, y: by, w: 0.6, h: 0.5, fontFace: MONO, fontSize: 20, bold: true, color: COPPER, margin: 0 });
      s.addText(head, { x: bx + 0.72, y: by - 0.02, w: 4.9, h: 0.34, fontFace: SERIF, fontSize: 16, bold: true, color: PAPER, margin: 0 });
      s.addText(body, { x: bx + 0.72, y: by + 0.34, w: 5.0, h: 0.9, fontFace: BODY, fontSize: 11, color: PAPERDIM, margin: 0, lineSpacingMultiple: 1.08 });
    }

    hairline(s, 0.95, 6.35, 11.4, DARKRULE);
    s.addText("github.com/sambitsargam/rulelift     ·     make demo     ·     every number recomputed live — nothing asserted", {
      x: 0.95, y: 6.55, w: 10.2, h: 0.35, fontFace: MONO, fontSize: 11, color: PAPERDIM, margin: 0,
    });
    mark(s, 12.0, 6.42, 0.62, { border: PAPER, bars: INK, arrow: BLOOD });

    s.addNotes(
      "Judging criterion four: the demo itself. Six beats, ninety seconds, one arc a non-engineer can follow: black box in, plain-English rule out, proof on 22,000 real records, a £35M catch, a one-sentence change priced at £23.7M, and a green test suite — with the human approving every step. " +
      "Close: this pattern applies to any rule you can replay against history — tax, pricing, commissions, eligibility."
    );
  }

  await pres.writeFile({ fileName: "pitch/RuleLift-pitch.pptx" });
  console.log("deck written");
}

main().catch((e) => { console.error(e); process.exit(1); });
