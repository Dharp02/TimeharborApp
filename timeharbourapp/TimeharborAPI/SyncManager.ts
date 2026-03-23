import { syncAll } from './SyncEngine';

class SyncManager {
  private static instance: SyncManager;

  public static getInstance(): SyncManager {
    if (!SyncManager.instance) {
      SyncManager.instance = new SyncManager();
    }
    return SyncManager.instance;
  }

  public init() {
    // Sync on network reconnect
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.syncNow());
    }
  }

  public async syncNow() {
    await syncAll();
  }

  public async addMutation(_url: string, _method: 'POST' | 'PUT' | 'PATCH' | 'DELETE', _body: any, _tempId?: string) {
    // Legacy — mutations now go through SessionManager/Dexie + SyncEngine
  }
}

export const syncManager = typeof window !== 'undefined'
  ? SyncManager.getInstance()
  : {} as SyncManager;
