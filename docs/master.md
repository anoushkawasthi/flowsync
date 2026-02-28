# FlowSync — Master Specification
AI-Powered Context Layer for AI-Assisted Development Teams

> This is the single source of truth for the FlowSync hackathon prototype.
> All architectural decisions made during planning are locked in this document.

---

## 1. Problem Statement

Modern software teams have adopted AI agents (Copilot, Claude, Cursor) as primary development tools. But the underlying infrastructure — Git, commit messages, PRs — was designed for humans, not AI.

**The concrete failure modes:**

1. **Context blindness across agents:** Dev 1's AI makes a decision (e.g. switches JWT strategy) and commits. Dev 2's AI pulls the code and has no idea why it changed. It reads the diff, guesses intent, and may make contradictory decisions.

2. **Context window loss:** Long-running AI sessions lose awareness of earlier decisions. The agent starts generating code that contradicts what it built an hour ago.

3. **Zero traceability at scale:** A project with 1,000 commits cannot be meaningfully queried. "Why did we switch from Redis to Memcache?" requires manual archaeology.

**What Git provides:** *What* changed, and *when*.

**What FlowSync provides:** *Why* it changed, *what decision was made*, *what's still pending*, and *what risk was flagged* — in a form that AI agents can query instantly.

---

## 2. Solution

FlowSync is a **shared AI context layer** — a persistent, structured knowledge base that sits alongside the codebase and is maintained automatically through development activity.

**Primary user: AI agents.** Every team member's AI agent is connected to the same FlowSync MCP server. Before starting work, it queries current project state. After completing work, it logs its reasoning. The knowledge base grows with every push.

**Secondary user: Human developers.** A lightweight dashboard provides visibility into what the AI agents have recorded — decisions, progress, risks, and full traceability back to source commits.

**Core principle:**
> Git tracks changes. FlowSync tracks understanding.

---

## 3. Hackathon Scope

### Timeline
4 active build days. Demo on day 5.

### Team
4 people.

| Person | Role |
|--------|------|
| ML Engineer (you) | Bedrock integration, prompt engineering, AI Processing Lambda, MCP Query tools, RAG/embedding search, determinism |
| Backend Engineer | Event Ingestion Lambda, Project APIs, auth, DynamoDB operations |
| Frontend Engineer | React dashboard, VS Code extension (TypeScript) |
| DevOps / Integration Engineer | AWS infrastructure, API Gateway, CI/CD, git hook injection, end-to-end integration testing, deployment |

### What we ARE building

| # | Component | Primary User |
|---|-----------|-------------|
| 1 | VS Code Extension | Developer (passive capture) |
| 2 | Onboarding wizard | Developer (project setup) |
| 3 | Post-push git hook | System (capture trigger) |
| 4 | Event Ingestion Backend | System |
| 5 | AI Processing Layer (Bedrock) | System |
| 6 | MCP Server | AI agents |
| 7 | Dashboard (timeline + search only) | Human developers |

### What we are NOT building

- Feature management, approval workflows, or feature tracking of any kind
- Standalone State Engine Lambda (project-level updates folded into AI Processing Lambda)
- OAuth (API tokens only)
- Real-time WebSocket updates (polling)
- SQS queuing (synchronous Lambda chain)
- Multi-region deployment
- Semantic vector search with a dedicated vector DB (Bedrock Titan Embeddings + DynamoDB instead)
- File save event capture (pushes only)
- Complex RBAC (one role per project for prototype)
- Existing project deep-history ingestion beyond last 50 commits

---

## 4. Architecture Overview

### System Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    Developer Machine                     │
│                                                         │
│  ┌──────────────────┐     ┌──────────────────────────┐  │
│  │  VS Code Extension│     │  AI Agent (Copilot/Claude)│  │
│  │  - Onboarding UI │     │  - Reads context via MCP  │  │
│  │  - Note capture  │     │  - Writes reasoning via   │  │
│  └────────┬─────────┘     │    MCP log_context tool   │  │
│           │               └────────────┬─────────────┘  │
│  ┌────────▼─────────┐                  │                 │
│  │  .git/hooks/     │                  │                 │
│  │  post-push       │                  │                 │
│  └────────┬─────────┘                  │                 │
└───────────┼────────────────────────────┼─────────────────┘
            │ HTTPS + Bearer Token        │ HTTPS + Bearer Token
            ▼                            ▼
┌────────────────────────────────────────────────────────────┐
│                      API Gateway                           │
│          /api/v1/events    /mcp/*    /api/v1/*             │
└──────────┬─────────────────┬──────────────────────────────┘
           │                 │
           ▼                 ▼
┌──────────────────┐  ┌─────────────────────────────────────┐
│ Ingestion Lambda │  │           MCP Lambda                │
│ (Node.js 20.x)   │  │          (Python 3.12)              │
│                  │  │                                     │
│ 1. Validate      │  │  Tools:                             │
│ 2. Write to S3   │  │  - get_project_context()            │
│ 3. Write events  │  │  - get_recent_changes()             │
│    to DynamoDB   │  │  - search_context()                 │
│ 4. Invoke AI     │  │  - log_context()                    │
│    Lambda sync   │  │                                     │
└──────────────────┘  └─────────────────────────────────────┘
           │                         │
           ▼                         │ reads
┌──────────────────┐                 │
│  AI Processing   │                 │
│  Lambda (Python) │                 │
│                  │                 │
│ 1. Call Bedrock  │                 │
│    (Claude 3     │                 │
│     Sonnet)      │                 │
│ 2. Validate JSON │                 │
│ 3. Generate      │                 │
│    embeddings    │                 │
│    (Titan)       │                 │
│ 4. Write context │                 │
│ 5. Update project│                 │
│    lastActivity  │                 │
│    + eventCount  │                 │
└────────┬─────────┘                 │
         │                           │
         ▼                           ▼
┌────────────────────────────────────────────────────────────┐
│                        DynamoDB                            │
│  flowsync-projects  │  flowsync-events  │ flowsync-context │
│  flowsync-audit                                            │
└────────────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────┐
│  Dashboard       │
│  (React + S3     │
│   static hosted) │
│                  │
│  - Commit        │
│    timeline      │
│  - NL search     │
│  - Branch switch │
└──────────────────┘
         │
         ▼
┌──────────────────┐
│  Query Lambda    │
│  (Python)        │
│                  │
│  RAG over        │
│  context using   │
│  Bedrock Titan   │
│  Embeddings      │
└──────────────────┘
```

### Design Principles

| Principle | Implementation |
|-----------|---------------|
| AI agents are first-class users | MCP server is the primary interface, not the dashboard |
| Capture is automatic | `post-push` git hook, no manual steps for commits |
| Writes are complementary | Agent reasoning + Bedrock code extraction are merged, not alternatives |
| Traceability is absolute | Every context record links to its source commit hash |
| Determinism by design | `temperature: 0`, pinned model version stored per record |
| Branch context is inherited | Child branch context layers on top of parent branch context |

---

## 5. Onboarding Flow

### Dev 1 — Project Initialization

Triggered via VS Code Command Palette: `FlowSync: Initialize Project`

**Step 1 — Wizard (VS Code Webview panel)**

Collects the following fields:

| Field | Required | Notes |
|-------|----------|-------|
| Project name | Yes | Alphanumeric, hyphens, underscores only |
| Description | Yes | 1–3 sentences about project purpose |
| Primary language(s) | Yes | Multi-select (JS, Python, Go, etc.) |
| Framework(s) | No | Free text |
| Default branch | Yes | Defaults to `main` |
| Team members | No | Name + role pairs, can add later |

No chatbot. A clean form, submitted in one step. The chatbot UX is reserved for the dashboard query interface, not setup.

**Step 2 — Backend creates project**

`POST /api/v1/projects` is called with wizard data. Backend:
1. Creates project record in `flowsync-projects`
2. Generates a project-scoped API token (stored hashed)
3. Returns `{ projectId, apiToken }`

**Step 3 — Extension writes `.flowsync.json` to repo root**

```json
{
  "projectId": "uuid",
  "backendUrl": "https://api.flowsync.io",
  "defaultBranch": "main"
}
```

This file is committed to the repo. It is the connection mechanism for all other team members. It contains no secrets.

**Step 4 — Extension injects git hook**

Writes `.git/hooks/post-push`:

```bash
#!/bin/sh
curl -s http://localhost:38475/flowsync-hook \
  --data "{\"event\":\"post-push\",\"branch\":\"$(git branch --show-current)\"}"
```

The extension runs a local lightweight HTTP listener on port `38475` that receives this signal, collects the diff, and transmits to the backend.

**Step 5 — API token storage**

The token returned from step 3 is stored in VS Code `SecretStorage` — never written to disk in plaintext, never committed.

**Step 6 — Existing project seeding (optional, prompted)**

"Would you like to seed FlowSync with your recent commit history?"

If yes: the last 50 commits are extracted from git log and sent as a batch to the ingestion pipeline. Bedrock processes each one. The knowledge base starts populated rather than empty.

This is optional because 50 × Bedrock calls on initialization adds latency. It should run as a background job, not block the wizard.

---

### Dev 2+ — Joining an Existing Project

Triggered automatically when VS Code Extension detects `.flowsync.json` in the workspace root.

**Step 1 — Extension detects `.flowsync.json`**

On workspace open, extension checks for `.flowsync.json`. If found and no token exists in SecretStorage, it prompts:

> "FlowSync project detected. Enter your API token to connect."

The team lead shares the API token out of band (Slack, email). For the prototype, one token per project is shared across the team.

**Step 2 — Extension validates token**

`GET /api/v1/projects/{projectId}` with the token. If 200 → connected. If 401 → re-prompt.

**Step 3 — Hook injection**

Same as Step 4 of dev 1 flow — the hook is injected into their local `.git/hooks/`. This must happen on every team member's machine for their pushes to be captured.

**Step 4 — Done**

No wizard, no re-configuration. Dev 2 is now contributing to the same knowledge base.

---

## 6. VS Code Extension

### Technology
TypeScript, VS Code Extension API (v1.80+)

### Responsibilities
- Detect `.flowsync.json` and manage connection state
- Run the onboarding wizard (new project)
- Handle joining flow (existing project)
- Inject and maintain `post-push` git hook
- Receive `post-push` signal via local HTTP listener
- Capture diff and transmit to ingestion backend
- Provide `FlowSync: Add Note` command for manual developer notes
- Show connection status in VS Code status bar

### Local HTTP Listener

The extension starts a local server on port `38475` when VS Code opens.
The git hook calls this local endpoint. The listener then:
1. Runs `git diff HEAD~1 HEAD` to get the diff
2. Runs `git log -1 --format="%H|%s|%an|%aI"` to get commit metadata
3. Reads current branch from `git branch --show-current`
4. Packages into a `CapturedEvent` and POSTs to the backend

This approach works regardless of whether the push originates from VS Code, terminal, or any GUI git client.

### Post-Push Notification Flow

After the event is transmitted to the backend, the extension shows a VS Code information notification:

> **"FlowSync captured your push. Add reasoning?"** `[Add Context]` `[Dismiss]`

When the developer clicks **Add Context**:
1. Extension reads `git config user.name` to identify the author
2. Opens Copilot Chat with a pre-filled prompt:

   ```
   A push was just detected on branch {branch}. Here is the diff:

   {diff}

   Call the FlowSync `log_context` MCP tool with your reasoning: what was decided,
   what changed, what is still pending, and any risks. Set the `author` field to "{git_user_name}".
   ```
3. Copilot calls `log_context` via MCP → MCP Lambda finds the existing `complete` record (same branch + author, within 30-min window) → merges `agentReasoning` into it → returns `status: complete`
4. Final record = Bedrock code extraction **+** agent reasoning, both bound to `commitHash`

**Usage rule:** `log_context` is called **at most once per push**, triggered by this notification. Never call it during active iteration or exploration — uncommitted exploratory work must not be logged. If the developer dismisses the notification, no context is written for that push.

### Event Schema

```typescript
interface CapturedEvent {
  eventId: string;           // UUID v4, client-generated
  projectId: string;         // from .flowsync.json
  eventType: 'push' | 'developer_note';
  timestamp: string;         // ISO 8601 UTC
  branch: string;            // current branch name
  payload: PushPayload | NotePayload;
}

interface PushPayload {
  commitHash: string;        // 40-char SHA of the pushed commit
  message: string;           // commit message
  author: string;            // git author name
  changedFiles: string[];    // relative file paths
  diff: string;              // truncated at 50,000 chars
  parentBranch?: string;     // detected from merge-base, optional
}

interface NotePayload {
  text: string;
  filePath: string;          // relative path
  lineNumber: number;
}
```

### Retry Strategy
- Transmit within 5 seconds of hook signal
- On failure: retry at 1s → 2s → 4s (exponential backoff, max 3 attempts)
- Failed events persisted locally in extension globalState for manual inspection

### Agent Context Write (MCP)
The extension also contributes an MCP tool surface. When an AI agent (Copilot) is connected via MCP, it can call `log_context` directly — the extension does not mediate this; it goes straight to the MCP Lambda.

### Copilot Instructions File (Required Deliverable)

A file at `.github/copilot-instructions.md` committed to the repo root instructs Copilot to proactively call FlowSync before every task. Without this file, Copilot will not call `get_project_context` unless the developer explicitly prompts it — defeating the "AI agent always has context" premise.

**File path:** `.github/copilot-instructions.md`

**Content:**

```
# FlowSync Context Instructions

Before starting any task:
1. Call the FlowSync MCP tool `get_project_context` to understand the current state of the project.
2. Use the returned context to inform your work — decisions, active risks, and pending tasks.

When logging context after a push:
- Call `log_context` once, after the push lands, when prompted by the FlowSync VS Code notification.
- Never call `log_context` during exploration or before work is committed and pushed.
```

This file is created by the onboarding wizard during project initialization and committed alongside `.flowsync.json` as part of the initialization commit.

---

## 7. Event Ingestion Backend

### Technology
AWS Lambda (Node.js 20.x), API Gateway HTTP API

### Endpoint

```
POST /api/v1/events
Authorization: Bearer <api_token>
Content-Type: application/json
```

**Response 200:**
```json
{
  "eventId": "uuid",
  "projectId": "string",
  "branch": "string",
  "status": "processing",
  "receivedAt": "ISO 8601"
}
```

**Response 400:**
```json
{
  "error": "validation_failed",
  "details": ["commitHash: must be 40 hex chars"]
}
```

**Response 401:** `{ "error": "invalid_token" }`

### Validation Rules

| Field | Rule |
|-------|------|
| `eventId` | Valid UUID v4 |
| `projectId` | Must exist in `flowsync-projects`, token must match |
| `eventType` | `push` or `developer_note` |
| `timestamp` | Valid ISO 8601 UTC |
| `branch` | Non-empty string, max 255 chars |
| `commitHash` | Exactly 40 hex characters (push events only) |
| `filePath` | Relative path, no `..` traversal (note events only) |
| `diff` | Max 50,000 characters (truncated by client before sending) |

### Handler Logic
1. Validate Bearer token → extract `projectId`
2. Validate event schema
3. Write event to DynamoDB with `processingStatus: pending`
4. Write raw payload to S3 (`raw-events/{projectId}/{eventId}.json`)
5. Invoke AI Processing Lambda synchronously (not SQS — single chain)
6. Return response to client immediately after DynamoDB write (don't wait for AI)

**Note on step 6:** The response is returned after the DynamoDB write, not after AI processing completes. AI processing happens asynchronously via a non-blocking Lambda invocation (`InvocationType: Event`).

### SLA
**500ms** for the ingestion response. AI processing runs independently after.

---

## 8. AI Processing Layer

### Technology
AWS Lambda (Python 3.12), Amazon Bedrock

### Models Used

| Model | Purpose |
|-------|---------|
| `anthropic.claude-3-sonnet-20240229-v1:0` | Intent extraction from push/note events |
| `amazon.titan-embed-text-v1` | Generating embeddings for semantic search |

### Bedrock Configuration (Extraction)

```python
bedrock_params = {
    "modelId": "anthropic.claude-3-sonnet-20240229-v1:0",
    "temperature": 0,
    "top_p": 1,
    "max_tokens": 2000
}
```

`temperature: 0` is non-negotiable. It is the primary determinism guarantee.

### Processing Pipeline

```
Event arrives (invoked by Ingestion Lambda)
        │
        ├─ Check for existing unlinked agent context record
        │   (same branch + author, within 30min window, commitHash: null)
        │
        ├─ [If found] → bind commitHash to existing record
        │                run Bedrock for code-level extraction only
        │                merge agent reasoning + Bedrock code analysis
        │
        └─ [If not found] → run full Bedrock extraction
                            create new context record
        │
        ├─ Generate Titan embedding of extracted context
        │   (store as embedding vector in context record)
        │
        ├─ Write to flowsync-context
        │
        ├─ Update event processingStatus → completed
        │
        ├─ Update project.lastActivityAt and increment project.eventCount
        │   (inline DynamoDB write — no separate Lambda)
        │
        └─ Write audit record to flowsync-audit
```

### Structured Output Schema

All Bedrock responses must be strict JSON. No free text. No markdown.

```json
{
  "feature": "Authentication Module",
  "decision": "Switched token strategy to JWT refresh model",
  "tasks": ["Implement refresh endpoint", "Add validation middleware"],
  "stage": "Feature Development",
  "risk": "Token expiry edge cases not yet handled",
  "confidence": 0.87,
  "entities": ["refreshToken()", "AuthMiddleware", "src/auth/tokens.ts"],
  "source_event_id": "uuid",
  "model_version": "anthropic.claude-3-sonnet-20240229-v1:0"
}
```

| Field | Type | Notes |
|-------|------|-------|
| `feature` | string | Feature or module name |
| `decision` | string \| null | Architectural decision made, if any |
| `tasks` | string[] | Remaining tasks inferred from the change |
| `stage` | string | `Setup` \| `Feature Development` \| `Refactoring` \| `Bug Fix` \| `Testing` \| `Documentation` |
| `risk` | string \| null | Risk or concern flagged |
| `confidence` | float 0–1 | Model confidence in extraction |
| `entities` | string[] | Functions, classes, files identified |
| `source_event_id` | string | UUID of triggering event |
| `model_version` | string | Exact Bedrock model ID — stored for traceability |

### Prompt Template — Push Events

**System:**
```
You are a deterministic software project intelligence extractor.
Return STRICT JSON only. No explanation, no markdown, no free text outside the JSON object.
```

**User:**
```
Analyze this Git push and extract structured project intelligence.

Commit Hash: {commitHash}
Commit Message: {message}
Author: {author}
Branch: {branch}
Changed Files: {changedFiles}

Diff:
{diff}

Return ONLY a valid JSON object with this exact structure:
{
  "feature": "name of the feature or module being modified",
  "decision": "architectural or implementation decision made, or null",
  "tasks": ["remaining task 1", "remaining task 2"],
  "stage": "one of: Setup | Feature Development | Refactoring | Bug Fix | Testing | Documentation",
  "risk": "potential risk or concern, or null",
  "confidence": 0.0,
  "entities": ["function/class/file name 1", "function/class/file name 2"]
}

Extract only factual information present in the diff and message. Do not invent or assume.
```

### Prompt Template — Developer Notes

**System:**
```
You are a deterministic software project intelligence extractor.
Return STRICT JSON only. No explanation, no markdown, no free text outside the JSON object.
```

**User:**
```
Analyze this developer note and extract structured project intelligence.

Note: {text}
File: {filePath}
Line: {lineNumber}
Branch: {branch}

Return ONLY a valid JSON object with this exact structure:
{
  "feature": "name of the feature or module this note relates to",
  "decision": "decision or rationale recorded, or null",
  "tasks": ["action item 1", "action item 2"],
  "stage": "one of: Setup | Feature Development | Refactoring | Bug Fix | Testing | Documentation",
  "risk": "concern or risk noted, or null",
  "confidence": 0.0,
  "entities": ["code entities mentioned"]
}

Extract only what is explicitly present in the note.
```

### Determinism Guarantees
- `temperature: 0` eliminates sampling randomness
- `modelId` is pinned per extraction and stored with every record
- Identical inputs + identical `modelId` = identical outputs
- Schema validation runs on every Bedrock response before storage
- Parse failure → event marked `failed`, error logged to CloudWatch, audit record written
- Model version change does not invalidate historical records — each record carries its own `model_version`

### Agent Context Linking

Linking runs in **two directions** depending on whether the push or the `log_context` call arrives first.

**Direction A — Push-first (normal path, triggered by notification):**
1. Push arrives → AI Processing Lambda runs → creates context record with `{ commitHash: <sha>, status: complete }`
2. VS Code notification fires → developer clicks → Copilot calls `log_context`
3. MCP Lambda scans `flowsync-context` for an existing record: same `projectId` + `branch` + `author`, within 30-min window, `status: complete`
4. If found → merges `agentReasoning` into the existing record. Record stays `status: complete`, now enriched with both Bedrock extraction and agent reasoning
5. If NOT found within the window → falls through to Direction B

**Direction B — Log-first (edge case, agent writes before pushing):**
1. Agent calls `log_context` before a push → MCP Lambda creates orphaned record: `{ commitHash: null, status: uncommitted, agentReasoning: {...} }`
2. Push arrives within 30 minutes, same branch + author → AI Processing Lambda scans for the unlinked record
3. Found → binds `commitHash`, runs Bedrock for code-level extraction, merges into the record, marks `status: complete`
4. If no push arrives within 30 minutes → record stays `status: uncommitted` — valid orphaned context (captures decisions that weren't committed)
5. Uncommitted records older than 7 days are flagged as `stale` in the dashboard

**Lookup key for both directions:** `projectId` + `branch` + `author` + timestamp within ±30 minutes.

---

## 9. Branch Context Model

Every context record is tagged `branch`. The MCP server and dashboard resolve context using a **branch inheritance tree**.

### Data Model

On every push, the extension detects `parentBranch` from git:

```bash
git merge-base --fork-point main HEAD
```

This gives the commit where the branch diverged. From that, `parentBranch = main` (or whichever base branch was used).

Stored in `flowsync-events` and `flowsync-context`:
```json
{
  "branch": "feature/auth-refactor",
  "parentBranch": "main"
}
```

### Query Resolution

When an MCP tool or dashboard query arrives with `branch: "feature/auth-refactor"`:

1. Fetch all context for `branch: "feature/auth-refactor"`
2. Fetch all context for `branch: "main"` (parent)
3. Merge — branch-specific context takes priority on field conflicts
4. Return unified view

This means an AI agent on `feature/auth-refactor` automatically inherits all of `main`'s context without explicitly asking about it.

### On Merge

When `feature/auth-refactor` is merged into `main`:
- All context records for `feature/auth-refactor` are tagged `mergedInto: "main"`, `mergedAt: timestamp`
- Context is queryable from `main` context going forward
- Feature branch context is archived but still directly queryable for traceability

### Cross-Branch Queries

If an agent on branch A asks about something that only exists in branch B, the MCP server returns the result annotated:

```json
{
  "answer": "...",
  "branchNote": "This context exists on branch B only and has not been merged into your current branch."
}
```

---

## 10. Database Schema

AWS Region: `us-east-1`. All timestamps ISO 8601 UTC.

---

### Table: `flowsync-projects`

| Attribute | Type | Notes |
|-----------|------|-------|
| `projectId` (PK) | String | UUID |
| `name` | String | Unique per account |
| `description` | String | |
| `languages` | List | e.g. `["TypeScript", "Python"]` |
| `frameworks` | List | |
| `defaultBranch` | String | e.g. `main` |
| `teamMembers` | List | `[{name, role}]` |
| `apiTokenHash` | String | bcrypt hash of bearer token |
| `createdAt` | String | |
| `lastActivityAt` | String | |
| `eventCount` | Number | |

---

### Table: `flowsync-events`

| Attribute | Type | Notes |
|-----------|------|-------|
| `projectId` (PK) | String | |
| `timestamp#eventId` (SK) | String | Chronological ordering within project |
| `eventId` | String | UUID |
| `eventType` | String | `push` \| `developer_note` |
| `branch` | String | |
| `parentBranch` | String | Optional |
| `payload` | Map | Full event payload |
| `receivedAt` | String | |
| `processingStatus` | String | `pending` \| `processing` \| `completed` \| `failed` |
| `processedAt` | String | Optional |

**GSI: `EventIdIndex`** — PK: `eventId` (direct lookup by event ID)

**GSI: `BranchIndex`** — PK: `projectId`, SK: `branch#timestamp` (all events for a branch)

---

### Table: `flowsync-context`

| Attribute | Type | Notes |
|-----------|------|-------|
| `eventId` (PK) | String | References source event |
| `projectId` | String | |
| `branch` | String | |
| `parentBranch` | String | Optional |
| `feature` | String | |
| `decision` | String \| null | |
| `tasks` | List | |
| `stage` | String | |
| `risk` | String \| null | |
| `confidence` | Number | |
| `entities` | List | |
| `author` | String | From `git config user.name` — used for linking + attribution |
| `agentReasoning` | Map \| null | Written by AI agent via MCP, if provided |
| `commitHash` | String \| null | null if agent wrote before committing |
| `status` | String | `complete` \| `uncommitted` \| `stale` |
| `modelVersion` | String | Bedrock model ID |
| `embedding` | List | Titan embedding vector (for semantic search) |
| `extractedAt` | String | |
| `processingDuration` | Number | Milliseconds |

**GSI: `ProjectContextIndex`** — PK: `projectId`, SK: `extractedAt`

**GSI: `BranchContextIndex`** — PK: `projectId`, SK: `branch#extractedAt`

---

### Table: `flowsync-audit`

| Attribute | Type | Notes |
|-----------|------|-------|
| `entityId` (PK) | String | Project, feature, or event ID |
| `timestamp` (SK) | String | |
| `entityType` | String | `project` \| `event` \| `context` |
| `action` | String | `created` \| `updated` \| `status_changed` \| `context_written` \| `agent_logged` |
| `actor` | String | Token identifier or `system` |
| `changes` | Map | Before/after values |
| `reason` | String | Optional |

---

## 11. MCP Server

The core product. AI agents connect to this to read and write project intelligence.

### Technology
AWS Lambda (Python 3.12), API Gateway, DynamoDB

### MCP Endpoint
```
https://api.flowsync.io/mcp
Authorization: Bearer <api_token>
```

Implements the [Model Context Protocol](https://spec.modelcontextprotocol.io/) spec. Exposes tools that AI agents discover and call.

### MCP Tools

---

#### `get_project_context`

Returns current project state for the AI agent's branch, inheriting parent branch context.

**Input:**
```json
{
  "projectId": "string",
  "branch": "string"
}
```

**Output:**
```json
{
  "projectName": "string",
  "description": "string",
  "defaultBranch": "string",
  "currentBranch": "string",
  "recentContext": [
    {
      "contextId": "string",
      "feature": "string",
      "stage": "string",
      "decision": "string | null",
      "pendingTasks": ["string"],
      "risk": "string | null",
      "commitHash": "string | null",
      "author": "string",
      "lastActivity": "ISO 8601"
    }
  ],
  "teamMembers": [{"name": "string", "role": "string"}],
  "lastActivity": "ISO 8601"
}
```

`recentContext` returns the last 10 processed context records for the branch (inheriting parent branch). This is the primary signal the AI agent uses to understand current project state.

---

#### `get_recent_changes`

Returns the last N processed context records for the branch.

**Input:**
```json
{
  "projectId": "string",
  "branch": "string",
  "limit": 10
}
```

**Output:**
```json
{
  "changes": [
    {
      "feature": "string",
      "decision": "string | null",
      "stage": "string",
      "commitHash": "string",
      "author": "string",
      "timestamp": "string",
      "confidence": 0.0
    }
  ]
}
```

---

#### `search_context`

Semantic search over all stored context using Bedrock Titan Embeddings. The killer query tool.

**Input:**
```json
{
  "projectId": "string",
  "query": "when did we switch from Redis to Memcache?",
  "branch": "string",
  "limit": 5
}
```

**Output:**
```json
{
  "results": [
    {
      "relevanceScore": 0.94,
      "feature": "string",
      "decision": "string",
      "commitHash": "string",
      "branch": "string",
      "timestamp": "string",
      "excerpt": "string"
    }
  ],
  "answer": "Based on the project history, the switch from Redis to Memcache occurred in commit abc123 on [date] because [reason extracted from context].",
  "answerGrounded": true
}
```

The `answer` field is generated by a secondary Bedrock call with the retrieved context injected as prompt context. `answerGrounded: true` means the answer is traceable to at least one source record.

---

#### `log_context`

AI agent writes its reasoning to FlowSync after a push. This is what makes the knowledge base agent-driven. Called **at most once per push**, triggered by the VS Code extension notification — never during exploration.

**Input:**
```json
{
  "projectId": "string",
  "branch": "string",
  "author": "string",
  "feature": "string",
  "reasoning": "I refactored the auth token strategy to use JWT refresh tokens because the previous session-based approach caused issues with horizontal scaling. The refresh endpoint still needs rate limiting.",
  "decision": "string | null",
  "tasks": ["string"],
  "risk": "string | null"
}
```

> **`author`** is read from `git config user.name` by the extension and pre-filled in the Copilot Chat prompt. It does not require a separate per-user token — project-level Bearer auth is still used for the request itself. The `author` field enables attribution queries such as *"what has Alice been working on?"*

**Output — push-first (normal):** reasoning merged into the existing committed record:
```json
{
  "contextId": "uuid",
  "status": "complete",
  "message": "Reasoning merged into committed context record."
}
```

**Output — log-first (pre-push):** new orphaned record created, waits for push:
```json
{
  "contextId": "uuid",
  "status": "uncommitted",
  "message": "Context logged. Will be linked to your next push on this branch."
}
```

---

### Search Implementation (Bedrock Titan Embeddings)

No dedicated vector database for the prototype. Approach:

1. On context write: call `amazon.titan-embed-text-v1` with the context summary → store embedding as a `List<Number>` in `flowsync-context`
2. On `search_context` call: embed the query using the same model → compute cosine similarity against stored embeddings in-memory (retrieved via `BranchContextIndex` GSI, max ~200 records per branch per project at prototype scale)
3. Rank by similarity score, return top N
4. Pass top N results to Claude as context for the `answer` generation

This is not production-scale RAG but it's functionally correct for prototype scale (< 1,000 context records) and avoids OpenSearch / Pinecone infra complexity.

---

## 12. Dashboard

### Technology
React (TypeScript), hosted on S3 + CloudFront (static)

### Scope — Single Page, Three Sections

**1. Project Header**
- Project name, description, team members
- Last activity timestamp
- Branch selector (dropdown, fetches branch list from API)
- Connected status indicator (MCP server reachable)

**2. Commit Timeline**
- Chronological list of processed push events for selected branch
- Per entry: commit hash (linked), author, timestamp, extracted feature + decision + stage + confidence
- Unassigned events (confidence < 0.3) shown in a separate "Unassigned" section
- Uncommitted agent context records shown with a `pending commit` badge

**3. Search Bar**
- Plain text input → calls `POST /api/v1/query` (same RAG pipeline as MCP `search_context`)
- Returns answer + source citations with links to commit entries in the timeline
- Make it visually prominent — this is the demo centrepiece

### API Polling
Dashboard polls `GET /api/v1/projects/{projectId}/events?branch={branch}&since={lastSeen}` every 5 seconds. No WebSocket for prototype.

### Query API (Human-facing, same RAG as MCP)

```
POST /api/v1/query
Authorization: Bearer <token>
Body: { "projectId": "string", "query": "string", "branch": "string" }

Response: {
  "answer": "string",
  "sources": [{ "eventId", "commitHash", "timestamp", "feature", "excerpt" }],
  "confidence": 0.0,
  "branchNote": "string | null",
  "suggestedQueries": ["string"]
}
```

---

## 13. Authentication

- **Method:** Bearer token, one per project (prototype). OAuth is post-hackathon.
- Token is generated at project creation, returned once, stored hashed (`bcrypt`) in `flowsync-projects`
- Every request requires `Authorization: Bearer <token>`
- Token is scoped to one project — no cross-project access
- Stored in VS Code `SecretStorage` on client — never on disk, never in `.flowsync.json`
- All auth failures: `401 { "error": "invalid_token" }`
- All auth attempts logged to `flowsync-audit`

---

## 14. AWS Infrastructure

### Services

| Service | Usage |
|---------|-------|
| API Gateway (HTTP API) | Single entry point for all Lambda functions |
| Lambda (Node.js 20.x) | Ingestion handler |
| Lambda (Python 3.12) | AI Processing, MCP, Query |
| DynamoDB (on-demand) | All persistent state |
| S3 | Raw event archive + dashboard static hosting |
| CloudFront | Dashboard CDN |
| Amazon Bedrock | Claude 3 Sonnet + Titan Embeddings |
| CloudWatch | Logs and basic alerting |

### Region
`us-east-1` only. Single-region for prototype.

### IaC
AWS CDK (TypeScript). DevOps engineer owns this. All resources defined as code from day 1 — no console click-ops.

### Lambda Configuration

| Lambda | Runtime | Timeout | Memory |
|--------|---------|---------|--------|
| Ingestion | Node.js 20.x | 10s | 256MB |
| AI Processing | Python 3.12 | 60s | 512MB |
| MCP | Python 3.12 | 30s | 256MB |
| Query | Python 3.12 | 30s | 256MB |

---

## 15. 4-Day Build Plan

### Day 1 — Foundation

**DevOps:**
- CDK stack: DynamoDB tables, API Gateway, Lambda skeletons, S3 buckets, CloudFront
- Deploy base infrastructure to AWS
- Verify all Lambdas are invocable and tables exist

**Backend Engineer:**
- Ingestion Lambda: validation logic, DynamoDB write, S3 archive write
- `POST /api/v1/projects` endpoint (project creation + token generation)

**ML Engineer:**
- Bedrock access confirmed in `us-east-1`
- Raw Claude API call with hardcoded diff → validate JSON output matches schema
- Titan Embeddings test call → verify embedding shape

**Frontend Engineer:**
- VS Code extension scaffold: detect `.flowsync.json`, `FlowSync: Initialize Project` command, local HTTP listener on port 38475
- Extension: post-push notification ("Add reasoning?") + Copilot Chat pre-fill logic (branch, diff, author)
- Commit `.github/copilot-instructions.md` to repo as part of onboarding wizard initialization
- React app scaffold: routing, API client, basic layout

> **Day 1 Checkpoint:** Lambda receives a hardcoded POST, writes to DynamoDB, S3 write confirmed. Bedrock returns valid structured JSON.

---

### Day 2 — Core Pipeline

**ML Engineer:**
- AI Processing Lambda: full pipeline (Bedrock extraction → Titan embedding → DynamoDB write)
- Schema validation on Bedrock response with error handling
- Agent context linking logic (unlinked record detection + commitHash binding)

**Backend Engineer:**
- Wire Ingestion Lambda → AI Processing Lambda (async invocation)
- Audit log writes from AI Processing Lambda (no separate State Engine)

**DevOps:**
- End-to-end integration test: POST event → Ingestion → AI Processing → DynamoDB verified (context record + embedding)
- CloudWatch alarms for Lambda errors

**Frontend Engineer:**
- VS Code extension: onboarding wizard webview (form, API call, `.flowsync.json` write, git hook injection)
- Extension: `post-push` signal receiver, diff capture, event transmission

> **Day 2 Checkpoint:** A real push from VS Code → full pipeline → context stored in DynamoDB with embedding.

---

### Day 3 — MCP + APIs

**ML Engineer:**
- MCP Lambda: all 4 tools (`get_project_context`, `get_recent_changes`, `search_context`, `log_context`)
- Cosine similarity search implementation
- Query Lambda: RAG for dashboard search bar

**Backend Engineer:**
- Dev 2 join flow (token validation, hook injection)
- Branch context inheritance in all read endpoints
- `GET /api/v1/projects/{projectId}/events` polling endpoint for dashboard

**DevOps:**
- MCP endpoint live and testable
- Test MCP tools with a real Copilot/Claude connection

**Frontend Engineer:**
- Dashboard: project header, commit timeline, branch selector
- Uncommitted agent context records visible with `pending commit` badge

> **Day 3 Checkpoint:** AI agent connects to MCP, calls `get_project_context`, gets real data back. Dashboard shows live commit timeline.

---

### Day 4 — Polish + Demo Prep

**All:**
- Full end-to-end demo runs (at least 3 dry runs)
- Fix critical bugs only — no new features
- Search bar working with real NL queries returning cited answers
- Uncommitted agent context records visible in dashboard
- Branch switching working in dashboard

**DevOps:**
- Production deploy verified
- Fallback: `curl` test script as backup if VS Code extension has issues

**Frontend Engineer:**
- Search bar UI polished — this is the visual demo centerpiece
- Status bar indicator in VS Code (connected / disconnected)

> **Day 4 Checkpoint:** Complete 3-minute demo rehearsed and clean.

---

## 16. Demo Script (3 Minutes)

**Setup (pre-demo):** Project created, 2-3 commits already processed, at least one context record with agent reasoning merged.

**Minute 1 — The problem (30s) + live capture (30s)**
- "Here's a 1,000-commit project. Ask an AI agent why we switched databases. Watch it struggle."
- Open VS Code, make a real commit (prepared in advance), push
- Switch to dashboard — event appears in timeline within seconds
- Show Bedrock-extracted context: feature, decision, tasks, confidence

**Minute 2 — The MCP moment (60s)**
- Open Copilot Chat (or Claude)
- MCP is connected to FlowSync
- Ask: *"What's the current state of the auth module?"*
- Agent calls `get_project_context` → returns structured answer with decisions and pending tasks
- "The agent didn't read a single file. It just knew."

**Minute 3 — Traceability query (30s) + wrap (30s)**
- Open dashboard search bar
- Type: *"Why did we change the token strategy?"*
- Answer appears with source commit citation, timestamp, author
- "Every answer is traceable. Every decision is permanent. Every AI agent on the team has the same context."

---

## 17. Risk Register

| Risk | Likelihood | Mitigation |
|------|------------|-----------|
| Bedrock returns malformed JSON | Medium | Schema validation on every response; `failed` status + CloudWatch alert on parse error |
| AI hallucination in extraction | Low | `temperature: 0`, strict JSON schema, source commit reference in every record |
| Git hook not firing on some machines | Medium | Extension checks hook exists on every VS Code open; manual re-inject command available |
| Cosine similarity search too slow at scale | Low | Prototype scale < 1,000 records — in-memory compute is fine for demo |
| VS Code extension not demo-ready | Low (Day 4 buffer) | Fallback: `curl` script directly calls ingestion API with prepared diff |
| DynamoDB cold reads slow first query | Low | Provision read capacity on `ProjectContextIndex` GSI |
| Bedrock Titan Embeddings shape mismatch | Low | Test on Day 1; embedding shape is fixed at 1,536 dimensions for Titan v1 |
| Force push overwrites commit history | Low | Context record retains its original `commitHash` — known limitation for prototype. Push history and FlowSync records may diverge after a force push. Document in onboarding. Rare in normal team workflows. |

---

## 18. Success Criteria

The prototype succeeds when all of the following are demonstrated live:

- [ ] VS Code extension captures a real push and transmits it to the backend automatically
- [ ] Bedrock extracts valid structured JSON from the push with `model_version` stored
- [ ] Titan embedding generated and stored with the context record
- [ ] Context is queryable via MCP — `get_project_context` returns real data
- [ ] `search_context` returns a grounded answer with source citation for a natural language query
- [ ] `log_context` from Copilot merges agent reasoning into a committed context record (Direction A) and can create an uncommitted record (Direction B)
- [ ] Dev 2 join flow works — clone repo, detect `.flowsync.json`, connect with token, hook injected
- [ ] Branch context inheritance works — agent on feature branch inherits main context
- [ ] Dashboard shows live timeline and search works for human queries
- [ ] Full 3-minute demo runs cleanly without errors

---

## 19. Guiding Principle

> **The MCP server is the product. Everything else is infrastructure that feeds it.**
>
> If it doesn't make an AI agent smarter or the demo cleaner, don't build it this week.
