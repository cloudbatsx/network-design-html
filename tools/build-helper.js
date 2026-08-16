"use strict";

// Injects a byte-identical copy of the blank template into edit-with-ai.html,
// base64-encoded in an inert script block - the same capsule pattern the
// packager uses for editable source. This is what lets "Start a new design"
// exist at all: a double-clicked page cannot read files off the disk, so the
// template has to travel inside the helper. The validator holds the embedded
// copy byte-identical to starters/network-design-template.edit.html, so the
// two cannot drift.
//
// Run after any change to the template:  npm run build:helper

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const helperPath = path.join(root, "edit-with-ai.html");
const templatePath = path.join(root, "starters", "network-design-template.edit.html");

const BEGIN = "<!-- EMBEDDED-TEMPLATE:BEGIN -->";
const END = "<!-- EMBEDDED-TEMPLATE:END -->";

const template = fs.readFileSync(templatePath);
const block = [
  BEGIN,
  '<script id="embedded-template" type="application/octet-stream">',
  template.toString("base64"),
  "</" + "script>",
  END
].join("\n");

let helper = fs.readFileSync(helperPath, "utf8");
const begin = helper.indexOf(BEGIN);
if (begin !== -1) {
  const end = helper.indexOf(END, begin);
  if (end === -1) throw new Error("EMBEDDED-TEMPLATE begin without end");
  helper = helper.slice(0, begin) + block + helper.slice(end + END.length);
} else {
  const anchor = helper.indexOf("<script>");
  if (anchor === -1) throw new Error("no script block to anchor the embedded template to");
  helper = helper.slice(0, anchor) + block + "\n\n" + helper.slice(anchor);
}
fs.writeFileSync(helperPath, helper);
console.log(`embedded template: ${template.length.toLocaleString()} bytes -> ${Math.round(template.length * 4 / 3 / 1024)} KB base64 in edit-with-ai.html`);
