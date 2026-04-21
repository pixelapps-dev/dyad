import type { ToolSet } from "ai";
import type { AgentContext } from "../types";
import { readFileTool } from "./read_file";
import { writeFileTool } from "./write_file";
import { deleteFileTool } from "./delete_file";
import { renameFileTool } from "./rename_file";
import { copyFileTool } from "./copy_file";
import { listFilesTool } from "./list_files";
import { grepTool } from "./grep";
import { editFileTool } from "./edit_file";
import { runTypeChecksTool } from "./run_type_checks";
import { addDependencyTool } from "./add_dependency";
import { webFetchTool } from "./web_fetch";
import { webCrawlTool } from "./web_crawl";
import { executeSqlTool } from "./execute_sql";
import { getDatabaseTableSchemaTool } from "./get_database_table_schema";
import { readLogsTool } from "./read_logs";

/**
 * Build the agent tool set for a given app context.
 *
 * P0 filesystem + search tools and most of the P1 tools are wired here.
 * The Supabase-backed tools (execute_sql, get_database_table_schema,
 * read_logs) only succeed on apps linked to a Supabase project; they
 * throw a clear error otherwise. Remaining P1 tools (web_search,
 * generate_image) are still pending — see FORK.md.
 */
export function buildAgentTools(ctx: AgentContext): ToolSet {
  return {
    read_file: readFileTool(ctx),
    write_file: writeFileTool(ctx),
    edit_file: editFileTool(ctx),
    delete_file: deleteFileTool(ctx),
    rename_file: renameFileTool(ctx),
    copy_file: copyFileTool(ctx),
    list_files: listFilesTool(ctx),
    grep: grepTool(ctx),
    run_type_checks: runTypeChecksTool(ctx),
    add_dependency: addDependencyTool(ctx),
    web_fetch: webFetchTool(),
    web_crawl: webCrawlTool(),
    execute_sql: executeSqlTool(ctx),
    get_database_table_schema: getDatabaseTableSchemaTool(ctx),
    read_logs: readLogsTool(ctx),
  };
}
