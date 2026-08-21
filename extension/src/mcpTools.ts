import * as fs from "fs";
import * as path from "path";

/**
 * The agent-facing tool surface, described once.
 *
 * The webview is a separate Vite build and cannot import from src/, so this list
 * is posted to it over the message channel rather than duplicated there — a
 * second copy would drift the moment a tool is added or renamed.
 *
 * Names and purposes mirror the registrations in mcp-server/src/index.ts. If you
 * add a tool there, add it here.
 */

export type McpToolKind = "read" | "write";

export interface McpToolInfo {
  name: string;
  kind: McpToolKind;
  /** One line, phrased for a human deciding whether their agent will use it. */
  purpose: string;
}

export const MCP_TOOLS: McpToolInfo[] = [
  {
    name: "log_context",
    kind: "write",
    purpose:
      "Records the why behind a change — decisions, risks and follow-up tasks. Merges into a push from the last 30 minutes.",
  },
  {
    name: "search_context",
    kind: "read",
    purpose:
      "Answers a natural-language question about the project, grounded in captured context with source citations.",
  },
  {
    name: "get_project_context",
    kind: "read",
    purpose:
      "Returns recent context for a branch, newest first. Feature branches are merged with main.",
  },
  {
    name: "get_recent_changes",
    kind: "read",
    purpose:
      "Returns recent context across all branches, optionally filtered to changes after a timestamp.",
  },
  {
    name: "get_events",
    kind: "read",
    purpose: "Raw context records from the dashboard API. Requires the project token.",
  },
];

/* ─── wiring diagnostic ─── */

export type McpWiringState = "wired" | "missing" | "mismatched" | "unknown";

export interface McpWiring {
  state: McpWiringState;
  /** Human-readable explanation, shown directly in the sidebar. */
  detail: string;
  /** Where the config is expected, relative to the workspace. */
  configPath: string;
}

/**
 * Answers "will my agent actually reach BuildBerry?" by inspecting the
 * .vscode/mcp.json that writeMcpConfig (commands/initProject.ts) generates.
 *
 * A stale projectId here is a real and silent failure mode: the file exists, the
 * agent starts the server, and every call reads a different project.
 */
export function checkMcpWiring(
  // getWorkspaceRoot() returns null, not undefined.
  workspaceRoot: string | null | undefined,
  projectId: string | undefined
): McpWiring {
  const configPath = ".vscode/mcp.json";

  if (!workspaceRoot) {
    return { state: "unknown", detail: "No workspace folder open.", configPath };
  }

  const absolute = path.join(workspaceRoot, ".vscode", "mcp.json");
  if (!fs.existsSync(absolute)) {
    return {
      state: "missing",
      detail: "No .vscode/mcp.json — your agent cannot reach BuildBerry yet.",
      configPath,
    };
  }

  try {
    const raw = JSON.parse(fs.readFileSync(absolute, "utf-8")) as {
      servers?: Record<string, { env?: Record<string, string> }>;
    };
    const server = raw.servers?.flowsync;

    if (!server) {
      return {
        state: "missing",
        detail: "mcp.json exists but has no `flowsync` server entry.",
        configPath,
      };
    }

    const configuredProject = server.env?.FLOWSYNC_PROJECT_ID;
    if (projectId && configuredProject && configuredProject !== projectId) {
      return {
        state: "mismatched",
        detail: "mcp.json points at a different project. Re-run Initialize or Join.",
        configPath,
      };
    }

    return {
      state: "wired",
      detail: "Your agent can call all five tools.",
      configPath,
    };
  } catch {
    return {
      state: "mismatched",
      detail: "mcp.json could not be parsed.",
      configPath,
    };
  }
}
