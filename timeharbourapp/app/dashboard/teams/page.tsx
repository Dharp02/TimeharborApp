'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Users, Plus, Copy, Check, Trash2, Edit2, Circle, UserPlus, UserMinus, Search, X } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { useTeam, Team, Member } from '@/components/dashboard/TeamContext';
import { useAuth } from '@/components/auth/AuthProvider';
import { TeamActivityReport } from '@/components/dashboard/TeamActivityReport';
import { copyText } from '@/lib/utils';

export default function TeamsPage() {
  const { user } = useAuth();
  const { currentTeam, teams, joinTeam, createTeam, deleteTeam, updateTeamName, selectTeam, addMember, removeMember, refreshTeams } = useTeam();
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  useEffect(() => {
    refreshTeams();
  }, []);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);
  const [isRemoveMemberModalOpen, setIsRemoveMemberModalOpen] = useState(false);
  const [selectedTeamForAction, setSelectedTeamForAction] = useState<Team | null>(null);
  const [memberToRemove, setMemberToRemove] = useState<Member | null>(null);
  
  const [joinCode, setJoinCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [newTeamName, setNewTeamName] = useState('');
  const [editTeamName, setEditTeamName] = useState('');
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [addMemberError, setAddMemberError] = useState<string | null>(null);
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [createdTeamCode, setCreatedTeamCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [headerCopied, setHeaderCopied] = useState(false);
  
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const handleJoinTeam = async () => {
    if (!joinCode.trim()) return;
    
    setIsJoining(true);
    setJoinError(null);
    
    const result = await joinTeam(joinCode);
    
    if (result.success) {
      setIsJoinModalOpen(false);
      setJoinCode('');
    } else {
      setJoinError(result.error || 'Failed to join team');
    }
    
    setIsJoining(false);
  };

  const handleCreateTeam = async () => {
    const code = await createTeam(newTeamName);
    setCreatedTeamCode(code);
  };

  const closeCreateModal = () => {
    setIsCreateModalOpen(false);
    setNewTeamName('');
    setCreatedTeamCode(null);
    setCopied(false);
  };

  const openEditModal = (team: Team) => {
    setSelectedTeamForAction(team);
    setEditTeamName(team.name);
    setIsEditModalOpen(true);
  };

  const handleEditTeam = () => {
    if (selectedTeamForAction && editTeamName.trim()) {
      updateTeamName(selectedTeamForAction.id, editTeamName);
      setIsEditModalOpen(false);
      setSelectedTeamForAction(null);
      setEditTeamName('');
    }
  };

  const openDeleteModal = (team: Team) => {
    setSelectedTeamForAction(team);
    setIsDeleteModalOpen(true);
  };

  const handleDeleteTeam = () => {
    if (selectedTeamForAction) {
      deleteTeam(selectedTeamForAction.id);
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

  const copyToClipboard = async () => {
    if (createdTeamCode) {
      const success = await copyText(createdTeamCode);
      if (success) {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
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
    <div className="pt-0 pb-4 md:p-6 space-y-6">
      <div className="flex justify-end items-center px-0 md:px-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsJoinModalOpen(true)}
              className="flex items-center gap-2 p-2 md:px-4 md:py-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors font-medium"
              title="Join a Team"
            >
              <Users className="w-5 h-5" />
              <span className="hidden md:inline">Join Team</span>
            </button>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="flex items-center gap-2 p-2 md:px-4 md:py-2 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors font-medium"
              title="Create a Team"
            >
              <Plus className="w-5 h-5" />
              <span className="hidden md:inline">Create Team</span>
            </button>
          </div>
        </div>
      </div>

      <div className="mt-6 md:mt-8">
        
        {!currentTeam ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 text-center text-gray-500 dark:text-gray-400 mx-4 md:mx-0">
            <p>Please select or join a team to view members.</p>
          </div>
        ) : (
          <div className="space-y-6">
              <div 
                key={currentTeam.id} 
                className="bg-white dark:bg-gray-800 md:rounded-xl shadow-sm border-y-2 border-x-0 md:border-2 border-blue-500 dark:border-blue-500 transition-all"
              >
                <div className="p-4 md:p-6">
                  <div className="flex justify-between items-start mb-4 md:mb-6">
                    <div className="flex-1 min-w-0 mr-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-lg md:text-2xl font-bold text-gray-900 dark:text-white truncate">
                          {currentTeam.name}
                        </h3>
                      </div>
                      <div className="flex items-center gap-3 mt-2">
                        <div className="flex items-center gap-2 px-2 md:px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                          <span className="text-xs md:text-sm font-mono text-gray-600 dark:text-gray-300">
                            Code: {currentTeam.code}
                          </span>
                          <button
                            onClick={copyHeaderCode}
                            className="p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                            title="Copy Team Code"
                          >
                            {headerCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                          </button>
                        </div>
                        <p className="text-sm md:text-base text-gray-500 dark:text-gray-400">
                          {currentTeam.members.length} members
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 shrink-0">
                      {currentTeam.role === 'Leader' && (
                        <>
                          <button
                            onClick={() => openEditModal(currentTeam)}
                            className="p-1.5 md:p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                            title="Edit Team"
                          >
                            <Edit2 className="w-4 h-4 md:w-5 md:h-5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="border-t border-gray-100 dark:border-gray-700 pt-4 md:pt-6">
                    <div className="flex justify-between items-center mb-3 md:mb-4">
                      <h4 className="text-base md:text-lg font-semibold text-gray-700 dark:text-gray-300">
                        Collaborators
                      </h4>
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
                        // Check if this member is the current user
                        // We compare by email since user.id is not directly available in member object here (member.id is user ID but verifying)
                        // Actually member.id is the userId.
                        const isSelf = user?.id === member.id;

                        // If not a leader, OR if it's the leader viewing themselves, render a plain div
                        if (!isLeader || isSelf) {
                          return (
                            <div 
                              key={member.id}
                              className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-700"
                            >
                              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-medium shadow-sm">
                                {member.name.charAt(0)}
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
                                    e.preventDefault(); // Prevent bubbling if it were in a link
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
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-medium shadow-sm">
                              {member.name.charAt(0)}
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
                            {/* Remove button logic handled within Link block */}
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
              </div>
          </div>
        )}
      </div>

      {/* Team Activity Report */}
      {currentTeam && (
        <div className="mt-8 px-4 md:px-0">
          <TeamActivityReport />
        </div>
      )}

      {/* Join Team Modal */}
      <Modal
        isOpen={isJoinModalOpen}
        onClose={() => {
          setIsJoinModalOpen(false);
          setJoinError(null);
          setJoinCode('');
        }}
        title="Join a Team"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Enter the 6-digit code provided by your team admin to join.
          </p>
          
          {joinError && (
            <div className="p-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 rounded-lg border border-red-200 dark:border-red-800 animate-in fade-in slide-in-from-top-2">
              {joinError}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Team Code
            </label>
            <input
              type="text"
              value={joinCode}
              onChange={(e) => {
                setJoinCode(e.target.value.toUpperCase());
                setJoinError(null);
              }}
              placeholder="e.g. 123456"
              maxLength={6}
              disabled={isJoining}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white font-mono text-center tracking-widest text-lg uppercase disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <button
              onClick={() => {
                setIsJoinModalOpen(false);
                setJoinError(null);
                setJoinCode('');
              }}
              disabled={isJoining}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={handleJoinTeam}
              disabled={joinCode.length < 6 || isJoining}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isJoining ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
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
        onClose={closeCreateModal}
        title="Create a Team"
      >
        <div className="space-y-4">
          {!createdTeamCode ? (
            <>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Give your new team a name. You'll get a code to share with your members.
              </p>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Team Name
                </label>
                <input
                  type="text"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  placeholder="e.g. Engineering Team"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={closeCreateModal}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateTeam}
                  disabled={!newTeamName.trim()}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Create Team
                </button>
              </div>
            </>
          ) : (
            <div className="text-center space-y-6 py-4">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto">
                <Check className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
              
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Team Created!</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Share this code with your team members
                </p>
              </div>

              <div className="bg-gray-100 dark:bg-gray-700/50 p-4 rounded-xl border border-gray-200 dark:border-gray-600 flex items-center justify-between gap-4">
                <span className="font-mono text-2xl font-bold tracking-widest text-gray-900 dark:text-white">
                  {createdTeamCode}
                </span>
                <button
                  onClick={copyToClipboard}
                  className="p-2 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                  title="Copy Code"
                >
                  {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                </button>
              </div>

              <button
                onClick={closeCreateModal}
                className="w-full px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg hover:opacity-90 transition-opacity"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </Modal>

      {/* Edit Team Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Team"
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
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>

          <div className="flex items-center justify-between mt-6">
            <button
               onClick={() => {
                  setIsEditModalOpen(false);
                  openDeleteModal(selectedTeamForAction!);
               }}
               className="text-sm font-medium text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors whitespace-nowrap pr-2"
            >
               Delete Team
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleEditTeam}
                disabled={!editTeamName.trim()}
                className="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              >
                Save Changes
              </button>
            </div>
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
    </div>
  );
}