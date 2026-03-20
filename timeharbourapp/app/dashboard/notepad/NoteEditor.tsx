'use client';

import { useEffect, useRef } from 'react';
import { useCreateBlockNote } from '@blocknote/react';
import { BlockNoteView } from '@blocknote/mantine';
import '@blocknote/core/fonts/inter.css';
import '@blocknote/mantine/style.css';

interface NoteEditorProps {
  initialContent: string;
  onChange: (content: string) => void;
}

export default function NoteEditor({ initialContent, onChange }: NoteEditorProps) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  let parsedInitial: unknown[] | undefined;
  try {
    parsedInitial = initialContent ? JSON.parse(initialContent) : undefined;
  } catch {
    parsedInitial = undefined;
  }

  const editor = useCreateBlockNote({
    initialContent: parsedInitial as never,
  });

  useEffect(() => {
    if (!editor) return;
    const handler = () => {
      const json = JSON.stringify(editor.document);
      onChangeRef.current(json);
    };
    const unsubscribe = editor.onChange(handler);
    return unsubscribe;
  }, [editor]);

  if (!editor) return null;

  return (
    <BlockNoteView
      editor={editor}
      theme="light"
      className="notepad-blocknote"
    />
  );
}
