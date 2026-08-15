# Template authoring rules

> **Who this is for.** Maintainers rebuilding the template itself. It asks an AI
> to return a **complete 97 KB HTML file**, which a free model cannot do
> reliably — expect a strong model and a careful review.
>
> **Changing a diagram is the other document.** Use
> [`ai-json-rules.md`](ai-json-rules.md), or
> [`../tools/edit-with-ai.html`](../tools/edit-with-ai.html), which ask for a
> small block of data instead. That is the path a free model can drive.

Use the attached `.edit.html` as my network-design template. Redesign or revise it according to my requirements while preserving the Network Design Packager v2 contract.

IMMUTABLE PACKAGING CONTRACT — NEVER CHANGE
1. Keep these three exact marker pairs, in this order, exactly once:
   - `NETWORK-PACKAGER-CONTRACT:BEGIN` / `NETWORK-PACKAGER-CONTRACT:END`
   - `NETWORK-ASSET-VAULT:BEGIN` / `NETWORK-ASSET-VAULT:END`
   - `EDITABLE-SOURCE-CAPSULE:BEGIN` / `EDITABLE-SOURCE-CAPSULE:END`
2. Keep these exact script ids:
   - `network-packager-contract`
   - `network-asset-vault`
   - `editable-source-capsule`
3. Keep the contract schema and mapping unchanged:
   - `schema`: `network-design-package/v2`
   - `assetReferences`: `asset-uri/v1`
   - `cisco`: `icons/cisco-pms3015/`
   - `rack`: `rack-assets/`
4. The editable vault must remain exactly `{}`.
5. The editable source capsule must remain empty.
6. Never add Base64, `data:image`, inline raster bytes, CDNs, or external icon libraries. The template's existing inline SVG symbol sprite is allowed and must remain path-based.
7. Keep the existing inline vector symbol definitions and semantic icon map intact. Select semantic keys; do not redraw, trace, restyle, or rename the protected symbol paths.

HYBRID VECTOR / OFFICIAL WORKFLOW
- In editable mode, topology nodes render the project's own inline SVG symbols and rack devices render inline CSS faces. Those are finished artwork, not stand-ins: the editable HTML is a complete deliverable on its own and must never need an adjacent image.
- In portable mode, the same semantic topology keys resolve to official Cisco JPG assets and the same rack schedule resolves to official front/rear PNG assets embedded by the packager.
- Every semantic icon record must retain both its vector id and its complete literal official identifier, for example:
  `"access-switch":{vector:"nd-access-switch",official:"asset:cisco/workgroup switch.jpg"}`
- Models may change a node's `icon` to another supported semantic key. Do not edit the vector sprite or official mapping to make ordinary topology changes.
- For an uncommon Cisco icon with no vector symbol, place the complete official identifier literally in node data as `"iconAsset": "asset:cisco/<exact filename>.jpg"`. Do not build the filename dynamically. Editable mode will show an official-only generic placeholder; packaged mode will render the embedded asset.

STABLE OFFICIAL-ASSET REFERENCES
- Cisco icon syntax: `asset:cisco/<exact Cisco JPG filename>`
- Rack image syntax: `asset:rack/<exact rack PNG filename>`
- These identifiers may appear anywhere in HTML, SVG-related data, JSON, or JavaScript. The packager scans the complete template; the surrounding topology schema and layout may change completely.
- Identifiers are case-sensitive. Use only exact filenames from the supplied catalog. Never invent, rename, URL-encode, or add directories to an identifier.
- Reuse the same identifier for repeated instances; the packager embeds its binary only once.

Common examples:
- `asset:cisco/cloud.jpg`
- `asset:cisco/router.jpg`
- `asset:cisco/firewall.jpg`
- `asset:cisco/layer 3 switch.jpg`
- `asset:cisco/workgroup switch.jpg`
- `asset:cisco/lightweight ap.jpg`
- `asset:cisco/fileserver.jpg`
- `asset:cisco/pc.jpg`

Available rack examples:
- `asset:rack/cisco-c9500x-28c8d.front.png`
- `asset:rack/cisco-c9500x-28c8d.rear.png`
- `asset:rack/cisco-c9300-48p.front.png`
- `asset:rack/cisco-c9300-48p.rear.png`
- `asset:rack/cisco-fpr4215-ngfw-k9.front.png`
- `asset:rack/cisco-fpr4215-ngfw-k9.rear.png`
- `asset:rack/dell-poweredge-r750.front.png`
- `asset:rack/dell-poweredge-r750.rear.png`
- `asset:rack/apc-smt3000rmi2uc.front.png`
- `asset:rack/apc-smt3000rmi2uc.rear.png`

RENDERER REQUIREMENT
- Preserve or adapt the template's `assetUrl(assetId)` helper.
- The normal editable topology and rack renderers must use their inline placeholders and must not request the adjacent image folders.
- If a maintainer preview explicitly calls `assetUrl()` in editable mode, it may translate a stable identifier through `assetUriSchemes` to its adjacent reference file.
- In portable mode it must resolve the identifier through `network-asset-vault.keys` and `network-asset-vault.blobs` to `data:<mime>;base64,<base64>`.
- Portable mode must never fall back to an external or relative path when an embedded asset is missing; show an error instead.

FREEDOM OUTSIDE THE CONTRACT
You may radically change the template's CSS, page layout, topology schema, SVG construction, dashboards, cards, tables, controls, data blocks, validation, and other renderer JavaScript. The packager does not require `PROOF-DATA` or any particular topology/rack schema. Keep all required asset identifiers literal and discoverable in the returned source.

BEFORE RETURNING, SILENTLY VERIFY
- All three protected regions and their script ids remain exact and unique.
- The contract is unchanged, vault is `{}`, and capsule is empty.
- Every official asset uses a valid literal `asset:cisco/...` or `asset:rack/...` identifier.
- No raster image payload was embedded.
- The inline SVG symbol ids remain unique and every semantic vector id resolves.
- The complete HTML is syntactically valid, its editable preview works offline by itself, and it makes no image requests.

Return the COMPLETE updated `.edit.html` and no separate explanation.

My requested design:

[PASTE THE NETWORK, RACK, AND VISUAL-DESIGN REQUIREMENTS HERE]
