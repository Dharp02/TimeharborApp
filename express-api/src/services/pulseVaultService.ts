import logger from '../utils/logger';

const PULSE_VAULT_URL = process.env.PULSE_VAULT_URL || 'https://pulse-vault.opensource.mieweb.org';
const PULSE_VAULT_API_KEY = process.env.PULSE_VAULT_API_KEY || '';

export interface DeeplinkParams {
  draftId: string;
  userId: string;
  externalUserEmail: string;
  expiresIn?: number; // seconds, default 86400 (24h)
  oneTimeUse?: boolean;
}

export interface DeeplinkResult {
  deeplink: string;
  qrData: string;
  token: string;
  tokenId: string;
  draftId: string;
  expiresAt: string;
  server: string;
}

/**
 * Calls Pulse Vault's deeplink API to get a Pulse Cam launch URL.
 * TimeHarbor is the caller; it generates the draftId and passes it here.
 * Pulse Vault embeds draftId inside the signed upload token so Pulse Cam
 * tags the finalized video with it.
 */
export async function requestDeeplink(params: DeeplinkParams): Promise<DeeplinkResult> {
  const {
    draftId,
    userId,
    externalUserEmail,
    expiresIn = 86400,
    oneTimeUse = false,
  } = params;

  const query = new URLSearchParams({
    draftId,
    userId,
    expiresIn: String(expiresIn),
    oneTimeUse: String(oneTimeUse),
    externalApp: 'timeharbour',
    externalUserEmail,
    externalUserId: userId,
  });

  const url = `${PULSE_VAULT_URL}/api/qr/deeplink?${query}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: { 'x-api-key': PULSE_VAULT_API_KEY },
  });

  if (!response.ok) {
    const body = await response.text();
    logger.error(`Pulse Vault deeplink request failed: ${response.status} ${body}`);
    throw new Error(`Pulse Vault returned ${response.status}`);
  }

  return response.json() as Promise<DeeplinkResult>;
}
