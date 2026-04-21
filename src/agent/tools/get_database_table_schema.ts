import { tool } from "ai";
import { z } from "zod";
import { eq } from "drizzle-orm";

import { db } from "../../db";
import { apps } from "../../db/schema";
import { getSupabaseTableSchema } from "../../supabase_admin/supabase_context";
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
      "this app is not linked to a Supabase project; cannot query schema",
    );
  }
  return {
    supabaseProjectId: row.supabaseProjectId,
    organizationSlug: row.supabaseOrganizationSlug ?? null,
  };
}

export function getDatabaseTableSchemaTool(ctx: AgentContext) {
  return tool({
    description:
      "Fetch the Postgres schema (tables, columns, RLS policies, triggers, and — when no table is specified — functions) for the app's Supabase project. Pass a tableName to limit the result to a single table.",
    inputSchema: z.object({
      tableName: z
        .string()
        .optional()
        .describe(
          "Optional. If set, return schema only for this table; otherwise return all tables in the public schema.",
        ),
    }),
    execute: async ({ tableName }) => {
      const link = await loadSupabaseLink(ctx.appId);
      const schemaJson = await getSupabaseTableSchema({
        supabaseProjectId: link.supabaseProjectId,
        organizationSlug: link.organizationSlug,
        tableName,
      });
      return {
        supabaseProjectId: link.supabaseProjectId,
        tableName: tableName ?? null,
        schema: schemaJson,
      };
    },
  });
}
