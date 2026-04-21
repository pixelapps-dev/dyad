/**
 * Minimal search-replace helpers used by the legacy response processor and
 * the DyadSearchReplace UI component. The original FSL implementation
 * supported a rich DSL with fuzzy matching and hunk-level diagnostics; this
 * replacement is deliberately simpler — if a model emits ambiguous blocks it
 * is the model's job to resolve them via another turn.
 */

export interface SearchReplaceBlock {
  searchContent: string;
  replaceContent: string;
}

const SEARCH_MARKER = "<<<<<<< SEARCH";
const DIVIDER = "=======";
const REPLACE_MARKER = ">>>>>>> REPLACE";

export function parseSearchReplaceBlocks(input: string): SearchReplaceBlock[] {
  const blocks: SearchReplaceBlock[] = [];
  const lines = input.split("\n");
  let i = 0;
  while (i < lines.length) {
    if (lines[i].trim() !== SEARCH_MARKER) {
      i++;
      continue;
    }
    const searchLines: string[] = [];
    i++;
    while (i < lines.length && lines[i].trim() !== DIVIDER) {
      searchLines.push(lines[i]);
      i++;
    }
    if (i >= lines.length) break; // unterminated block
    i++; // skip divider
    const replaceLines: string[] = [];
    while (i < lines.length && lines[i].trim() !== REPLACE_MARKER) {
      replaceLines.push(lines[i]);
      i++;
    }
    if (i >= lines.length) break; // unterminated block
    i++; // skip replace marker
    blocks.push({
      searchContent: searchLines.join("\n"),
      replaceContent: replaceLines.join("\n"),
    });
  }
  return blocks;
}

export interface ApplySearchReplaceResult {
  updated: string;
  appliedCount: number;
  failures: Array<{ block: number; reason: string }>;
}

/**
 * Apply a raw search-replace payload to a file's contents. Each block must
 * match exactly once; anything ambiguous is reported as a failure so the
 * caller can surface it back to the model.
 */
export function applySearchReplace(
  fileContents: string,
  rawPayload: string,
): ApplySearchReplaceResult {
  const blocks = parseSearchReplaceBlocks(rawPayload);
  let current = fileContents;
  let appliedCount = 0;
  const failures: ApplySearchReplaceResult["failures"] = [];

  blocks.forEach((block, idx) => {
    const first = current.indexOf(block.searchContent);
    if (first === -1) {
      failures.push({ block: idx, reason: "search content not found" });
      return;
    }
    const second = current.indexOf(
      block.searchContent,
      first + block.searchContent.length,
    );
    if (second !== -1) {
      failures.push({
        block: idx,
        reason: "search content matches multiple times",
      });
      return;
    }
    current =
      current.slice(0, first) +
      block.replaceContent +
      current.slice(first + block.searchContent.length);
    appliedCount++;
  });

  return { updated: current, appliedCount, failures };
}
