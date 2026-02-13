import NetworkDetector from './NetworkDetector';
import { db, type OfflineMutation } from './db';
import { authenticatedFetch } from './auth';
import { localTimeStore } from './time/LocalTimeStore';
import { TimeService } from './time/TimeService';

class SyncManager {
  private static instance: SyncManager;
  private detector: NetworkDetector;
  private isSyncing: boolean = false;

  private constructor() {
    this.detector = NetworkDetector.getInstance();
    this.detector.setSyncHandler(this.syncData);
  }

  public static getInstance(): SyncManager {
    if (!SyncManager.instance) {
      SyncManager.instance = new SyncManager();
    }
    return SyncManager.instance;
  }

  public init() {
    this.detector.init();
  }

  public async syncNow() {
    await this.detector.triggerSync();
  }

  private syncData = async (): Promise<void> => {
    if (this.isSyncing) return;
    this.isSyncing = true;

    try {
      // 1. Sync Mutations (Teams, Tickets, etc.)
      await this.syncMutations();

      // 2. Sync Time Events (Clock In/Out, Start/Stop Ticket)
      await this.syncTimeEvents();
      
    } catch (error) {
      console.error('Sync process failed:', error);
    } finally {
      this.isSyncing = false;
    }
  };

  private async syncMutations() {
    const mutations = await db.offlineMutations.toArray();
    
    if (mutations.length === 0) return;

    console.log(`Found ${mutations.length} offline mutations to sync`);

    for (const mutation of mutations) {
      try {
        await this.processMutation(mutation);
        // If successful, delete from DB
        if (mutation.id) {
          await db.offlineMutations.delete(mutation.id);
        }
      } catch (error: any) {
        console.error(`Failed to sync mutation ${mutation.id}:`, error);
        
        if (error.message === 'Session expired. Please sign in again.') {
          console.log('Session expired, clearing offline mutations');
          await db.offlineMutations.clear();
          break;
        }

        // If it's a client error (4xx), the request is invalid and retrying won't help. 
        // We should delete it to unblock the queue.
        if (error.message.startsWith('CLIENT_ERROR')) {
           console.warn(`Mutation ${mutation.id} failed with client error, removing from queue:`, error.message);
           if (mutation.id) {
             await db.offlineMutations.delete(mutation.id);
           }
           // Continue to next mutation
           continue;
        }

        // Stop processing to maintain order
        break; 
      }
    }
  }

  private async processMutation(mutation: OfflineMutation) {
    const { url, method, body, tempId } = mutation;
    
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://10.0.0.39:3001';
    const fullUrl = url.startsWith('http') ? url : `${backendUrl}${url}`;

    const response = await authenticatedFetch(fullUrl, {
      method,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Session expired. Please sign in again.');
      }
      
      // If client error (4xx), throw a specific error that we can catch and handle (delete mutation)
      if (response.status >= 400 && response.status < 500) {
        const text = await response.text();
        throw new Error(`CLIENT_ERROR: ${response.status} - ${text}`);
      }

      const responseText = await response.text();
      throw new Error(`HTTP error! status: ${response.status}, message: ${responseText}`);
    }

    // Handle ID updates if the server returns a new ID
    if (method === 'POST' && tempId) {
      try {
        const responseData = await response.json();
        const newId = responseData.id;

        if (newId && newId !== tempId) {
          console.log(`Updating ID mapping: ${tempId} -> ${newId}`);
          await this.updateLocalIds(tempId, newId);
        }
      } catch (e) {
        // Response might not be JSON or might not have ID, ignore
      }
    }
  }

  private async updateLocalIds(tempId: string, newId: string) {
    // 1. Update Tickets
    const ticket = await db.tickets.get(tempId);
    if (ticket) {
      await db.tickets.delete(tempId);
      ticket.id = newId;
      await db.tickets.put(ticket);
    }

    // 2. Update Teams
    const team = await db.teams.get(tempId);
    if (team) {
      await db.teams.delete(tempId);
      team.id = newId;
      await db.teams.put(team);
    }

    // 3. Update Pending Time Events
    // Update ticketId references
    await db.events
      .where('ticketId').equals(tempId)
      .modify({ ticketId: newId });
    
    // Update teamId references
    await db.events
      .where('teamId').equals(tempId)
      .modify({ teamId: newId });

    // 4. Update Subsequent Mutations
    // We need to update URLs and Bodies of pending mutations that reference the old ID
    const pendingMutations = await db.offlineMutations.toArray();
    for (const mut of pendingMutations) {
      let updated = false;
      let newUrl = mut.url;
      let newBody = mut.body;

      // Update URL
      if (newUrl.includes(tempId)) {
        newUrl = newUrl.replace(new RegExp(tempId, 'g'), newId);
        updated = true;
      }

      // Update Body
      const bodyStr = JSON.stringify(newBody);
      if (bodyStr.includes(tempId)) {
        const newBodyStr = bodyStr.replace(new RegExp(tempId, 'g'), newId);
        newBody = JSON.parse(newBodyStr);
        updated = true;
      }

      if (updated && mut.id) {
        await db.offlineMutations.update(mut.id, { url: newUrl, body: newBody });
      }
    }
  }

  private async syncTimeEvents() {
    const events = await localTimeStore.getPendingEvents();
    if (events.length === 0) return;

    console.log(`Syncing ${events.length} time events...`);
    
    try {
      await TimeService.syncTimeData(events);
      await localTimeStore.clearEvents(events.map(e => e.id));
      console.log('Synced offline time data successfully');
    } catch (error) {
      console.error('Failed to sync time events:', error);
    }
  }

  // Helper to add mutation
  public async addMutation(url: string, method: 'POST' | 'PUT' | 'PATCH' | 'DELETE', body: any, tempId?: string) {
    await db.offlineMutations.add({
      url,
      method,
      body,
      timestamp: Date.now(),
      retryCount: 0,
      tempId
    });

    if (this.detector.getStatus() === 'online') {
      this.detector.triggerSync();
    }
  }
}

export const syncManager = SyncManager.getInstance();
