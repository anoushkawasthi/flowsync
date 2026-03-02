import { useState } from "react";
import { vscode } from "../utilities/vscode";

interface JoinProjectProps {
  onNavigate: (view: string) => void;
}

export function JoinProject({ onNavigate }: JoinProjectProps) {
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || token.trim().length < 8) {
      setError("Token looks too short — paste the full token");
      return;
    }
    setLoading(true);
    setError(null);
    vscode.postMessage({
      type: "joinProject",
      data: { token: token.trim() },
    });
  };

  // Listen for results from the extension
  useState(() => {
    const handler = (event: MessageEvent) => {
      const message = event.data;
      if (message.type === "joinResult") {
        setLoading(false);
        if (message.success) {
          setSuccess(true);
        } else {
          setError(message.message || "Failed to join project");
        }
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  });

  if (success) {
    return (
      <div className="form-container">
        <div className="success-view">
          <div className="success-icon">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="var(--vscode-testing-iconPassed)" strokeWidth="2" />
              <path d="M8 12L11 15L16 9" stroke="var(--vscode-testing-iconPassed)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h2>Connected!</h2>
          <p className="success-message">
            FlowSync is now active. Your pushes will be captured automatically.
          </p>
          <button className="btn btn-primary" onClick={() => onNavigate("dashboard")}>
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="form-container">
      <button className="back-button" onClick={() => onNavigate("welcome")}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M19 12H5M12 19L5 12L12 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Back
      </button>

      <div className="form-header">
        <h1>Join Project</h1>
        <p>
          Enter the API token shared by your team lead to connect to an existing
          FlowSync project.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="project-form">
        <div className={`form-group ${error ? "has-error" : ""}`}>
          <label htmlFor="api-token">API Token</label>
          <input
            id="api-token"
            type="password"
            placeholder="Paste your FlowSync API token"
            value={token}
            onChange={(e) => {
              setToken(e.target.value);
              if (error) setError(null);
            }}
            disabled={loading}
            autoFocus
          />
          <span className="field-hint">
            Your team lead received this token when initializing the project.
          </span>
          {error && <span className="field-error">{error}</span>}
        </div>

        <div className="form-actions">
          <button type="submit" className="btn btn-primary btn-lg" disabled={loading}>
            {loading ? (
              <>
                <span className="spinner" />
                Validating...
              </>
            ) : (
              "Join Project"
            )}
          </button>
        </div>
      </form>

      <div className="info-callout">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
          <path d="M12 16V12M12 8H12.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <div>
          <strong>Don't have a token?</strong>
          <p>
            Ask your team lead to run "FlowSync: Initialize Project" and share the
            generated API token with you.
          </p>
        </div>
      </div>
    </div>
  );
}
