type NetworkStatus = 'online' | 'offline' | 'backend-unreachable';

class NetworkDetector {
  private static instance: NetworkDetector;

  public static getInstance(): NetworkDetector {
    if (!NetworkDetector.instance) {
      NetworkDetector.instance = new NetworkDetector();
    }
    return NetworkDetector.instance;
  }

  async init() {
    // No-op: backend connectivity checks removed
  }

  getStatus(): NetworkStatus {
    return 'online';
  }

  setSyncHandler(_handler: () => Promise<void>) {
    // No-op
  }

  async triggerSync() {
    // No-op
  }

  async destroy() {
    // No-op
  }
}

export default NetworkDetector;
export type { NetworkStatus };
