'use client';

import { Calendar } from 'lucide-react';

export type TimeRange = 'today' | 'yesterday' | 'week' | 'month';

interface TimeRangeFilterProps {
  selected: TimeRange;
  onChange: (range: TimeRange) => void;
  className?: string;
}

const timeRangeOptions: { value: TimeRange; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
];

export default function TimeRangeFilter({ selected, onChange, className = '' }: TimeRangeFilterProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`} role="group" aria-label="Time range filter">
      <div className="p-1.5 bg-blue-500/10 rounded-lg text-blue-500 hidden sm:block">
        <Calendar className="w-4 h-4" />
      </div>
      <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-900 rounded-lg p-1 border border-gray-200 dark:border-gray-700">
        {timeRangeOptions.map((option) => (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            className={`
              px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200
              ${
                selected === option.value
                  ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm border border-gray-200 dark:border-gray-600'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800/50'
              }
            `}
            aria-pressed={selected === option.value}
            aria-label={`Filter by ${option.label.toLowerCase()}`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
