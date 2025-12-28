
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
  
  if (!token) {
    throw new Error('No access token found');
  }

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

  return response.json();
};

export const getActivity = async (teamId?: string): Promise<Activity[]> => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
  
  if (!token) {
    throw new Error('No access token found');
  }

  const queryParams = teamId ? `?teamId=${teamId}` : '';
  const response = await fetch(`${API_URL}/dashboard/activity${queryParams}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch recent activity');
  }

  return response.json();
};
