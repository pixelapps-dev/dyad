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

/**
 * Build the agent tool set for a given app context.
 *
 * P0 filesystem + search tools and a first wave of P1 tools (type-check,
 * dependency install, web fetch) are wired here. Extend this registry as
 * more P1 tools (execute_sql, read_logs, generate_image, web_search,
 * web_crawl) land — see FORK.md.
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
  };
}
