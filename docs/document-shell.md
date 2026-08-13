# The documentation shell

Every document produced from this repository uses one layout, so a reader who
has seen one has seen them all. The template implements the **CloudBats standard
documentation shell (v1)**; this file records what is fixed, what is yours to
change, and where this implementation deliberately differs from the original.

## Replace the branding — that part is yours

The mark in the top-left of the sidebar is **not** fixed. It is data:

```json
"brand": {
  "name": "Acme Networks",
  "label": "Network Engineering — Internal",
  "logoViewBox": "0 0 512 512",
  "logoFill": "#0F172A",
  "logoPath": "M64 64h384v384h-384z"
}
```

`logoPath` is plain SVG path data. Export your logo as SVG, copy the `d`
attribute of its path, set `logoViewBox` to match, and the whole document
carries your brand. Nothing else depends on it.

Keep it a **path**, not an image file. Raster payloads break the editable file's
guarantee that it works offline with no adjacent folders, and the repository
validator rejects them.

## Fixed — changing these breaks the family

**Two-layer stylesheet, in this order.** Layer 1 is print/legacy (`@page`
Letter, pt units, literal hex) and defines every content primitive. Layer 2 is
the shell (`:root` vars, px, flex sidebar) and overrides Layer 1's typography
for screen. Layer 2's `@media print` hands control back to Layer 1. One file is
therefore both a screen document and a Letter PDF. **Merging the layers destroys
this.**

**Section spine — ids 0–5, same ids, same order, in every document:**

```text
overview · logical-topology · identity-addressing · physical-view
        · change-management · operations-observability
```

Labels may be abbreviated in the sidebar; the `id` may not change.

**Exactly two toggleable layers.** Not one, not three.

- **Slot A** is the *candour layer* — the document's own weak evidence, made
  hideable. Always section 6. Its id, label and wording come from
  `sections.findings`.
- **Slot B** is the equipment exhibit. Always `id="equipment-exhibit"`, always
  last, always lettered **A** (appendix), never numbered.

### The gap overlay

Slot A is not only a list. A finding that carries `at` (a device id) or `atZone`
(an area id) also draws a numbered marker onto the topology, so a reader can
point at the drawing and read the finding. Zone findings additionally get a
dashed outline.

One control governs all of it — the section, the markers, and any identity row
marked `"layer": "gap"` — because they all carry `.gap-layer` and the body
class `show-gaps` is the single switch.

Marker numbers are **derived from the order of `findings.items`**, never
authored. The earlier hand-built documents placed markers at absolute SVG
coordinates with hand-typed numbers; both drift silently the moment the layout
or the list changes. Anchoring to ids removes that whole class of error.

**Four header badges, this order, always:** domain (constant `Network &
Security`) · `{docClass} · {subject}` · `{revision} · {date}` · epistemic status.

**Print force-reveal.** `@media print` un-hides both toggled-off layers. The PDF
is always the complete document — the toggle is a presentation control, not a
redaction control.

**Footer grammar**, middot-separated, in order: author · original date · edition
· version and what changed · where the working detail lives · **epistemic
caveat** · **redaction statement**. The last two are mandatory.

**Zero dependencies.** No framework, no build step, no CDN, no external images.

## Two deliberate deviations from the original shell

Both exist because this repository makes a stronger promise than the shell did —
that the file works with no network at all — and because
[`gemini-editing-rules.md`](gemini-editing-rules.md) forbids CDNs outright.

| Original | Here | Why |
|---|---|---|
| Google Fonts `<link>` + `preconnect` for Sora / Inter / JetBrains Mono | The same font **stack**, no network link | A font service is a runtime dependency. The document is typographically identical wherever those fonts are installed and degrades to `system-ui` elsewhere. |
| Diagrams hand-authored inline SVG, never JS-rendered, from an `ic-*` symbol library | Diagrams rendered from the data block into the same `.figwrap → svg → .caption → .legend` triple, using the repository's 19 `nd-*` symbols | Data-driven diagrams are the point of this repository: a topology change is a reviewable data diff, not hand-edited geometry. The output is the same shape, and the `<defs>` symbol library is the same architecture. Adding `ic-*` symbols would also break the validator, which pins exactly 19. |

## The rule underneath the rules

Every fixed parameter serves one idea: **the reader must always be able to tell
what is known from what is assumed.**

That is why badge 4 is epistemic status, why captions must name what is assumed,
why Slot A exists at all, why the provenance declaration is mandatory in section
0, why print force-reveals the hidden layers, and why the footer must end in a
caveat and a redaction statement.

A document that renders perfectly but hides its own uncertainty is off-template.
