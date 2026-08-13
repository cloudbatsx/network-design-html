# Inline SVG symbol library

This directory is the canonical maintainer source for the clean vector symbols
embedded in [`../templates/network-design-template.edit.html`](../templates/network-design-template.edit.html).
The editable HTML carries its own synchronized copy and does not load this file
at runtime.

## Files

- `network-symbols.svg` contains 19 reusable `<symbol>` definitions.
- `symbol-map.json` maps 20 model-friendly semantic keys to a vector symbol ID
  and the exact official Cisco asset identifier understood by the packager.

The `pc` and `workstation` semantic keys intentionally share one vector symbol.

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

## Artwork status

These vectors are experimental interpretations informed by Cisco PMS 3015
reference silhouettes. They are not official Cisco-distributed SVG files. Read
[`../THIRD_PARTY_NOTICES.md`](../THIRD_PARTY_NOTICES.md) before publication or
redistribution.
