# AI editing rules — JSON only

Copy everything between the two rulers into your AI chat, fill in the two
placeholders at the bottom, and send it.

This is the prompt for **changing a diagram**. It asks the AI for the data block
only — never for the HTML file. See [`packaging rules`](template-authoring-rules.md)
instead if you are a maintainer changing the template itself.

It applies to the template and **all ten starters** — NET-BR-001, NET-ENT-001,
NET-ENT-002, NET-FAB-001, NET-HQ-001, NET-HQ-002, NET-LAB-002, NET-LAB-003,
NET-OT-001, NET-RH-001. Every starter is a coordinate-engine document and every
part of it is AI-editable, drawings included. (The four former engineering-sheet
kits were regenerated through the engine; a sheet-edition copy from an old
download is refused by `edit-with-ai.html` — re-download the current file.)

> Keep the lists below in sync with the template. They are copied from `ICONS`
> and `RACK_ASSETS` in `starters/network-design-template.edit.html` and from the
> `.link.*` / `.zone.*` rules in its stylesheet. Only the drawn-faceplate table is
> checked automatically, against `tools/rack-faces/rack-face-map.json` — if the others
> change, change this file too.

---

Reply with ONE JSON object and nothing else. The first character of your reply
must be `{` and the last character must be `}`. No ``` fences. No explanation
before or after. No comments inside the JSON.

You are supplying the data behind a diagram that is already built. You never
write HTML, CSS, JavaScript, or SVG.

## Closed lists — never invent a value

**`icon`** — one of exactly these 20:

`cloud`, `router`, `firewall`, `core-switch`, `access-switch`, `access-point`,
`server`, `pc`, `workstation`, `wlan-controller`, `vpn-headend`, `dc-switch`,
`ip-phone`, `laptop`, `printer`, `database`, `storage-array`,
`network-management`, `branch-office`, `wireless-router`

If the device you need is not on the list, pick the closest one. `switch`,
`l3-switch`, `ap`, `fw`, and `nas` do not exist and will render a red error box.

**Link `kind`** — `l3`, `aggregate`, `ha`, `access`, `backup`
An unlisted kind draws a completely invisible line.

**Zone `kind`** — `external`, `perimeter`, `internal`, `other`
An unlisted kind draws a solid black rectangle over your diagram.

**Rack `asset`** — a short hardware code, never a filename. Never invent one.
Pick the entry whose **`U` matches the device's `height`** and whose shape is
closest to the real hardware. Anything not on this list must be `generic`, which
still appears in both rack views at the right height as a plain labelled face.

*Official front and rear photography — use these only for that exact model:*
`c9500` `c9300` `fpr4215` `r750` `ups`

*Drawn faceplates, always available — no download, no packaging step:*

| Code | U | What it draws |
|---|---|---|
| `generic-switch-48p-1u` | 1 | 48 copper ports, 4 SFP+ uplinks |
| `generic-switch-24p-1u` | 1 | 24 copper ports, 4 SFP+ uplinks |
| `generic-router-1u` | 1 | small port set plus two module slots |
| `generic-firewall-1u` | 1 | 8 copper, 8 SFP, console and USB |
| `generic-security-appliance-3u` | 3 | chassis firewall: status display, module bays |
| `generic-wlan-controller-1u` | 1 | status display and 8 SFP |
| `generic-chassis-switch-4u` | 4 | fan tray, two supervisors, three line cards |
| `generic-server-1u` | 1 | 10 drive bays and a control panel |
| `generic-server-2u` | 2 | 24 drive bays and a control panel |
| `generic-storage-array-2u` | 2 | 12 large drive bays, dual controllers |
| `generic-kvm-console-1u` | 1 | closed console drawer |
| `generic-patch-panel-24-1u` | 1 | 24 keystone ports |
| `generic-patch-panel-48-2u` | 2 | 48 keystone ports |
| `generic-fibre-panel-1u` | 1 | four fibre cassettes |
| `generic-blanking-panel-1u` | 1 | a blank filler panel |
| `generic-cable-manager-1u` | 1 | horizontal finger duct |
| `generic-pdu-1u` | 1 | 8 outlets and a breaker |
| `generic-ups-2u` | 2 | status display, outlets on the rear |
| `cisco-catalyst-48p-1u` | 1 | 48 copper, uplink module, rear stacking ports |
| `cisco-isr-router-1u` | 1 | fixed ports plus two module slots |
| `cisco-nexus-48sfp-1u` | 1 | 48 SFP28 and 6 QSFP28 |
| `juniper-ex-48p-1u` | 1 | 48 copper, uplinks on the **rear** |
| `juniper-srx-firewall-1u` | 1 | 16 copper and 4 SFP |
| `palo-alto-ngfw-1u` | 1 | 16 copper, 4 SFP, 4 SFP28 |
| `fortinet-ngfw-1u` | 1 | front display, 16 copper, 12 optics |
| `arista-32qsfp-1u` | 1 | 32 QSFP28 spine ports |

The vendor-named faces draw that vendor's **layout**, not a specific product,
and carry no branding. Say `palo-alto-ngfw-1u` for a 1U Palo Alto box of roughly
that shape; do not go looking for a code for the exact model.

A face whose `U` does not match the device's `height` is reported as an error,
so do not use `generic-server-2u` to fill a 1U slot.

## Never touch these

- **`brand`** — the company logo and name. `logoPath` is SVG path data. Copy the
  whole `brand` object through **exactly as you found it**, character for
  character. It is the only place a person changes their own branding, and one
  altered character destroys the logo.
- **`evidence.color`** must be one of `purple`, `red`, `green`, `amber`, `teal`.

## Shape

Keep every field that is already present. Do not rename fields and do not
invent new ones.

```json
{
  "document": {
    "title": "", "subtitle": "", "drawing": "", "revision": "", "status": "", "date": "",
    "docClass": "", "subject": "", "author": "",
    "evidence": { "text": "", "color": "red" },
    "history": [ { "revision": "", "date": "", "author": "", "summary": "" } ],
    "brand": { "name": "", "label": "", "logoViewBox": "", "logoFill": "", "logoPath": "" },
    "layers": { "findings": true, "equipment": false },
    "omit": ["operations"],
    "footer": { "author": "", "originalDate": "", "edition": "", "changed": "", "detail": "", "caveat": "", "redaction": "" }
  },
  "topology": {
    "canvas": { "width": 1280, "height": 930 },
    "zones": [ { "id": "", "label": "", "kind": "internal", "x": 0, "y": 0, "width": 0, "height": 0 } ],
    "nodes": [ { "id": "", "label": "", "role": "", "icon": "router", "x": 0, "y": 0, "address": "", "notes": "", "labelSide": "below" } ],
    "links": [ { "from": "", "to": "", "kind": "l3", "label": "", "labelX": 0, "labelY": 0 } ]
  },
  "rack": {
    "applicable": true, "statement": "",
    "id": "", "location": "", "units": 42,
    "frontAisle": "cold aisle", "rearAisle": "hot aisle",
    "reserved": [ { "position": 1, "height": 1, "label": "" } ],
    "devices": [ { "id": "", "model": "", "role": "", "position": 1, "height": 1, "asset": "c9300" } ]
  },
  "sections": {
    "overview":   { "heading": "", "notes": [], "provenance": [], "tables": [] },
    "logical":    { "heading": "", "notes": [], "caption": "", "legend": "", "tables": [] },
    "identity":   { "heading": "", "notes": [], "columns": [], "rows": [], "tables": [] },
    "physical":   { "heading": "", "notes": [], "caption": "", "legend": "", "tables": [] },
    "change":     { "heading": "", "notes": [], "tables": [] },
    "operations": { "heading": "", "notes": [], "tables": [] },
    "findings":   { "id": "key-gaps", "label": "", "noun": "", "heading": "", "flavour": "gaps", "items": [ { "title": "", "detail": "" } ] },
    "equipment":  { "cards": [ { "model": "", "u": "", "why": "", "asset": "c9300" } ], "costs": [ { "role": "", "model": "", "qty": 1, "unit": 0 } ] }
  }
}
```

`document.omit` is the **section chooser**: a list of sections the document's
owner chose to leave out — the section, its sidebar entry and its trailing
rule disappear on screen and in print alike, and the visible sections renumber
so "Section 4" is always the fourth section a reader can see. Only `identity`,
`change`, `operations` and `equipment` may be omitted; the overview, the
figure and the gaps list never leave — they carry the status pill, the gap
pins and the candour doctrine. Any other key is a data error the document
reports loudly. This is the owner's presentation choice, set in the helper's
branding step — like `brand`, it is not yours to write.

`document.author` is the owner's too: set in the helper's branding step, shown
in the document-control panel, and signed onto every change-record row the
save stamp writes. Copy it through as you find it.

A **note** is either a plain string or `{ "lead": "bold part", "text": "rest" }`.

An **identity row** is either a list of cells, or
`{ "cells": [], "layer": "gap" }`. Rows marked `"layer": "gap"` are assumptions —
they hide and reveal with the Key gaps control, so mark anything unverified.

> **The helper teaches this grammar too.** The built-in prompt in
> `edit-with-ai.html` carries the drawing grammar below — caption sides,
> subnet bars, elbow lanes, section tables, the hostname anatomy, the
> deliberate no-rack statement — scoped to the part being edited, so a
> prompt about the rack never carries rules about cable lanes. All of it is optional: a design
> that uses none of it is still correct. The geometry entries state
> arithmetic rather than intent, for the reason the placement grid does —
> a model estimating pixels lands just over the line, and a model following
> stated numbers does not.

`labelSide` places a node's caption: `below` (default, name and role under the
symbol) or `left` / `right`, which side-anchor the caption beside the symbol
and additionally show the node's `address` line. Use the sides on paired
devices — left member captioned left, right member captioned right — so the
lane between them stays clear for links.

A node with `"shape": "segment"` is a **shared subnet bar** instead of a
symbol: a coloured rail at `x`,`y` spanning `width`, with an optional CSS
`color`. It has no `icon`. Links that end on a segment attach at the member's
own x, clamped into the bar span, and draw a junction circle — so more-than-
two-party segments read as one rail with taps, not a fan of lines. Caption
sits below the bar, or stacked off the right end with `"labelSide": "right"`.
Use a segment whenever more than two objects share one Layer 3 network.

A link with `"route": "elbow"` takes a right-angle path: down from its
source, across the `elbowAt` lane (the midpoint when unset), down to its
target. Give parallel paths in the same corridor **different `elbowAt`
lanes** so they never overlap; departures spread slightly toward travel on
their own. Elbow runs wear a white casing, so a crossing reads as a small
halo gap. Vertical drops, paired-device links and anything with authored
`via` waypoints should stay direct — `via` always wins over `route`.

A strictly logical design may set `"rack": { "applicable": false, "statement":
"why there is no rack" }` — the physical section then shows the statement
instead of an empty elevation. Never combine `"applicable": false` with a
`devices` list; the validator rejects the contradiction.

`document.history` is the revision history, **newest entry first** — the top
row must state the same revision as `document.revision`; the repository
validator holds the two to each other. Append a new first entry when the
revision changes; never rewrite old entries.

Nobody has to remember any of that: on every save of an edit the helper bumps
`document.revision` and prepends the row itself — dated by the machine's own
clock (a model has none), summarised from the person's request. An edit that
already moved the revision on purpose is respected; only its row's date is
corrected. A fresh build's first save re-dates the initial row instead of
bumping.

A section **table** is `{ "caption": "", "columns": [], "rows": [] }` inside a
section's `tables` list. Rows use the identity-row grammar, including
`{ "cells": [], "layer": "gap" }` for unverified rows. The `tables` list is
optional and empty by default; use it for schedules and registers that need
their own columns — a link schedule, a release audit, a risk register.

`sections.identity.naming` draws the **hostname-anatomy figure**: one worked
device name split into coloured monospace segments, each with a label and a
short slate note beneath it, plus an optional footnote.

```json
"naming": {
  "parts": [
    { "text": "sjc1", "label": "Site", "note": "San Jose campus 1" },
    { "text": "fw",   "label": "Role", "note": "edge firewall" },
    { "text": "01",   "label": "Unit", "note": "01 = first of the HA pair" }
  ],
  "separator": "-",
  "note": "an optional footnote under the figure"
}
```

The block is optional and off by default. It needs at least two usable parts
(each with `text` and `label`) or nothing is drawn — the helper warns at edit
time. `separator` defaults to `-`. Colours are engine-owned and cycle; the
data never picks them. Build the anatomy only from names actually on the
drawing — the parts joined by the separator must spell out a real device
name's pattern — and leave the block out if the names follow no visible
convention: a documented convention the drawing does not follow is the drawing
saying something untrue.

`findings.flavour` is `gaps` (what is missing), `patterns` (what worked), or
`gains` (what this buys you). Pick the one that matches the document.

## Pinning a gap onto the diagram

A finding can point at the thing it is about. A numbered marker then appears on the
topology, and the number is the finding's position in the list.

```json
{ "title": "No out-of-band path", "detail": "...", "at": "core-sw-01" }
{ "title": "Single uplink",       "detail": "...", "at": ["access-sw-01", "access-sw-02"] }
{ "title": "Unverified policy",   "detail": "...", "atZone": "perimeter" }
{ "title": "No change process",   "detail": "..." }
```

- `at` is a **device id**, or a list of them — one marker per device.
- `atZone` is an **area id** — draws a dashed outline round that area, plus a marker.
- Leave both out for a finding that is not about one place on the drawing.
- **Never write the marker number yourself.** It comes from the order of the list, so
  the picture and the list can never disagree.
- Every `at` must name a device in `topology.nodes`; every `atZone` must name an area
  in `topology.zones`. A marker pointing at something that does not exist is an error.

Anchor a finding only where it genuinely belongs. Roughly half anchored is a good
document; anchoring everything makes the drawing unreadable.

## The rule underneath the rules

**The reader must always be able to tell what is known from what is assumed.**

- `evidence.text` is an epistemic status, not decoration. Say what class of
  evidence the document rests on.
- Every caption must state what is **assumed** as well as what is drawn.
- `sections.findings.items` must never be empty. A document that renders
  perfectly but hides its own uncertainty is off-template. If you genuinely know
  of no gaps, say what has not been verified.
- `footer.caveat` and `footer.redaction` are mandatory. Never drop them.

Some fields are **hand-tuned drawing geometry**: `via` on a link (waypoints that
route a line around a device it would otherwise cut through), `labelX`/`labelY`
on a link, and `iconAsset` on a node.

**If one is already there, copy it through exactly. Never add a new one.**

A link label is drawn where there is room for it. The figure measures every
label box before drawing any: identical labels on the same pair of devices
collapse to one, and a box that would land on top of one already placed stands
down, because four stacked boxes on a meshed run say less than the bare lines
already do. The hover keeps every word either way, so nothing is lost. A label
carrying `labelX`/`labelY` is placed first and never stands down - a position
someone chose by hand is a decision, not a suggestion.

They exist because a straight line between two devices sometimes crosses a third.
Someone positioned those waypoints against a real render; removing one puts a
cable through the middle of a switch. Adding one blind usually makes it worse —
leave them out on new links and the drawing routes and labels itself.

## Numbers

- A node's `x`,`y` is the **centre** of a box that is **176 wide and 104 tall**.
- A zone's `x`,`y` is its **top-left** corner.
- The canvas is 1280 x 930. Keep nodes inside `x` 100–1180 and `y` 60–870.
- Two nodes overlap only when their `x` values are less than 176 apart **and**
  their `y` values are less than 104 apart. Both conditions must be true.
  Nodes far apart vertically may share an `x`.
- Rack units are numbered from the **bottom**. `position` is the lowest unit the
  device fills, so a device with `"position": 30, "height": 2` fills U30 **and**
  U31. Nothing else may use either unit.
- Every rack device must fit: `position` >= 1 and `position + height - 1` <=
  `units`.
- `position` and `height` must be numbers, never strings. `"height": "1"` breaks
  the rack.
- A device that appears both in the topology and in the rack uses the **same
  `id`** in both places. That link is what ties the two views together.

## Text

- Straight quotes only. Never use curly quotes (`"` `"` `'` `'`).
- Never use `<` or `>` inside any value.
- Every `id` must be unique, and every link's `from` and `to` must name a node
  `id` that exists.

## Current diagram

<<<CURRENT_JSON>>>

## What to change

<<<USER_REQUEST>>>

---

Reply with ONE JSON object and nothing else. First character `{`, last
character `}`. No ``` fences, no explanation, no comments.

---

## Changing one part only

Everything above asks for the whole data block. A free model has a limit on how
much it can write in one reply, and the largest starter is ~39,000 characters —
enough to be cut off part-way through, which is the most common failure there is.

The fix is to send one part and ask for that part back. `edit-with-ai.html` does
this for you from a dropdown; by hand, replace the *Current diagram* section with
just the part, nested exactly as it appears in the file:

```json
{ "topology": { "nodes": [ ... ] } }
```

| Part | What to send | Typical size |
|---|---|---|
| `topology.nodes` | devices | 2.7–12.8 KB |
| `topology.links` | connections | 1.0–7.3 KB |
| `topology.zones` | areas | 0.5–2.2 KB |
| `rack` | the equipment schedule | 1.7–5.1 KB |
| `sections.findings` | gaps and open items | 2.8–4.3 KB |
| `document` | title, branding, footer | small |

Then add this instruction, and paste the result back over the same part:

> Reply with `topology.nodes` only, nested exactly as given. Send no other part
> of the design.

**Ids are shared across parts.** A rack entry, a connection and a gap marker all
point at a device by `id`. So when you send one part, tell the model which ids
exist elsewhere — otherwise it renames a device in good faith and silently
detaches the rack entry and the connections that referred to it:

```text
FOR REFERENCE ONLY - do not include this in your reply.
Devices also listed in the rack: core-sw-01, acc-sw-01
Devices that connections depend on: core-sw-01, acc-sw-01
```

The helper tool builds that reference block for you, and it always checks the
**whole** design after merging your part back in — a part that is valid on its own
can still contradict the parts the model never saw.
