import { tool } from "ai";
import { z } from "zod";

import { readSettings, decrypt } from "../../main/settings";
import type {
  Secret,
  WebSearchProvider,
  WebSearchSettings,
} from "../../lib/schemas";

const DEFAULT_MAX_RESULTS = 5;
const HARD_MAX_RESULTS = 20;
const DEFAULT_TIMEOUT_SECONDS = 30;
const HARD_TIMEOUT_SECONDS = 120;

interface NormalizedResult {
  title: string;
  url: string;
  snippet: string;
  score?: number;
  publishedDate?: string;
}

interface SearchRun {
  provider: WebSearchProvider;
  query: string;
  results: NormalizedResult[];
  ok: boolean;
  error?: string;
}

function readKey(secret: Secret | undefined): string | null {
  if (!secret) return null;
  try {
    const plain = decrypt(secret);
    return plain.length > 0 ? plain : null;
  } catch {
    return null;
  }
}

function resolveProvider(
  requested: WebSearchProvider | undefined,
  settings: WebSearchSettings | undefined,
): { provider: WebSearchProvider; apiKey: string } {
  const byPriority: WebSearchProvider[] = ["tavily", "firecrawl", "exa"];
  const ordered: WebSearchProvider[] = requested
    ? [requested]
    : settings?.defaultProvider
      ? [
          settings.defaultProvider,
          ...byPriority.filter((p) => p !== settings.defaultProvider),
        ]
      : byPriority;
  for (const p of ordered) {
    const key = readKey(settings?.[p]?.apiKey);
    if (key) return { provider: p, apiKey: key };
  }
  throw new Error(
    requested
      ? `web_search: no API key configured for provider "${requested}". Add one in Settings -> Web Search.`
      : `web_search: no API keys configured. Add a Tavily, Firecrawl, or Exa key in Settings -> Web Search.`,
  );
}

async function postJson(
  url: string,
  headers: Record<string, string>,
  body: unknown,
  signal: AbortSignal,
): Promise<unknown> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
    signal,
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(
      `provider HTTP ${response.status}: ${text.slice(0, 500)}`,
    );
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(
      `provider returned non-JSON (status ${response.status}): ${text.slice(0, 200)}`,
    );
  }
}

async function searchTavily(
  apiKey: string,
  query: string,
  maxResults: number,
  signal: AbortSignal,
): Promise<NormalizedResult[]> {
  const data = (await postJson(
    "https://api.tavily.com/search",
    {},
    {
      api_key: apiKey,
      query,
      max_results: maxResults,
      search_depth: "basic",
      include_answer: false,
    },
    signal,
  )) as {
    results?: Array<{
      title?: string;
      url?: string;
      content?: string;
      score?: number;
      published_date?: string;
    }>;
  };
  return (data.results ?? []).map((r) => ({
    title: r.title ?? "",
    url: r.url ?? "",
    snippet: (r.content ?? "").slice(0, 800),
    score: r.score,
    publishedDate: r.published_date,
  }));
}

async function searchFirecrawl(
  apiKey: string,
  query: string,
  maxResults: number,
  signal: AbortSignal,
): Promise<NormalizedResult[]> {
  const data = (await postJson(
    "https://api.firecrawl.dev/v1/search",
    { Authorization: `Bearer ${apiKey}` },
    { query, limit: maxResults },
    signal,
  )) as {
    success?: boolean;
    data?: Array<{
      title?: string;
      url?: string;
      description?: string;
    }>;
  };
  if (data.success === false) {
    throw new Error("firecrawl: search returned success=false");
  }
  return (data.data ?? []).map((r) => ({
    title: r.title ?? "",
    url: r.url ?? "",
    snippet: (r.description ?? "").slice(0, 800),
  }));
}

async function searchExa(
  apiKey: string,
  query: string,
  maxResults: number,
  signal: AbortSignal,
): Promise<NormalizedResult[]> {
  const data = (await postJson(
    "https://api.exa.ai/search",
    { "x-api-key": apiKey },
    {
      query,
      numResults: maxResults,
      type: "auto",
      contents: { text: { maxCharacters: 800 } },
    },
    signal,
  )) as {
    results?: Array<{
      title?: string;
      url?: string;
      text?: string;
      score?: number;
      publishedDate?: string;
    }>;
  };
  return (data.results ?? []).map((r) => ({
    title: r.title ?? "",
    url: r.url ?? "",
    snippet: (r.text ?? "").slice(0, 800),
    score: r.score,
    publishedDate: r.publishedDate,
  }));
}

async function dispatch(
  provider: WebSearchProvider,
  apiKey: string,
  query: string,
  maxResults: number,
  signal: AbortSignal,
): Promise<NormalizedResult[]> {
  if (provider === "tavily") {
    return searchTavily(apiKey, query, maxResults, signal);
  }
  if (provider === "firecrawl") {
    return searchFirecrawl(apiKey, query, maxResults, signal);
  }
  return searchExa(apiKey, query, maxResults, signal);
}

export function webSearchTool() {
  return tool({
    description:
      "Search the public web for information relevant to a query. Results are normalized to { title, url, snippet, score? }. Provider is configured in Settings -> Web Search (Tavily / Firecrawl / Exa); the caller can force a provider via the `provider` arg.",
    inputSchema: z.object({
      query: z.string().min(1).describe("Natural-language search query."),
      provider: z
        .enum(["tavily", "firecrawl", "exa"])
        .optional()
        .describe(
          "Force a specific provider. If omitted, uses the configured default (or the first provider with an API key).",
        ),
      maxResults: z
        .number()
        .int()
        .positive()
        .max(HARD_MAX_RESULTS)
        .default(DEFAULT_MAX_RESULTS)
        .describe(
          `Maximum results to return (default ${DEFAULT_MAX_RESULTS}, hard max ${HARD_MAX_RESULTS}).`,
        ),
      timeoutSeconds: z
        .number()
        .int()
        .positive()
        .max(HARD_TIMEOUT_SECONDS)
        .default(DEFAULT_TIMEOUT_SECONDS)
        .describe(
          `Hard timeout in seconds (default ${DEFAULT_TIMEOUT_SECONDS}, max ${HARD_TIMEOUT_SECONDS}).`,
        ),
    }),
    execute: async ({
      query,
      provider: requestedProvider,
      maxResults,
      timeoutSeconds,
    }): Promise<SearchRun> => {
      const settings = readSettings();
      const { provider, apiKey } = resolveProvider(
        requestedProvider,
        settings.webSearch,
      );
      const controller = new AbortController();
      const timer = setTimeout(
        () => controller.abort(),
        timeoutSeconds * 1000,
      );
      try {
        const results = await dispatch(
          provider,
          apiKey,
          query,
          maxResults,
          controller.signal,
        );
        return {
          provider,
          query,
          results,
          ok: true,
        };
      } catch (err) {
        return {
          provider,
          query,
          results: [],
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        };
      } finally {
        clearTimeout(timer);
      }
    },
  });
}
