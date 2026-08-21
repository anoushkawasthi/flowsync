import { vscode } from "../utilities/vscode";
import { IconPlus, IconUsers, IconChevronRight } from "./icons";

interface WelcomeProps {
  onNavigate: (view: string) => void;
}

declare global {
  interface Window {
    __FLOWSYNC_LOGO__?: string;
  }
}

export function Welcome({ onNavigate }: WelcomeProps) {
  const logo = window.__FLOWSYNC_LOGO__ ?? "";

  const go = (view: string) => {
    onNavigate(view);
    vscode.postMessage({ type: "navigate", view });
  };

  return (
    <div className="welcome-container">
      <div className="welcome-header">
        {/* The tile treatment is in CSS now — this used to carry an inline
            borderRadius:12 that no token controlled. */}
        {logo && <img src={logo} alt="" className="welcome-logo" />}
        <h1 className="welcome-title">BuildBerry</h1>
        <p className="welcome-subtitle">
          Persistent project context for you and your AI agents.
        </p>
      </div>

      <div className="card-grid">
        <button className="action-card" onClick={() => go("init")}>
          <span className="card-icon">
            <IconPlus size={18} />
          </span>
          <span className="card-title">Initialize project</span>
          <span className="card-description">
            Set up BuildBerry for a new project. Creates the config, registers with the backend, and
            generates an API token for your team.
          </span>
          <span className="card-action">
            Get started <IconChevronRight size={12} />
          </span>
        </button>

        <button className="action-card" onClick={() => go("join")}>
          <span className="card-icon">
            <IconUsers size={18} />
          </span>
          <span className="card-title">Join project</span>
          <span className="card-description">
            Join an existing project with a token from your team lead. Requires a
            <code> .flowsync.json</code> in the repo.
          </span>
          <span className="card-action">
            Connect <IconChevronRight size={12} />
          </span>
        </button>
      </div>

      <div className="welcome-footer">
        <p>
          Already configured? BuildBerry auto-connects when a <code>.flowsync.json</code> is detected.
        </p>
      </div>
    </div>
  );
}
