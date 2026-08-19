"use strict";

/* Behaviour tests for edit-with-ai.html.
 *
 * The helper is a single self-contained HTML file, so its logic cannot be
 * imported. The one script block is extracted as text and evaluated in a
 * sandbox with a stub DOM, and an export shim appended to the same source
 * exposes the functions under test. Nothing here modifies the helper: if the
 * script grows load-time behaviour the stub cannot satisfy, this file fails
 * loudly rather than silently testing less.
 *
 * Run directly (node tests/edit-with-ai.test.js) or via npm test.
 */

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");

const root = path.resolve(__dirname, "..");
const helper = fs.readFileSync(path.join(root, "edit-with-ai.html"), "utf8");
const script = helper.match(/<script>([\s\S]*)<\/script>/);
assert(script, "edit-with-ai.html no longer contains a script block");

function stubElement() {
  const element = {
    value: "", textContent: "", disabled: false, hidden: false, open: false,
    className: "", children: [], dataset: {}, style: {},
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    addEventListener() {}, removeEventListener() {},
    replaceChildren() { element.children = []; },
    appendChild(child) { element.children.push(child); return child; },
    append() {}, remove() {}, click() {}, setAttribute() {},
    querySelector: () => stubElement(), querySelectorAll: () => []
  };
  return element;
}

const elements = new Map();
const sandbox = {
  document: {
    getElementById(id) { if (!elements.has(id)) elements.set(id, stubElement()); return elements.get(id); },
    createElement: () => stubElement(),
    createTextNode: (text) => ({ text }),
    body: stubElement(),
    querySelectorAll: () => []
  },
  navigator: {},
  URL: { createObjectURL: () => "blob:test", revokeObjectURL() {} },
  Blob, TextDecoder, structuredClone, setTimeout, console,
  // The helper's final step drives the real packaging engine; the sandbox
  // gets the same one the build injects, straight from its source of truth.
  PACKAGER_CORE: require(path.join(root, "tools", "packager-core.js"))
};

const shim = ";globalThis.__exports = { parseWithRepair, mergeReply, checkStructure, checkMeaning, checkShell, checkAssetStrings, looksTruncated, safeJson, contextFor, summarizeChange, editableParts, freshRequestText, freshDrawingId, brandedData, EXTRACT_PROMPT, SLICES, polishGeometry, layoutRulesFor, grammarRulesFor, svgLogoFrom, fillIdentityFromDrawing, buildPrompt, restyleTopology, sectionedData," +
  " setData: (d) => { currentData = d; }," +
  " setRequest: (text) => { document.getElementById('request').value = text; }," +
  " setSlice: (name) => { document.getElementById('slice').value = name; } };";
vm.runInNewContext(script[1] + shim, sandbox, { filename: "edit-with-ai.html <script>" });
const t = sandbox.__exports;

/* A small valid design in the coordinate grammar. Tests mutate their own copy. */
function baseDesign() {
  return {
    document: {
      drawing: "TEST-001",
      brand: { logoPath: "M0 0 H10 V10 Z Z Z" },
      evidence: { color: "red" },
      footer: { caveat: "c", redaction: "r" }
    },
    topology: {
      canvas: { width: 1280, height: 930 },
      zones: [{ id: "z1", label: "Zone", kind: "internal", x: 60, y: 80, width: 1100, height: 700 }],
      nodes: [
        { id: "core-sw-01", label: "Core", icon: "core-switch", x: 300, y: 300 },
        { id: "edge-fw-01", label: "Edge", icon: "firewall", x: 700, y: 300 }
      ],
      links: [{ from: "core-sw-01", to: "edge-fw-01", kind: "l3" }]
    },
    rack: {
      units: 42,
      devices: [
        { id: "core-sw-01", model: "X", role: "core", position: 40, height: 1, asset: "generic" },
        { id: "srv-01", model: "Y", role: "server", position: 10, height: 2, asset: "generic" }
      ]
    },
    sections: { findings: { items: [{ title: "T", detail: "D", at: "core-sw-01" }] } }
  };
}

const tests = [];
function test(name, run) { tests.push({ name, run }); }
const has = (problems, pattern, stop) =>
  problems.some((problem) => pattern.test(problem.what) && (stop === undefined || problem.stop === stop));

// Values parsed inside the sandbox carry the sandbox realm's prototypes, which
// deepStrictEqual counts as a difference. A JSON round-trip re-homes them.
const json = (value) => JSON.parse(JSON.stringify(value));

/* ---- the repair chain ---- */

test("repair: a fenced reply parses", () => {
  const { parsed, applied } = t.parseWithRepair('```json\n{"a":1}\n```');
  assert.deepStrictEqual(json(parsed), { a: 1 });
  assert(applied.includes("removed a code fence"));
});

test("repair: prose around the JSON is ignored", () => {
  const { parsed } = t.parseWithRepair('Here is the updated data:\n{"a":1}\nHope that helps!');
  assert.deepStrictEqual(json(parsed), { a: 1 });
});

test("repair: trailing commas and comments are stripped outside strings", () => {
  const { parsed } = t.parseWithRepair('{"label":"a, b, c", /* note */ "list":[1,2,],}');
  assert.deepStrictEqual(json(parsed), { label: "a, b, c", list: [1, 2] });
});

test("repair: curly quotes are the last resort and work", () => {
  const { parsed, applied } = t.parseWithRepair('{"a":“it’s”}');
  assert.strictEqual(parsed.a, "it's");
  assert.strictEqual(applied.at(-1), "replaced curly quotes");
});

test("repair: garbage stays unparsed", () => {
  assert.strictEqual(t.parseWithRepair("no json here at all").parsed, undefined);
});

/* ---- truncation detection ---- */

test("truncation: an unclosed object is truncated", () => {
  assert.strictEqual(t.looksTruncated('{"a":[1,2'), true);
});

test("truncation: a bare array is NOT truncated (regression)", () => {
  assert.strictEqual(t.looksTruncated("[1,2]"), false);
});

test("truncation: a complete object is not truncated", () => {
  assert.strictEqual(t.looksTruncated('{"a":1}'), false);
});

/* ---- merge ---- */

test("merge: the nested part replaces only its own path", () => {
  const original = baseDesign();
  const reply = { topology: { nodes: [{ id: "core-sw-01", icon: "router", x: 300, y: 300 }] } };
  const { merged, problems } = t.mergeReply(reply, original, "nodes");
  assert.strictEqual(merged.topology.nodes.length, 1);
  assert.deepStrictEqual(merged.rack, original.rack);
  assert.deepStrictEqual(merged.topology.links, original.topology.links);
  assert.strictEqual(problems.filter((p) => p.stop).length, 0);
});

test("merge: a bare array with the wrapper left off is accepted with a warning", () => {
  const original = baseDesign();
  const reply = [{ id: "core-sw-01", icon: "router", x: 300, y: 300 }];
  const { merged, problems } = t.mergeReply(reply, original, "nodes");
  assert(merged, "the bare array was rejected");
  assert.strictEqual(merged.topology.nodes.length, 1);
  assert(has(problems, /left off the "topology\.nodes" wrapper/, false));
});

test("merge: out-of-scope parts in the reply are dropped, not applied", () => {
  const original = baseDesign();
  const reply = {
    topology: { nodes: original.topology.nodes, links: [] },
    rack: { units: 12, devices: [] },
    document: { drawing: "HIJACKED" }
  };
  const { merged, problems } = t.mergeReply(reply, original, "nodes");
  assert.deepStrictEqual(merged.rack, original.rack, "the reply's rack leaked into the merge");
  assert.strictEqual(merged.document.drawing, "TEST-001");
  assert.deepStrictEqual(merged.topology.links, original.topology.links);
  assert(has(problems, /also sent/, false));
});

test("merge: a shape mismatch is rejected outright", () => {
  const { merged, problems } = t.mergeReply({ foo: 1 }, baseDesign(), "nodes");
  assert.strictEqual(merged, null);
  assert(has(problems, /does not contain/, true));
});

/* Replacing an object part wholesale is the merge contract, but a part sent
   back smaller than it was is a deletion nothing downstream can see:
   sections answered with only its overview used to wipe the findings with
   zero warnings. Arrays are exempt - removing a device is honest editing
   the change list already shows. */
test("merge: a reply that quietly drops whole keys from a part is named", () => {
  const original = baseDesign();
  original.sections.overview = { heading: "Overview", notes: ["Old."] };
  const reply = { sections: { overview: { heading: "Overview", notes: ["Rewritten."] } } };
  const { merged, problems } = t.mergeReply(reply, original, "sections");
  assert(has(problems, /no longer contains findings/, false),
    "wiping the findings by omission earned no warning");
  assert.strictEqual(problems.filter((p) => p.stop).length, 0,
    "the deletion notice must warn, not stop - it may be exactly what was asked for");
  assert.strictEqual(Object.keys(merged.sections).length, 1);
});

test("merge: the taught no-rack form replaces the schedule without complaint", () => {
  const original = baseDesign();
  const reply = { rack: { applicable: false, statement: "Logical view only." } };
  const { problems } = t.mergeReply(reply, original, "rack");
  assert(!has(problems, /no longer contains/),
    "the recommended no-rack form was scolded for dropping the schedule");
});

test("merge: removing a device from a list is editing, not deletion", () => {
  const original = baseDesign();
  const reply = { topology: { nodes: [original.topology.nodes[0]] } };
  const { problems } = t.mergeReply(reply, original, "nodes");
  assert(!has(problems, /no longer contains/),
    "an array shrink was reported as a key deletion");
});

/* ---- the whole design is validated after merging ---- */

test("whole-design: a gap pinned to a device the reply removed is caught", () => {
  const original = baseDesign();
  const reply = { topology: { nodes: [{ id: "edge-fw-01", icon: "firewall", x: 700, y: 300 }] } };
  const { merged } = t.mergeReply(reply, original, "nodes");
  const problems = t.checkShell(merged);
  assert(has(problems, /pinned to "core-sw-01"/, true));
});

/* ---- geometry ---- */

test("geometry: off-canvas is a stop", () => {
  const data = baseDesign();
  data.topology.nodes[0].x = 10;
  assert(has(t.checkMeaning(data), /off the left edge/, true));
});

test("geometry: a real pile-up is a stop", () => {
  const data = baseDesign();
  data.topology.nodes[1].x = data.topology.nodes[0].x;
  data.topology.nodes[1].y = data.topology.nodes[0].y;
  assert(has(t.checkMeaning(data), /sit on top of each other/, true));
});

test("geometry: a corner kiss is a warning, not a stop", () => {
  const data = baseDesign();
  data.topology.nodes[0].x = 200; data.topology.nodes[0].y = 200;
  data.topology.nodes[1].x = 293; data.topology.nodes[1].y = 303;
  const problems = t.checkMeaning(data);
  assert(has(problems, /overlap by a few pixels/, false));
  assert(!has(problems, /overlap/, true), "the corner kiss was wrongly promoted to a stop");
});

test("geometry: the viewBox grammar is exempt from every geometry rule", () => {
  const data = baseDesign();
  data.topology.canvas = { viewBox: "0 0 100 100" };
  data.topology.nodes[1].x = data.topology.nodes[0].x;
  data.topology.nodes[1].y = data.topology.nodes[0].y;
  const problems = t.checkMeaning(data);
  assert(!has(problems, /overlap|edge|half in/), "geometry rules ran on a viewBox document");
});

/* ---- which parts a design may edit ---- */

test("parts: the coordinate grammar supports every part", () => {
  assert.strictEqual(t.editableParts(baseDesign()), null);
});

test("parts: the retired sheet grammar is not editable", () => {
  const data = baseDesign();
  data.topology.canvas = { viewBox: "0 0 100 100" };
  assert.deepStrictEqual(json(t.editableParts(data)), []);
});

test("parts: a legacy sheet declaration is refused, not honoured", () => {
  const data = baseDesign();
  data.topology.canvas = { viewBox: "0 0 100 100" };
  data.editing = { grammar: "sheet", parts: ["rack", "findings", "nodes", "all"] };
  assert.deepStrictEqual(json(t.editableParts(data)), []);
});

/* ---- the sheet grammar in the whole-design checks ---- */

test("structure: a design that never had a rack is not required to grow one", () => {
  const original = baseDesign();
  delete original.rack;
  const merged = json(original);
  const problems = t.checkStructure("{}", merged, "findings", original);
  assert(!has(problems, /"rack" section is missing/), "a rackless sheet was blocked on its missing rack");
});

test("structure: a missing topology is still a stop when the original had one", () => {
  const original = baseDesign();
  const merged = json(original);
  delete merged.topology;
  assert(has(t.checkStructure("{}", merged, "findings", original), /"topology" section is missing/, true));
});

test("vocab: a sheet's own link kinds are not graded against the template's list", () => {
  const data = baseDesign();
  data.topology.canvas = { viewBox: "0 0 100 100" };
  data.topology.links[0].kind = "physical-10g";
  assert(!has(t.checkMeaning(data), /invisible line/), "a sheet link kind was graded against the template stylesheet");
});

test("vocab: an off-list link kind still warns in the coordinate grammar", () => {
  const data = baseDesign();
  data.topology.links[0].kind = "physical-10g";
  assert(has(t.checkMeaning(data), /invisible line/, false));
});

/* ---- the rack ---- */

test("rack: a face whose U does not match the height is a stop", () => {
  const data = baseDesign();
  data.rack.devices[0].asset = "generic-server-2u";
  assert(has(t.checkMeaning(data), /draws 2U/, true));
});

test("rack: duplicate rack ids are a stop", () => {
  const data = baseDesign();
  data.rack.devices[1].id = data.rack.devices[0].id;
  assert(has(t.checkMeaning(data), /share the id/, true));
});

test("rack: an overlap is a stop and names the free units", () => {
  const data = baseDesign();
  data.rack.devices[1].position = 40;
  const problems = t.checkMeaning(data);
  assert(has(problems, /both occupy U40/, true));
  assert(problems.some((p) => /Free units are/.test(p.tell)));
});

test("rack: a string-typed height is a stop that names the problem", () => {
  const data = baseDesign();
  data.rack.devices[0].height = "1";
  assert(has(t.checkMeaning(data), /text instead of a number/, true));
});

/* ---- the byte-exact splice ---- */

test("save: safeJson defuses every character that could break the file", () => {
  const out = t.safeJson({ a: "<b>&</b>", note: "x y" });
  assert(!out.includes("<") && !out.includes(">") && !out.includes("&"));
  assert(out.includes("\\u003c") && out.includes("\\u003e") && out.includes("\\u0026"));
  assert(out.includes("\\u2028"));
});

test("save: the splice touches nothing outside the data block", () => {
  const prefix = '<html><script id="proof-data" type="application/json">';
  const suffix = "</" + "script><footer>asset:cisco/x.jpg</footer></html>";
  const source = prefix + '{"old":true}' + suffix;
  const start = prefix.length, end = source.length - suffix.length;
  const out = source.slice(0, start) + "\n" + t.safeJson(baseDesign()) + "\n" + source.slice(end);
  assert.strictEqual(out.slice(0, start), source.slice(0, start));
  assert.strictEqual(out.slice(out.length - suffix.length), suffix);
});

/* ---- the reference block ---- */

test("context: an edit to the devices is told what the rack and links depend on", () => {
  const text = t.contextFor(baseDesign(), "nodes");
  assert(text.includes("Devices also listed in the rack: core-sw-01"));
  assert(text.includes("Devices that connections depend on: core-sw-01, edge-fw-01"));
  assert(text.includes("FOR REFERENCE ONLY"));
});

/* ---- the change list has no blind spots ---- */

test("changes: deleting a reserved unit is reported", () => {
  const before = baseDesign();
  before.rack.reserved = [{ position: 5, height: 1, label: "GROWTH" }];
  const after = json(before);
  after.rack.reserved = [];
  const group = t.summarizeChange(before, after).find((g) => g.label === "Reserved units");
  assert(group && group.lines.some((line) => line.kind === "remove" && /U5/.test(line.text)),
    "a deleted reserved unit went unreported");
});

test("changes: a canvas resize is reported", () => {
  const before = baseDesign();
  const after = json(before);
  after.topology.canvas.width = 1600;
  const group = t.summarizeChange(before, after).find((g) => g.label === "Canvas");
  assert(group && group.lines.some((line) => /canvas\.width 1280 → 1600/.test(line.text)),
    "a canvas resize went unreported");
});

test("changes: an aisle swap is reported", () => {
  const before = baseDesign();
  before.rack.frontAisle = "cold aisle";
  const after = json(before);
  after.rack.frontAisle = "hot aisle";
  const group = t.summarizeChange(before, after).find((g) => g.label === "Rack details");
  assert(group && group.lines.some((line) => /frontAisle/.test(line.text)),
    "an aisle change went unreported");
});

test("changes: an unnamed field cannot change invisibly", () => {
  const before = baseDesign();
  before.validation = { declared: 1 };
  const after = json(before);
  after.validation = { declared: 2 };
  const group = t.summarizeChange(before, after).find((g) => g.label === "Everything else");
  assert(group && group.lines.some((line) => /validation changed/.test(line.text)),
    "an unknown top-level field changed invisibly");
});

/* ---- the fresh-build wizard ---- */

test("wizard: the build request carries the title, id, zones, rack and gaps rules", () => {
  const text = t.freshRequestText("Our Organization Network", "OUR-NET-001", "small");
  assert(text.includes('Title "Our Organization Network"'));
  assert(text.includes("drawing id OUR-NET-001"));
  assert(/external area/.test(text) && /internal area/.test(text));
  assert(/Small rack/.test(text));
  assert(/gaps list/.test(text));
});

test("wizard: every question left empty still builds a complete request", () => {
  const text = t.freshRequestText("", "", "auto");
  assert(/Choose a fitting document title/.test(text), "empty title did not delegate naming");
  assert(/title's initials/.test(text), "empty id did not delegate the drawing id");
  assert(/If the diagram shows rack-mountable devices/.test(text), "auto rack did not delegate");
  assert(/gaps list/.test(text));
  assert(!text.includes('""'), "an empty answer leaked into the request");
});

test("wizard: an explicit title still wins, and derives the id when that is empty", () => {
  const text = t.freshRequestText("Acme Branch Network", "", "small");
  assert(text.includes('Title "Acme Branch Network"'));
  assert(text.includes("drawing id ABN-NET-001"));
});

test("wizard: choosing no rack records the absence as a gap", () => {
  const text = t.freshRequestText("T", "T-NET-001", "none");
  assert(/No rack/.test(text) && /absence of physical documentation as a gap/.test(text));
  assert(!/Small rack/.test(text));
});

test("wizard: drawing ids derive from title initials and never come out empty", () => {
  assert.strictEqual(t.freshDrawingId("Our Organization Network"), "OON-NET-001");
  assert.strictEqual(t.freshDrawingId(""), "NET-001");
});

test("wizard: the diagram-reading prompt captures all five lists and no code", () => {
  assert(/five plain-text lists/.test(t.EXTRACT_PROMPT));
  assert(/short id/.test(t.EXTRACT_PROMPT));
  assert(/interface or port names/.test(t.EXTRACT_PROMPT));
  assert(/licenses and their dates/.test(t.EXTRACT_PROMPT));
  assert(/SSIDs/.test(t.EXTRACT_PROMPT));
  assert(/expired, or end-of-life/.test(t.EXTRACT_PROMPT));
  assert(/Do not write any code yet/.test(t.EXTRACT_PROMPT));
});

test("wizard: repetition is counted and condensation must be confessed", () => {
  assert(/count every device/.test(t.EXTRACT_PROMPT), "the extraction no longer demands a device count");
  assert(/state the total/.test(t.EXTRACT_PROMPT), "the count is not required to be stated");
  assert(/one per line/.test(t.EXTRACT_PROMPT), "repeated devices are no longer forced onto their own lines");
  const text = t.freshRequestText("T", "T-NET-001", "auto");
  assert(/every device in the inventory/.test(text), "the build request dropped the completeness rule");
  assert(/condensed or omitted as a finding/.test(text), "condensation no longer has to be confessed");
});

test("wizard: the build request pushes the captured detail into the document", () => {
  const text = t.freshRequestText("T", "T-NET-001", "auto");
  assert(/interface or port names as connection labels/.test(text));
  assert(/identity table rows/.test(text));
  assert(/end-of-life becomes a finding/.test(text));
  assert(/caption and legend/.test(text));
});

/* ---- the branding panel ---- */

test("branding: named fields change, everything else survives untouched", () => {
  const base = baseDesign();
  const originalPath = base.document.brand.logoPath;
  const { next, problem } = t.brandedData(base, { name: "Acme Corp", label: "IT Infrastructure" });
  assert(!problem);
  assert.strictEqual(next.document.brand.name, "Acme Corp");
  assert.strictEqual(next.document.brand.label, "IT Infrastructure");
  assert.strictEqual(next.document.brand.logoPath, originalPath, "the logo path was disturbed");
  assert.deepStrictEqual(json(next.topology), json(base.topology));
});

test("branding: empty fields keep what the file already has", () => {
  const base = baseDesign();
  base.document.brand.name = "Existing";
  const { next } = t.brandedData(base, { name: "", label: "  " });
  assert.strictEqual(next.document.brand.name, "Existing");
});

test("branding: a broken logo path or colour is refused with a plain reason", () => {
  assert(/angle brackets|looks wrong/.test(t.brandedData(baseDesign(), { path: "M0 0<script>" }).problem));
  assert(t.brandedData(baseDesign(), { path: "M0 0" }).problem, "a too-short path was accepted");
  assert(/hex value/.test(t.brandedData(baseDesign(), { fill: "blue" }).problem));
});

test("branding: a small PNG data URI stages as the one allowed raster", () => {
  const uri = "data:image/png;base64," + "iVBORw0KGgoAAAANSUhEUg".repeat(3);
  const { next, problem } = t.brandedData(baseDesign(), { image: uri });
  assert(!problem, problem);
  assert.strictEqual(next.document.brand.logoImage, uri);
});

test("branding: a non-image or oversized data URI is refused plainly", () => {
  assert(/not a valid PNG, JPG or SVG/.test(t.brandedData(baseDesign(), { image: "data:text/html;base64,PGh0bWw+" }).problem));
  const huge = "data:image/png;base64," + "A".repeat(95000);
  assert(/too large/.test(t.brandedData(baseDesign(), { image: huge }).problem));
});

test("branding: an SVG logo stages with its own proportions", () => {
  const uri = "data:image/svg+xml;base64," + Buffer.from('<svg viewBox="0 0 320 80"></svg>').toString("base64");
  const { next, problem } = t.brandedData(baseDesign(), { image: uri, imageViewBox: "0 0 320 80" });
  assert(!problem, problem);
  assert.strictEqual(next.document.brand.logoImage, uri);
  assert.strictEqual(next.document.brand.logoViewBox, "0 0 320 80", "a wide lockup must not be squared off");
});

test("logo file: an SVG reports the proportions it declares", () => {
  assert.strictEqual(t.svgLogoFrom('<svg viewBox="0 0 320 80" xmlns="http://www.w3.org/2000/svg"></svg>').viewBox, "0 0 320 80");
  assert.strictEqual(t.svgLogoFrom('<svg width="240" height="60"></svg>').viewBox, "0 0 240 60", "width and height stand in for a missing viewBox");
  assert.strictEqual(t.svgLogoFrom("<svg></svg>").viewBox, "0 0 512 512", "a square default when the file declares nothing");
});

test("logo file: a scripted SVG is refused, a plain one is not", () => {
  assert(/not an SVG/.test(t.svgLogoFrom("<html><body>hello</body></html>").problem));
  assert(/carries a script/.test(t.svgLogoFrom('<svg viewBox="0 0 10 10"><script>alert(1)</script></svg>').problem));
  assert(/carries a script/.test(t.svgLogoFrom('<svg viewBox="0 0 10 10"><rect onload="steal()"/></svg>').problem));
  assert(/carries a script/.test(t.svgLogoFrom('<svg viewBox="0 0 10 10"><a href="javascript:x()"/></svg>').problem));
  assert(!t.svgLogoFrom('<svg viewBox="0 0 10 10"><rect fill="#c2661d"/></svg>').problem, "a plain drawing is fine");
});

test("branding: a real path and viewBox land together", () => {
  const { next, problem } = t.brandedData(baseDesign(), { path: "M10 10 H 90 V 90 H 10 Z", viewBox: "0 0 100 100", fill: "#123abc" });
  assert(!problem);
  assert.strictEqual(next.document.brand.logoPath, "M10 10 H 90 V 90 H 10 Z");
  assert.strictEqual(next.document.brand.logoViewBox, "0 0 100 100");
  assert.strictEqual(next.document.brand.logoFill, "#123abc");
});

/* ---- the packaging core: partial builds ---- */

const CORE = require(path.join(root, "tools", "packager-core.js"));

function miniEditable() {
  const contract = JSON.stringify({
    schema: "network-design-package/v2", assetReferences: "asset-uri/v1",
    assetUriSchemes: { cisco: "icons/cisco-pms3015/", rack: "rack-assets/" }
  });
  return [
    "<!doctype html><html><body>",
    "<!-- NETWORK-PACKAGER-CONTRACT:BEGIN -->",
    '<script id="network-packager-contract" type="application/json">',
    contract,
    "</scr" + "ipt>",
    "<!-- NETWORK-PACKAGER-CONTRACT:END -->",
    "<!-- NETWORK-ASSET-VAULT:BEGIN -->",
    '<script id="network-asset-vault" type="application/json">',
    "{}",
    "</scr" + "ipt>",
    "<!-- NETWORK-ASSET-VAULT:END -->",
    "<!-- EDITABLE-SOURCE-CAPSULE:BEGIN -->",
    '<script id="editable-source-capsule" type="application/octet-stream">',
    "",
    "</scr" + "ipt>",
    "<!-- EDITABLE-SOURCE-CAPSULE:END -->",
    '<p data-a="asset:rack/tiny.png" data-b="asset:cisco/tiny.jpg"></p>',
    "</body></html>"
  ].join("\n");
}

const TINY_PNG = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="), (c) => c.charCodeAt(0));
const fakeFile = (name, relativePath, bytes) => ({
  name, relativePath, size: bytes.length, lastModified: 1,
  arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
});

test("packaging: a partial build embeds what it has and reports the rest", async () => {
  const clean = CORE.cleanEditable(miniEditable());
  CORE.validateContract(clean);
  const ids = CORE.scanAssetIds(clean);
  assert.deepStrictEqual(ids, ["asset:cisco/tiny.jpg", "asset:rack/tiny.png"]);
  const artwork = CORE.emptyArtwork();
  CORE.indexInto(artwork, [fakeFile("tiny.png", "assets/rack-assets/tiny.png", TINY_PNG)]);
  const entries = CORE.resolveEntries(ids, artwork);
  const { portable, report } = await CORE.buildPortable(clean, entries);
  assert.strictEqual(report.embedded, 1);
  assert.strictEqual(report.skipped.length, 1);
  assert.strictEqual(report.skipped[0].id, "asset:cisco/tiny.jpg");
  assert.strictEqual(report.skipped[0].reason, "not found");
  assert.strictEqual(CORE.decodeUtf8Base64(CORE.readRegionScript(portable, CORE.BLOCKS.capsule)), clean,
    "the capsule did not round-trip");
  assert.strictEqual(CORE.maskProtected(portable), CORE.maskProtected(clean),
    "bytes outside the protected blocks changed");
});

test("packaging: wrong-format artwork is excluded, not embedded", async () => {
  const clean = CORE.cleanEditable(miniEditable());
  const artwork = CORE.emptyArtwork();
  // PNG bytes offered where a JPEG is required
  CORE.indexInto(artwork, [fakeFile("tiny.jpg", "assets/icons/cisco-pms3015/tiny.jpg", TINY_PNG)]);
  const entries = CORE.resolveEntries(CORE.scanAssetIds(clean), artwork);
  const { report } = await CORE.buildPortable(clean, entries);
  const wrong = report.skipped.find((item) => item.id === "asset:cisco/tiny.jpg");
  assert(wrong && /JPEG is required/.test(wrong.reason), "the mime mismatch was not reported");
  assert.strictEqual(report.embedded, 0);
});

/* ---- the geometry polish ---- */

test("polish: a slight overlap is separated, reported, and satisfies the checker", () => {
  const d = baseDesign();
  // dx = 86 of the 94-wide drawn symbol: an 8.5% overlap, the warning band.
  d.topology.nodes[1].x = 386;
  const { next, applied } = t.polishGeometry(d);
  assert.strictEqual(applied.length, 1);
  assert(/moved "(edge-fw-01|core-sw-01)" \d+px \w+ to clear "/.test(applied[0]), applied[0]);
  assert(!has(t.checkMeaning(json(next)), /overlap/), "the checker still sees the overlap");
});

test("polish: a straddler that plainly belongs is seated fully inside", () => {
  const d = baseDesign();
  // Zone z1 ends at x 1160; a centre at 1138 leaves the symbol 73% inside.
  d.topology.nodes[1].x = 1138;
  const { next, applied } = t.polishGeometry(d);
  assert.strictEqual(applied.length, 1);
  assert(/to sit fully inside "z1"/.test(applied[0]), applied[0]);
  assert(!has(t.checkMeaning(json(next)), /half in and half out/), "the checker still sees the straddle");
});

test("polish: a genuinely ambiguous straddler is left alone", () => {
  const d = baseDesign();
  // A centre at 1188 leaves the symbol 40% inside z1 - which side it belongs
  // on is a judgement call, so the warning must survive.
  d.topology.nodes[1].x = 1188;
  const { next, applied } = t.polishGeometry(d);
  assert.strictEqual(applied.length, 0);
  assert(has(t.checkMeaning(json(next)), /half in and half out/, false), "the ambiguity was guessed away");
});

test("polish: a pile-up is a stop and is never repaired", () => {
  const d = baseDesign();
  d.topology.nodes[1].x = 330;
  d.topology.nodes[1].y = 320;
  const { next, applied } = t.polishGeometry(d);
  assert.strictEqual(applied.length, 0);
  assert(has(t.checkMeaning(json(next)), /sit on top of each other/, true), "the stop was hidden by a repair");
});

test("polish: an area drawn too small for its own device is grown, not guessed", () => {
  const d = baseDesign();
  // The straddler's inward path is blocked by a fully-seated neighbour that
  // is not itself a straddler, so no node move is sound - the area's right
  // edge grows the 54px that holds the box instead.
  d.topology.nodes[0].x = 1044;
  d.topology.nodes[1].x = 1138;
  const { next, applied } = t.polishGeometry(d);
  assert.strictEqual(applied.length, 1);
  assert(/grew the area "z1" 31px right to hold "edge-fw-01"/.test(applied[0]), applied[0]);
  assert(!has(t.checkMeaning(json(next)), /half in and half out/), "the straddle survived the grow");
});

test("polish: a full row shifts as a chain when one push lands on the next box", () => {
  const d = baseDesign();
  d.topology.nodes[1].x = 386; // 8.5% overlap with core-sw-01 at 300
  d.topology.nodes.push({ id: "srv-x-01", label: "S", icon: "server", x: 480, y: 300 });
  const { next, applied } = t.polishGeometry(d);
  assert.strictEqual(applied.length, 2, applied.join("; "));
  assert(/moved "edge-fw-01" 16px right to clear "core-sw-01"/.test(applied[0]), applied[0]);
  assert(/moved "srv-x-01" 16px right to make room for "edge-fw-01"/.test(applied[1]), applied[1]);
  assert(!has(t.checkMeaning(json(next)), /overlap/), "an overlap survived the chain");
});

test("polish: clean geometry is untouched", () => {
  const d = baseDesign();
  const { next, applied } = t.polishGeometry(d);
  assert.strictEqual(applied.length, 0);
  assert.deepStrictEqual(json(next), json(d));
});

test("polish: the engineering-sheet grammar is never touched", () => {
  const d = baseDesign();
  d.topology.canvas = {};
  d.topology.nodes[1].x = 460;
  const { next, applied } = t.polishGeometry(d);
  assert.strictEqual(applied.length, 0);
  assert.deepStrictEqual(json(next), json(d));
});

/* ---- the layout construction rules ---- */

test("prompt: parts that place devices carry the construction grid", () => {
  for (const name of ["nodes", "zones", "topology", "all"]) {
    const rules = t.layoutRulesFor(name);
    assert(/Construct positions, never estimate them/.test(rules), name);
    assert(/200 apart across, 140 apart down/.test(rules), name);
    assert(/raise topology\.canvas\.height/.test(rules), name);
    assert(/never justifies dropping a device/.test(rules), name);
  }
});

test("prompt: parts that place nothing carry no grid", () => {
  for (const name of ["links", "rack", "findings", "sections", "document"]) {
    assert.strictEqual(t.layoutRulesFor(name), "", name);
  }
});

/* ---- section 3 restates what the drawing already says ---- */

function addressedDesign() {
  const d = baseDesign();
  d.sections.identity = { heading: "Identity & addressing", notes: [], columns: [], rows: [] };
  d.topology.nodes[0].address = "10.0.0.1/24";
  d.topology.nodes[0].role = "Core switch";
  d.topology.nodes[1].address = "10.0.0.2/24";
  d.topology.nodes[1].role = "Edge firewall";
  return d;
}

test("fill: an empty identity table is written from the devices that carry an address", () => {
  const { next, applied } = t.fillIdentityFromDrawing(addressedDesign(), "all");
  assert.strictEqual(applied.length, 1, applied.join("; "));
  assert(/filled the identity table from the 2 devices/.test(applied[0]), applied[0]);
  assert.deepStrictEqual(json(next.sections.identity.columns), ["Device", "Role", "Address", "Source"]);
  assert.strictEqual(next.sections.identity.rows.length, 2);
  assert.deepStrictEqual(json(next.sections.identity.rows[0].cells),
    ["core-sw-01", "Core switch", "10.0.0.1/24", "From the drawing"]);
});

test("fill: a table the model wrote itself is never overwritten", () => {
  const d = addressedDesign();
  d.sections.identity.columns = ["Function", "VLAN", "Range"];
  d.sections.identity.rows = [{ cells: ["Users", "10", "10.0.10.0/24"] }];
  const { next, applied } = t.fillIdentityFromDrawing(d, "all");
  assert.strictEqual(applied.length, 0, "an authored table was rewritten");
  assert.deepStrictEqual(json(next.sections.identity.rows), json(d.sections.identity.rows));
});

test("fill: nothing is invented when the devices carry no addresses", () => {
  const d = addressedDesign();
  for (const node of d.topology.nodes) delete node.address;
  const { applied } = t.fillIdentityFromDrawing(d, "all");
  assert.strictEqual(applied.length, 0, "addresses were invented from nothing");
});

test("fill: a subnet bar is not a device and never becomes a row", () => {
  const d = addressedDesign();
  d.topology.nodes.push({ id: "seg-users", shape: "segment", x: 400, y: 600, width: 500, address: "10.0.10.0/24" });
  const { next } = t.fillIdentityFromDrawing(d, "all");
  assert(!next.sections.identity.rows.some((row) => row.cells[0] === "seg-users"),
    "a rail was listed as a device");
});

test("fill: editing one part does not quietly rewrite another", () => {
  for (const scope of ["nodes", "links", "rack", "findings", "document"]) {
    assert.strictEqual(t.fillIdentityFromDrawing(addressedDesign(), scope).applied.length, 0, scope);
  }
});

test("rack: an empty rack beside mountable devices is named, not filled", () => {
  const d = addressedDesign();
  d.rack = { units: 42, devices: [] };
  const problems = t.checkMeaning(d);
  assert(has(problems, /The rack is empty, but 2 devices/, false), problems.map((p) => p.what).join(" | "));
  const advice = problems.find((p) => /rack is empty/.test(p.what));
  assert(/position, a height and a face code/.test(advice.tell), "the advice does not say what to add");
  assert(/applicable.*false/.test(advice.tell), "the deliberate-no-rack escape is not offered");
});

test("rack: a design with nothing mountable is not nagged", () => {
  const d = addressedDesign();
  d.rack = { units: 42, devices: [] };
  d.topology.nodes.forEach((node) => { node.icon = "pc"; });
  assert(!has(t.checkMeaning(d), /The rack is empty/), "a laptop-and-cloud drawing was told to build a rack");
});

test("rack: a deliberate no-rack statement is a valid shape, not a missing list", () => {
  const original = baseDesign();
  const reply = JSON.parse(JSON.stringify(original));
  reply.rack = { applicable: false, statement: "Wall-mounted; no rack at this site." };
  const stops = t.checkStructure("{}", reply, "all", original).filter((p) => p.stop);
  assert.strictEqual(stops.length, 0,
    "the escape hatch the prompt teaches and the empty-rack warning recommends was refused: " +
    stops.map((p) => p.what).join(" | "));
});

test("rack: a deliberate no-rack statement silences the ask", () => {
  const d = addressedDesign();
  d.rack = { applicable: false, statement: "Cloud-hosted; no premises equipment." };
  assert(!has(t.checkMeaning(d), /The rack is empty/), "a declared absence was still nagged");
});

/* ---- the three ways a build can start ---- */

test("source: a picture build still works from the inventory the AI read", () => {
  const text = t.freshRequestText("T", "T-NET-001", "auto", { mode: "picture" });
  assert(/^Build this whole design from the inventory above\./.test(text), text.slice(0, 80));
  assert(/every device in the inventory/.test(text));
});

test("source: no arguments still means the picture path (nothing regressed)", () => {
  assert(/from the inventory above/.test(t.freshRequestText("T", "T-NET-001", "auto")));
});

test("source: a described network travels inside the request", () => {
  const description = "Two sites joined by IPsec. Each has a router, a firewall and one switch.";
  const text = t.freshRequestText("", "", "auto", { mode: "describe", description });
  assert(text.includes(description), "the description never reached the prompt");
  assert(/from this description of the network/.test(text));
  assert(/never a guess/.test(text), "the honesty rule is missing from the described path");
  assert(!/inventory above/.test(text), "it still claims an inventory that does not exist");
  assert(/every device in the description/.test(text), "completeness is still worded for an inventory");
});

test("source: an example build says plainly that nothing in it was surveyed", () => {
  const text = t.freshRequestText("", "", "auto", { mode: "sample" });
  assert(/Invent a small plausible network/.test(text));
  assert(/worked example and nothing in it was surveyed/.test(text),
    "an invented document does not confess that it is invented");
  assert(!/inventory above/.test(text), "it still claims an inventory that does not exist");
});

/* ---- what the client's stuck session bought us ---- */

test("brand: a document that never had a logo path is not accused of destroying one", () => {
  const original = baseDesign();
  original.document.brand = { name: "", label: "", logoPath: "" };
  const reply = JSON.parse(JSON.stringify(original));
  assert.strictEqual(t.checkShell(reply, original).filter((p) => p.stop).length, 0,
    "the blank template's own brand was treated as a destroyed logo");
});

test("brand: a real logo path emptied by the model is still a stop", () => {
  const original = baseDesign();   // ships a genuine logoPath
  const reply = JSON.parse(JSON.stringify(original));
  reply.document.brand.logoPath = "";
  assert(has(t.checkShell(reply, original), /shortened or emptied/, true),
    "a genuinely destroyed logo slipped through");
});

test("brand: a staged logo image excuses the missing path", () => {
  const original = baseDesign();
  const reply = JSON.parse(JSON.stringify(original));
  reply.document.brand.logoPath = "";
  reply.document.brand.logoImage = "data:image/png;base64,iVBORw0KGgo=";
  assert.strictEqual(t.checkShell(reply, original).filter((p) => p.stop).length, 0,
    "a document branded with an image was told its logo was destroyed");
});

test("brand: a brand deleted whole is a destroyed logo, not a free pass", () => {
  const original = baseDesign();   // ships a genuine logoPath
  const reply = JSON.parse(JSON.stringify(original));
  delete reply.document.brand;
  assert(has(t.checkShell(reply, original), /removed, shortened or emptied/, true),
    "deleting document.brand outright slipped past the logo guard");
});

test("brand: an image-branded document is protected like a path-branded one", () => {
  const original = baseDesign();
  original.document.brand = { name: "Client", logoImage: "data:image/png;base64,iVBORw0KGgo=" };
  const reply = JSON.parse(JSON.stringify(original));
  reply.document.brand = { name: "Client" };
  assert(has(t.checkShell(reply, original), /removed, shortened or emptied/, true),
    "dropping logoImage from an image-branded document went unnoticed");
});

/* The drawing measures a 94-wide symbol and a 10-tall rail, not the 176x104
   card the group is positioned by. Measuring the card put every device drawn
   above its own subnet bar into a pile-up stop - which is what the prompt
   started producing the day it learned to draw bars. */
test("geometry: a device sitting above its own subnet bar is not an overlap", () => {
  const d = baseDesign();
  d.topology.nodes.push({ id: "seg-users", label: "USERS", shape: "segment", x: 300, y: 380, width: 700 });
  d.topology.links.push({ from: "core-sw-01", to: "seg-users", kind: "access" });
  const problems = t.checkMeaning(d);
  assert(!has(problems, /overlap|sit on top of each other/),
    "the bar and its own member were called an overlap: " + problems.map((p) => p.what).join(" | "));
});

test("geometry: two parallel subnet bars 70px apart do not overlap", () => {
  const d = baseDesign();
  d.topology.nodes.push({ id: "seg-a", label: "A", shape: "segment", x: 600, y: 600, width: 900 });
  d.topology.nodes.push({ id: "seg-b", label: "B", shape: "segment", x: 600, y: 670, width: 740 });
  assert(!has(t.checkMeaning(d), /overlap|sit on top of each other/),
    "two rails a comfortable 70px apart were called an overlap");
});

test("geometry: a subnet bar is never asked which area it belongs to", () => {
  const d = baseDesign();
  // A rail deliberately spanning the whole drawing, crossing the zone edge.
  d.topology.nodes.push({ id: "seg-wide", label: "W", shape: "segment", x: 640, y: 400, width: 1240 });
  assert(!has(t.checkMeaning(d), /half in and half out/),
    "a subnet bar was asked to pick an area");
});

test("geometry: two devices a symbol-width apart are left alone", () => {
  const d = baseDesign();
  // 130px apart: the spacing the shipped NET-HQ-002 uses, and it reads fine.
  d.topology.nodes[0].x = 300;
  d.topology.nodes[1].x = 430;
  assert(!has(t.checkMeaning(d), /overlap|sit on top of each other/),
    "devices that do not touch were reported as overlapping");
});

test("geometry: a genuine pile-up is still a stop", () => {
  const d = baseDesign();
  d.topology.nodes[1].x = 320;
  d.topology.nodes[1].y = 310;
  assert(has(t.checkMeaning(d), /sit on top of each other/, true),
    "the overlap check stopped catching real pile-ups");
});

/* ---- the optional drawing grammar ---- */

test("grammar: the parts that draw devices are offered caption sides", () => {
  for (const name of ["nodes", "topology", "all"]) {
    assert(/labelSide/.test(t.grammarRulesFor(name)), name);
    assert(/left one "left", the/.test(t.grammarRulesFor(name)), `${name} lost the paired-device guidance`);
  }
});

test("grammar: the write-up parts are offered tables, caption and legend", () => {
  for (const name of ["sections", "all"]) {
    const rules = t.grammarRulesFor(name);
    assert(/"tables"/.test(rules), name);
    assert(/one cell per column/.test(rules), `${name} never states the row/column rule`);
    assert(/"layer": "gap"/.test(rules), `${name} never offers the unverified row`);
    assert(/"caption" and "legend"/.test(rules), `${name} never offers the figure caption`);
  }
});

test("grammar: the rack part is offered the deliberate absence", () => {
  for (const name of ["rack", "all"]) {
    assert(/"applicable": false/.test(t.grammarRulesFor(name)), name);
  }
  assert(/Never combine/.test(t.grammarRulesFor("rack")), "the contradiction is not forbidden");
});

test("grammar: a part carries only the grammar it can use", () => {
  assert.strictEqual(t.grammarRulesFor("document"), "", "cover details need no drawing grammar");
  assert.strictEqual(t.grammarRulesFor("findings"), "", "the gaps list needs no drawing grammar");
  assert(!/tables/.test(t.grammarRulesFor("nodes")), "the devices part should not carry table rules");
  assert(!/labelSide/.test(t.grammarRulesFor("rack")), "the rack part should not carry caption rules");
});

test("grammar: the parts that draw links are offered elbow lanes with their arithmetic", () => {
  for (const name of ["links", "topology", "all"]) {
    const rules = t.grammarRulesFor(name);
    assert(/"route": "elbow"/.test(rules), name);
    assert(/steps 18 px on/.test(rules), `${name} never states the lane step`);
    assert(/never estimates/.test(rules), `${name} lets the model estimate lanes`);
  }
  assert(!/elbow/.test(t.grammarRulesFor("nodes")), "the devices part should not carry link routing");
});

test("grammar: the parts that draw devices are offered subnet bars, sized by arithmetic", () => {
  for (const name of ["nodes", "topology", "all"]) {
    const rules = t.grammarRulesFor(name);
    assert(/"shape": "segment"/.test(rules), name);
    assert(/MORE THAN TWO devices share one network/.test(rules), `${name} never states when to use a bar`);
    assert(/rightmost member x -\s+leftmost member x/.test(rules), `${name} never states how to size the bar`);
  }
});

/* The grammar is only safe to teach if the checkers accept what it produces.
   A model that draws a correct subnet bar and gets stopped for it would be
   worse off than one that never tried. */
test("grammar: the checkers accept a subnet bar and an elbow lane", () => {
  const design = baseDesign();
  design.topology.nodes.push({
    id: "seg-users", label: "USERS - VLAN 10", shape: "segment",
    x: 500, y: 600, width: 700, color: "#2458b3", labelSide: "right"
  });
  design.topology.nodes.push({ id: "acc-sw-01", label: "Access", icon: "access-switch", x: 300, y: 500, labelSide: "left" });
  design.topology.links.push({ from: "acc-sw-01", to: "seg-users", kind: "access", route: "elbow", elbowAt: 550 });
  const problems = t.checkMeaning(design).concat(t.checkShell(design)).concat(t.checkAssetStrings(design));
  const stops = problems.filter((p) => p.stop);
  assert.strictEqual(stops.length, 0,
    "the grammar the prompt now teaches was rejected: " + stops.map((p) => p.what).join(" | "));
});

test("grammar: the polish pass leaves a subnet bar alone", () => {
  const design = baseDesign();
  design.topology.nodes.push({
    id: "seg-users", label: "USERS", shape: "segment",
    x: 500, y: 600, width: 700, color: "#2458b3"
  });
  const { next } = t.polishGeometry(design);
  const bar = next.topology.nodes.find((node) => node.id === "seg-users");
  assert.strictEqual(bar.x, 500, "the bar was moved sideways");
  assert.strictEqual(bar.y, 600, "the bar was moved vertically");
  assert.strictEqual(bar.width, 700, "the bar was resized");
});

test("grammar: the SHAPE rule points at the exceptions instead of forbidding them", () => {
  const built = t.grammarRulesFor("all");
  assert(/OPTIONAL GRAMMAR/.test(built), "the section never names itself");
  assert(/none is required/.test(built), "the grammar never says it is optional");
});

test("grammar: the write-up parts teach the hostname anatomy, honestly scoped", () => {
  for (const name of ["sections", "all"]) {
    const rules = t.grammarRulesFor(name);
    assert(/identity\.naming/.test(rules), `${name} never mentions the anatomy`);
    assert(/ONLY from names actually on the drawing/.test(rules),
      `${name} teaches the figure without the honesty rule`);
    assert(/leave it out/.test(rules), `${name} never says the block is skippable`);
  }
  assert(!/identity\.naming/.test(t.grammarRulesFor("rack")),
    "the rack part carries anatomy rules it cannot use");
});

test("shell: a hostname anatomy too thin to draw is warned, never stopped", () => {
  const design = baseDesign();
  design.sections.identity = { naming: { parts: [{ text: "fw" }] } };
  const problems = t.checkShell(design, design);
  assert(has(problems, /fewer than two usable parts/, false),
    "an undrawable naming block earned no warning");
  design.sections.identity.naming.parts = [
    { text: "fw", label: "Role" }, { text: "01", label: "Unit" }
  ];
  assert(!has(t.checkShell(design, design), /fewer than two usable parts/),
    "a drawable naming block was warned anyway");
});

/* ---- the prompt carries every byte ---- */

/* A replacement string hands $$, $&, $` and $' to String.replace as
   substitution patterns. A note reading "in $'000" used to splice the
   prompt's own tail into the JSON the model was shown, and "costs $$"
   silently became "costs $" - which the model then echoed back, and every
   checker accepted. The fix is function replacers; this pins it. */
test("prompt: text that looks like a replacement pattern travels byte-for-byte", () => {
  const design = baseDesign();
  design.topology.nodes[0].notes = "budget in $'000, cost $$, match $&, col $`";
  t.setData(design);
  t.setSlice("nodes");
  t.setRequest("the PSU option costs $& and $$ installed");
  const prompt = t.buildPrompt();
  assert(prompt.includes("budget in $'000, cost $$, match $&, col $`"),
    "a note with dollar sequences must reach the model unaltered");
  assert(prompt.includes("the PSU option costs $& and $$ installed"),
    "a request with dollar sequences must reach the model unaltered");
  assert(!prompt.includes("<<<"),
    "no placeholder token may survive substitution or leak in via a $-pattern");
});

/* ---- the section chooser ---- */

test("sections: the chooser writes and clears document.omit, and filters nonsense", () => {
  const base = baseDesign();
  const next = t.sectionedData(base, ["operations", "equipment", "overview", "bogus"]);
  assert.deepStrictEqual(json(next.document.omit), ["operations", "equipment"],
    "locked or unknown keys crept into document.omit");
  const cleared = t.sectionedData(next, []);
  assert.strictEqual(cleared.document.omit, undefined, "an empty choice must remove the key");
});

test("sections: the shell check holds the omit contract", () => {
  const design = baseDesign();
  design.document.omit = ["operations", "overview"];
  const problems = t.checkShell(design, design);
  assert(has(problems, /"overview", which is not a section that can be left out/, false),
    "omitting a locked section earned no warning");
  assert.strictEqual(problems.filter((p) => p.stop).length, 0,
    "a bad omit key must warn, not stop");
  design.document.omit = ["identity", "change", "operations", "equipment"];
  assert(!has(t.checkShell(design, design), /left out/),
    "the four omittable sections were scolded");
  design.document.omit = "operations";
  assert(has(t.checkShell(design, design), /not a list/, false),
    "a non-list omit slipped through");
});

/* ---- the style converter ---- */

/* A hub with four single-homed devices fanning in below it - the taught
   subnet-bar case, with one spoke deliberately reversed and one labelled. */
function fanDesign() {
  const design = baseDesign();
  design.topology.zones = [];
  design.topology.nodes = [
    { id: "core", label: "Core", icon: "core-switch", x: 640, y: 200 },
    { id: "pc-1", icon: "pc", x: 400, y: 400 },
    { id: "pc-2", icon: "pc", x: 560, y: 400 },
    { id: "pc-3", icon: "pc", x: 720, y: 400 },
    { id: "pc-4", icon: "pc", x: 880, y: 400 }
  ];
  design.topology.links = [
    { from: "core", to: "pc-1", kind: "access" },
    { from: "core", to: "pc-2", kind: "access" },
    { from: "pc-3", to: "core", kind: "access" },
    { from: "core", to: "pc-4", kind: "access", label: "Gi0/4" }
  ];
  design.sections = { findings: { items: [{ title: "T", detail: "D" }] } };
  return design;
}

const linkShape = (links) => JSON.stringify(links.map((l) => [l.from, l.to, l.kind || "", l.label || ""]).sort());

test("style: a leaf fan becomes one bar with the taught arithmetic", () => {
  const { next, applied, counts } = t.restyleTopology(fanDesign(), "sheet");
  assert.strictEqual(counts.bars, 1, "one fan, one bar");
  const bar = next.topology.nodes.find((node) => node.shape === "segment");
  assert(bar, "no bar was drawn");
  assert.strictEqual(bar.width, (880 - 400) + 120, "width is not (spread + 120)");
  assert.strictEqual(bar.x, 640, "x is not halfway between the outer members");
  assert.strictEqual(bar.y, 300, "y is not between the hub and its devices");
  const barLinks = next.topology.links.filter((l) => l.from === bar.id || l.to === bar.id);
  assert.strictEqual(barLinks.length, 5, "four taps plus the hub");
  const labelled = barLinks.find((l) => l.label === "Gi0/4");
  assert(labelled, "a spoke's label was lost in the conversion");
  assert(barLinks.every((l) => (l.kind || "l3") === "access"), "spoke kinds were not preserved");
  assert.strictEqual(t.checkMeaning(next).filter((p) => p.stop).length, 0);
  assert.strictEqual(applied.length, 1);
  assert(/was not surveyed/.test(bar.notes), "the bar does not confess it was derived, not surveyed");
});

test("style: diagonals sharing ground take separate lanes; drops and pairs stay direct", () => {
  const design = baseDesign();
  design.topology.zones = [];
  design.topology.nodes = [
    { id: "a1", icon: "router", x: 200, y: 200 }, { id: "b1", icon: "server", x: 600, y: 500 },
    { id: "a2", icon: "router", x: 400, y: 200 }, { id: "b2", icon: "server", x: 900, y: 500 },
    { id: "c1", icon: "firewall", x: 1100, y: 200 }, { id: "c2", icon: "firewall", x: 1100, y: 500 }
  ];
  design.topology.links = [
    { from: "a1", to: "b1", kind: "l3" },
    { from: "a2", to: "b2", kind: "l3" },
    { from: "c1", to: "c2", kind: "l3" }
  ];
  design.sections = { findings: { items: [{ title: "T", detail: "D" }] } };
  const { next, counts } = t.restyleTopology(design, "sheet");
  const [e1, e2] = next.topology.links.filter((l) => l.route === "elbow");
  assert.strictEqual(counts.lanes, 2, "exactly the two diagonals take lanes");
  assert(Math.abs(e1.elbowAt - e2.elbowAt) >= 16, "overlapping lanes are not kept apart");
  for (const lane of [e1.elbowAt, e2.elbowAt]) {
    assert(lane > 270 && lane < 430, `lane ${lane} left the corridor between the rows`);
  }
  const drop = next.topology.links.find((l) => l.from === "c1");
  assert.strictEqual(drop.route, undefined, "a straight vertical drop was given a pointless elbow");
});

/* The two failure modes the archived free-model runs exposed: a corridor
   midpoint that lands ON an intermediate device row, and a corridor so
   congested no lane passes clear at all. The first must dodge; the second
   must refuse - a lane through a symbol is worse than a diagonal. */
test("style: a lane dodges a device sitting on the corridor midpoint", () => {
  const design = baseDesign();
  design.topology.zones = [];
  design.topology.nodes = [
    { id: "s", icon: "router", x: 200, y: 200 },
    { id: "t", icon: "server", x: 600, y: 760 },
    { id: "mid-row", icon: "pc", x: 400, y: 480 }
  ];
  design.topology.links = [{ from: "s", to: "t", kind: "l3" }];
  design.sections = { findings: { items: [{ title: "T", detail: "D" }] } };
  const { next } = t.restyleTopology(design, "sheet");
  const link = next.topology.links[0];
  assert.strictEqual(link.route, "elbow", "a clean dodge existed and was not taken");
  assert(Math.abs(link.elbowAt - 480) >= 60, `lane ${link.elbowAt} runs through the device on the midpoint`);
});

test("style: a congested corridor refuses the elbow and says so", () => {
  const design = baseDesign();
  design.topology.zones = [];
  design.topology.nodes = [
    { id: "s", icon: "router", x: 200, y: 200 },
    { id: "t", icon: "server", x: 260, y: 760 },
    { id: "block-1", icon: "pc", x: 230, y: 340 },
    { id: "block-2", icon: "pc", x: 230, y: 480 },
    { id: "block-3", icon: "pc", x: 230, y: 620 }
  ];
  design.topology.links = [{ from: "s", to: "t", kind: "l3" }];
  design.sections = { findings: { items: [{ title: "T", detail: "D" }] } };
  const { next, skipped } = t.restyleTopology(design, "sheet");
  assert.strictEqual(next.topology.links[0].route, undefined, "an elbow was forced through a wall of devices");
  assert(skipped.some((line) => /direct/.test(line)), "the refusal was silent");
});

test("style: an ha pair is captioned outward", () => {
  const design = baseDesign();
  design.topology.links[0].kind = "ha";
  const { next, counts } = t.restyleTopology(design, "sheet");
  const left = next.topology.nodes.find((n) => n.id === "core-sw-01");
  const right = next.topology.nodes.find((n) => n.id === "edge-fw-01");
  assert.strictEqual(counts.captioned, 2);
  assert.strictEqual(left.labelSide, "left");
  assert.strictEqual(right.labelSide, "right");
});

test("style: sheet then grid is a round trip - the fan comes back exactly", () => {
  const original = fanDesign();
  const sheet = t.restyleTopology(original, "sheet").next;
  const { next, counts } = t.restyleTopology(sheet, "grid");
  assert.strictEqual(counts.dissolved, 1);
  assert(!next.topology.nodes.some((n) => n.shape === "segment"), "the bar survived its own dissolution");
  assert.strictEqual(linkShape(next.topology.links), linkShape(original.topology.links),
    "the fan did not come back as it was - direction, kind or label drifted");
  assert.strictEqual(t.checkMeaning(next).filter((p) => p.stop).length, 0);
});

test("style: a bar with two possible hubs is left alone and said so", () => {
  const design = baseDesign();
  design.topology.zones = [];
  design.topology.nodes = [
    { id: "fw-a", icon: "firewall", x: 500, y: 200 }, { id: "fw-b", icon: "firewall", x: 800, y: 200 },
    { id: "web-1", icon: "server", x: 500, y: 500 }, { id: "web-2", icon: "server", x: 800, y: 500 },
    { id: "dmz", label: "DMZ", shape: "segment", x: 650, y: 350, width: 500, color: "#c2661d" }
  ];
  design.topology.links = [
    { from: "fw-a", to: "fw-b", kind: "ha" },
    { from: "fw-a", to: "dmz", kind: "l3" }, { from: "fw-b", to: "dmz", kind: "l3" },
    { from: "web-1", to: "dmz", kind: "access" }, { from: "web-2", to: "dmz", kind: "access" }
  ];
  design.sections = { findings: { items: [{ title: "T", detail: "D" }] } };
  const { next, skipped, counts } = t.restyleTopology(design, "grid");
  assert.strictEqual(counts.dissolved, 0);
  assert(next.topology.nodes.some((n) => n.id === "dmz"), "an authored bar was destroyed on a guess");
  assert(skipped.some((line) => /could be its hub/.test(line)), "the refusal was silent");
});

test("style: an external network is never absorbed into a subnet bar", () => {
  const design = fanDesign();
  design.topology.nodes.push({ id: "carrier-ring", icon: "cloud", x: 1000, y: 400 });
  design.topology.links.push({ from: "core", to: "carrier-ring", kind: "l3" });
  const { next } = t.restyleTopology(design, "sheet");
  const bar = next.topology.nodes.find((n) => n.shape === "segment");
  assert(bar, "the four real endpoints still deserve their bar");
  const cloudLink = next.topology.links.find((l) => l.to === "carrier-ring" || l.from === "carrier-ring");
  assert(cloudLink.from === "core" || cloudLink.to === "core",
    "a carrier ring was drawn as a host on the LAN segment");
  assert.strictEqual(bar.width, (880 - 400) + 120, "the bar sized itself around the cloud");
});

test("style: hand-routed via links are untouchable in both directions", () => {
  const design = fanDesign();
  design.topology.links[3].via = [[880, 300]];   // pc-4's spoke is hand-routed
  const { next } = t.restyleTopology(design, "sheet");
  const viaLink = next.topology.links.find((l) => l.via);
  assert(viaLink && viaLink.from === "core" && viaLink.to === "pc-4",
    "a hand-routed spoke was absorbed into a bar");
  assert.strictEqual(viaLink.route, undefined, "a via link was given an elbow on top of its waypoints");
  const bar = next.topology.nodes.find((n) => n.shape === "segment");
  assert(bar, "three clean spokes still deserve their bar");
  assert.strictEqual(next.topology.links.filter((l) => l.from === bar.id || l.to === bar.id).length, 4,
    "the bar took more or fewer taps than the three clean spokes plus the hub");
});

test("style: a bar a gap marker points at is never dissolved", () => {
  const original = fanDesign();
  const sheet = t.restyleTopology(original, "sheet").next;
  const bar = sheet.topology.nodes.find((n) => n.shape === "segment");
  sheet.sections.findings.items.push({ title: "Unverified segment", detail: "D", at: bar.id });
  const { next, skipped, counts } = t.restyleTopology(sheet, "grid");
  assert.strictEqual(counts.dissolved, 0);
  assert(next.topology.nodes.some((n) => n.shape === "segment"), "an anchored bar was dissolved");
  assert(skipped.some((line) => /gap marker/.test(line)), "the refusal was silent");
});

test("style: converting never touches the rack, the write-up or the cover", () => {
  const original = fanDesign();
  const { next } = t.restyleTopology(original, "sheet");
  assert.deepStrictEqual(json(next.rack), json(original.rack));
  assert.deepStrictEqual(json(next.sections), json(original.sections));
  assert.deepStrictEqual(json(next.document), json(original.document));
});

test("style: no shipped starter is broken by either conversion", () => {
  const startersDir = path.join(root, "starters");
  const OPEN = '<script id="proof-data"';
  for (const name of fs.readdirSync(startersDir).filter((f) => f.endsWith(".edit.html"))) {
    const text = fs.readFileSync(path.join(startersDir, name), "utf8");
    const tagEnd = text.indexOf(">", text.indexOf(OPEN));
    const data = JSON.parse(text.slice(tagEnd + 1, text.indexOf("</" + "script>", tagEnd)));
    const stopsOf = (d) => t.checkMeaning(d).concat(t.checkShell(d, data)).filter((p) => p.stop).length;
    const before = stopsOf(data);
    for (const target of ["sheet", "grid"]) {
      const { next } = t.restyleTopology(data, target);
      assert(stopsOf(next) <= before, `${name}: converting to ${target} minted a new stop`);
      // Pressing the same button twice must find nothing left to do.
      const twice = t.restyleTopology(next, target);
      assert.strictEqual(twice.applied.length, 0,
        `${name}: converting to ${target} twice applied again: ${twice.applied[0] || ""}`);
    }
  }
});

/* ---- the inventory gate and artifact rotation (the free-model runner) ---- */

const gateTools = require(path.join(root, "tools", "run-free-model-tests.js"));

test("gate: the stated count parses in every phrasing the record contains", () => {
  assert.strictEqual(gateTools.statedDeviceCount("**Total Device Count:** 41 devices"), 41);
  assert.strictEqual(gateTools.statedDeviceCount("Total device count: 33"), 33);
  assert.strictEqual(gateTools.statedDeviceCount("Total Devices: 15"), 15);
  assert.strictEqual(gateTools.statedDeviceCount("Device Count Summary: 12"), 12);
  assert.strictEqual(gateTools.statedDeviceCount("**Total Physical/Logical Hardware Devices:** **35**"), 35);
  assert.strictEqual(gateTools.statedDeviceCount("There are 9 devices in total."), 9);
  assert.strictEqual(gateTools.statedDeviceCount("I see some switches and a router."), null);
});

test("gate: a missing count is reported, never waved through", () => {
  const gate = gateTools.inventoryShortfall("no numbers here", { topology: { nodes: [{}] } });
  assert.strictEqual(gate.gate, "no-count-found");
  assert.strictEqual(gate.short, false);
});

test("gate: an unrelated 'omitted' finding is not a confession", () => {
  const data = { topology: { nodes: [{}, {}] }, sections: { findings: { items: [
    { title: "Firmware & Serial Numbers Omitted", detail: "Software versions, OS releases, and device serial numbers are unrecorded." }
  ] } } };
  const gate = gateTools.inventoryShortfall("Total device count: 5", data);
  assert.strictEqual(gate.gate, "shortfall");
  assert.strictEqual(gate.short, true);
});

test("gate: a numbered consolidation finding is a confession", () => {
  const data = { topology: { nodes: [{}, {}] }, sections: { findings: { items: [
    { title: "Endpoint Aggregation in Topology Diagram", detail: "10x Roku units, 8x security cameras, and 5x access points have been aggregated into single functional nodes." }
  ] } } };
  const gate = gateTools.inventoryShortfall("Total device count: 41", data);
  assert.strictEqual(gate.gate, "confessed");
  assert.strictEqual(gate.short, false);
});

test("gate: meeting the stated count needs no confession", () => {
  const gate = gateTools.inventoryShortfall("Total device count: 2", { topology: { nodes: [{}, {}] }, sections: {} });
  assert.strictEqual(gate.gate, "met");
  assert.strictEqual(gate.short, false);
});

test("gate: the prompts demand the exact count line and numbered confessions", () => {
  assert(/Total device count: 12/.test(t.EXTRACT_PROMPT), "the extraction no longer demands the exact count line");
  const text = t.freshRequestText("T", "T-NET-001", "auto");
  assert(/stating both numbers/.test(text), "the confession no longer has to state the numbers");
});

test("matrix: the nine documented edits target real parts and stand alone", () => {
  const matrix = gateTools.EDIT_MATRIX;
  assert.strictEqual(matrix.length, 9, "the protocol has nine runs");
  for (const { part, request } of matrix) {
    assert(t.SLICES[part], `unknown part: ${part}`);
    assert(request && request.length > 10, `empty request for ${part}`);
  }
  assert.strictEqual(matrix[8].part, "all", "run 9 is the Everything run");
  assert(matrix.slice(0, 8).every((entry) => entry.part !== "all"), "runs 1-8 are part-scoped");
});

test("evidence: a new run archives the last log instead of overwriting it", () => {
  const os = require("os");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ndh-rotate-"));
  try {
    fs.writeFileSync(path.join(dir, "run-log.json"), "{\"run\":\"first\"}");
    assert.strictEqual(gateTools.rotateArtifact(dir, "run-log.json"), "run-log.run1.json");
    fs.writeFileSync(path.join(dir, "run-log.json"), "{\"run\":\"second\"}");
    assert.strictEqual(gateTools.rotateArtifact(dir, "run-log.json"), "run-log.run2.json");
    assert(fs.readFileSync(path.join(dir, "run-log.run1.json"), "utf8").includes("first"));
    assert(fs.readFileSync(path.join(dir, "run-log.run2.json"), "utf8").includes("second"));
    assert(!fs.existsSync(path.join(dir, "run-log.json")));
    assert.strictEqual(gateTools.rotateArtifact(dir, "run-log.json"), null);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

/* ---- runner ---- */

(async () => {
  let failed = 0;
  for (const { name, run } of tests) {
    try {
      await run();
      process.stdout.write(`PASS  ${name}\n`);
    } catch (error) {
      failed += 1;
      process.stderr.write(`FAIL  ${name}: ${error.message}\n`);
    }
  }
  process.stdout.write(`\n${failed ? "Behaviour tests failed" : "Behaviour tests passed"}: ${tests.length - failed}/${tests.length}.\n`);
  if (failed) process.exitCode = 1;
})();
