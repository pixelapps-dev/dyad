import { tool } from "ai";
import { z } from "zod";

const MAX_BYTES = 2 * 1024 * 1024;

function assertPublicUrl(urlString: string): URL {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    throw new Error(`invalid URL: ${urlString}`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`only http(s) URLs are allowed: ${url.protocol}`);
  }
  // Defense-in-depth: block obvious SSRF targets. Hostname resolution happens
  // inside fetch; this check catches literal loopback/metadata addresses that
  // someone could otherwise pass directly.
  const host = url.hostname.toLowerCase();
  const blockedHosts = new Set([
    "localhost",
    "127.0.0.1",
    "0.0.0.0",
    "::1",
    "169.254.169.254", // AWS / GCP metadata
    "metadata.google.internal",
  ]);
  if (blockedHosts.has(host)) {
    throw new Error(`host not allowed: ${host}`);
  }
  if (host.endsWith(".local") || host.endsWith(".internal")) {
    throw new Error(`host not allowed: ${host}`);
  }
  // Reject RFC1918 literals and link-local.
  if (/^10\./.test(host)) throw new Error(`host not allowed: ${host}`);
  if (/^192\.168\./.test(host)) throw new Error(`host not allowed: ${host}`);
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) {
    throw new Error(`host not allowed: ${host}`);
  }
  if (/^169\.254\./.test(host)) throw new Error(`host not allowed: ${host}`);
  return url;
}

export function webFetchTool() {
  return tool({
    description:
      "Fetch a public web page or resource over HTTPS. Rejects private IP ranges and cloud metadata endpoints. Response body is capped at 2MB.",
    inputSchema: z.object({
      url: z.string(),
      method: z.enum(["GET", "HEAD"]).default("GET"),
      timeoutSeconds: z
        .number()
        .int()
        .positive()
        .max(60)
        .default(30)
        .describe("Hard timeout in seconds (default 30, max 60)."),
    }),
    execute: async ({ url: urlString, method, timeoutSeconds }) => {
      const url = assertPublicUrl(urlString);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutSeconds * 1000);
      try {
        const response = await fetch(url, {
          method,
          redirect: "follow",
          signal: controller.signal,
        });
        const contentType = response.headers.get("content-type") ?? "";
        if (method === "HEAD") {
          return {
            status: response.status,
            ok: response.ok,
            contentType,
            headers: Object.fromEntries(response.headers.entries()),
          };
        }
        const reader = response.body?.getReader();
        if (!reader) {
          return {
            status: response.status,
            ok: response.ok,
            contentType,
            body: "",
            truncated: false,
          };
        }
        const chunks: Uint8Array[] = [];
        let total = 0;
        let truncated = false;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (total + value.byteLength > MAX_BYTES) {
            chunks.push(value.subarray(0, MAX_BYTES - total));
            total = MAX_BYTES;
            truncated = true;
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
        const isText =
          contentType.startsWith("text/") ||
          contentType.includes("json") ||
          contentType.includes("xml") ||
          contentType.includes("javascript") ||
          contentType.includes("css");
        return {
          status: response.status,
          ok: response.ok,
          contentType,
          body: isText ? buf.toString("utf8") : buf.toString("base64"),
          encoding: isText ? "utf8" : "base64",
          bytes: total,
          truncated,
        };
      } finally {
        clearTimeout(timer);
      }
    },
  });
}
