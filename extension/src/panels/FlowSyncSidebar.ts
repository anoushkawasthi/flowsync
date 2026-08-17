import * as vscode from "vscode";
import { readConfig, BASE_PORT } from "../config";
import { buildWebviewHtml, webviewResourceRoots } from "./webviewHtml";
import { FlowSyncPanel } from "./FlowSyncPanel";
import { log } from "../logger";

/**
 * The activity-bar sidebar. A WebviewView rather than a TreeView: a TreeView
 * renders VS Code's own list chrome and cannot show this design at all, whereas
 * a webview view reuses the exact React bundle the panel already loads, just at
 * a narrower breakpoint.
 *
 * Scope is deliberately narrow. The sidebar answers "is FlowSync connected, and
 * what can I do right now"; anything with a multi-step form (initialize, join)
 * or a long transcript (chat, catch-up) hands off to the full editor panel,
 * which has the room for it. That also means this class doesn't have to
 * duplicate the panel's ~450 lines of backend handlers.
 */
export class FlowSyncSidebar implements vscode.WebviewViewProvider {
  public static readonly viewId = "flowsync.sidebar";

  private _view?: vscode.WebviewView;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _context: vscode.ExtensionContext,
    private readonly _onAuthenticated: () => void
  ) {}

  public resolveWebviewView(view: vscode.WebviewView): void {
    this._view = view;

    view.webview.options = {
      enableScripts: true,
      localResourceRoots: webviewResourceRoots(this._extensionUri),
    };
    view.webview.html = buildWebviewHtml(view.webview, this._extensionUri);

    view.webview.onDidReceiveMessage((msg) => this._handleMessage(msg));

    // Re-sync whenever the view becomes visible again — status may have changed
    // while it was collapsed.
    view.onDidChangeVisibility(() => {
      if (view.visible) {
        this._sendStatus();
      }
    });
  }

  /** Nudge the sidebar to re-read config, e.g. after init/join completes. */
  public refresh(): void {
    this._sendStatus();
  }

  private _openPanel(initialView: string): void {
    FlowSyncPanel.createOrShow(
      this._extensionUri,
      this._context,
      this._onAuthenticated,
      initialView
    );
  }

  private async _handleMessage(message: Record<string, unknown>): Promise<void> {
    switch (message.type) {
      case "ready":
        // Land straight on the status view; the panel handles onboarding flows.
        this._post({ type: "navigate", view: "dashboard" });
        await this._sendStatus();
        break;

      case "requestStatus":
      case "refreshStatus":
        await this._sendStatus();
        break;

      // Anything that needs room opens the editor panel instead of trying to
      // render a wizard in a 300px rail.
      case "navigate": {
        const view = String(message.view ?? "dashboard");
        if (view !== "dashboard") {
          this._openPanel(view);
        }
        break;
      }

      case "openOutput":
        vscode.commands.executeCommand("flowsync.openOutput");
        break;

      case "requestCatchUpData":
        vscode.commands.executeCommand("flowsync.catchMeUp");
        break;

      default:
        log.info("FlowSyncSidebar", `unhandled message type: ${String(message.type)}`);
    }
  }

  private _post(message: unknown): void {
    void this._view?.webview.postMessage(message);
  }

  private async _sendStatus(): Promise<void> {
    const config = readConfig();
    if (!config) {
      this._post({ type: "status", data: { connected: false } });
      return;
    }

    const token = await this._context.secrets.get(
      `flowsync.token.${config.projectId}`
    );

    this._post({
      type: "status",
      data: {
        connected: Boolean(token),
        projectId: config.projectId,
        defaultBranch: config.defaultBranch,
        port: config.port ?? BASE_PORT,
        backendUrl: config.backendUrl,
      },
    });
  }
}
