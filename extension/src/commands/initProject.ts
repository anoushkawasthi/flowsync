import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import * as https from "https";
import { writeConfig, getWorkspaceRoot, BASE_PORT } from "../config";
import { findAvailablePort } from "../hookListener";

const BACKEND_URL = "https://86tzell2w9.execute-api.us-east-1.amazonaws.com/prod";

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
  context: vscode.ExtensionContext,
  onInitialized: () => void
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
      validateInput: (value: string) => {
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

    // Step 2: POST /api/v1/projects → get { projectId, apiToken }
    let projectId: string;
    let apiToken: string;
    try {
      const result = await postJson(`${BACKEND_URL}/api/v1/projects`, {
        name: projectName,
        description,
        languages,
        frameworks: [],
        defaultBranch,
        teamMembers: [],
      });
      projectId = result.projectId as string;
      apiToken = result.apiToken as string;
      if (!projectId || !apiToken) {
        throw new Error("Backend returned unexpected response");
      }
    } catch (err) {
      vscode.window.showErrorMessage(
        `FlowSync: failed to create project. Check your network and try again. (${String(err)})`
      );
      return;
    }

    const backendUrl = BACKEND_URL;

    // Step 5: Store API token in SecretStorage — never written to disk
    await context.secrets.store(`flowsync.token.${projectId}`, apiToken);

    // Allocate a port for this project — first available from BASE_PORT
    const port = await findAvailablePort(BASE_PORT);

    // Step 3: Write .flowsync.json (includes port)
    writeConfig({ projectId, backendUrl, defaultBranch, port });

    // Step 4: Write .github/copilot-instructions.md
    writeCopilotInstructions(workspaceRoot);

    // Step 6: Inject post-push hook with the allocated port
    injectPostPushHook(workspaceRoot, port);

    // Show token — this is the ONLY time it is ever visible. Auto-copy + modal.
    await vscode.env.clipboard.writeText(apiToken);
    const tokenAction = await vscode.window.showInformationMessage(
      `FlowSync initialized for "${projectName}"!\n\n` +
      `Your API token (already copied to clipboard):\n${apiToken}\n\n` +
      `Share this token with teammates so they can run "FlowSync: Join Project". ` +
      `It will NOT be shown again.`,
      { modal: true },
      "Copy Again"
    );
    if (tokenAction === "Copy Again") {
      await vscode.env.clipboard.writeText(apiToken);
    }

    vscode.window.showInformationMessage(
      `FlowSync ready. Commit .flowsync.json and .github/copilot-instructions.md to share with your team.`
    );

    // Start hook listener immediately — no window reopen needed
    onInitialized();
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
 * Injects the pre-push git hook into .git/hooks/.
 * pre-push is a real Git hook (post-push does NOT exist in Git).
 * The hook sends a signal to the local listener on the project's allocated port.
 */
function injectPostPushHook(workspaceRoot: string, port: number): void {
  const hooksDir = path.join(workspaceRoot, ".git", "hooks");
  if (!fs.existsSync(hooksDir)) {
    fs.mkdirSync(hooksDir, { recursive: true });
  }

  // pre-push receives lines on stdin — we must consume them or git hangs.
  // Fire curl in background (&) so the push is not delayed.
  const hookPath = path.join(hooksDir, "pre-push");
  const hookContent = `#!/bin/sh
# FlowSync — notify local listener of push
cat > /dev/null
curl -s http://localhost:${port}/flowsync-hook \\
  --data "{\\"event\\":\\"push\\",\\"branch\\":\\"$(git branch --show-current)\\"}" &
`;

  fs.writeFileSync(hookPath, hookContent, { mode: 0o755 });
}

/**
 * POST JSON to a URL and return the parsed response.
 */
function postJson(url: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const parsedUrl = new URL(url);

    const req = https.request(
      {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || 443,
        path: parsedUrl.pathname,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(data),
        },
      },
      (res) => {
        let responseBody = "";
        res.on("data", (chunk: Buffer) => { responseBody += chunk.toString(); });
        res.on("end", () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try { resolve(JSON.parse(responseBody)); }
            catch { reject(new Error(`Failed to parse response: ${responseBody}`)); }
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${responseBody}`));
          }
        });
      }
    );

    req.on("error", reject);
    req.write(data);
    req.end();
  });
}
