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
  url_safety.ts         # shared assertPublicUrl for web_fetch / web_crawl
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
    web_crawl.ts        # BFS same-origin crawler; SSRF-safe; per-page 1MB cap
    web_search.ts       # pluggable provider dispatch (Tavily / Firecrawl / Exa)
    generate_image.ts   # pluggable provider dispatch (OpenAI DALL-E 3 / Stability Stable Image Core)
    # P1 Supabase-backed (only work on apps linked to a Supabase project)
    execute_sql.ts              # runs arbitrary SQL via Supabase Management API
    get_database_table_schema.ts # inspects tables/columns/policies/triggers/functions
    read_logs.ts                # tails edge-function logs; timestampMicros lower bound
  stream/
    local_agent_stream.ts       # handleLocalAgentStream() over runAgent(); emits the legacy
                                # chat:response:chunk / :end / :error IPC events and the new
                                # agent-tool:call-start / agent-tool:call-end events
  visual/
    index.ts                    # iframe ↔ renderer postMessage protocol for the DOM annotator
                                # (types only; clean-room pick-up for future Annotator work)
  compat/
    search_replace.ts           # drop-in parse/apply for the XML dialect, used by response_processor
```

### `src/components/preview_panel/Annotator.tsx`

The FSL `Annotator` component was removed. Its v1 replacement is a
clean-room screenshot annotator: captures the preview iframe via the
existing `dyad-take-screenshot` postMessage, shows the resulting PNG,
and offers an "Attach to chat" button that hands the PNG to the
chat-attachments pipeline (`useAttachments.addAttachments`). Drawing
and pin-marker tools are deliberately deferred — the public contract
(`onAttach: (file: File) => void`) lets us compose those later without
re-wiring the preview.

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
- [x] Wire the renderer to consume those events. `renderer.tsx`
      subscribes to both channels and populates a new
      `agentToolCallsByChatIdAtom` timeline (cleared on
      `chat:stream:start`). `AgentToolCallTimeline` renders the
      timeline inside `MessagesList` using the existing `DyadCard`
      primitives — running / ok / error states each get a distinct
      accent, and each card expands to show the input and output (or
      error) previews.
- [x] Add `web_crawl` tool: BFS same-origin crawler, 1MB per-page
      cap, 50-page / 5-depth / 300s hard ceilings, re-validates every
      dequeued URL via `src/agent/url_safety.ts` so redirects can't
      drag it into a blocked host.
- [x] Add `web_search` tool with a pluggable provider abstraction
      (Tavily / Firecrawl / Exa). API keys live under
      `settings.webSearch.{tavily,firecrawl,exa}.apiKey` and the caller
      can override the provider via an input arg; otherwise the tool
      uses `settings.webSearch.defaultProvider` or falls through the
      configured providers in priority order. Results are normalized
      across providers to `{title, url, snippet, score?, publishedDate?}`.
- [x] Add a Settings -> Integrations -> Web Search pane
      (`src/components/WebSearchSettings.tsx`) with a masked-key input
      + Replace / Remove buttons per provider and a default-provider
      picker. Keys round-trip through `writeSettings()` /
      `readSettings()` with `safeStorage` encryption like every other
      stored secret.
- [x] Add `generate_image` tool: pluggable provider dispatch
      (OpenAI DALL-E 3 / Stability Stable Image Core). The tool
      writes the generated PNG into the app workspace at a caller-
      supplied `outputPath` (sandboxed via `safeResolve`, 20MB cap),
      and a parallel Settings pane
      (`src/components/ImageGenerationSettings.tsx`) lets users
      paste keys under `settings.imageGeneration.{openai,stability}.apiKey`.
      Unlike `web_search`, this tool is not in the read-only
      allow-list — it mutates the workspace, so ask / plan mode
      can't invoke it.
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
- [x] Stand down the plan-mode questionnaire stub. No producer in the
      fork emits questionnaire requests, so the handler's throw was
      unreachable-by-construction but noisy. The stub file is gone and
      `plan_handlers.ts` now logs + ignores any stale questionnaire
      response instead of crashing.
- [x] Lay down `src/agent/visual/index.ts` as the clean-room starting
      point for future DOM-level selection overlays: defines the
      iframe ↔ renderer postMessage protocol (`dyad-visual:ready`,
      `:element-selected`, `:enter-select-mode`, `:highlight`). Theme
      picker is already Apache-2.0 (`src/shared/themes.ts` +
      `AuxiliaryActionsMenu.tsx`) and needed no re-implementation.
      Click-to-select for in-source editing already works today via
      `VisualEditingToolbar` + `@dyad-sh/react-vite-component-tagger`.
- [x] Replace `AnnotatorOnlyForPro` with a functional screenshot
      annotator at `src/components/preview_panel/Annotator.tsx`. v1
      shows the captured PNG and attaches it to the chat-input via
      `useAttachments.addAttachments`; drawing / pin-marker tools are
      a follow-up that can land without changing the Annotator's
      public contract.
- [x] Ship `scripts/rebrand.mjs` so a rebrand lands in one command
      once a new product name is picked. The script updates
      `package.json`, `forge.config.ts`, the hard-coded `api.dyad.sh`
      / `engine.dyad.sh` / `dyad-sh/dyad` references in the IPC
      utilities, and user-visible product-name strings in
      notifications, error/help dialogs, and the GitHub promo.
      Dry-runs by default; `--apply` writes. Does not touch internal
      `dyad*` identifiers, `<dyad-*>` XML tags, the upstream "Dyad"
      hosted-AI provider entry, or the Dyad Pro promo messages
      (those refer to upstream paid products that Pagemate doesn't
      have — delete them in a follow-up).
- [x] Execute the rebrand to **Pagemate** (product name) at
      `pixelapps-dev/pagemate` (GitHub slug) with `api.pagemate.dev`
      / `engine.pagemate.dev` hosts and `pagemate://` protocol
      scheme. 17 files touched; NOTICE/LICENSE keep the upstream
      "Dyad" attribution per Apache-2.0 §4(d).

Pending (tracked for follow-up):

- [ ] Grow the screenshot `Annotator.tsx` with drawing / pin-marker
      tools (v1 only attaches the raw PNG). And, optionally, a
      richer DOM-level selection overlay on top of the
      `src/agent/visual/` protocol — click-to-select for in-source
      editing already works via the existing VisualEditingToolbar, so
      this is only needed if we want overlay-level richness beyond
      what the toolbar offers.
- [ ] Build a real plan-mode questionnaire against the new agent:
      either a tool that emits questions into the chat, or a small
      planner loop that asks and then plans.
- [ ] Sunset the upstream XML dialect (`<dyad-write>`, `<dyad-rename>`,
      `<dyad-delete>`, `<dyad-add-dependency>`, `<dyad-search-replace>`,
      `cleanFullResponse`, `hasUnclosedDyadWrite`, `removeDyadTags`).
      The dialect is still live in `response_processor.ts` and in the
      upstream build-mode streaming path, and every test under
      `src/__tests__/chat_stream_handlers.test.ts` +
      `src/ipc/processors/response_processor.test.ts` covers
      production code. Ripping the tests out now would drop real
      coverage; they can only go once `response_processor.ts` itself
      migrates to the new agent path.
- [ ] Replace `assets/icon/*` with Pagemate-branded icon files
      (PNG / ICO / ICNS for the installer and app window).
- [ ] Mint a new PostHog project and update `src/renderer.tsx` with
      the new project key. Re-run the rebrand script with
      `--posthog-key phc_...` to do it in-place.
- [ ] Strip or rename Dyad Pro / dyad.sh promotional links (promo
      messages in `src/components/chat/PromoMessage.tsx`,
      `academy.dyad.sh` and `dyad.sh/docs` references in
      `HelpDialog.tsx`). These point at upstream paid / hosted
      services that Pagemate doesn't offer.
- [ ] Decide whether to keep the upstream "Dyad" hosted-AI provider
      entry (`src/ipc/shared/language_model_constants.ts` `auto`
      provider) or drop it; the label is still "Dyad" because it's
      legitimately the Dyad cloud's endpoint.
- [ ] Optional: mass-rename internal `dyad*` identifiers
      (`dyadRequestId`, `DYAD_ENGINE_URL`, `enableDyadPro`, …) in a
      follow-up commit. Keep it separate from the rebrand so the
      diff stays reviewable.
- [ ] Fresh pnpm lockfile once renames settle (`pnpm install`).

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
