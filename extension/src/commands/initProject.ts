import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { writeConfig, getWorkspaceRoot } from "../config";

/**
 * Copilot instructions content written to .github/copilot-instructions.md.
 * This makes Copilot proactively call FlowSync before every task.
 */
const COPILOT_INSTRUCTIONS = `# FlowSync Context Instructions

Before starting any task:
1. Call the FlowSync MCP tool \`get_project_context\` to understand the current state of the project.
2. Use the returned context to inform your work — decisions, active risks, and pending tasks.

When logging context after a push:
- Call \`log_context\` once, after the push lands, when prompted by the FlowSync VS Code notification.
- Never call \`log_context\` during exploration or before work is committed and pushed.
`;

/**
 * Registers the "FlowSync: Initialize Project" command.
 *
 * Flow:
 * 1. Collects project info via quick input (name, description, languages, default branch)
 * 2. Calls POST /api/v1/projects to create the project (placeholder for now)
 * 3. Writes .flowsync.json to repo root
 * 4. Writes .github/copilot-instructions.md to repo root
 * 5. Stores API token in SecretStorage
 * 6. Injects post-push git hook
 *
 * For Day 1, steps 1-4 + 6 are implemented. Step 2 (backend call) is stubbed
 * until the backend engineer has the endpoint ready.
 */
export function registerInitCommand(
  context: vscode.ExtensionContext
): vscode.Disposable {
  return vscode.commands.registerCommand("flowsync.initProject", async () => {
    const workspaceRoot = getWorkspaceRoot();
    if (!workspaceRoot) {
      vscode.window.showErrorMessage(
        "FlowSync: open a workspace folder first."
      );
      return;
    }

    // Check if already initialized
    if (fs.existsSync(path.join(workspaceRoot, ".flowsync.json"))) {
      vscode.window.showWarningMessage(
        "FlowSync: this project is already initialized."
      );
      return;
    }

    // Collect project info
    const projectName = await vscode.window.showInputBox({
      prompt: "Project name",
      placeHolder: "my-project",
      validateInput: (value) => {
        if (!value || !/^[a-zA-Z0-9-_]+$/.test(value)) {
          return "Alphanumeric, hyphens, underscores only";
        }
        return null;
      },
    });
    if (!projectName) {
      return;
    }

    const description = await vscode.window.showInputBox({
      prompt: "Short project description (1-3 sentences)",
      placeHolder: "What does this project do?",
    });
    if (!description) {
      return;
    }

    const languageOptions = [
      "JavaScript",
      "TypeScript",
      "Python",
      "Go",
      "Java",
      "Rust",
      "C++",
      "Other",
    ];
    const languages = await vscode.window.showQuickPick(languageOptions, {
      canPickMany: true,
      placeHolder: "Select primary language(s)",
    });
    if (!languages || languages.length === 0) {
      return;
    }

    const defaultBranch = await vscode.window.showInputBox({
      prompt: "Default branch",
      value: "main",
    });
    if (!defaultBranch) {
      return;
    }

    // TODO: POST /api/v1/projects → get { projectId, apiToken }
    // For now, generate a placeholder ID. Backend engineer will wire this up.
    const projectId = generateTempId();
    const backendUrl = "https://api.flowsync.dev"; // will become configurable

    // Step 3: Write .flowsync.json
    writeConfig({ projectId, backendUrl, defaultBranch });

    // Step 4: Write .github/copilot-instructions.md
    writeCopilotInstructions(workspaceRoot);

    // Step 6: Inject post-push hook
    injectPostPushHook(workspaceRoot);

    vscode.window.showInformationMessage(
      `FlowSync initialized for "${projectName}". Commit .flowsync.json and .github/copilot-instructions.md to share with your team.`
    );
  });
}

/**
 * Writes .github/copilot-instructions.md to the workspace.
 */
function writeCopilotInstructions(workspaceRoot: string): void {
  const githubDir = path.join(workspaceRoot, ".github");
  if (!fs.existsSync(githubDir)) {
    fs.mkdirSync(githubDir, { recursive: true });
  }

  const filePath = path.join(githubDir, "copilot-instructions.md");
  fs.writeFileSync(filePath, COPILOT_INSTRUCTIONS, "utf-8");
}

/**
 * Injects the post-push git hook into .git/hooks/.
 * The hook sends a signal to the local listener on port 38475.
 */
function injectPostPushHook(workspaceRoot: string): void {
  const hooksDir = path.join(workspaceRoot, ".git", "hooks");
  if (!fs.existsSync(hooksDir)) {
    fs.mkdirSync(hooksDir, { recursive: true });
  }

  const hookPath = path.join(hooksDir, "post-push");
  const hookContent = `#!/bin/sh
curl -s http://localhost:38475/flowsync-hook \\
  --data "{\\"event\\":\\"post-push\\",\\"branch\\":\\"$(git branch --show-current)\\"}"
`;

  fs.writeFileSync(hookPath, hookContent, { mode: 0o755 });
}

/**
 * Temporary ID generator until backend is wired up.
 */
function generateTempId(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
