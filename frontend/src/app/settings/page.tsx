'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useAppContext } from '@/hooks/useAppContext';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/PageHeader';
import { Segmented, type SegmentedOption } from '@/components/ui/segmented';
import { LogOut, Zap, CheckCircle2, Sun, Moon, Monitor } from 'lucide-react';
import { API_BASE_URL, DEMO_PROJECT_ID, DEMO_TOKEN } from '@/lib/constants';

/** A bordered fieldset — the page's one repeated structure. */
function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="neo rounded-card bg-surface shadow-neo-2">
      <header className="border-b-bw border-line px-5 py-3">
        <h3 className="neo-label">{title}</h3>
        {description && <p className="mt-1.5 text-sm text-ink-muted">{description}</p>}
      </header>
      <div className="space-y-4 p-5">{children}</div>
    </section>
  );
}

function FieldRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b-thin border-line pb-2 last:border-b-0 last:pb-0">
      <span className="neo-label-sm">{label}</span>
      <span className="max-w-full truncate font-mono text-xs text-ink-muted">{value}</span>
    </div>
  );
}

type ThemeChoice = 'light' | 'dark' | 'system';

const themeOptions: SegmentedOption<ThemeChoice>[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

export default function SettingsPage() {
  const { config, setConfig, clearConfig } = useAppContext();
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const [demoLoaded, setDemoLoaded] = useState(false);

  const handleDemoLogin = () => {
    setConfig({ projectId: DEMO_PROJECT_ID, token: DEMO_TOKEN });
    setDemoLoaded(true);
    setTimeout(() => setDemoLoaded(false), 2000);
  };

  const handleLogout = () => {
    clearConfig();
    router.push('/');
  };

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader eyebrow="Settings" title="Configuration" />

      <SettingsSection
        title="Connection"
        description="The project this browser is currently signed in to."
      >
        <div className="neo neo-thin space-y-2 rounded-chip bg-canvas px-4 py-3">
          <FieldRow label="Project ID" value={config.projectId || '—'} />
          <FieldRow label="API URL" value={API_BASE_URL} />
        </div>
      </SettingsSection>

      <SettingsSection title="Appearance" description="Applies to this browser only.">
        <Segmented
          options={themeOptions}
          value={(theme as ThemeChoice) ?? 'system'}
          onChange={setTheme}
          aria-label="Colour theme"
        />
      </SettingsSection>

      <SettingsSection title="Demo access" description="For judges and evaluators.">
        <p className="text-sm text-ink-muted">
          Switch to the pre-populated demo project with real captured events — no credentials
          required.
        </p>
        <Button variant={demoLoaded ? 'secondary' : 'outline'} onClick={handleDemoLogin}>
          {demoLoaded ? (
            <>
              <CheckCircle2 className="h-4 w-4" />
              Demo project loaded
            </>
          ) : (
            <>
              <Zap className="h-4 w-4" />
              Switch to demo project
            </>
          )}
        </Button>
        <div className="neo neo-thin rounded-chip bg-canvas px-4 py-3">
          <FieldRow label="Demo project ID" value={DEMO_PROJECT_ID} />
        </div>
      </SettingsSection>

      <SettingsSection title="Danger zone">
        <p className="text-sm text-ink-muted">
          Signing out clears the stored project ID and token from this browser.
        </p>
        <Button variant="destructive" onClick={handleLogout}>
          <LogOut className="h-4 w-4" />
          Sign out
        </Button>
      </SettingsSection>
    </div>
  );
}
