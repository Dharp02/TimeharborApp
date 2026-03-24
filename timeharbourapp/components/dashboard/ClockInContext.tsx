'use client';

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { sessionManager } from '@/TimeharborAPI/time/SessionManager';
import { useSession } from '@/TimeharborAPI/time/useSession';
import { syncManager } from '@/TimeharborAPI/SyncManager';
import { useAuth } from '@/components/auth/AuthProvider';
import { Modal } from '@/components/ui/Modal';
import { useActivityLog } from './ActivityLogContext';
import { formatDuration, formatDurationClock } from '@timeharbor/time-engine';
import { tickets as ticketsApi } from '@/TimeharborAPI';
import { Ticket as TicketType } from '@/TimeharborAPI/tickets';
import { Plus, Play, Ticket, Coffee, PlayCircle } from 'lucide-react';
import { Button, Input, Textarea } from '@mieweb/ui';

type ClockInContextType = {
  // Global Session
  isSessionActive: boolean;
  isOnBreak: boolean;
  sessionStartTime: number | null;
  sessionDuration: string;
  sessionFormat: string;

  // Ticket Timer
  activeTicketId: string | null;
  activeTicketTitle: string | null;
  ticketStartTime: number | null;
  ticketDuration: string;
  ticketFormat: string;
  ticketDurations: Record<string, number>;

  // Actions
  toggleSession: () => void;
  resumeFromBreak: () => void;
  toggleTicketTimer: (ticketId: string, ticketTitle: string, teamId?: string, comment?: string, link?: string) => void;
  getFormattedTotalTime: (ticketId: string) => string;
};

const ClockInContext = createContext<ClockInContextType | undefined>(undefined);

/** Format ms to mm:ss or hh:mm display */
function formatTimer(ms: number): { display: string; format: string } {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours === 0) {
    return {
      display: `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`,
      format: 'mm:ss',
    };
  }
  return {
    display: `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`,
    format: 'hh:mm',
  };
}

export function ClockInProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { addActivity, updateActivity, updateActiveSession } = useActivityLog();
  const router = useRouter();

  // Live session from Dexie via useSession hook (reactively updates every 1s)
  const { currentSession, stats, isOpen, isOnBreak, activeTicketId } = useSession(user?.id);

  // Modals
  const [isSessionOptionsOpen, setIsSessionOptionsOpen] = useState(false);
  const [isStopTicketModalOpen, setIsStopTicketModalOpen] = useState(false);
  const [stopTicketComment, setStopTicketComment] = useState('');
  const [stopTicketLink, setStopTicketLink] = useState('');
  const [isClockInPromptOpen, setIsClockInPromptOpen] = useState(false);
  const [clockInTickets, setClockInTickets] = useState<TicketType[]>([]);
  const [clockInTicketsLoading, setClockInTicketsLoading] = useState(false);

  // Pre-break ticket tracking (not in Dexie — ephemeral UI state)
  const preBreakTicketRef = useRef<{ id: string; title: string } | null>(null);

  // ── Derived values from useSession stats ──

  const isSessionActive = isOpen;
  const sessionStartTime = currentSession?.clockIn ?? null;

  const sessionTimer = stats
    ? formatTimer(stats.netWorkMs)
    : { display: '00:00', format: 'mm:ss' };
  const sessionDuration = sessionTimer.display;
  const sessionFormat = sessionTimer.format;

  // Active ticket info from session segments
  const activeSegment = currentSession?.ticketSegments.find(s => s.end === null) ?? null;
  const activeTicketTitle = activeSegment?.ticketTitle ?? null;
  const ticketStartTime = activeSegment?.start ?? null;

  // Ticket timer display — compute active ticket's total ms from stats
  const activeTicketMs = stats?.ticketBreakdown.find(t => t.ticketId === activeTicketId)?.totalMs ?? 0;
  const ticketTimerDisplay = (() => {
    const totalSeconds = Math.max(0, Math.floor(activeTicketMs / 1000));
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return {
      display: `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`,
      format: 'hh:mm:ss',
    };
  })();
  const ticketDuration = ticketTimerDisplay.display;
  const ticketFormat = ticketTimerDisplay.format;

  // Build ticketDurations map from stats breakdown
  const ticketDurations: Record<string, number> = {};
  if (stats) {
    for (const t of stats.ticketBreakdown) {
      ticketDurations[t.ticketId] = t.totalMs;
    }
  }

  // ── Actions ──

  const fetchClockInTickets = async () => {
    setClockInTicketsLoading(true);
    try {
      const fetched = await ticketsApi.getPersonalTickets({ sort: 'recent', status: 'open' });
      setClockInTickets(fetched);
    } catch {
      setClockInTickets([]);
    } finally {
      setClockInTicketsLoading(false);
    }
  };

  const toggleSession = useCallback(async () => {
    if (!user?.id) return;

    if (isSessionActive && currentSession) {
      // Open the Take a Break / Clock Out options modal
      setIsSessionOptionsOpen(true);
      return;
    }

    // Clock In
    await sessionManager.clockIn(user.id);

    addActivity({
      type: 'SESSION',
      title: 'Work Session Started',
      subtitle: 'Clocked In',
      status: 'Active',
      duration: '0h 0m',
      startTime: new Date().toISOString(),
    });

    await syncManager.syncNow();
    window.dispatchEvent(new Event('pull-to-refresh'));
    window.dispatchEvent(new CustomEvent('dashboard-stats-refresh'));

    // Prompt to pick a ticket
    setIsClockInPromptOpen(true);
    fetchClockInTickets();
  }, [user?.id, isSessionActive, currentSession, addActivity]);

  const takeBreak = useCallback(async () => {
    if (!currentSession) return;
    setIsSessionOptionsOpen(false);

    // Remember pre-break ticket
    if (activeTicketId && activeTicketTitle) {
      preBreakTicketRef.current = { id: activeTicketId, title: activeTicketTitle };
    } else {
      preBreakTicketRef.current = null;
    }

    await sessionManager.startBreak(currentSession.id);

    addActivity({
      type: 'SESSION',
      title: 'On Break',
      subtitle: 'Session paused',
      status: 'Active',
      duration: '0m',
    });
  }, [currentSession, activeTicketId, activeTicketTitle, addActivity]);

  const resumeFromBreak = useCallback(async () => {
    if (!currentSession) return;

    const pre = preBreakTicketRef.current;
    await sessionManager.endBreak(
      currentSession.id,
      pre?.id ?? null,
      pre?.title ?? null
    );
    preBreakTicketRef.current = null;

    addActivity({
      type: 'SESSION',
      title: 'Resumed',
      subtitle: 'Back from break',
      status: 'Active',
      duration: '0m',
    });
  }, [currentSession, addActivity]);

  const proceedToClockOut = useCallback(async () => {
    if (!currentSession) return;
    setIsSessionOptionsOpen(false);

    // If on break, end it first
    if (isOnBreak) {
      await sessionManager.endBreak(currentSession.id, null, null);
    }

    // If ticket running, prompt to stop it
    if (activeTicketId) {
      setIsStopTicketModalOpen(true);
      return;
    }

    // Clock out
    await sessionManager.clockOut(currentSession.id);

    const durationStr = stats ? formatDuration(stats.netWorkMs) : '0m';
    updateActiveSession(new Date().toISOString(), durationStr);
    addActivity({
      type: 'SESSION',
      title: 'Session Ended',
      subtitle: `Duration: ${durationStr}`,
      status: 'Completed',
      duration: durationStr,
    });

    await syncManager.syncNow();
    window.dispatchEvent(new Event('pull-to-refresh'));
    window.dispatchEvent(new CustomEvent('dashboard-stats-refresh'));
  }, [currentSession, isOnBreak, activeTicketId, stats, updateActiveSession, addActivity]);

  const confirmStopTicketAndSession = useCallback(async () => {
    if (!currentSession) return;

    // Stop the active ticket
    if (activeTicketId) {
      await sessionManager.stopTicket(currentSession.id);

      const ticketMs = stats?.ticketBreakdown.find(t => t.ticketId === activeTicketId)?.totalMs ?? 0;
      addActivity({
        type: 'SESSION',
        title: 'Stopped Ticket',
        subtitle: activeTicketTitle || 'Ticket',
        description: stopTicketComment,
        link: stopTicketLink || undefined,
        status: 'Completed',
        duration: formatDuration(ticketMs),
      });
    }

    // Clock out
    await sessionManager.clockOut(currentSession.id, stopTicketComment || undefined);

    const durationStr = stats ? formatDuration(stats.netWorkMs) : '0m';
    updateActiveSession(new Date().toISOString(), durationStr);
    addActivity({
      type: 'SESSION',
      title: 'Session Ended',
      subtitle: `Duration: ${durationStr}`,
      status: 'Completed',
      duration: durationStr,
    });

    await syncManager.syncNow();
    window.dispatchEvent(new Event('pull-to-refresh'));
    window.dispatchEvent(new CustomEvent('dashboard-stats-refresh'));

    setIsStopTicketModalOpen(false);
    setStopTicketComment('');
    setStopTicketLink('');
  }, [currentSession, activeTicketId, activeTicketTitle, stats, stopTicketComment, stopTicketLink, updateActiveSession, addActivity]);

  const cancelStopTicketAndSession = () => {
    setIsStopTicketModalOpen(false);
    setStopTicketComment('');
    setStopTicketLink('');
  };

  const handleClockInTicketSelect = (ticketId: string, ticketTitle: string) => {
    setIsClockInPromptOpen(false);
    toggleTicketTimer(ticketId, ticketTitle);
  };

  const dismissClockInPrompt = () => {
    setIsClockInPromptOpen(false);
  };

  const toggleTicketTimer = useCallback(async (
    ticketId: string,
    ticketTitle: string,
    _teamId?: string,
    comment?: string,
    link?: string
  ) => {
    if (!isSessionActive || !currentSession) return;

    if (activeTicketId === ticketId) {
      // Stop current ticket
      await sessionManager.stopTicket(currentSession.id);

      const ticketMs = stats?.ticketBreakdown.find(t => t.ticketId === ticketId)?.totalMs ?? 0;
      addActivity({
        type: 'SESSION',
        title: 'Stopped Ticket',
        subtitle: activeTicketTitle || 'Ticket',
        description: comment,
        link: link || undefined,
        status: 'Completed',
        duration: formatDuration(ticketMs),
      });
    } else if (activeTicketId) {
      // Switch: stop previous, start new
      const prevMs = stats?.ticketBreakdown.find(t => t.ticketId === activeTicketId)?.totalMs ?? 0;
      addActivity({
        type: 'SESSION',
        title: 'Stopped Ticket',
        subtitle: activeTicketTitle || 'Ticket',
        description: comment || 'Switched task',
        link: link || undefined,
        status: 'Completed',
        duration: formatDuration(prevMs),
      });

      await sessionManager.switchTicket(currentSession.id, ticketId, ticketTitle);

      addActivity({
        type: 'SESSION',
        title: 'Started Ticket',
        subtitle: ticketTitle,
        status: 'Active',
        duration: '0m',
        startTime: new Date().toISOString(),
      });
    } else {
      // Start ticket (no previous running)
      await sessionManager.startTicket(currentSession.id, ticketId, ticketTitle);

      addActivity({
        type: 'SESSION',
        title: 'Started Ticket',
        subtitle: ticketTitle,
        status: 'Active',
        duration: '0m',
        startTime: new Date().toISOString(),
      });
    }

    await syncManager.syncNow();
    window.dispatchEvent(new Event('pull-to-refresh'));
  }, [isSessionActive, currentSession, activeTicketId, activeTicketTitle, stats, addActivity]);

  const getFormattedTotalTime = useCallback((ticketId: string) => {
    const totalMs = ticketDurations[ticketId] || 0;
    return formatDurationClock(totalMs);
  }, [ticketDurations]);

  return (
    <ClockInContext.Provider value={{
      isSessionActive,
      isOnBreak,
      sessionStartTime,
      sessionDuration,
      sessionFormat,
      activeTicketId,
      activeTicketTitle,
      ticketStartTime,
      ticketDuration,
      ticketFormat,
      ticketDurations,
      toggleSession,
      resumeFromBreak,
      toggleTicketTimer,
      getFormattedTotalTime,
    }}>
      {children}

      {/* Session Options Modal: Take a Break or Clock Out */}
      <Modal
        isOpen={isSessionOptionsOpen}
        onClose={() => setIsSessionOptionsOpen(false)}
        title="What would you like to do?"
      >
        <div className="space-y-3">
          <button
            onClick={takeBreak}
            className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 hover:border-amber-400 dark:hover:border-amber-500 focus:ring-2 focus:ring-amber-400 focus:outline-none text-left transition-colors"
            aria-label="Take a break"
          >
            <div className="shrink-0 p-2 bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 rounded-lg">
              <Coffee className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">Take a Break</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Pause your session. Resume when you're back.</p>
            </div>
          </button>

          <button
            onClick={proceedToClockOut}
            className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 hover:border-red-400 dark:hover:border-red-600 focus:ring-2 focus:ring-red-400 focus:outline-none text-left transition-colors"
            aria-label="Clock out"
          >
            <div className="shrink-0 p-2 bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 rounded-lg">
              <PlayCircle className="w-5 h-5 rotate-180" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">Clock Out</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">End your work session for today.</p>
            </div>
          </button>

          <Button variant="ghost" onClick={() => setIsSessionOptionsOpen(false)}>
            Cancel
          </Button>
        </div>
      </Modal>

      {/* Clock-In Ticket Prompt Modal */}
      <Modal
        isOpen={isClockInPromptOpen}
        onClose={dismissClockInPrompt}
        title="You're clocked in! What are you working on?"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Start tracking time on an open ticket or create a new one.
          </p>

          {clockInTicketsLoading ? (
            <div className="text-center py-6 text-sm text-gray-400">Loading tickets…</div>
          ) : clockInTickets.length === 0 ? (
            <div className="text-center py-4 text-sm text-gray-400">
              No open tickets found.
            </div>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {clockInTickets.map((t) => (
                <Button
                  variant="outline"
                  key={t.id}
                  onClick={() => handleClockInTicketSelect(t.id, t.title)}
                  className="w-full flex items-center gap-3 p-3 h-auto justify-start text-left group"
                  aria-label={`Start timer for ${t.title}`}
                >
                  <div className="shrink-0 p-1.5 bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 rounded-md">
                    <Ticket className="w-4 h-4" />
                  </div>
                  <span className="flex-1 text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{t.title}</span>
                  <Play className="w-4 h-4 shrink-0 text-primary-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                </Button>
              ))}
            </div>
          )}

          <div className="flex justify-between items-center pt-2 border-t border-gray-100 dark:border-gray-700">
            <Button variant="ghost" onClick={dismissClockInPrompt}>
              Skip for now
            </Button>
            <Button onClick={() => { dismissClockInPrompt(); router.push('/dashboard/tickets/create'); }}>
              <Plus className="w-4 h-4" />
              New Ticket
            </Button>
          </div>
        </div>
      </Modal>

      {/* Stop Ticket + Clock Out Modal */}
      <Modal
        isOpen={isStopTicketModalOpen}
        onClose={cancelStopTicketAndSession}
        title={`Stop working on "${activeTicketTitle || 'Ticket'}"?`}
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            You are clocking out but the ticket timer is still running. Please add a comment to stop the ticket and clock out.
          </p>
          <Textarea
            value={stopTicketComment}
            onChange={(e) => setStopTicketComment(e.target.value)}
            placeholder="What did you work on?"
            autoFocus
          />
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Link (optional)</label>
            <Input
              type="url"
              value={stopTicketLink}
              onChange={(e) => setStopTicketLink(e.target.value)}
              placeholder="Paste a YouTube or Pulse link..."
            />
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={cancelStopTicketAndSession}>
              Cancel
            </Button>
            <Button onClick={confirmStopTicketAndSession}>
              Stop & Clock Out
            </Button>
          </div>
        </div>
      </Modal>
    </ClockInContext.Provider>
  );
}

export function useClockIn() {
  const context = useContext(ClockInContext);
  if (context === undefined) {
    throw new Error('useClockIn must be used within a ClockInProvider');
  }
  return context;
}
