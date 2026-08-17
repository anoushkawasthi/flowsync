'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';

/**
 * For the handful of places that must know the theme in JavaScript rather than
 * CSS — Recharts takes colours as props, and the syntax highlighter takes a
 * style object.
 *
 * `resolvedTheme` is only meaningful after mount, so `mounted` is returned too:
 * rendering a chart or a code block with the wrong palette and then swapping it
 * is more jarring than holding the space for a frame.
 */
export function useResolvedTheme() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  return { mounted, isDark: resolvedTheme === 'dark' };
}
