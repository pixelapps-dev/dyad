import { tool } from "ai";
import { z } from "zod";
import fs from "node:fs/promises";
import path from "node:path";
import { safeResolveDir } from "../path_safety";
import type { AgentContext } from "../types";

const DEFAULT_IGNORES = new Set([
  "node_modules",
  ".git",
  ".next",
  "dist",
  "build",
  ".vite",
  ".turbo",
  ".cache",
]);

export function listFilesTool(ctx: AgentContext) {
  return tool({
    description:
      "List files and directories at a workspace-relative path. Common build/vendor directories are filtered out by default.",
    inputSchema: z.object({
      path: z.string().default(".").describe("Directory to list"),
      recursive: z.boolean().default(false),
      includeHidden: z.boolean().default(false),
    }),
    execute: async ({ path: relPath, recursive, includeHidden }) => {
      const root = await safeResolveDir(ctx.appPath, relPath);
      const out: Array<{ path: string; type: "file" | "dir"; size?: number }> =
        [];

      async function walk(dir: string, prefix: string) {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (!includeHidden && entry.name.startsWith(".")) continue;
          if (DEFAULT_IGNORES.has(entry.name)) continue;
          const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
          const abs = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            out.push({ path: rel, type: "dir" });
            if (recursive) await walk(abs, rel);
          } else if (entry.isFile()) {
            const stat = await fs.stat(abs);
            out.push({ path: rel, type: "file", size: stat.size });
          }
        }
      }

      await walk(root, "");
      return { root: relPath, entries: out };
    },
  });
}
