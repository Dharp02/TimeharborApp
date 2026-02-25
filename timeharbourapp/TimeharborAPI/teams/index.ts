import { Network } from '@capacitor/network';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db';
import { authenticatedFetch, getUser } from '../auth';
import NetworkDetector from '../NetworkDetector';

export interface Member {
  id: string;
  name: string;
  email?: string;
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
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://10.0.0.8:8080/api';

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

const saveTeam = async (team: Team): Promise<void> => {
  if (!isBrowser) return;
  try {
    const teams = getTeams();
    teams.push(team);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(teams));
    
    // Update Dexie
    await db.teams.put(team);
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
    email: user.email,
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
  
  await saveTeam(newTeam);

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
      retryCount: 0,
      tempId: newTeam.id
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
    email: user.email,
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

  await saveTeam(newTeam);
  return newTeam;
};

export const fetchMyTeams = async (): Promise<Team[]> => {
  const user = getUser();
  if (!user) throw new Error('User not authenticated');

  try {
    const response = await authenticatedFetch(`${API_URL}/teams`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch teams');
    }

    const teams: Team[] = await response.json();
    
    // Update local storage
    if (isBrowser) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(teams));
    }

    // Update Dexie
    await db.transaction('rw', db.teams, async () => {
      await db.teams.clear();
      await db.teams.bulkAdd(teams);
    });
    
    return teams;
  } catch (error) {
    console.warn('Failed to fetch teams from API, falling back to offline storage', error);
    
    // Try Dexie first
    const cachedTeams = await db.teams.toArray();
    if (cachedTeams.length > 0) {
      return cachedTeams;
    }

    // Fallback to localStorage
    if (isBrowser) {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const teams = JSON.parse(stored);
        // Migrate to Dexie
        await db.teams.bulkAdd(teams);
        return teams;
      }
    }
    
    return [];
  }
};

export const updateTeam = async (teamId: string, name: string): Promise<Team> => {
  const user = getUser();
  if (!user) throw new Error('User not authenticated');

  const url = `${API_URL}/teams/${teamId}`;
  const body = { name };

  try {
    const response = await authenticatedFetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
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
      
      // Update Dexie
      await db.teams.update(teamId, { name: updatedTeam.name });
    }

    return updatedTeam;
  } catch (error) {
    console.warn('Update team failed, queuing offline mutation', error);

    // Optimistic update
    if (isBrowser) {
      const storedTeamsStr = localStorage.getItem(STORAGE_KEY);
      if (storedTeamsStr) {
        const teams: Team[] = JSON.parse(storedTeamsStr);
        const updatedTeams = teams.map(t => t.id === teamId ? { ...t, name } : t);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedTeams));
      }
      
      // Update Dexie
      await db.teams.update(teamId, { name });
    }

    await db.offlineMutations.add({
      url,
      method: 'PUT',
      body,
      timestamp: Date.now(),
      retryCount: 0
    });

    // Return the optimistically updated team
    const team = await db.teams.get(teamId);
    if (!team) {
      // Fallback if not in Dexie yet
      return {
        id: teamId,
        name,
        members: [], // We might not have this info if purely offline and not in DB, but usually we do
        role: 'Leader', // Assumption for fallback
        code: ''
      } as Team;
    }
    return team;
  }
};

export const deleteTeam = async (teamId: string): Promise<void> => {
  const user = getUser();
  if (!user) throw new Error('User not authenticated');

  const url = `${API_URL}/teams/${teamId}`;

  try {
    const response = await authenticatedFetch(url, {
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
      
      // Update Dexie
      await db.teams.delete(teamId);
    }
  } catch (error) {
    console.warn('Delete team failed, queuing offline mutation', error);

    // Optimistic delete
    if (isBrowser) {
      const storedTeamsStr = localStorage.getItem(STORAGE_KEY);
      if (storedTeamsStr) {
        const teams: Team[] = JSON.parse(storedTeamsStr);
        const updatedTeams = teams.filter(t => t.id !== teamId);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedTeams));
      }
      
      // Update Dexie
      await db.teams.delete(teamId);
    }

    await db.offlineMutations.add({
      url,
      method: 'DELETE',
      body: {},
      timestamp: Date.now(),
      retryCount: 0
    });
  }
};

export const addMemberToTeam = async (teamId: string, email: string): Promise<Member> => {
  const user = getUser();
  if (!user) throw new Error('User not authenticated');

  const url = `${API_URL}/teams/${teamId}/members`;
  const body = { email };

  try {
    const response = await authenticatedFetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to add member');
    }

    const newMember = await response.json();
    
    // Update local storage
    if (isBrowser) {
      const storedTeamsStr = localStorage.getItem(STORAGE_KEY);
      if (storedTeamsStr) {
        const teams: Team[] = JSON.parse(storedTeamsStr);
        const updatedTeams = teams.map(t => {
          if (t.id === teamId) {
            // Check if member already exists to avoid duplicates
            if (!t.members.some(m => m.id === newMember.id)) {
              return { ...t, members: [...t.members, newMember] };
            }
          }
          return t;
        });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedTeams));
      }
      
      // Update Dexie
      const team = await db.teams.get(teamId);
      if (team) {
        if (!team.members.some(m => m.id === newMember.id)) {
          team.members.push(newMember);
          await db.teams.put(team);
        }
      }
    }

    return newMember;
  } catch (error) {
    console.warn('Add member failed, queuing offline mutation', error);

    // Create temporary member
    const tempId = uuidv4();
    const tempMember: Member = {
      id: tempId,
      name: email, // Use email as name temporarily
      email: email,
      status: 'offline',
      role: 'Member',
      avatar: undefined
    };

    // Optimistic update
    if (isBrowser) {
      const storedTeamsStr = localStorage.getItem(STORAGE_KEY);
      if (storedTeamsStr) {
        const teams: Team[] = JSON.parse(storedTeamsStr);
        const updatedTeams = teams.map(t => {
          if (t.id === teamId) {
             return { ...t, members: [...t.members, tempMember] };
          }
          return t;
        });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedTeams));
      }
      
      // Update Dexie
      const team = await db.teams.get(teamId);
      if (team) {
        team.members.push(tempMember);
        await db.teams.put(team);
      }
    }

    await db.offlineMutations.add({
      url,
      method: 'POST',
      body,
      timestamp: Date.now(),
      retryCount: 0,
      tempId // Store tempId so we can update it later if needed
    });

    // Trigger sync attempt in case we are actually online
    NetworkDetector.getInstance().triggerSync();

    return tempMember;
  }
};

export const removeMemberFromTeam = async (teamId: string, userIdToRemove: string): Promise<void> => {
  const user = getUser();
  if (!user) throw new Error('User not authenticated');

  const url = `${API_URL}/teams/${teamId}/members/${userIdToRemove}`;

  try {
    const response = await authenticatedFetch(url, {
      method: 'DELETE'
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to remove member');
    }

    // Update local storage
    if (isBrowser) {
      const storedTeamsStr = localStorage.getItem(STORAGE_KEY);
      if (storedTeamsStr) {
        const teams: Team[] = JSON.parse(storedTeamsStr);
        const updatedTeams = teams.map(t => {
          if (t.id === teamId) {
            return { ...t, members: t.members.filter(m => m.id !== userIdToRemove) };
          }
          return t;
        });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedTeams));
      }
      
      // Update Dexie
      const team = await db.teams.get(teamId);
      if (team) {
        team.members = team.members.filter(m => m.id !== userIdToRemove);
        await db.teams.put(team);
      }
    }

  } catch (error) {
    console.warn('Remove member failed, queuing offline mutation', error);

    // Optimistic update
    if (isBrowser) {
      const storedTeamsStr = localStorage.getItem(STORAGE_KEY);
      if (storedTeamsStr) {
        const teams: Team[] = JSON.parse(storedTeamsStr);
        const updatedTeams = teams.map(t => {
          if (t.id === teamId) {
            return { ...t, members: t.members.filter(m => m.id !== userIdToRemove) };
          }
          return t;
        });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedTeams));
      }
      
      // Update Dexie
      const team = await db.teams.get(teamId);
      if (team) {
        team.members = team.members.filter(m => m.id !== userIdToRemove);
        await db.teams.put(team);
      }
    }

    await db.offlineMutations.add({
      url,
      method: 'DELETE',
      body: {},
      timestamp: Date.now(),
      retryCount: 0
    });
    
    // Trigger sync attempt in case we are actually online
    NetworkDetector.getInstance().triggerSync();
  }
};

export const getTeamActivity = async (teamId: string, limit: number = 50): Promise<any[]> => {
  const url = `${API_URL}/teams/${teamId}/activity?limit=${limit}`;

  try {
    const response = await authenticatedFetch(url);

    if (!response.ok) {
        if (response.status === 404) return [];
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch team activity');
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching team activity:', error);
    return [];
  }
};

export const updateMemberRole = async (teamId: string, memberId: string, role: 'Leader' | 'Member'): Promise<void> => {
  const endpoint = `${API_URL}/teams/${teamId}/members/${memberId}/role`;
  
  if (isBrowser) {
    const status = await Network.getStatus();
    if (!status.connected) {
       throw new Error('Cannot update member role while offline');
    }
  }

  const response = await authenticatedFetch(endpoint, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role })
  });
  
  if (!response.ok) {
     const error = await response.json().catch(() => ({}));
     throw new Error(error.error || 'Failed to update member role');
  }
};
