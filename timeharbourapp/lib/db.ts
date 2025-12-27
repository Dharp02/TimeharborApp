import Dexie, { type Table } from 'dexie';

export interface OfflineMutation {
  id?: number;
  url: string;
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body: any;
  timestamp: number;
  retryCount: number;
}

export interface UserProfile {
  key: string;
  data: any;
}

export class TimeharborDB extends Dexie {
  offlineMutations!: Table<OfflineMutation>;
  profile!: Table<UserProfile>;

  constructor() {
    super('TimeharborDB');
    this.version(1).stores({
      offlineMutations: '++id, timestamp'
    });
    
    this.version(2).stores({
      offlineMutations: '++id, timestamp',
      profile: 'key'
    });
  }
}

export const db = new TimeharborDB();
