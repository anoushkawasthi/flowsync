export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  'https://86tzell2w9.execute-api.us-east-1.amazonaws.com/prod';

export const DEMO_PROJECT_ID = '5bc7728e-ed1e-4e62-b94c-bd2e4238c252';
export const DEMO_TOKEN = '1e82dd7e6d1e8e21da1f348b1d8ee6d3c45f50ff91c0080693203e9f9a733f63';

export const POLLING_INTERVAL_MS = 5000;

// Stage colours live in src/lib/theme-colors.ts — one palette shared by the
// badges and the charts, so the two can no longer drift apart.

export const LOCAL_STORAGE_KEY = 'flowsync-config';
