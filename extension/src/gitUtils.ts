import { execSync } from "child_process";
import { getWorkspaceRoot } from "./config";

/**
 * Metadata captured from the most recent git commit.
 */
export interface CommitInfo {
  commitHash: string;
  message: string;
  author: string;
  timestamp: string;
}

/**
 * Runs a git command in the workspace root.
 * Returns trimmed stdout, or null on failure.
 */
function git(args: string): string | null {
  const cwd = getWorkspaceRoot();
  if (!cwd) {
    return null;
  }

  try {
    return execSync(`git ${args}`, { cwd, encoding: "utf-8" }).trim();
  } catch {
    return null;
  }
}

/**
 * Returns the diff between the last two commits.
 * Truncated to 50,000 chars as per spec.
 */
export function getDiff(): string | null {
  const diff = git("diff HEAD~1 HEAD");
  if (!diff) {
    return null;
  }
  return diff.length > 50_000 ? diff.slice(0, 50_000) : diff;
}

/**
 * Returns metadata for the most recent commit.
 * Format: "hash|subject|author|ISO date"
 */
export function getLastCommitInfo(): CommitInfo | null {
  const raw = git('log -1 --format="%H|%s|%an|%aI"');
  if (!raw) {
    return null;
  }

  const [commitHash, message, author, timestamp] = raw.split("|");
  if (!commitHash || !message || !author || !timestamp) {
    return null;
  }

  return { commitHash, message, author, timestamp };
}

/**
 * Returns the current branch name.
 */
export function getCurrentBranch(): string | null {
  return git("branch --show-current");
}

/**
 * Returns the parent branch by finding the fork point from main.
 */
export function getParentBranch(defaultBranch: string): string | null {
  return git(`merge-base --fork-point ${defaultBranch} HEAD`);
}

/**
 * Returns the git user.name config value (used as author identity).
 */
export function getGitUserName(): string | null {
  return git("config user.name");
}
