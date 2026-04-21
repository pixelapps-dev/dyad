import React, { useState } from "react";
import { Wrench, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { useAtomValue } from "jotai";
import {
  agentToolCallsByChatIdAtom,
  selectedChatIdAtom,
  type AgentToolCallEntry,
} from "@/atoms/chatAtoms";
import {
  DyadCard,
  DyadCardHeader,
  DyadBadge,
  DyadExpandIcon,
  DyadCardContent,
} from "./DyadCardPrimitives";
import { CodeHighlight } from "./CodeHighlight";

function accentFor(status: AgentToolCallEntry["status"]) {
  if (status === "error") return "red" as const;
  if (status === "ok") return "green" as const;
  return "blue" as const;
}

function StatusIcon({ status }: { status: AgentToolCallEntry["status"] }) {
  if (status === "running") {
    return <Loader2 size={15} className="animate-spin" />;
  }
  if (status === "error") {
    return <XCircle size={15} />;
  }
  return <CheckCircle2 size={15} />;
}

function ToolCallCard({ entry }: { entry: AgentToolCallEntry }) {
  const [expanded, setExpanded] = useState(false);
  const accent = accentFor(entry.status);
  const detail =
    entry.status === "error"
      ? (entry.error ?? "")
      : (entry.outputPreview ?? entry.inputPreview ?? "");

  return (
    <DyadCard
      accentColor={accent}
      isExpanded={expanded}
      onClick={() => setExpanded((v) => !v)}
    >
      <DyadCardHeader icon={<Wrench size={15} />} accentColor={accent}>
        <DyadBadge color={accent}>Tool</DyadBadge>
        <span className="text-xs px-2 py-0.5 rounded-full bg-muted/50 text-muted-foreground ring-1 ring-inset ring-border">
          {entry.toolName}
        </span>
        <div className="ml-1 flex items-center gap-1 text-xs text-muted-foreground">
          <StatusIcon status={entry.status} />
          <span>
            {entry.status === "running"
              ? "running"
              : entry.status === "ok"
                ? "done"
                : "failed"}
          </span>
        </div>
        <div className="ml-auto">
          <DyadExpandIcon isExpanded={expanded} />
        </div>
      </DyadCardHeader>
      <DyadCardContent isExpanded={expanded}>
        {entry.inputPreview && (
          <div className="mb-2">
            <div className="text-xs font-medium text-muted-foreground mb-1">
              Input
            </div>
            <CodeHighlight className="language-json">
              {entry.inputPreview}
            </CodeHighlight>
          </div>
        )}
        {detail && detail !== entry.inputPreview && (
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-1">
              {entry.status === "error" ? "Error" : "Output"}
            </div>
            <CodeHighlight className="language-json">{detail}</CodeHighlight>
          </div>
        )}
      </DyadCardContent>
    </DyadCard>
  );
}

/**
 * Renders the agent's tool-call timeline for the currently selected chat,
 * populated live from `agent-tool:call-start` / `agent-tool:call-end` events.
 * Renders nothing when there are no tool calls for the chat.
 */
export function AgentToolCallTimeline() {
  const chatId = useAtomValue(selectedChatIdAtom);
  const toolCallsByChatId = useAtomValue(agentToolCallsByChatIdAtom);
  if (chatId === null) return null;
  const entries = toolCallsByChatId.get(chatId);
  if (!entries || entries.length === 0) return null;

  return (
    <div className="flex justify-start px-4">
      <div className="max-w-3xl w-full mx-auto flex flex-col gap-2 py-2">
        {entries.map((entry) => (
          <ToolCallCard key={entry.toolCallId} entry={entry} />
        ))}
      </div>
    </div>
  );
}
