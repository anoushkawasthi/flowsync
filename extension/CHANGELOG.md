# Change Log

All notable changes to the FlowSync extension are documented here.
This project follows [Keep a Changelog](https://keepachangelog.com/).

## [1.2.0]

### Added

- **The Project Context sidebar now shows your project's actual context.** It
  leads with open risks, pending tasks and recent activity, with counts across
  the top. Previously it rendered `projectId`, `defaultBranch`, `port` and
  `backendUrl` — configuration plumbing — because the view made no network call
  at all and could not show project content.
- **Agent tools are visible.** A collapsible section lists all five MCP tools
  (`log_context`, `search_context`, `get_project_context`, `get_recent_changes`,
  `get_events`) with what each is for, plus a wiring indicator that reads your
  `.vscode/mcp.json` and warns when it is missing **or points at a different
  project** — a failure that is otherwise completely silent to the agent.
- **`FlowSync: Record Reasoning`** (`Ctrl/Cmd+Alt+R`) — the human path to
  `log_context`, the only write tool, which until now only an AI agent could
  call. Prompts for reasoning, decision, risk and follow-up tasks, and reports
  whether it merged into a recent push or created a new record.
- **`FlowSync: Open Web Dashboard`** — there was previously no way to reach the
  web dashboard from the extension at all. Copies the Project ID and token to the
  clipboard, then opens the dashboard. The web app reads credentials only from
  `localStorage`, so a link cannot pre-authenticate; the clipboard keeps the token
  out of URLs, browser history and server logs.
- `flowsync.dashboardUrl` setting.

### Changed

- Backend calls consolidated into one module. The base URL had been hardcoded in
  three separate files with each call site hand-rolling its own `node:https`
  plumbing.
- The sidebar surfaces fetch failures as a visible error state rather than
  rendering blank.

### Fixed

- **`flowsync.backendUrl` did nothing.** The setting shipped in 1.1.0 but no code
  ever read it, so pointing the extension at a different backend silently had no
  effect.

## [1.1.0]

### Added

- **Activity-bar presence.** A FlowSync container with a **Project Context**
  sidebar view (a webview view, so it shares the panel's UI), plus title-bar
  actions for Refresh, Open Dashboard, Catch Me Up and Show Logs.
- **Keybindings.** `Ctrl/Cmd+Alt+F` opens the dashboard, `Ctrl/Cmd+Alt+U` runs
  Catch Me Up.
- **Settings** under `flowsync.*`: `backendUrl`, `showPushNotification`,
  `autoOpenOutput`, `statusBar.enabled`.
- **Source-control menu entry** — Catch Me Up appears in the SCM title bar for
  git repositories.
- `FlowSync: Ask FlowSync`, `FlowSync: Refresh Status` and `FlowSync: Show Logs`
  commands.
- Themable status-bar colours (`flowsync.statusBarConnected` /
  `flowsync.statusBarDisconnected`).

### Changed

- **Complete UI redesign** on a neobrutalist system: 2px borders, flat offset
  shadows with no blur, a muted low-chroma palette, and Archivo + JetBrains Mono.
- **The webview now follows your VS Code theme.** It previously hardcoded a
  single dark palette and ignored the host entirely, so it looked wrong on any
  light theme. Geometry stays identical across themes; only the palette follows.
- **Fonts are bundled** rather than fetched. The webview CSP blocks remote fonts,
  so Archivo and JetBrains Mono now ship inside the extension.
- Commands use a proper `category` instead of baking `"FlowSync: "` into each
  title, and the palette now hides commands that don't apply — Initialize and
  Join only when disconnected, Catch Me Up and Refresh only when connected.
- New square logo. The previous one was 500x300 and was being rendered into
  square boxes everywhere, including the marketplace icon.
- Dashboard shows onboarding steps only while disconnected, instead of above the
  data on every visit.
- Marketplace banner switched to the light brand colour.

### Fixed

- The Output panel force-opened on **every** activation. It is now opt-in via
  `flowsync.autoOpenOutput` (default off).
- `FlowSync: Initialize Project` and `FlowSync: Join Project` were exported but
  never registered, so both commands — and their QuickPick flows — were
  unreachable.
- Five CSS classes were rendered by components but had no rule at all
  (`btn-link`, `btn-send`, `badge`, `empty-state-icon`, `welcome-logo`), so those
  elements fell back to browser defaults.
- Styles referencing `--error-bg` / `--error-border` / `--error`, which never
  existed (the real tokens are `--danger-*`), so hardcoded fallbacks always won
  and the state never followed the theme.
- Styles referencing undefined `--input-bg` / `--text-primary` with no fallback,
  which caused those declarations to be dropped at parse time.
- Emoji used as icons (👤 📝 ⚠️ ✦ ▼ ▶) replaced with inline SVGs at a consistent
  stroke weight; emoji ignored the theme and sat on a different baseline.

## [0.0.1]

- Initial prototype release for the AI for Bharat Hackathon.
- Project init and team join via the webview panel.
- Automatic context capture on every `git push` via a pre-push hook.
- AI extraction via AWS Bedrock Nova Pro: feature, decision, risk, tasks,
  affected files.
- Titan Embeddings for vector search.
- Catch Me Up — summarises teammate pushes since the last checkpoint.
- Five MCP tools: `get_project_context`, `get_recent_changes`, `search_context`,
  `log_context`, `get_events`.
- Merge propagation: context copied to the target branch on merge.
