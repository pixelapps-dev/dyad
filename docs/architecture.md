# Pagemate Architecture

This doc describes how the Pagemate desktop app works at a high level.
If something is out of date, please suggest a change via a pull request.

## Overview

Pagemate is an Electron app — a local, open-source B2B website builder
built on top of a clean-room AI agent stack. It's a fork of
[Dyad](https://github.com/dyad-sh/dyad) with the Functional-Source-Licensed
"Pro" carve-out removed; see [FORK.md](../FORK.md) for details.

## Electron architecture

Pagemate has the usual Electron split: a **renderer process** running
the React UI, and a Node.js **main process** with filesystem + network
access. The two talk over **IPC**, modeled as typed contracts (see
`src/ipc/types/` and `src/ipc/handlers/`).

## Life of a request — native tool-calling path (local-agent mode)

The fork's default chat mode (`local-agent`) uses the Vercel AI SDK's
native tool-calling protocol. End to end:

1. **Chat stream handler** (`src/ipc/handlers/chat_stream_handlers.ts`)
   receives the user prompt, picks the chat mode, and dispatches to
   `handleLocalAgentStream` for local-agent mode.
2. **`handleLocalAgentStream`** (`src/agent/stream/local_agent_stream.ts`)
   loads the message history, builds the tool set from
   `buildAgentTools()`, and calls `runAgent()`.
3. **`runAgent`** (`src/agent/run.ts`) wraps `streamText` from the AI SDK
   with `stopWhen: stepCountIs(maxSteps)`. Tool calls go through the
   SDK's native executor — no custom XML parser, no regex.
4. **Tools** (`src/agent/tools/*.ts`) each register a Zod input schema
   and an async `execute` function. They're sandboxed via
   `path_safety.ts` / `url_safety.ts`.
5. **Events stream back to the renderer** as `chat:response:chunk`
   (text deltas), `agent-tool:call-start` / `:call-end` (tool events),
   and `chat:response:end` (completion). `AgentToolCallTimeline`
   renders live tool cards from those events.

## Life of a request — legacy XML-dialect path (build mode)

Build mode still uses the upstream XML dialect — `<dyad-write>`,
`<dyad-rename>`, `<dyad-delete>`, `<dyad-add-dependency>`, etc. —
parsed by `src/ipc/processors/response_processor.ts` against the
system prompt in `src/prompts/system_prompt.ts`. The dialect works
because it predates tool-calling being widely supported; a future
sunset is tracked in FORK.md.

## FAQ

### Why two paths?

The XML-dialect build-mode path is inherited from upstream. Migrating
it to native tool-calling would flip the default experience, and that
migration is tracked in FORK.md rather than attempted in the initial
fork.

### Why is the agent loop small?

`runAgent` is a thin wrapper over `streamText` because the AI SDK
already handles streaming, tool-call parsing, tool-result serialization,
and retries. The upstream (FSL) agent handler was ~1,700 LOC because
it re-implemented those. We traded that for ~400 LOC and let the SDK
do the heavy lifting.

### How does context selection work?

Build mode defaults to sending the whole workspace as context, which
is simple but can get expensive on larger apps. Local-agent mode uses
`list_files` / `read_file` / `grep` tools so the model navigates
incrementally — the model pulls what it needs instead of the app
shipping everything up front.
