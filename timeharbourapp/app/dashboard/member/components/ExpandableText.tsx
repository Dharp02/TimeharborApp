'use client';

import { useState } from 'react';

export function ExpandableText({ text, limit = 60 }: { text: string; limit?: number }) {
  const [expanded, setExpanded] = useState(false);

  if (text.length <= limit) {
    return <span>{text}</span>;
  }

  return (
    <span>
      {expanded ? text : `${text.substring(0, limit)}...`}
      <button
        onClick={() => setExpanded(!expanded)}
        className="ml-1 text-blue-500 dark:text-blue-400 hover:underline text-xs font-medium focus:outline-none"
      >
        {expanded ? 'See Less' : 'See More'}
      </button>
    </span>
  );
}
