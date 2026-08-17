'use client';

import { ThemeProvider as NextThemeProvider } from 'next-themes';

/**
 * The app is statically exported (`output: 'export'`), so there is no server
 * render that could resolve the user's theme ahead of time. next-themes solves
 * that by injecting a blocking script that sets the class on <html> before
 * first paint — which is why this is the one dependency worth adding rather
 * than hand-rolling a provider that would flash light-then-dark on every load.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemeProvider>
  );
}
