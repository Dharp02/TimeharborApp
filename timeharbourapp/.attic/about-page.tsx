import { redirect } from 'next/navigation';

export default function AboutPage() {
  redirect('https://timeharborwebsite.os.mieweb.org/');
}

// ── Dead code below — kept for reference, page now redirects to external site ──

import Link from 'next/link';
import {
  Clock,
  ShieldCheck,
  Wifi,
  Smartphone,
  Users,
  Ticket,
  FolderOpen,
  CalendarDays,
  ExternalLink,
  Github,
  ArrowLeft,
  Play,
  Globe,
  Lock,
  RefreshCw,
  Bell,
} from 'lucide-react';

// ── Feature cards data ───────────────────────────────────────

const FEATURES = [
  {
    icon: <Clock className="w-5 h-5" />,
    title: 'Precise Time Tracking',
    description:
      'Clock in and out with ticket-based segments, break tracking, and per-session summaries. Every minute accounted for.',
  },
  {
    icon: <Wifi className="w-5 h-5" />,
    title: 'Offline-First',
    description:
      'Works without internet. All data is stored locally on your device. Changes sync automatically when you reconnect.',
  },
  {
    icon: <ShieldCheck className="w-5 h-5" />,
    title: 'End-to-End Encrypted',
    description:
      'Your data is encrypted with AES-256-GCM before it ever leaves your device. The server only stores opaque blobs — it can never read your data.',
  },
  {
    icon: <Smartphone className="w-5 h-5" />,
    title: 'Native Mobile Apps',
    description:
      'Available on iOS and Android via Capacitor. Supports biometric app lock, push notifications, and a fully responsive mobile layout.',
  },
  {
    icon: <Ticket className="w-5 h-5" />,
    title: 'Ticket Management',
    description:
      'Create, prioritise, and track tickets. Link them to time sessions for accurate billing and reporting.',
  },
  {
    icon: <FolderOpen className="w-5 h-5" />,
    title: 'Projects',
    description:
      'Organise tickets into projects. View rolled-up time totals per project and drill down into individual tickets.',
  },
  {
    icon: <Users className="w-5 h-5" />,
    title: 'Multi-Profile',
    description:
      'Up to 5 named profiles per device. Switch instantly — each profile has its own data, encryption key, and settings.',
  },
  {
    icon: <CalendarDays className="w-5 h-5" />,
    title: 'Timesheet & Reports',
    description:
      'Browse your calendar, view daily summaries, and export time reports broken down by ticket or project.',
  },
  {
    icon: <RefreshCw className="w-5 h-5" />,
    title: 'Cross-Device Sync',
    description:
      'Encrypted op-log sync keeps all your devices in perfect agreement using per-field last-writer-wins conflict resolution.',
  },
  {
    icon: <Bell className="w-5 h-5" />,
    title: 'Push Notifications',
    description:
      'Stay informed with real-time push notifications on Android (FCM) and iOS (APNs) for team activity and reminders.',
  },
  {
    icon: <Lock className="w-5 h-5" />,
    title: 'Timehuddle Integration',
    description:
      'Connect with Timehuddle to share tickets with your team, review changes before they are pushed, and collaborate on time entries.',
  },
  {
    icon: <Globe className="w-5 h-5" />,
    title: 'Open Source',
    description:
      'Built in the open on GitHub. Contributions, issues, and discussions are all welcome. Hosted live for free to try.',
  },
];

const TECH_STACK = [
  { label: 'Frontend', value: 'Next.js 16, React 19, TypeScript, Tailwind CSS 4' },
  { label: 'Mobile', value: 'Capacitor 8 — iOS & Android' },
  { label: 'Offline Storage', value: 'Dexie.js (IndexedDB)' },
  { label: 'Encryption', value: 'AES-256-GCM via Web Crypto API' },
  { label: 'Backend', value: 'Fastify 5, MongoDB, Better Auth' },
  { label: 'Testing', value: 'Playwright — Chromium, WebKit, Mobile Chrome' },
];

// ── Page ─────────────────────────────────────────────────────

export default function AboutPage() {
  return (
    <div className="space-y-10 px-4 py-6">

      {/* Back link */}
      <Link
        href="/dashboard/help"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Back to Help & Support"
      >
        <ArrowLeft className="w-4 h-4" />
        Help &amp; Support
      </Link>

      {/* Hero */}
      <div className="px-2 py-4 text-center space-y-3">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
          <Clock className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">TimeHarbor</h1>
        <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
          An offline-first, end-to-end encrypted time tracking and team management platform —
          built for developers and professionals who take ownership of their data.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-muted px-4 py-2 text-sm font-medium text-muted-foreground cursor-not-allowed" aria-label="Live demo coming soon">
            <Globe className="w-4 h-4" />
            Coming Soon
          </span>
          <a
            href="https://youtube.com/shorts/MfPd4NsjLQQ?feature=share"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
            aria-label="Watch the app demo on YouTube"
          >
            <Play className="w-4 h-4" />
            Watch Demo
          </a>
          <a
            href="https://github.com/Dharp02/TimeharborApp"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
            aria-label="View source on GitHub"
          >
            <Github className="w-4 h-4" />
            GitHub
          </a>
        </div>
      </div>

      {/* What is TimeHarbor */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">What is TimeHarbor?</h2>
        <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
          <p>
            TimeHarbor is a comprehensive time tracking application designed to work seamlessly
            whether you are online, offline, or switching between devices. It gives you full
            control over your work hours — down to the individual ticket and project.
          </p>
          <p>
            Unlike cloud-dependent tools, TimeHarbor stores all your data locally first using
            IndexedDB, then syncs it to the server using an encrypted op-log system. The server
            only ever stores encrypted blobs — your data belongs to you.
          </p>
          <p>
            Built as an open-source project by{' '}
            <a
              href="https://github.com/Dharp02"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline underline-offset-2"
              aria-label="Poonam Dharamkar on GitHub"
            >
              Poonam Dharamkar
            </a>{' '}
            and hosted via{' '}
            <a
              href="https://opensource.mieweb.org"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline underline-offset-2"
              aria-label="MIEWeb open source"
            >
              MIEWeb Open Source
            </a>
            .
          </p>
        </div>
      </section>

      {/* Features grid */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Key Features</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="px-0 py-2 space-y-1.5"
            >
              <div className="flex items-center gap-2 text-primary">
                {f.icon}
                <span className="text-sm font-semibold text-foreground">{f.title}</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{f.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Tech stack */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Technology Stack</h2>
        <div className="divide-y divide-border">
          {TECH_STACK.map((row) => (
            <div key={row.label} className="flex items-start gap-4 px-5 py-3">
              <span className="text-xs font-medium text-muted-foreground w-28 shrink-0 pt-0.5">
                {row.label}
              </span>
              <span className="text-sm text-foreground">{row.value}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Version & links */}
      <section className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2">
        <div>
          <p className="text-sm font-medium text-foreground">Version 0.1</p>
          <p className="text-xs text-muted-foreground mt-0.5">Open source · MIT licensed</p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium text-muted-foreground cursor-not-allowed" aria-label="Live demo coming soon">
            <Globe className="w-3 h-3" />
            Coming Soon
          </span>
          <a
            href="https://github.com/Dharp02/TimeharborApp"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium text-foreground hover:bg-muted transition-colors"
            aria-label="View source on GitHub"
          >
            <Github className="w-3 h-3" />
            Source Code
          </a>
          <a
            href="https://github.com/Dharp02/TimeharborApp/discussions/49"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium text-foreground hover:bg-muted transition-colors"
            aria-label="Send feedback"
          >
            <ExternalLink className="w-3 h-3" />
            Feedback
          </a>
        </div>
      </section>
    </div>
  );
}
