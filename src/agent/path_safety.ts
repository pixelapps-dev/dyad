import path from "node:path";
import fs from "node:fs/promises";

export class PathSafetyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PathSafetyError";
  }
}

/**
 * Resolves a user-supplied relative path against the workspace root and
 * rejects anything that escapes the workspace (via `..`, absolute paths,
 * or symlinks).
 */
export async function safeResolve(
  workspaceRoot: string,
  relativePath: string,
): Promise<string> {
  if (typeof relativePath !== "string" || relativePath.length === 0) {
    throw new PathSafetyError("path is empty");
  }
  if (path.isAbsolute(relativePath)) {
    throw new PathSafetyError(`absolute paths not allowed: ${relativePath}`);
  }

  const rootReal = await fs.realpath(workspaceRoot);
  const joined = path.resolve(rootReal, relativePath);

  // Symlink-aware containment check. If the target doesn't exist yet,
  // walk parents until we find an existing ancestor and realpath that.
  let existing = joined;
  while (true) {
    try {
      existing = await fs.realpath(existing);
      break;
    } catch {
      const parent = path.dirname(existing);
      if (parent === existing) break;
      existing = parent;
    }
  }

  const withinRoot =
    existing === rootReal || existing.startsWith(rootReal + path.sep);
  if (!withinRoot) {
    throw new PathSafetyError(
      `path escapes workspace: ${relativePath} -> ${existing}`,
    );
  }
  return joined;
}

/**
 * Same as safeResolve but for directory operations — ensures the resolved
 * path is (or will be) a directory within the workspace.
 */
export async function safeResolveDir(
  workspaceRoot: string,
  relativePath: string,
): Promise<string> {
  const resolved = await safeResolve(workspaceRoot, relativePath || ".");
  try {
    const stat = await fs.stat(resolved);
    if (!stat.isDirectory()) {
      throw new PathSafetyError(`not a directory: ${relativePath}`);
    }
  } catch (err: any) {
    if (err?.code !== "ENOENT") throw err;
  }
  return resolved;
}
