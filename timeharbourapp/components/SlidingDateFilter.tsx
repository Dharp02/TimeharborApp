'use client';

import { useRef, useEffect } from 'react';
import { Calendar } from 'lucide-react';

interface SlidingDateFilterProps {
  selected: string; // 'today', 'last_week', 'last_month', 'custom', or 'YYYY-MM-DD'
  onSelect: (value: string) => void;
  className?: string;
}

export function SlidingDateFilter({ selected, onSelect, className = '' }: SlidingDateFilterProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // Generate date options
  const generateDays = () => {
    const days = [];
    const today = new Date();
    
    // Generate past 30 days
    // "Yesterday dates in left side"
    // Usually means scroll starts at Today (Rightmost) and user scrolls LEFT to see past.
    // OR Today is Leftmost and user scrolls RIGHT to see past?
    // "Yesterday dates in left side" -> Past dates are to the left of Today.
    // So the list should be chronological: [... Day-2, Day-1, Today].
    // Then the filter buttons on the RIGHT.
    
    // Let's generate [Today - 29 ... Today]
    for (let i = 29; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        days.push(d);
    }
    return days;
  };
  
  const days = generateDays(); // [Day-29, ..., Yesterday, Today]
  
  const formatDateValue = (date: Date) => {
      const offset = date.getTimezoneOffset();
      const localDate = new Date(date.getTime() - (offset*60*1000));
      return localDate.toISOString().split('T')[0];
  };

  const isSelected = (value: string) => selected === value;

  // Scroll to end (Today) on mount so user sees most recent dates
  useEffect(() => {
    if (scrollRef.current) {
        // Find the "Today" element or just scroll to the end of the dates section?
        // Since dates are flex-row and buttons are at end, we probably want to scroll to 
        // the "Today" element which is near the buttons.
        // Let's try to center the selected element if possible.
        // For default 'today', that's near the right end.
        const container = scrollRef.current;
        // Simple heuristic: if 'today' or filter selected, scroll to right.
        if (selected === 'today' || selected.includes('-') || !['last_week', 'last_month', 'custom'].includes(selected)) {
             container.scrollLeft = container.scrollWidth; 
        }
    }
  }, []); // Only on mount

  return (
    <div className={`relative group ${className}`}>
      {/* Scroll Container */}
      <div 
        ref={scrollRef}
        className="flex overflow-x-auto gap-3 py-4 px-1 scrollbar-hide snap-x snap-mandatory"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {/* Date Options (Left Side - Chronological) */}
        {days.map((date) => {
            const dateStr = formatDateValue(date);
            const isToday = dateStr === formatDateValue(new Date());
            // If selected === 'today', we match today's dateStr
            // logic in parent sets 'today' or dateStr? 
            // In parent: `useState<string>(new Date().toISOString().split('T')[0])`
            // So selected IS usually a date string.
            
            const isActive = isSelected(dateStr);
            
            const dayName = date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
            const dayNum = date.getDate();
            
            return (
                <button
                    key={dateStr}
                    onClick={() => onSelect(dateStr)}
                    className={`flex flex-col items-center justify-center min-w-[64px] h-[72px] rounded-2xl border transition-all duration-200 snap-start flex-shrink-0
                        ${isActive 
                            ? 'bg-blue-600 border-blue-600 text-white dark:bg-blue-500 dark:border-blue-500 dark:text-white shadow-md scale-105' 
                            : 'bg-white border-zinc-200 text-zinc-500 hover:border-zinc-300 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-400'
                        }`}
                >
                    <span className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${isActive ? 'text-zinc-400 dark:text-zinc-500' : 'text-zinc-400'}`}>
                        {dayName}
                    </span>
                    <span className="text-xl font-bold font-mono tracking-tight">
                        {dayNum}
                    </span>
                     <span className={`text-[10px] font-medium mt-0.5 ${isActive ? 'text-zinc-500 dark:text-zinc-600' : 'text-zinc-300 dark:text-zinc-600'}`}>
                        -
                    </span>
                </button>
            );
        })}

        <div className="w-px h-10 bg-zinc-200 dark:bg-zinc-700 self-center mx-1 flex-shrink-0" />

        {/* Special Range Options (Right Side) */}
        <div className="flex gap-3 flex-shrink-0 snap-start">
             <button
                onClick={() => onSelect('last_week')}
                className={`flex flex-col items-center justify-center min-w-[70px] h-[72px] rounded-2xl border transition-all duration-200
                    ${isSelected('last_week') 
                        ? 'bg-blue-600 border-blue-600 text-white dark:bg-blue-500 dark:border-blue-500 dark:text-white shadow-md scale-105' 
                        : 'bg-white border-zinc-200 text-zinc-500 hover:border-zinc-300 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-400'
                    }`}
            >
                <span className="text-[10px] font-bold uppercase tracking-wider mb-1">Last</span>
                <span className="text-sm font-bold">Week</span>
            </button>
            <button
                onClick={() => onSelect('last_month')}
                className={`flex flex-col items-center justify-center min-w-[70px] h-[72px] rounded-2xl border transition-all duration-200
                    ${isSelected('last_month') 
                        ? 'bg-blue-600 border-blue-600 text-white dark:bg-blue-500 dark:border-blue-500 dark:text-white shadow-md scale-105' 
                        : 'bg-white border-zinc-200 text-zinc-500 hover:border-zinc-300 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-400'
                    }`}
            >
                <span className="text-[10px] font-bold uppercase tracking-wider mb-1">Last</span>
                <span className="text-sm font-bold">Month</span>
            </button>
             <button
                onClick={() => onSelect('custom')}
                className={`flex flex-col items-center justify-center min-w-[70px] h-[72px] rounded-2xl border transition-all duration-200
                    ${isSelected('custom') 
                        ? 'bg-blue-600 border-blue-600 text-white dark:bg-blue-500 dark:border-blue-500 dark:text-white shadow-md scale-105' 
                        : 'bg-white border-zinc-200 text-zinc-500 hover:border-zinc-300 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-400'
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
