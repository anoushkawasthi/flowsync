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
  ├── Git commits          ──►         ├── Event Ingestion (Lambda)
  ├── File saves                       │     └── Validates, stores to DynamoDB
  └── MCP Tool calls                   │
                                       ├── AI Processing (Lambda + Nova Pro)
MCP Server (stdio)       ◄──►          │     └── Extracts intent, features, decisions
  ├── get_project_context              │         Embeds with Titan Embeddings
  ├── get_recent_changes               │
  ├── search_context (RAG)             ├── MCP Handler (Lambda)
  └── log_context                      │     └── Routes 4 MCP tool calls
                                       │
Web Dashboard (Next.js)  ◄──           ├── Query (Lambda + Nova Lite)
  ├── Project summary                  │     └── Natural language Q&A, RAG pipeline
  ├── Feature timeline                 │
  ├── Branch compare                   └── Chat (Lambda + Nova Lite)
  └── Conversational chat                    └── Hybrid RAG conversational interface

STORAGE & DELIVERY
  ├── Context DB     — DynamoDB (events, embeddings, project metadata)
  ├── VSIX & Assets  — Amazon S3
  └── Dashboard CDN  — Amazon CloudFront
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
| Frontend Dashboard | Next.js 14, React 18, Tailwind CSS, shadcn/ui |
| CDN | Amazon CloudFront |

---

## 💰 Estimated Cost

| Component | AWS Service | Monthly Cost |
|-----------|-------------|--------------|
| Intent Extraction | Amazon Bedrock (Nova Pro) | ~₹420 ($5.00) |
| Chat & Q&A | Amazon Bedrock (Nova Lite) | ~₹85 ($1.00) |
| Embeddings | Amazon Titan Embeddings | ~₹84 ($1.00) |
| Compute | AWS Lambda | <₹170 ($2.00) |
| Storage | Amazon DynamoDB | ~₹420 ($5.00) |
| API, CDN & Network | API Gateway + CloudFront | ~₹265 ($3.15) |
| **Total** | | **~₹1,445 ($17.15) / month** |

> **~₹360 ($4.30) per developer per month** (4-person team)

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

## 🗺️ Roadmap

- [x] Core VS Code Extension (VSIX)
- [x] Amazon Bedrock intent extraction (Nova Pro)
- [x] DynamoDB Knowledge Graph with vector embeddings
- [x] Web Dashboard (Next.js + CloudFront)
- [x] Natural Language Q&A Interface (Nova Lite RAG)
- [x] MCP Server — 4 tools for GitHub Copilot integration
- [x] Conversational Chat with hybrid RAG
- [x] Pagination & timestamp filtering for MCP tools
- [ ] Mobile View *(coming soon)*
- [ ] Multi-IDE support (JetBrains, Neovim)
- [ ] GitHub / GitLab deep integration
- [ ] Team analytics & productivity insights
- [ ] Branch merge history propagation

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
