import type { Metadata } from 'next';
import { Archivo, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { AppShell } from '@/components/layout/AppShell';
import { ThemeProvider } from '@/components/theme/ThemeProvider';

// Loaded as CSS variables rather than `.className` so tailwind.config and the
// raw CSS in tokens.css/neo.css can both reach them.
const archivo = Archivo({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-archivo',
  display: 'swap',
});

const mono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  // Needed so the opengraph/twitter images resolve to absolute URLs. Without it
  // Next falls back to localhost:3000 and warns on every build.
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://flowsync.dev'),
  title: 'BuildBerry — Persistent memory for AI coding agents',
  description:
    'Your AI agent logs decisions after every task and searches project history before starting new work, via MCP tools. Git push auto-capture is the built-in fallback.',
  openGraph: {
    title: 'BuildBerry — Persistent memory for AI coding agents',
    description:
      'Your AI agent logs decisions after every task and searches project history before starting new work.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'BuildBerry — Persistent memory for AI coding agents',
    description:
      'Your AI agent logs decisions after every task and searches project history before starting new work.',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning is required: next-themes writes the theme class
    // onto <html> in a pre-hydration script, so the server and client markup
    // legitimately differ on this one attribute.
    <html lang="en" suppressHydrationWarning className={`${archivo.variable} ${mono.variable}`}>
      <body>
        <ThemeProvider>
          <AppShell>{children}</AppShell>
        </ThemeProvider>
      </body>
    </html>
  );
}
