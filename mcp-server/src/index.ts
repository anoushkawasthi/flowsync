#!/usr/bin/env node
/**
 * FlowSync MCP Server
 *
 * Exposes FlowSync project context as MCP tools for GitHub Copilot.
 * Wraps the FlowSync API Gateway — all heavy lifting (Bedrock RAG, DynamoDB)
 * happens in the existing Lambdas.
 *
 * Configuration (env vars or .vscode/mcp.json):
 *   FLOWSYNC_API_URL      API Gateway base URL (no trailing slash)
 *   FLOWSYNC_PROJECT_ID   Default project ID — used when tool caller omits it
 *   FLOWSYNC_TOKEN        Bearer token for authenticated endpoints (GET /events, POST /query)
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// ── Config ────────────────────────────────────────────────────────────────────

const API_URL =
  process.env.FLOWSYNC_API_URL ??
  "https://86tzell2w9.execute-api.us-east-1.amazonaws.com/prod";

const DEFAULT_PROJECT_ID = process.env.FLOWSYNC_PROJECT_ID ?? "";
const TOKEN = process.env.FLOWSYNC_TOKEN ?? "";

// ── HTTP helper ───────────────────────────────────────────────────────────────

async function callMcp(
  tool: string,
  params: Record<string, unknown>
): Promise<unknown> {
  const res = await fetch(`${API_URL}/mcp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tool, params }),
  });
  const data = (await res.json()) as unknown;
  if (!res.ok) {
    const err = data as Record<string, string>;
    throw new Error(err.message ?? `HTTP ${res.status}`);
  }
  return data;
}

async function callQuery(
  path: string,
  method: "GET" | "POST",
  body?: Record<string, unknown>,
  query?: Record<string, string>
): Promise<unknown> {
  const url = new URL(`${API_URL}${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  }
  const res = await fetch(url.toString(), {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await res.json()) as unknown;
  if (!res.ok) {
    const err = data as Record<string, string>;
    throw new Error(err.message ?? `HTTP ${res.status}`);
  }
  return data;
}

function toText(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

// ── Server ────────────────────────────────────────────────────────────────────

const server = new McpServer({
  name: "flowsync",
  version: "1.0.0",
});

// ── Tool 1: get_project_context ───────────────────────────────────────────────

server.tool(
  "get_project_context",
  "Get AI-extracted context records for a branch. " +
    "Call this at the start of any work session to understand what has been built, " +
    "what decisions were made, outstanding tasks, and risks. " +
    "Returns records newest-first. Feature branch records are merged with main branch context. " +
    "Use limit and nextToken for pagination to access deeper history.",
  {
    projectId: z
      .string()
      .optional()
      .describe(
        `Project ID. Defaults to ${DEFAULT_PROJECT_ID || "FLOWSYNC_PROJECT_ID env var"}`
      ),
    branch: z
      .string()
      .default("main")
      .describe("Branch name, e.g. 'main' or 'feature/auth'"),
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .default(10)
      .describe("Number of records to return (1-50, default 10)"),
    nextToken: z
      .string()
      .optional()
      .describe("Pagination cursor returned from a previous call to get more history"),
  },
  async ({ projectId, branch, limit, nextToken }) => {
    const pid = projectId ?? DEFAULT_PROJECT_ID;
    if (!pid) {
      return {
        isError: true,
        content: [
          {
            type: "text" as const,
            text: "projectId is required. Pass it explicitly or set FLOWSYNC_PROJECT_ID.",
          },
        ],
      };
    }
    try {
      const data = await callMcp("get_project_context", {
        projectId: pid,
        branch,
        limit,
        ...(nextToken ? { nextToken } : {}),
      });
      return { content: [{ type: "text" as const, text: toText(data) }] };
    } catch (err) {
      return {
        isError: true,
        content: [
          {
            type: "text" as const,
            text: `get_project_context failed: ${(err as Error).message}`,
          },
        ],
      };
    }
  }
);

// ── Tool 2: get_recent_changes ────────────────────────────────────────────────

server.tool(
  "get_recent_changes",
  "Get the most recent N context records across all branches for a project. " +
    "Use this to see the full recent history regardless of branch. " +
    "Useful for understanding what the team has been working on overall. " +
    "Use the 'since' parameter to filter to changes after a specific point in time, " +
    "e.g. 'since yesterday' as an ISO 8601 timestamp.",
  {
    projectId: z.string().optional().describe("Project ID"),
    branch: z
      .string()
      .optional()
      .describe("Optional branch filter. Omit for all branches."),
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .default(10)
      .describe("Number of records to return (1-50, default 10)"),
    since: z
      .string()
      .optional()
      .describe("ISO 8601 timestamp — only return records extracted after this time, e.g. '2026-03-05T00:00:00Z'"),
  },
  async ({ projectId, branch, limit, since }) => {
    const pid = projectId ?? DEFAULT_PROJECT_ID;
    if (!pid) {
      return {
        isError: true,
        content: [
          { type: "text" as const, text: "projectId is required." },
        ],
      };
    }
    try {
      const data = await callMcp("get_recent_changes", {
        projectId: pid,
        branch,
        limit,
        ...(since ? { since } : {}),
      });
      return { content: [{ type: "text" as const, text: toText(data) }] };
    } catch (err) {
      return {
        isError: true,
        content: [
          {
            type: "text" as const,
            text: `get_recent_changes failed: ${(err as Error).message}`,
          },
        ],
      };
    }
  }
);

// ── Tool 3: search_context ────────────────────────────────────────────────────

server.tool(
  "search_context",
  "Ask a natural language question about the project and get a grounded answer " +
    "backed by AI-extracted context records. " +
    "Uses semantic search (Titan embeddings + cosine similarity) to find the most " +
    "relevant context, then Nova Pro generates a grounded answer with source citations. " +
    "Examples: 'why did we switch auth strategy?', 'what features have been built?', " +
    "'what are the outstanding tasks?', 'what risks have been identified?'",
  {
    query: z
      .string()
      .min(3)
      .describe("Natural language question about the project"),
    projectId: z.string().optional().describe("Project ID"),
    branch: z
      .string()
      .optional()
      .describe("Optional branch filter for the search context"),
  },
  async ({ query, projectId, branch }) => {
    const pid = projectId ?? DEFAULT_PROJECT_ID;
    if (!pid) {
      return {
        isError: true,
        content: [
          { type: "text" as const, text: "projectId is required." },
        ],
      };
    }
    try {
      const data = await callMcp("search_context", {
        projectId: pid,
        query,
        branch,
      });
      return { content: [{ type: "text" as const, text: toText(data) }] };
    } catch (err) {
      return {
        isError: true,
        content: [
          {
            type: "text" as const,
            text: `search_context failed: ${(err as Error).message}`,
          },
        ],
      };
    }
  }
);

// ── Tool 4: log_context ───────────────────────────────────────────────────────

server.tool(
  "log_context",
  "Record your reasoning, decisions, and next tasks after completing work. " +
    "If a recent push exists (within 30 minutes) for this author+branch combination, " +
    "your reasoning is merged into that context record. " +
    "Otherwise an uncommitted record is created that will be bound when the next push happens. " +
    "Use this after completing a feature or making an architectural decision.",
  {
    reasoning: z
      .string()
      .min(10)
      .describe(
        "Your reasoning about the work done — what you built and why, in 1-3 sentences"
      ),
    branch: z.string().default("main").describe("Branch you worked on"),
    author: z
      .string()
      .describe(
        "Your git username (run `git config user.name` to check)"
      ),
    decision: z
      .string()
      .optional()
      .describe("Key architectural or implementation decision made, if any"),
    tasks: z
      .array(z.string())
      .optional()
      .describe("Remaining tasks or follow-up items"),
    risk: z
      .string()
      .optional()
      .describe("Any risk or concern you want to flag"),
    projectId: z.string().optional().describe("Project ID"),
  },
  async ({ reasoning, branch, author, decision, tasks, risk, projectId }) => {
    const pid = projectId ?? DEFAULT_PROJECT_ID;
    if (!pid) {
      return {
        isError: true,
        content: [
          { type: "text" as const, text: "projectId is required." },
        ],
      };
    }
    try {
      const data = await callMcp("log_context", {
        projectId: pid,
        branch,
        author,
        reasoning,
        decision,
        tasks,
        risk,
      });
      return { content: [{ type: "text" as const, text: toText(data) }] };
    } catch (err) {
      return {
        isError: true,
        content: [
          {
            type: "text" as const,
            text: `log_context failed: ${(err as Error).message}`,
          },
        ],
      };
    }
  }
);

// ── Tool 5: get_events (dashboard polling endpoint, auth required) ─────────────

server.tool(
  "get_events",
  "Fetch context records for a project from the dashboard API. " +
    "Requires a valid API token (set FLOWSYNC_TOKEN). " +
    "Supports filtering by branch and fetching records after a given timestamp.",
  {
    projectId: z.string().optional().describe("Project ID"),
    branch: z.string().optional().describe("Branch filter"),
    since: z
      .string()
      .optional()
      .describe("ISO timestamp — return only records after this time"),
    limit: z.number().int().min(1).max(50).default(20).describe("Max records"),
  },
  async ({ projectId, branch, since, limit }) => {
    const pid = projectId ?? DEFAULT_PROJECT_ID;
    if (!pid) {
      return {
        isError: true,
        content: [{ type: "text" as const, text: "projectId is required." }],
      };
    }
    const query: Record<string, string> = { limit: String(limit) };
    if (branch) query.branch = branch;
    if (since) query.since = since;

    try {
      const data = await callQuery(
        `/api/v1/projects/${pid}/events`,
        "GET",
        undefined,
        query
      );
      return { content: [{ type: "text" as const, text: toText(data) }] };
    } catch (err) {
      return {
        isError: true,
        content: [
          {
            type: "text" as const,
            text: `get_events failed: ${(err as Error).message}`,
          },
        ],
      };
    }
  }
);

// ── Start ─────────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
