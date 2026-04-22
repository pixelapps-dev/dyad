# Agent Architecture

Pagemate's local-agent chat mode uses the Vercel AI SDK's native
tool-calling protocol. The upstream (FSL) XML-dialect agent was replaced
by a clean-room loop in `src/agent/`; see [FORK.md](../FORK.md) for the
migration notes.

## Layout

- `src/agent/run.ts` — `runAgent()` wraps `streamText` with
  `stopWhen: stepCountIs(maxSteps)`. It accepts the tool set, system
  prompt, message history, and an abort signal.
- `src/agent/stream/local_agent_stream.ts` — Electron-side IPC wrapper
  that drives `runAgent()` and emits the renderer events
  (`chat:response:chunk`, `agent-tool:call-start` / `:call-end`,
  `chat:response:end`).
- `src/agent/tools/` — one file per tool. Each exports a factory that
  returns an AI SDK `tool({ description, inputSchema, execute })`.
- `src/agent/tools/index.ts` — `buildAgentTools(ctx)` registers the
  full tool set.
- `src/agent/path_safety.ts`, `src/agent/url_safety.ts` — sandboxing
  helpers every tool that touches disk or the network must use.
- `src/agent/compat/` — drop-in shims for the legacy XML dialect
  (`search_replace.ts`) that `response_processor.ts` still uses for
  the non-local-agent "build" mode.

## Add a tool

1. Create `src/agent/tools/<name>.ts`. Define a Zod input schema and
   an async `execute` function. If the tool touches disk, resolve
   paths through `safeResolve(ctx.appPath, relPath)`. If it hits the
   network, validate URLs through `assertPublicUrl`.
2. Register the factory in `src/agent/tools/index.ts` inside
   `buildAgentTools`. If the tool is read-only, also add its name to
   `READ_ONLY_TOOL_NAMES` in `src/agent/stream/local_agent_stream.ts`
   so ask / plan mode can use it.
3. (Optional) If you want a UI card for the tool call beyond the
   generic `AgentToolCallTimeline`, handle the tool name specially
   in the renderer when consuming `agent-tool:call-start` /
   `:call-end` events.

## Testing

- Tool unit tests go under `src/agent/tools/__tests__/` (if added).
- For E2E coverage, mirror the existing `e2e-tests/local_agent*.spec.ts`
  patterns and use the tool-call fixtures under
  `e2e-tests/fixtures/engine`.
