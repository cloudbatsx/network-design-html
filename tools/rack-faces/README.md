# Rack faceplate library

Front and rear faces for the rack elevation, as inline SVG. This is the vector
counterpart to the photographic PNGs in [`../assets/rack-assets/`](../assets/rack-assets/):
same job, no download, and it works in editable mode where the PNGs do not.

## Files

- `rack-face-core.js` — **the source.** Every faceplate is drawn here. This is
  the only file to edit.
- `rack-faces.svg` — generated sprite, one `<symbol>` per face and view, for use
  outside this project.
- `rack-face-map.json` — generated index: 26 semantic keys, each with its family,
  role, height in rack units, and symbol ids.

After editing the core, rebuild everything:

```bash
node tools/build-rack-faces.js
```

That regenerates the sprite and the map, rewrites
[`rack-face-preview.html`](rack-face-preview.html), and
re-inlines the core into every document that draws a rack. Then run `npm test` —
the validator checks that no document has drifted from the core, that every key
is documented in the AI prompt at the right unit height, and that the sprite has
a front and a rear for each one.

Check the preview page's second row for each device, not the first. A faceplate
that reads beautifully at full width can still be mush at 18px per U.

## Why a generator and not just the sprite

Documents inline `rack-face-core.js` and call `faceMarkup()` at render time.
They do **not** embed the sprite. A document has to carry the whole catalogue —
the data block must be able to name any device without a download — and the
expanded sprite is over 400 KB against the generator's 39 KB. Same picture,
a tenth of the weight.

## Geometry

Native size is **760 × 70 per rack unit**, which is EIA-310 exactly: 19 inches
wide, 1.75 inches per U. That works out to 40px per inch, so every port is sized
from its real dimension — an RJ45 opening is 18 × 21, an SFP cage 22 wide, a
QSFP cage 29. The width difference between SFP and QSFP is the only thing that
tells 10G from 100G at a glance, so it is drawn to scale rather than eyeballed.

Every symbol is `preserveAspectRatio="none"`. A rack elevation squeezes a 1U
face into roughly 346 × 18 CSS pixels — about 45% horizontally and 26%
vertically — so the artwork is stretched, hard, by design.

**Nothing carries text.** A glyph stretched by those factors is unreadable, so
device names stay in the document data and are drawn by the page over the
artwork, where they render at true proportion.

## Two families

`generic` is house artwork drawn to a role, not to a product — 18 of them, and
the right default for anything whose vendor you have not decided yet.

The vendor-shaped entries reproduce **port layout and chassis proportion**,
because that is what actually makes a model recognisable in an elevation: rear
uplink modules, stacking connectors, an SFP28 bank where the RJ45s would be.
They carry no logo, no wordmark, and no vendor colour scheme, and they are named
by family and role rather than by model number. `cisco-nexus-48sfp-1u` is a
48-port SFP28 data-centre switch drawn in that family's idiom — it is not a
drawing of any specific product.

## Rendering contract

A rack slot is drawn three ways, in falling order of fidelity:

```json
{ "id": "core-sw-01", "asset": "cisco-nexus-48sfp-1u", "position": 38, "height": 1 }
```

1. **Official photography**, once the document has been packaged and the key
   names one of the five models in [`../assets/rack-assets/`](../assets/rack-assets/).
2. **A drawn faceplate**, whenever the key is in this library — which is the
   normal case, and needs no packaging step.
3. **A labelled placeholder**, for `generic` and for anything unrecognised.

The five official keys each declare a `vector` alias in the template's
`RACK_ASSETS`, so a document written before this library existed draws real
faceplates too. The alias is the nearest face, not a portrait of the model.

An alias may be keyed by unit height, because one model can be scheduled at more
than one height across a document set and no single face suits both:

```js
vector:{1:"generic-firewall-1u",3:"generic-security-appliance-3u"}
```

A height with no entry falls back to the labelled placeholder — better a blank
than a 3U chassis crushed into 1U. The validator checks that each key agrees with
the height of the face it names.

`height` must match the face's unit height, and the document reports it as a
data error when it does not — a 2U faceplate squeezed into a 1U slot is a
drawing that disagrees with its own schedule. Aliases are exempt: an
approximation is stretched to fit rather than argued with.

Models select semantic keys; they should not redraw geometry.

## Licence

Original work, **MIT licensed** with the rest of the project — see
[`../LICENSE`](../LICENSE). No vendor artwork is involved: these are drawn from
published dimensions and port counts, not traced from photographs or vendor
vector files. Restyle or extend them freely.

## Using them outside this project

The sprite is an ordinary SVG. Inline it once, then reference symbols by id:

```html
<svg width="0" height="0" style="position:absolute"><!-- paste sprite here --></svg>
<svg width="346" height="18" preserveAspectRatio="none" viewBox="0 0 760 70">
  <use href="#rf-generic-switch-48p-1u-front"></use>
</svg>
```

Inline rather than linking to the file: a cross-file `<use href="sprite.svg#id">`
is blocked when the page is opened straight from disk, which is exactly how
these documents are meant to be opened.

Four CSS custom properties retheme the set without touching geometry:

```css
:root{ --rf-ear:#78848c; --rf-body:#c2ccd2; --rf-metal:#3d454c; --rf-hole:#12171b }
```
