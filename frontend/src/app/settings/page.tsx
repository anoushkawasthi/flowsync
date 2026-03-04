'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppContext } from '@/hooks/useAppContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { LogOut, Zap, CheckCircle2 } from 'lucide-react';
import { API_BASE_URL, DEMO_PROJECT_ID, DEMO_TOKEN } from '@/lib/constants';

export default function SettingsPage() {
  const { config, setConfig, clearConfig } = useAppContext();
  const router = useRouter();
  const [mockActivated, setMockActivated] = useState(false);

  const handleMockLogin = () => {
    setConfig({ projectId: DEMO_PROJECT_ID, token: DEMO_TOKEN });
    setMockActivated(true);
    setTimeout(() => setMockActivated(false), 2000);
  };

  const handleLogout = () => {
    clearConfig();
    router.push('/');
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Current session */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Current Session</CardTitle>
          <CardDescription>You are logged in to a FlowSync project.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-4 py-3 space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-500">Project ID</span>
              <span className="font-mono text-xs text-zinc-300">{config.projectId || '—'}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-500">API URL</span>
              <span className="font-mono text-[10px] text-zinc-500 truncate max-w-[200px]">{API_BASE_URL}</span>
            </div>
          </div>

          <Button
            variant="destructive"
            className="w-full sm:w-auto"
            onClick={handleLogout}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </CardContent>
      </Card>

      {/* Demo access */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="h-4 w-4 text-teal-500" />
            Demo Access
          </CardTitle>
          <CardDescription>For judges and evaluators.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm font-medium text-zinc-300 mb-1">Load Demo Project</p>
            <p className="text-xs text-zinc-500 mb-3">
              Switch to the pre-populated demo project with real captured events — no credentials required.
            </p>
            <Button
              variant="outline"
              className="border-teal-500/40 text-teal-400 hover:bg-teal-500/10 hover:border-teal-500/60"
              onClick={handleMockLogin}
            >
              {mockActivated ? (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Demo Project Loaded
                </>
              ) : (
                <>
                  <Zap className="mr-2 h-4 w-4" />
                  Switch to Demo Project
                </>
              )}
            </Button>
          </div>

          <Separator />

          <div className="space-y-1">
            <p className="text-xs font-medium text-zinc-500">Demo Project ID</p>
            <p className="font-mono text-[11px] text-zinc-400 break-all">{DEMO_PROJECT_ID}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
