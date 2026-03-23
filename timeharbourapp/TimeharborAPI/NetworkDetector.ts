type NetworkStatus = 'online' | 'offline' | 'backend-unreachable';

class NetworkDetector {
  private static instance: NetworkDetector;
  private status: NetworkStatus = 'online';
  private syncHandler: (() => Promise<void>) | null = null;

  public static getInstance(): NetworkDetector {
    if (!NetworkDetector.instance) {
      NetworkDetector.instance = new NetworkDetector();
    }
    return NetworkDetector.instance;
  }

  async init() {
    if (typeof window === 'undefined') return;

    this.status = navigator.onLine ? 'online' : 'offline';

    window.addEventListener('online', () => {
      this.status = 'online';
      this.triggerSync();
    });

    window.addEventListener('offline', () => {
      this.status = 'offline';
    });
  }

  getStatus(): NetworkStatus {
    return this.status;
  }

  setSyncHandler(handler: () => Promise<void>) {
    this.syncHandler = handler;
  }

  async triggerSync() {
    if (this.syncHandler && this.status === 'online') {
      try {
        await this.syncHandler();
      } catch {
        // Sync will retry on next trigger
      }
    }
  }

  async destroy() {
    this.syncHandler = null;
  }
}

export default NetworkDetector;
export type { NetworkStatus };
