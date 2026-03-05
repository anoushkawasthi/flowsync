# FlowSync MCP Server

TypeScript MCP server that exposes FlowSync project context as tools for GitHub Copilot and other MCP-compatible AI agents.

---

## Overview

The MCP server wraps the FlowSync API Gateway — all heavy lifting (Bedrock RAG, DynamoDB reads, embedding search) happens in the existing Lambda functions. The MCP server is a thin adapter that:

1. Accepts tool calls from an AI agent over stdio
2. Translates them into HTTP requests to the FlowSync API
3. Returns structured JSON results back to the agent

**The server is bundled into the VS Code extension** (`dist/mcp-server.mjs`) and started automatically when the extension activates. For development it can also be run standalone.

---

## Tools

| Tool | Description |
|---|---|
| `get_project_context` | Get AI-extracted context records for a branch, newest-first. Supports `limit` and `nextToken` pagination. |
| `get_recent_changes` | Get the most recent N records across all branches. Supports optional `branch` filter and `since` ISO timestamp. |
| `search_context` | Ask a natural language question — uses Titan Embeddings cosine similarity to find relevant records, then Nova Pro generates a grounded answer with source citations. |
| `log_context` | Record the WHY behind your work: decisions, reasoning, risks, and pending tasks. Merged into the most recent push record if within 30 minutes. |
| `get_events` | Fetch raw context records from the dashboard API. Requires `FLOWSYNC_TOKEN`. |

---

## Configuration

All config is via environment variables:

| Variable | Required | Description |
|---|---|---|
| `FLOWSYNC_API_URL` | No | API Gateway base URL. Defaults to the production endpoint. |
| `FLOWSYNC_PROJECT_ID` | Yes | Default project ID — used when a tool call omits `projectId`. |
| `FLOWSYNC_TOKEN` | For `get_events` | Bearer token for authenticated endpoints. |

---

## Usage with VS Code (Copilot agent mode)

Add `.vscode/mcp.json` to your workspace root:

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

Once added, Copilot agent mode will automatically discover and use the FlowSync tools.

---

## Development

```bash
cd mcp-server
npm install

# Build
npm run build          # tsc → dist/

# Run standalone (for testing)
FLOWSYNC_PROJECT_ID=<id> FLOWSYNC_TOKEN=<token> npm start

# Watch mode
npm run dev

# Bundle into extension (run from mcp-server dir)
npm run bundle         # esbuild → ../extension/dist/mcp-server.mjs
```

---

## Tech stack

- TypeScript, Node.js 20
- [`@modelcontextprotocol/sdk`](https://github.com/modelcontextprotocol/typescript-sdk) — MCP server framework
- `zod` — tool parameter schema validation
- `esbuild` — bundles into a single `.mjs` for the extension
