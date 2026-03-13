'use client';

import { useState, useEffect } from 'react';
import { Users, Plus, Copy, Check, Shield, User } from 'lucide-react';
import { useTeam } from './TeamContext';
import { Modal } from '@/components/ui/Modal';
import { copyText } from '@/lib/utils';
import { useLogger } from '@/hooks/useLogger';
import { Button, Input } from '@mieweb/ui';

interface TeamSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTeamSelected?: (teamName: string) => void;
}

export default function TeamSelectionModal({ isOpen, onClose, onTeamSelected }: TeamSelectionModalProps) {
  const logger = useLogger();
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

  const handleJoinSubmit = async () => {
    if (joinCode.trim()) {
      setIsJoining(true);
      setError(null);
      
      const result = await joinTeam(joinCode);
      
      if (result.success) {
        logger.log('Joined Team', { 
          subtitle: joinCode, 
          description: 'Joined via code',
          teamId: result.teamId // Ensure we log to the new team activity log
        });
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
        const newTeam = await createTeam(newTeamName);
        // Log to the *new* team's activity log using the new ID
        logger.log('Created Team', { 
          subtitle: newTeamName, 
          description: 'Created new team',
          teamId: newTeam.id 
        });
        setCreatedTeamCode(newTeam.code);
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
                          ? 'border-primary-500 bg-primary-50 dark:border-primary-500 dark:bg-primary-900/20' 
                          : 'border-gray-200 dark:border-gray-700 hover:border-primary-500 dark:hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full mb-3">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg transition-colors ${
                            isSelected
                              ? 'bg-primary-100 dark:bg-primary-800'
                              : 'bg-gray-100 dark:bg-gray-700 group-hover:bg-primary-100 dark:group-hover:bg-primary-800'
                          }`}>
                            <Users className={`w-5 h-5 ${
                              isSelected
                                ? 'text-primary-600 dark:text-primary-300'
                                : 'text-gray-600 dark:text-gray-300 group-hover:text-primary-600 dark:group-hover:text-primary-300'
                            }`} />
                          </div>
                          <div className="text-left">
                            <span className="block text-lg font-semibold text-gray-900 dark:text-white">{team.name}</span>
                            <span className="text-sm text-gray-500 dark:text-gray-400">{team.members.length} members</span>
                          </div>
                        </div>
                        
                        <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-sm font-medium ${
                          team.role === 'Leader' 
                            ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300' 
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
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => handleCopyCode(e, team.code)}
                            title="Copy Team Code"
                          >
                            {copiedCode === team.code ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="pt-4 border-t border-gray-200 dark:border-gray-700 flex gap-3">
            <Button
              variant="outline"
              onClick={() => setIsJoinModalOpen(true)}
              className="flex-1 p-3 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-primary-500 dark:hover:border-primary-500 hover:text-primary-600 dark:hover:text-primary-400 text-gray-500 dark:text-gray-400"
            >
              <Plus className="w-5 h-5" />
              <span className="font-medium">Join Team</span>
            </Button>

            <Button
              variant="outline"
              onClick={() => setIsCreateModalOpen(true)}
              className="flex-1 p-3 rounded-xl border-2 border-dashed border-primary-300 dark:border-primary-800 hover:border-primary-500 dark:hover:border-primary-500 hover:text-primary-600 dark:hover:text-primary-400 text-gray-500 dark:text-gray-400"
            >
              <Plus className="w-5 h-5" />
              <span className="font-medium">Create Team</span>
            </Button>
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
            <Input
              type="text"
              id="team-code"
              value={joinCode}
              onChange={(e) => {
                setJoinCode(e.target.value.toUpperCase());
                setError(null);
              }}
              placeholder="e.g. 123456"
              className="font-mono text-center tracking-widest text-lg uppercase"
              maxLength={6}
              disabled={isJoining}
            />
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <Button
              variant="ghost"
              onClick={() => {
                setIsJoinModalOpen(false);
                setError(null);
                setJoinCode('');
              }}
              disabled={isJoining}
            >
              Cancel
            </Button>
            <Button
              onClick={handleJoinSubmit}
              disabled={joinCode.length < 6 || isJoining}
            >
              {isJoining ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Joining...
                </>
              ) : (
                'Join Team'
              )}
            </Button>
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
                <Input
                  type="text"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  placeholder="e.g. Engineering Team"
                  disabled={isCreating}
                />
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <Button
                  variant="ghost"
                  onClick={() => setIsCreateModalOpen(false)}
                  disabled={isCreating}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateSubmit}
                  disabled={!newTeamName.trim() || isCreating}
                >
                  {isCreating ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Team'
                  )}
                </Button>
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
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => handleCopyCode(e, createdTeamCode!)}
                  title="Copy Code"
                >
                  {copiedCode === createdTeamCode ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                </Button>
              </div>

              <Button
                onClick={handleCreateClose}
                className="w-full"
              >
                Done
              </Button>
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
