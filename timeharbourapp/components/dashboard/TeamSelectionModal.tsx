'use client';

import { useState } from 'react';
import { Users, Plus } from 'lucide-react';

interface TeamSelectionModalProps {
  onTeamSelected: () => void;
}

export default function TeamSelectionModal({ onTeamSelected }: TeamSelectionModalProps) {
  const [isOpen, setIsOpen] = useState(true);

  const handleSelect = () => {
    setIsOpen(false);
    onTeamSelected();
  };

  if (!isOpen) return null;

  const dummyTeams = [
    { id: '1', name: 'Team A', members: 5 },
    { id: '2', name: 'Team B', members: 12 },
    { id: '3', name: 'Team C', members: 3 },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Welcome to Timeharbor</h2>
          <p className="text-gray-500 dark:text-gray-400">Please select a team to continue.</p>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Your Teams</h3>
          {dummyTeams.map((team) => (
            <button
              key={team.id}
              onClick={handleSelect}
              className="w-full flex items-center justify-between p-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg group-hover:bg-blue-100 dark:group-hover:bg-blue-800 transition-colors">
                  <Users className="w-5 h-5 text-gray-600 dark:text-gray-300 group-hover:text-blue-600 dark:group-hover:text-blue-300" />
                </div>
                <div className="text-left">
                  <span className="block font-semibold text-gray-900 dark:text-white">{team.name}</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">{team.members} members</span>
                </div>
              </div>
            </button>
          ))}
        </div>

        <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={handleSelect}
            className="w-full flex items-center justify-center gap-2 p-3 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-blue-500 dark:hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 text-gray-500 dark:text-gray-400 transition-all"
          >
            <Plus className="w-5 h-5" />
            <span className="font-medium">Join another team</span>
          </button>
        </div>
      </div>
    </div>
  );
}
