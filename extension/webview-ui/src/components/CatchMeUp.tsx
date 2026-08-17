import { useState, useEffect } from "react";
import { vscode } from "../utilities/vscode";
import { IconArrowLeft, IconUser, IconNote, IconWarning } from "./icons";

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

const MAX_TASKS = 15;

/** Author + commit line shared by decision and risk cards. */
function NoteMeta({ author, commitHash }: { author: string; commitHash: string }) {
  return (
    <div className="decision-card-meta">
      <span>
        <IconUser size={11} /> {author}
      </span>
      <span>
        <IconNote size={11} /> {commitHash?.slice(0, 7) ?? ""}
      </span>
    </div>
  );
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

    // Safety fallback: if data never arrives, stop spinning and re-request once.
    const fallback = setTimeout(() => {
      setLoading((prev) => {
        if (prev) vscode.postMessage({ type: "requestCatchUpData" });
        return false;
      });
    }, 5000);

    return () => {
      window.removeEventListener("message", handler);
      clearTimeout(fallback);
    };
  }, []);

  const backButton = (
    <button className="btn btn-ghost btn-sm back-button" onClick={() => onNavigate("dashboard")}>
      <IconArrowLeft size={14} />
      Back to dashboard
    </button>
  );

  if (loading) {
    return (
      <div className="dashboard-container">
        <div className="loading-view">
          <span className="spinner spinner-lg" />
          <p>Loading recent changes…</p>
        </div>
      </div>
    );
  }

  if (!data || data.totalEvents === 0) {
    return (
      <div className="dashboard-container">
        {backButton}
        <div className="empty-state">
          <h2>All caught up</h2>
          <p>
            {data?.isFirstTime
              ? "No activity captured in the last 24 hours."
              : "No new changes since you were last here."}
          </p>
        </div>
      </div>
    );
  }

  const timeStr =
    data.hoursSince < 24
      ? `${Math.round(data.hoursSince)} hours`
      : `${Math.round(data.hoursSince / 24)} days`;

  return (
    <div className="dashboard-container">
      {backButton}

      <div className="dashboard-header">
        <h1>Catch me up</h1>
        <p>
          {data.isFirstTime
            ? `Recent activity in the last ${timeStr}`
            : `Changes since you last checked (${timeStr} ago)`}
        </p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Total events</div>
          <div className="stat-value">{data.totalEvents}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Active authors</div>
          <div className="stat-value">{data.authors.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Decisions made</div>
          <div className="stat-value">{data.decisions.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Risks flagged</div>
          <div className="stat-value">{data.risks.length}</div>
        </div>
      </div>

      {data.branches.length > 1 && (
        <div className="dashboard-section">
          <h2>Branch activity</h2>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-label">Current branch</div>
              <div className="stat-value">{data.currentBranchEvents} events</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Other branches</div>
              <div className="stat-value">{data.otherBranchesEvents} events</div>
            </div>
          </div>
        </div>
      )}

      {data.authors.length > 0 && (
        <div className="dashboard-section">
          <h2>Active contributors</h2>
          <div className="chip-grid">
            {data.authors.map((author) => (
              <span key={author} className="chip chip-selected">
                {author}
              </span>
            ))}
          </div>
        </div>
      )}

      {data.decisions.length > 0 && (
        <div className="dashboard-section">
          <h2>Architectural decisions</h2>
          <div className="task-list">
            {data.decisions.map((dec, idx) => (
              <div key={idx} className="decision-card">
                <div className="decision-card-text">{dec.text}</div>
                <NoteMeta author={dec.author} commitHash={dec.commitHash} />
              </div>
            ))}
          </div>
        </div>
      )}

      {data.risks.length > 0 && (
        <div className="dashboard-section">
          <h2>Risks &amp; concerns</h2>
          <div className="task-list">
            {data.risks.map((risk, idx) => (
              <div key={idx} className="risk-card">
                <div className="decision-card-text">
                  <IconWarning size={12} /> {risk.text}
                </div>
                <NoteMeta author={risk.author} commitHash={risk.commitHash} />
              </div>
            ))}
          </div>
        </div>
      )}

      {data.tasks.length > 0 && (
        <div className="dashboard-section">
          <h2>Pending tasks ({data.tasks.length})</h2>
          <div className="task-list">
            {data.tasks.slice(0, MAX_TASKS).map((task, idx) => (
              <div key={idx} className="task-item">
                {task}
              </div>
            ))}
            {data.tasks.length > MAX_TASKS && (
              <p className="field-hint">
                and {data.tasks.length - MAX_TASKS} more
              </p>
            )}
          </div>
        </div>
      )}

      <div className="actions-row">
        <button className="btn btn-primary" onClick={() => onNavigate("dashboard")}>
          View full timeline
        </button>
      </div>
    </div>
  );
}
