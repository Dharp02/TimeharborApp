'use client';

import { useState, useEffect } from 'react';
import { Users, Plus, Copy, Trash2, Check, Shield, User } from 'lucide-react';
import { useTeam } from './TeamContext';
import { Modal } from '@/components/ui/Modal';
import { copyText } from '@/lib/utils';

interface TeamSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTeamSelected?: (teamName: string) => void;
}

export default function TeamSelectionModal({ isOpen, onClose, onTeamSelected }: TeamSelectionModalProps) {
  const { teams, currentTeam, selectTeam, deleteTeam, joinTeam, createTeam } = useTeam();
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [newTeamName, setNewTeamName] = useState('');
  const [createdTeamCode, setCreatedTeamCode] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isJoinModalOpen) {
      setError(null);
      setJoinCode('');
    }
  }, [isJoinModalOpen]);

  useEffect(() => {
    if (isCreateModalOpen) {
      setNewTeamName('');
      setCreatedTeamCode(null);
    }
  }, [isCreateModalOpen]);

  const handleSelect = (teamId: string) => {
    selectTeam(teamId);
    const team = teams.find(t => t.id === teamId);
    if (team && onTeamSelected) {
      onTeamSelected(team.name);
    }
    onClose();
  };

  const handleCopyCode = async (e: React.MouseEvent, code: string) => {
    e.stopPropagation();
    const success = await copyText(code);
    if (success) {
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    }
  };

  const handleDeleteTeam = (e: React.MouseEvent, teamId: string) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this team? This action cannot be undone.')) {
      deleteTeam(teamId);
    }
  };

  const handleJoinSubmit = async () => {
    if (joinCode.trim()) {
      setIsJoining(true);
      setError(null);
      
      const result = await joinTeam(joinCode);
      
      if (result.success) {
        setIsJoinModalOpen(false);
        setJoinCode('');
        onClose();
      } else {
        setError(result.error || 'Failed to join team');
      }
      
      setIsJoining(false);
    }
  };

  const handleCreateSubmit = async () => {
    if (newTeamName.trim()) {
      setIsCreating(true);
      try {
        const code = await createTeam(newTeamName);
        setCreatedTeamCode(code);
      } catch (err) {
        console.error('Failed to create team:', err);
      } finally {
        setIsCreating(false);
      }
    }
  };

  const handleCreateClose = () => {
    setIsCreateModalOpen(false);
    if (createdTeamCode) {
      // If a team was created, close the main modal too as it's likely selected
      onClose();
    }
  };

  const sortedTeams = [...teams].sort((a, b) => {
    if (currentTeam?.id === a.id) return -1;
    if (currentTeam?.id === b.id) return 1;
    return 0;
  });

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-6">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Welcome to Timeharbor</h2>
            {sortedTeams.length > 0 && (
              <p className="text-gray-500 dark:text-gray-400">Please select a team to continue.</p>
            )}
          </div>

          {sortedTeams.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Your Teams</h3>
              <div className="max-h-[300px] overflow-y-auto space-y-3 pr-2">
                {sortedTeams.map((team) => {
                  const isSelected = currentTeam?.id === team.id;
                  return (
                    <div
                      key={team.id}
                      onClick={() => handleSelect(team.id)}
                      className={`w-full flex flex-col p-4 rounded-xl border transition-all group cursor-pointer relative ${
                        isSelected 
                          ? 'border-blue-500 bg-blue-50 dark:border-blue-500 dark:bg-blue-900/20' 
                          : 'border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full mb-3">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg transition-colors ${
                            isSelected
                              ? 'bg-blue-100 dark:bg-blue-800'
                              : 'bg-gray-100 dark:bg-gray-700 group-hover:bg-blue-100 dark:group-hover:bg-blue-800'
                          }`}>
                            <Users className={`w-5 h-5 ${
                              isSelected
                                ? 'text-blue-600 dark:text-blue-300'
                                : 'text-gray-600 dark:text-gray-300 group-hover:text-blue-600 dark:group-hover:text-blue-300'
                            }`} />
                          </div>
                          <div className="text-left">
                            <span className="block text-lg font-semibold text-gray-900 dark:text-white">{team.name}</span>
                            <span className="text-sm text-gray-500 dark:text-gray-400">{team.members.length} members</span>
                          </div>
                        </div>
                        
                        <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-sm font-medium ${
                          team.role === 'Leader' 
                            ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' 
                            : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                        }`}>
                          {team.role === 'Leader' ? <Shield className="w-4 h-4" /> : <User className="w-4 h-4" />}
                          {team.role}
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-700/50 w-full">
                        <div className="flex items-center gap-3">
                          <span className="text-base font-mono bg-gray-100 dark:bg-gray-700 px-3 py-1.5 rounded text-gray-600 dark:text-gray-300">
                            {team.code}
                          </span>
                          <button
                            onClick={(e) => handleCopyCode(e, team.code)}
                            className="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                            title="Copy Team Code"
                          >
                            {copiedCode === team.code ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                          </button>
                        </div>
                        
                        {team.role === 'Leader' && (
                          <button
                            onClick={(e) => handleDeleteTeam(e, team.id)}
                            className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                            title="Delete Team"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="pt-4 border-t border-gray-200 dark:border-gray-700 flex gap-3">
            <button
              onClick={() => setIsJoinModalOpen(true)}
              className="flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-blue-500 dark:hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 text-gray-500 dark:text-gray-400 transition-all"
            >
              <Plus className="w-5 h-5" />
              <span className="font-medium">Join Team</span>
            </button>

            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border-2 border-dashed border-purple-300 dark:border-purple-800 hover:border-purple-500 dark:hover:border-purple-500 hover:text-purple-600 dark:hover:text-purple-400 text-gray-500 dark:text-gray-400 transition-all"
            >
              <Plus className="w-5 h-5" />
              <span className="font-medium">Create Team</span>
            </button>
          </div>
        </div>
      </div>

      <Modal
        isOpen={isJoinModalOpen}
        onClose={() => {
          setIsJoinModalOpen(false);
          setError(null);
          setJoinCode('');
        }}
        title="Join a Team"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Enter the 6-digit code provided by your team admin to join.
          </p>
          
          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 rounded-lg animate-in fade-in slide-in-from-top-2 duration-200 border border-red-200 dark:border-red-800">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="team-code" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Team Code
            </label>
            <input
              type="text"
              id="team-code"
              value={joinCode}
              onChange={(e) => {
                setJoinCode(e.target.value.toUpperCase());
                setError(null);
              }}
              placeholder="e.g. 123456"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white font-mono text-center tracking-widest text-lg uppercase disabled:opacity-50 disabled:cursor-not-allowed"
              maxLength={6}
              disabled={isJoining}
            />
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <button
              onClick={() => {
                setIsJoinModalOpen(false);
                setError(null);
                setJoinCode('');
              }}
              disabled={isJoining}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={handleJoinSubmit}
              disabled={joinCode.length < 6 || isJoining}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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

      <Modal
        isOpen={isCreateModalOpen}
        onClose={handleCreateClose}
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
                  disabled={isCreating}
                />
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  disabled={isCreating}
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateSubmit}
                  disabled={!newTeamName.trim() || isCreating}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isCreating ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Team'
                  )}
                </button>
              </div>
            </>
          ) : (
            <div className="text-center space-y-6 py-4">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto">
                <Check className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
              
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Team Created!</h3>
                <p className="text-gray-500 dark:text-gray-400">
                  Share this code with your team members to let them join.
                </p>
              </div>

              <div className="flex items-center justify-center gap-3 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-200 dark:border-gray-700">
                <span className="text-2xl font-mono font-bold tracking-wider text-gray-900 dark:text-white">
                  {createdTeamCode}
                </span>
                <button
                  onClick={(e) => handleCopyCode(e, createdTeamCode!)}
                  className="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                  title="Copy Code"
                >
                  {copiedCode === createdTeamCode ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                </button>
              </div>

              <button
                onClick={handleCreateClose}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
