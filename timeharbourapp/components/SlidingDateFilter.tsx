'use client';

import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { DateTime } from 'luxon';

interface SlidingDateFilterProps {
  selected: string; // 'today', 'last_week', 'last_month', 'custom', or 'YYYY-MM-DD'
  onSelect: (value: string) => void;
  className?: string;
}

export function SlidingDateFilter({ selected, onSelect, className = '' }: SlidingDateFilterProps) {
  // Helpers
  const formatDateValue = (date: DateTime) => {
      return date.toFormat('yyyy-MM-dd');
  };

  const todayStr = formatDateValue(DateTime.now());

  const getDayName = (dateStr: string) => {
      if (dateStr === 'this_week') return 'THIS';
      if (dateStr === 'this_month') return 'THIS';
      if (dateStr === 'last_week') return 'LAST';
      if (dateStr === 'last_month') return 'LAST';
      if (dateStr === 'custom') return 'CUSTOM';
      
      const dateObj = DateTime.fromISO(dateStr);
      return dateObj.toFormat('ccc').toUpperCase();
  };

  const getFullDisplayDate = (dateStr: string) => {
       if (dateStr === 'this_week') return 'Week';
       if (dateStr === 'this_month') return 'Month';
       if (dateStr === 'last_week') return 'Week';
       if (dateStr === 'last_month') return 'Month';
       if (dateStr === 'custom') return 'Range';

       const dateObj = DateTime.fromISO(dateStr);
       return dateObj.toFormat('MMM d, yyyy');
  };

  const handlePrevDay = () => {
      if (selected === 'last_month') {
          onSelect('last_week');
          return;
      }
      if (selected === 'last_week') {
          onSelect('this_month');
          return;
      }
      if (selected === 'this_month') {
          onSelect('this_week');
          return;
      }
      if (selected === 'this_week') {
          onSelect(todayStr); // Go back to Today
          return;
      }
      if (selected === 'custom') {
          onSelect(todayStr); // Default behavior for custom
          return;
      }

      // If date
      // Handle 'today' string case or 'todayStr'
      const dateToUse = (selected === 'today') ? todayStr : selected;
      const date = DateTime.fromISO(dateToUse).minus({ days: 1 });
      onSelect(formatDateValue(date));
  };
  
  const getDisplayDayName = () => {
       if (selected === 'today') return getDayName(todayStr);
       return getDayName(selected);
  }

  const getDisplayFullDate = () => {
        if (selected === 'today') return getFullDisplayDate(todayStr);
        return getFullDisplayDate(selected);
  }

  const handleNextDay = () => {
       if (selected === 'last_month') {
           // Do nothing, end of forward sequence
           return; 
       }
       if (selected === 'last_week') {
           onSelect('last_month');
           return;
       }
       if (selected === 'this_month') {
           onSelect('last_week');
           return;
       }
       if (selected === 'this_week') {
           onSelect('this_month');
           return;
       }
       if (selected === 'custom') {
           onSelect('this_week'); // Assume custom -> ranges flow
           return;
       }

       // It is a date or 'today' string
       const currentIsToday = selected === 'today' || selected === todayStr;

       if (currentIsToday) {
           // At Today, next step is ranges
           onSelect('this_week');
           return;
       }

       const date = DateTime.fromISO(selected).plus({ days: 1 });
       const nextDateStr = formatDateValue(date);
       
       // Check if next date is future
       if (nextDateStr > todayStr) {
           onSelect('this_week'); // If somehow we overshoot, fallback to range
       } else {
           onSelect(nextDateStr);
       }
  };

  return (
    <div className={`inline-flex items-center p-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm ${className}`}>
      {/* Navigation Controls */}
      <button
        onClick={handlePrevDay}
        className="flex items-center justify-center w-10 h-10 rounded-xl text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
        aria-label="Previous"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>

      {/* Date Display */}
      <div className="flex flex-col items-center justify-center min-w-[140px] px-2 select-none">
        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-0.5">
          {getDisplayDayName()}
        </span>
        <span className="text-lg font-bold font-mono tracking-tight text-gray-900 dark:text-white">
          {getDisplayFullDate()}
        </span>
      </div>

      <button
        onClick={handleNextDay}
        disabled={selected === 'last_month'}
        className={`flex items-center justify-center w-10 h-10 rounded-xl text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors
            ${selected === 'last_month' ? 'opacity-30 cursor-not-allowed hover:bg-transparent dark:hover:bg-transparent' : ''}`}
        aria-label="Next"
      >
        <ChevronRight className="w-5 h-5" />
      </button>

      {/* Divider */}
      <div className="w-px h-8 bg-gray-200 dark:bg-gray-700 mx-2" />

      {/* Custom Trigger */}
      <button
        onClick={() => onSelect('custom')}
        className={`flex items-center gap-2 px-4 h-10 rounded-xl transition-all font-medium text-sm
            ${selected === 'custom' 
                ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400' 
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700/50'
            }`}
      >
        <Calendar className="w-4 h-4" />
        <span>Custom</span>
      </button>
    </div>
  );
}
