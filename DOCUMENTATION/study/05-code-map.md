# 5 — The Code Map

> Where to open the file. Use this as a lookup table, not a read-through.

---

## Repository layout

```
flowsync/
├── extension/       VS Code extension (TypeScript → VSIX)
├── mcp-server/      MCP stdio server (TypeScript, one file)
├── frontend/        Next.js dashboard (static export)
├── infra/           AWS CDK stack + all five Lambdas
├── DOCUMENTATION/   Reference docs + this study guide
├── design/          Logo and icon assets
└── paper/           LaTeX write-up
```

Four deployable artifacts: the VSIX, the MCP server bundle, the static site, the CDK stack.

---

## "I need to change X" — start here

| Symptom / task | File |
|----------------|------|
| Push isn't captured at all | `extension/src/hookListener.ts`, then `.git/hooks/pre-push` in the test repo |
| Wrong diff captured | `extension/src/gitUtils.ts:28` |
| Event rejected with 400 | `infra/lambda/ingestion/index.js:130` (`validateEvent`) |
| 401 / token problems | `ingestion/index.js:96` **and** `flowsync_common/auth.py:94` (both!) |
| Extraction quality is poor | `infra/lambda/ai_processing/handler.py:27` (the prompt) |
| Confidence looks wrong | `ai_processing/handler.py:132` |
| Search returns nothing / wrong results | `flowsync_common/helpers.py:127` |
| Search returns stale results | The cache — `helpers.py:99`, 1-hour TTL |
| Chat answers ungrounded | `chat/handler.py:70` (routing), `:446` (system prompt) |
| Adding an MCP tool | `mcp-server/src/index.ts` **and** `infra/lambda/mcp/handler.py:397` |
| New API route | `infra/lib/infra-stack.ts:266` |
| New DynamoDB access pattern | `infra/lib/infra-stack.ts:36` (you'll need a GSI) |
| Dashboard data wrong | `frontend/src/lib/api.ts`, then `frontend/src/hooks/` |
| Timeline rendering | `frontend/src/components/dashboard/Timeline.tsx` |

---

## Extension — `extension/`

Entry point `src/extension.ts:59` (`activate`). Registers commands, starts the hook
listener, wires up the sidebar. Activation is lazy — `workspaceContains:.flowsync.json` or
opening the sidebar view.

| File | Lines | Responsibility |
|------|-------|----------------|
| `extension.ts` | ~320 | Activation, command registration, lifecycle |
| `hookListener.ts` | ~95 | Loopback HTTP server; `startHookListener:32`, `findAvailablePort:19` |
| `gitUtils.ts` | ~95 | `getDiff:28` (three-tier strategy), `getLastCommitInfo:82` |
| `eventTransmitter.ts` | ~110 | `transmitEvent:24`, retry `[0,1s,2s,4s]` at `:29` |
| `api.ts` | ~200 | Shared HTTP transport; default API URL at `:16`, dashboard URL `:18` |
| `autoDetect.ts` | ~340 | Project name `:21`, languages `:82`, frameworks `:155`, branch `:210`, description `:241`, `detectAll:285` |
| `config.ts` | ~100 | `.flowsync.json` read/write; `BASE_PORT = 38475` at `:5` |
| `mcpTools.ts` | — | The five tool descriptors surfaced in the UI, `:26-54` |
| `logger.ts` | — | Output-channel logging (`log.step/ok/warn/error`) |
| `notifications.ts` | — | Toasts |
| `commands/initProject.ts` | ~440 | Init flow; **hook injection at `:387`**, Copilot instructions at `:383` |
| `commands/joinProject.ts` | — | Dev-2+ join with an existing token |
| `commands/catchMeUp.ts` | ~300 | `runCatchMeUp:41`, auto-trigger `:281` |
| `commands/recordReasoning.ts` | — | Manual `log_context` from the palette |
| `panels/FlowSyncPanel.ts`, `webviewHtml.ts`, `FlowSyncSidebar.ts` | — | Webview UI |

**Read `commands/initProject.ts` first.** It's the most instructive file in the extension:
it auto-detects the project, creates it server-side, writes `.flowsync.json`, writes the
Copilot instructions file, injects the git hook, and shows the token modal — the whole
onboarding story in one place.

The generated hook (`initProject.ts:402`) is nine lines of `sh`: read the push range from
stdin, get the branch, and `curl` to `http://localhost:<port>/flowsync-hook` with a
trailing `&` so the push is never delayed.

> **Naming trivia that will confuse you:** logs, the hook comment, and some strings say
> **"BuildBerry"** (`extension.ts:72`, `initProject.ts:16`, `initProject.ts:403`) — a leftover from an earlier
> name. Same product. Command IDs and config are all `flowsync.*`.

---

## MCP server — `mcp-server/src/index.ts`

One file, ~420 lines, and worth reading start to finish — it's the clearest statement of
what an agent can do with FlowSync.

| Lines | What |
|-------|------|
| `:61` | `callQuery` — transport for the query API |
| `:94` | Server construction (`name: "flowsync"`) |
| `:105` | `get_project_context` |
| `:175` | `get_recent_changes` |
| `:235` | `search_context` |
| `:297` | `log_context` |
| `:373` | `get_events` — **routes to the query API, not `/mcp`** (`:400`) |
| end | `StdioServerTransport` + `server.connect` |

Each tool is: a zod schema, a call to the backend, and a text-content response. The pattern
is uniform, so adding a tool means copying ~40 lines — plus a branch in
`infra/lambda/mcp/handler.py:397`, or the backend returns `invalid_tool`.

---

## Backend — `infra/`

### CDK stack — `lib/infra-stack.ts` (370 lines)

Read top to bottom once; it *is* the architecture document.

| Lines | Section |
|-------|---------|
| `22-95` | Six DynamoDB tables + four GSIs |
| `101` | Raw events S3 bucket |
| `134` | Shared Python Lambda layer |
| `145-230` | Five Lambda functions |
| `266-287` | API Gateway routes |
| `306-360` | Frontend bucket, CloudFront distribution, deployment |

### Ingestion — `lambda/ingestion/index.js` (392 lines, Node 20)

| Lines | Function |
|-------|----------|
| `:53` / `:59` | `hashToken` / `verifyToken` (scrypt + `timingSafeEqual`) |
| `:88` / `:96` | `extractToken` / `authenticate` |
| `:111` / `:130` | `validateProjectInput` / `validateEvent` |
| `:171` | `createProject` — generates the project ID and token |
| `:224` | `ingestEvent` — **the hot path**; read `:255-306` for the critical/non-fatal split |
| `:338` | `getProject` — token validation for the join flow |
| `:369` | Router (`method` + `resource`) |

### AI processing — `lambda/ai_processing/handler.py` (488 lines)

| Lines | Function |
|-------|----------|
| `:12-14` | Model IDs |
| `:27` | `call_bedrock` — the extraction prompt lives here |
| `:121` / `:132` | `validate_extraction_schema` / `compute_confidence` |
| `:154` | `convert_floats_to_decimal` (the DynamoDB float gotcha) |
| `:165` | `call_titan_embedding` |
| `:203` / `:239` | `find_orphaned_record` / `update_orphaned_record` (Direction B) |
| `:278` | `propagate_branch_context` |
| `:317` | `handler` — three paths: propagate `:323`, orphan-bind `:356`, extract `:385` |

### MCP handler — `lambda/mcp/handler.py` (413 lines)

`get_project_context:45`, `get_recent_changes:128`, `search_context:183`,
`log_context:221`, router `:383`. The interesting half of `log_context` is the merge
branch at `:258` and the orphan creation at `:336`.

### Query — `lambda/query/handler.py` (194 lines)

`get_events:41` (strips embeddings before responding), `query_search:131` (thin wrapper
over the shared RAG pipeline), router `:178`.

### Chat — `lambda/chat/handler.py` (526 lines)

`needs_factual_answer:70`, `lambda_handler:113`, `get_or_create_session:175`,
`update_session:216`, `retrieve_relevant_context:243`, `generate_chat_response:286`,
`build_system_prompt:446`, `format_sources:498`.

### Shared layer — `lambda/shared/python/flowsync_common/`

**The most important file in the backend is `helpers.py:127`** — `search_context_rag`, the
whole RAG pipeline, shared by query and MCP.

`helpers.py`: `call_titan_embedding:51`, `cosine_similarity:66`, `strip_embeddings:76`,
`convert_floats_to_decimal:87`, `check_cache:99`, `write_cache:112`, `search_context_rag:127`.

`auth.py`: `extract_token:16`, `verify_token:41`, `authenticate:94`.

---

## Frontend — `frontend/src/`

```
app/          routes: / (landing), /dashboard, /search, /chat, /analytics, /settings
components/   landing, dashboard, search, analytics, layout, theme, shared, ui
hooks/        useAppContext, useEvents, useSearch, useBranches, useConfig, ...
lib/          api.ts, mock-data.ts, constants.ts, theme-colors.ts, utils.ts
types/        index.ts — the shared TypeScript shapes
```

`lib/api.ts` is the entire backend surface the dashboard uses — four functions:

| Function | Line | Endpoint |
|----------|------|----------|
| `getProjectInfo` | `:16` | `GET /api/v1/projects/{id}` |
| `getEvents` | `:30` | `GET /api/v1/projects/{id}/events` |
| `searchContext` | `:68` | `POST /api/v1/query` |
| `sendChatMessage` | `:112` | `POST /api/v1/chat` |

Everything else is presentation. The hooks in `src/hooks/` wrap those four calls with
loading/error state; `useAppContext.tsx` holds the project ID and token.

`lib/mock-data.ts` powers the "Try Demo Project" path — useful for developing UI without a
live backend.

Styling is Tailwind plus a neobrutalist layer in `app/neo.css` and `app/tokens.css`; theme
switching via `next-themes` (`components/theme/`).

---

## Where the same thing is implemented twice

Know these — they're the places a change silently half-lands:

1. **Token auth** — `ingestion/index.js:53-108` (Node) and `flowsync_common/auth.py`
   (Python). Both must agree on scrypt parameters and the `salt:hash` format.
2. **MCP tool list** — `mcp-server/src/index.ts` (5 tools) and `mcp/handler.py:397`
   (4 routed; `get_events` goes elsewhere).
3. **Titan embedding** — `ai_processing/handler.py:165` and `helpers.py:51`. The AI Lambda
   keeps a local copy rather than using the layer's.
4. **The composite sort key** — written in `ingestion/index.js:244` and
   `ai_processing/handler.py:402`, read in `helpers.py:161` and `mcp/handler.py:258`.
   Change the `{branch}#{timestamp}` format and four places break.

---

## Running it locally

```bash
# MCP server
cd mcp-server && npm install && npm run build && npm start

# Extension (F5 in VS Code launches an Extension Development Host)
cd extension && npm install && npm run compile

# Dashboard
cd frontend && npm install && npm run dev      # http://localhost:3000

# Infrastructure
cd infra && npm install && npx cdk diff        # inspect before you deploy
```

The dashboard's demo mode (`lib/mock-data.ts`) means you can work on the frontend without
deploying anything.

---

**Next:** [`06-self-check.md`](06-self-check.md) — find out whether it stuck.
