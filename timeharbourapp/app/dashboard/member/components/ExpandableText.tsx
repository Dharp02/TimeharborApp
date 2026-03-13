'use client';

import { useState } from 'react';
import { Button } from '@mieweb/ui';

export function ExpandableText({ text, limit = 60 }: { text: string; limit?: number }) {
  const [expanded, setExpanded] = useState(false);

  if (text.length <= limit) {
    return <span>{text}</span>;
  }

  return (
    <span>
      {expanded ? text : `${text.substring(0, limit)}...`}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setExpanded(!expanded)}
        className="ml-1 text-primary-500 dark:text-primary-400 hover:underline text-xs font-medium focus:outline-none p-0 h-auto"
      >
        {expanded ? 'See Less' : 'See More'}
      </Button>
    </span>
  );
}
