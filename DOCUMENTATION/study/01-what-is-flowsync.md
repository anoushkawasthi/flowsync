# 1 — What FlowSync Is

> Read this first. Everything else assumes the vocabulary defined here.

---

## The one-sentence version

FlowSync is **persistent, searchable project memory for AI coding agents**, exposed through
the Model Context Protocol (MCP), with an automatic git-push fallback so the memory grows
even when nobody is using an agent.

---

## The problem, precisely

An AI coding agent is stateless between sessions. Close the chat, and everything it knew
about *why* your codebase looks the way it does is gone. The obvious places that knowledge
could live all fail in a specific way:

| Source | Stores | Fails because |
|--------|--------|---------------|
| Git log | *What* changed, line by line | A diff never says why you rejected the other approach |
| Documentation | Intent, at a point in time | Requires discipline; goes stale silently |
| Chat history | Everything, unstructured | Per-user, fragmented, not searchable across a team |
| The agent itself | Nothing, after the session | No persistence layer at all |

The gap is **decision rationale**: "we chose scrypt over bcrypt because GPU attacks",
"this retry exists because Nova Pro throttles at burst". That knowledge exists for a few
days in someone's head and then it's gone.

FlowSync's bet: **the agent that made the decision is the best-placed thing to record it,
and it will do so reliably if recording is a tool call rather than a chore.**

---

## The two ways context gets in

This is the single most important thing to understand about the product, because
everything downstream is shared.

### Path A — the agent logs it (primary)

Your agent finishes a unit of work and calls the `log_context` MCP tool with the decision,
the risk, the tasks, the reasoning. This is structured, high-quality, and captures *why*.
It requires an agent that uses tools.

Entry point: `mcp-server/src/index.ts:297` → `POST /mcp` → `infra/lambda/mcp/handler.py:221`.

### Path B — the git push captures it (fallback)

A `pre-push` git hook fires, the diff is shipped to the backend, and **Nova Pro reads the
diff and infers** the feature, decision, risk, tasks and stage. Lower fidelity than Path A
— the model is guessing intent from code — but it requires zero developer behaviour change
and works for teammates who don't use an agent at all.

Entry point: `extension/src/commands/initProject.ts:387` (hook install) →
`extension/src/hookListener.ts:32` → `POST /api/v1/events` →
`infra/lambda/ingestion/index.js:224` → `infra/lambda/ai_processing/handler.py:317`.

### They converge

Both paths write a **context record** into the same `flowsync-context` DynamoDB table with
the same shape, and both get a Titan embedding so both are semantically searchable. The
system then tries to *merge* the two when they describe the same work — see
"bidirectional merging" in [`03-flows.md`](03-flows.md) §2. That merge is why a record has
a `status` of `uncommitted` versus `complete`.

---

## The vocabulary

Learn these six terms; the code uses them everywhere.

**Project** — the unit of isolation. One repo, one `projectId`, one API token shared by the
team. Stored in `flowsync-projects` (`infra/lib/infra-stack.ts:22`).

**Event** — a raw, unprocessed thing that happened: almost always a push carrying a diff.
Immutable, archived to S3, stored in `flowsync-events`. Think of it as the write-ahead log.

**Context record** — the *processed*, AI-extracted, embedded unit of memory. This is the
actual product. One record has: `feature`, `decision`, `tasks`, `stage`, `risk`,
`confidence`, `entities`, `author`, `branch`, `commitHash`, `embedding`. Stored in
`flowsync-context`. Built at `infra/lambda/ai_processing/handler.py:397`.

**Project brain** — the informal name for the whole collection of context records for one
project. What `search_context` searches.

**MCP tool** — a function your AI agent can call. FlowSync exposes five; they're the
primary interface to the product. See [`03-flows.md`](03-flows.md) §3.

**Grounding / citation** — every AI answer must point back at the context records it used.
Sources are returned alongside every answer (`format_sources`,
`infra/lambda/chat/handler.py:498`). The product claim is "no hallucinated project facts",
and grounding is how it's enforced.

---

## Who uses it

| Actor | How they touch FlowSync | What they get |
|-------|------------------------|---------------|
| **AI coding agent** | Calls the 5 MCP tools | Memory across sessions; can answer "what did we decide about auth?" |
| **Developer with an agent** | Nothing manual — the agent logs for them | Their reasoning is captured as a side effect of working |
| **Developer without an agent** | Just pushes code | Their work is captured by the pre-push hook anyway |
| **Team lead / new joiner** | Web dashboard: timeline, search, chat | Onboarding context and a decision history without asking anyone |

The "developer without an agent" row is the reason Path B exists. Without it, FlowSync only
works for the subset of a team that has adopted agents — which makes the project brain
partial, and a partial brain is one you stop trusting.

---

## What the four surfaces are

```
┌────────────────────┐   ┌──────────────────┐   ┌───────────────────┐
│  VS Code Extension │   │   MCP Server     │   │  Web Dashboard    │
│  (TypeScript)      │   │   (TypeScript,   │   │  (Next.js, static │
│                    │   │    stdio)        │   │   on S3+CloudFront)│
│  • installs hook   │   │  • 5 agent tools │   │  • timeline       │
│  • listens on      │   │                  │   │  • RAG search     │
│    127.0.0.1       │   │                  │   │  • chat           │
│  • sidebar UI      │   │                  │   │  • analytics      │
└─────────┬──────────┘   └────────┬─────────┘   └─────────┬─────────┘
          │                       │                       │
          └───────────────────────┴───────────────────────┘
                                  │  HTTPS + Bearer token
                        ┌─────────▼──────────┐
                        │  API Gateway       │
                        │  5 Lambdas         │  ← the backend
                        │  8 DynamoDB tables │
                        │  Bedrock (Nova,    │
                        │    Titan)          │
                        └────────────────────┘
```

The three clients are independent. The extension does not need the MCP server to work; the
dashboard does not need the extension. They share only the backend and the token.

---

## What FlowSync is *not*

Being clear about this prevents scope arguments:

- **Not a code review tool.** It records decisions; it doesn't judge them.
- **Not a replacement for docs.** It captures the ephemeral *why*, not the durable *how-to*.
- **Not a vector database.** Embeddings live in DynamoDB and similarity is computed in
  Lambda memory. See [`04-decisions.md`](04-decisions.md) D-07 for why, and what it costs.
- **Not multi-tenant-hardened.** One token per project, shared by the whole team; there are
  no per-user identities or roles. Explicitly a hackathon scope choice
  (`../init-design.md` §Prototype vs Production).

---

**Next:** [`02-the-stack.md`](02-the-stack.md) — every technology, and where it lives.
