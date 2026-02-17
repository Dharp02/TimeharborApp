'use client';

import { useState } from 'react';
import { Briefcase, ExternalLink, Link as LinkIcon, Send, Bell } from 'lucide-react';
import { SessionEvent } from '../types';
import { ExpandableText } from './ExpandableText';
import * as API from '@/TimeharborAPI/dashboard';

export function TicketItem({ event, member }: { event: SessionEvent, member?: any }) {
  const [expanded, setExpanded] = useState(false);
  const [comment, setComment] = useState('');
  const [replies, setReplies] = useState<any[]>(event.original?.replies || []);
  const [sending, setSending] = useState(false);

  const senderInitial = member?.name ? member.name.charAt(0).toUpperCase() : (member?.email ? member.email.charAt(0).toUpperCase() : '?');

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
       {/* Main Ticket Card */}
       <div 
          className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-100 dark:border-gray-700 shadow-sm transition-all hover:shadow-md cursor-pointer select-none"
          onClick={() => setExpanded(!expanded)}
       >
          <div className="flex items-start justify-between mb-2">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate pr-2">
                  {event.title}
              </h3>
              {event.status && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                      {event.status.replace(/_/g, ' ')}
                  </span>
              )}
          </div>

          <div className="text-xs text-gray-500 mb-4 font-medium flex items-center gap-1.5 flex-wrap">
              {/* Using timestamp from start of event */}
              <span>{event.timestamp.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
              
              {/* Use formatted times if available, fallback to basic time string */}
              {(event.startTimeFormatted || event.endTimeFormatted) ? (
                 <>
                    <span>·</span>
                    <span>{event.startTimeFormatted}</span>
                    {event.endTimeFormatted && (
                        <>
                            <span>-</span>
                            <span>{event.endTimeFormatted}</span>
                        </>
                    )}
                    {/* Duration usually in timeFormatted */}
                    {event.timeFormatted && event.timeFormatted !== event.startTimeFormatted && (
                        <>
                            <span>·</span>
                            <span>{event.timeFormatted}</span>
                        </>
                    )}
                 </>
              ) : (
                 <>
                    <span>·</span>
                    <span>{event.timeFormatted}</span>
                 </>
              )}
          </div>

          {/* Comment / Reply Box Area */}
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-3 flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center text-violet-700 dark:text-violet-300 font-semibold text-sm flex-shrink-0">
                  {senderInitial}
              </div>
              <div className="flex-1 min-w-0">
                  <div className="max-h-[120px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-700 pr-1">
                      <p className="text-base text-gray-700 dark:text-gray-300 font-medium break-words whitespace-pre-wrap">
                          {event.original?.comment || "No description"}
                      </p>
                  </div>
                  <p className="text-xs text-blue-500 mt-1 font-medium">
                      Tap to reply
                  </p>
              </div>
          </div>
          
          {/* Latest Reply Preview (if not expanded) */}
          {!expanded && replies.length > 0 && (
            <div className="mt-2 pl-3 border-l-2 border-gray-100 dark:border-gray-700 ml-4">
                <div className="text-sm text-gray-600 dark:text-gray-400 line-clamp-1">
                    <span className="font-semibold text-blue-500 mr-1">
                        {replies[replies.length - 1].user?.full_name || 'You'}:
                    </span>
                    {replies[replies.length - 1].content || replies[replies.length - 1]}
                </div>
                {replies.length > 1 && (
                    <div className="text-xs text-blue-500 mt-0.5 font-medium">
                        View {replies.length - 1} more replies
                    </div>
                )}
            </div>
          )}
       </div>

       {/* Expanded Content - Revealed below card */}
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

            {/* Replies */}
            {replies.length > 0 && (
                <div className="space-y-2 mt-2">
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
                    className="flex-1 text-base bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
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
