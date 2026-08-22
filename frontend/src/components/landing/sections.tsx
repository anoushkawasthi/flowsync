'use client';

import { GitBranch, Brain, Bot, Download, ArrowRight, Cpu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { LogoLockup, LogoTile } from '@/components/brand/Logo';
import { TerminalDemo } from './TerminalDemo';
import { cn } from '@/lib/utils';

export const VSIX_DOWNLOAD_URL = '/downloads/buildberry-1.2.0.vsix';

/* ------------------------------------------------------------------ */
/*  Nav                                                                */
/* ------------------------------------------------------------------ */

export function LandingNav({ onOpenLogin }: { onOpenLogin: () => void }) {
  return (
    <nav className="sticky top-0 z-50 border-b-bw border-line bg-surface">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <LogoLockup />
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild className="hidden sm:inline-flex">
            <a href={VSIX_DOWNLOAD_URL} download>
              <Download className="h-3.5 w-3.5" />
              Extension
            </a>
          </Button>
          <Button size="sm" onClick={onOpenLogin}>
            Dashboard
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
          <ThemeToggle />
        </div>
      </div>
    </nav>
  );
}

/* ------------------------------------------------------------------ */
/*  Hero                                                               */
/* ------------------------------------------------------------------ */

export function Hero({ onOpenLogin }: { onOpenLogin: () => void }) {
  return (
    <section className="neo-grid-bg relative border-b-bw border-line">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        {/* Deliberately asymmetric: the copy carries more weight than the demo,
            so a 50/50 split would make the page read as a brochure. */}
        <div className="grid items-center gap-10 lg:grid-cols-[1.15fr_1fr] lg:gap-14">
          <div>
            <p className="neo-eyebrow mb-5">Model Context Protocol</p>

            <h1 className="neo-display text-ink">
              Persistent memory for{' '}
              <span className="neo-highlight whitespace-nowrap">AI coding agents</span>
            </h1>

            <p className="neo-measure mt-6 text-lg text-ink-muted">
              Your agent logs decisions after every task and searches project history before
              starting new work — via MCP tools. Git push auto-capture is the built-in fallback.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button size="lg" asChild>
                <a href={VSIX_DOWNLOAD_URL} download>
                  <Download className="h-4 w-4" />
                  Download extension
                </a>
              </Button>
              <Button size="lg" variant="outline" onClick={onOpenLogin}>
                Open dashboard
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <TerminalDemo />
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Features — an unequal bento, not a 4-up grid of identical cards     */
/* ------------------------------------------------------------------ */

const features = [
  {
    icon: Brain,
    title: 'Agent logs reasoning',
    description:
      'Your AI agent calls log_context after every task — recording decisions, risks, and rationale. The why behind the code is captured automatically.',
    pastel: 'bg-pastel-dashboard',
    // The lead slab spans the full width on desktop and carries larger type.
    lead: true,
  },
  {
    icon: Bot,
    title: 'Agent searches context',
    description:
      'Before starting work, your agent calls search_context to ask "what did we decide about auth?" and gets a grounded, citation-backed answer.',
    pastel: 'bg-pastel-chat',
  },
  {
    icon: Cpu,
    title: 'MCP-native',
    description:
      'Works with GitHub Copilot, Cursor, Claude, and any MCP-compatible agent. Five built-in tools, zero glue code.',
    pastel: 'bg-pastel-timeline',
  },
  {
    icon: GitBranch,
    title: 'Auto-capture fallback',
    description:
      'Not using an AI agent? Every git push still extracts context automatically. Your project brain grows either way.',
    pastel: 'bg-pastel-analytics',
  },
];

export function Features() {
  return (
    <section className="border-b-bw border-line">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <p className="neo-eyebrow mb-8">How it works</p>
        <h2 className="neo-heading neo-measure mb-10 text-ink">
          Four capabilities that give your agent a memory.
        </h2>

        <div className="grid gap-4 sm:grid-cols-3">
          {features.map((f, i) => (
            <article
              key={f.title}
              className={cn(
                'neo rounded-card p-5 shadow-neo-2',
                f.pastel,
                'text-on-pastel',
                f.lead && 'sm:col-span-3'
              )}
            >
              <span className="neo neo-thin mb-4 inline-grid h-10 w-10 place-items-center rounded-chip bg-surface text-ink">
                <f.icon className="h-5 w-5" />
              </span>
              <h3
                className={cn(
                  'font-extrabold tracking-[-0.02em]',
                  f.lead ? 'text-2xl' : 'text-lg'
                )}
              >
                {f.title}
              </h3>
              <p className={cn('mt-2 opacity-80', f.lead ? 'max-w-[60ch] text-base' : 'text-sm')}>
                {f.description}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Steps — a horizontal numbered rail                                 */
/* ------------------------------------------------------------------ */

const steps = [
  {
    step: '01',
    title: 'Install & initialise',
    description:
      'Install the extension in VS Code and open the BuildBerry panel. Initialise your project to get a Project ID and token.',
  },
  {
    step: '02',
    title: 'Connect your agent',
    description:
      'Your AI agent gains five tools: log_context to record decisions, search_context to query history, and three more.',
  },
  {
    step: '03',
    title: 'Code with memory',
    description:
      'The agent logs why after every task and searches context before new work. Open the dashboard for team visibility.',
  },
];

export function Steps() {
  return (
    <section className="border-b-bw border-line bg-canvas">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <p className="neo-eyebrow mb-8">Getting started</p>
        <h2 className="neo-heading neo-measure mb-10 text-ink">Up and running in three steps.</h2>

        <ol className="relative grid gap-6 sm:grid-cols-3">
          {/* The connecting rule, desktop only — it would run through the cards
              rather than between them once they stack. */}
          <div
            aria-hidden
            className="absolute left-0 right-0 top-6 hidden h-[var(--bw)] bg-line opacity-25 sm:block"
          />

          {steps.map((s) => (
            <li key={s.step} className="relative">
              <span className="neo relative z-10 grid h-12 w-12 place-items-center rounded-chip bg-accent text-lg font-extrabold text-accent-ink shadow-neo-1">
                {s.step}
              </span>
              <h3 className="mt-4 text-lg font-extrabold tracking-[-0.02em] text-ink">{s.title}</h3>
              <p className="mt-1.5 text-sm text-ink-muted">{s.description}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Closing CTA + footer                                               */
/* ------------------------------------------------------------------ */

export function ClosingCTA({ onOpenLogin }: { onOpenLogin: () => void }) {
  return (
    <section className="border-b-bw border-line">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        {/* Surface, not an accent flood. The accent's rule is that it never
            becomes a large fill — a full-width terracotta slab is the loudest
            thing on the page and undercuts the restraint everywhere else. The
            emphasis comes from the logo tile and the primary button instead. */}
        <div className="neo neo-grid-bg flex flex-col items-center gap-5 rounded-card bg-surface px-6 py-14 text-center shadow-neo-3">
          <LogoTile className="h-14 w-14" />
          <h2 className="neo-heading max-w-[22ch] text-ink">Give your AI agent a memory.</h2>
          <p className="max-w-[46ch] text-ink-muted">
            Install the extension, connect your MCP agent, and every decision is captured
            automatically.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button size="lg" asChild>
              <a href={VSIX_DOWNLOAD_URL} download>
                <Download className="h-4 w-4" />
                Download for VS Code
              </a>
            </Button>
            <Button size="lg" variant="outline" onClick={onOpenLogin}>
              Open dashboard
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

export function LandingFooter() {
  return (
    <footer className="bg-surface">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-8 sm:flex-row sm:px-6">
        <LogoLockup wordClassName="text-sm" />
        <div className="flex flex-col items-center gap-1 sm:flex-row sm:gap-5">
          <span className="neo-label-sm">AI for Bharat Hackathon 2026</span>
          <span className="neo-label-sm">AWS Bedrock + DynamoDB</span>
        </div>
      </div>
    </footer>
  );
}
