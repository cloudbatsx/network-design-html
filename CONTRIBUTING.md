# Contributing

Ordinary topology work should edit a copy of the template's clearly marked data,
not the protected SVG geometry or packaging blocks.

**Where a starter adds something its source document deliberately withheld, that
addition must appear as a pinned finding in section 6.** Starters ported from a
finished design routinely need detail the source refused to record — a rack
elevation, an address, a model. Adding it is fine; adding it silently is not,
because the reader cannot then tell the recorded from the invented. `NET-ENT-001`
draws a rack for a source that recorded no physical facts at all, and says so in
its own gap list. `NET-ENT-002` keeps the source's refusal instead. Both are
correct; only an unannounced addition is wrong.

Before proposing a repository change:

1. Keep the three v2 marker pairs, script IDs, schema values, empty editable
   vault, and empty editable capsule unchanged.
2. Use existing semantic icon keys whenever possible. For an unsupported Cisco
   image, use one complete literal `asset:cisco/<exact filename>.jpg` value.
3. Treat official filenames as case-sensitive and never assemble them at runtime.
4. If vector geometry changes, synchronize `symbols/network-symbols.svg`, the
   embedded template sprite, and `examples/vector-symbol-showcase.html`.
5. If a semantic mapping changes, synchronize `symbols/symbol-map.json` and the
   embedded `ICONS` map in the template.
6. Run `npm test`. With reviewed local assets available, also run
   `npm run build:packager` and `npm run verify:packager`.

Do not add downloaded icon packs, rack PNGs, generated packagers, portable HTML
outputs, or Base64 raster payloads to a change. Rights and provenance must be
reviewed before any new third-party visual asset is introduced.
