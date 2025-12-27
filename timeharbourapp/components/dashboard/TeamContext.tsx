'use client';

import React, { createContext, useContext, useState } from 'react';

export type Team = {
  id: string;
  name: string;
  members: number;
  role: 'Leader' | 'Member';
  code: string;
};

interface TeamContextType {
  currentTeam: Team | null;
  teams: Team[];
  selectTeam: (teamId: string) => void;
  joinTeam: (code: string) => void;
  createTeam: (name: string) => string; // returns code
  deleteTeam: (teamId: string) => void;
}

const TeamContext = createContext<TeamContextType | undefined>(undefined);

export function TeamProvider({ children }: { children: React.ReactNode }) {
  // Mock data
  const [teams, setTeams] = useState<Team[]>([
    { id: '1', name: 'Team A', members: 5, role: 'Leader', code: '123456' },
    { id: '2', name: 'Team B', members: 12, role: 'Member', code: '789012' },
    { id: '3', name: 'Team C', members: 3, role: 'Leader', code: '345678' },
  ]);
  const [currentTeam, setCurrentTeam] = useState<Team | null>(null);

  const selectTeam = (teamId: string) => {
    const team = teams.find(t => t.id === teamId);
    if (team) setCurrentTeam(team);
  };

  const joinTeam = (code: string) => {
    // Mock join logic
    const newTeam: Team = {
      id: Math.random().toString(),
      name: `Team ${code}`,
      members: 1,
      role: 'Member',
      code: code
    };
    setTeams([...teams, newTeam]);
    setCurrentTeam(newTeam);
  };

  const createTeam = (name: string) => {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const newTeam: Team = {
      id: Math.random().toString(),
      name,
      members: 1,
      role: 'Leader',
      code
    };
    setTeams([...teams, newTeam]);
    setCurrentTeam(newTeam);
    return code;
  };

  const deleteTeam = (teamId: string) => {
    setTeams(teams.filter(t => t.id !== teamId));
    if (currentTeam?.id === teamId) {
      setCurrentTeam(null);
    }
  };

  return (
    <TeamContext.Provider value={{ currentTeam, teams, selectTeam, joinTeam, createTeam, deleteTeam }}>
      {children}
    </TeamContext.Provider>
  );
}

export function useTeam() {
  const context = useContext(TeamContext);
  if (context === undefined) {
    throw new Error('useTeam must be used within a TeamProvider');
  }
  return context;
}
