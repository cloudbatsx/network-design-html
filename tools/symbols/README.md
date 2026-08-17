# Inline SVG symbol library

This directory is the canonical maintainer source for the clean vector symbols
embedded in [`../../starters/network-design-template.edit.html`](../../starters/network-design-template.edit.html).
The editable HTML carries its own synchronized copy and does not load this file
at runtime.

## Files

- `network-symbols.svg` contains 19 reusable `<symbol>` definitions.
- `symbol-map.json` maps 20 model-friendly semantic keys to a vector symbol ID
  and the exact official Cisco asset identifier understood by the packager.

The `pc` and `workstation` semantic keys intentionally share one vector symbol.

The design rationale behind the library — why inline vector symbols beat the
alternatives that were tried — is retained in
[`../../docs/vector-symbol-study.md`](../../docs/vector-symbol-study.md).

## Rendering contract

The same node data works in both modes:

```json
{ "id": "access-sw-01", "icon": "access-switch" }
```

- Editable mode renders `#nd-access-switch` from the inline sprite.
- Portable mode resolves the same key to `asset:cisco/workgroup switch.jpg`.
- Models select semantic keys; they should not redraw protected path data.

When a symbol changes, update the canonical sprite, the embedded copy in the
template, and the source showcase together, then run `npm test`.

## Licence

Original work, **MIT licensed** with the rest of the project — see
[`../../LICENSE`](../../LICENSE). Use them here, in your own diagrams, or in an
unrelated project; restyle or extend them freely. No vendor artwork is involved
and no attribution beyond the MIT notice is required.

## Using them outside this project

The sprite is an ordinary SVG. Inline it once, then reference symbols by id:

```html
<svg width="0" height="0" style="position:absolute"><!-- paste sprite here --></svg>
<svg width="120" height="88"><use href="#nd-router"></use></svg>
```

Each `<symbol>` carries its own `viewBox` — `nd-router` is 120 x 88, `nd-cloud`
150 x 88, `nd-firewall` 86 x 108 — so it scales to whatever size you give the
outer `<svg>` and needs no viewBox of your own.

Inline rather than linking to the file: a cross-file `<use href="sprite.svg#id">`
is blocked when the page is opened straight from disk, which is exactly how these
documents are meant to be opened. Inlining is also why one `.edit.html` needs no
network at all.

Three CSS custom properties retheme the whole set without touching geometry:

```css
:root{ --symbol-main:#0076a8; --symbol-dark:#005779; --symbol-light:#51bde6 }
```
