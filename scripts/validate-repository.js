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
check("primary editable contract", () => { primary = validateEditable("templates/network-design-template.edit.html"); });
check("alternate editable fixture contract", () => { alternate = validateEditable("tests/fixtures/alternate-dashboard.edit.html"); });

const sprite = read("symbols/network-symbols.svg");
const showcase = read("examples/vector-symbol-showcase.html");
const map = JSON.parse(read("symbols/symbol-map.json"));

check("canonical 19-symbol library", () => {
  const ids = symbolIds(sprite);
  assert(ids.length === 19, `expected 19 symbols, found ${ids.length}`);
  assert(new Set(ids).size === ids.length, "symbol IDs are not unique");
});

check("embedded vector copies match canonical sprite", () => {
  const canonical = extractDefs(sprite, "sprite");
  assert(extractDefs(primary, "primary template") === canonical, "primary template sprite drifted from symbols/network-symbols.svg");
  assert(extractDefs(showcase, "showcase") === canonical, "showcase sprite drifted from symbols/network-symbols.svg");
  assert(symbolIds(primary).length === 19, "primary template does not contain 19 symbols");
  assert(symbolIds(showcase).length === 19, "showcase does not contain 19 symbols");
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

// Each starter carries its own copy of the sprite and the semantic map. Without
// this loop they drift apart silently, which is exactly how a documentation set
// ends up with the stylesheet no longer describing the document.
for (const name of starterNames) {
  check(`starter ${name}`, () => {
    const source = validateEditable(`starters/${name}`);
    starters.push(source);
    assert(extractDefs(source, name) === extractDefs(sprite, "sprite"), "sprite drifted from symbols/network-symbols.svg");
    assert(symbolIds(source).length === 19, `expected 19 symbols, found ${symbolIds(source).length}`);
    assert(!/<image\b/i.test(source), "contains an SVG image element");

    const embedded = embeddedIconMap(source);
    assert(Object.keys(embedded).length === Object.keys(map.symbols).length, "semantic key count differs from symbol-map.json");
    for (const [key, record] of Object.entries(map.symbols)) {
      assert(JSON.stringify(embedded[key]) === JSON.stringify(record), `${key} differs from symbol-map.json`);
    }

    const data = JSON.parse(scriptById(source, "proof-data"));
    const nodeIds = new Set((data.topology?.nodes || []).map((node) => node.id));
    const zoneIds = new Set((data.topology?.zones || []).map((zone) => zone.id));
    assert(nodeIds.size === (data.topology?.nodes || []).length, "duplicate topology node id");
    for (const link of data.topology?.links || []) {
      assert(nodeIds.has(link.from), `link references missing node ${link.from}`);
      assert(nodeIds.has(link.to), `link references missing node ${link.to}`);
    }
    const occupied = new Map();
    for (const device of data.rack?.devices || []) {
      assert(typeof device.position === "number" && typeof device.height === "number", `${device.id} position/height must be numbers`);
      assert(device.position >= 1 && device.position + device.height - 1 <= (data.rack.units || 42), `${device.id} does not fit the rack`);
      for (let unit = device.position; unit < device.position + device.height; unit++) {
        assert(!occupied.has(unit), `${device.id} overlaps ${occupied.get(unit)} at U${unit}`);
        occupied.set(unit, device.id);
      }
    }
    const findings = data.sections?.findings?.items || [];
    assert(findings.length > 0, "a starter kit must record its own gaps");
    findings.forEach((item, index) => {
      const anchors = item.at == null ? [] : (Array.isArray(item.at) ? item.at : [item.at]);
      for (const id of anchors) assert(nodeIds.has(id), `gap ${index + 1} pins to missing device ${id}`);
      if (item.atZone !== undefined) assert(zoneIds.has(item.atZone), `gap ${index + 1} pins to missing zone ${item.atZone}`);
    });
    assert(findings.some((item) => item.at != null || item.atZone !== undefined), "no gap is pinned to the drawing");
  });
}

check("editable vector files contain no raster image payloads", () => {
  for (const [label, source] of [["primary", primary], ["showcase", showcase], ["sprite", sprite]]) {
    assert(!/<image\b/i.test(source), `${label} contains an SVG image element`);
    assert(!source.includes("data:image/"), `${label} contains a raster data URI`);
  }
});

check("local asset references resolve when vendor assets are present", () => {
  const iconDirectory = path.join(root, "vendor-local", "icons", "cisco-pms3015");
  const rackDirectory = path.join(root, "vendor-local", "rack-assets");
  if (!fs.existsSync(iconDirectory) || !fs.existsSync(rackDirectory)) {
    notes.push("vendor-local assets absent; binary reference validation skipped");
    return;
  }
  const iconFiles = fs.readdirSync(iconDirectory).filter((name) => name.toLowerCase().endsWith(".jpg"));
  const rackFiles = fs.readdirSync(rackDirectory).filter((name) => name.toLowerCase().endsWith(".png"));
  assert(iconFiles.length === 294, `expected 294 local Cisco JPGs, found ${iconFiles.length}`);
  assert(rackFiles.length === 10, `expected 10 local rack PNGs, found ${rackFiles.length}`);
  const sources = [primary, alternate, JSON.stringify(map), ...starters];
  for (const source of sources) {
    for (const match of source.matchAll(/asset:(cisco|rack)\/([^"'<>`\r\n\\]+)/g)) {
      const directory = match[1] === "cisco" ? iconDirectory : rackDirectory;
      assert(fs.existsSync(path.join(directory, match[2])), `missing local asset: asset:${match[1]}/${match[2]}`);
    }
  }
});

check("generated and binary files stay in excluded directories", () => {
  const files = walk();
  const portableOutsideDist = files.filter((file) => file.endsWith(".portable.html") && !file.startsWith("dist/"));
  assert(portableOutsideDist.length === 0, `portable output outside dist: ${portableOutsideDist.join(", ")}`);
  const binariesOutsideLocal = files.filter((file) => /\.(?:jpe?g|png|gif|webp)$/i.test(file) &&
    !file.startsWith("vendor-local/") && !file.startsWith("dist/"));
  assert(binariesOutsideLocal.length === 0, `raster assets outside excluded directories: ${binariesOutsideLocal.join(", ")}`);
});

for (const label of passes) process.stdout.write(`PASS  ${label}\n`);
for (const note of notes) process.stdout.write(`NOTE  ${note}\n`);
for (const failure of failures) process.stderr.write(`FAIL  ${failure}\n`);
process.stdout.write(`\n${failures.length ? "Validation failed" : "Validation passed"}: ${passes.length} checks, ${failures.length} failures.\n`);
if (failures.length) process.exitCode = 1;
