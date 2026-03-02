'use client';

import { useAppContext } from '@/hooks/useAppContext';
import { ConfigForm } from '@/components/settings/ConfigForm';

export default function SettingsPage() {
  const { config, setConfig } = useAppContext();

  return (
    <div className="mx-auto max-w-2xl px-0 sm:px-0">
      <ConfigForm config={config} onSave={setConfig} />
    </div>
  );
}
