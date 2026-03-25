'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Plus, Play, Square, ChevronRight, Clock, Video, Users, RefreshCw, Share2, Check, Paperclip, X, FileText, Link2 } from 'lucide-react';
import Link from 'next/link';
import { Button, Input, Textarea, Badge, Card, CardContent, Text, SmallMuted } from '@mieweb/ui';
import { useClockIn } from './ClockInContext';
import { Modal } from '@/components/ui/Modal';
import { tickets as ticketsApi } from '@/TimeharborAPI';
import { Ticket as TicketType } from '@/TimeharborAPI/tickets';
import { useActivityLog } from './ActivityLogContext';
import { useRefresh } from '../../contexts/RefreshContext';
import { db } from '@/TimeharborAPI/db';
import { collectAttachments } from '@/TimeharborAPI/time/attachmentUtils';
import { formatDuration } from '@timeharbor/time-engine';

const getStatusDisplay = (status: string) =>
  status === 'Closed' ? 'Done' : status;

const formatRelativeTime = (dateStr: string) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return mins + 'm ago';
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + 'h ago';
  return Math.floor(hrs / 24) + ' days ago';
};

export default function OpenTickets() {
  const { isSessionActive, isOnBreak, activeTicketId, toggleTicketTimer, getFormattedTotalTime, toggleSession, ticketDuration, ticketDurations } = useClockIn();
  const { addActivity } = useActivityLog();
  const { register, lastRefreshed } = useRefresh();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'stop' | 'switch'>('stop');
  const [comment, setComment] = useState('');
  const [links, setLinks] = useState<string[]>([]);
  const [linkInput, setLinkInput] = useState('');
  const [pastedImages, setPastedImages] = useState<string[]>([]);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingTicket, setPendingTicket] = useState<{id: string, title: string} | null>(null);
  const [tickets, setTickets] = useState<TicketType[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showClockInWarning, setShowClockInWarning] = useState(false);

  const isMountedRef = useRef(true);

  const PERSONAL_TEAM_ID = '__personal__';

  const fetchTickets = useCallback(async () => {
    try {
      const fetchedTickets = await ticketsApi.getPersonalTickets({ sort: 'recent', status: 'open' });
      if (isMountedRef.current) {
        setTickets(fetchedTickets);
        db.tickets.bulkPut(fetchedTickets as any).catch(() => {});
      }
    } catch (error) {
      console.error('Failed to load tickets:', error);
    } finally {
      if (isMountedRef.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;

    // Read Dexie cache immediately
    const cacheTeamId = PERSONAL_TEAM_ID;
    db.tickets
      .where('teamId').equals(cacheTeamId)
      .filter(t => t.status === 'Open' || t.status === 'In Progress')
      .toArray()
      .then(cached => {
        if (cached.length > 0 && isMountedRef.current) {
          setTickets(cached as TicketType[]);
        } else {
          setIsLoading(true);
        }
      })
      .catch(() => setIsLoading(true));

    fetchTickets();

    const unregister = register(async () => { await fetchTickets(); });
    const handleRefresh = () => fetchTickets();
    window.addEventListener('pull-to-refresh', handleRefresh);

    // Re-read Dexie after SyncEngine pulls new tickets from the server
    const handleSyncComplete = () => fetchTickets();
    window.addEventListener('sync-complete', handleSyncComplete);

    return () => {
      isMountedRef.current = false;
      unregister();
      window.removeEventListener('pull-to-refresh', handleRefresh);
      window.removeEventListener('sync-complete', handleSyncComplete);
    };
  }, [register, lastRefreshed, fetchTickets]);

  const handleTicketClick = (e: React.MouseEvent, ticketId: string, ticketTitle: string) => {
    e.stopPropagation();
    
    if (!isSessionActive || isOnBreak) {
      if (!isSessionActive) setShowClockInWarning(true);
      return;
    }

    // If stopping the current ticket
    if (activeTicketId === ticketId) {
      setPendingTicket({ id: ticketId, title: ticketTitle });
      setModalType('stop');
      setComment('');
      setIsModalOpen(true);
    } 
    // If starting a new ticket (and potentially stopping another)
    else {
      if (activeTicketId) {
        setPendingTicket({ id: ticketId, title: ticketTitle });
        setModalType('switch');
        setComment('');
        setIsModalOpen(true);
      } else {
        // Just starting a new ticket
        toggleTicketTimer(ticketId, ticketTitle);
      }
    }
  };

  const handleConfirm = async () => {
    if (!pendingTicket) return;

    const atts = await collectAttachments(pastedImages, attachedFiles);

    if (modalType === 'stop') {
      toggleTicketTimer(pendingTicket.id, pendingTicket.title, undefined, comment || undefined, links.length > 0 ? links : undefined, atts.length > 0 ? atts : undefined);
    } else {
      toggleTicketTimer(pendingTicket.id, pendingTicket.title, undefined, comment || undefined, links.length > 0 ? links : undefined, atts.length > 0 ? atts : undefined);
    }

    setIsModalOpen(false);
    setPendingTicket(null);
    setComment('');
    setLinks([]);
    setLinkInput('');
    pastedImages.forEach(url => URL.revokeObjectURL(url));
    setPastedImages([]);
    setAttachedFiles([]);
  };

  const handleShareToTimehuddle = async (ticketId: string) => {
    try {
      await ticketsApi.shareToTimehuddle(ticketId);
      fetchTickets();
    } catch (error: any) {
      console.error('Failed to share:', error);
    }
  };

  return (
    <>
    <Modal
      isOpen={showClockInWarning}
      onClose={() => setShowClockInWarning(false)}
      title="Clock In Required"
    >
      <div className="space-y-4">
        <SmallMuted className="text-sm">
          You must be clocked in to start a ticket timer. Would you like to clock in now?
        </SmallMuted>
        <div className="flex justify-end gap-3 mt-6">
          <Button
            variant="ghost"
            onClick={() => setShowClockInWarning(false)}
          >
            Cancel
          </Button>
          <Button
            onClick={() => {
              toggleSession();
              setShowClockInWarning(false);
            }}
          >
            Clock In
          </Button>
        </div>
      </div>
    </Modal>
    <Card className="p-4 md:p-6 relative">
      <div className="flex items-center justify-between mb-4 md:mb-6">
        <Text className="text-lg md:text-xl font-bold">My Tickets</Text>
        <div className="flex items-center gap-2">
          <div className="flex gap-2">
            <Link href="/dashboard/tickets/create">
              <Button
                size="icon"
                aria-label="Create new ticket"
              >
                <Plus className="w-5 h-5" />
              </Button>
            </Link>
          </div>
          <Link href="/dashboard/tickets" className="hidden md:flex items-center text-sm text-primary-700 dark:text-primary-400 hover:underline ml-2">
            See All <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      <div className="space-y-3">
        {isLoading ? (
          <SmallMuted className="text-center py-4 block">Loading tickets...</SmallMuted>
        ) : tickets.length === 0 ? (
          <SmallMuted className="text-center py-4 block">No tickets found. Create one to get started!</SmallMuted>
        ) : (
          tickets
            .slice()
            .sort((a, b) => {
              if (a.id === activeTicketId) return -1;
              if (b.id === activeTicketId) return 1;
              return 0;
            })
            .slice(0, 5).map((ticket) => {
            const isTimehuddle = ticket.source === 'timehuddle';
            const isPersonal = !isTimehuddle;
            const assignerName = ticket.creator?.full_name?.split(' ')[0] || 'Someone';

            return (
              <Card key={ticket.id} className={`border transition-all duration-300 ${activeTicketId === ticket.id ? 'ring-2 ring-primary-500 border-primary-500 bg-primary-50 dark:bg-primary-950/20' : ''}`}>
                <CardContent className="space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <Text className="text-base font-bold leading-tight">
                      {ticket.title}
                    </Text>
                    <Badge
                      variant={
                        ticket.status === 'Open'
                          ? 'secondary'
                          : ticket.status === 'In Progress'
                            ? 'warning'
                            : 'success'
                      }
                      size="sm"
                    >
                      {getStatusDisplay(ticket.status)}
                    </Badge>
                  </div>

                  <SmallMuted className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    {isTimehuddle ? (
                      <>
                        <span className="flex items-center gap-1">
                          <Users className="w-3.5 h-3.5" />
                          {ticket.teamName}
                        </span>
                        <span>&middot;</span>
                        <span>Assigned by {assignerName}</span>
                        <span>&middot;</span>
                      </>
                    ) : (
                      <>
                        <span className="flex items-center gap-1">
                          &#128100; Personal ticket
                        </span>
                        <span>&middot;</span>
                      </>
                    )}
                    <span>{(ticketDurations[ticket.id] ? formatDuration(ticketDurations[ticket.id]) : ticket.trackedTime) || '0m'} tracked</span>
                    {isTimehuddle && ticket.syncedWithTimehuddle && (
                      <Badge variant="default" size="sm" icon={<RefreshCw className="w-3 h-3" />}>
                        synced
                      </Badge>
                    )}
                  </SmallMuted>

                  {ticket.pulseVideo ? (
                    <div className="flex items-center gap-3 bg-muted rounded-xl px-4 py-3">
                      <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary-600">
                        <Play className="w-5 h-5 text-white fill-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 text-primary-600 dark:text-primary-400">
                          <Video className="w-4 h-4" />
                          <Text className="text-sm font-semibold text-primary-600 dark:text-primary-400">
                            Pulse Video
                          </Text>
                        </div>
                        <SmallMuted>
                          Recorded {formatRelativeTime(ticket.pulseVideo.recordedAt)}{' '}
                          &middot; {ticket.pulseVideo.duration}
                        </SmallMuted>
                      </div>
                      <a
                        href={ticket.pulseVideo.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-muted-foreground underline decoration-dashed underline-offset-2 hover:text-foreground shrink-0"
                      >
                        Open Vault &#8599;
                      </a>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-full border-dashed border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 bg-transparent hover:bg-red-50 dark:hover:bg-red-950"
                    >
                      <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                      Record Pulse
                    </Button>
                  )}

                  <div className="flex items-center gap-2 pt-1">
                    <div className="flex flex-col items-start gap-1">
                      <Button
                        variant={activeTicketId === ticket.id ? 'danger' : 'secondary'}
                        size="sm"
                        onClick={(e) => handleTicketClick(e, ticket.id, ticket.title)}
                        className="rounded-full px-3 py-1 text-xs font-medium"
                      >
                        {activeTicketId === ticket.id ? (
                          <>
                            <Square className="w-3 h-3 mr-1 fill-current" /> Stop
                          </>
                        ) : (
                          <>
                            <Play className="w-3 h-3 mr-1 fill-current" /> Start
                          </>
                        )}
                      </Button>

                      {activeTicketId === ticket.id && (
                        <SmallMuted className="flex items-center gap-1 font-mono text-primary-600 dark:text-primary-400">
                          <Clock className="w-3 h-3" />
                          {getFormattedTotalTime(ticket.id)}
                        </SmallMuted>
                      )}
                    </div>

                    {isPersonal && !ticket.sharedToTimehuddle && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleShareToTimehuddle(ticket.id)}
                        className="rounded-full ml-auto whitespace-nowrap"
                      >
                        <Share2 className="w-3 h-3 mr-1" /> Share to Timehuddle
                      </Button>
                    )}

                    {isPersonal && ticket.sharedToTimehuddle && (
                      <Badge
                        variant="success"
                        size="sm"
                        icon={<Check className="w-3 h-3" />}
                        className="ml-auto"
                      >
                        Shared
                      </Badge>
                    )}

                    {isTimehuddle && (
                      <Badge
                        variant="warning"
                        size="sm"
                        icon={<Users className="w-3 h-3" />}
                        className="ml-auto"
                      >
                        Timehuddle
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
      
      <div className="mt-4 md:hidden text-center">
        <Link href="/dashboard/tickets">
          <Button variant="link" size="sm">See All Tickets</Button>
        </Link>
      </div>
    </Card>

    <Modal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setLinks([]); setLinkInput(''); pastedImages.forEach(u => URL.revokeObjectURL(u)); setPastedImages([]); setAttachedFiles([]); }}
        title={modalType === 'stop' ? 'Stop Timer?' : 'Switching Tasks'}
      >
        <div className="space-y-4">
          <SmallMuted>
            {modalType === 'stop' 
              ? 'Enter a comment for this session:' 
              : 'Enter a comment for the current task before switching:'}
          </SmallMuted>
          <div
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const files = Array.from(e.dataTransfer.files);
              for (const file of files) {
                if (file.type.startsWith('image/')) {
                  setPastedImages(prev => [...prev, URL.createObjectURL(file)]);
                } else {
                  setAttachedFiles(prev => [...prev, file]);
                }
              }
            }}
          >
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              onPaste={(e) => {
                const items = e.clipboardData?.items;
                if (!items) return;
                for (const item of Array.from(items)) {
                  if (item.type.startsWith('image/')) {
                    e.preventDefault();
                    const file = item.getAsFile();
                    if (file) setPastedImages(prev => [...prev, URL.createObjectURL(file)]);
                  }
                }
              }}
              placeholder="What did you work on?"
              className="w-full h-32"
              autoFocus
            />
          </div>
          {/* Attachments preview */}
          {(pastedImages.length > 0 || attachedFiles.length > 0) && (
            <div className="flex flex-wrap gap-2">
              {pastedImages.map((url, i) => (
                <div key={`img-${i}`} className="relative group">
                  <img src={url} alt={`Image ${i + 1}`} className="w-16 h-16 object-cover rounded-lg border border-gray-200 dark:border-gray-700" />
                  <button
                    type="button"
                    onClick={() => { URL.revokeObjectURL(url); setPastedImages(prev => prev.filter((_, idx) => idx !== i)); }}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label="Remove image"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              {attachedFiles.map((file, i) => (
                <div key={`file-${i}`} className="relative group flex items-center gap-1.5 px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                  <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="text-xs truncate max-w-[120px]">{file.name}</span>
                  <button
                    type="button"
                    onClick={() => setAttachedFiles(prev => prev.filter((_, idx) => idx !== i))}
                    className="w-4 h-4 rounded-full text-red-500 flex items-center justify-center shrink-0"
                    aria-label="Remove file"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
          {/* Attach button */}
          <div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Paperclip className="w-3.5 h-3.5" /> Attach image or document
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf,.doc,.docx,.txt,.md"
              multiple
              className="hidden"
              onChange={(e) => {
                const files = Array.from(e.target.files || []);
                for (const file of files) {
                  if (file.type.startsWith('image/')) {
                    setPastedImages(prev => [...prev, URL.createObjectURL(file)]);
                  } else {
                    setAttachedFiles(prev => [...prev, file]);
                  }
                }
                if (fileInputRef.current) fileInputRef.current.value = '';
              }}
            />
          </div>
          <div>
            <SmallMuted className="block text-xs font-medium mb-1">Links (optional)</SmallMuted>
            {links.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {links.map((l, i) => (
                  <div key={i} className="flex items-center gap-1 px-2 py-1 rounded-md bg-gray-100 dark:bg-gray-800 text-xs">
                    <Link2 className="w-3 h-3 text-muted-foreground shrink-0" />
                    <span className="truncate max-w-[200px]">{l}</span>
                    <button type="button" onClick={() => setLinks(prev => prev.filter((_, idx) => idx !== i))} className="text-red-500 shrink-0" aria-label="Remove link">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <Input
              type="url"
              value={linkInput}
              onChange={(e) => setLinkInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && linkInput.trim()) {
                  e.preventDefault();
                  setLinks(prev => [...prev, linkInput.trim()]);
                  setLinkInput('');
                }
              }}
              onPaste={(e) => {
                const text = e.clipboardData?.getData('text');
                if (text?.trim()) {
                  e.preventDefault();
                  setLinks(prev => [...prev, text.trim()]);
                }
              }}
              placeholder="Paste a link and press Enter..."
            />
          </div>
          <div className="flex justify-end gap-3">
            <Button
              variant="ghost"
              onClick={() => setIsModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirm}
              variant={modalType === 'stop' ? 'danger' : 'primary'}
            >
              {modalType === 'stop' ? 'Stop Timer' : 'Switch Task'}
            </Button>
          </div>
        </div>
      </Modal>


    </>
  );
}
