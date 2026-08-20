# Free-model validation — protocol and results

**Status: fresh-build path validated live and across twenty-two automated
runs · nine-run editing matrix PASSED automated on 2026-08-17 — nine for
nine in one round trip each, with the semantic audit's findings recorded
beside the table.**

Everything else in this repository is machine-checked. This is the one claim
only a live session can test: *"a free AI model is enough."* This document is
the protocol for that session and the record of its results. Anyone can rerun
it against any model and add a row.

## Setup

- **Design file:** `starters/NET-HQ-001.edit.html` — the largest supported
  starter (~39,000 characters of helper-formatted data). Hard mode on purpose.
- **Helper:** `edit-with-ai.html`, opened locally. Load the starter once
  and keep the tab open for the whole session — after every save, the helper
  continues from the file it just wrote, so the runs build on each other.
- **Model:** a genuinely free model, in a fresh chat per run so no run is
  helped by the context of an earlier one. Record the exact model name the
  interface shows, and the date.
- **Per run:** pick the part in the dropdown, paste the request below into the
  helper's request box, **Copy prompt**, paste into the model, paste the reply
  back, **Check it**. If the helper reports problems, use **Copy problems**,
  paste that to the model, and count the round trip. Save when clean.

## The nine runs

| # | Part in dropdown | Request to type |
|---|---|---|
| 1 | Devices | Add a wireless LAN controller in the internal zone, near the core switches. |
| 2 | Connections | Connect hq-wan-01 to hq-wan-02 with a backup link. |
| 3 | Areas | Make the out-of-band zone 30 pixels taller without moving any other zone. |
| 4 | The whole diagram | Move hq-srv-01 next to the ESX hosts and connect it to both core switches. |
| 5 | The rack | Give hq-wan-01 and hq-wan-02 the drawn face of a 1U router. |
| 6 | Gaps & open items | Add a finding pinned to hq-srv-01: its backup path has never been tested. |
| 7 | Notes & tables | Add a note to the operations section: weekly configuration backups are assumed, not verified. |
| 8 | Cover details | Bump the revision to v1.1 and set the date to today. Change nothing else. |
| 9 | Everything | Add a second wireless LAN controller as an HA pair for the first, wired to both cores. |

The runs are chosen to walk the known weak-model failure modes: the closed
icon list (1), referencing existing ids (2, 6), pure geometry (3), a
multi-part edit inside one slice (4), the drawn-faceplate vocabulary and the
face-height rule (5), the anchor rules (6), the note shapes (7), the
never-touch-the-brand rule (8), and output-length limits (9 — the whole
~39,000-character design, which is *expected* to strain a free model; if the
parts succeed and only this one truncates, that is the part-based design
working, not failing).

## What to record

The helper reports most of this itself — copy its words.

- Round trips to a clean save (target: **≤ 2** for runs 1–8).
- Did the reply need repair? (the helper says: *"I cleaned up the reply
  first: …"* — fences, prose, trailing commas, curly quotes)
- Was it cut off? (the helper distinguishes truncation from invalid JSON)
- Did it stay in scope? (the helper reports parts it dropped: *"The reply
  also sent …, which was ignored"*)
- Did any check fire? (invented icons or kinds, brand altered, footer lines
  dropped, geometry off-canvas or overlapping, rack conflicts)
- After saving: double-click the file — badge still PASS, drawing sane?

## Pass criteria

From the design goals: **a part-scoped edit reaches a clean save in at most
two round trips, with no truncation, on the largest starter.** Run 9 is
diagnostic, not pass/fail.

## Results

### Live result 1 — the fresh-build path · 2026-08-15

**Model:** Gemini free tier (gemini.google.com; the model picker offered 3.6 and
3.1, the run used the default "Thinking" setting) · **Operator:** Sayed Haque ·
**Input:** a ~15-device single-office topology image supplied by the
organisation.

The diagram-reading prompt returned a correct three-list inventory on the first
reply (every device with a sensible id, connections, trust areas). One
"Everything" run against the blank template then produced the complete design:
the helper's verdict was **"No problems found"** with no repair notes — the
reply was clean JSON on the first attempt. **Round trips: 1. Truncation: none.**
The saved document rendered with both zones, all devices, the encrypted
remote-access links, a populated rack with drawn faceplates, and a gaps
register the model wrote itself: addressing unspecified, VPN details
unverified, hardware models unspecified — each pinned to the right place.

Two workflow frictions surfaced and became fixes the same day: choosing a
starter felt like homework (now: the blank-template door), and composing the
two prompts by hand was error-prone (now: the helper's "Starting fresh" panel
builds both).

### Live results 2–8 — the automated fresh-build matrix (test folders 3–9) · 2026-08-15

**Model:** `gemini-3.6-flash` (the id the API reported back for every call) ·
**Surface:** Google AI free-tier API, driven by `tools/run-free-model-tests.js` ·
**Operator:** automated harness, Sayed Haque supervising.

Seven fresh-build runs, each from a different organisation-supplied topology
image and logo, each in its own conversation. The harness reuses the helper's
real logic — the same prompts, the same repair chain, the same checkers, the
same byte-guarded save, the same packaging engine — so these runs test the
product, not a reimplementation. Per-test detail (every round trip, every
problem, token counts) is in each test folder's `run-log.json`. Rerun with:

    node tools/run-free-model-tests.js --tests-dir tests/free-model-runs --tests 3-9

The run folders themselves live in the repository at `tests/free-model-runs/`
- every source diagram, logo, generated document, run-log and word-for-word
transcript, so any row in these tables can be checked against the artifacts
that produced it — with the exceptions recorded honestly in *Artifact
provenance* below: for folders 3–9 the table's evidence is
`run-log.run1.json`, not the primary log. The study distilled from runs
10-24 is `docs/engine-study-2026-08-16.md`.

**A note on which models this covers, plainly.** The free gemini.google.com
picker offers "3.6 Thinking" and "3.1 Pro". Google's documentation identifies
the app's 3.6 Thinking with the API model `gemini-3.6-flash`, which is what
these runs used — same model, different surface, and that difference is
recorded rather than papered over. "3.1 Pro" (`gemini-3.1-pro-preview`) is
**paid-tier only on the API** — attempted live on a billing-free key on
2026-08-15, refused with a 429 quota error — so it has no free programmatic
surface at all. It remains testable only by hand in the web app, and no 3.1
Pro rows appear here for that reason.

| Test | Drawing | Input diagram | Round trips | Repaired? | Cut off? | Stops fired | Warnings | Logo route | Packaging | Verdict |
|---|---|---|---|---|---|---|---|---|---|---|
| 3 | BSN-NET-001 | school district WAN (webp) | 1 | no | no | none | 0 | PNG raster | 29 embedded, 0 skipped | PASS |
| 4 | NON-NET-001 | office LAN (png) | 1 | no | no | none | 1 | JPG raster | 29 embedded, 0 skipped | PASS |
| 5 | MDN-NET-001 | Brocade VCS data center (jpg) | 1 | no | no | none | 0 | SVG path+viewBox | 29 embedded, 0 skipped | PASS |
| 6 | SAN-NET-001 | school campus LAN (jpg) | 1 | no | no | none | 0 | PNG raster | 29 embedded, 0 skipped | PASS |
| 7 | EN-NET-001 | energy grid network (png) | 1 | no | no | none | 0 | SVG path+viewBox | 29 embedded, 0 skipped | PASS |
| 8 | BFN-NET-001 | home FIOS network (drawio png) | 1 | no | no | none | 0 | JPG raster | 29 embedded, 0 skipped | PASS |
| 9 | PHN-NET-001 | homelab traffic diagram (png) | 1 | no | no | none | 0 | PNG raster | 29 embedded, 0 skipped | PASS |

Every run reached a clean save in **one round trip** with **zero repairs** —
no fences stripped, no trailing commas, no truncation across seven complete
designs of 10,000–17,500 characters each. Both logo routes were exercised:
five raster logos staged as the one allowed data URI, two SVG logos landed as
path + viewBox. Two designs (7, 8) correctly chose no rack for topologies with
nothing rack-mountable. Saved documents render with a PASS badge and sane
drawings (3 and 5 opened and inspected; the rest carry the same machine
checks).

**The one imperfection, faithfully:** run 4 saved with a single geometry
warning — *"pc-04" and "scan-01" overlap by 9% of a device box* — which the
checker caught and reported exactly as designed. Cosmetic, not structural, and
below the stop threshold; noted here so the record never looks cleaner than
the run was.

**Failures worth fixing:** the machine checks fired nothing, but the fidelity
audit below found what they cannot see.

#### Fidelity audit — source diagram vs. generated document · 2026-08-15

The checkers grade internal consistency; they cannot grade whether the
document matches the diagram it came from. So every source image was compared
by eye against its generated topology, device by device. The verdicts:

| Test | Fidelity | What the comparison found |
|---|---|---|
| 3 | **POOR — silent omission** | The source shows ~34 devices; the document has 18. All ~14 IDF switches (BM IDF 01–03, WHS IDF 01–03, PH IDF 01–04, one each for Gudith/Wegienka/Yake/Bates) and every MM-fiber uplink were dropped, and the legend's 2× Novell eDirectory/File Servers became one node. The prose *mentions* "MM Fiber used for local IDF uplinks" and the node ids skip srv-04 — evidence the extraction saw more than the build kept — yet no finding records the omission. |
| 4 | **HIGH** | All 19 devices, every IP (.1–.19), both phones-behind-PCs, scanner/printer placement all correct. Smartphone and scanner drawn with substitute icons (closed icon list has neither). |
| 5 | **GOOD** | Faithful for a conceptual marketing diagram; the remote DC's server stack was condensed to one node, defensibly. |
| 6 | **HIGH** | Port labels (Fa0/3–Fa0/12, Gi0/1↔Gi0/0, S0/0↔S0/1, 192.168.1.0/24) all preserved. The firewall was verified against the source under magnification: it is genuinely in the topology, not imported from the slide's icon legend — and the legend's other icons were correctly *not* imported. |
| 7 | **GOOD** | Every labelled component of an off-domain electrical schematic captured; the four battery cells were condensed to one bank node. Fuse/bus-bars forced into network icons by the closed vocabulary — labels carry the truth. |
| 8 | **HIGH** | Optical/COAX/HDMI paths, the MoCA 100 Mbps note (which became a finding), and the wall pass-through all captured. The TV's own Wi-Fi link is represented indirectly. |
| 9 | **HIGH** | All 9 devices, VLAN colour semantics preserved in link labels. One invented spec: "8-Port" on the HP ProCurve, which the source never states. |

**Named fix-list items from the audit:**

1. **Silent-omission blind spot (from run 3, the big one).** A document can be
   self-consistent, validated and PASS-badged while missing 40 % of the source
   topology. The model compresses visual repetition (14 IDFs → 0, 4 battery
   cells → 1, 2 Novell servers → 1). Candidate absorptions: the extraction
   prompt should demand a device *count* first and every repeated device
   listed; the build request should require any condensation to be recorded
   as a finding — silent omission becomes recorded honesty, which is the
   product's ethos applied to itself.
2. **The runner must keep the transcripts.** run-log.json records sizes and
   verdicts but not the extract/build reply text, so run 3's loss cannot be
   pinned to the extract step or the build step after the fact.
3. **Invented specs (from run 9).** "8-Port" was asserted, not read. The build
   request's existing honesty rules should extend to hardware port counts.
4. **Icon vocabulary gaps (from run 4).** No smartphone, no scanner symbol;
   both were substituted plausibly but visibly.

One caveat the matrix should carry: the automated runs skip the
human-corrects-the-inventory step that live result 1 included, so they test a
*stricter* path than the documented workflow — impressive that 7/7 passed it,
but run 3 shows what the human review step is for.

#### The fix, and the re-run that proves it · 2026-08-15

Items 1 and 2 shipped the same day. The extraction prompt now demands a
device count first and every repeated device on its own line; the build
request requires every inventory device in the document, with any
condensation or omission recorded as a finding; the runner keeps the full
transcript per run (`run-transcript.json`); a behaviour test pins all three
rules.

Test 3 was then re-run from scratch, same model, same image
(first run's log preserved as `run-log.run1.json`):

| | First run | Re-run with the fix |
|---|---|---|
| Extract | no count, IDFs lost downstream | opens with "**Total Device Count: 33 Devices**" |
| Nodes | 18 of 33 | **33 of 33** — all 14 IDFs, both Novell servers |
| MM-fiber uplinks | 0 | **14**, matching the diagram |
| Round trips / repairs | 1 / none | 1 / none |
| Warnings | 0 | 6 — a denser canvas left six devices 86 %-inside their zone edge, each caught and named by the checker |
| Badge | PASS · 18 nodes (silently incomplete) | **PASS · 33 nodes · 32 links · 11 rack devices** |

> The log of this exact re-run was later overwritten by one more
> regeneration of test 3 — see *Artifact provenance* below for what the
> folder's `run-log.json` now records.

The device count in the extract matches a by-hand count of the source image
exactly. The fidelity failure mode of run 3 is closed at its cause: the model
still compresses repetition when allowed, and the prompts no longer allow it
silently. The six boundary warnings are the honest cost of a fuller canvas —
cosmetic, correctly reported, and the next candidate for spacing guidance if
they recur. Items 3 (invented specs) and 4 (icon vocabulary) remain open.

### Live results 9–23 — the second automated matrix, fifteen harder diagrams (test folders 10–24) · 2026-08-16

**Model:** `gemini-3.6-flash` (the id the API reported back for every call) ·
**Surface:** Google AI free-tier API, driven by `tools/run-free-model-tests.js` ·
**Operator:** automated harness, Sayed Haque supervising.

Fifteen more fresh-build runs (desktop test folders 10–24), deliberately
ranging far beyond ordinary LAN diagrams: an AV-integration signal-flow
drawing, an industrial CC-Link fieldbus map, a VoIP carrier's physical layer,
an inter-datacenter fabric, a Juniper backbone annotated with interfaces and
/31s. Same harness, same command with `--tests 10-24`.

| Test | Drawing | Input diagram | Round trips | Repaired? | Cut off? | Stops fired | Warnings | Logo route | Packaging | Verdict |
|---|---|---|---|---|---|---|---|---|---|---|
| 10 | CCN-NET-001 | clinic network, HA UTM pair (png) | 1 | no | no | none | 1 | PNG raster | 29 embedded, 0 skipped | PASS |
| 11 | CGN-NET-001 | layered HQ campus + branch, textbook figure (png) | 1 | no | no | none | 7 | SVG path+viewBox | 29 embedded, 0 skipped | PASS |
| 12 | FCN-NET-001 | multi-building campus with two DCs (png) | 1 | no | no | none | 0 | SVG path+viewBox | 29 embedded, 0 skipped | PASS |
| 13 | BAN-NET-001 | AV-integration signal flow, cafeteria (jpg) | 1 | no | no | none | 1 | PNG raster | 29 embedded, 0 skipped | PASS |
| 14 | HDN-NET-001 | clinic network, second rendition (jpg) | 1 | no | no | none | 0 | SVG path+viewBox | 29 embedded, 0 skipped | PASS |
| 15 | CVN-NET-001 | VoIP carrier physical layer (png) | 1 | no | no | none | 0 | SVG path+viewBox | 29 embedded, 0 skipped | PASS |
| 16 | RRN-NET-001 | residence AV + network rack (png) | 1 | no | no | none | 0 | PNG raster | 29 embedded, 0 skipped | PASS |
| 17 | ILN-NET-001 | spine-leaf homelab with monitoring (jpg) | 1 | no | no | none | 0 | SVG path+viewBox | 29 embedded, 0 skipped | PASS |
| 18 | OTN-NET-001 | training-lab topology, logical + physical (png) | 1 | no | no | none | 0 | SVG path+viewBox | 29 embedded, 0 skipped | PASS |
| 19 | VNN-NET-001 | multi-region monitoring map, 5 branches (png) | 1 | no | no | none | 5 | PNG raster | 29 embedded, 0 skipped | PASS |
| 20 | RUN-NET-001 | university campus core, JANET/IX uplinks (png) | 2 | no | no | 2 in round 1 | 0 | SVG path+viewBox | 29 embedded, 0 skipped | PASS |
| 21 | WSHN-NET-001 | integrated smart home (png) | 1 | no | no | none | 0 | SVG path+viewBox | 29 embedded, 0 skipped | PASS |
| 22 | SDN-NET-001 | inter-datacenter architecture (jpg) | 1 | no | no | none | 0 | PNG raster | 29 embedded, 0 skipped | PASS |
| 23 | FAN-NET-001 | industrial CC-Link fieldbus network (jpg) | 1 | no | no | none | 0 | SVG path+viewBox | 29 embedded, 0 skipped | PASS |
| 24 | CTN-NET-001 | Juniper backbone with interfaces and /31s (png) | 1 | no | no | none | 0 | SVG path+viewBox | 29 embedded, 0 skipped | PASS |

Fifteen for fifteen, fourteen in **one round trip**, all with **zero repairs
and zero truncation**. Test 20 is the interesting one: round 1 pinned two gaps
to areas named `internal` and `perimeter` while the drawing's areas were
`zone-internal` and `zone-external` — the checker stopped the save, the
harness pasted the helper's own Copy-problems message back, and round 2 came
back clean. That is the second live firing of the retry loop, and like the
first it converged in one extra trip.

**The imperfections, faithfully.** All fourteen warnings across the batch fall
into exactly two geometry families the checker already names: device boxes
overlapping (runs 10, 13, 19 — 9–15 % of a box) and devices drawn 69–91 %
inside their zone edge (runs 11, 20-round-1). The model's semantic output was
flawless across the batch; every blemish was spatial. Layout guidance in the
build prompt — spacing margins, zone padding — is now the clear next
candidate, promoted from a note to a pattern by fourteen occurrences.

**Fidelity caveat:** unlike results 2–8, this batch has had only one
source-vs-document comparison so far (run 24: all 8 routers landed with
faithful ids — `ba1-dca1` through `ra2-dal2` — no condensation). The
device-count-first extraction rules were in force for every run here; a full
by-eye audit of the other fourteen remains open.

**Free-tier quota, plainly, for whoever reruns this.** The daily budget resets
at midnight Pacific; after heavy use the rolling window recovers roughly one
full test per two hours of idleness. Failed 429 calls cost nothing. The
cadence that finished this batch: run tests singly, never in bulk, once the
first 429 wall appears — a batch launched into a thin window burns its own
retries.

### The geometry program, and the run that proves it · 2026-08-17

The second matrix's fourteen warnings were all spatial, so two changes
shipped. The placing parts of the build prompt now carry a construction
recipe — grid centres, area sizing arithmetic, permission to grow the canvas
— because a model estimating pixel distances lands 9 % over a threshold and a
model following stated numbers does not. And the helper gained a geometry
polish: warning-band overlaps and plainly-belonging straddlers are repaired
deterministically and reported like text repairs. Proven against the saved
output of the two warning-heaviest runs before any new quota was spent:
test 11's seven warnings and test 19's five all repair to zero, including
full grid rows shifting as one chain and an area edge growing to hold its
own column.

The first live run with the grid found the trap the arithmetic had opened:
rather than grow the canvas further, the model **dropped 8 of the 40 devices
its own extract had counted** — silently, PASS badge and all. The prompt now
states that the grid never justifies dropping a device, and the runner holds
the build to the extract's own number: fewer nodes than promised with no
finding recording the omission becomes one more retry round; a shortfall
that persists is written into the verdict instead of hidden.

Test 11 was then re-run with the complete program — same image, same
`gemini-3.6-flash` (the first run's log survives as `run-log.run1.json`; the
grid-only middle run's log was overwritten — see *Artifact provenance*
below):

| | First run | Grid only | Grid + no-drop rule + count gate |
|---|---|---|---|
| Extract promised | 40 | 40 | 40 |
| Nodes placed | 40 | **32, silently** | **40** |
| Canvas | 1280×930 (default) | 1280×1600 | **1280×1800, model-grown** |
| Geometry warnings | 7 | 0 | **0** |
| Polish repairs needed | — | 0 | **0 — legal by construction** |
| Round trips | 1 | 1 | 1 |

The polish pass and the count gate both stood guard on the final run and
had nothing to do — which is the point. The construction recipe made the
model's job easy enough to do correctly on the first try; the guards exist
for the day it is not.

### The gate grows teeth · 2026-08-17

The same review re-examined the inventory gate itself and found it right for
the wrong reasons. test16's document places 10 nodes against an extract that
counted 41 — and a genuine, numbered confession sits in its findings ("10x
Roku units, 12x wall plates, 8x security cameras, and 5x access points have
been aggregated into single functional nodes") — but the gate's keyword list
did not know the word "aggregated". The run passed only because an unrelated
finding, "Firmware & Serial Numbers Omitted", happened to contain "omitted".
Separately, four extracts in the second batch (12, 14, 15, 18) stated their
count in phrasings the gate's single regex could not parse, so the gate
silently sat out those runs entirely, and nothing recorded that it had.

Three changes shipped, each pinned by a behaviour test:

- **The extraction prompt demands the count in one exact form** — "Total
  device count: 12" as the reply's first line — and the gate's parser now
  accepts every phrasing the 24-run record actually contains as fallback.
- **A confession is now a single finding that names devices, uses a
  condensation word, and states a number** — "aggregated" included. An
  unrelated finding with "omitted" in its title no longer counts.
- **The gate reports itself.** Every round records the gate outcome — met,
  confessed, shortfall, or no-count-found — in the run log, so a gate that
  could not engage is visible instead of indistinguishable from one that
  passed. The build request likewise now demands that a confession state
  both numbers: how many the inventory counted, how many the drawing shows.

Applied retroactively to all eighteen runs with a preserved transcript, the
hardened gate reads: **sixteen met their stated count exactly or exceeded
it, and two — test16 (41 counted, 10 drawn) and test20 (38 counted, 24
drawn) — are honestly-confessed consolidations**, recognised now on the
right evidence. Zero unparseable counts, zero unconfessed shortfalls. The
count leg of the open fidelity audit is machine-answered for every run that
kept its transcript; what remains by-eye is whether the *connections and
labels* match the source.

### Artifact provenance — what each run folder actually holds · 2026-08-17

A review of the folders against these tables found that later work overwrote
some primary artifacts. Nothing here changes a verdict; it changes where the
evidence for each verdict lives — and two runs' logs are gone for good.
Recorded plainly:

- **Folders 3–9: `run-log.run1.json` is the first-matrix run** each table row
  above describes (all `gemini-3.6-flash`, evening of 2026-08-15 Pacific).
  Checked log-against-table on 2026-08-17: every row matches.
- **The same evening, after the count-first fix shipped, a regeneration pass
  was attempted over all seven.** Tests 3 and 4 regenerated clean on
  3.6-flash; test 5 regenerated on `gemini-3.7-flash` in 2 round trips (its
  round 1 carried 12 stops and 8 warnings, all cleared in round 2). Tests
  6–9 never regenerated — the evening's quota wall arrived first, and their
  primary `run-log.json` records the refusals (503 ×3, 429 ×1) rather than a
  run. Their saved documents remain first-run vintage, which the fidelity
  audit above had already graded HIGH/GOOD, so they stand.
- **Consequence:** in folders 3–5 the primary `run-log.json` describes a
  later run than the table row; in 6–9 it describes an error. No transcript
  exists for 6–9 at all — the transcript-keeping runner postdates their
  successful runs.
- **The test-3 count-fix re-run's own log is gone.** The re-run table above
  (1 round trip, 6 boundary warnings) was recorded from the session that ran
  it, but its log was overwritten about 90 minutes later by one more
  regeneration during the legend-contract work — the run the folder's
  `run-log.json` now shows: 2 round trips, two rack-face stops in round 1
  (the retry loop's first live firing), 0 warnings, all 33 devices held.
  That third run is what produced the saved document.
- **test11's middle run is likewise gone.** The three-run arc in the
  geometry-program section is right, but only the first run (7 warnings) and
  the final run (clean 40/40) have logs; the "grid only, 32 nodes silently
  dropped" middle run — the one that motivated the no-drop rule — survives
  only in this document's description.
- **Folders 1–2 are hand-run browser sessions, not harness runs.** They
  predate the harness and hold only the source image and the saved design.
  `test1` (our-net-001) is live result 1's artifact; `test2` (honi-net-001)
  is a second hand session — also a clean one-trip save, and the session
  whose workflow findings produced the helper's guided-stepper round.
  Neither has a log or transcript, and neither is counted in the
  twenty-two automated runs.

The lesson: the runner must version every run's log and transcript instead
of overwriting the last one. An overwrite cost this record two artifacts it
can never get back. As of 2026-08-17 it does exactly that — a new run moves
the previous log and transcript to the next free `.runN` name before
writing, and a behaviour test holds it there.

### The nine-run editing matrix — run automated · 2026-08-17

The driver shipped the same day: it plays the nine runs through the
helper's real part machinery — each run a fresh conversation, the design
carrying forward from save to save, the scoped Copy-problems loop on
retries — and writes its artifacts to
`tests/free-model-runs/editing-matrix/` (run-log, word-for-word transcript,
and the final design, `NET-HQ-001.after-matrix.edit.html`):

    node tools/run-free-model-tests.js --tests-dir tests/free-model-runs --edit-matrix

Add `--smoke` for the no-quota dry run. The prompt sizes alone confirm the
part economics: the eight part prompts run 7,400–25,500 characters where
the Everything prompt runs 45,000.

**Session:** 2026-08-17 · **Model:** `gemini-3.6-flash` (the id the API
reported back) · **Interface:** Google AI free-tier API via the driver
above · **Operator:** automated harness

| # | Part | Round trips | Repaired? | Cut off? | In scope? | Checks fired | Clean save? | Notes |
|---|---|---|---|---|---|---|---|---|
| 1 | Devices | 1 | no | no | yes | none | yes | Semantic no-op — see below |
| 2 | Connections | 1 | no | no | yes | none | yes | Mutated, not added — see below |
| 3 | Areas | 1 | no | no | yes | 1 warning | yes | Grew oob-mgmt 30 px, but past the canvas edge |
| 4 | Whole diagram | 1 | no | no | yes | 1 (inherited) | yes | Moved hq-srv-01 77 px toward the ESX hosts; core links already existed |
| 5 | Rack | 1 | no | no | yes | 1 (inherited) | yes | Both WAN routers wear `cisco-isr-router-1u`; face-height rule held |
| 6 | Gaps | 1 | no | no | yes | 1 (inherited) | yes | Finding pinned to hq-srv-01, exactly as asked |
| 7 | Notes & tables | 1 | no | no | yes | 1 (inherited) | yes | One note appended word-for-word; nothing else touched |
| 8 | Cover details | 1 | no | no | yes | 1 (inherited) | yes | Revision v1.1 ✓; "today" became 2025-05-18 — the model's own clock |
| 9 | Everything | 1 | no | no | yes | 1 (inherited) | yes | 40,908 chars back, no truncation; hq-wlc-02 added, HA-paired, wired to both cores |

**Verdict: PASS — nine for nine in one round trip each, zero repairs, zero
truncation.** Runs 1–8 all land inside the two-trip bar, and diagnostic
run 9 returned the whole ~41,000-character design cleanly — the output-length
cliff the protocol was braced for did not appear on this model.

**The semantic audit, because a mechanical PASS is not the whole truth.**
The checkers grade consistency; comparing the artifacts against the
requests by hand found what they cannot see:

- **Run 1 was a no-op.** The current NET-HQ-001 already ships with
  `hq-wlc-01` in the internal zone, so the model returned the node list
  unchanged — a defensible reading (it refused to add a duplicate), but the
  run no longer tests device addition. Run 9 rescued the theme: asked for a
  second WLC, it added `hq-wlc-02`, HA-paired it and wired it to both cores.
- **Run 2 mutated instead of adding.** Asked to "connect hq-wan-01 to
  hq-wan-02 with a backup link", the model changed the existing l3
  interconnect's kind to `backup` — the primary link is gone. Internally
  consistent, invisible to every checker, semantically a loss.
- **Run 4's connect-half was already true** (the starter dual-homes
  hq-srv-01 to both cores), so only the move happened — and only 77 px of
  it.

**Failures worth fixing — each a work item:**

1. **Protocol drift.** Runs 1, 2 and 4 were written against an earlier
   NET-HQ-001 and are now partly pre-satisfied. The requests need re-aiming
   at the current starter so they test addition and multi-part editing
   again (e.g. a device the starter genuinely lacks, a link that genuinely
   does not exist).
2. **"Add a link" must not repurpose one.** Candidate prompt rule for the
   connections part: never remove or re-kind an existing link unless the
   request says to.
3. **The model has no clock.** "Set the date to today" produced 2025-05-18.
   The helper knows the real date and should inject it into the
   cover-details request text.
4. **Area growth ignored the canvas.** Run 3 grew the zone past the page
   edge instead of raising `canvas.height` — the permission exists in the
   grid text for placing parts; the zones part needs the same sentence
   about the canvas following the areas.

## 2026-08-19 — the guardrails validation round

Two questions, answered with the archive and two live probes.

**Does the de-anchored count line still work?** The extraction prompt's count
line became `"Total device count: <N>"` with an explicit never-copy rule,
after 19 archived extracts proved the old literal example was never echoed
(counts 6–41, none said 12). Two live re-runs on `gemini-3.6-flash` with the
new form: test18 stated **6** (gate: promised 6 = placed 6), test6 stated
**12** — and with no example number left in the prompt, a genuine 12 is now
unambiguous. Both runs: clean save in **one round trip**, packaged 29/29,
prior artifacts rotated to `.run1`. No regression.

**Is the engineering review pointing at real things?** Ground-truth audit:
for six archived tests (6, 10, 13, 14, 15, 18), every review observation was
judged against the *source image*. Eleven observations: **one AI-MISS, ten
TRUE-GAP, zero noise.**

- The AI-MISS is the reason the feature exists: test6's source image draws
  the firewall **inline** — Internet → firewall → router → switch → server —
  but the archived build placed it as a spur, leaving servers reachable
  without crossing it. The review's *exposed-service* observation caught a
  real extraction error a human had accepted. (The live re-run this round
  placed the firewall inline toward the internet on its own — and the review
  then flagged the *other* cloud it wired straight to a PC.)
- The ten TRUE-GAPs are the honest other half: images that genuinely draw no
  management story, a single core, an unjoined distribution pair, a raw
  facility-LAN edge — cases where **Record as a gap** is the right resolution,
  and notably test15, where even the source image draws its ASA firewalls
  off-path.

Rate so far: 11 of 11 observations useful, none inapplicable — consistent
with the calibration bar (zero observations on the eleven shipped starters).

## 2026-08-20 — the v0.6.0 full-corpus round (in progress)

The release round: every archived test re-run live on `gemini-3.6-flash`
against v0.6.0, each produced document archived beside the runner's normal
artifacts as `<slug>__v0.6.0.edit.html`, and each folder now also carries its
git-history vintages (`__v0.4.0`, and `__bb28853` for the two guardrails
probes) so a folder shows the app's evolution at a glance. Every finished
test was judged three ways: the runner's own record (gate, round trips,
warnings), the helper's review re-run over the saved document, and a
vision audit — an agent reading the *source image* against the document and
the observations.

**Vintage note.** Tests 18, 3, 4, 5, 6, 7, 8, 9 rode pristine v0.6.0
(tag 35a8301). The round's findings were then fixed forward (commits
3ecb727, b71525e, e3cc8ae below) and released as **v0.6.1**, so every
later test rides v0.6.1 — deliberately: the remaining runs double as the
fixes' live validation.

### The scoreboard so far

| test | verdict | RT | gate | review obs | vision audit |
|---|---|---|---|---|---|
| 18 | PASS | 1 | met 6=6 | 1 | 6/6 exact (two-panel image de-duplicated); unjoined-pair TRUE-GAP |
| 3 | PASS | 1 | met 31=31 | 2 | both TRUE-GAP; extract merged 2 appliance pairs the image draws separate |
| 4 | PASS | 1 | met 19=19 | 1 | TRUE-GAP; extract normalised a drawn PC daisy-chain to a star, moved the printer behind the scanner |
| 5 | PASS | 1 | met 20→23 | 1 | TRUE-GAP; extract padded 2 drawn server groups to 3, dropped the 4th SAN array; image's drawn router interconnect omitted |
| 6 | PASS | 1 | met 12→14 | 3 | 14/14 exact, firewall inline, perimeter drawn — the round's best evolution arc (v0.4.0 no perimeter → bb28853 upside-down → today near-perfect) |
| 7 | PASS | 1+warn | met 21=21 | 4 | right total, wrong composition (SmartShunts + bus bars dropped, clouds invented); the review's questions pointed exactly at the inventions |
| 8 | PASS | 1 | met 15=15 | 0→1 | 15/15 exact; review falsely quiet — wall jack wearing the network-management icon (fixed, see below) |
| 9 | PASS | 1 | met 8→9 | 1 | 9/9 exact, hardware names read out of the stock photos; TRUE-GAP |
| 10 | ERROR | — | — | — | daily quota exhausted mid-build; honest ERROR rotated in, re-run pending |

Eight for eight on the round-trip record: every completed test saved clean
in **one round trip**, zero truncation, zero checker stops, 29/29 packaged.
The engine's only narrated intervention all round: one 10px column snap
(test3). The version-suffixed documents confirm engine stability — old and
new docs differ in model choices (ids, zone names, wiring variance), never
in renderer behaviour.

### What the vision audits established

Review observations across the eight audited tests: **zero noise**, again.
Nine TRUE-GAPs, and a new category this round: on test7 the review's
undefended-edge and exposed-service questions pointed at content the model
had *invented* (cloud shapes the power diagram never draws) — the
walkthrough's "look at the picture again" would have removed the invention.
An observation can catch an extraction miss, name an honest absence, or
catch an invention; all three happened this round.

The round's real finding is one level down, and it has a name:
**the model normalises.** Where the old runs were faithful, the new runs
preferred pattern over evidence —

- test3 merged separately-drawn appliances onto shared lines (Barracuda +
  BlackBerry became one `srv-06`; the image draws two boxes; the legend
  itself disagrees with the drawing, 8 towers vs counts summing 9);
- test4 redrew a drawn PC daisy-chain as the conventional star and moved
  the printer behind the scanner (the old run had both right — pure
  run-to-run vision variance);
- test5 padded two drawn server groups to a uniform three, dropped the
  fourth SAN array, and turned the remote storage array into a third
  "server";
- test7 dropped the two bus bars the image literally draws (the segment
  grammar exists for exactly that shape) and invented clouds.

None of this is catchable after the fact — a normalised extraction is
internally consistent, and the count gate cannot see merges baked into the
stated count. The only lever the app owns is teaching, and the count-first
lesson of 2026-08-15 (which fixed repetition-condensation for good — the
14-IDF test3 extract has been exact ever since) says teaching works.

### The fixes the round earned (all shipped, suite 37 + 176)

- **3ecb727** — exposed-service walks each cloud separately and names the
  entry whose walk reached the servers ("from Access Network", not a
  generic "from the internet" — test6's audit caveat). And no-management's
  icon leg refuses passive plant: test8's run had given the unlabeled
  wall-jack rectangle the `network-management` icon, silencing the rule.
  Calibration before/after: starters zero both sides; the only fire-rate
  change is test8's honest +1 (corpus 35 → 36).
- **b71525e** — the extraction prompt teaches that the diagram outranks
  convention: copy repetition exactly, never add an undrawn device, never
  merge labelled boxes, reconcile against a drawn legend line by line, and
  a cable's endpoints are facts. The count line now states that clouds
  count — test5's and test6's placed-over-promised gaps were exactly the
  clouds their extracts had excluded.
- **e3cc8ae** — the runner records `gate: "over"` when placed exceeds
  promised (padding used to hide inside "met") and stamps fresh builds
  with the browser save()'s own versionStamp — every harness artifact
  until today carried the template's stale change-record date.

### Still open in this round

Tests 10–17 and 19–24 plus the editing matrix await quota (a paced
prober is draining the free tier's drip; the midnight-PT reset restores
throughput). test1/test2 — the two pre-harness manual folders — now carry
authored logos so the harness can run them for the first time; their
historical hand-run documents stay untouched beside the new slugs. Design
question parked, not lost: the review's security vocabulary reads odd on
non-network diagrams (test7's fuses and battery banks); a domain
stand-down is speculative and waits for evidence.

### test10 — the first gemini-2.5-flash build, and what a weaker model teaches · 2026-08-20

3.7-flash burned its bucket in a 503 storm, so test10 became the round's
first `gemini-2.5-flash` build — a tier below anything tested before, riding
the fresh v0.6.1 prompts. The mechanics held: round 1 piled two segment bars
onto switches (two stops), the copy-problems loop fixed everything in round
2, clean save, zero truncation, 29/29 packaged.

What it drew is the surprise. The *weaker* model reached for the *richer*
grammar — four VLAN rails (the first fresh build ever to use segment bars
unprompted), 37 links, ten findings including an honest "No Management
Network Documented" (the review's management rule stood down on the
confession, exactly as designed) and a confession of the five written VLANs
its rails don't cover.

The vision audit then took most of the shine off, and the lesson is worth
the shine. The image draws **two** Sophos UTMs joined by an `eth3
HA/Cluster` interconnect; the archived 3.6-flash run extracted both, this
run merged them into one node named after the second box's callout — and
the review's *single-point* observation fired on precisely that node: the
round's **second AI-MISS caught by the review**. The image draws ~16
equipment icons; this run placed 21, inventing a server no image shows, a
third access point, and a device made out of the "ISP Circuit" link label —
straight through the new never-add-an-undrawn-device teaching. And the
VLAN rails render genuinely-written numbers as a shared-bus abstraction the
image never draws.

Two harness truths came out of the same run: segment bars counted as
placed devices (the "over" note read 25 vs 21 for four rails), so
`inventoryShortfall` now counts only real inventory; and the model-ladder
scripts learned to rotate away from a storming bucket instead of hammering
it.

Standing verdict on the model comparison so far: **richer grammar, weaker
fidelity.** Teaching moved 3.6-flash from condensation to exactness in one
round; 2.5-flash invents through the same teaching. The review caught the
merge; nothing yet catches an invention the model also counts — that
remains the extraction-fidelity frontier.

### The cross-vendor editing matrix — a hole found and closed in ninety minutes · 2026-08-20

The nine-run editing protocol went to a second vendor for the first time:
`gpt-5.4-mini` through the new OpenAI-protocol adapter. First pass: **nine
for nine in one round trip each**, zero truncation — and a document with one
section left. Weak models answer a scoped edit with only the key they
changed; the merge read every missing key as a deletion, the guard warned
exactly as designed, and the auto-save committed the loss seven sections at
a time. Gemini had never surfaced this in five matrix passes because it
echoes the whole sections object back. One vendor's habit was another
vendor's blind spot.

The contract changed the same hour (1c35f31): **a key the reply leaves out
is a key it left alone** — missing pieces are restored and the restoration
is named; removing a section for real belongs to the owner's section
chooser, and an explicitly emptied key is still an honest edit. The gutted
document stays in the folder as evidence
(`NET-HQ-001.after-matrix__gpt-5.4-mini-gutted.edit.html`). The re-run on
the fixed merge: matrix PASS again, and the final document carries **all
eight sections**, revision v1.1, both controllers, every edit intact
(`__gpt-5.4-mini`). The column-snap pass narrated five alignments in run 1;
run 9 took three round trips this time — the retry loop, not luck.

### test11 on gemini-2.5-flash — the geometry benchmark revisited

One round trip, zero stops, zero warnings, and **zero review
observations** — it drew an "Organizational Perimeter" zone unprompted
where the archived run had earned the perimeter-band question, gave the
egress pair real firewall icons, and extracted the image's dashed HA
heartbeat as an `ha` link. The vision audit re-counted the image at exactly
**40** (the validated by-hand number): this run's 48 pads the pattern the
model keeps showing — HQ PCs doubled 4→8, one extra mobile, one extra
server in each server area. Padding again, structure otherwise excellent.
