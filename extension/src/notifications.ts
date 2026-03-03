import * as vscode from "vscode";

/**
 * Shows the post-push notification with "Add Context" and "Dismiss" buttons.
 *
 * When the developer clicks "Add Context":
 * 1. Opens Copilot Chat with a pre-filled prompt
 * 2. Copilot calls log_context via MCP to merge agent reasoning into the record
 *
 * When the developer clicks "Dismiss": nothing happens.
 * log_context is called at most once per push — never during iteration.
 */
export async function showPostPushNotification(
  branch: string,
  diff: string,
  gitUserName: string
): Promise<void> {
  const selection = await vscode.window.showInformationMessage(
    "FlowSync captured your push. Add reasoning?",
    "Add Context",
    "Dismiss"
  );

  if (selection === "Add Context") {
    openCopilotChatWithContext(branch, diff, gitUserName);
  }
}

/**
 * Opens Copilot Chat with a pre-filled prompt containing the push context.
 *
 * The prompt instructs Copilot to call the log_context MCP tool
 * with structured reasoning about what was decided, changed, and pending.
 */
function openCopilotChatWithContext(
  branch: string,
  diff: string,
  gitUserName: string
): void {
  // Truncate diff for the chat prompt (Copilot Chat has context limits)
  const truncatedDiff =
    diff.length > 10_000 ? diff.slice(0, 10_000) + "\n... (truncated)" : diff;

  // Extract a summary of changed files from the diff
  const changedFiles = [...truncatedDiff.matchAll(/^diff --git a\/.+ b\/(.+)$/gm)].map(
    (m) => `- ${m[1]}`
  );
  const filesSummary =
    changedFiles.length > 0
      ? `**Changed files (${changedFiles.length}):**\n${changedFiles.join("\n")}`
      : "";

  const prompt = [
    `## FlowSync — Push Detected on \`${branch}\``,
    "",
    ...(filesSummary ? [filesSummary, ""] : []),
    "**Full diff:**",
    "```diff",
    truncatedDiff,
    "```",
    "",
    `Call the FlowSync \`log_context\` MCP tool with your reasoning: what was decided, what changed, what is still pending, and any risks. Set the \`author\` field to "${gitUserName}".`,
  ].join("\n");

  // Use VS Code command to open Copilot Chat with the pre-filled prompt
  vscode.commands.executeCommand("workbench.action.chat.open", {
    query: prompt,
  });
}
