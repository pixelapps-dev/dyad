#!/usr/bin/env node
/**
 * Rebrand the fork from "Dyad" to a new product name in one pass.
 *
 * Usage:
 *   node scripts/rebrand.mjs \
 *     --name "Kestrel" \
 *     --github-slug "pixelapps-dev/kestrel" \
 *     --api-host "api.kestrel.dev" \
 *     --engine-host "engine.kestrel.dev" \
 *     --protocol kestrel \
 *     --posthog-key "phc_abcdefghijk" \
 *     [--apply]
 *
 * Without `--apply`, runs in dry-run mode and prints the planned edits.
 *
 * Deliberately narrow scope:
 *
 *   - Renames high-signal public surfaces (package.json name / productName,
 *     repository URL, protocol handler, API host, engine host, GitHub
 *     publisher, PostHog project key).
 *   - Does NOT touch internal code symbols (`dyadRequestId`,
 *     `dyadEngineUrl`, etc.) — they're internal protocol tokens that the
 *     upstream XML dialect and the compat layer still depend on.
 *   - Does NOT rewrite historical issue-link comments
 *     (`https://github.com/dyad-sh/dyad/issues/NNNN`), since the issues
 *     themselves don't move.
 *   - Leaves `<dyad-*>` XML tags alone — see FORK.md for the sunset plan.
 *
 * After this script finishes, you still need to:
 *
 *   1. Swap `assets/icon/*` with new icon PNG/ICO/ICNS files.
 *   2. Recreate the PostHog project (or reuse) and confirm the key here
 *      matches what `src/renderer.tsx` expects.
 *   3. Decide whether to mass-rename internal `dyad*` symbols; do it in
 *      a follow-up PR so the diff stays reviewable.
 *   4. Regenerate `pnpm-lock.yaml` by running `pnpm install`.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");

function parseArgs(argv) {
  const out = { apply: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--apply") {
      out.apply = true;
    } else if (arg.startsWith("--") && i + 1 < argv.length) {
      const key = arg.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      out[key] = argv[++i];
    }
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));

const REQUIRED = [
  "name",
  "githubSlug",
  "apiHost",
  "engineHost",
  "protocol",
];
for (const r of REQUIRED) {
  if (!args[r]) {
    console.error(
      `Missing required flag --${r.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase())}`,
    );
    console.error(
      "Run with --help or see the top of this file for the full usage example.",
    );
    process.exit(2);
  }
}

const name = args.name; // "Kestrel"
const lowerName = name.toLowerCase(); // "kestrel"
const githubSlug = args.githubSlug; // "pixelapps-dev/kestrel"
const apiHost = args.apiHost; // "api.kestrel.dev"
const engineHost = args.engineHost; // "engine.kestrel.dev"
const protocol = args.protocol; // "kestrel"
const posthogKey = args.posthogKey; // optional

/**
 * A single edit. `file` is relative to REPO_ROOT. `replacements` is
 * an array of [search, replace] pairs applied in order. Each search
 * is a literal string; to be forgiving we also log when a search
 * produces zero matches so the author notices upstream drift.
 */
const edits = [
  {
    file: "package.json",
    replacements: [
      ['"name": "dyad"', `"name": "${lowerName}"`],
      ['"productName": "dyad"', `"productName": "${name}"`],
      [
        '"url": "https://github.com/dyad-sh/dyad.git"',
        `"url": "https://github.com/${githubSlug}.git"`,
      ],
    ],
  },
  {
    file: "forge.config.ts",
    replacements: [
      [`schemes: ["dyad"],`, `schemes: ["${protocol}"],`],
      [
        `"https://raw.githubusercontent.com/dyad-sh/dyad/main/assets/icon/logo.ico"`,
        `"https://raw.githubusercontent.com/${githubSlug}/main/assets/icon/logo.ico"`,
      ],
      [`name: "dyad",`, `name: "${lowerName}",`],
    ],
  },
  {
    file: "src/main.ts",
    replacements: [
      [
        "`https://api.dyad.sh/v1/update/${postfix}`",
        "`https://" + apiHost + "/v1/update/${postfix}`",
      ],
      [`repo: "dyad-sh/dyad",`, `repo: "${githubSlug}",`],
    ],
  },
  {
    file: "src/ipc/shared/remote_desktop_config.ts",
    replacements: [
      [
        '"https://api.dyad.sh/v1/desktop-config"',
        `"https://${apiHost}/v1/desktop-config"`,
      ],
    ],
  },
  {
    file: "src/ipc/shared/remote_language_model_catalog.ts",
    replacements: [
      [
        '"https://api.dyad.sh/v1/language-model-catalog"',
        `"https://${apiHost}/v1/language-model-catalog"`,
      ],
    ],
  },
  {
    file: "src/ipc/handlers/free_agent_quota_handlers.ts",
    replacements: [
      ['"https://api.dyad.sh/health"', `"https://${apiHost}/health"`],
      ["Uses the HTTP Date header from api.dyad.sh.", `Uses the HTTP Date header from ${apiHost}.`],
    ],
  },
  {
    file: "src/ipc/handlers/pro_handlers.ts",
    replacements: [
      ['"https://api.dyad.sh/v1/user/info"', `"https://${apiHost}/v1/user/info"`],
      [
        '"https://engine.dyad.sh/v1"',
        `"https://${engineHost}/v1"`,
      ],
    ],
  },
  {
    file: "src/ipc/utils/get_model_client.ts",
    replacements: [
      [
        '"https://engine.dyad.sh/v1"',
        `"https://${engineHost}/v1"`,
      ],
    ],
  },
  {
    file: "src/ipc/utils/cloud_sandbox_provider.ts",
    replacements: [
      [
        '"https://engine.dyad.sh/v1"',
        `"https://${engineHost}/v1"`,
      ],
    ],
  },
  {
    file: "src/ipc/handlers/image_generation_handlers.ts",
    replacements: [
      [
        '"https://engine.dyad.sh/v1"',
        `"https://${engineHost}/v1"`,
      ],
    ],
  },
  {
    file: "src/ipc/utils/template_utils.ts",
    replacements: [
      [
        '"https://api.dyad.sh/v1/templates"',
        `"https://${apiHost}/v1/templates"`,
      ],
    ],
  },
];

// PostHog key is optional — only edit if provided, and only if the file
// actually references the old key. We search for the common
// `posthog.init("phc_...")` pattern.
if (posthogKey) {
  edits.push({
    file: "src/renderer.tsx",
    replacements: [
      [
        /posthog\.init\(\s*"(phc_[A-Za-z0-9]+)"/g,
        `posthog.init(\n      "${posthogKey}"`,
      ],
    ],
  });
}

let totalEdits = 0;
let failedLookups = 0;

for (const edit of edits) {
  const absPath = path.join(REPO_ROOT, edit.file);
  if (!existsSync(absPath)) {
    console.warn(`SKIP  ${edit.file} (not found)`);
    continue;
  }
  const before = readFileSync(absPath, "utf8");
  let after = before;
  for (const [search, replace] of edit.replacements) {
    if (search instanceof RegExp) {
      const matches = after.match(search);
      if (!matches || matches.length === 0) {
        failedLookups++;
        console.warn(`MISS  ${edit.file}: regex ${search} matched nothing`);
        continue;
      }
      after = after.replace(search, replace);
      totalEdits += matches.length;
      continue;
    }
    if (!after.includes(search)) {
      failedLookups++;
      console.warn(
        `MISS  ${edit.file}: literal not found: ${truncate(search, 80)}`,
      );
      continue;
    }
    const parts = after.split(search);
    totalEdits += parts.length - 1;
    after = parts.join(replace);
  }
  if (before === after) continue;
  if (args.apply) {
    writeFileSync(absPath, after, "utf8");
    console.log(`EDIT  ${edit.file}`);
  } else {
    console.log(`DRY   ${edit.file} (would apply ${edit.replacements.length} replacements)`);
  }
}

function truncate(s, n) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

const mode = args.apply ? "APPLIED" : "DRY-RUN";
console.log(
  `\n${mode}: ${totalEdits} replacements across ${edits.length} files.` +
    (failedLookups > 0
      ? ` ${failedLookups} lookups missed — inspect the MISS lines above.`
      : ""),
);
if (!args.apply) {
  console.log("\nRe-run with --apply to write the changes.");
}
console.log(
  "\nFollow-ups after rebrand:\n" +
    "  - Replace assets/icon/* with new icon files.\n" +
    "  - If renaming internal `dyad*` identifiers, do it in a follow-up commit.\n" +
    "  - Regenerate pnpm-lock.yaml (run `pnpm install`).\n" +
    "  - Update NOTICE if attribution wording needs to change.\n",
);
