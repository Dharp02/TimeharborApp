import { authenticatedFetch } from '../auth';
import { getApiUrl } from '../apiUrl';

const API_URL = getApiUrl();

export interface PulseAttachment {
  id: string;
  ticketId: string;
  teamId: string;
  requestedBy?: string;
  draftId: string;
  status: 'pending' | 'uploaded' | 'failed' | 'expired';
  watchUrl?: string;
  thumbnailUrl?: string;
  title?: string;
  expiresAt?: string;
  uploadedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RecordingSession {
  id: string;
  draftId: string;
  deeplink: string;  // pulsecam:// URL — open on mobile to launch Pulse Cam
  qrData: string;   // same URL rendered for QR display on desktop
  status: 'pending';
  expiresAt: string;
  resumed: boolean; // true if continuing a previous recording session
}

/**
 * Request a new Pulse Cam recording session for a ticket.
 * Returns the deeplink (for mobile) and qrData (for desktop QR modal).
 */
export const requestRecording = async (
  teamId: string,
  ticketId: string
): Promise<RecordingSession> => {
  const response = await authenticatedFetch(
    `${API_URL}/teams/${teamId}/tickets/${ticketId}/pulse`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' } }
  );
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error((err as any).message || 'Failed to request Pulse recording');
  }
  return response.json();
};

/**
 * List uploaded Pulse Shorts attached to a ticket.
 */
export const listAttachments = async (
  teamId: string,
  ticketId: string
): Promise<PulseAttachment[]> => {
  const response = await authenticatedFetch(
    `${API_URL}/teams/${teamId}/tickets/${ticketId}/pulse`
  );
  if (!response.ok) throw new Error('Failed to fetch Pulse attachments');
  return response.json();
};

/**
 * List pending (in-flight) recording sessions for a ticket.
 */
export const listPending = async (
  teamId: string,
  ticketId: string
): Promise<PulseAttachment[]> => {
  const response = await authenticatedFetch(
    `${API_URL}/teams/${teamId}/tickets/${ticketId}/pulse/pending`
  );
  if (!response.ok) throw new Error('Failed to fetch pending recordings');
  return response.json();
};

/**
 * Remove a Pulse Short reference from a ticket.
 * Does not delete the video from Pulse Vault.
 */
export const deleteAttachment = async (
  teamId: string,
  ticketId: string,
  attachmentId: string
): Promise<void> => {
  const response = await authenticatedFetch(
    `${API_URL}/teams/${teamId}/tickets/${ticketId}/pulse/${attachmentId}`,
    { method: 'DELETE' }
  );
  if (!response.ok) throw new Error('Failed to remove Pulse attachment');
};
