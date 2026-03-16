import { DateTime } from 'luxon';
import type { DateRangePreset } from '@mieweb/ui';

export interface LuxonDateRange {
  from: DateTime;
  to: DateTime;
}

export const dateFilterPresets: DateRangePreset[] = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'last-7-days', label: 'Past Week' },
  { key: 'last-30-days', label: 'Past Month' },
];

/**
 * Convert a @mieweb/ui DateRange callback to a Luxon DateRange.
 * When a preset chip is tapped on mobile, @mieweb/ui may pass
 * { start: null, end: null } — so we compute the range ourselves.
 */
export function resolveRange(
  range: { start: Date | null; end: Date | null },
  presetKey?: string,
): LuxonDateRange {
  const { start, end } = range;

  // If we already have concrete dates, convert and return.
  if (start && end) {
    return { from: DateTime.fromJSDate(start), to: DateTime.fromJSDate(end) };
  }

  // Compute from presetKey when dates are null (mobile chip tap).
  const now = DateTime.now();
  switch (presetKey) {
    case 'today':
      return { from: now.startOf('day'), to: now.endOf('day') };
    case 'yesterday': {
      const yesterday = now.minus({ days: 1 });
      return { from: yesterday.startOf('day'), to: yesterday.endOf('day') };
    }
    case 'last-7-days':
      return { from: now.minus({ days: 7 }).startOf('day'), to: now };
    case 'last-30-days':
      return { from: now.minus({ days: 30 }).startOf('day'), to: now };
    default:
      return { from: now.startOf('day'), to: now.endOf('day') };
  }
}
