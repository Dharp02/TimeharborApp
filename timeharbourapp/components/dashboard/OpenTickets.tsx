'use client';

import { useState } from 'react';
import { Plus, Search, Ticket, Play, Square, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useClockIn } from './ClockInContext';
import { Modal } from '@/components/ui/Modal';

export default function OpenTickets() {
  const { isSessionActive, activeTicketId, toggleTicketTimer, ticketDuration, getFormattedTotalTime } = useClockIn();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'stop' | 'switch'>('stop');
  const [comment, setComment] = useState('');
  const [pendingTicket, setPendingTicket] = useState<{id: string, title: string} | null>(null);

  // Mock data for tickets
  const tickets = [
    { id: 'T-101', title: 'Fix login page responsiveness', status: 'In Progress' },
    { id: 'T-102', title: 'Update user profile API', status: 'Open' },
    { id: 'T-103', title: 'Design dashboard mockups', status: 'Review' },
    { id: 'T-104', title: 'Implement dark mode', status: 'Open' },
    { id: 'T-105', title: 'Fix navigation bug', status: 'In Progress' },
    { id: 'T-106', title: 'Add unit tests', status: 'Open' },
  ];

  const handleTicketClick = (e: React.MouseEvent, ticketId: string, ticketTitle: string) => {
    e.stopPropagation();
    
    if (!isSessionActive) return;

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

  const handleConfirm = () => {
    if (!pendingTicket) return;

    if (modalType === 'stop') {
      toggleTicketTimer(pendingTicket.id, pendingTicket.title, comment);
    } else {
      toggleTicketTimer(pendingTicket.id, pendingTicket.title, comment);
    }

    setIsModalOpen(false);
    setPendingTicket(null);
    setComment('');
  };

  return (
    <>
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-4 md:p-6">
      <div className="flex items-center justify-between mb-4 md:mb-6">
        <h2 className="text-lg md:text-xl font-bold text-gray-900 dark:text-white">Open Tickets</h2>
        <div className="flex items-center gap-2">
          <div className="flex gap-2">
            <button className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
              <Search className="w-5 h-5" />
            </button>
            <button className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
              <Plus className="w-5 h-5" />
            </button>
          </div>
          <Link href="/dashboard/tickets" className="hidden md:flex items-center text-sm text-blue-600 dark:text-blue-400 hover:underline ml-2">
            See All <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      <div className="space-y-3">
        {tickets.slice(0, 5).map((ticket) => (
          <div 
            key={ticket.id}
            className="flex items-center justify-between p-3 md:p-4 bg-gray-50 dark:bg-gray-700/30 rounded-xl border border-gray-100 dark:border-gray-700 hover:border-blue-200 dark:hover:border-blue-800 transition-colors cursor-pointer group"
          >
            <div className="flex items-center gap-3 md:gap-4 overflow-hidden flex-1">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg shrink-0">
                <Ticket className="w-4 h-4 md:w-5 md:h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="font-medium text-gray-900 dark:text-white truncate text-sm md:text-base">
                  {ticket.title}
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs font-mono text-gray-500 dark:text-gray-400">{ticket.id}</span>
                  <span className="text-xs text-gray-400 dark:text-gray-500">•</span>
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
              <div className="flex flex-col items-center gap-1 min-w-[60px]">
                <button 
                  onClick={(e) => handleTicketClick(e, ticket.id, ticket.title)}
                  disabled={!isSessionActive}
                  className={`p-2 rounded-full transition-colors ${
                    !isSessionActive 
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed dark:bg-gray-700 dark:text-gray-500'
                      : activeTicketId === ticket.id
                        ? 'bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40'
                        : 'bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/40'
                  }`}
                >
                  {activeTicketId === ticket.id ? (
                    <Square className="w-4 h-4 fill-current" />
                  ) : (
                    <Play className="w-4 h-4 fill-current" />
                  )}
                </button>
                {activeTicketId === ticket.id && (
                  <span className="text-[10px] font-mono font-bold text-red-600 dark:text-red-400 animate-pulse">
                    {ticketDuration}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      
      <div className="mt-4 md:hidden text-center">
        <Link href="/dashboard/tickets" className="text-sm text-blue-600 dark:text-blue-400 font-medium">
          See All Tickets
        </Link>
      </div>
    </div>

    <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={modalType === 'stop' ? 'Stop Timer?' : 'Switching Tasks'}
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            {modalType === 'stop' 
              ? 'Enter a comment for this session:' 
              : 'Enter a comment for the current task before switching:'}
          </p>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="What did you work on?"
            className="w-full h-32 p-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            autoFocus
          />
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors ${
                modalType === 'stop'
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {modalType === 'stop' ? 'Stop Timer' : 'Switch Task'}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
