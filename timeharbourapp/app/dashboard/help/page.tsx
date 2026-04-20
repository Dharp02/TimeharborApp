'use client';

import { useState, useMemo } from 'react';
import {
  Search,
  ChevronDown,
  ChevronUp,
  Clock,
  Ticket,
  FolderOpen,
  CalendarDays,
  RefreshCw,
  Settings,
  HelpCircle,
} from 'lucide-react';
import { Input } from '@mieweb/ui';

// ── FAQ data ─────────────────────────────────────────────────

interface FaqItem {
  question: string;
  answer: string;
}

interface FaqCategory {
  label: string;
  icon: React.ReactNode;
  items: FaqItem[];
}

const FAQ_CATEGORIES: FaqCategory[] = [
  {
    label: 'Clock In & Clock Out',
    icon: <Clock className="w-5 h-5" />,
    items: [
      {
        question: 'How do I clock in?',
        answer:
          'Tap the Clock In button at the bottom of the screen (the large circular button in the center of the bottom nav). This starts a new work session and begins tracking your time. You can optionally select a ticket to track against before clocking in.',
      },
      {
        question: 'How do I clock out?',
        answer:
          'While clocked in, tap the same central button — it will now show "Clock Out". Confirm the action to end your session. Your total session time, ticket breakdown, and any notes will be saved automatically.',
      },
      {
        question: 'Can I add a note or link when clocking out?',
        answer:
          'Yes. When you tap Clock Out you will see fields to add an optional comment, links, and attachments before confirming. These are saved with the session record.',
      },
      {
        question: 'How do I track time against a specific ticket?',
        answer:
          'Open the Tickets tab and tap the timer icon next to any ticket. This starts (or switches) the active ticket segment within your current session. You can switch between tickets as many times as needed within a single session.',
      },
      {
        question: 'How does auto clock-out work?',
        answer:
          'If you leave a session running past midnight, TimeHarbor will automatically close it at the end of the day and create a new session for the next day. This keeps your timesheet accurate without manual intervention.',
      },
    ],
  },
  {
    label: 'Tickets',
    icon: <Ticket className="w-5 h-5" />,
    items: [
      {
        question: 'How do I create a ticket?',
        answer:
          'Go to the Tickets tab in the bottom navigation. Tap the "+" or "New Ticket" button. Fill in the title, description, priority, and status. Tap Save to create it. The ticket will appear in your list immediately — even offline.',
      },
      {
        question: 'How do I edit a ticket?',
        answer:
          'In the Tickets list, tap the three-dot (⋯) menu on any ticket and select Edit. Make your changes and tap Save. Updates sync to the server automatically when you are online.',
      },
      {
        question: 'How do I delete a ticket?',
        answer:
          'Tap the three-dot (⋯) menu on a ticket and select Delete. You will be asked to confirm. Deleted tickets are removed from your device and the change syncs to all your other devices.',
      },
      {
        question: 'What is the difference between personal and Timehuddle tickets?',
        answer:
          'Personal tickets are created and managed entirely within TimeHarbor — only you see them. Timehuddle tickets are shared with your team via the Timehuddle integration. Changes to Timehuddle tickets appear in the Sync Queue for manual approval before being pushed to the team.',
      },
      {
        question: 'How do I filter or search tickets?',
        answer:
          'Use the search bar at the top of the Tickets page to filter by title. You can also filter by status (Open, In Progress, Done, Closed) using the filter chips below the search bar.',
      },
    ],
  },
  {
    label: 'Projects',
    icon: <FolderOpen className="w-5 h-5" />,
    items: [
      {
        question: 'How do I create a project?',
        answer:
          'Go to the Projects tab from the sidebar or bottom navigation. Tap "New Project", enter a name and optional description, then tap Save. Projects help you group related tickets together.',
      },
      {
        question: 'How do I add tickets to a project?',
        answer:
          'There are two ways: (1) When creating or editing a ticket, select a project from the Project dropdown. (2) In the Projects page, open a project and use the "Add Ticket" button to assign existing tickets to it.',
      },
      {
        question: 'How do I view all tickets inside a project?',
        answer:
          'Open the Projects page and tap on any project card to expand it. You will see all tickets assigned to that project along with their status and tracked time.',
      },
      {
        question: 'Can I track time directly from a project?',
        answer:
          'Yes. Inside a project, tap the timer icon next to any ticket to start tracking time against it. Your active session will automatically link the time to that ticket.',
      },
    ],
  },
  {
    label: 'Timesheet & Reports',
    icon: <CalendarDays className="w-5 h-5" />,
    items: [
      {
        question: 'How do I view my timesheet?',
        answer:
          'Tap Timesheet in the bottom navigation or sidebar. You will see a calendar view of your sessions. Tap any day to see the detailed session breakdown including ticket time, breaks, and notes.',
      },
      {
        question: 'Can I view time by project or ticket?',
        answer:
          'Yes. In the Timesheet, use the date range picker to select a period. The summary below will show total time broken down by ticket. The Reports section (sidebar → Analytics → Reports) gives deeper project-level breakdowns.',
      },
      {
        question: 'How do I export my timesheet?',
        answer:
          'On the Timesheet page, tap the export/share icon in the top right. You can share a summary or copy the data. Full CSV export is available from the Reports page.',
      },
    ],
  },
  {
    label: 'Offline & Sync',
    icon: <RefreshCw className="w-5 h-5" />,
    items: [
      {
        question: 'Does TimeHarbor work offline?',
        answer:
          'Yes. All data is stored locally on your device using an offline-first database. You can clock in, create tickets, take notes, and do everything without an internet connection. Changes sync automatically when you are back online.',
      },
      {
        question: 'What is the Sync Queue?',
        answer:
          'The Sync Queue (Sidebar → General → Op Logs) shows all pending changes waiting to be synced to the server. Items appear here while offline and move to the Synced section once they have been successfully uploaded.',
      },
      {
        question: 'Why are some changes in Pending for a long time?',
        answer:
          'Pending items sync automatically when your device is online. If items stay pending, check your internet connection. Timehuddle ticket changes also require manual approval — select them in the Sync Queue and tap Sync.',
      },
      {
        question: 'Are my changes encrypted?',
        answer:
          'Yes. All data synced to the server is encrypted end-to-end using AES-256-GCM encryption. The server only stores encrypted blobs — it can never read your data. Your encryption passphrase never leaves your device.',
      },
      {
        question: 'What is the recovery key for?',
        answer:
          'The recovery key lets you restore access to your encrypted data on a new device if you lose your passphrase. Save it in a secure place (password manager, printed copy). You can view or regenerate it in Settings → Encryption.',
      },
    ],
  },
  {
    label: 'Settings & Profile',
    icon: <Settings className="w-5 h-5" />,
    items: [
      {
        question: 'How do I change my display name or avatar?',
        answer:
          'Go to Settings (sidebar → General → Settings) and tap your profile card at the top. You can edit your display name, upload a profile photo, and update your email from there.',
      },
      {
        question: 'How do I switch between profiles?',
        answer:
          'Tap your avatar in the top-right corner of the header. If you have multiple profiles set up, they will appear in the dropdown. Tap any profile to switch. Each profile has its own independent data and encryption key.',
      },
      {
        question: 'How do I change the app theme?',
        answer:
          'In Settings, toggle the Dark Mode switch to switch between light and dark themes. Your preference is saved per device.',
      },
      {
        question: 'How do I enable App Lock (biometrics)?',
        answer:
          'Go to Settings and look for the App Lock toggle. When enabled, the app will require Face ID, Touch ID, or your device PIN to unlock after it goes to the background. This protects your time data from unauthorised access.',
      },
    ],
  },
];

// ── Components ───────────────────────────────────────────────

function FaqItemRow({ item }: { item: FaqItem }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-border last:border-0">
      <button
        className="flex w-full items-center justify-between gap-4 py-4 text-left transition-colors hover:text-primary"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="text-sm font-medium text-foreground">{item.question}</span>
        {open
          ? <ChevronUp className="w-4 h-4 shrink-0 text-muted-foreground" />
          : <ChevronDown className="w-4 h-4 shrink-0 text-muted-foreground" />}
      </button>
      {open && (
        <p className="pb-4 text-sm leading-relaxed text-muted-foreground">
          {item.answer}
        </p>
      )}
    </div>
  );
}

function FaqCategorySection({
  category,
  defaultOpen,
}: {
  category: FaqCategory;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        className="flex w-full items-center gap-3 px-5 py-4 text-left hover:bg-muted/30 transition-colors"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="text-primary">{category.icon}</span>
        <span className="flex-1 text-base font-semibold text-foreground">{category.label}</span>
        <span className="text-xs text-muted-foreground mr-2">{category.items.length} topics</span>
        {open
          ? <ChevronUp className="w-4 h-4 shrink-0 text-muted-foreground" />
          : <ChevronDown className="w-4 h-4 shrink-0 text-muted-foreground" />}
      </button>
      {open && (
        <div className="px-5 border-t border-border">
          {category.items.map((item) => (
            <FaqItemRow key={item.question} item={item} />
          ))}
        </div>
      )}
    </section>
  );
}

// ── Page ─────────────────────────────────────────────────────

export default function HelpPage() {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    if (!query.trim()) return null;
    const lower = query.toLowerCase();
    const results: FaqItem[] = [];
    for (const cat of FAQ_CATEGORIES) {
      for (const item of cat.items) {
        if (
          item.question.toLowerCase().includes(lower) ||
          item.answer.toLowerCase().includes(lower)
        ) {
          results.push(item);
        }
      }
    }
    return results;
  }, [query]);

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Help &amp; Support</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Find answers to common questions about TimeHarbor.
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search for answers…"
          className="pl-9"
          aria-label="Search help topics"
        />
      </div>

      {/* Search results */}
      {filtered !== null && (
        <section className="rounded-xl border border-border bg-card overflow-hidden">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <HelpCircle className="w-8 h-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No results for &ldquo;{query}&rdquo;</p>
              <p className="text-xs text-muted-foreground/60">Try a different search term.</p>
            </div>
          ) : (
            <div className="px-5">
              <p className="py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {filtered.length} result{filtered.length !== 1 ? 's' : ''}
              </p>
              {filtered.map((item) => (
                <FaqItemRow key={item.question} item={item} />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Category sections — hidden when searching */}
      {filtered === null && (
        <div className="space-y-3">
          {FAQ_CATEGORIES.map((cat, i) => (
            <FaqCategorySection
              key={cat.label}
              category={cat}
              defaultOpen={i === 0}
            />
          ))}
        </div>
      )}

      {/* Footer links */}
      <div className="rounded-xl border border-border bg-muted/20 px-5 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-foreground">Still need help?</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Reach out via GitHub or report an issue.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <a
            href="https://github.com/Dharp02/TimeharborApp/discussions/49"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium text-foreground hover:bg-muted transition-colors"
            aria-label="Send feedback on GitHub"
          >
            Send Feedback
          </a>
          <a
            href="https://github.com/Dharp02/TimeharborApp/issues/new"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium text-foreground hover:bg-muted transition-colors"
            aria-label="Report an issue on GitHub"
          >
            Report an Issue
          </a>
        </div>
      </div>
    </div>
  );
}
