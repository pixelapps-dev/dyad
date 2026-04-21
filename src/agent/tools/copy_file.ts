import { tool } from "ai";
import { z } from "zod";
import fs from "node:fs/promises";
import path from "node:path";
import { safeResolve } from "../path_safety";
import type { AgentContext } from "../types";

export function copyFileTool(ctx: AgentContext) {
  return tool({
    description: "Copy a file to a new location within the app workspace.",
    inputSchema: z.object({
      from: z.string(),
      to: z.string(),
    }),
    execute: async ({ from, to }) => {
      const absFrom = await safeResolve(ctx.appPath, from);
      const absTo = await safeResolve(ctx.appPath, to);
      await fs.mkdir(path.dirname(absTo), { recursive: true });
      await fs.copyFile(absFrom, absTo);
      return { from, to, copied: true };
    },
  });
}
