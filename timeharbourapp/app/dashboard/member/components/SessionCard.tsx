'use client';

import { ActivitySession } from '../types';
import { TicketItem } from './TicketItem';
import { ClockEventItem } from './ClockEventItem';

export function SessionCard({ session, member }: { session: ActivitySession, member?: any }) {
  const dateStr = session.startTime.toFormat('MMM d');

  return (
    <div className="mb-8 px-1">
      {/* Date Header */}
      <div className="text-xl font-bold text-gray-900 dark:text-white mb-4 px-1">
         {dateStr}
      </div>

      {/* Events List - Timeline Container */}
      <div className="relative pl-2 ml-0 border-l-2 border-gray-200 dark:border-gray-800 space-y-2 pb-2">
         {session.events.map((event, idx) => {
            const isClock = event.type === 'CLOCK';
            const isClockIn = isClock && event.original.type === 'CLOCK_IN';
            const isLast = idx === session.events.length - 1;
            
            return (
               <div key={event.id} className="relative">
                  {/* Timeline Dot */}
                  <div className={`absolute -left-[16px] top-2 w-3 h-3 rounded-full border-2 border-white dark:border-gray-900 ${
                     isClock 
                        ? (isClockIn ? 'bg-emerald-500' : 'bg-orange-500')
                        : 'bg-blue-400'
                  } z-10`} />

                  {isClock ? (
                     <ClockEventItem event={event} isClockIn={isClockIn} />
                  ) : (
                     <TicketItem event={event} member={member} />
                  )}
                  
                  {/* Separator after Clock Out if not last */}
                  {isClock && !isClockIn && !isLast && (
                      <div className="my-4 border-b border-gray-200 dark:border-gray-800 border-dashed" />
                  )}
               </div>
            );
         })}
      </div>
    </div>
  );
}
