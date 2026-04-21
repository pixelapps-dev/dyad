import { tool } from "ai";
import { z } from "zod";
import fs from "node:fs/promises";
import { safeResolve } from "../path_safety";
import type { AgentContext } from "../types";

const MAX_BYTES = 2 * 1024 * 1024;

export function readFileTool(ctx: AgentContext) {
  return tool({
    description:
      "Read a UTF-8 text file from the app workspace. Binary files and files larger than 2MB are rejected.",
    inputSchema: z.object({
      path: z.string().describe("Path relative to the app workspace root"),
    }),
    execute: async ({ path: relPath }) => {
      const abs = await safeResolve(ctx.appPath, relPath);
      const stat = await fs.stat(abs);
      if (!stat.isFile()) {
        throw new Error(`not a file: ${relPath}`);
      }
      if (stat.size > MAX_BYTES) {
        throw new Error(
          `file too large (${stat.size} bytes, max ${MAX_BYTES}): ${relPath}`,
        );
      }
      return await fs.readFile(abs, "utf8");
    },
  });
}
