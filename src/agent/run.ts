import {
  streamText,
  stepCountIs,
  type LanguageModel,
  type ModelMessage,
  type StepResult,
  type ToolSet,
} from "ai";
import { buildAgentTools } from "./tools";
import type { AgentContext } from "./types";

export interface RunAgentArgs {
  ctx: AgentContext;
  model: LanguageModel;
  system: string;
  messages: ModelMessage[];
  abortSignal?: AbortSignal;
  maxSteps?: number;
  tools?: ToolSet;
  onStepFinish?: (step: StepResult<ToolSet>) => void | Promise<void>;
}

/**
 * Clean-room agent loop. Uses the Vercel AI SDK's native tool-calling so we
 * don't re-implement streaming/retry/parallel-tool-call plumbing ourselves.
 *
 * Persistence of messages and tool results into SQLite is the caller's
 * responsibility (see chat_stream_handlers.ts). This function returns the
 * raw stream; hook `onStepFinish` to persist after each model step.
 */
export function runAgent(args: RunAgentArgs) {
  const {
    ctx,
    model,
    system,
    messages,
    abortSignal,
    maxSteps = 30,
    tools,
    onStepFinish,
  } = args;

  return streamText({
    model,
    system,
    messages,
    tools: tools ?? buildAgentTools(ctx),
    stopWhen: stepCountIs(maxSteps),
    abortSignal,
    onStepFinish,
  });
}
