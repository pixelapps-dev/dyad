import { tool } from "ai";
import { z } from "zod";

import type { AgentContext } from "../types";

/**
 * Signal from plan mode that the planning phase is complete and the
 * user should be prompted to switch into build mode to execute. The
 * tool doesn't flip any state itself — the renderer already watches
 * `chat:response:end` to offer the "execute plan" CTA, so this tool
 * is a stable place for the model to mark "I'm done planning" and
 * for the renderer to hang UI off in a later iteration.
 */
export function exitPlanTool(_ctx: AgentContext) {
  return tool({
    description:
      "Signal that plan mode is complete. Call this once the plan is written (via `write_plan`) and there are no open questions left. The UI will prompt the user to switch to build mode to execute.",
    inputSchema: z.object({
      reason: z
        .string()
        .min(1)
        .max(400)
        .describe("One-sentence reason for exiting plan mode (e.g. 'Plan is ready for execution')."),
    }),
    execute: async ({ reason }) => {
      return { ok: true, reason };
    },
  });
}
