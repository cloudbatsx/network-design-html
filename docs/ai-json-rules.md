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

**Rack `asset`** — `c9500`, `c9300`, `fpr4215`, `r750`, `ups`
This is a short hardware code, never a filename. An unlisted code deletes the
device from both rack views.

## Shape

Keep every field that is already present. Do not rename fields and do not
invent new ones.

```json
{
  "document": { "title": "", "subtitle": "", "drawing": "", "revision": "", "status": "", "date": "" },
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
  }
}
```

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
