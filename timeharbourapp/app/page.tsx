'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { TimeHarborLogo } from '@/components/ui/TimeHarborLogo';

const stats = [
  { value: '1 tap', label: 'To clock in' },
  { value: 'Live', label: 'Team status' },
  { value: '100%', label: 'TypeScript' },
  { value: 'Offline', label: 'Ready' },
];

const featurePills = [
  'Time Tracking', 'Tickets', 'Activity Log',
  'Projects', 'Calendar', 'Notepad', 'Pulse', 'Dark Mode',
];

const features = [
  {
    title: 'Time Tracking',
    description: 'Clock in and out, track sessions across tickets and projects with precision.',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
  },
  {
    title: 'Tickets',
    description: 'Create and manage work tickets, link them to time sessions and team members.',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M9 11l3 3L22 4" />
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
      </svg>
    ),
  },
  {
    title: 'Activity Log',
    description: 'A full audit trail of everything your team does — searchable and filterable.',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
  },
  {
    title: 'Projects',
    description: 'Organise work into projects. See time spent, progress and team contributions.',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
  {
    title: 'Calendar',
    description: 'Visualise your scheduled work, sessions and deadlines in a calendar view.',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
  },
  {
    title: 'Notepad',
    description: 'Capture notes, stand-up updates and decisions — right alongside your work.',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
      </svg>
    ),
  },
];

export default function Home() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [activeScreen, setActiveScreen] = useState(0);

  useEffect(() => {
    // Use the browser's native navigation type to decide:
    //   'navigate'  → fresh open (new tab, typed URL, opened link) → show landing
    //   'reload'    → page refresh → skip to dashboard
    //   'back_forward' → browser back/forward → skip to dashboard
    const navEntry = performance.getEntriesByType(
      'navigation'
    )[0] as PerformanceNavigationTiming | undefined;
    const navType = navEntry?.type ?? 'navigate';

    if (navType === 'reload' || navType === 'back_forward') {
      router.replace('/dashboard');
    } else {
      setReady(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!ready) return null;

  return (
    <div className="min-h-screen bg-[#080808] text-white overflow-x-hidden" aria-label="TimeHarbor landing page">

      {/* Grid background */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />
      {/* Blue ambient glow */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at 20% 50%, rgba(39,170,225,0.13) 0%, transparent 60%)',
        }}
      />

      {/* ── Navbar ──────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-white/5 bg-[#080808]/90 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <TimeHarborLogo size={30} />
            <span className="font-bold text-lg tracking-tight">TimeHarbor</span>
          </div>
          <button
            onClick={() => router.push('/dashboard')}
            className="inline-flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white font-semibold rounded-full px-5 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            aria-label="Open TimeHarbor app"
          >
            Get started
          </button>
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────────── */}
      <section className="relative flex flex-col items-center justify-center px-6 pt-24 pb-16 text-center">
        {/* Badge pill */}
        <div className="inline-flex items-center gap-2 border border-white/10 bg-white/5 rounded-full px-4 py-1.5 text-sm text-neutral-300 mb-8">
          <span className="w-2 h-2 rounded-full bg-primary-500 animate-pulse" aria-hidden="true" />
          Time Tracking · Tickets · Projects · Activity
        </div>

        <h1 className="text-5xl sm:text-7xl font-black leading-none tracking-tight text-white mb-2">
          Track Time.
        </h1>
        <h1 className="text-5xl sm:text-7xl font-black leading-none tracking-tight text-primary-500 mb-8">
          Harbor Your Work.
        </h1>

        <p className="text-base sm:text-lg text-neutral-400 max-w-xl mb-10 leading-relaxed">
          TimeHarbor keeps your team in sync.{' '}
          <strong className="text-white">Clock in, clock out,</strong> manage{' '}
          <strong className="text-white">projects and tickets</strong>, and stay on top of every
          hour —{' '}
          <strong className="text-white">no spreadsheets required.</strong>
        </p>

        <button
          onClick={() => router.push('/dashboard')}
          className="inline-flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white font-bold rounded-full px-8 py-3.5 text-base transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          aria-label="Get started with TimeHarbor"
        >
          Get Started
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </button>

        {/* Feature pills */}
        <div className="flex flex-wrap justify-center gap-2 mt-10" aria-label="Features">
          {featurePills.map((pill) => (
            <span
              key={pill}
              className="border border-white/10 bg-white/5 rounded-full px-3.5 py-1 text-xs text-neutral-400"
            >
              {pill}
            </span>
          ))}
        </div>
      </section>

      {/* ── Stats bar ───────────────────────────────────────── */}
      <section className="max-w-3xl mx-auto px-6 pb-20" aria-label="Key stats">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-white/5 rounded-2xl overflow-hidden border border-white/5">
          {stats.map((stat) => (
            <div key={stat.label} className="bg-[#0f0f0f] px-6 py-6 text-center">
              <p className="text-2xl font-bold text-white">{stat.value}</p>
              <p className="text-xs text-neutral-500 mt-1">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features grid ───────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 pb-24" aria-labelledby="features-heading">
        <div className="text-center mb-12">
          <h2 id="features-heading" className="text-3xl sm:text-4xl font-bold text-white mb-3">
            Everything your team needs
          </h2>
          <p className="text-neutral-400">
            Time tracking, collaboration, and task management — all in one place.
          </p>
          <div className="w-12 h-0.5 bg-primary-500 mx-auto mt-4" aria-hidden="true" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="bg-[#111111] border border-white/5 rounded-2xl p-6 flex flex-col gap-4 hover:border-primary-500/20 transition-colors"
            >
              <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-white/5 text-white shrink-0">
                {feature.icon}
              </div>
              <div>
                <p className="text-sm font-semibold text-white mb-1.5">{feature.title}</p>
                <p className="text-xs text-neutral-500 leading-relaxed">{feature.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── See It in Action ────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 pb-24" aria-labelledby="screenshots-heading">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 border border-white/10 bg-white/5 rounded-full px-4 py-1.5 text-sm text-neutral-300 mb-5">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-primary-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
            Real screenshots
          </div>
          <h2 id="screenshots-heading" className="text-3xl sm:text-4xl font-bold text-white mb-3">
            See it in action
          </h2>
          <p className="text-neutral-400 max-w-lg mx-auto">
            Every screen, every feature — exactly as it looks inside the app.
          </p>
          <div className="w-12 h-0.5 bg-primary-500 mx-auto mt-4" aria-hidden="true" />
        </div>

        {/* Theme + page tab controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
          {/* Page tabs */}
          <div className="flex items-center gap-1 bg-white/5 border border-white/5 rounded-xl p-1 flex-wrap justify-center" role="tablist" aria-label="App pages">
            {[
              { label: 'Dashboard', idx: 0 },
              { label: 'Tickets', idx: 1 },
              { label: 'Activity', idx: 2 },
              { label: 'Projects', idx: 3 },
              { label: 'Calendar', idx: 4 },
              { label: 'Notepad', idx: 5 },
            ].map((tab) => (
              <button
                key={tab.idx}
                role="tab"
                aria-selected={activeScreen === tab.idx}
                onClick={() => setActiveScreen(tab.idx)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary-500 ${
                  activeScreen === tab.idx
                    ? 'bg-primary-500 text-white'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Dark / Light toggle */}
          <div className="flex items-center gap-1 bg-white/5 border border-white/5 rounded-xl p-1" role="group" aria-label="Color theme">
            <button
              onClick={() => setTheme('dark')}
              aria-pressed={theme === 'dark'}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary-500 ${
                theme === 'dark' ? 'bg-white/10 text-white' : 'text-neutral-500 hover:text-white'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
              Dark
            </button>
            <button
              onClick={() => setTheme('light')}
              aria-pressed={theme === 'light'}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary-500 ${
                theme === 'light' ? 'bg-white/10 text-white' : 'text-neutral-500 hover:text-white'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
              Light
            </button>
          </div>
        </div>

        {/* Screenshot display — browser chrome wrapper */}
        <div className="rounded-2xl overflow-hidden border border-white/10 shadow-2xl shadow-black/60">
          {/* Fake browser bar */}
          <div className="flex items-center gap-2 bg-[#1a1a1a] px-4 py-3 border-b border-white/5">
            <div className="flex gap-1.5" aria-hidden="true">
              <span className="w-3 h-3 rounded-full bg-[#ff5f57]" />
              <span className="w-3 h-3 rounded-full bg-[#febc2e]" />
              <span className="w-3 h-3 rounded-full bg-[#28c840]" />
            </div>
            <div className="flex-1 mx-3">
              <div className="bg-[#2a2a2a] rounded-md px-3 py-1 text-xs text-neutral-500 text-center max-w-xs mx-auto">
                timeharbor.app/dashboard
              </div>
            </div>
          </div>
          {/* Screenshot */}
          {[
            { name: 'dashboard', label: 'Dashboard' },
            { name: 'tickets', label: 'Tickets' },
            { name: 'activity', label: 'Activity' },
            { name: 'projects', label: 'Projects' },
            { name: 'calendar', label: 'Calendar' },
            { name: 'notepad', label: 'Notepad' },
          ].map((screen, idx) => (
            <img
              key={`${theme}-${screen.name}`}
              src={`/screenshots/${theme}-${screen.name}.png`}
              alt={`${screen.label} page in ${theme} mode`}
              width={1280}
              height={800}
              className={`w-full block ${activeScreen === idx ? '' : 'hidden'}`}
              style={{ aspectRatio: '16/10', objectFit: 'cover', objectPosition: 'top' }}
            />
          ))}
        </div>

        {/* Dot indicators */}
        <div className="flex justify-center gap-2 mt-4" aria-label="Page indicators">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <button
              key={i}
              onClick={() => setActiveScreen(i)}
              aria-label={`Go to screen ${i + 1}`}
              className={`w-2 h-2 rounded-full transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary-500 ${
                activeScreen === i ? 'bg-primary-500 w-4' : 'bg-white/20'
              }`}
            />
          ))}
        </div>
      </section>

      {/* ── Timehuddle Integration ───────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 pb-24" aria-labelledby="timehuddle-heading">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 border border-white/10 bg-white/5 rounded-full px-4 py-1.5 text-sm text-neutral-300 mb-5">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-primary-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            Works with Timehuddle
          </div>
          <h2 id="timehuddle-heading" className="text-3xl sm:text-4xl font-bold text-white mb-3">
            Your team lives in{' '}
            <span className="text-primary-500">Timehuddle?</span><br />
            TimeHarbor plugs right in.
          </h2>
          <p className="text-neutral-400 max-w-xl mx-auto">
            Sign into your Timehuddle org from within TimeHarbor. Tickets, team activity, and
            org-level work flow directly into your personal dashboard — no context switching.
          </p>
          <div className="w-12 h-0.5 bg-primary-500 mx-auto mt-4" aria-hidden="true" />
        </div>

        {/* 2-col feature cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">

          {/* Card 1 — Sign in */}
          <div className="bg-[#111111] border border-white/5 rounded-2xl p-7 flex flex-col gap-5 hover:border-primary-500/20 transition-colors">
            <div className="flex items-start gap-4">
              <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-primary-500/10 text-primary-500 shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <p className="text-sm font-semibold text-white">Sign into Timehuddle</p>
                  <span className="text-[10px] font-medium text-primary-500 border border-primary-500/40 rounded-full px-2 py-0.5">Inside TimeHarbor</span>
                </div>
                <p className="text-xs text-neutral-500 leading-relaxed">
                  Connect your Timehuddle account without leaving the app. Your org membership,
                  teams, and permissions carry over instantly.
                </p>
              </div>
            </div>
          </div>

          {/* Card 2 — Tickets sync */}
          <div className="bg-[#111111] border border-white/5 rounded-2xl p-7 flex flex-col gap-5 hover:border-primary-500/20 transition-colors">
            <div className="flex items-start gap-4">
              <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-primary-500/10 text-primary-500 shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <p className="text-sm font-semibold text-white">Tickets sync both ways</p>
                  <span className="text-[10px] font-medium text-primary-500 border border-primary-500/40 rounded-full px-2 py-0.5">Auto-sync</span>
                </div>
                <p className="text-xs text-neutral-500 leading-relaxed">
                  Timehuddle tickets appear in your personal board. Share your own tickets
                  back to the org with one tap — full two-way flow.
                </p>
              </div>
            </div>
          </div>

          {/* Card 3 — Team activity */}
          <div className="bg-[#111111] border border-white/5 rounded-2xl p-7 flex flex-col gap-5 hover:border-primary-500/20 transition-colors">
            <div className="flex items-start gap-4">
              <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-primary-500/10 text-primary-500 shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <p className="text-sm font-semibold text-white">Live team activity</p>
                  <span className="text-[10px] font-medium text-primary-500 border border-primary-500/40 rounded-full px-2 py-0.5">Real-time</span>
                </div>
                <p className="text-xs text-neutral-500 leading-relaxed">
                  See what your Timehuddle teammates are working on, right in your dashboard.
                  Team pulse, stand-ups, and activity all in one feed.
                </p>
              </div>
            </div>
          </div>

          {/* Card 4 — Op logs */}
          <div className="bg-[#111111] border border-white/5 rounded-2xl p-7 flex flex-col gap-5 hover:border-primary-500/20 transition-colors">
            <div className="flex items-start gap-4">
              <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-primary-500/10 text-primary-500 shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <p className="text-sm font-semibold text-white">Org-level op logs</p>
                  <span className="text-[10px] font-medium text-primary-500 border border-primary-500/40 rounded-full px-2 py-0.5">Audit trail</span>
                </div>
                <p className="text-xs text-neutral-500 leading-relaxed">
                  Every Timehuddle ticket change is logged and reviewable. Full audit trail
                  of org operations alongside your personal activity log.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Timehuddle link nudge */}
        <div className="flex items-center justify-center gap-3 border border-white/5 bg-[#0f0f0f] rounded-2xl px-6 py-4">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-neutral-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <p className="text-xs text-neutral-500">
            Don&apos;t have a Timehuddle account?{' '}
            <a
              href="https://timehuddledev.os.mieweb.org"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary-500 hover:underline"
              aria-label="Visit Timehuddle website (opens in new tab)"
            >
              Visit timehuddle.com →
            </a>{' '}
            TimeHarbor works standalone too — no org required.
          </p>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────── */}
      <section className="max-w-4xl mx-auto px-6 pb-24">
        <div
          className="relative rounded-3xl overflow-hidden p-12 text-center"
          style={{
            background: 'linear-gradient(135deg, #0d5f96 0%, #27aae1 60%, #1f88be 100%)',
          }}
        >
          {/* Dot grid overlay */}
          <div
            className="absolute inset-0 pointer-events-none opacity-10"
            style={{
              backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
              backgroundSize: '24px 24px',
            }}
            aria-hidden="true"
          />
          <h2 className="relative text-2xl sm:text-3xl font-bold text-white mb-3">
            Ready to set sail?
          </h2>
          <p className="relative text-white/75 mb-8 max-w-md mx-auto">
            Get your team tracking time, managing tickets, and staying in sync — in minutes.
          </p>
          <button
            onClick={() => router.push('/dashboard')}
            className="relative inline-flex items-center gap-2 bg-white text-[#1f88be] font-bold rounded-full px-8 py-3 text-base hover:bg-white/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            aria-label="Get started with TimeHarbor"
          >
            <TimeHarborLogo size={22} />
            Get Started
          </button>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────── */}
      <footer className="border-t border-white/5 py-8 text-center text-xs text-neutral-600">
        © 2026 TimeHarbor · Built for teams
      </footer>
    </div>
  );
}
