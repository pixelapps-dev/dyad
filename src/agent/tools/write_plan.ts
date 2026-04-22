import { tool } from "ai";
import { z } from "zod";
import fs from "node:fs/promises";
import path from "node:path";

import { safeResolve } from "../path_safety";
import type { AgentContext } from "../types";

/**
 * Plans are just Markdown files under `.dyad/plans/` in the app
 * workspace. This tool writes the plan body and returns the path —
 * the renderer's existing `planContracts.getPlan` / `getPlanForChat`
 * IPC reads the same files, so no additional plumbing is needed.
 *
 * A slug is derived from chat id + a short hash of the title so
 * repeat calls overwrite the same file rather than accumulating.
 */
function slugifyTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function writePlanTool(ctx: AgentContext) {
  return tool({
    description:
      "Write or overwrite the plan for the current chat as a Markdown document inside the app workspace (`.dyad/plans/`). Use this in plan mode to record the agreed-upon plan before execution; the renderer picks it up via the existing plan IPC. Returns the saved plan path.",
    inputSchema: z.object({
      title: z
        .string()
        .min(1)
        .max(120)
        .describe("Human-readable title for the plan."),
      summary: z
        .string()
        .max(400)
        .optional()
        .describe("One or two sentence summary shown in the plan picker."),
      content: z
        .string()
        .min(1)
        .describe("Full Markdown body of the plan (no frontmatter — the tool adds it)."),
    }),
    execute: async ({ title, summary, content }) => {
      const planDir = await safeResolve(ctx.appPath, ".dyad/plans");
      await fs.mkdir(planDir, { recursive: true });
      const slug = `chat-${ctx.chatId}-${slugifyTitle(title)}`;
      const now = new Date().toISOString();
      const filePath = path.join(planDir, `${slug}.md`);
      const frontmatter = [
        "---",
        `title: ${title}`,
        `summary: ${summary ?? ""}`,
        `chatId: ${ctx.chatId}`,
        `createdAt: ${now}`,
        `updatedAt: ${now}`,
        "---",
        "",
      ].join("\n");
      await fs.writeFile(filePath, frontmatter + content, "utf8");
      return {
        planId: slug,
        path: path.relative(ctx.appPath, filePath),
      };
    },
  });
}
