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

1. **Download two files** — a [starter kit](#starter-kits) (or the [blank template](templates/network-design-template.edit.html)) and [`edit-with-ai.html`](tools/edit-with-ai.html)
2. **Open `edit-with-ai.html`** and pick your design file
3. **Pick the part you're changing** — devices, connections, the rack, the gaps list — then **type your change** in plain English → **Copy prompt** → paste into your AI chat
4. **Paste the reply back** → click **Check it**
5. **Save new design file** → double-click it. Done.

> **Step 3 is why a free model can drive this.** Ask for the devices and the AI
> writes back ~3 KB instead of the whole 39 KB design — 80–90% less to produce, so
> it stops running out of room mid-reply, and a rewiring job can't quietly reword
> your findings. Your part is merged back in, then the **whole** design is checked.

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

## Two ways to finish

A design is **already finished** when you save it. It draws with 19 built-in vector
symbols, carries no images, and needs no download, no install and no network. That
is the light path, and for most documents it is the better one:

| | file size | needs |
|---|---|---|
| **Vector symbols** — just save it | **~100 KB** | nothing |
| **Official Cisco artwork** — run the packager | ~3.7 MB | the `assets` folder |

36× smaller, emails cleanly, diffs in Git, prints identically. The symbols live in
[`symbols/`](symbols/README.md), they are MIT licensed original work, and you are
free to lift them for anything else you build — see
[`examples/vector-symbol-showcase.html`](examples/vector-symbol-showcase.html) for
all 19 at a glance.

**The rack is drawn the same way.** 25 faceplates — switches, routers, firewalls,
servers, patch panels, PDUs, a UPS — front and rear, at true EIA-310 proportions,
so a 48-port switch reads as a 48-port switch and an SFP28 bank does not look like
copper. Seventeen are vendor-neutral; the rest reproduce the port layout that makes
a Cisco, Juniper, Palo Alto, Fortinet or Arista box recognisable, without any
branding. Name one in the equipment schedule:

```json
{ "id": "core-sw-01", "position": 38, "height": 1, "asset": "cisco-nexus-48sfp-1u" }
```

No download and no packaging step — see [`rack-faces/`](rack-faces/README.md) for
the full list and [`examples/rack-face-preview.html`](examples/rack-face-preview.html)
to browse them.

Nothing is one-way, either: a packaged file carries its editable source inside it,
so **Download editable source** hands the light version straight back.

## Official artwork

When a document does need the **official Cisco icons and rack faces** — a customer
deliverable, a house standard — swap them in at the end:

1. Open [`tools/packager/network-design-packager.html`](tools/packager/network-design-packager.html)
2. Point it at the **`assets`** folder from this repository
3. Choose your design file → **Build portable HTML**

Out comes one file with the real images inside it. Still offline, still no install,
still openable anywhere — and it can hand your editable source back at any time.

The artwork ships in this repository, so a clone has everything the packager needs:

```text
assets/icons/cisco-pms3015/   294 official Cisco topology icons
assets/rack-assets/            10 front/rear rack faces
```

**Your own artwork works too.** Drop your images into the packager, or keep them in
the `assets` folders, and reference them by exact filename:

```json
{ "id": "core-sw-01", "icon": "core-switch", "iconAsset": "asset:cisco/acme-9500.jpg" }
```

`iconAsset` overrides one device's picture without touching anything else. Filenames
are case-sensitive, and a `.jpg` is expected for topology icons, a `.png` for rack
faces. Anything the design asks for and you have not supplied is listed by name
before the build runs, so nothing fails silently.

> The four engineering-sheet kits — NET-ENT-002, NET-HQ-002, NET-LAB-003 and
> NET-RH-001 — draw in their own grammar and ignore `iconAsset`. Their twenty
> standard icons still swap to official artwork; per-device overrides do not.
> Start from any of the other kits if you need those.

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

## Starter kits

Don't start from a blank page. Copy the one closest to your network.

| Kit | Shape | Size |
|---|---|---|
| [**Branch site**](starters/NET-BR-001.edit.html) | One WAN edge, one firewall, one switch, wireless, 12U cabinet | 9 nodes — **start here** |
| [**Regional hub**](starters/NET-RH-001.edit.html) | The next size up from a branch: three diverse transports, an SD-WAN edge pair, a collapsed core, campus access and wireless, and a 24U rack with every unit accounted for | 18 nodes |
| [Enterprise edge, DMZ & services](starters/NET-ENT-001.edit.html) | Three zones with a DMZ hanging off the perimeter | 15 nodes |
| [The same edge, as an engineering sheet](starters/NET-ENT-002.edit.html) | One network, drawn the other way — shared subnet bars and junction circles instead of repeated point-to-point lines, and no rack on purpose | 19 objects |
| [Leaf-spine fabric](starters/NET-FAB-001.edit.html) | Non-hierarchical: every leaf to every spine, north-south via border leaf | 15 nodes |
| [**Industrial control network**](starters/NET-OT-001.edit.html) | Not an IT network at all: stacked by Purdue level, an industrial DMZ that brokers every crossing, cell/area **rings** instead of stars, and a safety system deliberately wired to nothing | 18 nodes |
| [Campus + rack](starters/NET-LAB-002.edit.html) | Two independent gateways, peer link, MLAG downstream | 17 nodes |
| [The same campus, as an engineering sheet](starters/NET-LAB-003.edit.html) | Dual provider handoffs, a cross-connected perimeter, and access, wireless and services all dual-homed to both cores — every drawn link carries the id of its record | 15 nodes |
| [Headquarters](starters/NET-HQ-001.edit.html) | Collapsed core, out-of-band zone, 22-device 42U rack | 20 nodes |
| [HQ campus, as an engineering sheet](starters/NET-HQ-002.edit.html) | Dual providers, StackWise Virtual core, three access floors, and a 42U rack scheduled to the unit with dual power feeds and an airflow record | 21 nodes |

**NET-ENT-001 and NET-ENT-002 are the same network.** They exist as a pair because
the drawing is a choice, not a consequence of the data: one spells out every link,
the other collapses shared networks onto a subnet bar. Open both and copy whichever
argues better to your reader.

Every kit is one self-contained file with no images, no fonts and no network calls.
Each one records **its own gaps** — because a document that renders perfectly while
hiding its own uncertainty is worse than no document.

### Gaps you can point at

A finding can name the device it's about:

```json
{ "title": "Firewall failover is unproven", "detail": "...", "at": "edge-fw-02" }
```

A numbered marker then appears on that device, and the number is the finding's
position in the list — so the drawing and the list can never disagree. Click the
marker to jump to the finding. `"atZone": "perimeter"` outlines a whole area instead.

One control hides the section, the markers, and every table row marked as an
assumption, together. Printing reveals all of it anyway: the toggle is a
presentation control, not a redaction control.

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
| [`symbols/README.md`](symbols/README.md) | The 19 vector symbols — the semantic keys, retheming, reusing them elsewhere. |
| [`docs/architecture.md`](docs/architecture.md) | The packaging contract and symbol synchronization. |
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | Read before changing symbol geometry. |

<details>
<summary><b>For maintainers</b> — tests, the packager, repo layout</summary>

<br>

Run the validator before sharing a template change:

```bash
npm test
```

**The packager needs no build.** It is source in the tree, and it reads `assets/`
from the checkout when you open it. Nothing bakes artwork into it — that is asserted
by `npm test`, along with a byte ceiling, because a packager that has to be built is
a packager most people will never have.

**Optional example build.** To regenerate the packaged examples and the QA report:

```bash
npm run build:packager
npm run verify:packager
```

Those write into `dist/`, which stays Git-ignored: the outputs embed artwork and are
reproducible from the tree in one click anyway.

[`docs/template-authoring-rules.md`](docs/template-authoring-rules.md) is the
template-authoring and packaging contract — the rules for rewriting the template
itself, *not* the prompt for editing a diagram. It asks for a complete 97 KB HTML
file back, so it needs a strong model; it was called `gemini-editing-rules.md`,
which pointed beginners at the one door a free model cannot open.

```text
starters/                ten ready-made designs to copy
templates/               the editable template
symbols/                 canonical SVG sprite + semantic map
assets/                  official Cisco icons and rack faces
tools/edit-with-ai.html  offline AI editing helper
tools/packager/          the packager, plus its maintainer scripts
docs/                    prompt, layout standard, architecture
scripts/                 repository validation
examples/  tests/        showcase and contract fixture
dist/                    build output, untracked
```

</details>

---

## Status and license

Pre-release, but the workflow above works today.

Code, tooling, documentation **and the 19 vector symbols** are **MIT licensed** —
see [`LICENSE`](LICENSE). The symbols are original work; reuse them anywhere.

⚠️ **One exclusion: `assets/`.** The Cisco topology icons and rack faces come from
third-party sources and ship here unmodified so the packager works from a clone.
The MIT grant does not extend to them, and this repository is not a licence to
redistribute them onward — read [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md)
first. Delete `assets/` and everything still works; you simply design and ship with
the vector symbols instead.

Independent project. Not affiliated with or endorsed by Cisco.
