import React from 'react';

/**
 * Matches URLs with http(s):// or bare www. prefixes.
 * Uses a non-greedy approach to avoid capturing trailing punctuation.
 */
const URL_REGEX = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;

/**
 * Splits text on URLs and wraps each URL in a clickable <a> tag.
 * Bare `www.` URLs get `https://` prepended for the href.
 */
export function linkifyText(text: string): React.ReactNode[] {
  const parts = text.split(URL_REGEX);
  return parts.map((part, i) => {
    if (URL_REGEX.test(part)) {
      // Reset lastIndex since we use the global flag
      URL_REGEX.lastIndex = 0;
      const href = part.startsWith('http') ? part : `https://${part}`;
      return (
        <a
          key={i}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary-500 underline break-all"
          onClick={(e) => e.stopPropagation()}
        >
          {part}
        </a>
      );
    }
    return part;
  });
}
