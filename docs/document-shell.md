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

**Section spine — same ids, same order, in every document:**

```text
overview · logical-topology · [Slot A] · identity-addressing
        · physical-view · change-management · operations-observability
```

Labels may be abbreviated in the sidebar; the `id` may not change.

The spine may be *shortened*, never reordered: `document.omit` lets the
owner leave out `identity`, `change`, `operations` and the `equipment`
appendix — the section, its sidebar entry and its trailing rule go together,
print follows the same choice by construction (the `body.omit-*` rules are
un-scoped, the `no-rack` recipe), and the visible sections renumber so the
numbering always matches the eye. The other three never leave: the overview
carries the status pill and the provenance, the figure carries the gap pins,
and Slot A is the candour doctrine. An unomittable key in `document.omit` is
a data error the document reports loudly.

**Exactly two toggleable layers.** Not one, not three.

- **Slot A** is the *candour layer* — the document's own weak evidence, made
  hideable. Always **section 2, directly after the logical topology**, so the
  numbered markers on the figure and the list they point to sit side by side —
  a reader should never scroll four sections to resolve a marker. Its id,
  label and wording come from `sections.findings`. (Until 2026-08-15 it sat
  last, as section 6; the overlay made adjacency worth more than convention.)
- **Slot B** is the equipment exhibit. Always `id="equipment-exhibit"`, always
  last, always lettered **A** (appendix), never numbered.

### The gap overlay

Slot A is not only a list. A finding that carries `at` (a device id) or `atZone`
(an area id) also draws a numbered marker onto the topology, so a reader can
point at the drawing and read the finding. Zone findings additionally get a
dashed outline.

One control governs the section and the markers — they carry `.gap-layer` and
the body class `show-gaps` is the single switch. Table rows marked
`"layer": "gap"` are **not** part of the switch: they stay visible always,
wearing a permanent `assumed` mark, because a document whose every identity
row is an assumption used to blank its own table the moment the layer was
hidden — and an invisible assumption is indistinguishable from a recorded
fact. (Until 2026-08-21 the rows hid with the layer; the mark replaced the
hiding.)

Marker numbers are **derived from the order of `findings.items`**, never
authored. The earlier hand-built documents placed markers at absolute SVG
coordinates with hand-typed numbers; both drift silently the moment the layout
or the list changes. Anchoring to ids removes that whole class of error.

**Four header badges, this order, always:** domain (constant `Network &
Security`) · `{docClass} · {subject}` · `{revision} · {date}` · epistemic status.

**Document control — one record, two views.** Section 0 renders the boxed
document-control panel (brand row, title, subtitle, nine labeled fields, caveat
line) from `document`: drawing, revision, date, subject, author, reviewedBy,
approvedBy, classification and status. Unset people fields render `Not
assigned` and an unset classification renders `Unclassified` — the panel never
invents a value, so a fresh build stays honest. The thin `.doc-control` strip
is the same record at print density: the shell hides it on screen, and its
`@media print` block swaps it back in for the boxed panel, so the two densities
can never disagree or appear together.

A document that declares scope shows it: when `document.coverage` or
`document.architecture` is set, both densities gain a **Declared scope** row —
the coverage packs by name, the architecture last (`Architecture — Spine-leaf
fabric`). Undeclared documents render no row at all; the panel still never
invents a value. The declaration is owner-set in the helper, and the
engineering review holds the drawing to it — the row is the promise the reader
can point at.

**Print follows the eye.** `@media print` prints exactly the layers the reader
has on screen. A printed copy is always a document someone actually looked at,
and the eye controls are how you decide what a deliverable contains.

The honesty doctrine does not rest on the printer. It rests on rules the reader
cannot switch off: `sections.findings.items` can never be empty, assumed rows
stay marked as assumed, the provenance declaration in section 0 is mandatory,
the footer must end in a caveat, and Slot A ships **on**. Someone who hides the
gap layer and prints has made a choice; someone who never recorded a gap has
made a document this shell refuses to render.

**Footer grammar**, middot-separated, in order: author · original date · edition
· version and what changed · where the working detail lives · **epistemic
caveat** · **redaction statement**. The last two are mandatory.

**Zero dependencies.** No framework, no build step, no CDN, no external images.

## Two deliberate deviations from the original shell

Both exist because this repository makes a stronger promise than the shell did —
that the file works with no network at all — and because
[`template-authoring-rules.md`](template-authoring-rules.md) forbids CDNs outright.

| Original | Here | Why |
|---|---|---|
| Google Fonts `<link>` + `preconnect` for Sora / Inter / JetBrains Mono | The same font **stack**, no network link | A font service is a runtime dependency. The document is typographically identical wherever those fonts are installed and degrades to `system-ui` elsewhere. |
| Diagrams hand-authored inline SVG, never JS-rendered, from an `ic-*` symbol library | Diagrams rendered from the data block into the same `.figwrap → svg → .caption → .figure-legend` run, using the repository's 19 `nd-*` symbols; the Figure 1 legend is the sheet kits' shared three-column contract, filled from the data with only what the drawing uses | Data-driven diagrams are the point of this repository: a topology change is a reviewable data diff, not hand-edited geometry. The output is the same shape, and the `<defs>` symbol library is the same architecture. Adding `ic-*` symbols would also break the validator, which pins exactly 19. |

## The rule underneath the rules

Every fixed parameter serves one idea: **the reader must always be able to tell
what is known from what is assumed.**

That is why badge 4 is epistemic status, why captions must name what is assumed,
why Slot A exists at all, why the provenance declaration is mandatory in section
0, why Slot A ships on rather than off, and why the footer must end in a caveat
and a redaction statement.

A document that renders perfectly but hides its own uncertainty is off-template.
