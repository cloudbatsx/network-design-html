# Free-model validation — protocol and results

**Status: fresh-build path validated live and across seven automated runs · nine-run editing matrix still pending.**

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

### Live results 2–8 — the automated fresh-build matrix · 2026-08-15

**Model:** `gemini-3.6-flash` (the id the API reported back for every call) ·
**Surface:** Google AI free-tier API, driven by `tools/run-free-model-tests.js` ·
**Operator:** automated harness, Sayed Haque supervising.

Seven fresh-build runs, each from a different organisation-supplied topology
image and logo, each in its own conversation. The harness reuses the helper's
real logic — the same prompts, the same repair chain, the same checkers, the
same byte-guarded save, the same packaging engine — so these runs test the
product, not a reimplementation. Per-test detail (every round trip, every
problem, token counts) is in each test folder's `run-log.json`. Rerun with:

    node tools/run-free-model-tests.js --tests-dir <folder> --tests 3-9

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

**Failures worth fixing:** none fired. The 9% overlap in run 4 is the only
candidate — if it recurs across future runs, the build prompt's spacing
guidance is the place to absorb it.

### The nine-run editing matrix

> Not yet run.

**Session:** _date_ · **Model:** _exact name as shown_ · **Interface:** _e.g.
gemini.google.com free tier_ · **Operator:** _name_

| # | Part | Round trips | Repaired? | Cut off? | In scope? | Checks fired | Clean save? | Notes |
|---|---|---|---|---|---|---|---|---|
| 1 | Devices | | | | | | | |
| 2 | Connections | | | | | | | |
| 3 | Areas | | | | | | | |
| 4 | Whole diagram | | | | | | | |
| 5 | Rack | | | | | | | |
| 6 | Gaps | | | | | | | |
| 7 | Notes & tables | | | | | | | |
| 8 | Cover details | | | | | | | |
| 9 | Everything | | | | | | | |

**Verdict:** _pending_

**Failures worth fixing:** _list anything the model did that the prompt,
checker or helper should absorb — each one becomes a work item._
