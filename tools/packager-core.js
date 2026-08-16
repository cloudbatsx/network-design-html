"use strict";

/* The packaging engine, in one place. Injected byte-identically into
 * packager.html and edit-with-ai.html by tools/build-helper.js - the same
 * inject-and-validate discipline the rack-face library lives under - so the
 * two surfaces can never disagree about how a portable file is built.
 *
 * Dual-mode: exports for Node (tests, build tooling) and attaches to
 * globalThis in a browser. Everything here is DOM-free.
 *
 * Partial builds are the rule, not the exception: an id with no artwork is
 * left out of the vault and reported, and the documents' renderers fall back
 * to their built-in drawn faces. Only structural failures throw.
 */
const PACKAGER_CORE = (function () {
  const MAX_SOURCE_BYTES = 10 * 1024 * 1024;
  const CONTRACT_SCHEMA = "network-design-package/v2";
  const ASSET_REFERENCE_SCHEMA = "asset-uri/v1";
  const PORTABLE_SCHEMA = "network-asset-vault/v2";
  const SCHEME_DIRS = Object.freeze({ cisco: "icons/cisco-pms3015", rack: "rack-assets" });
  const SCHEME_EXT = Object.freeze({ cisco: ".jpg", rack: ".png" });
  const BLOCKS = Object.freeze({
    contract: { begin: "<!-- NETWORK-PACKAGER-CONTRACT:BEGIN -->", end: "<!-- NETWORK-PACKAGER-CONTRACT:END -->", id: "network-packager-contract" },
    vault: { begin: "<!-- NETWORK-ASSET-VAULT:BEGIN -->", end: "<!-- NETWORK-ASSET-VAULT:END -->", id: "network-asset-vault" },
    capsule: { begin: "<!-- EDITABLE-SOURCE-CAPSULE:BEGIN -->", end: "<!-- EDITABLE-SOURCE-CAPSULE:END -->", id: "editable-source-capsule" }
  });

  const countOf = (source, token) => source.split(token).length - 1;

  function decodeUtf8Base64(value) {
    const bytes = Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  }

  function encodeBytesBase64(bytes) {
    let binary = "";
    for (let offset = 0; offset < bytes.length; offset += 32768) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + 32768));
    }
    return btoa(binary);
  }

  const encodeUtf8Base64 = (value) => encodeBytesBase64(new TextEncoder().encode(value));

  function region(source, block) {
    if (countOf(source, block.begin) !== 1 || countOf(source, block.end) !== 1) {
      throw new Error(`${block.id} markers must each appear exactly once.`);
    }
    const begin = source.indexOf(block.begin);
    const contentStart = begin + block.begin.length;
    const end = source.indexOf(block.end, contentStart);
    if (end < contentStart) throw new Error(`${block.id} markers are out of order.`);
    return { begin, contentStart, end };
  }

  function replaceRegionInner(source, block, content) {
    const found = region(source, block);
    return source.slice(0, found.contentStart) + `\n${content}\n` + source.slice(found.end);
  }

  function readRegionScript(source, block) {
    const found = region(source, block);
    const inside = source.slice(found.contentStart, found.end);
    const escaped = block.id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const expression = new RegExp(`^\\s*<script\\b(?=[^>]*\\bid=["']${escaped}["'])[^>]*>([\\s\\S]*?)<\\/script>\\s*$`, "i");
    const match = inside.match(expression);
    if (!match) throw new Error(`${block.id} block must contain exactly its required script element.`);
    return match[1].trim();
  }

  // Built by concatenation: a literal closing tag here would end the element
  // this source is injected into.
  function scriptBlock(id, type, content) {
    return `<script id="${id}" type="${type}">\n${content}\n${"</scr" + "ipt>"}`;
  }

  function safeJson(value) {
    return JSON.stringify(value, null, 2)
      .replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026")
      .replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
  }

  function maskProtected(source) {
    return replaceRegionInner(replaceRegionInner(source, BLOCKS.vault, "[VAULT]"), BLOCKS.capsule, "[CAPSULE]");
  }

  /* ---- artwork indexing and resolution ---- */

  function canonicalPathOf(relativePath) {
    const path = relativePath.replace(/\\/g, "/");
    const name = path.slice(path.lastIndexOf("/") + 1);
    for (const [scheme, directory] of Object.entries(SCHEME_DIRS)) {
      const needle = `${directory}/${name}`;
      if (path.toLowerCase().endsWith(needle.toLowerCase()) && name.toLowerCase().endsWith(SCHEME_EXT[scheme])) {
        return `${directory}/${name}`;
      }
    }
    return "";
  }

  function emptyArtwork() {
    return { byPath: new Map(), byName: new Map(), folders: new Set(), files: 0 };
  }

  function indexInto(artwork, files) {
    let added = 0, skipped = 0;
    for (const file of files) {
      const relative = file.webkitRelativePath || file.relativePath || file.name;
      if (!/\.(jpe?g|png)$/i.test(file.name)) { skipped++; continue; }
      const canonical = canonicalPathOf(relative);
      if (canonical) {
        artwork.byPath.set(canonical, file);
        artwork.folders.add(canonical.slice(0, canonical.lastIndexOf("/")));
      }
      const bucket = artwork.byName.get(file.name) || [];
      if (!bucket.some((existing) => existing.size === file.size && existing.lastModified === file.lastModified)) bucket.push(file);
      artwork.byName.set(file.name, bucket);
      added++;
    }
    artwork.files += added;
    return { added, skipped };
  }

  /* ---- design validation ---- */

  function cleanEditable(source) {
    const vault = readRegionScript(source, BLOCKS.vault);
    const capsule = readRegionScript(source, BLOCKS.capsule);
    if (vault && vault !== "{}") JSON.parse(vault);
    if (capsule && !/^[A-Za-z0-9+/=]+$/.test(capsule)) throw new Error("The editable source capsule is not valid Base64.");
    source = replaceRegionInner(source, BLOCKS.vault, scriptBlock(BLOCKS.vault.id, "application/json", "{}"));
    return replaceRegionInner(source, BLOCKS.capsule, scriptBlock(BLOCKS.capsule.id, "application/octet-stream", ""));
  }

  function normalizeInput(source) {
    if (byteLength(source) > MAX_SOURCE_BYTES) throw new Error("Input exceeds the 10 MB limit.");
    const capsule = readRegionScript(source, BLOCKS.capsule);
    if (capsule) {
      source = decodeUtf8Base64(capsule);
      if (byteLength(source) > MAX_SOURCE_BYTES) throw new Error("Recovered editable source exceeds the safety limit.");
    }
    return cleanEditable(source);
  }

  function byteLength(text) {
    return new TextEncoder().encode(text).length;
  }

  function validateContract(source) {
    const contract = JSON.parse(readRegionScript(source, BLOCKS.contract));
    if (contract.schema !== CONTRACT_SCHEMA) throw new Error(`Unsupported contract schema: ${contract.schema || "missing"}.`);
    if (contract.assetReferences !== ASSET_REFERENCE_SCHEMA) throw new Error(`Unsupported asset-reference schema: ${contract.assetReferences || "missing"}.`);
    const schemes = contract.assetUriSchemes;
    if (!schemes || schemes.cisco !== `${SCHEME_DIRS.cisco}/` || schemes.rack !== `${SCHEME_DIRS.rack}/`) {
      throw new Error("The immutable Cisco/rack URI scheme mapping is missing or changed.");
    }
    return contract;
  }

  function scanAssetIds(source) {
    const withoutProtected = Object.values(BLOCKS).reduce((text, block) => {
      const found = region(text, block);
      return text.slice(0, found.contentStart) + "\n[PROTECTED]\n" + text.slice(found.end);
    }, source);
    const matches = withoutProtected.match(/asset:(?:cisco|rack)\/[^\s"'<>`\\]+(?: [^\s"'<>`\\]+)*/g) || [];
    const ids = [...new Set(matches.map((value) => value.replace(/[),.;:]+$/, "")))].sort((left, right) => left.localeCompare(right));
    if (!ids.length) throw new Error("No stable asset: identifiers were found outside the protected blocks.");
    if (ids.length > 512) throw new Error("The design exceeds the 512-asset limit.");
    return ids;
  }

  function assetIdToPath(id) {
    const match = /^asset:(cisco|rack)\/([^/]+)$/.exec(id);
    if (!match) throw new Error(`Invalid asset identifier syntax: ${id}.`);
    const [, scheme, file] = match;
    if (file === "." || file === ".." || file.includes("\\") || file.includes("%") || /[\u0000-\u001f]/.test(file)) {
      throw new Error(`Unsafe asset identifier: ${id}.`);
    }
    if (!file.toLowerCase().endsWith(SCHEME_EXT[scheme])) throw new Error(`Wrong file type for ${id}.`);
    return { path: `${SCHEME_DIRS[scheme]}/${file}`, name: file, scheme };
  }

  /* Official copy first, then a file of that exact name from anywhere in the
     selection. Two different files sharing one name is reported, never
     guessed. */
  function resolveEntries(ids, artwork) {
    return ids.map((id) => {
      const { path, name, scheme } = assetIdToPath(id);
      const official = artwork.byPath.get(path);
      if (official) return { id, path, name, scheme, file: official, source: "official" };
      const bucket = artwork.byName.get(name) || [];
      if (bucket.length === 1) return { id, path, name, scheme, file: bucket[0], source: "mine" };
      if (bucket.length > 1) return { id, path, name, scheme, file: null, source: "ambiguous" };
      return { id, path, name, scheme, file: null, source: "missing" };
    });
  }

  async function digestHex(bytes) {
    if (!globalThis.crypto?.subtle) return "unavailable";
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
  }

  function detectMime(bytes) {
    if ([137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value)) return "image/png";
    if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return "image/jpeg";
    return "";
  }

  /* ---- the build ----
     Embeds every resolvable entry; everything else becomes a report line.
     A file whose bytes do not match its scheme (a JPEG where a PNG belongs)
     is excluded the same way - the document keeps its drawn artwork there -
     because a partial truth beats a refused build. Only the two structural
     proofs can throw. */
  async function buildPortable(clean, entries) {
    const keys = {}, blobs = {};
    const seen = new Map();
    const report = { embedded: 0, embeddedBytes: 0, skipped: [] };
    for (const entry of entries) {
      if (!entry.file) {
        report.skipped.push({ id: entry.id, reason: entry.source === "ambiguous" ? "more than one file with this name" : "not found" });
        continue;
      }
      let hash = seen.get(entry.file);
      if (!hash) {
        const bytes = new Uint8Array(await entry.file.arrayBuffer());
        const mime = detectMime(bytes);
        const expected = entry.scheme === "rack" ? "image/png" : "image/jpeg";
        if (!mime) { report.skipped.push({ id: entry.id, reason: "not a real JPEG or PNG" }); continue; }
        if (mime !== expected) {
          report.skipped.push({ id: entry.id, reason: `${mime === "image/png" ? "PNG" : "JPEG"} bytes where ${expected === "image/png" ? "PNG" : "JPEG"} is required` });
          continue;
        }
        hash = await digestHex(bytes);
        if (hash === "unavailable") hash = `size-${bytes.length}-${entry.name}`;
        seen.set(entry.file, hash);
        if (!blobs[hash]) {
          blobs[hash] = { mime, bytes: bytes.length, sha256: hash, base64: encodeBytesBase64(bytes) };
          report.embeddedBytes += bytes.length;
        }
      }
      keys[entry.id] = hash;
      report.embedded++;
    }

    const payload = { schema: PORTABLE_SCHEMA, keys, blobs };
    let portable = replaceRegionInner(clean, BLOCKS.vault, scriptBlock(BLOCKS.vault.id, "application/json", safeJson(payload)));
    portable = replaceRegionInner(portable, BLOCKS.capsule, scriptBlock(BLOCKS.capsule.id, "application/octet-stream", encodeUtf8Base64(clean)));

    if (decodeUtf8Base64(readRegionScript(portable, BLOCKS.capsule)) !== clean) {
      throw new Error("The editable source could not be recovered from the file just built.");
    }
    if (maskProtected(portable) !== maskProtected(clean)) {
      throw new Error("Bytes outside the two protected blocks changed.");
    }
    return { portable, report };
  }

  /* ---- names ---- */

  function editableName(name) {
    if (/\.portable\.html$/i.test(name)) return name.replace(/\.portable\.html$/i, ".edit.html");
    if (/\.edit\.html$/i.test(name)) return name;
    return name.replace(/\.html$/i, "") + ".edit.html";
  }

  const portableName = (name) => editableName(name).replace(/\.edit\.html$/i, ".portable.html");

  return {
    MAX_SOURCE_BYTES, CONTRACT_SCHEMA, ASSET_REFERENCE_SCHEMA, PORTABLE_SCHEMA, SCHEME_DIRS, SCHEME_EXT, BLOCKS,
    countOf, decodeUtf8Base64, encodeBytesBase64, encodeUtf8Base64,
    region, replaceRegionInner, readRegionScript, scriptBlock, safeJson, maskProtected,
    canonicalPathOf, emptyArtwork, indexInto,
    cleanEditable, normalizeInput, validateContract, scanAssetIds, assetIdToPath, resolveEntries,
    digestHex, detectMime, buildPortable, editableName, portableName
  };
})();

if (typeof module !== "undefined" && module.exports) module.exports = PACKAGER_CORE;
if (typeof globalThis !== "undefined") globalThis.PACKAGER_CORE = PACKAGER_CORE;
