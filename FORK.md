# Fork notes

This repository is a fork of [dyad-sh/dyad](https://github.com/dyad-sh/dyad).
The intent of the fork is to build a B2B website-builder tool on top of the
upstream Apache-2.0 core, while leaving the upstream project's
Functional-Source-Licensed ("FSL") Pro carve-out (and its competing-use
restriction) behind.

See `LICENSE` for licensing terms and `NOTICE` for required attribution.

## What was removed from upstream

### `src/pro/` (FSL-1.1-ALv2)

The entire `src/pro/` directory — roughly 13k lines containing the Pro /
local-agent / visual-editing / themes / search-replace DSL / Turbo Edits
prompt subsystems — was deleted in the initial fork commit. That code is
FSL-1.1-ALv2 and contains a Competing Use restriction that makes it unsafe
for use in a commercial product of this kind.

### CLA

`CLA.md` required contributors to assign copyright/IP to Dyad Tech, Inc.
It is not applicable to this fork and has been removed. Contributions to
this fork are covered by the project's Apache-2.0 license alone (unless
the repository owner adopts a different contribution policy later).

## Replacement subsystems

### `src/agent/` (new, Apache-2.0)

A clean-room agent loop built directly on top of Vercel AI SDK v6's native
tool-calling. It replaces the upstream XML-dialect (`<dyad-write>` etc.)
agent and the FSL Turbo Edits DSL. Layout:

```
src/agent/
  path_safety.ts        # safeResolve / safeResolveDir, symlink-aware sandbox
  types.ts              # AgentContext, AgentToolName, AgentTool
  run.ts                # runAgent() wrapper over streamText + stopWhen
  tools/
    index.ts            # buildAgentTools(ctx) -> ToolSet
    # P0 filesystem + search
    read_file.ts        # 2MB cap, UTF-8, rejects non-files
    write_file.ts       # mkdir -p parents, returns {path, bytes}
    edit_file.ts        # strict single-match find/replace; throws on 0 or >1 matches
    delete_file.ts      # rejects directories
    rename_file.ts      # both paths safe-resolved
    copy_file.ts
    list_files.ts       # DEFAULT_IGNORES excludes node_modules/.git/.next/dist/...
    grep.ts             # shells out to ripgrep with --json
    # P1 build + network
    run_type_checks.ts  # npx tsc --noEmit with timeout + output cap
    add_dependency.ts   # auto-detects pnpm/yarn/npm; strict package-spec whitelist
    web_fetch.ts        # http(s) only; SSRF-safe; 2MB cap; GET/HEAD
    # P1 Supabase-backed (only work on apps linked to a Supabase project)
    execute_sql.ts              # runs arbitrary SQL via Supabase Management API
    get_database_table_schema.ts # inspects tables/columns/policies/triggers/functions
    read_logs.ts                # tails edge-function logs; timestampMicros lower bound
  stream/
    local_agent_stream.ts       # handleLocalAgentStream() over runAgent(); emits the legacy
                                # chat:response:chunk / :end / :error IPC events and the new
                                # agent-tool:call-start / agent-tool:call-end events
  compat/
    search_replace.ts           # drop-in parse/apply for the XML dialect, used by response_processor
    questionnaire_stub.ts       # throws; points callers at the new agent
```

### `src/components/preview_panel/AnnotatorOnlyForPro.tsx`

The FSL `Annotator` component was removed. `AnnotatorOnlyForPro` was
retained but rewritten as a "coming soon" placeholder that no longer
links to `dyad.sh/pro`. A clean-room screenshot annotator will replace it
in a later phase.

## Migration status

Done:

- [x] Delete `src/pro/` (63 files, ~13k LOC) and its tests (7 test files).
- [x] Remove the `src/pro/` carve-out from `LICENSE`.
- [x] Delete `CLA.md`.
- [x] Add `NOTICE` per Apache-2.0 §4(d) attributing Dyad Tech, Inc.
- [x] Create `src/agent/` skeleton with the eight P0 tools and `runAgent`.
- [x] Add first-wave P1 tools: `run_type_checks`, `add_dependency`,
      `web_fetch`.
- [x] Create `src/agent/compat/` shims for `parseSearchReplaceBlocks` /
      `applySearchReplace` and `resolveQuestionnaireResponse`.
- [x] Wire `runAgent` into `chat_stream_handlers.ts` via a new
      `src/agent/stream/local_agent_stream.ts` that emits the legacy
      `chat:response:chunk` / `:end` / `:error` IPC events. Build mode gets
      the full tool set; ask / plan mode gets a read-only subset
      (`read_file`, `list_files`, `grep`, `run_type_checks`, `web_fetch`,
      `get_database_table_schema`, `read_logs`).
- [x] Add Supabase-backed P1 tools: `execute_sql`,
      `get_database_table_schema`, `read_logs`. Each loads the app's
      `supabaseProjectId` / `supabaseOrganizationSlug` from the DB and
      throws a clear error on unlinked apps.
- [x] Define `agent-tool:call-start` / `agent-tool:call-end` event
      contracts in `src/ipc/types/agent.ts` and forward the AI SDK's
      `tool-call` / `tool-result` / `tool-error` stream parts from
      `local_agent_stream.ts`. Payloads include `toolCallId`,
      `toolName`, and JSON-truncated previews of the input / output or
      an error string.
- [x] Rewire all nine production imports that used to point into
      `src/pro/`:
      - `src/ipc/ipc_host.ts` (three handler registrations deleted)
      - `src/ipc/handlers/chat_stream_handlers.ts` (local-agent stub)
      - `src/ipc/handlers/plan_handlers.ts` (questionnaire stub)
      - `src/ipc/processors/response_processor.ts` (search-replace compat)
      - `src/components/chat/DyadSearchReplace.tsx` (search-replace compat)
      - `src/hooks/useAgentTools.ts` (new `AgentToolName`)
      - `src/main.ts` (dropped `cleanupOldAiMessagesJson`)
      - `src/prompts/system_prompt.ts` (dropped `TURBO_EDITS_V2_SYSTEM_PROMPT`)
      - `src/components/preview_panel/PreviewIframe.tsx` (dropped `Annotator`)

Pending (tracked for follow-up):

- [ ] Add the remaining P1 tools to `src/agent/tools/` (`web_search`,
      `web_crawl`, `generate_image`). These are referenced in
      `AgentToolName` but not yet implemented. `web_search` and
      `web_crawl` are green-field (no backing infra in the fork yet);
      `generate_image` would currently need to point at the upstream
      `engine.dyad.sh` host, so it's deferred until the rebrand lands.
- [ ] Wire the renderer to consume the new `agent-tool:call-start` /
      `agent-tool:call-end` events so the chat UI can render per-tool
      invocation cards.
- [ ] Re-implement visual editing (themes picker + DOM annotator) as a
      clean-room feature in `src/agent/visual/`.
- [ ] Re-implement the plan-mode questionnaire flow against the new agent
      in `src/agent/plan/` (current stub throws).
- [ ] Delete tests and fixtures that still reference the old XML dialect.
- [ ] Rebrand: swap product name, icons, protocol handler (`dyad://`),
      PostHog key, auto-update host (`api.dyad.sh`), engine host
      (`engine.dyad.sh`), and GitHub publisher (`dyad-sh/dyad`).
- [ ] Fresh pnpm lockfile once renames settle.

## Why native tool-calling

The upstream "build" chat mode streams model output that contains custom
XML tags (`<dyad-write>`, `<dyad-rename>`, `<dyad-delete>`,
`<dyad-add-dependency>`, …) which a regex-based response processor then
parses and applies to the workspace. The FSL-licensed Pro path replaces
that with a second XML dialect (`<<<<<<< SEARCH` / `>>>>>>> REPLACE`
blocks driven by the Turbo Edits prompt).

AI SDK v6 ships first-class tool-calling with JSON-Schema-validated inputs
and structured outputs. That gives us:

1. Type-safe tool inputs via Zod schemas, with validation errors surfaced
   to the model automatically.
2. Parallel tool calls out of the box.
3. A smaller prompt — we can stop spending tokens teaching the model a
   custom XML dialect.
4. Portability across providers without dialect-specific prompt tuning.

The resulting `src/agent/` module is meaningfully smaller than the code
it replaces (~4–8k LOC target vs. ~13k LOC removed).
