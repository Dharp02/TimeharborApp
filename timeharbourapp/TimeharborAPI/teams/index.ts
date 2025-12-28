import { v4 as uuidv4 } from 'uuid';
import { db } from '../../lib/db';
import { authenticatedFetch, getUser } from '../auth';
import NetworkDetector from '../NetworkDetector';

export interface Member {
  id: string;
  name: string;
  status: 'online' | 'offline';
  role: 'Leader' | 'Member';
  avatar?: string;
}

export interface Team {
  id: string;
  name: string;
  members: Member[];
  role: 'Leader' | 'Member';
  code: string;
}

const STORAGE_KEY = 'timeharbor_teams';
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://10.0.0.39:3001';

const isBrowser = typeof window !== 'undefined';

// Generate or retrieve device ID once
const getDeviceId = (): string => {
  if (!isBrowser) return uuidv4();
  
  let deviceId = localStorage.getItem('deviceId');
  if (!deviceId) {
      deviceId = uuidv4();
      localStorage.setItem('deviceId', deviceId);
  }
  return deviceId;
};

export const generateTeamCode = (): string => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    
    // 2 chars from device ID (consistent per device)
    const deviceId = getDeviceId();
    const deviceHash = deviceId.slice(0, 2).toUpperCase();
    
    // 4 random chars
    const array = new Uint8Array(4);
    crypto.getRandomValues(array);
    let random = '';
    for (let i = 0; i < 4; i++) {
        random += chars[array[i] % chars.length];
    }
    
    return deviceHash + random;
};

const getTeams = (): Team[] => {
  if (!isBrowser) return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Error reading teams from offline storage:', error);
    return [];
  }
};

const saveTeam = (team: Team): void => {
  if (!isBrowser) return;
  try {
    const teams = getTeams();
    teams.push(team);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(teams));
  } catch (error) {
    console.error('Error saving team to offline storage:', error);
  }
};
export const createNewTeam = async (name: string): Promise<Team> => {
  const { user } = await getUser();
  const code = generateTeamCode();
  
  const member: Member = user ? {
    id: user.id,
    name: user.full_name || user.email,
    status: 'online',
    role: 'Leader'
  } : {
    id: 'u1',
    name: 'You',
    status: 'online',
    role: 'Leader'
  };

  const newTeam: Team = {
    id: uuidv4(),
    name,
    members: [member],
    role: 'Leader',
    code
  };
  
  saveTeam(newTeam);

  const url = `${API_URL}/teams`;
  const body = {
    id: newTeam.id,
    name: newTeam.name,
    code: newTeam.code,
    createdAt: new Date().toISOString()
  };

  try {
    // Try to send immediately
    const response = await authenticatedFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new Error('Failed to create team on backend');
    }
  } catch (error) {
    console.log('Offline or backend unreachable, queuing mutation', error);
    // Store in Dexie for sync
    await db.offlineMutations.add({
      url,
      method: 'POST',
      body,
      timestamp: Date.now(),
      retryCount: 0
    });

    // Trigger sync attempt in case we are actually online
    NetworkDetector.getInstance().triggerSync();
  }

  return newTeam;
};

export const joinTeamByCode = async (code: string): Promise<Team> => {
  const { user } = await getUser();
  if (!user) throw new Error('User not authenticated');

  const url = `${API_URL}/teams/join`;
  
  const response = await authenticatedFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code })
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to join team');
  }

  const teamData = await response.json();

  // Construct local Team object
  const member: Member = {
    id: user.id,
    name: user.full_name || user.email,
    status: 'online',
    role: 'Member'
  };

  const newTeam: Team = {
    id: teamData.id,
    name: teamData.name,
    members: [member],
    role: 'Member',
    code: teamData.code
  };

  saveTeam(newTeam);
  return newTeam;
};

export const fetchMyTeams = async (): Promise<Team[]> => {
  const user = getUser();
  if (!user) throw new Error('User not authenticated');

  const response = await authenticatedFetch(`${API_URL}/teams`);
  
  if (!response.ok) {
    throw new Error('Failed to fetch teams');
  }

  const teams: Team[] = await response.json();
  
  // Update local storage
  localStorage.setItem(STORAGE_KEY, JSON.stringify(teams));
  
  return teams;
};

export const updateTeam = async (teamId: string, name: string): Promise<Team> => {
  const user = getUser();
  if (!user) throw new Error('User not authenticated');

  const response = await authenticatedFetch(`${API_URL}/teams/${teamId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ name })
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to update team');
  }

  const updatedTeam = await response.json();
  
  // Update local storage
  if (isBrowser) {
    const storedTeamsStr = localStorage.getItem(STORAGE_KEY);
    if (storedTeamsStr) {
      const teams: Team[] = JSON.parse(storedTeamsStr);
      const updatedTeams = teams.map(t => t.id === teamId ? { ...t, name: updatedTeam.name } : t);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedTeams));
    }
  }

  return updatedTeam;
};

export const deleteTeam = async (teamId: string): Promise<void> => {
  const user = getUser();
  if (!user) throw new Error('User not authenticated');

  const response = await authenticatedFetch(`${API_URL}/teams/${teamId}`, {
    method: 'DELETE'
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to delete team');
  }

  // Update local storage
  if (isBrowser) {
    const storedTeamsStr = localStorage.getItem(STORAGE_KEY);
    if (storedTeamsStr) {
      const teams: Team[] = JSON.parse(storedTeamsStr);
      const updatedTeams = teams.filter(t => t.id !== teamId);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedTeams));
    }
  }
};

export const addMemberToTeam = async (teamId: string, email: string): Promise<Member> => {
  const user = getUser();
  if (!user) throw new Error('User not authenticated');

  const response = await authenticatedFetch(`${API_URL}/teams/${teamId}/members`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email })
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to add member');
  }

  return await response.json();
};

export const removeMemberFromTeam = async (teamId: string, userIdToRemove: string): Promise<void> => {
  const user = getUser();
  if (!user) throw new Error('User not authenticated');

  const response = await authenticatedFetch(`${API_URL}/teams/${teamId}/members/${userIdToRemove}`, {
    method: 'DELETE'
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to remove member');
  }
};
