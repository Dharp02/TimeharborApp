'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Ticket, ArrowLeft, Check, X } from 'lucide-react';
import { useTeam } from '@/components/dashboard/TeamContext';
import { useAuth } from '@/components/auth/AuthProvider';
import { tickets as ticketsApi } from '@/TimeharborAPI';
import { CreateTicketData } from '@/TimeharborAPI/tickets';
import { useLogger } from '@/hooks/useLogger';
import Link from 'next/link';

export default function CreateTicketPage() {
  const router = useRouter();
  const logger = useLogger();
  const { currentTeam } = useTeam();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [newTicket, setNewTicket] = useState({ 
    title: '', 
    description: '', 
    status: 'Open', 
    priority: 'Medium', 
    reference: '' 
  });

  const handleCreateTicket = async () => {
    if (!currentTeam) return;

    if (!newTicket.title.trim()) {
        setError("Title is required");
        return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Create new ticket
      const ticketData: CreateTicketData = {
        title: newTicket.title,
        description: newTicket.description,
        status: newTicket.status as any,
        priority: newTicket.priority as any,
        link: newTicket.reference
      };
      await ticketsApi.createTicket(currentTeam.id, ticketData);
      
      logger.log('Created Ticket', {
        subtitle: newTicket.title,
        description: `Ticket created by ${user?.full_name || 'User'}`
      });
      
      router.push('/dashboard/tickets');
    } catch (error: any) {
      console.error('Failed to create ticket:', error);
      setError(error.message || 'Failed to create ticket');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900 overflow-y-auto">
      {/* Content */}
      <div className="px-1 pt-0 pb-0 md:p-6 md:pb-6 flex-grow-0">
        <div className="max-w-3xl mr-auto space-y-6">
            
            {error && (
                <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-lg text-sm border border-red-200 dark:border-red-800">
                    {error}
                </div>
            )}

            <div className="space-y-6">
                <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-2">
                    <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                        <Ticket className="w-5 h-5 text-green-600 dark:text-green-500" />
                    </div>
                    <p className="text-sm">Create a new ticket to track your work.</p>
                </div>

                <div className="space-y-5">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                            Title <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={newTicket.title}
                            onChange={(e) => setNewTicket({ ...newTicket, title: e.target.value })}
                            placeholder="Enter ticket title"
                            disabled={isLoading}
                            className="w-full px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 dark:text-white placeholder-gray-500 transition-shadow"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                            Description <span className="text-gray-400 font-normal">(optional)</span>
                        </label>
                        <textarea
                            value={newTicket.description}
                            onChange={(e) => setNewTicket({ ...newTicket, description: e.target.value })}
                            placeholder="Add more details..."
                            disabled={isLoading}
                            className="w-full px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 dark:text-white placeholder-gray-500 min-h-[120px] transition-shadow resize-y"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                            Reference Link <span className="text-gray-400 font-normal">(optional)</span>
                        </label>
                        <input
                            type="url"
                            value={newTicket.reference}
                            onChange={(e) => setNewTicket({ ...newTicket, reference: e.target.value })}
                            placeholder="https://..."
                            disabled={isLoading}
                            className="w-full px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 dark:text-white placeholder-gray-500 transition-shadow"
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                Status
                            </label>
                            <div className="relative">
                                <select
                                    value={newTicket.status}
                                    onChange={(e) => setNewTicket({ ...newTicket, status: e.target.value })}
                                    disabled={isLoading}
                                    className="w-full px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 dark:text-white appearance-none"
                                >
                                    <option value="Open">Open</option>
                                    <option value="In Progress">In Progress</option>
                                    <option value="Closed">Closed</option>
                                </select>
                                <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                Priority
                            </label>
                            <div className="relative">
                                <select
                                    value={newTicket.priority}
                                    onChange={(e) => setNewTicket({ ...newTicket, priority: e.target.value })}
                                    disabled={isLoading}
                                    className="w-full px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 dark:text-white appearance-none"
                                >
                                    <option value="Low">Low</option>
                                    <option value="Medium">Medium</option>
                                    <option value="High">High</option>
                                </select>
                                <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="pt-4 flex gap-4 hidden md:flex">
                     <button
                        onClick={() => router.push('/dashboard/tickets')}
                        disabled={isLoading}
                        className="flex-1 px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleCreateTicket}
                        disabled={isLoading}
                        className="flex-1 px-4 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex justify-center items-center gap-2"
                    >
                        {isLoading ? 'Creating...' : 'Create Ticket'}
                    </button>
                </div>
            </div>
        </div>
      </div>

       {/* Mobile Actions - Pushed to the form instead of fixed bottom */}
       <div className="md:hidden px-0 -mt-3 pb-8">
            <div className="flex gap-4">
                <button
                    onClick={() => router.push('/dashboard/tickets')}
                    disabled={isLoading}
                        className="flex-1 px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                    >
                        Cancel
                    </button>
                <button
                    onClick={handleCreateTicket}
                    disabled={isLoading}
                    className="flex-1 px-4 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex justify-center items-center gap-2"
                >
                    {isLoading ? 'Creating...' : 'Create Ticket'}
                </button>
            </div>
       </div>

    </div>
  );
}
