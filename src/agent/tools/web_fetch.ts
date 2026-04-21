import { tool } from "ai";
import { z } from "zod";

import { assertPublicUrl } from "../url_safety";

const MAX_BYTES = 2 * 1024 * 1024;

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
