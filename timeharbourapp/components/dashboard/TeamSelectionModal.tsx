'use client';

import { useState } from 'react';
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
  const { teams, selectTeam, deleteTeam, joinTeam } = useTeam();
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      try {
        await joinTeam(joinCode);
        setIsJoinModalOpen(false);
        setJoinCode('');
        onClose();
      } catch (err: any) {
        setError(err.message || 'Failed to join team');
      } finally {
        setIsJoining(false);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-6">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Welcome to Timeharbor</h2>
            <p className="text-gray-500 dark:text-gray-400">Please select a team to continue.</p>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Your Teams</h3>
            <div className="max-h-[300px] overflow-y-auto space-y-3 pr-2">
              {teams.map((team) => (
                <div
                  key={team.id}
                  onClick={() => handleSelect(team.id)}
                  className="w-full flex flex-col p-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all group cursor-pointer relative"
                >
                  <div className="flex items-center justify-between w-full mb-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg group-hover:bg-blue-100 dark:group-hover:bg-blue-800 transition-colors">
                        <Users className="w-5 h-5 text-gray-600 dark:text-gray-300 group-hover:text-blue-600 dark:group-hover:text-blue-300" />
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
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setIsJoinModalOpen(true)}
              className="w-full flex items-center justify-center gap-2 p-3 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-blue-500 dark:hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 text-gray-500 dark:text-gray-400 transition-all"
            >
              <Plus className="w-5 h-5" />
              <span className="font-medium">Join another team</span>
            </button>
          </div>
        </div>
      </div>

      <Modal
        isOpen={isJoinModalOpen}
        onClose={() => setIsJoinModalOpen(false)}
        title="Join a Team"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Enter the 6-digit code provided by your team admin to join.
          </p>
          
          <div>
            <label htmlFor="team-code" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Team Code
            </label>
            <input
              type="text"
              id="team-code"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              placeholder="e.g. 123456"
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              maxLength={6}
            />
          </div>

          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 rounded-lg">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3 mt-6">
            <button
              onClick={() => setIsJoinModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleJoinSubmit}
              disabled={!joinCode.trim() || isJoining}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isJoining ? 'Joining...' : 'Join Team'}
              Cancel
            </button>
            <button
              onClick={handleJoinSubmit}
              disabled={!joinCode.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Join Team
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
