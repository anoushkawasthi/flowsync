# FlowSync

**AI-powered context layer for AI-assisted development teams.**

Every time your team pushes code, FlowSync automatically captures *what* was built, *why* it was decided, and *what risks* were introduced — and makes that knowledge queryable by both humans and AI agents.

Built for the **AI for Bharat 2026** · Powered by **AWS Bedrock** (Nova Pro + Titan Embeddings) + **DynamoDB**

---

## Features

- **Zero-config context capture** — a post-push git hook is installed automatically; every `git push` sends the diff to the AI backend without any manual input
- **AI-powered extraction** — Claude (Nova Pro) analyses each diff and extracts: feature summary, decisions made, risks introduced, pending tasks, and affected files
- **Vector search via MCP** — Titan Embeddings index all context records; AI coding agents can query your project history over the Model Context Protocol
- **Catch Me Up** — run one command to see a human-readable summary of everything your teammates pushed while you were away, with smart deduplication
- **Merge propagation** — when a branch is merged, all context records are automatically copied to the target branch so history is never lost
- **Team memory** — team leads generate a shared API token; all teammates push context to the same project, building a living knowledge base

---

## Quick Start

### Team lead — initialize a new project

1. Open the repo folder in VS Code
2. Press `Ctrl+Shift+P` → **FlowSync: Initialize Project**
3. Enter project name, description, primary language, and default branch
4. Copy the generated API token and share it with your team securely
5. Commit `.flowsync.json` and `.github/copilot-instructions.md` to the repo
6. Push — FlowSync captures your first context record automatically

### Team members — join an existing project

1. Clone the repo (`.flowsync.json` is already there)
2. Press `Ctrl+Shift+P` → **FlowSync: Join Project**
3. Paste the API token from your team lead
4. Push normally — your context is captured from now on

---

## Commands

| Command | Description |
|---|---|
| `FlowSync: Initialize Project` | Create a new FlowSync project and generate a team API token |
| `FlowSync: Join Project` | Join an existing project using a shared API token |
| `FlowSync: Catch Me Up` | Summarize everything pushed by teammates since you last checked |
| `FlowSync: Open Dashboard` | Open the web dashboard for your project |
| `FlowSync: Show Status` | Display current project config and connection status |

---

## MCP Integration

FlowSync exposes an MCP server so your AI coding agent can query project context directly.

Add this to your MCP client config (e.g. Claude Desktop, Copilot agent mode):

```json
{
  "mcpServers": {
    "flowsync": {
      "command": "npx",
      "args": ["-y", "flowsync-mcp"],
      "env": {
        "FLOWSYNC_PROJECT_ID": "<your-project-id>",
        "FLOWSYNC_TOKEN": "<your-api-token>"
      }
    }
  }
}
```

Your agent can then ask questions like:
- *"What did we decide about authentication?"*
- *"What risks were introduced in the payments branch?"*
- *"Summarize what the team built last week"*

---

## Extension Settings

| Setting | Default | Description |
|---|---|---|
| `flowsync.apiUrl` | `https://86tzell2w9.execute-api.us-east-1.amazonaws.com/prod` | Backend API endpoint |
| `flowsync.projectId` | *(from `.flowsync.json`)* | Your project's unique ID |
| `flowsync.token` | *(stored in Secret Storage)* | API token for authentication |

Settings are typically auto-populated from `.flowsync.json` in your repo — manual configuration is rarely needed.

---

## Requirements

- VS Code 1.109 or later
- Git installed and available on `PATH`
- A git repository (`.git` folder present anywhere in the directory tree)
- Internet access to reach the FlowSync API

---

## Release Notes

### 1.2.0
- Merge propagation: context records automatically copied to target branch on merge
- Workspace root auto-detection: walks up the directory tree to find `.git`
- Catch Me Up timestamp fix: checkpoint only advances when you view the summary

### 1.1.0
- Catch Me Up command with AI-powered diff summarization
- MCP tools: `query_context`, `get_recent_context`, `get_project_summary`
- Merge visual badge on dashboard context cards

### 1.0.0
- Initial release: project init, team join, automatic context capture on push, AI extraction via AWS Bedrock Nova Pro
