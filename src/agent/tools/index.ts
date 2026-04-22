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
import { webSearchTool } from "./web_search";
import { generateImageTool } from "./generate_image";
import { executeSqlTool } from "./execute_sql";
import { getDatabaseTableSchemaTool } from "./get_database_table_schema";
import { readLogsTool } from "./read_logs";
import { updateTodosTool } from "./update_todos";
import { writePlanTool } from "./write_plan";
import { exitPlanTool } from "./exit_plan";
import { setChatSummaryTool } from "./set_chat_summary";
import { readGuideTool } from "./read_guide";

/**
 * Build the agent tool set for a given app context.
 *
 * P0 filesystem + search tools and most of the P1 tools are wired here.
 * The Supabase-backed tools (execute_sql, get_database_table_schema,
 * read_logs) only succeed on apps linked to a Supabase project; they
 * throw a clear error otherwise. `web_search` / `generate_image`
 * dispatch to whichever provider has an API key configured under
 * `settings.webSearch` / `settings.imageGeneration` respectively.
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
    // Compatibility alias so prompts trained on the upstream tool
    // vocabulary keep working.
    code_search: grepTool(ctx),
    run_type_checks: runTypeChecksTool(ctx),
    add_dependency: addDependencyTool(ctx),
    web_fetch: webFetchTool(),
    web_crawl: webCrawlTool(),
    web_search: webSearchTool(),
    generate_image: generateImageTool(ctx),
    execute_sql: executeSqlTool(ctx),
    get_database_table_schema: getDatabaseTableSchemaTool(ctx),
    read_logs: readLogsTool(ctx),
    // Agent-state tools — emit / write state the renderer already
    // consumes via existing IPC / atoms.
    update_todos: updateTodosTool(ctx),
    write_plan: writePlanTool(ctx),
    exit_plan: exitPlanTool(ctx),
    set_chat_summary: setChatSummaryTool(ctx),
    read_guide: readGuideTool(),
  };
}
