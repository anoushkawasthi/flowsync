import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { readConfig, writeConfig, getWorkspaceRoot } from "./config";
import { startHookListener, stopHookListener } from "./hookListener";
import { getDiff, getLastCommitInfo, getGitUserName } from "./gitUtils";
import { transmitEvent, CapturedEvent } from "./eventTransmitter";
import { showPostPushNotification } from "./notifications";
import { FlowSyncPanel } from "./panels/FlowSyncPanel";
import { initLogger, log } from "./logger";
import { registerCatchMeUpCommand, checkAndAutoTriggerCatchMeUp } from "./commands/catchMeUp";

export function activate(context: vscode.ExtensionContext) {
  const outputChannel = initLogger();
  outputChannel.show(false); // show panel without stealing focus

  log.sep();
  log.info("FlowSync extension activated");

  const config = readConfig();
  log.info("Workspace config", config ?? "no .flowsync.json found");

  const onAuthenticated = () => {
    log.step("onAuthenticated", "reading fresh config after init/join");
    const freshConfig = readConfig();
    if (freshConfig) {
      log.ok("onAuthenticated", `projectId=${freshConfig.projectId} port=${freshConfig.port}`);
      initializeForProject(context, freshConfig);
    } else {
      log.error("onAuthenticated", "readConfig returned null after init — .flowsync.json may not have been written");
    }
  };

  // Register the webview panel command
  context.subscriptions.push(
    vscode.commands.registerCommand("flowsync.openPanel", () => {
      const initialView = readConfig() ? "dashboard" : "welcome";
      FlowSyncPanel.createOrShow(
        context.extensionUri,
        context,
        onAuthenticated,
        initialView
      );
    })
  );

  // Register "Catch Me Up" command
  registerCatchMeUpCommand(context, context.extensionUri);

  // Register the chat command
  context.subscriptions.push(
    vscode.commands.registerCommand("flowsync.openChat", () => {
      FlowSyncPanel.createOrShow(
        context.extensionUri,
        context,
        onAuthenticated,
        "chat"
      );
    })
  );

  if (config) {
    log.step("activate", `found existing config, initializing for projectId=${config.projectId}`);
    initializeForProject(context, config);
    // Auto-trigger "Catch Me Up" if >4 hours since last seen
    checkAndAutoTriggerCatchMeUp(context, context.extensionUri);
  } else {
    log.info("activate", "no .flowsync.json — open FlowSync dashboard to initialize or join a project");
  }
}

async function initializeForProject(
  context: vscode.ExtensionContext,
  config: ReturnType<typeof readConfig> & object
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
              initializeForProject(context, freshConfig);
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
    vscode.window.setStatusBarMessage(`$(check) FlowSync connected on port ${actualPort}`, 8000);
  } else {
    log.ok("initializeForProject", `listener bound on port ${actualPort}`);
    vscode.window.setStatusBarMessage(`$(check) FlowSync connected (port ${actualPort})`, 8000);
  }
  updateHookPort(actualPort);
  log.info("initializeForProject", "ready — waiting for push events");
}

function updateHookPort(port: number): void {
  const workspaceRoot = getWorkspaceRoot();
  if (!workspaceRoot) { return; }
  const hooksDir = path.join(workspaceRoot, ".git", "hooks");
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
    },
  };

  log.step("handlePushEvent", `transmitting eventId=${event.eventId} to ${backendUrl}`);

  try {
    const result = await transmitEvent(backendUrl, apiToken, event);
    log.ok("handlePushEvent", `event transmitted successfully — response: ${JSON.stringify(result)}`);
    vscode.window.showInformationMessage(`FlowSync: push captured (${commitInfo.commitHash.slice(0, 8)})`);
    
    // Update "last seen" timestamp after successful push
    await context.globalState.update("flowsync.lastSeenTimestamp", new Date().toISOString());
  } catch (err) {
    log.error("handlePushEvent", `transmit failed after all retries: ${err instanceof Error ? err.message : String(err)}`);
    vscode.window.showWarningMessage("FlowSync: could not send push data to backend. Check Output panel.");
    return;
  }

  if (gitUserName) {
    await showPostPushNotification(branch, diff, gitUserName);
  }
}

export function deactivate() {
  log.info("FlowSync extension deactivated");
  stopHookListener();
}
