'use client';

import { Calendar, ChevronDown } from 'lucide-react';
import { DateTime } from 'luxon';

export type TimeRange = 'today' | 'yesterday' | 'week' | 'month' | 'custom';

interface TimeRangeFilterProps {
  selected: TimeRange;
  onChange: (range: TimeRange) => void;
  startDate?: string;
  endDate?: string;
  onDateChange?: (start: string, end: string) => void;
  className?: string;
}

const timeRangeOptions: { value: TimeRange; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'custom', label: 'Custom Range' },
];

export default function TimeRangeFilter({ selected, onChange, startDate, endDate, onDateChange, className = '' }: TimeRangeFilterProps) {
  const selectedOption = timeRangeOptions.find(opt => opt.value === selected) || timeRangeOptions[0];

  const getDateDisplay = () => {
    const today = DateTime.now();
    
    switch (selected) {
      case 'today':
        return today.toFormat('MMM d');
      case 'yesterday': {
        return today.minus({ days: 1 }).toFormat('MMM d');
      }
      case 'week': {
        const start = today.startOf('week'); // Monday
        const end = today.endOf('week');
        return `${start.toFormat('MMM d')} - ${end.toFormat('MMM d')}`;
      }
      case 'month': {
        const start = today.startOf('month');
        const end = today.endOf('month');
        return `${start.toFormat('MMM d')} - ${end.toFormat('MMM d')}`;
      }
      case 'custom': {
        if (startDate && endDate) {
          const start = DateTime.fromISO(startDate);
          const end = DateTime.fromISO(endDate);
          return `${start.toFormat('MMM d')} - ${end.toFormat('MMM d')}`;
        }
        return 'Custom Range';
      }
      default:
        return 'Select Range';
    }
  };

  return (
    <div className={`flex flex-col sm:flex-row gap-2 ${className}`}>
      <div className="relative group flex-1 w-full">
        <div className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors cursor-pointer min-w-[140px] w-full">
          <Calendar className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          <div className="flex-1 flex justify-between items-center text-sm">
            <span className="font-medium text-gray-900 dark:text-gray-200">
                {selectedOption.label}
            </span>
            <span className="text-gray-500 dark:text-gray-400 font-normal">
                {getDateDisplay()}
            </span>
          </div>
          <ChevronDown className="w-4 h-4 text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-300 transition-colors" />
        </div>
        
        <select
          value={selected}
          onChange={(e) => onChange(e.target.value as TimeRange)}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          aria-label="Filter activity by time range"
        >
          {timeRangeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

       {selected === 'custom' && onDateChange && (
        <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-4 duration-300">
          <input
            type="date"
            value={startDate || ''}
            onChange={(e) => onDateChange(e.target.value, endDate || '')}
            className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm text-sm text-gray-900 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <span className="text-gray-400">-</span>
           <input
            type="date"
            value={endDate || ''}
            onChange={(e) => onDateChange(startDate || '', e.target.value)}
            className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm text-sm text-gray-900 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      )}
    </div>
  );
}
