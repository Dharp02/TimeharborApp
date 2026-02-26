'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { useSocket } from '@/contexts/SocketContext';
import { useRefresh } from '../../contexts/RefreshContext';
import { 
  fetchMyTeams, 
  createNewTeam, 
  joinTeamByCode, 
  updateTeam as apiUpdateTeam, 
  deleteTeam as apiDeleteTeam,
  addMemberToTeam,
  removeMemberFromTeam,
  updateMemberRole as apiUpdateMemberRole
} from '@/TimeharborAPI/teams';
import { db } from '@/TimeharborAPI/db';

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
  updateMemberRole: (teamId: string, memberId: string, role: 'Leader' | 'Member') => Promise<void>;
  addMember: (teamId: string, email: string) => Promise<void>;
  removeMember: (teamId: string, userId: string) => Promise<void>;
  refreshTeams: () => Promise<void>;
}

const TeamContext = createContext<TeamContextType | undefined>(undefined);

export function TeamProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { socket } = useSocket();
  const { register, lastRefreshed } = useRefresh();
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
      // Fast path: read from Dexie for instant UI (replaces localStorage cache)
      try {
        const cachedTeams = await db.teams.toArray();
        if (cachedTeams.length > 0) {
          setTeams(cachedTeams);
          const savedTeamId = localStorage.getItem('timeharbor-current-team-id');
          const cachedCurrent = savedTeamId
            ? cachedTeams.find(t => t.id === savedTeamId)
            : cachedTeams[0];
          if (cachedCurrent) setCurrentTeam(cachedCurrent);
          setIsLoading(false);
        }
      } catch (e) {
        console.warn('Failed to read cached teams from Dexie', e);
      }

      const myTeams = await fetchMyTeams();
      setTeams(myTeams);
      if (myTeams.length > 0) {
        await db.teams.bulkPut(myTeams);
      }

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

    const unregister = register(async () => {
        if (user) await loadTeams();
    });

    window.addEventListener('pull-to-refresh', handleRefresh);
    return () => {
        unregister();
        window.removeEventListener('pull-to-refresh', handleRefresh);
    };
  }, [user, register, lastRefreshed]);

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
      setTeams(prev => [...prev, newTeam]);
      setCurrentTeam(newTeam);
      db.teams.put(newTeam).catch(() => {});
      return { success: true, teamId: newTeam.id };
    } catch (error: any) {
      return { success: false, error: error.message || 'Failed to join team' };
    }
  };

  const createTeam = async (name: string) => {
    const newTeam = await createNewTeam(name);
    localStorage.setItem('timeharbor-current-team-id', newTeam.id);
    setTeams(prev => [...prev, newTeam]);
    setCurrentTeam(newTeam);
    db.teams.put(newTeam).catch(() => {});
    return newTeam;
  };

  const deleteTeam = async (teamId: string) => {
    try {
      await apiDeleteTeam(teamId);
      const nextTeams = teams.filter(t => t.id !== teamId);
      setTeams(nextTeams);
      db.teams.delete(teamId).catch(() => {});
      if (currentTeam?.id === teamId) {
        const next = nextTeams[0] ?? null;
        setCurrentTeam(next);
        if (next) {
          localStorage.setItem('timeharbor-current-team-id', next.id);
        } else {
          localStorage.removeItem('timeharbor-current-team-id');
        }
      }
    } catch (error) {
      console.error('Failed to delete team:', error);
      throw error;
    }
  };

  const updateTeamName = async (teamId: string, name: string) => {
    try {
      await apiUpdateTeam(teamId, name);
      setTeams(prev => prev.map(t => t.id === teamId ? { ...t, name } : t));
      if (currentTeam?.id === teamId) setCurrentTeam(prev => prev ? { ...prev, name } : prev);
      db.teams.update(teamId, { name }).catch(() => {});
    } catch (error) {
      console.error('Failed to update team:', error);
      throw error;
    }
  };

  const addMember = async (teamId: string, email: string) => {
    try {
      const newMember = await addMemberToTeam(teamId, email);
      setTeams(prev => prev.map(t =>
        t.id === teamId ? { ...t, members: [...t.members, newMember] } : t
      ));
      if (currentTeam?.id === teamId)
        setCurrentTeam(prev => prev ? { ...prev, members: [...prev.members, newMember] } : prev);
      const existing = teams.find(t => t.id === teamId);
      if (existing) db.teams.put({ ...existing, members: [...existing.members, newMember] }).catch(() => {});
    } catch (error) {
      console.error('Failed to add member:', error);
      throw error;
    }
  };

  const removeMember = async (teamId: string, userId: string) => {
    try {
      await removeMemberFromTeam(teamId, userId);
      setTeams(prev => prev.map(t =>
        t.id === teamId ? { ...t, members: t.members.filter(m => m.id !== userId) } : t
      ));
      if (currentTeam?.id === teamId)
        setCurrentTeam(prev => prev ? { ...prev, members: prev.members.filter(m => m.id !== userId) } : prev);
      const existing = teams.find(t => t.id === teamId);
      if (existing) db.teams.put({ ...existing, members: existing.members.filter(m => m.id !== userId) }).catch(() => {});
    } catch (error) {
      console.error('Failed to remove member:', error);
      throw error;
    }
  };

  const updateMemberRole = async (teamId: string, userId: string, role: 'Leader' | 'Member') => {
    try {
      await apiUpdateMemberRole(teamId, userId, role);
      setTeams(prev => prev.map(t =>
        t.id === teamId
          ? { ...t, members: t.members.map(m => m.id === userId ? { ...m, role } : m) }
          : t
      ));
      if (currentTeam?.id === teamId)
        setCurrentTeam(prev => prev
          ? { ...prev, members: prev.members.map(m => m.id === userId ? { ...m, role } : m) }
          : prev);
      const existing = teams.find(t => t.id === teamId);
      if (existing) db.teams.put({ ...existing, members: existing.members.map(m => m.id === userId ? { ...m, role } : m) }).catch(() => {});
    } catch (error) {
      console.error('Failed to update member role:', error);
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
    updateMemberRole,
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
