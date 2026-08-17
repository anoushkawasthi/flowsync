'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, ArrowRight } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LogoMark } from '@/components/brand/Logo';
import { useAppContext } from '@/hooks/useAppContext';
import { DEMO_PROJECT_ID, DEMO_TOKEN } from '@/lib/constants';
import { getEvents } from '@/lib/api';

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Presented as a modal rather than swapped into the hero's right column. The
 * old version replaced the MCP terminal demo — the single most persuasive thing
 * on the page — the moment anyone clicked "Open Dashboard".
 */
export function LoginPanel({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { setConfig } = useAppContext();
  const router = useRouter();
  const [projectId, setProjectId] = useState('');
  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId.trim() || !token.trim()) {
      setError('Both fields are required.');
      return;
    }
    if (!uuidRegex.test(projectId.trim())) {
      setError('Project ID must be a valid UUID.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      // Validate credentials against the real API before saving anything.
      await getEvents(projectId.trim(), token.trim(), undefined, undefined, 1);
      setConfig({ projectId: projectId.trim(), token: token.trim() });
      router.push('/dashboard');
    } catch (err: unknown) {
      const status = (err as { response?: { status: number } })?.response?.status;
      if (status === 401 || status === 403) {
        setError('Invalid Project ID or token. Check your credentials.');
      } else if (status === 404) {
        setError('Project not found. Check your Project ID.');
      } else {
        setError('Could not reach the API. Check your connection.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = () => {
    setConfig({ projectId: DEMO_PROJECT_ID, token: DEMO_TOKEN });
    router.push('/dashboard');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Open dashboard</DialogTitle>
          <DialogDescription>
            Use the Project ID and token from the VS Code extension.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleLogin} className="space-y-3">
          <div className="space-y-1.5">
            <label htmlFor="project-id" className="neo-label-sm">
              Project ID
            </label>
            <Input
              id="project-id"
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="font-mono text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="api-token" className="neo-label-sm">
              API token
            </label>
            <div className="relative">
              <Input
                id="api-token"
                type={showToken ? 'text' : 'password'}
                placeholder="Your project token"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="pr-10 font-mono text-sm"
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                aria-label={showToken ? 'Hide token' : 'Show token'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-subtle hover:text-ink"
              >
                {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {error && (
            <p role="alert" className="text-sm font-bold text-danger">
              {error}
            </p>
          )}

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? 'Connecting…' : 'Open dashboard'}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </form>

        <div className="flex items-center gap-3">
          <span className="h-[var(--bw-thin)] flex-1 bg-line opacity-30" />
          <span className="neo-label-sm">or</span>
          <span className="h-[var(--bw-thin)] flex-1 bg-line opacity-30" />
        </div>

        <div className="space-y-2">
          <Button variant="secondary" className="w-full" onClick={handleDemoLogin}>
            <LogoMark className="h-4 w-4" />
            Try the demo project
          </Button>
          <p className="text-center text-xs text-ink-subtle">
            Real pushes from a live project — not mock data.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
