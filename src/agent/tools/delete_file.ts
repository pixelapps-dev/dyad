import { tool } from "ai";
import { z } from "zod";
import fs from "node:fs/promises";
import { safeResolve } from "../path_safety";
import type { AgentContext } from "../types";

export function deleteFileTool(ctx: AgentContext) {
  return tool({
    description: "Delete a file from the app workspace.",
    inputSchema: z.object({ path: z.string() }),
    execute: async ({ path: relPath }) => {
      const abs = await safeResolve(ctx.appPath, relPath);
      const stat = await fs.stat(abs);
      if (stat.isDirectory()) {
        throw new Error(
          `refusing to delete directory via delete_file: ${relPath}`,
        );
      }
      await fs.unlink(abs);
      return { path: relPath, deleted: true };
    },
  });
}
