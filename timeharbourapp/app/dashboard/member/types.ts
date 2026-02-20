import { DateTime } from 'luxon';

export interface SessionEvent {
  id: string;
  type: 'CLOCK' | 'TICKET';
  title: string;
  timestamp: DateTime;
  status?: string;
  original: any;
  references?: any[];
  timeDisplay?: string;
  timeFormatted?: string;
  startTimeFormatted?: string;
  endTimeFormatted?: string;
}

export interface ActivitySession {
  id: string;
  startTime: DateTime;
  endTime?: DateTime;
  events: SessionEvent[];
  status: 'active' | 'completed' | 'adhoc';
}
