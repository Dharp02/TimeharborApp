'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Button, useSidebar } from '@mieweb/ui';
import {
  Clock,
  Ticket,
  Timer,
  FolderKanban,
  StickyNote,
  UserCircle,
  CalendarDays,
  Bell,
  Activity,
  Shield,
  Rocket,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import './walkthrough.scss';

const WALKTHROUGH_KEY = 'th_walkthrough_completed';

interface WalkthroughStep {
  /**
   * One or more CSS selectors to try (first visible one wins).
   * Null = centered card (no highlight).
   */
  targets: string[] | null;
  icon: React.ReactNode;
  title: string;
  description: string;
  tip?: string;
  /** Preferred tooltip placement relative to the target element. */
  placement?: 'top' | 'bottom' | 'left' | 'right';
}

const STEPS: WalkthroughStep[] = [
  // ── 0  Welcome ──
  {
    targets: null,
    icon: <Rocket className="w-10 h-10 text-primary-500" />,
    title: 'Welcome to TimeHarbor!',
    description:
      'Your personal time-tracking companion. This quick tour will show you every feature on the dashboard. Let\u2019s get started!',
    tip: 'You can replay this walkthrough anytime from Settings \u2192 Help.',
  },
  // ── 1  Dashboard — Time Summary ──
  {
    targets: ['[data-walkthrough="dashboard-summary"]'],
    icon: <Clock className="w-10 h-10 text-green-500" />,
    title: 'Time Summary',
    description:
      'This is your at-a-glance dashboard. "Total Hours" shows how long you\u2019ve worked today, and "This Week" shows your weekly total. Both update in real time.',
    tip: 'These numbers refresh automatically whenever you clock in or out.',
    placement: 'bottom',
  },
  // ── 2  Dashboard — Clock In / Clock Out ──
  {
    targets: ['[data-walkthrough="desktop-clock-in"]', '[data-walkthrough="clock-in-fab"]'],
    icon: <Clock className="w-10 h-10 text-green-500" />,
    title: 'Clock In & Clock Out',
    description:
      'This is the main action button. Tap it once to clock in and start a work session — a live timer appears. Tap it again to clock out and save the session.',
    tip: 'You can clock in without selecting a ticket — it starts a general time session.',
    placement: 'top',
  },
  // ── 3  Dashboard — My Tickets ──
  {
    targets: ['[data-walkthrough="open-tickets"]'],
    icon: <Ticket className="w-10 h-10 text-blue-500" />,
    title: 'My Tickets',
    description:
      'All your active tickets appear here. Tap the "+" button to create a new ticket — give it a title, assign it to a project, and set a priority. Tap "See All" to view the full list.',
    tip: 'Tickets let you categorise tasks and see how much time each one consumed.',
    placement: 'top',
  },
  // ── 4  Dashboard — Ticket Timer (Start/Stop) ──
  {
    targets: ['[data-walkthrough="ticket-timer"]'],
    icon: <Timer className="w-10 h-10 text-orange-500" />,
    title: 'Start & Stop Ticket Timer',
    description:
      'Each ticket has its own Start / Stop button. Tap "Start" to begin tracking time on that specific ticket. The time is logged separately for each ticket so you know exactly where your hours go.',
    tip: 'You can switch tickets without clocking out — the previous ticket timer pauses automatically.',
    placement: 'left',
  },
  // ── 5  Notification Bell ──
  {
    targets: ['[data-walkthrough="notification-bell"]'],
    icon: <Bell className="w-10 h-10 text-amber-500" />,
    title: 'Notifications',
    description:
      'The bell icon shows real-time alerts — team activity, session reminders, and system updates. A red dot means you have unread notifications.',
    tip: 'Enable push notifications in your device settings for instant alerts even when the app is closed.',
    placement: 'bottom',
  },
  // ── 6  Sidebar — Your Profile ──
  {
    targets: ['[data-walkthrough="sidebar-profile"]'],
    icon: <UserCircle className="w-10 h-10 text-teal-500" />,
    title: 'Your Profile',
    description:
      'This is your identity in TimeHarbor. Tap here to go to your Profile page where you can update your name, upload a photo, and customize your details. A complete profile helps team collaboration.',
    tip: 'Your avatar and name appear across the app wherever you clock in or share links.',
    placement: 'right',
  },
  // ── 7  Sidebar — Tickets ──
  {
    targets: ['[data-walkthrough="nav-tickets"]'],
    icon: <Ticket className="w-10 h-10 text-blue-500" />,
    title: 'Tickets Page',
    description:
      'Navigate here to see all your tickets — open, in progress, and closed. Create, edit, and manage tickets from this page.',
    placement: 'right',
  },
  // ── 8  Sidebar — Projects ──
  {
    targets: ['[data-walkthrough="nav-projects"]'],
    icon: <FolderKanban className="w-10 h-10 text-purple-500" />,
    title: 'Projects',
    description:
      'Group related tickets under a project. Create a project, give it a name and colour, then assign tickets to it. This lets you see combined time reports per project.',
    tip: 'Great for tracking time across client work or large initiatives.',
    placement: 'right',
  },
  // ── 9  Sidebar — Calendar ──
  {
    targets: ['[data-walkthrough="nav-calendar"]'],
    icon: <CalendarDays className="w-10 h-10 text-indigo-500" />,
    title: 'Calendar',
    description:
      'View all your tracked sessions on a calendar. Switch between month, week, and day views. You can also connect Google Calendar to see external events side by side.',
    placement: 'right',
  },
  // ── 10  Sidebar — Notepad ──
  {
    targets: ['[data-walkthrough="nav-notepad"]'],
    icon: <StickyNote className="w-10 h-10 text-yellow-500" />,
    title: 'Notepad',
    description:
      'A built-in rich-text editor for jotting down quick notes. Your notes are saved locally on your device so they\u2019re always available, even offline.',
    tip: 'Perfect for meeting notes, daily stand-up talking points, or personal reminders.',
    placement: 'right',
  },
  // ── 11  Sidebar — Timesheet ──
  {
    targets: ['[data-walkthrough="nav-timesheet"]'],
    icon: <Activity className="w-10 h-10 text-pink-500" />,
    title: 'Timesheet',
    description:
      'Your detailed timesheet lives here. Review daily and weekly breakdowns of logged hours, filter by date range, and export for reporting.',
    tip: 'Useful for weekly reviews, invoicing, and sharing progress with your team.',
    placement: 'right',
  },
  // ── 12  Sidebar — Settings ──
  {
    targets: ['[data-walkthrough="nav-settings"]'],
    icon: <Shield className="w-10 h-10 text-emerald-500" />,
    title: 'Settings & Security',
    description:
      'Head to Settings for dark mode, encryption setup, recovery key backup, app lock, and more. This is also where you\u2019ll find "Replay Walkthrough" to revisit this guide.',
    tip: 'Set up your recovery key early — it\u2019s the only way to restore encrypted data on a new device.',
    placement: 'right',
  },
  // ── 13  Done ──
  {
    targets: null,
    icon: <Rocket className="w-10 h-10 text-primary-500" />,
    title: 'You\u2019re All Set!',
    description:
      'That covers all the key features. Start by clocking in, create your first ticket, and explore at your own pace. Happy tracking!',
  },
];

/* ─── Positioning helpers ─── */

interface TooltipPos {
  top: number;
  left: number;
  transformOrigin: string;
}

function computeTooltipPos(
  rect: DOMRect,
  placement: 'top' | 'bottom' | 'left' | 'right',
  tooltipW: number,
  tooltipH: number,
): TooltipPos {
  const pad = 12;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let top = 0;
  let left = 0;
  let origin = 'top left';

  switch (placement) {
    case 'bottom':
      top = rect.bottom + pad;
      left = rect.left + rect.width / 2 - tooltipW / 2;
      origin = 'top center';
      break;
    case 'top':
      top = rect.top - tooltipH - pad;
      left = rect.left + rect.width / 2 - tooltipW / 2;
      origin = 'bottom center';
      break;
    case 'right':
      top = rect.top + rect.height / 2 - tooltipH / 2;
      left = rect.right + pad;
      origin = 'center left';
      break;
    case 'left':
      top = rect.top + rect.height / 2 - tooltipH / 2;
      left = rect.left - tooltipW - pad;
      origin = 'center right';
      break;
  }

  // Clamp within viewport
  if (left < 8) left = 8;
  if (left + tooltipW > vw - 8) left = vw - tooltipW - 8;
  if (top < 8) top = 8;
  if (top + tooltipH > vh - 8) top = vh - tooltipH - 8;

  return { top, left, transformOrigin: origin };
}

/* ─── Component ─── */

interface WalkthroughProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function WalkthroughModal({ isOpen, onClose }: WalkthroughProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [tooltipPos, setTooltipPos] = useState<TooltipPos | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const { openMobile, closeMobile, isMobileViewport } = useSidebar();
  const totalSteps = STEPS.length;
  const step = STEPS[currentStep];

  // Reset when modal opens
  useEffect(() => {
    if (isOpen) {
      setCurrentStep(0);
      setTargetRect(null);
    }
  }, [isOpen]);

  // Auto-open/close mobile sidebar for steps targeting sidebar elements
  const isSidebarStep = step.targets?.some((s) =>
    s.includes('sidebar-') || s.includes('nav-'),
  ) ?? false;

  useEffect(() => {
    if (!isOpen || !isMobileViewport) return;
    if (isSidebarStep) {
      openMobile();
    } else {
      closeMobile();
    }
  }, [isOpen, isSidebarStep, isMobileViewport, openMobile, closeMobile]);

  // Find & measure the target element for the current step
  useEffect(() => {
    if (!isOpen || !step.targets) {
      setTargetRect(null);
      return;
    }
    const measure = () => {
      // Try each selector in order; pick the first one that's visible
      for (const selector of step.targets!) {
        const el = document.querySelector(selector);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            setTargetRect(rect);
            el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            return;
          }
        }
      }
      // None visible — fall back to centered card
      setTargetRect(null);
    };

    // Give sidebar animation time to finish before measuring
    const timer = setTimeout(measure, isSidebarStep ? 350 : 150);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [isOpen, step.targets, currentStep]);

  // Re-compute tooltip position after render using real dimensions
  useEffect(() => {
    if (!isOpen || !targetRect) {
      setTooltipPos(null);
      return;
    }
    // Wait a frame so the tooltip is rendered and measurable
    const raf = requestAnimationFrame(() => {
      const el = tooltipRef.current;
      const tooltipW = Math.min(340, window.innerWidth - 32);
      const tooltipH = el ? el.offsetHeight : 260;
      // On mobile, sidebar steps should show the tooltip at the bottom
      // so it doesn't overlap the sidebar menu
      const effectivePlacement =
        isMobileViewport && isSidebarStep ? 'bottom' : (step.placement ?? 'bottom');
      const pos = computeTooltipPos(targetRect, effectivePlacement, tooltipW, tooltipH);
      // On mobile sidebar steps, position tooltip opposite to the target element
      // so it doesn't overlap the sidebar item being highlighted
      if (isMobileViewport && isSidebarStep) {
        const targetMidY = targetRect.top + targetRect.height / 2;
        const inBottomHalf = targetMidY > window.innerHeight / 2;
        if (inBottomHalf) {
          // Target is low — pin tooltip to top
          pos.top = 8;
          pos.transformOrigin = 'top center';
        } else {
          // Target is high — pin tooltip to bottom
          pos.top = window.innerHeight - tooltipH - 8;
          pos.transformOrigin = 'bottom center';
        }
        pos.left = (window.innerWidth - tooltipW) / 2;
      }
      setTooltipPos(pos);
    });
    return () => cancelAnimationFrame(raf);
  }, [isOpen, targetRect, currentStep, step.placement, isMobileViewport, isSidebarStep]);

  const handleNext = useCallback(() => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep((s) => s + 1);
    } else {
      localStorage.setItem(WALKTHROUGH_KEY, '1');
      if (isMobileViewport) closeMobile();
      onClose();
    }
  }, [currentStep, totalSteps, onClose, isMobileViewport, closeMobile]);

  const handlePrev = useCallback(() => {
    if (currentStep > 0) setCurrentStep((s) => s - 1);
  }, [currentStep]);

  const handleSkip = useCallback(() => {
    localStorage.setItem(WALKTHROUGH_KEY, '1');
    if (isMobileViewport) closeMobile();
    onClose();
  }, [onClose, isMobileViewport, closeMobile]);

  if (!isOpen || typeof document === 'undefined') return null;

  const progress = ((currentStep + 1) / totalSteps) * 100;
  const hasTarget = !!targetRect;

  // Tooltip max-width for inline style
  const tooltipW = Math.min(340, window.innerWidth - 32);

  // Spotlight hole via box-shadow on a positioned element
  const spotPad = 8;
  const spotStyle: React.CSSProperties | undefined = hasTarget
    ? {
        position: 'fixed',
        top: targetRect.top - spotPad,
        left: targetRect.left - spotPad,
        width: targetRect.width + spotPad * 2,
        height: targetRect.height + spotPad * 2,
        borderRadius: 12,
        // Huge box-shadow covers the rest of the viewport
        boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.55)',
        pointerEvents: 'none' as const,
        zIndex: 9998,
        transition: 'top 0.3s ease, left 0.3s ease, width 0.3s ease, height 0.3s ease',
      }
    : undefined;

  return createPortal(
    <div className="wt-overlay" aria-modal="true" role="dialog" aria-label="App walkthrough">
      {/* Dark backdrop — full screen when no target, or the spotlight creates the dimming */}
      {hasTarget ? (
        <div style={spotStyle} />
      ) : (
        <div className="wt-backdrop" onClick={handleSkip} />
      )}

      {/* Clickable area outside tooltip to dismiss */}
      {hasTarget && (
        <div className="wt-backdrop-click" onClick={handleSkip} />
      )}

      {/* Tooltip / card */}
      <div
        ref={tooltipRef}
        className={`wt-tooltip ${hasTarget ? 'wt-tooltip--anchored' : 'wt-tooltip--centered'}`}
        style={
          tooltipPos
            ? { top: tooltipPos.top, left: tooltipPos.left, maxWidth: tooltipW, transformOrigin: tooltipPos.transformOrigin }
            : { maxWidth: tooltipW }
        }
      >
        {/* Progress bar */}
        <div className="wt-progress-track">
          <div className="wt-progress-bar" style={{ width: `${progress}%` }} />
        </div>

        <p className="wt-counter">
          Step {currentStep + 1} of {totalSteps}
        </p>

        <div className="wt-content">
          <div className="wt-icon">{step.icon}</div>
          <h2 className="wt-title">{step.title}</h2>
          <p className="wt-description">{step.description}</p>
          {step.tip && (
            <div className="wt-tip">
              <span className="wt-tip-label">Tip:</span> {step.tip}
            </div>
          )}
        </div>

        {/* Dot indicators */}
        <div className="wt-dots">
          {STEPS.map((_, i) => (
            <button
              key={i}
              className={`wt-dot ${i === currentStep ? 'wt-dot--active' : ''}`}
              onClick={() => setCurrentStep(i)}
              aria-label={`Go to step ${i + 1}`}
            />
          ))}
        </div>

        {/* Navigation */}
        <div className="wt-actions">
          {currentStep === 0 ? (
            <Button variant="ghost" onClick={handleSkip} className="wt-skip-btn">
              Skip walkthrough
            </Button>
          ) : (
            <Button variant="outline" onClick={handlePrev}>
              <ChevronLeft className="w-4 h-4 mr-1" /> Back
            </Button>
          )}

          <Button onClick={handleNext}>
            {currentStep === totalSteps - 1 ? (
              'Get Started!'
            ) : (
              <>
                Next <ChevronRight className="w-4 h-4 ml-1" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/**
 * Hook to manage walkthrough visibility.
 * Automatically shows on first visit.
 */
export function useWalkthrough(): [boolean, React.Dispatch<React.SetStateAction<boolean>>] {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const completed = localStorage.getItem(WALKTHROUGH_KEY);
    if (!completed) {
      const timer = setTimeout(() => setShow(true), 800);
      return () => clearTimeout(timer);
    }
  }, []);

  return [show, setShow];
}
