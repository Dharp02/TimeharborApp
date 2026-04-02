'use client';

import React, { createContext, useContext } from 'react';

// Types preserved for backward compatibility
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
  createTeam: (name: string) => Promise<Team>;
  deleteTeam: (teamId: string) => Promise<void>;
  updateTeamName: (teamId: string, name: string) => Promise<void>;
  updateMemberRole: (teamId: string, memberId: string, role: 'Leader' | 'Member') => Promise<void>;
  addMember: (teamId: string, email: string) => Promise<void>;
  removeMember: (teamId: string, userId: string) => Promise<void>;
  refreshTeams: () => Promise<void>;
}

const noop = async () => {};

const defaultValue: TeamContextType = {
  currentTeam: null,
  teams: [],
  isLoading: false,
  selectTeam: () => {},
  joinTeam: async () => ({ success: false }),
  createTeam: async () => ({ id: '', name: '', members: [], role: 'Member', code: '' }),
  deleteTeam: noop,
  updateTeamName: noop,
  updateMemberRole: noop,
  addMember: noop,
  removeMember: noop,
  refreshTeams: noop,
};

const TeamContext = createContext<TeamContextType>(defaultValue);

/**
 * Teams have been moved to Timehuddle.
 * This provider is a no-op stub that keeps existing consumers compiling.
 */
export function TeamProvider({ children }: { children: React.ReactNode }) {
  return <TeamContext.Provider value={defaultValue}>{children}</TeamContext.Provider>;
}

export function useTeam() {
  return useContext(TeamContext);
}
