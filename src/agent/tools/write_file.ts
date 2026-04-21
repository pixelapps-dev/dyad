import { tool } from "ai";
import { z } from "zod";
import fs from "node:fs/promises";
import path from "node:path";
import { safeResolve } from "../path_safety";
import type { AgentContext } from "../types";

export function writeFileTool(ctx: AgentContext) {
  return tool({
    description:
      "Create or overwrite a text file at the given workspace-relative path. Parent directories are created automatically.",
    inputSchema: z.object({
      path: z.string(),
      content: z.string(),
    }),
    execute: async ({ path: relPath, content }) => {
      const abs = await safeResolve(ctx.appPath, relPath);
      await fs.mkdir(path.dirname(abs), { recursive: true });
      await fs.writeFile(abs, content, "utf8");
      return { path: relPath, bytes: Buffer.byteLength(content, "utf8") };
    },
  });
}
