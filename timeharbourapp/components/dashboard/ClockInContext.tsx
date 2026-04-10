'use client';

import React, { createContext, useContext, useState, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { sessionManager } from '@/TimeharborAPI/time/SessionManager';
import { collectAttachments } from '@/TimeharborAPI/time/attachmentUtils';
import type { SessionAttachment } from '@/TimeharborAPI/db';
import { db } from '@/TimeharborAPI/db';
import { useSession } from '@/TimeharborAPI/time/useSession';
import { syncManager } from '@/TimeharborAPI/SyncManager';
import { useAuth } from '@/components/auth/AuthProvider';
import { getIdentityUUID } from '@/TimeharborAPI/sync/IdentityManager';
import { Modal } from '@/components/ui/Modal';
import { useActivityLog } from './ActivityLogContext';
import { formatDuration, formatDurationClock } from '@timeharbor/time-engine';
import { tickets as ticketsApi } from '@/TimeharborAPI';
import { Ticket as TicketType } from '@/TimeharborAPI/tickets';
import { Plus, Play, Ticket, Coffee, PlayCircle, X, Paperclip, FileText, Link2 } from 'lucide-react';
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
  toggleTicketTimer: (ticketId: string, ticketTitle: string, teamId?: string, comment?: string, links?: string[], attachments?: SessionAttachment[]) => void;
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

  // Use identity UUID (always available) with auth user.id as fallback
  const userId = user?.id ?? getIdentityUUID();

  // Live session from Dexie via useSession hook (reactively updates every 1s)
  const { currentSession, stats, isOpen, isOnBreak, activeTicketId } = useSession(userId);

  // Modals
  const [isSessionOptionsOpen, setIsSessionOptionsOpen] = useState(false);
  const [isStopTicketModalOpen, setIsStopTicketModalOpen] = useState(false);
  const [stopTicketComment, setStopTicketComment] = useState('');
  const [stopTicketLinks, setStopTicketLinks] = useState<string[]>([]);
  const [stopTicketLinkInput, setStopTicketLinkInput] = useState('');
  const [stopTicketImages, setStopTicketImages] = useState<string[]>([]);
  const [stopTicketFiles, setStopTicketFiles] = useState<File[]>([]);
  const stopTicketFileRef = useRef<HTMLInputElement>(null);
  const [isClockInPromptOpen, setIsClockInPromptOpen] = useState(false);
  const [clockInTickets, setClockInTickets] = useState<TicketType[]>([]);
  const [clockInTicketsLoading, setClockInTicketsLoading] = useState(false);

  // Pre-break ticket tracking (not in Dexie — ephemeral UI state)
  const preBreakTicketRef = useRef<{ id: string; title: string } | null>(null);

  // Recover pre-break ticket from session data on mount/session change.
  // If the user was on break and the app was killed, the ref would be lost.
  // Look at the last closed ticket segment before the open break to recover it.
  if (isOnBreak && !preBreakTicketRef.current && currentSession) {
    const lastBreak = currentSession.breaks.at(-1);
    if (lastBreak && lastBreak.end === null) {
      // Find the ticket segment that was closed when the break started
      const closedBeforeBreak = currentSession.ticketSegments
        .filter(s => s.end !== null && s.end <= lastBreak.start + 1000) // 1s tolerance
        .sort((a, b) => (b.end ?? 0) - (a.end ?? 0));
      if (closedBeforeBreak.length > 0) {
        preBreakTicketRef.current = {
          id: closedBeforeBreak[0].ticketId,
          title: closedBeforeBreak[0].ticketTitle,
        };
      }
    }
  }

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
    if (!userId) return;

    if (isSessionActive && currentSession) {
      // Open the Take a Break / Clock Out options modal
      setIsSessionOptionsOpen(true);
      return;
    }

    // Clock In
    await sessionManager.clockIn(userId);

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
  }, [userId, isSessionActive, currentSession, addActivity]);

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

    // Convert images and files to persistable attachments
    const atts = await collectAttachments(stopTicketImages, stopTicketFiles);

    // Stop the active ticket
    if (activeTicketId) {
      const stoppedSession = await sessionManager.stopTicket(currentSession.id);

      const ticketMs = stoppedSession.ticketBreakdown.find(t => t.ticketId === activeTicketId)?.totalMs ?? 0;

      // Update ticket's tracked time in Dexie
      try {
        await db.tickets.update(activeTicketId, {
          trackedMs: ticketMs,
          trackedTime: formatDuration(ticketMs),
        });
      } catch (_) { /* ticket may not exist locally */ }

      addActivity({
        type: 'SESSION',
        title: 'Stopped Ticket',
        subtitle: activeTicketTitle || 'Ticket',
        description: stopTicketComment,
        link: stopTicketLinks[0] || undefined,
        status: 'Completed',
        duration: formatDuration(ticketMs),
      });
    }

    // Clock out with all data
    await sessionManager.clockOut(currentSession.id, {
      comment: stopTicketComment || undefined,
      links: stopTicketLinks.length > 0 ? stopTicketLinks : undefined,
      attachments: atts.length > 0 ? atts : undefined,
    });

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
    setStopTicketLinks([]);
    setStopTicketLinkInput('');
  }, [currentSession, activeTicketId, activeTicketTitle, stats, stopTicketComment, stopTicketLinks, stopTicketImages, stopTicketFiles, updateActiveSession, addActivity]);

  const cancelStopTicketAndSession = () => {
    setIsStopTicketModalOpen(false);
    setStopTicketComment('');
    setStopTicketLinks([]);
    setStopTicketLinkInput('');
    stopTicketImages.forEach(url => URL.revokeObjectURL(url));
    setStopTicketImages([]);
    setStopTicketFiles([]);
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
    links?: string[],
    attachments?: SessionAttachment[]
  ) => {
    if (!isSessionActive || !currentSession) return;

    if (activeTicketId === ticketId) {
      // Stop current ticket, saving data to session
      const updatedSession = await sessionManager.stopTicket(currentSession.id, {
        comment: comment || undefined,
        links: links?.length ? links : undefined,
        attachments: attachments?.length ? attachments : undefined,
      });

      const ticketMs = updatedSession.ticketBreakdown.find(t => t.ticketId === ticketId)?.totalMs ?? 0;

      // Update ticket's tracked time in Dexie
      try {
        await db.tickets.update(ticketId, {
          trackedMs: ticketMs,
          trackedTime: formatDuration(ticketMs),
        });
      } catch (_) { /* ticket may not exist locally */ }

      addActivity({
        type: 'SESSION',
        title: 'Stopped Ticket',
        subtitle: activeTicketTitle || 'Ticket',
        description: comment,
        link: links?.[0] || undefined,
        status: 'Completed',
        duration: formatDuration(ticketMs),
      });
    } else if (activeTicketId) {
      // Switch: stop previous, start new
      const switchedSession = await sessionManager.switchTicket(currentSession.id, ticketId, ticketTitle);
      const prevMs = switchedSession.ticketBreakdown.find(t => t.ticketId === activeTicketId)?.totalMs ?? 0;

      // Update previous ticket's tracked time in Dexie
      try {
        await db.tickets.update(activeTicketId, {
          trackedMs: prevMs,
          trackedTime: formatDuration(prevMs),
        });
      } catch (_) { /* ticket may not exist locally */ }

      addActivity({
        type: 'SESSION',
        title: 'Stopped Ticket',
        subtitle: activeTicketTitle || 'Ticket',
        description: comment || 'Switched task',
        link: links?.[0] || undefined,
        status: 'Completed',
        duration: formatDuration(prevMs),
      });

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

  const contextValue = useMemo(() => ({
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
  }), [
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
  ]);

  return (
    <ClockInContext.Provider value={contextValue}>
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
          <div
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const files = Array.from(e.dataTransfer.files);
              for (const file of files) {
                if (file.type.startsWith('image/')) {
                  setStopTicketImages(prev => [...prev, URL.createObjectURL(file)]);
                } else {
                  setStopTicketFiles(prev => [...prev, file]);
                }
              }
            }}
          >
            <Textarea
              value={stopTicketComment}
              onChange={(e) => setStopTicketComment(e.target.value)}
              onPaste={(e) => {
                const items = e.clipboardData?.items;
                if (!items) return;
                for (const item of Array.from(items)) {
                  if (item.type.startsWith('image/')) {
                    e.preventDefault();
                    const file = item.getAsFile();
                    if (file) setStopTicketImages(prev => [...prev, URL.createObjectURL(file)]);
                  }
                }
              }}
              placeholder="What did you work on?"
              autoFocus
            />
          </div>
          {(stopTicketImages.length > 0 || stopTicketFiles.length > 0) && (
            <div className="flex flex-wrap gap-2">
              {stopTicketImages.map((url, i) => (
                <div key={`img-${i}`} className="relative group">
                  <img src={url} alt={`Image ${i + 1}`} className="w-16 h-16 object-cover rounded-lg border border-gray-200 dark:border-gray-700" />
                  <button
                    type="button"
                    onClick={() => { URL.revokeObjectURL(url); setStopTicketImages(prev => prev.filter((_, idx) => idx !== i)); }}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label="Remove image"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              {stopTicketFiles.map((file, i) => (
                <div key={`file-${i}`} className="relative group flex items-center gap-1.5 px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                  <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="text-xs truncate max-w-[120px]">{file.name}</span>
                  <button
                    type="button"
                    onClick={() => setStopTicketFiles(prev => prev.filter((_, idx) => idx !== i))}
                    className="w-4 h-4 rounded-full text-red-500 flex items-center justify-center shrink-0"
                    aria-label="Remove file"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div>
            <button
              type="button"
              onClick={() => stopTicketFileRef.current?.click()}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Paperclip className="w-3.5 h-3.5" /> Attach image or document
            </button>
            <input
              ref={stopTicketFileRef}
              type="file"
              accept="image/*,.pdf,.doc,.docx,.txt,.md"
              multiple
              className="hidden"
              onChange={(e) => {
                const files = Array.from(e.target.files || []);
                for (const file of files) {
                  if (file.type.startsWith('image/')) {
                    setStopTicketImages(prev => [...prev, URL.createObjectURL(file)]);
                  } else {
                    setStopTicketFiles(prev => [...prev, file]);
                  }
                }
                if (stopTicketFileRef.current) stopTicketFileRef.current.value = '';
              }}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Links (optional)</label>
            {stopTicketLinks.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {stopTicketLinks.map((l, i) => (
                  <div key={i} className="flex items-center gap-1 px-2 py-1 rounded-md bg-gray-100 dark:bg-gray-800 text-xs">
                    <Link2 className="w-3 h-3 text-muted-foreground shrink-0" />
                    <span className="truncate max-w-[200px]">{l}</span>
                    <button type="button" onClick={() => setStopTicketLinks(prev => prev.filter((_, idx) => idx !== i))} className="text-red-500 shrink-0" aria-label="Remove link">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <Input
                type="url"
                value={stopTicketLinkInput}
                onChange={(e) => setStopTicketLinkInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && stopTicketLinkInput.trim()) {
                    e.preventDefault();
                    setStopTicketLinks(prev => [...prev, stopTicketLinkInput.trim()]);
                    setStopTicketLinkInput('');
                  }
                }}
                onPaste={(e) => {
                  const text = e.clipboardData?.getData('text');
                  if (text?.trim()) {
                    e.preventDefault();
                    setStopTicketLinks(prev => [...prev, text.trim()]);
                  }
                }}
                placeholder="Paste a link and press Enter..."
              />
            </div>
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
