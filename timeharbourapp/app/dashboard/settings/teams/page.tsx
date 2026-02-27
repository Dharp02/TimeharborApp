'use client';

import { useState } from 'react';
import { Users, Plus, Check, Copy } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { useTeam } from '@/components/dashboard/TeamContext';
import { useLogger } from '@/hooks/useLogger';
import { copyText } from '@/lib/utils';
import { useRouter } from 'next/navigation';

export default function TeamSettingsPage() {
  const logger = useLogger();
  const router = useRouter();
  const { joinTeam, createTeam } = useTeam();
  
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  
  const [joinCode, setJoinCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  
  const [newTeamName, setNewTeamName] = useState('');
  const [createdTeamCode, setCreatedTeamCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleJoinTeam = async () => {
    if (!joinCode.trim()) return;
    
    setIsJoining(true);
    setJoinError(null);
    
    const result = await joinTeam(joinCode);
    
    if (result.success) {
      logger.log('Joined Team', { 
        subtitle: joinCode, 
        description: 'Joined via code',
        teamId: result.teamId 
      });
      setIsJoinModalOpen(false);
      setJoinCode('');
      router.push('/dashboard/teams');
    } else {
      setJoinError(result.error || 'Failed to join team');
    }
    
    setIsJoining(false);
  };

  const handleCreateTeam = async () => {
    try {
      const newTeam = await createTeam(newTeamName);
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
    setCopied(false);
    if (createdTeamCode) {
        router.push('/dashboard/teams');
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

  return (
    <div className="p-4 space-y-6">
      <div className="hidden md:block">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Team Settings</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <button
          onClick={() => setIsJoinModalOpen(true)}
          className="flex flex-col items-center justify-center p-8 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border-2 border-transparent hover:border-blue-500 dark:hover:border-blue-400 transition-all group"
        >
          <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <Users className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Join a Team</h3>
          <p className="text-center text-gray-500 dark:text-gray-400 text-sm">
            Enter a code to join an existing team and collaborate with members.
          </p>
        </button>

        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="flex flex-col items-center justify-center p-8 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border-2 border-transparent hover:border-purple-500 dark:hover:border-purple-400 transition-all group"
        >
          <div className="w-16 h-16 bg-purple-50 dark:bg-purple-900/20 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <Plus className="w-8 h-8 text-purple-600 dark:text-purple-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Create a Team</h3>
          <p className="text-center text-gray-500 dark:text-gray-400 text-sm">
            Set up a new team, invite members, and start tracking together.
          </p>
        </button>
      </div>

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
    </div>
  );
}