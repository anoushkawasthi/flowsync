'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { DEMO_PROJECT_ID } from '@/lib/constants';
import type { ProjectConfig } from '@/types';
import { Eye, EyeOff, Zap } from 'lucide-react';

interface ConfigModalProps {
  open: boolean;
  onSave: (config: ProjectConfig) => void;
}

export function ConfigModal({ open, onSave }: ConfigModalProps) {
  const [projectId, setProjectId] = useState(DEMO_PROJECT_ID);
  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [error, setError] = useState('');

  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId.trim() || !token.trim()) {
      setError('Both fields are required');
      return;
    }
    if (!uuidRegex.test(projectId.trim())) {
      setError('Project ID must be a valid UUID');
      return;
    }
    setError('');
    onSave({ projectId: projectId.trim(), token: token.trim() });
  };

  return (
    <Dialog open={open}>
      <DialogContent
        hideCloseButton
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        className="sm:max-w-md"
      >
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <Zap className="h-5 w-5 text-teal-500" />
            <DialogTitle>Connect to FlowSync</DialogTitle>
          </div>
          <DialogDescription>
            Enter your project ID and API token to get started. You can find
            these in your project settings.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-2">
            <label
              htmlFor="projectId"
              className="text-sm font-medium text-zinc-300"
            >
              Project ID
            </label>
            <Input
              id="projectId"
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="token"
              className="text-sm font-medium text-zinc-300"
            >
              API Token
            </label>
            <div className="relative">
              <Input
                id="token"
                type={showToken ? 'text' : 'password'}
                placeholder="Enter your API token"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
              >
                {showToken ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}

          <Button
            type="submit"
            className="w-full bg-teal-500 hover:bg-teal-600 text-white"
          >
            Connect to FlowSync
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
