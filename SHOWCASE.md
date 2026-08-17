# FlowSync — Showcase Run Sheet

Team Vanta — Aahil Khan, Anoushka Awasthi, Maulik Dang, Sanyam Wadhwa
AI for Bharat Hackathon · Extension v1.2.0

> A styled version of this doc is at `showcase.html` — open it in a browser.

---

## Before you present

**🔴 The public dashboard URL does not work — demo from localhost.**
`flowsync.aahil-khan.tech` has a public DNS A record pointing at `127.0.0.1`, so it
resolves to the visitor's own machine and nobody can reach it. Verified against
Cloudflare DNS, not just this laptop.

**🟢 Backend is live, demo project has real data.**
API returns 200. Project `task-manager-api` — 27 events with decisions, risks and
tasks from actual pushes. Everything you show is real captured context.

**🟡 The VS Code sidebar has never been run in a real editor.**
It typechecks, builds and packages, but nobody has pressed F5 yet. Give yourself ten
minutes before you present. If it misbehaves, fall back to the web dashboard.

### Have these running

```
cd frontend && npx next dev        # dashboard on :3000
code extension/  →  press F5       # Extension Development Host
```

In the dev host, set `flowsync.dashboardUrl` to `http://localhost:3000` so **Open Web
Dashboard** lands somewhere real. Open the dashboard once and hit **Try the demo
project** so you're already logged in.

---

## The pitch, in sixty seconds

AI coding agents are powerful but **stateless** — they forget everything between
sessions. Git tells you *what* changed; it never tells you *why*. Docs go stale. Chat
history is fragmented and unsearchable.

FlowSync gives your agent a project brain over MCP. It calls `log_context` to record
the decision and the risk it just introduced, and `search_context` to ask "what did we
decide about auth?" — getting a grounded answer with citations back to the commit it
came from. For anyone not using an agent, every `git push` is auto-captured through
Bedrock Nova Pro, so the brain grows either way.

---

## Demo, in order

**01 — Open on the problem, not the product.** Ten seconds, nothing on screen.
> "Everyone here has joined a repo and had no idea why the code looks the way it does.
> Git logs tell you what changed. They never tell you why."

**02 — Dashboard → Timeline.** Scroll it. Point at a real entry: the decision, the
risk, the follow-up tasks, the commit hash.
> "Nobody wrote any of this. It was extracted from the diff and the commit message
> when the code was pushed."

The **Compare** tab is a good second beat — the same feature seen from two branches.

**03 — Search → ask something real.** Try *"what did we decide about retries?"* or
*"what are the open risks?"* — the demo project has genuine answers for both.
> "Grounded, with sources. And when it can't support an answer from captured context,
> it says so rather than inventing one."

Call out the grounded/ungrounded badge explicitly — that's the anti-hallucination
story and judges look for it.

**04 — VS Code → Project Context sidebar.** Open risks and pending tasks sitting next
to your code, recent activity underneath.
> "Same brain, without leaving the editor."

Expand **Agent tools** — it lists all five and tells you whether your `mcp.json` is
actually wired to this project.

**05 — Show the loop closing.** Run **Record Reasoning** (`Ctrl+Alt+R`), type a real
sentence, watch it land in the sidebar and the dashboard.
> "That's the same tool the agent calls. A human can use it too."

If Copilot or Cursor is wired up, have the agent log something instead — an agent doing
it live is the stronger version.

**06 — Close on architecture and cost.** Serverless on AWS: API Gateway, Lambda,
DynamoDB, Bedrock Nova Pro for extraction, Titan embeddings for search.
> "About seventeen dollars a month for a four-person team — roughly four dollars per
> developer."

---

## The five MCP tools

| Tool | | What it does |
|---|---|---|
| `log_context` | **write** | Records the why — decision, risk, follow-up tasks. Merges into a push from the last 30 minutes. **This is the core one.** |
| `search_context` | read | Natural-language question, grounded answer, source citations. Titan embeddings + Nova Pro. |
| `get_project_context` | read | Recent context for a branch, newest first. Feature branches merged with main. |
| `get_recent_changes` | read | Recent context across all branches, optionally since a timestamp. |
| `get_events` | read | Raw context records from the dashboard API. |

Works with GitHub Copilot, Cursor and Claude — anything that speaks MCP. No glue code.

---

## If they ask

**How is this different from just reading the git log?**
Git records what changed. FlowSync records why. Nova Pro reads the diff and the commit
message and extracts the decision, the risk it introduces, and the follow-up work —
then makes all of it searchable. A commit message says "add retry logic"; FlowSync says
"chose exponential backoff over fixed-delay to avoid a thundering herd, and the total
retry window is now 15 seconds."

**What if I don't use an AI agent?**
Every `git push` is auto-captured through a pre-push hook, extracted by Nova Pro, and
shows up on the dashboard. The agent tools are the richer path, not the only one.

**How do you stop it hallucinating?**
Every answer is retrieved from captured context and carries citations back to the
originating commit. When retrieval doesn't support the answer, it's flagged ungrounded
rather than presented as fact.

**Where does our code go?**
Diffs go to your own AWS account — API Gateway over TLS, DynamoDB, Bedrock in-region.
The project token lives in VS Code's SecretStorage, not in the repo. The committed
`.flowsync.json` holds only the project ID and backend URL.

**What does it cost to run?**
Roughly $17/month for a four-person team — about $4 per developer. Bedrock extraction
is the largest line at ~$5, then DynamoDB at ~$5, then API Gateway, Lambda, embeddings.

**What would you build next?**
Team-level views (the demo project has one contributor), and pushing context into PR
review so the why shows up where the code is discussed. Retrieval is branch-aware today
but not yet PR-aware.

---

## Don't demo these

**Not exercised**
- The extension's activity bar, menus, keybindings and status bar have never run in a
  real VS Code window.
- Mobile layout was never visually confirmed at phone width.
- The public dashboard domain resolves to `127.0.0.1`.

**Thin spots**
- The demo project has a single contributor, so team features look quiet.
- Last captured activity is March — if asked, say the project is a fixture, not a live
  repo.
- Chat is a separate surface from search; don't switch between them mid-answer.
