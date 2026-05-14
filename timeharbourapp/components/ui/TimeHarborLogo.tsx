'use client';

import { useId } from 'react';

interface TimeHarborLogoProps {
  className?: string;
  size?: number;
}

// Pre-computed tick positions for 12 hour markers
const ticks = Array.from({ length: 12 }, (_, i) => {
  const angle = (i * 30 * Math.PI) / 180;
  return {
    x1: +(100 + 78 * Math.sin(angle)).toFixed(2),
    y1: +(100 - 78 * Math.cos(angle)).toFixed(2),
    x2: +(100 + 68 * Math.sin(angle)).toFixed(2),
    y2: +(100 - 68 * Math.cos(angle)).toFixed(2),
  };
});

/**
 * TimeHarbor brand logo — clock face with navy ring and teal harbor waves.
 * Colors match the original brand asset exactly.
 */
export function TimeHarborLogo({ className, size = 40 }: TimeHarborLogoProps) {
  const uid = useId();
  // Sanitize React's ":r0:" style ids for SVG attribute compatibility
  const clipId = `th-logo-clip-${uid.replace(/:/g, '')}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <clipPath id={clipId}>
          {/* Clip waves to just inside the ring's inner edge */}
          <circle cx="100" cy="100" r="81" />
        </clipPath>
      </defs>

      {/* White clock face */}
      <circle cx="100" cy="100" r="88" fill="white" />

      {/* Outer thick navy ring */}
      <circle cx="100" cy="100" r="88" fill="none" stroke="#1d3557" strokeWidth="14" />

      {/* Hour tick marks */}
      {ticks.map((t, i) => (
        <line
          key={i}
          x1={t.x1} y1={t.y1}
          x2={t.x2} y2={t.y2}
          stroke="#1d3557"
          strokeWidth="4.5"
          strokeLinecap="round"
        />
      ))}

      {/* Minute hand — near 12, slightly right (~5°) */}
      {/* x2 = 100 + 56*sin(5°) = 105, y2 = 100 - 56*cos(5°) = 44 */}
      <line x1="100" y1="100" x2="105" y2="44" stroke="#1d3557" strokeWidth="5" strokeLinecap="round" />

      {/* Hour hand — pointing to ~10 o'clock (300°) */}
      {/* x2 = 100 + 38*sin(300°) = 67, y2 = 100 - 38*cos(300°) = 81 */}
      <line x1="100" y1="100" x2="67" y2="81" stroke="#1d3557" strokeWidth="6.5" strokeLinecap="round" />

      {/* Center pivot dot */}
      <circle cx="100" cy="100" r="6" fill="#1d3557" />

      {/* Harbor waves — clipped to circle interior */}
      <g clipPath={`url(#${clipId})`}>
        {/* Back wave — deeper steel blue */}
        <path
          d="M -10 122 C 20 105 50 140 80 122 C 110 105 140 140 170 122 C 185 113 200 117 215 122 L 215 200 L -10 200 Z"
          fill="#4a8fa8"
        />
        {/* Front wave — lighter teal */}
        <path
          d="M -10 137 C 25 118 55 154 85 137 C 115 118 145 154 175 137 C 190 128 203 132 215 137 L 215 200 L -10 200 Z"
          fill="#6dbdd0"
        />
      </g>
    </svg>
  );
}
