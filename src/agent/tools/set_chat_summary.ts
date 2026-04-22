import { tool } from "ai";
import { z } from "zod";
import { eq } from "drizzle-orm";

import { db } from "../../db";
import { chats } from "../../db/schema";
import type { AgentContext } from "../types";

/**
 * Writes a concise title for the current chat — shown in the chat
 * sidebar. The upstream flow set this via a `<dyad-chat-summary>` XML
 * tag in the assistant's final turn; this tool exposes the same
 * effect through the new native-tool-calling surface.
 */
export function setChatSummaryTool(ctx: AgentContext) {
  return tool({
    description:
      "Set a short, ≤80-character summary for the current chat. Used as the sidebar label. Call this once per chat, typically at the end of the first turn, after you understand what the user is building.",
    inputSchema: z.object({
      summary: z
        .string()
        .min(1)
        .max(120)
        .describe("Concise chat title — aim for under 60 chars."),
    }),
    execute: async ({ summary }) => {
      await db
        .update(chats)
        .set({ title: summary })
        .where(eq(chats.id, ctx.chatId));
      return { chatId: ctx.chatId, title: summary };
    },
  });
}
