# FlowSync

**AI-powered context layer for AI-assisted development teams.**

Every time your team pushes code, FlowSync automatically captures *what* was built, *why* it was decided, and *what risks* were introduced — and makes that knowledge queryable by both humans and AI agents.

Built for the **AI for Bharat Hackathon** · Powered by **AWS Bedrock** (Nova Pro + Titan Embeddings) + **DynamoDB**

---

## Features

- **Zero-config context capture** — a post-push git hook is installed automatically; every `git push` sends the diff to the AI backend without any manual input
- **AI-powered extraction** — AWS Bedrock Nova Pro analyses each diff and extracts: feature summary, decisions made, risks introduced, pending tasks, and affected files
- **Vector search via MCP** — Titan Embeddings index all context records; AI coding agents can query your project history over the Model Context Protocol using 5 built-in tools
- **Catch Me Up** — one command summarises everything your teammates pushed since you last checked, with deduplication across authors and branches
- **Merge propagation** — when a branch is merged, all context records are automatically copied to the target branch so history is never lost
- **Team memory** — team leads generate a shared API token; all teammates push context to the same project, building a living knowledge base

---

## Quick Start

### Team lead — initialize a new project

1. Open the repo folder in VS Code
2. Press `Ctrl+Shift+P` → **FlowSync: Open Dashboard**
3. Click **Initialize Project** in the panel
4. Enter project name, description, primary language, and default branch
5. Copy the generated API token and share it with your team securely
6. Commit `.flowsync.json` and `.github/copilot-instructions.md` to the repo
7. Push — FlowSync captures your first context record automatically

### Team members — join an existing project

1. Clone the repo (`.flowsync.json` is already there)
2. Press `Ctrl+Shift+P` → **FlowSync: Open Dashboard**
3. Click **Join Project** and paste the API token from your team lead
4. Push normally — your context is captured from now on

---

## Commands

The extension registers two commands in the Command Palette (`Ctrl+Shift+P`):

| Command | Description |
|---|---|
| `FlowSync: Open Dashboard` | Opens the FlowSync panel — initialize, join, view context, and chat |
| `FlowSync: Catch Me Up` | Summarizes all teammate pushes since you last checked |

Project initialization and joining are done inside the **Open Dashboard** panel UI, not as separate commands.

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
      "description": "FlowSync API token — find it in .flowsync.json",
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
- Internet access to reach the FlowSync API

---

## Release Notes

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
