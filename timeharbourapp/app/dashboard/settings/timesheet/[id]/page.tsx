'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { DateTime } from 'luxon';
import {
  ArrowLeft, Clock, Calendar, ExternalLink, Pencil, Save, X, Image as ImageIcon, Link2, FileText, Trash2, Paperclip,
} from 'lucide-react';
import { Button, Input, Textarea, Select, Badge, Text, SmallMuted } from '@mieweb/ui';
import { db, type DexieWorkSession, type SessionAttachment } from '@/TimeharborAPI/db';
import { formatDurationMs } from '@/lib/formatDuration';

/* ── options ───────────────────────────────────────────── */
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

/* ── types ─────────────────────────────────────────────── */
interface EntryData {
  sessionId: string;
  type: 'in' | 'out';
  title: string;
  tickets: string;
  date: string;
  startTime: string;
  endTime: string;
  description: string;
  link: string;
  attachments: SessionAttachment[];
  flag: string;
  status: string;
  durationMs: number;
}

function sessionToEntry(session: DexieWorkSession, type: 'in' | 'out'): EntryData {
  const tickets = session.ticketBreakdown?.map(t => t.ticketTitle).filter(Boolean).join(', ') || '';
  const clockInDT = DateTime.fromMillis(session.clockIn);
  const clockOutDT = session.clockOut ? DateTime.fromMillis(session.clockOut) : null;

  return {
    sessionId: session.id,
    type,
    title: type === 'in' ? 'Work Session Started' : 'Session Ended',
    tickets,
    date: clockInDT.toFormat('yyyy-MM-dd'),
    startTime: clockInDT.toFormat('HH:mm'),
    endTime: clockOutDT?.toFormat('HH:mm') || '',
    description: session.comment || '',
    link: session.link || '',
    attachments: session.attachments || [],
    flag: (session as any).flag || 'none',
    status: session.clockOut ? 'Completed' : 'Active',
    durationMs: session.netWorkMs,
  };
}

/* ── component ─────────────────────────────────────────── */
export default function TimesheetEntryPage() {
  const router = useRouter();
  const params = useParams();
  const entryId = params.id as string; // Format: {sessionId}-in or {sessionId}-out

  const [entry, setEntry] = useState<EntryData | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<EntryData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [editAttachments, setEditAttachments] = useState<SessionAttachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ── load session from Dexie ─────────────────────────── */
  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        // entryId format: {sessionId}-in or {sessionId}-out
        const lastDash = entryId.lastIndexOf('-');
        const sessionId = entryId.substring(0, lastDash);
        const type = entryId.substring(lastDash + 1) as 'in' | 'out';

        const session = await db.workSessions.get(sessionId);
        if (session) {
          const data = sessionToEntry(session, type);
          setEntry(data);
          setDraft(data);
          setEditAttachments(data.attachments);
        }
      } catch (err) {
        console.error('Failed to load entry:', err);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [entryId]);

  /* ── edit helpers ────────────────────────────────────── */
  const startEditing = () => {
    setIsEditing(true);
    setDraft(entry ? { ...entry } : null);
    setSaveMessage(null);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setDraft(entry ? { ...entry } : null);
    setEditAttachments(entry?.attachments || []);
    setSaveMessage(null);
  };

  const updateDraft = (patch: Partial<EntryData>) => {
    setDraft(prev => prev ? { ...prev, ...patch } : prev);
  };

  const handleImagePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onload = () => {
            const dataUrl = reader.result as string;
            const mime = file.type || 'image/png';
            setEditAttachments(prev => [...prev, {
              name: file.name || `pasted-image.${mime.split('/')[1] || 'png'}`,
              type: mime,
              dataUrl,
            }]);
          };
          reader.readAsDataURL(file);
        }
      }
    }
  }, []);

  const handleFileSelect = useCallback((files: FileList | null) => {
    if (!files) return;
    for (const file of Array.from(files)) {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        setEditAttachments(prev => [...prev, {
          name: file.name,
          type: file.type || 'application/octet-stream',
          dataUrl,
        }]);
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const removeAttachment = (index: number) => {
    setEditAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!draft || !entry) return;
    try {
      await db.workSessions.update(entry.sessionId, {
        comment: draft.description,
        link: draft.link || undefined,
        attachments: editAttachments.length > 0 ? editAttachments : undefined,
        updatedAt: Date.now(),
        _dirty: 1,
      });

      const updated = { ...draft, attachments: editAttachments };
      setEntry(updated);
      setDraft(updated);
      setIsEditing(false);
      setSaveMessage({ type: 'success', text: 'Entry updated successfully.' });
    } catch (err) {
      console.error('Failed to save entry:', err);
      setSaveMessage({ type: 'error', text: 'Failed to save entry.' });
    }
  };

  /* ── format helpers ──────────────────────────────────── */
  const fmtTime = (time: string) => {
    if (!time) return '—';
    const [h, m] = time.split(':').map(Number);
    const dt = DateTime.now().set({ hour: h, minute: m });
    return dt.toFormat('h:mm a');
  };

  const fmtDate = (date: string) => {
    return DateTime.fromFormat(date, 'yyyy-MM-dd').toFormat('EEEE, MMMM d, yyyy');
  };

  /* ── render ──────────────────────────────────────────── */
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full mb-4" />
        <SmallMuted>Loading entry...</SmallMuted>
      </div>
    );
  }

  if (!entry || !draft) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <SmallMuted>Entry not found.</SmallMuted>
        <Button variant="outline" onClick={() => router.push('/dashboard/settings/timesheet')}>
          <ArrowLeft className="w-4 h-4" /> Back to Timesheet
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mr-auto px-1 py-2 md:px-6 md:py-4 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-end">
        {!isEditing ? (
          <Button variant="outline" size="sm" onClick={startEditing}>
            <Pencil className="w-3.5 h-3.5" /> Edit
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={cancelEditing}>
              <X className="w-3.5 h-3.5" /> Cancel
            </Button>
            <Button size="sm" onClick={handleSave}>
              <Save className="w-3.5 h-3.5" /> Save
            </Button>
          </div>
        )}
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

      {/* Title & Status */}
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Text size="xl" weight="bold">{entry.title}</Text>
            {entry.tickets && (
              <Text size="sm" className="text-primary-600 dark:text-primary-400 mt-1">
                {entry.tickets}
              </Text>
            )}
          </div>
          <Badge variant={badgeVariantForStatus(isEditing ? draft.status : entry.status)} size="sm">
            {isEditing ? draft.status : entry.status}
          </Badge>
        </div>

        {/* Time Info */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="space-y-1">
            <SmallMuted className="flex items-center gap-1 text-xs font-medium uppercase tracking-wider">
              <Calendar className="w-3 h-3" /> Date
            </SmallMuted>
            {isEditing ? (
              <Input type="date" value={draft.date} onChange={e => updateDraft({ date: e.target.value })} />
            ) : (
              <Text size="sm" weight="medium">{fmtDate(entry.date)}</Text>
            )}
          </div>
          <div className="space-y-1">
            <SmallMuted className="flex items-center gap-1 text-xs font-medium uppercase tracking-wider">
              <Clock className="w-3 h-3" /> Start
            </SmallMuted>
            {isEditing ? (
              <Input type="time" value={draft.startTime} onChange={e => updateDraft({ startTime: e.target.value })} />
            ) : (
              <Text size="sm" weight="medium">{fmtTime(entry.startTime)}</Text>
            )}
          </div>
          <div className="space-y-1">
            <SmallMuted className="flex items-center gap-1 text-xs font-medium uppercase tracking-wider">
              <Clock className="w-3 h-3" /> End
            </SmallMuted>
            {isEditing ? (
              <Input type="time" value={draft.endTime} onChange={e => updateDraft({ endTime: e.target.value })} />
            ) : (
              <Text size="sm" weight="medium">{fmtTime(entry.endTime)}</Text>
            )}
          </div>
          <div className="space-y-1">
            <SmallMuted className="flex items-center gap-1 text-xs font-medium uppercase tracking-wider">
              <Clock className="w-3 h-3" /> Duration
            </SmallMuted>
            <Text size="sm" weight="bold" className="text-primary-600 dark:text-primary-400">
              {formatDurationMs(entry.durationMs)}
            </Text>
          </div>
        </div>
      </div>

      <hr className="border-gray-200 dark:border-gray-700" />

      {/* Description */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-muted-foreground" />
          <Text size="sm" weight="semibold">Description</Text>
        </div>
        {isEditing ? (
          <Textarea
            value={draft.description}
            onChange={e => updateDraft({ description: e.target.value })}
            onPaste={handleImagePaste}
            placeholder="What did you work on?"
            rows={4}
          />
        ) : entry.description ? (
          <Text size="sm" className="whitespace-pre-wrap text-gray-700 dark:text-gray-300">
            {entry.description}
          </Text>
        ) : (
          <SmallMuted className="italic">No description added.</SmallMuted>
        )}
      </div>

      {/* Link */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Link2 className="w-4 h-4 text-muted-foreground" />
          <Text size="sm" weight="semibold">Reference Link</Text>
        </div>
        {isEditing ? (
          <Input
            type="url"
            value={draft.link}
            onChange={e => updateDraft({ link: e.target.value })}
            onPaste={(e) => {
              const text = e.clipboardData?.getData('text');
              if (text) {
                e.preventDefault();
                updateDraft({ link: text.trim() });
              }
            }}
            placeholder="Paste a YouTube, Pulse, or GitHub link..."
          />
        ) : entry.link ? (
          <a
            href={entry.link}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-primary-600 dark:text-primary-400 hover:underline break-all"
          >
            <ExternalLink className="w-4 h-4 shrink-0" />
            {entry.link}
          </a>
        ) : (
          <SmallMuted className="italic">No link attached.</SmallMuted>
        )}
      </div>

      {/* Attachments */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <ImageIcon className="w-4 h-4 text-muted-foreground" />
          <Text size="sm" weight="semibold">Attachments</Text>
        </div>
        {editAttachments.length > 0 ? (
          <div className="space-y-3">
            {/* Image attachments */}
            {editAttachments.filter(a => a.type.startsWith('image/')).length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {editAttachments.map((att, i) =>
                  att.type.startsWith('image/') ? (
                    <div key={i} className="relative group aspect-square">
                      <img
                        src={att.dataUrl}
                        alt={att.name}
                        className="w-full h-full object-cover rounded-lg border border-gray-200 dark:border-gray-700"
                      />
                      {isEditing && (
                        <button
                          type="button"
                          onClick={() => removeAttachment(i)}
                          className="absolute top-1 right-1 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          aria-label="Remove attachment"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ) : null
                )}
              </div>
            )}
            {/* Document attachments */}
            {editAttachments.filter(a => !a.type.startsWith('image/')).length > 0 && (
              <div className="flex flex-wrap gap-2">
                {editAttachments.map((att, i) =>
                  !att.type.startsWith('image/') ? (
                    <div key={i} className="relative group flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                      <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                      <a href={att.dataUrl} download={att.name} className="text-sm hover:underline truncate max-w-[200px]">{att.name}</a>
                      {isEditing && (
                        <button
                          type="button"
                          onClick={() => removeAttachment(i)}
                          className="w-4 h-4 text-red-500 shrink-0"
                          aria-label="Remove file"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  ) : null
                )}
              </div>
            )}
          </div>
        ) : (
          <SmallMuted className="italic">No attachments.</SmallMuted>
        )}
        {isEditing && (
          <div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Paperclip className="w-3.5 h-3.5" /> Attach image or document
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf,.doc,.docx,.txt,.md"
              multiple
              className="hidden"
              onChange={(e) => {
                handleFileSelect(e.target.files);
                if (fileInputRef.current) fileInputRef.current.value = '';
              }}
            />
          </div>
        )}
      </div>

      {/* Flag & Status (edit mode) */}
      {isEditing && (
        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Flag"
            options={FLAG_OPTIONS}
            value={draft.flag}
            onValueChange={v => updateDraft({ flag: v })}
          />
          <Select
            label="Status"
            options={STATUS_OPTIONS}
            value={draft.status}
            onValueChange={v => updateDraft({ status: v })}
          />
        </div>
      )}

      {/* Flag & Status (view mode) */}
      {!isEditing && (entry.flag !== 'none' || entry.status) && (
        <div className="flex flex-wrap gap-2">
          {entry.flag && entry.flag !== 'none' && (
            <Badge variant="outline" size="sm">
              {FLAG_OPTIONS.find(f => f.value === entry.flag)?.label ?? entry.flag}
            </Badge>
          )}
        </div>
      )}

      {/* Ticket Breakdown */}
      {entry.tickets && (
        <div className="space-y-2">
          <Text size="sm" weight="semibold">Tickets Worked On</Text>
          <div className="flex flex-wrap gap-2">
            {entry.tickets.split(', ').map((t, i) => (
              <Badge key={i} variant="secondary" size="sm">{t}</Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
