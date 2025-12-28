'use client';

import { useState, useEffect } from 'react';
import { Plus, Search, Ticket, Play, Square, Filter, MoreHorizontal, Clock, UserPlus, Trash2, User, ArrowRightLeft, Check, Edit2, ExternalLink, AlignLeft } from 'lucide-react';
import { useClockIn } from '@/components/dashboard/ClockInContext';
import { useTeam } from '@/components/dashboard/TeamContext';
import { useAuth } from '@/components/auth/AuthProvider';
import { Modal } from '@/components/ui/Modal';
import { tickets as ticketsApi } from '@/TimeharborAPI';
import { Ticket as TicketType, CreateTicketData, UpdateTicketData } from '@/TimeharborAPI/tickets';

export default function TicketsPage() {
  const { isSessionActive, activeTicketId, toggleTicketTimer, ticketDuration, getFormattedTotalTime } = useClockIn();
  const { currentTeam } = useTeam();
  const { user } = useAuth();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAddTicketModalOpen, setIsAddTicketModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  
  const [modalType, setModalType] = useState<'stop' | 'switch'>('stop');
  const [comment, setComment] = useState('');
  const [pendingTicket, setPendingTicket] = useState<{id: string, title: string} | null>(null);
  const [newTicket, setNewTicket] = useState({ title: '', description: '', status: 'Open', priority: 'Medium', reference: '' });
  const [isEditing, setIsEditing] = useState(false);
  const [editingTicketId, setEditingTicketId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('All');
  
  const [openMenuTicketId, setOpenMenuTicketId] = useState<string | null>(null);
  const [selectedTicketForAction, setSelectedTicketForAction] = useState<{id: string, title: string} | null>(null);
  const [detailTicketId, setDetailTicketId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Mock data for tickets
  const [allTickets, setAllTickets] = useState<any[]>([]);

  useEffect(() => {
    if (currentTeam) {
      loadTickets();
    } else {
      setAllTickets([]);
    }
  }, [currentTeam]);

  const loadTickets = async () => {
    if (!currentTeam) return;
    setIsLoading(true);
    try {
      const fetchedTickets = await ticketsApi.getTickets(currentTeam.id);
      // Map API response to component state structure if needed, or use directly
      // The API returns TicketType, but the component uses a slightly different structure (assignee initials vs object)
      // Let's adapt the data
      const mappedTickets = fetchedTickets.map(t => ({
        id: t.id,
        title: t.title,
        status: t.status,
        priority: t.priority,
        assignee: t.assignee ? t.assignee.full_name.split(' ').map((n: string) => n[0]).join('').toUpperCase().substring(0, 2) : 'UN',
        assigneeName: t.assignee ? t.assignee.full_name : 'Unassigned',
        description: t.description || '',
        reference: t.link || '',
        createdAt: t.createdAt,
        createdBy: t.createdBy
      }));
      setAllTickets(mappedTickets);
    } catch (error) {
      console.error('Failed to load tickets:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const tabs = ['All', 'Open', 'In Progress', 'Closed'];

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

  const handleAddTicket = async () => {
    if (!currentTeam) return;

    try {
      if (isEditing && editingTicketId) {
        // Update existing ticket
        const updateData: UpdateTicketData = {
          title: newTicket.title,
          description: newTicket.description,
          status: newTicket.status as any,
          priority: newTicket.priority as any,
          link: newTicket.reference
        };
        await ticketsApi.updateTicket(currentTeam.id, editingTicketId, updateData);
      } else {
        // Create new ticket
        const ticketData: CreateTicketData = {
          title: newTicket.title,
          description: newTicket.description,
          status: newTicket.status as any,
          priority: newTicket.priority as any,
          link: newTicket.reference
        };
        await ticketsApi.createTicket(currentTeam.id, ticketData);
      }
      
      setIsAddTicketModalOpen(false);
      setNewTicket({ title: '', description: '', status: 'Open', priority: 'Medium', reference: '' });
      setIsEditing(false);
      setEditingTicketId(null);
      loadTickets();
    } catch (error: any) {
      console.error('Failed to save ticket:', error);
      alert(error.message || 'Failed to save ticket');
    }
  };

  const openEditModal = (ticket: any) => {
    setNewTicket({
      title: ticket.title,
      description: ticket.description || '',
      status: ticket.status,
      priority: ticket.priority,
      reference: ticket.reference || ''
    });
    setIsEditing(true);
    setEditingTicketId(ticket.id);
    setIsAddTicketModalOpen(true);
    setIsDetailModalOpen(false); // Close detail modal if open
    setOpenMenuTicketId(null);
  };

  const openDetails = (ticketId: string) => {
    setDetailTicketId(ticketId);
    setIsDetailModalOpen(true);
  };

  const handleAssignTicket = async (memberId: string, memberName: string) => {
    if (selectedTicketForAction && currentTeam) {
      try {
        await ticketsApi.updateTicket(currentTeam.id, selectedTicketForAction.id, {
          assignedTo: memberId
        });
        setIsAssignModalOpen(false);
        setSelectedTicketForAction(null);
        setOpenMenuTicketId(null);
        loadTickets();
      } catch (error: any) {
        console.error('Failed to assign ticket:', error);
        alert(error.message || 'Failed to assign ticket');
      }
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (selectedTicketForAction && currentTeam) {
      try {
        await ticketsApi.updateTicket(currentTeam.id, selectedTicketForAction.id, {
          status: newStatus as any
        });
        setIsStatusModalOpen(false);
        setSelectedTicketForAction(null);
        setOpenMenuTicketId(null);
        loadTickets();
      } catch (error: any) {
        console.error('Failed to update status:', error);
        alert(error.message || 'Failed to update status');
      }
    }
  };

  const handleDeleteTicket = async () => {
    if (selectedTicketForAction && currentTeam) {
      try {
        await ticketsApi.deleteTicket(currentTeam.id, selectedTicketForAction.id);
        setIsDeleteModalOpen(false);
        setSelectedTicketForAction(null);
        setOpenMenuTicketId(null);
        loadTickets();
      } catch (error: any) {
        console.error('Failed to delete ticket:', error);
        alert(error.message || 'Failed to delete ticket');
      }
    }
  };

  const openAssignModal = (e: React.MouseEvent, ticket: {id: string, title: string}) => {
    e.stopPropagation();
    setSelectedTicketForAction(ticket);
    setIsAssignModalOpen(true);
    setOpenMenuTicketId(null);
  };

  const openStatusModal = (e: React.MouseEvent, ticket: {id: string, title: string}) => {
    e.stopPropagation();
    setSelectedTicketForAction(ticket);
    setIsStatusModalOpen(true);
    setOpenMenuTicketId(null);
  };

  const openDeleteModal = (e: React.MouseEvent, ticket: {id: string, title: string}) => {
    e.stopPropagation();
    setSelectedTicketForAction(ticket);
    setIsDeleteModalOpen(true);
    setOpenMenuTicketId(null);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Open': return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300';
      case 'In Progress': return 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400';
      case 'Closed': return 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400';
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
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm min-h-[400px]">
        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          {isLoading ? (
            <div className="p-8 text-center text-gray-500">Loading tickets...</div>
          ) : filteredTickets.length > 0 ? (
            filteredTickets.map((ticket) => (
              <div 
                key={ticket.id}
                onClick={() => openDetails(ticket.id)}
                className={`group p-4 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors first:rounded-t-2xl last:rounded-b-2xl cursor-pointer ${
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
                        {ticket.id.substring(0, 8)}
                      </span>
                      <button 
                        onClick={(e) => openStatusModal(e, ticket)}
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(ticket.status)} hover:opacity-80 transition-opacity`}
                      >
                        {ticket.status}
                      </button>
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
                        {getFormattedTotalTime(ticket.id)}
                      </div>
                    )}
                  </div>

                  {/* Actions Menu */}
                  <div className="relative">
                    {/* Mobile Menu Button */}
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        openDetails(ticket.id);
                      }}
                      className="md:hidden p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      <MoreHorizontal className="w-5 h-5" />
                    </button>

                    {/* Desktop Menu Button */}
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenuTicketId(openMenuTicketId === ticket.id ? null : ticket.id);
                      }}
                      className="hidden md:block p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      <MoreHorizontal className="w-5 h-5" />
                    </button>
                    
                    {openMenuTicketId === ticket.id && (
                      <>
                        <div 
                          className="fixed inset-0 z-10" 
                          onClick={(e) => { e.stopPropagation(); setOpenMenuTicketId(null); }} 
                        />
                        <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 z-20 overflow-hidden py-1">
                          {/* Assign - Creator Only */}
                          {user && ticket.createdBy === user.id && (
                            <button
                              onClick={(e) => openAssignModal(e, ticket)}
                              className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-left"
                            >
                              <UserPlus className="w-4 h-4" />
                              Assign Ticket
                            </button>
                          )}

                          {/* Change Status - Everyone */}
                          <button
                            onClick={(e) => openStatusModal(e, ticket)}
                            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-left"
                          >
                            <ArrowRightLeft className="w-4 h-4" />
                            Change Status
                          </button>

                          {/* Edit - Creator Only */}
                          {user && ticket.createdBy === user.id && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                openEditModal(ticket);
                              }}
                              className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-left"
                            >
                              <Edit2 className="w-4 h-4" />
                              Edit Ticket
                            </button>
                          )}
                          
                          {/* Delete - Creator Only */}
                          {user && ticket.createdBy === user.id && (
                            <button
                              onClick={(e) => openDeleteModal(e, ticket)}
                              className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-left"
                            >
                              <Trash2 className="w-4 h-4" />
                              Delete Ticket
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
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
        title={isEditing ? "Edit Ticket" : "Add Ticket"}
      >
        <div className="space-y-4">
          <div className="flex items-center gap-2 -mt-2 mb-4 text-gray-500 dark:text-gray-400">
            <Ticket className="w-5 h-5 text-green-500" />
            <p className="text-sm">{isEditing ? "Update ticket details." : "Create a new ticket to track your work."}</p>
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

            <div className="grid grid-cols-2 gap-4">
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
                <option value="Closed">Closed</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Priority
                </label>
                <select
                  value={newTicket.priority}
                  onChange={(e) => setNewTicket({ ...newTicket, priority: e.target.value })}
                  className="w-full px-3 py-2 bg-transparent border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 dark:text-white"
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                </select>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 mt-6">
            <button
              onClick={handleAddTicket}
              className="w-full px-4 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors"
            >
              {isEditing ? "Update Ticket" : "Create Ticket"}
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
      {/* Assign Ticket Modal */}
      <Modal
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        title="Assign Ticket"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Select a team member to assign <span className="font-semibold">{selectedTicketForAction?.title}</span> to.
          </p>
          
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {currentTeam?.members.map((member) => (
              <button
                key={member.id}
                onClick={() => handleAssignTicket(member.id, member.name)}
                className="w-full flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center text-sm font-medium text-gray-600 dark:text-gray-300">
                    {member.name.charAt(0)}
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{member.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">{member.role}</p>
                  </div>
                </div>
                {member.status === 'online' && (
                  <span className="w-2 h-2 bg-green-500 rounded-full" title="Online" />
                )}
              </button>
            ))}
          </div>

          <div className="flex justify-end mt-6">
            <button
              onClick={() => setIsAssignModalOpen(false)}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </Modal>

      {/* Change Status Modal */}
      <Modal
        isOpen={isStatusModalOpen}
        onClose={() => setIsStatusModalOpen(false)}
        title="Change Status"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Select a new status for <span className="font-semibold">{selectedTicketForAction?.title}</span>.
          </p>
          
          <div className="space-y-2">
            {['Open', 'In Progress', 'Closed'].map((status) => (
              <button
                key={status}
                onClick={() => handleStatusChange(status)}
                className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all ${
                  selectedTicketForAction && allTickets.find(t => t.id === selectedTicketForAction.id)?.status === status
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`w-3 h-3 rounded-full ${
                    status === 'Open' ? 'bg-gray-400' :
                    status === 'In Progress' ? 'bg-blue-500' :
                    'bg-green-500'
                  }`} />
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{status}</span>
                </div>
                {selectedTicketForAction && allTickets.find(t => t.id === selectedTicketForAction.id)?.status === status && (
                  <Check className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                )}
              </button>
            ))}
          </div>

          <div className="flex justify-end mt-6">
            <button
              onClick={() => setIsStatusModalOpen(false)}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </Modal>

      {/* Ticket Details Modal */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        title="Ticket Details"
      >
        {detailTicketId && (() => {
          const ticket = allTickets.find(t => t.id === detailTicketId);
          if (!ticket) return null;
          
          return (
            <div className="space-y-6">
              {/* Header Info */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-mono text-gray-500 dark:text-gray-400">{ticket.id.substring(0, 8)}</span>
                  <div className="flex gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(ticket.status)}`}>
                      {ticket.status}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(ticket.priority)}`}>
                      {ticket.priority}
                    </span>
                  </div>
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white leading-tight">
                  {ticket.title}
                </h3>
              </div>

              {/* Description */}
              <div className="bg-gray-50 dark:bg-gray-700/30 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
                <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Description</h4>
                <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                  {ticket.description || "No description provided."}
                </p>
                {ticket.reference && (
                  <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                    <a 
                      href={ticket.reference} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Reference Link
                    </a>
                  </div>
                )}
              </div>

              {/* Assignee */}
              <div className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-sm font-medium text-gray-600 dark:text-gray-300">
                    {ticket.assignee}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{ticket.assigneeName}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Currently assigned</p>
                  </div>
                </div>
                {user && ticket.createdBy === user.id && (
                  <button 
                    onClick={(e) => {
                      setIsDetailModalOpen(false);
                      openAssignModal(e, ticket);
                    }}
                    className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                  >
                    <UserPlus className="w-5 h-5" />
                  </button>
                )}
              </div>

              {/* Actions Grid */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={(e) => {
                    setIsDetailModalOpen(false);
                    openStatusModal(e, ticket);
                  }}
                  className="flex items-center justify-center gap-2 p-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  <ArrowRightLeft className="w-4 h-4" />
                  Change Status
                </button>
                
                {user && ticket.createdBy === user.id && (
                  <button
                    onClick={() => openEditModal(ticket)}
                    className="flex items-center justify-center gap-2 p-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                    Edit Ticket
                  </button>
                )}
              </div>

              {user && ticket.createdBy === user.id && (
                <button
                  onClick={(e) => {
                    setIsDetailModalOpen(false);
                    openDeleteModal(e, ticket);
                  }}
                  className="w-full flex items-center justify-center gap-2 p-3 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-xl font-medium hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete Ticket
                </button>
              )}
            </div>
          );
        })()}
      </Modal>

      {/* Delete Ticket Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Delete Ticket"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg">
            <Trash2 className="w-5 h-5 shrink-0" />
            <p className="text-sm">
              Are you sure you want to delete <span className="font-bold">{selectedTicketForAction?.title}</span>? This action cannot be undone.
            </p>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <button
              onClick={() => setIsDeleteModalOpen(false)}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDeleteTicket}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Delete Ticket
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
