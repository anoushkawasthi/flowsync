import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

/**
 * Shape of the .flowsync.json file committed to the repo root.
 * Contains no secrets — only connection metadata.
 */
export interface FlowSyncConfig {
  projectId: string;
  backendUrl: string;
  defaultBranch: string;
}

/**
 * Reads .flowsync.json from the workspace root.
 * Returns null if the file doesn't exist or is malformed.
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

    // Validate required fields
    if (!parsed.projectId || !parsed.backendUrl || !parsed.defaultBranch) {
      return null;
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
 * Returns the root path of the first workspace folder, or null.
 */
export function getWorkspaceRoot(): string | null {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    return null;
  }
  return folders[0].uri.fsPath;
}
