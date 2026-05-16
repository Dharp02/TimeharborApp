'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import {
  NotebookPen,
  Plus,
  Trash2,
  Search,
  FileText,
} from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  Input,
  Text,
  SmallMuted,
} from '@mieweb/ui';
import { Modal } from '@/components/ui/Modal';
import { db, type DexieNote } from '@/TimeharborAPI/db';
import { getIdentityUUID } from '@/TimeharborAPI/sync/IdentityManager';
import { operationsLog } from '@/TimeharborAPI/OperationsLog';
import { opLogWriter } from '@/TimeharborAPI/sync/OpLogWriter';
import './notepad.scss';

const NoteEditor = dynamic(
  () => import('./NoteEditor') as Promise<{ default: React.ComponentType<{ initialContent: string; onChange: (content: string) => void }> }>,
  { ssr: false }
);

const LEGACY_STORAGE_KEY = 'timeharbor-notepad-notes';

/** One-time migration from localStorage → Dexie */
async function migrateFromLocalStorage(userId: string) {
  if (typeof window === 'undefined') return;
  const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
  if (!raw) return;
  try {
    const legacy: Array<{ id: string; title: string; content: string; updatedAt: string }> = JSON.parse(raw);
    for (const note of legacy) {
      const exists = await db.notes.get(note.id);
      if (!exists) {
        await db.notes.put({
          id: note.id,
          userId,
          title: note.title,
          content: note.content,
          _deleted: false,
          createdAt: note.updatedAt,
          updatedAt: note.updatedAt,
        });
      }
    }
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    // Migration failed — leave localStorage as-is, will retry next mount
  }
}

export default function NotepadPage() {
  const [notes, setNotes] = useState<DexieNote[]>([]);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState<string | null>(null);
  const [showList, setShowList] = useState(true);

  // Load notes from Dexie
  useEffect(() => {
    let cancelled = false;
    const loadNotes = async () => {
      const userId = getIdentityUUID();
      if (!userId || cancelled) return;
      await migrateFromLocalStorage(userId);
      const loaded = await db.notes
        .where('userId')
        .equals(userId)
        .filter(n => !n._deleted)
        .toArray();
      loaded.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      if (!cancelled) {
        setNotes(loaded);
        if (loaded.length > 0) setActiveNoteId(loaded[0].id);
      }
    };
    loadNotes();

    const onSyncComplete = () => loadNotes();
    window.addEventListener('sync-complete', onSyncComplete);
    return () => { cancelled = true; window.removeEventListener('sync-complete', onSyncComplete); };
  }, []);

  const activeNote = notes.find((n) => n.id === activeNoteId) ?? null;

  const filteredNotes = notes.filter((n) =>
    n.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const notifyHeader = useCallback((editing: boolean, title?: string) => {
    window.dispatchEvent(
      new CustomEvent('notepad-header', { detail: editing ? { title: title || 'Untitled' } : null })
    );
  }, []);

  useEffect(() => {
    const handleBack = () => {
      setShowList(true);
      notifyHeader(false);
    };
    window.addEventListener('notepad-back', handleBack);
    return () => window.removeEventListener('notepad-back', handleBack);
  }, [notifyHeader]);

  useEffect(() => {
    return () => notifyHeader(false);
  }, [notifyHeader]);

  const createNote = async () => {
    const newNote: DexieNote = {
      id: crypto.randomUUID(),
      userId: getIdentityUUID(),
      title: 'Untitled',
      content: '',
      _deleted: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await db.notes.put(newNote);
    await opLogWriter.recordCreate('notes', newNote.id, newNote as unknown as Record<string, unknown>);
    await operationsLog.log({ category: 'NOTE', action: 'CREATE', result: 'success', target: 'Note', targetId: newNote.id, details: { title: newNote.title } });
    setNotes((prev) => [newNote, ...prev]);
    setActiveNoteId(newNote.id);
    setShowList(false);
    notifyHeader(true, newNote.title);
  };

  const updateNoteContent = useCallback(
    (content: string) => {
      const now = new Date().toISOString();
      setNotes((prev) =>
        prev.map((n) =>
          n.id === activeNoteId ? { ...n, content, updatedAt: now } : n
        )
      );
      if (activeNoteId) {
        db.notes.update(activeNoteId, { content, updatedAt: now });
        opLogWriter.recordUpdate('notes', activeNoteId, { content, updatedAt: now });
      }
    },
    [activeNoteId]
  );

  const updateNoteTitle = useCallback(
    (title: string) => {
      const now = new Date().toISOString();
      setNotes((prev) =>
        prev.map((n) =>
          n.id === activeNoteId ? { ...n, title, updatedAt: now } : n
        )
      );
      if (activeNoteId) {
        db.notes.update(activeNoteId, { title, updatedAt: now });
        opLogWriter.recordUpdate('notes', activeNoteId, { title, updatedAt: now });
      }
      notifyHeader(true, title);
    },
    [activeNoteId, notifyHeader]
  );

  const deleteNote = async () => {
    if (!noteToDelete) return;
    const deletedNote = notes.find((n) => n.id === noteToDelete);
    const now = new Date().toISOString();
    // Always soft-delete — op-log sync handles propagation
    await db.notes.update(noteToDelete, { _deleted: true, updatedAt: now });
    await opLogWriter.recordDelete('notes', noteToDelete);
    await operationsLog.log({ category: 'NOTE', action: 'DELETE', result: 'success', target: 'Note', targetId: noteToDelete, details: { title: deletedNote?.title, contentPreview: deletedNote?.content?.slice(0, 200) } });
    const updated = notes.filter((n) => n.id !== noteToDelete);
    setNotes(updated);
    if (activeNoteId === noteToDelete) {
      setActiveNoteId(updated[0]?.id ?? null);
    }
    setNoteToDelete(null);
    setShowDeleteModal(false);
  };

  const selectNote = (id: string) => {
    setActiveNoteId(id);
    setShowList(false);
    const note = notes.find((n) => n.id === id);
    notifyHeader(true, note?.title);
  };

  return (
    <div className="notepad-page">
      {/* ── Note List Panel ──────────────────────────── */}
      <aside className={`notepad-list${showList ? ' notepad-list--open' : ''}`}>
        <div className="notepad-list__search sticky lg:top-10 z-10 bg-background shadow-sm shadow-background">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search notes…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              aria-label="Search notes"
            />
          </div>
          <Button
            size="sm"
            onClick={createNote}
            aria-label="Create new note"
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>

        <div className="notepad-list__items">
          {filteredNotes.length === 0 ? (
            <div className="notepad-list__empty">
              <FileText className="w-10 h-10 text-muted-foreground opacity-40" />
              <SmallMuted>
                {notes.length === 0 ? 'No notes yet' : 'No matches'}
              </SmallMuted>
            </div>
          ) : (
            filteredNotes.map((note) => (
              <Card
                key={note.id}
                className={`notepad-list__item${
                  activeNoteId === note.id ? ' notepad-list__item--active' : ''
                }`}
                onClick={() => selectNote(note.id)}
                role="button"
                aria-label={`Open note: ${note.title}`}
                aria-current={activeNoteId === note.id ? 'true' : undefined}
              >
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">
                        {note.title || 'Untitled'}
                      </p>
                      <SmallMuted>
                        {new Date(note.updatedAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </SmallMuted>
                    </div>
                    <button
                      className="shrink-0 p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        setNoteToDelete(note.id);
                        setShowDeleteModal(true);
                      }}
                      aria-label={`Delete note: ${note.title}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </aside>

      {/* ── Editor Panel ─────────────────────────────── */}
      <main className={`notepad-editor${!showList ? ' notepad-editor--open' : ''}`}>
        {activeNote ? (
          <>
            <div className="notepad-editor__toolbar">
              <Input
                value={activeNote.title}
                onChange={(e) => updateNoteTitle(e.target.value)}
                className="notepad-editor__title"
                placeholder="Note title…"
                aria-label="Note title"
              />
            </div>
            <div className="notepad-editor__canvas">
              <NoteEditor
                key={activeNote.id}
                initialContent={activeNote.content}
                onChange={updateNoteContent}
              />
            </div>
          </>
        ) : (
          <div className="notepad-editor__empty">
            <NotebookPen className="w-16 h-16 text-muted-foreground opacity-30" />
            <Text className="text-muted-foreground">
              Select a note or create a new one
            </Text>
            <Button onClick={createNote}>
              <Plus className="w-4 h-4 mr-2" />
              New Note
            </Button>
          </div>
        )}
      </main>

      {/* ── Delete Confirmation Modal ────────────────── */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete Note"
      >
        <p className="text-sm text-muted-foreground mb-4">
          Are you sure you want to delete this note? This action cannot be undone.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setShowDeleteModal(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={deleteNote}>
            Delete
          </Button>
        </div>
      </Modal>
    </div>
  );
}
