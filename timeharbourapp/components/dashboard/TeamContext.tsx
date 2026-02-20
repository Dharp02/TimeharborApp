'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { useSocket } from '@/contexts/SocketContext';
import { 
  fetchMyTeams, 
  createNewTeam, 
  joinTeamByCode, 
  updateTeam as apiUpdateTeam, 
  deleteTeam as apiDeleteTeam,
  addMemberToTeam,
  removeMemberFromTeam 
} from '@/TimeharborAPI/teams';

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
  joinTeam: (code: string) => Promise<{ success: boolean; error?: string; teamId?: string }>;
  createTeam: (name: string) => Promise<Team>; // returns entire team object
  deleteTeam: (teamId: string) => Promise<void>;
  updateTeamName: (teamId: string, name: string) => Promise<void>;
  addMember: (teamId: string, email: string) => Promise<void>;
  removeMember: (teamId: string, userId: string) => Promise<void>;
  refreshTeams: () => Promise<void>;
}

const TeamContext = createContext<TeamContextType | undefined>(undefined);

export function TeamProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [teams, setTeams] = useState<Team[]>([]);
  const [currentTeam, setCurrentTeam] = useState<Team | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Listen for real-time online status updates
  useEffect(() => {
    if (!socket || !currentTeam) return;

    const handleStatusChange = ({ userId, status }: { userId: string, status: 'online' | 'offline' }) => {
      console.log(`User status changed: ${userId} -> ${status}`);
      
      setCurrentTeam(prevTeam => {
        if (!prevTeam) return null;
        
        const memberExists = prevTeam.members.some(m => m.id === userId);
        if (!memberExists) return prevTeam;

        return {
          ...prevTeam,
          members: prevTeam.members.map(member => 
            member.id === userId ? { ...member, status } : member
          )
        };
      });
    };

    socket.on('user_status_change', handleStatusChange);

    return () => {
      socket.off('user_status_change', handleStatusChange);
    };
  }, [socket, currentTeam?.id]); // Re-subscribe if socket or team ID changes

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

    const handleRefresh = () => {
      if (user) loadTeams();
    };
    window.addEventListener('pull-to-refresh', handleRefresh);
    return () => window.removeEventListener('pull-to-refresh', handleRefresh);
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
      return { success: true, teamId: newTeam.id };
    } catch (error: any) {
      // console.error('Error joining team:', error);
      return { success: false, error: error.message || 'Failed to join team' };
    }
  };

  const createTeam = async (name: string) => {
    const newTeam = await createNewTeam(name); // returns { id, name, code, members, role }
    localStorage.setItem('timeharbor-current-team-id', newTeam.id);
    
    await loadTeams();
    return newTeam;
  };

  const deleteTeam = async (teamId: string) => {
    try {
      const teamNames = teams.find(t => t.id === teamId)?.name || 'Team';
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
      const oldName = teams.find(t => t.id === teamId)?.name;
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

  // Memoize the context value to prevent unnecessary re-renders of consumers
  const contextValue = React.useMemo(() => ({
    currentTeam,
    teams,
    isLoading,
    selectTeam,
    joinTeam,
    createTeam,
    deleteTeam,
    updateTeamName,
    addMember,
    removeMember,
    refreshTeams: loadTeams
  }), [currentTeam, teams, isLoading]);

  return (
    <TeamContext.Provider value={contextValue}>
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
