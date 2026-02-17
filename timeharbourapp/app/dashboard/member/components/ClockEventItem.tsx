'use client';

import { useState } from 'react';
import { Send } from 'lucide-react';
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

    
    const hasComments = (event.original?.comment || replies.length > 0);

    return (
        <div className="flex flex-col w-full group">
            {/* Main Row - Minimal */}
            <div 
                className="flex flex-col w-full py-1 cursor-pointer select-none"
                onClick={() => setExpanded(!expanded)}
            >
                <div className="flex items-center justify-between w-full">
                    <span className={`text-sm font-medium ${isClockIn ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                        {isClockIn ? 'Clocked In' : 'Clocked Out'}
                    </span>
                    <span className="text-sm font-mono text-gray-400">{event.timeFormatted}</span>
                </div>

                {/* Always show full comment if present */}
                {!isClockIn && event.original?.comment && (
                    <div className="mt-1 text-base text-gray-600 dark:text-gray-300">
                        {event.original.comment}
                    </div>
                )}
                 
                 {/* Show reply indicator if collapsed and has replies */}
                 {!expanded && replies.length > 0 && (
                    <div className="mt-2 pl-2 border-l-2 border-gray-100 dark:border-gray-700 ml-1">
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

            {/* Expanded Content */}
            {expanded && (
                <div className="mt-2 pl-2 space-y-3 pb-2 animate-in fade-in slide-in-from-top-1 duration-200">
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
                            className="flex-1 text-base bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
                            onKeyDown={(e) => e.key === 'Enter' && !sending && handleSendReply()}
                        />
                        <button
                            onClick={handleSendReply}
                            disabled={!replyText.trim() || sending}
                            className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-full transition-colors disabled:opacity-50"
                        >
                            <Send className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
