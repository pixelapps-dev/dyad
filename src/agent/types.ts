import type { Tool } from "ai";

export interface AgentContext {
  appId: number;
  appPath: string;
  chatId: number;
  requestId: string;
}

export type AgentTool = Tool;

export type AgentToolName =
  | "read_file"
  | "write_file"
  | "edit_file"
  | "delete_file"
  | "rename_file"
  | "copy_file"
  | "list_files"
  | "grep"
  | "run_type_checks"
  | "add_dependency"
  | "execute_sql"
  | "get_database_table_schema"
  | "web_fetch"
  | "web_search"
  | "web_crawl"
  | "generate_image"
  | "read_logs"
  | "update_todos"
  | "write_plan"
  | "exit_plan"
  | "set_chat_summary"
  | "planning_questionnaire";
