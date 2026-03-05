import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

const BASE_PORT = 38475;

/**
 * Shape of the .flowsync.json file committed to the repo root.
 * Contains no secrets — only connection metadata.
 */
export interface FlowSyncConfig {
  projectId: string;
  backendUrl: string;
  defaultBranch: string;
  port: number; // per-project listener port — unique per workspace
}

/**
 * Reads .flowsync.json from the workspace root.
 * Returns null if the file doesn't exist or is malformed.
 * Backwards-compatible: missing port defaults to BASE_PORT.
 */
export function readConfig(): FlowSyncConfig | null {
  const workspaceRoot = getWorkspaceRoot();
  if (!workspaceRoot) {
    return null;
  }

  const configPath = path.join(workspaceRoot, ".flowsync.json");
  if (!fs.existsSync(configPath)) {
    return null;
  }

  try {
    const raw = fs.readFileSync(configPath, "utf-8");
    const parsed = JSON.parse(raw);

    if (!parsed.projectId || !parsed.backendUrl || !parsed.defaultBranch) {
      return null;
    }

    // Backwards-compatible: old configs without port get the base port
    if (!parsed.port) {
      parsed.port = BASE_PORT;
    }

    return parsed as FlowSyncConfig;
  } catch {
    return null;
  }
}

/**
 * Writes .flowsync.json to the workspace root.
 * Called during project initialization.
 */
export function writeConfig(config: FlowSyncConfig): void {
  const workspaceRoot = getWorkspaceRoot();
  if (!workspaceRoot) {
    throw new Error("No workspace folder open");
  }

  const configPath = path.join(workspaceRoot, ".flowsync.json");
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", "utf-8");
}

/**
 * Returns the Git repository root by walking up the directory tree.
 * Looks for .git directory or .flowsync.json file.
 * Falls back to first workspace folder if neither found.
 */
export function getWorkspaceRoot(): string | null {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    return null;
  }

  const startPath = folders[0].uri.fsPath;
  let current = startPath;

  // Walk up looking for .git (Git root) or .flowsync.json
  while (current !== path.dirname(current)) {
    const gitPath = path.join(current, '.git');
    const configPath = path.join(current, '.flowsync.json');

    if (fs.existsSync(gitPath)) {
      return current;
    }
    if (fs.existsSync(configPath)) {
      return current;
    }

    current = path.dirname(current);
  }

  // Fallback to opened workspace folder if no Git root found
  return startPath;
}

export { BASE_PORT };
