'use client';

import { ActivitySession } from '../types';
import { TicketItem } from './TicketItem';
import { ClockEventItem } from './ClockEventItem';

export function SessionCard({ session }: { session: ActivitySession }) {
  const dateStr = session.startTime.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const timeRange = `${session.startTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} - ${session.endTime ? session.endTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : 'Now'}`;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl px-2 py-4 border border-gray-200 dark:border-gray-700 shadow-sm mb-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4 px-2">
         <div className={`w-3 h-3 rounded-full ${session.status === 'adhoc' ? 'bg-orange-400' : 'bg-green-500'}`} />
         <span className="text-base font-semibold text-gray-900 dark:text-gray-100">
            {dateStr}
         </span>
         <span className="text-base text-gray-500">
            {timeRange}
         </span>
      </div>

      {/* Timeline */}
      <div className="relative pl-6 ml-3 border-l border-gray-200 dark:border-gray-800 space-y-4 pb-2">
         {session.events.map((event, idx) => {
            const isClock = event.type === 'CLOCK';
            const isClockIn = isClock && event.original.type === 'CLOCK_IN';
            
            return (
               <div key={event.id} className="relative group">
                  {/* Minimal Dot */}
                  <div className={`absolute -left-[29px] top-1.5 w-3 h-3 rounded-full border-2 border-white dark:border-gray-900 ${
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
