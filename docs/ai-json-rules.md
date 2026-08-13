# AI editing rules — JSON only

Copy everything between the two rulers into your AI chat, fill in the two
placeholders at the bottom, and send it.

This is the prompt for **changing a diagram**. It asks the AI for the data block
only — never for the HTML file. See [`packaging rules`](gemini-editing-rules.md)
instead if you are a maintainer changing the template itself.

> Keep the four lists below in sync with the template. They are copied from
> `ICONS` and `RACK_ASSETS` in `templates/network-design-template.edit.html` and
> from the `.link.*` / `.zone.*` rules in its stylesheet. Nothing checks this
> automatically — if those change, change this file too.

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

**Rack `asset`** — `c9500`, `c9300`, `fpr4215`, `r750`, `ups`, `generic`
This is a short hardware code, never a filename. Only those five models have
real front and rear artwork. **For any other hardware use `generic`** — the
device still appears in both rack views at the right height, drawn as a plain
labelled face. Never invent a code.

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
    "docClass": "", "subject": "",
    "evidence": { "text": "", "color": "red" },
    "brand": { "name": "", "label": "", "logoViewBox": "", "logoFill": "", "logoPath": "" },
    "layers": { "findings": true, "equipment": false },
    "footer": { "author": "", "originalDate": "", "edition": "", "changed": "", "detail": "", "caveat": "", "redaction": "" }
  },
  "topology": {
    "canvas": { "width": 1280, "height": 930 },
    "zones": [ { "id": "", "label": "", "kind": "internal", "x": 0, "y": 0, "width": 0, "height": 0 } ],
    "nodes": [ { "id": "", "label": "", "role": "", "icon": "router", "x": 0, "y": 0, "address": "", "notes": "" } ],
    "links": [ { "from": "", "to": "", "kind": "l3", "label": "", "labelX": 0, "labelY": 0 } ]
  },
  "rack": {
    "id": "", "location": "", "units": 42,
    "frontAisle": "cold aisle", "rearAisle": "hot aisle",
    "reserved": [ { "position": 1, "height": 1, "label": "" } ],
    "devices": [ { "id": "", "model": "", "role": "", "position": 1, "height": 1, "asset": "c9300" } ]
  },
  "sections": {
    "overview":   { "heading": "", "notes": [], "provenance": [] },
    "logical":    { "heading": "", "notes": [], "caption": "", "legend": "" },
    "identity":   { "heading": "", "notes": [], "columns": [], "rows": [] },
    "physical":   { "heading": "", "notes": [], "caption": "", "legend": "" },
    "change":     { "heading": "", "notes": [] },
    "operations": { "heading": "", "notes": [] },
    "findings":   { "id": "key-gaps", "label": "", "noun": "", "heading": "", "flavour": "gaps", "items": [ { "title": "", "detail": "" } ] },
    "equipment":  { "cards": [ { "model": "", "u": "", "why": "", "asset": "c9300" } ], "costs": [ { "role": "", "model": "", "qty": 1, "unit": 0 } ] }
  }
}
```

A **note** is either a plain string or `{ "lead": "bold part", "text": "rest" }`.

An **identity row** is either a list of cells, or
`{ "cells": [], "layer": "gap" }`. Rows marked `"layer": "gap"` are assumptions —
they hide and reveal with the Key gaps control, so mark anything unverified.

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

Fields you may see but must never add yourself: `iconAsset` on a node, `via` on
a link. If one is already there, copy it through unchanged.

`label`, `labelX`, and `labelY` on a link are optional. If a link already has
them, keep them exactly as they are. Do not add `labelX`/`labelY` to a new link
— leave them out and the label positions itself.

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
