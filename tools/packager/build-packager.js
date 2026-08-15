"use strict";

/*
 * Maintainer-only. The packager itself is no longer built: it is a tracked,
 * dependency-free page at tools/packager/network-design-packager.html that
 * reads assets/ from the checkout at runtime. What is still worth generating
 * is proof that the same contract survives a real end-to-end packaging run, so
 * this script packages two fixtures the way the browser does and writes them,
 * with a QA report, into the untracked dist/ directory.
 *
 *   node tools/packager/build-packager.js
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const repoRoot = path.resolve(__dirname, "../..");
const assetRoot = path.join(repoRoot, "assets");
const packagerPath = path.join(repoRoot, "tools", "packager", "network-design-packager.html");

const outputs = [
  {
    editablePath: path.join(repoRoot, "starters", "network-design-template.edit.html"),
    portablePath: path.join(repoRoot, "dist", "examples", "topology-and-rack.portable.html")
  },
  {
    editablePath: path.join(repoRoot, "tests", "fixtures", "alternate-dashboard.edit.html"),
    portablePath: path.join(repoRoot, "dist", "examples", "alternate-dashboard.portable.html")
  }
];

const CONTRACT_SCHEMA = "network-design-package/v2";
const ASSET_REFERENCE_SCHEMA = "asset-uri/v1";
const PORTABLE_SCHEMA = "network-asset-vault/v2";
const SCHEME_DIRS = Object.freeze({ cisco: "icons/cisco-pms3015", rack: "rack-assets" });
const BLOCKS = Object.freeze({
  contract: { begin: "<!-- NETWORK-PACKAGER-CONTRACT:BEGIN -->", end: "<!-- NETWORK-PACKAGER-CONTRACT:END -->", id: "network-packager-contract" },
  vault: { begin: "<!-- NETWORK-ASSET-VAULT:BEGIN -->", end: "<!-- NETWORK-ASSET-VAULT:END -->", id: "network-asset-vault" },
  capsule: { begin: "<!-- EDITABLE-SOURCE-CAPSULE:BEGIN -->", end: "<!-- EDITABLE-SOURCE-CAPSULE:END -->", id: "editable-source-capsule" }
});

function readUtf8(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}


// Built from escape sequences on purpose. ECMAScript counts U+2028/U+2029 as
// line terminators, so a regex literal holding one raw ends early and throws
// before this file can run; a literal control character is just as invisible.
const LINE_SEP = new RegExp("\\u2028", "g");
const PARA_SEP = new RegExp("\\u2029", "g");
const CONTROL_CHARS = new RegExp("[\\u0000-\\u001f]");

function safeJson(value, spacing = 0) {
  return JSON.stringify(value, null, spacing)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(LINE_SEP, "\\u2028")
    .replace(PARA_SEP, "\\u2029");
}

function countOf(source, token) {
  let count = 0;
  let offset = 0;
  while ((offset = source.indexOf(token, offset)) >= 0) {
    count += 1;
    offset += token.length;
  }
  return count;
}

function region(source, block) {
  if (countOf(source, block.begin) !== 1 || countOf(source, block.end) !== 1) {
    throw new Error(`${block.id} markers must each appear exactly once.`);
  }
  const begin = source.indexOf(block.begin);
  const contentStart = begin + block.begin.length;
  const end = source.indexOf(block.end, contentStart);
  if (end < contentStart) throw new Error(`${block.id} markers are out of order.`);
  return { begin, contentStart, end, afterEnd: end + block.end.length };
}

function replaceRegionInner(source, block, content) {
  const found = region(source, block);
  return source.slice(0, found.contentStart) + `\n${content}\n` + source.slice(found.end);
}

function readRegionScript(source, block) {
  const found = region(source, block);
  const inside = source.slice(found.contentStart, found.end);
  const escaped = block.id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const expression = new RegExp(
    `^\\s*<script\\b(?=[^>]*\\bid=["']${escaped}["'])[^>]*>([\\s\\S]*?)<\\/script>\\s*$`,
    "i"
  );
  const match = inside.match(expression);
  if (!match) throw new Error(`${block.id} block must contain exactly its required script element.`);
  return match[1].trim();
}

function scriptBlock(id, type, content) {
  return `<script id="${id}" type="${type}">\n${content}\n</script>`;
}

function cleanEditable(source) {
  readRegionScript(source, BLOCKS.vault);
  readRegionScript(source, BLOCKS.capsule);
  source = replaceRegionInner(source, BLOCKS.vault, scriptBlock(BLOCKS.vault.id, "application/json", "{}"));
  return replaceRegionInner(source, BLOCKS.capsule, scriptBlock(BLOCKS.capsule.id, "application/octet-stream", ""));
}

function validateContract(source) {
  const contract = JSON.parse(readRegionScript(source, BLOCKS.contract));
  if (contract.schema !== CONTRACT_SCHEMA || contract.assetReferences !== ASSET_REFERENCE_SCHEMA) {
    throw new Error("Unsupported or incomplete v2 packaging contract.");
  }
  if (contract.assetUriSchemes?.cisco !== `${SCHEME_DIRS.cisco}/` || contract.assetUriSchemes?.rack !== `${SCHEME_DIRS.rack}/`) {
    throw new Error("Immutable asset URI scheme mappings were changed.");
  }
  return contract;
}

function scanAssetIds(source) {
  let scanText = source;
  for (const block of Object.values(BLOCKS)) {
    const found = region(scanText, block);
    scanText = scanText.slice(0, found.contentStart) + "\n[PROTECTED]\n" + scanText.slice(found.end);
  }
  const matches = scanText.match(/asset:(?:cisco|rack)\/[^\s"'<>`\\]+(?: [^\s"'<>`\\]+)*/g) || [];
  const ids = [...new Set(matches.map((value) => value.replace(/[),.;:]+$/, "")))].sort((left, right) => left.localeCompare(right));
  if (ids.length > 512) throw new Error("The template exceeds the 512-asset limit.");
  return ids;
}

function assetIdToPath(id) {
  const match = /^asset:(cisco|rack)\/([^/]+)$/.exec(id);
  if (!match) throw new Error(`Invalid asset identifier syntax: ${id}`);
  const [, scheme, file] = match;
  if (file.includes("\\") || file.includes("%") || CONTROL_CHARS.test(file)) {
    throw new Error(`Unsafe asset identifier: ${id}`);
  }
  const expectedExtension = scheme === "cisco" ? ".jpg" : ".png";
  if (!file.toLowerCase().endsWith(expectedExtension)) throw new Error(`Wrong file type: ${id}`);
  return `${SCHEME_DIRS[scheme]}/${file}`;
}

function filesIn(canonicalRelativeDirectory, extension) {
  const absoluteDirectory = path.join(assetRoot, canonicalRelativeDirectory);
  if (!fs.existsSync(absoluteDirectory)) {
    throw new Error(`Artwork directory is unavailable: assets/${canonicalRelativeDirectory}`);
  }
  return fs.readdirSync(absoluteDirectory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(extension))
    .map((entry) => ({
      absolutePath: path.join(absoluteDirectory, entry.name),
      canonicalPath: `${canonicalRelativeDirectory}/${entry.name}`
    }))
    .sort((left, right) => left.canonicalPath.localeCompare(right.canonicalPath));
}

function detectMime(buffer, canonicalPath) {
  if ([137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => buffer[index] === value)) return "image/png";
  if (buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255) return "image/jpeg";
  throw new Error(`Unrecognized image signature: ${canonicalPath}`);
}

// The browser packager reads only the files a design actually references. Here
// the whole tree is indexed first because two fixtures are built in one pass.
function buildFullVault() {
  const files = [
    ...filesIn(SCHEME_DIRS.cisco, ".jpg"),
    ...filesIn(SCHEME_DIRS.rack, ".png")
  ];
  const keys = {};
  const blobs = {};
  let totalBytes = 0;
  for (const file of files) {
    const buffer = fs.readFileSync(file.absolutePath);
    const mime = detectMime(buffer, file.canonicalPath);
    // The same rule the browser packager enforces at its line "has to be a
    // PNG. Rename it or convert it." — without this, verify:packager passes a
    // vault the packager a real user opens would refuse to build, which is
    // exactly how two JPEGs wearing .png shipped undetected.
    const expected = file.canonicalPath.startsWith(SCHEME_DIRS.rack) ? "image/png" : "image/jpeg";
    if (mime !== expected) {
      throw new Error(`${file.canonicalPath} is ${mime} but its location requires ${expected}. Rename it or convert it.`);
    }
    const hash = sha256(buffer);
    keys[file.canonicalPath] = hash;
    totalBytes += buffer.length;
    if (!blobs[hash]) blobs[hash] = { mime, bytes: buffer.length, sha256: hash, base64: buffer.toString("base64") };
  }
  const uniqueBytes = Object.values(blobs).reduce((sum, record) => sum + record.bytes, 0);
  return {
    schema: "network-packager-vault/v2",
    iconCount: files.filter((file) => file.canonicalPath.startsWith("icons/")).length,
    rackCount: files.filter((file) => file.canonicalPath.startsWith("rack-assets/")).length,
    totalBytes,
    uniqueBytes,
    keys,
    blobs
  };
}

function analyzeEditable(source, fullVault) {
  const clean = cleanEditable(source);
  validateContract(clean);
  const ids = scanAssetIds(clean);
  if (!ids.length) throw new Error("No stable asset identifiers were found.");
  const entries = ids.map((id) => ({ id, path: assetIdToPath(id) }));
  const missing = entries.find((entry) => !fullVault.keys[entry.path]);
  if (missing) throw new Error(`Artwork is unavailable: ${missing.id}`);
  return { clean, entries };
}

function buildPortable(editableSource, fullVault) {
  const analysis = analyzeEditable(editableSource, fullVault);
  const keys = {};
  const blobs = {};
  for (const entry of analysis.entries) {
    const hash = fullVault.keys[entry.path];
    keys[entry.id] = hash;
    if (!blobs[hash]) blobs[hash] = fullVault.blobs[hash];
  }
  const payload = { schema: PORTABLE_SCHEMA, keys, blobs };
  let portable = replaceRegionInner(
    analysis.clean,
    BLOCKS.vault,
    scriptBlock(BLOCKS.vault.id, "application/json", safeJson(payload, 2))
  );
  portable = replaceRegionInner(
    portable,
    BLOCKS.capsule,
    scriptBlock(BLOCKS.capsule.id, "application/octet-stream", Buffer.from(analysis.clean, "utf8").toString("base64"))
  );
  return { ...analysis, portable, keys, blobs };
}

function maskProtected(source) {
  source = replaceRegionInner(source, BLOCKS.vault, "[NETWORK-ASSET-VAULT]");
  return replaceRegionInner(source, BLOCKS.capsule, "[EDITABLE-SOURCE-CAPSULE]");
}

function relative(filePath) {
  return path.relative(repoRoot, filePath).replace(/\\/g, "/");
}

function main() {
  // The packager ships as source now. If it ever acquires a build token again,
  // it has stopped being the file people can open straight from a clone.
  const packager = readUtf8(packagerPath);
  if (/@@[A-Z_]+@@/.test(packager)) {
    throw new Error("tools/packager/network-design-packager.html still contains build tokens; it must be usable as-is.");
  }

  fs.mkdirSync(path.join(repoRoot, "dist", "examples"), { recursive: true });
  const vault = buildFullVault();

  const reports = [];
  for (const output of outputs) {
    const editable = cleanEditable(readUtf8(output.editablePath));
    const built = buildPortable(editable, vault);
    fs.writeFileSync(output.portablePath, built.portable, "utf8");
    const recovered = Buffer.from(readRegionScript(built.portable, BLOCKS.capsule), "base64").toString("utf8");
    reports.push({
      editable: relative(output.editablePath),
      editableBytes: Buffer.byteLength(editable),
      editableSha256: sha256(editable),
      portable: relative(output.portablePath),
      portableBytes: Buffer.byteLength(built.portable),
      assetIds: Object.keys(built.keys).length,
      uniqueBlobs: Object.keys(built.blobs).length,
      capsuleExact: recovered === editable,
      maskedTemplateExact: maskProtected(editable) === maskProtected(built.portable)
    });
  }

  process.stdout.write(`${JSON.stringify({
    packager: { file: relative(packagerPath), bytes: Buffer.byteLength(packager), tracked: true, buildRequired: false },
    artwork: { root: "assets", names: Object.keys(vault.keys).length, uniqueFiles: Object.keys(vault.blobs).length, bytes: vault.uniqueBytes },
    outputs: reports
  }, null, 2)}\n`);
}

main();
