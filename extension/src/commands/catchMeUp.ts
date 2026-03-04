import * as vscode from "vscode";
import * as https from "https";
import { readConfig, getWorkspaceRoot } from "../config";
import { log } from "../logger";
import { FlowSyncPanel } from "../panels/FlowSyncPanel";

const BACKEND_URL = "https://86tzell2w9.execute-api.us-east-1.amazonaws.com/prod";

interface EventSummary {
  eventId: string;
  author: string;
  feature: string;
  decision: string | null;
  tasks: string[];
  risk: string | null;
  stage: string;
  branch: string;
  extractedAt: string;
  commitHash: string | null;
}

interface CatchUpData {
  totalEvents: number;
  authors: Set<string>;
  decisions: Array<{ text: string; commitHash: string; author: string }>;
  risks: Array<{ text: string; commitHash: string; author: string }>;
  tasks: string[];
  branches: Set<string>;
  currentBranchEvents: number;
  otherBranchesEvents: number;
  hoursSince: number;
  isFirstTime: boolean;
  canViewRecent: boolean; // Can user view recent activity even with no new changes
}

/**
 * "Catch Me Up" command — summarize changes since last seen timestamp.
 */
export async function registerCatchMeUpCommand(
  context: vscode.ExtensionContext,
  extensionUri: vscode.Uri
): Promise<void> {
  context.subscriptions.push(
    vscode.commands.registerCommand("flowsync.catchMeUp", async () => {
      await runCatchMeUp(context, extensionUri, false);
    })
  );
}

/**
 * Run the catch-me-up logic. Can be invoked manually or auto-triggered.
 */
export async function runCatchMeUp(
  context: vscode.ExtensionContext,
  extensionUri: vscode.Uri,
  isAutoTrigger: boolean,
  forceRecent: boolean = false
): Promise<void> {
  const workspaceRoot = getWorkspaceRoot();
  if (!workspaceRoot) {
    if (!isAutoTrigger) {
      vscode.window.showErrorMessage("FlowSync: No workspace folder open.");
    }
    return;
  }

  const config = readConfig();
  if (!config) {
    if (!isAutoTrigger) {
      vscode.window.showErrorMessage(
        "FlowSync: Project not initialized. Run 'FlowSync: Initialize Project' first."
      );
    }
    return;
  }

  const apiToken = await context.secrets.get(`flowsync.token.${config.projectId}`);
  if (!apiToken) {
    if (!isAutoTrigger) {
      vscode.window.showErrorMessage("FlowSync: API token not found.");
    }
    return;
  }

  const lastSeen = context.globalState.get<string>("flowsync.lastSeenTimestamp");
  
  // If forceRecent, always use last 24 hours
  // Otherwise, use lastSeen if available, or fall back to last 24 hours
  const since = forceRecent || !lastSeen 
    ? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    : lastSeen;
  
  const hoursSince = forceRecent || !lastSeen
    ? 24
    : (Date.now() - new Date(lastSeen).getTime()) / (1000 * 60 * 60);
  
  // Don't auto-trigger if less than 4 hours (only applies when we have a real timestamp)
  if (isAutoTrigger && lastSeen && hoursSince < 4 && !forceRecent) {
    return;
  }

  log.step("catchMeUp", `Fetching changes since ${since} (${hoursSince.toFixed(1)}h ago)${forceRecent ? " [force recent]" : ""}`);

  try {
    const events = await fetchEventsSince(config.projectId, since, apiToken);
    
    if (events.length === 0) {
      // Even with no events, show panel with empty state
      const emptyData: CatchUpData = {
        totalEvents: 0,
        authors: new Set<string>(),
        decisions: [],
        risks: [],
        tasks: [],
        branches: new Set<string>(),
        currentBranchEvents: 0,
        otherBranchesEvents: 0,
        hoursSince,
        isFirstTime: !lastSeen,
        canViewRecent: !forceRecent && !!lastSeen, // Only offer if we have timestamp and haven't forced
      };
      
      if (!isAutoTrigger) {
        showCatchUpPanel(context, extensionUri, emptyData);
      } else {
        // For auto-trigger, just log
        log.info("catchMeUp", "No new changes since last check.");
      }
      return;
    }

    const data = aggregateEvents(events, workspaceRoot, hoursSince, !lastSeen, !forceRecent && !!lastSeen);
    
    // Show the catch-up panel
    showCatchUpPanel(context, extensionUri, data);
    
    // Update timestamp after showing (but not if forceRecent - we don't want to reset the checkpoint)
    if (!forceRecent) {
      await context.globalState.update("flowsync.lastSeenTimestamp", new Date().toISOString());
    }
  } catch (err) {
    log.error("catchMeUp", `Failed to fetch changes: ${err}`);
    if (!isAutoTrigger) {
      vscode.window.showErrorMessage(`FlowSync: Failed to fetch changes — ${err}`);
    }
  }
}

/**
 * Fetch events from backend since a given timestamp.
 */
async function fetchEventsSince(
  projectId: string,
  since: string,
  apiToken: string
): Promise<EventSummary[]> {
  const url = `${BACKEND_URL}/api/v1/projects/${projectId}/events?since=${encodeURIComponent(since)}&limit=50`;
  
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        "Authorization": `Bearer ${apiToken}`,
        "Accept": "application/json",
      },
    }, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
        try {
          const parsed = JSON.parse(data);
          resolve(parsed.events || []);
        } catch (err) {
          reject(err);
        }
      });
    });
    req.on("error", reject);
    req.end();
  });
}

/**
 * Aggregate events into a summary structure.
 */
function aggregateEvents(
  events: EventSummary[],
  workspaceRoot: string,
  hoursSince: number,
  isFirstTime: boolean,
  canViewRecent: boolean
): CatchUpData {
  const authors = new Set<string>();
  const branches = new Set<string>();
  const decisions: Array<{ text: string; commitHash: string; author: string }> = [];
  const risks: Array<{ text: string; commitHash: string; author: string }> = [];
  const tasksSet = new Set<string>();
  
  // Get current branch
  let currentBranch = "main";
  try {
    const { execSync } = require("child_process");
    currentBranch = execSync("git branch --show-current", {
      cwd: workspaceRoot,
      encoding: "utf-8",
    }).trim() || "main";
  } catch {
    // ignore
  }

  let currentBranchEvents = 0;
  let otherBranchesEvents = 0;

  for (const evt of events) {
    authors.add(evt.author);
    branches.add(evt.branch);
    
    if (evt.branch === currentBranch) {
      currentBranchEvents++;
    } else {
      otherBranchesEvents++;
    }

    if (evt.decision) {
      decisions.push({
        text: evt.decision,
        commitHash: evt.commitHash || "uncommitted",
        author: evt.author,
      });
    }

    if (evt.risk) {
      risks.push({
        text: evt.risk,
        commitHash: evt.commitHash || "uncommitted",
        author: evt.author,
      });
    }

    for (const task of evt.tasks) {
      tasksSet.add(task);
    }
  }

  return {
    totalEvents: events.length,
    authors,
    decisions,
    risks,
    tasks: Array.from(tasksSet),
    branches,
    currentBranchEvents,
    otherBranchesEvents,
    hoursSince,
    isFirstTime,
    canViewRecent,
  };
}

/**
 * Show catch-up data in the webview panel.
 */
function showCatchUpPanel(
  context: vscode.ExtensionContext,
  extensionUri: vscode.Uri,
  data: CatchUpData
): void {
  const timeStr = data.hoursSince < 24
    ? `${Math.round(data.hoursSince)} hours`
    : `${Math.round(data.hoursSince / 24)} days`;

  // Log summary to output channel for reference
  log.sep();
  log.info("Catch Me Up", data.isFirstTime 
    ? `Recent activity (last ${Math.round(data.hoursSince)} hours):`
    : `Since you last checked (${timeStr} ago):`
  );
  log.info("catchMeUp", `${data.totalEvents} events by ${data.authors.size} author(s)`);
  
  if (data.decisions.length > 0) {
    log.info("catchMeUp", "\nDecisions:");
    for (const dec of data.decisions) {
      log.info("catchMeUp", `  • ${dec.text} (${dec.author}, ${dec.commitHash.slice(0, 7)})`);
    }
  }
  if (data.risks.length > 0) {
    log.info("catchMeUp", "\nRisks:");
    for (const risk of data.risks) {
      log.info("catchMeUp", `  • ${risk.text} (${risk.author}, ${risk.commitHash.slice(0, 7)})`);
    }
  }

  // Convert Sets to arrays for JSON serialization
  const serializedData = {
    ...data,
    authors: Array.from(data.authors),
    branches: Array.from(data.branches),
  };

  // Open the panel and send data
  FlowSyncPanel.createOrShow(extensionUri, context, () => {}, "catchmeup");
  
  // Send the data after a short delay to ensure the panel is ready
  setTimeout(() => {
    if (FlowSyncPanel.currentPanel) {
      FlowSyncPanel.currentPanel.sendCatchUpData(serializedData);
    }
  }, 500);
}

/**
 * Check if we should auto-trigger catch-me-up on workspace activation.
 * Call this from extension.ts activate().
 */
export async function checkAndAutoTriggerCatchMeUp(
  context: vscode.ExtensionContext,
  extensionUri: vscode.Uri
): Promise<void> {
  const lastSeen = context.globalState.get<string>("flowsync.lastSeenTimestamp");
  if (!lastSeen) {
    return; // No timestamp yet
  }

  const hoursSince = (Date.now() - new Date(lastSeen).getTime()) / (1000 * 60 * 60);
  if (hoursSince >= 4) {
    // Delay slightly so extension fully activates first
    setTimeout(() => {
      runCatchMeUp(context, extensionUri, true);
    }, 2000);
  }
}
