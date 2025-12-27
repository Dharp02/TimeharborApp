'use client';

import { useState } from 'react';
import { Plus, Search, Ticket, Play, Square, Filter, MoreHorizontal, Clock } from 'lucide-react';
import { useClockIn } from '@/components/dashboard/ClockInContext';
import { Modal } from '@/components/ui/Modal';

export default function TicketsPage() {
  const { isSessionActive, activeTicketId, toggleTicketTimer, ticketDuration, getFormattedTotalTime } = useClockIn();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAddTicketModalOpen, setIsAddTicketModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'stop' | 'switch'>('stop');
  const [comment, setComment] = useState('');
  const [pendingTicket, setPendingTicket] = useState<{id: string, title: string} | null>(null);
  const [newTicket, setNewTicket] = useState({ title: '', description: '', status: 'Open', reference: '' });
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('All');

  // Mock data for tickets
  const allTickets = [
    { id: 'T-101', title: 'Fix login page responsiveness', status: 'In Progress', priority: 'High', assignee: 'JD' },
    { id: 'T-102', title: 'Update user profile API', status: 'Open', priority: 'Medium', assignee: 'JD' },
    { id: 'T-103', title: 'Design dashboard mockups', status: 'Review', priority: 'High', assignee: 'AS' },
    { id: 'T-104', title: 'Implement dark mode', status: 'Open', priority: 'Low', assignee: 'JD' },
    { id: 'T-105', title: 'Fix navigation bug', status: 'In Progress', priority: 'Critical', assignee: 'JD' },
    { id: 'T-106', title: 'Add unit tests', status: 'Open', priority: 'Medium', assignee: 'TS' },
    { id: 'T-107', title: 'Refactor auth context', status: 'Completed', priority: 'High', assignee: 'JD' },
    { id: 'T-108', title: 'Update documentation', status: 'Open', priority: 'Low', assignee: 'AS' },
    { id: 'T-109', title: 'Optimize image loading', status: 'In Progress', priority: 'Medium', assignee: 'TS' },
  ];

  const tabs = ['All', 'Open', 'In Progress', 'Review', 'Completed'];

  const filteredTickets = allTickets.filter(ticket => {
    const matchesSearch = ticket.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          ticket.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTab = activeTab === 'All' || ticket.status === activeTab;
    return matchesSearch && matchesTab;
  });

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

  const handleAddTicket = () => {
    // Here you would typically call an API to create the ticket
    console.log('Creating ticket:', newTicket);
    setIsAddTicketModalOpen(false);
    setNewTicket({ title: '', description: '', status: 'Open', reference: '' });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Open': return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300';
      case 'In Progress': return 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400';
      case 'Review': return 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400';
      case 'Completed': return 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'Critical': return 'text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400';
      case 'High': return 'text-orange-600 bg-orange-50 dark:bg-orange-900/20 dark:text-orange-400';
      case 'Medium': return 'text-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400';
      case 'Low': return 'text-gray-600 bg-gray-50 dark:bg-gray-800 dark:text-gray-400';
      default: return 'text-gray-600';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Tickets</h1>
          <p className="text-gray-500 dark:text-gray-400">Manage and track your tasks</p>
        </div>
        <button 
          onClick={() => setIsAddTicketModalOpen(true)}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors shadow-sm"
        >
          <Plus className="w-5 h-5" />
          <span>New Ticket</span>
        </button>
      </div>

      {/* Filters and Search */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-4">
        <div className="flex flex-col md:flex-row gap-4 justify-between">
          {/* Tabs */}
          <div className="flex overflow-x-auto pb-2 md:pb-0 gap-2 no-scrollbar">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  activeTab === tab
                    ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                    : 'text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-700/50'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Search and Filter Actions */}
          <div className="flex gap-2">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search tickets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>
            <button className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-700 transition-colors">
              <Filter className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Ticket List */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          {filteredTickets.length > 0 ? (
            filteredTickets.map((ticket) => (
              <div 
                key={ticket.id}
                className={`group p-4 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors ${
                  activeTicketId === ticket.id ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''
                }`}
              >
                <div className="flex items-center gap-4">
                  {/* Status Icon/Action */}
                  <button
                    onClick={(e) => handleTicketClick(e, ticket.id, ticket.title)}
                    disabled={!isSessionActive}
                    className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                      activeTicketId === ticket.id
                        ? 'bg-blue-600 text-white shadow-md scale-105'
                        : 'bg-gray-100 text-gray-400 hover:bg-blue-100 hover:text-blue-600 dark:bg-gray-700 dark:text-gray-500 dark:hover:bg-blue-900/30 dark:hover:text-blue-400'
                    } ${!isSessionActive ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    {activeTicketId === ticket.id ? (
                      <Square className="w-4 h-4 fill-current" />
                    ) : (
                      <Play className="w-4 h-4 fill-current ml-0.5" />
                    )}
                  </button>

                  {/* Ticket Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                        {ticket.id}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(ticket.status)}`}>
                        {ticket.status}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(ticket.priority)}`}>
                        {ticket.priority}
                      </span>
                    </div>
                    <h3 className="text-base font-medium text-gray-900 dark:text-white truncate">
                      {ticket.title}
                    </h3>
                  </div>

                  {/* Meta Info (Hidden on mobile) */}
                  <div className="hidden md:flex items-center gap-6 text-sm text-gray-500 dark:text-gray-400">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-xs font-medium">
                        {ticket.assignee}
                      </div>
                    </div>
                    {activeTicketId === ticket.id && (
                      <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-medium font-mono">
                        <Clock className="w-4 h-4" />
                        {getFormattedTotalTime()}
                      </div>
                    )}
                  </div>

                  {/* Actions Menu */}
                  <button className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                    <MoreHorizontal className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              <Ticket className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p>No tickets found matching your criteria</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal for Stopping/Switching Tickets */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={modalType === 'stop' ? 'Stop Working' : 'Switch Ticket'}
      >
        <div className="space-y-4">
          <p className="text-gray-600 dark:text-gray-300">
            {modalType === 'stop' 
              ? 'Are you sure you want to stop working on this ticket?' 
              : 'You are currently working on another ticket. Do you want to switch?'}
          </p>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Work Description (Optional)
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="What did you work on?"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <button
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              {modalType === 'stop' ? 'Stop Timer' : 'Switch & Start'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Add Ticket Modal */}
      <Modal
        isOpen={isAddTicketModalOpen}
        onClose={() => setIsAddTicketModalOpen(false)}
        title="Add Ticket"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-2 -mt-2 mb-4 text-gray-500 dark:text-gray-400">
            <Ticket className="w-5 h-5 text-green-500" />
            <p className="text-sm">Create a new ticket to track your work.</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Title
              </label>
              <input
                type="text"
                value={newTicket.title}
                onChange={(e) => setNewTicket({ ...newTicket, title: e.target.value })}
                placeholder="Enter ticket title"
                className="w-full px-3 py-2 bg-transparent border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 dark:text-white placeholder-gray-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description (optional)
              </label>
              <textarea
                value={newTicket.description}
                onChange={(e) => setNewTicket({ ...newTicket, description: e.target.value })}
                placeholder="Add more details..."
                className="w-full px-3 py-2 bg-transparent border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 dark:text-white placeholder-gray-500 min-h-[100px]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Reference Link (optional)
              </label>
              <input
                type="url"
                value={newTicket.reference}
                onChange={(e) => setNewTicket({ ...newTicket, reference: e.target.value })}
                placeholder="https://..."
                className="w-full px-3 py-2 bg-transparent border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 dark:text-white placeholder-gray-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Status
              </label>
              <select
                value={newTicket.status}
                onChange={(e) => setNewTicket({ ...newTicket, status: e.target.value })}
                className="w-full px-3 py-2 bg-transparent border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 dark:text-white"
              >
                <option value="Open">Open</option>
                <option value="In Progress">In Progress</option>
                <option value="Review">Review</option>
                <option value="Completed">Completed</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-3 mt-6">
            <button
              onClick={handleAddTicket}
              className="w-full px-4 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors"
            >
              Create Ticket
            </button>
            <button
              onClick={() => setIsAddTicketModalOpen(false)}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
