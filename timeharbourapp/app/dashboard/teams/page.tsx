'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Users, Plus, Copy, Check, Trash2, Edit2, Circle, UserPlus, UserMinus, Search, X } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { useTeam, Team, Member } from '@/components/dashboard/TeamContext';
import { useAuth } from '@/components/auth/AuthProvider';
import { TeamActivityReport } from '@/components/dashboard/TeamActivityReport';
import { copyText } from '@/lib/utils';
import { useLogger } from '@/hooks/useLogger';

export default function TeamsPage() {
  const logger = useLogger();
  const { user } = useAuth();
  const { currentTeam, teams, deleteTeam, updateTeamName, selectTeam, addMember, removeMember, refreshTeams, joinTeam, createTeam } = useTeam();
  const [activeTab, setActiveTab] = useState<'teaminfo' | 'teamactivity'>('teaminfo');

  useEffect(() => {
    refreshTeams();
  }, []);

  // When team changes, set default tab based on role
  useEffect(() => {
    if (currentTeam) {
      setEditTeamName(currentTeam.name);
      if (currentTeam.role === 'Leader') {
        setActiveTab('teamactivity');
      } else {
        setActiveTab('teaminfo');
      }
    }
  }, [currentTeam?.id]); // Only run when team ID changes

  // Ensure non-leaders can't see team activity if role changes while on that tab
  useEffect(() => {
    if (currentTeam && currentTeam.role !== 'Leader' && activeTab === 'teamactivity') {
      setActiveTab('teaminfo');
    }
  }, [currentTeam?.role, activeTab]);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);
  const [isRemoveMemberModalOpen, setIsRemoveMemberModalOpen] = useState(false);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [createdTeamCode, setCreatedTeamCode] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [selectedTeamForAction, setSelectedTeamForAction] = useState<Team | null>(null);
  const [memberToRemove, setMemberToRemove] = useState<Member | null>(null);
  
  const [editTeamName, setEditTeamName] = useState('');
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [addMemberError, setAddMemberError] = useState<string | null>(null);
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [headerCopied, setHeaderCopied] = useState(false);
  
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  
  const [teamActionsOpen, setTeamActionsOpen] = useState(false);
  const teamActionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (teamActionsRef.current && !teamActionsRef.current.contains(event.target as Node)) {
        setTeamActionsOpen(false);
      }
    };

    if (teamActionsOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [teamActionsOpen]);

  const handleJoinTeam = async () => {
    if (!joinCode.trim()) return;
    
    setIsJoining(true);
    setJoinError(null);
    
    const result = await joinTeam(joinCode);
    
    if (result.success) {
      logger.log('Joined Team', { 
        subtitle: joinCode, 
        description: 'Joined via code',
        teamId: result.teamId // Ensure we log to the new team activity log
      });
      setIsJoinModalOpen(false);
      setJoinCode('');
    } else {
      setJoinError(result.error || 'Failed to join team');
    }
    
    setIsJoining(false);
  };

  const handleCreateTeam = async () => {
    try {
      const newTeam = await createTeam(newTeamName);
      // Log ensuring it goes to the NEW team storage
      logger.log('Created Team', { 
        subtitle: newTeamName, 
        description: 'Created new team',
        teamId: newTeam.id 
      });
      setCreatedTeamCode(newTeam.code);
    } catch (e) {
      console.error(e);
    }
  };

  const closeCreateModal = () => {
    setIsCreateModalOpen(false);
    setNewTeamName('');
    setCreatedTeamCode(null);
    setHeaderCopied(false);
  };

  const openEditModal = (team: Team) => {
    setSelectedTeamForAction(team);
    setEditTeamName(team.name);
    setIsEditModalOpen(true);
  };

  const handleEditTeam = async () => {
    if (selectedTeamForAction && editTeamName.trim()) {
      await updateTeamName(selectedTeamForAction.id, editTeamName);
      logger.log('Updated Team', { subtitle: `${selectedTeamForAction.name} -> ${editTeamName}` });
      setIsEditModalOpen(false);
      setSelectedTeamForAction(null);
      setEditTeamName('');
    }
  };

  const openDeleteModal = (team: Team) => {
    setSelectedTeamForAction(team);
    setIsDeleteModalOpen(true);
  };

  const handleDeleteTeam = async () => {
    if (selectedTeamForAction) {
      await deleteTeam(selectedTeamForAction.id);
      logger.log('Deleted Team', { subtitle: selectedTeamForAction.name });
      setIsDeleteModalOpen(false);
      setSelectedTeamForAction(null);
    }
  };

  const handleAddMember = async () => {
    if (currentTeam && newMemberEmail.trim()) {
      setIsAddingMember(true);
      setAddMemberError(null);
      try {
        await addMember(currentTeam.id, newMemberEmail);
        setIsAddMemberModalOpen(false);
        setNewMemberEmail('');
      } catch (error: any) {
        setAddMemberError(error.message || 'Failed to add member');
      } finally {
        setIsAddingMember(false);
      }
    }
  };

  const openRemoveMemberModal = (member: Member) => {
    setMemberToRemove(member);
    setIsRemoveMemberModalOpen(true);
  };

  const handleRemoveMember = async () => {
    if (currentTeam && memberToRemove) {
      try {
        await removeMember(currentTeam.id, memberToRemove.id);
        setIsRemoveMemberModalOpen(false);
        setMemberToRemove(null);
      } catch (error) {
        console.error('Failed to remove member:', error);
      }
    }
  };

  const copyHeaderCode = async () => {
    if (currentTeam?.code) {
      const success = await copyText(currentTeam.code);
      if (success) {
        setHeaderCopied(true);
        setTimeout(() => setHeaderCopied(false), 2000);
      }
    }
  };

  return (
    <div className="pt-0 pb-4 md:p-6 space-y-4">
      <div className="mt-0">
        {!currentTeam ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 text-center text-gray-500 dark:text-gray-400 mx-4 md:mx-0 flex flex-col items-center gap-4">
            <p>Please select or join a team to view members.</p>
            <div className="flex gap-4">
              <button
                 onClick={() => setIsJoinModalOpen(true)}
                 className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                 Join Team
              </button>
              <button
                 onClick={() => setIsCreateModalOpen(true)}
                 className="px-4 py-2 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
              >
                 Create Team
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Tabs */}
            <div className="flex mb-3 bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden border border-gray-200 dark:border-gray-700">
                    {currentTeam.role === 'Leader' && (
                      <>
                        <button
                          onClick={() => setActiveTab('teamactivity')}
                          className={`flex-1 px-3 py-3 text-sm md:text-base font-medium transition-all ${
                            activeTab === 'teamactivity'
                              ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20'
                              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                          }`}
                        >
                          Team Activity
                        </button>
                        <div className="w-px bg-gray-200 dark:bg-gray-700"></div>
                      </>
                    )}
                    <button
                      onClick={() => setActiveTab('teaminfo')}
                      className={`flex-1 px-4 py-3 text-sm md:text-base font-medium transition-all ${
                        activeTab === 'teaminfo'
                          ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20'
                          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                      }`}
                    >
                      Team Info
                    </button>
                  </div>

                  {/* Tab Content */}
                  <div>
                    {activeTab === 'teaminfo' && (
                      <div className="space-y-4">
                        {/* Team Name & Code Section */}
                        <div className="relative pt-2">
                          {/* Team Name with Dropdown */}
                          <div className="relative inline-block" ref={teamActionsRef}>
                            <h3 
                              onClick={() => {
                                if (currentTeam.role === 'Leader') {
                                  setTeamActionsOpen(!teamActionsOpen);
                                }
                              }}
                              className={`text-2xl font-bold text-gray-900 dark:text-white ${
                                currentTeam.role === 'Leader' 
                                  ? 'cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors' 
                                  : ''
                              }`}
                            >
                              {currentTeam.name}
                            </h3>

                            {/* Dropdown Menu */}
                            {teamActionsOpen && currentTeam.role === 'Leader' && (
                              <div className="absolute top-full left-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-10 animate-in fade-in zoom-in duration-200">
                                <button
                                  onClick={() => {
                                    setEditTeamName(currentTeam.name);
                                    setIsEditModalOpen(true);
                                    setTeamActionsOpen(false);
                                  }}
                                  className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                                >
                                  <Edit2 className="w-4 h-4" />
                                  Edit Name
                                </button>
                                <button
                                  onClick={() => {
                                    setSelectedTeamForAction(currentTeam);
                                    setIsDeleteModalOpen(true);
                                    setTeamActionsOpen(false);
                                  }}
                                  className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                                >
                                  <Trash2 className="w-4 h-4" />
                                  Delete Team
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Team Code Below Name */}
                          <div className="mt-1 flex items-center gap-2">
                            <span className="text-sm text-gray-500 dark:text-gray-400">Code:</span>
                            <span className="text-sm font-mono font-medium text-gray-900 dark:text-white">
                              {currentTeam.code}
                            </span>
                            <button
                              onClick={copyHeaderCode}
                              className="p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                              title="Copy team code"
                            >
                              {headerCopied ? (
                                <Check className="w-3 h-3" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        </div>

                        <div className="pt-1 md:pt-1">
                          <div className="flex justify-between items-center mb-2 md:mb-3">
                            <div>
                              <h4 className="text-base md:text-lg font-semibold text-gray-700 dark:text-gray-300">
                                Collaborators
                              </h4>
                              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                {currentTeam.members.length} members
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              {/* Search Component */}
                              <div className={`flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg transition-all duration-300 ${isSearchOpen ? 'w-48 px-2 py-1' : 'w-8 h-8 md:w-9 md:h-9 bg-transparent hover:bg-gray-100 dark:hover:bg-gray-800 justify-center'}`}>
                                {isSearchOpen ? (
                                   <>
                                     <Search className="w-4 h-4 text-gray-500 flex-shrink-0 mr-2" />
                                     <input 
                                        autoFocus
                                        type="text"
                                        placeholder="Search members..."
                                        value={memberSearchQuery}
                                        onChange={(e) => setMemberSearchQuery(e.target.value)}
                                        className="bg-transparent border-none outline-none text-sm w-full text-gray-900 dark:text-gray-100 placeholder-gray-500"
                                        onBlur={() => {
                                           if (!memberSearchQuery) setIsSearchOpen(false);
                                        }}
                                     />
                                     <button 
                                        onClick={() => {
                                           setMemberSearchQuery('');
                                           setIsSearchOpen(false);
                                        }}
                                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 ml-1"
                                      >
                                        <X className="w-3 h-3" />
                                      </button>
                                   </>
                                ) : (
                                   <button onClick={() => setIsSearchOpen(true)} className="flex items-center justify-center w-full h-full text-gray-500 dark:text-gray-400">
                                      <Search className="w-4 h-4" />
                                   </button>
                                )}
                              </div>

                              {currentTeam.role === 'Leader' && (
                                <button
                                  onClick={() => setIsAddMemberModalOpen(true)}
                                  className="flex items-center justify-center w-8 h-8 md:w-9 md:h-9 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded-lg transition-colors"
                                  title="Add Member"
                                >
                                  <Plus className="w-5 h-5" />
                                </button>
                              )}
                            </div>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                            {[...currentTeam.members]
                              .filter(member => 
                                 (member.name || '').toLowerCase().includes(memberSearchQuery.toLowerCase()) || 
                                 (member.email || '').toLowerCase().includes(memberSearchQuery.toLowerCase())
                              )
                              .sort((a, b) => {
                                if (a.role === 'Leader' && b.role !== 'Leader') return -1;
                                if (a.role !== 'Leader' && b.role === 'Leader') return 1;
                                  return 0;
                              })
                              .map((member) => {
                              const isLeader = currentTeam.role === 'Leader';
                              const isSelf = user?.id === member.id;

                              if (!isLeader || isSelf) {
                                return (
                                  <div 
                                    key={member.id}
                                    className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-700"
                                  >
                                    <div className="relative">
                                      <div className={`w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-medium shadow-sm ${member.status === 'online' ? 'ring-2 ring-green-500 ring-offset-2 dark:ring-offset-gray-900' : ''}`}>
                                        {member.name.charAt(0)}
                                      </div>
                                      {member.status === 'online' && (
                                        <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white dark:border-gray-800 rounded-full z-10"></div>
                                      )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                        <p className="font-medium text-gray-900 dark:text-white truncate">
                                          {member.name}
                                        </p>
                                        {member.role === 'Leader' && (
                                          <span className="px-1.5 py-0.5 text-[10px] uppercase font-bold bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 rounded-full shrink-0">
                                            Leader
                                          </span>
                                        )}
                                      </div>
                                      <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                                        {member.email}
                                      </p>
                                    </div>
                                    {isLeader && !isSelf && (
                                      <button
                                        onClick={(e) => {
                                          e.preventDefault();
                                          openRemoveMemberModal(member);
                                        }}
                                        className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                        title="Remove Member"
                                      >
                                        <UserMinus className="w-4 h-4" />
                                      </button>
                                    )}
                                  </div>
                                );
                              }

                              return (
                                <Link 
                                  href={`/dashboard/member?id=${member.id}&teamId=${currentTeam.id}&name=${encodeURIComponent(member.name)}`}
                                  key={member.id}
                                  className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                                >
                                  <div className="relative">
                                    <div className={`w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-medium shadow-sm ${member.status === 'online' ? 'ring-2 ring-green-500 ring-offset-2 dark:ring-offset-gray-900' : ''}`}>
                                      {member.name.charAt(0)}
                                    </div>
                                    {member.status === 'online' && (
                                      <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white dark:border-gray-800 rounded-full z-10"></div>
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <p className="font-medium text-gray-900 dark:text-white truncate">
                                        {member.name}
                                      </p>
                                      {member.role === 'Leader' && (
                                        <span className="px-1.5 py-0.5 text-[10px] uppercase font-bold bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 rounded-full shrink-0">
                                          Leader
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                                      {member.email}
                                    </p>
                                  </div>
                                  {currentTeam.role === 'Leader' && member.id !== user?.id && (
                                    <button
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        openRemoveMemberModal(member);
                                      }}
                                      className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                      title="Remove Member"
                                    >
                                      <UserMinus className="w-4 h-4" />
                                    </button>
                                  )}
                                </Link>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}

                    {activeTab === 'teamactivity' && (
                      <div className="space-y-4">
                        <TeamActivityReport />
                      </div>
                    )}
                  </div>
          </>
        )}
      </div>

      {/* Edit Team Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditTeamName(currentTeam?.name || '');
        }}
        title="Edit Team Name"
      >
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Team Name
            </label>
            <input
              type="text"
              value={editTeamName}
              onChange={(e) => setEditTeamName(e.target.value)}
              placeholder="e.g. Engineering Team"
              autoFocus
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <button
              onClick={() => {
                setIsEditModalOpen(false);
                setEditTeamName(currentTeam?.name || '');
              }}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                if (currentTeam && editTeamName.trim()) {
                  updateTeamName(currentTeam.id, editTeamName);
                  setIsEditModalOpen(false);
                }
              }}
              disabled={!editTeamName.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Save Changes
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Team Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Delete Team"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Are you sure you want to delete <span className="font-bold">{selectedTeamForAction?.name}</span>? This action cannot be undone.
          </p>

          <div className="flex justify-end gap-3 mt-6">
            <button
              onClick={() => setIsDeleteModalOpen(false)}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDeleteTeam}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Delete Team
            </button>
          </div>
        </div>
      </Modal>

      {/* Add Member Modal */}
      <Modal
        isOpen={isAddMemberModalOpen}
        onClose={() => {
          setIsAddMemberModalOpen(false);
          setNewMemberEmail('');
          setAddMemberError(null);
        }}
        title="Add Team Member"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Member Email
            </label>
            <input
              type="email"
              value={newMemberEmail}
              onChange={(e) => setNewMemberEmail(e.target.value)}
              placeholder="colleague@example.com"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            />
            {addMemberError && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                {addMemberError}
              </p>
            )}
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <button
              onClick={() => {
                setIsAddMemberModalOpen(false);
                setNewMemberEmail('');
                setAddMemberError(null);
              }}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleAddMember}
              disabled={!newMemberEmail.trim() || isAddingMember}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isAddingMember ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Adding...
                </>
              ) : (
                'Add Member'
              )}
            </button>
          </div>
        </div>
      </Modal>

      {/* Remove Member Modal */}
      <Modal
        isOpen={isRemoveMemberModalOpen}
        onClose={() => setIsRemoveMemberModalOpen(false)}
        title="Remove Team Member"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Are you sure you want to remove <span className="font-bold">{memberToRemove?.name}</span> from the team? They will lose access to all team resources.
          </p>

          <div className="flex justify-end gap-3 mt-6">
            <button
              onClick={() => setIsRemoveMemberModalOpen(false)}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleRemoveMember}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Remove Member
            </button>
          </div>
        </div>
      </Modal>

      {/* Join Team Modal */}
      <Modal
        isOpen={isJoinModalOpen}
        onClose={() => {
          setIsJoinModalOpen(false);
          setJoinCode('');
          setJoinError(null);
        }}
        title="Join a Team"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Team Code
            </label>
            <input
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              placeholder="Enter team code"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            />
            {joinError && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                {joinError}
              </p>
            )}
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <button
              onClick={() => {
                setIsJoinModalOpen(false);
                setJoinCode('');
                setJoinError(null);
              }}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleJoinTeam}
              disabled={!joinCode.trim() || isJoining}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isJoining ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Joining...
                </>
              ) : (
                'Join Team'
              )}
            </button>
          </div>
        </div>
      </Modal>

      {/* Create Team Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setNewTeamName('');
          setCreatedTeamCode(null);
        }}
        title="Create New Team"
      >
        {createdTeamCode ? (
          <div className="text-center py-4">
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4 text-green-600 dark:text-green-400">
              <Check className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Team Created Successfully!</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              Share this code with your team members to invite them.
            </p>
            
            <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700 mb-6">
              <code className="flex-1 font-mono text-lg font-bold text-center tracking-wider text-gray-800 dark:text-gray-200">
                {createdTeamCode}
              </code>
              <button
                onClick={async () => {
                  if (createdTeamCode) {
                    await copyText(createdTeamCode);
                    setHeaderCopied(true);
                    setTimeout(() => setHeaderCopied(false), 2000);
                  }
                }}
                className="p-2 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400"
                title="Copy Code"
              >
                {headerCopied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
              </button>
            </div>
            
            <button
              onClick={() => {
                setIsCreateModalOpen(false);
                setNewTeamName('');
                setCreatedTeamCode(null);
                refreshTeams();
              }}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Done
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Team Name
              </label>
              <input
                type="text"
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
                placeholder="e.g. Design Team"
                autoFocus
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setIsCreateModalOpen(false);
                  setNewTeamName('');
                }}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateTeam}
                disabled={!newTeamName.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Create Team
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}