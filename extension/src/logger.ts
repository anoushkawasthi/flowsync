import * as vscode from "vscode";

/**
 * Centralized logger — writes to VS Code Output panel ("FlowSync") AND console.
 * View logs: View → Output → select "FlowSync" from the dropdown.
 */
let channel: vscode.OutputChannel | null = null;

export function initLogger(): vscode.OutputChannel {
  if (!channel) {
    channel = vscode.window.createOutputChannel("FlowSync");
  }
  return channel;
}

function ts(): string {
  return new Date().toISOString().replace("T", " ").slice(0, 23);
}

export const log = {
  info(msg: string, ...data: unknown[]): void {
    const line = data.length
      ? `[${ts()}] INFO  ${msg} ${data.map((d) => JSON.stringify(d, null, 0)).join(" ")}`
      : `[${ts()}] INFO  ${msg}`;
    channel?.appendLine(line);
    console.log(line);
  },

  warn(msg: string, ...data: unknown[]): void {
    const line = data.length
      ? `[${ts()}] WARN  ${msg} ${data.map((d) => JSON.stringify(d, null, 0)).join(" ")}`
      : `[${ts()}] WARN  ${msg}`;
    channel?.appendLine(line);
    console.warn(line);
  },

  error(msg: string, ...data: unknown[]): void {
    const line = data.length
      ? `[${ts()}] ERROR ${msg} ${data.map((d) => (d instanceof Error ? d.stack ?? d.message : JSON.stringify(d, null, 0))).join(" ")}`
      : `[${ts()}] ERROR ${msg}`;
    channel?.appendLine(line);
    console.error(line);
  },

  step(step: string, detail?: string): void {
    const line = detail
      ? `[${ts()}] STEP  ▶ ${step} — ${detail}`
      : `[${ts()}] STEP  ▶ ${step}`;
    channel?.appendLine(line);
    console.log(line);
  },

  ok(step: string, detail?: string): void {
    const line = detail
      ? `[${ts()}] OK    ✓ ${step} — ${detail}`
      : `[${ts()}] OK    ✓ ${step}`;
    channel?.appendLine(line);
    console.log(line);
  },

  sep(): void {
    const line = `[${ts()}] ${"─".repeat(60)}`;
    channel?.appendLine(line);
    console.log(line);
  },
};
