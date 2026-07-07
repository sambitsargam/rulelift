#!/bin/sh
# Builds pitch/RuleLift-demo.mp4 — narrated walkthrough over real product screens.
# Requires: ffmpeg, macOS `say`. Run from the repo root: sh pitch/build_video.sh
set -e

FF=$(command -v ffmpeg || echo /opt/homebrew/bin/ffmpeg)
FONT="/System/Library/Fonts/Supplemental/Arial Bold.ttf"
TMP=$(mktemp -d)
VOICE="Samantha"
RATE=180

PY="${PY:-.venv/bin/python}"

scene() { # $1 idx  $2 image  $3 caption  $4 narration
  idx="$1"; img="$2"; cap="$3"; txt="$4"
  "$PY" pitch/caption.py "$img" "$cap" "$TMP/f$idx.png"
  say -v "$VOICE" -r "$RATE" -o "$TMP/a$idx.aiff" "$txt"
  dur=$(afinfo "$TMP/a$idx.aiff" | awk '/estimated duration/ {print $3}')
  total=$(echo "$dur + 0.7" | bc)
  "$FF" -y -loglevel error -loop 1 -i "$TMP/f$idx.png" -i "$TMP/a$idx.aiff" \
    -t "$total" -c:v libx264 -tune stillimage -r 30 -pix_fmt yuv420p \
    -c:a aac -b:a 160k -ar 44100 -ac 2 \
    -vf "fade=t=in:st=0:d=0.35" \
    -af "apad=pad_dur=0.7" -shortest "$TMP/s$idx.mp4"
  echo "file '$TMP/s$idx.mp4'" >> "$TMP/list.txt"
}

scene 1 docs/landing.png "RuleLift — extract, prove, and safely change buried business rules" \
"This is RuleLift. Every enterprise runs on business rules that exist only as legacy code, written by people who left years ago. RuleLift digs those rules out — and unlike a chatbot, it proves what it found."

scene 2 docs/ingest.png "Stage 1 · Ingest — 22,000 real transactions, messy rows triaged" \
"We start with a genuine black box: an undocumented, mainframe-ported stamp duty engine, plus twenty two thousand real property transactions from the U K Land Registry. Every messy row — blanks, junk text, absurd outliers — is classified and excluded with a reason. Nothing crashes on dirty data."

scene 3 docs/extract.png "Stage 2 · Extract — the buried rule, in plain English" \
"The model reads the code and must return the rule as strict JSON — bands, conditions, and its honest assumptions — validated against a schema, with any errors fed straight back. The buried rule appears in plain English, right next to the crusty source."

scene 4 docs/prove.png "Stage 4 · Prove — 100.00% fidelity · £35.2M drift caught" \
"Now the proof. Every transaction is replayed through the legacy code, the extracted rule, and the official statutory rates. One hundred percent fidelity: the extraction is behaviourally identical to the legacy system. And look at the red panel — a thirty five million pound discrepancy against the statute book, on seventeen thousand records. Nobody told the app where the bug was. Deterministic replay found it."

scene 5 docs/edit.png "Stage 5 · Edit — one plain-English sentence, previewed, approved" \
"Changing the rule takes one sentence: raise the nil-rate threshold to three hundred thousand pounds. It's parsed deterministically — not by the model — previewed as a band table, and applied only when a human approves."

scene 6 docs/impact.png "Stage 6 · Impact — £23.7M across 10,438 records, computed live" \
"The impact is computed on the real ledger, never asserted: ten thousand four hundred and thirty eight transactions repriced, twenty three point seven million pounds in total — with the distribution, and exactly who pays less."

scene 7 docs/change.png "Stage 7 · Change & Verify — guarded diff · 71 generated tests green" \
"Finally, the change itself: a unified diff applied to a write-guarded copy — the original file is hash-verified untouched — and seventy one golden tests generated from the historical data. Pytest goes green."

scene 8 docs/landing.png "github.com/sambitsargam/rulelift · make demo" \
"Seven stages. Seven explicit human approvals. The model proposes; deterministic Python disposes. Weeks of consultant archaeology become minutes of proven, test-backed change. RuleLift."

# re-encode audio at concat time: stream-copied AAC across segment joins can
# play back silent in QuickTime; one continuous re-encoded track is safe everywhere
"$FF" -y -loglevel error -f concat -safe 0 -i "$TMP/list.txt" \
  -c:v copy -c:a aac -b:a 160k -ar 44100 -ac 2 -movflags +faststart \
  pitch/RuleLift-demo.mp4
rm -rf "$TMP"
echo "wrote pitch/RuleLift-demo.mp4"
afinfo pitch/RuleLift-demo.mp4 2>/dev/null | grep duration || true
