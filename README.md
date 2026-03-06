# FlowSync — Persistent Memory for AI Coding Agents

> *Give your AI agent project-wide context it never forgets.*

> **AI for Bharat Hackathon** | Powered by Amazon Bedrock
> Team **Vanta** — Aahil Khan, Anoushka Awasthi, Maulik Dang, Sanyam Wadhwa

---

## 🧠 What is FlowSync?

FlowSync gives AI coding agents — GitHub Copilot, Cursor, Claude — **persistent project memory** via the Model Context Protocol (MCP).

Your agent calls `log_context` to record *why* it made a decision, and `search_context` to recall what the team decided weeks ago. Five MCP tools turn your agent from a stateless autocomplete into a teammate that **remembers everything**.

For developers who don't use an AI agent, FlowSync also auto-captures context from every `git push` as a built-in fallback.

---

## 🚨 The Problem

AI coding agents are powerful but **stateless** — they lose all project context between sessions. Traditional tools can't fix this:

| Tool | Limitation |
|------|------------|
| **Git Logs** | Stores *what* changed, not *why* |
| **Documentation** | Requires manual updates; goes stale quickly |
| **AI Assistants** | No persistent memory across sessions |
| **Chat history** | Fragmented, unsearchable, per-user |

---

## ✅ How FlowSync Works

### 1. 🤖 Agent Logs — *`log_context`*
After completing a task, your AI agent calls `log_context` to record the decisions made, risks introduced, and reasoning — structured and searchable. This is FlowSync's **core value**: capturing the *why* behind code, not just the *what*.

### 2. 🔍 Agent Searches — *`search_context`*
Before starting work, your agent calls `search_context` with a natural-language question like *"what did we decide about auth?"* — and gets a grounded answer with source citations, powered by Titan Embeddings + Nova Pro RAG.

### 3. 📡 Auto-Capture Fallback — *Git Push*
For developers who don't use an AI agent, a post-push hook automatically sends diffs to **Amazon Bedrock (Nova Pro)** which extracts decisions, risks, tasks, and affected files. The project brain grows either way.

### 👥 Team Visibility*
Any team member can view the context timeline, chat with the project brain, or ask natural language questions from the web dashboard — no AI agent required.

---

## ✨ Key Features

- **`log_context` MCP Tool** — AI agent records decisions, risks, reasoning, and tasks after every unit of work
- **`search_context` MCP Tool** — AI agent queries project history with natural language; gets grounded, citation-backed answers
- **5 MCP Tools Total** — `get_project_context`, `get_recent_changes`, `search_context`, `log_context`, `get_events` — works with Copilot, Cursor, Claude
- **Auto-Capture Fallback** — Every git push triggers AI extraction via Nova Pro; project brain grows even without an AI agent
- **Strict Traceability & Source Citations** — Every AI insight is linked back to its originating commit or logged context, preventing hallucinations
- **Team Dashboard** — Real-time timeline of decisions, risks, and tasks across all branches and contributors

---

## 🏗️ Architecture

```
CLIENT LAYER                        BACKEND LAYER (AWS)
─────────────────────────────────────────────────────────────────
VS Code Extension (VSIX)            Amazon API Gateway
  ├── Git push hook         ──►         ├── Ingestion (Lambda)
  └── MCP Tool calls                    │     └── Validates, stores to DynamoDB
                                        │         Invokes AI processing async
                                        │
MCP Server (stdio)       ◄──►           ├── AI Processing (Lambda + Nova Pro)
  ├── get_project_context               │     └── Extracts context, embeddings,
  ├── get_recent_changes                │         merge propagation
  ├── search_context                    │
  ├── log_context                       ├── MCP Handler (Lambda)
  └── get_events                        │     └── Routes 5 MCP tool calls
                                        │
Web Dashboard (Next.js)  ◄──            ├── Query (Lambda + Nova Pro)
  (hosted on S3 + CloudFront)             │     └── Natural language Q&A, RAG
                                        │
                                        └── Chat (Lambda + Nova Lite)
                                              └── Conversational interface

STORAGE
  ├── flowsync-projects  — DynamoDB (project metadata + API tokens)
  ├── flowsync-events    — DynamoDB (raw push events)
  ├── flowsync-context   — DynamoDB (AI-extracted context + embeddings)
  ├── flowsync-cache     — DynamoDB (RAG response cache, 1-hr TTL)
  └── flowsync-raw-*     — S3 (raw event archive)
```

---

## 🔄 Process Flow

```
1. Agent works on task  →  2. Agent calls log_context   →  3. Context stored in Project Brain
        ↑                                                           ↓
6. Team views dashboard   ←  5. RAG answers with citations  ←  4. Agent calls search_context

                  ── Fallback: git push auto-captures diffs ──
```

**Key Actors:**
- **AI Agent** — Primary user; logs decisions via `log_context`, queries via `search_context`
- **Developer** — Codes normally; pushes trigger auto-capture as fallback
- **Team Lead / Member** — Views dashboard, chats with project brain

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| IDE Extension | TypeScript / Node.js (VS Code) |
| MCP Server | TypeScript, `@modelcontextprotocol/sdk`, stdio transport |
| API & Security | Amazon API Gateway (TLS 1.3, Bearer tokens, rate limiting) |
| Serverless Compute | AWS Lambda (Python 3.12) |
| AI / LLM | Amazon Bedrock — Nova Pro (intent extraction), Nova Lite (chat/Q&A) |
| Embeddings | Amazon Titan Text Embeddings v1 |
| Database | Amazon DynamoDB |
| Asset Storage | Amazon S3 |
| Frontend Dashboard | Next.js 14, React 18, Tailwind CSS, shadcn/ui — hosted on AWS S3 + CloudFront |

---

## 💰 Estimated Cost

| Component | AWS Service | Monthly Cost |
|-----------|-------------|--------------|
| Intent Extraction | Amazon Bedrock (Nova Pro) | ~₹420 ($5.00) |
| Chat & Q&A | Amazon Bedrock (Nova Lite) | ~₹85 ($1.00) |
| Embeddings | Amazon Titan Embeddings | ~₹84 ($1.00) |
| Compute | AWS Lambda | <₹170 ($2.00) |
| Storage | Amazon DynamoDB | ~₹420 ($5.00) |
| API & Network | Amazon API Gateway | ~₹265 ($3.15) |
| **Total** | | **~₹1,400 ($17.00) / month** |

> **~₹350 ($4.00) per developer per month** (4-person team)

### Why it's cost-effective:
- **Zero Idle Cost** — Serverless architecture means you pay ₹0 when the team isn't coding
- **High ROI** — Saving just a couple of hours of confusion per month makes it pay for itself
- **Linear Scalability** — Costs grow linearly with team activity, no sudden tier jumps

---

## �️ Why This Architecture

### DynamoDB over RDS
FlowSync ingests unpredictable bursts of developer events — spiky, bursty, schema-light workloads that would thrash a relational DB. DynamoDB delivers **single-digit millisecond reads** at any scale, and PAY_PER_REQUEST means **₹0 idle cost** overnight when teams aren't coding. A JOIN-heavy RDS instance would sit idle burning reserved capacity.

### Lambda over EC2 / ECS
There is no sustained load — events arrive in bursts during working hours then go silent. Lambda scales to **zero between events** and to **hundreds of concurrent executions** during a commit storm. EC2 or ECS would require capacity planning, health checks, and a baseline bill even at rest.

### Model Tiering — Nova Pro → Nova Lite
`us.amazon.nova-pro-v1:0` is used only for **high-value, once-per-commit intent extraction** where accuracy matters. `us.amazon.nova-lite-v1:0` handles **interactive chat and Q&A** where latency matters. This splits cost and latency: Pro costs ~4× more; routing cheaper queries to Lite cuts the AI bill by ~60% for typical usage.

### Async Ingestion Pipeline
The ingestion Lambda stores the raw event to DynamoDB immediately (200 ms latency), then fires `invokeAsync` to the AI processing Lambda. The developer's push hook gets an instant `200 OK` and is never blocked waiting on Bedrock. AI processing happens in the background within seconds.

### S3 Archival for Query Audit
Every raw event payload is also archived to S3 (`flowsync-raw-*`). This provides a **full audit trail** for debugging, compliance, and potential future ML training — at roughly ₹1.7/GB/month with no compute cost.

### API Gateway over ALB
API Gateway provides **built-in rate limiting, per-client API keys, request validation, and TLS termination** — all configured with a single CDK resource. An ALB would require a separate WAF, custom auth Lambda, and manual cert rotation.

### Titan Embeddings for RAG
Amazon Titan Text Embeddings v1 is **natively integrated** with Bedrock, requires no external vector DB, and stores 1,536-dimension embedding arrays directly in DynamoDB beside the context item. This eliminates the operational overhead of running a separate Pinecone or pgvector instance.

### Scrypt over Bcrypt for Token Hashing
Project API tokens are hashed with `scrypt` (N=16384, r=8, p=1). Scrypt is **memory-hard** (not just CPU-hard like bcrypt), making GPU-based brute-force attacks ~100× more expensive for an attacker, with no observable difference to the user.

---

## �🆚 FlowSync vs. Alternatives

| | FlowSync | Git Logs | Documentation | AI Assistants |
|--|---------|----------|---------------|---------------|
| AI agent can log & query context | ✅ | ❌ | ❌ | ❌ |
| Captures *why* changes happen | ✅ | ❌ | ❌ | ❌ |
| Auto-updated (no manual work) | ✅ | ✅ | ❌ | ❌ |
| Persistent project memory | ✅ | ❌ | ❌ | ❌ |
| Natural language Q&A with citations | ✅ | ❌ | ❌ | Partial |
| MCP-native (works with Copilot/Cursor) | ✅ | ❌ | ❌ | ❌ |

---

## 🎯 USP

- **Agent-First Architecture** — Built for AI agents as the primary user; MCP tools are the main interface, not an afterthought
- **Persistent Memory** — Unlike chat history, FlowSync stores structured, searchable project knowledge forever
- **Dual Input** — AI agent logging + automatic git push capture ensures no context is ever lost
- **Guaranteed Accountability** — Strict traceability and source citations prevent AI hallucinations about project facts
- **First of its kind** — The first system that gives AI coding agents persistent, project-wide memory via MCP

---

## 🚀 Quick Start

### Prerequisites
- VS Code 1.85+
- A git repository

### 1. Install the Extension
Download `flowsync-1.0.1.vsix` from the [Releases](https://github.com/anoushkawasthi/flowsync/releases) page or from the [FlowSync website](https://flowsync.aahil-khan.tech/).

```bash
code --install-extension flowsync-1.0.1.vsix
```

### 2. Initialize Your Project
Open your repo in VS Code. Click the **⚡ FlowSync** button in the status bar → **Initialize Project**.

FlowSync auto-detects your project name, languages, frameworks, and branch. You’ll receive a **Project ID** and **API Token** — save these and share the token with teammates.

### 3. Connect Your AI Agent
Your agent (Copilot, Cursor, Claude) should automatically discover 5 MCP tools: `log_context`, `search_context`, `get_project_context`, `get_recent_changes`, and `get_events`.

If not, add `.vscode/mcp.json` to your repo:
```jsonc
{
  "servers": {
    "flowsync": {
      "type": "stdio",
      "command": "node",
      "args": ["${workspaceFolder}/mcp-server/dist/index.js"],
      "env": {
        "FLOWSYNC_PROJECT_ID": "<your-project-id>",
        "FLOWSYNC_TOKEN": "${input:flowsync-token}"
      }
    }
  }
}
```

### 4. Start Working
- **Your AI agent** calls `log_context` after completing tasks and `search_context` before starting new work — automatically
- **Git pushes** are auto-captured as a fallback, even without an AI agent
- **Open the dashboard** at [flowsync.site](https://flowsync.aahil-khan.tech/) with your Project ID and Token

> **Try it now:** Visit the dashboard and click “Try Demo Project” to explore a live project — no setup needed.

---
## 📚 Documentation

- **[Technical Deep Dive](docs/technical-deep-dive.md)** — Full architecture, implementation details, MCP server, RAG pipeline, caching, security, and more
- **[Performance Report](docs/performance-report.md)** — Benchmark results, latency breakdowns, extraction accuracy, and cost analysis

---
## 👥 Team

| Name | Role |
|------|------|
| **Aahil Khan** | Team Leader |
| **Anoushka Awasthi** | Team Member |
| **Maulik Dang** | Team Member |
| **Sanyam Wadhwa** | Team Member |

---

*Built with ❤️ for the **AI for Bharat Hackathon***
