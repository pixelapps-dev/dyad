import { tool } from "ai";
import { z } from "zod";

import { emitTodosUpdate } from "../events";
import type { AgentContext } from "../types";
import type { AgentTodo } from "@/ipc/types";

const TodoInputSchema = z.object({
  id: z.string().min(1),
  content: z.string().min(1).max(500),
  status: z.enum(["pending", "in_progress", "completed"]),
});

/**
 * Mirror of the agent-side todo list the renderer shows as a pill
 * tracker above the chat input. The tool broadcasts the full list on
 * every call — the renderer already treats each message as a
 * replace-all update, so partial diffs aren't supported.
 */
export function updateTodosTool(ctx: AgentContext) {
  return tool({
    description:
      "Replace the agent's current todo list for this chat. Pass the FULL list every call — status may be 'pending', 'in_progress', or 'completed'. Use this to show the user an ordered plan before executing it, and to mark items done as you finish them.",
    inputSchema: z.object({
      todos: z.array(TodoInputSchema).max(50),
    }),
    execute: async ({ todos }) => {
      emitTodosUpdate(ctx.chatId, todos as AgentTodo[]);
      return {
        chatId: ctx.chatId,
        count: todos.length,
      };
    },
  });
}
