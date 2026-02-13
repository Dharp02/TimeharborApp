'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { createNewTeam, joinTeamByCode, fetchMyTeams, updateTeam as apiUpdateTeam, deleteTeam as apiDeleteTeam, addMemberToTeam, removeMemberFromTeam } from '@/TimeharborAPI/teams';

export type Member = {
  id: string;
  name: string;
  email?: string;
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
  deleteTeam: (teamId: string) => Promise<void>;
  updateTeamName: (teamId: string, name: string) => Promise<void>;
  addMember: (teamId: string, email: string) => Promise<void>;
  removeMember: (teamId: string, userId: string) => Promise<void>;
  refreshTeams: () => Promise<void>;
}

const TeamContext = createContext<TeamContextType | undefined>(undefined);

export function TeamProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [currentTeam, setCurrentTeam] = useState<Team | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadTeams = async () => {
    try {
      // Optimistic load from local storage first for instant UI
      // Use 'timeharbor_teams' directly as it is used in TimeharborAPI/teams/index.ts
      if (typeof window !== 'undefined') {
        const cached = localStorage.getItem('timeharbor_teams');
        if (cached) {
          try {
            const parsedTeams = JSON.parse(cached);
            if (Array.isArray(parsedTeams) && parsedTeams.length > 0) {
              setTeams(parsedTeams);
              // Also try to set current team if not set
              if (!currentTeam) {
                 const savedTeamId = localStorage.getItem('timeharbor-current-team-id');
                 if (savedTeamId) {
                   const team = parsedTeams.find(t => t.id === savedTeamId);
                   if (team) setCurrentTeam(team);
                 } else {
                   setCurrentTeam(parsedTeams[0]);
                 }
              }
              // Data is visible, so we can stop loading spinner even if network sync is pending
              // But we keep loading true if we want to show a background sync indicator
              // For UX, "isLoading" usually means "blocking load", so we can set it false.
              setIsLoading(false);
            }
          } catch (e) {
            console.warn('Failed to parse cached teams', e);
          }
        }
      }

      const myTeams = await fetchMyTeams();
      setTeams(myTeams);
      
      const savedTeamId = localStorage.getItem('timeharbor-current-team-id');
      if (savedTeamId) {
        const team = myTeams.find(t => t.id === savedTeamId);
        if (team) {
          setCurrentTeam(team);
        } else if (myTeams.length > 0) {
          setCurrentTeam(myTeams[0]);
          localStorage.setItem('timeharbor-current-team-id', myTeams[0].id);
        }
      } else if (myTeams.length > 0) {
        setCurrentTeam(myTeams[0]);
        localStorage.setItem('timeharbor-current-team-id', myTeams[0].id);
      }
    } catch (error) {
      console.error('Failed to load teams:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadTeams();
    } else {
      // If no user (logged out), clear teams but only if we had them
      if (teams.length > 0) {
        setTeams([]);
        setCurrentTeam(null);
      }
    }
  }, [user]);

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
      localStorage.setItem('timeharbor-current-team-id', newTeam.id);
      await loadTeams();
      return { success: true };
    } catch (error: any) {
      // console.error('Error joining team:', error);
      return { success: false, error: error.message || 'Failed to join team' };
    }
  };

  const createTeam = async (name: string) => {
    const newTeam = await createNewTeam(name);
    localStorage.setItem('timeharbor-current-team-id', newTeam.id);
    await loadTeams();
    return newTeam.code;
  };

  const deleteTeam = async (teamId: string) => {
    try {
      await apiDeleteTeam(teamId);
      if (currentTeam?.id === teamId) {
        localStorage.removeItem('timeharbor-current-team-id');
        setCurrentTeam(null);
      }
      await loadTeams();
    } catch (error) {
      console.error('Failed to delete team:', error);
      throw error;
    }
  };

  const updateTeamName = async (teamId: string, name: string) => {
    try {
      await apiUpdateTeam(teamId, name);
      await loadTeams();
    } catch (error) {
      console.error('Failed to update team:', error);
      throw error;
    }
  };

  const addMember = async (teamId: string, email: string) => {
    try {
      await addMemberToTeam(teamId, email);
      await loadTeams();
    } catch (error) {
      console.error('Failed to add member:', error);
      throw error;
    }
  };

  const removeMember = async (teamId: string, userId: string) => {
    try {
      await removeMemberFromTeam(teamId, userId);
      await loadTeams();
    } catch (error) {
      console.error('Failed to remove member:', error);
      throw error;
    }
  };

  return (
    <TeamContext.Provider value={{ currentTeam, teams, isLoading, selectTeam, joinTeam, createTeam, deleteTeam, updateTeamName, addMember, removeMember, refreshTeams: loadTeams }}>
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
