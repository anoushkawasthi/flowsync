# BuildBerry

*Persistent Memory for AI Coding Agents.*

**Give your AI agent project-wide context it never forgets — via MCP tools.**

Your AI agent calls `log_context` to record decisions after every task and `search_context` to recall project history before starting new work. For developers who don't use an AI agent, every git push still auto-captures context as a fallback.

Built for the **AI for Bharat Hackathon** · Powered by **AWS Bedrock** (Nova Pro + Titan Embeddings) + **DynamoDB**

---

## Features

- **`log_context` — Agent records reasoning** — after every task, your AI agent logs decisions, risks, and rationale via the MCP tool; this is BuildBerry's core value
- **`search_context` — Agent queries history** — natural language questions get grounded answers with source citations via Titan Embeddings + Nova Pro RAG
- **5 MCP tools for AI agents** — works with GitHub Copilot, Cursor, Claude, and any MCP-compatible agent out of the box
- **Auto-capture fallback** — a post-push git hook captures diffs automatically; Nova Pro extracts context even without an AI agent
- **Catch Me Up** — one command summarises everything your teammates pushed since you last checked
- **Merge propagation** — when a branch is merged, all context records are automatically copied to the target branch
- **Team memory** — shared API token lets all teammates contribute to the same project brain

---

## Quick Start

### Team lead — initialize a new project

1. Open the repo folder in VS Code
2. Press `Ctrl+Shift+P` → **BuildBerry: Open Dashboard**
3. Click **Initialize Project** in the panel
4. Enter project name, description, primary language, and default branch
5. Copy the generated API token and share it with your team securely
6. Commit `.flowsync.json` and `.github/copilot-instructions.md` to the repo
7. Push — BuildBerry captures your first context record automatically

### Team members — join an existing project

1. Clone the repo (`.flowsync.json` is already there)
2. Press `Ctrl+Shift+P` → **BuildBerry: Open Dashboard**
3. Click **Join Project** and paste the API token from your team lead
4. Push normally — your context is captured from now on

---

## Where BuildBerry lives in VS Code

**Activity bar** — the BuildBerry icon opens a **Project Context** sidebar showing
your project's live context: open risks, pending tasks and recent activity, with
counts across the top. Below that, a collapsible **Agent tools** section lists the
five MCP tools and tells you whether your `.vscode/mcp.json` is actually wired to
this project — including the silent case where it exists but points somewhere
else. Multi-step flows (initialize, join, chat, catch-up) open in the full editor
panel, which has the room for them.

**Status bar** — a BuildBerry item on the left, tinted to show whether the current
workspace is connected. Click it to open the dashboard. Hide it with
`flowsync.statusBar.enabled`.

### Commands

| Command | Keybinding | Description |
|---|---|---|
| `BuildBerry: Open Dashboard` | `Ctrl/Cmd+Alt+F` | Opens the panel — status, context, and chat |
| `BuildBerry: Catch Me Up` | `Ctrl/Cmd+Alt+U` | Summarises teammate pushes since you last checked |
| `BuildBerry: Ask BuildBerry` | — | Opens the chat view |
| `BuildBerry: Record Reasoning` | `Ctrl/Cmd+Alt+R` | Log the *why* behind your work without an AI agent |
| `BuildBerry: Open Web Dashboard` | — | Copies your credentials and opens the web dashboard |
| `BuildBerry: Initialize Project` | — | Creates a project and issues an API token |
| `BuildBerry: Join Project` | — | Connects to an existing project with a token |
| `BuildBerry: Refresh Status` | — | Re-reads config and connection state |
| `BuildBerry: Show Logs` | — | Opens the BuildBerry output channel |

Initialize and Join only appear in the palette when the workspace is *not* yet
connected; Catch Me Up and Refresh only appear when it is.

### Settings

| Setting | Default | Description |
|---|---|---|
| `flowsync.backendUrl` | `""` | Override the backend URL |
| `flowsync.dashboardUrl` | `""` | Override the web dashboard URL |
| `flowsync.showPushNotification` | `true` | Prompt to add reasoning after each push |
| `flowsync.autoOpenOutput` | `false` | Open the Output panel on activation |
| `flowsync.statusBar.enabled` | `true` | Show BuildBerry in the status bar |

---

## MCP Integration

The MCP server is **bundled inside the extension** and exposes 5 tools to GitHub Copilot and other MCP-compatible agents.

### VS Code (Copilot agent mode)

Add a `.vscode/mcp.json` to your workspace:

```jsonc
{
  "inputs": [
    {
      "id": "flowsync-token",
      "type": "promptString",
      "description": "BuildBerry API token — find it in .flowsync.json",
      "password": true
    }
  ],
  "servers": {
    "flowsync": {
      "type": "stdio",
      "command": "node",
      "args": ["${workspaceFolder}/mcp-server/dist/index.js"],
      "env": {
        "FLOWSYNC_API_URL": "https://86tzell2w9.execute-api.us-east-1.amazonaws.com/prod",
        "FLOWSYNC_PROJECT_ID": "<your-project-id>",
        "FLOWSYNC_TOKEN": "${input:flowsync-token}"
      }
    }
  }
}
```

### Available MCP tools

| Tool | Description |
|---|---|
| `get_project_context` | Get AI-extracted context records for a branch (paginated) |
| `get_recent_changes` | Get the most recent records across all branches, with optional `since` filter |
| `search_context` | Ask a natural language question — RAG search via Titan Embeddings + Nova Pro |
| `log_context` | Record the WHY behind your work: decisions, risks, and reasoning |
| `get_events` | Fetch raw context records from the dashboard API (requires token) |

### Example agent queries

- *"What did we decide about authentication?"*
- *"What risks were introduced in the payments branch?"*
- *"Summarize what the team built last week"*
- *"Log my decision: chose JWT over sessions for stateless horizontal scaling"*

---

## Requirements

- VS Code 1.109 or later
- Git installed and available on `PATH`
- A git repository (`.git` folder present anywhere in the directory tree)
- Internet access to reach the BuildBerry API

---

## Release Notes

See [CHANGELOG.md](CHANGELOG.md) for the full history.

### 1.2.0
- Project Context sidebar now shows live risks, tasks and recent activity
- Agent tools surfaced with an mcp.json wiring diagnostic
- New `Record Reasoning` and `Open Web Dashboard` commands
- Fixed: `flowsync.backendUrl` was never read by any code

### 1.1.0
- Rebuilt the entire UI on a neobrutalist design system: hard borders, flat
  offset shadows, muted palette, Archivo + JetBrains Mono
- New activity-bar container with a **Project Context** sidebar view
- Commands now use a proper `BuildBerry` category, plus keybindings, context-aware
  palette filtering, SCM and view-title menu entries
- Added settings for the backend URL, push notifications, output auto-open and
  the status bar
- Status bar reflects connection state with a themable colour
- Webview now follows your VS Code light/dark/high-contrast theme instead of
  forcing its own dark palette
- Fonts are bundled, so the panel renders correctly offline and under the CSP
- New square logo (the old one was 500x300 and was being squashed everywhere)
- Fixed: the Output panel no longer force-opens on every activation
- Fixed: `Initialize Project` and `Join Project` were registered nowhere and
  were unreachable

### 0.0.1
- Initial prototype release for AI for Bharat Hackathon
- Project init and team join via webview panel UI
- Automatic context capture on every `git push` via post-push hook
- AI extraction via AWS Bedrock Nova Pro: feature, decision, risk, tasks, affected files
- Titan Embeddings for vector search
- Catch Me Up command — summarises teammate pushes since last checkpoint
- 5 MCP tools: `get_project_context`, `get_recent_changes`, `search_context`, `log_context`, `get_events`
- Merge propagation: context copied to target branch on merge
- Workspace root auto-detection via `.git` directory walk
- Merge visual badge on dashboard context cards
