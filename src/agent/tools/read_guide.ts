import { tool } from "ai";
import { z } from "zod";
import fs from "node:fs/promises";
import path from "node:path";

const GUIDES_DIR = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  "..",
  "..",
  "prompts",
  "guides",
);

/**
 * Curated Pagemate how-to guides shipped with the app. The agent can
 * fetch one on demand — e.g. "how do I wire auth into this app?" —
 * instead of bloating every system prompt with the full library.
 */
async function listGuides(): Promise<string[]> {
  try {
    const entries = await fs.readdir(GUIDES_DIR);
    return entries.filter((e) => e.endsWith(".md")).sort();
  } catch {
    return [];
  }
}

export function readGuideTool() {
  return tool({
    description:
      "Read one of Pagemate's bundled how-to guides by name (e.g. 'add-authentication' for `add-authentication.md`). Omit the name to list every available guide. Use this before proposing boilerplate that has a curated recipe.",
    inputSchema: z.object({
      name: z
        .string()
        .optional()
        .describe(
          "Guide basename without the .md extension. If omitted, returns the list of available guides.",
        ),
    }),
    execute: async ({ name }) => {
      if (!name) {
        const available = await listGuides();
        return {
          available: available.map((f) => f.replace(/\.md$/, "")),
          usage: "Call again with name=<one of the above>.",
        };
      }
      // Resolve and ensure we stay under the guides directory.
      const candidate = path.resolve(GUIDES_DIR, `${name}.md`);
      if (!candidate.startsWith(GUIDES_DIR + path.sep)) {
        throw new Error(`guide path escapes directory: ${name}`);
      }
      try {
        const content = await fs.readFile(candidate, "utf8");
        return { name, content };
      } catch (err) {
        const available = await listGuides();
        throw new Error(
          `Guide not found: ${name}. Available: ${available
            .map((f) => f.replace(/\.md$/, ""))
            .join(", ") || "(none)"} (${(err as Error).message})`,
        );
      }
    },
  });
}
