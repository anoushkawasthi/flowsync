import { vscode } from "../utilities/vscode";
import logo from '../assets/logo.png';

interface WelcomeProps {
  onNavigate: (view: string) => void;
}

export function Welcome({ onNavigate }: WelcomeProps) {
  return (
    <div className="welcome-container">
      <div className="welcome-header">
        <img src={logo} alt="FlowSync" className="welcome-logo" style={{ width: 56, height: 56, borderRadius: 12, objectFit: 'contain' }} />
        <h1 className="welcome-title">FlowSync</h1>
        <p className="welcome-subtitle">
          AI-powered context layer for AI-assisted development teams
        </p>
      </div>

      <div className="card-grid">
        <button
          className="action-card"
          onClick={() => {
            onNavigate("init");
            vscode.postMessage({ type: "navigate", view: "init" });
          }}
        >
          <div className="card-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 5V19M5 12H19"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <h2 className="card-title">Initialize Project</h2>
          <p className="card-description">
            Set up FlowSync for a new project. Creates config files, registers
            with the backend, and generates an API token for your team.
          </p>
          <span className="card-action">Get Started &rarr;</span>
        </button>

        <button
          className="action-card"
          onClick={() => {
            onNavigate("join");
            vscode.postMessage({ type: "navigate", view: "join" });
          }}
        >
          <div className="card-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
              <path
                d="M16 21V19C16 16.7909 14.2091 15 12 15H5C2.79086 15 1 16.7909 1 19V21"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <circle
                cx="8.5"
                cy="7"
                r="4"
                stroke="currentColor"
                strokeWidth="2"
              />
              <path
                d="M20 8V14M17 11H23"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <h2 className="card-title">Join Project</h2>
          <p className="card-description">
            Join an existing FlowSync project using an API token shared by your
            team lead. Requires a .flowsync.json in the repo.
          </p>
          <span className="card-action">Connect &rarr;</span>
        </button>
      </div>

      <div className="welcome-footer">
        <p>
          Already configured? FlowSync will auto-connect when a{" "}
          <code>.flowsync.json</code> file is detected.
        </p>
      </div>
    </div>
  );
}
