#!/bin/sh
# Builds pitch/RuleLift-full.mp4 — narrated deck walkthrough followed by the
# product demo, as one continuous MP4.
# Prereqs: slide frames at /tmp/deckframe-1..8.png (see build_deck QA export),
#          pitch/RuleLift-demo.mp4 already built, ffmpeg, macOS `say`.
set -e

FF=$(command -v ffmpeg || echo /opt/homebrew/bin/ffmpeg)
TMP=$(mktemp -d)
VOICE="Samantha"
RATE=180

slide() { # $1 idx  $2 narration
  idx="$1"; txt="$2"
  say -v "$VOICE" -r "$RATE" -o "$TMP/a$idx.aiff" "$txt"
  dur=$(afinfo "$TMP/a$idx.aiff" | awk '/estimated duration/ {print $3}')
  total=$(echo "$dur + 0.8" | bc)
  "$FF" -y -loglevel error -loop 1 -i "/tmp/deckframe-$idx.png" -i "$TMP/a$idx.aiff" \
    -t "$total" -c:v libx264 -tune stillimage -r 30 -pix_fmt yuv420p \
    -c:a aac -b:a 160k -ar 44100 -ac 2 \
    -vf "fade=t=in:st=0:d=0.35" -af "apad=pad_dur=0.8" -shortest "$TMP/p$idx.mp4"
  echo "file '$TMP/p$idx.mp4'" >> "$TMP/list.txt"
}

slide 1 "Hi — this is RuleLift: a copilot that extracts business rules buried in legacy code, proves the extraction against real data, and ships safe, test-backed changes. Keep four numbers in mind — all computed live by the product: one hundred percent extraction fidelity, thirty five point two million pounds of legacy drift caught, twenty three point seven million pounds of impact from a one-sentence change, and seventy one generated tests, all green."

slide 2 "The problem is universal. The engineer who wrote your rule engine left years ago, and the only spec left is the code itself — cryptic names, dead branches, mainframe ports. So every change becomes a consulting engagement: weeks of code archaeology. Language models can read that code in seconds, but a model's summary is an opinion — and you can't bet a tax filing on an opinion."

slide 3 "Our answer: the model proposes, deterministic Python disposes. The L L M does exactly two jobs — reading the code into a strict, schema-validated rule spec, and drafting the final code change. Everything that decides correctness — compiling the rule, replaying it, pricing the change, and running the tests — is pure deterministic Python. And there's an approval gate at every single step."

slide 4 "Here's the product at its hero moment. The extracted rule reproduced the legacy engine on all twenty one thousand nine hundred and ninety real Land Registry transactions — one hundred percent fidelity, counted record by record. And as a by-product, replay against the official statutory rates caught the legacy engine mischarging seventeen thousand records — thirty five million pounds. Nobody told the app where the bug was."

slide 5 "On technical execution: this is real engineering, not a prompt wrapper. Messy data is triaged, never fatal. The L L M is schema-gated with error feedback and a cached fallback. A write-guard in code makes it impossible to touch the original file, with a live hash check on screen. Thirty eight unit tests cover the deterministic core, the pipeline is a state machine that rejects out-of-order runs, and everything degrades gracefully — no A P I key, no network, the demo still runs end to end."

slide 6 "On impact: recovering a rule goes from weeks of code reading to thirty seconds. Verification goes from manual spot checks to a full twenty two thousand record replay. Pricing a change goes from days of B I work to an instant computation on the real ledger. And shipping the change with tests goes from sprints to minutes. The thirty five million pound catch is the kind of finding that pays for the tool on day one."

slide 7 "On control: control beats autonomy, so we built the leash first. Seven explicit gates — approve, skip, or reject at every stage. Total visibility into every spec, diff, rationale, and failing test. A hard write boundary enforced in code, and a live integrity proof that the original engine was never touched. RuleLift cannot act alone — by construction, not by policy."

slide 8 "Here's the ninety-second demo flow: ingest, extract, prove, edit, impact, verify. Now watch the product do it for real."

# stitch: narrated deck + product demo, one continuous re-encoded file
echo "file '$(pwd)/pitch/RuleLift-demo.mp4'" >> "$TMP/list.txt"
"$FF" -y -loglevel error -f concat -safe 0 -i "$TMP/list.txt" \
  -c:v libx264 -r 30 -pix_fmt yuv420p -c:a aac -b:a 160k -ar 44100 -ac 2 \
  -movflags +faststart pitch/RuleLift-full.mp4

rm -rf "$TMP"
echo "wrote pitch/RuleLift-full.mp4"
