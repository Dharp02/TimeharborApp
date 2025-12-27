'use client';

import React, { createContext, useContext, useState } from 'react';
import { createNewTeam } from '@/TimeharborAPI/teams';

export type Member = {
  id: string;
  name: string;
  status: 'online' | 'offline';
  role: 'Leader' | 'Member';
  avatar?: string;
};

export type Team = {
  id: string;
  name: string;
  members: Member[];
  role: 'Leader' | 'Member';
  code: string;
};

interface TeamContextType {
  currentTeam: Team | null;
  teams: Team[];
  selectTeam: (teamId: string) => void;
  joinTeam: (code: string) => void;
  createTeam: (name: string) => Promise<string>; // returns code
  deleteTeam: (teamId: string) => void;
  updateTeamName: (teamId: string, name: string) => void;
}

const TeamContext = createContext<TeamContextType | undefined>(undefined);

export function TeamProvider({ children }: { children: React.ReactNode }) {
  // Mock data
  const [teams, setTeams] = useState<Team[]>([
    { 
      id: '1', 
      name: 'Team A', 
      members: [
        { id: 'u1', name: 'You', status: 'online', role: 'Leader' },
        { id: 'u2', name: 'Alice', status: 'online', role: 'Member' },
        { id: 'u3', name: 'Bob', status: 'offline', role: 'Member' },
        { id: 'u4', name: 'Charlie', status: 'offline', role: 'Member' },
        { id: 'u5', name: 'David', status: 'online', role: 'Member' },
      ], 
      role: 'Leader', 
      code: '123456' 
    },
    { 
      id: '2', 
      name: 'Team B', 
      members: [
        { id: 'u1', name: 'You', status: 'online', role: 'Member' },
        { id: 'u6', name: 'Eve', status: 'online', role: 'Leader' },
      ], 
      role: 'Member', 
      code: '789012' 
    },
    { 
      id: '3', 
      name: 'Team C', 
      members: [
        { id: 'u1', name: 'You', status: 'online', role: 'Leader' },
        { id: 'u7', name: 'Frank', status: 'offline', role: 'Member' },
        { id: 'u8', name: 'Grace', status: 'online', role: 'Member' },
      ], 
      role: 'Leader', 
      code: '345678' 
    },
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
      members: [
        { id: 'u1', name: 'You', status: 'online', role: 'Member' }
      ],
      role: 'Member',
      code: code
    };
    setTeams([...teams, newTeam]);
    setCurrentTeam(newTeam);
  };

  const createTeam = async (name: string) => {
    const newTeam = await createNewTeam(name);
    setTeams([...teams, newTeam]);
    setCurrentTeam(newTeam);
    return newTeam.code;
  };

  const deleteTeam = (teamId: string) => {
    setTeams(teams.filter(t => t.id !== teamId));
    if (currentTeam?.id === teamId) {
      setCurrentTeam(null);
    }
  };

  const updateTeamName = (teamId: string, name: string) => {
    setTeams(teams.map(t => t.id === teamId ? { ...t, name } : t));
    if (currentTeam?.id === teamId) {
      setCurrentTeam(prev => prev ? { ...prev, name } : null);
    }
  };

  return (
    <TeamContext.Provider value={{ currentTeam, teams, selectTeam, joinTeam, createTeam, deleteTeam, updateTeamName }}>
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
