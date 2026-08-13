# Network Design HTML

**Network diagrams you can edit by asking. One HTML file. No installs.**

[![Validate](https://github.com/cloudbatsx/network-design-html/actions/workflows/validate.yml/badge.svg)](https://github.com/cloudbatsx/network-design-html/actions/workflows/validate.yml)
[![License](https://img.shields.io/badge/license-MIT%20%28scoped%29-blue)](LICENSE)
![Dependencies](https://img.shields.io/badge/dependencies-none-brightgreen)
![Offline](https://img.shields.io/badge/works-offline-brightgreen)

Your topology, rack elevation, and design notes live in **one HTML file** that opens
in any browser, prints to a clean PDF, and diffs properly in Git.

You change it by describing what you want. A **free** AI model is enough, because it
never sees the HTML — only a small block of data.

---

## How it works

```mermaid
flowchart LR
    A["Say what you want:<br/>add a WLC, wire it<br/>to both cores"] --> B["Free AI model"]
    B --> C["JSON only<br/>~17% of the file"]
    C --> D{"Checked"}
    D -- problems --> B
    D -- clean --> E["New .edit.html<br/>byte-exact"]
    E --> F["Open · Print · Commit"]
```

The AI never touches the drawing code, the symbols, or the styling. Everything
outside the data block is copied through **byte for byte**.

---

## Quick start

No Node. No npm. No command line. Just a browser and an AI chat window.

1. **Download two files** — [`network-design-template.edit.html`](templates/network-design-template.edit.html) and [`edit-with-ai.html`](tools/edit-with-ai.html)
2. **Open `edit-with-ai.html`** and pick your design file
3. **Type your change** in plain English → click **Copy prompt** → paste into your AI chat
4. **Paste the reply back** → click **Check it**
5. **Save new design file** → double-click it. Done.

> **Step 4 is the important one.** If the AI got something wrong, you get plain
> English — *"access-sw-01 and edge-fw-02 both occupy U38"* — plus a ready-made
> sentence to paste straight back to the AI.

<details>
<summary><b>No helper tool? Do it by hand.</b></summary>

<br>

1. Open the template in a plain text editor
2. Find `<!-- PROOF-DATA:BEGIN -->` and `<!-- PROOF-DATA:END -->`
3. Copy the JSON between them (not the `<script>` lines)
4. Paste it into the prompt from [`docs/ai-json-rules.md`](docs/ai-json-rules.md)
5. Paste the reply back over the old JSON, save, reopen

**Three things that will bite you:**

- Save as **UTF-8**, never ANSI — the file contains `·` and `—`
- Use a **plain text editor**. Never Word
- Change **nothing** outside those two marker lines

</details>

---

## What you get

| | |
|---|---|
| 🖥️ **Logical topology** | Zones, devices, and links from a JSON block. Click any device to inspect it. |
| 🗄️ **Rack elevation** | Front and rear from one equipment schedule, so they can't drift apart. |
| ✅ **It checks itself** | Catches rack overlaps, dangling links, duplicate IDs, devices outside the rack. |
| 🖨️ **Prints properly** | Letter-size PDF with the sidebar dropped and hidden sections revealed. |
| 🎨 **Your branding** | Swap the logo with one line of JSON. |
| 📦 **Zero dependencies** | No CDN, no fonts, no build step, no server. Works on a plane. |

### It catches your mistakes

This is the part that isn't like other diagram tools. Visio and draw.io will happily
let you stack two 2U servers in the same rack slot forever. This won't:

```
FAIL · 2 data errors
access-sw-01 overlaps edge-fw-02 at U38.
Link 19 references a missing node.
```

---

## Make it yours

The layout is fixed so every document reads the same way. **The branding is not.**

```json
"brand": {
  "name": "Acme Networks",
  "label": "Network Engineering — Internal",
  "logoViewBox": "0 0 512 512",
  "logoPath": "M64 64h384v384h-384z"
}
```

Export your logo as SVG, paste its path `d` into `logoPath`, match the `viewBox`.
That's it — nothing else depends on it.

---

## Why HTML?

- **The source and the deliverable are the same file.** No export step.
- **Git tells you what changed.** Adding a switch is a readable diff, not a new binary.
- **It opens anywhere.** Attach it to a ticket. Email it. Archive it. It still works in five years.
- **Weak AI models can drive it.** The editable surface is data, not geometry.

### What this is *not*

Documentation tooling — not discovery, monitoring, or a source of truth. It won't poll
your network or replace NetBox. It makes *intentional* design documentation easy to
write, review, and keep honest.

There's also no auto-layout: node positions are coordinates you (or the AI) set. Fine
for the diagrams people actually hand-draw; not a substitute for Graphviz on 200 nodes.

---

## Documentation

| File | What it covers |
|---|---|
| [`docs/ai-json-rules.md`](docs/ai-json-rules.md) | The prompt. Copy it into your AI chat. |
| [`docs/document-shell.md`](docs/document-shell.md) | The layout standard — section spine, toggleable layers, print contract. |
| [`docs/architecture.md`](docs/architecture.md) | The packaging contract and symbol synchronization. |
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | Read before changing symbol geometry. |

<details>
<summary><b>For maintainers</b> — tests, the packager, repo layout</summary>

<br>

Run the validator before sharing a template change:

```bash
npm test
```

**Optional official-asset build.** Cisco JPGs and rack PNGs are not in this repository.
If you have reviewed and supplied them under `vendor-local/`:

```bash
npm run build:packager
npm run verify:packager
```

This produces `dist/network-design-packager.html` — a browser tool that embeds official
artwork into a self-contained `.portable.html`, which can recover its exact editable
source again. Both `vendor-local/` and `dist/` are Git-ignored.

[`docs/gemini-editing-rules.md`](docs/gemini-editing-rules.md) is the template-authoring
and packaging contract — the rules for rewriting the template itself, *not* the prompt
for editing a diagram.

```text
templates/               the editable template
symbols/                 canonical SVG sprite + semantic map
tools/edit-with-ai.html  offline AI editing helper
tools/packager/          optional packager source
docs/                    prompt, layout standard, architecture
scripts/                 repository validation
examples/  tests/        showcase and contract fixture
vendor-local/  dist/     untracked binaries and build output
```

</details>

---

## Status and license

Pre-release, but the workflow above works today.

Code, tooling, and documentation are **MIT licensed** — see [`LICENSE`](LICENSE).

⚠️ **That grant excludes the vector symbols.** They are experimental interpretations
informed by Cisco reference silhouettes, and the artwork review is not finished. Don't
treat this repository as permission to redistribute Cisco artwork or close derivatives.
See [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).

Independent project. Not affiliated with or endorsed by Cisco.
