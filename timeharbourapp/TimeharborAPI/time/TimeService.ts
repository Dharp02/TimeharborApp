import { authenticatedFetch } from '../auth';
import { getApiUrl } from '../apiUrl';

const API_URL = getApiUrl();

export const TimeService = {
  async syncTimeData(events: any[]) {
    const response = await authenticatedFetch(`${API_URL}/time/sync-events`, {
      method: 'POST',
      body: JSON.stringify({ events })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Sync failed: ${response.statusText}`);
    }

    return response.json();
  }
};
