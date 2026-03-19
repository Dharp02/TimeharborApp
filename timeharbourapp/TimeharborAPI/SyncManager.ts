class SyncManager {
  private static instance: SyncManager;

  public static getInstance(): SyncManager {
    if (!SyncManager.instance) {
      SyncManager.instance = new SyncManager();
    }
    return SyncManager.instance;
  }

  public init() {
    // No-op: backend sync removed
  }

  public async syncNow() {
    // No-op: backend sync removed
  }

  public async addMutation(_url: string, _method: 'POST' | 'PUT' | 'PATCH' | 'DELETE', _body: any, _tempId?: string) {
    // No-op: backend sync removed
  }
}

export const syncManager = typeof window !== 'undefined'
  ? SyncManager.getInstance()
  : {} as SyncManager;
