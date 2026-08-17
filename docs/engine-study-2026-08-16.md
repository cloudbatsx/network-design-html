# What the engine taught us — the 15-diagram study (tests 10–24)

*Study date 2026-08-16 · evidence: run-logs, run-transcripts, and the proof-data
JSON of all fifteen generated documents, profiled against their source images.*

The batch was designed to stress the engine sideways: an AV signal-flow
drawing, an industrial CC-Link fieldbus map, a VoIP carrier's physical plant,
an inter-DC fabric, a Juniper backbone annotated with interfaces and /31s.
Fifteen for fifteen passed. That number alone says little — the point of this
study is what the *shape* of the successes and the blemishes teaches.

---

## 1. What the engine does well — with the evidence

**JSON discipline is a solved problem.** Fifteen diverse builds, 7,000–23,000
characters each: zero repairs, zero truncation, zero fence-stripping. The
repair chain (`parseWithRepair`) never had to fire. This is the strongest
possible signal that the contract design — one JSON object, closed
vocabularies, byte-guarded splice — is doing its job. The repair chain still
earns its keep as the floor for weaker models than 3.6-flash.

**The count-first extraction fix generalizes.** The rule shipped after test3's
silent-omission audit (demand a device count, list every repeat) held up on
every hostile input: the 37-component factory network landed 37/37, the
backbone landed 8/8 with faithful ids (`ba1-dca1`…`ra2-dal2`), and nothing in
the batch shows the old compress-the-repetition failure.

**Semantic capture is genuinely rich now.** Three examples worth naming:

- test24 carried *every* interface pair and /31 into link labels —
  `xe-2/2/3 <-> xe-4/1/5:3 · 10.0.0.62/31` — exactly the notation an operator
  would want.
- test23 mapped an off-domain fieldbus hierarchy into honest link labels
  (`CC-Link IE Field`, `150Mbps SSCNET`, `AnyWireASLINK`, `Max. 10Mbps`) and
  reused the kind vocabulary sensibly (`ha` for the redundant PLC pair,
  `aggregate` for trunks).
- test13 turned AV signal flow into labelled edges (`HDMI-1001`, `MIC-1001`,
  `RS-1001`) rather than pretending it was IP.

**Field coverage is total.** Every node in every test carries `address` and
`notes` — 100 % across ~330 nodes. The v0.3a prompt push ("push details into
notes/address/labels") worked completely.

**Label coverage tracks the source honestly.** Where sources had per-link
annotations, labels are near-total (24: 12/12, 21: 24/24, 23: 37/37, 13:
11/13). Where sources drew bare lines (11, 12, 17, 22), labels are near-zero.
The model is not inventing link facts to look thorough — that is the honesty
rules working, not a gap.

**The model reads diagram *semantics*, not just topology.** test24's findings
include "Red status on ra1.dal2 and link ba1.dca1–cr1.den1" — it understood
that red meant fault — plus two "unlabeled subnet" confessions. The findings
machinery is being used for real observations.

**The retry loop converges.** Its second live firing (test20: two gaps pinned
to areas named `internal`/`perimeter` that didn't exist — the drawing used
`zone-internal`/`zone-external`) was caught by the checker, explained by the
Copy-problems message, and fixed in one extra trip. Both live firings to date:
one extra round, done.

---

## 2. Where the engine is weak — with the evidence

**One failure family owns every blemish: geometry.** All fourteen warnings in
the batch are spatial — device boxes overlapping (tests 10, 13, 19; 9–15 % of
a box) or devices straddling a zone edge (tests 11, 20-round-1; 69–91 %
inside). Not one semantic, structural, or honesty defect. The model thinks
well and *places* poorly.

**Root cause 1 — the packing math is against it.** A node box is 176×104 px;
the canvas is 1280×930 in every generated doc (the template default — no run
ever changed it). At 40 nodes (test11) the boxes alone claim **61 %** of the
canvas; the factory network claims 57 %; the campus 55 %. Warnings correlate
directly with this density: the three densest tests produced 12 of the 14
warnings. No layout could satisfy the checker comfortably at 60 % box density
— the model was set up to fail before it placed the first node.

**Root cause 2 — the prompt states constraints, not a construction recipe.**
The build prompt says "FULLY inside an area" and defines overlap precisely,
but offers no numbers to *build with*: no minimum spacing, no zone padding, no
grid, no per-zone row budget. An LLM doing pixel arithmetic in its head aims
to *barely* satisfy a threshold and lands 9 % over the line. The 84–91 %-inside
straddles are the same story at zone edges: "fully inside" with no stated
margin produces centres placed exactly at the boundary of legality.

**Root cause 3 — nobody grows the canvas.** `canvas.width/height` is model-
writable data, and the model never once touched it. Nothing tells it that a
40-device build should ask for a taller page.

**Secondary gaps, smaller but real:**

- **Zone vocabulary flattens multi-site topologies.** `external / perimeter /
  internal / other` cannot express "five branch buildings and two data
  centers". test12 (multi-building campus) and test19 (HQ + 5 branches) each
  collapsed to 3 zones; the building/branch structure that dominated the
  source images survives only in node labels. This is the largest
  *expressiveness* gap the batch exposed.
- **Link state has nowhere to live.** test24's red (down) link could only be
  recorded as a finding. The renderer's kinds carry medium/role, not health.
  One optional field (`status: "down" | "degraded"`) and a dashed/red stroke
  would let a diagram say what every NOC diagram wants to say.
- **Icon vocabulary strain** (audit item 4, still open, now measured): the AV
  build wanted projector/display/speaker/microphone; the industrial build
  wanted PLC/robot/drive/HMI; the older audit wanted smartphone/scanner.
  Labels carried the truth, but the substitutions are visible.
- **Findings quality is uneven.** test24's findings are operational
  (fault + unlabeled subnets). test13's are title-block metadata ("Checked By
  Field Unverified"). Nothing prompts for the findings an engineer values
  most: single points of failure, single-homed devices, missing redundancy.
  The AV matrix switch — a textbook SPOF feeding every display and speaker —
  went unremarked.
- **Racks are invented confidently.** Delegated rack mode produced plausible
  fictions (16 rack devices for the VoIP carrier) — by design, but the
  invented-specs honesty rule (audit item 3) still hasn't shipped, and rack
  contents are where inventions concentrate.

---

## 3. The direction — ranked, each item pinned to evidence

**D1. Compute a layout budget in the engine and put it in the build prompt.**
*Highest leverage, no schema change, pure engine code.* The workflow is
two-step: the extraction reply (with its device count, thanks to count-first)
exists *before* `buildPrompt()` composes the request. The helper can therefore
compute and inject real numbers:

> You are placing N devices. Set canvas height to H (grow it; the page
> scrolls). Keep node centres ≥ 200 px apart horizontally, ≥ 130 px
> vertically; keep centres ≥ 120 px inside zone edges. Zone areas should sum
> to roughly A px².

with H derived from N at a target box density of ~25–30 %. This converts the
whole observed failure family from "model estimates pixels" to "model follows
stated arithmetic" — the thing LLMs are actually good at. The same numbers
belong in the smoke test so the budget rule is pinned.

**D2. A deterministic geometry-polish pass — extend the repair ethos from
syntax to space.** `parseWithRepair` already fixes fences and trailing commas
and *says so*. The checker already computes every overlap and containment
percentage exactly. Between them sits an obvious move: when the only problems
are sub-threshold spatial blemishes, nudge — separate two boxes along their
overlap axis, pull an 88 %-inside device fully into its zone, clamp to canvas
— and report it in the repair voice: *"I tidied 3 positions: …"*. Warnings
become fixes; stops stay stops. Every one of this batch's fourteen warnings
would have been silently-impossible; instead each becomes a one-line honest
repair note. Zero model tokens spent.

**D3. Give multi-site topologies a shape: zone grouping.** Smallest viable
change: allow zones to carry an optional `group` (or `parent`) so five branch
zones can exist without exhausting the kind vocabulary, and teach the
extraction prompt to list *sites/buildings* as candidate areas. The renderer
already draws N zones; what's missing is permission and a naming pattern.
test12 and test19 are the acceptance tests.

**D4. Optional `status` on links (and nodes).** `"status": "down" |
"degraded"` → red/dashed stroke, amber halo. test24 is the acceptance test:
the red link should be red in the generated document, not only confessed in
findings. Backwards-compatible; absent means healthy.

**D5. Findings quality bar in the build request.** One sentence: "Include at
least one finding about resilience if the topology shows a single point of
failure, a single-homed device, or an unprotected uplink." test13's matrix
switch and test19's single-router branches are the acceptance tests. (Keep
the honesty framing — findings must cite what the diagram shows, not
speculate.)

**D6. Icon vocabulary, one deliberate round.** Ship the four audit/batch
clusters: mobile/peripheral (smartphone, scanner), AV (display, projector,
speaker, microphone), industrial (plc, hmi, drive, robot), and a generic
`iot-device`. The closed list is a feature — grow it by evidence, not by
whim, and these ten have evidence.

**D7. Scalability guard for the next size class.** The biggest fresh build to
date is 40 nodes / 47 links / ~23 k chars — comfortably inside output limits.
The known cliff is output length (the ~39 k "Everything" concern from the
editing protocol). Before someone feeds a 100-device diagram: have the
harness (which knows the extract count) warn past ~60 devices, and consider a
two-pass build (zones+nodes, then links+sections) as the documented big-
diagram path. Cheap insurance, aligned with the part-based design that
already exists for edits.

**What not to change:** the closed vocabularies, the one-JSON-object
contract, the never-touch-the-brand rule, and the reactive Copy-problems
loop all earned their keep in this batch. The temptation after 15/15 is to
loosen; the record says tighten selectively (D1, D5) and repair humbly (D2).

---

## 4. One paragraph of perspective

Two batches ago the engine's biggest defect was silent omission — a fidelity
problem, fixed by making the prompts demand honesty about count. This batch
shows the next stratum down: the engine now *knows* the right things and
still *places* them like someone estimating distances by eye. The fix has the
same character as last time — don't ask the model to be better, change the
engine so the model's job is easier to do correctly (give it arithmetic, then
polish deterministically what estimation gets nearly right). That pattern —
move the burden from model talent to engine construction — is the direction,
and it is exactly the thesis of the repository: a weak model in a strong
harness beats a strong model in a weak one.
