import { BrowserWindow } from "electron";
import log from "electron-log";

import type { AgentTodo } from "@/ipc/types";

const logger = log.scope("agent-events");

/**
 * Broadcasts an IPC event to the first open Electron window. Agent tools
 * run inside the main process and don't otherwise have a handle on the
 * renderer's event sender, so we reach into `BrowserWindow.getAllWindows`
 * the same way `sendTelemetryEvent` does.
 *
 * This is a fire-and-forget best-effort channel — if no window is open
 * (app quitting, tests), the call is a no-op.
 */
function broadcast(channel: string, payload: unknown): void {
  try {
    const windows = BrowserWindow.getAllWindows();
    if (windows.length === 0) return;
    windows[0].webContents.send(channel, payload);
  } catch (err) {
    logger.warn(`failed to broadcast ${channel}:`, err);
  }
}

/**
 * Forward an updated todo list for a chat so the renderer can rehydrate
 * its `agentTodosByChatIdAtom` view.
 */
export function emitTodosUpdate(chatId: number, todos: AgentTodo[]): void {
  broadcast("agent-tool:todos-update", { chatId, todos });
}
