import NetworkDetector from './NetworkDetector';
import { db, type OfflineMutation } from './db';
import { authenticatedFetch } from './auth';

class SyncManager {
  private static instance: SyncManager;
  private detector: NetworkDetector;

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

  private syncData = async (): Promise<void> => {
    const mutations = await db.offlineMutations.toArray();
    
    if (mutations.length === 0) {
      return;
    }

    console.log(`Found ${mutations.length} offline mutations to sync`);

    // Process sequentially to maintain order
    for (const mutation of mutations) {
      try {
        await this.processMutation(mutation);
        // If successful, delete from DB
        if (mutation.id) {
          await db.offlineMutations.delete(mutation.id);
        }
      } catch (error: any) {
        console.error(`Failed to sync mutation ${mutation.id}:`, error);
        
        // If session is expired, clear all pending mutations as they are likely invalid
        if (error.message === 'Session expired. Please sign in again.') {
          console.log('Session expired, clearing offline mutations');
          await db.offlineMutations.clear();
          break;
        }

        // For other errors, we might want to retry later or skip
        // For now, we stop to preserve order
        break; 
      }
    }
  };

  private async processMutation(mutation: OfflineMutation) {
    const { url, method, body } = mutation;
    
    // Ensure we use the full URL if it's relative, or use the backend URL from env
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://10.0.0.39:3001';
    const fullUrl = url.startsWith('http') ? url : `${backendUrl}${url}`;

    // Use authenticatedFetch to handle tokens and refreshing
    const response = await authenticatedFetch(fullUrl, {
      method,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Session expired. Please sign in again.');
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }
  }

  // Helper to add mutation
  public async addMutation(url: string, method: 'POST' | 'PUT' | 'PATCH' | 'DELETE', body: any) {
    await db.offlineMutations.add({
      url,
      method,
      body,
      timestamp: Date.now(),
      retryCount: 0
    });

    // Try to sync immediately if online
    if (this.detector.getStatus() === 'online') {
      this.detector.triggerSync();
    }
  }
}

export const syncManager = SyncManager.getInstance();
