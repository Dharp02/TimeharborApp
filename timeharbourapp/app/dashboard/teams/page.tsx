'use client';

import { useState } from 'react';
import { Users, Plus, Copy, Check, Trash2, Edit2, Circle } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { useTeam, Team } from '@/components/dashboard/TeamContext';
import { TeamActivityReport } from '@/components/dashboard/TeamActivityReport';
import { copyText } from '@/lib/utils';

export default function TeamsPage() {
  const { currentTeam, teams, joinTeam, createTeam, deleteTeam, updateTeamName, selectTeam } = useTeam();
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedTeamForAction, setSelectedTeamForAction] = useState<Team | null>(null);
  
  const [joinCode, setJoinCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [newTeamName, setNewTeamName] = useState('');
  const [editTeamName, setEditTeamName] = useState('');
  const [createdTeamCode, setCreatedTeamCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [headerCopied, setHeaderCopied] = useState(false);

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
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Teams</h1>
          {currentTeam && (
            <div className="flex items-center gap-2 px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <span className="text-sm font-mono text-gray-600 dark:text-gray-300">
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
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button 
          onClick={() => setIsJoinModalOpen(true)}
          className="flex items-center justify-center gap-3 p-6 rounded-xl border-2 border-blue-100 dark:border-blue-900 hover:border-blue-500 dark:hover:border-blue-500 bg-blue-50 dark:bg-blue-900/20 transition-all group"
        >
          <div className="p-3 bg-blue-100 dark:bg-blue-800 rounded-full group-hover:bg-blue-200 dark:group-hover:bg-blue-700 transition-colors">
            <Users className="w-6 h-6 text-blue-600 dark:text-blue-300" />
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-gray-900 dark:text-white">Join a Team</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Find your team and start collaborating</p>
          </div>
        </button>

        <button 
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center justify-center gap-3 p-6 rounded-xl border-2 border-purple-100 dark:border-purple-900 hover:border-purple-500 dark:hover:border-purple-500 bg-purple-50 dark:bg-purple-900/20 transition-all group"
        >
          <div className="p-3 bg-purple-100 dark:bg-purple-800 rounded-full group-hover:bg-purple-200 dark:group-hover:bg-purple-700 transition-colors">
            <Plus className="w-6 h-6 text-purple-600 dark:text-purple-300" />
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-gray-900 dark:text-white">Create a Team</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Set up a new workspace for your team</p>
          </div>
        </button>
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Your Team</h2>
        
        {!currentTeam ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 text-center text-gray-500 dark:text-gray-400">
            <p>Please select or join a team to view members.</p>
          </div>
        ) : (
          <div className="space-y-6">
              <div 
                key={currentTeam.id} 
                className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border-2 border-blue-500 dark:border-blue-500 transition-all"
              >
                <div className="p-6">
                  <div className="flex justify-between items-start mb-6">
                    <div className="flex-1">
                      <h3 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                        {currentTeam.name}
                        {currentTeam.role === 'Leader' && (
                          <span className="px-2.5 py-1 text-sm font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 rounded-full">
                            Leader
                          </span>
                        )}
                      </h3>
                      <p className="text-base text-gray-500 dark:text-gray-400 mt-2">
                        {currentTeam.members.length} members • Code: <span className="font-mono text-lg">{currentTeam.code}</span>
                      </p>
                    </div>
                    
                    {currentTeam.role === 'Leader' && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEditModal(currentTeam)}
                          className="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                          title="Edit Team"
                        >
                          <Edit2 className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => openDeleteModal(currentTeam)}
                          className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                          title="Delete Team"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="border-t border-gray-100 dark:border-gray-700 pt-6">
                    <h4 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-4">
                      Collaborators
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                      {currentTeam.members.map((member) => (
                        <div 
                          key={member.id}
                          className="flex items-center gap-4 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                        >
                          <div className="relative">
                            <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center text-lg font-medium text-gray-600 dark:text-gray-300">
                              {member.name.charAt(0)}
                            </div>
                            <div className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-white dark:border-gray-800 ${
                              member.status === 'online' ? 'bg-green-500' : 'bg-gray-400'
                            }`} />
                          </div>
                          <div>
                            <p className="text-base font-semibold text-gray-900 dark:text-white">
                              {member.name}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1.5 mt-0.5">
                              <Circle className={`w-2.5 h-2.5 fill-current ${
                                member.status === 'online' ? 'text-green-500' : 'text-gray-400'
                              }`} />
                              {member.status === 'online' ? 'Online' : 'Offline'}
                              {member.role === 'Leader' && ' • Leader'}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
          </div>
        )}
      </div>

      {/* Team Activity Report */}
      {currentTeam && (
        <div className="mt-8">
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
        <div className="space-y-4">
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

          <div className="flex justify-end gap-3 mt-6">
            <button
              onClick={() => setIsEditModalOpen(false)}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleEditTeam}
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
    </div>
  );
}