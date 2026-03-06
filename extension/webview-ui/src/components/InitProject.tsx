import { useState, useEffect } from "react";
import { vscode } from "../utilities/vscode";

const LANGUAGE_OPTIONS = [
  "JavaScript",
  "TypeScript",
  "Python",
  "Go",
  "Java",
  "Rust",
  "C++",
  "C#",
  "Ruby",
  "PHP",
  "Swift",
  "Kotlin",
];

interface InitProjectProps {
  onNavigate: (view: string) => void;
}

interface FormErrors {
  name?: string;
  description?: string;
  languages?: string;
  defaultBranch?: string;
}

export function InitProject({ onNavigate }: InitProjectProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [languages, setLanguages] = useState<string[]>([]);
  const [defaultBranch, setDefaultBranch] = useState("main");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [autoDetected, setAutoDetected] = useState(false);
  const [hasGit, setHasGit] = useState<boolean | null>(null);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    token?: string;
  } | null>(null);

  const validate = (): boolean => {
    const newErrors: FormErrors = {};
    if (!name || !/^[a-zA-Z0-9-_]+$/.test(name)) {
      newErrors.name = "Use only letters, numbers, hyphens, and underscores";
    }
    if (!description || description.trim().length < 5) {
      newErrors.description = "Please provide a meaningful description (5+ characters)";
    }
    if (languages.length === 0) {
      newErrors.languages = "Select at least one language";
    }
    if (!defaultBranch || defaultBranch.trim().length === 0) {
      newErrors.defaultBranch = "Default branch is required";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const toggleLanguage = (lang: string) => {
    setLanguages((prev) =>
      prev.includes(lang) ? prev.filter((l) => l !== lang) : [...prev, lang]
    );
    if (errors.languages) {
      setErrors((prev) => ({ ...prev, languages: undefined }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    setResult(null);
    vscode.postMessage({
      type: "initProject",
      data: { name, description, languages, defaultBranch },
    });
  };

  // On mount, request auto-detected metadata from the extension
  useEffect(() => {
    vscode.postMessage({ type: "requestAutoDetect" });
  }, []);

  // Listen for results and auto-detected metadata from the extension
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const message = event.data;
      if (message.type === "initResult") {
        setLoading(false);
        setResult(message);
      } else if (message.type === "autoDetect") {
        const d = message.data;
        setHasGit(d.hasGit === true);
        if (d.name)                        setName(d.name);
        if (d.description)                 setDescription(d.description);
        if (d.languages?.length > 0)       setLanguages(d.languages);
        if (d.defaultBranch)               setDefaultBranch(d.defaultBranch);
        setAutoDetected(true);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  // Show blocker before the form if no git repo is detected
  if (hasGit === false) {
    return (
      <div className="form-container">
        <button className="back-button" onClick={() => onNavigate("welcome")}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M19 12H5M12 19L5 12L12 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back
        </button>
        <div className="no-git-view">
          <div className="no-git-icon">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.8" />
              <path d="M12 7v5M12 16h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <h2>No Git repository found</h2>
          <p>FlowSync requires a git repository in your workspace root. Initialise one first, then come back.</p>
          <div className="no-git-command">
            <code>git init</code>
          </div>
          <p className="no-git-hint">Open a terminal in your workspace and run the command above, then click Retry.</p>
          <button
            className="btn btn-primary"
            onClick={() => vscode.postMessage({ type: "requestAutoDetect" })}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (result?.success) {
    return (
      <div className="form-container">
        <div className="success-view">
          <div className="success-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
              <path d="M8 12L11 15L16 9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h2>Project Initialized!</h2>
          <p className="success-message">{result.message}</p>
          {result.token && (
            <div className="token-display">
              <label>API Token (share with your team)</label>
              <div className="token-box">
                <code>{result.token}</code>
                <button
                  className="btn btn-sm"
                  onClick={() => vscode.postMessage({ type: "copyToken", token: result.token })}
                >
                  Copy
                </button>
              </div>
              <p className="token-warning">
                ⚠ This token will not be shown again. Make sure to copy it now.
              </p>
            </div>
          )}
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
        <h1>Initialize Project</h1>
        <p>Set up FlowSync for your project. This will create config files and register with the backend.</p>
      </div>

      {autoDetected && (
        <div className="auto-detect-notice">
          ✦ Fields pre-filled from your project files — review and confirm before submitting.
        </div>
      )}

      <form onSubmit={handleSubmit} className="project-form">
        <div className={`form-group ${errors.name ? "has-error" : ""}`}>
          <label htmlFor="project-name">Project Name</label>
          <input
            id="project-name"
            type="text"
            placeholder="my-awesome-project"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
            }}
            disabled={loading}
            autoFocus
          />
          {errors.name && <span className="field-error">{errors.name}</span>}
        </div>

        <div className={`form-group ${errors.description ? "has-error" : ""}`}>
          <label htmlFor="project-desc">Description</label>
          <textarea
            id="project-desc"
            placeholder="What does this project do? (1-3 sentences)"
            rows={3}
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              if (errors.description) setErrors((prev) => ({ ...prev, description: undefined }));
            }}
            disabled={loading}
          />
          {errors.description && <span className="field-error">{errors.description}</span>}
        </div>

        <div className={`form-group ${errors.languages ? "has-error" : ""}`}>
          <label>Languages</label>
          <div className="chip-grid">
            {LANGUAGE_OPTIONS.map((lang) => (
              <button
                key={lang}
                type="button"
                className={`chip ${languages.includes(lang) ? "chip-selected" : ""}`}
                onClick={() => toggleLanguage(lang)}
                disabled={loading}
              >
                {lang}
              </button>
            ))}
          </div>
          {errors.languages && <span className="field-error">{errors.languages}</span>}
        </div>

        <div className={`form-group ${errors.defaultBranch ? "has-error" : ""}`}>
          <label htmlFor="default-branch">Default Branch</label>
          <input
            id="default-branch"
            type="text"
            placeholder="main"
            value={defaultBranch}
            onChange={(e) => {
              setDefaultBranch(e.target.value);
              if (errors.defaultBranch) setErrors((prev) => ({ ...prev, defaultBranch: undefined }));
            }}
            disabled={loading}
          />
          {errors.defaultBranch && <span className="field-error">{errors.defaultBranch}</span>}
        </div>

        <div className="form-actions">
          <button type="submit" className="btn btn-primary btn-lg" disabled={loading}>
            {loading ? (
              <>
                <span className="spinner" />
                Creating Project...
              </>
            ) : (
              "Initialize Project"
            )}
          </button>
        </div>

        {result && !result.success && (
          <div className="form-error-banner">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
              <path d="M12 8V12M12 16H12.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            {result.message}
          </div>
        )}
      </form>
    </div>
  );
}
