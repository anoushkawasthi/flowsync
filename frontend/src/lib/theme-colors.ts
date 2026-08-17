/**
 * Hex mirrors of the design tokens, for the places that cannot use a CSS class.
 *
 * Recharts takes colours as props (`fill`, `stroke`, inline tooltip styles), so
 * it can never read a Tailwind class. Rather than let it grow its own private
 * palette — which is exactly how this codebase ended up with `STAGE_COLORS` as
 * Tailwind strings and `CHART_COLORS` as hex, six stages defined twice and free
 * to drift — every consumer now reads from here.
 *
 * src/app/tokens.css remains the source of truth. If you change a value there,
 * change it here too; these are the same colours expressed for a different
 * consumer, not a second palette.
 */

/** One pastel per pipeline stage. Always pair with STAGE_INK for text on top. */
export const STAGE_PALETTE: Record<string, string> = {
  Setup: '#C6D6E3',
  'Feature Development': '#C7D8C4',
  'Bug Fix': '#E2C4BE',
  Refactoring: '#E3D3AC',
  Testing: '#D3CADE',
  Documentation: '#DAD6CE',
};

export const STAGE_FALLBACK = '#DAD6CE';

/** Pastels do not flip between themes, so text on them is always this ink. */
export const STAGE_INK = '#16161A';

export function stageColor(stage: string): string {
  return STAGE_PALETTE[stage] ?? STAGE_FALLBACK;
}

/**
 * Chart chrome — axes, ticks, tooltips, grid. These DO flip, so callers pass
 * the resolved theme from `useTheme()`.
 */
export function chartTheme(isDark: boolean) {
  return {
    ink: isDark ? '#F2EFE8' : '#16161A',
    inkSubtle: isDark ? 'rgba(242,239,232,0.56)' : 'rgba(22,22,26,0.56)',
    surface: isDark ? '#1F1F25' : '#FFFFFF',
    border: isDark ? '#F2EFE8' : '#16161A',
    accent: isDark ? '#CF6A4D' : '#B84E35',
    grid: isDark ? 'rgba(242,239,232,0.14)' : 'rgba(22,22,26,0.12)',
  };
}

/** Shared tooltip styling so both charts read as the same object. */
export function chartTooltipStyle(isDark: boolean) {
  const t = chartTheme(isDark);
  return {
    backgroundColor: t.surface,
    border: `2px solid ${t.border}`,
    borderRadius: 8,
    boxShadow: `4px 4px 0 0 ${t.border}`,
    color: t.ink,
    fontWeight: 700,
    fontSize: 12,
  } as const;
}
