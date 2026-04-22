import { tool } from "ai";
import { z } from "zod";
import fs from "node:fs/promises";
import path from "node:path";

import { readSettings, decrypt } from "../../main/settings";
import { safeResolve } from "../path_safety";
import { assertPublicUrl } from "../url_safety";
import type {
  Secret,
  ImageGenerationProvider,
  ImageGenerationSettings,
} from "../../lib/schemas";
import type { AgentContext } from "../types";

const DEFAULT_TIMEOUT_SECONDS = 120;
const HARD_TIMEOUT_SECONDS = 600;
const MAX_IMAGE_BYTES = 20 * 1024 * 1024; // 20 MB

/**
 * Subset of PNG/JPEG/WebP sizes we accept across providers. The
 * providers support different sets — we normalise to a common list and
 * the adapter translates as needed.
 */
const SIZE_OPTIONS = ["1024x1024", "1024x1792", "1792x1024"] as const;
type SizeOption = (typeof SIZE_OPTIONS)[number];

interface GeneratedImageBuffer {
  contentType: string;
  buffer: Buffer;
  /** Optional provider-reported note (e.g. safety filter hits). */
  note?: string;
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
  requested: ImageGenerationProvider | undefined,
  settings: ImageGenerationSettings | undefined,
): { provider: ImageGenerationProvider; apiKey: string } {
  const byPriority: ImageGenerationProvider[] = ["openai", "stability"];
  const ordered: ImageGenerationProvider[] = requested
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
      ? `generate_image: no API key configured for provider "${requested}". Add one in Settings -> Image Generation.`
      : `generate_image: no API keys configured. Add an OpenAI or Stability key in Settings -> Image Generation.`,
  );
}

function extFromContentType(contentType: string): string {
  const ct = contentType.toLowerCase();
  if (ct.includes("png")) return ".png";
  if (ct.includes("webp")) return ".webp";
  if (ct.includes("jpeg") || ct.includes("jpg")) return ".jpg";
  return ".png";
}

async function downloadImage(
  urlString: string,
  signal: AbortSignal,
): Promise<GeneratedImageBuffer> {
  const url = assertPublicUrl(urlString);
  const response = await fetch(url, { method: "GET", signal });
  if (!response.ok) {
    throw new Error(
      `failed to download generated image: HTTP ${response.status}`,
    );
  }
  const contentType =
    response.headers.get("content-type") ?? "application/octet-stream";
  const reader = response.body?.getReader();
  if (!reader) throw new Error("no body returned when downloading image");
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (total + value.byteLength > MAX_IMAGE_BYTES) {
      try {
        await reader.cancel();
      } catch {
        // ignore
      }
      throw new Error(
        `image exceeded ${MAX_IMAGE_BYTES} bytes; refusing to save`,
      );
    }
    chunks.push(value);
    total += value.byteLength;
  }
  return {
    contentType,
    buffer: Buffer.concat(chunks.map((c) => Buffer.from(c))),
  };
}

async function generateWithOpenAI(
  apiKey: string,
  prompt: string,
  size: SizeOption,
  signal: AbortSignal,
): Promise<GeneratedImageBuffer> {
  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "dall-e-3",
      prompt,
      n: 1,
      size,
      response_format: "b64_json",
    }),
    signal,
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`OpenAI HTTP ${response.status}: ${text.slice(0, 500)}`);
  }
  const data = JSON.parse(text) as {
    data?: Array<{ b64_json?: string; url?: string; revised_prompt?: string }>;
  };
  const first = data.data?.[0];
  if (!first) throw new Error("OpenAI returned an empty data array");
  if (first.b64_json) {
    return {
      contentType: "image/png",
      buffer: Buffer.from(first.b64_json, "base64"),
      note: first.revised_prompt,
    };
  }
  if (first.url) {
    const downloaded = await downloadImage(first.url, signal);
    return { ...downloaded, note: first.revised_prompt };
  }
  throw new Error("OpenAI returned neither b64_json nor url");
}

async function generateWithStability(
  apiKey: string,
  prompt: string,
  size: SizeOption,
  signal: AbortSignal,
): Promise<GeneratedImageBuffer> {
  // Stability's v2beta/stable-image/generate/core returns a raw PNG binary
  // when Accept: image/* is sent. We use the multipart API since it's the
  // simplest for a no-image-input generate call.
  const [w, h] = size.split("x").map((n) => Number(n));
  const aspect =
    w === h ? "1:1" : w > h ? "16:9" : "9:16";
  const form = new FormData();
  form.append("prompt", prompt);
  form.append("aspect_ratio", aspect);
  form.append("output_format", "png");

  const response = await fetch(
    "https://api.stability.ai/v2beta/stable-image/generate/core",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "image/*",
      },
      body: form,
      signal,
    },
  );
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(
      `Stability HTTP ${response.status}: ${errText.slice(0, 500)}`,
    );
  }
  const arrayBuf = await response.arrayBuffer();
  const buf = Buffer.from(arrayBuf);
  if (buf.byteLength > MAX_IMAGE_BYTES) {
    throw new Error(
      `Stability returned image exceeding ${MAX_IMAGE_BYTES} bytes`,
    );
  }
  return { contentType: "image/png", buffer: buf };
}

async function dispatch(
  provider: ImageGenerationProvider,
  apiKey: string,
  prompt: string,
  size: SizeOption,
  signal: AbortSignal,
): Promise<GeneratedImageBuffer> {
  if (provider === "openai") {
    return generateWithOpenAI(apiKey, prompt, size, signal);
  }
  return generateWithStability(apiKey, prompt, size, signal);
}

export function generateImageTool(ctx: AgentContext) {
  return tool({
    description:
      "Generate an image from a text prompt using a configured provider (OpenAI DALL-E 3 or Stability AI). The image is saved inside the app workspace at `outputPath`; the tool returns the saved path, content type, and size in bytes. Provider is configured in Settings -> Image Generation; the caller can force one via the `provider` arg.",
    inputSchema: z.object({
      prompt: z
        .string()
        .min(1)
        .describe("Natural-language description of the image to generate."),
      outputPath: z
        .string()
        .min(1)
        .describe(
          "Relative path inside the app workspace where the generated image will be written, e.g. 'public/hero.png'. Parents are created as needed. Any existing file at the path is overwritten.",
        ),
      size: z
        .enum(SIZE_OPTIONS)
        .default("1024x1024")
        .describe(
          "Image size. Square (1024x1024), portrait (1024x1792), or landscape (1792x1024). Stability maps these to aspect ratios.",
        ),
      provider: z
        .enum(["openai", "stability"])
        .optional()
        .describe(
          "Force a specific provider. If omitted, uses the configured default (or the first provider with an API key).",
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
      prompt,
      outputPath,
      size,
      provider: requestedProvider,
      timeoutSeconds,
    }) => {
      const settings = readSettings();
      const { provider, apiKey } = resolveProvider(
        requestedProvider,
        settings.imageGeneration,
      );

      // Resolve + sandbox the output path before making a network call so
      // a bad path fails fast.
      const resolved = await safeResolve(ctx.appPath, outputPath);

      const controller = new AbortController();
      const timer = setTimeout(
        () => controller.abort(),
        timeoutSeconds * 1000,
      );
      try {
        const image = await dispatch(
          provider,
          apiKey,
          prompt,
          size,
          controller.signal,
        );

        // If the caller gave an extension-less path, append one inferred
        // from the provider's content-type. Otherwise trust the caller.
        const hasExt = !!path.extname(resolved);
        const finalPath = hasExt
          ? resolved
          : resolved + extFromContentType(image.contentType);
        await fs.mkdir(path.dirname(finalPath), { recursive: true });
        await fs.writeFile(finalPath, image.buffer);

        return {
          provider,
          outputPath: path.relative(ctx.appPath, finalPath),
          contentType: image.contentType,
          bytes: image.buffer.byteLength,
          size,
          note: image.note,
        };
      } finally {
        clearTimeout(timer);
      }
    },
  });
}
