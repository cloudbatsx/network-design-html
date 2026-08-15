"use strict";

/* Behaviour tests for tools/edit-with-ai.html.
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
const helper = fs.readFileSync(path.join(root, "tools", "edit-with-ai.html"), "utf8");
const script = helper.match(/<script>([\s\S]*)<\/script>/);
assert(script, "tools/edit-with-ai.html no longer contains a script block");

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
  Blob, TextDecoder, structuredClone, setTimeout, console
};

const shim = ";globalThis.__exports = { parseWithRepair, mergeReply, checkStructure, checkMeaning, checkShell, checkAssetStrings, looksTruncated, safeJson, contextFor, summarizeChange, editableParts, freshRequestText, freshDrawingId, brandedData, EXTRACT_PROMPT, SLICES };";
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
  data.topology.nodes[1].x = 375; data.topology.nodes[1].y = 303;
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

test("parts: a sheet without a declaration is not editable", () => {
  const data = baseDesign();
  data.topology.canvas = { viewBox: "0 0 100 100" };
  assert.deepStrictEqual(json(t.editableParts(data)), []);
});

test("parts: a sheet offers exactly what it declares", () => {
  const data = baseDesign();
  data.topology.canvas = { viewBox: "0 0 100 100" };
  data.editing = { grammar: "sheet", parts: ["rack", "findings"] };
  assert.deepStrictEqual(json(t.editableParts(data)), ["rack", "findings"]);
});

test("parts: a declared drawing part is stripped, not honoured", () => {
  const data = baseDesign();
  data.topology.canvas = { viewBox: "0 0 100 100" };
  data.editing = { grammar: "sheet", parts: ["nodes", "topology", "all", "rack"] };
  assert.deepStrictEqual(json(t.editableParts(data)), ["rack"]);
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

test("wizard: choosing no rack records the absence as a gap", () => {
  const text = t.freshRequestText("T", "T-NET-001", "none");
  assert(/No rack/.test(text) && /absence of physical documentation as a gap/.test(text));
  assert(!/Small rack/.test(text));
});

test("wizard: drawing ids derive from title initials and never come out empty", () => {
  assert.strictEqual(t.freshDrawingId("Our Organization Network"), "OON-NET-001");
  assert.strictEqual(t.freshDrawingId(""), "NET-001");
});

test("wizard: the diagram-reading prompt asks for lists, ids and areas, and no code", () => {
  assert(/short id/.test(t.EXTRACT_PROMPT));
  assert(/three plain-text lists/.test(t.EXTRACT_PROMPT));
  assert(/Do not write any code yet/.test(t.EXTRACT_PROMPT));
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

test("branding: a real path and viewBox land together", () => {
  const { next, problem } = t.brandedData(baseDesign(), { path: "M10 10 H 90 V 90 H 10 Z", viewBox: "0 0 100 100", fill: "#123abc" });
  assert(!problem);
  assert.strictEqual(next.document.brand.logoPath, "M10 10 H 90 V 90 H 10 Z");
  assert.strictEqual(next.document.brand.logoViewBox, "0 0 100 100");
  assert.strictEqual(next.document.brand.logoFill, "#123abc");
});

/* ---- runner ---- */

let failed = 0;
for (const { name, run } of tests) {
  try {
    run();
    process.stdout.write(`PASS  ${name}\n`);
  } catch (error) {
    failed += 1;
    process.stderr.write(`FAIL  ${name}: ${error.message}\n`);
  }
}
process.stdout.write(`\n${failed ? "Behaviour tests failed" : "Behaviour tests passed"}: ${tests.length - failed}/${tests.length}.\n`);
if (failed) process.exitCode = 1;
