import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { formatDistanceToNow } from 'date-fns';
import type { ContextRecord } from '@/types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formats a list of context records into a Markdown snapshot for sharing.
 * Includes decisions, risks, pending tasks, and activity summary.
 */
export function formatContextSnapshot(
  events: ContextRecord[],
  branch: string
): string {
  if (events.length === 0) {
    return `# FlowSync — Project Summary\n\n**Branch:** ${branch}\n\nNo events captured yet.`;
  }

  // Identical aggregation logic as ProjectSummary's useSummary hook
  const latestEvent = events[0];
  const currentStage = latestEvent?.stage ?? 'Setup';

  // Active authors
  const authorMap = new Map<string, string>();
  for (const e of events) {
    const existing = authorMap.get(e.author);
    if (!existing || e.extractedAt > existing) {
      authorMap.set(e.author, e.extractedAt);
    }
  }
  const authors = Array.from(authorMap.keys());

  // Recent decisions (last 5 non-null, deduplicated)
  const seenDecisions = new Set<string>();
  const decisions: { decision: string; feature: string; extractedAt: string; commitHash: string }[] = [];
  for (const e of events) {
    if (e.decision !== null && !seenDecisions.has(e.decision)) {
      seenDecisions.add(e.decision);
      decisions.push({
        decision: e.decision,
        feature: e.feature,
        extractedAt: e.extractedAt,
        commitHash: e.commitHash,
      });
      if (decisions.length >= 5) break;
    }
  }

  // Active risks (deduplicated)
  const seenRisks = new Set<string>();
  const risks: { risk: string; feature: string; extractedAt: string }[] = [];
  for (const e of events) {
    if (e.risk !== null && !seenRisks.has(e.risk)) {
      seenRisks.add(e.risk);
      risks.push({
        risk: e.risk,
        feature: e.feature,
        extractedAt: e.extractedAt,
      });
    }
  }

  // Pending tasks (deduplicated, limit to 10)
  const taskSet = new Set<string>();
  const tasks: string[] = [];
  for (const e of events) {
    for (const t of e.tasks) {
      if (!taskSet.has(t)) {
        taskSet.add(t);
        tasks.push(t);
        if (tasks.length >= 10) break;
      }
    }
    if (tasks.length >= 10) break;
  }

  // Confidence trend
  const avgConfidence =
    events.length > 0
      ? Math.round((events.reduce((s, e) => s + e.confidence, 0) / events.length) * 100)
      : 0;

  // Format timestamp
  const lastActivityTime = formatDistanceToNow(new Date(latestEvent.extractedAt), {
    addSuffix: true,
  });

  const lines: string[] = [];
  lines.push('# FlowSync — Project Summary');
  lines.push('');
  lines.push(
    `**Branch:** \`${branch}\` | **Last activity:** ${lastActivityTime} | **Stage:** ${currentStage}`
  );
  lines.push(`**Events:** ${events.length} | **Contributors:** ${authors.length} | **Avg Confidence:** ${avgConfidence}%`);
  lines.push('');

  // Recent decisions
  if (decisions.length > 0) {
    lines.push('## Recent Decisions');
    for (const d of decisions) {
      const time = formatDistanceToNow(new Date(d.extractedAt), { addSuffix: true });
      const hashInfo = d.commitHash ? ` (\`${d.commitHash.slice(0, 7)}\`, ${time})` : ` (${time})`;
      lines.push(`- **${d.feature}**: ${d.decision}${hashInfo}`);
    }
    lines.push('');
  }

  // Active risks
  if (risks.length > 0) {
    lines.push('## Active Risks');
    for (const r of risks) {
      const time = formatDistanceToNow(new Date(r.extractedAt), { addSuffix: true });
      lines.push(`- **${r.feature}**: ${r.risk} (${time})`);
    }
    lines.push('');
  }

  // Pending tasks
  if (tasks.length > 0) {
    lines.push('## Pending Tasks');
    for (const t of tasks) {
      lines.push(`- [ ] ${t}`);
    }
    lines.push('');
  }

  // Activity summary
  lines.push('## Activity Summary');
  lines.push(`- ${events.length} commits captured`);
  lines.push(`- ${authors.length} contributor${authors.length !== 1 ? 's' : ''}: ${authors.join(', ')}`);
  lines.push(`- Confidence trend: ${avgConfidence}% average`);

  return lines.join('\n');
}
