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
import { Button, Input, Textarea, Select } from '@mieweb/ui';

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
                        <Input
                            type="text"
                            value={newTicket.title}
                            onChange={(e) => setNewTicket({ ...newTicket, title: e.target.value })}
                            placeholder="Enter ticket title"
                            disabled={isLoading}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                            Description <span className="text-gray-400 font-normal">(optional)</span>
                        </label>
                        <Textarea
                            value={newTicket.description}
                            onChange={(e) => setNewTicket({ ...newTicket, description: e.target.value })}
                            placeholder="Add more details..."
                            disabled={isLoading}
                            className="min-h-[120px]"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                            Reference Link <span className="text-gray-400 font-normal">(optional)</span>
                        </label>
                        <Input
                            type="url"
                            value={newTicket.reference}
                            onChange={(e) => setNewTicket({ ...newTicket, reference: e.target.value })}
                            placeholder="https://..."
                            disabled={isLoading}
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <Select
                            label="Status"
                            value={newTicket.status}
                            onValueChange={(value) => setNewTicket({ ...newTicket, status: value })}
                            disabled={isLoading}
                            options={[
                                { value: 'Open', label: 'Open' },
                                { value: 'In Progress', label: 'In Progress' },
                                { value: 'Closed', label: 'Closed' },
                            ]}
                        />
                        <Select
                            label="Priority"
                            value={newTicket.priority}
                            onValueChange={(value) => setNewTicket({ ...newTicket, priority: value })}
                            disabled={isLoading}
                            options={[
                                { value: 'Low', label: 'Low' },
                                { value: 'Medium', label: 'Medium' },
                                { value: 'High', label: 'High' },
                            ]}
                        />
                    </div>
                </div>

                <div className="pt-4 flex gap-4 hidden md:flex">
                     <Button
                        onClick={() => router.push('/dashboard/tickets')}
                        disabled={isLoading}
                        variant="outline"
                        className="flex-1 py-3"
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleCreateTicket}
                        disabled={isLoading}
                        className="flex-1 py-3 bg-green-600 hover:bg-green-700"
                    >
                        {isLoading ? 'Creating...' : 'Create Ticket'}
                    </Button>
                </div>
            </div>
        </div>
      </div>

       {/* Mobile Actions - Pushed to the form instead of fixed bottom */}
       <div className="md:hidden px-0 -mt-3 pb-8">
            <div className="flex gap-4">
                <Button
                    onClick={() => router.push('/dashboard/tickets')}
                    disabled={isLoading}
                    variant="outline"
                    className="flex-1 py-3"
                    >
                        Cancel
                    </Button>
                <Button
                    onClick={handleCreateTicket}
                    disabled={isLoading}
                    className="flex-1 py-3 bg-green-600 hover:bg-green-700"
                >
                    {isLoading ? 'Creating...' : 'Create Ticket'}
                </Button>
            </div>
       </div>

    </div>
  );
}
