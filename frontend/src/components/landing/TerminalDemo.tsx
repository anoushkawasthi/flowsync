/**
 * The MCP round-trip, shown as a hard-bordered terminal slab. This is the most
 * persuasive element on the page — it shows the product working rather than
 * describing it — so it stays visible at all times.
 */
export function TerminalDemo() {
  return (
    <div className="neo overflow-hidden rounded-card bg-surface shadow-neo-3">
      {/* title bar — squares, not the usual three circles */}
      <div className="flex items-center gap-2 border-b-bw border-line bg-pastel-neutral px-3 py-2">
        <span aria-hidden className="neo neo-thin h-2.5 w-2.5 rounded-[2px] bg-danger-fill" />
        <span aria-hidden className="neo neo-thin h-2.5 w-2.5 rounded-[2px] bg-warn-fill" />
        <span aria-hidden className="neo neo-thin h-2.5 w-2.5 rounded-[2px] bg-success-fill" />
        <span className="ml-1 text-[0.6875rem] font-bold uppercase tracking-[0.1em] text-on-pastel opacity-70">
          agent session
        </span>
      </div>

      <div className="space-y-2 p-4 font-mono text-[0.8125rem] leading-relaxed">
        <p className="text-ink-subtle"># AI agent finishes implementing auth</p>
        <p className="text-ink">
          <span className="font-bold text-accent-text">mcp</span> log_context
        </p>

        <dl className="neo neo-thin mt-2 space-y-1.5 rounded-chip bg-canvas p-3 text-xs">
          <div className="flex gap-2">
            <dt className="shrink-0 text-ink-subtle">Decision:</dt>
            <dd className="text-ink">Use RS256 for cross-service token validation</dd>
          </div>
          <div className="flex gap-2">
            <dt className="shrink-0 text-ink-subtle">Risk:</dt>
            <dd className="text-ink">Token expiry not handled on mobile clients</dd>
          </div>
          <div className="flex gap-2">
            <dt className="shrink-0 text-ink-subtle">Task:</dt>
            <dd className="text-ink">Add refresh token rotation</dd>
          </div>
        </dl>

        <p className="pt-2 text-ink-subtle"># next day — agent starts a new task</p>
        <p className="text-ink">
          <span className="font-bold text-accent-text">mcp</span> search_context
          <span className="text-ink-muted"> &quot;what did we decide about auth?&quot;</span>
        </p>
        <p className="text-xs text-ink-muted">
          ↳ RS256 for cross-service validation (logged 1d ago, 2 sources)
        </p>

        <p className="pt-2 text-[0.6875rem] text-ink-subtle">
          # git pushes are auto-captured as a fallback
        </p>
      </div>
    </div>
  );
}
