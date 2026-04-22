/**
 * Clean-room replacement for the upstream `handleLocalAgentStream`.
 *
 * The upstream implementation (~1,700 LOC, FSL-1.1-ALv2) lived at
 * src/pro/main/ipc/handlers/local_agent/local_agent_handler.ts. This file
 * re-creates the IPC event contract — enough of it for the UI to function —
 * on top of `runAgent()` in src/agent/run.ts, which in turn wraps the Vercel
 * AI SDK's native tool-calling streamText.
 *
 * This is intentionally the minimum viable wiring:
 *   - No mid-turn compaction, no retry-with-backoff on transient 5xx, no
 *     todos / questionnaire / consent UI, no aiMessagesJson tool-history
 *     replay, no file-edit tracking. Those pieces can land incrementally.
 *   - In build mode we expose the full tool set from buildAgentTools().
 *   - In ask / plan-read-only mode we restrict to non-mutating tools.
 *   - The renderer gets the same IPC events it got before
 *     (`chat:response:chunk` incremental + full, `chat:response:end`,
 *     `chat:response:error`), so no renderer changes are required.
 */

import type { IpcMainInvokeEvent } from "electron";
import { eq } from "drizzle-orm";
import log from "electron-log";
import type { ModelMessage, ToolSet } from "ai";

import { db } from "../../db";
import { chats, messages as messagesTable } from "../../db/schema";
import { getDyadAppPath } from "../../paths/paths";
import { getModelClient } from "../../ipc/utils/get_model_client";
import { readSettings } from "../../main/settings";
import { safeSend } from "../../ipc/utils/safe_sender";
import { appendCancelledResponseNotice } from "@/shared/chatCancellation";
import type { ChatResponseEnd, ChatStreamParams } from "@/ipc/types";
import { DyadError, DyadErrorKind } from "@/errors/dyad_error";

import { runAgent } from "../run";
import { buildAgentTools } from "../tools";
import type { AgentContext } from "../types";
import type {
  AgentToolCallStartPayload,
  AgentToolCallEndPayload,
} from "@/ipc/types/agent";

const logger = log.scope("local_agent_handler");

const DEFAULT_MAX_STEPS = 30;
const DB_SAVE_INTERVAL_MS = 150;
const TOOL_PREVIEW_CHAR_LIMIT = 2_000;

function safePreview(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  let s: string;
  try {
    s = typeof value === "string" ? value : JSON.stringify(value);
  } catch {
    s = String(value);
  }
  if (s.length > TOOL_PREVIEW_CHAR_LIMIT) {
    return s.slice(0, TOOL_PREVIEW_CHAR_LIMIT) + "… [truncated]";
  }
  return s;
}

const READ_ONLY_TOOL_NAMES = new Set<string>([
  "read_file",
  "list_files",
  "grep",
  "code_search",
  "run_type_checks",
  "web_fetch",
  "web_crawl",
  "web_search",
  "get_database_table_schema",
  "read_logs",
  // Agent-state tools are safe for plan / ask mode: they advertise
  // intent to the renderer but don't mutate the workspace or DB
  // state the user hasn't already approved.
  "update_todos",
  "write_plan",
  "exit_plan",
  "read_guide",
]);

export interface HandleLocalAgentStreamOptions {
  placeholderMessageId: number;
  systemPrompt: string;
  dyadRequestId: string;
  /** If true, strip mutating tools (write/edit/delete/rename/copy/add_dependency). */
  readOnly?: boolean;
  /** If true, plan-mode restricted surface. Today treated the same as readOnly. */
  planModeOnly?: boolean;
  /** Pre-baked message history that overrides the DB read. */
  messageOverride?: ModelMessage[];
}

function filterTools(tools: ToolSet, readOnly: boolean): ToolSet {
  if (!readOnly) return tools;
  const out: ToolSet = {};
  for (const [name, tool] of Object.entries(tools)) {
    if (READ_ONLY_TOOL_NAMES.has(name)) {
      out[name] = tool;
    }
  }
  return out;
}

function toModelMessages(
  rows: Array<{ role: "user" | "assistant"; content: string }>,
): ModelMessage[] {
  const out: ModelMessage[] = [];
  for (const row of rows) {
    if (!row.content) continue;
    if (row.role === "user") {
      out.push({ role: "user", content: row.content });
    } else {
      out.push({ role: "assistant", content: row.content });
    }
  }
  return out;
}

export async function handleLocalAgentStream(
  event: IpcMainInvokeEvent,
  req: ChatStreamParams,
  abortController: AbortController,
  opts: HandleLocalAgentStreamOptions,
): Promise<boolean> {
  const {
    placeholderMessageId,
    systemPrompt,
    dyadRequestId,
    readOnly = false,
    planModeOnly = false,
    messageOverride,
  } = opts;

  const settings = readSettings();
  const maxSteps = settings.maxToolCallSteps ?? DEFAULT_MAX_STEPS;

  const chat = await db.query.chats.findFirst({
    where: eq(chats.id, req.chatId),
    with: {
      app: true,
      messages: {
        orderBy: (m, { asc }) => [asc(m.createdAt)],
      },
    },
  });
  if (!chat) {
    throw new DyadError(`Chat not found: ${req.chatId}`, DyadErrorKind.NotFound);
  }
  const appPath = getDyadAppPath(chat.app.path);

  // Send initial full-messages chunk so the placeholder shows up immediately.
  safeSend(event.sender, "chat:response:chunk", {
    chatId: req.chatId,
    messages: chat.messages,
  });

  const modelMessages: ModelMessage[] =
    messageOverride ??
    // Exclude the placeholder assistant row (which has empty content)
    // so we don't hand the model an empty assistant turn to continue.
    toModelMessages(
      chat.messages
        .filter((m) => m.id !== placeholderMessageId)
        .map((m) => ({ role: m.role, content: m.content })),
    );

  const ctx: AgentContext = {
    appId: chat.app.id,
    appPath,
    chatId: chat.id,
    requestId: dyadRequestId,
  };

  const restricted = readOnly || planModeOnly;
  const tools = filterTools(buildAgentTools(ctx), restricted);

  const { modelClient } = await getModelClient(settings.selectedModel, settings);

  let fullResponse = "";
  let lastDbSaveAt = 0;

  const flushToDb = async (force = false) => {
    const now = Date.now();
    if (!force && now - lastDbSaveAt < DB_SAVE_INTERVAL_MS) return;
    lastDbSaveAt = now;
    try {
      await db
        .update(messagesTable)
        .set({ content: fullResponse })
        .where(eq(messagesTable.id, placeholderMessageId));
    } catch (err) {
      logger.warn("Failed to persist streaming content:", err);
    }
  };

  try {
    const stream = runAgent({
      ctx,
      model: modelClient.model,
      system: systemPrompt,
      messages: modelMessages,
      abortSignal: abortController.signal,
      maxSteps,
      tools,
    });

    for await (const part of stream.fullStream) {
      if (part.type === "text-delta") {
        fullResponse += part.text ?? "";
        safeSend(event.sender, "chat:response:chunk", {
          chatId: req.chatId,
          streamingMessageId: placeholderMessageId,
          streamingContent: fullResponse,
        });
        await flushToDb();
      } else if (part.type === "tool-call") {
        const p = part as {
          toolCallId?: string;
          toolName?: string;
          input?: unknown;
        };
        const payload: AgentToolCallStartPayload = {
          chatId: req.chatId,
          toolCallId: p.toolCallId ?? "",
          toolName: p.toolName ?? "",
          inputPreview: safePreview(p.input),
        };
        safeSend(event.sender, "agent-tool:call-start", payload);
      } else if (part.type === "tool-result") {
        const p = part as {
          toolCallId?: string;
          toolName?: string;
          output?: unknown;
        };
        const payload: AgentToolCallEndPayload = {
          chatId: req.chatId,
          toolCallId: p.toolCallId ?? "",
          toolName: p.toolName ?? "",
          ok: true,
          outputPreview: safePreview(p.output),
        };
        safeSend(event.sender, "agent-tool:call-end", payload);
      } else if (part.type === "tool-error") {
        const p = part as {
          toolCallId?: string;
          toolName?: string;
          error?: unknown;
        };
        const errText =
          p.error instanceof Error
            ? p.error.message
            : typeof p.error === "string"
              ? p.error
              : JSON.stringify(p.error);
        const payload: AgentToolCallEndPayload = {
          chatId: req.chatId,
          toolCallId: p.toolCallId ?? "",
          toolName: p.toolName ?? "",
          ok: false,
          error: errText,
        };
        safeSend(event.sender, "agent-tool:call-end", payload);
      } else if (part.type === "error") {
        const errMsg = (part as { error?: unknown }).error;
        throw errMsg instanceof Error ? errMsg : new Error(String(errMsg));
      }
    }

    await flushToDb(true);

    // Send the completed assistant content as a final full-messages chunk so
    // the renderer sees the final text before the `end` event.
    const finalChat = await db.query.chats.findFirst({
      where: eq(chats.id, req.chatId),
      with: {
        messages: { orderBy: (m, { asc }) => [asc(m.createdAt)] },
      },
    });
    if (finalChat) {
      safeSend(event.sender, "chat:response:chunk", {
        chatId: req.chatId,
        messages: finalChat.messages,
      });
    }

    safeSend(event.sender, "chat:response:end", {
      chatId: req.chatId,
      updatedFiles: !restricted,
    } satisfies ChatResponseEnd);

    return true;
  } catch (err) {
    if (abortController.signal.aborted) {
      try {
        await db
          .update(messagesTable)
          .set({ content: appendCancelledResponseNotice(fullResponse) })
          .where(eq(messagesTable.id, placeholderMessageId));
      } catch (dbErr) {
        logger.warn("Failed to record cancellation:", dbErr);
      }
      return false;
    }

    logger.error("Local agent stream error:", err);
    const message =
      err instanceof Error
        ? err.message
        : typeof err === "string"
          ? err
          : JSON.stringify(err);
    safeSend(event.sender, "chat:response:error", {
      chatId: req.chatId,
      error: `Error: ${message}`,
    });
    return false;
  }
}
