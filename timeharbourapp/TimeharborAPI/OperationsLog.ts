import { v4 as uuidv4 } from 'uuid';
import { db, type DexieOperationLog } from './db';
import { getStoredUser } from './auth';

export type OperationCategory =
  | 'SESSION'
  | 'TICKET'
  | 'PROJECT'
  | 'AUTH'
  | 'NOTIFICATION'
  | 'NOTE'
  | 'PROFILE'
  | 'SYNC';

export type OperationAction =
  | 'CLOCK_IN'
  | 'CLOCK_OUT'
  | 'START_TICKET'
  | 'STOP_TICKET'
  | 'SWITCH_TICKET'
  | 'START_BREAK'
  | 'END_BREAK'
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'ASSIGN'
  | 'UNASSIGN'
  | 'SHARE'
  | 'SIGN_IN'
  | 'SIGN_UP'
  | 'SIGN_OUT'
  | 'UPLOAD'
  | 'FETCH'
  | 'MARK_READ'
  | 'MARK_ALL_READ'
  | 'SYNC_PUSH'
  | 'SYNC_PULL';

export type OperationResult = 'success' | 'failure';

export interface OperationLogEntry {
  category: OperationCategory;
  action: OperationAction;
  result: OperationResult;
  target?: string;
  targetId?: string;
  details?: Record<string, unknown>;
  errorMessage?: string;
}

/**
 * OperationsLog — records every user/system action in the app.
 *
 * Usage:
 *   import { operationsLog } from '@/TimeharborAPI/OperationsLog';
 *
 *   // Successful operation
 *   await operationsLog.log({
 *     category: 'TICKET',
 *     action: 'CREATE',
 *     result: 'success',
 *     target: 'Ticket',
 *     targetId: ticket.id,
 *     details: { title: ticket.title },
 *   });
 *
 *   // Failed operation
 *   await operationsLog.log({
 *     category: 'TICKET',
 *     action: 'DELETE',
 *     result: 'failure',
 *     target: 'Ticket',
 *     targetId: ticketId,
 *     errorMessage: err.message,
 *   });
 */
class OperationsLog {
  async log(entry: OperationLogEntry): Promise<void> {
    try {
      const user = await getStoredUser();
      const record: DexieOperationLog = {
        id: uuidv4(),
        _dirty: 1,
        _rev: 1,
        userId: user?.id || '',
        category: entry.category,
        action: entry.action,
        result: entry.result,
        target: entry.target,
        targetId: entry.targetId,
        details: entry.details,
        errorMessage: entry.errorMessage,
        timestamp: new Date().toISOString(),
      };
      await db.operationLogs.add(record);
    } catch (err) {
      // Never let logging itself crash the app
      console.warn('OperationsLog: failed to persist entry', err);
    }
  }

  /** Convenience wrapper: run an async operation and log the result. */
  async wrap<T>(
    entry: Omit<OperationLogEntry, 'result' | 'errorMessage'>,
    fn: () => Promise<T>,
  ): Promise<T> {
    try {
      const result = await fn();
      await this.log({ ...entry, result: 'success' });
      return result;
    } catch (err: any) {
      await this.log({
        ...entry,
        result: 'failure',
        errorMessage: err?.message ?? String(err),
      });
      throw err;
    }
  }
}

export const operationsLog = typeof window !== 'undefined'
  ? new OperationsLog()
  : ({} as OperationsLog);
