# Network Design HTML

Git-native, self-contained network topology documentation for network engineers.

Network Design HTML treats a network diagram as both a visual document and
maintainable source code. The result is an ordinary HTML file that opens in a
browser, remains useful without a server or special drawing application, and can
be reviewed and versioned with the same Git workflow used for infrastructure and
automation code.

## Why this project matters

Network diagrams are critical operational documents, but they are often stored
as proprietary drawing files, slide decks, exported PDFs, or screenshots. Those
formats can produce a good picture while making the underlying design difficult
to inspect, compare, automate, and maintain. Over time, multiple copies circulate,
the reason for a change is lost, and nobody is certain which diagram represents
the current network.

HTML offers a practical alternative because the source and the deliverable are
the same artifact. A network engineer can edit the structured source, immediately
open the file in a browser, and see the result. The file can then be committed,
reviewed, shared, printed, archived, or converted to PDF without a proprietary
viewer or an export step.

This makes network documentation behave more like an engineering system of
record than a static illustration.

### Universal and portable

Every modern workstation already has a browser. A self-contained topology can be
opened on Windows, macOS, or Linux; attached to a ticket or change record; shared
with a colleague; stored with project documentation; or kept as an offline
artifact. Inline CSS and SVG mean that the default editable file does not depend
on a web server, CDN, font service, adjacent icon directory, or paid application.

### Traceable by design

HTML, CSS, SVG, JavaScript, and JSON are text. Git can therefore record who
changed a topology, what changed, when it changed, and why it changed. Engineers
can use commits, branches, diffs, pull requests, reviews, tags, and rollbacks to
follow the design from an early proposal through implementation and the final
as-built state.

The template keeps ordinary topology edits in clearly marked semantic data. A
change such as adding a switch, renaming a VLAN, moving a connection, or updating
a rack position can remain understandable in a source diff instead of appearing
only as an opaque binary-file replacement.

### Immediately useful as documentation

The browser-rendered result is already a document. It can support design notes,
device and interface labels, addressing context, rack information, legends, and
operational annotations alongside the topology. Engineers can zoom it, print it,
save it as PDF, capture part of it for another document, or copy its source into
a larger documentation workflow.

The same approach is useful for enterprise networks, branch deployments, data
centers, lab environments, managed-service providers, training material,
incident records, migration plans, change-control evidence, and hobby networks.

### Accessible to people and automation

The diagram is readable by a browser, editable with any text editor, and
structured enough for scripts and AI tools. Devices use stable semantic keys such
as `router`, `access-switch`, and `wlan-controller`; ordinary editors do not need
to understand or redraw complex SVG geometry.

That smaller editing surface is intentional. It allows lower-capability and free
AI models to make useful topology changes while protected symbol definitions and
packaging contracts remain stable. A human reviewer can then inspect the same
plain-text change before accepting it.

### One design, two presentation paths

The default workflow uses clean inline SVG symbols. This keeps the working file
small, scalable, self-contained, and easy to version. When a presentation
requires official raster artwork, the same semantic design can optionally be
processed by the local packager, which replaces the placeholders with embedded
official assets without changing the topology data.

In short, the project separates the durable network design from the artwork used
to present it:

```text
network intent and notes
        ↓
self-contained editable HTML + inline SVG
        ↓ Git history, review, sharing, printing
optional local packaging
        ↓
self-contained HTML with embedded official assets
```

## Project principles

- The editable topology should remain a single, directly viewable HTML file.
- A useful diagram should not require a particular operating system or paid tool.
- Ordinary changes should be semantic, reviewable, and friendly to Git diffs.
- Visual symbols should be reusable and kept outside the routine editing surface.
- A packaged document should remain self-contained and recover its exact editable
  source.
- Third-party artwork should remain separate from the source repository until its
  provenance and redistribution terms are understood.

This is documentation tooling, not a live discovery or monitoring platform. It
does not attempt to replace a network source of truth, configuration management,
telemetry, or a full CAD application. Its purpose is to make intentional network
design documentation easier to create, understand, exchange, and maintain.

## Start here — no installs, no command line

You need a browser and an AI chat window. Nothing else. A free AI model is
enough, because you never ask it for the HTML file — only for the diagram data,
which is about a sixth of the file and contains no code at all.

### The short way

1. Download [`templates/network-design-template.edit.html`](templates/network-design-template.edit.html)
   and [`tools/edit-with-ai.html`](tools/edit-with-ai.html).
2. Double-click `edit-with-ai.html` and choose your design file.
3. Type what you want changed, click **Copy prompt**, and paste it into your AI
   chat.
4. Paste the reply back and click **Check it**. If something is wrong it tells
   you in plain English and gives you a sentence to paste back to the AI.
5. Click **Save new design file**, then double-click the file you just saved.

The helper never uploads anything and never edits the drawing code — everything
outside the diagram data is copied through byte for byte.

### By hand

The same loop works with nothing but a text editor.

1. Download [`templates/network-design-template.edit.html`](templates/network-design-template.edit.html)
   and double-click it. You should see an example campus network, a 42U rack
   elevation, and a green `PASS` badge.
2. Open that same file in a plain text editor. Find these two lines:

   ```text
   <!-- PROOF-DATA:BEGIN -->
   <!-- PROOF-DATA:END -->
   ```

3. Between them is a `<script id="proof-data" ...>` line, a block of JSON, and a
   closing `</script>` line. Copy **only the JSON** — not the two script lines.
4. Open [`docs/ai-json-rules.md`](docs/ai-json-rules.md), copy the prompt, and
   paste your JSON where it says `<<<CURRENT_JSON>>>`. Describe your change in
   plain English where it says `<<<USER_REQUEST>>>`. Send it.
5. The AI replies with JSON. Paste it back over the old JSON, in exactly the same
   place. Save.
6. Double-click the file again. Your change is on the screen.

Three things that will bite you:

- **Save as UTF-8, never ANSI.** The file contains `·` and `—`; ANSI destroys
  them.
- **Use a plain text editor.** Notepad, VS Code, Notepad++. Never Word or
  anything that formats text.
- **Change nothing outside those two marker lines.** Everything else — the
  drawing code, the symbols, the styling — is meant to stay exactly as it is.

If the diagram looks wrong or the badge turns red, the page tells you what is
wrong at the top of each tab. Paste that message back to the AI and ask it to
fix it.

You pick device types by name — `router`, `access-switch`, `wlan-controller`.
You never touch drawing geometry or artwork filenames.

## For maintainers

Changing the template, the symbols, or the packaging contract is a different
job with its own rules.

- [`docs/gemini-editing-rules.md`](docs/gemini-editing-rules.md) is the
  template-authoring and packaging contract — the rules an AI must follow when
  it rewrites the template itself, not the prompt for editing a diagram.
- [`docs/architecture.md`](docs/architecture.md) covers the protected packaging
  contract and symbol synchronization.
- [`CONTRIBUTING.md`](CONTRIBUTING.md) is required reading before changing
  symbol geometry.

Run `npm test` before sharing a template change.

### Optional official-asset build

Official Cisco JPGs and local rack PNGs are not part of this repository. If you
have reviewed and supplied them under `vendor-local/`, run:

```text
npm run build:packager
npm run verify:packager
```

This creates `dist/network-design-packager.html` and tested self-contained
`.portable.html` examples. Both `vendor-local/` and generated `dist/` artifacts
are Git-ignored because they may contain third-party binary artwork.

## Repository layout

```text
templates/             canonical editable hybrid template
symbols/               canonical SVG sprite and semantic map
examples/              source-controlled vector showcase
docs/                  diagram-editing prompt, architecture, packaging contract
tools/edit-with-ai.html offline AI editing helper for diagram data
tools/packager/         reproducible optional packager source
tools/                  local Cisco filename catalog
scripts/                source validation
tests/fixtures/         alternate editable contract fixture
vendor-local/           optional untracked binary inputs
dist/                   generated untracked outputs
```

## Publication status

This is a pre-release working repository. The vector symbols are experimental
interpretations informed by Cisco reference silhouettes, not official
Cisco-distributed SVG files. No project license has been selected, and the
third-party/artwork review is not complete. Do not treat the current tree as
permission to redistribute Cisco artwork or close derivatives; see
[`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).

This project is independent and is not affiliated with or endorsed by Cisco.
