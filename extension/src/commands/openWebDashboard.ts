import * as vscode from "vscode";
import { readConfig } from "../config";
import { getDashboardUrl } from "../api";

/**
 * Opens the web dashboard, putting the credentials on the clipboard first.
 *
 * The web app reads credentials only from localStorage['flowsync-config']
 * (frontend/src/hooks/useConfig.ts) — there is no query-param or fragment
 * handoff, so a link cannot pre-authenticate the browser. The clipboard is the
 * honest alternative: the token never enters a URL, browser history, or a server
 * access log, and the user pastes it once per browser.
 */
export function registerOpenWebDashboardCommand(
  context: vscode.ExtensionContext
): vscode.Disposable {
  return vscode.commands.registerCommand("flowsync.openWebDashboard", async () => {
    const dashboardUrl = getDashboardUrl();
    const config = readConfig();

    if (!config) {
      // Nothing to copy — still useful to open, the dashboard has a demo project.
      await vscode.env.openExternal(vscode.Uri.parse(dashboardUrl));
      vscode.window.showInformationMessage(
        "FlowSync: opened the dashboard. This workspace has no project yet, so use 'Try the demo project'."
      );
      return;
    }

    const token = await context.secrets.get(`flowsync.token.${config.projectId}`);

    if (!token) {
      await vscode.env.openExternal(vscode.Uri.parse(dashboardUrl));
      vscode.window.showWarningMessage(
        "FlowSync: opened the dashboard, but no API token is stored for this project. Run 'FlowSync: Join Project' to add one."
      );
      return;
    }

    await vscode.env.clipboard.writeText(`${config.projectId}\n${token}`);
    await vscode.env.openExternal(vscode.Uri.parse(dashboardUrl));

    const reveal = "Show Project ID";
    const choice = await vscode.window.showInformationMessage(
      "FlowSync: Project ID and token copied to your clipboard — paste them into the dashboard login.",
      reveal
    );
    if (choice === reveal) {
      // Deliberately shows only the project ID. The token stays on the clipboard.
      vscode.window.showInformationMessage(`Project ID: ${config.projectId}`);
    }
  });
}
