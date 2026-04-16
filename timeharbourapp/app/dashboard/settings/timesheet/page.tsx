'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { DateRangePickerWithPresets } from '@/components/DateRangePickerWithPresets';
import { DateTime } from 'luxon';
import { dateFilterPresets, resolveRange, type LuxonDateRange } from '@/lib/datePresets';
import { Activity, fetchActivitiesByDateRange, getTimesheetTotals, TimesheetDayTotal } from '@/TimeharborAPI/dashboard';
import { formatDurationMs } from '@/lib/formatDuration';
import {
  Clock, Calendar, Pencil, X, Check, Plus, Trash2, ChevronDown, ChevronRight,
} from 'lucide-react';
import { useRefresh } from '../../../../contexts/RefreshContext';
import {
  Button, Input, Select, Badge,
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@mieweb/ui';
import TimesheetEntryClient from './[id]/TimesheetEntryClient';

/* ── flag / status options ─────────────────────────────── */
const FLAG_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'billable', label: 'Billable' },
  { value: 'non-billable', label: 'Non-Billable' },
  { value: 'overtime', label: 'Overtime' },
  { value: 'holiday', label: 'Holiday' },
];

const STATUS_OPTIONS = [
  { value: 'Active', label: 'Active' },
  { value: 'Completed', label: 'Completed' },
  { value: 'Pending', label: 'Pending' },
];

const badgeVariantForStatus = (status?: string) => {
  switch (status) {
    case 'Active': return 'success' as const;
    case 'Completed': return 'default' as const;
    case 'Pending': return 'warning' as const;
    default: return 'outline' as const;
  }
};

/* ── editable row state ────────────────────────────────── */
interface EditState {
  date: string;
  startTime: string;
  endTime: string;
  ticket: string;
  description: string;
  flag: string;
  status: string;
}

const toEditState = (a: Activity): EditState => ({
  date: DateTime.fromISO(a.startTime).toFormat('yyyy-MM-dd'),
  startTime: DateTime.fromISO(a.startTime).toFormat('HH:mm'),
  endTime: a.endTime ? DateTime.fromISO(a.endTime).toFormat('HH:mm') : '',
  ticket: a.subtitle || '',
  description: a.description || '',
  flag: (a.metadata?.flag as string) || 'none',
  status: a.status || 'Active',
});

export default function TimesheetPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const entryId = searchParams.get('entryId');
  const { register, lastRefreshed } = useRefresh();

  /* ── filter state ───────────────────────────────────── */
  const [dateRange, setDateRange] = useState<LuxonDateRange>({
    from: DateTime.now().startOf('day'),
    to: DateTime.now().endOf('day'),
  });
  const [preset, setPreset] = useState('today');

  /* ── data state ─────────────────────────────────────── */
  const [activities, setActivities] = useState<Activity[]>([]);
  const [timesheetTotals, setTimesheetTotals] = useState<TimesheetDayTotal[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  /* ── edit state ─────────────────────────────────────── */
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<EditState | null>(null);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  /* ── data fetching ──────────────────────────────────── */
  useEffect(() => {
    if (entryId) return; // skip fetching when showing entry detail
    if (!dateRange.from || !dateRange.to) return;
    const from = dateRange.from.toISODate();
    const to = dateRange.to.toISODate();
    if (!from || !to) return;

    const loadData = async () => {
      setIsLoading(true);
      try {
        const [acts, totals] = await Promise.all([
          fetchActivitiesByDateRange('', dateRange.from!.toISO() || '', dateRange.to!.toISO() || ''),
          getTimesheetTotals(from, to),
        ]);
        setActivities(acts);
        setTimesheetTotals(totals);
      } catch (e) {
        console.error('Failed to load timesheet data:', e);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
    const unregister = register(loadData);
    return unregister;
  }, [dateRange, entryId, lastRefreshed, register]);

  const handleRangeChange = (range: { start: Date | null; end: Date | null }, presetKey?: string) => {
    setDateRange(resolveRange(range, presetKey));
    setPreset(presetKey || '');
    setEditingId(null);
  };

  /* ── sorted entries ─────────────────────────────────── */
  const sortedActivities = useMemo(() => {
    return [...activities].sort(
      (a, b) => DateTime.fromISO(b.startTime).toMillis() - DateTime.fromISO(a.startTime).toMillis(),
    );
  }, [activities]);

  const totalMs = useMemo(() => timesheetTotals.reduce((s, t) => s + t.totalMs, 0), [timesheetTotals]);

  /* ── group activities by day (Mon–Sun) ──────────────── */
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());

  const groupedByDay = useMemo(() => {
    const groups: { dateKey: string; dayName: string; fullDate: string; activities: Activity[]; totalMs: number }[] = [];
    const map = new Map<string, Activity[]>();

    for (const a of sortedActivities) {
      const dt = DateTime.fromISO(a.startTime);
      const key = dt.toFormat('yyyy-MM-dd');
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    }

    // Sort date keys descending (most recent first)
    const sortedKeys = [...map.keys()].sort((a, b) => b.localeCompare(a));

    for (const key of sortedKeys) {
      const acts = map.get(key)!;
      const dt = DateTime.fromFormat(key, 'yyyy-MM-dd');
      const dayTotal = timesheetTotals.find(t => t.date === key);
      groups.push({
        dateKey: key,
        dayName: dt.toFormat('EEEE'),
        fullDate: dt.toFormat('MMM d, yyyy'),
        activities: acts,
        totalMs: dayTotal?.totalMs ?? 0,
      });
    }

    return groups;
  }, [sortedActivities, timesheetTotals]);

  // Auto-expand today's entry on first load
  useEffect(() => {
    if (groupedByDay.length > 0 && expandedDays.size === 0) {
      const todayKey = DateTime.now().toFormat('yyyy-MM-dd');
      const firstKey = groupedByDay[0].dateKey;
      setExpandedDays(new Set([todayKey, firstKey]));
    }
  }, [groupedByDay]);

  const toggleDay = (dateKey: string) => {
    setExpandedDays(prev => {
      const next = new Set(prev);
      if (next.has(dateKey)) next.delete(dateKey);
      else next.add(dateKey);
      return next;
    });
  };

  /* ── edit helpers ───────────────────────────────────── */
  const startEdit = (a: Activity) => {
    setEditingId(a.id);
    setEditDraft(toEditState(a));
    setSaveMessage(null);
  };
  const cancelEdit = () => { setEditingId(null); setEditDraft(null); };
  const updateDraft = (patch: Partial<EditState>) => setEditDraft(prev => prev ? { ...prev, ...patch } : prev);

  const saveEdit = () => {
    if (!editDraft || !editingId) return;
    // TODO: Wire up to backend API
    setActivities(prev =>
      prev.map(a => {
        if (a.id !== editingId) return a;
        const start = DateTime.fromFormat(`${editDraft.date} ${editDraft.startTime}`, 'yyyy-MM-dd HH:mm');
        const end = editDraft.endTime
          ? DateTime.fromFormat(`${editDraft.date} ${editDraft.endTime}`, 'yyyy-MM-dd HH:mm')
          : undefined;
        return {
          ...a,
          startTime: start.toISO() || a.startTime,
          endTime: end?.toISO() ?? a.endTime,
          subtitle: editDraft.ticket,
          description: editDraft.description,
          status: editDraft.status as Activity['status'],
          metadata: { ...a.metadata, flag: editDraft.flag },
        };
      }),
    );
    setSaveMessage({ type: 'success', text: 'Entry updated locally. Backend sync coming soon.' });
    setEditingId(null);
    setEditDraft(null);
  };

  const deleteEntry = (id: string) => {
    // TODO: Wire up to backend API
    setActivities(prev => prev.filter(a => a.id !== id));
    if (editingId === id) cancelEdit();
    setSaveMessage({ type: 'success', text: 'Entry removed locally.' });
  };

  const addEntry = () => {
    const now = DateTime.now();
    const newEntry: Activity = {
      id: `new-${Date.now()}`,
      type: 'MANUAL',
      title: 'Manual Entry',
      startTime: now.toISO() || '',
      status: 'Pending',
      metadata: { flag: 'none' },
    };
    setActivities(prev => [newEntry, ...prev]);
    startEdit(newEntry);
  };

  /* ── format helpers ─────────────────────────────────── */
  const fmtTime = (iso: string) => DateTime.fromISO(iso).toFormat('h:mm a');
  const fmtDate = (iso: string) => DateTime.fromISO(iso).toFormat('MMM d, yyyy');

  /* ── render ─────────────────────────────────────────── */

  // When ?entryId=xxx is present, render the detail view instead of the list.
  // This avoids relying on the [id] dynamic route which is not pre-rendered
  // in Capacitor static-export builds (output: 'export').
  if (entryId) {
    return <TimesheetEntryClient entryIdProp={entryId} />;
  }

  return (
    <div className="max-w-7xl mx-auto px-0 py-2 space-y-4">
      {/* Filter Bar */}
      <div className="sticky top-[102px] lg:top-16 z-20 bg-background -mx-4 px-4 py-2 -mt-2 shadow-sm shadow-background">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <DateRangePickerWithPresets
            value={{ start: dateRange.from.toJSDate(), end: dateRange.to.toJSDate() }}
            onChange={handleRangeChange}
            activePreset={preset}
            presets={dateFilterPresets}
            variant="responsive"
            className="w-full md:w-auto"
          />
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground font-medium">Total:</span>
              <span className="text-base font-bold text-gray-900 dark:text-white">
                {formatDurationMs(totalMs)}
              </span>
            </div>
            <Button onClick={addEntry} aria-label="Add timesheet entry">
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Add Entry</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Feedback */}
      {saveMessage && (
        <div
          role="alert"
          className={`p-3 rounded-lg text-sm ${
            saveMessage.type === 'success'
              ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
              : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
          }`}
        >
          {saveMessage.text}
        </div>
      )}

      {/* Day-grouped entries */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-muted-foreground">Loading timesheet data…</p>
        </div>
      ) : groupedByDay.length === 0 ? (
        <div className="text-center py-12">
          <Calendar className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">No entries found</h3>
          <p className="text-muted-foreground">Adjust the date range or add a new entry.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {groupedByDay.map(({ dateKey, dayName, fullDate, activities: dayActivities, totalMs: dayMs }) => {
            const isExpanded = expandedDays.has(dateKey);
            const isToday = dateKey === DateTime.now().toFormat('yyyy-MM-dd');
            return (
              <div key={dateKey} className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                {/* Day header – accordion toggle */}
                <button
                  type="button"
                  onClick={() => toggleDay(dateKey)}
                  className={`w-full flex items-center justify-between px-4 py-3 transition-colors ${
                    isExpanded
                      ? 'bg-primary-50 dark:bg-primary-900/20'
                      : 'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                  }`}
                  aria-expanded={isExpanded}
                  aria-controls={`day-${dateKey}`}
                >
                  <div className="flex items-center gap-3">
                    {isExpanded
                      ? <ChevronDown className="w-5 h-5 text-muted-foreground" />
                      : <ChevronRight className="w-5 h-5 text-muted-foreground" />}
                    <div className="text-left">
                      <span className="font-semibold text-foreground">
                        {dayName}
                      </span>
                      {isToday && (
                        <span className="ml-2 text-xs font-medium px-2 py-0.5 bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-400 rounded-full">
                          Today
                        </span>
                      )}
                      <p className="text-xs text-muted-foreground">{fullDate}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">
                      {dayActivities.length} {dayActivities.length === 1 ? 'entry' : 'entries'}
                    </span>
                    <span className="text-sm font-bold text-foreground">
                      {formatDurationMs(dayMs)}
                    </span>
                  </div>
                </button>

                {/* Day entries – collapsible */}
                {isExpanded && (
                  <div id={`day-${dateKey}`} className="border-t border-gray-200 dark:border-gray-700">
                    {/* Desktop table */}
                    <div className="hidden md:block overflow-x-auto">
                      <Table className="w-full table-fixed">
                        <colgroup>
                          <col className="w-[12%]" />
                          <col className="w-[12%]" />
                          <col className="w-[18%]" />
                          <col className="w-[26%]" />
                          <col className="w-[12%]" />
                          <col className="w-[10%]" />
                          <col className="w-[10%]" />
                        </colgroup>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Start</TableHead>
                            <TableHead>End</TableHead>
                            <TableHead>Ticket</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>Flag</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {dayActivities.map(a => {
                            const isEditing = editingId === a.id;
                            return (
                              <TableRow key={a.id}>
                                {isEditing && editDraft ? (
                                  <>
                                    <TableCell>
                                      <Input type="time" value={editDraft.startTime} onChange={e => updateDraft({ startTime: e.target.value })} className="w-full" />
                                    </TableCell>
                                    <TableCell>
                                      <Input type="time" value={editDraft.endTime} onChange={e => updateDraft({ endTime: e.target.value })} className="w-full" />
                                    </TableCell>
                                    <TableCell>
                                      <Input value={editDraft.ticket} onChange={e => updateDraft({ ticket: e.target.value })} placeholder="TKT-123" className="w-full" />
                                    </TableCell>
                                    <TableCell>
                                      <Input value={editDraft.description} onChange={e => updateDraft({ description: e.target.value })} placeholder="What did you work on?" className="w-full" />
                                    </TableCell>
                                    <TableCell>
                                      <Select options={FLAG_OPTIONS} value={editDraft.flag} onValueChange={v => updateDraft({ flag: v })} placeholder="Flag" hideLabel />
                                    </TableCell>
                                    <TableCell>
                                      <Select options={STATUS_OPTIONS} value={editDraft.status} onValueChange={v => updateDraft({ status: v })} placeholder="Status" hideLabel />
                                    </TableCell>
                                    <TableCell>
                                      <div className="flex justify-end gap-1">
                                        <Button variant="ghost" onClick={saveEdit} aria-label="Save changes"><Check className="w-4 h-4 text-green-600" /></Button>
                                        <Button variant="ghost" onClick={cancelEdit} aria-label="Cancel editing"><X className="w-4 h-4 text-gray-500" /></Button>
                                      </div>
                                    </TableCell>
                                  </>
                                ) : (
                                  <>
                                    <TableCell className="whitespace-nowrap cursor-pointer" onClick={() => router.push(`/dashboard/settings/timesheet/?entryId=${a.id}`)}>{fmtTime(a.startTime)}</TableCell>
                                    <TableCell className="whitespace-nowrap cursor-pointer" onClick={() => router.push(`/dashboard/settings/timesheet/?entryId=${a.id}`)}>{a.endTime ? fmtTime(a.endTime) : '—'}</TableCell>
                                    <TableCell className="text-primary-600 dark:text-primary-400 font-medium cursor-pointer" onClick={() => router.push(`/dashboard/settings/timesheet/?entryId=${a.id}`)}>{a.subtitle || '—'}</TableCell>
                                    <TableCell className="truncate cursor-pointer" onClick={() => router.push(`/dashboard/settings/timesheet/?entryId=${a.id}`)}>{a.description || a.title}</TableCell>
                                    <TableCell>
                                      {a.metadata?.flag && a.metadata.flag !== 'none' ? (
                                        <Badge variant="outline" size="sm">{FLAG_OPTIONS.find(f => f.value === a.metadata?.flag)?.label ?? a.metadata.flag}</Badge>
                                      ) : '—'}
                                    </TableCell>
                                    <TableCell>
                                      <Badge variant={badgeVariantForStatus(a.status)} size="sm">{a.status || '—'}</Badge>
                                    </TableCell>
                                    <TableCell>
                                      <div className="flex justify-end gap-1">
                                        <Button variant="ghost" onClick={() => startEdit(a)} aria-label="Edit entry"><Pencil className="w-4 h-4" /></Button>
                                        <Button variant="ghost" onClick={() => deleteEntry(a.id)} aria-label="Delete entry"><Trash2 className="w-4 h-4 text-red-500" /></Button>
                                      </div>
                                    </TableCell>
                                  </>
                                )}
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Mobile cards */}
                    <div className="md:hidden divide-y divide-gray-200 dark:divide-gray-700">
                      {dayActivities.map(a => {
                        const isEditing = editingId === a.id;
                        return (
                          <div
                            key={a.id}
                            className="p-4 space-y-3"
                            onClick={() => !isEditing && router.push(`/dashboard/settings/timesheet/?entryId=${a.id}`)}
                            role={!isEditing ? 'link' : undefined}
                            tabIndex={!isEditing ? 0 : undefined}
                            style={!isEditing ? { cursor: 'pointer' } : undefined}
                          >
                            {isEditing && editDraft ? (
                              <>
                                <div className="grid grid-cols-2 gap-3">
                                  <div>
                                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Start</label>
                                    <Input type="time" value={editDraft.startTime} onChange={e => updateDraft({ startTime: e.target.value })} />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">End</label>
                                    <Input type="time" value={editDraft.endTime} onChange={e => updateDraft({ endTime: e.target.value })} />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Ticket</label>
                                    <Input value={editDraft.ticket} onChange={e => updateDraft({ ticket: e.target.value })} placeholder="TKT-123" />
                                  </div>
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Description</label>
                                  <Input value={editDraft.description} onChange={e => updateDraft({ description: e.target.value })} placeholder="What did you work on?" />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                  <Select options={FLAG_OPTIONS} value={editDraft.flag} onValueChange={v => updateDraft({ flag: v })} label="Flag" />
                                  <Select options={STATUS_OPTIONS} value={editDraft.status} onValueChange={v => updateDraft({ status: v })} label="Status" />
                                </div>
                                <div className="flex justify-end gap-2 pt-1">
                                  <Button variant="outline" onClick={cancelEdit}><X className="w-4 h-4" /> Cancel</Button>
                                  <Button onClick={saveEdit}><Check className="w-4 h-4" /> Save</Button>
                                </div>
                              </>
                            ) : (
                              <>
                                <div className="flex justify-between items-start">
                                  <div>
                                    <p className="font-medium text-foreground">{a.title}</p>
                                    {a.subtitle && <p className="text-sm text-primary-600 dark:text-primary-400">{a.subtitle}</p>}
                                  </div>
                                  <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                                    <button onClick={() => startEdit(a)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700" aria-label="Edit entry">
                                      <Pencil className="w-4 h-4 text-gray-500" />
                                    </button>
                                    <button onClick={() => deleteEntry(a.id)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700" aria-label="Delete entry">
                                      <Trash2 className="w-4 h-4 text-red-500" />
                                    </button>
                                  </div>
                                </div>
                                {a.description && <p className="text-sm text-muted-foreground line-clamp-2">{a.description}</p>}
                                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                  <span>{fmtTime(a.startTime)}{a.endTime ? ` – ${fmtTime(a.endTime)}` : ''}</span>
                                  {a.metadata?.flag && a.metadata.flag !== 'none' && (
                                    <Badge variant="outline" size="sm">{FLAG_OPTIONS.find(f => f.value === a.metadata?.flag)?.label ?? a.metadata.flag}</Badge>
                                  )}
                                  <Badge variant={badgeVariantForStatus(a.status)} size="sm">{a.status || '—'}</Badge>
                                </div>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

