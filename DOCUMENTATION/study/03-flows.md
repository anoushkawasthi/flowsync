# 3 — The Flows

> This is the core of the study guide. Five flows; trace each one in the code as you read.
> If you only learn one thing about FlowSync, learn flow §1 and §2 — everything else is
> reading what those two wrote.

**Study tip:** split these across the team, one flow each, and present them back.

| § | Flow | Trigger | Ends at |
|---|------|---------|---------|
| 1 | [Capture](#1--capture) | `git push` | Event row in DynamoDB, 200 OK in <500 ms |
| 2 | [Extract](#2--extract) | Async Lambda invoke | Context record with embedding |
| 3 | [Agent](#3--agent) | MCP tool call | Context read or written |
| 4 | [Query](#4--query-rag) | Dashboard search | Grounded answer + citations |
| 5 | [Chat](#5--chat) | Dashboard chat | Conversational reply with session memory |

Plus: [merging](#the-merge-problem), [branch propagation](#branch-merge-propagation),
[Catch Me Up](#catch-me-up).

---

## 1 — Capture

**The problem this solves:** a git hook is a shell script. It has no VS Code API, no
credentials, and no idea what the project token is. But the extension has all three. So the
hook's only job is to shout at localhost.

```
 developer: git push
        │
        ▼
 .git/hooks/pre-push                    ← installed at init
   reads push range from stdin
   curl -s POST 127.0.0.1:<port>
        │  {event:"push", branch, remoteRef}
        ▼
 Extension HTTP listener (127.0.0.1 only)
   gitUtils.getDiff()                   ← the real work happens here
   builds event payload
        │
        ▼
 eventTransmitter.transmitEvent()
   POST https://<api>/api/v1/events
   Bearer <token>
   retries: 0ms → 1s → 2s → 4s
        │
        ▼
 API Gateway → flowsync-ingestion (Node 20)
```

### Step by step

1. **Hook install** — at project init, a `pre-push` script is written to `.git/hooks/`
   (`extension/src/commands/initProject.ts:387`). The port is baked into the script at
   install time. The code comment there is worth reading: *"pre-push is a real Git hook
   (post-push does NOT exist in Git)."* Several older docs say "post-push"; the hook is
   `pre-push`. See [`07-doc-deltas.md`](07-doc-deltas.md).

2. **The listener** — the extension binds an HTTP server to `127.0.0.1` on a free port
   starting from `38475` (`extension/src/hookListener.ts:32`, `findAvailablePort` at `:19`).
   Loopback-only, so nothing outside the machine can reach it. It accepts payloads where
   `event` is `push` or `post-push` (`hookListener.ts:52`).

3. **Diff capture** — `getDiff()` (`extension/src/gitUtils.ts:28`) has a three-tier
   strategy, in order:
   - **Push range** (best): `git diff <remoteRef> HEAD` — the hook passes the old remote SHA
     on stdin, so this captures exactly what's being pushed, even if that's ten commits.
   - **Merge base**: if HEAD is a merge commit (detected via
     `git rev-list --parents -n 1 HEAD` returning 2+ parents), diff from the merge base.
   - **Fallback**: `git diff HEAD~1 HEAD`, then `git show HEAD` for a repo's first commit.

   The diff is **truncated at 50,000 characters** (`gitUtils.ts:76`). Bedrock has a token
   limit and a giant vendored-dependency commit would blow it. Real cost: extraction quality
   degrades on very large pushes.

4. **Transmit** — `transmitEvent()` (`extension/src/eventTransmitter.ts:24`) POSTs to
   `/api/v1/events` with retry delays `[0, 1000, 2000, 4000]` ms
   (`eventTransmitter.ts:29`). Four attempts over ~7 seconds. **This is fire-and-forget from
   the developer's point of view** — the push already succeeded; nothing here can block it.

5. **Ingestion Lambda** — `infra/lambda/ingestion/index.js:224`, and the ordering here is
   the whole design:

   ```
   authenticate()          ← reject early                    ingestion/index.js:230
   validateEvent()         ← schema check                     :234
   PutCommand → events     ← THE ONLY CRITICAL WRITE          :255
   ─── everything below is wrapped in try/catch and non-fatal ───
   S3 archive                                                 :259
   InvokeCommand(AI, type='Event')   ← async, not awaited     :273
   InvokeCommand(AI, propagate)      ← only if merge          :292
   audit write                                                :306
   return 200 { status: 'processing' }                        :325
   ```

   **Read that ordering again.** Exactly one write can fail the request. If S3 is down, if
   the AI Lambda can't be invoked, if the audit write fails — the developer still gets a
   200, and the event is safely stored. The comment at `:269` says it plainly:
   *"We do NOT wait — this is what keeps us inside the 500 ms SLA."*

   The response is `status: 'processing'`, not `'done'`. The client is explicitly told the
   work is incomplete.

### Why it's built this way

A developer pushing code will not tolerate a tool that adds seconds to their workflow, and
they *definitely* won't tolerate one that fails their push. So the synchronous path is
trimmed to the absolute minimum — auth, validate, one write — and everything expensive
(Bedrock, ~2-4 s) is thrown over the wall to an async Lambda.

---

## 2 — Extract

**Trigger:** async invoke from ingestion. Nothing waits on this.
**Entry:** `infra/lambda/ai_processing/handler.py:317`.

The handler has **three distinct paths**, and mistaking one for another is the most common
source of confusion in this codebase:

```
handler(event)
  │
  ├─ event.propagate == true ──────────► branch propagation (see below)   :323
  │
  ├─ commit_hash AND orphan found ─────► bind commit to existing record   :356
  │                                       (returns early — NO extraction)
  │
  └─ otherwise ────────────────────────► full extraction                  :385
```

### The full extraction path

1. **Nova Pro reads the diff** — `call_bedrock()` (`:27`) via the **Converse API** (`:75`),
   asking for a strict JSON object: `feature`, `decision`, `tasks`, `stage`, `risk`,
   `entities`. The prompt explicitly tells the model to write *what was chosen and why*
   (`:71`). Falls back to Nova Lite on throttle (`:76`). Markdown code fences are stripped
   from the response before parsing (`:111`) — models add them despite instructions.

2. **Validate** — `validate_extraction_schema()` (`:121`) rejects malformed output. The
   model is not trusted.

3. **Score confidence deterministically** — `compute_confidence()` (`:132`). This is a good
   one to understand, because the docstring tells you what went wrong before it existed:
   *"Replaces the flat 0.85 default the model was producing."* Asking a model to rate its
   own confidence yielded a constant. So confidence is now computed from **completeness**:

   | Component | Points |
   |-----------|--------|
   | Base (feature identified) | 0.55 |
   | `decision` populated | +0.15 |
   | `risk` populated | +0.15 |
   | ≥1 task inferred | +0.10 |
   | ≥2 entities extracted | +0.05 |

   Capped at 1.0. Not a probability — a completeness score, and honest about it.

4. **Embed** — the entire extraction JSON is serialised and sent to Titan, producing a
   1536-float vector (`:165`, `:398`). **Note what gets embedded: the extraction, not the
   diff.** Semantic search therefore matches on decisions and features, not on code syntax.
   That's the right call for "what did we decide about auth?" and the wrong one for "find
   the commit that touched `parseToken`".

5. **Write the context record** (`:398`) with `status` = `complete` if there's a commit
   hash, else `uncommitted`. Floats become `Decimal` for DynamoDB (`:154`) — a Python/DDB
   gotcha that bites everyone once.

6. **Audit + project activity + CloudWatch metrics.**

Typical wall time: a few seconds, dominated by the Bedrock call. Nobody is waiting.

---

## The merge problem

Two independent writers describe the same work: the agent (Path A) and the push (Path B).
Without reconciliation you'd get two records per unit of work — one with rich reasoning and
no commit, one with a commit and inferred reasoning. So both writers look for the other's
record first. The matching rule in both directions is:

> **same `projectId` + same `branch` + same `author`, within a 30-minute window**

implemented via `BranchContextIndex` with a `BETWEEN` key condition on
`branch#timestamp` — which is exactly what that composite sort key was designed for.

### Direction A — push first, then agent logs

1. Push creates a `complete` record, with an embedding.
2. Agent calls `log_context`; it finds that record (`mcp/handler.py:258`) and **enriches**
   it: sets `agentReasoning`, and overwrites `decision`/`tasks`/`risk` if supplied.
3. Crucially, it then **re-embeds** (`mcp/handler.py:301`) — because the record's content
   just changed and a stale vector would make the enriched record unfindable. The re-embed
   is wrapped non-fatally: enrichment is more important than search ranking.

Result: one record, commit-linked, with both AI-inferred and agent-authored reasoning.
This path works well.

### Direction B — agent logs first, then push

1. `log_context` finds no match, so it creates an **orphaned record**
   (`mcp/handler.py:336`): `commitHash: None`, `status: 'uncommitted'`,
   `confidence: 0.5`, `modelVersion: 'mcp-agent'`, **`embedding: None`**.
2. The push arrives. `find_orphaned_record()` (`ai_processing/handler.py:203`) matches it,
   and `update_orphaned_record()` (`:239`) binds `commitHash`, sets `status: 'complete'`,
   and records `committedAt`.

> ### ⚠️ Known gap — verify this yourself, then decide if it matters
>
> On Direction B the record **never gets an embedding**.
> `log_context` writes `embedding: None` (`mcp/handler.py:357`). The push path finds the
> orphan and returns *early* at `ai_processing/handler.py:380` — before extraction and
> before the Titan call — so nothing ever fills it in. `update_orphaned_record` only sets
> `commitHash`, `status`, `committedAt` (`:239`).
>
> And `search_context_rag` skips any record without an embedding:
> `if not raw_embedding: continue` (`helpers.py:197`).
>
> **So agent-logged-first records are permanently invisible to semantic search**, even
> though they contain the highest-quality reasoning in the system. They still appear in the
> dashboard timeline and in `get_recent_changes`, which is likely why it hasn't been
> noticed.
>
> The fix is small — embed on create in `log_context`, or re-embed in
> `update_orphaned_record`. Flagged here rather than fixed because changing extraction
> behaviour is a decision for the team, not a docs change.

---

## Branch merge propagation

When you merge `feat/auth` into `main`, the decisions made on that branch should be part of
`main`'s memory — otherwise merging silently loses context.

- Ingestion detects `payload.isMerge && payload.sourceBranch` and fires a second async
  invoke with `propagate: true` (`ingestion/index.js:292`).
- `propagate_branch_context()` (`ai_processing/handler.py:278`) copies every `complete`
  context record from source to target, rewriting `branchExtractedAt` to
  `{targetBranch}#{timestamp}` (`:308`) and tagging each copy with `mergedFrom` (`:309`).

It **copies rather than re-points**, so the same decision now exists twice with different
branch keys. That's a deliberate trade: reads stay a single-branch Query, at the cost of
duplicated rows and duplicated 1536-float embeddings. Given DynamoDB pricing at this scale,
storage is cheaper than query complexity.

---

## 3 — Agent

Five MCP tools. The agent spawns `mcp-server/dist/index.js` over stdio; `zod` schemas
(`mcp-server/src/index.ts`) tell the agent what each tool takes.

| Tool | MCP server | Backend | Purpose |
|------|-----------|---------|---------|
| `get_project_context` | `mcp-server/src/index.ts:105` | `mcp/handler.py:45` | Project overview + recent state |
| `get_recent_changes` | `mcp-server/src/index.ts:175` | `mcp/handler.py:128` | What happened lately |
| `search_context` | `mcp-server/src/index.ts:235` | `mcp/handler.py:183` | **Semantic Q&A over the brain** |
| `log_context` | `mcp-server/src/index.ts:297` | `mcp/handler.py:221` | **Write reasoning** |
| `get_events` | `mcp-server/src/index.ts:373` | `query/handler.py:41` | Raw record listing |

**Two things to notice.**

First, `get_events` is the odd one out — it does **not** go through `POST /mcp`. It calls
`GET /api/v1/projects/{id}/events` on the query Lambda (`mcp-server/src/index.ts:400`, via `callQuery` at `:61`). Which is why the
MCP Lambda's router only knows four tools and returns `invalid_tool` for anything else
(`mcp/handler.py:397-405`). If you add a tool, you must add it in both places.

Second, **branch auto-scoping**: the server defaults `branch` to the current git branch, so
an agent asks about "the auth work" and gets the branch it's actually on, not the whole
project. Pass `branch: "all"` to widen (documented in the Copilot instructions the extension
writes, `extension/src/commands/initProject.ts:27`).

`search_context` shares the exact same RAG pipeline as the dashboard — both call
`search_context_rag` from the shared layer. One implementation, two front doors.

---

## 4 — Query (RAG)

**Route:** `POST /api/v1/query` → `query/handler.py:131` → `helpers.py:127`.

The pipeline, in `search_context_rag`:

```
1. cache check      sha256(projectId:query:branch) → flowsync-cache   helpers.py:144
      └─ hit? return immediately with cached:true
2. embed query      Titan, 1536 dims                                  helpers.py:151
3. fetch records    Query BranchContextIndex (if branch given)
                    or ProjectContextIndex (all), FULLY PAGINATED     helpers.py:157-180
4. score            cosine similarity in Lambda memory                helpers.py:197-209
                    × 0.85 penalty for non-main records when no
                      branch was specified
5. top 5            sort, slice                                       helpers.py:211
6. generate         Nova Pro over those 5 records (Lite on throttle)  helpers.py:220
7. cache write      1-hour TTL
8. return           { answer, answerGrounded, sources[] }
```

### The three things worth understanding here

**Step 3-4 is a full scan, in memory.** Every context record for the project is pulled into
the Lambda and scored with a Python loop. There is no vector index. At hackathon scale
(hundreds of records) this is fast and free. At 100k records it is neither — you'd be paying
to read the whole table on every uncached query, and eventually you'd blow the Lambda's
memory. This is the single biggest scaling limit in the system, and it's a conscious trade —
see [`04-decisions.md`](04-decisions.md) D-07.

Note the pagination loop (`helpers.py:175-179`) — an earlier version presumably read only
the first DynamoDB page and silently searched a fraction of the project.

**The cross-branch penalty** (`helpers.py:193`, `CROSS_BRANCH_PENALTY = 0.85`). When no
branch is specified, records not on `main` are scored down 15%. Why: without it, a dozen
records on an experimental branch outrank the two on `main` that actually describe shipped
behaviour. It's a heuristic, tuned by feel, and it's the kind of thing you should know is
a heuristic when a search result looks odd.

**Records without embeddings are skipped**, as are any whose vector isn't exactly 1536 long
(`helpers.py:197-201`) — defensive, in case an embedding model ever changes dimensions.

---

## 5 — Chat

**Route:** `POST /api/v1/chat` → `chat/handler.py:113`.

Chat is *not* just RAG with history. It first classifies the message
(`needs_factual_answer()`, `chat/handler.py:70`) with a two-tier regex:

- **Conversational patterns win first** — `^(can you|could you|please|help me)`,
  `how do i|should i`, `suggest|recommend`, `^(write|create|generate|build)`.
- **Then factual patterns** — `^(what|when|where|who|which|how many)`, `explain|describe`,
  `decision|why did`, `developer|author|contributor`, `feature|commit|change`.
- **Ambiguous → conversational** (`:110`).

Factual questions get retrieval (`retrieve_relevant_context`, `:243`) and a grounded,
cited answer. Conversational ones get a normal Nova Lite reply without dragging irrelevant
context into the prompt.

Why bother: "who wrote the auth module?" must be grounded in real records, but "can you
help me name this function?" doesn't need retrieval, and stuffing five unrelated context
records into that prompt makes the answer *worse*, not better. Regex is a blunt instrument
— an LLM classifier would be better but costs a round trip on every message.

Sessions live in `flowsync-chat-sessions`, keyed by `sessionId`
(`get_or_create_session`, `:175`; `update_session`, `:216`). The system prompt is assembled
per-request from retrieved context (`build_system_prompt`, `:446`), and sources are attached
to the reply (`format_sources`, `:498`).

Chat uses **Nova Lite**, not Pro (`chat/handler.py:33`, `CHAT_MODEL_ID`) — interactive latency matters more
than peak reasoning quality, and it's roughly 4× cheaper.

---

## Catch Me Up

A small flow, but it's the one that demos best.

`extension/src/commands/catchMeUp.ts:41` — reads a `lastSeen` timestamp, fetches events
since then (`fetchEvents(..., { since, limit: 50 })`, `:146`), aggregates them into a
summary (`:150`) and shows it. There's an auto-trigger on activation
(`checkAndAutoTriggerCatchMeUp`, `:281`), so opening a project after a week greets you with
what the team did.

It reads through the **query Lambda's** `get_events` (`query/handler.py:41`), which strips
embeddings from responses before returning (`strip_embeddings`, `helpers.py:76`) — 1536
floats per record would otherwise dominate the payload.

---

## Putting it together: one push, end to end

```
t+0.0s   developer runs: git push
t+0.0s   pre-push hook fires → curl 127.0.0.1:38475
t+0.1s   extension runs git diff (push range), builds payload
t+0.2s   POST /api/v1/events  (Bearer token)
t+0.3s   ingestion: auth → validate → write flowsync-events
t+0.3s   ingestion: async-invoke AI Lambda, archive to S3, write audit
t+0.4s   200 OK { status: 'processing' }   ← developer's push is done
──────── developer is gone; everything below is background ────────
t+0.5s   AI Lambda cold-starts, checks for an orphaned record
t+3.0s   Nova Pro returns extraction JSON (feature/decision/risk/tasks)
t+3.2s   confidence computed, Titan returns a 1536-dim vector
t+3.4s   context record written → the project brain has grown
──────── a week later ────────
         teammate asks the dashboard "why do we hash tokens with scrypt?"
         → embed query → score every record → top 5 → Nova Pro
         → grounded answer + citation pointing at that very commit
```

That last arrow is the entire product.

---

**Next:** [`04-decisions.md`](04-decisions.md) — why it's built this way, and what each
choice costs.
