'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { TimeHarborLogo } from '@/components/ui/TimeHarborLogo';
import {
  motion,
  AnimatePresence,
  useScroll,
  useTransform,
  useSpring,
  useMotionValue,
  useMotionTemplate,
} from 'motion/react';

// ── Prefers-reduced-motion ────────────────────────────────────
function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const listener = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', listener);
    return () => mq.removeEventListener('change', listener);
  }, []);
  return reduced;
}

// ── Stagger variants ──────────────────────────────────────────
const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};
const cardItem = {
  hidden: { opacity: 0, y: 40, scale: 0.96 },
  visible: {
    opacity: 1, y: 0, scale: 1,
    transition: { duration: 0.5, ease: [0.25, 0.1, 0.25, 1] as const },
  },
};
const pillItem = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.3 } },
};

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

const screenTabs = [
  { label: 'Dashboard', name: 'dashboard', idx: 0 },
  { label: 'Tickets', name: 'tickets', idx: 1 },
  { label: 'Activity', name: 'activity', idx: 2 },
  { label: 'Projects', name: 'projects', idx: 3 },
  { label: 'Calendar', name: 'calendar', idx: 4 },
  { label: 'Notepad', name: 'notepad', idx: 5 },
];

export default function Home() {
  const router = useRouter();
  const reduced = useReducedMotion();
  const [ready, setReady] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [activeScreen, setActiveScreen] = useState(0);
  const [scrolled, setScrolled] = useState(false);

  // ── Scroll-driven values ──────────────────────────────────
  const { scrollY, scrollYProgress } = useScroll();
  const smoothScrollY = useSpring(scrollY, { stiffness: 60, damping: 20 });
  const springProgress = useSpring(scrollYProgress, { stiffness: 100, damping: 30 });

  // Parallax offsets for orbs
  const orb1Y = useTransform(smoothScrollY, [0, 1000], [0, -200]);
  const orb2Y = useTransform(smoothScrollY, [0, 1000], [0, -120]);

  // Mouse-tracking glow
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const mouseGlow = useMotionTemplate`radial-gradient(600px circle at ${mouseX}px ${mouseY}px, rgba(39,170,225,0.12), transparent 60%)`;

  useEffect(() => {
    return scrollY.on('change', (v) => setScrolled(v > 20));
  }, [scrollY]);

  useEffect(() => {
    const navEntry = performance.getEntriesByType(
      'navigation'
    )[0] as PerformanceNavigationTiming | undefined;
    const navType = navEntry?.type ?? 'navigate';

    if (navType === 'reload') {
      router.replace('/dashboard');
    } else {
      setReady(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!ready) return null;

  return (
    <div className="min-h-screen bg-[#080808] text-white overflow-x-hidden" aria-label="TimeHarbor landing page">

      {/* Scroll progress bar */}
      {!reduced && (
        <motion.div
          className="fixed top-0 left-0 right-0 h-0.5 bg-primary-500 origin-left z-100"
          style={{ scaleX: springProgress }}
          aria-hidden="true"
        />
      )}

      {/* Grid background */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      {/* Parallax ambient orbs */}
      <motion.div
        className="fixed pointer-events-none"
        style={{
          y: reduced ? 0 : orb1Y,
          top: '5%',
          left: '-5%',
          width: '55vw',
          height: '55vw',
          background: 'radial-gradient(ellipse, rgba(39,170,225,0.11) 0%, transparent 60%)',
        }}
        aria-hidden="true"
      />
      <motion.div
        className="fixed pointer-events-none"
        style={{
          y: reduced ? 0 : orb2Y,
          top: '55%',
          right: '-10%',
          width: '40vw',
          height: '40vw',
          background: 'radial-gradient(ellipse, rgba(39,170,225,0.07) 0%, transparent 60%)',
        }}
        aria-hidden="true"
      />

      {/* ── Navbar ──────────────────────────────────────────── */}
      <header
        className={`sticky top-0 z-50 transition-all duration-300 ${
          scrolled
            ? 'border-b border-white/10 bg-[#080808]/95 backdrop-blur-md'
            : 'border-b border-transparent bg-transparent'
        }`}
      >
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <motion.div
            className="flex items-center gap-2.5"
            initial={reduced ? false : { opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
          >
            <TimeHarborLogo size={30} />
            <span className="font-bold text-lg tracking-tight">TimeHarbor</span>
          </motion.div>
          <motion.div
            className="flex items-center gap-3"
            initial={reduced ? false : { opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
          >
            <a
              href="https://github.com/Dharp02/TimeharborApp"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-neutral-400 hover:text-white transition-colors text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded-md"
              aria-label="View TimeHarbor on GitHub (opens in new tab)"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.295 24 12c0-6.63-5.37-12-12-12"/></svg>
              <span className="hidden sm:inline">GitHub</span>
            </a>
            <button
              onClick={() => router.push('/dashboard')}
              className="inline-flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white font-semibold rounded-full px-5 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
              aria-label="Open TimeHarbor app"
            >
              Get started
            </button>
          </motion.div>
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────────── */}
      <section
        className="relative flex flex-col items-center justify-center px-6 pt-24 pb-16 text-center"
        onMouseMove={reduced ? undefined : (e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          mouseX.set(e.clientX - rect.left);
          mouseY.set(e.clientY - rect.top);
        }}
      >
        {/* Mouse-tracking radial glow */}
        {!reduced && (
          <motion.div
            className="absolute inset-0 pointer-events-none"
            style={{ background: mouseGlow }}
            aria-hidden="true"
          />
        )}

        {/* Badge pill */}
        <motion.div
          className="inline-flex items-center gap-2 border border-white/10 bg-white/5 rounded-full px-4 py-1.5 text-sm text-neutral-300 mb-8"
          initial={reduced ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
        >
          <span className="w-2 h-2 rounded-full bg-primary-500 animate-pulse" aria-hidden="true" />
          Time Tracking · Tickets · Projects · Activity
        </motion.div>

        {/* Headline line 1 — word-by-word stagger */}
        <div className="mb-2">
          {['Track', 'Time.'].map((word, i) => (
            <motion.span
              key={word}
              className="text-5xl sm:text-7xl font-black leading-none tracking-tight text-white inline-block mr-4"
              initial={reduced ? false : { opacity: 0, y: 30, rotateX: -30 }}
              animate={{ opacity: 1, y: 0, rotateX: 0 }}
              transition={{ duration: 0.6, delay: 0.1 + i * 0.1, ease: [0.25, 0.1, 0.25, 1] }}
              style={{ perspective: 1000, display: 'inline-block' }}
            >
              {word}
            </motion.span>
          ))}
        </div>

        {/* Headline line 2 — staggered blue words */}
        <div className="mb-8">
          {['Harbor', 'Your', 'Work.'].map((word, i) => (
            <motion.span
              key={word}
              className="text-5xl sm:text-7xl font-black leading-none tracking-tight text-primary-500 inline-block mr-4"
              initial={reduced ? false : { opacity: 0, y: 30, rotateX: -30 }}
              animate={{ opacity: 1, y: 0, rotateX: 0 }}
              transition={{ duration: 0.6, delay: 0.3 + i * 0.1, ease: [0.25, 0.1, 0.25, 1] }}
              style={{ perspective: 1000, display: 'inline-block' }}
            >
              {word}
            </motion.span>
          ))}
        </div>

        {/* Subtitle */}
        <motion.p
          className="text-base sm:text-lg text-neutral-400 max-w-xl mb-10 leading-relaxed"
          initial={reduced ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
        >
          TimeHarbor keeps your team in sync.{' '}
          <strong className="text-white">Clock in, clock out,</strong> manage{' '}
          <strong className="text-white">projects and tickets</strong>, and stay on top of every
          hour —{' '}
          <strong className="text-white">no spreadsheets required.</strong>
        </motion.p>

        {/* CTA button with shimmer sweep */}
        <motion.div
          initial={reduced ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.7, ease: [0.25, 0.1, 0.25, 1] }}
        >
          <button
            onClick={() => router.push('/dashboard')}
            className="relative inline-flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white font-bold rounded-full px-8 py-3.5 text-base transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 overflow-hidden"
            aria-label="Get started with TimeHarbor"
          >
            {!reduced && (
              <motion.span
                className="absolute inset-0 pointer-events-none"
                style={{
                  background:
                    'linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.25) 50%, transparent 70%)',
                }}
                animate={{ x: ['-100%', '200%'] }}
                transition={{ duration: 2, repeat: Infinity, repeatDelay: 1.5, ease: 'linear' }}
                aria-hidden="true"
              />
            )}
            Get Started
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </button>
        </motion.div>

        {/* Feature pills — staggered scale-in */}
        <motion.div
          className="flex flex-wrap justify-center gap-2 mt-10"
          aria-label="Features"
          initial={reduced ? false : 'hidden'}
          animate="visible"
          variants={reduced ? {} : { hidden: {}, visible: { transition: { staggerChildren: 0.06, delayChildren: 0.85 } } }}
        >
          {featurePills.map((pill) => (
            <motion.span
              key={pill}
              className="border border-white/10 bg-white/5 rounded-full px-3.5 py-1 text-xs text-neutral-400"
              variants={reduced ? {} : pillItem}
            >
              {pill}
            </motion.span>
          ))}
        </motion.div>
      </section>

      {/* ── Stats bar ───────────────────────────────────────── */}
      <section className="max-w-3xl mx-auto px-6 pb-20" aria-label="Key stats">
        <motion.div
          className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-white/5 rounded-2xl overflow-hidden border border-white/5"
          initial={reduced ? false : 'hidden'}
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          variants={reduced ? {} : { hidden: {}, visible: { transition: { staggerChildren: 0.1 } } }}
        >
          {stats.map((stat) => (
            <motion.div
              key={stat.label}
              className="bg-[#0f0f0f] px-6 py-6 text-center"
              variants={reduced ? {} : { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5 } } }}
            >
              <p className="text-2xl font-bold text-white">{stat.value}</p>
              <p className="text-xs text-neutral-500 mt-1">{stat.label}</p>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ── Features grid ───────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 pb-24" aria-labelledby="features-heading">
        <motion.div
          className="text-center mb-12"
          initial={reduced ? false : { opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6 }}
        >
          <h2 id="features-heading" className="text-3xl sm:text-4xl font-bold text-white mb-3">
            Everything your team needs
          </h2>
          <p className="text-neutral-400">
            Time tracking, collaboration, and task management — all in one place.
          </p>
          <motion.div
            className="w-12 h-0.5 bg-primary-500 mx-auto mt-4 origin-left"
            initial={reduced ? false : { scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.5, delay: 0.2 }}
            aria-hidden="true"
          />
        </motion.div>

        <motion.div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
          initial={reduced ? false : 'hidden'}
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          variants={reduced ? {} : staggerContainer}
        >
          {features.map((feature) => (
            <motion.div
              key={feature.title}
              className="bg-[#111111] border border-white/5 rounded-2xl p-6 flex flex-col gap-4 hover:border-primary-500/20 transition-colors"
              variants={reduced ? {} : cardItem}
              whileHover={reduced ? {} : { y: -4, scale: 1.015 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            >
              <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-white/5 text-white shrink-0">
                {feature.icon}
              </div>
              <div>
                <p className="text-sm font-semibold text-white mb-1.5">{feature.title}</p>
                <p className="text-xs text-neutral-500 leading-relaxed">{feature.description}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ── See It in Action ────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 pb-24" aria-labelledby="screenshots-heading">
        <motion.div
          className="text-center mb-10"
          initial={reduced ? false : { opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6 }}
        >
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
          <motion.div
            className="w-12 h-0.5 bg-primary-500 mx-auto mt-4 origin-left"
            initial={reduced ? false : { scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.5, delay: 0.2 }}
            aria-hidden="true"
          />
        </motion.div>

        {/* Theme + page tab controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
          {/* Page tabs */}
          <div className="flex items-center gap-1 bg-white/5 border border-white/5 rounded-xl p-1 flex-wrap justify-center" role="tablist" aria-label="App pages">
            {screenTabs.map((tab) => (
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
        <motion.div
          className="rounded-2xl overflow-hidden border border-white/10 shadow-2xl shadow-black/60"
          initial={reduced ? false : { opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.7 }}
        >
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
          {/* AnimatePresence cross-fade on tab / theme change */}
          <div className="relative overflow-hidden" style={{ aspectRatio: '16/10' }}>
            <AnimatePresence mode="wait">
              <motion.img
                key={`${theme}-${screenTabs[activeScreen].name}`}
                src={`/screenshots/${theme}-${screenTabs[activeScreen].name}.png`}
                alt={`${screenTabs[activeScreen].label} page in ${theme} mode`}
                width={1280}
                height={800}
                className="w-full block absolute inset-0"
                style={{ objectFit: 'cover', objectPosition: 'top' }}
                initial={reduced ? false : { opacity: 0, scale: 1.02 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={reduced ? {} : { opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.3 }}
              />
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Dot indicators */}
        <div className="flex justify-center gap-2 mt-4" aria-label="Page indicators">
          {screenTabs.map((tab) => (
            <button
              key={tab.idx}
              onClick={() => setActiveScreen(tab.idx)}
              aria-label={`Go to ${tab.label} screen`}
              className={`h-2 rounded-full transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary-500 ${
                activeScreen === tab.idx ? 'bg-primary-500 w-4' : 'bg-white/20 w-2'
              }`}
            />
          ))}
        </div>
      </section>

      {/* ── Timehuddle Integration ───────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 pb-24" aria-labelledby="timehuddle-heading">
        {/* Header */}
        <motion.div
          className="text-center mb-10"
          initial={reduced ? false : { opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6 }}
        >
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
          <motion.div
            className="w-12 h-0.5 bg-primary-500 mx-auto mt-4 origin-left"
            initial={reduced ? false : { scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.5, delay: 0.2 }}
            aria-hidden="true"
          />
        </motion.div>

        {/* 2-col feature cards */}
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6"
          initial={reduced ? false : 'hidden'}
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          variants={reduced ? {} : staggerContainer}
        >
          {/* Card 1 — Sign in */}
          <motion.div
            className="bg-[#111111] border border-white/5 rounded-2xl p-7 flex flex-col gap-5 hover:border-primary-500/20 transition-colors"
            variants={reduced ? {} : cardItem}
            whileHover={reduced ? {} : { y: -3, scale: 1.01 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          >
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
          </motion.div>

          {/* Card 2 — Tickets sync */}
          <motion.div
            className="bg-[#111111] border border-white/5 rounded-2xl p-7 flex flex-col gap-5 hover:border-primary-500/20 transition-colors"
            variants={reduced ? {} : cardItem}
            whileHover={reduced ? {} : { y: -3, scale: 1.01 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          >
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
          </motion.div>

          {/* Card 3 — Team activity */}
          <motion.div
            className="bg-[#111111] border border-white/5 rounded-2xl p-7 flex flex-col gap-5 hover:border-primary-500/20 transition-colors"
            variants={reduced ? {} : cardItem}
            whileHover={reduced ? {} : { y: -3, scale: 1.01 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          >
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
          </motion.div>

          {/* Card 4 — Op logs */}
          <motion.div
            className="bg-[#111111] border border-white/5 rounded-2xl p-7 flex flex-col gap-5 hover:border-primary-500/20 transition-colors"
            variants={reduced ? {} : cardItem}
            whileHover={reduced ? {} : { y: -3, scale: 1.01 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          >
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
          </motion.div>
        </motion.div>

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
        <motion.div
          className="relative rounded-3xl overflow-hidden p-12 text-center"
          style={{ background: 'linear-gradient(135deg, #0d5f96 0%, #27aae1 60%, #1f88be 100%)' }}
          initial={reduced ? false : { opacity: 0, y: 30, scale: 0.97 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.7 }}
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
          {/* Rotating decorative circles */}
          {!reduced && (
            <>
              <motion.div
                className="absolute -top-20 -right-20 w-64 h-64 rounded-full border-2 border-white/10 pointer-events-none"
                animate={{ rotate: 360 }}
                transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
                aria-hidden="true"
              />
              <motion.div
                className="absolute -bottom-16 -left-16 w-48 h-48 rounded-full border border-white/10 pointer-events-none"
                animate={{ rotate: -360 }}
                transition={{ duration: 25, repeat: Infinity, ease: 'linear' }}
                aria-hidden="true"
              />
            </>
          )}
          <motion.h2
            className="relative text-2xl sm:text-3xl font-bold text-white mb-3"
            initial={reduced ? false : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            Ready to set sail?
          </motion.h2>
          <motion.p
            className="relative text-white/75 mb-8 max-w-md mx-auto"
            initial={reduced ? false : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            Get your team tracking time, managing tickets, and staying in sync — in minutes.
          </motion.p>
          <motion.div
            initial={reduced ? false : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <button
              onClick={() => router.push('/dashboard')}
              className="relative inline-flex items-center gap-2 bg-white text-[#1f88be] font-bold rounded-full px-8 py-3 text-base hover:bg-white/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white overflow-hidden"
              aria-label="Get started with TimeHarbor"
            >
              {!reduced && (
                <motion.span
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background:
                      'linear-gradient(105deg, transparent 30%, rgba(39,170,225,0.2) 50%, transparent 70%)',
                  }}
                  animate={{ x: ['-100%', '200%'] }}
                  transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 2, ease: 'linear' }}
                  aria-hidden="true"
                />
              )}
              <TimeHarborLogo size={22} />
              Get Started
            </button>
          </motion.div>
        </motion.div>
      </section>

      {/* ── Footer ──────────────────────────────────────────── */}
      <footer className="border-t border-white/5 py-8 text-center text-xs text-neutral-600">
        <span>© 2026 TimeHarbor · Built for teams</span>
        <span className="mx-2 text-neutral-700">·</span>
        <motion.a
          href="https://github.com/Dharp02/TimeharborApp"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-neutral-600 hover:text-neutral-400 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary-500 rounded"
          whileHover={reduced ? {} : { y: -2 }}
          transition={{ type: 'spring', stiffness: 400, damping: 15 }}
          aria-label="View TimeHarbor source on GitHub (opens in new tab)"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.295 24 12c0-6.63-5.37-12-12-12"/></svg>
          GitHub
        </motion.a>
      </footer>
    </div>
  );
}
