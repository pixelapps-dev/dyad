import { tool } from "ai";
import { z } from "zod";
import { spawn } from "node:child_process";
import type { AgentContext } from "../types";

const MAX_OUTPUT_BYTES = 256 * 1024;

interface ProcessResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

async function runCommand(
  cmd: string,
  args: string[],
  cwd: string,
  timeoutMs: number,
): Promise<ProcessResult> {
  return await new Promise((resolve) => {
    const proc = spawn(cmd, args, { cwd, shell: false });
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill("SIGTERM");
      setTimeout(() => proc.kill("SIGKILL"), 5_000).unref();
    }, timeoutMs);

    proc.stdout.on("data", (c: Buffer) => {
      if (stdoutBytes < MAX_OUTPUT_BYTES) {
        stdoutChunks.push(c);
        stdoutBytes += c.length;
      }
    });
    proc.stderr.on("data", (c: Buffer) => {
      if (stderrBytes < MAX_OUTPUT_BYTES) {
        stderrChunks.push(c);
        stderrBytes += c.length;
      }
    });
    proc.on("error", (err) => {
      clearTimeout(timer);
      resolve({
        exitCode: -1,
        stdout: "",
        stderr: err.message,
        timedOut: false,
      });
    });
    proc.on("close", (code) => {
      clearTimeout(timer);
      resolve({
        exitCode: code ?? -1,
        stdout: Buffer.concat(stdoutChunks).toString("utf8"),
        stderr: Buffer.concat(stderrChunks).toString("utf8"),
        timedOut,
      });
    });
  });
}

export function runTypeChecksTool(ctx: AgentContext) {
  return tool({
    description:
      "Run TypeScript type-checking in the app workspace. Uses the app's local tsc via `npx tsc --noEmit`. Returns exit code, stdout, and stderr (capped at 256KB each).",
    inputSchema: z.object({
      project: z
        .string()
        .optional()
        .describe(
          "Optional tsconfig path relative to the app root. Defaults to tsconfig.json.",
        ),
      timeoutSeconds: z
        .number()
        .int()
        .positive()
        .max(300)
        .default(120)
        .describe("Hard timeout in seconds (default 120, max 300)."),
    }),
    execute: async ({ project, timeoutSeconds }) => {
      const args = ["tsc", "--noEmit"];
      if (project) {
        args.push("-p", project);
      }
      const result = await runCommand(
        "npx",
        args,
        ctx.appPath,
        timeoutSeconds * 1000,
      );
      return {
        exitCode: result.exitCode,
        ok: result.exitCode === 0,
        stdout: result.stdout,
        stderr: result.stderr,
        timedOut: result.timedOut,
      };
    },
  });
}
