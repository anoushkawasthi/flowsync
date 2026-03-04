import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import * as https from "https";
import { writeConfig, getWorkspaceRoot, BASE_PORT } from "../config";
import { findAvailablePort } from "../hookListener";
import { detectAll } from "../autoDetect";

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
 * Writes .vscode/mcp.json into the workspace, registering the FlowSync MCP server
 * so GitHub Copilot can discover and call the tools automatically.
 *
 * Points to the bundled mcp-server.js shipped inside the extension VSIX at
 * `<extensionPath>/dist/mcp-server.js` — no separate install required.
 */
export function writeMcpConfig(
  workspaceRoot: string,
  extensionPath: string,
  projectId: string,
  token: string
): void {
  const vscodeDir = path.join(workspaceRoot, ".vscode");
  if (!fs.existsSync(vscodeDir)) {
    fs.mkdirSync(vscodeDir, { recursive: true });
  }

  const mcpServerPath = path.join(extensionPath, "dist", "mcp-server.mjs");

  const mcpConfig = {
    servers: {
      flowsync: {
        type: "stdio",
        command: "node",
        args: [mcpServerPath],
        env: {
          FLOWSYNC_API_URL: BACKEND_URL,
          FLOWSYNC_PROJECT_ID: projectId,
          FLOWSYNC_TOKEN: token,
        },
      },
    },
  };

  fs.writeFileSync(
    path.join(vscodeDir, "mcp.json"),
    JSON.stringify(mcpConfig, null, 2),
    "utf-8"
  );
}

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

    // Auto-detect project metadata
    vscode.window.showInformationMessage("FlowSync: detecting project metadata...");
    const detected = detectAll(workspaceRoot);

    const hasAllDetected =
      !!detected.name &&
      detected.languages.length > 0 &&
      !!detected.defaultBranch;

    // --- FAST PATH: everything detected, single confirmation screen ---
    if (hasAllDetected) {
      const detectedSummary = [
        `Name:     ${detected.name}`,
        `Languages:${detected.languages.join(", ")}`,
        `Frameworks:${detected.frameworks.length > 0 ? detected.frameworks.join(", ") : "none detected"}`,
        `Branch:   ${detected.defaultBranch}`,
        detected.description ? `Description: ${detected.description.slice(0, 80)}…` : "",
      ]
        .filter(Boolean)
        .join("\n");

      const confirmAction = await vscode.window.showQuickPick(
        [
          {
            label: "$(check) Confirm & Create",
            description: "Use detected values and create project now",
            detail: detectedSummary,
          },
          {
            label: "$(edit) Edit detected values",
            description: "Review and modify before creating",
          },
        ],
        {
          placeHolder: `Auto-detected: ${detected.name} (${detected.languages.join(", ")})`,
          matchOnDescription: false,
          matchOnDetail: false,
        }
      );

      if (!confirmAction) return;

      // Fast-path confirm: skip all forms, go straight to API call
      if (confirmAction.label.includes("Confirm")) {
        return await createProject({
          context,
          workspaceRoot,
          projectName: detected.name!,
          description: detected.description ?? `${detected.name} project`,
          languages: detected.languages,
          frameworks: detected.frameworks,
          defaultBranch: detected.defaultBranch,
          onInitialized,
        });
      }
      // else fall through to manual form (pre-filled with detected values)
    }

    // --- SLOW PATH: manual form (pre-filled when auto-detect ran) ---
    const projectName = await vscode.window.showInputBox({
      prompt: "Project name",
      value: detected.name ?? undefined,
      placeHolder: "my-project",
      validateInput: (value: string) => {
        if (!value || !/^[a-zA-Z0-9-_]+$/.test(value)) {
          return "Alphanumeric, hyphens, underscores only";
        }
        return null;
      },
    });
    if (!projectName) return;

    const description = await vscode.window.showInputBox({
      prompt: "Short project description (1-3 sentences)",
      value: detected.description ?? undefined,
      placeHolder: "What does this project do?",
    });
    if (description === undefined) return; // null means cancelled

    const ALL_LANGUAGES = [
      "JavaScript", "TypeScript", "Python", "Go", "Java", "Rust", "C++", "C#", "Other",
    ];

    // Pre-check detected languages using QuickPickItem with picked:true
    const languageItems: vscode.QuickPickItem[] = ALL_LANGUAGES.map((lang) => ({
      label: lang,
      picked: detected.languages.includes(lang),
    }));

    const selectedLanguageItems = await vscode.window.showQuickPick(languageItems, {
      canPickMany: true,
      placeHolder:
        detected.languages.length > 0
          ? `Detected: ${detected.languages.join(", ")} — confirm or change`
          : "Select primary language(s)",
    });

    const finalLanguages =
      selectedLanguageItems && selectedLanguageItems.length > 0
        ? selectedLanguageItems.map((i) => i.label)
        : detected.languages.length > 0
        ? detected.languages
        : null;

    if (!finalLanguages || finalLanguages.length === 0) {
      vscode.window.showErrorMessage("FlowSync: at least one language is required.");
      return;
    }

    const defaultBranch = await vscode.window.showInputBox({
      prompt: "Default branch",
      value: detected.defaultBranch,
    });
    if (!defaultBranch) return;

    await createProject({
      context,
      workspaceRoot,
      projectName,
      description: description || `${projectName} project`,
      languages: finalLanguages,
      frameworks: detected.frameworks,
      defaultBranch,
      onInitialized,
    });
  });
}

interface CreateProjectOptions {
  context: vscode.ExtensionContext;
  workspaceRoot: string;
  projectName: string;
  description: string;
  languages: string[];
  frameworks: string[];
  defaultBranch: string;
  onInitialized: () => void;
}

/**
 * Calls the backend to create the project, writes all config files,
 * injects the git hook, and shows the token modal.
 * Used by both the fast-path (auto-detect confirm) and slow-path (manual form).
 */
async function createProject({
  context,
  workspaceRoot,
  projectName,
  description,
  languages,
  frameworks,
  defaultBranch,
  onInitialized,
}: CreateProjectOptions): Promise<void> {
  // POST /api/v1/projects → get { projectId, apiToken }
  let projectId: string;
  let apiToken: string;
  try {
    const result = await postJson(`${BACKEND_URL}/api/v1/projects`, {
      name: projectName,
      description,
      languages,
      frameworks,
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

  // Store API token in SecretStorage — never written to disk
  await context.secrets.store(`flowsync.token.${projectId}`, apiToken);

  // Allocate a port for this project — first available from BASE_PORT
  const port = await findAvailablePort(BASE_PORT);

  // Write .flowsync.json (includes port)
  writeConfig({ projectId, backendUrl, defaultBranch, port });

  // Write .github/copilot-instructions.md
  writeCopilotInstructions(workspaceRoot);

  // Write .vscode/mcp.json so Copilot auto-discovers the FlowSync tools
  writeMcpConfig(workspaceRoot, context.extensionPath, projectId, apiToken);

  // Inject post-push hook with the allocated port
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

  // pre-push receives the push range on stdin:
  //   <local_ref> <local_sha> <remote_ref> <remote_sha>
  // We read it to get the old remote SHA, then fire curl in the background
  // so the push is not delayed. The remoteRef lets getDiff() capture the
  // full range of commits being pushed, not just the tip.
  const hookPath = path.join(hooksDir, "pre-push");
  const hookContent = `#!/bin/sh
# FlowSync — notify local listener of push
REMOTE_SHA=""
while read local_ref local_sha remote_ref remote_sha; do
  REMOTE_SHA="$remote_sha"
done
BRANCH=$(git branch --show-current)
curl -s http://localhost:${port}/flowsync-hook \\
  --data "{\\"event\\":\\"push\\",\\"branch\\":\\"$BRANCH\\",\\"remoteRef\\":\\"$REMOTE_SHA\\"}" &
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
