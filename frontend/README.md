# FlowSync Dashboard (Frontend)

Next.js 14 web dashboard for viewing, searching, and chatting with your team's AI-extracted development context.

---

## Features

- **Context timeline** — browse all AI-extracted context records across branches, with merge badges and author attribution
- **Branch filtering** — filter context by branch to see what was built where
- **Chat** — conversational interface powered by Nova Lite + RAG over project context
- **Catch Me Up** — quick summary view of what teammates pushed since your last check
- **Analytics** — activity charts and contribution breakdown

---

## Stack

- **Next.js 14.2** (App Router)
- **React 18** with TypeScript
- **Tailwind CSS** + **shadcn/ui** component library
- **lucide-react** for icons

---

## Getting started

```bash
cd frontend
npm install
npm run dev       # http://localhost:3000
```

### Environment

No `.env` file is required for local development — the API URL is hardcoded to the production endpoint. To point at a local or alternative backend, edit `src/lib/api.ts`.

---

## Project structure

```
src/
  app/
    page.tsx              # Landing page with login form
    dashboard/            # Main dashboard — context timeline
    chat/                 # Conversational chat
    analytics/            # Activity analytics
    settings/             # Project settings
  components/
    dashboard/            # ContextCard, BranchFilter, etc.
    chat/                 # ChatWindow, MessageBubble
    layout/               # Sidebar, AppShell
    ui/                   # shadcn/ui primitives
  lib/
    api.ts                # API client (getEvents, postChat, postQuery)
    constants.ts          # DEMO_PROJECT_ID, DEMO_TOKEN
    utils.ts              # cn() and helpers
  hooks/
    useAppContext.ts       # Global project config + auth state
  types/
    index.ts              # ContextRecord, Project, ChatMessage types
public/
  logo.png                # Extension + dashboard logo
  downloads/
    flowsync-context.vsix # VSIX download served from the landing page
```

---

## Deployment

The dashboard is deployed to **Vercel**. Push to `main` triggers an automatic build and deploy.

```bash
npm run build    # Builds Next.js static + server output
npm run start    # Runs the production server locally
npm run lint     # ESLint
```

---

## Authentication

Authentication is project-based, not user-based:

- Users enter a `projectId` + `apiToken` (from `.flowsync.json` in their repo)
- Credentials are stored in `localStorage` via `useAppContext`
- A **Demo Project** is available on the landing page with preloaded data (no token required)
