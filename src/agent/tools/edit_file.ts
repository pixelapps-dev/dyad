import { tool } from "ai";
import { z } from "zod";
import fs from "node:fs/promises";
import { safeResolve } from "../path_safety";
import type { AgentContext } from "../types";

/**
 * Simple anchored find/replace. The `find` string must appear exactly once in
 * the file. This is intentionally strict — the model should include enough
 * surrounding context in `find` to make the match unique.
 *
 * We deliberately do NOT use a DSL here; if a file needs multiple edits the
 * model can invoke edit_file multiple times.
 */
export function editFileTool(ctx: AgentContext) {
  return tool({
    description:
      "Edit part of a file by exact string replacement. The `find` string must be present exactly once — include enough surrounding context to make it unique.",
    inputSchema: z.object({
      path: z.string(),
      find: z.string().min(1),
      replace: z.string(),
    }),
    execute: async ({ path: relPath, find, replace }) => {
      const abs = await safeResolve(ctx.appPath, relPath);
      const original = await fs.readFile(abs, "utf8");
      const first = original.indexOf(find);
      if (first === -1) {
        throw new Error(`find string not found in ${relPath}`);
      }
      const second = original.indexOf(find, first + find.length);
      if (second !== -1) {
        throw new Error(
          `find string matches multiple times in ${relPath}; add more surrounding context to make it unique`,
        );
      }
      const updated =
        original.slice(0, first) + replace + original.slice(first + find.length);
      await fs.writeFile(abs, updated, "utf8");
      return {
        path: relPath,
        before: find.length,
        after: replace.length,
      };
    },
  });
}
