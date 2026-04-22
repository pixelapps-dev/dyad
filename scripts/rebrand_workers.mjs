#!/usr/bin/env node
/**
 * Rename the worker/dyad-*.js files and their protocol identifier
 * strings to the Pagemate scheme. Both the files themselves and every
 * consumer in src/ use the same literal strings, so a coordinated
 * rename is simpler than an in-place find-and-replace on each call
 * site.
 */
import { readFileSync, writeFileSync, renameSync, readdirSync, lstatSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// Files under worker/ that rename from dyad-* to pagemate-*.
const WORKER_RENAMES = [
  ["worker/pagemate-shim.js", "worker/pagemate-shim.js"],
  ["worker/pagemate-sw.js", "worker/pagemate-sw.js"],
  ["worker/pagemate-sw-register.js", "worker/pagemate-sw-register.js"],
  [
    "worker/pagemate-component-selector-client.js",
    "worker/pagemate-component-selector-client.js",
  ],
  [
    "worker/pagemate-screenshot-client.js",
    "worker/pagemate-screenshot-client.js",
  ],
  [
    "worker/pagemate-visual-editor-client.js",
    "worker/pagemate-visual-editor-client.js",
  ],
  ["worker/pagemate_logs.js", "worker/pagemate_logs.js"],
];

// Ordered replacements: longest literal first so we don't clobber
// prefixes we want to keep intact.
const STRING_REPLACEMENTS = [
  // Protocol / message-type identifiers (both directions).
  ["activate-pagemate-component-selector", "activate-pagemate-component-selector"],
  [
    "deactivate-pagemate-component-selector",
    "deactivate-pagemate-component-selector",
  ],
  [
    "pagemate-component-selector-initialized",
    "pagemate-component-selector-initialized",
  ],
  ["pagemate-screenshot-response", "pagemate-screenshot-response"],
  ["pagemate-take-screenshot", "pagemate-take-screenshot"],
  // Worker file-on-disk references from proxy_server.js and HTML loads.
  ["pagemate-component-selector-client.js", "pagemate-component-selector-client.js"],
  ["pagemate-screenshot-client.js", "pagemate-screenshot-client.js"],
  ["pagemate-visual-editor-client.js", "pagemate-visual-editor-client.js"],
  ["pagemate-sw-register.js", "pagemate-sw-register.js"],
  ["pagemate-shim.js", "pagemate-shim.js"],
  ["pagemate-sw.js", "pagemate-sw.js"],
  ["pagemate_logs.js", "pagemate_logs.js"],
  // Console / log prefixes — pure cosmetic.
  ["[pagemate-shim]", "[pagemate-shim]"],
  ["[pagemate-screenshot]", "[pagemate-screenshot]"],
  ["pagemate-shim.js loaded", "pagemate-shim.js loaded"],
  ["pagemate-shim.js via proxy", "pagemate-shim.js via proxy"],
  ["pagemateShimPath", "pagemateShimPath"],
];

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    // Skip heavy / build-output trees.
    if (
      entry === "node_modules" ||
      entry === ".git" ||
      entry === ".vite" ||
      entry === "dist" ||
      entry === "out"
    ) {
      continue;
    }
    const full = path.join(dir, entry);
    let s;
    try {
      s = lstatSync(full);
    } catch {
      continue;
    }
    if (s.isSymbolicLink()) continue;
    if (s.isDirectory()) {
      walk(full, out);
    } else if (/\.(ts|tsx|js|mjs|cjs|json|md|html|css)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

// Apply string replacements everywhere.
const files = walk(ROOT);
let touched = 0;
for (const file of files) {
  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    continue;
  }
  let next = text;
  for (const [from, to] of STRING_REPLACEMENTS) {
    if (next.includes(from)) {
      next = next.split(from).join(to);
    }
  }
  if (next !== text) {
    writeFileSync(file, next);
    touched++;
    console.log(`edited ${path.relative(ROOT, file)}`);
  }
}

// Rename worker files on disk.
for (const [from, to] of WORKER_RENAMES) {
  const src = path.join(ROOT, from);
  const dst = path.join(ROOT, to);
  try {
    renameSync(src, dst);
    console.log(`renamed ${from} -> ${to}`);
  } catch (err) {
    console.warn(`skip rename ${from}: ${err.message}`);
  }
}

console.log(`TOTAL: ${touched} files edited`);
