import * as vscode from "vscode";
import { readConfig, getWorkspaceRoot } from "../config";
import { getGitUserName } from "../gitUtils";
import { logContext } from "../api";
import { log } from "../logger";

/**
 * The human path to `log_context`, the only write tool.
 *
 * Until now it was reachable exclusively by an AI agent over MCP, which meant a
 * developer who wanted to record why they did something had no way to do it
 * short of asking their agent to do it for them. Same endpoint, same record —
 * just an input box instead of a tool call.
 */
export function registerRecordReasoningCommand(
  context: vscode.ExtensionContext,
  onLogged: () => void
): vscode.Disposable {
  return vscode.commands.registerCommand("flowsync.recordReasoning", async () => {
    const config = readConfig();
    if (!config) {
      vscode.window.showErrorMessage(
        "FlowSync: this workspace has no project. Run 'FlowSync: Initialize Project' first."
      );
      return;
    }

    const reasoning = await vscode.window.showInputBox({
      title: "FlowSync — record reasoning",
      prompt: "Why did you take this approach? What would a teammate not be able to infer from the code?",
      placeHolder:
        "Chose JWT over sessions because the API must stay stateless for horizontal scaling…",
      ignoreFocusOut: true,
      // The tool's own schema requires min(10); rejecting here beats a 400.
      validateInput: (value) => {
        const trimmed = value.trim();
        if (trimmed.length === 0) {
          return "Reasoning is required.";
        }
        if (trimmed.length < 10) {
          return "Give it at least 10 characters — this is the part code can't tell anyone.";
        }
        return undefined;
      },
    });
    if (!reasoning) {
      return; // cancelled
    }

    const decision = await vscode.window.showInputBox({
      title: "FlowSync — decision (optional)",
      prompt: "The key architectural or implementation decision, if there was one. Leave blank to skip.",
      ignoreFocusOut: true,
    });
    if (decision === undefined) {
      return;
    }

    const risk = await vscode.window.showInputBox({
      title: "FlowSync — risk (optional)",
      prompt: "Anything you want to flag as a concern. Leave blank to skip.",
      ignoreFocusOut: true,
    });
    if (risk === undefined) {
      return;
    }

    const tasksRaw = await vscode.window.showInputBox({
      title: "FlowSync — follow-up tasks (optional)",
      prompt: "Comma-separated. Leave blank to skip.",
      placeHolder: "add integration test, document the retry semantics",
      ignoreFocusOut: true,
    });
    if (tasksRaw === undefined) {
      return;
    }

    const tasks = tasksRaw
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const workspaceRoot = getWorkspaceRoot();
    const author = getGitUserName() || "unknown";
    const branch = currentBranch(workspaceRoot) || config.defaultBranch || "main";

    await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: "FlowSync: recording reasoning…" },
      async () => {
        try {
          const result = await logContext(
            {
              projectId: config.projectId,
              reasoning: reasoning.trim(),
              branch,
              author,
              decision: decision.trim() || undefined,
              risk: risk.trim() || undefined,
              tasks: tasks.length > 0 ? tasks : undefined,
            },
            config.backendUrl
          );

          log.ok("recordReasoning", `eventId=${result.eventId} action=${result.action}`);

          // "updated" means it merged into a push from the last 30 minutes, which
          // is worth saying out loud — otherwise people wonder where it went.
          vscode.window.showInformationMessage(
            result.action === "updated"
              ? `FlowSync: reasoning merged into your recent push on ${branch}.`
              : `FlowSync: reasoning recorded on ${branch}. It will bind to your next push.`
          );
          onLogged();
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          log.error("recordReasoning", message);
          vscode.window.showErrorMessage(
            `FlowSync: could not record reasoning. ${message}`
          );
        }
      }
    );
  });
}

function currentBranch(workspaceRoot: string | null | undefined): string | undefined {
  if (!workspaceRoot) {
    return undefined;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { execSync } = require("child_process");
    return (
      execSync("git branch --show-current", {
        cwd: workspaceRoot,
        encoding: "utf-8",
      }).trim() || undefined
    );
  } catch {
    return undefined;
  }
}
