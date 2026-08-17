import { useEffect, useState } from "react";
import { Welcome } from "./components/Welcome";
import { InitProject } from "./components/InitProject";
import { JoinProject } from "./components/JoinProject";
import { Dashboard } from "./components/Dashboard";
import { CatchMeUp } from "./components/CatchMeUp";
import { Chat } from "./components/Chat";
import { ProjectContext } from "./components/ProjectContext";
import { vscode } from "./utilities/vscode";

type View =
  | "loading"
  | "welcome"
  | "init"
  | "join"
  | "dashboard"
  | "chat"
  | "catchMeUp"
  // Rendered only in the activity-bar view; FlowSyncSidebar navigates here on ready.
  | "sidebar";

function App() {
  const [view, setView] = useState<View>("loading");

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const message = event.data;
      if (message.type === "navigate" && message.view) {
        setView(message.view as View);
      }
    };
    window.addEventListener("message", handler);

    // Notify extension that the webview is ready — extension responds with navigate immediately
    vscode.postMessage({ type: "ready" });

    // Fallback: if extension doesn't respond within 1s, show welcome screen
    const fallback = setTimeout(() => {
      setView((current) => (current === "loading" ? "welcome" : current));
    }, 1000);

    return () => {
      window.removeEventListener("message", handler);
      clearTimeout(fallback);
    };
  }, []);

  const navigate = (v: string) => setView(v as View);

  // Chat owns the full viewport height (its message list scrolls internally), so
  // it opts out of the shared padded shell rather than sitting inside it.
  if (view === "chat") {
    return <Chat />;
  }

  // The sidebar has its own tighter padding — app-shell's max-width and gutters
  // are sized for the editor panel.
  if (view === "sidebar") {
    return <ProjectContext />;
  }

  return (
    <div className="app-shell">
      {view === "loading" && (
        <div className="loading-view">
          <span className="spinner spinner-lg" />
          <p>Loading FlowSync…</p>
        </div>
      )}
      {view === "welcome" && <Welcome onNavigate={navigate} />}
      {view === "init" && <InitProject onNavigate={navigate} />}
      {view === "join" && <JoinProject onNavigate={navigate} />}
      {view === "dashboard" && <Dashboard onNavigate={navigate} />}
      {view === "catchMeUp" && <CatchMeUp onNavigate={navigate} />}
    </div>
  );
}

export default App;
