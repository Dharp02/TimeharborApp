'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Ticket as TicketIcon, Check, X } from 'lucide-react';
import { tickets as ticketsApi } from '@/TimeharborAPI';
import type { Ticket, UpdateTicketData } from '@/TimeharborAPI/tickets';
import { Button, Input, Textarea, Select } from '@mieweb/ui';

export default function EditTicketClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const ticketId = searchParams.get('id') || '';

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ticket, setTicket] = useState<Ticket | null>(null);

  const [form, setForm] = useState({
    title: '',
    description: '',
    status: 'Open',
    priority: 'Medium',
    reference: '',
  });

  useEffect(() => {
    if (!ticketId) {
      setError('No ticket ID provided.');
      setIsLoading(false);
      return;
    }

    const load = async () => {
      try {
        const all = await ticketsApi.getAllTickets();
        const found = all.find(t => t.id === ticketId);
        if (found) {
          setTicket(found);
          setForm({
            title: found.title,
            description: found.description || '',
            status: found.status === 'Closed' ? 'Closed' : found.status,
            priority: found.priority,
            reference: found.link || '',
          });
        } else {
          setError('Ticket not found.');
        }
      } catch {
        setError('Failed to load ticket.');
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [ticketId]);

  const handleUpdate = async () => {
    if (!form.title.trim()) {
      setError('Title is required');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const data: UpdateTicketData = {
        title: form.title,
        description: form.description,
        status: form.status as Ticket['status'],
        priority: form.priority as Ticket['priority'],
        link: form.reference,
      };
      await ticketsApi.updatePersonalTicket(ticketId, data);
      router.push('/dashboard/tickets/');
    } catch (err: any) {
      setError(err.message || 'Failed to update ticket.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="p-8 text-center text-muted-foreground">{error || 'Ticket not found.'}</div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900 overflow-y-auto">
      <div className="px-1 pt-0 pb-0 md:p-6 md:pb-6 grow-0">
        <div className="space-y-6">

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-lg text-sm border border-red-200 dark:border-red-800">
              {error}
            </div>
          )}

          <div className="space-y-6">
            <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-2">
              <div className="p-2 bg-[var(--mieweb-primary-100)] dark:bg-[var(--mieweb-primary-900)]/30 rounded-lg">
                <TicketIcon className="w-5 h-5 text-[var(--mieweb-primary-500)]" />
              </div>
              <p className="text-sm">Update ticket details.</p>
            </div>

            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Title
                </label>
                <Input
                  type="text"
                  value={form.title}
                  onChange={e => setForm({ ...form, title: e.target.value })}
                  placeholder="Ticket title"
                  disabled={isSaving}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Description <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <Textarea
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder="Add more details..."
                  disabled={isSaving}
                  className="min-h-30"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Reference Link <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <Input
                  type="url"
                  value={form.reference}
                  onChange={e => setForm({ ...form, reference: e.target.value })}
                  placeholder="https://..."
                  disabled={isSaving}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <Select
                  label="Status"
                  value={form.status}
                  onValueChange={value => setForm({ ...form, status: value })}
                  disabled={isSaving}
                  options={[
                    { value: 'Open', label: 'Open' },
                    { value: 'In Progress', label: 'In Progress' },
                    { value: 'Closed', label: 'Closed' },
                  ]}
                />
                <Select
                  label="Priority"
                  value={form.priority}
                  onValueChange={value => setForm({ ...form, priority: value })}
                  disabled={isSaving}
                  options={[
                    { value: 'Low', label: 'Low' },
                    { value: 'Medium', label: 'Medium' },
                    { value: 'High', label: 'High' },
                  ]}
                />
              </div>
            </div>

            {/* Desktop Actions */}
            <div className="pt-4 hidden md:flex gap-4">
              <Button
                onClick={() => router.push('/dashboard/tickets/')}
                disabled={isSaving}
                variant="outline"
                className="flex-1 py-3"
              >
                <X className="w-4 h-4" /> Cancel
              </Button>
              <Button
                onClick={handleUpdate}
                disabled={isSaving}
                className="flex-1 py-3"
              >
                {isSaving ? 'Updating...' : <><Check className="w-4 h-4" /> Update</>}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Actions */}
      <div className="md:hidden px-0 -mt-3 pb-8">
        <div className="flex gap-4">
          <Button
            onClick={() => router.push('/dashboard/tickets/')}
            disabled={isSaving}
            variant="outline"
            className="flex-1 py-3"
          >
            <X className="w-4 h-4" /> Cancel
          </Button>
          <Button
            onClick={handleUpdate}
            disabled={isSaving}
            className="flex-1 py-3"
          >
            {isSaving ? 'Updating...' : <><Check className="w-4 h-4" /> Update</>}
          </Button>
        </div>
      </div>
    </div>
  );
}
