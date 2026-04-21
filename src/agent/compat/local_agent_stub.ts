/**
 * Temporary shim for the legacy `handleLocalAgentStream` entry point.
 *
 * The original FSL-licensed implementation (~1,700 LOC) is gone. The
 * replacement lives in `src/agent/run.ts` and uses the Vercel AI SDK's native
 * tool-calling. The call sites in `chat_stream_handlers.ts` haven't been
 * migrated yet — see FORK.md "Agent loop rewiring".
 *
 * Until migration is done, calling this shim throws a clear error so nothing
 * silently pretends to work.
 */
export async function handleLocalAgentStream(
  ..._args: unknown[]
): Promise<boolean> {
  throw new Error(
    "Local agent mode is not wired up in this fork yet. " +
      "Port chat_stream_handlers.ts to call runAgent() from src/agent/run.ts. " +
      "See FORK.md for the migration checklist.",
  );
}
