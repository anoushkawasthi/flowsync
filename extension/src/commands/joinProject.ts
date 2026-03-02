import * as vscode from "vscode";
import * as https from "https";
import { readConfig } from "../config";

/**
 * Registers the "FlowSync: Join Project" command.
 *
 * Used by Dev 2+ who clone a repo that already has .flowsync.json.
 * They need to supply their API token (shared out-of-band by the team lead).
 *
 * Flow:
 * 1. Read .flowsync.json to get projectId + backendUrl
 * 2. Prompt for API token
 * 3. Validate token against GET /api/v1/projects/{projectId}
 * 4. Store token in SecretStorage
 * 5. Call onAuthenticated() so extension.ts can start the hook listener
 *
 * onAuthenticated is passed in from extension.ts to avoid a circular import.
 */
export function registerJoinCommand(
  context: vscode.ExtensionContext,
  onAuthenticated: () => void
): vscode.Disposable {
  return vscode.commands.registerCommand("flowsync.joinProject", async () => {
    const config = readConfig();
    if (!config) {
      vscode.window.showErrorMessage(
        "FlowSync: no .flowsync.json found in this workspace. Run 'FlowSync: Initialize Project' first."
      );
      return;
    }

    const { projectId, backendUrl } = config;

    // Prompt for token
    const token = await vscode.window.showInputBox({
      prompt: "Enter your FlowSync API token (shared by your team lead)",
      placeHolder: "Paste token here",
      password: true,
      ignoreFocusOut: true,
      validateInput: (value: string) => {
        if (!value || value.trim().length < 8) {
          return "Token looks too short — paste the full token";
        }
        return null;
      },
    });

    if (!token) {
      return; // user cancelled
    }

    // Validate token against backend
    vscode.window.setStatusBarMessage("$(sync~spin) FlowSync: validating token...", 5000);

    try {
      await validateToken(backendUrl, projectId, token.trim());
    } catch (err) {
      vscode.window.showErrorMessage(
        `FlowSync: token validation failed. Double-check your token and try again. (${String(err)})`
      );
      return;
    }

    // Store in SecretStorage — initializeForProject will read it from here
    await context.secrets.store(`flowsync.token.${projectId}`, token.trim());

    // Delegate back to extension.ts to start the hook listener
    onAuthenticated();

    vscode.window.setStatusBarMessage("$(check) FlowSync connected", 5000);
    vscode.window.showInformationMessage(
      "FlowSync: connected successfully. Your pushes will now be captured automatically."
    );
  });
}

/**
 * Validates a token by calling GET /api/v1/projects/{projectId}.
 * Throws if the token is invalid or the request fails.
 */
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
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
      (res) => {
        let body = "";
        res.on("data", (chunk: Buffer) => { body += chunk.toString(); });
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
