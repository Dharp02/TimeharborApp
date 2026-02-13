'use client';

import { ActivitySession } from '../types';
import { TicketItem } from './TicketItem';
import { ClockEventItem } from './ClockEventItem';

export function SessionCard({ session }: { session: ActivitySession }) {
  const dateStr = session.startTime.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-4">
         <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-gray-300 dark:bg-gray-600" />
            <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">
               {session.status === 'adhoc' ? 'Activity' : 'Work Session'}
            </span>
            <span className="text-xs text-gray-400">• {dateStr}</span>
         </div>
      </div>

      <div className="relative pl-4 border-l-2 border-gray-100 dark:border-gray-700 space-y-6">
         {session.events.map((event, idx) => {
            const isClock = event.type === 'CLOCK';
            const isClockIn = isClock && event.original.type === 'CLOCK_IN';
            
            return (
               <div key={event.id} className="relative">
                  {/* Dot */}
                  <div className={`absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full ring-4 ring-white dark:ring-gray-800 ${
                     isClock 
                        ? (isClockIn ? 'bg-emerald-500' : 'bg-orange-500')
                        : 'bg-blue-500'
                  }`} />

                  {isClock ? (
                     <ClockEventItem event={event} isClockIn={isClockIn} />
                  ) : (
                     <TicketItem event={event} />
                  )}
               </div>
            );
         })}
      </div>
    </div>
  );
}
