'use client';

import { Calendar, ChevronDown } from 'lucide-react';

export type TimeRange = 'today' | 'yesterday' | 'week' | 'month';

interface TimeRangeFilterProps {
  selected: TimeRange;
  onChange: (range: TimeRange) => void;
  className?: string;
}

const timeRangeOptions: { value: TimeRange; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
];

export default function TimeRangeFilter({ selected, onChange, className = '' }: TimeRangeFilterProps) {
  const selectedOption = timeRangeOptions.find(opt => opt.value === selected) || timeRangeOptions[0];

  return (
    <div className={`relative group ${className}`}>
      <div className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors cursor-pointer min-w-[140px]">
        <Calendar className="w-4 h-4 text-gray-500 dark:text-gray-400" />
        <span className="flex-1 text-sm font-medium text-gray-900 dark:text-gray-200">
          {selectedOption.label}
        </span>
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
  );
}
