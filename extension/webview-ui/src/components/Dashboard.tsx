import { useEffect, useState } from "react";
import { vscode } from "../utilities/vscode";

interface StatusData {
  connected: boolean;
  projectId?: string;
  defaultBranch?: string;
  port?: number;
  backendUrl?: string;
}

interface DashboardProps {
  onNavigate: (view: string) => void;
}

export function Dashboard({ onNavigate }: DashboardProps) {
  const [status, setStatus] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const message = event.data;
      if (message.type === "status") {
        setStatus(message.data);
        setLoading(false);
      }
    };
    window.addEventListener("message", handler);
    vscode.postMessage({ type: "requestStatus" });
    return () => window.removeEventListener("message", handler);
  }, []);

  if (loading) {
    return (
      <div className="dashboard-container">
        <div className="loading-view">
          <span className="spinner spinner-lg" />
          <p>Loading project status...</p>
        </div>
      </div>
    );
  }

  if (!status || !status.connected) {
    return (
      <div className="dashboard-container">
        <div className="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="var(--vscode-descriptionForeground)" strokeWidth="1.5" strokeDasharray="4 4" />
            <path d="M8 12H16" stroke="var(--vscode-descriptionForeground)" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <h2>Not Connected</h2>
          <p>No active FlowSync project detected in this workspace.</p>
          <div className="empty-state-actions">
            <button className="btn btn-primary" onClick={() => onNavigate("init")}>
              Initialize Project
            </button>
            <button className="btn btn-secondary" onClick={() => onNavigate("join")}>
              Join Project
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div className="status-badge connected">
          <span className="status-dot" />
          Connected
        </div>
        <h1>Project Dashboard</h1>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Project ID</div>
          <div className="stat-value mono">{status.projectId}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Default Branch</div>
          <div className="stat-value">{status.defaultBranch}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Listener Port</div>
          <div className="stat-value mono">{status.port}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Backend</div>
          <div className="stat-value mono small">
            {status.backendUrl?.replace("https://", "").replace("http://", "")}
          </div>
        </div>
      </div>

      <div className="dashboard-section">
        <h2>How It Works</h2>
        <div className="steps-list">
          <div className="step-item">
            <div className="step-number">1</div>
            <div className="step-content">
              <strong>Push your code</strong>
              <p>FlowSync's git hook captures every push automatically.</p>
            </div>
          </div>
          <div className="step-item">
            <div className="step-number">2</div>
            <div className="step-content">
              <strong>Add context</strong>
              <p>After each push, optionally add reasoning via Copilot Chat.</p>
            </div>
          </div>
          <div className="step-item">
            <div className="step-number">3</div>
            <div className="step-content">
              <strong>Stay in sync</strong>
              <p>Your team and AI agents always have project context.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="dashboard-section">
        <h2>Quick Actions</h2>
        <div className="actions-row">
          <button
            className="btn btn-secondary"
            onClick={() => vscode.postMessage({ type: "openOutput" })}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M4 6H20M4 12H20M4 18H12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            View Logs
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => vscode.postMessage({ type: "refreshStatus" })}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M1 4V10H7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M3.51 15A9 9 0 1 0 5.64 5.64L1 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Refresh
          </button>
        </div>
      </div>
    </div>
  );
}
