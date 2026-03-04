export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  'https://86tzell2w9.execute-api.us-east-1.amazonaws.com/prod';

export const DEMO_PROJECT_ID = '5bc7728e-ed1e-4e62-b94c-bd2e4238c252';
export const DEMO_TOKEN = '1e82dd7e6d1e8e21da1f348b1d8ee6d3c45f50ff91c0080693203e9f9a733f63';

export const POLLING_INTERVAL_MS = 5000;

export const STAGE_COLORS: Record<
  string,
  { bg: string; text: string; border: string }
> = {
  Setup: {
    bg: 'bg-blue-500/15',
    text: 'text-blue-400',
    border: 'border-blue-500/30',
  },
  'Feature Development': {
    bg: 'bg-emerald-500/15',
    text: 'text-emerald-400',
    border: 'border-emerald-500/30',
  },
  'Bug Fix': {
    bg: 'bg-red-500/15',
    text: 'text-red-400',
    border: 'border-red-500/30',
  },
  Refactoring: {
    bg: 'bg-yellow-500/15',
    text: 'text-yellow-400',
    border: 'border-yellow-500/30',
  },
  Testing: {
    bg: 'bg-purple-500/15',
    text: 'text-purple-400',
    border: 'border-purple-500/30',
  },
  Documentation: {
    bg: 'bg-zinc-500/15',
    text: 'text-zinc-400',
    border: 'border-zinc-500/30',
  },
};

export const LOCAL_STORAGE_KEY = 'flowsync-config';
