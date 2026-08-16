"use strict";

// Keeps the user-facing apps supplied with the pieces they cannot fetch:
//
//   edit-with-ai.html  <- the blank template (base64 capsule: "Start a new
//                         design" cannot read the disk) and the packaging
//                         engine (its final step builds portable files)
//   packager.html      <- the same packaging engine, byte-identical
//
// Sources of truth: starters/network-design-template.edit.html and
// tools/packager-core.js. The validator holds every injected copy identical
// to its source, so editing an injected block by hand is a build failure.
//
// Run after changing either source:  npm run build:helper

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");

function inject(filePath, begin, end, block, anchorFinder) {
  let source = fs.readFileSync(filePath, "utf8");
  const at = source.indexOf(begin);
  if (at !== -1) {
    const stop = source.indexOf(end, at);
    if (stop === -1) throw new Error(`${path.basename(filePath)}: ${begin} without ${end}`);
    source = source.slice(0, at) + block + source.slice(stop + end.length);
  } else {
    const anchor = anchorFinder(source);
    if (anchor === -1) throw new Error(`${path.basename(filePath)}: no anchor for ${begin}`);
    source = source.slice(0, anchor) + block + "\n\n" + source.slice(anchor);
  }
  fs.writeFileSync(filePath, source);
}

/* -- the blank template, into the helper -- */
const template = fs.readFileSync(path.join(root, "starters", "network-design-template.edit.html"));
const TPL_BEGIN = "<!-- EMBEDDED-TEMPLATE:BEGIN -->";
const TPL_END = "<!-- EMBEDDED-TEMPLATE:END -->";
const templateBlock = [
  TPL_BEGIN,
  '<script id="embedded-template" type="application/octet-stream">',
  template.toString("base64"),
  "</" + "script>",
  TPL_END
].join("\n");

/* -- the packaging engine, into both apps -- */
const core = fs.readFileSync(path.join(root, "tools", "packager-core.js"), "utf8").trimEnd();
if (/<\/script/i.test(core)) throw new Error("packager-core.js contains a literal closing script tag and cannot be inlined");
const CORE_BEGIN = "<!-- PACKAGER-CORE:BEGIN -->";
const CORE_END = "<!-- PACKAGER-CORE:END -->";
const coreBlock = [
  CORE_BEGIN,
  '<script id="packager-core">',
  core,
  "</" + "script>",
  CORE_END
].join("\n");

const firstScript = (source) => source.indexOf("<script>");

const helperPath = path.join(root, "edit-with-ai.html");
inject(helperPath, CORE_BEGIN, CORE_END, coreBlock, firstScript);
inject(helperPath, TPL_BEGIN, TPL_END, templateBlock, firstScript);

const packagerPath = path.join(root, "packager.html");
inject(packagerPath, CORE_BEGIN, CORE_END, coreBlock, firstScript);

console.log(`template capsule: ${template.length.toLocaleString()} bytes -> ${Math.round(template.length * 4 / 3 / 1024)} KB base64 in edit-with-ai.html`);
console.log(`packager core: ${core.length.toLocaleString()} bytes into edit-with-ai.html and packager.html`);
