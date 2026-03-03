import { useEffect, useState } from "react";
import { Welcome } from "./components/Welcome";
import { InitProject } from "./components/InitProject";
import { JoinProject } from "./components/JoinProject";
import { Dashboard } from "./components/Dashboard";
import { Chat } from "./components/Chat";
import "./App.css";

type View = "welcome" | "init" | "join" | "dashboard" | "chat";

function App() {
  const [view, setView] = useState<View>("welcome");

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const message = event.data;
      if (message.type === "navigate" && message.view) {
        setView(message.view as View);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  const navigate = (v: string) => setView(v as View);

  return (
    <div className="app-shell">
      {view === "welcome" && <Welcome onNavigate={navigate} />}
      {view === "init" && <InitProject onNavigate={navigate} />}
      {view === "join" && <JoinProject onNavigate={navigate} />}
      {view === "dashboard" && <Dashboard onNavigate={navigate} />}
      {view === "chat" && <Chat />}
    </div>
  );
}

export default App;
