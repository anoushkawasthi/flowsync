import type { Config } from 'tailwindcss';

/**
 * Colours map straight onto the custom properties in src/app/tokens.css rather
 * than going through the shadcn `hsl(var(--x))` indirection. That trades away
 * Tailwind's `/50` opacity modifiers, which this design barely uses — flat
 * fills and hard borders are the whole point, and the few blends that are
 * needed use color-mix() inside neo.css where they can be commented.
 *
 * The old hardcoded `accent: '#14B8A6'` override is gone: teal is retired, and
 * the accent now flips per theme like every other token.
 */
const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        canvas: 'var(--canvas)',
        surface: {
          DEFAULT: 'var(--surface)',
          sunken: 'var(--surface-sunken)',
        },
        ink: {
          DEFAULT: 'var(--ink)',
          muted: 'var(--ink-muted)',
          subtle: 'var(--ink-subtle)',
        },
        line: {
          DEFAULT: 'var(--border)',
          soft: 'var(--border-soft)',
        },
        border: 'var(--border)',
        accent: {
          DEFAULT: 'var(--accent)',
          ink: 'var(--accent-ink)',
          text: 'var(--accent-text)',
        },
        // Status: a text colour that clears AA on --surface, plus a pastel fill.
        danger: { DEFAULT: 'var(--danger)', fill: 'var(--danger-fill)' },
        warn: { DEFAULT: 'var(--warn)', fill: 'var(--warn-fill)' },
        success: { DEFAULT: 'var(--success)', fill: 'var(--success-fill)' },
        // Section pastels. These do not flip between themes; pair with `text-on-pastel`.
        'on-pastel': 'var(--on-pastel)',
        pastel: {
          dashboard: 'var(--p-dashboard)',
          timeline: 'var(--p-timeline)',
          analytics: 'var(--p-analytics)',
          chat: 'var(--p-chat)',
          risk: 'var(--p-risk)',
          search: 'var(--p-search)',
          'compare-a': 'var(--p-compare-a)',
          'compare-b': 'var(--p-compare-b)',
          neutral: 'var(--p-neutral)',
        },
      },
      borderRadius: {
        card: 'var(--r-card)',
        chip: 'var(--r-chip)',
        pill: 'var(--r-pill)',
      },
      borderWidth: {
        DEFAULT: 'var(--bw)',
        thin: 'var(--bw-thin)',
        bw: 'var(--bw)',
      },
      boxShadow: {
        // Hard shadows only: zero blur, zero spread, offset scales with importance.
        'neo-1': 'var(--sh-1)',
        'neo-2': 'var(--sh-2)',
        'neo-3': 'var(--sh-3)',
        'neo-focus': 'var(--sh-focus)',
        none: 'none',
      },
      fontFamily: {
        sans: ['var(--font-archivo)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        display: ['var(--fs-display)', { lineHeight: '0.95', letterSpacing: '-0.04em' }],
        heading: ['var(--fs-heading)', { lineHeight: '1.08', letterSpacing: '-0.02em' }],
      },
      maxWidth: {
        measure: 'var(--measure)',
        content: 'var(--content-max)',
      },
      spacing: {
        bar: 'var(--bar-h)',
        rail: 'var(--rail-w)',
        'rail-collapsed': 'var(--rail-w-collapsed)',
      },
      transitionTimingFunction: {
        neo: 'var(--ease)',
      },
      // Named rather than written inline as `duration-[var(--t-micro)]`: the
      // arbitrary form is ambiguous to Tailwind (transition- vs animation-
      // duration) and warns on every build.
      transitionDuration: {
        micro: 'var(--t-micro)',
        hover: 'var(--t-hover)',
        content: 'var(--t-content)',
      },
      keyframes: {
        'slide-down-fade': {
          '0%': { opacity: '0', transform: 'translateY(-10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-left': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(0)' },
        },
      },
      animation: {
        'slide-down-fade': 'slide-down-fade 0.3s var(--ease)',
        'slide-in-left': 'slide-in-left 0.2s var(--ease)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
export default config;
