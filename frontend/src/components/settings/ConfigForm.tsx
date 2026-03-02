'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Eye, EyeOff, Save, CheckCircle2 } from 'lucide-react';
import { API_BASE_URL } from '@/lib/constants';
import type { ProjectConfig } from '@/types';

interface ConfigFormProps {
  config: ProjectConfig;
  onSave: (config: ProjectConfig) => void;
}

export function ConfigForm({ config, onSave }: ConfigFormProps) {
  const [projectId, setProjectId] = useState(config.projectId);
  const [token, setToken] = useState(config.token);
  const [showToken, setShowToken] = useState(false);
  const [useMock, setUseMock] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const mock = localStorage.getItem('flowsync-use-mock');
    setUseMock(mock === 'true');
  }, []);

  const handleSave = () => {
    onSave({ projectId: projectId.trim(), token: token.trim() });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleMockToggle = (checked: boolean) => {
    setUseMock(checked);
    localStorage.setItem('flowsync-use-mock', String(checked));
  };

  return (
    <div className="space-y-6">
      {/* Connection settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Connection Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label
              htmlFor="settings-projectId"
              className="text-sm font-medium text-zinc-300"
            >
              Project ID
            </label>
            <Input
              id="settings-projectId"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="settings-token"
              className="text-sm font-medium text-zinc-300"
            >
              API Token
            </label>
            <div className="relative">
              <Input
                id="settings-token"
                type={showToken ? 'text' : 'password'}
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

          <Button
            onClick={handleSave}
            className="bg-teal-500 hover:bg-teal-600 text-white"
          >
            {saved ? (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Saved
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Changes
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Developer settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Developer Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-zinc-300">Mock Mode</p>
              <p className="text-xs text-zinc-500">
                Use mock data instead of calling the API
              </p>
            </div>
            <Switch checked={useMock} onCheckedChange={handleMockToggle} />
          </div>

          <Separator />

          <div className="space-y-2">
            <p className="text-sm font-medium text-zinc-300">API Base URL</p>
            <p className="rounded bg-zinc-800 px-3 py-2 font-mono text-xs text-zinc-400">
              {API_BASE_URL}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div
              className={`h-2 w-2 rounded-full ${
                projectId && token ? 'bg-emerald-500' : 'bg-red-500'
              }`}
            />
            <span className="text-xs text-zinc-500">
              {projectId && token ? 'Connected' : 'Not configured'}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
