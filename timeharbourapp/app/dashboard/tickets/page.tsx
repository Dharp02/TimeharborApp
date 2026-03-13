'use client';

import { useState, useEffect } from 'react';
import { Plus, Search, Ticket, Play, Square, Filter, MoreHorizontal, Clock, UserPlus, Trash2, User, ArrowRightLeft, Check, Edit2, ExternalLink, AlignLeft, X } from 'lucide-react';
import { Button, Input, Textarea, Select } from '@mieweb/ui';
import { useRouter } from 'next/navigation';
import { useClockIn } from '@/components/dashboard/ClockInContext';
import { useTeam } from '@/components/dashboard/TeamContext';
import { useAuth } from '@/components/auth/AuthProvider';
import { Modal } from '@/components/ui/Modal';
import { tickets as ticketsApi } from '@/TimeharborAPI';
import { Ticket as TicketType, CreateTicketData, UpdateTicketData } from '@/TimeharborAPI/tickets';
import { useLogger } from '@/hooks/useLogger';
import PulseButton from '@/components/dashboard/PulseButton';

export default function TicketsPage() {
  const logger = useLogger();
  const router = useRouter();
  const { isSessionActive, activeTicketId, toggleTicketTimer, ticketDuration, getFormattedTotalTime, toggleSession } = useClockIn();
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
  const [link, setLink] = useState('');
  const [pendingTicket, setPendingTicket] = useState<{id: string, title: string} | null>(null);
  const [newTicket, setNewTicket] = useState({ title: '', description: '', status: 'Open', priority: 'Medium', reference: '' });
  const [isEditing, setIsEditing] = useState(false);
  const [editingTicketId, setEditingTicketId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('All');
  
  const [showClockInWarning, setShowClockInWarning] = useState(false);
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
        createdBy: t.createdBy,
        creatorName: t.creator ? t.creator.full_name : 'Unknown'
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

  const fetchGitHubDescription = async (ticketId: string) => {
    const ticket = allTickets.find(t => t.id === ticketId);
    if (!ticket || !currentTeam || ticket.description || !ticket.reference) return;

    // Regex for GitHub PR/Issue URL
    // https://github.com/owner/repo/pull/123 or issues/123
    const githubRegex = /github\.com\/([^/]+)\/([^/]+)\/(pull|issues)\/(\d+)/;
    const match = ticket.reference.match(githubRegex);

    if (match) {
      try {
        const [_, owner, repo, type, number] = match;
        const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/${type === 'pull' ? 'pulls' : 'issues'}/${number}`);
        
        if (response.ok) {
          const data = await response.json();
          const title = data.title;
          const body = data.body || '';
          
          // Construct a description
          const newDescription = `**${title}**\n\n${body}`;
          
          // Update ticket via API
          await ticketsApi.updateTicket(currentTeam.id, ticket.id, {
            description: newDescription
          });
          
          // Update local state smoothly
          setAllTickets(prev => prev.map(t => 
             t.id === ticket.id ? { ...t, description: newDescription } : t
          ));

          logger.log('Auto-filled Description', {
            subtitle: ticket.title,
            description: `Fetched from GitHub PR/Issue #${number}`
          });
        }
      } catch (error) {
        console.error("Failed to auto-fill GitHub description", error);
      }
    }
  };

  useEffect(() => {
    if (isDetailModalOpen && detailTicketId) {
       fetchGitHubDescription(detailTicketId);
    }
  }, [isDetailModalOpen, detailTicketId]);

  const handleTicketClick = (e: React.MouseEvent, ticketId: string, ticketTitle: string) => {
    e.stopPropagation();
    
    if (!isSessionActive) {
      setShowClockInWarning(true);
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
      toggleTicketTimer(pendingTicket.id, pendingTicket.title, undefined, comment, link || undefined);
    } else {
      toggleTicketTimer(pendingTicket.id, pendingTicket.title, currentTeam?.id, comment, link || undefined);
    }

    setIsModalOpen(false);
    setPendingTicket(null);
    setComment('');
    setLink('');
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
        
        logger.log('Updated Ticket', {
          subtitle: newTicket.title,
          description: `Ticket updated by ${user?.full_name || 'User'}`
        });

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
        
        logger.log('Created Ticket', {
          subtitle: newTicket.title,
          description: `Ticket created by ${user?.full_name || 'User'}`
        });
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
        
        logger.log('Assigned Ticket', {
          subtitle: selectedTicketForAction.title,
          description: `Assigned to ${memberName}`
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
        
        logger.log('Status Updated', {
          subtitle: selectedTicketForAction.title,
          description: `Status changed to ${newStatus}`
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
        
        logger.log('Deleted Ticket', {
          subtitle: selectedTicketForAction.title,
          description: `Ticket deleted by ${user?.full_name || 'User'}`
        });

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
      case 'In Progress': return 'bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400';
      case 'Closed': return 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'Critical': return 'text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400';
      case 'High': return 'text-orange-600 bg-orange-50 dark:bg-orange-900/20 dark:text-orange-400';
      case 'Medium': return 'text-primary-600 bg-primary-50 dark:bg-primary-900/20 dark:text-primary-400';
      case 'Low': return 'text-gray-600 bg-gray-50 dark:bg-gray-800 dark:text-gray-400';
      default: return 'text-gray-600';
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
          <p className="text-gray-600 dark:text-gray-300">
            You must be clocked in to start a ticket timer. Would you like to clock in now?
          </p>
          <div className="flex justify-end gap-3 mt-6">
            <Button
              variant="outline"
              onClick={() => setShowClockInWarning(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                toggleSession(currentTeam?.id);
                setShowClockInWarning(false);
              }}
              className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              Clock In
            </Button>
          </div>
        </div>
      </Modal>
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-end gap-4">
        <Button 
          onClick={() => router.push('/dashboard/tickets/create')}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-colors shadow-sm"
        >
          <Plus className="w-5 h-5" />
          <span>New Ticket</span>
        </Button>
      </div>

      {/* Filters and Search */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-4">
        <div className="flex flex-col md:flex-row gap-4 justify-between">
          {/* Tabs */}
          <div className="flex overflow-x-auto pb-2 md:pb-0 gap-2 no-scrollbar">
            {tabs.map((tab) => (
              <Button
                key={tab}
                variant="ghost"
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  activeTab === tab
                    ? 'bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400'
                    : 'text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-700/50'
                }`}
              >
                {tab}
              </Button>
            ))}
          </div>

          {/* Search and Filter Actions */}
          <div className="flex gap-2">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Search tickets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-700 rounded-lg text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
              />
            </div>
            <Button variant="ghost" size="icon" className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-700 transition-colors">
              <Filter className="w-4 h-4" />
            </Button>
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
                  activeTicketId === ticket.id ? 'bg-primary-50/50 dark:bg-primary-900/10' : ''
                }`}
              >
                <div className="flex items-center gap-4">
                  {/* Status Icon/Action */}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => handleTicketClick(e, ticket.id, ticket.title)}
                    className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                      activeTicketId === ticket.id
                        ? 'bg-primary-600 text-white shadow-md scale-105'
                        : 'bg-gray-100 text-gray-400 hover:bg-primary-100 hover:text-primary-600 dark:bg-gray-700 dark:text-gray-500 dark:hover:bg-primary-900/30 dark:hover:text-primary-400'
                    } cursor-pointer`}
                  >
                    {activeTicketId === ticket.id ? (
                      <Square className="w-4 h-4 fill-current" />
                    ) : (
                      <Play className="w-4 h-4 fill-current ml-0.5" />
                    )}
                  </Button>

                  {/* Ticket Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                        {ticket.id.substring(0, 8)}
                      </span>
                      <Button 
                        variant="ghost"
                        size="sm"
                        onClick={(e) => openStatusModal(e, ticket)}
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(ticket.status)} hover:opacity-80 transition-opacity`}
                      >
                        {ticket.status}
                      </Button>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(ticket.priority)}`}>
                        {ticket.priority}
                      </span>
                    </div>
                    <h3 className="text-base font-medium text-gray-900 dark:text-white truncate">
                      {ticket.title}
                    </h3>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      Created by <span className="font-medium text-gray-700 dark:text-gray-300">{ticket.creatorName}</span>
                    </div>
                    {ticket.reference && (
                      <div className="mt-1">
                        <a 
                          href={ticket.reference}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-xs text-primary-500 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 hover:underline max-w-full"
                        >
                          <ExternalLink className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{ticket.reference}</span>
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Meta Info (Hidden on mobile) */}
                  <div className="hidden md:flex items-center gap-6 text-sm text-gray-500 dark:text-gray-400">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-xs font-medium">
                        {ticket.assignee}
                      </div>
                    </div>
                    {activeTicketId === ticket.id && (
                      <div className="flex items-center gap-1.5 text-primary-600 dark:text-primary-400 font-medium font-mono">
                        <Clock className="w-4 h-4" />
                        {getFormattedTotalTime(ticket.id)}
                      </div>
                    )}
                  </div>

                  {/* Actions Menu */}
                  <div className="flex items-center gap-1">
                    {/* Pulse Button */}
                    {currentTeam && (
                      <PulseButton teamId={currentTeam.id} ticketId={ticket.id} />
                    )}

                    {/* Mobile Menu Button */}
                    <Button 
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        openDetails(ticket.id);
                      }}
                      className="md:hidden p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      <MoreHorizontal className="w-5 h-5" />
                    </Button>

                    {/* Desktop Menu Button */}
                    <Button 
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenuTicketId(openMenuTicketId === ticket.id ? null : ticket.id);
                      }}
                      className="hidden md:block p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      <MoreHorizontal className="w-5 h-5" />
                    </Button>
                    
                    {openMenuTicketId === ticket.id && (
                      <>
                        <div 
                          className="fixed inset-0 z-10" 
                          onClick={(e) => { e.stopPropagation(); setOpenMenuTicketId(null); }} 
                        />
                        <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 z-20 overflow-hidden py-1">
                          {/* Assign - Creator Only */}
                          {user && ticket.createdBy === user.id && (
                            <Button
                              variant="ghost"
                              onClick={(e) => openAssignModal(e, ticket)}
                              className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-left rounded-none justify-start"
                            >
                              <UserPlus className="w-4 h-4" />
                              Assign Ticket
                            </Button>
                          )}

                          {/* Change Status - Everyone */}
                          <Button
                            variant="ghost"
                            onClick={(e) => openStatusModal(e, ticket)}
                            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-left rounded-none justify-start"
                          >
                            <ArrowRightLeft className="w-4 h-4" />
                            Change Status
                          </Button>

                          {/* Edit - Creator Only */}
                          {user && ticket.createdBy === user.id && (
                            <Button
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                openEditModal(ticket);
                              }}
                              className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-left rounded-none justify-start"
                            >
                              <Edit2 className="w-4 h-4" />
                              Edit Ticket
                            </Button>
                          )}
                          
                          {/* Delete - Creator Only */}
                          {user && ticket.createdBy === user.id && (
                            <Button
                              variant="ghost"
                              onClick={(e) => openDeleteModal(e, ticket)}
                              className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-left rounded-none justify-start"
                            >
                              <Trash2 className="w-4 h-4" />
                              Delete Ticket
                            </Button>
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
        onClose={() => { setIsModalOpen(false); setLink(''); }}
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
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="What did you work on?"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
              rows={3}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Link (optional)
            </label>
            <Input
              type="url"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="Paste a YouTube or Pulse link..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white text-sm"
            />
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <Button
              variant="ghost"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirm}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              {modalType === 'stop' ? 'Stop Timer' : 'Switch & Start'}
            </Button>
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
              <Input
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
              <Textarea
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
              <Input
                type="url"
                value={newTicket.reference}
                onChange={(e) => setNewTicket({ ...newTicket, reference: e.target.value })}
                placeholder="https://..."
                className="w-full px-3 py-2 bg-transparent border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 dark:text-white placeholder-gray-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Select
                label="Status"
                value={newTicket.status}
                onValueChange={(value) => setNewTicket({ ...newTicket, status: value })}
                options={[
                  { value: 'Open', label: 'Open' },
                  { value: 'In Progress', label: 'In Progress' },
                  { value: 'Closed', label: 'Closed' },
                ]}
              />
              <Select
                label="Priority"
                value={newTicket.priority}
                onValueChange={(value) => setNewTicket({ ...newTicket, priority: value })}
                options={[
                  { value: 'Low', label: 'Low' },
                  { value: 'Medium', label: 'Medium' },
                  { value: 'High', label: 'High' },
                ]}
              />
            </div>
          </div>

          <div className="mt-6">
            {/* Desktop Actions */}
            <div className="hidden md:flex flex-col gap-3">
              <Button
                onClick={handleAddTicket}
                className="w-full px-4 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors"
              >
                {isEditing ? "Update Ticket" : "Create Ticket"}
              </Button>
              <Button
                variant="outline"
                onClick={() => setIsAddTicketModalOpen(false)}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </Button>
            </div>

            {/* Mobile Actions - Icon based */}
            <div className="flex -mx-4 -mb-4 border-t border-gray-100 dark:border-gray-700 md:hidden">
              <Button
                variant="ghost"
                onClick={() => setIsAddTicketModalOpen(false)}
                className="flex-1 p-4 flex items-center justify-center gap-2 text-gray-600 dark:text-gray-400 border-r border-gray-100 dark:border-gray-700 active:bg-gray-50 dark:active:bg-gray-750 rounded-none"
              >
                <X className="w-5 h-5" />
                <span className="font-medium">Cancel</span>
              </Button>
              <Button
                variant="ghost"
                onClick={handleAddTicket}
                className="flex-1 p-4 flex items-center justify-center gap-2 text-green-600 dark:text-green-400 active:bg-green-50 dark:active:bg-green-900/10 rounded-none"
              >
                <Check className="w-5 h-5" />
                <span className="font-medium">{isEditing ? "Update" : "Create"}</span>
              </Button>
            </div>
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
              <Button
                key={member.id}
                variant="ghost"
                onClick={() => handleAssignTicket(member.id, member.name)}
                className="w-full flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-primary-500 dark:hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-all group"
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
              </Button>
            ))}
          </div>

          <div className="flex justify-end mt-6">
            <Button
              variant="ghost"
              onClick={() => setIsAssignModalOpen(false)}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Cancel
            </Button>
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
              <Button
                key={status}
                variant="ghost"
                onClick={() => handleStatusChange(status)}
                className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all ${
                  selectedTicketForAction && allTickets.find(t => t.id === selectedTicketForAction.id)?.status === status
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-primary-500 dark:hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`w-3 h-3 rounded-full ${
                    status === 'Open' ? 'bg-gray-400' :
                    status === 'In Progress' ? 'bg-primary-500' :
                    'bg-green-500'
                  }`} />
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{status}</span>
                </div>
                {selectedTicketForAction && allTickets.find(t => t.id === selectedTicketForAction.id)?.status === status && (
                  <Check className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                )}
              </Button>
            ))}
          </div>

          <div className="flex justify-end mt-6">
            <Button
              variant="ghost"
              onClick={() => setIsStatusModalOpen(false)}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Cancel
            </Button>
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
              <div className="bg-gray-50 dark:bg-gray-700/30 p-4 rounded-xl border border-gray-100 dark:border-gray-700 relative group">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Description</h4>
                  {user && ticket.createdBy === user.id && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditModal(ticket)}
                      className="p-1 text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 rounded transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                      title="Edit Description"
                    >
                      <Edit2 className="w-3 h-3" />
                    </Button>
                  )}
                </div>
                
                {ticket.description ? (
                  <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                    {ticket.description}
                  </p>
                ) : (
                  <p className="text-sm text-gray-400 dark:text-gray-500 italic">
                    No description provided.
                    {user && ticket.createdBy === user.id && (
                      <Button 
                        variant="link"
                        onClick={() => openEditModal(ticket)}
                        className="ml-2 text-primary-600 dark:text-primary-400 hover:underline not-italic font-medium"
                      >
                        Add description
                      </Button>
                    )}
                  </p>
                )}

                {ticket.reference && (
                  <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700/50">
                    <a 
                      href={ticket.reference} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="flex items-center gap-2 text-sm text-primary-600 dark:text-primary-400 hover:underline break-all group"
                    >
                      <ExternalLink className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate">{ticket.reference}</span>
                    </a>
                  </div>
                )}
              </div>

              {/* Assignee / Assigner Info */}
              <div className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-sm font-medium text-gray-600 dark:text-gray-300">
                    {/* If current user created the ticket, show assignee. If someone else created it, show creator. */}
                    {user && ticket.createdBy === user.id 
                      ? ticket.assignee 
                      : (ticket.creatorName ? ticket.creatorName.split(' ').map((n: string) => n[0]).join('').toUpperCase().substring(0, 2) : 'CN')}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {user && ticket.createdBy === user.id ? ticket.assigneeName : ticket.creatorName}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {user && ticket.createdBy === user.id ? 'Assigned To' : 'Assigned By'} 
                    </p>
                  </div>
                </div>
                {user && (ticket.createdBy === user.id || ticket.assigneeName === 'Unassigned') && (
                  <Button 
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      setIsDetailModalOpen(false);
                      openAssignModal(e, ticket);
                    }}
                    className="p-2 text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
                  >
                    <UserPlus className="w-5 h-5" />
                  </Button>
                )}
              </div>

              {/* Creator Info */}
              <div className="flex items-center justify-between px-1 text-sm text-gray-500 dark:text-gray-400 border-t border-b border-gray-100 dark:border-gray-700 py-3">
                 <div className="flex flex-col">
                    <span className="text-xs uppercase tracking-wider font-semibold mb-0.5">Created By</span>
                    <span className="text-gray-900 dark:text-white font-medium">{ticket.creatorName}</span>
                 </div>
                 <div className="flex flex-col items-end">
                    <span className="text-xs uppercase tracking-wider font-semibold mb-0.5">Created On</span>
                    <span className="text-gray-900 dark:text-white font-medium">
                        {new Date(ticket.createdAt).toLocaleDateString(undefined, { 
                            year: 'numeric', 
                            month: 'short', 
                            day: 'numeric'
                        })}
                    </span>
                 </div>
              </div>

              {/* Actions Grid */}
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="ghost"
                  onClick={(e) => {
                    setIsDetailModalOpen(false);
                    openStatusModal(e, ticket);
                  }}
                  className="flex items-center justify-center gap-2 p-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  <ArrowRightLeft className="w-4 h-4" />
                  Change Status
                </Button>
                
                {user && ticket.createdBy === user.id && (
                  <Button
                    variant="ghost"
                    onClick={() => openEditModal(ticket)}
                    className="flex items-center justify-center gap-2 p-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                    Edit Ticket
                  </Button>
                )}
              </div>

              {user && ticket.createdBy === user.id && (
                <Button
                  variant="ghost"
                  onClick={(e) => {
                    setIsDetailModalOpen(false);
                    openDeleteModal(e, ticket);
                  }}
                  className="w-full flex items-center justify-center gap-2 p-3 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-xl font-medium hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete Ticket
                </Button>
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
            <Button
              variant="ghost"
              onClick={() => setIsDeleteModalOpen(false)}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Cancel
            </Button>
            <Button
              onClick={handleDeleteTicket}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Delete Ticket
            </Button>
          </div>
        </div>
      </Modal>
    </div>
    </>
  );
}
