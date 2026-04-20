import { syncAll as encryptedSyncAll } from './sync/EncryptedSyncEngine';

class SyncManager {
  private static instance: SyncManager;
  private syncing = false;
  private stopped = false;
  private syncKey: CryptoKey | null = null;

  /** Listeners notified when encryption setup is needed. */
  private encryptionNeededListeners: Array<() => void> = [];

  public static getInstance(): SyncManager {
    if (!SyncManager.instance) {
      SyncManager.instance = new SyncManager();
    }
    return SyncManager.instance;
  }

  public init() {
    this.stopped = false;
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.syncNow());
    }
  }

  /** Set the AES-256-GCM sync key to enable sync. */
  public setSyncKey(key: CryptoKey) {
    this.syncKey = key;
  }

  /** Get the current sync key (null if not set). */
  public getSyncKey(): CryptoKey | null {
    return this.syncKey;
  }

  /**
   * Flag the next sync cycle to include this device's own batches.
   * Automatically resets after one sync cycle.
   */
  private pendingFullRestore = false;
  public requestFullRestore() {
    this.pendingFullRestore = true;
  }

  /** Register a callback that fires when encryption setup is needed. */
  public onEncryptionNeeded(listener: () => void) {
    this.encryptionNeededListeners.push(listener);
  }

  /** Remove an encryption-needed listener. */
  public offEncryptionNeeded(listener: () => void) {
    this.encryptionNeededListeners = this.encryptionNeededListeners.filter(
      (l) => l !== listener,
    );
  }

  /** Block all future syncs and wait for any in-flight sync to finish. */
  public async stop() {
    this.stopped = true;
    this.syncKey = null;
    // Wait for an in-flight sync to drain (poll for up to 3 s).
    const deadline = Date.now() + 3000;
    while (this.syncing && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  /** Re-enable syncing after a stop (e.g. after sign-out → sign-in). */
  public resume() {
    this.stopped = false;
  }

  /**
   * Execute an encrypted sync cycle.
   *
   * If a syncKey is set → encrypted op-log sync.
   * Otherwise → prompt user for encryption passphrase.
   */
  public async syncNow() {
    if (this.syncing || this.stopped) return;
    // Skip if browser/OS reports no network connection
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      console.warn('[sync] skipping — device is offline');
      return;
    }
    this.syncing = true;
    try {
      if (this.syncKey) {
        const includeOwn = this.pendingFullRestore;
        this.pendingFullRestore = false;
        await encryptedSyncAll(this.syncKey, { includeOwn });
      } else {
        // No key — prompt user for passphrase
        this.encryptionNeededListeners.forEach((l) => l());
      }
    } catch (err) {
      // Swallow transient network errors so they don't become unhandled
      // rejections. The next sync cycle will retry automatically.
      if (err instanceof TypeError) {
        console.warn('[sync] network unavailable, will retry next cycle', err.message);
      } else {
        throw err;
      }
    } finally {
      this.syncing = false;
    }
  }
}

export const syncManager = typeof window !== 'undefined'
  ? SyncManager.getInstance()
  : {} as SyncManager;
