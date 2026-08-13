"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const repoRoot = path.resolve(__dirname, "../..");
const BLOCKS = Object.freeze({
  vault: { begin: "<!-- NETWORK-ASSET-VAULT:BEGIN -->", end: "<!-- NETWORK-ASSET-VAULT:END -->", id: "network-asset-vault" },
  capsule: { begin: "<!-- EDITABLE-SOURCE-CAPSULE:BEGIN -->", end: "<!-- EDITABLE-SOURCE-CAPSULE:END -->", id: "editable-source-capsule" }
});

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function hash(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function countOf(source, token) {
  return source.split(token).length - 1;
}

function region(source, block) {
  if (countOf(source, block.begin) !== 1 || countOf(source, block.end) !== 1) {
    throw new Error(`Bad ${block.id} markers.`);
  }
  const contentStart = source.indexOf(block.begin) + block.begin.length;
  const end = source.indexOf(block.end, contentStart);
  return { contentStart, end };
}

function replaceRegionInner(source, block, content) {
  const found = region(source, block);
  return source.slice(0, found.contentStart) + content + source.slice(found.end);
}

function readRegionScript(source, block) {
  const found = region(source, block);
  const inside = source.slice(found.contentStart, found.end);
  const expression = new RegExp(`<script\\b(?=[^>]*\\bid=["']${block.id}["'])[^>]*>([\\s\\S]*?)<\\/script>`, "i");
  const match = inside.match(expression);
  if (!match) throw new Error(`Missing ${block.id} script.`);
  return match[1].trim();
}

function readScriptById(source, id) {
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = source.match(new RegExp(`<script\\b(?=[^>]*\\bid=["']${escaped}["'])[^>]*>([\\s\\S]*?)<\\/script>`, "i"));
  if (!match) throw new Error(`Missing ${id} script.`);
  return match[1].trim();
}

function mask(source) {
  source = replaceRegionInner(source, BLOCKS.vault, "[VAULT]");
  return replaceRegionInner(source, BLOCKS.capsule, "[CAPSULE]");
}

function verifyPair(editableName, portableName, expectedAssets) {
  const editable = read(editableName);
  const portable = read(portableName);
  const vault = JSON.parse(readRegionScript(portable, BLOCKS.vault));
  const recovered = Buffer.from(readRegionScript(portable, BLOCKS.capsule), "base64").toString("utf8");
  const keys = Object.keys(vault.keys);
  const blobs = Object.entries(vault.blobs);
  const blobChecks = blobs.map(([blobHash, record]) => {
    const bytes = Buffer.from(record.base64, "base64");
    return {
      blobHash,
      byteLengthValid: bytes.length === record.bytes,
      sha256Valid: hash(bytes) === blobHash,
      payloadOccurrences: portable.split(record.base64).length - 1
    };
  });
  const result = {
    editableName,
    portableName,
    editableBytes: Buffer.byteLength(editable),
    portableBytes: Buffer.byteLength(portable),
    editableSha256: hash(editable),
    recoveredSha256: hash(recovered),
    recoveredExact: recovered === editable,
    maskedSourceSha256: hash(mask(editable)),
    maskedPortableSha256: hash(mask(portable)),
    templateBytesPreserved: mask(editable) === mask(portable),
    assetIds: keys.length,
    uniqueBlobs: blobs.length,
    expectedAssetCount: expectedAssets,
    noDataImagesInEditable: !editable.includes("data:image/"),
    vaultSchemaValid: vault.schema === "network-asset-vault/v2",
    blobChecks
  };
  result.pass = result.recoveredExact && result.templateBytesPreserved &&
    result.assetIds === expectedAssets && result.uniqueBlobs <= result.assetIds &&
    result.noDataImagesInEditable && result.vaultSchemaValid &&
    blobChecks.every((check) => check.byteLengthValid && check.sha256Valid && check.payloadOccurrences === 1);
  return result;
}

function verifyPackager() {
  const packager = read("dist/network-design-packager.html");
  const primary = Buffer.from(readScriptById(packager, "bundled-hybrid-source"), "base64").toString("utf8");
  const alternate = Buffer.from(readScriptById(packager, "bundled-alternate-source"), "base64").toString("utf8");
  const vault = JSON.parse(readScriptById(packager, "packager-asset-vault"));
  const expectedPrimary = read("templates/network-design-template.edit.html");
  const expectedAlternate = read("tests/fixtures/alternate-dashboard.edit.html");
  return {
    sourcePrimaryExact: primary === expectedPrimary,
    sourceAlternateExact: alternate === expectedAlternate,
    vaultSchemaValid: vault.schema === "network-packager-vault/v2",
    ciscoAssets: vault.iconCount,
    rackAssets: vault.rackCount,
    namedAssets: Object.keys(vault.keys || {}).length,
    uniqueBlobs: Object.keys(vault.blobs || {}).length,
    pass: primary === expectedPrimary && alternate === expectedAlternate &&
      vault.schema === "network-packager-vault/v2" && vault.iconCount === 294 && vault.rackCount === 10
  };
}

const pairs = [
  verifyPair("templates/network-design-template.edit.html", "dist/examples/topology-and-rack.portable.html", 29),
  verifyPair("tests/fixtures/alternate-dashboard.edit.html", "dist/examples/alternate-dashboard.portable.html", 11)
];
const packager = verifyPackager();
const report = {
  schema: "network-design-packager-qa/v1",
  generatedAt: new Date().toISOString(),
  pass: pairs.every((pair) => pair.pass) && packager.pass,
  packager,
  pairs
};
fs.mkdirSync(path.join(repoRoot, "dist"), { recursive: true });
fs.writeFileSync(path.join(repoRoot, "dist", "qa-packager-report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
process.stdout.write(`${report.pass ? "PASS" : "FAIL"}: packager + ${pairs.length} portable fixtures\n`);
for (const pair of pairs) {
  process.stdout.write(`- ${pair.portableName}: ${pair.pass ? "PASS" : "FAIL"} (${pair.assetIds} assets, ${pair.portableBytes} bytes)\n`);
}
if (!report.pass) process.exitCode = 1;
