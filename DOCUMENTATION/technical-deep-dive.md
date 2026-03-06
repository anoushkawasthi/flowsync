# FlowSync — Technical Deep Dive

> This document covers the internal architecture, implementation details, and design decisions behind FlowSync.
> For setup and usage, see the [README](../README.md).

---

## Table of Contents

1. [MCP Server — 5-Tool Agent Integration](#1-mcp-server--5-tool-agent-integration)
2. [Event Capture Pipeline](#2-event-capture-pipeline)
3. [AI-Powered Intent Extraction](#3-ai-powered-intent-extraction)
4. [RAG Search Pipeline](#4-rag-search-pipeline)
5. [Caching Layer](#5-caching-layer)
6. [Bidirectional Record Merging](#6-bidirectional-record-merging)
7. [Branch Merge Propagation](#7-branch-merge-propagation)
8. [Retry & Fallback Mechanics](#8-retry--fallback-mechanics)
9. [Smart Project Auto-Detection](#9-smart-project-auto-detection)
10. [Chat Interface — Hybrid RAG](#10-chat-interface--hybrid-rag)
11. [Catch Me Up](#11-catch-me-up)
12. [Traceability & Audit Trail](#12-traceability--audit-trail)
13. [Security Model](#13-security-model)
14. [System Flow Diagrams](#14-system-flow-diagrams)
15. [Full Architecture Diagram](#15-full-architecture-diagram)
16. [UI/UX Wireframes](#16-uiux-wireframes)
17. [DynamoDB Schema](#17-dynamodb-schema)
18. [Performance Targets & Results](#18-performance-targets--results)
19. [Scalability](#19-scalability)
20. [Future Scope](#20-future-scope)

---

## 1. MCP Server — 5-Tool Agent Integration

The MCP Server is the centrepiece of FlowSync. It exposes five tools to AI coding agents (GitHub Copilot, Claude Desktop, Cursor) through the Model Context Protocol over stdio transport. The server is bundled directly inside the VS Code extension VSIX — no separate install.

### Tool Reference

| Tool | Purpose | Key Implementation Detail |
|------|---------|--------------------------|
| `get_project_context` | Branch-aware context retrieval with pagination | Merges feature branch + main records, deduplicates by feature name |
| `search_context` | Natural language RAG search with source citations | Auto-scoped to current git branch; pass `branch: "all"` for cross-branch |
| `get_recent_changes` | Latest activity across branches | Supports `since` time filter and configurable limit (1–50) |
| `log_context` | Record the WHY behind code changes | Merges into most recent push within 30 minutes; re-embeds for search |
| `get_events` | Raw event listing for a project | Authenticated via Bearer token; supports branch/since/limit filters |

### Branch Auto-Scoping

At startup, the MCP server runs `git rev-parse --abbrev-ref HEAD` to detect the current branch and uses it as the default scope for `search_context`. An agent working on `feature/auth` automatically searches only that branch's records — no cross-branch pollution from unrelated features.

Pass `branch: "all"` to escape the default and search across every branch.

### Copilot Instructions

On project init, FlowSync writes `.github/copilot-instructions.md` that teaches Copilot to:
1. Call `search_context` before starting any new task
2. Call `log_context` after completing every unit of work
3. Use `get_recent_changes` when asked about recent activity
4. Use `get_project_context` for full branch context

This ensures agents call the tools proactively without the developer asking.

---

## 2. Event Capture Pipeline

### Extension-Side Capture

The VS Code extension installs a `pre-push` git hook silently during project init. A local HTTP listener receives the hook signal and captures:

- Commit hash, message, author, timestamp
- Full diff (up to 50KB)
- Changed files list
- Branch name
- Merge commit detection (for branch propagation)

The payload is transmitted to the backend via authenticated `POST /api/v1/events` with a Bearer token. Zero developer friction — no manual logging required.

### Server-Side Ingestion (Node.js 20 Lambda)

The ingestion Lambda processes each event in three steps:

1. **Validate** — Schema check (UUID v4 project ID, 40-char hex commit hash, ISO 8601 timestamps, diff max 50,000 chars)
2. **Store** — Write to `flowsync-events` DynamoDB table + archive raw JSON to S3
3. **Dispatch** — Fire-and-forget async invoke of the AI Processing Lambda

Response time: **167–184ms warm**, **398ms cold**. The developer's push hook gets an instant `200 OK` and is never blocked waiting on Bedrock.

### Merge Detection

When the ingestion Lambda detects a merge commit (e.g., `Merge branch 'feature/auth' into main`), it triggers context propagation to copy all source-branch context records to the target branch.

---

## 3. AI-Powered Intent Extraction

The AI Processing Lambda (Python 3.12, 512MB, 60s timeout) runs Amazon Nova Pro at temperature=0 via the Bedrock Converse API. It extracts structured fields from each push:

| Field | Description |
|-------|-------------|
| `feature` | Feature name or short description of what changed |
| `decision` | Why this change was made — architectural rationale |
| `tasks` | Specific tasks completed or remaining |
| `stage` | One of: `Setup`, `Feature Development`, `Refactoring`, `Bug Fix`, `Testing`, `Documentation` |
| `risk` | Any risks introduced by this change |
| `entities` | Affected function names, class names, filenames |

### Dynamic Confidence Scoring

Confidence is computed deterministically after extraction — not self-assessed by the model:

```
confidence = 0.55 (base)
            + 0.15 (if decision populated)
            + 0.15 (if risk populated)
            + 0.10 (if tasks populated)
            + 0.05 (if 2+ entities identified)
```

Range: 0.55–1.0. Gives reliable signal about extraction completeness without relying on LLM self-evaluation.

### Benchmarked Performance

- **857ms** warm average (Nova Pro inference)
- **112ms** average for Titan embedding generation
- **~91%** of total processing time is Bedrock inference
- Cold start penalty: **+472ms** (Python 3.12 Lambda init)

---

## 4. RAG Search Pipeline

The full Retrieval-Augmented Generation pipeline used by `search_context`, the dashboard search, and the chat interface:

### Step-by-Step

1. **Cache check** — SHA-256 key from `{project_id}:{query}:{branch or 'all'}`. On HIT, return immediately with `cached: true` flag
2. **Embed query** — Amazon Titan Embeddings v1 produces a 1536-dimension vector (~112ms)
3. **Fetch context records** — Paginated DynamoDB query via `BranchContextIndex` (branch-scoped) or `ProjectContextIndex` (all branches). Fetches ALL pages, not just the first
4. **Cosine similarity** — Compute similarity between query vector and every stored embedding
5. **Branch affinity scoring** — When searching without a branch filter, non-main records receive a **0.85× penalty** to prevent cross-branch pollution
6. **Top-5 selection** — Highest similarity records are selected as RAG context
7. **Nova Pro answer generation** — Model receives the top-5 records and generates a grounded answer at temperature=0.3. Falls back to Nova Lite on throttle
8. **Cache write** — Store the response in DynamoDB with 1-hour TTL
9. **Return** — Answer + source citations (commit hash, timestamp, author, relevance score)

### Re-Embedding on Enrichment

When `log_context` adds reasoning, decision, risk, or tasks to an existing record, the embedding is **regenerated** from the enriched content. This ensures the RAG pipeline can find records based on the newly added context — not just the original auto-extracted fields.

---

## 5. Caching Layer

FlowSync caches RAG search responses in DynamoDB to avoid redundant Bedrock calls.

### Implementation

- **Table:** `flowsync-cache` (DynamoDB, on-demand)
- **Key:** SHA-256 hash of `{project_id}:{query}:{branch or 'all'}`
- **TTL:** 1 hour (`expiresAt` attribute, DynamoDB TTL)
- **Scope:** Used by Query Lambda, MCP Lambda, and Chat Lambda (all three call `search_context_rag()`)

### Cache Behaviour

| Scenario | Action |
|----------|--------|
| Cache HIT | Return cached response immediately with `cached: true` flag. Skips embedding, DynamoDB scan, and Bedrock inference |
| Cache MISS | Run full RAG pipeline → write result to cache → return |
| Cache failure | Non-fatal. Logs warning, continues with full pipeline. System never breaks due to cache |

### Why It Matters

The RAG pipeline is the most expensive operation in FlowSync: embedding (~112ms) + full DynamoDB scan + Nova Pro inference (~857ms). Caching eliminates all of this for repeated queries within the same hour. Agents often ask similar questions across sessions — the cache turns ~1.3s responses into near-instant ones.

---

## 6. Bidirectional Record Merging

FlowSync supports two workflows that both produce a single unified context record — never duplicates:

### Direction A — Push First

1. Developer pushes code
2. AI Processing Lambda extracts context (feature, entities, etc.)
3. Agent later calls `log_context` within 30 minutes
4. `log_context` finds the most recent push record and merges reasoning, decision, risk, tasks into it
5. Record is re-embedded with the enriched content

### Direction B — Log First

1. Agent calls `log_context` before any push (orphaned record)
2. Developer pushes code
3. AI Processing Lambda finds the orphaned record (same project, within 30 minutes)
4. Merges AI-extracted fields into the orphan record
5. Re-embeds the combined content

Both directions produce one context record. The 30-minute merge window prevents stale matches while covering the typical code→push→reflect cycle.

---

## 7. Branch Merge Propagation

When a merge commit is detected (e.g., `feature/auth` merged into `main`):

1. Ingestion Lambda identifies the source branch from the merge commit
2. All non-failed context records from the source branch are queried
3. Each record is copied to the target branch in the context table
4. `main` always has the complete project history, including features developed on separate branches

This ensures that searching `main` returns the full project brain, even for work done on feature branches.

---

## 8. Retry & Fallback Mechanics

### Bedrock Retry Configuration

All Python Lambda functions (query, MCP, chat, AI processing) use adaptive retry:

```python
BotoConfig(retries={'max_attempts': 3, 'mode': 'adaptive'})
```

Adaptive mode handles Bedrock throttling with exponential backoff automatically.

### Model Fallback

When Nova Pro returns a `ThrottlingException`, `ModelTimeoutException`, or `ServiceUnavailableException`, the system falls back to Nova Lite:

```
Primary:  us.amazon.nova-pro-v1:0  (higher accuracy, higher cost)
Fallback: us.amazon.nova-lite-v1:0 (lower cost, faster, 75% cheaper)
```

The fallback fires after the primary model fails — not as a parallel request. This keeps costs down while ensuring availability.

### Extension-Side Retry

The VS Code extension retries failed API calls 4 times with exponential backoff: `[0, 1, 2, 4]` seconds.

---

## 9. Smart Project Auto-Detection

On `Initialize Project`, the extension scans the workspace to detect:

| Detected | Sources |
|----------|---------|
| **Project name** | `package.json`, `pyproject.toml`, `Cargo.toml`, `go.mod`, or folder name |
| **Languages** (8) | TypeScript, JavaScript, Python, Go, Rust, Java, C#, C++ |
| **Frameworks** (15) | React, Next.js, Vue, Angular, Express, NestJS, Svelte, Django, Flask, FastAPI, AWS CDK, and more |
| **Default branch** | Current git branch or remote HEAD |
| **Description** | First paragraph of `README.md` |

### Monorepo Support

Scans root, `src/`, and immediate child directories to detect languages and frameworks in monorepos.

### Fast Path

If all metadata is detected, a single confirmation click creates the project — no forms. Blocks init if no `.git` directory found.

---

## 10. Chat Interface — Hybrid RAG

The chat system uses a **hybrid classification** approach:

1. Nova Lite receives the user's question
2. If the question is factual (about the project), it triggers the RAG pipeline → Nova Pro generates a grounded answer → Nova Lite presents it conversationally
3. If the question is general guidance, Nova Lite responds directly — no RAG overhead

### Session Management

- DynamoDB-backed sessions with 30-minute TTL
- Max 10 messages per session (prevents unbounded context growth)
- Markdown rendering with syntax highlighting

---

## 11. Catch Me Up

Triggers automatically when a developer returns after 4+ hours of inactivity:

1. Aggregates all pushes since last activity
2. Summarizes: decisions made, risks flagged, tasks completed, per-branch activity
3. Available as a VS Code command, panel view, or webview tab

---

## 12. Traceability & Audit Trail

- Every AI-generated insight links back to its source commit hash, diff, author, and timestamp
- Immutable audit log in `flowsync-audit` DynamoDB table tracks all state changes (push received, context extracted, reasoning logged)
- Grounded generation with Nova Pro — answers only use content from retrieved records
- Every extraction emits structured `BENCHMARK_LOG` JSON for production monitoring

---

## 13. Security Model

### Token Authentication

- **256-bit tokens** — Generated via `crypto.randomBytes(32)` (64-char hex string)
- **Scrypt hashing** — `crypto.scryptSync` (Node.js) / `hashlib.scrypt` (Python) with N=16384, r=8, p=1
- **Random salts** — 16-byte salt per token, stored alongside hash
- **Timing-safe comparison** — `crypto.timingSafeEqual` (Node.js) + `hmac.compare_digest` (Python)
- **Shown once** — Token displayed at project creation (auto-copied to clipboard), then only hash stored
- **VS Code SecretStorage** — API token never written to disk

### Why Scrypt over Bcrypt

Scrypt is **memory-hard** (not just CPU-hard like bcrypt), making GPU-based brute-force attacks ~100× more expensive for attackers. No observable difference to the user.

### Input Validation

- UUID v4 for project IDs
- 40-char hex for commit hashes
- ISO 8601 for timestamps
- Diff max 50,000 characters
- CORS configured on API Gateway

---

## 14. System Flow Diagrams

### End-to-End Process Flow

```
┌──────────────┐
│  Developer    │
│  pushes code  │
└──────┬───────┘
       │
       ▼
┌──────────────────┐     Git pre-push hook fires
│  VS Code          │     automatically
│  Extension         │────────────────────────────┐
│  (Hook Listener)   │                            │
└──────────────────┘                              │
       │                                          │
       │  Captures: diff, commit, author,         │
       │  branch, merge info, changed files       │
       │                                          │
       ▼                                          │
┌──────────────────┐                              │
│  POST /api/v1/    │  Bearer Token Auth          │
│  events            │◄───────────────────────────┘
└──────┬───────────┘
       │
       ▼
┌──────────────────────────────────────────────────┐
│                 AWS API Gateway                    │
│              (REST API + CORS)                     │
└──────┬───────────────────────────────────────────┘
       │
       ▼
┌──────────────────┐     ┌──────────────────────┐
│  Ingestion Lambda │────▶│  DynamoDB             │
│  (Node.js 20)     │     │  (events table)       │
│                    │     └──────────────────────┘
│  • Validates schema│     ┌──────────────────────┐
│  • Stores event    │────▶│  S3 Bucket            │
│  • Returns ~300ms  │     │  (raw event archive)  │
└──────┬───────────┘      └──────────────────────┘
       │
       │  Async Invoke (fire-and-forget)
       ▼
┌──────────────────────────────────────────────────┐
│       AI Processing Lambda (Python 3.12)           │
│                                                    │
│  1. Call Bedrock Nova Pro (temperature=0)           │
│     → Extract: feature, decision, tasks,           │
│       stage, risk, entities (~857ms warm)           │
│                                                    │
│  2. compute_confidence() → deterministic 0.55–1.0  │
│                                                    │
│  3. Call Titan Embeddings v1                        │
│     → Generate 1536-dim vector (~112ms)            │
│                                                    │
│  4. Write to DynamoDB (context table)               │
│                                                    │
│  5. Handle orphan merging (Direction B)             │
│  6. Handle branch merge propagation                 │
└──────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────────┐
│                   QUERY / CONSUMPTION LAYER                   │
│                                                               │
│  ┌───────────────┐  ┌───────────┐  ┌───────────────────────┐ │
│  │ Web Dashboard  │  │   Chat    │  │  MCP Server (5 tools) │ │
│  │ (Next.js 14)   │  │ (Nova     │  │  (Copilot / Claude    │ │
│  │ 6 routes       │  │  Lite)    │  │   Integration)        │ │
│  └─────┬──────────┘  └─────┬─────┘  └───────┬──────────────┘ │
│        │                   │                 │                 │
│        └───────────────────┼─────────────────┘                 │
│                            ▼                                   │
│              ┌─────────────────────────┐                       │
│              │   Shared RAG Pipeline    │                       │
│              │   Titan Embed Query      │                       │
│              │   → Branch-Aware Cosine  │                       │
│              │   → Top-5 + Nova Pro     │                       │
│              │   → Source Citations      │                       │
│              └─────────────────────────┘                       │
└───────────────────────────────────────────────────────────────┘
```

### Use Case Diagram

```
                      ┌──────────────────────────────────────┐
                      │           FlowSync System             │
                      │                                       │
┌──────────┐          │  ┌─────────────────────────────────┐  │
│AI Agent  │──────────│─▶│ get_project_context (MCP)       │  │
│(Copilot/ │          │  │  Branch-aware, paginated         │  │
│ Claude)  │──────────│─▶│ search_context (MCP + RAG)      │  │
│          │          │  │  Auto-scoped to current branch   │  │
│ PRIMARY  │──────────│─▶│ get_recent_changes (MCP)        │  │
│ USER     │          │  │  Time-filtered activity feed     │  │
│          │──────────│─▶│ log_context (MCP)                │  │
│          │          │  │  Persist reasoning + re-embed    │  │
│          │──────────│─▶│ get_events (MCP)                 │  │
│          │          │  │  Raw event access                │  │
└──────────┘          │  └─────────────────────────────────┘  │
                      │                                       │
┌──────────┐          │  ┌─────────────────────────────────┐  │
│Developer │──────────│─▶│ Initialize / Join Project        │  │
│          │          │  │  Auto-detect, hook install, MCP   │  │
│          │──────────│─▶│ Push Code (auto-captured)        │  │
│          │          │  │  Hook → ingestion → AI → context  │  │
│          │──────────│─▶│ Catch Me Up (after 4h absence)   │  │
│          │          │  │  AI-summarized changelog          │  │
│          │──────────│─▶│ Search / Chat (Dashboard)        │  │
│          │          │  │  RAG answers with citations       │  │
└──────────┘          │  └─────────────────────────────────┘  │
                      │                                       │
┌──────────┐          │  ┌─────────────────────────────────┐  │
│Team Lead │──────────│─▶│ View Dashboard (Timeline)        │  │
│          │──────────│─▶│ Review Analytics (Contributors)  │  │
│          │──────────│─▶│ Configure Settings               │  │
└──────────┘          │  └─────────────────────────────────┘  │
                      │                                       │
                      └──────────────────────────────────────┘
```

---

## 15. Full Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          FLOWSYNC SYSTEM ARCHITECTURE                           │
└─────────────────────────────────────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────────────────────────────────┐
  │                           CLIENT LAYER                                       │
  │                                                                              │
  │  ┌──────────────────┐   ┌──────────────────┐   ┌──────────────────────────┐ │
  │  │  VS Code Extension│   │   Web Dashboard  │   │   AI Agents (Copilot)    │ │
  │  │  TypeScript        │   │   Next.js 14     │   │   via MCP Server         │ │
  │  │                    │   │   React 18       │   │   (stdio transport)      │ │
  │  │  • Git Hook        │   │   Tailwind CSS   │   │                          │ │
  │  │  • Event Capture   │   │   Radix UI       │   │  • get_project_context   │ │
  │  │  • Hook Listener   │   │   Recharts       │   │  • search_context        │ │
  │  │  • Webview Panel   │   │                  │   │  • get_recent_changes    │ │
  │  │  • MCP Config      │   │  Pages:          │   │  • log_context           │ │
  │  │  • Auto-Detect     │   │  • Dashboard     │   │  • get_events            │ │
  │  │                    │   │  • Analytics     │   │                          │ │
  │  │  Commands:         │   │  • Search        │   │  Features:               │ │
  │  │  • Catch Me Up     │   │  • Chat          │   │  • Branch auto-detect    │ │
  │  │  • Open Dashboard  │   │  • Settings      │   │  • 'all' escape hatch    │ │
  │  │                    │   │                  │   │  • Re-embed on enrich    │ │
  │  └────────┬───────────┘   └────────┬─────────┘   └────────────┬─────────────┘ │
  └───────────┼────────────────────────┼──────────────────────────┼──────────────┘
              │                        │                          │
              │    HTTPS + Bearer Token Auth                      │
              └────────────────────────┼──────────────────────────┘
                                       │
  ┌────────────────────────────────────▼──────────────────────────────────────────┐
  │                          AWS API GATEWAY (REST)                               │
  │                                                                               │
  │  POST /api/v1/projects          POST /api/v1/events                           │
  │  GET  /api/v1/projects/{id}     GET  /api/v1/projects/{id}/events             │
  │  POST /api/v1/query             POST /api/v1/chat                             │
  │  POST /mcp                                                                    │
  └────────────┬──────────────┬──────────────┬──────────────┬─────────────────────┘
               │              │              │              │
  ┌────────────▼───┐  ┌──────▼───────┐  ┌──▼──────────┐  ┌▼──────────────────────┐
  │  Ingestion      │  │  Query       │  │  Chat       │  │  MCP Lambda           │
  │  Lambda         │  │  Lambda      │  │  Lambda     │  │  (Python 3.12)        │
  │  (Node.js 20)   │  │  (Python)    │  │  (Python)   │  │                       │
  │  256 MB / 10s   │  │  256MB / 30s │  │  512MB / 30s│  │  5 tool handlers      │
  │                 │  │              │  │             │  │  256MB / 30s           │
  │  • Validate     │  │  • Timeline  │  │  • Session  │  │                       │
  │  • Store event  │  │  • RAG search│  │    mgmt     │  │  • Pagination         │
  │  • Archive S3   │  │              │  │  • Nova Lite│  │  • Branch inheritance  │
  │  • Async invoke │  │              │  │  • RAG      │  │  • RAG search          │
  │  • Merge detect │  │              │  │  • Hybrid   │  │  • Re-embed on enrich  │
  └───────┬────────┘  └──────┬───────┘  └──────┬──────┘  └───────┬───────────────┘
          │                  │                 │                  │
          │  Async           │                 │                  │
          ▼                  │                 │                  │
  ┌──────────────────┐       │     ┌───────────▼──────────────────▼───────────────┐
  │  AI Processing    │       │     │            SHARED LAMBDA LAYER               │
  │  Lambda           │       │     │            (Python 3.12)                     │
  │  (Python 3.12)    │       │     │                                              │
  │  512 MB / 60s     │       │     │  • auth.py — Token verification (scrypt)     │
  │                   │       │     │  • helpers.py — RAG pipeline, embeddings,    │
  │  • Nova Pro       │       │     │    cosine similarity, branch affinity,        │
  │    (temp=0)       │       │     │    caching, DynamoDB helpers, pagination      │
  │  • Titan Embed    │       │     └──────────────────────────────────────────────┘
  │  • Confidence     │       │
  │  • Orphan merge   │       │
  │  • Branch propagate       │
  └──────────┬────────┘       │
             │                │
  ┌──────────▼────────────────▼──────────────────────────────────────────────────┐
  │                        AWS BEDROCK (AI LAYER)                                │
  │                                                                              │
  │  ┌─────────────────────┐  ┌──────────────────┐  ┌────────────────────────┐  │
  │  │  Amazon Nova Pro     │  │  Amazon Nova Lite │  │  Amazon Titan          │  │
  │  │  (us.amazon.nova-    │  │  (us.amazon.nova- │  │  Embeddings v1         │  │
  │  │   pro-v1:0)          │  │   lite-v1:0)      │  │  (amazon.titan-embed-  │  │
  │  │                      │  │                   │  │   text-v1)             │  │
  │  │  Temperature: 0      │  │  Temperature: 0.7 │  │  Dimension: 1536      │  │
  │  │  Max tokens: 2000    │  │  Max tokens: 2000 │  │                        │  │
  │  │                      │  │                   │  │  Used for:             │  │
  │  │  Used for:           │  │  Used for:        │  │  • Query embedding     │  │
  │  │  • Intent extraction │  │  • Chat responses │  │  • Context embedding   │  │
  │  │  • RAG answer gen    │  │  • Conversational │  │  • Cosine similarity   │  │
  │  │    (temp=0.3)        │  │    dialogue       │  │  • Branch affinity     │  │
  │  └─────────────────────┘  └──────────────────┘  └────────────────────────┘  │
  └──────────────────────────────────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────────────────────────────────┐
  │                         STORAGE LAYER                                        │
  │                                                                              │
  │  ┌──────────────────────────────────────────────────────────────────────┐    │
  │  │                     Amazon DynamoDB (On-Demand)                       │    │
  │  │                                                                      │    │
  │  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐   │    │
  │  │  │ flowsync-     │  │ flowsync-    │  │ flowsync-context          │   │    │
  │  │  │ projects      │  │ events       │  │                           │   │    │
  │  │  │               │  │              │  │ PK: eventId               │   │    │
  │  │  │ PK: projectId │  │ PK: projectId│  │ GSI: ProjectContextIndex  │   │    │
  │  │  │               │  │ SK: ts#evtId │  │ GSI: BranchContextIndex   │   │    │
  │  │  │ Stores:       │  │              │  │                           │   │    │
  │  │  │ • name        │  │ GSI:         │  │ Stores:                    │   │    │
  │  │  │ • languages   │  │ EventIdIndex │  │ • feature, decision        │   │    │
  │  │  │ • frameworks  │  │ BranchIndex  │  │ • tasks, stage, risk       │   │    │
  │  │  │ • tokenHash   │  │              │  │ • entities, confidence     │   │    │
  │  │  │ • teamMembers │  │              │  │ • embedding (1536-dim)     │   │    │
  │  │  └──────────────┘  └──────────────┘  │ • agentReasoning           │   │    │
  │  │                                      └──────────────────────────┘   │    │
  │  │  ┌──────────────┐  ┌────────────────────────┐  ┌──────────────┐     │    │
  │  │  │ flowsync-     │  │ flowsync-chat-sessions │  │ flowsync-    │     │    │
  │  │  │ audit         │  │                        │  │ cache        │     │    │
  │  │  │               │  │ PK: sessionId          │  │              │     │    │
  │  │  │ PK: entityId  │  │ TTL: 30 min            │  │ PK: cacheKey │     │    │
  │  │  │ SK: timestamp │  │ Max 10 messages/session │  │ TTL: 1 hour  │     │    │
  │  │  │               │  │                        │  │              │     │    │
  │  │  │ Immutable log │  │                        │  │ RAG cache    │     │    │
  │  │  └──────────────┘  └────────────────────────┘  └──────────────┘     │    │
  │  └──────────────────────────────────────────────────────────────────────┘    │
  │                                                                              │
  │  ┌──────────────────────────────────────┐                                    │
  │  │  Amazon S3                            │                                    │
  │  │  flowsync-raw-events-{account}        │                                    │
  │  │  Raw event JSON archive               │                                    │
  │  └──────────────────────────────────────┘                                    │
  └──────────────────────────────────────────────────────────────────────────────┘
```

---

## 16. UI/UX Wireframes

### VS Code Extension Panel

```
┌──────────────────────────────────────────────────┐
│  FlowSync                                    ✕   │
├──────────────────────────────────────────────────┤
│                                                   │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────┐ │
│  │  Dashboard   │  │  Catch Me Up │  │   Chat   │ │
│  └─────────────┘  └─────────────┘  └──────────┘ │
│                                                   │
│  ── Current Project ──────────────────────────── │
│  Project: flowsync                                │
│  Branch:  main                                    │
│  Status:  ● Connected                             │
│                                                   │
│  ── Recent Activity ─────────────────────────── │
│  ┌────────────────────────────────────────────┐  │
│  │ 🔵 feat: Add MCP server integration        │  │
│  │    Stage: Implementation | Confidence: 95%  │  │
│  │    Decision: Use stdio transport for MCP    │  │
│  │    Author: aahil | 2 hours ago              │  │
│  ├────────────────────────────────────────────┤  │
│  │ 🟢 fix: Token hashing timing-safe compare  │  │
│  │    Stage: Bug Fix | Confidence: 70%         │  │
│  │    Risk: Security — side-channel prevention │  │
│  │    Author: anoushka | 5 hours ago           │  │
│  └────────────────────────────────────────────┘  │
│                                                   │
│  ── Quick Actions ───────────────────────────── │
│  [ + Add Note ]    [ ⟳ Catch Me Up ]            │
│                                                   │
└──────────────────────────────────────────────────┘
```

### Dashboard — Event Timeline

```
┌──────────────────────────────────────────────────────────────────────────┐
│  ≡ FlowSync                              🔍 Search...        👤 Team    │
├──────┬───────────────────────────────────────────────────────────────────┤
│      │                                                                   │
│  📊  │  Dashboard  ─  flowsync                                          │
│ Dash │                                                                   │
│      │  ┌──────────────────────────────────────────────────────────────┐ │
│  🔍  │  │  Total Events: 247  │  Active Features: 12  │  Team: 4     │ │
│Search│  └──────────────────────────────────────────────────────────────┘ │
│      │                                                                   │
│  💬  │  ── Event Timeline ────────────────────────────────────────────  │
│ Chat │                                                                   │
│      │  ┌──────────────────────────────────────────────────────────┐    │
│  📈  │  │  ● Feature Development                      3 min ago    │    │
│ Ana- │  │                                                          │    │
│lytics│  │  feat: Implement MCP server with 5 tools                 │    │
│      │  │                                                          │    │
│  ⚙️  │  │  Decision: Use stdio transport over HTTP for lower       │    │
│Sett- │  │  latency and simpler auth model                          │    │
│ings  │  │                                                          │    │
│      │  │  Tasks: ✅ get_project_context  ✅ search_context        │    │
│      │  │         ✅ get_recent_changes   ✅ log_context            │    │
│      │  │         ✅ get_events                                    │    │
│      │  │                                                          │    │
│      │  │  Risk: None identified                                   │    │
│      │  │  Entities: MCP, Copilot, stdio, TypeScript               │    │
│      │  │  Confidence: █████████████████░░ 95%                     │    │
│      │  │                                                          │    │
│      │  │  🔗 abc1234 · aahil · main                               │    │
│      │  └──────────────────────────────────────────────────────────┘    │
│      │                                                                   │
└──────┴───────────────────────────────────────────────────────────────────┘
```

### Dashboard — RAG Search

```
┌──────────────────────────────────────────────────────────────────────────┐
│  ≡ FlowSync                              🔍 Search...        👤 Team    │
├──────┬───────────────────────────────────────────────────────────────────┤
│      │                                                                   │
│  📊  │  Search  ─  "Why did we choose native crypto over bcryptjs?"     │
│      │                                                                   │
│  🔍  │  ┌──────────────────────────────────────────────────────────┐    │
│      │  │  🟢 Grounded Answer                                      │    │
│  💬  │  │                                                          │    │
│      │  │  The team switched from bcryptjs to Node.js native       │    │
│  📈  │  │  crypto.scryptSync to eliminate the external dependency  │    │
│      │  │  and reduce Lambda cold start time. The native crypto    │    │
│  ⚙️  │  │  module provides equivalent security (scrypt KDF with   │    │
│      │  │  random salt) without adding 800KB to the bundle.        │    │
│      │  │                                                          │    │
│      │  │  Sources:                                                │    │
│      │  │  📎 a3f8b21 — "refactor: replace bcryptjs with native   │    │
│      │  │     scrypt" · anoushka · Feb 28 (relevance: 0.89)       │    │
│      │  │  📎 b7c2e45 — "fix: timing-safe token comparison"       │    │
│      │  │     · anoushka · Mar 1 (relevance: 0.76)                │    │
│      │  └──────────────────────────────────────────────────────────┘    │
│      │                                                                   │
└──────┴───────────────────────────────────────────────────────────────────┘
```

### Dashboard — Chat

```
┌──────────────────────────────────────────────────────────────────────────┐
│  ≡ FlowSync                              🔍 Search...        👤 Team    │
├──────┬───────────────────────────────────────────────────────────────────┤
│      │                                                                   │
│  📊  │  Chat  ─  FlowSync AI                                           │
│      │                                                                   │
│  🔍  │  ┌──────────────────────────────────────────────────────────┐    │
│      │  │  👤 What's the status of the MCP integration?            │    │
│  💬  │  │                                                          │    │
│      │  │  🤖 The MCP server integration is fully implemented      │    │
│  📈  │  │  with all 5 tools operational:                           │    │
│      │  │                                                          │    │
│  ⚙️  │  │  - ✅ get_project_context                                │    │
│      │  │  - ✅ search_context (with RAG)                          │    │
│      │  │  - ✅ get_recent_changes                                 │    │
│      │  │  - ✅ log_context (with re-embed)                        │    │
│      │  │  - ✅ get_events                                         │    │
│      │  │                                                          │    │
│      │  │  The server auto-detects the current git branch and      │    │
│      │  │  scopes search_context to it. Uses stdio transport,      │    │
│      │  │  bundled inside the VS Code extension VSIX.              │    │
│      │  │                                                          │    │
│      │  │  📎 Source: abc1234 · aahil · 3 min ago                  │    │
│      │  └──────────────────────────────────────────────────────────┘    │
│      │                                                                   │
│      │  ┌──────────────────────────────────────────────────────┐        │
│      │  │  Ask FlowSync...                              Send ▶ │        │
│      │  └──────────────────────────────────────────────────────┘        │
│      │                                                                   │
└──────┴───────────────────────────────────────────────────────────────────┘
```

---

## 17. DynamoDB Schema

| Table | Partition Key | Sort Key | GSIs |
|-------|--------------|----------|------|
| `flowsync-projects` | `projectId` | — | — |
| `flowsync-events` | `projectId` | `timestamp#eventId` | `EventIdIndex`, `BranchIndex` |
| `flowsync-context` | `eventId` | — | `ProjectContextIndex`, `BranchContextIndex` |
| `flowsync-audit` | `entityId` | `timestamp` | — |
| `flowsync-chat-sessions` | `sessionId` | — | TTL: 30 min |
| `flowsync-cache` | `cacheKey` | — | TTL: 1 hour |

All tables use on-demand (PAY_PER_REQUEST) billing — zero cost when idle.

---

## 18. Performance Targets & Results

### Ingestion

| Metric | Target | Measured |
|--------|--------|----------|
| Event ingestion (warm) | < 500ms | **167–184ms** |
| Event ingestion (cold) | < 500ms | **398ms** |
| DynamoDB write + S3 archive | < 200ms | ~150ms |

### AI Processing

| Metric | Target | Measured |
|--------|--------|----------|
| Nova Pro extraction (warm avg) | < 10s | **857ms** |
| Nova Pro extraction (overall avg) | < 10s | **1,150ms** |
| Titan embedding | < 2s | **112ms** |
| Total pipeline (p50) | < 15s | **1,256ms** |
| Total pipeline (p95) | < 15s | **1,595ms** |
| Cold start penalty | — | **+472ms** |

### Query Performance

| Metric | Target | Measured |
|--------|--------|----------|
| Timeline query | < 200ms | ~80ms |
| RAG search (end-to-end) | < 5s | ~2-3s |
| Chat response | < 5s | ~3-4s |

### Extraction Quality (5 pushes)

| Metric | Score |
|--------|-------|
| Feature name accuracy | **90%** (4.5/5) |
| Decision auto-populated | **40%** (2/5 — only when diff contains architectural language) |
| Entity extraction | **80%** (4/5) |
| Risk (auto) | 0% — requires `log_context` |
| Tasks (auto) | 0% — requires `log_context` |

---

## 19. Scalability

| Parameter | Capacity |
|-----------|----------|
| Concurrent developers | Up to 50 |
| Events per project | Up to 10,000 |
| Context records (searchable) | Up to 10,000 |
| DynamoDB throughput | On-demand (auto-scaling) |
| Lambda concurrency | AWS default (1,000) |

---

## 20. Future Scope

### Near-Term

- **Hard branch filtering** — Enforce `BranchContextIndex` queries when branch is specified, eliminating cross-branch results entirely
- **File save capture** — Track granular file edits (not just pushes)
- **WebSocket real-time updates** — Live dashboard updates without polling
- **SQS event queuing** — Buffer high-volume events with dead-letter queue

### Medium-Term

- **Multi-repository support** — Single dashboard across multiple projects
- **Semantic vector database** — Migrate from DynamoDB embeddings to Amazon OpenSearch Serverless
- **PR review intelligence** — Context-aware PR summaries and review suggestions
- **OAuth + RBAC** — Role-based access control with GitHub/Google SSO
- **Slack/Teams integration** — Daily project summaries to team channels

### Long-Term

- **Multi-region deployment** — Low-latency global access with cross-region replication
- **Advanced analytics** — AI-generated sprint reports, burndown predictions, code health scores
- **Knowledge graph visualization** — Interactive graph of features, decisions, developers, and relationships
- **Custom AI fine-tuning** — Train project-specific models on accumulated context

---

*FlowSync — Every project deserves a memory.*
