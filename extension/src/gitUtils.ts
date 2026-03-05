import { execSync } from "child_process";
import { getWorkspaceRoot } from "./config";
import { log } from "./logger";

export interface CommitInfo {
  commitHash: string;
  message: string;
  author: string;
  timestamp: string;
}

function git(args: string): string | null {
  const cwd = getWorkspaceRoot();
  if (!cwd) {
    log.error("git", "no workspace root — cannot run git command");
    return null;
  }
  try {
    const result = execSync(`git ${args}`, { cwd, encoding: "utf-8" }).trim();
    return result || null;
  } catch (e) {
    log.warn("git", `command failed: git ${args} — ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
}

export function getDiff(remoteRef?: string): string | null {
  // If we know the old remote SHA (passed from pre-push hook stdin), diff the
  // full range of commits being pushed — handles multi-commit pushes correctly.
  if (remoteRef && remoteRef !== "0000000000000000000000000000000000000000") {
    log.step("getDiff", `using push range diff: ${remoteRef.slice(0, 8)}..HEAD`);
    const rangeDiff = git(`diff ${remoteRef} HEAD`);
    if (rangeDiff) {
      const truncated = rangeDiff.length > 50_000;
      const result = truncated ? rangeDiff.slice(0, 50_000) : rangeDiff;
      log.ok("getDiff", `push-range diff: ${result.length} chars${truncated ? " (truncated)" : ""}`);
      return result;
    }
  }

  // Detect merge commits — HEAD has 2+ parents.
  // `git rev-list --parents -n 1 HEAD` returns: <hash> <parent1> [<parent2> ...]
  const parentsLine = git("rev-list --parents -n 1 HEAD");
  const parentCount = parentsLine ? parentsLine.trim().split(" ").length - 1 : 1;

  if (parentCount >= 2) {
    // Merge commit. Diff from the merge base of the two parents so we capture
    // all changes introduced by the merged branch, not just the merge commit itself.
    log.step("getDiff", "merge commit detected — diffing from merge-base");
    const mergeBase = git("merge-base HEAD~1 HEAD~2");
    if (mergeBase) {
      const mergeDiff = git(`diff ${mergeBase.trim()} HEAD`);
      if (mergeDiff) {
        const truncated = mergeDiff.length > 50_000;
        const result = truncated ? mergeDiff.slice(0, 50_000) : mergeDiff;
        log.ok("getDiff", `merge-base diff: ${result.length} chars${truncated ? " (truncated)" : ""}`);
        return result;
      }
    }
    log.warn("getDiff", "merge-base unavailable, falling back to HEAD~1 HEAD");
  }

  log.step("getDiff", "trying git diff HEAD~1 HEAD");
  let diff = git("diff HEAD~1 HEAD");

  if (!diff) {
    log.warn("getDiff", "HEAD~1 not available (first commit?) — falling back to git show HEAD");
    diff = git("show HEAD --format= --patch");
  }

  if (!diff) {
    log.error("getDiff", "both diff strategies returned null — no diff available");
    return null;
  }

  const truncated = diff.length > 50_000;
  const result = truncated ? diff.slice(0, 50_000) : diff;
  log.ok("getDiff", `captured ${result.length} chars${truncated ? " (truncated from " + diff.length + ")" : ""}`);
  return result;
}

export function getLastCommitInfo(): CommitInfo | null {
  log.step("getLastCommitInfo", "running git log -1");
  const raw = git("log -1 --format=format:%H%n%s%n%an%n%aI");
  if (!raw) {
    log.error("getLastCommitInfo", "git log returned null");
    return null;
  }

  const parts = raw.split("\n");
  log.info("getLastCommitInfo", `raw output (${parts.length} lines): ${JSON.stringify(parts)}`);

  const [commitHash, message, author, timestamp] = parts;
  if (!commitHash || !message || !author || !timestamp) {
    log.error("getLastCommitInfo", `parse failed — commitHash=${commitHash} message=${message} author=${author} timestamp=${timestamp}`);
    return null;
  }

  const info = { commitHash, message, author, timestamp };
  log.ok("getLastCommitInfo", `hash=${commitHash.slice(0, 8)} author="${author}" msg="${message}"`);
  return info;
}

export function getCurrentBranch(): string | null {
  return git("branch --show-current");
}

export function getMergeInfo(): { isMerge: boolean; sourceBranch: string | null } {
  const parentsLine = git("rev-list --parents -n 1 HEAD");
  const parts = parentsLine ? parentsLine.trim().split(" ") : [];
  const parentCount = parts.length - 1;

  if (parentCount < 2) {
    return { isMerge: false, sourceBranch: null };
  }

  // Second parent hash = tip of the branch being merged in
  const parent2Hash = parts[2] ?? null;
  let sourceBranch: string | null = null;

  if (parent2Hash) {
    const rawName = git(`name-rev --name-only ${parent2Hash}`);
    if (rawName && rawName !== "undefined") {
      // Normalise: strip remotes/origin/ prefix and ~N / ^N suffixes
      sourceBranch = rawName
        .replace(/^remotes\/(?:origin\/)?/, "")
        .replace(/^origin\//, "")
        .replace(/[~^]\d*$/, "")
        .trim() || null;
    }
  }

  log.ok("getMergeInfo", `merge commit detected — source branch: ${sourceBranch ?? "unknown"}`);
  return { isMerge: true, sourceBranch };
}

export function getParentBranch(defaultBranch: string): string | null {
  return git(`merge-base --fork-point ${defaultBranch} HEAD`);
}

export function getGitUserName(): string | null {
  return git("config user.name");
}
