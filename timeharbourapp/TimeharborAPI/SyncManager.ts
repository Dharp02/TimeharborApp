import { syncAll } from './SyncEngine';

class SyncManager {
  private static instance: SyncManager;
  private syncing = false;
  private stopped = false;

  public static getInstance(): SyncManager {
    if (!SyncManager.instance) {
      SyncManager.instance = new SyncManager();
    }
    return SyncManager.instance;
  }

  public init() {
    this.stopped = false;
    // Sync on network reconnect
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.syncNow());
    }
  }

  /** Block all future syncs and wait for any in-flight sync to finish. */
  public async stop() {
    this.stopped = true;
    // Wait for an in-flight sync to drain (poll for up to 3 s).
    const deadline = Date.now() + 3000;
    while (this.syncing && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  public async syncNow() {
    if (this.syncing || this.stopped) return;
    this.syncing = true;
    try {
      await syncAll();
    } finally {
      this.syncing = false;
    }
  }

  public async addMutation(_url: string, _method: 'POST' | 'PUT' | 'PATCH' | 'DELETE', _body: any, _tempId?: string) {
    // Legacy — mutations now go through SessionManager/Dexie + SyncEngine
  }
}

export const syncManager = typeof window !== 'undefined'
  ? SyncManager.getInstance()
  : {} as SyncManager;
