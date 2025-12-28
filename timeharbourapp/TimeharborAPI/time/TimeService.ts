const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export const TimeService = {
  async syncTimeData(data: { attendance: any[], workLogs: any[] }) {
    // Retrieve token from localStorage (matching the key used in auth/index.ts)
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;

    if (!token) {
      throw new Error('No authentication token found');
    }

    const response = await fetch(`${API_URL}/time/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Sync failed: ${response.statusText}`);
    }

    return response.json();
  }
};
