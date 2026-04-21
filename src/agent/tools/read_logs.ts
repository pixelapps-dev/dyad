import { tool } from "ai";
import { z } from "zod";
import { eq } from "drizzle-orm";

import { db } from "../../db";
import { apps } from "../../db/schema";
import { getSupabaseProjectLogs } from "../../supabase_admin/supabase_management_client";
import type { AgentContext } from "../types";

const MAX_RETURNED_LOGS = 200;

export function readLogsTool(ctx: AgentContext) {
  return tool({
    description:
      "Fetch recent edge-function logs for the app's Supabase project. Returns the most recent entries (up to 200). Pass sinceMillis to filter to entries newer than a given epoch-millis timestamp.",
    inputSchema: z.object({
      sinceMillis: z
        .number()
        .int()
        .nonnegative()
        .optional()
        .describe(
          "Optional epoch-milliseconds lower bound. When omitted, the last 10 minutes of logs are returned.",
        ),
    }),
    execute: async ({ sinceMillis }) => {
      const row = await db.query.apps.findFirst({
        where: eq(apps.id, ctx.appId),
        columns: {
          supabaseProjectId: true,
          supabaseOrganizationSlug: true,
        },
      });
      if (!row) {
        throw new Error(`app not found: ${ctx.appId}`);
      }
      if (!row.supabaseProjectId) {
        throw new Error(
          "this app is not linked to a Supabase project; cannot read logs",
        );
      }

      const response = await getSupabaseProjectLogs(
        row.supabaseProjectId,
        sinceMillis,
        row.supabaseOrganizationSlug ?? undefined,
      );

      if (response.error) {
        const msg =
          typeof response.error === "string"
            ? response.error
            : JSON.stringify(response.error);
        throw new Error(`failed to fetch logs: ${msg}`);
      }

      const raw = response.result ?? [];
      const trimmed = raw.slice(-MAX_RETURNED_LOGS);
      const entries = trimmed.map((entry) => {
        const meta = entry.metadata?.[0] ?? {};
        const level = meta.level ?? "info";
        return {
          timestampMicros: entry.timestamp,
          level:
            level === "error" ? "error" : level === "warn" ? "warn" : "info",
          message: entry.event_message ?? "",
        };
      });

      return {
        supabaseProjectId: row.supabaseProjectId,
        count: entries.length,
        truncated: raw.length > trimmed.length,
        entries,
      };
    },
  });
}
