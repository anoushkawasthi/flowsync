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

export function getDiff(): string | null {
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

export function getParentBranch(defaultBranch: string): string | null {
  return git(`merge-base --fork-point ${defaultBranch} HEAD`);
}

export function getGitUserName(): string | null {
  return git("config user.name");
}
