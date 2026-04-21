import { tool } from "ai";
import { z } from "zod";
import { spawn } from "node:child_process";
import { rgPath } from "@vscode/ripgrep";
import { safeResolveDir } from "../path_safety";
import type { AgentContext } from "../types";

interface RgMatch {
  path: string;
  lineNumber: number;
  line: string;
}

async function runRipgrep(args: string[], cwd: string): Promise<RgMatch[]> {
  return await new Promise((resolve, reject) => {
    const proc = spawn(rgPath, args, { cwd });
    const chunks: Buffer[] = [];
    const errChunks: Buffer[] = [];
    proc.stdout.on("data", (c) => chunks.push(c));
    proc.stderr.on("data", (c) => errChunks.push(c));
    proc.on("error", reject);
    proc.on("close", (code) => {
      // rg returns 1 when no matches — that's not an error.
      if (code !== 0 && code !== 1) {
        const stderr = Buffer.concat(errChunks).toString("utf8");
        reject(new Error(`ripgrep exited ${code}: ${stderr}`));
        return;
      }
      const lines = Buffer.concat(chunks).toString("utf8").split("\n");
      const matches: RgMatch[] = [];
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const event = JSON.parse(line);
          if (event.type === "match") {
            const submatch = event.data.submatches?.[0];
            matches.push({
              path: event.data.path.text,
              lineNumber: event.data.line_number,
              line: event.data.lines.text.replace(/\n$/, ""),
            });
            void submatch;
          }
        } catch {
          // ignore malformed lines
        }
      }
      resolve(matches);
    });
  });
}

export function grepTool(ctx: AgentContext) {
  return tool({
    description:
      "Search for a regular expression across the app workspace using ripgrep. Returns matching lines with file paths and line numbers.",
    inputSchema: z.object({
      pattern: z.string(),
      path: z.string().default("."),
      caseSensitive: z.boolean().default(true),
      glob: z.string().optional(),
      maxResults: z.number().int().positive().max(500).default(100),
    }),
    execute: async ({ pattern, path: relPath, caseSensitive, glob, maxResults }) => {
      const cwd = await safeResolveDir(ctx.appPath, relPath);
      const args = [
        "--json",
        "--max-count",
        String(maxResults),
        caseSensitive ? "--case-sensitive" : "--ignore-case",
      ];
      if (glob) {
        args.push("--glob", glob);
      }
      args.push(pattern);
      const matches = await runRipgrep(args, cwd);
      return {
        pattern,
        count: matches.length,
        matches: matches.slice(0, maxResults),
      };
    },
  });
}
