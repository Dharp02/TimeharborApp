'use client';

import { useState } from 'react';
import { Briefcase, ExternalLink, Link as LinkIcon, MessageSquare, Send } from 'lucide-react';
import { SessionEvent } from '../types';
import { ExpandableText } from './ExpandableText';
import * as API from '@/TimeharborAPI/dashboard';

export function TicketItem({ event }: { event: SessionEvent }) {
  const [comment, setComment] = useState('');
  const [replies, setReplies] = useState<any[]>(event.original?.replies || []);
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!comment.trim() || sending) return;
    
    try {
        setSending(true);
        const newReply = await API.addWorkLogReply(event.id, comment);
        
        // Add to local state
        setReplies([...replies, newReply]);
        setComment('');
    } catch (error) {
        console.error('Failed to send reply:', error);
        alert('Failed to send reply. Please try again.');
    } finally {
        setSending(false);
    }
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
            {(event.original?.comment || replies.length > 0) && (
                <div className="bg-white dark:bg-gray-800 p-2.5 rounded-md mb-3 text-sm text-gray-700 dark:text-gray-300 border border-gray-100 dark:border-gray-700 shadow-sm space-y-2">
                    {event.original?.comment && (
                        <div className="flex gap-2">
                            <MessageSquare className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                            <span>{event.original.comment}</span>
                        </div>
                    )}
                    
                    {/* Replies */}
                    {replies.map((reply, i) => (
                        <div key={reply.id || i} className="flex gap-2 pl-2 border-l-2 border-gray-200 dark:border-gray-700 ml-1">
                            {/* <div className="w-1 h-1 bg-gray-400 rounded-full mt-2" /> */}
                            <div className="flex flex-col text-xs md:text-sm">
                                {reply.user && <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400">{reply.user.full_name}</span>}
                                <span className={reply.user ? '' : 'italic'}>{reply.content || reply}</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
            
            {/* Comment Box */}
            <div className="flex gap-2">
               <div className="relative flex-1">
                  <input
                  type="text"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Reply..."
                  className="w-full pl-3 pr-8 py-2 text-base md:text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-400"
                  onKeyDown={(e) => e.key === 'Enter' && !sending && handleSend()}
                  disabled={sending}
                  />
               </div>
               <button
                  onClick={handleSend}
                  disabled={!comment.trim() || sending}
                  className="p-2 md:p-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 text-blue-600 dark:text-blue-400 rounded-md transition-colors"
                >
                  {sending ? (
                      <div className="w-4 h-4 md:w-3.5 md:h-3.5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  ) : (
                      <Send className="w-4 h-4 md:w-3.5 md:h-3.5" />
                  )}
               </button>
            </div>
         </div>
      </div>
    );
}
