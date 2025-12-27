'use client';

import { useState } from 'react';
import { Users, Plus, Copy, Check } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { useTeam } from '@/components/dashboard/TeamContext';
import { copyText } from '@/lib/utils';

export default function TeamsPage() {
  const { currentTeam, joinTeam, createTeam } = useTeam();
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [newTeamName, setNewTeamName] = useState('');
  const [createdTeamCode, setCreatedTeamCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [headerCopied, setHeaderCopied] = useState(false);

  const handleJoinTeam = () => {
    joinTeam(joinCode);
    setIsJoinModalOpen(false);
    setJoinCode('');
  };

  const handleCreateTeam = () => {
    const code = createTeam(newTeamName);
    setCreatedTeamCode(code);
  };

  const closeCreateModal = () => {
    setIsCreateModalOpen(false);
    setNewTeamName('');
    setCreatedTeamCode(null);
    setCopied(false);
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
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Your Teams</h2>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 text-center text-gray-500 dark:text-gray-400">
          <p>You haven't joined any teams yet.</p>
        </div>
      </div>

      {/* Join Team Modal */}
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
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Team Code
            </label>
            <input
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="e.g. 123456"
              maxLength={6}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white font-mono text-center tracking-widest text-lg uppercase"
            />
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <button
              onClick={() => setIsJoinModalOpen(false)}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleJoinTeam}
              disabled={joinCode.length < 6}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Join Team
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
