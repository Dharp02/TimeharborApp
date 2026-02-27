import { Duration } from 'luxon';

/**
 * Format raw milliseconds into a human-readable "Xh Ym" string.
 *
 * All duration *calculations* happen on the backend (UTC-based).
 * This function is the single frontend formatting layer — using Luxon Duration
 * so we keep consistent behaviour across dashboard, timesheet, and member pages.
 */
export function formatDurationMs(ms: number): string {
  if (!ms || ms <= 0) return '0h 0m';
  const d = Duration.fromMillis(ms).shiftTo('hours', 'minutes');
  const h = Math.floor(d.hours);
  const m = Math.floor(d.minutes);
  return `${h}h ${m}m`;
}
