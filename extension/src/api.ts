import * as vscode from "vscode";
import * as https from "https";
import * as http from "http";
import { URL } from "url";

/**
 * One place for every backend call.
 *
 * The base URL used to be hardcoded in three separate files
 * (commands/catchMeUp.ts, commands/initProject.ts, panels/FlowSyncPanel.ts) and
 * each call site hand-rolled its own node:https plumbing. The sidebar needs the
 * same two reads, so this exists rather than a fourth copy.
 */

const DEFAULT_BACKEND_URL =
  "https://86tzell2w9.execute-api.us-east-1.amazonaws.com/prod";

export const DEFAULT_DASHBOARD_URL = "https://flowsync.aahil-khan.xyz";

/**
 * Honours the `flowsync.backendUrl` setting. That setting shipped with the
 * redesign's `contributes` block but nothing ever read it, so overriding the
 * backend silently did nothing.
 */
export function getBackendUrl(): string {
  const configured = vscode.workspace
    .getConfiguration("flowsync")
    .get<string>("backendUrl", "")
    .trim();
  return configured || DEFAULT_BACKEND_URL;
}

export function getDashboardUrl(): string {
  const configured = vscode.workspace
    .getConfiguration("flowsync")
    .get<string>("dashboardUrl", "")
    .trim();
  return (configured || DEFAULT_DASHBOARD_URL).replace(/\/+$/, "");
}

/** A context record as returned by the events endpoint. */
export interface ContextRecord {
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
  confidence?: number;
  entities?: string[];
}

export interface ProjectInfo {
  projectId: string;
  name: string;
  description?: string;
  languages?: string[];
  frameworks?: string[];
  defaultBranch?: string;
  eventCount?: number;
  lastActivityAt?: string;
}

/* ─── transport ─── */

interface RequestOptions {
  method: "GET" | "POST";
  path: string;
  token?: string;
  body?: unknown;
  /** Overrides getBackendUrl(), e.g. when config carries its own backendUrl. */
  baseUrl?: string;
}

function request<T>(opts: RequestOptions): Promise<T> {
  const base = (opts.baseUrl || getBackendUrl()).replace(/\/+$/, "");
  const url = new URL(base + opts.path);
  const payload = opts.body === undefined ? undefined : JSON.stringify(opts.body);
  // http only ever appears for a local backend during development.
  const transport = url.protocol === "http:" ? http : https;

  return new Promise<T>((resolve, reject) => {
    const req = transport.request(
      {
        hostname: url.hostname,
        port: url.port || (url.protocol === "http:" ? 80 : 443),
        path: url.pathname + url.search,
        method: opts.method,
        headers: {
          Accept: "application/json",
          ...(payload
            ? {
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(payload),
              }
            : {}),
          ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          const status = res.statusCode ?? 0;
          if (status < 200 || status >= 300) {
            reject(new BackendError(status, data));
            return;
          }
          try {
            resolve(data ? (JSON.parse(data) as T) : ({} as T));
          } catch (err) {
            reject(err instanceof Error ? err : new Error(String(err)));
          }
        });
      }
    );
    req.on("error", reject);
    if (payload) {
      req.write(payload);
    }
    req.end();
  });
}

/** Carries the HTTP status so callers can distinguish auth failures from outages. */
export class BackendError extends Error {
  constructor(
    public readonly status: number,
    public readonly bodyText: string
  ) {
    super(`HTTP ${status}${bodyText ? `: ${bodyText.slice(0, 200)}` : ""}`);
    this.name = "BackendError";
  }

  /** True when the token is rejected, as opposed to the backend being down. */
  get isAuthFailure(): boolean {
    return this.status === 401 || this.status === 403;
  }
}

/* ─── reads ─── */

export interface FetchEventsOptions {
  branch?: string;
  /** ISO 8601 — only records extracted after this time. */
  since?: string;
  /** Backend caps this at 50. */
  limit?: number;
  baseUrl?: string;
}

export async function fetchEvents(
  projectId: string,
  token: string,
  options: FetchEventsOptions = {}
): Promise<ContextRecord[]> {
  const params = new URLSearchParams();
  if (options.branch) {
    params.set("branch", options.branch);
  }
  if (options.since) {
    params.set("since", options.since);
  }
  params.set("limit", String(Math.min(options.limit ?? 20, 50)));

  const result = await request<{ events?: ContextRecord[] }>({
    method: "GET",
    path: `/api/v1/projects/${projectId}/events?${params.toString()}`,
    token,
    baseUrl: options.baseUrl,
  });
  return result.events ?? [];
}

/**
 * Project metadata. Doubles as the token-validation endpoint — a 401 here means
 * the stored secret is stale.
 */
export function fetchProjectInfo(
  projectId: string,
  token: string,
  baseUrl?: string
): Promise<ProjectInfo> {
  return request<ProjectInfo>({
    method: "GET",
    path: `/api/v1/projects/${projectId}`,
    token,
    baseUrl,
  });
}

/* ─── MCP passthrough ─── */

export interface LogContextParams {
  projectId: string;
  reasoning: string;
  branch: string;
  author: string;
  decision?: string;
  risk?: string;
  tasks?: string[];
}

export interface LogContextResult {
  success: boolean;
  eventId: string;
  /** "updated" means it merged into a push from the last 30 minutes. */
  action: "updated" | "created";
}

/**
 * POST /mcp — the same entry point the MCP server uses. Deliberately sends no
 * Authorization header: the mcp Lambda does not authenticate, and mirroring the
 * MCP server (mcp-server/src/index.ts callMcp) keeps the two consistent.
 */
export function callMcpTool<T>(
  tool: string,
  params: Record<string, unknown>,
  baseUrl?: string
): Promise<T> {
  return request<T>({
    method: "POST",
    path: "/mcp",
    body: { tool, params },
    baseUrl,
  });
}

export function logContext(
  params: LogContextParams,
  baseUrl?: string
): Promise<LogContextResult> {
  return callMcpTool<LogContextResult>("log_context", { ...params }, baseUrl);
}
