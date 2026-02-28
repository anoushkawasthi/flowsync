import * as vscode from "vscode";
import { readConfig } from "./config";
import { startHookListener, stopHookListener } from "./hookListener";
import { getDiff, getLastCommitInfo, getCurrentBranch, getGitUserName } from "./gitUtils";
import { transmitEvent, CapturedEvent } from "./eventTransmitter";
import { showPostPushNotification } from "./notifications";
import { registerInitCommand } from "./commands/initProject";

/**
 * Called when the extension activates.
 * Activation triggers:
 * - workspaceContains:.flowsync.json (auto, on workspace open)
 * - flowsync.initProject command (manual, from command palette)
 */
export function activate(context: vscode.ExtensionContext) {
  console.log("FlowSync extension activated");

  // Register commands
  context.subscriptions.push(registerInitCommand(context));

  // Check if this workspace has a FlowSync project
  const config = readConfig();
  if (config) {
    initializeForProject(context, config.projectId, config.backendUrl, config.defaultBranch);
  }
}

/**
 * Sets up the extension for a connected FlowSync project.
 * Starts the hook listener and handles incoming push events.
 */
async function initializeForProject(
  context: vscode.ExtensionContext,
  projectId: string,
  backendUrl: string,
  defaultBranch: string
): Promise<void> {
  // Retrieve API token from SecretStorage
  const apiToken = await context.secrets.get(`flowsync.token.${projectId}`);
  if (!apiToken) {
    // No token stored — prompt the join flow
    vscode.window.showInformationMessage(
      "FlowSync project detected. Enter your API token to connect.",
      "Enter Token"
    ).then((selection) => {
      if (selection === "Enter Token") {
        vscode.commands.executeCommand("flowsync.joinProject");
      }
    });
    return;
  }

  // Start the local HTTP listener for post-push hook signals
  startHookListener((branch: string) => {
    handlePushEvent(context, projectId, backendUrl, defaultBranch, apiToken, branch);
  });

  vscode.window.setStatusBarMessage("$(check) FlowSync connected", 5000);
}

/**
 * Handles an incoming push event from the git hook.
 *
 * Flow:
 * 1. Capture diff + commit metadata from git
 * 2. POST to backend ingestion endpoint (with retry)
 * 3. Show "Add reasoning?" notification
 */
async function handlePushEvent(
  _context: vscode.ExtensionContext,
  projectId: string,
  backendUrl: string,
  defaultBranch: string,
  apiToken: string,
  branch: string
): Promise<void> {
  // Capture git data
  const diff = getDiff();
  const commitInfo = getLastCommitInfo();
  const gitUserName = getGitUserName();

  if (!diff || !commitInfo) {
    console.warn("FlowSync: could not capture git data for push");
    return;
  }

  // Build the event payload
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

  // Transmit to backend
  try {
    await transmitEvent(backendUrl, apiToken, event);
    console.log(`FlowSync: event ${event.eventId} transmitted`);
  } catch (err) {
    console.error("FlowSync: failed to transmit event", err);
    vscode.window.showWarningMessage(
      "FlowSync: could not send push data to backend. Will retry later."
    );
    // TODO: persist to globalState for manual retry
    return;
  }

  // Show post-push notification
  if (gitUserName) {
    await showPostPushNotification(branch, diff, gitUserName);
  }
}

/**
 * Called when the extension deactivates. Clean up resources.
 */
export function deactivate() {
  stopHookListener();
}

