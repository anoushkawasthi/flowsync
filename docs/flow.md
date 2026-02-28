# FlowSync — Full Flow Trace

> End-to-end walkthrough of every path through the system. Use this as the integration reference during build week.

---

## Phase 0 — Onboarding (once per project)

### Dev 1 — Project Initialization

1. Runs `FlowSync: Initialize Project` from VS Code Command Palette
2. Fills the wizard form (name, description, languages, default branch)
3. Extension calls `POST /api/v1/projects` → backend creates project record in `flowsync-projects`, generates bcrypt-hashed Bearer token, returns `{ projectId, apiToken }`
4. Extension writes `.flowsync.json` to repo root (projectId + backendUrl, no secrets)
5. Extension writes `.github/copilot-instructions.md` to repo root — this is what makes Copilot proactively call FlowSync before every task
6. Both files committed to the repo — Dev 2 receives them automatically via clone/pull
7. API token stored in VS Code `SecretStorage` — never on disk, never in `.flowsync.json`
8. Extension injects `.git/hooks/post-push`:
   ```sh
   #!/bin/sh
   curl -s http://localhost:38475/flowsync-hook \
     --data "{\"event\":\"post-push\",\"branch\":\"$(git branch --show-current)\"}"
   ```
9. (Optional) Last 50 commits batched to ingestion pipeline as background seed job — knowledge base starts populated

### Dev 2+ — Joining an Existing Project

1. Clones the repo — receives `.flowsync.json` and `.github/copilot-instructions.md` automatically
2. On VS Code open, extension detects `.flowsync.json`, no token in `SecretStorage` → prompts:
   > "FlowSync project detected. Enter your API token to connect."
3. Token shared out-of-band by Dev 1 (Slack, email)
4. Extension validates: `GET /api/v1/projects/{projectId}` → 200 → connected; 401 → re-prompt
5. Extension injects the post-push hook into Dev 2's local `.git/hooks/`
6. Dev 2 is now writing to the same shared knowledge base — no further configuration needed

---

## Phase 1 — Developer Pushes Code (Write Path)

### Step 1 — Git hook fires (any push source)

```
git push  →  .git/hooks/post-push fires  →  curl localhost:38475/flowsync-hook
```

Works regardless of whether the push came from VS Code, terminal, or any GUI git client.

### Step 2 — Extension listener receives signal (port 38475)

- `git diff HEAD~1 HEAD` → diff (truncated at 50,000 chars)
- `git log -1 --format="%H|%s|%an|%aI"` → commitHash, message, author, timestamp
- `git branch --show-current` → branch name
- `git merge-base --fork-point main HEAD` → parentBranch
- Packages into `CapturedEvent` and POSTs to `POST /api/v1/events` with Bearer token
- On failure: retry at 1s → 2s → 4s (max 3 attempts); failed events persisted in extension `globalState`

### Step 3 — Ingestion Lambda (Node.js 20.x)

1. Validates Bearer token → confirms project exists in `flowsync-projects`, hash matches
2. Validates event schema (commitHash format, UUID, branch, diff length, etc.)
3. Writes event to `flowsync-events` with `processingStatus: pending`
4. Archives raw payload to S3: `raw-events/{projectId}/{eventId}.json`
5. Invokes AI Processing Lambda (`InvocationType: Event` — non-blocking)
6. Returns `{ eventId, status: "processing" }` to extension within **500ms**

### Step 4 — AI Processing Lambda (Python 3.12)

```
Checks flowsync-context for existing orphaned record:
  same projectId + branch + author, commitHash: null, within 30-min window

[NOT FOUND — normal push-first path]
  → Calls Claude 3 Sonnet (temperature: 0, strict JSON output only)
  → Schema validates response: feature, decision, tasks, stage, risk, confidence, entities
  → Calls Titan Embeddings (amazon.titan-embed-text-v1) → 1,536-dim vector
  → Writes new complete record to flowsync-context
      { status: complete, commitHash: <sha>, modelVersion: <pinned ID> }

[FOUND — log-first edge case, agent wrote before pushing]
  → Binds commitHash to the existing orphaned record
  → Calls Bedrock for code-level entities extraction only
  → Merges agent reasoning + Bedrock extraction into the record
  → Marks status: complete

Both paths:
  → Updates flowsync-projects: lastActivityAt, eventCount++
  → Marks flowsync-events processingStatus: completed
  → Writes audit record to flowsync-audit
```

### Step 5 — VS Code notification fires

Extension shows:
> **"FlowSync captured your push. Add reasoning?"** `[Add Context]` `[Dismiss]`

**Developer clicks Add Context:**
1. Extension reads `git config user.name` → author identity
2. Opens Copilot Chat with pre-filled prompt:
   ```
   A push was just detected on branch {branch}. Here is the diff:

   {diff}

   Call the FlowSync `log_context` MCP tool with your reasoning: what was decided,
   what changed, what is still pending, and any risks. Set the `author` field to "{git_user_name}".
   ```
3. Copilot calls `log_context` via MCP → MCP Lambda scans `flowsync-context` for a `complete` record on same branch + author within 30-min window → **found** → merges `agentReasoning` into it
4. Final record = Bedrock code extraction **+** agent reasoning, both bound to `commitHash`, `status: complete`

**Developer clicks Dismiss:** no context written. Bedrock extraction record stands on its own.

**Usage rule:** `log_context` is called at most once per push. Never during iteration or exploration.

---

## Phase 2 — AI Agent Starts a Task (Read Path)

Triggered automatically by `.github/copilot-instructions.md` before every Copilot task.

### `get_project_context` — primary orientation call

1. MCP Lambda fetches last 10 context records for requested branch via `BranchContextIndex` GSI
2. Fetches parent branch context (e.g. `main`), merges — branch-specific records take priority on conflicts
3. Returns unified `recentContext`:
   ```json
   {
     "recentContext": [
       {
         "feature": "Authentication Module",
         "stage": "Feature Development",
         "decision": "Switched to JWT refresh token strategy",
         "pendingTasks": ["Add refresh endpoint", "Rate limit refresh route"],
         "risk": "Token expiry edge cases not handled",
         "author": "Alice",
         "commitHash": "a3f9c12...",
         "lastActivity": "2026-02-28T10:43:00Z"
       }
     ]
   }
   ```
4. Agent knows current state — decisions made, what's in progress, risks flagged — without reading any source files

### `get_recent_changes` — granular recent history

- Returns last N context records with author, timestamp, confidence, commitHash
- Used when the agent wants a chronological view rather than a summarised state

### `search_context` — semantic question answering

1. Query string embedded via Titan Embeddings → 1,536-dim vector
2. All context records for the branch retrieved via `BranchContextIndex` GSI (max ~200 at prototype scale)
3. Cosine similarity computed in-memory against all stored embeddings
4. Top N results ranked by similarity score
5. Top N injected as context into a secondary Claude 3 Sonnet call
6. Returns:
   ```json
   {
     "answer": "The switch from Redis to Memcache occurred in commit a3f9c12 on 2026-01-14 because Memcache had lower operational overhead for the team's use case.",
     "answerGrounded": true,
     "results": [{ "relevanceScore": 0.94, "commitHash": "...", "author": "...", "timestamp": "..." }]
   }
   ```

### `log_context` — agent writes reasoning (MCP write)

Two directions depending on timing:

| Path | Trigger | What happens |
|------|---------|--------------|
| **Push-first (normal)** | Push lands → notification → Copilot calls `log_context` | MCP Lambda finds existing `complete` record (same branch + author, ≤30 min) → merges `agentReasoning` in → returns `status: complete` |
| **Log-first (edge case)** | Agent proactively calls before pushing | Creates orphaned record `{ commitHash: null, status: uncommitted }` → AI Processing Lambda binds `commitHash` when push arrives within 30 min |

Lookup key for both directions: `projectId + branch + author` within ±30 minutes.

---

## Phase 3 — Human Developer Checks Dashboard (Visibility Path)

1. Opens dashboard (React, S3 + CloudFront static hosting)
2. Selects project + branch from dropdown

**Timeline section:**
- Dashboard polls `GET /api/v1/projects/{projectId}/events?branch={branch}&since={lastSeen}` every 5 seconds
- Chronological list of context records: feature, decision, stage, confidence, author, commit link
- Uncommitted agent records shown with `pending commit` badge
- Low-confidence records (< 0.3) in a separate `Unassigned` section

**Search bar:**
- Plain text query → `POST /api/v1/query`
- Same RAG pipeline as `search_context` (Query Lambda — Python 3.12)
- Returns answer + source citations with links back to timeline entries
- This is the visual demo centrepiece

---

## Branch Context — Inheritance at Every Read

Every MCP read and dashboard query resolves context through the inheritance tree.

```
main
└── feature/auth-refactor    ← inherits all of main's context automatically
    └── feature/auth-rate-limit  ← inherits feature/auth-refactor + main
```

- Agent on `feature/auth-refactor` sees all `main` decisions without explicitly asking
- On merge: feature branch records tagged `mergedInto: main`, `mergedAt: timestamp`
- Records remain permanently queryable from both branches for traceability

---

## What a Complete Context Record Looks Like

When the full write path completes (push + agent reasoning), a record in `flowsync-context` looks like:

```json
{
  "eventId": "550e8400-e29b-41d4-a716-446655440000",
  "projectId": "uuid",
  "branch": "feature/auth-refactor",
  "parentBranch": "main",
  "commitHash": "a3f9c12d8e4b1f6a2c7d9e0b3f5a8c1d4e7b2f9a",
  "status": "complete",
  "feature": "Authentication Module",
  "decision": "Switched to JWT refresh token strategy",
  "tasks": ["Add refresh endpoint", "Rate limit refresh route"],
  "stage": "Feature Development",
  "risk": "Token expiry edge cases not handled",
  "confidence": 0.91,
  "entities": ["refreshToken()", "AuthMiddleware", "src/auth/tokens.ts"],
  "agentReasoning": {
    "reasoning": "Session-based auth breaks horizontal scaling. JWT refresh tokens allow stateless verification across instances.",
    "decision": "JWT refresh tokens",
    "tasks": ["Rate limit refresh route"],
    "risk": "Expiry edge cases need handling"
  },
  "author": "Alice",
  "modelVersion": "anthropic.claude-3-sonnet-20240229-v1:0",
  "embedding": [0.023, -0.14, 0.087, "...1536 dims total"],
  "extractedAt": "2026-02-28T10:43:00Z",
  "processingDuration": 2340
}
```

---

## Flow Summary (One Line Per Step)

```
Dev pushes
  → post-push hook fires
    → extension captures diff + metadata
      → POST /api/v1/events (Ingestion Lambda validates + stores)
        → AI Processing Lambda invoked async
          → Claude 3 Sonnet extracts structured context (temp=0)
            → Titan Embeddings generates vector
              → flowsync-context record written (status: complete)
                → VS Code notification: "Add reasoning?"
                  → developer clicks → Copilot Chat pre-filled
                    → Copilot calls log_context via MCP
                      → agentReasoning merged into existing record

Next dev's Copilot starts a task
  → copilot-instructions.md triggers get_project_context
    → MCP Lambda fetches + merges branch inheritance tree
      → agent has full context: decisions, risks, pending tasks
        → agent works informed, not blind
```
