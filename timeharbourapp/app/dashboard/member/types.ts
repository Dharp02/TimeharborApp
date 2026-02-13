export interface SessionEvent {
  id: string;
  type: 'CLOCK' | 'TICKET';
  title: string;
  timestamp: Date;
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
  startTime: Date;
  endTime?: Date;
  events: SessionEvent[];
  status: 'active' | 'completed' | 'adhoc';
}
