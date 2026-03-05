# FlowSync — AI-Native Project Development System

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
  (deployed to Vercel)                  │     └── Natural language Q&A, RAG
                                        │
                                        └── Chat (Lambda + Nova Lite)
                                              └── Conversational interface

STORAGE
  ├── flowsync-projects  — DynamoDB (project metadata + API tokens)
  ├── flowsync-events    — DynamoDB (raw push events)
  ├── flowsync-context   — DynamoDB (AI-extracted context + embeddings)
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
| Frontend Dashboard | Next.js 14, React 18, Tailwind CSS, shadcn/ui (deployed to Vercel) |

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

## 🆚 FlowSync vs. Alternatives

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

## 👥 Team

| Name | Role |
|------|------|
| **Aahil Khan** | Team Leader |
| **Anoushka Awasthi** | Team Member |
| **Maulik Dang** | Team Member |
| **Sanyam Wadhwa** | Team Member |

---

*Built with ❤️ for the **AI for Bharat Hackathon***
