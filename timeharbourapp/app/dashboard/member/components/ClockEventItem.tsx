'use client';

import { useState } from 'react';
import { Send, Bell, MessageSquare } from 'lucide-react';
import { ActivitySession } from '../types';
import { ExpandableText } from './ExpandableText';
import * as API from '@/TimeharborAPI/dashboard';

export function ClockEventItem({ event, isClockIn }: { event: ActivitySession['events'][0], isClockIn: boolean }) {
    const [expanded, setExpanded] = useState(false);
    const [replyText, setReplyText] = useState('');
    const [sending, setSending] = useState(false);
    const [replies, setReplies] = useState<any[]>(event.original?.replies || []);

    const handleSendReply = async () => {
        if (!replyText.trim() || sending) return;
        try {
            setSending(true);
            const newReply = await API.addWorkLogReply(event.id, replyText);
            const displayReply = {
                id: newReply.id,
                content: newReply.content,
                userName: newReply.user?.full_name 
            };
            setReplies([...replies, displayReply]);
            setReplyText('');
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
                    <span className="font-mono text-gray-500 text-sm">{event.timeFormatted}</span>
                </div>
                <div className="flex-1">
                   <p className={`text-base font-medium ${isClockIn ? 'text-gray-900 dark:text-gray-100' : 'text-gray-500'}`}>
                      {isClockIn ? 'Clocked In' : 'Clocked Out'}
                   </p>
                   
                   {/* Inline Preview of Comments (if not expanded) */}
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
                    {/* Original Comment */}
                    {!isClockIn && event.original?.comment && (
                        <div className="text-sm text-gray-600 dark:text-gray-300 italic">
                            <ExpandableText text={event.original.comment} />
                        </div>
                    )}
                    
                    {/* Replies */}
                    {replies.length > 0 && (
                        <div className="space-y-2">
                            {replies.map((reply, idx) => (
                                <div key={reply.id || idx} className="text-sm text-gray-700 dark:text-gray-200 pl-2 border-l-2 border-gray-200 dark:border-gray-700">
                                    {reply.user && <span className="font-semibold text-xs text-blue-500 block mb-0.5">{reply.user.full_name || reply.userName}</span>}
                                    <span>{typeof reply === 'string' ? reply : reply.content}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Action Bar */}
                    <div className="flex gap-2 items-center pt-1">
                        <input
                            type="text"
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            placeholder="Add a reply..."
                            className="flex-1 text-sm bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
                            onKeyDown={(e) => e.key === 'Enter' && !sending && handleSendReply()}
                        />
                        <button
                            onClick={handleSendReply}
                            disabled={!replyText.trim() || sending}
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
