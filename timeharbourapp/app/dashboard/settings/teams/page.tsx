'use client';

import { useState } from 'react';
import { Users, Plus, Check, Copy } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { useTeam } from '@/components/dashboard/TeamContext';
import { useLogger } from '@/hooks/useLogger';
import { Button, Input } from '@mieweb/ui';
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
        <Button
  variant="outline"
          onClick={() => setIsJoinModalOpen(true)}
          className="flex flex-col items-center justify-center p-8 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border-2 border-transparent hover:border-primary-500 dark:hover:border-primary-400 group h-auto"
        >
          <div className="w-16 h-16 bg-primary-50 dark:bg-primary-900/20 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <Users className="w-8 h-8 text-primary-600 dark:text-primary-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Join a Team</h3>
          <p className="text-center text-gray-500 dark:text-gray-400 text-sm">
            Enter a code to join an existing team and collaborate with members.
          </p>
        </Button>

        <Button
  variant="outline"
          onClick={() => setIsCreateModalOpen(true)}
          className="flex flex-col items-center justify-center p-8 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border-2 border-transparent hover:border-primary-500 dark:hover:border-primary-400 group h-auto"
        >
          <div className="w-16 h-16 bg-primary-50 dark:bg-primary-900/20 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <Plus className="w-8 h-8 text-primary-600 dark:text-primary-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Create a Team</h3>
          <p className="text-center text-gray-500 dark:text-gray-400 text-sm">
            Set up a new team, invite members, and start tracking together.
          </p>
        </Button>
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
            <Input
              type="text"
              value={joinCode}
              onChange={(e) => {
                setJoinCode(e.target.value.toUpperCase());
                setJoinError(null);
              }}
              placeholder="e.g. 123456"
              maxLength={6}
              disabled={isJoining}
              className="font-mono text-center tracking-widest text-lg uppercase"
            />
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <Button
  variant="ghost"
              onClick={() => {
                setIsJoinModalOpen(false);
                setJoinError(null);
                setJoinCode('');
              }}
              disabled={isJoining}
            >
              Cancel
            </Button>
            <Button
              onClick={handleJoinTeam}
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
                <Input
                  type="text"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  placeholder="e.g. Engineering Team"
                />
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <Button
  variant="ghost"
                  onClick={closeCreateModal}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateTeam}
                  disabled={!newTeamName.trim()}
                >
                  Create Team
                </Button>
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
                <Button
  variant="ghost"
  size="icon"
                  onClick={copyToClipboard}
                  title="Copy Code"
                >
                  {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                </Button>
              </div>

              <Button
                onClick={closeCreateModal}
              >
                Done
              </Button>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}