# FlowSync — Build Timeline

4 active build days. Demo on Day 5.

| Person | Role |
|--------|------|
| **ML Engineer** | Bedrock integration, AI Processing Lambda, MCP tools, embeddings, RAG |
| **Backend Engineer** | Ingestion Lambda, project/auth APIs, DynamoDB operations, join flow |
| **Frontend Engineer** | VS Code extension (TypeScript), React dashboard |
| **DevOps** | AWS CDK infrastructure, API Gateway, CI/CD, integration testing, deployment |

---

## Day 1 — Foundation

> Goal: infrastructure exists, Bedrock talks, Lambda writes to DynamoDB. No full pipeline yet.

| | Task | Done |
|-|------|------|
| **DevOps** | CDK stack: all 4 DynamoDB tables, API Gateway, 4 Lambda skeletons, S3 buckets, CloudFront | ☐ |
| **DevOps** | Deploy base infrastructure to AWS (`us-east-1`) | ☐ |
| **DevOps** | Verify all Lambdas are invocable and all tables exist | ☐ |
| **Backend** | Ingestion Lambda: Bearer token validation, event schema validation, DynamoDB write, S3 archive write | ☐ |
| **Backend** | `POST /api/v1/projects` endpoint: project creation + bcrypt token generation + return `{ projectId, apiToken }` | ☐ |
| **ML** | Confirm Bedrock access in `us-east-1` (Claude 3 Sonnet + Titan Embeddings) | ☐ |
| **ML** | Raw Claude 3 Sonnet call with hardcoded diff → validate JSON output matches extraction schema | ☐ |
| **ML** | Titan Embeddings test call → verify 1,536-dim output shape | ☐ |
| **Frontend** | VS Code extension scaffold: detect `.flowsync.json`, `FlowSync: Initialize Project` command, local HTTP listener on port `38475` | ☐ |
| **Frontend** | Extension: post-push notification ("Add reasoning?") + Copilot Chat pre-fill logic (branch, diff, author from `git config`) | ☐ |
| **Frontend** | Onboarding wizard writes `.github/copilot-instructions.md` to repo root as part of initialization commit | ☐ |
| **Frontend** | React app scaffold: routing, API client, basic layout | ☐ |

### ✅ Day 1 Checkpoint
- [ ] Ingestion Lambda receives a hardcoded POST, writes event to DynamoDB, writes raw payload to S3
- [ ] Bedrock returns valid structured JSON matching the extraction schema
- [ ] Titan Embeddings returns a 1,536-dim vector

---

## Day 2 — Core Pipeline

> Goal: a real push triggers the full write path end-to-end. Context lands in DynamoDB with embedding.

| | Task | Done |
|-|------|------|
| **DevOps** | End-to-end integration test: `POST /api/v1/events` → Ingestion → AI Processing → DynamoDB context record + embedding verified | ☐ |
| **DevOps** | CloudWatch alarms for Lambda errors (AI Processing, Ingestion) | ☐ |
| **Backend** | Wire Ingestion Lambda → AI Processing Lambda (`InvocationType: Event`, non-blocking) | ☐ |
| **Backend** | AI Processing Lambda writes audit record to `flowsync-audit` | ☐ |
| **ML** | AI Processing Lambda: full pipeline (Bedrock extraction → schema validation → Titan embedding → `flowsync-context` write) | ☐ |
| **ML** | Schema validation on every Bedrock response — parse failure → event marked `failed`, CloudWatch alert | ☐ |
| **ML** | Agent context linking: scan for orphaned record (same branch + author, `commitHash: null`, ≤30 min) and bind `commitHash` (Direction B — log-first) | ☐ |
| **ML** | AI Processing Lambda: update `flowsync-projects` `lastActivityAt` + `eventCount++` inline | ☐ |
| **Frontend** | VS Code extension: onboarding wizard webview (form → `POST /api/v1/projects` → write `.flowsync.json` → inject post-push hook) | ☐ |
| **Frontend** | Extension: `post-push` signal receiver (port 38475) → `git diff` + metadata capture → `POST /api/v1/events` with retry | ☐ |

### ✅ Day 2 Checkpoint
- [ ] Real push from VS Code → hook fires → Ingestion Lambda → AI Processing Lambda → `flowsync-context` record written with `commitHash`, all fields, and embedding
- [ ] Audit record written to `flowsync-audit`
- [ ] `flowsync-projects` `eventCount` incremented

---

## Day 3 — MCP + APIs

> Goal: AI agent can connect to MCP and get real data. Dashboard shows live timeline.

| | Task | Done |
|-|------|------|
| **DevOps** | MCP endpoint live on API Gateway and testable (`/mcp` route) | ☐ |
| **DevOps** | Test all 4 MCP tools with a real Copilot or Claude connection | ☐ |
| **Backend** | Dev 2 join flow: `GET /api/v1/projects/{projectId}` token validation endpoint | ☐ |
| **Backend** | Branch context inheritance in all read endpoints (fetch branch + parent branch, merge results) | ☐ |
| **Backend** | `GET /api/v1/projects/{projectId}/events` polling endpoint (branch filter + `since` cursor for dashboard) | ☐ |
| **ML** | MCP Lambda: `get_project_context` — fetch last 10 records via `BranchContextIndex` GSI, merge parent branch context | ☐ |
| **ML** | MCP Lambda: `get_recent_changes` — last N records with author, timestamp, confidence, commitHash | ☐ |
| **ML** | MCP Lambda: `search_context` — embed query (Titan) → cosine similarity in-memory → top N → Claude RAG answer | ☐ |
| **ML** | MCP Lambda: `log_context` — Direction A (push-first): scan for existing `complete` record, merge `agentReasoning` in | ☐ |
| **ML** | Query Lambda: same RAG pipeline as `search_context` for dashboard `POST /api/v1/query` | ☐ |
| **Frontend** | Dashboard: project header (name, last activity, branch selector, MCP connected indicator) | ☐ |
| **Frontend** | Dashboard: commit timeline (context records per branch, author, confidence, commit link) | ☐ |
| **Frontend** | Dashboard: uncommitted agent context records shown with `pending commit` badge | ☐ |

### ✅ Day 3 Checkpoint
- [ ] AI agent connects to MCP, calls `get_project_context`, gets real data back
- [ ] `search_context` returns a grounded answer with source citation
- [ ] Dashboard shows live commit timeline for real data

---

## Day 4 — Polish + Demo Prep

> Goal: 3-minute demo runs clean, 3 times in a row.

| | Task | Done |
|-|------|------|
| **DevOps** | Production deploy verified — all Lambdas, tables, CloudFront, API Gateway live | ☐ |
| **DevOps** | Fallback `curl` test script ready: directly calls ingestion API with a prepared diff (backup if extension fails during demo) | ☐ |
| **Frontend** | Dashboard search bar UI polished — visually prominent, this is the demo centrepiece | ☐ |
| **Frontend** | VS Code status bar indicator (FlowSync connected / disconnected) | ☐ |
| **All** | End-to-end demo dry run #1 — identify breaks | ☐ |
| **All** | Fix critical bugs only — no new features | ☐ |
| **All** | End-to-end demo dry run #2 | ☐ |
| **All** | End-to-end demo dry run #3 — must be clean | ☐ |
| **All** | Branch switching working in dashboard | ☐ |
| **All** | Search bar returning real NL answers with cited sources | ☐ |

### ✅ Day 4 Checkpoint
- [ ] Complete 3-minute demo script rehearsed and clean — no errors
- [ ] Fallback path tested and ready

---

## Day 5 — Demo

**Setup (before presenting):**
- Project created, 2–3 commits already processed, at least one context record with agent reasoning merged
- MCP connected to Copilot
- Dashboard open on the search bar

**3-minute script:**

| Time | Beat |
|------|------|
| 0:00 – 0:30 | "Here's a 1,000-commit project. Ask an AI agent why we switched databases. Watch it struggle." |
| 0:30 – 1:00 | Make a real prepared push → dashboard timeline updates within seconds → show Bedrock-extracted context: feature, decision, tasks, confidence |
| 1:00 – 2:00 | Open Copilot Chat → ask *"What's the current state of the auth module?"* → agent calls `get_project_context` → returns structured answer → **"The agent didn't read a single file. It just knew."** |
| 2:00 – 2:30 | Open dashboard search bar → type *"Why did we change the token strategy?"* → answer with source commit citation, timestamp, author |
| 2:30 – 3:00 | "Every answer is traceable. Every decision is permanent. Every AI agent on the team has the same context." |

---

## Success Criteria

All of the following must pass before the demo:

- [ ] VS Code extension captures a real push and transmits it to the backend automatically
- [ ] Bedrock extracts valid structured JSON from the push with `model_version` stored
- [ ] Titan embedding generated and stored with the context record
- [ ] Context is queryable via MCP — `get_project_context` returns real data
- [ ] `search_context` returns a grounded answer with source citation for a natural language query
- [ ] `log_context` from Copilot merges agent reasoning into the committed context record
- [ ] Dev 2 join flow works — clone repo, detect `.flowsync.json`, connect with token, hook injected
- [ ] Branch context inheritance works — agent on feature branch inherits main context
- [ ] Dashboard shows live timeline and search works for human queries
- [ ] Full 3-minute demo runs cleanly without errors
