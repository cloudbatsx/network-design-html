"use strict";

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const failures = [];
const passes = [];
const notes = [];

const BLOCKS = Object.freeze({
  contract: { begin: "<!-- NETWORK-PACKAGER-CONTRACT:BEGIN -->", end: "<!-- NETWORK-PACKAGER-CONTRACT:END -->", id: "network-packager-contract" },
  vault: { begin: "<!-- NETWORK-ASSET-VAULT:BEGIN -->", end: "<!-- NETWORK-ASSET-VAULT:END -->", id: "network-asset-vault" },
  capsule: { begin: "<!-- EDITABLE-SOURCE-CAPSULE:BEGIN -->", end: "<!-- EDITABLE-SOURCE-CAPSULE:END -->", id: "editable-source-capsule" }
});

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function check(label, operation) {
  try {
    operation();
    passes.push(label);
  } catch (error) {
    failures.push(`${label}: ${error.message}`);
  }
}

// A broken starter is usually broken in more than one way. `check` stops at the
// first throw, which means fixing and re-running once per problem. This reports
// every independent failure in one pass; a throw still ends the run, because a
// file whose data will not parse cannot be checked any further.
function checkEvery(label, operation) {
  const problems = [];
  try {
    operation((condition, message) => { if (!condition) problems.push(message); });
  } catch (error) {
    problems.push(error.message);
  }
  if (problems.length) failures.push(`${label}: ${problems.join(" · ")}`);
  else passes.push(label);
}

function count(source, token) {
  return source.split(token).length - 1;
}

function scriptInBlock(source, block) {
  assert(count(source, block.begin) === 1, `${block.begin} must occur once`);
  assert(count(source, block.end) === 1, `${block.end} must occur once`);
  const begin = source.indexOf(block.begin);
  const contentStart = begin + block.begin.length;
  const end = source.indexOf(block.end, contentStart);
  assert(end > contentStart, `${block.id} markers are out of order`);
  const inner = source.slice(contentStart, end);
  const escaped = block.id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = inner.match(new RegExp(`^\\s*<script\\b(?=[^>]*\\bid=["']${escaped}["'])[^>]*>([\\s\\S]*?)<\\/script>\\s*$`, "i"));
  assert(match, `${block.id} block must contain only its required script`);
  return { begin, end, content: match[1].trim() };
}

function validateEditable(relativePath) {
  const source = read(relativePath);
  const contractBlock = scriptInBlock(source, BLOCKS.contract);
  const vaultBlock = scriptInBlock(source, BLOCKS.vault);
  const capsuleBlock = scriptInBlock(source, BLOCKS.capsule);
  assert(contractBlock.begin < vaultBlock.begin && vaultBlock.begin < capsuleBlock.begin, "protected blocks must retain their order");
  const contract = JSON.parse(contractBlock.content);
  assert(contract.schema === "network-design-package/v2", "contract schema changed");
  assert(contract.assetReferences === "asset-uri/v1", "asset reference schema changed");
  assert(contract.assetUriSchemes?.cisco === "icons/cisco-pms3015/", "Cisco asset scheme changed");
  assert(contract.assetUriSchemes?.rack === "rack-assets/", "rack asset scheme changed");
  assert(vaultBlock.content === "{}", "editable asset vault must be exactly {}");
  assert(capsuleBlock.content === "", "editable source capsule must be empty");
  assert(!source.includes("data:image/"), "editable source contains a raster data URI");
  return source;
}

function extractDefs(source, label) {
  const match = source.match(/<defs\b(?=[^>]*\bid=["']vector-symbol-library["'])[^>]*>[\s\S]*?<\/defs>/i);
  assert(match, `${label} has no canonical vector-symbol-library defs block`);
  return match[0].replace(/\s+/g, " ").trim();
}

function symbolIds(source) {
  return [...source.matchAll(/<symbol\b[^>]*\bid=["']([^"']+)["']/gi)].map((match) => match[1]);
}

// Scoped to the topology sprite on purpose. A document also carries the rack
// faceplate library, and counting its symbols here would make "the canonical 19
// are present and unchanged" fail for a reason that has nothing to do with them.
function topologySymbolIds(source, label) {
  return symbolIds(extractDefs(source, label));
}

function walk(relativeDirectory = "") {
  const absolute = path.join(root, relativeDirectory);
  const results = [];
  for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
    const relative = path.join(relativeDirectory, entry.name);
    if (entry.isDirectory()) results.push(...walk(relative));
    else if (entry.isFile()) results.push(relative.replace(/\\/g, "/"));
  }
  return results;
}

let primary;
let alternate;
check("primary editable contract", () => { primary = validateEditable("starters/network-design-template.edit.html"); });
check("alternate editable fixture contract", () => { alternate = validateEditable("tests/fixtures/alternate-dashboard.edit.html"); });

const sprite = read("tools/symbols/network-symbols.svg");
const showcase = read("tools/symbols/vector-symbol-showcase.html");
const map = JSON.parse(read("tools/symbols/symbol-map.json"));

check("canonical 19-symbol library", () => {
  const ids = symbolIds(sprite);
  assert(ids.length === 19, `expected 19 symbols, found ${ids.length}`);
  assert(new Set(ids).size === ids.length, "symbol IDs are not unique");
});

check("embedded vector copies match canonical sprite", () => {
  const canonical = extractDefs(sprite, "sprite");
  assert(extractDefs(primary, "primary template") === canonical, "primary template sprite drifted from tools/symbols/network-symbols.svg");
  assert(extractDefs(showcase, "showcase") === canonical, "showcase sprite drifted from tools/symbols/network-symbols.svg");
  assert(topologySymbolIds(primary, "primary template").length === 19, "primary template does not contain 19 symbols");
  assert(topologySymbolIds(showcase, "showcase").length === 19, "showcase does not contain 19 symbols");
});

check("semantic symbol map", () => {
  assert(map.schema === "network-design-symbol-map/v1", "symbol map schema changed");
  assert(map.sprite === "network-symbols.svg", "symbol map points to the wrong sprite");
  const entries = Object.entries(map.symbols || {});
  assert(entries.length === 20, `expected 20 semantic keys, found ${entries.length}`);
  const ids = new Set(symbolIds(sprite));
  for (const [key, record] of entries) {
    assert(ids.has(record.vector), `${key} references missing vector ${record.vector}`);
    assert(/^asset:cisco\/[^/]+\.jpg$/.test(record.official), `${key} has an invalid official asset ID`);
  }
});

check("template semantic map matches JSON", () => {
  const embedded = {};
  for (const match of primary.matchAll(/^\s*"([^"]+)":\{vector:"([^"]+)",official:"([^"]+)"\}/gm)) {
    embedded[match[1]] = { vector: match[2], official: match[3] };
  }
  assert(Object.keys(embedded).length === Object.keys(map.symbols).length, "embedded semantic key count differs from symbol-map.json");
  for (const [key, record] of Object.entries(map.symbols)) {
    assert(JSON.stringify(embedded[key]) === JSON.stringify(record), `${key} differs between template and symbol-map.json`);
  }
});

function scriptById(source, id) {
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = source.match(new RegExp(`<script\\b(?=[^>]*\\bid=["']${escaped}["'])[^>]*>([\\s\\S]*?)<\\/script>`, "i"));
  assert(match, `missing ${id} script`);
  return match[1].trim();
}

function embeddedIconMap(source) {
  const embedded = {};
  for (const match of source.matchAll(/^\s*"([^"]+)":\{vector:"([^"]+)",official:"([^"]+)"\}/gm)) {
    embedded[match[1]] = { vector: match[2], official: match[3] };
  }
  return embedded;
}

const starterDirectory = path.join(root, "starters");
const starterNames = fs.existsSync(starterDirectory)
  ? fs.readdirSync(starterDirectory).filter((name) => name.endsWith(".edit.html")).sort()
  : [];
const starters = [];

check("starter kits exist", () => {
  assert(starterNames.length > 0, "no .edit.html starter kits found under starters/");
});

// The five official photography codes name real hardware with a real unit
// height (per vendor datasheets): the same model was once scheduled at 1U in
// nine documents and 3U in two, and nothing noticed. A schedule that disagrees
// with the machine is wrong about the machine.
const OFFICIAL_UNITS = Object.freeze({ c9500: 1, c9300: 1, fpr4215: 1, r750: 2, ups: 2 });

// Each starter carries its own copy of the sprite and the semantic map. Without
// this loop they drift apart silently, which is exactly how a documentation set
// ends up with the stylesheet no longer describing the document.
for (const name of starterNames) {
  checkEvery(`starter ${name}`, (want) => {
    const source = validateEditable(`starters/${name}`);
    starters.push(source);
    want(extractDefs(source, name) === extractDefs(sprite, "sprite"), "sprite drifted from tools/symbols/network-symbols.svg");
    want(topologySymbolIds(source, name).length === 19, `expected 19 symbols, found ${topologySymbolIds(source, name).length}`);
    want(!/<image\b/i.test(source), "contains an SVG image element");

    const embedded = embeddedIconMap(source);
    want(Object.keys(embedded).length === Object.keys(map.symbols).length, "semantic key count differs from symbol-map.json");
    // Reported as one line, not one per key: a drifted map fails all twenty at
    // once, and twenty identical messages bury the failures that differ.
    const drifted = Object.entries(map.symbols)
      .filter(([key, record]) => JSON.stringify(embedded[key]) !== JSON.stringify(record))
      .map(([key]) => key);
    want(drifted.length === 0, `differs from symbol-map.json: ${drifted.join(", ")}`);

    const data = JSON.parse(scriptById(source, "proof-data"));
    const nodeIds = new Set((data.topology?.nodes || []).map((node) => node.id));
    const zoneIds = new Set((data.topology?.zones || []).map((zone) => zone.id));
    want(nodeIds.size === (data.topology?.nodes || []).length, "duplicate topology node id");

    // An icon key with no entry in the semantic map draws as an empty
    // "OFFICIAL AFTER PACKAGE" box -- in the editable mode a starter is opened
    // in. A starter must not ship a node that renders as a placeholder.
    for (const node of data.topology?.nodes || []) {
      if (!node.icon || node.iconAsset) continue;
      want(Object.hasOwn(embedded, node.icon), `${node.id} uses icon "${node.icon}", which is not a semantic key`);
    }

    for (const link of data.topology?.links || []) {
      want(nodeIds.has(link.from), `link references missing node ${link.from}`);
      want(nodeIds.has(link.to), `link references missing node ${link.to}`);
    }
    // An absence is a record too - but it cannot coexist with a schedule.
    if (data.rack?.applicable === false) {
      want((data.rack.devices || []).length === 0, "rack is declared not applicable but schedules devices");
    }
    const occupied = new Map();
    for (const device of data.rack?.devices || []) {
      want(typeof device.position === "number" && typeof device.height === "number", `${device.id} position/height must be numbers`);
      want(device.position >= 1 && device.position + device.height - 1 <= (data.rack.units || 42), `${device.id} does not fit the rack`);
      if (Object.hasOwn(OFFICIAL_UNITS, device.asset)) {
        want(device.height === OFFICIAL_UNITS[device.asset],
          `${device.id} schedules ${device.asset} at ${device.height}U; the hardware is ${OFFICIAL_UNITS[device.asset]}U`);
      }
      for (let unit = device.position; unit < device.position + device.height; unit++) {
        want(!occupied.has(unit), `${device.id} overlaps ${occupied.get(unit)} at U${unit}`);
        occupied.set(unit, device.id);
      }
    }
    const findings = data.sections?.findings?.items || [];
    want(findings.length > 0, "a starter kit must record its own gaps");
    findings.forEach((item, index) => {
      const anchors = item.at == null ? [] : (Array.isArray(item.at) ? item.at : [item.at]);
      for (const id of anchors) want(nodeIds.has(id), `gap ${index + 1} pins to missing device ${id}`);
      if (item.atZone !== undefined) want(zoneIds.has(item.atZone), `gap ${index + 1} pins to missing zone ${item.atZone}`);
    });
    want(findings.some((item) => item.at != null || item.atZone !== undefined), "no gap is pinned to the drawing");

    // Declared scope renders in both densities - the boxed panel on screen,
    // the strip in print - whenever document.coverage or .architecture is
    // set. A document that can hold a declaration must be able to show it.
    want(source.includes('id="dc-scope-field"') && source.includes('id="meta-scope-row"'),
      "declared-scope row missing from the document-control panel or the print strip");
    want(source.includes('el("dc-scope-field")'), "the renderer no longer fills the declared-scope row");

    // The gap switch hides the findings section and the drawing markers
    // ONLY; assumed table rows stay visible wearing their permanent mark.
    // Both halves of that contract ship together - a switch that can blank
    // a table, or an unmarked assumption, is each its own failure.
    want(source.includes("body:not(.show-gaps) section.gap-layer"),
      "the gap switch is no longer scoped to the section and the overlay");
    want(source.includes('tr.gap-layer td:first-child::before'),
      "the permanent assumed-row mark is missing");
  });
}

// The rack faceplate library is generated, inlined into every document that
// draws a rack, and edited in exactly one place. These checks are the reason a
// contributor can trust that last claim.
const faceCore = read("tools/rack-faces/rack-face-core.js").trimEnd();
const faceMap = JSON.parse(read("tools/rack-faces/rack-face-map.json"));
const faceSprite = read("tools/rack-faces/rack-faces.svg");
const FACE_BLOCK = { begin: "<!-- RACK-FACE-LIBRARY:BEGIN -->", end: "<!-- RACK-FACE-LIBRARY:END -->" };

function inlinedFaceCore(source) {
  const begin = source.indexOf(FACE_BLOCK.begin);
  if (begin === -1) return null;
  const end = source.indexOf(FACE_BLOCK.end, begin);
  assert(end > begin, "rack face library markers are out of order");
  const match = source.slice(begin, end).match(/<script id="rack-face-core">\n([\s\S]*?)\n<\/script>/);
  assert(match, "rack face library block has no rack-face-core script");
  return match[1];
}

checkEvery("rack faceplate library", (want) => {
  want(faceMap.schema === "network-design-rack-face-map/v1", "rack face map schema changed");
  want(faceMap.core === "rack-face-core.js", "rack face map points at the wrong core");
  const keys = Object.keys(faceMap.faces || {});
  want(keys.length > 0, "rack face map is empty");

  // Every mapped key must exist in the sprite, at the height the map claims.
  const spriteIds = new Set(symbolIds(faceSprite));
  const missing = keys.filter((key) => !spriteIds.has(`rf-${key}-front`) || !spriteIds.has(`rf-${key}-rear`));
  want(missing.length === 0, `no front/rear symbol for: ${missing.join(", ")}`);
  want(spriteIds.size === keys.length * 2, `sprite has ${spriteIds.size} symbols for ${keys.length} faces`);

  const badUnits = keys.filter((key) => !Number.isInteger(faceMap.faces[key].units) || faceMap.faces[key].units < 1);
  want(badUnits.length === 0, `unit height is not a positive integer: ${badUnits.join(", ")}`);

  // The drawing must stay a drawing. A raster payload here would defeat the
  // whole reason documents inline the generator instead of the sprite.
  want(!/<image\b/i.test(faceCore) && !faceCore.includes("data:image/"), "rack face core embeds raster artwork");
  want(!/\brequire\s*\(/.test(faceCore), "rack face core uses require and cannot run in a browser");

  // A face the prompt does not list is a face no model will ever choose, which
  // makes drawing it pointless.
  const rules = read("docs/ai-json-rules.md");
  const undocumented = keys.filter((key) => !rules.includes(`\`${key}\``));
  want(undocumented.length === 0, `missing from docs/ai-json-rules.md: ${undocumented.join(", ")}`);

  // Counts written out in prose. Adding one faceplate went out of date in three
  // places at once, so they are asserted rather than remembered.
  const generic = keys.filter((key) => faceMap.faces[key].family === "generic").length;
  for (const [file, pattern, expected, what] of [
    ["README.md", /(\d+) faceplates/, keys.length, "total faceplates"],
    ["README.md", /(\d+) are vendor-neutral/, generic, "vendor-neutral faces"],
    ["tools/rack-faces/README.md", /(\d+) semantic keys/, keys.length, "total faceplates"],
    ["tools/rack-faces/README.md", /(\d+) of them, and/, generic, "vendor-neutral faces"]
  ]) {
    const found = read(file).match(pattern);
    want(found, `${file} no longer states its ${what}`);
    if (found) want(Number(found[1]) === expected, `${file} says ${found[1]} ${what}, there are ${expected}`);
  }
  const documentedUnits = keys.filter((key) => {
    const row = rules.split("\n").find((line) => line.includes(`\`${key}\``) && line.startsWith("|"));
    return row && !new RegExp(`\\|\\s*${faceMap.faces[key].units}\\s*\\|`).test(row);
  });
  want(documentedUnits.length === 0, `documented at the wrong unit height: ${documentedUnits.join(", ")}`);
});

// A document that draws a rack must carry the library, byte for byte. A document
// that does not must not carry it — 39 KB of unreachable drawing code is not a
// neutral thing to ship.
// Read fresh rather than reusing the `starters` array: that one only collects
// files that survived validateEditable, so its indices stop matching the names.
const faceDocuments = starterNames.map((name) => `starters/${name}`);

checkEvery("every rack document carries the current library", (want) => {
  for (const label of faceDocuments) {
    const source = read(label);
    const drawsRack = source.includes("function rackFaceContent(");
    const inlined = inlinedFaceCore(source);
    if (!drawsRack) {
      want(inlined === null, `${label} carries the rack face library but has no rack renderer`);
      continue;
    }
    want(inlined !== null, `${label} draws a rack but does not carry the rack face library`);
    if (inlined !== null) want(inlined === faceCore, `${label} rack face library drifted from tools/rack-faces/rack-face-core.js`);
    want(source.includes('id="rack-face-style"'), `${label} is missing the rack face stylesheet`);
  }
});

// A vector alias that names a face the library does not have draws nothing, and
// draws it silently.
checkEvery("rack asset vector aliases resolve", (want) => {
  const keys = new Set(Object.keys(faceMap.faces || {}));
  for (const label of faceDocuments) {
    const source = read(label);
    // Anchored to the trailing form used by RACK_ASSETS, in both spellings: a
    // bare face name, or an object keyed by unit height. The topology icon map
    // opens its records with `{vector:"nd-..."`, which is a different namespace.
    for (const match of source.matchAll(/,vector:(?:"([^"]+)"|\{([^}]*)\})/g)) {
      const named = match[1] ? [match[1]] : [...match[2].matchAll(/"([^"]+)"/g)].map((face) => face[1]);
      want(named.length > 0, `${label} has an empty vector alias`);
      for (const face of named) want(keys.has(face), `${label} aliases missing face "${face}"`);
    }
    // A height-keyed alias whose key disagrees with the face it names draws the
    // wrong shape at exactly the size it was meant to fix.
    for (const match of source.matchAll(/,vector:\{([^}]*)\}/g)) {
      for (const pair of match[1].matchAll(/(\d+):"([^"]+)"/g)) {
        const face = faceMap.faces[pair[2]];
        if (face) want(face.units === Number(pair[1]), `${label} maps ${pair[1]}U to ${pair[2]}, a ${face.units}U face`);
      }
    }
  }
});

/* The closed lists exist in three places: the template's renderer decides what
   is real, the helper tool grades an AI reply against them, and the prompt doc
   tells the model what to pick from. Nothing kept them in step, and they had
   already drifted - the tool was failing replies on rules its own prompt never
   stated. These make drift a build failure instead of a support question. */
function listFrom(source, name) {
  const match = source.match(new RegExp(`const ${name}\\s*=\\s*\\[([^\\]]*)\\]`));
  assert(match, `${name} not found in edit-with-ai.html`);
  return [...match[1].matchAll(/"([^"]+)"/g)].map((entry) => entry[1]);
}

// The stylesheet is the authority on link and zone kinds: an unlisted kind does
// not throw, it silently draws an invisible line or a black rectangle.
function cssKinds(source, prefix) {
  return [...new Set([...source.matchAll(new RegExp(`\\.${prefix}\\.([a-z0-9-]+)\\b`, "g"))].map((match) => match[1]))].sort();
}

checkEvery("the helper tool's closed lists match the template", (want) => {
  const helper = read("edit-with-ai.html");
  const iconKeys = listFrom(helper, "ICON_KEYS");
  const templateIcons = Object.keys(embeddedIconMap(primary));
  want(JSON.stringify(iconKeys.slice().sort()) === JSON.stringify(templateIcons.slice().sort()),
    `icon keys differ from the template: tool has ${iconKeys.length}, template has ${templateIcons.length}`);

  for (const [name, prefix] of [["LINK_KINDS", "link"], ["ZONE_KINDS", "zone"]]) {
    const fromTool = listFrom(helper, name).slice().sort();
    const fromCss = cssKinds(primary, prefix);
    const missing = fromTool.filter((kind) => !fromCss.includes(kind));
    want(missing.length === 0, `${name} has ${missing.join(", ")}, which the template stylesheet does not draw`);
  }

  /* Rack codes come from two families and the tool has to know both: the five
     that resolve to official photography, and every drawn faceplate. A code the
     tool has not heard of is reported to the user as invalid, which is how a
     model gets told off for picking a face that works perfectly. */
  const rackCodes = listFrom(helper, "RACK_CODES").filter((code) => code !== "generic");
  const officialCodes = [...new Set([...primary.matchAll(/^\s*"([a-z0-9-]+)":\{"front"/gm)].map((match) => match[1]))];
  const valid = new Set([...officialCodes, ...Object.keys(faceMap.faces || {})]);
  const unknown = rackCodes.filter((code) => !valid.has(code));
  const unlisted = [...valid].filter((code) => !rackCodes.includes(code));
  want(unknown.length === 0, `the tool offers rack codes nothing can draw: ${unknown.join(", ")}`);
  want(unlisted.length === 0, `the tool does not offer these usable rack codes: ${unlisted.join(", ")}`);
});

// Rules the tool enforces but never states are rules the model is failed on
// without being told. Each of these is checked by checkShell() in the helper.
checkEvery("the helper tool's prompt states the rules it grades on", (want) => {
  const helper = read("edit-with-ai.html");
  const prompt = helper.match(/const PROMPT = `([\s\S]*?)`;/);
  assert(prompt, "PROMPT not found in edit-with-ai.html");
  const text = prompt[1];
  for (const [label, needle] of [
    ["the brand must not be touched", /brand object through exactly as you found it/i],
    ["the evidence colour list", /purple, red, green, amber, teal/i],
    ["the mandatory footer lines", /footer\.caveat and footer\.redaction/i],
    ["gaps must not be empty", /findings\.items must never be empty/i],
    ["gap anchors must exist", /must already exist/i],
    ["the face height must match the device", /must match the device's height/i]
  ]) {
    want(needle.test(text), `the prompt never mentions ${label}, but the checker fails replies over it`);
  }
});

// A starter nobody can find is a starter nobody copies.
check("every starter is listed in the README", () => {
  const readme = read("README.md");
  const missing = starterNames.filter((name) => !readme.includes(`starters/${name}`));
  assert(missing.length === 0, `missing from the starter table: ${missing.join(", ")}`);
});

check("editable vector files contain no raster image payloads", () => {
  for (const [label, source] of [["primary", primary], ["showcase", showcase], ["sprite", sprite]]) {
    assert(!/<image\b/i.test(source), `${label} contains an SVG image element`);
    assert(!source.includes("data:image/"), `${label} contains a raster data URI`);
  }
});

// Artwork ships with the repository now, so this is no longer conditional: a
// design that names an image the checkout does not contain is a broken design.
const iconDirectory = path.join(root, "assets", "icons", "cisco-pms3015");
const rackDirectory = path.join(root, "assets", "rack-assets");

// Deleting assets/ is a supported configuration - three documents promise it,
// and every design still renders on vector symbols alone. So the counts are
// asserted only when the artwork is present: a partial folder is a mistake,
// an absent one is a choice.
const artworkPresent = fs.existsSync(iconDirectory) || fs.existsSync(rackDirectory);
check("official artwork is complete when present", () => {
  if (!artworkPresent) { notes.push("assets/ not present - artwork checks skipped (supported configuration)"); return; }
  assert(fs.existsSync(iconDirectory), "assets/icons/cisco-pms3015 is missing while assets/rack-assets exists");
  assert(fs.existsSync(rackDirectory), "assets/rack-assets is missing while assets/icons exists");
  const iconFiles = fs.readdirSync(iconDirectory).filter((name) => name.toLowerCase().endsWith(".jpg"));
  const rackFiles = fs.readdirSync(rackDirectory).filter((name) => name.toLowerCase().endsWith(".png"));
  assert(iconFiles.length === 294, `expected 294 Cisco JPGs in assets/, found ${iconFiles.length}`);
  assert(rackFiles.length === 10, `expected 10 rack PNGs in assets/, found ${rackFiles.length}`);
});

// A JPEG wearing a .png extension ships silently, and then the packager -
// correctly - refuses to build any design that references it. Extensions are
// load-bearing in the asset schemes, so the bytes must match them. This class
// of defect shipped once (the fpr4215 rack faces); nothing looked until a
// build failed in the one tool a real user opens.
checkEvery("artwork bytes match their extensions", (want) => {
  const signatureOf = (head) => {
    if (head.length >= 8 && head.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "png";
    if (head[0] === 255 && head[1] === 216 && head[2] === 255) return "jpg";
    return "unknown";
  };
  for (const directory of [iconDirectory, rackDirectory]) {
    if (!fs.existsSync(directory)) continue;
    for (const name of fs.readdirSync(directory)) {
      const lower = name.toLowerCase();
      const claimed = lower.endsWith(".png") ? "png" : (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) ? "jpg" : null;
      if (!claimed) continue;
      const descriptor = fs.openSync(path.join(directory, name), "r");
      const head = Buffer.alloc(8);
      fs.readSync(descriptor, head, 0, 8, 0);
      fs.closeSync(descriptor);
      const actual = signatureOf(head);
      want(actual === claimed,
        `${name} is ${actual === "unknown" ? "not recognisable image data" : actual.toUpperCase() + " data"} behind a .${claimed} extension`);
    }
  }
});

checkEvery("every asset reference resolves to a shipped file", (want) => {
  if (!artworkPresent) return;
  const sources = [primary, alternate, JSON.stringify(map), ...starters];
  const missing = new Set();
  for (const source of sources) {
    for (const match of source.matchAll(/asset:(cisco|rack)\/([^"'<>`\r\n\\]+)/g)) {
      const directory = match[1] === "cisco" ? iconDirectory : rackDirectory;
      if (!fs.existsSync(path.join(directory, match[2]))) missing.add(`asset:${match[1]}/${match[2]}`);
    }
  }
  want(missing.size === 0, `unresolved artwork: ${[...missing].join(", ")}`);
});

// The packager is the whole reason somebody can package without installing
// anything. These guard the two ways that quietly stops being true: it grows a
// build step, or it swallows the artwork it is supposed to read from disk.
checkEvery("the packager is usable straight from a clone", (want) => {
  const packagerPath = path.join(root, "packager.html");
  want(fs.existsSync(packagerPath), "packager.html is missing");
  if (!fs.existsSync(packagerPath)) return;
  const packager = fs.readFileSync(packagerPath, "utf8");
  want(!/@@[A-Z_]+@@/.test(packager), "packager still contains build tokens");
  want(!packager.includes("data:image/"), "packager embeds raster artwork");
  want(packager.includes("webkitdirectory"), "packager no longer reads an artwork folder");
  want(Buffer.byteLength(packager) <= 200 * 1024, "packager exceeds 200 KB, which suggests baked-in artwork");
});

/* Every kit that once used the engineering-sheet grammar - hand-tuned SVG
   geometry carried in the data, editable only through declared parts - has
   been regenerated through the coordinate engine. A starter that reintroduces
   a viewBox canvas or an editing declaration is a regression to the retired
   grammar, and the helper would refuse it. */
checkEvery("the retired sheet grammar stays retired", (want) => {
  for (const name of starterNames) {
    const source = read(`starters/${name}`);
    const data = JSON.parse(scriptById(source, "proof-data"));
    const canvas = data.topology?.canvas || {};
    want(Number.isFinite(Number(canvas.width)) && Number.isFinite(Number(canvas.height)),
      `${name} does not use the coordinate canvas`);
    want(data.editing === undefined, `${name} carries a sheet-era editing declaration`);
  }
});

/* A starter's identity lived in up to four names at once - filename
   NET-HQ-002, sidebar NET-SJC-HQ-001, control header CB-ND-SJC-HQ-001, a
   title claiming v2.1 over a header claiming 2.0 - and every run stayed
   green, because nothing compared the surfaces to each other. The filename
   is the one name a user actually picks, so it is the authority: every
   surface that states an identity must state that one, and a claimed
   revision must exist in the document's own history. */
checkEvery("every starter claims exactly one identity", (want) => {
  for (const name of starterNames) {
    const source = read(`starters/${name}`);
    const stem = name.replace(/\.edit\.html$/, "");
    const data = JSON.parse(scriptById(source, "proof-data"));
    const drawing = data.document?.drawing;

    // A data-block history renders newest-first, so its top row IS the
    // document's claimed revision - hold the two to each other.
    const history = Array.isArray(data.document?.history) ? data.document.history : [];
    if (history.length) {
      want(String(history[0]?.revision ?? "") === String(data.document?.revision ?? ""),
        `the newest history row says "${history[0]?.revision}", the document claims "${data.document?.revision}"`);
    }

    // The blank template deliberately carries a placeholder id - a real
    // starter's name on the template would collide the moment it is copied.
    if (name === "network-design-template.edit.html") {
      want(drawing === "NET-PROOF-001", `template drawing is "${drawing}", expected the NET-PROOF-001 placeholder`);
      continue;
    }
    want(drawing === stem, `proof-data names the drawing "${drawing}", the file is ${stem}`);

    // Every identity surface renders from proof-data at runtime, so the
    // drawing-id equality and the history check above cover the whole file.
    // The hardcoded per-surface checks that guarded the sheet-era conversions
    // retired with the sheet grammar itself.
  }
});

// One packaging engine, two surfaces. The core is injected byte-identically
// into both apps by build:helper; an edited copy in either is a build failure,
// which is what lets the helper's final step and the standalone packager
// never disagree about how a portable file is made.
check("the packaging engine is one source, byte for byte", () => {
  const core = read("tools/packager-core.js").trimEnd();
  for (const label of ["edit-with-ai.html", "packager.html"]) {
    const source = read(label);
    const match = source.match(/<script id="packager-core">\n([\s\S]*?)\n<\/script>/);
    assert(match, `${label} has no packager-core block - run npm run build:helper`);
    assert(match[1] === core, `${label} packager-core drifted from tools/packager-core.js - run npm run build:helper`);
  }
});

// "Start a new design" only works because the blank template travels inside
// the helper - a double-clicked page cannot read the disk. An embedded copy
// that drifts from the real template would hand new users a different product
// than the repository ships.
check("the helper carries the blank template, byte for byte", () => {
  const helper = read("edit-with-ai.html");
  const match = helper.match(/<script id="embedded-template"[^>]*>\n([\s\S]*?)\n<\/script>/);
  assert(match, "edit-with-ai.html has no embedded-template capsule - run npm run build:helper");
  const embedded = Buffer.from(match[1].trim(), "base64");
  const template = fs.readFileSync(path.join(root, "starters", "network-design-template.edit.html"));
  assert(embedded.equals(template), "embedded template drifted from the real template - run npm run build:helper");
});

// 69 KB of tool logic used to ship with nothing so much as parsing it: a stray
// character in the helper or the packager went through a green run completely
// broken. Nothing here executes the tools - the behaviour harness in tests/
// does that - but at minimum every script a user's browser will run must parse.
checkEvery("every embedded script parses", (want) => {
  const pages = [
    ...starterNames.map((name) => `starters/${name}`),
    "start-here.html",
    "edit-with-ai.html",
    "packager.html",
    "tools/cisco-icon-catalog.html",
    "tools/symbols/vector-symbol-showcase.html",
    "tools/rack-faces/rack-face-preview.html",
    "tests/fixtures/alternate-dashboard.edit.html"
  ];
  for (const label of pages) {
    if (!fs.existsSync(path.join(root, label))) { want(false, `${label} is missing`); continue; }
    const source = read(label);
    let index = 0;
    for (const match of source.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
      index += 1;
      if (/type\s*=\s*["']application\/(json|octet-stream)["']/i.test(match[1])) continue;
      try { new Function(match[2]); } catch (error) { want(false, `${label} script #${index} does not parse: ${error.message}`); }
    }
  }
});

check("generated files stay in excluded directories", () => {
  // tests/free-model-runs holds the live validation runs of
  // docs/free-model-results.md: source diagram, logo, generated document and
  // logs per run. Its packaged .portable.html files stay gitignored, and its
  // images are the run inputs - evidence, not stray assets.
  const RUNS = "tests/free-model-runs/";
  const files = walk();
  const portableOutsideDist = files.filter((file) => file.endsWith(".portable.html") &&
    !file.startsWith("dist/") && !file.startsWith(RUNS));
  assert(portableOutsideDist.length === 0, `portable output outside dist: ${portableOutsideDist.join(", ")}`);
  const binariesOutsidePermitted = files.filter((file) => /\.(?:jpe?g|png|gif|webp)$/i.test(file) &&
    !file.startsWith("assets/") && !file.startsWith("dist/") && !file.startsWith(RUNS));
  assert(binariesOutsidePermitted.length === 0, `raster assets outside assets/: ${binariesOutsidePermitted.join(", ")}`);
});

/* Every document this repository ships must be one the helper would let you
   save. It sounds obvious; it was not enforced, and v0.4.1 shipped eleven
   documents - the blank template among them - that the helper's own checker
   stopped on sight, because white-labelling the brand emptied a logo path
   that a stop was written to defend. A whole release was unusable and every
   other check stayed green. This is that check. */
check("every shipped document passes the helper's own checkers", () => {
  const vm = require("vm");
  const helperSource = read("edit-with-ai.html");
  const script = helperSource.match(/<script>([\s\S]*)<\/script>/);
  assert(script, "edit-with-ai.html no longer contains a script block");
  const stub = () => {
    const element = {
      value: "", textContent: "", disabled: false, hidden: false, open: false,
      className: "", children: [], dataset: {}, style: {},
      classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
      addEventListener() {}, removeEventListener() {}, replaceChildren() {},
      appendChild: (child) => child, append() {}, remove() {}, click() {},
      setAttribute() {}, querySelector: () => stub(), querySelectorAll: () => []
    };
    return element;
  };
  const elements = new Map();
  const sandbox = {
    document: {
      getElementById: (id) => { if (!elements.has(id)) elements.set(id, stub()); return elements.get(id); },
      createElement: () => stub(), createTextNode: (text) => ({ text }),
      body: stub(), querySelectorAll: () => []
    },
    navigator: {}, URL: { createObjectURL: () => "b", revokeObjectURL() {} },
    Blob, TextDecoder, structuredClone, setTimeout, console, atob, btoa,
    PACKAGER_CORE: require(path.join(root, "tools", "packager-core.js"))
  };
  vm.runInNewContext(script[1] +
    ";globalThis.__v={checkShell,checkMeaning,checkAssetStrings,loadSource,state:()=>({currentData})};",
    sandbox, { filename: "edit-with-ai.html <script>" });
  const helper = sandbox.__v;

  const broken = [];
  for (const name of fs.readdirSync(path.join(root, "starters")).filter((f) => f.endsWith(".edit.html"))) {
    helper.loadSource(read(`starters/${name}`), name);
    const data = helper.state().currentData;
    assert(data, `${name} does not load in the helper at all`);
    // Its own brand is its baseline: nothing has been edited yet.
    const stops = helper.checkShell(data, data)
      .concat(helper.checkMeaning(data))
      .concat(helper.checkAssetStrings(data))
      .filter((problem) => problem.stop);
    if (stops.length) broken.push(`${name}: ${stops[0].what}`);
  }
  assert(broken.length === 0, `the helper stops on documents we ship - ${broken.join(" | ")}`);
});

check("the release recipe resolves to a complete kit", () => {
  const release = require(path.join(root, "tools", "build-release.js"));
  const files = release.releaseFiles();
  const missing = files.filter((rel) => !fs.existsSync(path.join(root, rel)));
  assert(missing.length === 0, `the release recipe names files that do not exist: ${missing.slice(0, 3).join(", ")}`);
  const starters = files.filter((f) => f.startsWith("starters/") && f.endsWith(".edit.html"));
  const onDisk = fs.readdirSync(path.join(root, "starters")).filter((f) => f.endsWith(".edit.html"));
  assert(starters.length === onDisk.length,
    `the recipe ships ${starters.length} starters but the repository has ${onDisk.length}`);
  for (const want of ["edit-with-ai.html", "packager.html", "start-here.html", "README.md",
    "LICENSE", "THIRD_PARTY_NOTICES.md", "docs/ai-json-rules.md", "tools/cisco-icon-catalog.html"]) {
    assert(files.includes(want), `the release kit is missing ${want}`);
  }
  assert(files.filter((f) => f.startsWith("assets/icons/cisco-pms3015/")).length >= 290,
    "the official icon set in the kit is short");
  assert(files.filter((f) => f.startsWith("assets/rack-assets/")).length >= 10,
    "the rack faces in the kit are short");
});

for (const label of passes) process.stdout.write(`PASS  ${label}\n`);
for (const note of notes) process.stdout.write(`NOTE  ${note}\n`);
for (const failure of failures) process.stderr.write(`FAIL  ${failure}\n`);
process.stdout.write(`\n${failures.length ? "Validation failed" : "Validation passed"}: ${passes.length} checks, ${failures.length} failures.\n`);
if (failures.length) process.exitCode = 1;
