'use client';

import React, { useState, useEffect } from 'react';
import { 
  format, 
  subDays, 
  startOfDay, 
  endOfDay, 
  subMonths
} from 'date-fns';
import { Calendar as CalendarIcon, ChevronDown } from 'lucide-react';

export type DateRangePreset = 'today' | 'yesterday' | 'past_week' | 'past_month' | 'custom';

export interface DateRange {
  from: Date;
  to: Date;
}

interface DateRangePickerProps {
  initialPreset?: DateRangePreset;
  initialCustomRange?: DateRange;
  onRangeChange: (range: DateRange, preset: DateRangePreset) => void;
  className?: string;
}

export function DateRangePicker({
  initialPreset = 'today',
  initialCustomRange,
  onRangeChange,
  className = ''
}: DateRangePickerProps) {
  const [preset, setPreset] = useState<DateRangePreset>(initialPreset);
  const [customRange, setCustomRange] = useState<DateRange>(
    initialCustomRange || { from: new Date(), to: new Date() }
  );

  // Helper to get range from preset
  const getRangeFromPreset = (p: DateRangePreset): DateRange => {
    const now = new Date();
    switch (p) {
      case 'today':
        return { from: startOfDay(now), to: endOfDay(now) };
      case 'yesterday':
        const yesterday = subDays(now, 1);
        return { from: startOfDay(yesterday), to: endOfDay(yesterday) };
      case 'past_week':
        return { from: startOfDay(subDays(now, 7)), to: endOfDay(now) };
      case 'past_month':
        return { from: startOfDay(subMonths(now, 1)), to: endOfDay(now) };
      case 'custom':
        return customRange;
      default:
        return { from: startOfDay(now), to: endOfDay(now) };
    }
  };

  // Only notify parent when user interacts, or initially? 
  // Often it's better to let parent control, but for "bare bones" internal state is easier.
  
  const handlePresetChange = (newPreset: DateRangePreset) => {
    setPreset(newPreset);
    if (newPreset !== 'custom') {
      const range = getRangeFromPreset(newPreset);
      onRangeChange(range, newPreset);
    } else {
        // When switching to custom, we might want to keep the current range or reset
        // keeping current range is usually better UX
        onRangeChange(customRange, newPreset);
    }
  };

  const handleCustomDateChange = (type: 'from' | 'to', value: string) => {
    if (!value) return;
    const date = new Date(value); // Input type="date" returns YYYY-MM-DD
    // Adjust for timezone - input date is usually local YYYY-MM-DD
    // We want start/end of that day in local time
    
    // Quick fix for date input causing UTC shifts:
    // Append T00:00 to keep it local or use manual parsing
    const parts = value.split('-');
    const localDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));

    const newRange = { ...customRange };
    if (type === 'from') {
      newRange.from = startOfDay(localDate);
    } else {
      newRange.to = endOfDay(localDate);
    }
    
    setCustomRange(newRange);
    onRangeChange(newRange, 'custom');
  };

  const options: { value: DateRangePreset; label: string }[] = [
    { value: 'today', label: 'Today' },
    { value: 'yesterday', label: 'Yesterday' },
    { value: 'past_week', label: 'Past Week' },
    { value: 'past_month', label: 'Past Month' },
    { value: 'custom', label: 'Custom Range' },
  ];

  // Formatting for display
  const currentRange = getRangeFromPreset(preset);
  const displayLabel = preset === 'custom' 
    ? `${format(customRange.from, 'MMM d, yyyy')} - ${format(customRange.to, 'MMM d, yyyy')}`
    : options.find(o => o.value === preset)?.label;

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      {/* Mobile-friendly select / Dropdown trigger */}
      <div className="relative w-full">
        <div className="flex items-center justify-between w-full sm:w-auto px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm">
          <div className="flex items-center flex-1 min-w-0">
            <CalendarIcon className="w-4 h-4 mr-2 text-gray-500 flex-shrink-0" />
            <span className="flex-1 text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
              {displayLabel}
            </span>
          </div>
          <ChevronDown className="w-4 h-4 ml-2 text-gray-500 flex-shrink-0" />
          
          <select
            value={preset}
            onChange={(e) => handlePresetChange(e.target.value as DateRangePreset)}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            aria-label="Select date range"
          >
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Custom Date Inputs - Visible only when custom is selected */}
      {preset === 'custom' && (
        <div className="flex flex-wrap items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2 w-full sm:w-auto">
             <input
              type="date"
              value={format(customRange.from, 'yyyy-MM-dd')}
              onChange={(e) => handleCustomDateChange('from', e.target.value)}
              className="flex-1 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              aria-label="Start date"
            />
            <span className="text-gray-400">to</span>
            <input
              type="date"
              value={format(customRange.to, 'yyyy-MM-dd')}
              onChange={(e) => handleCustomDateChange('to', e.target.value)}
              className="flex-1 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              aria-label="End date"
            />
          </div>
        </div>
      )}
    </div>
  );
}
