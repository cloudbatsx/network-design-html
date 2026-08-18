#!/usr/bin/env node
"use strict";

/* Automated free-model validation runs (docs/free-model-results.md).
 *
 * Drives the full fresh-build product loop against a live Gemini model for
 * each test folder: EXTRACT (the topology image + the helper's own
 * EXTRACT_PROMPT, vision) -> BUILD (the helper's own composed prompt against
 * the blank template) -> CHECK (the helper's own repair/merge/check pipeline,
 * with the helper's own Copy-problems message on retries) -> BRAND (the
 * helper's own brandedData) -> SAVE (the helper's own splice + byte guards)
 * -> PACKAGE (tools/packager-core.js + the repo's assets/).
 *
 * Nothing here reimplements product logic. The helper's script block is
 * evaluated in a vm sandbox with a stub DOM - the exact pattern of
 * tests/edit-with-ai.test.js - and an export shim hands over the real
 * functions. If the helper grows load-time behaviour the stub cannot satisfy,
 * this runner fails loudly rather than silently testing something else.
 *
 * Usage:
 *   node tools/run-free-model-tests.js --tests-dir <folder> [--tests 3-9]
 *     [--model gemini-3.6-flash] [--env-file <path-to-.env>] [--delay-ms 7000]
 *     [--smoke] [--edit-matrix]
 *
 * --edit-matrix drives the nine-run editing protocol from
 * docs/free-model-results.md instead of the fresh-build loop: nine
 * part-scoped edits on starters/NET-HQ-001.edit.html, each in a fresh
 * conversation, the design carrying forward from save to save. Artifacts land
 * in <tests-dir>/editing-matrix/. With --smoke it composes all nine prompts
 * and proves the splice path without spending quota.
 *
 * Each test folder must hold one topology image and one logo image named
 * logo-<organisation>.<png|jpg|svg>. The API key comes from
 * GOOGLE_GENERATIVE_AI_API_KEY / GEMINI_API_KEY, or from --env-file (a file
 * with a GOOGLE_GENERATIVE_AI_API_KEY=... line; the key never appears on the
 * command line). --smoke runs everything except the model calls and writes
 * nothing: it proves the sandbox, the prompt, the splice and the packaging
 * path before any quota is spent.
 *
 * Outputs, per test folder: {drawing-id}.edit.html, {drawing-id}.portable.html
 * and run-log.json (the honest record: every round trip, every repair, every
 * problem, the packaging report, token counts, the exact model version).
 */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const CORE = require("./packager-core.js");

/* ---------- the helper's real logic, via the sandbox ---------- */

function loadHelper() {
  const helper = fs.readFileSync(path.join(root, "edit-with-ai.html"), "utf8");
  const script = helper.match(/<script>([\s\S]*)<\/script>/);
  if (!script) throw new Error("edit-with-ai.html no longer contains a script block");

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
    URL: { createObjectURL: () => "blob:runner", revokeObjectURL() {} },
    Blob, TextDecoder, structuredClone, setTimeout, console, atob, btoa,
    PACKAGER_CORE: CORE
  };

  const shim = ";globalThis.__exports = { parseWithRepair, mergeReply, checkStructure, checkMeaning," +
    " checkShell, checkAssetStrings, checkHostileText, looksTruncated, safeJson, freshRequestText," +
    " freshDrawingId, brandedData, EXTRACT_PROMPT, SLICES, pathLabel, buildPrompt, loadSource," +
    " FORBIDDEN_IN_DATA, countOf, polishGeometry," +
    " state: () => ({ source, payloadStart, payloadEnd, currentData })," +
    " setRequest: (text) => { document.getElementById('request').value = text; }," +
    " setSlice: (name) => { document.getElementById('slice').value = name; } };";
  vm.runInNewContext(script[1] + shim, sandbox, { filename: "edit-with-ai.html <script>" });
  return sandbox.__exports;
}

/* ---------- test discovery ---------- */

const IMAGE_MIME = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp" };

// "brownstown-schools" -> "Brownstown Schools"; short tokens are initialisms ("dc" -> "DC").
function orgNameFromSlug(slug) {
  return slug.split(/[-_]+/).filter(Boolean)
    .map((word) => word.length <= 2 ? word.toUpperCase() : word[0].toUpperCase() + word.slice(1))
    .join(" ");
}

function discoverTest(dir) {
  const files = fs.readdirSync(dir);
  const logoName = files.find((name) => /^logo-/i.test(name) && /\.(png|jpe?g|svg)$/i.test(name));
  if (!logoName) throw new Error(`${dir}: no logo-*.png/jpg/svg file`);
  const topologyName = files.find((name) => name !== logoName && /\.(png|jpe?g|webp)$/i.test(name));
  if (!topologyName) throw new Error(`${dir}: no topology image`);
  const org = orgNameFromSlug(logoName.replace(/^logo-/i, "").replace(/\.[^.]+$/, ""));
  return { dir, logoName, topologyName, org, title: `${org} Network` };
}

/* ---------- the model ---------- */

function readKey(envFile) {
  let key = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY || "";
  if (!key && envFile) {
    const text = fs.readFileSync(envFile, "utf8");
    const match = text.match(/^\s*(?:GOOGLE_GENERATIVE_AI_API_KEY|GEMINI_API_KEY)\s*=\s*(.+)$/m);
    if (match) key = match[1].trim();
  }
  if (!key) throw new Error("No API key: set GOOGLE_GENERATIVE_AI_API_KEY or pass --env-file");
  return key;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function callModel(model, key, contents, log) {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({ contents, generationConfig: { maxOutputTokens: 65536 } })
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const message = `HTTP ${res.status} ${body.error?.status || ""}: ${String(body.error?.message || "").slice(0, 200)}`;
      if ((res.status === 429 || res.status >= 500) && attempt < 4) {
        log(`  model returned ${res.status}, waiting 35s (attempt ${attempt}/3 retries)`);
        await sleep(35000);
        continue;
      }
      throw new Error(message);
    }
    const data = await res.json();
    const candidate = data.candidates?.[0];
    const text = (candidate?.content?.parts || [])
      .filter((part) => typeof part.text === "string" && !part.thought)
      .map((part) => part.text).join("");
    return {
      text,
      finishReason: candidate?.finishReason || "?",
      modelVersion: data.modelVersion || model,
      usage: {
        prompt: data.usageMetadata?.promptTokenCount,
        output: data.usageMetadata?.candidatesTokenCount,
        thoughts: data.usageMetadata?.thoughtsTokenCount
      }
    };
  }
}

/* ---------- the helper's check pipeline, orchestrated as check() does ---------- */

function runCheck(t, raw, original, name = "all") {
  const hostile = t.checkHostileText(raw);
  const { parsed, applied, text: cleanedText } = t.parseWithRepair(raw);

  if (parsed === undefined) {
    // The exact two verdicts check() renders when nothing parsed, scope-aware.
    const narrower = name === "all"
      ? "Send it again as one part only: reply with just the topology section, and nothing else."
      : "Send it again. If it keeps being cut off, change fewer things in one go.";
    const why = t.looksTruncated(cleanedText)
      ? { stop: true,
          what: "The reply is cut off. It stops part-way through, so some of it is missing.",
          tell: `Your last reply was cut off before it finished. ${narrower}` }
      : { stop: true,
          what: "This reply is not valid JSON, even after cleaning it up.",
          tell: "Your last reply was not valid JSON. Reply again with one JSON object and nothing else - no explanation, no code fences." };
    return { merged: null, problems: hostile.concat([why]), applied, truncated: t.looksTruncated(cleanedText) };
  }

  const { merged, problems: mergeProblems } = t.mergeReply(parsed, original, name);
  if (!merged) return { merged: null, problems: hostile.concat(mergeProblems), applied, truncated: false };

  // The helper tidies arithmetic-band geometry before grading - same call,
  // same order as check(). Its moves land in the applied list, so run-log.json
  // records them beside the text repairs.
  const polished = t.polishGeometry(merged);

  const problems = hostile
    .concat(mergeProblems)
    .concat(t.checkStructure(cleanedText, polished.next, name, original))
    .concat(t.checkAssetStrings(polished.next))
    .concat(t.checkShell(polished.next, original))
    .concat(t.checkMeaning(polished.next));
  return { merged: polished.next, problems, applied: applied.concat(polished.applied), truncated: false };
}

// The Copy-problems message, exactly as the helper composes it for "all" scope.
/* The one fidelity check a harness can make mechanically. The extraction
   prompt demands a stated device count, so the build can be held to it:
   fewer placed devices with no finding recording the omission is exactly the
   silent-condensation failure of the first fidelity audit. A shortfall WITH
   a finding that records it is not a failure - recorded honesty is the
   product's ethos.

   The 2026-08-17 review hardened all three legs. The count parse accepts
   every phrasing the 24-run record actually contains, and a reply with no
   parseable count is reported as such instead of silently waving the build
   through. The confession test is scoped to a single finding and must see a
   condensation word, a device word and a number together - test16's real
   confession said "aggregated", which the old keyword list could not see,
   while its unrelated "Serial Numbers Omitted" finding satisfied it; the
   gate reached the right verdict on the wrong evidence. */
function statedDeviceCount(extractText) {
  const patterns = [
    /total\s+device\s+count[^0-9\n]{0,20}(\d+)/i,
    /total\s+devices?[^0-9\n]{0,20}(\d+)/i,
    /total[^0-9\n]{0,40}devices?[^0-9\n]{0,20}(\d+)/i,
    /device\s+count[^0-9\n]{0,20}(\d+)/i,
    /counted[^0-9\n]{0,20}(\d+)\s+devices?/i,
    /(\d+)\s+devices?\s+(?:total|drawn|in\s+total)/i
  ];
  for (const pattern of patterns) {
    const match = extractText.match(pattern);
    if (match) return Number(match[1]);
  }
  return null;
}

function confessesCondensation(data) {
  const items = (data.sections?.findings?.items) || [];
  const condenseWord = /condens|consolidat|aggregat|grouped|group\s+node|combin|collapsed|shown\s+as\s+one|represented\s+by|omitted|omission|not\s+shown|not\s+drawn|excluded|left\s+out|dropped/i;
  const deviceWord = /device|node|endpoint|unit|camera|switch|access\s+point|host|drawn|topolog|diagram|inventory/i;
  for (const item of items) {
    const text = `${item.title || ""} ${item.detail || ""}`;
    if (condenseWord.test(text) && deviceWord.test(text) && /\d/.test(text)) return true;
  }
  return false;
}

function inventoryShortfall(extractText, data) {
  const promised = statedDeviceCount(extractText);
  const placed = (data.topology?.nodes || []).length;
  if (promised === null) return { gate: "no-count-found", promised: null, placed, short: false };
  if (placed >= promised) return { gate: "met", promised, placed, short: false };
  if (confessesCondensation(data)) return { gate: "confessed", promised, placed, short: false };
  return { gate: "shortfall", promised, placed, short: true };
}

/* Logs and transcripts are evidence; evidence is never overwritten. The
   previous artifact moves to the next free .runN name (run1 is the oldest),
   and the plain name always holds the latest run - the convention the
   3-9 folders already follow. Two runs of the historical record are gone
   because this rotation did not exist; see free-model-results.md, Artifact
   provenance. */
function rotateArtifact(dir, name) {
  const full = path.join(dir, name);
  if (!fs.existsSync(full)) return null;
  const base = name.replace(/\.json$/, "");
  let n = 1;
  while (fs.existsSync(path.join(dir, `${base}.run${n}.json`))) n++;
  const archived = `${base}.run${n}.json`;
  fs.renameSync(full, path.join(dir, archived));
  return archived;
}

function problemsMessage(problems) {
  const lines = problems.map((p, i) => `${i + 1}. ${p.what}\n   ${p.tell}`);
  return `Your last reply had these problems. Please send the complete JSON object again with them fixed, and reply with JSON only.\n\n${lines.join("\n\n")}`;
}

/* ---------- branding ---------- */

function logoFields(dir, logoName, org) {
  const full = path.join(dir, logoName);
  if (/\.svg$/i.test(logoName)) {
    const svg = fs.readFileSync(full, "utf8");
    const viewBox = (svg.match(/viewBox\s*=\s*"([^"]+)"/i) || [])[1];
    const ds = [...svg.matchAll(/<path\b[^>]*?\sd\s*=\s*"([^"]+)"/gi)].map((m) => m[1]);
    const fill = (svg.match(/fill\s*=\s*"(#[0-9a-fA-F]{3,8})"/) || [])[1];
    if (!viewBox || !ds.length) {
      return { fields: { name: org }, note: `SVG logo ${logoName} has no extractable viewBox+path; branded name only` };
    }
    const fields = { name: org, path: ds.join(" "), viewBox };
    if (fill) fields.fill = fill;
    return { fields, note: `SVG logo: ${ds.length} path(s) extracted` };
  }
  const bytes = fs.readFileSync(full);
  const mime = /\.png$/i.test(logoName) ? "image/png" : "image/jpeg";
  const uri = `data:${mime};base64,${bytes.toString("base64")}`;
  return { fields: { name: org, image: uri }, note: `raster logo: ${bytes.length} bytes` };
}

/* ---------- the save-time splice, with save()'s own byte guards ---------- */

function spliceAndGuard(t, source, payloadStart, payloadEnd, accepted) {
  const injected = "\n" + t.safeJson(accepted) + "\n";
  const out = source.slice(0, payloadStart) + injected + source.slice(payloadEnd);
  const countOf = t.countOf;

  for (const marker of t.FORBIDDEN_IN_DATA) {
    if (countOf(source, marker) !== countOf(out, marker)) throw new Error(`internal marker count changed for ${marker}`);
  }
  if (countOf(out, "<" + "script") !== countOf(source, "<" + "script")) throw new Error("script tag count changed");
  const suffixStart = out.length - (source.length - payloadEnd);
  if (countOf(out.slice(0, payloadStart), "asset:") !== countOf(source.slice(0, payloadStart), "asset:")
    || countOf(out.slice(suffixStart), "asset:") !== countOf(source.slice(payloadEnd), "asset:")) throw new Error("artwork references outside the data block changed");
  const allowedImages = accepted?.document?.brand?.logoImage ? 1 : 0;
  if (countOf(out, "data:image/") !== allowedImages
    || countOf(out.slice(0, payloadStart), "data:image/") !== 0
    || countOf(out.slice(suffixStart), "data:image/") !== 0) throw new Error("an embedded image appeared outside the brand logo");
  if (!out.trimEnd().endsWith("</" + "html>")) throw new Error("the file no longer ends correctly");
  if (out.slice(0, payloadStart) !== source.slice(0, payloadStart)) throw new Error("bytes before the diagram data changed");
  if (out.slice(out.length - (source.length - payloadEnd)) !== source.slice(payloadEnd)) throw new Error("bytes after the diagram data changed");
  return out;
}

function outputSlug(accepted) {
  const drawing = accepted?.document?.drawing || "network-design";
  const slug = String(drawing).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return slug || "network-design";
}

/* ---------- packaging, from the repo's own assets/ ---------- */

function repoArtwork() {
  const artwork = CORE.emptyArtwork();
  const files = [];
  (function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) { walk(full); continue; }
      if (!/\.(jpe?g|png)$/i.test(entry.name)) continue;
      const stat = fs.statSync(full);
      files.push({
        name: entry.name,
        relativePath: path.relative(root, full).replace(/\\/g, "/"),
        size: stat.size,
        lastModified: stat.mtimeMs,
        arrayBuffer: async () => {
          const bytes = fs.readFileSync(full);
          return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
        }
      });
    }
  })(path.join(root, "assets"));
  CORE.indexInto(artwork, files);
  return artwork;
}

async function packageEditable(editText, artwork) {
  const clean = CORE.normalizeInput(editText);
  CORE.validateContract(clean);
  const ids = CORE.scanAssetIds(clean);
  const entries = CORE.resolveEntries(ids, artwork);
  const { portable, report } = await CORE.buildPortable(clean, entries);
  return { portable, report, ids };
}

/* ---------- one test, end to end ---------- */

const MAX_ROUND_TRIPS = 3;

async function runTest(t, test, options, log) {
  const record = {
    test: path.basename(test.dir), title: test.title, organisation: test.org,
    topologyImage: test.topologyName, logoImage: test.logoName,
    model: options.model, surface: "API (Google AI free tier)",
    date: new Date().toISOString(), rounds: [], verdict: "pending"
  };

  // The blank template, exactly as the helper's "Start a new design" door loads it.
  const template = fs.readFileSync(path.join(root, "starters", "network-design-template.edit.html"), "utf8");
  t.loadSource(template, "network-design-template.edit.html");
  const state = t.state();
  if (!state.currentData) throw new Error("the template did not load in the sandbox");

  // The wizard's request: explicit title, delegated drawing id, delegated rack.
  t.setRequest(t.freshRequestText(test.title, "", "auto"));
  const buildRequest = t.buildPrompt();

  // EXTRACT - the topology image plus the helper's own prompt, one vision turn.
  const imageBytes = fs.readFileSync(path.join(test.dir, test.topologyName));
  const mime = IMAGE_MIME[path.extname(test.topologyName).toLowerCase()];
  const contents = [{
    role: "user",
    parts: [
      { inline_data: { mime_type: mime, data: imageBytes.toString("base64") } },
      { text: t.EXTRACT_PROMPT }
    ]
  }];
  log(`  EXTRACT: ${test.topologyName} (${mime}, ${imageBytes.length} bytes)`);
  const extract = await callModel(options.model, options.key, contents, log);
  record.modelVersion = extract.modelVersion;
  record.extract = { finishReason: extract.finishReason, chars: extract.text.length, usage: extract.usage };
  log(`  extract reply: ${extract.text.length} chars, ${extract.finishReason}`);
  contents.push({ role: "model", parts: [{ text: extract.text }] });

  // The full word-for-word exchange, so a fidelity loss can later be pinned
  // to the extract step or the build step instead of guessed at.
  const transcript = {
    extractPrompt: t.EXTRACT_PROMPT, extractReply: extract.text,
    buildPrompt: buildRequest, rounds: []
  };

  // BUILD + CHECK round trips, same conversation, the helper's own messages.
  contents.push({ role: "user", parts: [{ text: buildRequest }] });
  let accepted = null;
  for (let round = 1; round <= MAX_ROUND_TRIPS; round++) {
    await sleep(options.delayMs);
    log(`  BUILD round ${round}...`);
    const reply = await callModel(options.model, options.key, contents, log);
    const checked = runCheck(t, reply.text, state.currentData);
    const stops = checked.problems.filter((p) => p.stop);
    const warnings = checked.problems.length - stops.length;
    record.rounds.push({
      round, finishReason: reply.finishReason, chars: reply.text.length, usage: reply.usage,
      repairsApplied: checked.applied, truncated: checked.truncated,
      stops: stops.map((p) => p.what), warnings,
      warningTexts: checked.problems.filter((p) => !p.stop).map((p) => p.what)
    });
    log(`  round ${round}: ${reply.text.length} chars, ${stops.length} stop(s), ${warnings} warning(s)` +
      (checked.applied.length ? `, repaired: ${checked.applied.join(", ")}` : ""));
    if (checked.merged && !stops.length) {
      const gate = inventoryShortfall(extract.text, checked.merged);
      record.rounds[record.rounds.length - 1].inventoryGate = gate;
      if (gate.gate === "no-count-found") {
        log(`  INVENTORY GATE: the extract never stated a parseable count - this build cannot be held to a number`);
      }
      if (!gate.short) {
        transcript.rounds.push({ reply: reply.text });
        accepted = checked.merged; record.roundTrips = round; break;
      }
      if (round === MAX_ROUND_TRIPS) {
        // Out of retries: keep the design, and let the verdict tell the truth.
        transcript.rounds.push({ reply: reply.text });
        accepted = checked.merged; record.roundTrips = round;
        record.inventoryShortfall = gate;
        break;
      }
      log(`  INVENTORY: the extract promised ${gate.promised} devices, the design places ${gate.placed}, no finding records the omission - retrying`);
      const countMessage = `Your extracted inventory stated ${gate.promised} devices. This design places ${gate.placed}, and no finding records what was left out. Either add the missing devices - raise topology.canvas.height if they need room - or record exactly what was condensed or omitted as a finding stating both numbers. Reply with the corrected JSON object only.`;
      transcript.rounds.push({ reply: reply.text, problemsMessage: countMessage });
      contents.push({ role: "model", parts: [{ text: reply.text }] });
      contents.push({ role: "user", parts: [{ text: countMessage }] });
      continue;
    }
    const retryMessage = problemsMessage(checked.problems);
    transcript.rounds.push({ reply: reply.text, problemsMessage: retryMessage });
    contents.push({ role: "model", parts: [{ text: reply.text }] });
    contents.push({ role: "user", parts: [{ text: retryMessage }] });
  }
  if (!options.smoke) {
    rotateArtifact(test.dir, "run-transcript.json");
    fs.writeFileSync(path.join(test.dir, "run-transcript.json"), JSON.stringify(transcript, null, 2) + "\n", "utf8");
  }
  if (!accepted) {
    record.verdict = `FAIL - no clean reply within ${MAX_ROUND_TRIPS} round trips`;
    return record;
  }

  // BRAND - the helper's own validator stages the logo.
  const { fields, note } = logoFields(test.dir, test.logoName, test.org);
  const branded = t.brandedData(accepted, fields);
  if (branded.problem) {
    record.branding = { applied: "name only", note, refused: branded.problem };
    const nameOnly = t.brandedData(accepted, { name: test.org });
    if (!nameOnly.problem) accepted = nameOnly.next;
  } else {
    record.branding = { applied: Object.keys(fields).join("+"), note };
    accepted = branded.next;
  }
  log(`  BRAND: ${record.branding.applied} (${note})${branded.problem ? ` - refused: ${branded.problem}` : ""}`);

  // SAVE - the byte-exact splice with save()'s guards.
  const editText = spliceAndGuard(t, state.source, state.payloadStart, state.payloadEnd, accepted);
  const slug = outputSlug(accepted);
  record.drawingId = accepted.document?.drawing || "";
  if (!options.smoke) fs.writeFileSync(path.join(test.dir, `${slug}.edit.html`), editText, "utf8");
  record.saved = `${slug}.edit.html`;
  log(`  SAVE: ${record.saved} (${editText.length} chars)`);

  // PACKAGE - partial builds are the rule and are reported, not failed.
  const { portable, report } = await packageEditable(editText, options.artwork);
  if (!options.smoke) fs.writeFileSync(path.join(test.dir, `${slug}.portable.html`), portable, "utf8");
  record.packaged = `${slug}.portable.html`;
  record.packaging = { embedded: report.embedded, embeddedBytes: report.embeddedBytes, skipped: report.skipped };
  log(`  PACKAGE: ${report.embedded} embedded, ${report.skipped.length} skipped`);

  const warned = record.rounds[record.roundTrips - 1].warnings;
  record.verdict = `PASS - clean save in ${record.roundTrips} round trip${record.roundTrips === 1 ? "" : "s"}` +
    (warned ? ` with ${warned} warning(s)` : "") +
    (record.inventoryShortfall
      ? ` - BUT the extract promised ${record.inventoryShortfall.promised} devices and only ${record.inventoryShortfall.placed} are placed, unrecorded`
      : "");
  return record;
}

/* ---------- smoke: everything except the model ---------- */

async function smoke(t, artwork) {
  const template = fs.readFileSync(path.join(root, "starters", "network-design-template.edit.html"), "utf8");
  t.loadSource(template, "network-design-template.edit.html");
  const state = t.state();
  if (!state.currentData) throw new Error("template did not load");
  t.setRequest(t.freshRequestText("Smoke Test Network", "", "auto"));
  const prompt = t.buildPrompt();
  if (!prompt.includes('Title "Smoke Test Network"')) throw new Error("request text missing from prompt");
  if (prompt.includes("<<<")) throw new Error("an unreplaced placeholder survived in the prompt");
  if (!prompt.includes("Construct positions, never estimate them")) throw new Error("the layout construction rules are missing from a whole-design prompt");
  console.log(`smoke: prompt builds (${prompt.length} chars), EXTRACT_PROMPT ${t.EXTRACT_PROMPT.length} chars`);
  const spliced = spliceAndGuard(t, state.source, state.payloadStart, state.payloadEnd, state.currentData);
  console.log(`smoke: splice + byte guards pass on the unchanged template (${spliced.length} chars)`);
  const { report, ids } = await packageEditable(spliced, artwork);
  console.log(`smoke: packaging - ${ids.length} asset ids, ${report.embedded} embedded, ${report.skipped.length} skipped`);
  console.log("smoke: OK");
}

/* ---------- the nine-run editing matrix (docs/free-model-results.md) ---------- */

/* The protocol's nine part-scoped edits on NET-HQ-001, verbatim from the
   document. Each run is a fresh conversation so no run is helped by the
   context of an earlier one; the design itself carries forward from save to
   save, exactly as the documented live session would. Runs 1-8 are graded
   against the pass bar (clean save in at most two round trips, no
   truncation); run 9 - the whole ~39,000-character design - is diagnostic. */
const EDIT_MATRIX = [
  { part: "nodes",    request: "Add a wireless LAN controller in the internal zone, near the core switches." },
  { part: "links",    request: "Connect hq-wan-01 to hq-wan-02 with a backup link." },
  { part: "zones",    request: "Make the out-of-band zone 30 pixels taller without moving any other zone." },
  { part: "topology", request: "Move hq-srv-01 next to the ESX hosts and connect it to both core switches." },
  { part: "rack",     request: "Give hq-wan-01 and hq-wan-02 the drawn face of a 1U router." },
  { part: "findings", request: "Add a finding pinned to hq-srv-01: its backup path has never been tested." },
  { part: "sections", request: "Add a note to the operations section: weekly configuration backups are assumed, not verified." },
  { part: "document", request: "Bump the revision to v1.1 and set the date to today. Change nothing else." },
  { part: "all",      request: "Add a second wireless LAN controller as an HA pair for the first, wired to both cores." }
];

const MATRIX_STARTER = "NET-HQ-001.edit.html";

async function runEditMatrix(t, options, log) {
  const dir = path.join(options.testsDir, "editing-matrix");
  fs.mkdirSync(dir, { recursive: true });
  let source = fs.readFileSync(path.join(root, "starters", MATRIX_STARTER), "utf8");
  const record = {
    protocol: "nine-run editing matrix", starter: MATRIX_STARTER,
    model: options.model, date: new Date().toISOString(), runs: []
  };
  const transcript = { starter: MATRIX_STARTER, runs: [] };

  for (let index = 0; index < EDIT_MATRIX.length; index++) {
    const { part, request } = EDIT_MATRIX[index];
    const number = index + 1;
    t.loadSource(source, MATRIX_STARTER);
    const state = t.state();
    t.setSlice(part);
    t.setRequest(request);
    const prompt = t.buildPrompt();
    log(`\n  RUN ${number} (${part}): ${request}`);
    const runRecord = { run: number, part, request, rounds: [] };
    const runTranscript = { run: number, part, request, prompt, rounds: [] };
    const contents = [{ role: "user", parts: [{ text: prompt }] }];
    let accepted = null;
    for (let round = 1; round <= MAX_ROUND_TRIPS; round++) {
      await sleep(options.delayMs);
      const reply = await callModel(options.model, options.key, contents, log);
      record.modelVersion = reply.modelVersion;
      const checked = runCheck(t, reply.text, state.currentData, part);
      const stops = checked.problems.filter((p) => p.stop);
      const warnings = checked.problems.length - stops.length;
      runRecord.rounds.push({
        round, finishReason: reply.finishReason, chars: reply.text.length, usage: reply.usage,
        repairsApplied: checked.applied, truncated: checked.truncated,
        stops: stops.map((p) => p.what), warnings,
        warningTexts: checked.problems.filter((p) => !p.stop).map((p) => p.what)
      });
      log(`  run ${number} round ${round}: ${reply.text.length} chars, ${stops.length} stop(s), ${warnings} warning(s)` +
        (checked.applied.length ? `, repaired: ${checked.applied.join(", ")}` : ""));
      if (checked.merged && !stops.length) {
        runTranscript.rounds.push({ reply: reply.text });
        accepted = checked.merged;
        runRecord.roundTrips = round;
        break;
      }
      const retryMessage = problemsMessage(checked.problems);
      runTranscript.rounds.push({ reply: reply.text, problemsMessage: retryMessage });
      contents.push({ role: "model", parts: [{ text: reply.text }] });
      contents.push({ role: "user", parts: [{ text: retryMessage }] });
    }
    if (!accepted) {
      runRecord.verdict = `FAIL - no clean save within ${MAX_ROUND_TRIPS} round trips`;
      record.runs.push(runRecord);
      transcript.runs.push(runTranscript);
      log(`  run ${number}: ${runRecord.verdict} - the session cannot continue from an unsaved design`);
      break;
    }
    source = spliceAndGuard(t, state.source, state.payloadStart, state.payloadEnd, accepted);
    const trips = runRecord.roundTrips;
    const warned = runRecord.rounds[trips - 1].warnings;
    runRecord.verdict = `clean save in ${trips} round trip${trips === 1 ? "" : "s"}` +
      (warned ? ` with ${warned} warning(s)` : "");
    log(`  run ${number}: ${runRecord.verdict}`);
    record.runs.push(runRecord);
    transcript.runs.push(runTranscript);
  }

  const graded = record.runs.filter((r) => r.run <= 8);
  const passed = graded.length === 8 && graded.every((r) =>
    r.roundTrips && r.roundTrips <= 2 && r.rounds.every((round) => !round.truncated));
  const nine = record.runs.find((r) => r.run === 9);
  record.verdict = (passed
    ? "PASS - runs 1-8 clean in at most two round trips, no truncation"
    : "FAIL - see the runs") +
    (nine ? `; run 9 (diagnostic): ${nine.verdict || "no clean save"}` : "; run 9 not reached");

  if (!options.smoke) {
    const finalName = "NET-HQ-001.after-matrix.edit.html";
    fs.writeFileSync(path.join(dir, finalName), source, "utf8");
    record.saved = finalName;
    rotateArtifact(dir, "run-log.json");
    fs.writeFileSync(path.join(dir, "run-log.json"), JSON.stringify(record, null, 2) + "\n", "utf8");
    rotateArtifact(dir, "run-transcript.json");
    fs.writeFileSync(path.join(dir, "run-transcript.json"), JSON.stringify(transcript, null, 2) + "\n", "utf8");
  }
  log(`\n  MATRIX: ${record.verdict}`);
  return record;
}

/* Matrix smoke: compose all nine prompts against the real starter, prove the
   slice targeting and the splice path, spend zero quota. */
function editMatrixSmoke(t) {
  const source = fs.readFileSync(path.join(root, "starters", MATRIX_STARTER), "utf8");
  t.loadSource(source, MATRIX_STARTER);
  const state = t.state();
  for (const { part, request } of EDIT_MATRIX) {
    t.setSlice(part);
    t.setRequest(request);
    const prompt = t.buildPrompt();
    if (!prompt.includes(request)) throw new Error(`the ${part} prompt lost its request`);
    if (part !== "all" && !prompt.includes("ONE PART")) throw new Error(`the ${part} prompt is not part-scoped`);
    if (part === "all" && !prompt.includes("all four top-level keys")) throw new Error("the Everything prompt is not whole-design");
    console.log(`smoke: matrix prompt (${part}) builds, ${prompt.length} chars`);
  }
  spliceAndGuard(t, state.source, state.payloadStart, state.payloadEnd, state.currentData);
  console.log("smoke: edit-matrix OK");
}

/* ---------- main ---------- */

function parseArgs(argv) {
  const options = { tests: "3-9", model: "gemini-3.6-flash", delayMs: 7000, smoke: false };
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--tests-dir") options.testsDir = argv[++i];
    else if (arg === "--tests") options.tests = argv[++i];
    else if (arg === "--model") options.model = argv[++i];
    else if (arg === "--env-file") options.envFile = argv[++i];
    else if (arg === "--delay-ms") options.delayMs = Number(argv[++i]);
    else if (arg === "--smoke") options.smoke = true;
    else if (arg === "--edit-matrix") options.editMatrix = true;
    else throw new Error(`unknown argument: ${arg}`);
  }
  const range = options.tests.match(/^(\d+)-(\d+)$/);
  options.testNumbers = range
    ? Array.from({ length: Number(range[2]) - Number(range[1]) + 1 }, (_, i) => Number(range[1]) + i)
    : options.tests.split(",").map(Number);
  return options;
}

if (require.main === module) (async () => {
  const options = parseArgs(process.argv);
  const t = loadHelper();
  const artwork = repoArtwork();
  console.log(`artwork index: ${artwork.files} files from assets/`);

  if (options.smoke) {
    await smoke(t, artwork);
    if (options.editMatrix) editMatrixSmoke(t);
    return;
  }

  if (!options.testsDir) throw new Error("--tests-dir is required (or use --smoke)");
  options.key = readKey(options.envFile);
  options.artwork = artwork;

  if (options.editMatrix) {
    const record = await runEditMatrix(t, options, (line) => console.log(line));
    if (/FAIL/.test(record.verdict)) process.exitCode = 1;
    return;
  }

  const results = [];
  for (const number of options.testNumbers) {
    const dir = path.join(options.testsDir, `test${number}`);
    console.log(`\n=== test${number} ===`);
    const test = discoverTest(dir);
    console.log(`  ${test.topologyName} + ${test.logoName} -> "${test.title}"`);
    let record;
    try {
      record = await runTest(t, test, options, (line) => console.log(line));
    } catch (error) {
      record = { test: `test${number}`, model: options.model, date: new Date().toISOString(),
        verdict: `ERROR - ${error.message}` };
      console.log(`  ERROR: ${error.message}`);
    }
    rotateArtifact(dir, "run-log.json");
    fs.writeFileSync(path.join(dir, "run-log.json"), JSON.stringify(record, null, 2) + "\n", "utf8");
    results.push(record);
    console.log(`  verdict: ${record.verdict}`);
    await sleep(options.delayMs);
  }

  console.log("\n=== summary ===");
  for (const record of results) {
    console.log(`${record.test}: ${record.verdict}` +
      (record.roundTrips ? ` (model ${record.modelVersion}, ${record.roundTrips} round trip(s))` : ""));
  }
  if (results.some((record) => /^(FAIL|ERROR)/.test(record.verdict))) process.exitCode = 1;
})().catch((error) => { console.error(error.message); process.exit(1); });

// The gate and the rotation are graded by the behaviour suite; requiring
// this file runs nothing.
module.exports = { statedDeviceCount, confessesCondensation, inventoryShortfall, rotateArtifact, EDIT_MATRIX };
