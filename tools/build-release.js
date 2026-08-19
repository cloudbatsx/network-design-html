"use strict";
/* Builds the release ZIP - the exact kit every release since v0.1.0 has
 * shipped, previously reconstructed by hand from the previous release's
 * archive. The recipe now lives HERE, as data, and the repository validator
 * holds it: a renamed app, a missing starter or a thinned icon set fails
 * `npm test` long before it can ship a hollow kit.
 *
 *   npm run build:release
 *
 * writes dist/network-design-html-<version>.zip (version from package.json;
 * dist/ is untracked). Then publish it:
 *
 *   gh release create v<version> dist/network-design-html-<version>.zip \
 *     --title "..." --notes-file <notes.md>
 *
 * No dependencies, no platform tools: the ZIP is written directly - deflate
 * from node's own zlib, CRC-32 below - so the same command works anywhere
 * node does. Requiring this file runs nothing, like the free-model runner.
 */

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const root = path.resolve(__dirname, "..");

/* ---------- the recipe ---------- */

// Everything a person needs offline, and nothing maintainer-only: the three
// apps, the licences, the guide, the whole artwork set, every starter, the
// AI contract, and the icon catalogue. tools/ machinery and tests stay home.
const ROOT_FILES = [
  "edit-with-ai.html", "packager.html", "start-here.html",
  "README.md", "LICENSE", "THIRD_PARTY_NOTICES.md"
];
const TREES = ["assets", "starters"];
const EXTRAS = ["docs/ai-json-rules.md", "tools/cisco-icon-catalog.html"];

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

/* Every file the kit ships, repository-relative with forward slashes, sorted
   so the archive is deterministic. */
function releaseFiles() {
  const files = [...ROOT_FILES, ...EXTRAS];
  for (const tree of TREES) {
    files.push(...walk(path.join(root, tree))
      .map((full) => path.relative(root, full).split(path.sep).join("/")));
  }
  return [...new Set(files)].sort();
}

/* ---------- a minimal ZIP writer ---------- */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function dosDateTime(mtime) {
  const d = new Date(mtime);
  const date = ((Math.max(0, d.getFullYear() - 1980)) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  return { date, time };
}

/* Local header + deflated data per entry, then the central directory, then
   the end record - ZIP as the specification writes it, nothing more. Bit 11
   marks names as UTF-8. */
function buildZip(entries) {
  const chunks = [], central = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const deflated = zlib.deflateRawSync(entry.bytes, { level: 9 });
    const crc = crc32(entry.bytes);
    const { date, time } = dosDateTime(entry.mtime);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);          // version needed
    local.writeUInt16LE(0x0800, 6);      // flags: UTF-8 names
    local.writeUInt16LE(8, 8);           // method: deflate
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(deflated.length, 18);
    local.writeUInt32LE(entry.bytes.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    chunks.push(local, name, deflated);

    const dir = Buffer.alloc(46);
    dir.writeUInt32LE(0x02014b50, 0);
    dir.writeUInt16LE(20, 4);            // made by
    dir.writeUInt16LE(20, 6);            // version needed
    dir.writeUInt16LE(0x0800, 8);
    dir.writeUInt16LE(8, 10);
    dir.writeUInt16LE(time, 12);
    dir.writeUInt16LE(date, 14);
    dir.writeUInt32LE(crc, 16);
    dir.writeUInt32LE(deflated.length, 20);
    dir.writeUInt32LE(entry.bytes.length, 24);
    dir.writeUInt16LE(name.length, 28);
    // extra, comment, disk, internal attrs, external attrs all zero
    dir.writeUInt32LE(offset, 42);
    central.push(dir, name);

    offset += local.length + name.length + deflated.length;
  }
  const dirBytes = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(dirBytes.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...chunks, dirBytes, end]);
}

/* ---------- build ---------- */

function main() {
  const version = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")).version;
  const files = releaseFiles();

  // Refuse to ship a hollow kit. The validator holds the same floor.
  const starters = files.filter((f) => f.startsWith("starters/") && f.endsWith(".edit.html"));
  const icons = files.filter((f) => f.startsWith("assets/icons/cisco-pms3015/"));
  const faces = files.filter((f) => f.startsWith("assets/rack-assets/"));
  if (starters.length < 11) throw new Error(`only ${starters.length} starters - the kit ships 11`);
  if (icons.length < 290) throw new Error(`only ${icons.length} official icons - the set is short`);
  if (faces.length < 10) throw new Error(`only ${faces.length} rack faces - the set is short`);

  const prefix = `network-design-html-${version}/`;
  const entries = files.map((rel) => {
    const full = path.join(root, rel);
    return { name: prefix + rel, bytes: fs.readFileSync(full), mtime: fs.statSync(full).mtime };
  });

  const zip = buildZip(entries);
  const outDir = path.join(root, "dist");
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `network-design-html-${version}.zip`);
  fs.writeFileSync(outFile, zip);

  const mb = (zip.length / 1024 / 1024).toFixed(2);
  console.log(`dist/network-design-html-${version}.zip: ${files.length} files, ${mb} MB`);
  console.log(`publish: gh release create v${version} dist/network-design-html-${version}.zip --title "..." --notes-file <notes.md>`);
}

module.exports = { releaseFiles, ROOT_FILES, TREES, EXTRAS };
if (require.main === module) main();
