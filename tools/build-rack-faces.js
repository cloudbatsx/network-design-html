"use strict";

// Builds every artefact derived from the rack faceplate drawing core:
//
//   rack-faces/rack-faces.svg          the sprite, for use outside this project
//   rack-faces/rack-face-map.json      semantic keys -> symbol ids
//   examples/rack-face-preview.html    the review page
//   starters/                          the inlined copy each document carries
//
// The drawing itself lives in rack-faces/rack-face-core.js. Edit that, then run:
//
//   node tools/build-rack-faces.js
//
// Documents inline the core rather than the sprite because the expanded sprite
// is over 400 KB and every document has to carry the whole catalogue — the data
// block must be able to name any device without a download. The generator is
// a fifteenth of the size and draws the same picture.

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const faceDir = path.join(root, "rack-faces");
const corePath = path.join(faceDir, "rack-face-core.js");

const CORE = require(corePath);
const coreSource = fs.readFileSync(corePath, "utf8").trimEnd();
const { W, U, DEVICES } = CORE;

const BEGIN = "<!-- RACK-FACE-LIBRARY:BEGIN -->";
const END = "<!-- RACK-FACE-LIBRARY:END -->";

/* -- sprite -------------------------------------------------------------- */

function symbolFor(device, view) {
  return [
    `    <symbol id="rf-${device.key}-${view}" viewBox="${CORE.viewBoxFor(device.key)}" preserveAspectRatio="none">`,
    `      <title>${device.label} — ${view} face, ${device.units}U</title>`,
    `      ${CORE.faceMarkup(device.key, view)}`,
    `    </symbol>`
  ].join("\n");
}

const sprite = [
  `<?xml version="1.0" encoding="UTF-8"?>`,
  `<svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true">`,
  `  <title>Network Design rack faceplate sprite</title>`,
  `  <style>${CORE.STYLE}`,
  `  </style>`,
  `  <defs id="rack-face-library">`,
  DEVICES.flatMap(device => [symbolFor(device, "front"), symbolFor(device, "rear")]).join("\n"),
  `  </defs>`,
  `</svg>`,
  ``
].join("\n");

const map = {
  schema: "network-design-rack-face-map/v1",
  sprite: "rack-faces.svg",
  core: "rack-face-core.js",
  geometry: { width: W, unitHeight: U, pixelsPerInch: CORE.PPI, note: "EIA-310: 19in wide, 1.75in per rack unit." },
  faces: Object.fromEntries(DEVICES.map(device => [device.key, {
    label: device.label,
    family: device.family,
    role: device.role,
    units: device.units,
    front: `#rf-${device.key}-front`,
    rear: `#rf-${device.key}-rear`
  }]))
};

/* -- the block each document carries ------------------------------------- */

const libraryBlock = [
  BEGIN,
  `<style id="rack-face-style">${CORE.STYLE}`,
  `</style>`,
  `<script id="rack-face-core">`,
  coreSource,
  `</script>`,
  END
].join("\n");

// Inserted after the source capsule so the three protected packaging blocks keep
// their required order, and before the document script that calls into it.
const ANCHOR = "<!-- EDITABLE-SOURCE-CAPSULE:END -->";

function injectLibrary(relativePath) {
  const file = path.join(root, relativePath);
  const source = fs.readFileSync(file, "utf8");
  const begin = source.indexOf(BEGIN);
  let next;
  if (begin !== -1) {
    const end = source.indexOf(END, begin);
    if (end === -1) throw new Error(`${relativePath}: ${BEGIN} without ${END}`);
    next = source.slice(0, begin) + libraryBlock + source.slice(end + END.length);
  } else {
    const anchor = source.indexOf(ANCHOR);
    if (anchor === -1) throw new Error(`${relativePath}: no ${ANCHOR} to anchor the library to`);
    const at = anchor + ANCHOR.length;
    next = `${source.slice(0, at)}\n\n${libraryBlock}\n${source.slice(at)}`;
  }
  if (next === source) return false;
  fs.writeFileSync(file, next);
  return true;
}

/* -- review page --------------------------------------------------------- */

// A faceplate that reads well at full width can still be unreadable in the
// place it actually gets used. This page shows both: the drawing as drawn, and
// the same drawing inside a rack bay at the two sizes the template offers.

const spriteInline = sprite
  .replace(/^<\?xml[^>]*\?>\n/, "")
  .replace(/^<svg /, '<svg style="position:absolute;width:0;height:0;overflow:hidden" ');

function previewCard(device) {
  const box = CORE.viewBoxFor(device.key);
  const faces = ["front", "rear"].map(view => `
      <figure class="face">
        <figcaption>${view === "front" ? "Front" : "Rear"}</figcaption>
        <svg class="face-art" viewBox="${box}" preserveAspectRatio="none" role="img"
             style="aspect-ratio:${W}/${U * device.units}"
             aria-label="${device.label}, ${view} face"><use href="#rf-${device.key}-${view}"/></svg>
      </figure>`).join("");

  const inRack = [
    { size: "18px", caption: "Compact · 18px per U" },
    { size: "28px", caption: "Full size · 28px per U" }
  ].map(step => `
      <figure class="rack-check">
        <figcaption>${step.caption}</figcaption>
        <div class="rack-bay" style="--u:${step.size};height:calc(${device.units * 2 + 3} * var(--u))">
          <div class="device-face" style="height:calc(${device.units} * var(--u));bottom:calc(${device.units + 2} * var(--u))">
            <svg viewBox="${box}" preserveAspectRatio="none"><use href="#rf-${device.key}-front"/></svg>
          </div>
          <div class="device-face" style="height:calc(${device.units} * var(--u));bottom:calc(1 * var(--u))">
            <svg viewBox="${box}" preserveAspectRatio="none"><use href="#rf-${device.key}-rear"/></svg>
          </div>
        </div>
      </figure>`).join("");

  return `
    <section class="card" id="${device.key}">
      <h2>${device.label}</h2>
      <p class="meta"><code>${device.key}</code> · ${device.units}U · ${device.family} · role <code>${device.role}</code></p>
      <div class="faces">${faces}</div>
      <h3>How it lands in an elevation</h3>
      <div class="racks">${inRack}</div>
    </section>`;
}

const families = [...new Set(DEVICES.map(device => device.family))];
const contents = families.map(family => `
    <div class="fam">
      <h4>${family}</h4>
      <ul>${DEVICES.filter(device => device.family === family)
    .map(device => `<li><a href="#${device.key}">${device.label}</a></li>`).join("")}</ul>
    </div>`).join("");

const preview = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Rack faceplate review · Network Design HTML</title>
<style>
  :root{color-scheme:light}
  body{margin:0;padding:32px clamp(16px,4vw,56px);background:#f4f7f9;color:#17262e;
       font:15px/1.55 "Segoe UI",system-ui,sans-serif}
  h1{margin:0 0 6px;font-size:1.5rem}
  .lede{max-width:64ch;margin:0 0 26px;color:#4a5c66}
  .toc{display:flex;flex-wrap:wrap;gap:26px;margin:0 0 34px;padding:18px 22px;
       border:1px solid #dbe4ea;border-radius:12px;background:#fff}
  .toc h4{margin:0 0 6px;font-size:.72rem;text-transform:uppercase;letter-spacing:.08em;color:#5b6c76}
  .toc ul{margin:0;padding-left:16px;font-size:.85rem}
  .toc a{color:#0f6d92}
  .card{margin:0 0 34px;padding:22px 24px;border:1px solid #dbe4ea;border-radius:12px;background:#fff;scroll-margin-top:16px}
  .card h2{margin:0;font-size:1.15rem}
  .card h3{margin:26px 0 10px;font-size:.78rem;text-transform:uppercase;letter-spacing:.06em;color:#5b6c76}
  .meta{margin:4px 0 18px;color:#5b6c76;font-size:.85rem}
  code{font:12px/1 Consolas,monospace;background:#eef3f6;padding:1px 5px;border-radius:3px}
  figcaption{margin-bottom:6px;font-size:.76rem;font-weight:700;color:#4a5c66}
  .faces{display:grid;gap:16px}
  .face{margin:0}
  .face-art{display:block;width:100%;height:auto;border:1px solid #c8d3d9;border-radius:3px;background:#e9eef1}
  .racks{display:flex;flex-wrap:wrap;gap:24px}
  .rack-check{margin:0}
  /* Lifted from the template so this is a like-for-like check, not a lookalike. */
  .rack-bay{position:relative;width:360px;border-width:0 10px;border-style:solid;
            border-color:#697a84;background:repeating-linear-gradient(to bottom,#eef3f6 0 calc(var(--u) - 1px),
            #b7c4cb calc(var(--u) - 1px) var(--u));box-shadow:inset 3px 0 #aebbc2,inset -3px 0 #aebbc2}
  .device-face{position:absolute;left:7px;right:7px;z-index:2;background:#fff}
  .device-face svg{display:block;width:100%;height:100%}
</style>
</head>
<body>
${spriteInline}
<h1>Rack faceplate review</h1>
<p class="lede">${DEVICES.length} faceplates, front and rear each, generated by
<code>rack-faces/rack-face-core.js</code>. The top drawing is the artwork at its native 19-inch
proportion; below it is the same artwork inside a rack bay at the two zoom steps the document
offers, which is where it has to stay readable.</p>
<nav class="toc">${contents}</nav>
${DEVICES.map(previewCard).join("")}
</body>
</html>
`;

/* -- write --------------------------------------------------------------- */

fs.writeFileSync(path.join(faceDir, "rack-faces.svg"), sprite);
fs.writeFileSync(path.join(faceDir, "rack-face-map.json"), JSON.stringify(map, null, 2) + "\n");
fs.writeFileSync(path.join(root, "examples", "rack-face-preview.html"), preview);

// Only documents that actually draw a rack carry the library. The four
// engineering-sheet kits use a different shell with no rack renderer at all;
// giving them 39 KB of drawing code they never call would be dead weight.
const candidates = [];
const starterDir = path.join(root, "starters");
if (fs.existsSync(starterDir)) {
  for (const name of fs.readdirSync(starterDir).filter(file => file.endsWith(".edit.html")).sort()) {
    candidates.push(`starters/${name}`);
  }
}
const targets = candidates.filter(relativePath =>
  fs.readFileSync(path.join(root, relativePath), "utf8").includes("function rackFaceContent("));

const injected = targets.filter(injectLibrary);
const skipped = candidates.filter(file => !targets.includes(file));

console.log(`${DEVICES.length} faceplates · ${DEVICES.length * 2} symbols`);
console.log(`sprite ${(Buffer.byteLength(sprite) / 1024).toFixed(0)} KB · inlined core ${(Buffer.byteLength(libraryBlock) / 1024).toFixed(0)} KB`);
console.log(`${targets.length} document(s) carry the library · ${injected.length} rewritten`);
if (skipped.length) console.log(`no rack renderer, skipped: ${skipped.map(file => path.basename(file)).join(", ")}`);
