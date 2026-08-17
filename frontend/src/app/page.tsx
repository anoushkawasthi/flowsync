'use client';

import { useState } from 'react';
import {
  LandingNav,
  Hero,
  Features,
  Steps,
  ClosingCTA,
  LandingFooter,
} from '@/components/landing/sections';
import { LoginPanel } from '@/components/landing/LoginPanel';

/**
 * The page was 397 lines with the login form, both data arrays, and every
 * section inlined. It is now an orchestrator: sections live in
 * components/landing/, and login is a modal so it no longer displaces the hero.
 */
export default function LandingPage() {
  const [loginOpen, setLoginOpen] = useState(false);
  const openLogin = () => setLoginOpen(true);

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <LandingNav onOpenLogin={openLogin} />
      <Hero onOpenLogin={openLogin} />
      <Features />
      <Steps />
      <ClosingCTA onOpenLogin={openLogin} />
      <LandingFooter />

      <LoginPanel open={loginOpen} onOpenChange={setLoginOpen} />
    </div>
  );
}
