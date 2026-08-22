# 6 — Self-Check

> Closed-book. Answer out loud or in writing before expanding. If you can't answer one, the
> doc to re-read is named in the answer.
>
> Questions marked **⚑** are the ones that separate "I read the docs" from "I understand
> the system" — those are the ones to ask in a review or an interview.

---

## Round 1 — Product

**1.** Why isn't a git log enough to solve the problem FlowSync solves?

<details><summary>Answer</summary>

A diff records *what* changed, never *why* — not the alternative that was rejected, not the
constraint that forced the choice. That rationale is the thing that evaporates within days
and is exactly what a new joiner or a stateless agent needs. → `01`

</details>

**2.** FlowSync has two ways context enters the system. Name them, and say which produces
better data and why.

<details><summary>Answer</summary>

(a) The agent calls `log_context` — the agent *knows* its reasoning, so this is
first-hand and high fidelity. (b) A `pre-push` git hook ships the diff and Nova Pro infers
intent — second-hand, the model is guessing from code, but it costs the developer nothing.
→ `01`

</details>

**3. ⚑** If Path A (agent logging) produces better data, why keep Path B at all?

<details><summary>Answer</summary>

Coverage. If only agent-users are captured, the brain has holes wherever a teammate doesn't
use an agent — and a brain with holes is one people stop trusting after their first empty
search. Path B has zero adoption cost. Note the price: nearly all the merge complexity in
the system exists because there are two writers. → `04` D-02

</details>

---

## Round 2 — Capture

**4.** Which git hook does FlowSync install, and why does the hook talk to `localhost`
instead of the API?

<details><summary>Answer</summary>

`pre-push` (there is no `post-push` hook in git). It posts to `127.0.0.1:<port>` so the
**API token never has to live inside a shell script** in `.git/hooks/`. The extension holds
the token and makes the authenticated call. → `03` §1, `04` D-16

</details>

**5. ⚑** What's the failure mode of that localhost design?

<details><summary>Answer</summary>

Push from a terminal with VS Code closed (or the project not open) and nothing is listening
— the event is silently dropped. That's the price of not writing a credential to disk.
→ `04` D-16

</details>

**6.** Ingestion does four writes. Which one is allowed to fail the request, and why the
others aren't?

<details><summary>Answer</summary>

Only the `flowsync-events` put (`ingestion/index.js:255`). S3 archive, the async AI invoke,
and the audit write are each individually try/caught and logged `[non-fatal]` — a bad
minute in S3 must not surface as an error to a developer who just pushed. → `03` §1, `04` D-05

</details>

**7.** Why does ingestion return `status: 'processing'` rather than the extracted context?

<details><summary>Answer</summary>

Bedrock extraction takes seconds. Doing it inline would stall the push and fail it when
Bedrock throttles. Ingestion fires an async invoke and returns immediately; the response
honestly says the work isn't finished. → `04` D-04

</details>

**8. ⚑** The async AI invoke fails. What happens to that push's context?

<details><summary>Answer</summary>

Nothing — and nobody is told. There is no DLQ, no retry, no reconciliation sweep. The raw
event survives in `flowsync-events` and S3 so it isn't *lost*, but it never becomes a
context record and never appears in the brain. The only trace is a `[non-fatal]` line in
CloudWatch. This is the top item on the production checklist. → `04` D-04

</details>

---

## Round 3 — Extraction and storage

**9.** What text actually gets embedded — the diff, or something else? Why does it matter?

<details><summary>Answer</summary>

The **extraction JSON** (feature/decision/risk/tasks), not the diff
(`ai_processing/handler.py:398`). So semantic search matches on decisions and intent, which
is right for "what did we decide about auth?" and wrong for "which commit touched
`parseToken`". → `03` §2

</details>

**10. ⚑** Confidence is computed by a formula rather than asked of the model. What went
wrong with asking, and what does the score actually measure?

<details><summary>Answer</summary>

The model returned a flat 0.85 for everything — self-reported confidence was a constant,
therefore useless (the reason is recorded in the docstring at
`ai_processing/handler.py:132`). The replacement measures **completeness**: 0.55 base, plus
points for decision, risk, tasks, entities. It does *not* measure correctness — a
confidently wrong extraction that fills every field scores 1.0. → `04` D-11

</details>

**11.** `flowsync-context` is partitioned by `eventId`. So how does "show me everything on
branch `feat/auth`" avoid a table scan?

<details><summary>Answer</summary>

A denormalised composite attribute, `branchExtractedAt = "{branch}#{timestamp}"`, written at
insert time and used as the sort key of the `BranchContextIndex` GSI. The read becomes
`begins_with(branchExtractedAt, 'feat/auth#')` — one Query. → `02` §Storage

</details>

**12.** What is an "orphaned" context record?

<details><summary>Answer</summary>

One created by `log_context` when no matching push record exists yet: `commitHash: None`,
`status: 'uncommitted'`. A later push on the same branch by the same author within 30
minutes binds the commit hash and flips it to `complete`. → `03` §merge

</details>

**13. ⚑** Trace Direction B end to end and say what's wrong with it.

<details><summary>Answer</summary>

Agent logs first → orphaned record with `embedding: None` (`mcp/handler.py:357`). Push
arrives → `find_orphaned_record` matches → `update_orphaned_record` sets `commitHash`,
`status`, `committedAt` and the handler **returns early** (`ai_processing/handler.py:380`),
skipping extraction *and* the Titan call. Nothing ever fills in the embedding. And
`search_context_rag` skips records without one (`helpers.py:197`).

**So agent-logged-first records are permanently invisible to semantic search** — the
highest-quality reasoning in the system. They still show in the timeline, which is probably
why it went unnoticed. → `03` §merge

</details>

---

## Round 4 — Retrieval

**14.** Walk through what happens on a dashboard search, from HTTP request to answer.

<details><summary>Answer</summary>

`POST /api/v1/query` → cache check on `sha256(projectId:query:branch)` → embed the query
with Titan → Query the branch or project GSI, fully paginated → cosine similarity for every
record in Lambda memory → top 5 → Nova Pro generates over those 5 → write cache (1 h) →
return `{answer, answerGrounded, sources[]}`. → `03` §4

</details>

**15. ⚑** Where is the vector database?

<details><summary>Answer</summary>

There isn't one. Embeddings are stored as 1536 `Decimal`s on the DynamoDB record and
similarity is a Python loop in the Lambda (`helpers.py:197-209`). Every uncached query reads
**every record in the project**. Free and fast at hackathon scale; linear in project history
and eventually fatal. Biggest scaling limit in the system — and the migration path is
narrow, since the embeddings already exist. → `04` D-07

</details>

**16.** What is `CROSS_BRANCH_PENALTY` and why does it exist?

<details><summary>Answer</summary>

`0.85` (`helpers.py:193`). With no branch specified, records not on `main` get scored down
15%, so a dozen records from an experimental branch don't drown out the two on `main` that
describe shipped behaviour. A hand-tuned heuristic — worth remembering when a result looks
strange. → `03` §4

</details>

**17.** You push a fix, then ask the dashboard the same question you asked ten minutes
before, and the answer ignores your change. Bug?

<details><summary>Answer</summary>

No — the 1-hour RAG cache, keyed on the exact query string. Rephrase and you'll get a fresh
answer. Worth knowing before a demo. → `04` D-08

</details>

**18. ⚑** Why does chat use Nova Lite while extraction uses Nova Pro?

<details><summary>Answer</summary>

Opposite priorities. Extraction runs once per push, nobody is waiting, and the result is
stored forever — pay for quality. Chat is interactive with a human watching a spinner, and
the answer is disposable — pay for latency, and Lite is ~75% cheaper. Lite doubles as the
throttle fallback for Pro. → `04` D-09, D-10

</details>

---

## Round 5 — Agent surface

**19.** Name the five MCP tools. Which one doesn't hit the MCP Lambda?

<details><summary>Answer</summary>

`get_project_context`, `get_recent_changes`, `search_context`, `log_context`, `get_events`.
`get_events` calls `GET /api/v1/projects/{id}/events` on the **query** Lambda
(`mcp-server/src/index.ts:400`) — which is why the MCP Lambda's router only knows four
(`mcp/handler.py:397`). → `03` §3

</details>

**20.** You're adding a sixth tool. Which files must change?

<details><summary>Answer</summary>

`mcp-server/src/index.ts` (zod schema + handler) **and** the router in
`infra/lambda/mcp/handler.py:397` plus the tool function itself. Miss the second and the
backend returns `invalid_tool`. Optionally `extension/src/mcpTools.ts` so it shows in the
sidebar. → `05` §Where the same thing is implemented twice

</details>

---

## Round 6 — Security and operations

**21. ⚑** Why scrypt instead of bcrypt, and what else protects the token comparison?

<details><summary>Answer</summary>

Scrypt is memory-hard, not just CPU-hard — GPU-parallel cracking has to buy RAM per guess,
so mass offline attacks get far more expensive. No user-visible cost. Comparison uses
`crypto.timingSafeEqual` (`ingestion/index.js:64`) to close the timing side channel.
→ `04` D-15

</details>

**22.** What can a person holding a project token do, and what can't be done about it?

<details><summary>Answer</summary>

Read and write the entire project brain. There are no per-user identities, no roles, and no
per-person revocation — one shared token per project. `author` is recorded but not
authenticated. Deliberate hackathon scope; a blocker for real adoption. → `04` D-17

</details>

**23. ⚑** What single AWS command would destroy the project brain, and why is that possible?

<details><summary>Answer</summary>

`cdk destroy`. Every table is `RemovalPolicy.DESTROY` (`infra-stack.ts:25`, comment: *"easy
cleanup after hackathon"*) with no PITR and no backups. First thing to change before anyone
stores anything real. → `04` D-22

</details>

**24.** Why is one Lambda in Node while the other four are Python — and what hazard does
that create?

<details><summary>Answer</summary>

Ingestion is the only latency-critical function and does no AI work, so it takes Node's
faster cold start with zero dependencies; the AI functions want Python/boto3 and nothing
waits on them. Hazard: **token auth is implemented twice**
(`ingestion/index.js:53` and `flowsync_common/auth.py:41`) and the two must agree on scrypt
parameters forever. → `04` D-19

</details>

---

## Round 7 — Synthesis (discuss as a group)

**25. ⚑** FlowSync's own repo contains a decision recorded at the moment it was made, with
the reason, in the place someone would look for it. Find it, and say why it's the best
argument for the product.

<details><summary>Answer</summary>

The `compute_confidence` docstring (`ai_processing/handler.py:132`): *"Replaces the flat
0.85 default the model was producing."* Six months later nobody would remember that
self-reported confidence was tried and failed — someone would "simplify" it back and
reintroduce the bug. That one sentence prevents it. FlowSync is that sentence, automated.

</details>

**26. ⚑** You have one sprint to make FlowSync production-ready. What are your top three,
and what do you consciously leave?

<details><summary>Answer</summary>

Defensible top three: (1) `RemovalPolicy.RETAIN` + PITR — one command currently deletes
everything; (2) DLQ and retry on the async AI invoke — silent data loss today;
(3) per-user auth and revocation — nothing else unblocks team adoption.

Consciously left: the vector index (D-07). It's the scariest-looking problem but it doesn't
bite until you have tens of thousands of records, the embeddings are already stored, and the
change is contained to `search_context_rag`. Knowing *not* to do that first is the point of
the question. → `04` §Summary

</details>

**27.** Explain FlowSync end to end in 90 seconds, to someone technical who has never heard
of it.

<details><summary>Answer</summary>

No key — do it out loud, timed, to another person. If you can't, go back to `01` and `03`.
A good version names: the problem (rationale evaporates), the two capture paths, the
extract-and-embed step, retrieval with citations, and one honest limitation.

</details>

---

## Scoring

- **Struggled with round 1-2** — re-read `01` and `03` §1.
- **Struggled with round 3-4** — re-read `03` §2, §4. This is the heart of the system.
- **Fine on facts, stuck on the ⚑ questions** — you know *what* it does but not *why*.
  Read `04` properly; that's the gap that shows in review.
- **Answered the ⚑ questions including #13, #15, #23, #26** — you can own a feature here.
