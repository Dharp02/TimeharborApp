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
  },

  /**
   * Fetch the authoritative session state from the backend.
   * Used to restore an in-progress session on Device B when the user was
   * already clocked in on Device A.
   */
  async getSessionState(): Promise<{
    isSessionActive: boolean;
    sessionStartTime: string | null;
    isOnBreak: boolean;
    breakStartTime: string | null;
    totalBreakMs: number;
    activeTicketId: string | null;
    activeTicketTitle: string | null;
    activeTicketTeamId: string | null;
    ticketStartTime: string | null;
  } | null> {
    try {
      const response = await authenticatedFetch(`${API_URL}/time/session-state`);
      if (!response.ok) return null;
      return response.json();
    } catch {
      return null;
    }
  }
};
