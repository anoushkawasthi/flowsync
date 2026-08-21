import { useEffect, useState } from "react";
import { vscode } from "../utilities/vscode";
import {
  IconRefresh,
  IconWarning,
  IconChevronDown,
  IconChevronRight,
  IconUnplug,
  IconNote,
  IconMessage,
  IconList,
  IconSparkle,
} from "./icons";

type McpToolKind = "read" | "write";

interface McpToolInfo {
  name: string;
  kind: McpToolKind;
  purpose: string;
}

interface McpWiring {
  state: "wired" | "missing" | "mismatched" | "unknown";
  detail: string;
  configPath: string;
}

interface SidebarData {
  connected: boolean;
  projectId?: string;
  projectName?: string;
  branch?: string;
  counts: { events: number; risks: number; tasks: number; authors: number };
  risks: Array<{ text: string; author: string; feature: string }>;
  tasks: string[];
  recent: Array<{
    eventId: string;
    feature: string;
    stage: string;
    author: string;
    extractedAt: string;
    hasRisk: boolean;
  }>;
  tools: McpToolInfo[];
  wiring: McpWiring;
  error?: string;
}

const MAX_RISKS = 4;
const MAX_TASKS = 5;
const MAX_RECENT = 6;

/** Compact relative time — the rail has no room for a full timestamp. */
function ago(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return "";
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${Math.max(mins, 1)}m`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d`;
  return `${Math.round(days / 30)}mo`;
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="dashboard-section">
      <h2>
        {title}
        {count !== undefined && count > 0 && <span className="section-count">{count}</span>}
      </h2>
      {children}
    </div>
  );
}

/**
 * The activity-bar "Project Context" view.
 *
 * A dedicated component rather than a reuse of Dashboard.tsx: that one renders
 * projectId / branch / port / backendUrl, which is configuration plumbing and the
 * reason this view read as empty. This leads with what needs attention — open
 * risks, pending tasks, recent activity — and puts the agent tools and actions
 * below it.
 */
export function ProjectContext() {
  const [data, setData] = useState<SidebarData | null>(null);
  const [loading, setLoading] = useState(true);
  const [toolsOpen, setToolsOpen] = useState(false);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type === "sidebarData") {
        setData(event.data.data as SidebarData);
        setLoading(false);
      }
    };
    window.addEventListener("message", handler);
    vscode.postMessage({ type: "requestSidebarData" });
    return () => window.removeEventListener("message", handler);
  }, []);

  const run = (command: string) => vscode.postMessage({ type: "runCommand", command });
  const openPanel = (view: string) => vscode.postMessage({ type: "openPanelView", view });

  const refresh = () => {
    setLoading(true);
    vscode.postMessage({ type: "requestSidebarData" });
  };

  if (loading && !data) {
    return (
      <div className="sidebar-view">
        <div className="loading-view">
          <span className="spinner spinner-lg" />
          <p>Loading project context…</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="sidebar-view">
        <div className="empty-state">
          <span className="empty-state-icon">
            <IconUnplug size={18} />
          </span>
          <h2>No data</h2>
          <p>Could not read project context.</p>
          <button className="btn btn-secondary btn-sm" onClick={refresh}>
            <IconRefresh size={13} />
            Retry
          </button>
        </div>
      </div>
    );
  }

  /* ── not connected ── */
  if (!data.connected) {
    return (
      <div className="sidebar-view">
        <div className="empty-state">
          <span className="empty-state-icon">
            <IconUnplug size={18} />
          </span>
          <h2>Not connected</h2>
          <p>
            {data.projectId
              ? "This project has no stored API token."
              : "No BuildBerry project in this workspace."}
          </p>
          <div className="empty-state-actions">
            <button className="btn btn-primary btn-sm" onClick={() => openPanel("init")}>
              Initialize
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => openPanel("join")}>
              Join
            </button>
          </div>
        </div>

        <ToolsSection
          tools={data.tools}
          wiring={data.wiring}
          open={toolsOpen}
          onToggle={() => setToolsOpen((v) => !v)}
        />
      </div>
    );
  }

  const hasContext = data.counts.events > 0;

  return (
    <div className="sidebar-view">
      {/* status strip */}
      <div className="sidebar-head">
        <span className="status-badge connected">
          <span className="status-dot" />
          {data.branch ?? "connected"}
        </span>
        <span className="sidebar-project" title={data.projectId}>
          {data.projectName ?? data.projectId}
        </span>
        <button
          className="btn btn-ghost btn-sm sidebar-refresh"
          onClick={refresh}
          aria-label="Refresh project context"
          title="Refresh"
        >
          <IconRefresh size={13} />
        </button>
      </div>

      {data.error && (
        <div className="form-error-banner">
          <IconWarning size={13} />
          <span>{data.error}</span>
        </div>
      )}

      {!data.error && !hasContext && (
        <div className="empty-state">
          <span className="empty-state-icon">
            <IconNote size={18} />
          </span>
          <h2>No context yet</h2>
          <p>Push some code, or record your reasoning to create the first entry.</p>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => run("flowsync.recordReasoning")}
          >
            <IconSparkle size={13} />
            Record reasoning
          </button>
        </div>
      )}

      {hasContext && (
        <>
          <div className="stats-grid sidebar-counts">
            <div className="stat-card">
              <div className="stat-label">Events</div>
              <div className="stat-value">{data.counts.events}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Risks</div>
              <div className="stat-value">{data.counts.risks}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Tasks</div>
              <div className="stat-value">{data.counts.tasks}</div>
            </div>
          </div>

          {data.risks.length > 0 && (
            <Section title="Open risks" count={data.risks.length}>
              <div className="task-list">
                {data.risks.slice(0, MAX_RISKS).map((risk, i) => (
                  <div key={i} className="risk-card">
                    <div className="decision-card-text">{risk.text}</div>
                    <div className="decision-card-meta">{risk.feature}</div>
                  </div>
                ))}
                {data.risks.length > MAX_RISKS && (
                  <button className="btn btn-link btn-sm" onClick={() => openPanel("dashboard")}>
                    {data.risks.length - MAX_RISKS} more in the dashboard
                  </button>
                )}
              </div>
            </Section>
          )}

          {data.tasks.length > 0 && (
            <Section title="Pending tasks" count={data.tasks.length}>
              <div className="task-list">
                {data.tasks.slice(0, MAX_TASKS).map((task, i) => (
                  <div key={i} className="task-item">
                    {task}
                  </div>
                ))}
                {data.tasks.length > MAX_TASKS && (
                  <button className="btn btn-link btn-sm" onClick={() => openPanel("dashboard")}>
                    {data.tasks.length - MAX_TASKS} more in the dashboard
                  </button>
                )}
              </div>
            </Section>
          )}

          {data.recent.length > 0 && (
            <Section title="Recent">
              <div className="recent-list">
                {data.recent.slice(0, MAX_RECENT).map((entry) => (
                  <button
                    key={entry.eventId}
                    className="recent-row"
                    onClick={() => openPanel("dashboard")}
                    title={`${entry.feature} — ${entry.author}`}
                  >
                    <span className="recent-main">
                      <span className="recent-feature">{entry.feature}</span>
                      <span className="recent-meta">
                        {entry.stage} · {entry.author}
                      </span>
                    </span>
                    <span className="recent-tail">
                      {entry.hasRisk && (
                        <span className="recent-risk" title="Has a flagged risk">
                          <IconWarning size={11} />
                        </span>
                      )}
                      <span className="recent-ago">{ago(entry.extractedAt)}</span>
                    </span>
                  </button>
                ))}
              </div>
            </Section>
          )}
        </>
      )}

      <ToolsSection
        tools={data.tools}
        wiring={data.wiring}
        open={toolsOpen}
        onToggle={() => setToolsOpen((v) => !v)}
      />

      <Section title="Actions">
        <div className="actions-row">
          <button className="btn btn-primary btn-sm" onClick={() => run("flowsync.recordReasoning")}>
            <IconSparkle size={13} />
            Record reasoning
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => run("flowsync.openChat")}>
            <IconMessage size={13} />
            Ask
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => run("flowsync.catchMeUp")}>
            <IconList size={13} />
            Catch me up
          </button>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => run("flowsync.openWebDashboard")}
          >
            Web dashboard
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => run("flowsync.openOutput")}>
            Logs
          </button>
        </div>
      </Section>
    </div>
  );
}

/**
 * The five MCP tools plus whether the agent can actually reach them. Collapsed by
 * default — it's reference material, not something you read every time.
 */
function ToolsSection({
  tools,
  wiring,
  open,
  onToggle,
}: {
  tools: McpToolInfo[];
  wiring: McpWiring;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="dashboard-section">
      <button className="section-toggle" onClick={onToggle} aria-expanded={open}>
        {open ? <IconChevronDown size={12} /> : <IconChevronRight size={12} />}
        Agent tools
        <span className="section-count">{tools.length}</span>
      </button>

      <div className={`wiring-note wiring-${wiring.state}`}>
        <span className="status-dot" />
        <span>{wiring.detail}</span>
      </div>

      {open && (
        <div className="tool-list">
          {tools.map((tool) => (
            <div key={tool.name} className="tool-row">
              <div className="tool-head">
                <code className="tool-name">{tool.name}</code>
                <span className={`badge badge-${tool.kind}`}>{tool.kind}</span>
              </div>
              <p className="tool-purpose">{tool.purpose}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
