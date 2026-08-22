# 2 — The Stack

> Every technology in FlowSync, where it lives, and why it's there.
> Verified against the manifests and the CDK stack, not from memory.

---

## At a glance

| Layer | Technology | Lives in |
|-------|-----------|----------|
| IDE extension | TypeScript, VS Code API `^1.109.0`, webpack | `extension/` |
| MCP server | TypeScript, `@modelcontextprotocol/sdk` ^1.12, `zod`, stdio | `mcp-server/` |
| Dashboard | Next.js 14.2 (static export), React 18, Tailwind 3.4, shadcn/Radix, Recharts | `frontend/` |
| Infrastructure | AWS CDK v2 (`aws-cdk-lib` ^2.240), TypeScript | `infra/lib/infra-stack.ts` |
| API | Amazon API Gateway (REST) | `infra/lib/infra-stack.ts:266` |
| Compute | AWS Lambda — **1 × Node.js 20, 4 × Python 3.12** | `infra/lambda/` |
| AI | Amazon Bedrock — Nova Pro, Nova Lite, Titan Embeddings v1 | `infra/lambda/*/handler.py` |
| Storage | DynamoDB (6 tables + 4 GSIs) + S3 (raw archive, dashboard hosting) | `infra/lib/infra-stack.ts:22-104` |

**Note the mixed Lambda runtimes.** The root README says "Python 3.12" for compute; that's
true of four of the five. Ingestion is Node.js 20 (`infra/lib/infra-stack.ts:147`). See
[`07-doc-deltas.md`](07-doc-deltas.md).

---

## Client layer

### VS Code extension — `extension/`

TypeScript, bundled by webpack into a VSIX, **zero runtime dependencies** (everything is a
devDependency; it uses only the VS Code API and Node built-ins like `http`, `https`,
`crypto`, `child_process`). That's deliberate — it keeps the VSIX small and the supply
chain trivial.

Activates on `workspaceContains:.flowsync.json` or when the sidebar view is opened
(`extension/package.json` → `activationEvents`), so it costs nothing in unrelated projects.

Nine commands are contributed: `openPanel`, `catchMeUp`, `recordReasoning`,
`openWebDashboard`, `openChat`, `refresh`, `openOutput`, `initProject`, `joinProject`.

Its most unusual job: it runs a **local HTTP server on 127.0.0.1** so a git hook (a shell
script, which knows nothing about VS Code) can talk to it. Port discovery starts at `38475`
and walks upward to find a free port (`extension/src/config.ts:5`,
`extension/src/hookListener.ts:19`).

### MCP server — `mcp-server/`

A single file, `src/index.ts`, ~420 lines. It's an ESM Node program speaking MCP over
**stdio** — the agent spawns it as a subprocess and talks over stdin/stdout. `zod` defines
the tool input schemas, which is what gives the agent typed, self-describing tools.

It is a **thin proxy**: four of five tools just forward to `POST /mcp` on API Gateway. The
fifth, `get_events`, calls `GET /api/v1/projects/{id}/events` instead — worth knowing,
because it means `get_events` is served by the *query* Lambda, not the MCP Lambda
(`mcp-server/src/index.ts:373`). All the logic lives server-side, so fixing a tool usually
does not require shipping a new VSIX.

It can also be bundled straight into the extension: `npm run bundle` emits
`extension/dist/mcp-server.mjs` via esbuild.

### Dashboard — `frontend/`

Next.js 14 App Router with **`output: 'export'`** (`frontend/next.config.js`) — a fully
static site, no Node server, no SSR. That's what lets it live on S3 behind CloudFront for
pennies. Consequence: **there is no server-side secret**; the project token is held in the
browser and sent directly to API Gateway.

- **Styling:** Tailwind 3.4 with a neobrutalist theme (`src/app/neo.css`,
  `src/app/tokens.css`), `next-themes` for light/dark.
- **Components:** shadcn-style primitives over Radix (`src/components/ui/`).
- **Charts:** Recharts (`src/components/analytics/`).
- **Data:** `axios` in `src/lib/api.ts`, wrapped by hooks in `src/hooks/`
  (`useEvents`, `useSearch`, `useBranches`, `useConfig`).
- **Markdown:** `react-markdown` + `react-syntax-highlighter` for rendering chat answers.

Five routes: `/` (landing + login), `/dashboard`, `/search`, `/chat`, `/analytics`,
`/settings`.

---

## Backend layer

### API Gateway — REST API

Routes, all defined at `infra/lib/infra-stack.ts:266-287`:

| Method | Path | Lambda |
|--------|------|--------|
| POST | `/api/v1/events` | ingestion |
| POST | `/api/v1/projects` | ingestion (create project) |
| GET | `/api/v1/projects/{projectId}` | ingestion (join / validate token) |
| GET | `/api/v1/projects/{projectId}/events` | query |
| POST | `/api/v1/query` | query (RAG search) |
| POST | `/api/v1/chat` | chat |
| POST | `/mcp` | mcp |

Note `/mcp` sits at the **root**, not under `/api/v1` — a small inconsistency, but it's
what the MCP server targets, so don't "fix" it without updating the client.

### The five Lambdas

| Function | Runtime | Timeout | Memory | Job |
|----------|---------|---------|--------|-----|
| `flowsync-ingestion` | Node.js 20 | 10 s | 256 MB | Auth, validate, persist, fan out. Must be fast. |
| `flowsync-ai-processing` | Python 3.12 | 60 s | 512 MB | Bedrock extraction, embedding, merge, branch propagation. Async only. |
| `flowsync-mcp` | Python 3.12 | 30 s | 256 MB | Routes 4 MCP tool calls |
| `flowsync-query` | Python 3.12 | 30 s | 256 MB | Event listing + RAG search |
| `flowsync-chat` | Python 3.12 | 30 s | 512 MB | Conversational interface with sessions |

Defined at `infra/lib/infra-stack.ts:145`, `:162`, `:179`, `:197`, `:214`.

The Python Lambdas share code through a **Lambda layer** (`FlowSyncSharedLayer`,
`infra/lib/infra-stack.ts:134`) containing `flowsync_common` — `auth.py` (token extraction
and verification) and `helpers.py` (embeddings, cosine similarity, caching, and the whole
RAG pipeline in `search_context_rag`). If you fix RAG behaviour, you fix it once, in the
layer, and both query and MCP inherit it.

Why is ingestion the odd one out in Node? It's the only Lambda on the hot path with a hard
latency target, and it does no AI work — just crypto, validation, and three SDK writes.
Node's cold start beats Python's, and the whole file is dependency-free
(`infra/lambda/ingestion/index.js`).

### Bedrock models

| Model | ID | Used for | Where |
|-------|----|----------|-------|
| Nova Pro | `us.amazon.nova-pro-v1:0` | Intent extraction from diffs; RAG answer generation | `ai_processing/handler.py:12`, `helpers.py:16` |
| Nova Lite | `us.amazon.nova-lite-v1:0` | Chat; fallback when Pro throttles | `chat/handler.py:33`, `ai_processing/handler.py:14` |
| Titan Embeddings v1 | `amazon.titan-embed-text-v1` | 1536-dim embeddings for every context record and every query | `helpers.py:15` |

Extraction uses the Bedrock **Converse API** rather than `invoke_model`, so the model is
swappable without rewriting the request shape (`ai_processing/handler.py:75`). Embeddings
still use `invoke_model` because Titan isn't a Converse-API model
(`ai_processing/handler.py:168`).

---

## Storage layer

### DynamoDB — 6 tables

All `PAY_PER_REQUEST`, all `RemovalPolicy.DESTROY` (hackathon cleanup — **this would delete
your data on a stack teardown in production**).

| Table | PK | SK | Holds |
|-------|----|----|-------|
| `flowsync-projects` | `projectId` | — | Metadata + scrypt-hashed API token |
| `flowsync-events` | `projectId` | `timestampEventId` | Raw push events |
| `flowsync-context` | `eventId` | — | **The project brain**: extracted context + embedding |
| `flowsync-audit` | `entityId` | `timestamp` | Append-only audit trail |
| `flowsync-chat-sessions` | `sessionId` | — | Chat history per session |
| `flowsync-cache` | `cacheKey` | — | RAG response cache, 1-hour TTL |

Plus four **GSIs**, and these are the key to understanding every read path
(`infra/lib/infra-stack.ts:36-68`):

| Index | On | Key | Answers |
|-------|----|----|---------|
| `EventIdIndex` | events | `eventId` | "fetch one event by id" |
| `BranchIndex` | events | `projectId` + `branchTimestamp` | "events on branch X, in order" |
| `ProjectContextIndex` | context | `projectId` + `extractedAt` | "all context for project, chronological" |
| `BranchContextIndex` | context | `projectId` + `branchExtractedAt` | "context on branch X" |

**The composite sort keys are the trick worth internalising.** `flowsync-context` is keyed
by `eventId` — great for point lookups, useless for "show me this project's timeline". So
the writer synthesises two extra attributes at write time:

- `branchTimestamp = "{branch}#{timestamp}"` (`ingestion/index.js:244`)
- `branchExtractedAt = "{branch}#{timestamp}"` (`ai_processing/handler.py:402`)

That turns "all context on branch `feat/auth`" into a single `begins_with(branchExtractedAt,
'feat/auth#')` Query instead of a Scan (`helpers.py:161`). One denormalised string field
buys you the whole branch-scoped read path.

### S3 — two buckets

- **Raw event archive** — every event payload written to
  `raw-events/{projectId}/{eventId}.json` (`ingestion/index.js:261`). Non-fatal on failure;
  it's an audit and future-training asset, not a dependency.
- **Dashboard hosting** — the static Next.js export, fronted by CloudFront.

---

## Cross-cutting

**Auth** — one bearer token per project, hashed with **scrypt** (Node's defaults: N=16384,
r=8, p=1, 64-byte key) and stored as `salt:hash` (`ingestion/index.js:53`). Verification
uses `crypto.timingSafeEqual` to prevent timing enumeration (`ingestion/index.js:64`). The
Python side mirrors this in `flowsync_common/auth.py:41`.

**Observability** — CloudWatch custom metrics published from the Lambdas
(`publish_metric`, `mcp/handler.py:29`; `publish_cloudwatch_metric`,
`ai_processing/handler.py:254`), plus structured JSON timing logs from ingestion
(`ingestion/index.js:324`, the `INGESTION_TIMING` line).

**Testing** — Jest configured in `infra/` (`infra/jest.config.js`); `@vscode/test-cli` for
the extension (`extension/src/test/extension.test.ts`). Coverage is thin — this is a
hackathon build, and the original test strategy in `../init-design.md` §Testing Strategy is
aspirational rather than implemented.

---

**Next:** [`03-flows.md`](03-flows.md) — how a push becomes an answer.
