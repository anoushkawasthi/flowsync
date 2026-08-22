# 7 — Doc Deltas

> Places where the existing docs and the current code disagree. Each one was checked against
> the source. Read this before quoting the older docs in a demo, a review, or the paper.
>
> Nothing here is a criticism of those docs — the code moved between May and August and the
> prose didn't. Listing the deltas is cheaper than distrusting the docs wholesale.

**Verified against the tree as of 2026-08-22.**

---

## D-1 — The hook is `pre-push`, not `post-push`

| | |
|--|--|
| **Says** | `README.md:43` — "a post-push hook automatically sends diffs" |
| **Actually** | A `pre-push` hook is installed at `extension/src/commands/initProject.ts:387` |
| **Severity** | Cosmetic, but embarrassing in a demo |

Git has no `post-push` hook. The code comment says so explicitly
(`initProject.ts:388`): *"pre-push is a real Git hook (post-push does NOT exist in Git)."*

`DOCUMENTATION/technical-deep-dive.md:69` gets this right. The README is the outlier.

The design still behaves like a post-push hook, because the script backgrounds its `curl`
with `&` (`initProject.ts:410`) — the push is never delayed. That's presumably where the
"post-push" language came from.

**Suggested fix:** change "post-push" to "pre-push" in `README.md:43`.

---

## D-2 — Not all Lambdas are Python ⚠️

| | |
|--|--|
| **Says** | `README.md` tech-stack table — "Serverless Compute \| AWS Lambda (Python 3.12)" |
| **Actually** | Four are Python 3.12; **ingestion is Node.js 20** (`infra/lib/infra-stack.ts:147`) |
| **Severity** | Matters — someone will open the wrong file |

`technical-deep-dive.md:79` has it right ("Server-Side Ingestion (Node.js 20 Lambda)"), so
the two docs contradict each other. The mixed runtime is a deliberate decision, not an
accident — see [`04-decisions.md`](04-decisions.md) D-19.

**Suggested fix:** "AWS Lambda (Node.js 20 ingestion, Python 3.12 for AI/query/chat/MCP)".

---

## D-3 — There are six DynamoDB tables, not four

| | |
|--|--|
| **Says** | `README.md` architecture block lists `flowsync-projects`, `-events`, `-context`, `-cache` |
| **Actually** | Six: those four plus `flowsync-audit` and `flowsync-chat-sessions` (`infra-stack.ts:71`, `:79`) |
| **Severity** | Low — an omission, not an error |

`technical-deep-dive.md:718` (§17 DynamoDB Schema) lists all six correctly, including the
four GSIs. Use that table, not the README block.

---

## D-4 — "No pre-push hook is added to the git repo" is wrong ⚠️

| | |
|--|--|
| **Says** | `performance-report.md:22` — "Client-side overhead from FlowSync: **Zero** — no pre-push hook"; and `:166` — "There's no pre-push hook added to the git repo… it doesn't modify the git pipeline" |
| **Actually** | A `pre-push` hook **is** written to `.git/hooks/pre-push` at init (`initProject.ts:387-412`) |
| **Severity** | High — it's a factual claim in a report, and it's checkable in ten seconds |

The *conclusion* is defensible: the hook backgrounds its `curl` with `&`, so the measured
push latency really is unchanged. But the stated reason is false, and anyone who runs
`cat .git/hooks/pre-push` on an initialised repo will see it. If a judge or reviewer checks
one claim in that report, it will be this one.

**Suggested fix:** keep the zero-overhead claim, change the justification — "the hook
backgrounds its request (`curl … &`) and never blocks the push", rather than denying the
hook exists.

---

## D-5 — "5 MCP tools" is true, but only 4 go through the MCP Lambda

| | |
|--|--|
| **Says** | README and deep-dive: five MCP tools |
| **Actually** | Five tools on the MCP server, but `get_events` calls `GET /api/v1/projects/{id}/events` on the **query** Lambda (`mcp-server/src/index.ts:400`). The MCP Lambda router handles four and returns `invalid_tool` for anything else (`infra/lambda/mcp/handler.py:397-405`) |
| **Severity** | Low for the pitch, high if you're adding a tool |

Not an error — the agent really does see five tools. But if you add a tool by copying
`get_events`, you'll wire it to the wrong Lambda.

---

## D-6 — The docs say "FlowSync"; users now see "BuildBerry" ⚠️

| | |
|--|--|
| **Says** | Every doc in `DOCUMENTATION/` — including this study guide — calls the product **FlowSync** |
| **Actually** | User-facing text was renamed to **BuildBerry** in commit `6099141` (merged as PR #1, Aug 2026), and the released VSIX is `buildberry-1.2.0.vsix` (PR #2) |
| **Severity** | High for anything external — the README pitches a product under a name users no longer see |

The rename was scoped deliberately: **visible strings only** — command titles, notifications,
status bar, settings labels, webview UI, dashboard copy, wordmark. **Internal identifiers
were left alone** — command IDs, config keys, `.flowsync.json`, storage keys, API routes,
DynamoDB table names, the repo name. The commit message is explicit that renaming those
would be a functional change, not a visual one.

So both names are current, with a clean split:

| | Name |
|--|--|
| What users see | **BuildBerry** |
| What the code, infra and config are called | **`flowsync`** |

This study guide uses "FlowSync" throughout because it documents the codebase, where every
identifier still is `flowsync`. But the **root `README.md` is a product pitch**, and it
still says FlowSync everywhere — including the Quick Start, which tells people to install
`flowsync-1.0.1.vsix` (`README.md:206`, `:209`). PR #2 renamed the package to `buildberry`
and now ships **`buildberry-1.2.0.vsix`**, so that instruction is wrong on both the name and
the version, and points at a download that doesn't exist.

> Heads-up: the README differs between checkouts. On `origin/main` it reads
> `flowsync-1.0.1.vsix` / `flowsync.aahil-khan.tech`; the working copy in the main checkout
> reads `flowsync-1.2.0.vsix` / `flowsync.aahil-khan.xyz`. Someone has unpushed README edits
> — worth reconciling before fixing the name, or the fix will be clobbered.

**Suggested fix:** decide the naming policy explicitly, then apply it to `README.md` first
(especially the Quick Start filename).

---

## What the older docs still get right

Worth stating, so nobody over-corrects and starts distrusting all of it:

- `technical-deep-dive.md` is **accurate** on the DynamoDB schema (§17), the pre-push hook
  (§2), the RAG pipeline (§4), caching (§5), bidirectional merging (§6), branch propagation
  (§7) and the security model (§13). It's a good reference. Its §17 TTL claims check out in
  both places they'd have to: `timeToLiveAttribute` is set on the chat-sessions and cache
  tables (`infra-stack.ts:83`, `:92`), and the application writes matching expiry values —
  `SESSION_TTL_MINUTES = 30` (`chat/handler.py:37`) and `ttl_seconds=3600`
  (`helpers.py:112`).
- `init-design.md` and `init-requirements.md` are **historical intent documents**. They
  describe things that were planned and not built (WebSocket API, approval workflows,
  property-based test suites). Read them as "what we set out to do", never as "what exists".
- `performance-report.md` numbers other than D-4 weren't re-benchmarked here — they're
  plausible and internally consistent, but this study guide didn't verify them. If they
  matter for the paper, re-run the measurements.

---

## Keeping this list empty

The cheapest fix is D-1 through D-3 — three small edits to `README.md`. D-4 is the one that
actually matters, because it's a checkable false claim in a document meant to establish
credibility.

None of these were changed as part of writing this guide: editing the pitch README and the
performance report is a call for the team, not a side effect of writing study docs.

---

**Back to:** [`README.md`](README.md) — the study path index.
