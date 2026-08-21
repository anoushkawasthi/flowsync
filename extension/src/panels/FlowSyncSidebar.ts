import * as vscode from "vscode";
import { readConfig, getWorkspaceRoot } from "../config";
import { buildWebviewHtml, webviewResourceRoots } from "./webviewHtml";
import { FlowSyncPanel } from "./FlowSyncPanel";
import { fetchEvents, fetchProjectInfo, BackendError, type ContextRecord } from "../api";
import { MCP_TOOLS, checkMcpWiring, type McpWiring, type McpToolInfo } from "../mcpTools";
import { log } from "../logger";

/** Everything the Project Context view renders, in one message. */
interface SidebarData {
  connected: boolean;
  projectId?: string;
  projectName?: string;
  branch?: string;
  counts: { events: number; risks: number; tasks: number; authors: number };
  risks: Array<{ text: string; author: string; feature: string }>;
  tasks: string[];
  recent: Array<{
    eventId: string;
    feature: string;
    stage: string;
    author: string;
    extractedAt: string;
    hasRisk: boolean;
  }>;
  tools: McpToolInfo[];
  wiring: McpWiring;
  /** Set when the fetch failed, so the view can say so instead of looking empty. */
  error?: string;
}

const RECENT_LIMIT = 25;

/**
 * The activity-bar sidebar. A WebviewView rather than a TreeView: a TreeView
 * renders VS Code's own list chrome and cannot show this design at all, whereas
 * a webview view reuses the exact React bundle the panel already loads, just at
 * a narrower breakpoint.
 *
 * It used to post only local config — projectId, branch, port, backendUrl — and
 * made no network call at all, which is why the view read as empty. It now
 * fetches the project's actual context and leads with what needs attention.
 *
 * Multi-step flows (initialize, join) and long transcripts (chat, catch-up) still
 * hand off to the full editor panel, which has the room for them.
 */
export class FlowSyncSidebar implements vscode.WebviewViewProvider {
  public static readonly viewId = "flowsync.sidebar";

  private _view?: vscode.WebviewView;
  private _loading = false;

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

    // Re-sync when the view becomes visible again — context may have changed
    // while it was collapsed.
    view.onDidChangeVisibility(() => {
      if (view.visible) {
        void this._send();
      }
    });
  }

  /** Re-fetch and repaint. Called after init/join, a push, or a manual refresh. */
  public refresh(): void {
    void this._send();
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
        this._post({ type: "navigate", view: "sidebar" });
        await this._send();
        break;

      case "requestSidebarData":
      case "refreshStatus":
      case "requestStatus":
        await this._send();
        break;

      // Anything needing room opens the editor panel rather than trying to render
      // a wizard or a transcript in a 300px rail.
      case "openPanelView":
        this._openPanel(String(message.view ?? "dashboard"));
        break;

      case "navigate": {
        const view = String(message.view ?? "dashboard");
        if (view !== "sidebar") {
          this._openPanel(view);
        }
        break;
      }

      case "runCommand": {
        const command = String(message.command ?? "");
        // Allow-list: the webview must not be able to invoke arbitrary commands.
        const allowed = new Set([
          "flowsync.catchMeUp",
          "flowsync.openChat",
          "flowsync.openPanel",
          "flowsync.openOutput",
          "flowsync.openWebDashboard",
          "flowsync.recordReasoning",
          "flowsync.refresh",
        ]);
        if (allowed.has(command)) {
          await vscode.commands.executeCommand(command);
        } else {
          log.warn("FlowSyncSidebar", `blocked command from webview: ${command}`);
        }
        break;
      }

      default:
        log.info("FlowSyncSidebar", `unhandled message type: ${String(message.type)}`);
    }
  }

  private _post(message: unknown): void {
    void this._view?.webview.postMessage(message);
  }

  private async _send(): Promise<void> {
    if (!this._view) {
      return;
    }
    // Visibility flips and pushes can both fire while a fetch is in flight.
    if (this._loading) {
      return;
    }
    this._loading = true;

    try {
      this._post({ type: "sidebarData", data: await this._build() });
    } finally {
      this._loading = false;
    }
  }

  private async _build(): Promise<SidebarData> {
    const workspaceRoot = getWorkspaceRoot();
    const config = readConfig();
    const empty: SidebarData = {
      connected: false,
      counts: { events: 0, risks: 0, tasks: 0, authors: 0 },
      risks: [],
      tasks: [],
      recent: [],
      tools: MCP_TOOLS,
      wiring: checkMcpWiring(workspaceRoot, config?.projectId),
    };

    if (!config) {
      return empty;
    }

    const token = await this._context.secrets.get(
      `flowsync.token.${config.projectId}`
    );
    if (!token) {
      return { ...empty, projectId: config.projectId };
    }

    const base = { ...empty, connected: true, projectId: config.projectId };

    try {
      // Project info is nice-to-have (it gives a real name instead of a UUID), so
      // a failure there must not blank out the context we did manage to fetch.
      const [events, info] = await Promise.all([
        fetchEvents(config.projectId, token, {
          limit: RECENT_LIMIT,
          baseUrl: config.backendUrl,
        }),
        fetchProjectInfo(config.projectId, token, config.backendUrl).catch(() => undefined),
      ]);

      return {
        ...base,
        projectName: info?.name,
        branch: config.defaultBranch,
        ...rollUp(events),
      };
    } catch (err) {
      const message =
        err instanceof BackendError
          ? err.isAuthFailure
            ? "Your API token was rejected. Re-run 'BuildBerry: Join Project'."
            : `Backend returned ${err.status}.`
          : err instanceof Error
            ? err.message
            : String(err);

      log.error("FlowSyncSidebar", `context fetch failed: ${message}`);
      return { ...base, branch: config.defaultBranch, error: message };
    }
  }
}

/**
 * Counts, open risks, pending tasks and recent entries, derived from the events
 * array. There is no aggregate endpoint on the backend, so every surface computes
 * this client-side; this mirrors `aggregateEvents` in commands/catchMeUp.ts but
 * keeps only what a narrow rail can show.
 */
function rollUp(events: ContextRecord[]): Pick<
  SidebarData,
  "counts" | "risks" | "tasks" | "recent"
> {
  const authors = new Set<string>();
  const seenTasks = new Set<string>();
  const seenRisks = new Set<string>();
  const risks: SidebarData["risks"] = [];
  const tasks: string[] = [];

  for (const evt of events) {
    authors.add(evt.author);

    if (evt.risk && !seenRisks.has(evt.risk)) {
      seenRisks.add(evt.risk);
      risks.push({ text: evt.risk, author: evt.author, feature: evt.feature });
    }

    for (const task of evt.tasks ?? []) {
      if (!seenTasks.has(task)) {
        seenTasks.add(task);
        tasks.push(task);
      }
    }
  }

  return {
    counts: {
      events: events.length,
      risks: risks.length,
      tasks: tasks.length,
      authors: authors.size,
    },
    risks,
    tasks,
    recent: events.map((evt) => ({
      eventId: evt.eventId,
      feature: evt.feature,
      stage: evt.stage,
      author: evt.author,
      extractedAt: evt.extractedAt,
      hasRisk: Boolean(evt.risk),
    })),
  };
}
