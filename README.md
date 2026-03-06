# FlowSync — AI-Native Project Development System

> *Code Collaboration, Reimagined.*

> **AI for Bharat Hackathon** | Powered by Amazon Bedrock
> Team **Vanta** — Aahil Khan, Anoushka Awasthi, Maulik Dang, Sanyam Wadhwa

---

## 🧠 What is FlowSync?

FlowSync is an **AI-native development intelligence system** that transforms raw, fragmented coding activities — VS Code events, commits, file changes — into a structured, living **"Project Brain."**

It solves the **"lost context" problem** in AI-assisted development teams by ensuring every code change, decision, and architectural shift is traceable, searchable, and visualized in real-time.

---

## 🚨 The Problem

When developers write code, the *reasoning* behind that code is often lost in chat logs or forgotten entirely. Traditional tools fall short:

| Tool | Limitation |
|------|-----------|
| **Git Logs** | Stores *what* changed, not *why* |
| **Documentation** | Requires manual updates; goes stale quickly |
| **AI Assistants (e.g., ChatGPT)** | No persistent memory of project state |

---

## ✅ How FlowSync Works

### 1. 👀 It Watches — *Capture*
A lightweight **VS Code Extension** quietly captures development events (file saves, Git commits, active window changes) in the background with zero developer friction.

### 2. 🤔 It Thinks — *AI Processing*
Raw event data is processed by **Amazon Bedrock (Nova Pro + Nova Lite + Titan Embeddings)**, which analyzes code diffs and commits to extract developer *intent* — e.g., *"This commit fixes a bug in the login system"* or *"This adds a new payment feature."*

### 3. 🧩 It Remembers — *Knowledge Graph*
Extracted intelligence is saved into a **"Project Brain"** — a persistent, structured Knowledge Graph in DynamoDB — connecting features, files, and decisions. Unlike a chatbot, this brain remembers the *entire project history forever*.

### 4. 💬 It Answers — *Dashboard & Q&A*
Any team member can ask natural language questions like:
- *"Why did we switch to SQS?"*
- *"What is the status of the Auth module?"*
- *"Who changed the database last week?"*

The system returns instant, accurate, source-cited answers.

---

## ✨ Key Features

- **Automated Context Ingestion** — VS Code Extension captures events silently in the background
- **AI-Powered Intent Extraction** — AWS Bedrock deduces reasoning behind every code change
- **Dynamic Knowledge Graph** — Living project map in DynamoDB, updated in real-time
- **Natural Language Project Q&A** — Query your project like a conversation
- **Strict Traceability & Source Citations** — Every AI insight is linked back to its originating commit or IDE event, preventing hallucinations
- **Automated Status Visibility** — Real-time view of what the team is building; no more manual Jira updates

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
1. Initialize Project  →  2. Define Features  →  3. Code Normally
        ↑                                               ↓
9. Query System                               4. Capture Events (VS Code hooks)
        ↑                                               ↓
8. Visualize Dashboard  ←  7. Update State  ←  5. Ingest Events (validate + store)
                                    ↑                   ↓
                            6. AI Processing  ←─────────┘
                         (extract context, infer intent)

                        ──── Continuous Loop ────
```

**Key Actors:**
- **Developer** — Codes, commits, adds notes
- **Team Lead** — Approves features, monitors progress
- **Team Member** — Queries system, views dashboard

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
| API & Network | Amazon API Gateway | ~₹170 ($2.00) |
| **Total** | | **~₹1,349 ($16.00) / month** |

> **~₹337 ($4.00) per developer per month** (4-person team)

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
| Captures *why* changes happen | ✅ | ❌ | ❌ | ❌ |
| Auto-updated | ✅ | ✅ | ❌ | ❌ |
| Persistent project memory | ✅ | ❌ | ❌ | ❌ |
| Natural language Q&A | ✅ | ❌ | ❌ | ✅ |
| Source-cited, hallucination-free | ✅ | ✅ | ✅ | ❌ |

---

## 🎯 USP

- **Deterministic AI** — Humans define structure; AI interprets activity. Guarantees correctness.
- **Intelligence Layer** — Doesn't just *track* development — it *understands* it.
- **Guaranteed Accountability** — Strict traceability prevents AI hallucinations about project facts.
- **First of its kind** — Combines activity tracking, reasoning extraction, and structured memory in one platform.

---

## � Quick Start

### Prerequisites
- AWS CLI configured (`aws configure`) with Bedrock access enabled in `us-east-1`
- Node.js 20+, Python 3.12+, AWS CDK v2 (`npm i -g aws-cdk`)
- VS Code 1.85+

### 1. Deploy Backend
```bash
git clone https://github.com/your-org/flowsync
cd flowsync/frontend && npm install && npm run build     # produces frontend/out/
cd ../infra && npm install
cdk bootstrap   # first time only
cdk deploy      # deploys all Lambda, DynamoDB, API Gateway, CloudFront
```
> After deploy, CDK prints `ApiUrl` and `FrontendUrl` — copy both.

### 2. Install VS Code Extension
```bash
code --install-extension extension/flowsync-1.0.0.vsix
```
Open Command Palette → **FlowSync: Initialize Project** — paste your `ApiUrl` and project token.

### 3. Configure MCP Server (optional, for Claude/Cursor)
Add to your MCP client config:
```json
{
  "mcpServers": {
    "flowsync": {
      "command": "node",
      "args": ["path/to/flowsync/mcp-server/dist/index.js"],
      "env": { "FLOWSYNC_API_URL": "<ApiUrl>", "FLOWSYNC_TOKEN": "<token>" }
    }
  }
}
```

### 4. Open Dashboard
Visit the `FrontendUrl` printed by CDK — sign in with your project token.

> **Note:** `DEMO_TOKEN` (`demo-token-123`) is an intentional demo credential wired to the hosted demo. Remove it in production by deleting the `demo-projects` seeding in the ingestion Lambda.

---

## �👥 Team

| Name | Role |
|------|------|
| **Aahil Khan** | Team Leader |
| **Anoushka Awasthi** | Team Member |
| **Maulik Dang** | Team Member |
| **Sanyam Wadhwa** | Team Member |

---

*Built with ❤️ for the **AI for Bharat Hackathon***
