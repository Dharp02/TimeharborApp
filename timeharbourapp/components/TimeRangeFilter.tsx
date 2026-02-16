'use client';

import { Calendar, ChevronDown } from 'lucide-react';

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
    const today = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
    
    switch (selected) {
      case 'today':
        return formatter.format(today);
      case 'yesterday': {
        const prev = new Date(today);
        prev.setDate(prev.getDate() - 1);
        return formatter.format(prev);
      }
      case 'week': {
        const first = new Date(today);
        // Assuming week starts on Monday for business context, or we can use Sunday.
        // Let's use simple logic: set to previous Monday (or today if Monday)
        const day = first.getDay() || 7; // Get current day number, converting Sun (0) to 7
        if (day !== 1) first.setHours(-24 * (day - 1));
        
        const last = new Date(first);
        last.setDate(last.getDate() + 6);
        
        return `${formatter.format(first)} - ${formatter.format(last)}`;
      }
      case 'month':
        return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(today);
      case 'custom':
        if (startDate && endDate) {
            const start = new Date(startDate);
            const end = new Date(endDate);
            // Adjust for timezone offset if needed, but simple parsing usually suffices for display if input is YYYY-MM-DD
             // inputs are strings YYYY-MM-DD. When new Date('YYYY-MM-DD') is called, it might be UTC. 
             // To be safe for display we can just reformat the string or use UTC methods. 
             // let's stick to simple string formatting or the Intl formatter which handles dates.
             // Best to just use the formatter on the date objects.
             // Note: new Date('2023-01-01') is UTC, which might show as Dec 31 in local time.
             // Better to append T00:00:00 to ensure local time or handle timezone. 
             // For simplicity, let's assume the user picks dates and we format them.
             return `${formatter.format(new Date(startDate + 'T00:00:00'))} - ${formatter.format(new Date(endDate + 'T00:00:00'))}`;
        }
        return '';
      default:
        return '';
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
