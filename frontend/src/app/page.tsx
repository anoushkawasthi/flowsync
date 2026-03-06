'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  GitBranch,
  Brain,
  Users,
  Bot,
  ChevronRight,
  Eye,
  EyeOff,
  Terminal,
  Download,
  ArrowRight,
  CheckCircle2,
  Cpu,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAppContext } from '@/hooks/useAppContext';
import { DEMO_PROJECT_ID, DEMO_TOKEN } from '@/lib/constants';
import { getEvents } from '@/lib/api';

const VSIX_DOWNLOAD_URL = '/downloads/flowsync-1.0.1.vsix';

const features = [
  {
    icon: GitBranch,
    title: 'Auto-captured on push',
    description:
      'Install the VS Code extension once. Every git push automatically triggers context extraction — no manual input.',
    accent: 'text-teal-400',
    bg: 'bg-teal-500/10',
    border: 'border-teal-500/20',
  },
  {
    icon: Brain,
    title: 'AI-powered extraction',
    description:
      'Claude analyses your diff and extracts the decision made, risks introduced, pending tasks, and affected entities.',
    accent: 'text-purple-400',
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/20',
  },
  {
    icon: Bot,
    title: 'MCP tools for AI agents',
    description:
      'Your AI coding assistant can query FlowSync directly via MCP. Ask "what did we decide about auth?" and get a grounded answer.',
    accent: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
  },
  {
    icon: Users,
    title: 'Persistent team memory',
    description:
      'Context is stored per-project in DynamoDB. Every team member sees the same shared history — branches, authors, decisions.',
    accent: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
  },
];

const steps = [
  {
    step: '01',
    title: 'Install the extension',
    description: 'Download the FlowSync VS Code extension and run "FlowSync: Initialize Project" in a git repo.',
    icon: Download,
  },
  {
    step: '02',
    title: 'Push your code',
    description: 'Work normally. Every git push triggers the hook — your diff is sent to AWS Bedrock for analysis.',
    icon: Terminal,
  },
  {
    step: '03',
    title: 'Query your context',
    description: 'Open the dashboard to see decisions, risks, and tasks. Or let your AI agent query via MCP.',
    icon: Cpu,
  },
];

function LoginForm() {
  const { setConfig } = useAppContext();
  const router = useRouter();
  const [projectId, setProjectId] = useState('');
  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  const handleLogin = async (e: React.FormEvent) => {
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
    setLoading(true);
    try {
      // Validate credentials against the real API before saving
      await getEvents(projectId.trim(), token.trim(), undefined, undefined, 1);
      setConfig({ projectId: projectId.trim(), token: token.trim() });
      router.push('/dashboard');
    } catch (err: unknown) {
      const status = (err as { response?: { status: number } })?.response?.status;
      if (status === 401 || status === 403) {
        setError('Invalid Project ID or token. Please check your credentials.');
      } else if (status === 404) {
        setError('Project not found. Check your Project ID.');
      } else {
        setError('Could not reach the API. Check your connection.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleMockLogin = () => {
    setConfig({ projectId: DEMO_PROJECT_ID, token: DEMO_TOKEN });
    router.push('/dashboard');
  };

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-6 backdrop-blur">
      <h3 className="mb-4 text-base font-semibold text-zinc-100">Open Dashboard</h3>
      <form onSubmit={handleLogin} className="space-y-3">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-400">Project ID</label>
          <Input
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-400">API Token</label>
          <div className="relative">
            <Input
              type={showToken ? 'text' : 'password'}
              placeholder="Your project token"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="pr-9 text-sm"
            />
            <button
              type="button"
              onClick={() => setShowToken(!showToken)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
            >
              {showToken ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
        <Button
          type="submit"
          disabled={loading}
          className="w-full bg-teal-500 hover:bg-teal-600 text-white"
        >
          {loading ? 'Connecting…' : 'Open Dashboard'}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </form>

      <div className="mt-3 flex items-center gap-3">
        <div className="h-px flex-1 bg-zinc-800" />
        <span className="text-[11px] text-zinc-600">or</span>
        <div className="h-px flex-1 bg-zinc-800" />
      </div>

      <Button
        variant="outline"
        className="mt-3 w-full text-sm text-zinc-300 border-zinc-700 hover:border-teal-500/50 hover:text-teal-400"
        onClick={handleMockLogin}
      >
        <Image src="/logo.png" alt="" width={24} height={24} className="mr-2 h-6 w-6" />
        Try Demo Project
        <span className="ml-auto text-[10px] text-zinc-500 font-normal">(preloaded data)</span>
      </Button>
    </div>
  );
}

export default function LandingPage() {
  const [showLogin, setShowLogin] = useState(false);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-zinc-800/60 bg-zinc-950/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <Image src="/logo.png" alt="FlowSync" width={32} height={32} className="h-8 w-8" />
            <span className="text-base font-bold">FlowSync</span>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={VSIX_DOWNLOAD_URL}
              download
              className="hidden sm:flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-zinc-400 hover:text-zinc-100 transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              Extension
            </a>
            <Button
              size="sm"
              variant="outline"
              className="border-teal-500/50 text-teal-400 hover:bg-teal-500/10"
              onClick={() => setShowLogin(!showLogin)}
            >
              Dashboard
              <ChevronRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative mx-auto max-w-6xl px-4 sm:px-6 pt-20 pb-16">
        {/* Glow */}
        <div className="pointer-events-none absolute inset-0 flex items-start justify-center overflow-hidden">
          <div className="h-72 w-72 -translate-y-12 rounded-full bg-teal-500/10 blur-3xl" />
        </div>

        <div className="relative grid gap-12 lg:grid-cols-2 lg:items-center">
          {/* Left: copy */}
          <div>
            <h1 className="mb-4 text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
              Your codebase's{' '}
              <span className="text-teal-400">memory layer</span>
            </h1>
            <p className="mb-6 text-lg text-zinc-400 leading-relaxed">
              FlowSync captures what your team decides, every time they push
              code. AI agents query your project history naturally. No more
              "why did we do it this way?" moments.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <a href={VSIX_DOWNLOAD_URL} download>
                <Button
                  size="lg"
                  className="w-full sm:w-auto bg-teal-500 hover:bg-teal-600 text-white font-semibold"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download Extension
                </Button>
              </a>
              <Button
                size="lg"
                variant="outline"
                className="w-full sm:w-auto border-zinc-700 text-zinc-300 hover:border-teal-500/50 hover:text-teal-400"
                onClick={() => setShowLogin(true)}
              >
                Open Dashboard
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Right: login form or placeholder */}
          <div>
            {showLogin ? (
              <LoginForm />
            ) : (
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6">
                <div className="space-y-2 font-mono text-sm">
                  <div className="text-zinc-500"># your git repo</div>
                  <div className="text-zinc-300">
                    <span className="text-teal-400">$</span> git push origin feature/auth
                  </div>
                  <div className="text-zinc-500 text-xs mt-3">→ FlowSync captured context</div>
                  <div className="mt-3 rounded-lg border border-zinc-700 bg-zinc-950 p-3 text-xs space-y-1.5">
                    <div><span className="text-zinc-500">Feature:</span> <span className="text-zinc-200">JWT Authentication System</span></div>
                    <div><span className="text-zinc-500">Decision:</span> <span className="text-teal-300">Use RS256 for cross-service token validation</span></div>
                    <div><span className="text-zinc-500">Risk:</span> <span className="text-amber-300">Token expiry not handled on mobile clients</span></div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {['auth.ts', 'middleware.ts', 'userController.ts'].map(e => (
                        <span key={e} className="rounded bg-zinc-800 px-1.5 py-0.5 text-zinc-400 text-[10px]">{e}</span>
                      ))}
                    </div>
                  </div>
                  <div className="text-zinc-500 text-xs">
                    <span className="text-teal-400">$</span> mcp query "what did we decide about auth?"
                  </div>
                  <div className="text-zinc-300 text-xs">↳ JWT with RS256, see commit a1b2c3d</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 py-16 border-t border-zinc-800/60">
        <div className="mb-10 text-center">
          <h2 className="text-2xl font-bold sm:text-3xl">How FlowSync works</h2>
          <p className="mt-2 text-zinc-400">Four pieces that give your team and your AI agents context.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <div
              key={f.title}
              className={`rounded-xl border ${f.border} ${f.bg} p-5 space-y-3`}
            >
              <div className={`inline-flex rounded-lg border ${f.border} p-2`}>
                <f.icon className={`h-5 w-5 ${f.accent}`} />
              </div>
              <h3 className="font-semibold text-zinc-100 text-sm">{f.title}</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">{f.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How to use */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 py-16 border-t border-zinc-800/60">
        <div className="mb-10 text-center">
          <h2 className="text-2xl font-bold sm:text-3xl">Get started in 3 steps</h2>
          <p className="mt-2 text-zinc-400">Zero config. Works with any git repo.</p>
        </div>
        <div className="grid gap-6 sm:grid-cols-3">
          {steps.map((s, i) => (
            <div key={s.step} className="relative flex gap-4">
              <div className="flex flex-col items-center">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-teal-500/30 bg-teal-500/10 text-teal-400 text-sm font-bold">
                  {s.step}
                </div>
                {i < steps.length - 1 && (
                  <div className="mt-2 flex-1 w-px bg-zinc-800 hidden sm:block" />
                )}
              </div>
              <div className="pb-8">
                <div className="flex items-center gap-2 mb-1.5">
                  <s.icon className="h-4 w-4 text-zinc-500" />
                  <h3 className="font-semibold text-zinc-100 text-sm">{s.title}</h3>
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">{s.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 py-16 border-t border-zinc-800/60">
        <div className="rounded-2xl border border-teal-500/20 bg-teal-500/5 p-8 text-center">
          <Image src="/logo.png" alt="FlowSync" width={80} height={80} className="mx-auto mb-4 h-20 w-20" />
          <h2 className="mb-2 text-2xl font-bold">Ready to remember everything?</h2>
          <p className="mb-6 text-zinc-400">
            Install the extension and push a commit. FlowSync captures the rest.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-3">
            <a href={VSIX_DOWNLOAD_URL} download>
              <Button size="lg" className="w-full sm:w-auto bg-teal-500 hover:bg-teal-600 text-white font-semibold">
                <Download className="mr-2 h-4 w-4" />
                Download VS Code Extension
              </Button>
            </a>
            <Button
              size="lg"
              variant="ghost"
              className="w-full sm:w-auto text-zinc-400 hover:text-teal-400"
              onClick={() => { setShowLogin(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            >
              Open Dashboard
              <CheckCircle2 className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-800/60 py-8">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-zinc-600">
          <div className="flex items-center gap-2">
            <Image src="/logo.png" alt="" width={32} height={32} className="h-8 w-8" />
            <span>FlowSync</span>
          </div>
          <span>AI for Bharat Hackathon 2026</span>
          <span>Powered by AWS Bedrock + DynamoDB</span>
        </div>
      </footer>
    </div>
  );
}
