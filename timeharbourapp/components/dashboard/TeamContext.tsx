'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { createNewTeam, joinTeamByCode, fetchMyTeams } from '@/TimeharborAPI/teams';


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
  isLoading: boolean;
  selectTeam: (teamId: string) => void;
  joinTeam: (code: string) => Promise<{ success: boolean; error?: string }>;
  createTeam: (name: string) => Promise<string>; // returns code
  deleteTeam: (teamId: string) => void;
  updateTeamName: (teamId: string, name: string) => void;
}

const TeamContext = createContext<TeamContextType | undefined>(undefined);

export function TeamProvider({ children }: { children: React.ReactNode }) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [currentTeam, setCurrentTeam] = useState<Team | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadTeams = async () => {
      try {
        const myTeams = await fetchMyTeams();
        setTeams(myTeams);
        
        const savedTeamId = localStorage.getItem('timeharbor-current-team-id');
        if (savedTeamId) {
          const team = myTeams.find(t => t.id === savedTeamId);
          if (team) {
            setCurrentTeam(team);
          } else if (myTeams.length > 0) {
            setCurrentTeam(myTeams[0]);
          }
        } else if (myTeams.length > 0) {
          setCurrentTeam(myTeams[0]);
        }
      } catch (error) {
        console.error('Failed to load teams:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadTeams();
  }, []);

  const selectTeam = (teamId: string) => {
    const team = teams.find(t => t.id === teamId);
    if (team) {
      setCurrentTeam(team);
      localStorage.setItem('timeharbor-current-team-id', teamId);
    }
  };

  const joinTeam = async (code: string) => {
    try {
      const newTeam = await joinTeamByCode(code);
      setTeams(prev => [...prev, newTeam]);
      setCurrentTeam(newTeam);
      localStorage.setItem('timeharbor-current-team-id', newTeam.id);
      return { success: true };
    } catch (error: any) {
      // console.error('Error joining team:', error);
      return { success: false, error: error.message || 'Failed to join team' };
    }
  };

  const createTeam = async (name: string) => {
    const newTeam = await createNewTeam(name);
    setTeams([...teams, newTeam]);
    setCurrentTeam(newTeam);
    localStorage.setItem('timeharbor-current-team-id', newTeam.id);
    return newTeam.code;
  };

  const deleteTeam = (teamId: string) => {
    setTeams(teams.filter(t => t.id !== teamId));
    if (currentTeam?.id === teamId) {
      setCurrentTeam(null);
      localStorage.removeItem('timeharbor-current-team-id');
    }
  };

  const updateTeamName = (teamId: string, name: string) => {
    setTeams(teams.map(t => t.id === teamId ? { ...t, name } : t));
    if (currentTeam?.id === teamId) {
      setCurrentTeam(prev => prev ? { ...prev, name } : null);
    }
  };

  return (
    <TeamContext.Provider value={{ currentTeam, teams, isLoading, selectTeam, joinTeam, createTeam, deleteTeam, updateTeamName }}>
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
