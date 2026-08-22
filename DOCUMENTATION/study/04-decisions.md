# 4 — The Decisions

> A decision register. Each entry: what was chosen, what it was chosen *over*, why, what it
> costs, and where it's enforced in code.
>
> **Read this one as a group and argue with it.** Some of these are load-bearing
> architecture; others are hackathon expedience that will need revisiting. The docs that
> only tell you the upside aren't teaching you anything — the "cost" lines are the point.

---

## Product decisions

### D-01 — The AI agent is the primary user, not the developer

**Over:** a conventional dashboard-first tool where humans write entries.

**Why:** any system that depends on humans remembering to document decisions decays —
that's the exact failure mode of the documentation it's replacing. An agent, however, calls
`log_context` because it's a tool in its context window and it just finished a task. The
recording becomes a side effect of working rather than an act of discipline.

**Cost:** the highest-quality path only exists for teams already using tool-capable agents.
That's a bet on where the industry is going, and D-02 is the hedge.

**Where:** MCP is the first-class interface — `mcp-server/src/index.ts`, five tools;
the dashboard is a read surface over what agents wrote.

---

### D-02 — Dual input: agent logging *and* automatic git capture

**Over:** agent-only (cleaner) or push-only (simpler).

**Why:** a project brain with holes in it is a brain you stop trusting. If two of four
developers use an agent, agent-only capture means half the team's reasoning is missing, and
the first time someone searches and finds nothing they stop searching. Push capture is
lower fidelity but has **zero adoption cost** — you get it by pushing code.

**Cost:** two writers to one table, which forces the whole merge machinery
([`03-flows.md`](03-flows.md) §merge), a `status` field, a 30-minute correlation window, and
the Direction-B embedding gap. A meaningful chunk of the system's complexity traces back to
this one decision. It's still the right call — but know what it bought and what it cost.

**Where:** `mcp/handler.py:221` (Path A) and `ai_processing/handler.py:385` (Path B),
reconciled at `mcp/handler.py:258` and `ai_processing/handler.py:203`.

---

### D-03 — Every AI answer must carry citations

**Over:** returning a fluent answer and trusting it.

**Why:** the product's promise is *memory*, and memory that confabulates is worse than no
memory — a wrong confident answer about a past decision will actively mislead someone. So
every answer ships with the context records it was derived from, and the user can click
through to the originating commit.

**Cost:** answers are constrained to retrieved context; the system will say "no context
found" rather than reason from general knowledge. That's a feature here.

**Where:** `sources[]` on every response — `helpers.py:127` (`search_context_rag`),
`format_sources` at `chat/handler.py:498`. `answerGrounded` is an explicit flag.

---

## Architecture decisions

### D-04 — Async ingestion: store first, AI later

**Over:** doing extraction synchronously inside the request.

**Why:** Bedrock extraction takes ~2-4 seconds. Doing it inline would mean a git push that
hangs for several seconds, and a failed push if Bedrock throttles. Nobody would keep the
tool installed. So ingestion writes the raw event, fires `InvocationType: 'Event'`, and
returns `200 { status: 'processing' }` — the async invoke returns as soon as Lambda accepts
the payload.

**Cost:** eventual consistency. A context record does not exist the instant a push
completes. Worse, if the async AI Lambda fails, **the event is stored but never processed,
and nothing retries it or alerts** — there's no DLQ or reconciliation sweep. The raw event
survives in `flowsync-events` and S3, so the data isn't lost, but it also won't show up in
the brain on its own. First thing to add for production.

**Where:** `ingestion/index.js:268-278`; the SLA comment at `:269`.

---

### D-05 — Only one write is allowed to fail the request

**Over:** treating all writes as equally important.

**Why:** ingestion does four writes — events table, S3 archive, AI invoke, audit. Only the
events write is essential; the others are archival, asynchronous, or observability. If S3
has a bad minute, the developer should not see an error. So the critical write is awaited
bare, and every other operation is individually wrapped in `try/catch` with a
`[non-fatal]` log.

**Cost:** silent partial failure. A run of failed S3 archives or AI invokes shows up only
in CloudWatch logs. You need alarms on those `[non-fatal]` lines or you'll never know.

**Where:** `ingestion/index.js:255` (critical) vs `:259`, `:273`, `:306` (non-fatal).

---

### D-06 — DynamoDB over a relational database

**Over:** RDS/Postgres (which would also have given `pgvector` for free).

**Why:** the workload is bursty and schema-light — silent overnight, spiky during working
hours. `PAY_PER_REQUEST` means ₹0 when nobody is coding, versus an RDS instance billing
around the clock. Reads are single-digit ms, and context records are self-contained
documents with no natural joins.

**Cost:** no ad-hoc queries. Every read path had to be designed as an index up front (the
four GSIs), and adding a new access pattern later means adding a GSI and backfilling. The
composite sort keys (`branch#timestamp`) are the workaround for the lack of multi-column
querying. Also, no `pgvector` — which leads directly to D-07.

**Where:** `infra/lib/infra-stack.ts:22-95`.

---

### D-07 — Vector search is an in-memory scan, not a vector database ⚠️

**Over:** Pinecone / OpenSearch / pgvector.

**Why:** a dedicated vector store is another service to provision, secure, pay for, and
learn — for a dataset of a few hundred records. Storing 1536 floats beside the record in
DynamoDB and computing cosine similarity in a Python loop is *zero* extra infrastructure,
and at hackathon scale it's genuinely fast.

**Cost — and this is the biggest scaling limit in the system:** every uncached query reads
**every context record in the project** into Lambda memory and scores it one by one
(`helpers.py:175-209`). Cost and latency grow linearly with project history. At a few
hundred records: fine. At 100k: you're reading the whole table per query, at 512 MB of
Lambda memory, and it will fall over. The 1-hour cache (D-08) hides this in demos.

The honest framing: **this is correct for the hackathon and wrong for production**, and the
team should be able to say so out loud. The migration path is real, though — embeddings are
already computed and stored, so moving to OpenSearch or pgvector means changing steps 3-5
of `search_context_rag` and nothing else.

**Where:** `helpers.py:127-215`; `cosine_similarity` at `helpers.py:66`.

---

### D-08 — Cache RAG responses for an hour

**Over:** no cache, or a shorter TTL.

**Why:** teams ask the same questions ("what's the auth decision?") repeatedly, and the
uncached path costs an embedding call plus a full scan plus a Nova Pro generation. The
cache key is `sha256(projectId:query:branch)`, so it only hits on an exact repeat.

**Cost:** a one-hour staleness window. Push a change and ask the same question verbatim and
you'll get the pre-push answer. Acceptable because project decisions don't change minute to
minute — but it *does* mean a demo can show a stale answer if you re-ask a question you
asked before the demo push. Also: exact-match keying means "what about auth?" and "what
did we decide about auth?" are two separate entries.

**Where:** `helpers.py:99` (`check_cache`), `:112` (`write_cache`, `ttl_seconds=3600`),
key at `:144`.

---

### D-09 — Model tiering: Nova Pro for extraction, Nova Lite for chat

**Over:** one model everywhere.

**Why:** the two jobs have opposite priorities. Extraction happens once per push, nobody is
watching, and quality compounds forever — pay for Pro. Chat is interactive, a human is
staring at a spinner, and the answer is disposable — pay for latency with Lite, which is
noted in the code as ~75% cheaper (`chat/handler.py:33`).

**Cost:** two models to prompt-engineer and evaluate; chat answers are measurably weaker
than a Pro-backed chat would be.

**Where:** `ai_processing/handler.py:12-14`; `chat/handler.py:33`.

---

### D-10 — Nova Lite is also the throttle fallback

**Over:** retrying Pro until it succeeds, or failing.

**Why:** on-demand Bedrock throttles under burst — exactly what a commit storm produces.
A degraded extraction from Lite beats no extraction, and the event would otherwise be
silently lost (see D-04: nothing retries it).

**Cost:** extraction quality varies invisibly between records. `modelVersion` is stored on
each record, so you *can* tell after the fact — but nothing surfaces it.

**Where:** `ai_processing/handler.py:76`; `helpers.py:283`.

---

### D-11 — Confidence is computed, not asked for

**Over:** having the model self-report confidence.

**Why:** it was tried and it failed. The docstring at `compute_confidence`
(`ai_processing/handler.py:132`) records the finding: *"Replaces the flat 0.85 default the
model was producing."* Self-reported confidence was a constant, therefore useless. The
replacement is a deterministic completeness score — did we get a decision, a risk, tasks,
entities?

**Cost:** it measures *completeness*, not *correctness*. A confidently-wrong extraction that
fills every field scores 1.0. Don't read it as accuracy.

**Why it's the best entry in this register:** it's a decision with a recorded reason,
written down at the moment it was made, in the place someone would look. It is FlowSync's
own thesis applied to FlowSync.

---

### D-12 — Merge propagation copies records instead of re-pointing them

**Over:** a reference/pointer from the target branch to the source records.

**Why:** reads stay dead simple — "all context on `main`" is one `begins_with` Query, with
no fan-out or joins. Given D-06, avoiding joins is the whole game.

**Cost:** duplicated rows and duplicated 1536-float embeddings on every merge. Storage
grows with merge frequency, and the same decision now appears more than once in a full-scan
search (though the top-5 cut usually hides it). Tagged with `mergedFrom` so duplicates are
at least identifiable.

**Where:** `ai_processing/handler.py:278-315`.

---

### D-13 — Branch auto-scoping in the MCP tools

**Over:** always searching the whole project.

**Why:** an agent working on `feat/auth` asking "what's the plan here?" means *on this
branch*. Defaulting to the current branch makes answers relevant without the agent
reasoning about scope; `branch: "all"` opts out.

**Cost:** an agent can miss a relevant decision made on another branch and not know it
missed anything. The 0.85 cross-branch penalty in unscoped search is the softer version of
the same trade-off (`helpers.py:193`).

**Where:** `mcp-server/src/index.ts`; documented to agents in the Copilot instructions
written at `extension/src/commands/initProject.ts:27`.

---

### D-14 — Chat routes on a regex, not a classifier model

**Over:** an LLM call to decide whether a message needs retrieval.

**Why:** a classifier call adds a full round-trip of latency to *every* chat message, in
the one place in the product where latency is most visible. Regex is instant and free, and
the failure mode is mild — you either retrieve when you didn't need to, or you don't when
you should have.

**Cost:** it's brittle in the obvious way. "Tell me about the auth work" is caught by
`tell me about`; "auth — remind me?" matches nothing and is treated as conversational.
Ambiguous messages default to conversational (`chat/handler.py:110`).

**Where:** `needs_factual_answer`, `chat/handler.py:70-110`.

---

## Security decisions

### D-15 — Scrypt over bcrypt for token hashing

**Over:** bcrypt, the usual default.

**Why:** scrypt is **memory-hard**, not just CPU-hard. Bcrypt is cheap to parallelise on a
GPU; scrypt forces the attacker to buy RAM per parallel guess, which raises the cost of
mass offline cracking by orders of magnitude. There's no user-visible difference — tokens
are verified once per request in a Lambda.

Comparison is via `crypto.timingSafeEqual` (`ingestion/index.js:64`), closing the timing
side channel that a naive `===` would open.

**Cost:** scrypt costs more Lambda memory and CPU per verification than bcrypt. Immaterial
at this scale.

**Where:** `ingestion/index.js:53-69`; Python side at `flowsync_common/auth.py:41`.

---

### D-16 — The git hook talks to localhost, not to the cloud

**Over:** the hook `curl`ing the API directly with the token.

**Why:** a hook that calls the API needs the token, which means the token sits in a shell
script inside `.git/hooks/`. Instead the hook posts to `127.0.0.1:<port>` and the extension
— which already holds the token securely — does the authenticated call. **The token never
touches the hook script.** The listener binds loopback-only
(`hookListener.ts:78`), so nothing off-machine can reach it.

**Cost:** capture only works while VS Code is open with the project loaded. Push from a
terminal with the editor closed and the event is silently dropped. That's a real gap, and
it's the trade for not writing a credential to disk in a script.

Port collisions are handled by scanning upward from 38475 (`hookListener.ts:19`), but the
port is baked into the hook at install time — so if the port moves, the hook needs
reinstalling.

**Where:** `initProject.ts:387`, `hookListener.ts:32`.

---

### D-17 — One shared token per project

**Over:** per-user identity and roles.

**Why:** deliberate hackathon scope. Authorship is tracked (`author` on every record) but
not *authenticated* — it comes from git config. The whole team shares one bearer token.

**Cost:** no revocation for one person, no per-user audit, no roles. Anyone with the token
can read and write the entire project brain. Fine for a four-person hackathon team, not
shippable to a company. Called out in `../init-design.md` §Prototype vs Production.

**Where:** `flowsync-projects` holds one hash per project (`infra-stack.ts:22`).

---

## Infrastructure decisions

### D-18 — Lambda over EC2/ECS

**Why:** no sustained load. Bursts during working hours, silence otherwise. Lambda scales to
zero and to hundreds of concurrent executions during a commit storm without capacity
planning.

**Cost:** cold starts on the first push of the day, and a hard 15-minute ceiling. This is
also *why* ingestion is Node — see D-19.

---

### D-19 — Ingestion is Node.js 20; everything else is Python 3.12

**Over:** one runtime everywhere (which would be simpler).

**Why:** ingestion is the only Lambda on the latency-critical path, and it does no AI work —
just crypto, validation and three SDK calls. Node cold-starts faster and the file has zero
dependencies. The AI Lambdas want Python for `boto3` and the Bedrock ecosystem, and nothing
is waiting on them.

**Cost:** two runtimes, two dependency stories, two sets of idioms — and the auth logic is
implemented **twice** (`ingestion/index.js:53` and `flowsync_common/auth.py:41`). Those two
implementations must agree on the scrypt parameters forever; if one drifts, tokens verify in
one Lambda and fail in another. That's a genuine hazard worth a test.

**Where:** `infra-stack.ts:147` vs `:164`, `:181`, `:199`, `:216`.

---

### D-20 — Shared Lambda layer for the Python functions

**Why:** `search_context_rag` is used by both the query Lambda and the MCP Lambda. Two
copies would drift, and RAG behaviour differing between the dashboard and the agent would be
a nightmare to debug.

**Cost:** a layer must be rebuilt and redeployed for shared-code changes; the two Lambdas
can no longer be deployed truly independently.

**Where:** `infra-stack.ts:134`; `infra/lambda/shared/python/flowsync_common/`.

---

### D-21 — Static Next.js export on S3 + CloudFront

**Over:** SSR on Vercel/Amplify.

**Why:** the dashboard has no server-side work to do — it's a client talking to API Gateway
with a bearer token. `output: 'export'` yields static files at near-zero hosting cost and no
server to operate.

**Cost:** no server-side secrets, no SSR, no middleware. The project token lives in the
browser and is sent from the client. That's consistent with D-17 (the token is already a
shared team secret), but it means the dashboard can never hold a credential the user
shouldn't have.

**Where:** `frontend/next.config.js`; `infra-stack.ts:306` (bucket), `:322` (distribution).

---

### D-22 — `RemovalPolicy.DESTROY` on every table ⚠️

**Why:** trivial teardown after the hackathon; no orphaned billing.

**Cost:** `cdk destroy` deletes **the entire project brain**, irreversibly. No
point-in-time recovery, no backups configured. The CDK comment is candid: *"easy cleanup
after hackathon"* (`infra-stack.ts:25`).

**Change this before anyone stores anything they care about.** It's a one-line change per
table plus enabling PITR, and it belongs at the top of the production checklist.

---

## Summary: what to change first for production

Ordered by how much it would hurt to skip:

1. **`RemovalPolicy.RETAIN` + point-in-time recovery** (D-22) — one bad command loses everything.
2. **A DLQ and retry for the async AI invoke** (D-04) — today, a failed extraction is silent.
3. **Fix the Direction-B embedding gap** ([`03-flows.md`](03-flows.md) §merge) — the best
   reasoning in the system is unsearchable.
4. **Per-user auth and token revocation** (D-17) — blocks any real team adoption.
5. **A real vector index** (D-07) — not urgent at current scale, but it's the wall you hit.
6. **A shared auth test across both runtimes** (D-19) — cheap insurance against a nasty bug.

---

**Next:** [`05-code-map.md`](05-code-map.md) — where to open the file.
