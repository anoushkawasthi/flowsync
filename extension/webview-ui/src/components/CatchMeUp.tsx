import { useState, useEffect } from "react";
import { vscode } from "../utilities/vscode";

interface CatchMeUpProps {
  onNavigate: (view: string) => void;
}

interface CatchUpData {
  totalEvents: number;
  authors: string[];
  decisions: Array<{ text: string; commitHash: string; author: string }>;
  risks: Array<{ text: string; commitHash: string; author: string }>;
  tasks: string[];
  branches: string[];
  currentBranchEvents: number;
  otherBranchesEvents: number;
  hoursSince: number;
  isFirstTime: boolean;
  canViewRecent: boolean;
}

export function CatchMeUp({ onNavigate }: CatchMeUpProps) {
  const [data, setData] = useState<CatchUpData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const message = event.data;
      if (message.type === "catchUpData") {
        setData(message.data);
        setLoading(false);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  if (loading) {
    return (
      <div className="dashboard-container">
        <div className="loading-view">
          <div className="spinner spinner-lg"></div>
          <p>Loading recent changes...</p>
        </div>
      </div>
    );
  }

  if (!data || data.totalEvents === 0) {
    const handleViewRecent = () => {
      setLoading(true);
      vscode.postMessage({ type: "requestRecentActivity" });
    };

    return (
      <div className="dashboard-container">
        <button className="back-button" onClick={() => onNavigate("dashboard")}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M19 12H5M12 19L5 12L12 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back to Dashboard
        </button>
        <div className="empty-state">
          <h2>All Caught Up!</h2>
          <p>
            {data?.isFirstTime 
              ? "No recent changes in the last 24 hours."
              : "No new changes since you were last here."}
          </p>
          {data?.canViewRecent && (
            <button 
              className="btn btn-primary" 
              onClick={handleViewRecent}
              style={{ marginTop: "1rem" }}
            >
              View Recent Activity (Last 24 Hours)
            </button>
          )}
        </div>
      </div>
    );
  }

  const timeStr = data.hoursSince < 24
    ? `${Math.round(data.hoursSince)} hours`
    : `${Math.round(data.hoursSince / 24)} days`;

  return (
    <div className="dashboard-container">
      <button className="back-button" onClick={() => onNavigate("dashboard")}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M19 12H5M12 19L5 12L12 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Back to Dashboard
      </button>

      <div className="dashboard-header">
        <h1>Catch Me Up</h1>
        <p>
          {data.isFirstTime 
            ? `Recent activity in the last ${timeStr}`
            : `Changes since you last checked (${timeStr} ago)`}
        </p>
      </div>

      {/* Summary Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Total Events</div>
          <div className="stat-value" style={{ fontSize: "1.5rem", fontWeight: 700 }}>
            {data.totalEvents}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Active Authors</div>
          <div className="stat-value" style={{ fontSize: "1.5rem", fontWeight: 700 }}>
            {data.authors.length}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Decisions Made</div>
          <div className="stat-value" style={{ fontSize: "1.5rem", fontWeight: 700 }}>
            {data.decisions.length}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Risks Flagged</div>
          <div className="stat-value" style={{ fontSize: "1.5rem", fontWeight: 700, color: data.risks.length > 0 ? "var(--vscode-editorWarning-foreground)" : "inherit" }}>
            {data.risks.length}
          </div>
        </div>
      </div>

      {/* Branch Activity */}
      {data.branches.length > 1 && (
        <div className="dashboard-section">
          <h2>Branch Activity</h2>
          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
            <div className="stat-card">
              <div className="stat-label">Current Branch</div>
              <div className="stat-value">{data.currentBranchEvents} events</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Other Branches</div>
              <div className="stat-value">{data.otherBranchesEvents} events</div>
            </div>
          </div>
        </div>
      )}

      {/* Authors */}
      {data.authors.length > 0 && (
        <div className="dashboard-section">
          <h2>Active Contributors</h2>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            {data.authors.map((author) => (
              <div key={author} className="chip chip-selected" style={{ cursor: "default" }}>
                {author}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Decisions */}
      {data.decisions.length > 0 && (
        <div className="dashboard-section">
          <h2>Architectural Decisions</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {data.decisions.map((dec, idx) => (
              <div
                key={idx}
                className="stat-card"
                style={{
                  borderLeft: "3px solid var(--vscode-terminal-ansiCyan)",
                  background: "color-mix(in srgb, var(--vscode-terminal-ansiCyan) 8%, transparent)",
                }}
              >
                <div style={{ fontSize: "0.9rem", marginBottom: "0.5rem" }}>
                  {dec.text}
                </div>
                <div style={{ fontSize: "0.75rem", opacity: 0.7, display: "flex", gap: "1rem" }}>
                  <span>👤 {dec.author}</span>
                  <span>📝 {dec.commitHash.slice(0, 7)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Risks */}
      {data.risks.length > 0 && (
        <div className="dashboard-section">
          <h2>Risks & Concerns</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {data.risks.map((risk, idx) => (
              <div
                key={idx}
                className="stat-card"
                style={{
                  borderLeft: "3px solid var(--vscode-editorWarning-foreground)",
                  background: "color-mix(in srgb, var(--vscode-editorWarning-foreground) 8%, transparent)",
                }}
              >
                <div style={{ fontSize: "0.9rem", marginBottom: "0.5rem" }}>
                  ⚠️ {risk.text}
                </div>
                <div style={{ fontSize: "0.75rem", opacity: 0.7, display: "flex", gap: "1rem" }}>
                  <span>👤 {risk.author}</span>
                  <span>📝 {risk.commitHash.slice(0, 7)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pending Tasks */}
      {data.tasks.length > 0 && (
        <div className="dashboard-section">
          <h2>Pending Tasks ({data.tasks.length})</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {data.tasks.slice(0, 15).map((task, idx) => (
              <div key={idx} style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start" }}>
                <span style={{ opacity: 0.5, fontSize: "0.85rem", flexShrink: 0 }}>
                  {idx + 1}.
                </span>
                <span style={{ fontSize: "0.88rem" }}>{task}</span>
              </div>
            ))}
            {data.tasks.length > 15 && (
              <div style={{ fontSize: "0.82rem", opacity: 0.6, paddingTop: "0.5rem" }}>
                ...and {data.tasks.length - 15} more tasks
              </div>
            )}
          </div>
        </div>
      )}

      {/* Action */}
      <div className="actions-row" style={{ paddingTop: "1rem" }}>
        <button className="btn btn-primary" onClick={() => onNavigate("dashboard")}>
          View Full Timeline
        </button>
      </div>
    </div>
  );
}
