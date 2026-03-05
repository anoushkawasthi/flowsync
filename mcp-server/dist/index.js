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
import { execSync } from "child_process";
import { z } from "zod";
// ── Config ────────────────────────────────────────────────────────────────────
const API_URL = process.env.FLOWSYNC_API_URL ??
    "https://86tzell2w9.execute-api.us-east-1.amazonaws.com/prod";
const DEFAULT_PROJECT_ID = process.env.FLOWSYNC_PROJECT_ID ?? "";
const TOKEN = process.env.FLOWSYNC_TOKEN ?? "";
/** Current git branch — used as the default branch filter for search_context
 *  so queries stay scoped to what the user is working on right now.
 *  Falls back to FLOWSYNC_BRANCH env var, then 'main'. */
function detectCurrentBranch() {
    if (process.env.FLOWSYNC_BRANCH)
        return process.env.FLOWSYNC_BRANCH;
    try {
        return execSync("git rev-parse --abbrev-ref HEAD", { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim();
    }
    catch {
        return "main";
    }
}
const DEFAULT_BRANCH = detectCurrentBranch();
// ── HTTP helper ───────────────────────────────────────────────────────────────
async function callMcp(tool, params) {
    const res = await fetch(`${API_URL}/mcp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tool, params }),
    });
    const data = (await res.json());
    if (!res.ok) {
        const err = data;
        throw new Error(err.message ?? `HTTP ${res.status}`);
    }
    return data;
}
async function callQuery(path, method, body, query) {
    const url = new URL(`${API_URL}${path}`);
    if (query) {
        for (const [k, v] of Object.entries(query))
            url.searchParams.set(k, v);
    }
    const res = await fetch(url.toString(), {
        method,
        headers: {
            "Content-Type": "application/json",
            ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
    });
    const data = (await res.json());
    if (!res.ok) {
        const err = data;
        throw new Error(err.message ?? `HTTP ${res.status}`);
    }
    return data;
}
function toText(data) {
    return JSON.stringify(data, null, 2);
}
// ── Server ────────────────────────────────────────────────────────────────────
const server = new McpServer({
    name: "flowsync",
    version: "1.0.0",
    description: "FlowSync is a development intelligence system that captures the WHY behind code changes. " +
        "Every commit is analyzed by AI to extract decisions, risks, and reasoning — not just what changed, but why. " +
        "Use FlowSync tools to understand project context before starting work, record your own reasoning after completing work, " +
        "and answer questions about past decisions without digging through commit history.",
});
// ── Tool 1: get_project_context ───────────────────────────────────────────────
server.tool("get_project_context", "Get AI-extracted context records for a branch. " +
    "Call this at the start of any work session to understand what has been built, " +
    "what decisions were made, outstanding tasks, and risks. " +
    "Returns records newest-first. Feature branch records are merged with main branch context. " +
    "Use limit and nextToken for pagination to access deeper history. " +
    "WHY: Starting work without context risks duplicating effort or contradicting existing decisions. " +
    "This gives you immediate situational awareness of the branch — what was built, the reasoning behind it, and what's still pending.", {
    projectId: z
        .string()
        .optional()
        .describe(`Project ID. Defaults to ${DEFAULT_PROJECT_ID || "FLOWSYNC_PROJECT_ID env var"}`),
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
}, async ({ projectId, branch, limit, nextToken }) => {
    const pid = projectId ?? DEFAULT_PROJECT_ID;
    if (!pid) {
        return {
            isError: true,
            content: [
                {
                    type: "text",
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
        return { content: [{ type: "text", text: toText(data) }] };
    }
    catch (err) {
        return {
            isError: true,
            content: [
                {
                    type: "text",
                    text: `get_project_context failed: ${err.message}`,
                },
            ],
        };
    }
});
// ── Tool 2: get_recent_changes ────────────────────────────────────────────────
server.tool("get_recent_changes", "Get the most recent N context records across all branches for a project. " +
    "Use this to see the full recent history regardless of branch. " +
    "Use the 'since' parameter to filter to changes after a specific point in time, e.g. '2026-03-05T00:00:00Z'. " +
    "WHY: Decisions on other branches affect your work even if they haven't merged yet. " +
    "Use this before making architectural decisions to avoid conflicts, or when answering 'what has the team done recently?' across all branches.", {
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
}, async ({ projectId, branch, limit, since }) => {
    const pid = projectId ?? DEFAULT_PROJECT_ID;
    if (!pid) {
        return {
            isError: true,
            content: [
                { type: "text", text: "projectId is required." },
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
        return { content: [{ type: "text", text: toText(data) }] };
    }
    catch (err) {
        return {
            isError: true,
            content: [
                {
                    type: "text",
                    text: `get_recent_changes failed: ${err.message}`,
                },
            ],
        };
    }
});
// ── Tool 3: search_context ────────────────────────────────────────────────────
server.tool("search_context", "Ask a natural language question about the project and get a grounded answer " +
    "backed by AI-extracted context records. " +
    "Uses Titan embeddings + cosine similarity to find the most relevant context, " +
    "then Nova Pro generates a grounded answer with source citations. " +
    "Good questions: 'Why did we choose JWT over sessions?', 'What are the identified security risks?', " +
    "'What features have been built?', 'What tasks are still pending on feature/auth?'. " +
    `Searches branch '${DEFAULT_BRANCH}' by default (current git branch) — pass branch='all' to search across all branches. ` +
    "WHY: Reading every context record manually is slow and error-prone. " +
    "This answers your specific question directly and cites the exact records it used, so you can trust and verify the answer.", {
    query: z
        .string()
        .min(3)
        .describe("Natural language question about the project"),
    projectId: z.string().optional().describe("Project ID"),
    branch: z
        .string()
        .optional()
        .describe(`Branch to search within. Defaults to '${DEFAULT_BRANCH}' (current git branch). ` +
        "Pass 'all' to search across all branches."),
}, async ({ query, projectId, branch }) => {
    const pid = projectId ?? DEFAULT_PROJECT_ID;
    if (!pid) {
        return {
            isError: true,
            content: [
                { type: "text", text: "projectId is required." },
            ],
        };
    }
    // Hard branch filter: default to the current git branch so results stay
    // scoped to what the user is working on. Pass branch='all' to opt out.
    const effectiveBranch = branch === "all" ? undefined : (branch ?? DEFAULT_BRANCH);
    try {
        const data = await callMcp("search_context", {
            projectId: pid,
            query,
            branch: effectiveBranch,
        });
        return { content: [{ type: "text", text: toText(data) }] };
    }
    catch (err) {
        return {
            isError: true,
            content: [
                {
                    type: "text",
                    text: `search_context failed: ${err.message}`,
                },
            ],
        };
    }
});
// ── Tool 4: log_context ───────────────────────────────────────────────────────
server.tool("log_context", "Record the WHY behind your work — decisions made, reasoning, risks, and next tasks. " +
    "This is FlowSync's core value: capturing intent that code alone cannot convey. " +
    "If a recent push exists (within 30 minutes) for this author+branch, your reasoning is merged into that record. " +
    "Otherwise an uncommitted record is created and bound on the next push. " +
    "ALWAYS call this after completing a feature, making an architectural decision, or choosing between approaches. " +
    "WHY: Future developers and AI agents can read the code — they cannot read your mind. " +
    "The reasoning you log today prevents wrong assumptions, repeated debates, and reverted changes tomorrow.", {
    reasoning: z
        .string()
        .min(10)
        .describe("The WHY behind your work — motivation, tradeoffs, and context that cannot be inferred from code alone. " +
        "MUST answer: why this approach over alternatives? What problem does it solve? " +
        "Bad: 'Added JWT authentication'. " +
        "Good: 'Chose JWT over sessions because the API needs to be stateless for horizontal scaling — sessions would require sticky routing or shared Redis.'"),
    branch: z.string().default("main").describe("Branch you worked on"),
    author: z
        .string()
        .describe("Your git username (run `git config user.name` to check)"),
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
}, async ({ reasoning, branch, author, decision, tasks, risk, projectId }) => {
    const pid = projectId ?? DEFAULT_PROJECT_ID;
    if (!pid) {
        return {
            isError: true,
            content: [
                { type: "text", text: "projectId is required." },
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
        return { content: [{ type: "text", text: toText(data) }] };
    }
    catch (err) {
        return {
            isError: true,
            content: [
                {
                    type: "text",
                    text: `log_context failed: ${err.message}`,
                },
            ],
        };
    }
});
// ── Tool 5: get_events (dashboard polling endpoint, auth required) ─────────────
server.tool("get_events", "Fetch context records for a project from the dashboard API. " +
    "Requires a valid API token (set FLOWSYNC_TOKEN). " +
    "Supports filtering by branch and fetching records after a given timestamp.", {
    projectId: z.string().optional().describe("Project ID"),
    branch: z.string().optional().describe("Branch filter"),
    since: z
        .string()
        .optional()
        .describe("ISO timestamp — return only records after this time"),
    limit: z.number().int().min(1).max(50).default(20).describe("Max records"),
}, async ({ projectId, branch, since, limit }) => {
    const pid = projectId ?? DEFAULT_PROJECT_ID;
    if (!pid) {
        return {
            isError: true,
            content: [{ type: "text", text: "projectId is required." }],
        };
    }
    const query = { limit: String(limit) };
    if (branch)
        query.branch = branch;
    if (since)
        query.since = since;
    try {
        const data = await callQuery(`/api/v1/projects/${pid}/events`, "GET", undefined, query);
        return { content: [{ type: "text", text: toText(data) }] };
    }
    catch (err) {
        return {
            isError: true,
            content: [
                {
                    type: "text",
                    text: `get_events failed: ${err.message}`,
                },
            ],
        };
    }
});
// ── Start ─────────────────────────────────────────────────────────────────────
const transport = new StdioServerTransport();
await server.connect(transport);
