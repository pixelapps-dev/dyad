import { tool } from "ai";
import { z } from "zod";

import { assertPublicUrl } from "../url_safety";

const DEFAULT_MAX_PAGES = 10;
const HARD_MAX_PAGES = 50;
const DEFAULT_MAX_DEPTH = 2;
const HARD_MAX_DEPTH = 5;
const DEFAULT_TIMEOUT_SECONDS = 60;
const HARD_TIMEOUT_SECONDS = 300;
const PER_PAGE_BYTES = 1 * 1024 * 1024;
const EXCERPT_CHARS = 400;

interface FetchedPage {
  url: string;
  status: number;
  title: string | null;
  excerpt: string | null;
  links: string[];
  bytes: number;
  error?: string;
}

function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractTitle(html: string): string | null {
  const m = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  if (!m) return null;
  return stripTags(m[1]).slice(0, 300) || null;
}

function extractLinks(html: string, base: URL): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const re = /<a\b[^>]*?\shref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const raw = m[1] ?? m[2] ?? m[3] ?? "";
    if (!raw) continue;
    if (raw.startsWith("#") || raw.startsWith("javascript:") || raw.startsWith("mailto:")) {
      continue;
    }
    try {
      const u = new URL(raw, base);
      if (u.protocol !== "http:" && u.protocol !== "https:") continue;
      u.hash = "";
      const s = u.toString();
      if (!seen.has(s)) {
        seen.add(s);
        out.push(s);
      }
    } catch {
      // ignore malformed hrefs
    }
  }
  return out;
}

async function fetchPage(
  url: URL,
  signal: AbortSignal,
): Promise<FetchedPage> {
  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal,
    });
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("html") && !contentType.includes("text")) {
      return {
        url: url.toString(),
        status: response.status,
        title: null,
        excerpt: null,
        links: [],
        bytes: 0,
      };
    }
    const reader = response.body?.getReader();
    if (!reader) {
      return {
        url: url.toString(),
        status: response.status,
        title: null,
        excerpt: null,
        links: [],
        bytes: 0,
      };
    }
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (total + value.byteLength > PER_PAGE_BYTES) {
        chunks.push(value.subarray(0, PER_PAGE_BYTES - total));
        total = PER_PAGE_BYTES;
        try {
          await reader.cancel();
        } catch {
          // ignore
        }
        break;
      }
      chunks.push(value);
      total += value.byteLength;
    }
    const buf = Buffer.concat(chunks.map((c) => Buffer.from(c)));
    const html = buf.toString("utf8");
    const title = extractTitle(html);
    const text = stripTags(html);
    const excerpt = text.slice(0, EXCERPT_CHARS) || null;
    const links = extractLinks(html, url);
    return {
      url: url.toString(),
      status: response.status,
      title,
      excerpt,
      links,
      bytes: total,
    };
  } catch (err) {
    return {
      url: url.toString(),
      status: 0,
      title: null,
      excerpt: null,
      links: [],
      bytes: 0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export function webCrawlTool() {
  return tool({
    description:
      "Breadth-first crawl a public website starting from `startUrl`. Follows same-origin links by default (or every host listed in `allowedHosts`). Extracts plain-text excerpts and the outgoing link set from each page so the agent can answer questions about a site without pulling every page individually. SSRF-safe: only http(s), blocks loopback / RFC1918 / cloud-metadata hosts. Response per-page is capped at 1MB.",
    inputSchema: z.object({
      startUrl: z.string().describe("The public URL to start crawling from."),
      maxPages: z
        .number()
        .int()
        .positive()
        .max(HARD_MAX_PAGES)
        .default(DEFAULT_MAX_PAGES)
        .describe(
          `Maximum pages to fetch in this crawl (default ${DEFAULT_MAX_PAGES}, hard max ${HARD_MAX_PAGES}).`,
        ),
      maxDepth: z
        .number()
        .int()
        .nonnegative()
        .max(HARD_MAX_DEPTH)
        .default(DEFAULT_MAX_DEPTH)
        .describe(
          `Maximum link-following depth from the start URL (default ${DEFAULT_MAX_DEPTH}, hard max ${HARD_MAX_DEPTH}).`,
        ),
      allowedHosts: z
        .array(z.string())
        .optional()
        .describe(
          "Optional explicit allow-list of hostnames. When omitted, the crawler stays on the start URL's hostname.",
        ),
      timeoutSeconds: z
        .number()
        .int()
        .positive()
        .max(HARD_TIMEOUT_SECONDS)
        .default(DEFAULT_TIMEOUT_SECONDS)
        .describe(
          `Total crawl timeout across all pages (default ${DEFAULT_TIMEOUT_SECONDS}, hard max ${HARD_TIMEOUT_SECONDS}).`,
        ),
    }),
    execute: async ({
      startUrl,
      maxPages,
      maxDepth,
      allowedHosts,
      timeoutSeconds,
    }) => {
      const start = assertPublicUrl(startUrl);
      const hostAllowList = new Set<string>(
        (allowedHosts && allowedHosts.length > 0
          ? allowedHosts
          : [start.hostname]
        ).map((h) => h.toLowerCase()),
      );

      const controller = new AbortController();
      const timer = setTimeout(
        () => controller.abort(),
        timeoutSeconds * 1000,
      );

      const visited = new Set<string>();
      const pages: FetchedPage[] = [];
      type QueueItem = { url: URL; depth: number };
      const queue: QueueItem[] = [{ url: start, depth: 0 }];

      try {
        while (queue.length > 0 && pages.length < maxPages) {
          if (controller.signal.aborted) break;
          const item = queue.shift()!;
          const key = item.url.toString();
          if (visited.has(key)) continue;
          visited.add(key);

          // Re-assert safety for every URL we dequeue so a redirect chain
          // from a trusted host can't drag us into a blocked one.
          let safeUrl: URL;
          try {
            safeUrl = assertPublicUrl(key);
          } catch {
            continue;
          }
          if (!hostAllowList.has(safeUrl.hostname.toLowerCase())) continue;

          const page = await fetchPage(safeUrl, controller.signal);
          pages.push(page);

          if (item.depth >= maxDepth) continue;
          for (const link of page.links) {
            if (visited.has(link)) continue;
            try {
              const linkUrl = new URL(link);
              if (!hostAllowList.has(linkUrl.hostname.toLowerCase())) continue;
              queue.push({ url: linkUrl, depth: item.depth + 1 });
            } catch {
              // ignore malformed
            }
          }
        }
      } finally {
        clearTimeout(timer);
      }

      return {
        startUrl: start.toString(),
        hostAllowList: Array.from(hostAllowList),
        pagesFetched: pages.length,
        timedOut: controller.signal.aborted,
        pages: pages.map((p) => ({
          url: p.url,
          status: p.status,
          title: p.title,
          excerpt: p.excerpt,
          outgoingLinks: p.links.length,
          bytes: p.bytes,
          ...(p.error ? { error: p.error } : {}),
        })),
      };
    },
  });
}
