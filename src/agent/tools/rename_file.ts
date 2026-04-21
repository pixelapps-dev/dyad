import { tool } from "ai";
import { z } from "zod";
import fs from "node:fs/promises";
import path from "node:path";
import { safeResolve } from "../path_safety";
import type { AgentContext } from "../types";

export function renameFileTool(ctx: AgentContext) {
  return tool({
    description: "Rename or move a file within the app workspace.",
    inputSchema: z.object({
      from: z.string(),
      to: z.string(),
    }),
    execute: async ({ from, to }) => {
      const absFrom = await safeResolve(ctx.appPath, from);
      const absTo = await safeResolve(ctx.appPath, to);
      await fs.mkdir(path.dirname(absTo), { recursive: true });
      await fs.rename(absFrom, absTo);
      return { from, to, renamed: true };
    },
  });
}
