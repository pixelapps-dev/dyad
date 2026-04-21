import { tool } from "ai";
import { z } from "zod";
import { eq } from "drizzle-orm";

import { db } from "../../db";
import { apps } from "../../db/schema";
import { executeSupabaseSql } from "../../supabase_admin/supabase_management_client";
import type { AgentContext } from "../types";

async function loadSupabaseLink(appId: number): Promise<{
  supabaseProjectId: string;
  organizationSlug: string | null;
}> {
  const row = await db.query.apps.findFirst({
    where: eq(apps.id, appId),
    columns: {
      supabaseProjectId: true,
      supabaseOrganizationSlug: true,
    },
  });
  if (!row) {
    throw new Error(`app not found: ${appId}`);
  }
  if (!row.supabaseProjectId) {
    throw new Error(
      "this app is not linked to a Supabase project; cannot execute SQL",
    );
  }
  return {
    supabaseProjectId: row.supabaseProjectId,
    organizationSlug: row.supabaseOrganizationSlug ?? null,
  };
}

export function executeSqlTool(ctx: AgentContext) {
  return tool({
    description:
      "Execute a raw SQL statement against the app's Supabase Postgres database via the Management API. Returns the result as JSON. Use this only when a structured tool isn't available — destructive statements run with full privileges and are NOT automatically rolled back.",
    inputSchema: z.object({
      query: z
        .string()
        .min(1)
        .describe("Single SQL statement or semicolon-delimited batch."),
    }),
    execute: async ({ query }) => {
      const link = await loadSupabaseLink(ctx.appId);
      const resultJson = await executeSupabaseSql({
        supabaseProjectId: link.supabaseProjectId,
        query,
        organizationSlug: link.organizationSlug,
      });
      return {
        supabaseProjectId: link.supabaseProjectId,
        result: resultJson,
      };
    },
  });
}
