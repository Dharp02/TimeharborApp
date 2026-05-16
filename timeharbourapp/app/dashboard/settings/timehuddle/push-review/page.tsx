'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Upload, CheckSquare, Square } from 'lucide-react';
import { Button, Badge, Text, SmallMuted, Input } from '@mieweb/ui';
import { db } from '@/TimeharborAPI/db';
import { pushTicketToTimehuddle } from '@/TimeharborAPI/timehuddle';
import { formatDuration } from '@timeharbor/time-engine';
import type { Ticket } from '@/TimeharborAPI/tickets';

interface PushRow {
  ticket: Ticket;
  pendingMs: number;
  status: string;
  description: string;
  github: string;
  selected: boolean;
}

const TH_STATUS_MAP: Record<string, string> = {
  Open: 'open',
  'In Progress': 'in-progress',
  Closed: 'closed',
};

export default function PushReviewPage() {
  const router = useRouter();
  const [rows, setRows] = useState<PushRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPushing, setIsPushing] = useState(false);
  const [pushed, setPushed] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadRows = useCallback(async () => {
    setIsLoading(true);
    try {
      const tickets = await db.tickets
        .filter((t: any) => t.source === 'timehuddle' && !t._deleted && t._disconnected !== 1)
        .toArray();

      const pending: PushRow[] = tickets
        .map((t: any) => ({
          ticket: t as Ticket,
          pendingMs: Math.max(0, (t.trackedMs ?? 0) - (t._pushedMs ?? 0)),
          status: TH_STATUS_MAP[t.status] ?? 'open',
          description: t.description ?? '',
          github: t.link ?? '',
          selected: true,
        }))
        .filter((r) => r.pendingMs > 0);

      setRows(pending);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  const toggleSelect = (idx: number) => {
    setRows((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, selected: !r.selected } : r))
    );
  };

  const toggleSelectAll = () => {
    const allSelected = rows.every((r) => r.selected);
    setRows((prev) => prev.map((r) => ({ ...r, selected: !allSelected })));
  };

  const updateRow = (idx: number, patch: Partial<PushRow>) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };

  const handlePushSelected = async () => {
    const selected = rows.filter((r) => r.selected);
    if (selected.length === 0) return;

    setIsPushing(true);
    setErrorMsg(null);
    const succeeded: string[] = [];

    for (const row of selected) {
      try {
        await pushTicketToTimehuddle(row.ticket.id, {
          addMs: row.pendingMs > 0 ? row.pendingMs : undefined,
          status: row.status || undefined,
          description: row.description || undefined,
          github: row.github || undefined,
        });
        succeeded.push(row.ticket.id);
      } catch (err) {
        console.error(`Failed to push ${row.ticket.id}:`, err);
        setErrorMsg(`Failed to push "${row.ticket.title}". Others may have succeeded.`);
      }
    }

    setPushed((prev) => [...prev, ...succeeded]);
    // Remove pushed rows from the list
    setRows((prev) => prev.filter((r) => !succeeded.includes(r.ticket.id)));
    setIsPushing(false);
  };

  const selectedCount = rows.filter((r) => r.selected).length;

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-4">
        <button
          onClick={() => router.back()}
          className="p-2 rounded-full hover:bg-muted transition-colors"
          aria-label="Go back"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold">Review Pending Work</h1>
          <SmallMuted>Push tracked time &amp; updates to TimeHuddle</SmallMuted>
        </div>
      </div>

      <div className="px-4 space-y-4">
        {isLoading ? (
          <SmallMuted>Loading tickets…</SmallMuted>
        ) : rows.length === 0 && pushed.length === 0 ? (
          <div className="rounded-xl border border-border bg-muted/30 p-6 text-center space-y-2">
            <Text className="font-semibold">All caught up!</Text>
            <SmallMuted>No pending work to push to TimeHuddle.</SmallMuted>
          </div>
        ) : (
          <>
            {rows.length > 0 && (
              <>
                {/* Select-all row */}
                <div className="flex items-center justify-between">
                  <button
                    onClick={toggleSelectAll}
                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={rows.every((r) => r.selected) ? 'Deselect all' : 'Select all'}
                  >
                    {rows.every((r) => r.selected) ? (
                      <CheckSquare className="w-4 h-4" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                    {rows.every((r) => r.selected) ? 'Deselect all' : 'Select all'}
                  </button>
                  <SmallMuted>{rows.length} ticket{rows.length !== 1 ? 's' : ''} pending</SmallMuted>
                </div>

                {/* Ticket rows */}
                <ul className="space-y-3" aria-label="Pending push tickets">
                  {rows.map((row, idx) => (
                    <li
                      key={row.ticket.id}
                      className={`rounded-xl border bg-card p-4 space-y-3 transition-opacity ${
                        row.selected ? '' : 'opacity-50'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <button
                          onClick={() => toggleSelect(idx)}
                          className="mt-1 shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                          aria-label={row.selected ? 'Deselect ticket' : 'Select ticket'}
                        >
                          {row.selected ? (
                            <CheckSquare className="w-4 h-4 text-primary-600" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                        <div className="flex-1 min-w-0 space-y-1">
                          <Text className="font-semibold leading-tight">{row.ticket.title}</Text>
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="warning" size="sm">
                              {row.ticket.teamName ?? 'Team'}
                            </Badge>
                            <SmallMuted className="font-mono text-xs">
                              +{formatDuration(row.pendingMs)} to push
                            </SmallMuted>
                          </div>
                        </div>
                      </div>

                      {row.selected && (
                        <div className="space-y-2 pl-7">
                          <div>
                            <label className="text-xs text-muted-foreground mb-1 block">Status</label>
                            <select
                              value={row.status}
                              onChange={(e) => updateRow(idx, { status: e.target.value })}
                              className="w-full text-sm border border-input rounded-md px-2 py-1 bg-background"
                              aria-label="Status to push"
                            >
                              <option value="open">Open</option>
                              <option value="in-progress">In Progress</option>
                              <option value="blocked">Blocked</option>
                              <option value="reviewed">Reviewed</option>
                              <option value="closed">Closed</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground mb-1 block">Description (optional)</label>
                            <Input
                              value={row.description}
                              onChange={(e) => updateRow(idx, { description: e.target.value })}
                              placeholder="Leave blank to keep existing"
                              className="text-sm"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground mb-1 block">GitHub URL / issue (optional)</label>
                            <Input
                              value={row.github}
                              onChange={(e) => updateRow(idx, { github: e.target.value })}
                              placeholder="Leave blank to keep existing"
                              className="text-sm"
                            />
                          </div>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>

                {/* Push button */}
                <Button
                  onClick={handlePushSelected}
                  disabled={isPushing || selectedCount === 0}
                  isLoading={isPushing}
                  loadingText="Pushing…"
                  className="w-full"
                  aria-label={`Push ${selectedCount} selected ticket${selectedCount !== 1 ? 's' : ''} to TimeHuddle`}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Push {selectedCount} Selected
                </Button>
              </>
            )}

            {pushed.length > 0 && (
              <div className="rounded-xl border border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30 p-4">
                <Text className="text-sm text-green-700 dark:text-green-400 font-semibold">
                  ✓ {pushed.length} ticket{pushed.length !== 1 ? 's' : ''} pushed successfully
                </Text>
              </div>
            )}

            {errorMsg && (
              <div className="rounded-xl border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30 p-4">
                <Text className="text-sm text-red-700 dark:text-red-400">{errorMsg}</Text>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
