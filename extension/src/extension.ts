import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { readConfig, writeConfig, getWorkspaceRoot } from "./config";
import { startHookListener, stopHookListener } from "./hookListener";
import { getDiff, getLastCommitInfo, getGitUserName, getMergeInfo } from "./gitUtils";
import { transmitEvent, CapturedEvent } from "./eventTransmitter";
import { showPostPushNotification } from "./notifications";
import { FlowSyncPanel } from "./panels/FlowSyncPanel";
import { initLogger, log } from "./logger";
import { registerCatchMeUpCommand, checkAndAutoTriggerCatchMeUp } from "./commands/catchMeUp";
import { registerInitCommand } from "./commands/initProject";
import { registerJoinCommand } from "./commands/joinProject";
import { FlowSyncSidebar } from "./panels/FlowSyncSidebar";

const CONFIG_SECTION = "flowsync";

/** Drives the `flowsync.connected` context key that the `when` clauses read. */
async function setConnectedContext(
  context: vscode.ExtensionContext
): Promise<boolean> {
  const config = readConfig();
  let connected = false;
  if (config) {
    const token = await context.secrets.get(`flowsync.token.${config.projectId}`);
    connected = Boolean(token);
  }
  await vscode.commands.executeCommand("setContext", "flowsync.connected", connected);
  return connected;
}

/**
 * The status bar item reflects connection state through a real ThemeColor rather
 * than only a codicon, and can be turned off entirely via settings.
 */
function applyStatusBar(item: vscode.StatusBarItem, connected: boolean): void {
  const enabled = vscode.workspace
    .getConfiguration(CONFIG_SECTION)
    .get<boolean>("statusBar.enabled", true);

  if (!enabled) {
    item.hide();
    return;
  }

  item.command = "flowsync.openPanel";
  item.text = connected ? "$(check) FlowSync" : "$(zap) FlowSync";
  item.tooltip = connected
    ? "FlowSync connected — click to open the dashboard"
    : "FlowSync — click to set up this project";
  item.backgroundColor = new vscode.ThemeColor(
    connected ? "flowsync.statusBarConnected" : "flowsync.statusBarDisconnected"
  );
  item.show();
}

export function activate(context: vscode.ExtensionContext) {
  const outputChannel = initLogger();
  // Opt-in. This used to run on every activation, which force-opened the Output
  // panel over whatever the user was looking at each time VS Code started.
  if (
    vscode.workspace
      .getConfiguration(CONFIG_SECTION)
      .get<boolean>("autoOpenOutput", false)
  ) {
    outputChannel.show(false);
  }

  log.sep();
  log.info("FlowSync extension activated");

  const statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    100
  );
  context.subscriptions.push(statusBarItem);
  applyStatusBar(statusBarItem, false);

  const config = readConfig();
  log.info("Workspace config", config ?? "no .flowsync.json found");

  // Declared before syncState/onAuthenticated so neither closes over a
  // binding that is still in its temporal dead zone.
  let sidebar: FlowSyncSidebar | undefined;

  const syncState = async () => {
    const connected = await setConnectedContext(context);
    applyStatusBar(statusBarItem, connected);
    sidebar?.refresh();
  };

  const onAuthenticated = () => {
    log.step("onAuthenticated", "reading fresh config after init/join");
    const freshConfig = readConfig();
    if (freshConfig) {
      log.ok("onAuthenticated", `projectId=${freshConfig.projectId} port=${freshConfig.port}`);
      initializeForProject(context, freshConfig, statusBarItem);
    } else {
      log.error("onAuthenticated", "readConfig returned null after init — .flowsync.json may not have been written");
    }
    void syncState();
  };

  // ── Activity-bar sidebar ─────────────────────────────────────────────────
  sidebar = new FlowSyncSidebar(context.extensionUri, context, onAuthenticated);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(FlowSyncSidebar.viewId, sidebar, {
      // Keep the React tree alive while the view is collapsed so reopening it
      // doesn't replay the whole mount + status round-trip.
      webviewOptions: { retainContextWhenHidden: true },
    })
  );

  const openPanel = (view?: string) =>
    FlowSyncPanel.createOrShow(
      context.extensionUri,
      context,
      onAuthenticated,
      view ?? (readConfig() ? "dashboard" : "welcome")
    );

  context.subscriptions.push(
    vscode.commands.registerCommand("flowsync.openPanel", () => openPanel()),
    vscode.commands.registerCommand("flowsync.openChat", () => openPanel("chat")),
    vscode.commands.registerCommand("flowsync.refresh", async () => {
      await syncState();
      vscode.window.setStatusBarMessage("$(check) FlowSync status refreshed", 3000);
    }),
    vscode.commands.registerCommand("flowsync.openOutput", () => {
      outputChannel.show(true);
    }),
    // Re-apply when the user toggles the status bar setting.
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(`${CONFIG_SECTION}.statusBar.enabled`)) {
        void syncState();
      }
    })
  );

  // Register "Catch Me Up" command
  registerCatchMeUpCommand(context, context.extensionUri);

  // These two were exported but never called, so `FlowSync: Initialize Project`
  // and `FlowSync: Join Project` were registered nowhere and their QuickPick
  // flows were unreachable dead code.
  context.subscriptions.push(
    registerInitCommand(context, onAuthenticated),
    registerJoinCommand(context, onAuthenticated)
  );

  void syncState();

  if (config) {
    log.step("activate", `found existing config, initializing for projectId=${config.projectId}`);
    initializeForProject(context, config, statusBarItem);
    // Auto-trigger "Catch Me Up" if >4 hours since last seen
    checkAndAutoTriggerCatchMeUp(context, context.extensionUri);
  } else {
    log.info("activate", "no .flowsync.json — open FlowSync dashboard to initialize or join a project");
  }
}

async function initializeForProject(
  context: vscode.ExtensionContext,
  config: ReturnType<typeof readConfig> & object,
  statusBarItem?: vscode.StatusBarItem
): Promise<void> {
  const { projectId, backendUrl, defaultBranch, port: preferredPort } = config;

  log.sep();
  log.step("initializeForProject", `projectId=${projectId} preferredPort=${preferredPort}`);

  log.step("initializeForProject", "checking SecretStorage for API token");
  const apiToken = await context.secrets.get(`flowsync.token.${projectId}`);
  if (!apiToken) {
    log.warn("initializeForProject", `no token in SecretStorage for key flowsync.token.${projectId} — prompting dashboard join flow`);
    vscode.window.showInformationMessage(
      "FlowSync project detected. Enter your API token to connect.",
      "Enter Token"
    ).then((selection: string | undefined) => {
      if (selection === "Enter Token") {
        FlowSyncPanel.createOrShow(
          context.extensionUri,
          context,
          () => {
            const freshConfig = readConfig();
            if (freshConfig) {
              initializeForProject(context, freshConfig, statusBarItem);
            }
          },
          "join"
        );
      }
    });
    return;
  }
  log.ok("initializeForProject", "API token found in SecretStorage");

  log.step("initializeForProject", `starting hook listener on preferred port ${preferredPort}`);
  const actualPort = await startHookListener(
    (branch: string, remoteRef?: string) => handlePushEvent(context, projectId, backendUrl, defaultBranch, apiToken, branch, remoteRef),
    preferredPort
  );

  if (actualPort !== preferredPort) {
    log.warn("initializeForProject", `port ${preferredPort} was taken, bound to ${actualPort} — updating .flowsync.json and hook script`);
    writeConfig({ projectId, backendUrl, defaultBranch, port: actualPort });
    if (statusBarItem) {
      statusBarItem.text = `$(check) FlowSync`;
      statusBarItem.tooltip = `FlowSync connected — click to open panel`;
    }
    vscode.window.setStatusBarMessage(`$(check) FlowSync connected on port ${actualPort}`, 8000);
  } else {
    log.ok("initializeForProject", `listener bound on port ${actualPort}`);
    if (statusBarItem) {
      statusBarItem.text = `$(check) FlowSync`;
      statusBarItem.tooltip = `FlowSync connected — click to open panel`;
    }
    vscode.window.setStatusBarMessage(`$(check) FlowSync connected (port ${actualPort})`, 8000);
  }
  updateHookPort(actualPort);
  log.info("initializeForProject", "ready — waiting for push events");
}

function updateHookPort(port: number): void {
  const workspaceRoot = getWorkspaceRoot();
  if (!workspaceRoot) { return; }
  // Never create a .git directory — only update if it already exists
  const gitDir = path.join(workspaceRoot, ".git");
  if (!fs.existsSync(gitDir)) { return; }
  const hooksDir = path.join(gitDir, "hooks");
  const hookPath = path.join(hooksDir, "pre-push");
  const existed = fs.existsSync(hookPath);
  if (!fs.existsSync(hooksDir)) {
    fs.mkdirSync(hooksDir, { recursive: true });
  }
  const content = `#!/bin/sh\n# FlowSync — notify local listener of push\nREMOTE_SHA=""\nwhile read local_ref local_sha remote_ref remote_sha; do\n  REMOTE_SHA="$remote_sha"\ndone\nBRANCH=$(git branch --show-current)\ncurl -s http://localhost:${port}/flowsync-hook \\\n  --data "{\\"event\\":\\"push\\",\\"branch\\":\\"$BRANCH\\",\\"remoteRef\\":\\"$REMOTE_SHA\\"}" &\n`;
  fs.writeFileSync(hookPath, content, { mode: 0o755 });
  log.ok("updateHookPort", `hook script ${existed ? "updated" : "created"} at ${hookPath} for port ${port}`);
}

async function handlePushEvent(
  context: vscode.ExtensionContext,
  projectId: string,
  backendUrl: string,
  defaultBranch: string,
  apiToken: string,
  branch: string,
  remoteRef?: string
): Promise<void> {
  log.sep();
  log.step("handlePushEvent", `push signal received on branch=${branch} remoteRef=${remoteRef ?? "none"}`);

  log.step("handlePushEvent", "computing diff");
  const diff = getDiff(remoteRef);
  const mergeInfo = getMergeInfo();
  if (mergeInfo.isMerge) {
    log.ok("handlePushEvent", `merge commit — sourceBranch=${mergeInfo.sourceBranch ?? "unknown"} → ${branch}`);
  }
  log.step("handlePushEvent", "running git log for commit info");
  const commitInfo = getLastCommitInfo();
  const gitUserName = getGitUserName();

  if (!diff) {
    log.error("handlePushEvent", "getDiff() returned null — git diff failed or repo has no commits");
  }
  if (!commitInfo) {
    log.error("handlePushEvent", "getLastCommitInfo() returned null — git log failed or format parse error");
  }
  if (!diff || !commitInfo) {
    vscode.window.showWarningMessage("FlowSync: could not read git data. Check Output panel for details.");
    return;
  }

  log.ok("handlePushEvent", `commit=${commitInfo.commitHash.slice(0, 8)} author="${commitInfo.author}" message="${commitInfo.message}" diffLen=${diff.length}`);

  const event: CapturedEvent = {
    eventId: crypto.randomUUID(),
    projectId,
    eventType: "push",
    timestamp: new Date().toISOString(),
    branch,
    payload: {
      commitHash: commitInfo.commitHash,
      message: commitInfo.message,
      diff,
      author: commitInfo.author,
      parentBranch: defaultBranch !== branch ? defaultBranch : undefined,
      isMerge: mergeInfo.isMerge || undefined,
      sourceBranch: mergeInfo.isMerge && mergeInfo.sourceBranch ? mergeInfo.sourceBranch : undefined,
    },
  };

  log.step("handlePushEvent", `transmitting eventId=${event.eventId} to ${backendUrl}`);

  try {
    const result = await transmitEvent(backendUrl, apiToken, event);
    log.ok("handlePushEvent", `event transmitted successfully — response: ${JSON.stringify(result)}`);
    vscode.window.showInformationMessage(`FlowSync: push captured (${commitInfo.commitHash.slice(0, 8)})`);
  } catch (err) {
    log.error("handlePushEvent", `transmit failed after all retries: ${err instanceof Error ? err.message : String(err)}`);
    vscode.window.showWarningMessage("FlowSync: could not send push data to backend. Check Output panel.");
    return;
  }

  const notifyOnPush = vscode.workspace
    .getConfiguration("flowsync")
    .get<boolean>("showPushNotification", true);

  if (gitUserName && notifyOnPush) {
    await showPostPushNotification(branch, diff, gitUserName);
  }
}

export function deactivate() {
  log.info("FlowSync extension deactivated");
  stopHookListener();
}
