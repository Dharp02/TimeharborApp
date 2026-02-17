import { db, TimeEvent } from '../db';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export interface DashboardStats {
  totalHoursToday: string;
  totalHoursWeek: string;
  openTickets: number;
  teamMembers: number;
}

export interface Activity {
  id: string;
  type: 'SESSION';
  title: string;
  subtitle?: string;
  startTime: string;
  endTime?: string;
  status?: 'Active' | 'Completed';
  duration?: string;
}

export const getStats = async (teamId?: string): Promise<DashboardStats> => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
  const cacheKey = teamId || 'global';

  try {
    if (!token) throw new Error('No access token found');

    const queryParams = teamId ? `?teamId=${teamId}` : '';
    const response = await fetch(`${API_URL}/dashboard/stats${queryParams}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch dashboard stats');
    }

    const stats: DashboardStats = await response.json();
    
    // Cache the stats
    await db.dashboardStats.put({
      teamId: cacheKey,
      data: stats,
      updatedAt: Date.now()
    });

    return stats;
  } catch (error) {
    console.warn('Fetching stats failed, loading from offline cache:', error);

    // Try to get from cache
    const cached = await db.dashboardStats.get(cacheKey);
    if (cached) {
      return cached.data as DashboardStats;
    }

    // If no cache, try to calculate what we can from local DB
    let openTickets = 0;
    let teamMembers = 0;

    if (teamId) {
      openTickets = await db.tickets
        .where('teamId').equals(teamId)
        .filter(t => t.status !== 'Closed')
        .count();
      
      const team = await db.teams.get(teamId);
      if (team) {
        teamMembers = team.members.length;
      }
    } else {
      openTickets = await db.tickets
        .filter(t => t.status !== 'Closed')
        .count();
      
      // Sum members of all teams (approximate, as users might be in multiple teams)
      const teams = await db.teams.toArray();
      const uniqueMembers = new Set<string>();
      teams.forEach(t => t.members.forEach(m => uniqueMembers.add(m.id)));
      teamMembers = uniqueMembers.size;
    }

    return {
      totalHoursToday: '00:00', // Hard to calculate offline without full logs
      totalHoursWeek: '00:00',
      openTickets,
      teamMembers
    };
  }
};

export const getActivity = async (teamId?: string, limit?: number | 'all'): Promise<Activity[]> => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
  const cacheKey = teamId || 'global';

  try {
    if (!token) throw new Error('No access token found');

    const params = new URLSearchParams();
    if (teamId) params.append('teamId', teamId);
    if (limit) params.append('limit', limit.toString());

    const queryString = params.toString() ? `?${params.toString()}` : '';
    const response = await fetch(`${API_URL}/dashboard/activity${queryString}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch recent activity');
    }

    const activities: Activity[] = await response.json();

    // Cache activities
    // First clear old cache for this scope
    await db.dashboardActivity.where('teamId').equals(cacheKey).delete();
    
    // Add new ones
    await db.dashboardActivity.bulkPut(activities.map(a => ({
      id: a.id,
      teamId: cacheKey,
      data: a,
      updatedAt: Date.now()
    })));

    return activities;
  } catch (error) {
    console.warn('Fetching activity failed, loading from offline cache:', error);

    const cached = await db.dashboardActivity
      .where('teamId').equals(cacheKey)
      .toArray();
    
    let activities: Activity[] = [];
    if (cached.length > 0) {
      activities = cached.map(c => c.data as Activity);
    }

    // Merge with offline completed sessions
    // We look for pairs of CLOCK_IN and CLOCK_OUT in pending events
    const pendingEvents = await db.events
      .where('synced').equals(0)
      .filter(e => e.type === 'CLOCK_IN' || e.type === 'CLOCK_OUT')
      .toArray();

    if (pendingEvents.length > 0) {
      // Sort by timestamp
      pendingEvents.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      const offlineActivities: Activity[] = [];
      let lastClockIn: TimeEvent | null = null;

      for (const event of pendingEvents) {
        if (event.type === 'CLOCK_IN') {
          lastClockIn = event;
        } else if (event.type === 'CLOCK_OUT' && lastClockIn) {
          // Found a pair, create a completed activity
          const durationMs = new Date(event.timestamp).getTime() - new Date(lastClockIn.timestamp).getTime();
          
          // Format duration
          const hours = Math.floor(durationMs / 3600000);
          const minutes = Math.floor((durationMs % 3600000) / 60000);
          const seconds = Math.floor((durationMs % 60000) / 1000);
          const durationStr = hours > 0 
            ? `${hours}h ${minutes}m` 
            : `${minutes}m ${seconds}s`;

          offlineActivities.push({
            id: event.id, // Use the clock-out event ID
            type: 'SESSION',
            title: 'Work Session',
            subtitle: event.comment || 'Clocked Out (Offline)',
            startTime: lastClockIn.timestamp,
            endTime: event.timestamp,
            status: 'Completed',
            duration: durationStr
          });
          
          lastClockIn = null; // Reset
        }
      }

      // Prepend offline activities (newest first)
      activities = [...offlineActivities.reverse(), ...activities];
    }

    return activities;
  }
};

export interface MemberProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  github?: string;
  linkedin?: string;
}

export interface ClockEvent {
  type: 'CLOCK_IN' | 'CLOCK_OUT';
  timestamp: string;
  time: string;
}

export interface MemberActivityData {
  member: MemberProfile;
  timeTracking: {
    today: {
      duration: string;
      clockEvents: ClockEvent[];
    };
    week: {
      duration: string;
    };
    month: {
      duration: string;
    };
  };
  recentTickets: Array<{
    id: string;
    title: string;
    lastWorkedOn: string;
  }>;
  sessions?: Array<{
    id: string;
    startTime: string;
    endTime?: string | null;
    status: 'active' | 'completed' | 'adhoc';
    events: Array<{
      id: string;
      type: string;
      title: string;
      timestamp: string;
      original: any;
      timeFormatted: string;
    }>;
  }>;
}

export const getMemberActivity = async (memberId: string, teamId?: string, cursor?: string, limit: number = 5): Promise<MemberActivityData> => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;

  if (!token) throw new Error('No access token found');

  try {
    const params = new URLSearchParams();
    if (teamId) params.append('teamId', teamId);
    if (cursor) params.append('cursor', cursor);
    if (limit) params.append('limit', limit.toString());

    const queryString = params.toString() ? `?${params.toString()}` : '';

    const response = await fetch(`${API_URL}/dashboard/member/${memberId}${queryString}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch member activity');
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching member activity:', error);
    throw error;
  }
};

export interface WorkLogReply {
  id: string;
  content: string;
  userId: string;
  user?: {
    id: string;
    full_name: string;
    email: string;
  };
  createdAt: string;
}

export const addWorkLogReply = async (workLogId: string, message: string): Promise<WorkLogReply> => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;

  if (!token) throw new Error('No access token found');

  try {
    const response = await fetch(`${API_URL}/dashboard/activity/reply`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ workLogId, message }),
    });

    if (!response.ok) {
      throw new Error('Failed to send reply');
    }

    return await response.json();
  } catch (error) {
    console.error('Error sending reply:', error);
    throw error;
  }
};