import { Network } from '@capacitor/network';
import { App } from '@capacitor/app';
import type { PluginListenerHandle } from '@capacitor/core';

type NetworkStatus = 'online' | 'offline' | 'backend-unreachable';

interface NetworkDetectorOptions {
  backendUrl?: string;
  onStatusChange?: (status: NetworkStatus) => void;
  onSync?: () => Promise<void>;
  maxRetries?: number;
}

class NetworkDetector {
  private status: NetworkStatus = 'offline';
  private backendUrl: string;
  private onStatusChange?: (status: NetworkStatus) => void;
  private onSync?: () => Promise<void>;
  private isSyncing: boolean = false;
  private retryCount: number = 0;
  private maxRetries: number;
  private retryTimeoutId: NodeJS.Timeout | null = null;
  
  private networkListener?: PluginListenerHandle;
  private appStateListener?: PluginListenerHandle;

  private static instance: NetworkDetector;

  constructor(options: NetworkDetectorOptions = {}) {
    // Default to localhost if env var is not set, as specific IPs are fragile
    this.backendUrl = options.backendUrl || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    this.onStatusChange = options.onStatusChange;
    this.onSync = options.onSync;
    this.maxRetries = options.maxRetries || 5;
  }

  public static getInstance(options?: NetworkDetectorOptions): NetworkDetector {
    if (!NetworkDetector.instance) {
      NetworkDetector.instance = new NetworkDetector(options);
    }
    return NetworkDetector.instance;
  }

  async init() {
    await this.checkNetworkStatus();

    this.networkListener = await Network.addListener(
      'networkStatusChange',
      this.handleNetworkChange
    );

    this.appStateListener = await App.addListener(
      'appStateChange',
      this.handleAppStateChange
    );

    console.log('NetworkDetector initialized');
  }

  private handleNetworkChange = async (status: { connected: boolean; connectionType: string }) => {
    console.log('Network status changed:', status);
    
    if (!status.connected) {
      console.log('Network disconnected');
      this.updateStatus('offline');
      this.retryCount = 0;
      this.cancelRetry();
    } else {
      console.log('Network connected:', status.connectionType);
      await this.checkNetworkStatus();
    }
  };

  private handleAppStateChange = async (state: { isActive: boolean }) => {
    if (state.isActive) {
      console.log('App became active, checking status...');
      await this.checkNetworkStatus();
    }
  };

  private async checkNetworkStatus() {
    const networkStatus = await Network.getStatus();
    
    if (!networkStatus.connected) {
      this.updateStatus('offline');
      return;
    }

    console.log('Network connected, verifying backend...');
    const isReachable = await this.checkBackendReachability();
    
    if (isReachable) {
      console.log('Backend is reachable');
      this.updateStatus('online');
      this.retryCount = 0;
      
      if (!this.isSyncing) {
        this.triggerSync();
      }
    } else {
      console.log('Backend unreachable, will retry with backoff');
      this.updateStatus('backend-unreachable');
      this.scheduleRetry();
    }
  }

  private async checkBackendReachability(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const baseUrl = this.backendUrl.replace(/\/$/, '');
      const url = new URL(`${baseUrl}/health`);
      url.searchParams.set('_', Date.now().toString());

      const response = await fetch(url.toString(), {
        method: 'HEAD',
        signal: controller.signal,
        cache: 'no-store',
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch (error) {
      console.log('Backend check failed:', error);
      return false;
    }
  }

  private scheduleRetry() {
    this.cancelRetry();

    if (this.retryCount >= this.maxRetries) {
      console.log(`Max retries (${this.maxRetries}) reached. Waiting for network event.`);
      return;
    }

    const baseDelay = Math.pow(2, this.retryCount) * 1000;
    const jitter = Math.random() * 1000;
    const delay = baseDelay + jitter;

    console.log(`Retry ${this.retryCount + 1}/${this.maxRetries} in ${Math.round(delay / 1000)}s`);

    this.retryTimeoutId = setTimeout(async () => {
      this.retryCount++;
      console.log(`Retry attempt ${this.retryCount}...`);
      await this.checkNetworkStatus();
    }, delay);
  }

  private cancelRetry() {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
      this.retryTimeoutId = null;
    }
  }

  private updateStatus(newStatus: NetworkStatus) {
    if (this.status !== newStatus) {
      const oldStatus = this.status;
      this.status = newStatus;
      console.log(`Status change: ${oldStatus} -> ${newStatus}`);
      this.onStatusChange?.(newStatus);
    }
  }

  async triggerSync() {
    if (this.isSyncing || this.status !== 'online' || !this.onSync) {
      return;
    }

    this.isSyncing = true;
    console.log('Starting sync...');

    try {
      await this.onSync();
      console.log('Sync completed successfully');
    } catch (error) {
      console.error('Sync error:', error);
    } finally {
      this.isSyncing = false;
    }
  }

  getStatus(): NetworkStatus {
    return this.status;
  }

  setSyncHandler(handler: () => Promise<void>) {
    this.onSync = handler;
  }

  async destroy() {
    console.log('Cleaning up NetworkDetector...');
    this.cancelRetry();
    
    if (this.networkListener) {
      await this.networkListener.remove();
    }
    if (this.appStateListener) {
      await this.appStateListener.remove();
    }
  }
}

export default NetworkDetector;
export type { NetworkStatus };
