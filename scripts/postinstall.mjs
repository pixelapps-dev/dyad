#!/usr/bin/env node
/**
 * Post-install repair pass.
 *
 * pnpm's content-addressable store can deduplicate the `electron`
 * package across projects, and when it restores the package from
 * the store (`reused` in the pnpm output) the `node install.js`
 * postinstall hook doesn't re-run — leaving
 * `node_modules/electron/dist/` empty and `pnpm start` crashing with:
 *
 *   Error: Electron failed to install correctly, please delete
 *   node_modules/electron and try installing again
 *
 * This script detects the empty-dist state and kicks off the
 * download exactly once. It's a no-op on healthy installs.
 *
 * The script is registered as `package.json`'s `scripts.postinstall`
 * so every `pnpm install` / `npm install` ends with a healthy
 * Electron binary.
 */
import { existsSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const ELECTRON_DIR = path.join(ROOT, "node_modules", "electron");
const DIST_DIR = path.join(ELECTRON_DIR, "dist");
const INSTALL_SCRIPT = path.join(ELECTRON_DIR, "install.js");

function hasElectronBinary() {
  if (!existsSync(DIST_DIR)) return false;
  try {
    const entries = readdirSync(DIST_DIR);
    // On every platform the extraction drops more than a couple of files.
    // An empty (or near-empty) dist means the download silently bailed.
    return entries.length > 2;
  } catch {
    return false;
  }
}

if (!existsSync(ELECTRON_DIR) || !existsSync(INSTALL_SCRIPT)) {
  // Either electron hasn't been installed yet (this script may run
  // before `electron` is placed) or the user has a very old setup.
  // Nothing we can do — let the real install flow proceed.
  process.exit(0);
}

if (hasElectronBinary()) {
  process.exit(0);
}

console.log(
  "[pagemate:postinstall] electron/dist is empty — running install.js to repair…",
);
const result = spawnSync(process.execPath, [INSTALL_SCRIPT], {
  cwd: ELECTRON_DIR,
  stdio: "inherit",
});
if (result.status !== 0) {
  console.error(
    "[pagemate:postinstall] electron install.js exited with code",
    result.status,
  );
  console.error(
    "[pagemate:postinstall] If this keeps failing, set GITHUB_TOKEN and re-run `pnpm install`.",
  );
  process.exit(result.status ?? 1);
}
