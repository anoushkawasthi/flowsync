# FlowSync — Team Study Guide

This folder is the **learning path** for FlowSync. The existing docs in `DOCUMENTATION/`
are excellent *reference* material — they answer "what is the spec?" — but they are not
ordered for someone learning the system from zero. These docs are.

Everything here was written by reading the current source tree, so every claim has a
`file:line` pointer you can open and verify. If a pointer is wrong, the code moved —
fix the pointer.

---

## What already existed (read these too)

| Doc | What it is | When to reach for it |
|-----|-----------|---------------------|
| [`../../README.md`](../../README.md) | Product pitch, architecture summary, quick start | First 10 minutes, and for demos |
| [`../technical-deep-dive.md`](../technical-deep-dive.md) | 20-section reference: MCP, RAG, caching, security, diagrams, schema | Reference while coding |
| [`../performance-report.md`](../performance-report.md) | Benchmarks: latency, extraction accuracy, cost | Perf/cost questions |
| [`../init-requirements.md`](../init-requirements.md) | Original 12 requirements + NFRs | "Was this in scope?" |
| [`../init-design.md`](../init-design.md) | Original design doc: data models, correctness properties, test strategy | Design intent, invariants |

**Those five are the source of truth for intent. This study guide is the source of truth
for what the code actually does today.** Where they disagree, see
[`07-doc-deltas.md`](07-doc-deltas.md).

---

## The path

| # | Doc | Time | You'll be able to… |
|---|-----|------|--------------------|
| 1 | [What FlowSync is](01-what-is-flowsync.md) | 15 min | Explain the problem, the product, and the vocabulary |
| 2 | [The stack](02-the-stack.md) | 20 min | Name every technology and say why it's there |
| 3 | [The flows](03-flows.md) | 45 min | Trace a push and a question end to end |
| 4 | [The decisions](04-decisions.md) | 30 min | Defend every architectural choice, and its cost |
| 5 | [The code map](05-code-map.md) | 30 min | Open the right file for any bug, first try |
| 6 | [Self-check](06-self-check.md) | 20 min | Prove to yourself you actually understood it |
| 7 | [Doc deltas](07-doc-deltas.md) | 5 min | Avoid the stale claims in the older docs |

Total: about **2.5 hours** for the full path.

---

## Shorter paths by role

**Just demoing it (20 min)** — `01`, then the Quick Start in the root README, then the
"push → answer" walkthrough in `03`.

**Working on the extension (1 hr)** — `01`, `03` §1 (Capture), `05` §Extension.
The extension is TypeScript and self-contained; you can be productive without knowing AWS.

**Working on the backend / Lambdas (2 hr)** — `01`, `02`, all of `03`, `04`, `05` §Backend.
You need the DynamoDB key design in `02` before `03` will make sense.

**Working on the dashboard (45 min)** — `01`, `02` §Frontend, `03` §4 (Query) and §5 (Chat),
`05` §Frontend. The frontend only talks to a handful of endpoints; learn those and you're set.

**Reviewing the architecture / writing the paper (1.5 hr)** — `01`, `04`, then
`../performance-report.md`. `04` is the decision register with tradeoffs stated honestly,
including the ones that don't scale.

---

## How to study this as a team

1. **Everyone reads `01` and `02` alone.** They're short and they set shared vocabulary.
   Without them a group discussion turns into definition arguments.
2. **Split `03` four ways.** One person per flow (Capture, Extract, Agent, Query/Chat),
   each traces their flow in the real code and presents it for ~10 minutes. Teaching a flow
   is the fastest way to actually learn it.
3. **Read `04` together.** Every decision has a "cost" line. Argue with them — several are
   genuinely debatable at production scale, and knowing which ones are load-bearing versus
   which were hackathon expedience is the most valuable thing in this repo.
4. **Do `06` closed-book.** If you can't answer a question, the doc it maps to is listed.

---

## Ground rules for these docs

- **Every factual claim points at code.** No "it probably does X."
- **Hackathon shortcuts are labelled, not hidden.** Knowing that vector search is an
  in-memory scan is more useful than believing it's a vector database.
- **When you change the code, change the pointer.** These docs are only worth having if
  they're true.
