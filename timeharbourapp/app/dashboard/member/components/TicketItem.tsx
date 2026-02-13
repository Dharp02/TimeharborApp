'use client';

import { useState } from 'react';
import { Briefcase, ExternalLink, Link as LinkIcon, MessageSquare, Send } from 'lucide-react';
import { SessionEvent } from '../types';
import { ExpandableText } from './ExpandableText';

export function TicketItem({ event }: { event: SessionEvent }) {
  const [comment, setComment] = useState('');

  const handleSend = () => {
    if (!comment.trim()) return;
    console.log('Sending comment for event', event.id, comment);
    // Here you would typically call an API to save the comment
    setComment('');
  };

  return (
    <div className="mt-2">
         <div className="bg-blue-50/50 dark:bg-blue-900/10 rounded-lg p-3 border border-blue-100 dark:border-blue-900/30">
            <div className="flex justify-between items-start mb-2">
               <div className="font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-blue-500" />
                  <span>{event.title}</span>
               </div>
               <div className="flex flex-col items-end">
                   {event.startTimeFormatted ? (
                       <div className="text-xs font-mono text-gray-500 flex flex-col items-end">
                           <span>{event.startTimeFormatted} {event.endTimeFormatted ? ` - ${event.endTimeFormatted}` : ''}</span>
                           {event.endTimeFormatted && <span className="text-[10px] text-gray-400">Duration: {event.timeFormatted}</span>}
                       </div>
                   ) : (
                       <span className="text-xs font-mono text-gray-500">{event.timeFormatted}</span>
                   )}
               </div>
            </div>

            {/* References */}
            {event.references && event.references.length > 0 && (
               <div className="flex flex-wrap gap-2 mb-3">
                  {event.references.map((ref: any, i: number) => (
                     <a 
                        key={i} 
                        href={ref.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 hover:underline border border-gray-200 dark:border-gray-700 shadow-sm"
                     >
                        {ref.type === 'github' ? <ExternalLink className="w-3 h-3" /> : <LinkIcon className="w-3 h-3" />}
                        {ref.label || 'Reference'}
                     </a>
                  ))}
               </div>
            )}
            
            {/* Comment Display */}
            {event.original?.comment && (
                <div className="bg-white dark:bg-gray-800 p-2.5 rounded-md mb-3 text-sm text-gray-700 dark:text-gray-300 border border-gray-100 dark:border-gray-700 shadow-sm">
                    <div className="flex gap-2">
                       <MessageSquare className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                       <span>{event.original.comment}</span>
                    </div>
                </div>
            )}
            
            {/* Comment Box */}
            <div className="flex gap-2">
               <div className="relative flex-1">
                  <input
                  type="text"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Add a note..."
                  className="w-full pl-3 pr-8 py-2 text-base md:text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-400"
                  />
               </div>
               <button
                  onClick={handleSend}
                  disabled={!comment.trim()}
                  className="p-2 md:p-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 text-blue-600 dark:text-blue-400 rounded-md transition-colors"
               >
                  <Send className="w-4 h-4 md:w-3.5 md:h-3.5" />
               </button>
            </div>
         </div>
    </div>
  );
}
