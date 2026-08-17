import { useEffect, useState } from "react";
import { vscode } from "../utilities/vscode";
import { IconList, IconRefresh, IconUnplug } from "./icons";

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
          <p>Loading project status…</p>
        </div>
      </div>
    );
  }

  if (!status || !status.connected) {
    return (
      <div className="dashboard-container">
        <div className="empty-state">
          <span className="empty-state-icon">
            <IconUnplug size={20} />
          </span>
          <h2>Not connected</h2>
          <p>No active FlowSync project detected in this workspace.</p>
          <div className="empty-state-actions">
            <button className="btn btn-primary" onClick={() => onNavigate("init")}>
              Initialize project
            </button>
            <button className="btn btn-secondary" onClick={() => onNavigate("join")}>
              Join project
            </button>
          </div>
        </div>

        {/* Onboarding steps belong here, in the disconnected state — on a
            connected dashboard they are noise above the data you came for. */}
        <div className="dashboard-section">
          <h2>How it works</h2>
          <div className="steps-list">
            <div className="step-item">
              <div className="step-number">1</div>
              <div className="step-content">
                <strong>Push your code</strong>
                <p>FlowSync&apos;s git hook captures every push automatically.</p>
              </div>
            </div>
            <div className="step-item">
              <div className="step-number">2</div>
              <div className="step-content">
                <strong>Add context</strong>
                <p>After each push, optionally add reasoning via your AI agent.</p>
              </div>
            </div>
            <div className="step-item">
              <div className="step-number">3</div>
              <div className="step-content">
                <strong>Stay in sync</strong>
                <p>Your team and your agents always have the project context.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      {/* A full-width banner rather than a badge floating above a heading. */}
      <div className="dashboard-header">
        <h1>Project dashboard</h1>
        <span className="status-badge connected">
          <span className="status-dot" />
          Connected
        </span>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Project ID</div>
          <div className="stat-value mono small">{status.projectId}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Default branch</div>
          <div className="stat-value">{status.defaultBranch}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Listener port</div>
          <div className="stat-value mono">{status.port}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Backend</div>
          <div className="stat-value mono small">
            {status.backendUrl?.replace(/^https?:\/\//, "")}
          </div>
        </div>
      </div>

      <div className="dashboard-section">
        <h2>Quick actions</h2>
        <div className="actions-row">
          <button className="btn btn-secondary" onClick={() => onNavigate("catchMeUp")}>
            <IconList size={14} />
            Catch me up
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => vscode.postMessage({ type: "refreshStatus" })}
          >
            <IconRefresh size={14} />
            Refresh
          </button>
          <button
            className="btn btn-ghost"
            onClick={() => vscode.postMessage({ type: "openOutput" })}
          >
            View logs
          </button>
        </div>
      </div>
    </div>
  );
}
