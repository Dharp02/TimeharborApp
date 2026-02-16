'use client';

import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

interface SlidingDateFilterProps {
  selected: string; // 'today', 'last_week', 'last_month', 'custom', or 'YYYY-MM-DD'
  onSelect: (value: string) => void;
  className?: string;
}

export function SlidingDateFilter({ selected, onSelect, className = '' }: SlidingDateFilterProps) {
  // Helpers
  const formatDateValue = (date: Date) => {
      const offset = date.getTimezoneOffset();
      const localDate = new Date(date.getTime() - (offset*60*1000));
      return localDate.toISOString().split('T')[0];
  };

  const getDayName = (dateStr: string) => {
      const [y, m, d] = dateStr.split('-').map(Number);
      const dateObj = new Date(y, m - 1, d); 
      return dateObj.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
  };

  const getFullDisplayDate = (dateStr: string) => {
       const [y, m, d] = dateStr.split('-').map(Number);
       const dateObj = new Date(y, m - 1, d);
       // e.g. "Oct 24, 2024"
       return dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Determine active date to display in the middle box
  const isRangeSelected = ['last_week', 'last_month', 'custom'].includes(selected);
  const displayDateStr = isRangeSelected ? formatDateValue(new Date()) : selected; // Default to Today if range active

  const handlePrevDay = () => {
      const [y, m, d] = displayDateStr.split('-').map(Number);
      const date = new Date(y, m - 1, d);
      date.setDate(date.getDate() - 1);
      onSelect(formatDateValue(date));
  };
  
  const handleNextDay = () => {
      const [y, m, d] = displayDateStr.split('-').map(Number);
      const date = new Date(y, m - 1, d);
      date.setDate(date.getDate() + 1);
      onSelect(formatDateValue(date));
  };

  const isSelected = (value: string) => selected === value;

  return (
    <div className={`relative ${className}`}>
      <div className="flex items-center gap-3 overflow-x-auto scrollbar-hide py-1">
        {/* Navigation Controls (Left Side) */}
        <div className="flex items-center gap-2">
            <button
                onClick={handlePrevDay}
                className="flex items-center justify-center w-10 h-[68px] rounded-2xl border border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 transition-colors shadow-sm"
                aria-label="Previous day"
            >
                <ChevronLeft className="w-5 h-5" />
            </button>
            
            {/* Current Date Display BUTTON */}
            <button 
                onClick={() => onSelect(formatDateValue(new Date()))}
                className={`flex flex-col items-center justify-center min-w-[130px] h-[68px] px-2 rounded-2xl border transition-all duration-200
                ${!isRangeSelected 
                    ? 'bg-blue-600 border-blue-600 text-white dark:bg-blue-500 dark:border-blue-500 dark:text-white shadow-md scale-105' 
                    : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 opacity-90'
                }`}
            >
                <span className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${!isRangeSelected ? 'text-gray-200' : 'text-gray-400'}`}>
                    {getDayName(displayDateStr)}
                </span>
                <span className="text-lg font-bold font-mono tracking-tight whitespace-nowrap">
                   {getFullDisplayDate(displayDateStr)}
                </span>
            </button>

            <button
                onClick={handleNextDay}
                className="flex items-center justify-center w-10 h-[68px] rounded-2xl border border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 transition-colors shadow-sm"
                aria-label="Next day"
            >
                <ChevronRight className="w-5 h-5" />
            </button>
        </div>

        <div className="w-px h-10 bg-gray-200 dark:bg-gray-700 self-center mx-1 flex-shrink-0" />

        {/* Range Options (Right Side) */}
        <div className="flex gap-2 flex-shrink-0">
             <button
                onClick={() => onSelect('last_week')}
                className={`flex flex-col items-center justify-center min-w-[70px] h-[68px] rounded-2xl border transition-all duration-200
                    ${isSelected('last_week') 
                        ? 'bg-blue-600 border-blue-600 text-white dark:bg-blue-500 dark:border-blue-500 dark:text-white shadow-md scale-105' 
                        : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400'
                    }`}
            >
                <span className="text-[10px] font-bold uppercase tracking-wider mb-1">Last</span>
                <span className="text-sm font-bold">Week</span>
            </button>
            <button
                onClick={() => onSelect('last_month')}
                className={`flex flex-col items-center justify-center min-w-[70px] h-[68px] rounded-2xl border transition-all duration-200
                    ${isSelected('last_month') 
                        ? 'bg-blue-600 border-blue-600 text-white dark:bg-blue-500 dark:border-blue-500 dark:text-white shadow-md scale-105' 
                        : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400'
                    }`}
            >
                <span className="text-[10px] font-bold uppercase tracking-wider mb-1">Last</span>
                <span className="text-sm font-bold">Month</span>
            </button>
             <button
                onClick={() => onSelect('custom')}
                className={`flex flex-col items-center justify-center min-w-[70px] h-[68px] rounded-2xl border transition-all duration-200
                    ${isSelected('custom') 
                        ? 'bg-blue-600 border-blue-600 text-white dark:bg-blue-500 dark:border-blue-500 dark:text-white shadow-md scale-105' 
                        : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400'
                    }`}
            >
                <Calendar className="w-5 h-5 mb-1" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Custom</span>
            </button>
        </div>
      </div>
    </div>
  );
}
