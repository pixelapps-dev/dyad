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

/**
 * Build the agent tool set for a given app context. Only P0 tools are wired
 * here; extend this registry as you port more tools (see FORK.md).
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
  };
}
