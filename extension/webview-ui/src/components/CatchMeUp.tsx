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

    // Safety fallback: if data never arrives (e.g. timing issue), stop spinning after 5s
    const fallback = setTimeout(() => {
      setLoading((prev) => {
        if (prev) {
          // Request data again in case the message was lost
          vscode.postMessage({ type: "requestCatchUpData" });
        }
        return false;
      });
    }, 5000);

    return () => {
      window.removeEventListener("message", handler);
      clearTimeout(fallback);
    };
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
              ? "No activity captured in the last 24 hours."
              : "No new changes since you were last here."}
          </p>
          {!data && (
            <p style={{ fontSize: "0.8rem", opacity: 0.5, marginTop: "0.5rem" }}>
              Try running Catch Me Up again from the command palette.
            </p>
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
          <div className="stat-value" style={{ fontSize: "1.75rem", fontWeight: 700, color: "var(--text)" }}>
            {data.totalEvents}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Active Authors</div>
          <div className="stat-value" style={{ fontSize: "1.75rem", fontWeight: 700, color: "var(--text)" }}>
            {data.authors.length}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Decisions Made</div>
          <div className="stat-value" style={{ fontSize: "1.75rem", fontWeight: 700, color: "var(--accent)" }}>
            {data.decisions.length}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Risks Flagged</div>
          <div className="stat-value" style={{ fontSize: "1.75rem", fontWeight: 700, color: data.risks.length > 0 ? "var(--warn)" : "var(--text)" }}>
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
          <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
            {data.decisions.map((dec, idx) => (
              <div key={idx} className="decision-card">
                <div className="decision-card-text">{dec.text}</div>
                <div className="decision-card-meta">
                  <span>&#128100; {dec.author}</span>
                  <span>&#128221; {dec.commitHash?.slice(0, 7) ?? ""}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Risks */}
      {data.risks.length > 0 && (
        <div className="dashboard-section">
          <h2>Risks &amp; Concerns</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
            {data.risks.map((risk, idx) => (
              <div key={idx} className="risk-card">
                <div className="decision-card-text" style={{ color: "var(--warn)" }}>&#9888;&#65039; {risk.text}</div>
                <div className="decision-card-meta">
                  <span>&#128100; {risk.author}</span>
                  <span>&#128221; {risk.commitHash?.slice(0, 7) ?? ""}</span>
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
          <div className="task-list">
            {data.tasks.slice(0, 15).map((task, idx) => (
              <div key={idx} className="task-item">{task}</div>
            ))}
            {data.tasks.length > 15 && (
              <div style={{ fontSize: "0.82rem", color: "var(--text-dim)", paddingTop: "0.25rem" }}>
                ...and {data.tasks.length - 15} more tasks
              </div>
            )}
          </div>
        </div>
      )}

      {/* Action */}
      <div className="actions-row" style={{ paddingTop: "0.5rem" }}>
        <button className="btn btn-primary" onClick={() => onNavigate("dashboard")}>
          View Full Timeline
        </button>
      </div>
    </div>
  );
}
