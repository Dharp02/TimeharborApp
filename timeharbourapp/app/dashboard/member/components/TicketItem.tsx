'use client';

import { useState } from 'react';
import { Briefcase, ExternalLink, Link as LinkIcon, Send, Bell, MessageSquare } from 'lucide-react';
import { SessionEvent } from '../types';
import { ExpandableText } from './ExpandableText';
import * as API from '@/TimeharborAPI/dashboard';

export function TicketItem({ event }: { event: SessionEvent }) {
  const [expanded, setExpanded] = useState(false);
  const [comment, setComment] = useState('');
  const [replies, setReplies] = useState<any[]>(event.original?.replies || []);
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!comment.trim() || sending) return;
    try {
        setSending(true);
        const newReply = await API.addWorkLogReply(event.id, comment);
        setReplies([...replies, newReply]);
        setComment('');
    } catch (error) {
        console.error('Failed to send reply:', error);
        alert('Failed to send reply.');
    } finally {
        setSending(false);
    }
  };

  const handlePushNotification = (e: React.MouseEvent) => {
    e.stopPropagation();
    alert('Push notification sent!');
  };

  const hasComments = (event.original?.comment || replies.length > 0);

  return (
    <div className="flex flex-col w-full group">
       {/* Main Row - Clickable */}
       <div 
          className="flex items-center gap-3 cursor-pointer py-3 px-3 select-none bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-gray-300 dark:hover:border-gray-600 transition-all"
          onClick={() => setExpanded(!expanded)}
       >
          <div className="flex items-center gap-2 min-w-[80px]">
              <span className="text-sm font-mono text-gray-500">{event.timeFormatted}</span>
          </div>
          
          <Briefcase className="w-5 h-5 text-blue-500 flex-shrink-0" />
          
          <div className="flex-1 min-w-0">
             <span className="text-base font-medium text-gray-900 dark:text-gray-100 truncate block">{event.title}</span>
             
             {/* Inline Preview */}
             {!expanded && hasComments && (
                 <div className="flex items-center gap-1.5 mt-1 text-gray-400">
                     <MessageSquare className="w-3.5 h-3.5" />
                     <span className="text-sm truncate max-w-[200px]">
                        {replies.length > 0 ? `${replies.length} replies` : event.original.comment}
                     </span>
                 </div>
             )}
          </div>
       </div>

       {/* Expanded Content */}
       {expanded && (
          <div className="mt-2 pl-2 space-y-3 pb-2 animate-in fade-in slide-in-from-top-1 duration-200">
             {/* References */}
             {event.references && event.references.length > 0 && (
                <div className="flex flex-wrap gap-2">
                   {event.references.map((ref: any, i: number) => (
                      <a 
                         key={i} 
                         href={ref.url}
                         target="_blank"
                         rel="noopener noreferrer"
                         className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 transition-colors"
                      >
                         {ref.type === 'github' ? <ExternalLink className="w-3 h-3" /> : <LinkIcon className="w-3 h-3" />}
                         {ref.label || 'Link'}
                      </a>
                   ))}
                </div>
             )}

            {/* Original Comment */}
            {event.original?.comment && (
                <div className="text-sm text-gray-600 dark:text-gray-300">
                    <ExpandableText text={event.original.comment} />
                </div>
            )}
             
            {/* Replies */}
            {replies.length > 0 && (
                <div className="space-y-2">
                    {replies.map((reply, i) => (
                        <div key={reply.id || i} className="text-sm text-gray-700 dark:text-gray-200 pl-2 border-l-2 border-gray-200 dark:border-gray-700">
                            {reply.user && <span className="font-semibold text-xs text-blue-500 block mb-0.5">{reply.user.full_name}</span>}
                            <span className={reply.user ? '' : 'italic'}>{reply.content || reply}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* Action Bar */}
            <div className="flex gap-2 items-center pt-1">
                <input
                    type="text"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Add a reply..."
                    className="flex-1 text-sm bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
                    onKeyDown={(e) => e.key === 'Enter' && !sending && handleSend()}
                />
                <button
                    onClick={handleSend}
                    disabled={!comment.trim() || sending}
                    className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-full transition-colors disabled:opacity-50"
                >
                    <Send className="w-4 h-4" />
                </button>
                <button
                    onClick={handlePushNotification}
                    className="p-2 text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-full transition-colors"
                    title="Send Push Notification"
                >
                    <Bell className="w-4 h-4" />
                </button>
            </div>
          </div>
       )}
    </div>
  );
}
