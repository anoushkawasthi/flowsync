import * as vscode from "vscode";
import * as path from "path";
import * as https from "https";
import * as fs from "fs";
import { readConfig, writeConfig, getWorkspaceRoot, BASE_PORT } from "../config";
import { findAvailablePort } from "../hookListener";
import { writeMcpConfig } from "../commands/initProject";
import { detectAll } from "../autoDetect";
import { log } from "../logger";

const BACKEND_URL =
  "https://86tzell2w9.execute-api.us-east-1.amazonaws.com/prod";

/**
 * Manages the FlowSync webview panel — the polished React UI for
 * initializing projects, joining, and viewing dashboard status.
 */
export class FlowSyncPanel {
  public static currentPanel: FlowSyncPanel | undefined;
  private static readonly viewType = "flowsync.panel";

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private readonly _context: vscode.ExtensionContext;
  private readonly _onInitialized: () => void;
  private _disposables: vscode.Disposable[] = [];

  /* ─── public API ─── */

  public static createOrShow(
    extensionUri: vscode.Uri,
    context: vscode.ExtensionContext,
    onInitialized: () => void,
    initialView?: string
  ): void {
    const column = vscode.window.activeTextEditor?.viewColumn;

    if (FlowSyncPanel.currentPanel) {
      FlowSyncPanel.currentPanel._panel.reveal(column);
      if (initialView) {
        FlowSyncPanel.currentPanel.navigateTo(initialView);
      }
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      FlowSyncPanel.viewType,
      "FlowSync",
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, "webview-ui", "build"),
        ],
      }
    );

    FlowSyncPanel.currentPanel = new FlowSyncPanel(
      panel,
      extensionUri,
      context,
      onInitialized,
      initialView
    );
  }

  public navigateTo(view: string): void {
    this._panel.webview.postMessage({ type: "navigate", view });
  }

  public sendCatchUpData(data: unknown): void {
    this._panel.webview.postMessage({ type: "catchUpData", data });
  }

  private _sendAutoDetect(): void {
    const workspaceRoot = getWorkspaceRoot();
    if (!workspaceRoot) { return; }
    try {
      const detected = detectAll(workspaceRoot);
      log.step("autoDetect", `root=${workspaceRoot} name=${detected.name} langs=${JSON.stringify(detected.languages)} branch=${detected.defaultBranch}`);
      this._panel.webview.postMessage({ type: "autoDetect", data: detected });
    } catch (err) {
      log.error("FlowSyncPanel:autoDetect", `detection failed: ${err}`);
    }
  }

  public dispose(): void {
    FlowSyncPanel.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      const d = this._disposables.pop();
      d?.dispose();
    }
  }

  /* ─── constructor ─── */

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    context: vscode.ExtensionContext,
    onInitialized: () => void,
    initialView?: string
  ) {
    this._panel = panel;
    this._extensionUri = extensionUri;
    this._context = context;
    this._onInitialized = onInitialized;

    this._panel.webview.html = this._getHtmlForWebview(this._panel.webview);

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    this._panel.webview.onDidReceiveMessage(
      (msg) => this._handleMessage(msg),
      null,
      this._disposables
    );

    // Send initial navigation after React mounts
    if (initialView) {
      setTimeout(() => this.navigateTo(initialView), 300);
    }
  }

  /* ─── HTML builder ─── */

  private _getHtmlForWebview(webview: vscode.Webview): string {
    const buildUri = vscode.Uri.joinPath(
      this._extensionUri,
      "webview-ui",
      "build"
    );

    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(buildUri, "assets", "index.js")
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(buildUri, "assets", "index.css")
    );

    const nonce = getNonce();

    return /* html */ `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="Content-Security-Policy"
      content="default-src 'none';
               style-src ${webview.cspSource} 'unsafe-inline';
               script-src 'nonce-${nonce}';
               connect-src ${webview.cspSource};
               font-src ${webview.cspSource};
               img-src ${webview.cspSource} data:;">
    <link rel="stylesheet" href="${styleUri}">
    <title>FlowSync</title>
  </head>
  <body>
    <div id="root"></div>
    <script nonce="${nonce}" src="${scriptUri}"></script>
  </body>
</html>`;
  }

  /* ─── message router ─── */

  private async _handleMessage(message: Record<string, unknown>): Promise<void> {
    switch (message.type) {
      case "initProject":
        await this._handleInitProject(message.data as Record<string, unknown>);
        break;
      case "joinProject":
        await this._handleJoinProject(message.data as Record<string, unknown>);
        break;
      case "requestStatus":
      case "refreshStatus":
        await this._sendStatus();
        break;
      case "sendChatMessage":
        await this._handleSendChatMessage(message.data as Record<string, unknown>);
        break;
      case "copyToken":
        await vscode.env.clipboard.writeText(message.token as string);
        vscode.window.showInformationMessage("Token copied to clipboard");
        break;
      case "openOutput":
        vscode.commands.executeCommand(
          "workbench.action.output.toggleOutput"
        );
        break;
      case "requestAutoDetect":
        this._sendAutoDetect();
        break;
      case "requestRecentActivity":
        // User wants to see recent activity even though there are no new changes
        vscode.commands.executeCommand("flowsync.viewRecentActivity");
        break;
    }
  }

  /* ─── init project handler ─── */

  private async _handleInitProject(data: Record<string, unknown>): Promise<void> {
    const workspaceRoot = getWorkspaceRoot();
    if (!workspaceRoot) {
      this._sendInitResult(false, "Open a workspace folder first.");
      return;
    }

    if (fs.existsSync(path.join(workspaceRoot, ".flowsync.json"))) {
      this._sendInitResult(false, "This project is already initialized.");
      return;
    }

    const { name, description, languages, defaultBranch } = data as {
      name: string;
      description: string;
      languages: string[];
      defaultBranch: string;
    };

    log.step("WebviewPanel:initProject", `name=${name}`);

    let projectId: string;
    let apiToken: string;

    try {
      const result = await postJson(`${BACKEND_URL}/api/v1/projects`, {
        name,
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
      log.error("WebviewPanel:initProject", `backend call failed: ${err}`);
      this._sendInitResult(
        false,
        `Failed to create project: ${err instanceof Error ? err.message : String(err)}`
      );
      return;
    }

    // Store token
    await this._context.secrets.store(`flowsync.token.${projectId}`, apiToken);

    // Allocate port
    const port = await findAvailablePort(BASE_PORT);

    // Write config files
    writeConfig({ projectId, backendUrl: BACKEND_URL, defaultBranch, port });
    writeCopilotInstructions(workspaceRoot);
    writeMcpConfig(workspaceRoot, this._context.extensionPath, projectId, apiToken);
    injectHook(workspaceRoot, port);

    log.ok("WebviewPanel:initProject", `project ${projectId} created`);

    this._sendInitResult(true, `Project "${name}" initialized.`, apiToken);

    // Trigger extension hook listener
    this._onInitialized();
  }

  /* ─── join project handler ─── */

  private async _handleJoinProject(data: Record<string, unknown>): Promise<void> {
    const config = readConfig();
    if (!config) {
      this._sendJoinResult(false, "No .flowsync.json found. Initialize first.");
      return;
    }

    const token = (data as { token: string }).token;
    const { projectId, backendUrl } = config;

    log.step("WebviewPanel:joinProject", `validating token for ${projectId}`);

    try {
      await validateToken(backendUrl, projectId, token);
    } catch (err) {
      log.error("WebviewPanel:joinProject", `validation failed: ${err}`);
      this._sendJoinResult(
        false,
        `Token validation failed: ${err instanceof Error ? err.message : String(err)}`
      );
      return;
    }

    await this._context.secrets.store(`flowsync.token.${projectId}`, token);

    const workspaceRoot = getWorkspaceRoot();
    if (workspaceRoot) {
      writeMcpConfig(workspaceRoot, this._context.extensionPath, projectId, token);
    }

    log.ok("WebviewPanel:joinProject", "token validated, stored");

    this._sendJoinResult(true, "Connected successfully.");
    this._onInitialized();
  }

  /* ─── chat message handler ─── */

  private async _handleSendChatMessage(data: Record<string, unknown>): Promise<void> {
    const config = readConfig();
    if (!config) {
      this._panel.webview.postMessage({
        type: "chatError",
        message: "Project not configured",
      });
      return;
    }

    const apiToken = await this._context.secrets.get(`flowsync.token.${config.projectId}`);
    if (!apiToken) {
      this._panel.webview.postMessage({
        type: "chatError",
        message: "No API token found",
      });
      return;
    }

    const { message, sessionId } = data as { message: string; sessionId: string | null };

    log.step("WebviewPanel:sendChatMessage", `sending message for project ${config.projectId}`);

    try {
      const response = await postJsonWithAuth(
        `${config.backendUrl}/api/v1/chat`,
        apiToken,
        {
          projectId: config.projectId,
          message,
          sessionId,
        }
      );

      log.ok("WebviewPanel:sendChatMessage", "received response from chat API");

      this._panel.webview.postMessage({
        type: "chatResponse",
        data: response,
      });
    } catch (err) {
      log.error("WebviewPanel:sendChatMessage", `chat API error: ${err}`);
      this._panel.webview.postMessage({
        type: "chatError",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /* ─── status ─── */

  private async _sendStatus(): Promise<void> {
    const config = readConfig();
    if (!config) {
      this._panel.webview.postMessage({
        type: "status",
        data: { connected: false },
      });
      return;
    }

    const hasToken = !!(await this._context.secrets.get(
      `flowsync.token.${config.projectId}`
    ));

    this._panel.webview.postMessage({
      type: "status",
      data: {
        connected: hasToken,
        projectId: config.projectId,
        defaultBranch: config.defaultBranch,
        port: config.port,
        backendUrl: config.backendUrl,
      },
    });
  }

  /* ─── helpers ─── */

  private _sendInitResult(success: boolean, message: string, token?: string): void {
    this._panel.webview.postMessage({
      type: "initResult",
      success,
      message,
      token,
    });
  }

  private _sendJoinResult(success: boolean, message: string): void {
    this._panel.webview.postMessage({
      type: "joinResult",
      success,
      message,
    });
  }
}

/* ================================================================
   Standalone helpers (same logic as commands/initProject.ts but
   kept here to avoid circular deps from the webview flow)
   ================================================================ */

function getNonce(): string {
  let text = "";
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return text;
}

const COPILOT_INSTRUCTIONS = `# FlowSync Context Instructions

Before starting any task:
1. Call the FlowSync MCP tool \`get_project_context\` to understand the current state of the project.
2. Use the returned context to inform your work — decisions, active risks, and pending tasks.

When logging context after a push:
- Call \`log_context\` once, after the push lands, when prompted by the FlowSync VS Code notification.
- Never call \`log_context\` during exploration or before work is committed and pushed.
`;

function writeCopilotInstructions(workspaceRoot: string): void {
  const dir = path.join(workspaceRoot, ".github");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(path.join(dir, "copilot-instructions.md"), COPILOT_INSTRUCTIONS, "utf-8");
}

function injectHook(workspaceRoot: string, port: number): void {
  const hooksDir = path.join(workspaceRoot, ".git", "hooks");
  if (!fs.existsSync(hooksDir)) {
    fs.mkdirSync(hooksDir, { recursive: true });
  }
  const hookPath = path.join(hooksDir, "pre-push");
  const content = `#!/bin/sh
# FlowSync — notify local listener of push
cat > /dev/null
curl -s http://localhost:${port}/flowsync-hook \\
  --data "{\\"event\\":\\"push\\",\\"branch\\":\\"$(git branch --show-current)\\"}" &
`;
  fs.writeFileSync(hookPath, content, { mode: 0o755 });
}

function postJson(
  url: string,
  body: Record<string, unknown>
): Promise<Record<string, unknown>> {
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
        res.on("data", (chunk: Buffer) => {
          responseBody += chunk.toString();
        });
        res.on("end", () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve(JSON.parse(responseBody));
            } catch {
              reject(new Error(`Failed to parse response: ${responseBody}`));
            }
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

function validateToken(
  backendUrl: string,
  projectId: string,
  token: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const url = new URL(`${backendUrl}/api/v1/projects/${projectId}`);
    const req = https.request(
      {
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname,
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      },
      (res) => {
        let body = "";
        res.on("data", (chunk: Buffer) => {
          body += chunk.toString();
        });
        res.on("end", () => {
          if (res.statusCode === 200) {
            resolve();
          } else if (res.statusCode === 401) {
            reject(new Error("Invalid token"));
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${body}`));
          }
        });
      }
    );
    req.on("error", reject);
    req.end();
  });
}

function postJsonWithAuth(
  url: string,
  token: string,
  body: Record<string, unknown>
): Promise<Record<string, unknown>> {
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
          Authorization: `Bearer ${token}`,
        },
      },
      (res) => {
        let responseBody = "";
        res.on("data", (chunk: Buffer) => {
          responseBody += chunk.toString();
        });
        res.on("end", () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve(JSON.parse(responseBody));
            } catch {
              reject(new Error(`Failed to parse response: ${responseBody}`));
            }
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
