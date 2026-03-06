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
    icon: Brain,
    title: 'Agent logs reasoning',
    description:
      'Your AI agent calls log_context after every task — recording decisions, risks, and rationale. The WHY behind code is captured automatically.',
    accent: 'text-teal-400',
    bg: 'bg-teal-500/10',
    border: 'border-teal-500/20',
  },
  {
    icon: Bot,
    title: 'Agent searches context',
    description:
      'Before starting work, your agent calls search_context to ask "what did we decide about auth?" and gets a grounded, citation-backed answer.',
    accent: 'text-purple-400',
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/20',
  },
  {
    icon: Cpu,
    title: 'MCP-native integration',
    description:
      'Works with GitHub Copilot, Cursor, Claude, and any MCP-compatible agent. Five built-in tools — zero custom glue code required.',
    accent: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
  },
  {
    icon: GitBranch,
    title: 'Auto-capture fallback',
    description:
      'Not using an AI agent? Every git push still auto-extracts context via Nova Pro. Your project brain grows either way.',
    accent: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
  },
];

const steps = [
  {
    step: '01',
    title: 'Install & initialize',
    description: 'Download the VSIX, install it in VS Code, and click the ⚡ FlowSync status bar button. Initialize your project — you get a Project ID and Token.',
    icon: Download,
  },
  {
    step: '02',
    title: 'Connect your AI agent',
    description: 'Your AI agent now automatically has 5 new tools: log_context to record decisions, search_context to query history, and 3 more.',
    icon: Bot,
  },
  {
    step: '03',
    title: 'Code with memory',
    description: 'Your agent logs WHY after every task and searches context before starting new work. Git pushes are auto-captured as a fallback. Open the dashboard for team visibility.',
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
        <span className="ml-auto text-[10px] text-zinc-500 font-normal">(live data)</span>
      </Button>
      <p className="mt-2 text-center text-[10px] text-zinc-600">
        Real pushes from a live project — not mock data
      </p>
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
              Persistent memory for{' '}
              <span className="text-teal-400">AI coding agents</span>
            </h1>
            <p className="mb-6 text-lg text-zinc-400 leading-relaxed">
              Your AI agent logs decisions after every task and searches
              project history before starting new work — via MCP tools.
              Git push auto-capture is the built-in fallback.
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
                  <div className="text-zinc-500"># AI agent finishes implementing auth</div>
                  <div className="text-zinc-300">
                    <span className="text-teal-400">mcp</span> log_context
                  </div>
                  <div className="mt-2 rounded-lg border border-zinc-700 bg-zinc-950 p-3 text-xs space-y-1.5">
                    <div><span className="text-zinc-500">Decision:</span> <span className="text-teal-300">Use RS256 for cross-service token validation</span></div>
                    <div><span className="text-zinc-500">Risk:</span> <span className="text-amber-300">Token expiry not handled on mobile clients</span></div>
                    <div><span className="text-zinc-500">Task:</span> <span className="text-zinc-200">Add refresh token rotation</span></div>
                  </div>
                  <div className="text-zinc-500 text-xs mt-3"># Next day — agent starts new task</div>
                  <div className="text-zinc-300">
                    <span className="text-teal-400">mcp</span> search_context "what did we decide about auth?"
                  </div>
                  <div className="text-zinc-300 text-xs mt-1">↳ RS256 for cross-service validation (logged 1d ago, 2 sources)</div>
                  <div className="text-zinc-600 text-[10px] mt-3"># git pushes also auto-captured as fallback</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 py-16 border-t border-zinc-800/60">
        <div className="mb-10 text-center">
          <h2 className="text-2xl font-bold sm:text-3xl">How it works</h2>
          <p className="mt-2 text-zinc-400">Your AI agent gets persistent project memory through four capabilities.</p>
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
          <h2 className="text-2xl font-bold sm:text-3xl">Up and running in 3 steps</h2>
          <p className="mt-2 text-zinc-400">Works with any git repo. Your AI agent gets memory in minutes.</p>
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
          <h2 className="mb-2 text-2xl font-bold">Give your AI agent a memory</h2>
          <p className="mb-6 text-zinc-400">
            Install the extension, connect your MCP agent, and every decision is captured — automatically.
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
