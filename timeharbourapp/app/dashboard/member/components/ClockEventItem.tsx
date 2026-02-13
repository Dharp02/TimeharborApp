'use client';

import { useState } from 'react';
import { Send } from 'lucide-react';
import { ActivitySession } from '../types';
import { ExpandableText } from './ExpandableText';

export function ClockEventItem({ event, isClockIn }: { event: ActivitySession['events'][0], isClockIn: boolean }) {
    const [replyText, setReplyText] = useState('');

    // Mock existing replies (would come from event.original.replies or similar)
    const [replies, setReplies] = useState<string[]>([]);

    const handleSendReply = () => {
        if (!replyText.trim()) return;
        // In a real implementations, this would call an API
        console.log('Sending reply to clock out:', event.id, replyText);
        setReplies([...replies, replyText]);
        setReplyText('');
    };

    return (
        <div className="flex flex-col w-full group">
            <div className="flex justify-between items-center w-full">
                <span className={`text-sm font-semibold ${isClockIn ? 'text-emerald-600 dark:text-emerald-400' : 'text-orange-600 dark:text-orange-400'}`}>
                {isClockIn ? 'Clocked In' : 'Clocked Out'}
                </span>
                <span className="text-xs font-mono text-gray-400">{event.timeFormatted}</span>
            </div>
            {!isClockIn && event.original?.comment && (
                <div className="mt-1 text-sm text-gray-500 dark:text-gray-400 break-words italic pl-2 border-l-2 border-orange-200 dark:border-orange-800">
                    <ExpandableText text={event.original.comment} />
                </div>
            )}
            
            {/* Replies List */}
            {replies.length > 0 && (
                <div className="mt-2 pl-4 space-y-1">
                    {replies.map((reply, idx) => (
                        <div key={idx} className="text-xs text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-800/50 p-2 md:p-1.5 rounded border border-gray-100 dark:border-gray-700 flex gap-1.5">
                            <div className="w-0.5 self-stretch bg-blue-400 rounded-full" /> 
                            <span>{reply}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* Reply Input */}
            {!isClockIn && (
                <div className="mt-2 flex gap-2">
                    <div className="relative flex-1">
                        <input
                            type="text"
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            placeholder="Add a note..."
                            className="w-full pl-3 pr-8 py-2 text-base md:text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-400"
                            onKeyDown={(e) => e.key === 'Enter' && handleSendReply()}
                        />
                    </div>
                    <button
                        onClick={handleSendReply}
                        disabled={!replyText.trim()}
                        className="p-2 md:p-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 text-blue-600 dark:text-blue-400 rounded-md transition-colors"
                    >
                        <Send className="w-4 h-4 md:w-3.5 md:h-3.5" />
                    </button>
                </div>
            )}
        </div>
    );
}
