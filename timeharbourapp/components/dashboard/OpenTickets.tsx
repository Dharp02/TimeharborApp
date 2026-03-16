'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Plus, Search, Ticket, Play, Square, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { Button, Input, Textarea } from '@mieweb/ui';
import { useClockIn } from './ClockInContext';
import PulseButton from '@/components/dashboard/PulseButton';
import { Modal } from '@/components/ui/Modal';
import { useTeam } from './TeamContext';
import { tickets as ticketsApi } from '@/TimeharborAPI';
import { Ticket as TicketType } from '@/TimeharborAPI/tickets';
import { useActivityLog } from './ActivityLogContext';
import { useRefresh } from '../../contexts/RefreshContext';
import { db } from '@/TimeharborAPI/db';

const getUserInitials = (name?: string, email?: string) => {
  if (name && name.trim()) {
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return parts[0].substring(0, 2).toUpperCase();
  }
  if (email) {
    return email.substring(0, 2).toUpperCase();
  }
  return 'U';
};

export default function OpenTickets() {
  const { isSessionActive, isOnBreak, activeTicketId, toggleTicketTimer, ticketDuration, getFormattedTotalTime, toggleSession } = useClockIn();
  const { currentTeam } = useTeam();
  const { addActivity } = useActivityLog();
  const { register, lastRefreshed } = useRefresh();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAddTicketModalOpen, setIsAddTicketModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'stop' | 'switch'>('stop');
  const [comment, setComment] = useState('');
  const [link, setLink] = useState('');
  const [pendingTicket, setPendingTicket] = useState<{id: string, title: string} | null>(null);
  const [newTicket, setNewTicket] = useState({ title: '', description: '', status: 'Open', reference: '' });
  const [tickets, setTickets] = useState<TicketType[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showClockInWarning, setShowClockInWarning] = useState(false);

  const isMountedRef = useRef(true);

  const PERSONAL_TEAM_ID = '__personal__';

  const fetchTickets = useCallback(async () => {
    try {
      const fetchedTickets = currentTeam?.id
        ? await ticketsApi.getTickets(currentTeam.id, { sort: 'recent', status: 'open' })
        : await ticketsApi.getPersonalTickets({ sort: 'recent', status: 'open' });
      if (isMountedRef.current) {
        setTickets(fetchedTickets);
        db.tickets.bulkPut(fetchedTickets as any).catch(() => {});
      }
    } catch (error) {
      console.error('Failed to load tickets:', error);
    } finally {
      if (isMountedRef.current) setIsLoading(false);
    }
  }, [currentTeam?.id]);

  useEffect(() => {
    isMountedRef.current = true;

    // Read Dexie cache immediately — tickets appear instantly on repeat visits
    const cacheTeamId = currentTeam?.id || PERSONAL_TEAM_ID;
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

    return () => {
      isMountedRef.current = false;
      unregister();
      window.removeEventListener('pull-to-refresh', handleRefresh);
    };
  }, [currentTeam?.id, register, lastRefreshed, fetchTickets]);

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
        toggleTicketTimer(ticketId, ticketTitle, currentTeam?.id);
      }
    }
  };

  const handleConfirm = () => {
    if (!pendingTicket) return;

    if (modalType === 'stop') {
      // Stop the ticket (comment optional)
      toggleTicketTimer(pendingTicket.id, pendingTicket.title, undefined, comment || undefined, link || undefined);
    } else {
      // Switch to a new ticket
      toggleTicketTimer(pendingTicket.id, pendingTicket.title, currentTeam?.id, comment || undefined, link || undefined);
    }

    setIsModalOpen(false);
    setPendingTicket(null);
    setComment('');
    setLink('');
  };

  return (
    <>
    <Modal
      isOpen={showClockInWarning}
      onClose={() => setShowClockInWarning(false)}
      title="Clock In Required"
    >
      <div className="space-y-4">
        <p className="text-gray-600 dark:text-gray-300">
          You must be clocked in to start a ticket timer. Would you like to clock in now?
        </p>
        <div className="flex justify-end gap-3 mt-6">
          <Button
            variant="ghost"
            onClick={() => setShowClockInWarning(false)}
          >
            Cancel
          </Button>
          <Button
            onClick={() => {
              toggleSession(currentTeam?.id);
              setShowClockInWarning(false);
            }}
          >
            Clock In
          </Button>
        </div>
      </div>
    </Modal>
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-4 md:p-6 relative">
      <div className="flex items-center justify-between mb-4 md:mb-6">
        <h2 className="text-lg md:text-xl font-bold text-gray-900 dark:text-white">Open Tickets</h2>
        <div className="flex items-center gap-2">
          <div className="flex gap-2">
            <Link href="/dashboard/tickets/create">
              <Button
                disabled={!currentTeam}
                className="p-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors shadow-sm"
                aria-label="Create new ticket"
              >
                <Plus className="w-5 h-5" />
              </Button>
            </Link>
          </div>
          <Link href="/dashboard/tickets" className="hidden md:flex items-center text-sm text-primary-600 dark:text-primary-400 hover:underline ml-2">
            See All <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      <div className="space-y-3">
        {isLoading ? (
          <div className="text-center py-4 text-gray-500">Loading tickets...</div>
        ) : tickets.length === 0 ? (
          <div className="text-center py-4 text-gray-500">No tickets found. Create one to get started!</div>
        ) : (
          tickets.slice(0, 5).map((ticket) => (
            <div 
              key={ticket.id}
            className="flex items-center justify-between p-3 md:p-4 bg-gray-50 dark:bg-gray-700/30 rounded-xl border border-gray-100 dark:border-gray-700 hover:border-primary-200 dark:hover:border-primary-800 transition-colors cursor-pointer group"
          >
            <div className="flex items-center gap-3 md:gap-4 overflow-hidden flex-1">
              <div className="p-2 bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 rounded-lg shrink-0">
                <Ticket className="w-4 h-4 md:w-5 md:h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="font-medium text-gray-900 dark:text-white truncate text-sm md:text-base">
                  {ticket.title}
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  {ticket.creator && (
                    <>
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">Created by</span>
                        <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-primary-500 to-primary-700 flex items-center justify-center text-[10px] font-bold text-white shadow-sm ring-1 ring-white dark:ring-gray-700 shrink-0 transform hover:scale-105 transition-transform cursor-help" title={ticket.creator.full_name}>
                          {getUserInitials(ticket.creator.full_name, ticket.creator.email)}
                        </div>
                      </div>
                      <span className="text-xs text-gray-400 dark:text-gray-500">•</span>
                    </>
                  )}
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
                    {getFormattedTotalTime(ticket.id)}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3 shrink-0 ml-2">
              <span className="hidden md:inline-block text-xs font-medium px-2 py-1 bg-white dark:bg-gray-600 rounded-md border border-gray-200 dark:border-gray-500 text-gray-600 dark:text-gray-300">
                {ticket.status}
              </span>
              {currentTeam && (
                <PulseButton teamId={currentTeam.id} ticketId={ticket.id} />
              )}
              <div className="flex flex-col items-center gap-1 min-w-[60px]">
                <Button 
                  variant="ghost"
                  size="icon"
                  onClick={(e) => handleTicketClick(e, ticket.id, ticket.title)}
                  className={`p-2 rounded-full transition-colors ${
                    !isSessionActive || isOnBreak
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed dark:bg-gray-700 dark:text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600'
                      : activeTicketId === ticket.id
                        ? 'bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40'
                        : 'bg-primary-50 text-primary-600 hover:bg-primary-100 dark:bg-primary-900/20 dark:text-primary-400 dark:hover:bg-primary-900/40'
                  }`}
                >
                  {activeTicketId === ticket.id ? (
                    <Square className="w-4 h-4 fill-current" />
                  ) : (
                    <Play className="w-4 h-4 fill-current" />
                  )}
                </Button>
                {activeTicketId === ticket.id && (
                  <span className="text-[10px] font-mono font-bold text-red-600 dark:text-red-400 animate-pulse">
                    {ticketDuration}
                  </span>
                )}
              </div>
            </div>
          </div>
          ))
        )}
      </div>
      
      <div className="mt-4 md:hidden text-center">
        <Link href="/dashboard/tickets" className="text-sm text-primary-600 dark:text-primary-400 font-medium">
          See All Tickets
        </Link>
      </div>
    </div>

    <Modal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setLink(''); }}
        title={modalType === 'stop' ? 'Stop Timer?' : 'Switching Tasks'}
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            {modalType === 'stop' 
              ? 'Enter a comment for this session:' 
              : 'Enter a comment for the current task before switching:'}
          </p>
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="What did you work on?"
            className="w-full h-32"
            autoFocus
          />
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Link (optional)</label>
            <Input
              type="url"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="Paste a YouTube or Pulse link..."
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
