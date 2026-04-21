import { tool } from "ai";
import { z } from "zod";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import type { AgentContext } from "../types";

const MAX_OUTPUT_BYTES = 256 * 1024;

// Strict whitelist for npm package names plus optional @scope and @version.
// Refuses flags and shell metacharacters so the args list can never be
// re-interpreted as options to npm install.
const PACKAGE_SPEC = /^(@[a-z0-9][a-z0-9-_.]*\/)?[a-z0-9][a-z0-9-_.]*(@[A-Za-z0-9][A-Za-z0-9.^~>=<*|-]*)?$/;

function validateSpec(spec: string): void {
  if (spec.startsWith("-")) {
    throw new Error(`package spec must not start with '-': ${spec}`);
  }
  if (!PACKAGE_SPEC.test(spec)) {
    throw new Error(
      `invalid package spec: ${spec} (expected name, @scope/name, or name@version)`,
    );
  }
}

async function detectPackageManager(
  cwd: string,
): Promise<"pnpm" | "yarn" | "npm"> {
  const candidates: Array<[string, "pnpm" | "yarn" | "npm"]> = [
    ["pnpm-lock.yaml", "pnpm"],
    ["yarn.lock", "yarn"],
    ["package-lock.json", "npm"],
  ];
  for (const [file, pm] of candidates) {
    try {
      await fs.access(path.join(cwd, file));
      return pm;
    } catch {
      // try next
    }
  }
  return "npm";
}

async function runCommand(
  cmd: string,
  args: string[],
  cwd: string,
  timeoutMs: number,
): Promise<{
  exitCode: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}> {
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

export function addDependencyTool(ctx: AgentContext) {
  return tool({
    description:
      "Install one or more npm packages into the app workspace. Package manager is auto-detected from the lockfile (pnpm/yarn/npm). Package specs are validated against a strict whitelist to prevent CLI flag injection.",
    inputSchema: z.object({
      packages: z
        .array(z.string())
        .min(1)
        .max(20)
        .describe(
          "List of package specs, e.g. ['react', '@tanstack/react-query', 'zod@^3.0.0'].",
        ),
      dev: z
        .boolean()
        .default(false)
        .describe("If true, install as a devDependency."),
      timeoutSeconds: z
        .number()
        .int()
        .positive()
        .max(600)
        .default(180)
        .describe("Hard timeout in seconds (default 180, max 600)."),
    }),
    execute: async ({ packages, dev, timeoutSeconds }) => {
      for (const spec of packages) validateSpec(spec);

      const pm = await detectPackageManager(ctx.appPath);
      const args: string[] = [];
      if (pm === "npm") {
        args.push("install", dev ? "--save-dev" : "--save");
      } else if (pm === "yarn") {
        args.push("add");
        if (dev) args.push("--dev");
      } else {
        args.push("add");
        if (dev) args.push("--save-dev");
      }
      args.push(...packages);

      const result = await runCommand(
        pm,
        args,
        ctx.appPath,
        timeoutSeconds * 1000,
      );
      return {
        packageManager: pm,
        packages,
        dev,
        exitCode: result.exitCode,
        ok: result.exitCode === 0,
        stdout: result.stdout,
        stderr: result.stderr,
        timedOut: result.timedOut,
      };
    },
  });
}
